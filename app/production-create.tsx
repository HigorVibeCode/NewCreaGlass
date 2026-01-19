import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Button } from '../src/components/shared/Button';
import { DatePicker } from '../src/components/shared/DatePicker';
import { Dropdown, DropdownOption } from '../src/components/shared/Dropdown';
import { Input } from '../src/components/shared/Input';
import { useI18n } from '../src/hooks/use-i18n';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { repos } from '../src/services/container';
import { useAuth } from '../src/store/auth-store';
import { theme } from '../src/theme';
import {
    GlassType,
    InventoryItem,
    PaintType,
    Production,
    ProductionAttachment,
    ProductionItem,
    StructureType,
} from '../src/types';

const GLASS_GROUP_ID = 'group-glass';
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_ATTACHMENTS = 3;

interface ProductionItemForm {
  glassId: string;
  glassType: GlassType | '';
  quantity: string;
  areaM2: string;
  structureType: StructureType;
  paintType: PaintType;
}

export default function ProductionCreateScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const colors = useThemeColors();
  const { productionId } = useLocalSearchParams<{ productionId: string }>();

  const [orderNumber, setOrderNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [orderType, setOrderType] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [glassItems, setGlassItems] = useState<InventoryItem[]>([]);
  const [productionItem, setProductionItem] = useState<ProductionItemForm>({
    glassId: '',
    glassType: '',
    quantity: '',
    areaM2: '',
    structureType: 'none',
    paintType: 'none',
  });
  const [attachments, setAttachments] = useState<ProductionAttachment[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [loadingGlassItems, setLoadingGlassItems] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isEditing = !!productionId;

  useEffect(() => {
    loadGlassItems();
    if (productionId) {
      loadProduction();
    }
  }, [productionId]);

  const loadProduction = async () => {
    if (!productionId) return;
    setIsLoading(true);
    try {
      const productionData = await repos.productionRepo.getProductionById(productionId);
      if (productionData) {
        setOrderNumber(productionData.orderNumber);
        setClientName(productionData.clientName);
        setOrderType(productionData.orderType);
        setDueDate(productionData.dueDate);
        setAttachments(productionData.attachments);
        if (productionData.items.length > 0) {
          const item = productionData.items[0];
          setProductionItem({
            glassId: item.glassId,
            glassType: item.glassType,
            quantity: item.quantity.toString(),
            areaM2: item.areaM2.toString(),
            structureType: item.structureType,
            paintType: item.paintType,
          });
        }
      } else {
        Alert.alert(t('common.error'), 'Production order not found', [
          { text: t('common.confirm'), onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      console.error('Error loading production:', error);
      Alert.alert(t('common.error'), 'Failed to load production order');
    } finally {
      setIsLoading(false);
    }
  };

  const loadGlassItems = async () => {
    setLoadingGlassItems(true);
    try {
      const items = await repos.inventoryRepo.getItemsByGroup(GLASS_GROUP_ID);
      setGlassItems(items);
    } catch (error) {
      console.error('Error loading glass items:', error);
      Alert.alert(t('common.error'), t('production.loadGlassItemsError'));
    } finally {
      setLoadingGlassItems(false);
    }
  };

  const glassTypeOptions: DropdownOption[] = [
    { label: t('common.select'), value: '' },
    { label: t('production.glassTypes.tempered'), value: 'tempered' },
    { label: t('production.glassTypes.strengthened'), value: 'strengthened' },
    { label: t('production.glassTypes.textured'), value: 'textured' },
    { label: t('production.glassTypes.laminated'), value: 'laminated' },
    { label: t('production.glassTypes.sandblasted'), value: 'sandblasted' },
    { label: t('production.glassTypes.cuted'), value: 'cuted' },
    { label: t('production.glassTypes.insulated'), value: 'insulated' },
  ];

  const structureTypeOptions: DropdownOption[] = [
    { label: t('production.structureTypes.none'), value: 'none' },
    { label: t('production.structureTypes.linear'), value: 'linear' },
    { label: t('production.structureTypes.abstract'), value: 'abstract' },
    { label: t('production.structureTypes.organic'), value: 'organic' },
    { label: t('production.structureTypes.check_project'), value: 'check_project' },
  ];

  const paintTypeOptions: DropdownOption[] = [
    { label: t('production.paintTypes.none'), value: 'none' },
    { label: t('production.paintTypes.solid'), value: 'solid' },
    { label: t('production.paintTypes.gradient'), value: 'gradient' },
    { label: t('production.paintTypes.printed'), value: 'printed' },
    { label: t('production.paintTypes.satiniert'), value: 'satiniert' },
    { label: t('production.paintTypes.check_project'), value: 'check_project' },
  ];

  const handleUpdateItem = (field: keyof ProductionItemForm, value: string) => {
    setProductionItem({ ...productionItem, [field]: value });
  };

  const handleAddAttachment = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      Alert.alert(t('common.error'), t('production.maxAttachments'));
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ALLOWED_MIME_TYPES,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      if (!ALLOWED_MIME_TYPES.includes(file.mimeType || '')) {
        Alert.alert(t('common.error'), t('documents.allowedTypes'));
        return;
      }

      const newAttachment: ProductionAttachment = {
        id: 'attach-' + Date.now(),
        filename: file.name,
        mimeType: file.mimeType || 'application/octet-stream',
        storagePath: file.uri,
        createdAt: new Date().toISOString(),
      };

      setAttachments([...attachments, newAttachment]);
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert(t('common.error'), t('production.addAttachmentError'));
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(attachments.filter((att) => att.id !== id));
  };

  const validateForm = (): boolean => {
    if (!orderNumber.trim()) {
      Alert.alert(t('common.error'), t('production.fillRequiredFields'));
      return false;
    }

    if (!clientName.trim()) {
      Alert.alert(t('common.error'), t('production.fillRequiredFields'));
      return false;
    }

    if (!orderType.trim()) {
      Alert.alert(t('common.error'), t('production.fillRequiredFields'));
      return false;
    }

    if (!dueDate.trim()) {
      Alert.alert(t('common.error'), t('production.fillRequiredFields'));
      return false;
    }

    if (!productionItem.glassId || !productionItem.glassType || !productionItem.quantity.trim() || !productionItem.areaM2.trim()) {
      Alert.alert(t('common.error'), t('production.fillRequiredFields'));
      return false;
    }

    return true;
  };

  const handleCreateOrder = async () => {
    if (!user) return;

    if (!validateForm()) return;

    setIsCreating(true);
    try {
      const item: ProductionItem = {
        id: 'item-0',
        glassId: productionItem.glassId,
        glassType: productionItem.glassType as GlassType,
        quantity: parseFloat(productionItem.quantity),
        areaM2: parseFloat(productionItem.areaM2),
        structureType: productionItem.structureType,
        paintType: productionItem.paintType,
      };

      if (isEditing && productionId) {
        // Update existing production
        await repos.productionRepo.updateProduction(productionId, {
          orderNumber: orderNumber.trim(),
          clientName: clientName.trim(),
          orderType: orderType.trim(),
          dueDate,
          items: [item],
          attachments,
        });
        Alert.alert(t('common.success'), 'Order updated successfully', [
          { text: t('common.confirm'), onPress: () => router.back() },
        ]);
      } else {
        // Create new production
        const newProduction: Omit<Production, 'id' | 'createdAt'> = {
          orderNumber: orderNumber.trim(),
          clientName: clientName.trim(),
          orderType: orderType.trim(),
          dueDate,
          status: 'not_authorized',
          items: [item],
          attachments,
          createdBy: user.id,
        };

        await repos.productionRepo.createProduction(newProduction);
        Alert.alert(t('common.success'), t('production.orderCreated'), [
          { text: t('common.confirm'), onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} production order:`, error);
      Alert.alert(t('common.error'), isEditing ? 'Failed to update order' : t('production.createOrderError'));
    } finally {
      setIsCreating(false);
    }
  };

  const glassOptions: DropdownOption[] = glassItems.length > 0
    ? [
        { label: t('common.select'), value: '' },
        ...glassItems.map((item) => ({
          label: item.name,
          value: item.id,
        })),
      ]
    : [{ label: t('common.select'), value: '' }];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Input
          label="Client Name"
          value={clientName}
          onChangeText={setClientName}
          placeholder={t('production.clientNamePlaceholder')}
        />

        <Input
          label="Order Type"
          value={orderType}
          onChangeText={setOrderType}
          placeholder={t('production.orderTypePlaceholder')}
        />

        <Input
          label={t('production.orderNumber')}
          value={orderNumber}
          onChangeText={setOrderNumber}
          placeholder={t('production.orderNumberPlaceholder')}
        />

        <DatePicker
          label={t('production.dueDate')}
          value={dueDate}
          onSelect={setDueDate}
          placeholder={t('production.selectDueDate')}
        />

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('production.items')}
          </Text>

          <View style={[styles.itemCard, { backgroundColor: colors.cardBackground }]}>
            <Dropdown
              label={t('production.glass')}
              value={productionItem.glassId}
              options={glassOptions}
              onSelect={(value) => handleUpdateItem('glassId', value)}
            />

            <Dropdown
              label={t('production.glassType')}
              value={productionItem.glassType}
              options={glassTypeOptions}
              onSelect={(value) => handleUpdateItem('glassType', value)}
            />

            <Input
              label={t('production.quantity')}
              value={productionItem.quantity}
              onChangeText={(value) => handleUpdateItem('quantity', value)}
              placeholder="0"
              keyboardType="numeric"
            />

            <Input
              label={t('production.areaM2')}
              value={productionItem.areaM2}
              onChangeText={(value) => handleUpdateItem('areaM2', value)}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />

            <Dropdown
              label={t('production.structureType')}
              value={productionItem.structureType}
              options={structureTypeOptions}
              onSelect={(value) => handleUpdateItem('structureType', value as StructureType)}
            />

            <Dropdown
              label={t('production.paintType')}
              value={productionItem.paintType}
              options={paintTypeOptions}
              onSelect={(value) => handleUpdateItem('paintType', value as PaintType)}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('production.attachments')} ({attachments.length}/{MAX_ATTACHMENTS})
            </Text>
            {attachments.length < MAX_ATTACHMENTS && (
              <Button
                title={t('production.addAttachment')}
                onPress={handleAddAttachment}
                variant="outline"
                style={styles.addButton}
              />
            )}
          </View>

          {attachments.map((attachment) => (
            <View
              key={attachment.id}
              style={[styles.attachmentCard, { backgroundColor: colors.cardBackground }]}
            >
              <Text style={[styles.attachmentName, { color: colors.text }]}>{attachment.filename}</Text>
              <TouchableOpacity
                onPress={() => handleRemoveAttachment(attachment.id)}
                style={[styles.removeButton, { backgroundColor: colors.error + '20' }]}
              >
                <Ionicons name="close" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title={t('common.cancel')}
            onPress={() => router.back()}
            variant="outline"
            style={styles.button}
          />
          <Button
            title={isEditing ? t('common.save') : t('common.create')}
            onPress={handleCreateOrder}
            loading={isCreating || isLoading}
            style={styles.button}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  section: {
    marginTop: theme.spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  addButton: {
    paddingHorizontal: theme.spacing.md,
  },
  itemCard: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  attachmentName: {
    flex: 1,
    fontSize: theme.typography.fontSize.md,
    marginRight: theme.spacing.sm,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  button: {
    flex: 1,
  },
});
