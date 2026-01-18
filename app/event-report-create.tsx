import React, { useState, useMemo } from 'react';
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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { useAuth } from '../src/store/auth-store';
import { Button } from '../src/components/shared/Button';
import { Input } from '../src/components/shared/Input';
import { Dropdown, DropdownOption } from '../src/components/shared/Dropdown';
import { DatePicker } from '../src/components/shared/DatePicker';
import { TimePicker } from '../src/components/shared/TimePicker';
import { repos } from '../src/services/container';
import { WorkOrder, WorkOrderServiceType } from '../src/types';
import { theme } from '../src/theme';
import { useThemeColors } from '../src/hooks/use-theme-colors';

export default function WorkOrderCreateScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [serviceType, setServiceType] = useState<WorkOrderServiceType | ''>('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [plannedMaterials, setPlannedMaterials] = useState('');
  const [team, setTeam] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const serviceTypeOptions: DropdownOption[] = [
    { label: t('common.select'), value: '' },
    { label: t('workOrders.serviceTypeOptions.maintenance'), value: 'maintenance' },
    { label: t('workOrders.serviceTypeOptions.installation'), value: 'installation' },
    { label: t('workOrders.serviceTypeOptions.internal'), value: 'internal' },
    { label: t('workOrders.serviceTypeOptions.external'), value: 'external' },
  ];

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

  const handleCreateWorkOrder = async () => {
    if (!user) return;

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

      // Helper function to validate UUID format
      const isValidUUID = (str: string): boolean => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
      };

      // Convert team text to array of UUIDs only if valid UUIDs are provided
      // If text contains non-UUID values, store empty array (text is just for reference)
      const teamMembersArray: string[] = team.trim()
        ? team.split(',').map(id => id.trim()).filter(id => id.length > 0 && isValidUUID(id))
        : [];

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
        internalNotes: internalNotes.trim() || undefined,
        teamMembers: teamMembersArray,
        responsible: user.id,
        isLocked: false,
        timeStatuses: [],
        serviceLogs: [],
        evidences: [],
        checklistItems: [],
        createdBy: user.id,
      };

      await repos.workOrdersRepo.createWorkOrder(newWorkOrder);
      Alert.alert(t('common.success'), t('workOrders.orderCreated') || 'Ordem de serviço criada com sucesso', [
        { text: t('common.confirm'), onPress: () => router.back() },
      ]);
    } catch (error: any) {
      console.error('Error creating work order:', error);
      const errorMessage = error?.message || t('workOrders.createOrderError') || 'Falha ao criar ordem de serviço';
      Alert.alert(t('common.error'), errorMessage, [{ text: t('common.confirm') }]);
    } finally {
      setIsCreating(false);
    }
  };

  const topPadding = insets.top + theme.spacing.md;
  const wrapperStyle = useMemo(() => ({ backgroundColor: colors.background }), [colors.background]);

  return (
    <View style={[styles.wrapper, wrapperStyle]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[styles.header, { paddingTop: topPadding, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.backgroundSecondary }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t('workOrders.createOrder') || 'Criar Ordem de Serviço'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <Input
            label={t('workOrders.clientName') || 'Nome do Cliente'}
            value={clientName}
            onChangeText={setClientName}
            placeholder={t('workOrders.clientNamePlaceholder') || 'Digite o nome do cliente'}
          />

          <Input
            label={t('workOrders.clientAddress') || 'Endereço do Cliente'}
            value={clientAddress}
            onChangeText={setClientAddress}
            placeholder={t('workOrders.clientAddressPlaceholder') || 'Digite o endereço completo'}
            multiline
            numberOfLines={2}
          />

          <Input
            label={t('workOrders.clientContact') || 'Contato do Cliente'}
            value={clientContact}
            onChangeText={setClientContact}
            placeholder={t('workOrders.clientContactPlaceholder') || 'Telefone, email, etc.'}
          />

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

          <Input
            label={t('workOrders.internalNotes') || 'Observações Internas (Opcional)'}
            value={internalNotes}
            onChangeText={setInternalNotes}
            placeholder={t('workOrders.internalNotesPlaceholder') || 'Digite observações internas (não visíveis ao cliente)'}
            multiline
            numberOfLines={4}
          />

          <Input
            label={t('workOrders.plannedMaterials') || 'Materiais Planejados (Opcional)'}
            value={plannedMaterials}
            onChangeText={(text) => {
              if (text.length <= 1000) {
                setPlannedMaterials(text);
              }
            }}
            placeholder={t('workOrders.plannedMaterialsPlaceholder') || 'Digite os materiais planejados (até 1000 caracteres)'}
            multiline
            numberOfLines={6}
            maxLength={1000}
          />

          <Input
            label={t('workOrders.team') || 'Equipe (Opcional)'}
            value={team}
            onChangeText={setTeam}
            placeholder={t('workOrders.teamPlaceholder') || 'Digite os IDs dos membros da equipe separados por vírgula'}
          />

          <View style={styles.buttonContainer}>
            <Button
              title={t('common.cancel')}
              onPress={() => router.back()}
              variant="outline"
              style={styles.button}
            />
            <Button
              title={t('common.create')}
              onPress={handleCreateWorkOrder}
              loading={isCreating}
              style={styles.button}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
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
