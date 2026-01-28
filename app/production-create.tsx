import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
    ProductionCompany,
    ProductionItem,
    StructureType,
} from '../src/types';

const GLASS_GROUP_ID = 'group-glass';
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
const MAX_ATTACHMENTS = 10;

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
  const insets = useSafeAreaInsets();
  const { productionId } = useLocalSearchParams<{ productionId: string }>();

  const [orderNumber, setOrderNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [orderType, setOrderType] = useState('');
  const [company, setCompany] = useState<ProductionCompany>('3S');
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
        setCompany(productionData.company || '3S');
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

  const companyOptions: DropdownOption[] = [
    { label: '3S', value: '3S' },
    { label: 'Crea Glass', value: 'Crea Glass' },
  ];

  const handleUpdateItem = (field: keyof ProductionItemForm, value: string) => {
    setProductionItem({ ...productionItem, [field]: value });
  };

  const handleTakePhoto = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      Alert.alert(t('common.error'), t('production.maxAttachments'));
      return;
    }
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.error'), t('production.cameraPermissionDenied') || 'Permissão da câmera negada');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const filename = asset.uri.split('/').pop() || `photo_${Date.now()}.jpg`;
      const mimeType = asset.mimeType || 'image/jpeg';

      const newAttachment: ProductionAttachment = {
        id: 'attach-' + Date.now(),
        filename,
        mimeType,
        storagePath: asset.uri,
        createdAt: new Date().toISOString(),
      };

      setAttachments([...attachments, newAttachment]);
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert(t('common.error'), t('production.addAttachmentError'));
    }
  };

  const handleChooseFromLibrary = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      Alert.alert(t('common.error'), t('production.maxAttachments'));
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.error'), t('production.mediaPermissionDenied') || 'Permissão da galeria negada');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const filename = asset.uri.split('/').pop() || `image_${Date.now()}.jpg`;
      const mimeType = asset.mimeType || 'image/jpeg';

      const newAttachment: ProductionAttachment = {
        id: 'attach-' + Date.now(),
        filename,
        mimeType,
        storagePath: asset.uri,
        createdAt: new Date().toISOString(),
      };

      setAttachments([...attachments, newAttachment]);
    } catch (error) {
      console.error('Error choosing from library:', error);
      Alert.alert(t('common.error'), t('production.addAttachmentError'));
    }
  };

  const handleChooseDocument = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      Alert.alert(t('common.error'), t('production.maxAttachments'));
      return;
    }

    try {
      // Usar tipos específicos do DocumentPicker para melhor compatibilidade
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/webp',
          'video/mp4',
          'video/quicktime',
          'video/x-msvideo',
          'video/webm',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      
      // Verificar se o tipo é permitido após seleção
      const fileMimeType = file.mimeType || 'application/octet-stream';
      const fileExtension = file.name?.split('.').pop()?.toLowerCase() || '';
      
      const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(fileExtension) || 
                      fileMimeType.startsWith('image/');
      const isPDF = fileExtension === 'pdf' || fileMimeType === 'application/pdf';
      const isVideo = fileExtension === 'mp4' || fileExtension === 'mov' || fileExtension === 'avi' || fileExtension === 'webm' || fileMimeType.startsWith('video/');
      
      if (!isImage && !isPDF && !isVideo) {
        Alert.alert(
          t('common.error'), 
          t('documents.allowedTypes') || 'Apenas imagens (JPG, PNG, WEBP), PDF e vídeos são permitidos'
        );
        return;
      }

      const newAttachment: ProductionAttachment = {
        id: 'attach-' + Date.now(),
        filename: file.name,
        mimeType: fileMimeType,
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

    if (!company || (company !== '3S' && company !== 'Crea Glass')) {
      Alert.alert(t('common.error'), 'Selecione a Company (3S ou Crea Glass).');
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
          company,
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
          company,
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
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.md, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.backgroundSecondary }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {isEditing ? (t('production.editOrder') || 'Edit Order') : t('production.createOrder')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={[
          styles.content, 
          { 
            paddingBottom: insets.bottom + theme.spacing.md 
          }
        ]}
      >
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

        <Dropdown
          label="Company *"
          value={company}
          options={companyOptions}
          onSelect={(value) => setCompany(value as ProductionCompany)}
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
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('production.attachments')} ({attachments.length}/{MAX_ATTACHMENTS})
          </Text>
          {attachments.length < MAX_ATTACHMENTS && (
            <View style={styles.attachmentOptions}>
              <TouchableOpacity
                style={[styles.attachmentOption, { backgroundColor: colors.backgroundSecondary }]}
                onPress={handleTakePhoto}
                activeOpacity={0.7}
              >
                <Ionicons name="camera" size={28} color={colors.primary} />
                <Text style={[styles.attachmentOptionLabel, { color: colors.text }]}>
                  {t('production.takePhoto') || 'Tirar Foto'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.attachmentOption, { backgroundColor: colors.backgroundSecondary }]}
                onPress={handleChooseFromLibrary}
                activeOpacity={0.7}
              >
                <Ionicons name="image" size={28} color={colors.primary} />
                <Text style={[styles.attachmentOptionLabel, { color: colors.text }]}>
                  {t('production.chooseFromLibrary') || 'Galeria'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.attachmentOption, { backgroundColor: colors.backgroundSecondary }]}
                onPress={handleChooseDocument}
                activeOpacity={0.7}
              >
                <Ionicons name="document-text" size={28} color={colors.primary} />
                <Text style={[styles.attachmentOptionLabel, { color: colors.text }]}>
                  {t('production.chooseDocument') || 'PDF'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: theme.spacing.md,
  },
  headerSpacer: {
    width: 40,
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
  attachmentOptions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  attachmentOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    minHeight: 100,
    gap: theme.spacing.xs,
    ...theme.shadows.sm,
  },
  attachmentOptionLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    textAlign: 'center',
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
