import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useRouteParams } from '../src/hooks/use-route-params';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { useAuth } from '../src/store/auth-store';
import { usePermissions } from '../src/hooks/use-permissions';
import { Button } from '../src/components/shared/Button';
import { Input } from '../src/components/shared/Input';
import { Dropdown, DropdownOption } from '../src/components/shared/Dropdown';
import { DatePicker } from '../src/components/shared/DatePicker';
import { TimePicker } from '../src/components/shared/TimePicker';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { PermissionGuard } from '../src/components/shared/PermissionGuard';
import { repos } from '../src/services/container';
import { supabase } from '../src/services/supabase';
import { User, WorkOrder, WorkOrderServiceType } from '../src/types';
import { theme } from '../src/theme';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useGoBack, safeBack } from '../src/hooks/use-go-back';

interface WOAttachment {
  id: string;
  filename: string;
  uri: string;
  mimeType: string;
}

const MAX_ATTACHMENTS = 10;

export default function WorkOrderCreateScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { workOrderId } = useRouteParams<{ workOrderId: string }>('/event-report-create');
  const goBack = useGoBack('/(tabs)/events');

  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [serviceType, setServiceType] = useState<WorkOrderServiceType | ''>('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [plannedMaterials, setPlannedMaterials] = useState('');
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [attachments, setAttachments] = useState<WOAttachment[]>([]);

  // Load active users for team selection
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const users = await repos.usersRepo.getAllUsers();
        setAllUsers(users);
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };
    loadUsers();
  }, []);

  // Load work order data if in edit mode
  useEffect(() => {
    if (workOrderId) {
      setIsEditMode(true);
      loadWorkOrder();
    }
  }, [workOrderId]);

  const loadWorkOrder = async () => {
    if (!workOrderId) return;
    setIsLoading(true);
    try {
      const workOrderData = await repos.workOrdersRepo.getWorkOrderById(workOrderId);
      if (workOrderData) {
        setClientName(workOrderData.clientName || '');
        setClientAddress(workOrderData.clientAddress || '');
        setClientContact(workOrderData.clientContact || '');
        setServiceType(workOrderData.serviceType || '');
        setScheduledDate(workOrderData.scheduledDate || '');
        setScheduledTime(workOrderData.scheduledTime || '');
        // Convert plannedMaterials array to string
        const materialsText = workOrderData.plannedMaterials && workOrderData.plannedMaterials.length > 0
          ? workOrderData.plannedMaterials.map((m: any) => m.name || '').join(', ')
          : '';
        setPlannedMaterials(materialsText);
        // Load team members
        if (workOrderData.teamMembers && workOrderData.teamMembers.length > 0) {
          setSelectedTeamMembers(workOrderData.teamMembers);
        }
      } else {
        if (Platform.OS === 'web') {
          window.alert('Work order not found');
          safeBack(router);
        } else {
          Alert.alert(t('common.error'), 'Work order not found', [
            { text: t('common.confirm'), onPress: () => safeBack(router) },
          ]);
        }
      }
    } catch (error) {
      console.error('Error loading work order:', error);
      Alert.alert(t('common.error'), 'Failed to load work order');
    } finally {
      setIsLoading(false);
    }
  };

  const serviceTypeOptions: DropdownOption[] = [
    { label: t('common.select'), value: '' },
    { label: t('workOrders.serviceTypeOptions.maintenance'), value: 'maintenance' },
    { label: t('workOrders.serviceTypeOptions.installation'), value: 'installation' },
    { label: t('workOrders.serviceTypeOptions.internal'), value: 'internal' },
    { label: t('workOrders.serviceTypeOptions.external'), value: 'external' },
  ];

  // ---------- Attachment handlers (same pattern as Production) ----------
  const handleTakePhoto = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      Alert.alert(t('common.error'), t('production.maxAttachments') || `Máximo de ${MAX_ATTACHMENTS} anexos`);
      return;
    }
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.error'), t('production.cameraPermissionDenied') || 'Permissão da câmera negada');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      setAttachments((prev) => [
        ...prev,
        {
          id: 'att-' + Date.now(),
          filename: asset.uri.split('/').pop() || `photo_${Date.now()}.jpg`,
          uri: asset.uri,
          mimeType: asset.mimeType || 'image/jpeg',
        },
      ]);
    } catch (error) {
      console.error('Error taking photo:', error);
    }
  };

  const handleChooseFromLibrary = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      Alert.alert(t('common.error'), t('production.maxAttachments') || `Máximo de ${MAX_ATTACHMENTS} anexos`);
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.error'), t('production.mediaPermissionDenied') || 'Permissão da galeria negada');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      setAttachments((prev) => [
        ...prev,
        {
          id: 'att-' + Date.now(),
          filename: asset.uri.split('/').pop() || `image_${Date.now()}.jpg`,
          uri: asset.uri,
          mimeType: asset.mimeType || 'image/jpeg',
        },
      ]);
    } catch (error) {
      console.error('Error choosing from library:', error);
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  /** Upload local attachments as work order evidences after creation */
  const uploadAttachments = async (workOrderId: string, userId: string) => {
    const bucketName = 'documents';

    for (const att of attachments) {
      try {
        const timestamp = Date.now();
        const uniqueFilename = `${timestamp}_${att.filename}`;

        // Upload to Supabase Storage (same pattern as Production)
        let fileData: Blob | Uint8Array;

        if (Platform.OS === 'web') {
          // Web: fetch blob directly
          const response = await fetch(att.uri);
          fileData = await response.blob();
        } else {
          // Mobile: fetch blob and convert
          const response = await fetch(att.uri);
          const blob = await response.blob();
          const arrayBuffer = await new Response(blob).arrayBuffer();
          fileData = new Uint8Array(arrayBuffer);
        }

        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(uniqueFilename, fileData, { contentType: att.mimeType, upsert: false });

        if (uploadError) {
          console.error('Error uploading attachment:', uploadError);
          continue;
        }

        // Store only the filename (not URL) - same pattern as Production.
        // The detail screen resolves it to a signed URL when displaying.
        const photoPath = uniqueFilename;

        // Create evidence record linked to the work order
        await repos.workOrdersRepo.createEvidence(workOrderId, {
          type: 'antes',
          photoPath,
          createdBy: userId,
        });
      } catch (err) {
        console.error('Error uploading attachment:', err);
      }
    }
  };

  const validateForm = (): boolean => {
    if (!clientName.trim()) {
      Alert.alert(t('common.error'), t('workOrders.fillRequiredFields') || 'Por favor, preencha todos os campos obrigatórios');
      return false;
    }

    if (!clientAddress.trim()) {
      Alert.alert(t('common.error'), t('workOrders.fillRequiredFields') || 'Por favor, preencha todos os campos obrigatórios');
      return false;
    }

    if (!clientContact.trim()) {
      Alert.alert(t('common.error'), t('workOrders.fillRequiredFields') || 'Por favor, preencha todos os campos obrigatórios');
      return false;
    }

    if (!serviceType) {
      Alert.alert(t('common.error'), t('workOrders.fillRequiredFields') || 'Por favor, preencha todos os campos obrigatórios');
      return false;
    }

    if (!scheduledDate.trim()) {
      Alert.alert(t('common.error'), t('workOrders.fillRequiredFields') || 'Por favor, preencha todos os campos obrigatórios');
      return false;
    }

    if (!scheduledTime.trim()) {
      Alert.alert(t('common.error'), t('workOrders.fillRequiredFields') || 'Por favor, preencha todos os campos obrigatórios');
      return false;
    }

    if (!user) {
      Alert.alert(t('common.error'), 'User not authenticated');
      return false;
    }

    return true;
  };

  const handleSaveWorkOrder = async () => {
    if (!user) return;

    // Verificar permissão antes de criar/editar
    if (isEditMode && !hasPermission('workOrders.update')) {
      Alert.alert(t('common.error'), 'Você não tem permissão para editar ordens de serviço');
      return;
    }
    if (!isEditMode && !hasPermission('workOrders.create')) {
      Alert.alert(t('common.error'), 'Você não tem permissão para criar ordens de serviço');
      return;
    }

    if (!validateForm()) return;

    setIsCreating(true);
    try {
      // Convert plannedMaterials text to array format if text is provided
      const plannedMaterialsArray = plannedMaterials.trim()
        ? [{
            id: `temp-${Date.now()}`,
            name: plannedMaterials.trim(),
            quantity: 1,
            unit: '',
          }]
        : [];

      if (isEditMode && workOrderId) {
        // Update existing work order
        const updates: Partial<WorkOrder> = {
          clientName: clientName.trim(),
          clientAddress: clientAddress.trim(),
          clientContact: clientContact.trim(),
          serviceType: serviceType as WorkOrderServiceType,
          scheduledDate,
          scheduledTime,
          plannedMaterials: plannedMaterialsArray,
          teamMembers: selectedTeamMembers,
        };

        await repos.workOrdersRepo.updateWorkOrder(workOrderId, updates);

        // Upload new attachments as evidences
        if (attachments.length > 0) {
          await uploadAttachments(workOrderId, user.id);
        }

        if (Platform.OS === 'web') {
          window.alert(t('workOrders.orderUpdated') || 'Ordem de serviço atualizada com sucesso');
          router.replace({
            pathname: '/work-order-detail',
            params: { workOrderId },
          });
        } else {
          Alert.alert(t('common.success'), t('workOrders.orderUpdated') || 'Ordem de serviço atualizada com sucesso', [
            { 
              text: t('common.confirm'), 
              onPress: () => router.replace({
                pathname: '/work-order-detail',
                params: { workOrderId },
              }),
            },
          ]);
        }
      } else {
        // Create new work order
        const newWorkOrder: Omit<WorkOrder, 'id' | 'createdAt' | 'updatedAt'> = {
          clientName: clientName.trim(),
          clientAddress: clientAddress.trim(),
          clientContact: clientContact.trim(),
          serviceType: serviceType as WorkOrderServiceType,
          scheduledDate,
          scheduledTime,
          status: 'planned',
          plannedChecklist: [],
          plannedMaterials: plannedMaterialsArray,
          teamMembers: selectedTeamMembers,
          responsible: user.id,
          isLocked: false,
          timeStatuses: [],
          serviceLogs: [],
          evidences: [],
          checklistItems: [],
          createdBy: user.id,
        };

        const createdWorkOrder = await repos.workOrdersRepo.createWorkOrder(newWorkOrder);

        // Upload attachments as evidences
        if (attachments.length > 0) {
          await uploadAttachments(createdWorkOrder.id, user.id);
        }

        if (Platform.OS === 'web') {
          window.alert(t('workOrders.orderCreated') || 'Ordem de serviço criada com sucesso');
          router.replace({
            pathname: '/work-order-detail',
            params: { workOrderId: createdWorkOrder.id },
          });
        } else {
          Alert.alert(t('common.success'), t('workOrders.orderCreated') || 'Ordem de serviço criada com sucesso', [
            { 
              text: t('common.confirm'), 
              onPress: () => router.replace({
                pathname: '/work-order-detail',
                params: { workOrderId: createdWorkOrder.id },
              }),
            },
          ]);
        }
      }
    } catch (error: any) {
      console.error('Error saving work order:', error);
      const errorMessage = error?.message || (isEditMode 
        ? (t('workOrders.updateOrderError') || 'Falha ao atualizar ordem de serviço')
        : (t('workOrders.createOrderError') || 'Falha ao criar ordem de serviço'));
      if (Platform.OS === 'web') {
        window.alert(errorMessage);
      } else {
        Alert.alert(t('common.error'), errorMessage, [{ text: t('common.confirm') }]);
      }
    } finally {
      setIsCreating(false);
    }
  };

  // Verificar permissão ao montar o componente
  useEffect(() => {
    if (!user) return;
    
    if (isEditMode && !hasPermission('workOrders.update')) {
      Alert.alert(t('common.error'), 'Você não tem permissão para editar ordens de serviço', [
        { text: t('common.confirm'), onPress: () => safeBack(router) },
      ]);
      return;
    }
    if (!isEditMode && !hasPermission('workOrders.create')) {
      Alert.alert(t('common.error'), 'Você não tem permissão para criar ordens de serviço', [
        { text: t('common.confirm'), onPress: () => safeBack(router) },
      ]);
      return;
    }
  }, [user, isEditMode, hasPermission]);

  if (!user || (isEditMode && !hasPermission('workOrders.update')) || (!isEditMode && !hasPermission('workOrders.create'))) {
    return null; // Não renderizar se não tiver permissão
  }

  return (
    <ScreenWrapper>
      <KeyboardAvoidingView
        style={styles.container}
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
            {isEditMode ? (t('workOrders.editOrder') || 'Editar Ordem de Serviço') : (t('workOrders.createOrder') || 'Criar Ordem de Serviço')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.md }]}
        >
          {/* 1. Client Info */}
          <Input
            label={t('workOrders.clientName') || 'Nome do Cliente'}
            value={clientName}
            onChangeText={setClientName}
            placeholder={t('workOrders.clientNamePlaceholder') || 'Digite o nome do cliente'}
          />

          <Input
            label={t('workOrders.clientContact') || 'Contato do Cliente'}
            value={clientContact}
            onChangeText={setClientContact}
            placeholder={t('workOrders.clientContactPlaceholder') || 'Telefone, email, etc.'}
          />

          <Input
            label={t('workOrders.clientAddress') || 'Endereço do Cliente'}
            value={clientAddress}
            onChangeText={setClientAddress}
            placeholder={t('workOrders.clientAddressPlaceholder') || 'Digite o endereço completo'}
            multiline
            numberOfLines={2}
          />

          {/* 2. Service Info */}
          <Dropdown
            label={t('workOrders.serviceType') || 'Service Type'}
            value={serviceType}
            options={serviceTypeOptions}
            onSelect={(value) => setServiceType(value as WorkOrderServiceType | '')}
          />

          <View style={styles.dateTimeRow}>
            <View style={styles.dateTimeColumn}>
              <DatePicker
                label={t('workOrders.scheduledDate') || 'Data Agendada'}
                value={scheduledDate}
                onSelect={setScheduledDate}
                placeholder={t('common.select')}
              />
            </View>
            <View style={styles.dateTimeColumn}>
              <TimePicker
                label={t('workOrders.scheduledTime') || 'Hora Agendada'}
                value={scheduledTime}
                onSelect={setScheduledTime}
                placeholder={t('common.select')}
              />
            </View>
          </View>

          {/* 3. Team Selection */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('workOrders.team') || 'Equipe (Opcional)'}
            </Text>
            {allUsers.length === 0 ? (
              <Text style={{ color: colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                {t('common.loading') || 'Carregando...'}
              </Text>
            ) : (
              <View style={styles.checkboxGrid}>
                {allUsers.map((u) => {
                  const isSelected = selectedTeamMembers.includes(u.id);
                  return (
                    <TouchableOpacity
                      key={u.id}
                      style={[
                        styles.checkboxChip,
                        {
                          backgroundColor: isSelected ? colors.primary + '15' : colors.backgroundSecondary,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => {
                        setSelectedTeamMembers((prev) =>
                          isSelected
                            ? prev.filter((id) => id !== u.id)
                            : [...prev, u.id]
                        );
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={16}
                        color={isSelected ? colors.primary : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.checkboxLabel,
                          { color: isSelected ? colors.primary : colors.text },
                        ]}
                        numberOfLines={1}
                      >
                        {u.username}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* 4. Extra Info */}
          <Input
            label={t('workOrders.extraInfo') || 'Info Extra (Opcional)'}
            value={plannedMaterials}
            onChangeText={(text) => {
              if (text.length <= 1000) {
                setPlannedMaterials(text);
              }
            }}
            placeholder={t('workOrders.extraInfoPlaceholder') || 'Informações adicionais (até 1000 caracteres)'}
            multiline
            numberOfLines={4}
            maxLength={1000}
          />

          {/* 4. Attachments (same pattern as Production) */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('production.attachments') || 'Anexos'} ({attachments.length}/{MAX_ATTACHMENTS})
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
              </View>
            )}

            {attachments.map((att) => (
              <View
                key={att.id}
                style={[styles.attachmentCard, { backgroundColor: colors.cardBackground }]}
              >
                <Ionicons name="image-outline" size={20} color={colors.textSecondary} />
                <Text style={[styles.attachmentName, { color: colors.text }]} numberOfLines={1}>
                  {att.filename}
                </Text>
                <TouchableOpacity
                  onPress={() => handleRemoveAttachment(att.id)}
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
              onPress={goBack}
              variant="outline"
              style={styles.button}
            />
            <Button
              title={isEditMode ? (t('common.save') || 'Save') : t('common.create')}
              onPress={handleSaveWorkOrder}
              loading={isCreating || isLoading}
              style={styles.button}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
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
    padding: theme.spacing.md,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  dateTimeColumn: {
    flex: 1,
  },
  section: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    marginBottom: theme.spacing.sm,
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
    minHeight: 80,
    gap: theme.spacing.xs,
  },
  attachmentOptionLabel: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.medium,
    textAlign: 'center',
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xs,
    gap: theme.spacing.sm,
  },
  attachmentName: {
    fontSize: theme.typography.fontSize.sm,
    flex: 1,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  checkboxChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    width: '31%',
    height: 40,
  },
  checkboxLabel: {
    fontSize: theme.typography.fontSize.sm,
    flexShrink: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  button: {
    flex: 1,
  },
});
