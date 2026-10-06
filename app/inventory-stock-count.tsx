import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useRouteParams } from '../src/hooks/use-route-params';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { useAuth } from '../src/store/auth-store';
import { Button } from '../src/components/shared/Button';
import { Input } from '../src/components/shared/Input';
import { repos } from '../src/services/container';
import { InventoryItem, InventoryHistory } from '../src/types';
import { theme } from '../src/theme';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useGoBack, safeBack } from '../src/hooks/use-go-back';
import { formatDateTime as formatDateTimeUtil } from '../src/utils/date-format';
import { confirmDialog } from '../src/utils/confirm-dialog';
import {
  PartialCount,
  getPendingCount,
  savePendingCount,
  clearPendingCount,
  sumPartialCounts,
} from '../src/utils/pending-stock-count';

export default function InventoryStockCountScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { itemId } = useRouteParams<{ itemId: string }>('/inventory-stock-count');
  const goBack = useGoBack('/(tabs)/inventory');

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [quantity, setQuantity] = useState('');
  const [countLocation, setCountLocation] = useState('');
  const [partialCounts, setPartialCounts] = useState<PartialCount[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<InventoryHistory[]>([]);

  useEffect(() => {
    if (itemId) {
      loadItem();
      loadHistory();
      getPendingCount(itemId).then(setPartialCounts);
    }
  }, [itemId]);

  const loadItem = async () => {
    if (!itemId) return;
    try {
      const itemData = await repos.inventoryRepo.getItemById(itemId);
      if (itemData) {
        setItem(itemData);
      }
    } catch (error) {
      console.error('Error loading item:', error);
      Alert.alert(t('common.error'), t('inventory.loadItemError'));
    }
  };

  const loadHistory = async () => {
    if (!itemId) return;
    try {
      const historyData = await repos.inventoryRepo.getItemHistory(itemId);
      // Filter only stock count adjustments and sort by date (newest first)
      const stockCounts = historyData
        .filter(h => h.action === 'adjustStock')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setHistory(stockCounts);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const parseQuantity = (value: string): number | null => {
    if (!value.trim()) return null;
    const parsed = parseFloat(value.replace(',', '.'));
    return isNaN(parsed) || parsed < 0 ? NaN : parsed;
  };

  const typedQuantity = parseQuantity(quantity);
  const reservedTotal = sumPartialCounts(partialCounts);
  // What "confirm" will save: everything reserved plus what is typed right now
  const countTotal = reservedTotal + (typedQuantity && !isNaN(typedQuantity) ? typedQuantity : 0);
  const hasCount = partialCounts.length > 0 || (typedQuantity !== null && !isNaN(typedQuantity));

  const handleReserve = async () => {
    if (!itemId) return;
    if (typedQuantity === null || isNaN(typedQuantity)) {
      Alert.alert(t('common.error'), t('inventory.invalidQuantity'));
      return;
    }
    const entry: PartialCount = {
      id: `${Date.now()}`,
      quantity: typedQuantity,
      location: countLocation.trim(),
      createdAt: new Date().toISOString(),
    };
    const next = [...partialCounts, entry];
    setPartialCounts(next);
    setQuantity('');
    setCountLocation('');
    try {
      await savePendingCount(itemId, next);
    } catch (error) {
      console.error('Error saving pending count:', error);
    }
  };

  const handleRemovePartial = async (entryId: string) => {
    if (!itemId) return;
    const next = partialCounts.filter((entry) => entry.id !== entryId);
    setPartialCounts(next);
    await savePendingCount(itemId, next);
  };

  const handleDiscard = () => {
    if (!itemId) return;
    confirmDialog(
      t('inventory.stockCount.discardTitle'),
      t('inventory.stockCount.discardMessage'),
      async () => {
        setPartialCounts([]);
        setQuantity('');
        setCountLocation('');
        await clearPendingCount(itemId);
      },
      undefined,
      t('inventory.stockCount.discard'),
      t('common.cancel')
    );
  };

  const saveCount = async () => {
    if (!user || !item || !itemId) return;
    setIsSaving(true);
    try {
      await repos.inventoryRepo.adjustStock(itemId, countTotal - item.stock, user.id);
      await clearPendingCount(itemId);
      safeBack(router);
    } catch (error) {
      console.error('Error adjusting stock:', error);
      Alert.alert(t('common.error'), t('inventory.adjustStockError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirm = () => {
    if (!item) return;
    if (typedQuantity !== null && isNaN(typedQuantity)) {
      Alert.alert(t('common.error'), t('inventory.invalidQuantity'));
      return;
    }
    if (!hasCount) {
      Alert.alert(t('common.error'), t('inventory.invalidQuantity'));
      return;
    }
    confirmDialog(
      t('inventory.stockCount.confirmTitle'),
      t('inventory.stockCount.confirmMessage', {
        from: item.stock,
        to: countTotal,
        unit: item.unit || '',
      }),
      saveCount,
      undefined,
      t('inventory.stockCount.confirm'),
      t('common.cancel')
    );
  };

  const formatDate = (dateString: string) => {
    return formatDateTimeUtil(dateString);
  };

  if (!item) {
    return null;
  }

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + theme.spacing.md }}
    >
      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{item.name}</Text>
          
          <View style={[styles.currentStockContainer, { backgroundColor: colors.backgroundSecondary }]}>
            <Text style={[styles.currentStockLabel, { color: colors.textSecondary }]}>
              {t('inventory.currentStock')}
            </Text>
            <Text style={[styles.currentStockValue, { color: colors.text }]}>
              {item.stock} {item.unit}
            </Text>
          </View>

          {partialCounts.length > 0 && (
            <View style={[styles.pendingCard, { backgroundColor: colors.warning + '14', borderColor: colors.warning + '60' }]}>
              <View style={styles.pendingHeader}>
                <Ionicons name="time-outline" size={18} color={colors.warning} />
                <Text style={[styles.pendingTitle, { color: colors.text }]}>
                  {t('inventory.stockCount.inProgress')}
                </Text>
              </View>
              {partialCounts.map((entry, index) => (
                <View key={entry.id} style={[styles.partialRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.partialLocation, { color: colors.textSecondary }]} numberOfLines={1}>
                    {entry.location || t('inventory.stockCount.place', { number: index + 1 })}
                  </Text>
                  <Text style={[styles.partialQty, { color: colors.text }]}>
                    {entry.quantity} {item.unit}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleRemovePartial(entry.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel={t('common.delete')}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              ))}
              <View style={styles.partialTotalRow}>
                <Text style={[styles.partialTotalLabel, { color: colors.text }]}>
                  {t('inventory.stockCount.reservedTotal')}
                </Text>
                <Text style={[styles.partialTotalValue, { color: colors.text }]}>
                  {reservedTotal} {item.unit}
                </Text>
              </View>
            </View>
          )}

          <Input
            label={t('inventory.stockCount.quantityHere')}
            value={quantity}
            onChangeText={setQuantity}
            placeholder={t('inventory.newQuantityPlaceholder')}
            keyboardType="numeric"
          />
          <Input
            label={t('inventory.stockCount.locationLabel')}
            value={countLocation}
            onChangeText={setCountLocation}
            placeholder={t('inventory.stockCount.locationPlaceholder')}
          />

          <Button
            title={t('inventory.stockCount.reserve')}
            onPress={handleReserve}
            variant="outline"
            style={styles.reserveButton}
          />
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            {t('inventory.stockCount.reserveHint')}
          </Text>

          {hasCount && (
            <View style={[styles.summaryRow, { backgroundColor: colors.backgroundSecondary }]}>
              <View>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                  {t('inventory.stockCount.newStock')}
                </Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>
                  {countTotal} {item.unit}
                </Text>
              </View>
              <Text
                style={[
                  styles.summaryDelta,
                  { color: countTotal - item.stock >= 0 ? colors.success : colors.error },
                ]}
              >
                {countTotal - item.stock >= 0 ? '+' : ''}
                {countTotal - item.stock}
              </Text>
            </View>
          )}

          <Button
            title={t('inventory.stockCount.confirm')}
            onPress={handleConfirm}
            disabled={!hasCount || isSaving}
            style={styles.confirmButton}
          />
          {partialCounts.length > 0 ? (
            <TouchableOpacity onPress={handleDiscard} style={styles.discardLink}>
              <Text style={[styles.discardText, { color: colors.error }]}>
                {t('inventory.stockCount.discard')}
              </Text>
            </TouchableOpacity>
          ) : (
            <Button
              title={t('common.cancel')}
              onPress={goBack}
              variant="outline"
              style={styles.cancelButton}
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('inventory.countHistory')}
          </Text>
          
          {history.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('inventory.noHistory')}
            </Text>
          ) : (
            <View style={styles.historyList}>
              {history.map((entry) => (
                <View key={entry.id} style={[styles.historyItem, { backgroundColor: colors.cardBackground }]}>
                  <View style={styles.historyItemHeader}>
                    <Text style={[styles.historyDate, { color: colors.textSecondary }]}>
                      {formatDate(entry.createdAt)}
                    </Text>
                    <View style={[
                      styles.historyDelta,
                      { backgroundColor: entry.delta >= 0 ? colors.success + '20' : colors.error + '20' }
                    ]}>
                      <Text style={[
                        styles.historyDeltaText,
                        { color: entry.delta >= 0 ? colors.success : colors.error }
                      ]}>
                        {entry.delta >= 0 ? '+' : ''}{entry.delta}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.historyItemDetails}>
                    <Text style={[styles.historyDetailText, { color: colors.textSecondary }]}>
                      {t('inventory.previousValue')}: {entry.previousValue} {item.unit}
                    </Text>
                    <Text style={[styles.historyDetailText, { color: colors.textSecondary }]}>
                      {t('inventory.newValue')}: {entry.newValue} {item.unit}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.lg,
  },
  currentStockContainer: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
  },
  currentStockLabel: {
    fontSize: theme.typography.fontSize.sm,
    marginBottom: theme.spacing.xs,
  },
  currentStockValue: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  pendingCard: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  pendingTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  partialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
  },
  partialLocation: {
    flex: 1,
    fontSize: theme.typography.fontSize.sm,
  },
  partialQty: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  partialTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.sm,
  },
  partialTotalLabel: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  partialTotalValue: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  reserveButton: {
    marginTop: theme.spacing.sm,
  },
  hint: {
    fontSize: theme.typography.fontSize.xs,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  summaryLabel: {
    fontSize: theme.typography.fontSize.sm,
  },
  summaryValue: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
  },
  summaryDelta: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  confirmButton: {
    marginBottom: theme.spacing.sm,
  },
  cancelButton: {},
  discardLink: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  discardText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.md,
    textAlign: 'center',
    padding: theme.spacing.lg,
  },
  historyList: {
    gap: theme.spacing.sm,
  },
  historyItem: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  historyDate: {
    fontSize: theme.typography.fontSize.sm,
  },
  historyDelta: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  historyDeltaText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
  },
  historyItemDetails: {
    gap: theme.spacing.xs,
  },
  historyDetailText: {
    fontSize: theme.typography.fontSize.sm,
  },
});
