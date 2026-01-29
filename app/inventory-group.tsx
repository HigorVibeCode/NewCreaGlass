import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Modal, TouchableWithoutFeedback, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
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
import { confirmDelete } from '../src/utils/confirm-dialog';

function SignedInventoryImage({
  storagePath,
  style,
  imageStyle,
  placeholderIconSize = 32,
}: {
  storagePath: string;
  style?: object;
  imageStyle?: object;
  placeholderIconSize?: number;
}) {
  const colors = useThemeColors();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!storagePath) {
      setSignedUrl(null);
      return;
    }
    let cancelled = false;
    repos.inventoryRepo
      .getItemImageUrlSigned(storagePath)
      .then((url) => {
        if (!cancelled && url) setSignedUrl(url);
      })
      .catch(() => {
        if (!cancelled) setSignedUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  if (!signedUrl) {
    return (
      <View style={[styles.itemImageWrap, { backgroundColor: colors.backgroundSecondary }, style]}>
        <Ionicons name="image-outline" size={placeholderIconSize} color={colors.textTertiary} />
      </View>
    );
  }
  return (
    <View style={[styles.itemImageWrap, { backgroundColor: colors.backgroundSecondary }, style]}>
      <Image source={{ uri: signedUrl }} style={[styles.itemImage, imageStyle]} contentFit="cover" />
    </View>
  );
}

export default function InventoryGroupScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { hasPermission } = usePermissions();
  const { groupId, editItemId } = useLocalSearchParams<{ groupId: string; editItemId?: string }>();
  
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
  const [itemStock, setItemStock] = useState('');
  const [itemThreshold, setItemThreshold] = useState('');
  // Supplies: Position, Color, Type, OPO Oeschger Code
  const [position, setPosition] = useState('');
  const [color, setColor] = useState('');
  const [suppliesType, setSuppliesType] = useState('');
  const [opoOeschgerCode, setOpoOeschgerCode] = useState('');
  // Supplies: up to 3 images, one main (shown on card)
  const [itemImages, setItemImages] = useState<
    Array<
      | { type: 'existing'; id: string; storagePath: string; isMain: boolean }
      | { type: 'new'; uri: string; isMain: boolean }
    >
  >([]);
  const didOpenEditFromParam = useRef(false);
  const [searchTerm, setSearchTerm] = useState('');

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

  useEffect(() => {
    if (groupId && editItemId && items.length > 0 && !didOpenEditFromParam.current) {
      const item = items.find((i) => i.id === editItemId);
      if (item) {
        didOpenEditFromParam.current = true;
        handleEditItem(item);
        router.replace({ pathname: '/inventory-group', params: { groupId } });
      }
    }
  }, [groupId, editItemId, items]);

  useFocusEffect(
    useCallback(() => {
      if (groupId) {
        loadItems();
      }
    }, [groupId, loadItems])
  );

  const isGlassGroup = group?.name === 'Glass';
  const isSuppliesGroup = group?.name === 'Supplies';

  const suppliesFilteredItems = useMemo(() => {
    if (group?.name !== 'Supplies' || !searchTerm.trim()) return items;
    const lower = searchTerm.toLowerCase().trim();
    return items.filter((item) => {
      const typeLabel =
        item.type === 'aluminios' ? t('inventory.typeAluminios') : item.type === 'vedacoes' ? t('inventory.typeVedacoes') : item.type === 'magnets' ? t('inventory.typeMagnets') : item.type || '';
      const searchable = [item.name, item.position, item.type, item.opoOeschgerCode, typeLabel].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(lower);
    });
  }, [items, group?.name, searchTerm, t]);

  const displayItems = isSuppliesGroup ? suppliesFilteredItems : items;

  const handleCreateGlassItem = async () => {
    if (!user || !groupId) {
      Alert.alert(t('common.error'), t('inventory.createItemError'));
      return;
    }

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
      resetForm();
      await loadItems();
      Alert.alert(t('common.success'), t('inventory.createItemSuccess'));
    } catch (error) {
      console.error('Error creating glass item:', error);
      const message = error instanceof Error ? error.message : t('inventory.createItemError');
      Alert.alert(t('common.error'), message);
    }
  };

  const handleCreateItem = async () => {
    if (!user || !groupId) {
      Alert.alert(t('common.error'), t('inventory.createItemError'));
      return;
    }

    if (!itemName.trim()) {
      Alert.alert(t('common.error'), t('inventory.fillAllRequiredFields'));
      return;
    }

    if (isSuppliesGroup && itemImages.length > 0) {
      const mainCount = itemImages.filter((e) => e.isMain).length;
      if (mainCount !== 1) {
        Alert.alert(t('common.error'), t('inventory.selectOneMainImage'));
        return;
      }
    }
    if (isSuppliesGroup && itemImages.length > 3) {
      Alert.alert(t('common.error'), t('inventory.maxImagesPerItem') ? 'Maximum 3 images.' : 'Máximo 3 imagens.');
      return;
    }

    try {
      const created = await repos.inventoryRepo.createItem({
        groupId,
        name: itemName.trim(),
        unit: 'un',
        stock: isSuppliesGroup ? 0 : parseFloat(itemStock) || 0,
        lowStockThreshold: parseFloat(itemThreshold) || 0,
        createdBy: user.id,
        position: isSuppliesGroup ? position.trim() || undefined : undefined,
        color: isSuppliesGroup ? color.trim() || undefined : undefined,
        type: isSuppliesGroup ? (suppliesType || undefined) : undefined,
        opoOeschgerCode: isSuppliesGroup ? opoOeschgerCode.trim() || undefined : undefined,
      });
      if (isSuppliesGroup && itemImages.length > 0) {
        for (let i = 0; i < itemImages.length; i++) {
          const entry = itemImages[i];
          if (entry.type === 'new') {
            const filename = entry.uri.split('/').pop() || `photo_${Date.now()}.jpg`;
            await repos.inventoryRepo.addItemImage(created.id, { uri: entry.uri, name: filename, type: 'image/jpeg' }, entry.isMain);
          }
        }
      }
      setItemName('');
      setItemStock('');
      setItemThreshold('');
      setPosition('');
      setColor('');
      setSuppliesType('');
      setOpoOeschgerCode('');
      setItemImages([]);
      setShowCreateItem(false);
      await loadItems();
      Alert.alert(t('common.success'), t('inventory.createItemSuccess'));
    } catch (error) {
      console.error('Error creating item:', error);
      const message = error instanceof Error ? error.message : t('inventory.createItemError');
      Alert.alert(t('common.error'), message);
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
      if (!isSuppliesGroup) {
        setItemStock(item.stock.toString());
      }
      setItemThreshold(item.lowStockThreshold.toString());
      setItemImages([]);
      if (isSuppliesGroup) {
        setPosition(item.position || '');
        setColor(item.color || '');
        setSuppliesType(item.type || '');
        setOpoOeschgerCode(item.opoOeschgerCode || '');
        setItemImages(
          (item.images || []).map((im) => ({
            type: 'existing' as const,
            id: im.id,
            storagePath: im.storagePath,
            isMain: im.isMain,
          }))
        );
      }
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
      const message = error instanceof Error ? error.message : t('inventory.updateItemError');
      Alert.alert(t('common.error'), message);
    }
  };

  const handleUpdateItem = async () => {
    if (!user || !groupId || !editingItem) return;

    if (!itemName.trim()) {
      Alert.alert(t('common.error'), t('inventory.fillAllRequiredFields'));
      return;
    }
    if (isSuppliesGroup && itemImages.length > 0) {
      const mainCount = itemImages.filter((e) => e.isMain).length;
      if (mainCount !== 1) {
        Alert.alert(t('common.error'), t('inventory.selectOneMainImage'));
        return;
      }
    }
    if (isSuppliesGroup && itemImages.length > 3) {
      Alert.alert(t('common.error'), t('inventory.maxImagesPerItem') ? 'Maximum 3 images.' : 'Máximo 3 imagens.');
      return;
    }

    try {
      if (isSuppliesGroup) {
        const existingIds = new Set((editingItem.images ?? []).map((im) => im.id));
        const keptEntries = itemImages.filter((e): e is { type: 'existing'; id: string; storagePath: string; isMain: boolean } => e.type === 'existing');
        const keptIds = new Set(keptEntries.map((e) => e.id));
        for (const id of existingIds) {
          if (!keptIds.has(id)) await repos.inventoryRepo.deleteItemImage(id);
        }
        for (const entry of itemImages) {
          if (entry.type === 'new') {
            const filename = entry.uri.split('/').pop() || `photo_${Date.now()}.jpg`;
            await repos.inventoryRepo.addItemImage(editingItem.id, { uri: entry.uri, name: filename, type: 'image/jpeg' }, entry.isMain);
          }
        }
        const mainExisting = keptEntries.find((e) => e.isMain);
        if (mainExisting) {
          await repos.inventoryRepo.setMainItemImage(mainExisting.id);
        }
      }
      const updatePayload: Parameters<typeof repos.inventoryRepo.updateItem>[1] = {
        name: itemName.trim(),
        lowStockThreshold: parseFloat(itemThreshold) || 0,
        position: isSuppliesGroup ? position.trim() || undefined : undefined,
        color: isSuppliesGroup ? color.trim() || undefined : undefined,
        type: isSuppliesGroup ? (suppliesType || undefined) : undefined,
        opoOeschgerCode: isSuppliesGroup ? opoOeschgerCode.trim() || undefined : undefined,
      };
      if (!isSuppliesGroup) {
        updatePayload.stock = parseFloat(itemStock) || 0;
      }
      await repos.inventoryRepo.updateItem(editingItem.id, updatePayload);
      resetForm();
      await loadItems();
    } catch (error) {
      console.error('Error updating item:', error);
      const message = error instanceof Error ? error.message : t('inventory.updateItemError');
      Alert.alert(t('common.error'), message);
    }
  };

  const handleDeleteItem = (item: InventoryItem) => {
    confirmDelete(
      t('inventory.deleteItem'),
      `${t('inventory.deleteItemConfirm')} "${item.name}"?`,
      async () => {
        await repos.inventoryRepo.deleteItem(item.id);
        await loadItems();
      },
      undefined,
      t('common.delete'),
      t('common.cancel'),
      undefined,
      t('inventory.deleteItemError')
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
    setItemStock('');
    setItemThreshold('');
    setPosition('');
    setColor('');
    setSuppliesType('');
    setOpoOeschgerCode('');
    setItemImages([]);
    setShowCreateItem(false);
    setEditingItem(null);
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.error'), t('production.cameraPermissionDenied') || 'Permissão da câmera negada');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;
      const isFirst = itemImages.length === 0;
      setItemImages((prev) => (prev.length >= 3 ? prev : [...prev, { type: 'new' as const, uri: result.assets[0].uri, isMain: isFirst }]));
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert(t('common.error'), t('inventory.createItemError'));
    }
  };

  const handleChooseFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.error'), t('production.mediaPermissionDenied') || 'Permissão da galeria negada');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;
      const isFirst = itemImages.length === 0;
      setItemImages((prev) => (prev.length >= 3 ? prev : [...prev, { type: 'new' as const, uri: result.assets[0].uri, isMain: isFirst }]));
    } catch (error) {
      console.error('Error choosing from gallery:', error);
      Alert.alert(t('common.error'), t('inventory.createItemError'));
    }
  };

  const setMainImage = (index: number) => {
    setItemImages((prev) =>
      prev.map((e, i) => ({ ...e, isMain: i === index }))
    );
  };

  const removeImage = (index: number) => {
    setItemImages((prev) => prev.filter((_, i) => i !== index));
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
          {isSuppliesGroup && (
            <View style={[styles.searchContainer, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder={t('inventory.searchPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                value={searchTerm}
                onChangeText={setSearchTerm}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchTerm.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchTerm('')}
                  style={styles.searchClearButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          )}
          <View style={styles.section}>

          {displayItems.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {isSuppliesGroup && searchTerm.trim() ? t('inventory.noItemsFound') : t('inventory.noItems')}
            </Text>
          ) : (
                            <View style={styles.itemsList}>
              {displayItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.itemCard, { backgroundColor: colors.cardBackground }]}
                  onPress={() => router.push({ pathname: '/inventory-item-detail', params: { itemId: item.id, groupId: groupId! } })}
                  activeOpacity={0.7}
                >
                  {isSuppliesGroup && (() => {
                    const mainImg = item.images?.find((im) => im.isMain) ?? item.images?.[0];
                    return mainImg ? (
                      <SignedInventoryImage
                        storagePath={mainImg.storagePath}
                        style={styles.itemImageWrapLarge}
                        imageStyle={styles.itemImageLarge}
                        placeholderIconSize={40}
                      />
                    ) : (
                      <View style={[styles.itemImageWrapLarge, { backgroundColor: colors.backgroundSecondary }]}>
                        <Ionicons name="image-outline" size={40} color={colors.textTertiary} />
                      </View>
                    );
                  })()}
                  <View style={styles.itemInfo}>
                    <View style={styles.itemHeader}>
                      <View style={styles.itemHeaderLeft}>
                        <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                        {isGlassGroup && item.height && item.width && (
                          <Text style={[styles.itemDimensions, { color: colors.textSecondary }]}>
                            {item.width}mm × {item.height}mm{item.thickness && ` × ${item.thickness}mm`}
                          </Text>
                        )}
                        {isSuppliesGroup && (item.position || item.type) && (
                          <Text style={[styles.itemDimensions, { color: colors.textSecondary }]}>
                            {[
                              item.position,
                              item.type === 'aluminios' ? t('inventory.typeAluminios') : item.type === 'vedacoes' ? t('inventory.typeVedacoes') : item.type === 'magnets' ? t('inventory.typeMagnets') : item.type,
                            ].filter(Boolean).join(' · ')}
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
                </TouchableOpacity>
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
                      {isSuppliesGroup ? (
                        <>
                          <Input
                            label={t('inventory.itemName')}
                            value={itemName}
                            onChangeText={setItemName}
                            placeholder={t('inventory.itemNamePlaceholder')}
                          />
                          <Input
                            label={t('inventory.position')}
                            value={position}
                            onChangeText={setPosition}
                            placeholder={t('inventory.positionPlaceholder')}
                          />
                          <Dropdown
                            label={t('inventory.type')}
                            value={suppliesType}
                            options={[
                              { label: t('inventory.typeAluminios'), value: 'aluminios' },
                              { label: t('inventory.typeVedacoes'), value: 'vedacoes' },
                              { label: t('inventory.typeMagnets'), value: 'magnets' },
                            ]}
                            onSelect={setSuppliesType}
                          />
                          <Input
                            label={t('inventory.opoOeschgerCode')}
                            value={opoOeschgerCode}
                            onChangeText={setOpoOeschgerCode}
                            placeholder={t('inventory.opoOeschgerCodePlaceholder')}
                          />
                          <Input
                            label={t('inventory.lowStockThreshold')}
                            value={itemThreshold}
                            onChangeText={setItemThreshold}
                            placeholder={t('inventory.lowStockThresholdPlaceholder')}
                            keyboardType="numeric"
                          />
                          <View style={styles.productImageSection}>
                            <Text style={[styles.productImageLabel, { color: colors.text }]}>
                              {t('inventory.productImage')} ({t('inventory.maxImagesPerItem')})
                            </Text>
                            <View style={styles.productImageRow}>
                              {itemImages.map((entry, index) => (
                                <View key={entry.type === 'existing' ? entry.id : `new-${index}`} style={styles.productImagePreviewWrap}>
                                  {entry.type === 'existing' ? (
                                    <SignedInventoryImage
                                      storagePath={entry.storagePath}
                                      style={[styles.productImagePreview, { backgroundColor: colors.backgroundSecondary }]}
                                      imageStyle={styles.productImagePreview}
                                      placeholderIconSize={28}
                                    />
                                  ) : (
                                    <Image source={{ uri: entry.uri }} style={styles.productImagePreview} contentFit="cover" />
                                  )}
                                  <TouchableOpacity
                                    style={[styles.removeImageButton, { backgroundColor: colors.error }]}
                                    onPress={() => removeImage(index)}
                                  >
                                    <Ionicons name="close" size={18} color="#fff" />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={[
                                      styles.mainImageBadge,
                                      { backgroundColor: entry.isMain ? colors.primary : colors.backgroundSecondary },
                                    ]}
                                    onPress={() => setMainImage(index)}
                                  >
                                    <Text style={[styles.mainImageBadgeText, { color: entry.isMain ? colors.textInverse : colors.textSecondary }]}>
                                      {t('inventory.mainImage')}
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              ))}
                              {itemImages.length < 3 && (
                                <View style={styles.productImageButtons}>
                                  <TouchableOpacity
                                    style={[styles.productImageButton, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                                    onPress={handleTakePhoto}
                                    activeOpacity={0.7}
                                  >
                                    <Ionicons name="camera" size={24} color={colors.primary} />
                                    <Text style={[styles.productImageButtonText, { color: colors.primary }]}>{t('inventory.camera')}</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={[styles.productImageButton, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                                    onPress={handleChooseFromGallery}
                                    activeOpacity={0.7}
                                  >
                                    <Ionicons name="images" size={24} color={colors.primary} />
                                    <Text style={[styles.productImageButtonText, { color: colors.primary }]}>{t('inventory.gallery')}</Text>
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>
                          </View>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
    minHeight: 44,
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
  searchClearButton: {
    marginLeft: theme.spacing.xs,
    padding: theme.spacing.xs,
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
    gap: theme.spacing.md,
  },
  itemImageWrap: {
    width: 56,
    height: 56,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  itemImageWrapLarge: {
    width: 96,
    height: 96,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemImageLarge: {
    width: 96,
    height: 96,
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
  productImageSection: {
    marginBottom: theme.spacing.md,
  },
  productImageLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    marginBottom: theme.spacing.sm,
  },
  productImageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  productImagePreviewWrap: {
    position: 'relative',
  },
  productImagePreview: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.md,
  },
  productImageButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  productImageButton: {
    flex: 1,
    borderWidth: 2,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  productImageButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  removeImageButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainImageBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: theme.spacing.xs,
    alignItems: 'center',
    borderBottomLeftRadius: theme.borderRadius.md,
    borderBottomRightRadius: theme.borderRadius.md,
  },
  mainImageBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
  },
});
