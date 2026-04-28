import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Modal, TouchableWithoutFeedback, TextInput, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../../src/hooks/use-i18n';
import { ScreenWrapper } from '../../src/components/shared/ScreenWrapper';
import { DatePicker } from '../../src/components/shared/DatePicker';
import { Dropdown } from '../../src/components/shared/Dropdown';
import { DropdownOption } from '../../src/components/shared/Dropdown';
import { PermissionGuard } from '../../src/components/shared/PermissionGuard';
import { repos } from '../../src/services/container';
import { supabase } from '../../src/services/supabase';
import { Production, ProductionCompany, ProductionStatus, InventoryItem } from '../../src/types';
import { theme } from '../../src/theme';
import { useThemeColors } from '../../src/hooks/use-theme-colors';
import { useAuth } from '../../src/store/auth-store';
import { formatDate } from '../../src/utils/date-format';
import { pushWithParams } from '../../src/utils/navigation';

// Alert levels for waiting status cards
// 0 = no alert, 1 = >8h slow pulse, 2 = >24h pulse+darker, 3 = >48h pulse+alert
type WaitingAlertLevel = 0 | 1 | 2 | 3;

const WAITING_STATUSES: ProductionStatus[] = [
  'waiting_to_cnc_wjet',
  'waiting_to_drill',
  'waiting_to_paint_cabin',
  'waiting_for_schmelz',
  'waiting_for_tempering',
  'waiting_for_packing',
];

/** Compute alert level based on hours waiting */
function getAlertLevel(hours: number): WaitingAlertLevel {
  if (hours > 48) return 3;
  if (hours > 24) return 2;
  if (hours > 8) return 1;
  return 0;
}

/** Pulse speed per alert level (ms per half-cycle) */
function getPulseDuration(level: WaitingAlertLevel): number {
  switch (level) {
    case 1: return 1800; // slow
    case 2: return 1200; // medium
    case 3: return 800;  // fast
    default: return 1800;
  }
}

/** Color for pulse — always the same vivid yellow */
function getPulseColor(_level: WaitingAlertLevel): string {
  return '#eab308'; // yellow-500 vivid for all levels
}

/** Animated wrapper that adds a pulse glow effect for waiting cards */
function WaitingPulseCard({ children, alertLevel }: { children: React.ReactNode; alertLevel: WaitingAlertLevel }) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (alertLevel > 0) {
      const duration = getPulseDuration(alertLevel);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [alertLevel]);

  if (alertLevel === 0) {
    return <>{children}</>;
  }

  const color = getPulseColor(alertLevel);

  const borderColor = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [`${color}00`, `${color}90`],
  });

  const shadowOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, alertLevel >= 2 ? 0.5 : 0.3],
  });

  return (
    <Animated.View
      style={{
        borderRadius: theme.borderRadius.md,
        borderWidth: alertLevel >= 2 ? 2 : 1.5,
        borderColor,
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity,
        shadowRadius: alertLevel >= 3 ? 12 : 8,
        elevation: alertLevel >= 2 ? 6 : 4,
      }}
    >
      {children}
    </Animated.View>
  );
}

