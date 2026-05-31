import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Modal, TouchableWithoutFeedback, ActivityIndicator, Animated, Platform, Easing, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../../src/hooks/use-i18n';
import { ScreenWrapper } from '../../src/components/shared/ScreenWrapper';
import { PermissionGuard } from '../../src/components/shared/PermissionGuard';
import { DropdownOption } from '../../src/components/shared/Dropdown';
import { repos } from '../../src/services/container';
import { Event, EventType, WorkOrder } from '../../src/types';
import { theme } from '../../src/theme';
import { useThemeColors } from '../../src/hooks/use-theme-colors';
import { formatDateTime as formatDateTimeUtil, formatTimestamp as formatTimestampUtil } from '../../src/utils/date-format';
import { pushWithParams } from '../../src/utils/navigation';

type EventOrWorkOrder = 
  | { type: 'event'; data: Event }
  | { type: 'workOrder'; data: WorkOrder };

// Componente que adiciona glow pulsante em torno do card (mesmo padrão da tela de produção)
function InProgressPulseCard({ children, active }: { children: React.ReactNode; active: boolean }) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [active]);

  if (!active) {
    return <>{children}</>;
  }

  const color = '#10b981'; // emerald green for in_progress

  const borderColor = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [`${color}00`, `${color}90`],
  });

  const shadowOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.4],
  });

  return (
    <Animated.View
      style={{
        borderRadius: theme.borderRadius.md,
        borderWidth: 2,
        borderColor,
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity,
        shadowRadius: 10,
        elevation: 5,
      }}
    >
      {children}
    </Animated.View>
  );
}

