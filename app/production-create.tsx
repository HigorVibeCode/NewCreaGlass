import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useRouteParams } from '../src/hooks/use-route-params';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    ActivityIndicator,
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
import { ClientAutocomplete } from '../src/components/shared/ClientAutocomplete';
import { DatePicker } from '../src/components/shared/DatePicker';
import { Dropdown, DropdownOption } from '../src/components/shared/Dropdown';
import { Input } from '../src/components/shared/Input';
import { useI18n } from '../src/hooks/use-i18n';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useGoBack, safeBack } from '../src/hooks/use-go-back';
import { repos } from '../src/services/container';
import { supabase } from '../src/services/supabase';
import { useAuth } from '../src/store/auth-store';
import { theme } from '../src/theme';
import {
    Client,
    GlassType,
    InventoryItem,
    PaintType,
    Production,
    ProductionAttachment,
    ProductionCompany,
    ProductionItem,
    StructureType,
} from '../src/types';

const CREA_GLASS_START_SEQ = 20; // Sequence starts at 0020

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
  const { productionId, quickAttachmentAction } = useRouteParams<{ productionId: string; quickAttachmentAction?: string }>('/production-create');
  const goBack = useGoBack();

  const [orderNumber, setOrderNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const [clients, setClients] = useState<Client[]>([]);
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
  const [isAutoOrderNumber, setIsAutoOrderNumber] = useState(false);
  const [loadingOrderNumber, setLoadingOrderNumber] = useState(false);
  const [quickActionHandled, setQuickActionHandled] = useState(false);

  const isEditing = !!productionId;

  /** Fetch the next available order number for Crea Glass (sequence starting at 0020) */
  const generateNextCreaGlassOrderNumber = useCallback(async (): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from('productions')
        .select('order_number')
        .eq('company', 'Crea Glass')
        .order('order_number', { ascending: false });

      if (error) {
        console.error('Error fetching Crea Glass order numbers:', error);
        return String(CREA_GLASS_START_SEQ).padStart(4, '0');
      }

      let maxNum = CREA_GLASS_START_SEQ - 1; // start below so first = 0020
      for (const row of data || []) {
        const num = parseInt(row.order_number, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }

      const nextNum = maxNum + 1;
      return String(nextNum).padStart(4, '0');
    } catch (err) {
      console.error('Error generating Crea Glass order number:', err);
      return String(CREA_GLASS_START_SEQ).padStart(4, '0');
    }
  }, []);

  /** Handle company change — auto-set order number for Crea Glass */
  const handleCompanyChange = useCallback(async (value: string) => {
    const newCompany = value as ProductionCompany;
    setCompany(newCompany);

    if (newCompany === 'Crea Glass' && !isEditing) {
      setIsAutoOrderNumber(true);
      setLoadingOrderNumber(true);
      try {
        const nextNumber = await generateNextCreaGlassOrderNumber();
        setOrderNumber(nextNumber);
      } finally {
        setLoadingOrderNumber(false);
      }
    } else {
      setIsAutoOrderNumber(false);
      if (!isEditing) {
        setOrderNumber('');
      }
    }
  }, [isEditing, generateNextCreaGlassOrderNumber]);

  useEffect(() => {
    loadGlassItems();
    loadClients();
    if (productionId) {
      loadProduction();
    }
  }, [productionId]);

  const loadClients = async () => {
    try {
      const allClients = await repos.clientsRepo.getAllClients();
      setClients(allClients);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const loadProduction = async () => {
    if (!productionId) return;
    setIsLoading(true);
    try {
      const productionData = await repos.productionRepo.getProductionById(productionId);
      if (productionData) {
        setOrderNumber(productionData.orderNumber);
        setClientId(productionData.clientId);
        setClientName(productionData.clientName);
        setOrderType(productionData.orderType);
        const loadedCompany = productionData.company || '3S';
        setCompany(loadedCompany);
        setIsAutoOrderNumber(loadedCompany === 'Crea Glass');
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
          { text: t('common.confirm'), onPress: () => safeBack(router) },
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
    { label: t('production.glassTypes.client_service'), value: 'client_service' },
    { label: t('production.glassTypes.polish_only'), value: 'polish_only' },
    { label: t('production.glassTypes.cutting_only'), value: 'cutting_only' },
    { label: t('production.glassTypes.tempered'), value: 'tempered' },
    { label: t('production.glassTypes.strengthened'), value: 'strengthened' },
    { label: t('production.glassTypes.schmelzglas_only'), value: 'schmelzglas_only' },
    { label: t('production.glassTypes.textured'), value: 'textured' },
    { label: t('production.glassTypes.schmelzglas_tvg'), value: 'schmelzglas_tvg' },
    { label: t('production.glassTypes.float_esg'), value: 'float_esg' },
    { label: t('production.glassTypes.float_tvg'), value: 'float_tvg' },
    { label: t('production.glassTypes.laminated'), value: 'laminated' },
    { label: t('production.glassTypes.lavabo'), value: 'lavabo' },
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
    const isQuickCameraFlow = isEditing && quickAttachmentAction === 'camera' && !!productionId;
    let baseAttachments = attachments;

    if (isQuickCameraFlow) {
      try {
        const latestProduction = await repos.productionRepo.getProductionById(productionId);
        if (!latestProduction) {
          Alert.alert(t('common.error'), t('production.updateStatusError') || 'Order not found');
          safeBack(router);
          return;
        }
        baseAttachments = latestProduction.attachments || [];
      } catch (loadError) {
        console.error('Error loading latest attachments for quick camera flow:', loadError);
        Alert.alert(t('common.error'), t('production.addAttachmentError'));
        safeBack(router);
        return;
      }
    }

    if (baseAttachments.length >= MAX_ATTACHMENTS) {
      Alert.alert(t('common.error'), t('production.maxAttachments'));
      if (isQuickCameraFlow) {
        safeBack(router);
      }
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
        webFile: (asset as any).file,
        createdAt: new Date().toISOString(),
      };
      const nextAttachments = [...baseAttachments, newAttachment];

      if (isQuickCameraFlow) {
        try {
          setIsCreating(true);
          await repos.productionRepo.updateProduction(
            productionId,
            { attachments: nextAttachments },
            user?.id
          );
          if (Platform.OS === 'web') {
            window.alert(t('common.success') || 'Saved');
          } else {
            Alert.alert(t('common.success'), t('production.orderUpdated') || 'Order updated');
          }
          safeBack(router);
          return;
        } catch (saveError) {
          console.error('Error saving quick camera attachment:', saveError);
          Alert.alert(t('common.error'), t('production.addAttachmentError'));
        } finally {
          setIsCreating(false);
        }
      }

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
        webFile: (asset as any).file,
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
        webFile: (file as any).file,
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

  useEffect(() => {
    if (!isEditing || quickActionHandled) return;
    if (quickAttachmentAction !== 'camera') return;
    if (isLoading) return;
    setQuickActionHandled(true);
    handleTakePhoto();
  }, [isEditing, quickAttachmentAction, isLoading, quickActionHandled]);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert(title, message);
    }
  };

  const validateForm = (): boolean => {
    if (!company || (company !== '3S' && company !== 'Crea Glass')) {
      showAlert(t('common.error'), 'Selecione a Company (3S ou Crea Glass).');
      return false;
    }

    // Order number: required for 3S (manual), auto-generated for Crea Glass
    if (company === '3S' && !orderNumber.trim()) {
      showAlert(t('common.error'), t('production.fillRequiredFields'));
      return false;
    }

    if (company === 'Crea Glass' && !orderNumber.trim()) {
      showAlert(t('common.error'), 'Erro ao gerar número do pedido. Tente novamente.');
      return false;
    }

    if (!clientId && !isEditing) {
      showAlert(t('common.error'), t('production.fillRequiredFields'));
      return false;
    }

    if (!orderType.trim()) {
      showAlert(t('common.error'), t('production.fillRequiredFields'));
      return false;
    }

    if (!dueDate.trim()) {
      showAlert(t('common.error'), t('production.fillRequiredFields'));
      return false;
    }

    if (!productionItem.glassId || !productionItem.glassType || !productionItem.quantity.trim() || !productionItem.areaM2.trim()) {
      showAlert(t('common.error'), t('production.fillRequiredFields'));
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
          clientId,
          clientName: clientName.trim(),
          orderType: orderType.trim(),
          company,
          dueDate,
          items: [item],
          attachments,
        });
        if (Platform.OS === 'web') {
          window.alert('Order updated successfully');
          safeBack(router);
        } else {
          Alert.alert(t('common.success'), 'Order updated successfully', [
            { text: t('common.confirm'), onPress: () => safeBack(router) },
          ]);
        }
      } else {
        // Create new production
        const newProduction: Omit<Production, 'id' | 'createdAt'> = {
          orderNumber: orderNumber.trim(),
          clientId,
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
        if (Platform.OS === 'web') {
          window.alert(t('production.orderCreated') || 'Production order created');
          safeBack(router);
        } else {
          Alert.alert(t('common.success'), t('production.orderCreated'), [
            { text: t('common.confirm'), onPress: () => safeBack(router) },
          ]);
        }
      }
    } catch (error) {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} production order:`, error);
      showAlert(t('common.error'), isEditing ? 'Failed to update order' : t('production.createOrderError'));
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

  const lowStockGlassIds = useMemo(
    () =>
      new Set(
        glassItems
          .filter((item) => item.lowStockThreshold > 0 && item.stock <= item.lowStockThreshold)
          .map((item) => item.id)
      ),
    [glassItems]
  );

  const selectedGlassItem = useMemo(
    () => glassItems.find((item) => item.id === productionItem.glassId) || null,
    [glassItems, productionItem.glassId]
  );

  const isSelectedGlassLowStock = !!selectedGlassItem && selectedGlassItem.lowStockThreshold > 0 && selectedGlassItem.stock <= selectedGlassItem.lowStockThreshold;

  const handleSelectGlass = useCallback(
    (glassId: string) => {
      handleUpdateItem('glassId', glassId);
      const selected = glassItems.find((item) => item.id === glassId);
      if (selected && selected.lowStockThreshold > 0 && selected.stock <= selected.lowStockThreshold) {
        showAlert(
          t('inventory.lowStock'),
          t('production.lowStockSelectedWarning', {
            itemName: selected.name,
            stock: selected.stock,
            threshold: selected.lowStockThreshold,
          })
        );
      }
    },
    [glassItems, t]
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.md, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.backgroundSecondary }]}
          onPress={goBack}
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
        {/* 1. Client & Company */}
        <ClientAutocomplete
          label="Cliente *"
          clients={clients}
          selectedClientId={clientId}
          placeholder={t('production.clientNamePlaceholder')}
          onSelectClient={(client) => {
            setClientId(client.id);
            setClientName(client.name);
          }}
          onManageClientsPress={() => router.push('/clients')}
        />

        <Dropdown
          label="Company *"
          value={company}
          options={companyOptions}
          onSelect={handleCompanyChange}
        />

        {/* 2. Order Number (manual for 3S, auto for Crea Glass) */}
        {isAutoOrderNumber ? (
          <View style={styles.autoOrderRow}>
            <View style={styles.autoOrderField}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {t('production.orderNumber')}
              </Text>
              <View style={[styles.autoOrderValueBox, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                {loadingOrderNumber ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[styles.autoOrderValue, { color: colors.text }]}>
                    {orderNumber || '—'}
                  </Text>
                )}
                <View style={[styles.autoOrderBadge, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.autoOrderBadgeText, { color: colors.primary }]}>Auto</Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <Input
            label={t('production.orderNumber')}
            value={orderNumber}
            onChangeText={setOrderNumber}
            placeholder={t('production.orderNumberPlaceholder')}
          />
        )}

        <Input
          label="Order Type"
          value={orderType}
          onChangeText={setOrderType}
          placeholder={t('production.orderTypePlaceholder')}
        />

        {/* 3. Schedule */}
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
              onSelect={handleSelectGlass}
              getOptionTextColor={(option) => (lowStockGlassIds.has(option.value) ? colors.error : undefined)}
            />
            {isSelectedGlassLowStock && selectedGlassItem && (
              <View style={[styles.lowStockAlert, { backgroundColor: colors.error + '12', borderColor: colors.error + '55' }]}>
                <Ionicons name="warning-outline" size={16} color={colors.error} />
                <Text style={[styles.lowStockAlertText, { color: colors.error }]}>
                  {t('production.lowStockSelectedWarning', {
                    itemName: selectedGlassItem.name,
                    stock: selectedGlassItem.stock,
                    threshold: selectedGlassItem.lowStockThreshold,
                  })}
                </Text>
              </View>
            )}

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

          {attachments.length > 0 && (
            <View style={styles.attachmentGrid}>
              {attachments.map((attachment) => {
                const isImage = attachment.mimeType?.startsWith('image/');
                const isPdf = attachment.mimeType === 'application/pdf';
                return (
                  <View
                    key={attachment.id}
                    style={[styles.attachmentThumbCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                  >
                    {isImage ? (
                      <Image
                        source={{ uri: attachment.storagePath }}
                        style={styles.attachmentThumbImage}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <View style={[styles.attachmentThumbFallback, { backgroundColor: colors.backgroundSecondary }]}>
                        <Ionicons
                          name={isPdf ? 'document-text-outline' : 'videocam-outline'}
                          size={24}
                          color={colors.textSecondary}
                        />
                        <Text
                          numberOfLines={2}
                          style={[styles.attachmentThumbName, { color: colors.textSecondary }]}
                        >
                          {attachment.filename}
                        </Text>
                      </View>
                    )}
                    <TouchableOpacity
                      onPress={() => handleRemoveAttachment(attachment.id)}
                      style={[styles.removeFloatingButton, { backgroundColor: colors.error }]}
                    >
                      <Ionicons name="close" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title={t('common.cancel')}
            onPress={goBack}
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
  lowStockAlert: {
    marginTop: -theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  lowStockAlertText: {
    flex: 1,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
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
  attachmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  attachmentThumbCard: {
    width: 110,
    height: 110,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    ...theme.shadows.sm,
  },
  attachmentThumbImage: {
    width: '100%',
    height: '100%',
  },
  attachmentThumbFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  attachmentThumbName: {
    fontSize: theme.typography.fontSize.xs,
    textAlign: 'center',
  },
  removeFloatingButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoOrderRow: {
    marginBottom: theme.spacing.md,
  },
  autoOrderField: {
    gap: theme.spacing.xs,
  },
  fieldLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    marginBottom: 4,
  },
  autoOrderValueBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    minHeight: 48,
  },
  autoOrderValue: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    letterSpacing: 1,
  },
  autoOrderBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  autoOrderBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
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
