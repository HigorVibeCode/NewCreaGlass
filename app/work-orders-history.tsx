import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { repos } from '../src/services/container';
import { WorkOrder } from '../src/types';
import { theme } from '../src/theme';
import { useThemeColors } from '../src/hooks/use-theme-colors';

type EventOrWorkOrder = 
  | { type: 'workOrder'; data: WorkOrder };

export default function WorkOrdersHistoryScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [historyItems, setHistoryItems] = useState<EventOrWorkOrder[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      // Load only completed work orders for history
      const allWorkOrders = await repos.workOrdersRepo.getAllWorkOrders();
      console.log('All work orders loaded:', allWorkOrders.length);
      
      const completedWorkOrders = allWorkOrders.filter(wo => wo.status === 'completed');
      console.log('Completed work orders:', completedWorkOrders.length);

      const historyItems: EventOrWorkOrder[] = completedWorkOrders.map(workOrder => ({
        type: 'workOrder',
        data: workOrder,
      }));

      // Sort by scheduled date (most recent first)
      historyItems.sort((a, b) => {
        const dateA = new Date(`${a.data.scheduledDate}T${a.data.scheduledTime || '00:00'}`);
        const dateB = new Date(`${b.data.scheduledDate}T${b.data.scheduledTime || '00:00'}`);
        return dateB.getTime() - dateA.getTime(); // Descending (newest first)
      });

      setHistoryItems(historyItems);
    } catch (error) {
      console.error('Error loading history:', error);
      setHistoryItems([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

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
        return colors.info;
      case 'in_progress':
        return colors.primary;
      case 'paused':
        return colors.warning;
      case 'completed':
        return colors.success;
      case 'cancelled':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const formatDateTime = (date: string, time?: string): string => {
    if (!date) return '';
    const dateObj = new Date(date);
    const dateStr = dateObj.toLocaleDateString();
    return time ? `${dateStr} ${time}` : dateStr;
  };

  return (
    <ScreenWrapper>
      {/* Custom Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + theme.spacing.md,
            paddingBottom: theme.spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t('events.history')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + theme.spacing.md }
        ]}
        showsVerticalScrollIndicator={true}
      >
        {isLoadingHistory ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: theme.spacing.md }]}>
              {t('common.loading')}
            </Text>
          </View>
        ) : historyItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: theme.spacing.md }]}>
              {t('events.noHistory')}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {historyItems.map((item) => {
              if (item.type === 'workOrder') {
                const workOrder = item.data;
                const workOrderColor = '#059669';
                const statusColor = getWorkOrderStatusColor(workOrder.status);

                return (
                  <TouchableOpacity
                    key={`history-${workOrder.id}`}
                    style={[styles.card, { backgroundColor: colors.cardBackground }]}
                    activeOpacity={0.7}
                    onPress={() => {
                      router.push({
                        pathname: '/work-order-detail',
                        params: { workOrderId: workOrder.id },
                      });
                    }}
                  >
                    <View style={[styles.cardIndicator, { backgroundColor: workOrderColor }]} />
                    <View style={styles.cardContent}>
                      <View style={styles.cardHeader}>
                        <View style={styles.leftHeader}>
                          <View style={[styles.typeBadge, { backgroundColor: workOrderColor + '15' }]}>
                            <Ionicons name="document-text" size={16} color={workOrderColor} />
                            <Text style={[styles.typeLabel, { color: workOrderColor }]}>
                              {t('events.workOrderLabel')}
                            </Text>
                          </View>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                          <Text style={[styles.statusText, { color: statusColor }]}>
                            {getWorkOrderStatusLabel(workOrder.status)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.cardBody}>
                        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                          {workOrder.clientName}
                        </Text>
                        <Text style={[styles.cardType, { color: colors.textSecondary }]}>
                          {getServiceTypeLabel(workOrder.serviceType)}
                        </Text>

                        <View style={styles.cardMeta}>
                          <View style={styles.metaRow}>
                            <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                              {formatDateTime(workOrder.scheduledDate, workOrder.scheduledTime)}
                            </Text>
                          </View>
                          {workOrder.clientAddress && (
                            <View style={styles.metaRow}>
                              <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                              <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
                                {workOrder.clientAddress}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }
              return null;
            })}
          </View>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: theme.spacing.md,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: theme.spacing.xs,
    marginLeft: -theme.spacing.xs,
    zIndex: 10,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    textAlign: 'center',
    marginLeft: -32,
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.md,
    textAlign: 'center',
  },
  list: {
    gap: theme.spacing.md,
  },
  card: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    flexDirection: 'row',
    ...theme.shadows.sm,
  },
  cardIndicator: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    padding: theme.spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  leftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  typeLabel: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  statusText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  cardBody: {
    gap: theme.spacing.xs,
  },
  cardTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  cardType: {
    fontSize: theme.typography.fontSize.sm,
  },
  cardMeta: {
    marginTop: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  metaText: {
    fontSize: theme.typography.fontSize.sm,
    flex: 1,
  },
});