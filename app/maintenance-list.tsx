import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { Button } from '../src/components/shared/Button';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { repos } from '../src/services/container';
import { MaintenanceRecord } from '../src/types';
import { theme } from '../src/theme';

export default function MaintenanceListScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const { effectiveTheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const isDark = effectiveTheme === 'dark';
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const allRecords = await repos.maintenanceRepo.getAllMaintenanceRecords();
      setRecords(allRecords);
    } catch (error) {
      console.error('Error loading maintenance records:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [loadRecords])
  );

  const handleAddRecord = () => {
    router.push('/maintenance-create');
  };

  const handleRecordPress = (recordId: string) => {
    router.push({
      pathname: '/maintenance-detail',
      params: { recordId },
    } as any);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
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
            <View style={styles.headerTitleContainer}>
              <View
                style={[
                  styles.headerIconContainer,
                  {
                    backgroundColor: isDark ? '#fef3c740' : '#fef3c7',
                  },
                ]}
              >
                <Ionicons name="construct" size={20} color="#f59e0b" />
              </View>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                {t('documents.categories.equipmentTools.subCategories.maintenance.title')}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddRecord}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {records.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconContainer, { backgroundColor: colors.backgroundSecondary }]}>
                <Ionicons name="construct-outline" size={48} color={colors.textTertiary} />
              </View>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {t('maintenance.noRecords')}
              </Text>
              <Button
                title={t('maintenance.createRecord')}
                onPress={handleAddRecord}
                style={styles.createButton}
              />
            </View>
          ) : (
            <View style={styles.recordsContainer}>
              {records.map((record) => (
                <TouchableOpacity
                  key={record.id}
                  style={[styles.recordCard, { backgroundColor: colors.cardBackground }]}
                  onPress={() => handleRecordPress(record.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.recordHeader}>
                    <Text style={[styles.recordTitle, { color: colors.text }]} numberOfLines={1}>
                      {record.title}
                    </Text>
                  </View>
                  <View style={styles.recordDetails}>
                    <View style={styles.recordDetailRow}>
                      <Ionicons name="build-outline" size={16} color={colors.textSecondary} />
                      <Text style={[styles.recordDetailText, { color: colors.textSecondary }]}>
                        {record.equipment}
                      </Text>
                    </View>
                    <View style={styles.recordDetailRow}>
                      <Ionicons name="pricetag-outline" size={16} color={colors.textSecondary} />
                      <Text style={[styles.recordDetailText, { color: colors.textSecondary }]}>
                        {record.type}
                      </Text>
                    </View>
                    <View style={styles.recordDetailRow}>
                      <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                      <Text style={[styles.recordDetailText, { color: colors.textSecondary }]}>
                        {formatDate(record.createdAt)}
                      </Text>
                    </View>
                    {record.infos.length > 0 && (
                      <View style={styles.recordDetailRow}>
                        <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
                        <Text style={[styles.recordDetailText, { color: colors.textSecondary }]}>
                          {record.infos.length} {t('maintenance.infos')}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    minHeight: 44,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -theme.spacing.xs,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    flex: 1,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.lg,
  },
  emptyState: {
    paddingVertical: theme.spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: theme.typography.fontSize.md,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  createButton: {
    marginTop: theme.spacing.md,
  },
  recordsContainer: {
    gap: theme.spacing.md,
  },
  recordCard: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },
  recordHeader: {
    marginBottom: theme.spacing.sm,
  },
  recordTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
  },
  recordDetails: {
    gap: theme.spacing.xs,
  },
  recordDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  recordDetailText: {
    fontSize: theme.typography.fontSize.sm,
    flex: 1,
  },
});