export default function EventsScreen() {
  'use no memo';
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const isFocused = useIsFocused();
  const [items, setItems] = useState<EventOrWorkOrder[]>([]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedType, setSelectedType] = useState<EventType | 'all'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [showCompleted, setShowCompleted] = useState(false); // false = oculta work orders concluídas
  const [searchQuery, setSearchQuery] = useState('');

  // Timer para atualizar tempo real dos serviços em andamento
  useEffect(() => {
    const hasInProgress = items.some(item => item.type === 'workOrder' && item.data.status === 'in_progress');
    if (hasInProgress) {
      const interval = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(interval);
    }
  }, [items]);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getWorkOrderTotalTime = (workOrder: WorkOrder): number => {
    const completedTime = (workOrder.timeStatuses || []).reduce((sum, ts) => sum + ts.totalDuration, 0);
    // Se há um time status ativo (sem endTime), calcular tempo real
    const activeTs = (workOrder.timeStatuses || []).find(ts => !ts.endTime);
    if (activeTs) {
      const elapsed = Math.floor((now - new Date(activeTs.startTime).getTime()) / 1000);
      return completedTime + elapsed;
    }
    return completedTime;
  };

  const getServiceStartTime = (workOrder: WorkOrder): string | null => {
    if (workOrder.checkIn?.timestamp) return workOrder.checkIn.timestamp;
    const firstTs = (workOrder.timeStatuses || [])[0];
    return firstTs?.startTime || null;
  };

  const getServiceEndTime = (workOrder: WorkOrder): string | null => {
    if (workOrder.status !== 'completed') return null;
    const timeStatuses = workOrder.timeStatuses || [];
    for (let i = timeStatuses.length - 1; i >= 0; i--) {
      if (timeStatuses[i].endTime) return timeStatuses[i].endTime!;
    }
    return null;
  };

  const formatTimestamp = (timestamp: string): string => {
    return formatTimestampUtil(timestamp);
  };

  const handleCreateEvent = () => {
    router.push('/event-create');
  };

  const handleCreateReport = () => {
    router.push('/event-report-create');
  };

  const handleFilter = () => {
    setFilterModalVisible(true);
  };

  const loadEventsAndWorkOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load events and work orders in parallel
      const [allEvents, allWorkOrders] = await Promise.all([
        repos.eventsRepo.getAllEvents(),
        repos.workOrdersRepo.getAllWorkOrders(), // Get all work orders (pending and completed)
      ]);

      // Filter events by type if selected
      const filteredEvents = selectedType === 'all' 
        ? allEvents 
        : allEvents.filter(event => event.type === selectedType);

      // Convert to unified format
      const eventItems: EventOrWorkOrder[] = filteredEvents.map(event => ({
        type: 'event',
        data: event,
      }));

      // Incluir todas as work orders (filtro de concluídas é aplicado na renderização)
      const workOrderItems: EventOrWorkOrder[] = allWorkOrders.map(workOrder => ({
        type: 'workOrder',
        data: workOrder,
      }));

      // Combine and sort by date (most recent/upcoming first)
      const combinedItems = [...eventItems, ...workOrderItems];
      
      combinedItems.sort((a, b) => {
        // Get date for comparison
        let dateA: Date;
        let dateB: Date;

        if (a.type === 'event') {
          dateA = new Date(`${a.data.startDate}T${a.data.startTime || '00:00'}`);
        } else {
          dateA = new Date(`${a.data.scheduledDate}T${a.data.scheduledTime || '00:00'}`);
        }

        if (b.type === 'event') {
          dateB = new Date(`${b.data.startDate}T${b.data.startTime || '00:00'}`);
        } else {
          dateB = new Date(`${b.data.scheduledDate}T${b.data.scheduledTime || '00:00'}`);
        }

        // Sort ascending (closest date first)
        return dateA.getTime() - dateB.getTime();
      });

      setItems(combinedItems);
    } catch (error) {
      console.error('Error loading events and work orders:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedType]);

  useEffect(() => {
    if (isFocused) {
      loadEventsAndWorkOrders();
    }
  }, [isFocused, loadEventsAndWorkOrders]);

  const handleFilterSelect = (value: string) => {
    setSelectedType(value as EventType | 'all');
    setFilterModalVisible(false);
  };

  const getTypeLabel = (type: EventType): string => {
    switch (type) {
      case 'meeting':
        return t('events.types.meeting');
      case 'training':
        return t('events.types.training');
      case 'maintenance':
        return t('events.types.maintenance');
      case 'installation':
        return t('events.types.installation');
      case 'inspection':
        return t('events.types.inspection');
      case 'other':
        return t('events.types.other');
      default:
        return type;
    }
  };

  const formatDateTime = (date: string, time: string): string => {
    if (!date) return '';
    return formatDateTimeUtil(date, time);
  };

  const getServiceTypeLabel = (type: string): string => {
    switch (type) {
      case 'maintenance':
        return t('workOrders.serviceTypeOptions.maintenance');
      case 'installation':
        return t('workOrders.serviceTypeOptions.installation');
      case 'internal':
        return t('workOrders.serviceTypeOptions.internal');
      case 'external':
        return t('workOrders.serviceTypeOptions.external');
      default:
        return type;
    }
  };

  const getWorkOrderStatusLabel = (status: string): string => {
    switch (status) {
      case 'planned':
        return t('workOrders.status.planned');
      case 'in_progress':
        return t('workOrders.status.in_progress');
      case 'paused':
        return t('workOrders.status.paused');
      case 'completed':
        return t('workOrders.status.completed');
      case 'cancelled':
        return t('workOrders.status.cancelled');
      default:
        return status;
    }
  };

  const getWorkOrderStatusColor = (status: string): string => {
    switch (status) {
      case 'planned':
        return '#6366f1'; // Indigo - planejado
      case 'in_progress':
        return '#059669'; // Verde esmeralda - em progresso
      case 'paused':
        return '#f59e0b'; // Amarelo - pausado
      case 'completed':
        return '#10b981'; // Verde claro - concluído
      case 'cancelled':
        return '#ef4444'; // Vermelho - cancelado
      default:
        return colors.textSecondary;
    }
  };

  const getWorkOrderStatusIcon = (status: string): string => {
    switch (status) {
      case 'planned':
        return 'calendar-outline';
      case 'in_progress':
        return 'play-circle';
      case 'paused':
        return 'pause-circle';
      case 'completed':
        return 'checkmark-circle';
      case 'cancelled':
        return 'close-circle';
      default:
        return 'ellipse';
    }
  };

  const typeOptions: DropdownOption[] = [
    { label: t('events.filterByType'), value: 'all' },
    { label: t('events.types.meeting'), value: 'meeting' },
    { label: t('events.types.training'), value: 'training' },
    { label: t('events.types.maintenance'), value: 'maintenance' },
    { label: t('events.types.installation'), value: 'installation' },
    { label: t('events.types.inspection'), value: 'inspection' },
    { label: t('events.types.other'), value: 'other' },
  ];

  const visibleItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const statusFiltered = showCompleted
      ? items
      : items.filter((item) => {
          if (item.type === 'workOrder' && item.data.status === 'completed') return false;
          if (item.type === 'event' && item.data.status === 'completed') return false;
          return true;
        });

    if (!normalizedQuery) return statusFiltered;

    return statusFiltered.filter((item) => {
      if (item.type === 'event') {
        const event = item.data;
        const eventTypeLabel = getTypeLabel(event.type).toLowerCase();
        return [
          event.title,
          event.location || '',
          event.people || '',
          eventTypeLabel,
        ].some((value) => value.toLowerCase().includes(normalizedQuery));
      }

      const workOrder = item.data;
      const serviceTypeLabel = getServiceTypeLabel(workOrder.serviceType).toLowerCase();
      return [
        workOrder.clientName,
        workOrder.clientAddress || '',
        workOrder.clientContact || '',
        serviceTypeLabel,
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [items, showCompleted, searchQuery]);

  return (
    <ScreenWrapper>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <View style={styles.topBar}>
            <View style={[styles.searchContainer, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <Ionicons name="search" size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t('common.search')}
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {!!searchQuery && (
                <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: colors.backgroundSecondary }]}
              onPress={handleFilter}
              activeOpacity={0.7}
            >
              <Ionicons name="filter" size={20} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterButton,
                { backgroundColor: showCompleted ? colors.primary + '30' : colors.backgroundSecondary },
              ]}
              onPress={() => setShowCompleted(!showCompleted)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showCompleted ? 'eye' : 'eye-off'}
                size={20}
                color={showCompleted ? colors.primary : colors.text}
              />
            </TouchableOpacity>

            <PermissionGuard permission="events.report.create">
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#059669' }]}
                onPress={handleCreateReport}
                activeOpacity={0.7}
              >
                <Text style={[styles.buttonText, { color: '#ffffff' }]}>{t('events.addWorkOrder')}</Text>
              </TouchableOpacity>
            </PermissionGuard>

            <PermissionGuard permission="events.create">
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: '#ea580c' }]}
                onPress={handleCreateEvent}
                activeOpacity={0.7}
              >
                <Text style={[styles.buttonText, { color: '#ffffff' }]}>{t('events.addEvent')}</Text>
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
                        {t('events.filterByType')}
                      </Text>
                      <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                        <Ionicons name="close" size={24} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.optionsList} nestedScrollEnabled>
                      {typeOptions.map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.optionItem,
                            { borderBottomColor: colors.borderLight },
                            selectedType === option.value && { backgroundColor: colors.primary + '10' },
                          ]}
                          onPress={() => handleFilterSelect(option.value)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.optionText,
                              { color: colors.text },
                              selectedType === option.value && { 
                                fontWeight: theme.typography.fontWeight.semibold, 
                                color: colors.primary 
                              },
                            ]}
                          >
                            {option.label}
                          </Text>
                          {selectedType === option.value && (
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

          {(() => {
            if (visibleItems.length === 0) {
              return (
                <View style={styles.emptyState}>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('events.noData')}</Text>
                </View>
              );
            }

            return (
            <View style={styles.eventsList}>
              {visibleItems.map((item) => {
                if (item.type === 'event') {
                  const event = item.data;
                  const eventColor = '#ea580c'; // Laranja
                  const isEventCompleted = event.status === 'completed';

                  return (
                    <TouchableOpacity
                      key={`event-${event.id}`}
                      style={[styles.eventCard, { backgroundColor: colors.cardBackground }]}
                      activeOpacity={0.7}
                      onPress={() => {
                        pushWithParams(router, '/event-detail', { eventId: event.id });
                      }}
                    >
                      <View style={[styles.cardIndicator, { backgroundColor: eventColor }]} />
                      <View style={styles.cardContent}>
                        <View style={styles.cardHeader}>
                          <View style={styles.leftHeader}>
                            <View style={[styles.typeBadge, { backgroundColor: eventColor + '15' }]}>
                              <Ionicons name="calendar" size={16} color={eventColor} />
                              <Text style={[styles.typeLabel, { color: eventColor }]}>{t('events.eventLabel')}</Text>
                            </View>
                          </View>
                          {isEventCompleted && (
                            <View style={[styles.statusBadge, { backgroundColor: '#10b981' + '20' }]}>
                              <View style={styles.statusBadgeContent}>
                                <Ionicons name="checkmark-circle" size={12} color="#10b981" />
                                <Text style={[styles.statusText, { color: '#10b981' }]}>
                                  {t('events.statusCompleted') || 'Concluído'}
                                </Text>
                              </View>
                            </View>
                          )}
                        </View>

                        <View style={styles.cardBody}>
                          <View style={styles.titleRow}>
                            <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>
                              {event.title}
                            </Text>
                            <Text style={[styles.eventType, { color: colors.textSecondary }]}>
                              {getTypeLabel(event.type)}
                            </Text>
                          </View>

                          <View style={styles.infoRow}>
                            <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                              {formatDateTime(event.startDate, event.startTime)}
                              {event.endDate && ` - ${formatDateTime(event.endDate, event.endTime)}`}
                            </Text>
                          </View>

                          {event.location && (
                            <View style={styles.infoRow}>
                              <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                              <Text style={[styles.infoText, { color: colors.textSecondary }]} numberOfLines={1}>
                                {event.location}
                              </Text>
                            </View>
                          )}

                          {event.people && (
                            <View style={styles.infoRow}>
                              <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
                              <Text style={[styles.infoText, { color: colors.textSecondary }]} numberOfLines={1}>
                                {event.people}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                } else {
                  const workOrder = item.data;
                  const workOrderColor = '#059669'; // Verde escuro
                  const statusColor = getWorkOrderStatusColor(workOrder.status);
                  const isInProgress = workOrder.status === 'in_progress';
                  const totalTime = getWorkOrderTotalTime(workOrder);
                  const serviceStart = getServiceStartTime(workOrder);
                  const serviceEnd = getServiceEndTime(workOrder);
                  return (
                    <InProgressPulseCard
                      key={`workOrder-${workOrder.id}`}
                      active={isInProgress}
                    >
                    <TouchableOpacity
                      style={[
                        styles.eventCard,
                        { backgroundColor: colors.cardBackground },
                      ]}
                      activeOpacity={0.7}
                      onPress={() => {
                        pushWithParams(router, '/work-order-detail', { workOrderId: workOrder.id });
                      }}
                    >
                      <View style={[styles.cardIndicator, { backgroundColor: workOrderColor }]} />
                      <View style={styles.cardContent}>
                        <View style={styles.cardHeader}>
                          <View style={styles.leftHeader}>
                            <View style={[styles.typeBadge, { backgroundColor: workOrderColor + '15' }]}>
                              <Ionicons name="document-text" size={16} color={workOrderColor} />
                              <Text style={[styles.typeLabel, { color: workOrderColor }]}>{t('events.workOrderLabel')}</Text>
                            </View>
                          </View>
                        </View>

                        <View style={styles.cardBody}>
                          <View style={styles.titleRow}>
                            <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>
                              {workOrder.clientName}
                            </Text>
                            <View style={styles.titleRight}>
                              <Text style={[styles.eventType, { color: colors.textSecondary }]}>
                                {getServiceTypeLabel(workOrder.serviceType)}
                              </Text>
                              <View
                                style={[
                                  styles.statusBadge,
                                  { backgroundColor: statusColor + '20' },
                                ]}
                              >
                                <View style={styles.statusBadgeContent}>
                                  <Ionicons 
                                    name={getWorkOrderStatusIcon(workOrder.status) as any} 
                                    size={12} 
                                    color={statusColor} 
                                  />
                                  <Text
                                    style={[
                                      styles.statusText,
                                      { color: statusColor },
                                    ]}
                                  >
                                    {getWorkOrderStatusLabel(workOrder.status)}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          </View>

                          <View style={styles.infoRow}>
                            <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                              {formatDateTime(workOrder.scheduledDate, workOrder.scheduledTime)}
                            </Text>
                          </View>

                          {workOrder.clientAddress && (
                            <View style={styles.infoRow}>
                              <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                              <Text style={[styles.infoText, { color: colors.textSecondary }]} numberOfLines={1}>
                                {workOrder.clientAddress}
                              </Text>
                            </View>
                          )}

                          {workOrder.clientContact && (
                            <View style={styles.infoRow}>
                              <Ionicons name="call-outline" size={14} color={colors.textSecondary} />
                              <Text style={[styles.infoText, { color: colors.textSecondary }]} numberOfLines={1}>
                                {workOrder.clientContact}
                              </Text>
                            </View>
                          )}

                          {/* Tempo de serviço e datas */}
                          {(totalTime > 0 || serviceStart) && (
                            <View style={[styles.serviceTimeSection, { borderTopColor: colors.border }]}>
                              {/* Timer em tempo real ou total */}
                              {totalTime > 0 && (
                                <View style={styles.infoRow}>
                                  <Ionicons 
                                    name="timer-outline" 
                                    size={14} 
                                    color={isInProgress ? statusColor : colors.textSecondary} 
                                  />
                                  <Text style={[
                                    styles.timerText,
                                    { 
                                      color: isInProgress ? statusColor : colors.textSecondary,
                                      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                                    },
                                  ]}>
                                    {formatDuration(totalTime)}
                                  </Text>
                                  {isInProgress && (
                                    <View style={[styles.liveBadge, { backgroundColor: statusColor + '20' }]}>
                                      <View style={[styles.liveDot, { backgroundColor: statusColor }]} />
                                      <Text style={[styles.liveText, { color: statusColor }]}>LIVE</Text>
                                    </View>
                                  )}
                                </View>
                              )}

                              {/* Data/hora início */}
                              {serviceStart && (
                                <View style={styles.infoRow}>
                                  <Ionicons name="play-outline" size={14} color={colors.textSecondary} />
                                  <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                                    {t('workOrders.serviceStartedAt') || 'Início'}: {formatTimestamp(serviceStart)}
                                  </Text>
                                </View>
                              )}

                              {/* Data/hora conclusão */}
                              {serviceEnd && (
                                <View style={styles.infoRow}>
                                  <Ionicons name="checkmark-outline" size={14} color={colors.success} />
                                  <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                                    {t('workOrders.serviceCompletedAt') || 'Conclusão'}: {formatTimestamp(serviceEnd)}
                                  </Text>
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                    </InProgressPulseCard>
                  );
                }
              })}
            </View>
            );
          })()}
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
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.typography.fontSize.sm,
    paddingVertical: theme.spacing.sm,
  },
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    gap: theme.spacing.xs,
    ...theme.shadows.sm,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    gap: theme.spacing.xs,
    ...theme.shadows.sm,
  },
  buttonText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
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
  eventsList: {
    gap: theme.spacing.md,
  },
  eventCard: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
    marginBottom: theme.spacing.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  cardIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  cardContent: {
    marginLeft: theme.spacing.xs,
    paddingRight: theme.spacing.xs,
  },
  cardHeader: {
    marginBottom: theme.spacing.md,
  },
  leftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs / 2,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs / 2,
    borderRadius: theme.borderRadius.sm,
  },
  typeLabel: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardBody: {
    gap: theme.spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
    gap: theme.spacing.sm,
  },
  titleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    flexShrink: 0,
  },
  eventTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    flex: 1,
    minWidth: 0,
  },
  eventType: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  cardSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
  },
  infoText: {
    fontSize: theme.typography.fontSize.sm,
    flex: 1,
    lineHeight: theme.typography.lineHeight.sm * 1.2,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
    flexWrap: 'wrap',
  },
  eventType: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  separator: {
    fontSize: theme.typography.fontSize.sm,
    marginHorizontal: theme.spacing.xs,
  },
  eventLocation: {
    fontSize: theme.typography.fontSize.sm,
    flex: 1,
  },
  eventDateTime: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  dateTimeText: {
    fontSize: theme.typography.fontSize.sm,
  },
  eventPeople: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  peopleText: {
    fontSize: theme.typography.fontSize.sm,
    flex: 1,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
    gap: theme.spacing.xs,
    flexWrap: 'wrap',
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  statusBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  serviceTimeSection: {
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    gap: theme.spacing.xs,
  },
  timerText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: theme.spacing.xs,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 9,
    fontWeight: theme.typography.fontWeight.bold,
    letterSpacing: 0.5,
  },
});
