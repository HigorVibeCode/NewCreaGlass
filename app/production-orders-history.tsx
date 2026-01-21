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
import { Production, ProductionStatus } from '../src/types';
import { theme } from '../src/theme';
import { useThemeColors } from '../src/hooks/use-theme-colors';

export default function ProductionOrdersHistoryScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [completedProductions, setCompletedProductions] = useState<Production[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load only completed production orders
      const allProductions = await repos.productionRepo.getAllProductions();
      const completed = allProductions.filter(p => p.status === 'completed');
      
      // Sort by creation date (most recent first)
      completed.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.dueDate).getTime();
        const dateB = new Date(b.createdAt || b.dueDate).getTime();
        return dateB - dateA; // Descending (newest first)
      });

      setCompletedProductions(completed);
    } catch (error) {
      console.error('Error loading production history:', error);
      setCompletedProductions([]);
    } finally {
      setIsLoading(false);
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

  const getStatusColor = (status: ProductionStatus): string => {
    switch (status) {
      case 'completed':
        return colors.success;
      default:
        return colors.textSecondary;
    }
  };

  const getStatusLabel = (status: ProductionStatus): string => {
    switch (status) {
      case 'completed':
        return t('production.status.completed');
      default:
        return status;
    }
  };

  const getOrderTypeLabel = (orderType: string): string => {
    return orderType || '';
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
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t('production.statusHistory')}
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
        {isLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: theme.spacing.md }]}>
              {t('common.loading')}
            </Text>
          </View>
        ) : completedProductions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkbox-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: theme.spacing.md }]}>
              {t('production.noCompletedOrders')}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {completedProductions.map((production) => {
              const statusColor = getStatusColor(production.status);

              return (
                <TouchableOpacity
                  key={production.id}
                  style={[styles.card, { backgroundColor: colors.cardBackground }]}
                  activeOpacity={0.7}
                  onPress={() => {
                    router.push({
                      pathname: '/production-detail',
                      params: { productionId: production.id },
                    });
                  }}
                >
                  <View style={[styles.cardIndicator, { backgroundColor: statusColor }]} />
                  <View style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                      <View style={styles.orderDetails}>
                        <View style={styles.clientRow}>
                          <Text style={[styles.clientName, { color: colors.text }]}>
                            {production.clientName}
                          </Text>
                          <Text style={[styles.separator, { color: colors.textSecondary }]}>•</Text>
                          <Text style={[styles.orderNumber, { color: colors.textSecondary }]}>
                            {production.orderNumber}
                          </Text>
                        </View>
                        <Text style={[styles.orderType, { color: colors.textSecondary }]}>
                          {getOrderTypeLabel(production.orderType)}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>
                          {getStatusLabel(production.status)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardMeta}>
                      <View style={styles.metaRow}>
                        <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                          {t('production.dueDate')}: {new Date(production.dueDate).toLocaleDateString()}
                        </Text>
                      </View>
                      {production.createdAt && (
                        <View style={styles.metaRow}>
                          <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                            {new Date(production.createdAt).toLocaleDateString()}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
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
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
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
    fontSize: theme.typography.fontSize.lg,
    marginHorizontal: theme.spacing.xs,
  },
  orderNumber: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.medium,
  },
  orderType: {
    fontSize: theme.typography.fontSize.sm,
    marginTop: theme.spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
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