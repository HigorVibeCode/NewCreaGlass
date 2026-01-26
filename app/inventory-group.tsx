import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Modal, TouchableWithoutFeedback, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../src/hooks/use-i18n';
import { useAuth } from '../src/store/auth-store';
import { usePermissions } from '../src/hooks/use-permissions';
import { PermissionGuard } from '../src/components/shared/PermissionGuard';
import { Button } from '../src/components/shared/Button';
import { Input } from '../src/components/shared/Input';
import { Dropdown } from '../src/components/shared/Dropdown';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { repos } from '../src/services/container';
import { InventoryGroup, InventoryItem } from '../src/types';
import { theme } from '../src/theme';
import { useThemeColors } from '../src/hooks/use-theme-colors';

export default function InventoryGroupScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { hasPermission } = usePermissions();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  
  const [group, setGroup] = useState<InventoryGroup | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [showCreateItem, setShowCreateItem] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  
  // Glass fields
  const [glassName, setGlassName] = useState('');
  const [height, setHeight] = useState('');
  const [width, setWidth] = useState('');
  const [thickness, setThickness] = useState('');
  const [minimumStock, setMinimumStock] = useState('');
  const [idealStock, setIdealStock] = useState('');
  const [location, setLocation] = useState('');
  const [supplier, setSupplier] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  
  // Other groups fields
  const [itemName, setItemName] = useState('');
  const [itemUnit, setItemUnit] = useState('');
  const [itemStock, setItemStock] = useState('');
  const [itemThreshold, setItemThreshold] = useState('');

  // Declare loadItems first using useCallback
  const loadItems = useCallback(async () => {
    if (!groupId) return;
    try {
      const groupItems = await repos.inventoryRepo.getItemsByGroup(groupId);
      setItems(groupItems);
    } catch (error) {
      console.error('Error loading items:', error);
    }
  }, [groupId]);

  // Declare loadGroup using useCallback
  const loadGroup = useCallback(async () => {
    if (!groupId) return;
    try {
      const groupData = await repos.inventoryRepo.getGroupById(groupId);
      setGroup(groupData);
    } catch (error) {
      console.error('Error loading group:', error);
    }
  }, [groupId]);

  useEffect(() => {
    if (groupId) {
      loadGroup();
      loadItems();
    }
  }, [groupId, loadGroup, loadItems]);

  useFocusEffect(
    useCallback(() => {
      if (groupId) {
        loadItems();
      }
    }, [groupId, loadItems])
  );

  const isGlassGroup = group?.name === 'Glass';

  const handleCreateGlassItem = async () => {
    if (!user || !groupId) return;

    if (!glassName.trim() || !height.trim() || !width.trim() || !thickness.trim()) {
      Alert.alert(t('common.error'), t('inventory.fillAllRequiredFields'));
      return;
    }

    const heightNum = parseFloat(height);
    const widthNum = parseFloat(width);
    const thicknessNum = parseFloat(thickness);
    const calculatedM2 = (heightNum * widthNum) / 1000000; // Convert mm² to m²

    try {
      await repos.inventoryRepo.createItem({
        groupId,
        name: glassName.trim(),
        unit: 'm²',
        stock: 0,
        lowStockThreshold: parseFloat(minimumStock) || 0,
        createdBy: user.id,
        height: heightNum,
        width: widthNum,
        thickness: thicknessNum,
        totalM2: calculatedM2,
        idealStock: parseFloat(idealStock) || undefined,
        location: location.trim() || undefined,
        supplier: supplier || undefined,
        referenceNumber: referenceNumber.trim() || undefined,
      });
      
      // Reset form
      resetForm();
      await loadItems();
    } catch (error) {
      console.error('Error creating item:', error);
      Alert.alert(t('common.error'), t('inventory.createItemError'));
    }
  };

  const handleCreateItem = async () => {
    if (!user || !groupId) return;

    if (!itemName.trim() || !itemUnit.trim()) {
      Alert.alert(t('common.error'), t('inventory.fillAllRequiredFields'));
      return;
    }

    try {
      await repos.inventoryRepo.createItem({
        groupId,
        name: itemName.trim(),
        unit: itemUnit.trim(),
        stock: parseFloat(itemStock) || 0,
        lowStockThreshold: parseFloat(itemThreshold) || 0,
        createdBy: user.id,
      });
      
      // Reset form
      setItemName('');
      setItemUnit('');
      setItemStock('');
      setItemThreshold('');
      setShowCreateItem(false);
      await loadItems();
    } catch (error) {
      console.error('Error creating item:', error);
      Alert.alert(t('common.error'), t('inventory.createItemError'));
    }
  };

  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    if (isGlassGroup) {
      setGlassName(item.name);
      setWidth(item.width?.toString() || '');
      setHeight(item.height?.toString() || '');
      setThickness(item.thickness?.toString() || '');
      setMinimumStock(item.lowStockThreshold?.toString() || '');
      setIdealStock(item.idealStock?.toString() || '');
      setLocation(item.location || '');
      setSupplier(item.supplier || '');
      setReferenceNumber(item.referenceNumber || '');
    } else {
      setItemName(item.name);
      setItemUnit(item.unit);
      setItemStock(item.stock.toString());
      setItemThreshold(item.lowStockThreshold.toString());
    }
    setShowCreateItem(true);
  };

  const handleUpdateGlassItem = async () => {
    if (!user || !groupId || !editingItem) return;

    if (!glassName.trim() || !height.trim() || !width.trim() || !thickness.trim()) {
      Alert.alert(t('common.error'), t('inventory.fillAllRequiredFields'));
      return;
    }

    const heightNum = parseFloat(height);
    const widthNum = parseFloat(width);
    const thicknessNum = parseFloat(thickness);
    const calculatedM2 = (heightNum * widthNum) / 1000000; // Convert mm² to m²

    try {
      const updateData = {
        name: glassName.trim(),
        height: heightNum,
        width: widthNum,
        thickness: thicknessNum,
        totalM2: calculatedM2,
        lowStockThreshold: parseFloat(minimumStock) || 0,
        idealStock: parseFloat(idealStock) || undefined,
        location: location.trim() || undefined,
        supplier: supplier && supplier.trim() ? supplier.trim() : undefined,
        referenceNumber: referenceNumber && referenceNumber.trim() ? referenceNumber.trim() : undefined,
      };
      
      console.log('Updating item with data:', updateData);
      const updatedItem = await repos.inventoryRepo.updateItem(editingItem.id, updateData);
      console.log('Item updated successfully:', updatedItem);
      
      // Reset form
      resetForm();
      await loadItems();
    } catch (error) {
      console.error('Error updating item:', error);
      Alert.alert(t('common.error'), t('inventory.updateItemError'));
    }
  };

  const handleUpdateItem = async () => {
    if (!user || !groupId || !editingItem) return;

    if (!itemName.trim() || !itemUnit.trim()) {
      Alert.alert(t('common.error'), t('inventory.fillAllRequiredFields'));
      return;
    }

    try {
      await repos.inventoryRepo.updateItem(editingItem.id, {
        name: itemName.trim(),
        unit: itemUnit.trim(),
        stock: parseFloat(itemStock) || 0,
        lowStockThreshold: parseFloat(itemThreshold) || 0,
      });
      
      // Reset form
      resetForm();
      await loadItems();
    } catch (error) {
      console.error('Error updating item:', error);
      Alert.alert(t('common.error'), t('inventory.updateItemError'));
    }
  };

  const handleDeleteItem = (item: InventoryItem) => {
    Alert.alert(
      t('inventory.deleteItem'),
      `${t('inventory.deleteItemConfirm')} "${item.name}"?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await repos.inventoryRepo.deleteItem(item.id);
              await loadItems();
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert(t('common.error'), t('inventory.deleteItemError'));
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setGlassName('');
    setHeight('');
    setWidth('');
    setThickness('');
    setMinimumStock('');
    setIdealStock('');
    setLocation('');
    setSupplier('');
    setReferenceNumber('');
    setItemName('');
    setItemUnit('');
    setItemStock('');
    setItemThreshold('');
    setShowCreateItem(false);
    setEditingItem(null);
  };

  if (!group) {
    return null;
  }

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
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {group.name}
            </Text>
          </View>
          <PermissionGuard permission="inventory.item.create">
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowCreateItem(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={24} color={colors.primary} />
            </TouchableOpacity>
          </PermissionGuard>
        </View>
      </View>

      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <View style={styles.section}>

          {items.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('inventory.noItems')}
            </Text>
          ) : (
            <View style={styles.itemsList}>
              {items.map((item) => (
                <View key={item.id} style={[styles.itemCard, { backgroundColor: colors.cardBackground }]}>
                  <View style={styles.itemInfo}>
                    <View style={styles.itemHeader}>
                      <View style={styles.itemHeaderLeft}>
                        <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                        {isGlassGroup && item.height && item.width && (
                          <Text style={[styles.itemDimensions, { color: colors.textSecondary }]}>
                            {item.width}mm × {item.height}mm{item.thickness && ` × ${item.thickness}mm`}
                          </Text>
                        )}
                      </View>
                      <View style={styles.itemHeaderRight}>
                        <PermissionGuard permission="inventory.item.adjustStock">
                          <TouchableOpacity
                            style={[styles.calculatorButton, { backgroundColor: colors.success + '20' }]}
                            onPress={() => router.push({
                              pathname: '/inventory-stock-count',
                              params: { itemId: item.id },
                            })}
                          >
                            <Ionicons name="calculator" size={20} color={colors.success} />
                          </TouchableOpacity>
                        </PermissionGuard>
                        <PermissionGuard permission="inventory.item.update">
                          <TouchableOpacity
                            style={[styles.editButton, { backgroundColor: colors.textTertiary + '20' }]}
                            onPress={() => handleEditItem(item)}
                          >
                            <Ionicons name="create" size={20} color={colors.textTertiary} />
                          </TouchableOpacity>
                        </PermissionGuard>
                      </View>
                    </View>
                    
                    {isGlassGroup ? (
                      <View style={styles.itemBadges}>
                        <View style={[styles.pillBadge, { backgroundColor: colors.backgroundSecondary }]}>
                          <Ionicons name="cube" size={16} color={colors.textSecondary} />
                          <Text style={[styles.pillBadgeText, { color: colors.textSecondary }]}>
                            {item.stock} {t('inventory.units')}
                          </Text>
                        </View>
                        {item.totalM2 && (
                          <View style={[styles.pillBadge, { backgroundColor: colors.backgroundSecondary }]}>
                            <Ionicons name="grid" size={16} color={colors.textSecondary} />
                            <Text style={[styles.pillBadgeText, { color: colors.textSecondary }]}>
                              {(item.totalM2 * item.stock).toFixed(2)} m²
                            </Text>
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={styles.itemBadges}>
                        <View style={[styles.pillBadge, { backgroundColor: colors.backgroundSecondary }]}>
                          <Ionicons name="cube" size={16} color={colors.textSecondary} />
                          <Text style={[styles.pillBadgeText, { color: colors.textSecondary }]}>
                            {item.stock} {item.unit}
                          </Text>
                        </View>
                      </View>
                    )}
                    
                    {item.stock <= item.lowStockThreshold && (
                      <View style={[styles.lowStockPill, { backgroundColor: colors.error + '20' }]}>
                        <Ionicons name="warning" size={16} color={colors.error} />
                        <Text style={[styles.lowStockPillText, { color: colors.error }]}>
                          {t('inventory.lowStock')}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
      </ScrollView>

      <Modal
        visible={showCreateItem}
        transparent
        animationType="slide"
        onRequestClose={resetForm}
      >
        <TouchableWithoutFeedback onPress={resetForm}>
          <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {editingItem ? t('inventory.editItem') : t('inventory.createItem')} - {group.name}
                  </Text>
                  <TouchableOpacity onPress={resetForm}>
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.modalBody}>
                  {isGlassGroup ? (
                    <>
                      <Input
                        label={t('inventory.glass')}
                        value={glassName}
                        onChangeText={setGlassName}
                        placeholder={t('inventory.glassPlaceholder')}
                      />
                      <View style={styles.row}>
                        <View style={styles.rowItem}>
                          <Input
                            label={t('inventory.width')}
                            value={width}
                            onChangeText={setWidth}
                            placeholder={t('inventory.widthPlaceholder')}
                            keyboardType="numeric"
                            containerStyle={styles.inputContainer}
                          />
                        </View>
                        <View style={styles.rowItem}>
                          <Input
                            label={t('inventory.height')}
                            value={height}
                            onChangeText={setHeight}
                            placeholder={t('inventory.heightPlaceholder')}
                            keyboardType="numeric"
                            containerStyle={styles.inputContainer}
                          />
                        </View>
                        <View style={styles.rowItem}>
                          <Input
                            label={t('inventory.thickness')}
                            value={thickness}
                            onChangeText={setThickness}
                            placeholder={t('inventory.thicknessPlaceholder')}
                            keyboardType="numeric"
                            containerStyle={styles.inputContainer}
                          />
                        </View>
                      </View>
                      <View style={styles.row}>
                        <View style={styles.rowItem}>
                          <Input
                            label={t('inventory.minimumStock')}
                            value={minimumStock}
                            onChangeText={setMinimumStock}
                            placeholder={t('inventory.minimumStockPlaceholder')}
                            keyboardType="numeric"
                            containerStyle={styles.inputContainer}
                          />
                        </View>
                        <View style={styles.rowItem}>
                          <Input
                            label={t('inventory.idealStock')}
                            value={idealStock}
                            onChangeText={setIdealStock}
                            placeholder={t('inventory.idealStockPlaceholder')}
                            keyboardType="numeric"
                            containerStyle={styles.inputContainer}
                          />
                        </View>
                      </View>
                      <Input
                        label={t('inventory.location')}
                        value={location}
                        onChangeText={setLocation}
                        placeholder={t('inventory.locationPlaceholder')}
                      />
                      <Dropdown
                        label={t('inventory.supplier')}
                        value={supplier}
                        options={[
                          { label: '3S', value: '3S' },
                          { label: 'Crea Glass', value: 'Crea Glass' },
                        ]}
                        onSelect={setSupplier}
                      />
                      <Input
                        label={t('inventory.referenceNumber')}
                        value={referenceNumber}
                        onChangeText={setReferenceNumber}
                        placeholder={t('inventory.referenceNumberPlaceholder')}
                      />
                    </>
                  ) : (
                    <>
                      <Input
                        label={t('inventory.itemName')}
                        value={itemName}
                        onChangeText={setItemName}
                        placeholder={t('inventory.itemNamePlaceholder')}
                      />
                      <Input
                        label={t('inventory.unit')}
                        value={itemUnit}
                        onChangeText={setItemUnit}
                        placeholder={t('inventory.unitPlaceholder')}
                      />
                      <Input
                        label={t('inventory.stock')}
                        value={itemStock}
                        onChangeText={setItemStock}
                        placeholder={t('inventory.stockPlaceholder')}
                        keyboardType="numeric"
                      />
                      <Input
                        label={t('inventory.lowStockThreshold')}
                        value={itemThreshold}
                        onChangeText={setItemThreshold}
                        placeholder={t('inventory.lowStockThresholdPlaceholder')}
                        keyboardType="numeric"
                      />
                    </>
                  )}
                </ScrollView>
                <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
                  {editingItem && (
                    <PermissionGuard permission="inventory.item.delete">
                      <TouchableOpacity
                        style={[styles.modalIconButton, { backgroundColor: colors.error + '20' }]}
                        onPress={() => {
                          resetForm();
                          handleDeleteItem(editingItem);
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash" size={20} color={colors.error} />
                      </TouchableOpacity>
                    </PermissionGuard>
                  )}
                  <TouchableOpacity
                    style={[styles.modalIconButton, { backgroundColor: colors.backgroundSecondary }]}
                    onPress={resetForm}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalIconButton, { backgroundColor: colors.primary }]}
                    onPress={isGlassGroup 
                      ? (editingItem ? handleUpdateGlassItem : handleCreateGlassItem)
                      : (editingItem ? handleUpdateItem : handleCreateItem)
                    }
                    activeOpacity={0.7}
                  >
                    <Ionicons name="checkmark" size={20} color={colors.textInverse} />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  headerTitleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  addButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.md,
    textAlign: 'center',
    padding: theme.spacing.lg,
  },
  itemsList: {
    gap: theme.spacing.md,
  },
  itemCard: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  itemInfo: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  itemHeaderLeft: {
    flex: 1,
  },
  itemHeaderRight: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
  },
  calculatorButton: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemName: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.xs,
  },
  itemDimensions: {
    fontSize: theme.typography.fontSize.sm,
  },
  itemBadges: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    gap: theme.spacing.xs,
  },
  pillBadgeText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  lowStockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    gap: theme.spacing.xs,
    alignSelf: 'flex-start',
  },
  lowStockPillText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
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
    maxWidth: 500,
    maxHeight: '80%',
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
  modalBody: {
    padding: theme.spacing.lg,
    maxHeight: 400,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderTopWidth: 1,
  },
  modalIconButton: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  rowItem: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 0,
  },
});
