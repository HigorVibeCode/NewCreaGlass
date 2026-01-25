import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Modal, TouchableWithoutFeedback, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../../src/hooks/use-i18n';
import { ScreenWrapper } from '../../src/components/shared/ScreenWrapper';
import { DropdownOption } from '../../src/components/shared/Dropdown';
import { PermissionGuard } from '../../src/components/shared/PermissionGuard';
import { repos } from '../../src/services/container';
import { Production, ProductionStatus, InventoryItem } from '../../src/types';
import { theme } from '../../src/theme';
import { useThemeColors } from '../../src/hooks/use-theme-colors';
import { useAuth } from '../../src/store/auth-store';

export default function ProductionScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const { user } = useAuth();
  const [productions, setProductions] = useState<Production[]>([]);
  const [allProductions, setAllProductions] = useState<Production[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<ProductionStatus | 'all'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [glassItems, setGlassItems] = useState<Map<string, InventoryItem>>(new Map());

  const loadProductions = useCallback(async () => {
    setIsLoading(true);
    try {
      const status = selectedStatus === 'all' ? undefined : selectedStatus;
      const fetchedProductions = await repos.productionRepo.getAllProductions(status);
      // Filter out completed productions - they go to history only
      const activeProductions = fetchedProductions.filter(p => p.status !== 'completed');
      setAllProductions(activeProductions);
      
      // Load glass items for all productions
      const glassIds = new Set<string>();
      activeProductions.forEach(prod => {
        prod.items.forEach(item => {
          if (item.glassId) {
            glassIds.add(item.glassId);
          }
        });
      });
      
      const glassMap = new Map<string, InventoryItem>();
      for (const glassId of glassIds) {
        try {
          const glassItem = await repos.inventoryRepo.getItemById(glassId);
          if (glassItem) {
            glassMap.set(glassId, glassItem);
          }
        } catch (error) {
          console.error(`Error loading glass item ${glassId}:`, error);
        }
      }
      setGlassItems(glassMap);
    } catch (error) {
      console.error('Error loading productions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedStatus]);

  useEffect(() => {
    loadProductions();
  }, [loadProductions]);

  useFocusEffect(
    useCallback(() => {
      loadProductions();
    }, [loadProductions])
  );

  const handleCreateProduction = () => {
    router.push('/production-create');
  };

  const statusOptions: DropdownOption[] = [
    { label: t('production.status.all'), value: 'all' },
    { label: t('production.status.not_authorized'), value: 'not_authorized' },
    { label: t('production.status.authorized'), value: 'authorized' },
    { label: t('production.status.cutting'), value: 'cutting' },
    { label: t('production.status.polishing'), value: 'polishing' },
    { label: t('production.status.on_paint_cabin'), value: 'on_paint_cabin' },
    { label: t('production.status.on_laminating_machine'), value: 'on_laminating_machine' },
    { label: t('production.status.on_schmelz_oven'), value: 'on_schmelz_oven' },
    { label: t('production.status.waiting_for_tempering'), value: 'waiting_for_tempering' },
    { label: t('production.status.waiting_for_schmelz'), value: 'waiting_for_schmelz' },
    { label: t('production.status.tempering_in_progress'), value: 'tempering_in_progress' },
    { label: t('production.status.tempered'), value: 'tempered' },
    { label: t('production.status.waiting_for_packing'), value: 'waiting_for_packing' },
    { label: t('production.status.packed'), value: 'packed' },
    { label: t('production.status.ready_for_dispatch'), value: 'ready_for_dispatch' },
    { label: t('production.status.delivered'), value: 'delivered' },
    { label: t('production.status.completed'), value: 'completed' },
  ];

  const getStatusColor = (status: ProductionStatus): string => {
    switch (status) {
      case 'not_authorized':
        return colors.error; // vermelho
      case 'authorized':
        return colors.success; // verde
      case 'cutting':
        return colors.info; // azul
      case 'polishing':
        return colors.info; // azul
      case 'on_paint_cabin':
        return '#f97316'; // laranja
      case 'on_laminating_machine':
        return '#f97316'; // laranja
      case 'on_schmelz_oven':
        return '#f97316'; // laranja
      case 'waiting_for_tempering':
        return colors.warning; // Amarelo
      case 'waiting_for_schmelz':
        return colors.warning; // Amarelo
      case 'tempering_in_progress':
        return '#8b5cf6'; // Roxo
      case 'tempered':
        return '#8b5cf6'; // Roxo
      case 'waiting_for_packing':
        return colors.warning; // Amarelo
      case 'packed':
        return colors.info; // azul
      case 'ready_for_dispatch':
        return '#34d399'; // verde claro
      case 'delivered':
        return '#059669'; // verde escuro
      case 'completed':
        return '#059669'; // verde escuro
      // Compatibilidade com status antigos
      case 'on_cabin':
        return '#f97316'; // laranja (mapeado para on_paint_cabin)
      case 'laminating':
        return '#f97316'; // laranja (mapeado para on_laminating_machine)
      case 'laminated':
        return colors.info; // azul (mantido para compatibilidade)
      case 'on_oven':
        return '#f97316'; // laranja (mapeado para on_schmelz_oven)
      default:
        return colors.textSecondary;
    }
  };

  const getStatusLabel = (status: ProductionStatus): string => {
    switch (status) {
      case 'not_authorized':
        return t('production.status.not_authorized');
      case 'authorized':
        return t('production.status.authorized');
      case 'cutting':
        return t('production.status.cutting');
      case 'polishing':
        return t('production.status.polishing');
      case 'on_paint_cabin':
        return t('production.status.on_paint_cabin');
      case 'on_laminating_machine':
        return t('production.status.on_laminating_machine');
      case 'on_schmelz_oven':
        return t('production.status.on_schmelz_oven');
      case 'waiting_for_tempering':
        return t('production.status.waiting_for_tempering');
      case 'waiting_for_schmelz':
        return t('production.status.waiting_for_schmelz');
      case 'tempering_in_progress':
        return t('production.status.tempering_in_progress');
      case 'tempered':
        return t('production.status.tempered');
      case 'waiting_for_packing':
        return t('production.status.waiting_for_packing');
      case 'packed':
        return t('production.status.packed');
      case 'ready_for_dispatch':
        return t('production.status.ready_for_dispatch');
      case 'delivered':
        return t('production.status.delivered');
      case 'completed':
        return t('production.status.completed');
      // Compatibilidade com status antigos
      case 'on_cabin':
        return t('production.status.on_paint_cabin');
      case 'laminating':
        return t('production.status.on_laminating_machine');
      case 'laminated':
        return t('production.status.laminated') || 'Laminated';
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

  const handleFilterSelect = (value: string) => {
    setSelectedStatus(value as ProductionStatus | 'all');
    setFilterModalVisible(false);
  };

  // Filter and sort productions based on search term and due date
  const filteredProductions = useMemo(() => {
    let filtered = allProductions;
    
    // Apply search filter if there's a search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      
      filtered = allProductions.filter(production => {
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
    
    // Sort by due date (ascending - closest dates first)
    return filtered.sort((a, b) => {
      const dateA = new Date(a.dueDate).getTime();
      const dateB = new Date(b.dueDate).getTime();
      return dateA - dateB;
    });
  }, [allProductions, searchTerm, glassItems]);

  // Update productions when filtered list changes
  useEffect(() => {
    setProductions(filteredProductions);
  }, [filteredProductions]);

  return (
    <ScreenWrapper>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <View style={styles.topBar}>
            {/* Search Bar */}
            <View style={[styles.searchContainer, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder={t('production.searchPlaceholder') || 'Buscar por cliente, número, tipo ou item...'}
                placeholderTextColor={colors.textTertiary}
                value={searchTerm}
                onChangeText={setSearchTerm}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchTerm.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchTerm('')}
                  style={styles.clearButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[styles.historyButton, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => router.push('/production-orders-history')}
              activeOpacity={0.7}
            >
              <Ionicons name="checkbox-outline" size={20} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => setFilterModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="filter" size={20} color={colors.text} />
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
                        {t('production.filterByStatus')}
                      </Text>
                      <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                        <Ionicons name="close" size={24} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.optionsList} nestedScrollEnabled>
                      {statusOptions.map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.optionItem,
                            { borderBottomColor: colors.borderLight },
                            selectedStatus === option.value && { backgroundColor: colors.primary + '10' },
                          ]}
                          onPress={() => handleFilterSelect(option.value)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.optionText,
                              { color: colors.text },
                              selectedStatus === option.value && { 
                                fontWeight: theme.typography.fontWeight.semibold, 
                                color: colors.primary 
                              },
                            ]}
                          >
                            {option.label}
                          </Text>
                          {selectedStatus === option.value && (
                            <Ionicons name="checkmark" size={20} color={colors.primary} />
                          )}
                        </TouchableOpacity>
                      ))}
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
              {productions.map((production) => (
                <TouchableOpacity
                  key={production.id}
                  style={[styles.orderCard, { backgroundColor: colors.cardBackground }]}
                  activeOpacity={0.7}
                  onPress={() => router.push({
                    pathname: '/production-detail',
                    params: { productionId: production.id },
                  })}
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
                          { backgroundColor: getStatusColor(production.status) + '20' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            { color: getStatusColor(production.status) },
                          ]}
                        >
                          {getStatusLabel(production.status)}
                        </Text>
                      </View>
                      <Text style={[styles.dueDate, { color: colors.textSecondary }]}>
                        {new Date(production.dueDate).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    flex: 1,
    marginRight: theme.spacing.sm,
    minWidth: 0,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.typography.fontSize.md,
    paddingVertical: theme.spacing.sm,
    minWidth: 0,
  },
  clearButton: {
    marginLeft: theme.spacing.xs,
    padding: theme.spacing.xs,
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
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
  },
  optionText: {
    fontSize: theme.typography.fontSize.md,
    flex: 1,
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
  dueDate: {
    fontSize: theme.typography.fontSize.xs,
    textAlign: 'right',
  },
});
