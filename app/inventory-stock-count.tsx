import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
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

export default function InventoryStockCountScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [quantity, setQuantity] = useState('');
  const [history, setHistory] = useState<InventoryHistory[]>([]);

  useEffect(() => {
    if (itemId) {
      loadItem();
      loadHistory();
    }
  }, [itemId]);

  const loadItem = async () => {
    if (!itemId) return;
    try {
      const itemData = await repos.inventoryRepo.getItemById(itemId);
      if (itemData) {
        setItem(itemData);
        setQuantity(itemData.stock.toString());
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

  const handleSave = async () => {
    if (!user || !item || !itemId) return;

    const newQuantity = parseFloat(quantity);
    if (isNaN(newQuantity) || newQuantity < 0) {
      Alert.alert(t('common.error'), t('inventory.invalidQuantity'));
      return;
    }

    const delta = newQuantity - item.stock;

    try {
      await repos.inventoryRepo.adjustStock(itemId, delta, user.id);
      router.back();
    } catch (error) {
      console.error('Error adjusting stock:', error);
      Alert.alert(t('common.error'), t('inventory.adjustStockError'));
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

          <Input
            label={t('inventory.newQuantity')}
            value={quantity}
            onChangeText={setQuantity}
            placeholder={t('inventory.newQuantityPlaceholder')}
            keyboardType="numeric"
          />

          <View style={styles.buttonContainer}>
            <Button
              title={t('common.save')}
              onPress={handleSave}
              style={styles.saveButton}
            />
            <Button
              title={t('common.cancel')}
              onPress={() => router.back()}
              variant="outline"
              style={styles.cancelButton}
            />
          </View>
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
  buttonContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  saveButton: {
    flex: 1,
  },
  cancelButton: {
    flex: 1,
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