export default function ProductionScreen() {
  'use no memo';
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const { user } = useAuth();
  const isFocused = useIsFocused();
  const [productions, setProductions] = useState<Production[]>([]);
  const [allProductions, setAllProductions] = useState<Production[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<ProductionStatus | 'all'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<ProductionCompany | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGlassId, setSelectedGlassId] = useState<string>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [draftStatus, setDraftStatus] = useState<ProductionStatus | 'all'>('all');
  const [draftCompany, setDraftCompany] = useState<ProductionCompany | 'all'>('all');
  const [draftSearchTerm, setDraftSearchTerm] = useState('');
  const [draftGlassId, setDraftGlassId] = useState<string>('all');
  const [draftFromDate, setDraftFromDate] = useState('');
  const [draftToDate, setDraftToDate] = useState('');
  const [showFinished, setShowFinished] = useState(false); // false = oculta cancelled/packed/dispatch/delivered/completed
  const [glassItems, setGlassItems] = useState<Map<string, InventoryItem>>(new Map());
  const [waitingHoursMap, setWaitingHoursMap] = useState<Map<string, number>>(new Map());

  const resetFiltersToInitialState = useCallback(() => {
    setSelectedStatus('all');
    setSelectedCompany('all');
    setSearchTerm('');
    setSelectedGlassId('all');
    setFromDate('');
    setToDate('');
    setDraftStatus('all');
    setDraftCompany('all');
    setDraftSearchTerm('');
    setDraftGlassId('all');
    setDraftFromDate('');
    setDraftToDate('');
  }, []);

  const loadProductions = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedProductions = await repos.productionRepo.getAllProductions();
      setAllProductions(fetchedProductions);

      const glassIds = new Set<string>();
      fetchedProductions.forEach(prod => {
        prod.items.forEach(item => {
          if (item.glassId) glassIds.add(item.glassId);
        });
      });

      const waitingProds = fetchedProductions.filter(p =>
        WAITING_STATUSES.includes(p.status)
      );
      const waitingIds = waitingProds.map(p => p.id);

      const [glassItems, historyResult] = await Promise.all([
        glassIds.size > 0
          ? repos.inventoryRepo.getItemsByIds(Array.from(glassIds))
          : Promise.resolve([]),
        waitingIds.length > 0
          ? supabase
              .from('production_status_history')
              .select('production_id, changed_at')
              .in('production_id', waitingIds)
              .order('changed_at', { ascending: false })
          : Promise.resolve({ data: null }),
      ]);

      const glassMap = new Map<string, InventoryItem>();
      for (const item of glassItems) {
        glassMap.set(item.id, item);
      }
      setGlassItems(glassMap);

      if (waitingProds.length > 0) {
        const latestChangeMap = new Map<string, string>();
        for (const entry of historyResult.data || []) {
          if (!latestChangeMap.has(entry.production_id)) {
            latestChangeMap.set(entry.production_id, entry.changed_at);
          }
        }
        const now = Date.now();
        const hoursMap = new Map<string, number>();
        for (const prod of waitingProds) {
          const changedAt = latestChangeMap.get(prod.id);
          const timestamp = changedAt || prod.createdAt;
          if (timestamp) {
            const diff = now - new Date(timestamp).getTime();
            hoursMap.set(prod.id, diff / (1000 * 60 * 60));
          }
        }
        setWaitingHoursMap(hoursMap);
      } else {
        setWaitingHoursMap(new Map());
      }
    } catch (error) {
      console.error('Error loading productions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      // Regra A: sempre entrar na tela com filtros zerados
      resetFiltersToInitialState();
      loadProductions();
    }
  }, [isFocused, loadProductions, resetFiltersToInitialState]);

  const handleCreateProduction = () => {
    router.push('/production-create');
  };

  const statusOptions: DropdownOption[] = [
    { label: t('production.status.all'), value: 'all' },
    // Red group
    { label: t('production.status.not_authorized'), value: 'not_authorized' },
    { label: t('production.status.cancelled'), value: 'cancelled' },
    { label: t('production.status.rework_needed'), value: 'rework_needed' },
    // Green (entry)
    { label: `${t('production.status.authorized')} 🔔`, value: 'authorized' },
    // Orange group (active processes)
    { label: t('production.status.on_cutting_process'), value: 'on_cutting_process' },
    { label: t('production.status.on_polishing_process'), value: 'on_polishing_process' },
    { label: t('production.status.on_paint_cabin'), value: 'on_paint_cabin' },
    { label: t('production.status.on_laminating_machine'), value: 'on_laminating_machine' },
    { label: t('production.status.on_schmelz_oven'), value: 'on_schmelz_oven' },
    { label: t('production.status.on_banding_oven'), value: 'on_banding_oven' },
    { label: t('production.status.tempering_in_progress'), value: 'tempering_in_progress' },
    // Yellow group (waiting)
    { label: t('production.status.waiting_to_cnc_wjet'), value: 'waiting_to_cnc_wjet' },
    { label: t('production.status.waiting_to_drill'), value: 'waiting_to_drill' },
    { label: t('production.status.waiting_to_paint_cabin'), value: 'waiting_to_paint_cabin' },
    { label: t('production.status.waiting_for_schmelz'), value: 'waiting_for_schmelz' },
    { label: t('production.status.waiting_for_tempering'), value: 'waiting_for_tempering' },
    { label: t('production.status.waiting_for_packing'), value: 'waiting_for_packing' },
    // Blue group
    { label: t('production.status.packed'), value: 'packed' },
    { label: t('production.status.ready_for_dispatch'), value: 'ready_for_dispatch' },
    // Green (exit)
    { label: t('production.status.delivered'), value: 'delivered' },
    { label: t('production.status.completed'), value: 'completed' },
  ];

  const getStatusColor = (status: ProductionStatus): string => {
    switch (status) {
      // Red group
      case 'not_authorized':
      case 'cancelled':
      case 'rework_needed':
        return colors.error; // vermelho
      // Green (entry)
      case 'authorized':
        return colors.success; // verde
      // Orange group (active processes)
      case 'on_cutting_process':
      case 'on_polishing_process':
      case 'on_paint_cabin':
      case 'on_laminating_machine':
      case 'on_schmelz_oven':
      case 'on_banding_oven':
      case 'tempering_in_progress':
        return '#f97316'; // laranja
      // Yellow group (waiting)
      case 'waiting_to_cnc_wjet':
      case 'waiting_to_drill':
      case 'waiting_to_paint_cabin':
      case 'waiting_for_schmelz':
      case 'waiting_for_tempering':
      case 'waiting_for_packing':
        return '#eab308'; // amarelo
      // Blue group
      case 'packed':
      case 'ready_for_dispatch':
        return colors.info; // azul
      // Green (exit)
      case 'delivered':
      case 'completed':
        return '#059669'; // verde escuro
      // Compatibilidade com status antigos
      case 'cutting':
      case 'polishing':
        return '#f97316'; // laranja (mapeado para on_cutting/polishing_process)
      case 'tempered':
        return '#059669'; // verde
      case 'on_cabin':
        return '#f97316'; // laranja
      case 'laminating':
        return '#f97316'; // laranja
      case 'laminated':
        return colors.info; // azul
      case 'on_oven':
        return '#f97316'; // laranja
      default:
        return colors.textSecondary;
    }
  };

  const getStatusLabel = (status: ProductionStatus): string => {
    // Try to get translation key directly
    const key = `production.status.${status}`;
    const translated = t(key);
    // If translation returns the key itself, it means no translation exists — fallback
    if (translated && translated !== key) {
      return translated;
    }
    // Compatibility fallback for old statuses
    switch (status) {
      case 'on_cabin':
        return t('production.status.on_paint_cabin');
      case 'laminating':
        return t('production.status.on_laminating_machine');
      case 'on_oven':
        return t('production.status.on_schmelz_oven');
      default:
        return status;
    }
  };

  const getOrderTypeLabel = (orderType: string): string => {
    return orderType || '';
  };

  const getGlassNames = (production: Production): string => {
    if (!production.items || production.items.length === 0) {
      return '-';
    }
    
    const glassNames = production.items
      .map(item => {
        if (!item.glassId) return null;
        const glassItem = glassItems.get(item.glassId);
        return glassItem?.name || null;
      })
      .filter((name): name is string => name !== null);
    
    if (glassNames.length === 0) {
      return '-';
    }
    
    // Se houver múltiplos vidros, mostra os primeiros e indica se há mais
    if (glassNames.length === 1) {
      return glassNames[0];
    } else if (glassNames.length <= 3) {
      return glassNames.join(', ');
    } else {
      return `${glassNames.slice(0, 2).join(', ')} +${glassNames.length - 2}`;
    }
  };

  const companyOptions: DropdownOption[] = [
    { label: t('production.allCompanies'), value: 'all' },
    { label: '3S', value: '3S' },
    { label: 'Crea Glass', value: 'Crea Glass' },
  ];

  const glassOptions: DropdownOption[] = useMemo(() => {
    const usedGlassIds = new Set<string>();
    allProductions.forEach((production) => {
      production.items.forEach((item) => {
        if (item.glassId) usedGlassIds.add(item.glassId);
      });
    });

    const options = Array.from(usedGlassIds)
      .map((glassId) => {
        const glass = glassItems.get(glassId);
        return glass ? { label: glass.name, value: glass.id } : null;
      })
      .filter((option): option is DropdownOption => option !== null)
      .sort((a, b) => a.label.localeCompare(b.label));

    return [{ label: 'Todos os vidros', value: 'all' }, ...options];
  }, [allProductions, glassItems]);

  const hasActiveFilters = useMemo(() => {
    return (
      selectedStatus !== 'all' ||
      selectedCompany !== 'all' ||
      !!searchTerm.trim() ||
      selectedGlassId !== 'all' ||
      !!fromDate.trim() ||
      !!toDate.trim()
    );
  }, [selectedStatus, selectedCompany, searchTerm, selectedGlassId, fromDate, toDate]);

  const openFilterModal = () => {
    setDraftStatus(selectedStatus);
    setDraftCompany(selectedCompany);
    setDraftSearchTerm(searchTerm);
    setDraftGlassId(selectedGlassId);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setFilterModalVisible(true);
  };

  const applyFilters = () => {
    setSelectedStatus(draftStatus);
    setSelectedCompany(draftCompany);
    setSearchTerm(draftSearchTerm.trim());
    setSelectedGlassId(draftGlassId);
    setFromDate(draftFromDate.trim());
    setToDate(draftToDate.trim());
    setFilterModalVisible(false);
  };

  const clearFilters = () => {
    resetFiltersToInitialState();
  };

  // Statuses hidden by default when showFinished is off
  const HIDDEN_STATUSES: ProductionStatus[] = [
    'cancelled', 'packed', 'ready_for_dispatch', 'delivered', 'completed',
  ];

  // Filter and sort productions based on search term, company and due date
  const filteredProductions = useMemo(() => {
    let filtered = allProductions;

    // Hide finished/archived statuses unless toggle is active
    if (!showFinished) {
      filtered = filtered.filter(p => !HIDDEN_STATUSES.includes(p.status));
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(p => p.status === selectedStatus);
    }

    // Apply company filter
    if (selectedCompany !== 'all') {
      filtered = filtered.filter(p => p.company === selectedCompany);
    }
    
    // Apply search filter if there's a search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      
      filtered = filtered.filter(production => {
        // Search in client name
        if (production.clientName?.toLowerCase().includes(searchLower)) {
          return true;
        }
        
        // Search in order number
        if (production.orderNumber?.toLowerCase().includes(searchLower)) {
          return true;
        }
        
        // Search in order type
        if (production.orderType?.toLowerCase().includes(searchLower)) {
          return true;
        }
        
        // Search in glass items names
        if (production.items && production.items.length > 0) {
          const hasMatchingItem = production.items.some(item => {
            if (!item.glassId) return false;
            const glassItem = glassItems.get(item.glassId);
            if (glassItem?.name?.toLowerCase().includes(searchLower)) {
              return true;
            }
            return false;
          });
          
          if (hasMatchingItem) {
            return true;
          }
        }
        
        return false;
      });
    }

    if (selectedGlassId !== 'all') {
      filtered = filtered.filter(production =>
        production.items?.some(item => {
          return item.glassId === selectedGlassId;
        })
      );
    }

    if (fromDate) {
      const fromTimestamp = new Date(`${fromDate}T00:00:00`).getTime();
      filtered = filtered.filter(p => new Date(p.createdAt).getTime() >= fromTimestamp);
    }
    if (toDate) {
      const toTimestamp = new Date(`${toDate}T23:59:59`).getTime();
      filtered = filtered.filter(p => new Date(p.createdAt).getTime() <= toTimestamp);
    }
    
    // Sort by due date (ascending - closest dates first)
    return filtered.sort((a, b) => {
      const dateA = new Date(a.dueDate).getTime();
      const dateB = new Date(b.dueDate).getTime();
      return dateA - dateB;
    });
  }, [allProductions, searchTerm, selectedGlassId, fromDate, toDate, selectedCompany, selectedStatus, showFinished]);

  // Update productions when filtered list changes
  useEffect(() => {
    setProductions(filteredProductions);
  }, [filteredProductions]);

  return (
    <ScreenWrapper>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <View style={styles.topBar}>
            <TouchableOpacity
              style={[
                styles.searchButton,
                { backgroundColor: colors.backgroundSecondary, borderColor: hasActiveFilters ? colors.primary : colors.border },
              ]}
              onPress={openFilterModal}
              activeOpacity={0.7}
            >
              <Ionicons name="search" size={20} color={hasActiveFilters ? colors.primary : colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                { backgroundColor: showFinished ? colors.primary + '30' : colors.backgroundSecondary },
              ]}
              onPress={() => setShowFinished(!showFinished)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showFinished ? 'eye' : 'eye-off'}
                size={20}
                color={showFinished ? colors.primary : colors.text}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => router.push('/clients')}
              activeOpacity={0.7}
            >
              <Ionicons name="people-outline" size={20} color={colors.text} />
            </TouchableOpacity>
            <PermissionGuard permission="production.create">
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: colors.primary }]}
                onPress={handleCreateProduction}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={20} color={colors.textInverse} />
              </TouchableOpacity>
            </PermissionGuard>
          </View>

          <Modal
            visible={filterModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setFilterModalVisible(false)}
          >
            <TouchableWithoutFeedback onPress={() => setFilterModalVisible(false)}>
              <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
                <TouchableWithoutFeedback>
                  <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                    <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.modalTitle, { color: colors.text }]}>
                        {t('production.searchPlaceholder') || 'Filtros de Produção'}
                      </Text>
                      <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                        <Ionicons name="close" size={24} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.optionsList} nestedScrollEnabled>
                      <View style={styles.filterFields}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Busca geral</Text>
                        <View style={[styles.filterInputContainer, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                          <TextInput
                            style={[styles.filterInput, { color: colors.text }]}
                            placeholder={t('production.searchPlaceholder') || 'Cliente, numero, tipo...'}
                            placeholderTextColor={colors.textTertiary}
                            value={draftSearchTerm}
                            onChangeText={setDraftSearchTerm}
                            autoCapitalize="none"
                            autoCorrect={false}
                          />
                        </View>

                        <Dropdown
                          label="Vidro"
                          value={draftGlassId}
                          options={glassOptions}
                          onSelect={setDraftGlassId}
                        />

                        <Dropdown
                          label="Status"
                          value={draftStatus}
                          options={statusOptions}
                          onSelect={(value) => setDraftStatus(value as ProductionStatus | 'all')}
                        />

                        <Dropdown
                          label="Empresa"
                          value={draftCompany}
                          options={companyOptions}
                          onSelect={(value) => setDraftCompany(value as ProductionCompany | 'all')}
                        />

                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Periodo de criacao</Text>
                        <DatePicker
                          label="Data inicial"
                          value={draftFromDate}
                          onSelect={setDraftFromDate}
                          placeholder="Selecionar data inicial"
                        />
                        <DatePicker
                          label="Data final"
                          value={draftToDate}
                          onSelect={setDraftToDate}
                          placeholder="Selecionar data final"
                        />
                      </View>

                      <View style={styles.filterActions}>
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: colors.backgroundSecondary }]}
                          onPress={clearFilters}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.actionButtonText, { color: colors.text }]}>Limpar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: colors.primary }]}
                          onPress={applyFilters}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.actionButtonText, { color: colors.textInverse }]}>Aplicar</Text>
                        </TouchableOpacity>
                      </View>
                    </ScrollView>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </Modal>

          {productions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {t('production.noOrders')}
              </Text>
            </View>
          ) : (
            <View style={styles.ordersList}>
              {productions.map((production) => {
                const statusColor = getStatusColor(production.status);
                const isWaiting = WAITING_STATUSES.includes(production.status);
                const waitingHours = waitingHoursMap.get(production.id) || 0;
                const alertLevel: WaitingAlertLevel = isWaiting ? getAlertLevel(waitingHours) : 0;
                const badgeColor = statusColor;

                return (
                  <WaitingPulseCard key={production.id} alertLevel={alertLevel}>
                    <TouchableOpacity
                      style={[styles.orderCard, { backgroundColor: colors.cardBackground }]}
                      activeOpacity={0.7}
                      onPress={() => pushWithParams(router, '/production-detail', { productionId: production.id })}
                    >
                      <View style={styles.cardContent}>
                        <View style={styles.orderDetails}>
                          <View style={styles.clientRow}>
                            <Text style={[styles.clientName, { color: colors.text }]}>{production.clientName}</Text>
                            <Text style={[styles.separator, { color: colors.textSecondary }]}>•</Text>
                            <Text style={[styles.orderNumber, { color: colors.textSecondary }]}>{production.orderNumber}</Text>
                          </View>
                          <Text style={[styles.orderType, { color: colors.textSecondary }]}>
                            {getOrderTypeLabel(production.orderType)}
                          </Text>
                          <Text style={[styles.glassName, { color: colors.textSecondary }]}>
                            {getGlassNames(production)}
                          </Text>
                        </View>
                        <View style={styles.statusColumn}>
                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: badgeColor + '20' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusText,
                                { color: badgeColor },
                              ]}
                            >
                              {alertLevel >= 3 ? '⚠️ ' : ''}{getStatusLabel(production.status)}
                            </Text>
                          </View>
                          {isWaiting && waitingHours > 0 && (
                            <Text style={[styles.waitingTime, { color: badgeColor }]}>
                              {waitingHours >= 24
                                ? `${Math.floor(waitingHours / 24)}d ${Math.floor(waitingHours % 24)}h`
                                : `${Math.floor(waitingHours)}h`}
                            </Text>
                          )}
                          <Text style={[styles.dueDate, { color: colors.textSecondary }]}>
                            {formatDate(production.dueDate)}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </WaitingPulseCard>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
  },
  filterFields: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  fieldLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    marginTop: theme.spacing.xs,
  },
  filterInputContainer: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
  },
  filterInput: {
    fontSize: theme.typography.fontSize.md,
    paddingVertical: theme.spacing.sm,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    width: '100%',
  },
  historyButton: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  searchButton: {
    height: 36,
    minWidth: 72,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    ...theme.shadows.sm,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    borderRadius: theme.borderRadius.lg,
    width: '100%',
    maxWidth: 400,
    ...theme.shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  optionsList: {
    maxHeight: 400,
  },
  filterActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  actionButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
    padding: theme.spacing.xl,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.md,
    textAlign: 'center',
  },
  ordersList: {
    gap: theme.spacing.md,
  },
  orderCard: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  orderDetails: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
    flexWrap: 'wrap',
  },
  clientName: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    marginRight: theme.spacing.xs,
  },
  separator: {
    fontSize: theme.typography.fontSize.md,
    marginHorizontal: theme.spacing.xs,
  },
  orderNumber: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.medium,
  },
  glassName: {
    fontSize: theme.typography.fontSize.sm,
    marginTop: theme.spacing.xs,
  },
  orderType: {
    fontSize: theme.typography.fontSize.sm,
    marginTop: theme.spacing.xs,
  },
  statusColumn: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    minWidth: 100,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.xs,
    alignSelf: 'flex-end',
  },
  statusText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  waitingTime: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
    textAlign: 'right',
    marginBottom: 2,
  },
  dueDate: {
    fontSize: theme.typography.fontSize.xs,
    textAlign: 'right',
  },
});
