import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import SignatureCanvas from 'react-native-signature-canvas';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { useAuth } from '../src/store/auth-store';
import { repos } from '../src/services/container';
import { supabase } from '../src/services/supabase';
import { WorkOrder, User, TimeStatus, ServiceLog, Evidence, ChecklistItem } from '../src/types';
import { theme } from '../src/theme';
import { useThemeColors } from '../src/hooks/use-theme-colors';

export default function WorkOrderDetailScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { workOrderId } = useLocalSearchParams<{ workOrderId: string }>();

  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentElapsedTime, setCurrentElapsedTime] = useState(0);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [clientName, setClientName] = useState('');
  const [signatureBase64, setSignatureBase64] = useState<string | null>(null);
  const signatureRef = useRef<any>(null);
  const [checkInAddress, setCheckInAddress] = useState<string | null>(null);
  const [signatureAddress, setSignatureAddress] = useState<string | null>(null);

  const handleEdit = () => {
    if (!workOrderId) return;
    router.push({
      pathname: '/event-report-create',
      params: { workOrderId },
    });
  };

  const handleStartService = async () => {
    if (!workOrderId || !user) return;

    setIsProcessing(true);
    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('common.error') || 'Error',
          t('workOrders.locationPermissionRequired') || 'Permissão de localização é necessária para criar o check-in'
        );
        setIsProcessing(false);
        return;
      }

      // Get current location
      let location;
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
      } catch (locationError) {
        console.error('Error getting location:', locationError);
        Alert.alert(
          t('common.error') || 'Error',
          t('workOrders.locationError') || 'Erro ao obter localização. Tentando continuar...'
        );
        // Fallback to default coordinates if location fails
        location = {
          coords: {
            latitude: 0,
            longitude: 0,
            accuracy: 0,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        };
      }

      const latitude = location.coords.latitude;
      const longitude = location.coords.longitude;
      const timestamp = new Date().toISOString();

      // 1. Create check-in
      await repos.workOrdersRepo.createCheckIn(workOrderId, {
        timestamp,
        latitude,
        longitude,
        toleranceRadius: 100, // 100 meters default
        performedBy: user.id,
      });

      // 2. Create time status EM_ATENDIMENTO
      await repos.workOrdersRepo.createTimeStatus(workOrderId, {
        status: 'EM_ATENDIMENTO',
        startTime: timestamp,
        totalDuration: 0,
        createdBy: user.id,
      });

      // 3. Update work order status to in_progress
      await repos.workOrdersRepo.updateWorkOrder(workOrderId, {
        status: 'in_progress',
      });

      // Reload work order to show updated data
      await loadWorkOrder();

      Alert.alert(
        t('common.success') || 'Success',
        t('workOrders.serviceStarted') || 'Serviço iniciado com sucesso'
      );
    } catch (error) {
      console.error('Error starting service:', error);
      Alert.alert(
        t('common.error') || 'Error',
        t('workOrders.startServiceError') || 'Falha ao iniciar serviço'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRequestSignature = () => {
    setClientName('');
    setSignatureBase64(null);
    setShowSignatureModal(true);
  };

  const [pendingSignature, setPendingSignature] = useState<string | null>(null);

  const handleSignatureOK = (signature: string) => {
    setSignatureBase64(signature);
    // Se estamos aguardando confirmação, processar imediatamente
    if (pendingSignature !== null) {
      processSignature(signature);
    }
  };

  const handleSignatureEmpty = () => {
    setSignatureBase64(null);
    if (pendingSignature !== null) {
      setPendingSignature(null);
      setIsProcessing(false);
      Alert.alert(t('common.error') || 'Error', t('workOrders.signatureDrawingRequired') || 'Por favor, desenhe a assinatura');
    }
  };

  const handleClearSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.clearSignature();
      setSignatureBase64(null);
    }
  };

  const processSignature = async (signatureData: string) => {
    if (!workOrderId || !user || !workOrder) {
      setPendingSignature(null);
      setIsProcessing(false);
      return;
    }

    if (!clientName || !clientName.trim()) {
      setPendingSignature(null);
      setIsProcessing(false);
      Alert.alert(t('common.error') || 'Error', t('workOrders.clientNameRequired') || 'Nome do cliente é obrigatório');
      return;
    }

    setIsProcessing(true);
    
    try {
      // Get current location for signature
      let location;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const locationData = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          location = locationData;
        }
      } catch (locationError) {
        console.error('Error getting location for signature:', locationError);
      }

      const latitude = location?.coords?.latitude || 0;
      const longitude = location?.coords?.longitude || 0;
      const timestamp = new Date().toISOString();

      // Convert base64 signature to file
      const base64Data = signatureData.replace(/^data:image\/png;base64,/, '');
      const filename = `signature_${workOrderId}_${Date.now()}.png`;
      const bucketName = 'signatures';

      // Convert base64 to Uint8Array for Supabase Storage
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const fileData = new Uint8Array(byteNumbers);

      // Upload signature image to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filename, fileData, {
          contentType: 'image/png',
          upsert: false,
        });

      if (uploadError) {
        console.error('Error uploading signature:', uploadError);
        throw new Error(`Failed to upload signature: ${uploadError.message}`);
      }

      // Get public URL for the signature
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filename);

      const signaturePath = urlData?.publicUrl || `${bucketName}/${filename}`;

      // Create signature record
      await repos.workOrdersRepo.createSignature(workOrderId, {
        fullName: clientName.trim(),
        timestamp,
        latitude,
        longitude,
        signaturePath,
        createdBy: user.id,
      });

      // Close modal and reset state
      setShowSignatureModal(false);
      setClientName('');
      setSignatureBase64(null);
      setPendingSignature(null);

      // Reload work order to show updated data
      await loadWorkOrder();

      Alert.alert(
        t('common.success') || 'Success',
        t('workOrders.signatureCreated') || 'Assinatura registrada com sucesso'
      );
    } catch (error) {
      console.error('Error creating signature:', error);
      Alert.alert(
        t('common.error') || 'Error',
        t('workOrders.signatureError') || 'Falha ao registrar assinatura'
      );
    } finally {
      setIsProcessing(false);
      setPendingSignature(null);
    }
  };

  const handleConfirmSignature = () => {
    if (!workOrderId || !user || !workOrder) return;

    if (!clientName || !clientName.trim()) {
      Alert.alert(t('common.error') || 'Error', t('workOrders.clientNameRequired') || 'Nome do cliente é obrigatório');
      return;
    }

    // Se já temos a assinatura no estado, processar diretamente
    if (signatureBase64) {
      setIsProcessing(true);
      processSignature(signatureBase64);
      return;
    }

    // Caso contrário, usar readSignature() para obter a assinatura do canvas
    setIsProcessing(true);
    setPendingSignature('waiting'); // Flag para indicar que estamos aguardando
    
    // Chamar readSignature que vai trigger onOK ou onEmpty
    if (signatureRef.current) {
      signatureRef.current.readSignature();
    } else {
      setIsProcessing(false);
      setPendingSignature(null);
      Alert.alert(t('common.error') || 'Error', t('workOrders.signatureDrawingRequired') || 'Por favor, desenhe a assinatura');
    }
  };

  const handleFinishService = async () => {
    if (!workOrderId || !user || !workOrder) return;

    // Check if signature exists
    if (!workOrder.signature) {
      Alert.alert(
        t('common.error') || 'Error',
        t('workOrders.signatureRequired') || 'Assinatura do cliente é obrigatória para finalizar o serviço'
      );
      return;
    }

    setIsProcessing(true);
    try {
      const timestamp = new Date().toISOString();

      // 1. Get current time status (EM_ATENDIMENTO)
      const currentTimeStatus = await repos.workOrdersRepo.getCurrentTimeStatus(workOrderId);

      if (currentTimeStatus) {
        // Calculate duration
        const startTime = new Date(currentTimeStatus.startTime).getTime();
        const endTime = new Date(timestamp).getTime();
        const duration = Math.floor((endTime - startTime) / 1000); // in seconds

        // Update time status to close it
        await repos.workOrdersRepo.updateTimeStatus(currentTimeStatus.id, {
          endTime: timestamp,
          totalDuration: duration,
        });
      }

      // 2. Update work order status to completed
      await repos.workOrdersRepo.updateWorkOrder(workOrderId, {
        status: 'completed',
      });

      // Reload work order to show updated data
      await loadWorkOrder();

      Alert.alert(
        t('common.success') || 'Success',
        t('workOrders.serviceCompleted') || 'Serviço finalizado com sucesso'
      );
    } catch (error) {
      console.error('Error finishing service:', error);
      Alert.alert(
        t('common.error') || 'Error',
        t('workOrders.finishServiceError') || 'Falha ao finalizar serviço'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      t('common.delete') || 'Delete',
      'Are you sure you want to delete this work order?',
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('common.delete') || 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!workOrderId) return;
            try {
              await repos.workOrdersRepo.deleteWorkOrder(workOrderId);
              Alert.alert(t('common.success') || 'Success', 'Work order deleted successfully', [
                { text: t('common.confirm') || 'OK', onPress: () => router.back() },
              ]);
            } catch (error) {
              console.error('Error deleting work order:', error);
              Alert.alert(t('common.error') || 'Error', 'Failed to delete work order');
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    if (workOrderId) {
      loadWorkOrder();
    }
  }, [workOrderId]);

  // Timer em tempo real para time status ativo
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (workOrder && workOrder.status === 'in_progress') {
      // Verificar se há um time status ativo (sem endTime)
      const activeTimeStatus = workOrder.timeStatuses?.find(ts => !ts.endTime);
      
      if (activeTimeStatus) {
        interval = setInterval(() => {
          const startTime = new Date(activeTimeStatus.startTime).getTime();
          const now = Date.now();
          const elapsed = Math.floor((now - startTime) / 1000); // em segundos
          setCurrentElapsedTime(elapsed);
        }, 1000);
      }
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [workOrder]);

  // Reverse geocoding for CheckIn address
  useEffect(() => {
    const getCheckInAddress = async () => {
      if (workOrder?.checkIn && workOrder.checkIn.latitude && workOrder.checkIn.longitude) {
        try {
          const addresses = await Location.reverseGeocodeAsync({
            latitude: workOrder.checkIn.latitude,
            longitude: workOrder.checkIn.longitude,
          });
          if (addresses && addresses.length > 0) {
            const addr = addresses[0];
            const addressParts = [
              addr.name,
              addr.street,
              addr.district,
              addr.city,
              addr.region,
              addr.postalCode,
              addr.country,
            ].filter(Boolean);
            const formattedAddress = addressParts.join(', ') || 'Endereço não disponível';
            setCheckInAddress(formattedAddress);
          }
        } catch (error) {
          console.error('Error reverse geocoding check-in:', error);
          setCheckInAddress(null);
        }
      } else {
        setCheckInAddress(null);
      }
    };

    getCheckInAddress();
  }, [workOrder?.checkIn]);

  // Reverse geocoding for Signature address
  useEffect(() => {
    const getSignatureAddress = async () => {
      if (workOrder?.signature && workOrder.signature.latitude && workOrder.signature.longitude) {
        try {
          const addresses = await Location.reverseGeocodeAsync({
            latitude: workOrder.signature.latitude,
            longitude: workOrder.signature.longitude,
          });
          if (addresses && addresses.length > 0) {
            const addr = addresses[0];
            const addressParts = [
              addr.name,
              addr.street,
              addr.district,
              addr.city,
              addr.region,
              addr.postalCode,
              addr.country,
            ].filter(Boolean);
            const formattedAddress = addressParts.join(', ') || 'Endereço não disponível';
            setSignatureAddress(formattedAddress);
          }
        } catch (error) {
          console.error('Error reverse geocoding signature:', error);
          setSignatureAddress(null);
        }
      } else {
        setSignatureAddress(null);
      }
    };

    getSignatureAddress();
  }, [workOrder?.signature]);

  const loadWorkOrder = async () => {
    if (!workOrderId) return;
    setIsLoading(true);
    try {
      const workOrderData = await repos.workOrdersRepo.getWorkOrderById(workOrderId);
      if (workOrderData) {
        console.log('Loaded work order:', {
          id: workOrderData.id,
          clientName: workOrderData.clientName,
          teamMembers: workOrderData.teamMembers?.length || 0,
          plannedMaterials: workOrderData.plannedMaterials?.length || 0,
          plannedChecklist: workOrderData.plannedChecklist?.length || 0,
          checklistItems: workOrderData.checklistItems?.length || 0,
          checkIn: workOrderData.checkIn ? 'yes' : 'no',
          timeStatuses: workOrderData.timeStatuses?.length || 0,
          serviceLogs: workOrderData.serviceLogs?.length || 0,
          evidences: workOrderData.evidences?.length || 0,
          signature: workOrderData.signature ? 'yes' : 'no',
        });
        setWorkOrder(workOrderData);
        await loadUsers(workOrderData);
      } else {
        Alert.alert(t('common.error'), 'Work order not found', [
          { text: t('common.confirm'), onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      console.error('Error loading work order:', error);
      Alert.alert(t('common.error'), 'Failed to load work order');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async (wo: WorkOrder) => {
    const userIds = new Set<string>();
    if (wo.responsible) userIds.add(wo.responsible);
    if (wo.teamMembers) wo.teamMembers.forEach(id => userIds.add(id));
    if (wo.timeStatuses) wo.timeStatuses.forEach(ts => userIds.add(ts.createdBy));
    if (wo.serviceLogs) wo.serviceLogs.forEach(sl => userIds.add(sl.author));
    if (wo.evidences) wo.evidences.forEach(ev => userIds.add(ev.createdBy));
    if (wo.checklistItems) wo.checklistItems.forEach(ci => {
      if (ci.completedBy) userIds.add(ci.completedBy);
    });
    if (wo.checkIn) userIds.add(wo.checkIn.performedBy);
    if (wo.signature) userIds.add(wo.signature.createdBy);

    const userMap = new Map<string, User>();
    for (const userId of userIds) {
      try {
        const userData = await repos.usersRepo.getUserById(userId);
        if (userData) {
          userMap.set(userId, userData);
        }
      } catch (error) {
        console.error(`Error loading user ${userId}:`, error);
      }
    }
    setUsers(userMap);
  };

  const getServiceTypeLabel = (type: string): string => {
    switch (type) {
      case 'maintenance':
        return t('workOrders.serviceTypeOptions.maintenance');
      case 'installation':
        return t('workOrders.serviceTypeOptions.installation');
      case 'internal':
        return t('workOrders.serviceTypeOptions.internal');
      case 'external':
        return t('workOrders.serviceTypeOptions.external');
      default:
        return type;
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'planned':
        return t('workOrders.status.planned');
      case 'in_progress':
        return t('workOrders.status.in_progress');
      case 'paused':
        return t('workOrders.status.paused');
      case 'completed':
        return t('workOrders.status.completed');
      case 'cancelled':
        return t('workOrders.status.cancelled');
      default:
        return status;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'planned':
        return colors.info;
      case 'in_progress':
        return colors.primary;
      case 'paused':
        return colors.warning;
      case 'completed':
        return colors.success;
      case 'cancelled':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const getTimeStatusLabel = (status: string): string => {
    switch (status) {
      case 'EM_ATENDIMENTO':
        return 'Em Atendimento';
      case 'PAUSADO':
        return 'Pausado';
      case 'DESLOCAMENTO':
        return 'Deslocamento';
      default:
        return status;
    }
  };

  const getServiceLogTypeLabel = (type: string): string => {
    switch (type) {
      case 'ajuste':
        return 'Ajuste';
      case 'problema':
        return 'Problema';
      case 'material':
        return 'Material';
      case 'recomendacao':
        return 'Recomendação';
      default:
        return type;
    }
  };

  const getEvidenceTypeLabel = (type: string): string => {
    switch (type) {
      case 'antes':
        return 'Antes';
      case 'durante':
        return 'Durante';
      case 'depois':
        return 'Depois';
      default:
        return type;
    }
  };

  const formatDateTime = (date: string, time?: string): string => {
    if (!date) return '';
    const dateObj = new Date(date);
    const dateStr = dateObj.toLocaleDateString();
    return time ? `${dateStr} ${time}` : dateStr;
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getUserName = (userId: string): string => {
    return users.get(userId)?.username || userId;
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!workOrder) {
    return null;
  }

  const totalTime = (workOrder.timeStatuses || []).reduce((sum, ts) => sum + ts.totalDuration, 0);
  
  // Calcular tempo total incluindo o tempo ativo em andamento
  const activeTimeStatus = workOrder.timeStatuses?.find(ts => !ts.endTime && ts.status === 'EM_ATENDIMENTO');
  const totalTimeWithActive = activeTimeStatus 
    ? totalTime + currentElapsedTime 
    : totalTime;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Work Order Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={[styles.scrollView, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <View style={[styles.headerCard, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.headerRow}>
              <Text style={[styles.clientName, { color: colors.text }]}>
                {workOrder.clientName}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(workOrder.status) + '20' },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: getStatusColor(workOrder.status) },
                  ]}
                >
                  {getStatusLabel(workOrder.status)}
                </Text>
              </View>
            </View>
            <Text style={[styles.serviceType, { color: colors.textSecondary }]}>
              {getServiceTypeLabel(workOrder.serviceType)}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Schedule</Text>
            <View style={[styles.infoCard, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                    Scheduled Date & Time
                  </Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {formatDateTime(workOrder.scheduledDate, workOrder.scheduledTime)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Client Information</Text>
            <View style={[styles.infoCard, { backgroundColor: colors.cardBackground }]}>
              {workOrder.clientAddress && (
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={20} color={colors.textSecondary} />
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Address</Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {workOrder.clientAddress}
                    </Text>
                  </View>
                </View>
              )}
              {workOrder.clientContact && (
                <View style={styles.infoRow}>
                  <Ionicons name="call-outline" size={20} color={colors.textSecondary} />
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Contact</Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {workOrder.clientContact}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Team</Text>
            <View style={[styles.infoCard, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.infoRow}>
                <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Responsible</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {getUserName(workOrder.responsible)}
                  </Text>
                </View>
              </View>
              {workOrder.teamMembers && workOrder.teamMembers.length > 0 && (
                <View style={styles.infoRow}>
                  <Ionicons name="people-outline" size={20} color={colors.textSecondary} />
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Team Members</Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {workOrder.teamMembers.map(id => getUserName(id)).join(', ')}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {workOrder.plannedMaterials && workOrder.plannedMaterials.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Planned Materials</Text>
              <View style={[styles.infoCard, { backgroundColor: colors.cardBackground }]}>
                {workOrder.plannedMaterials.map((material) => (
                  <View key={material.id} style={styles.materialRow}>
                    <Ionicons name="cube-outline" size={20} color={colors.textSecondary} />
                    <Text style={[styles.materialText, { color: colors.text }]}>
                      {material.name} - {material.quantity} {material.unit}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {workOrder.plannedChecklist && workOrder.plannedChecklist.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Planned Checklist</Text>
              <View style={[styles.infoCard, { backgroundColor: colors.cardBackground }]}>
                {workOrder.plannedChecklist.map((item) => (
                  <View key={item.id} style={styles.checklistRow}>
                    <Ionicons
                      name={item.checked ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={item.checked ? colors.success : colors.textSecondary}
                    />
                    <View style={styles.checklistContent}>
                      <Text style={[styles.checklistTitle, { color: colors.text }]}>
                        {item.title}
                      </Text>
                      {item.description && (
                        <Text style={[styles.checklistDescription, { color: colors.textSecondary }]}>
                          {item.description}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {workOrder.checklistItems && workOrder.checklistItems.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Execution Checklist</Text>
              <View style={[styles.infoCard, { backgroundColor: colors.cardBackground }]}>
                {workOrder.checklistItems.map((item) => (
                  <View key={item.id} style={styles.checklistRow}>
                    <Ionicons
                      name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={item.completed ? colors.success : colors.textSecondary}
                    />
                    <View style={styles.checklistContent}>
                      <Text style={[styles.checklistTitle, { color: colors.text }]}>
                        {item.title}
                      </Text>
                      {item.description && (
                        <Text style={[styles.checklistDescription, { color: colors.textSecondary }]}>
                          {item.description}
                        </Text>
                      )}
                      {item.completed && item.completedAt && (
                        <Text style={[styles.checklistMeta, { color: colors.textSecondary }]}>
                          Completed by {getUserName(item.completedBy || '')} on {formatTimestamp(item.completedAt)}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {workOrder.checkIn && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Check-In</Text>
              <View style={[styles.infoCard, { backgroundColor: colors.cardBackground }]}>
                <View style={styles.infoRow}>
                  <Ionicons name="location" size={20} color={colors.textSecondary} />
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Location</Text>
                    {checkInAddress ? (
                      <Text style={[styles.infoValue, { color: colors.text }]}>
                        {checkInAddress}
                      </Text>
                    ) : (
                      <Text style={[styles.infoValue, { color: colors.text }]}>
                        {workOrder.checkIn.latitude.toFixed(6)}, {workOrder.checkIn.longitude.toFixed(6)}
                      </Text>
                    )}
                    <Text style={[styles.infoSubtext, { color: colors.textSecondary }]}>
                      {!checkInAddress && (
                        <>Coordinates: {workOrder.checkIn.latitude.toFixed(6)}, {workOrder.checkIn.longitude.toFixed(6)} - </>
                      )}
                      Tolerance: {workOrder.checkIn.toleranceRadius}m
                    </Text>
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Time</Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {formatTimestamp(workOrder.checkIn.timestamp)}
                    </Text>
                    <Text style={[styles.infoSubtext, { color: colors.textSecondary }]}>
                      By {getUserName(workOrder.checkIn.performedBy)}
                    </Text>
                  </View>
                </View>
                {workOrder.checkIn.photoPath && (
                  <View style={styles.photoContainer}>
                    <Image
                      source={{ uri: workOrder.checkIn.photoPath }}
                      style={styles.photo}
                      contentFit="cover"
                    />
                  </View>
                )}
              </View>
            </View>
          )}

          {((workOrder.timeStatuses && workOrder.timeStatuses.length > 0) || activeTimeStatus) && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Time Tracking</Text>
              <View style={[styles.infoCard, { backgroundColor: colors.cardBackground }]}>
                <View style={styles.totalTimeRow}>
                  <Ionicons name="time" size={20} color={colors.primary} />
                  <Text style={[styles.totalTimeText, { color: colors.text }]}>
                    Total Time: {formatDuration(totalTimeWithActive)}
                  </Text>
                  {activeTimeStatus && (
                    <View style={[styles.activeTimerBadge, { backgroundColor: colors.success + '20' }]}>
                      <Text style={[styles.activeTimerText, { color: colors.success }]}>
                        ⏱️ {formatDuration(currentElapsedTime)}
                      </Text>
                    </View>
                  )}
                </View>
                {workOrder.timeStatuses && workOrder.timeStatuses.map((timeStatus) => (
                  <View key={timeStatus.id} style={styles.timeStatusRow}>
                    <View style={styles.timeStatusContent}>
                      <Text style={[styles.timeStatusLabel, { color: colors.text }]}>
                        {getTimeStatusLabel(timeStatus.status)}
                      </Text>
                      {timeStatus.pauseReason && (
                        <Text style={[styles.pauseReason, { color: colors.textSecondary }]}>
                          Reason: {timeStatus.pauseReason}
                        </Text>
                      )}
                      <Text style={[styles.timeStatusMeta, { color: colors.textSecondary }]}>
                        {formatTimestamp(timeStatus.startTime)}
                        {timeStatus.endTime && ` - ${formatTimestamp(timeStatus.endTime)}`}
                      </Text>
                      <Text style={[styles.timeStatusMeta, { color: colors.textSecondary }]}>
                        Duration: {formatDuration(timeStatus.totalDuration)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {workOrder.serviceLogs && workOrder.serviceLogs.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Service Logs</Text>
              <View style={[styles.infoCard, { backgroundColor: colors.cardBackground }]}>
                {workOrder.serviceLogs.map((log) => (
                  <View key={log.id} style={styles.logRow}>
                    <View style={styles.logHeader}>
                      <View
                        style={[
                          styles.logTypeBadge,
                          { backgroundColor: colors.primary + '20' },
                        ]}
                      >
                        <Text style={[styles.logTypeText, { color: colors.primary }]}>
                          {getServiceLogTypeLabel(log.type)}
                        </Text>
                      </View>
                      <Text style={[styles.logTime, { color: colors.textSecondary }]}>
                        {formatTimestamp(log.timestamp)}
                      </Text>
                    </View>
                    <Text style={[styles.logText, { color: colors.text }]}>{log.text}</Text>
                    <Text style={[styles.logAuthor, { color: colors.textSecondary }]}>
                      By {getUserName(log.author)}
                    </Text>
                    {log.photoPath && (
                      <View style={styles.photoContainer}>
                        <Image
                          source={{ uri: log.photoPath }}
                          style={styles.photo}
                          contentFit="cover"
                        />
                      </View>
                    )}
                    {log.videoPath && (
                      <View style={styles.videoContainer}>
                        <Ionicons name="videocam" size={20} color={colors.textSecondary} />
                        <Text style={[styles.videoText, { color: colors.text }]}>Video available</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}

          {workOrder.evidences && workOrder.evidences.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Evidence</Text>
              {['antes', 'durante', 'depois'].map((evidenceType) => {
                const evidences = workOrder.evidences.filter(e => e.type === evidenceType);
                if (evidences.length === 0) return null;
                return (
                  <View key={evidenceType} style={styles.evidenceGroup}>
                    <Text style={[styles.evidenceTypeTitle, { color: colors.text }]}>
                      {getEvidenceTypeLabel(evidenceType)}
                    </Text>
                    <View style={[styles.infoCard, { backgroundColor: colors.cardBackground }]}>
                      {evidences.map((evidence) => (
                        <View key={evidence.id} style={styles.evidenceRow}>
                          {evidence.photoPath && (
                            <View style={styles.photoContainer}>
                              <Image
                                source={{ uri: evidence.photoPath }}
                                style={styles.photo}
                                contentFit="cover"
                              />
                            </View>
                          )}
                          {evidence.internalNotes && (
                            <View style={styles.notesContainer}>
                              <Text style={[styles.notesLabel, { color: colors.textSecondary }]}>
                                Internal Notes:
                              </Text>
                              <Text style={[styles.notesText, { color: colors.text }]}>
                                {evidence.internalNotes}
                              </Text>
                            </View>
                          )}
                          {evidence.clientNotes && (
                            <View style={styles.notesContainer}>
                              <Text style={[styles.notesLabel, { color: colors.textSecondary }]}>
                                Client Notes:
                              </Text>
                              <Text style={[styles.notesText, { color: colors.text }]}>
                                {evidence.clientNotes}
                              </Text>
                            </View>
                          )}
                          {evidence.videoPath && (
                            <View style={styles.videoContainer}>
                              <Ionicons name="videocam" size={20} color={colors.textSecondary} />
                              <Text style={[styles.videoText, { color: colors.text }]}>Video available</Text>
                            </View>
                          )}
                          <Text style={[styles.evidenceMeta, { color: colors.textSecondary }]}>
                            {formatTimestamp(evidence.createdAt)} by {getUserName(evidence.createdBy)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {workOrder.status === 'in_progress' && !workOrder.signature && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Client Signature</Text>
              <View style={[styles.infoCard, { backgroundColor: colors.cardBackground }]}>
                <TouchableOpacity
                  style={[styles.signatureButton, { backgroundColor: colors.primary }]}
                  onPress={handleRequestSignature}
                  activeOpacity={0.7}
                >
                  <Ionicons name="create-outline" size={24} color={colors.background} />
                  <Text style={[styles.signatureButtonText, { color: colors.background }]}>
                    {t('workOrders.requestSignature') || 'Solicitar Assinatura do Cliente'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {workOrder.signature && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Signature</Text>
              <View style={[styles.infoCard, { backgroundColor: colors.cardBackground }]}>
                <View style={styles.signatureRow}>
                  <Ionicons name="create-outline" size={20} color={colors.textSecondary} />
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Signed By</Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {workOrder.signature.fullName}
                    </Text>
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {formatTimestamp(workOrder.signature.timestamp)}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={20} color={colors.textSecondary} />
                  <View style={styles.infoContent}>
                    {signatureAddress ? (
                      <Text style={[styles.infoValue, { color: colors.text }]}>
                        {signatureAddress}
                      </Text>
                    ) : (
                      <Text style={[styles.infoValue, { color: colors.text }]}>
                        {workOrder.signature.latitude.toFixed(6)}, {workOrder.signature.longitude.toFixed(6)}
                      </Text>
                    )}
                    {signatureAddress && (
                      <Text style={[styles.infoSubtext, { color: colors.textSecondary }]}>
                        {workOrder.signature.latitude.toFixed(6)}, {workOrder.signature.longitude.toFixed(6)}
                      </Text>
                    )}
                  </View>
                </View>
                {workOrder.signature.signaturePath && (
                  <View style={styles.signatureImageContainer}>
                    <Image
                      source={{ uri: workOrder.signature.signaturePath }}
                      style={styles.signatureImage}
                      contentFit="contain"
                    />
                  </View>
                )}
              </View>
            </View>
          )}

          {workOrder.internalNotes && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Internal Notes</Text>
              <View style={[styles.infoCard, { backgroundColor: colors.cardBackground }]}>
                <Text style={[styles.descriptionText, { color: colors.text }]}>
                  {workOrder.internalNotes}
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.buttonContainer}>
          {workOrder.status === 'planned' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={handleStartService}
              disabled={isProcessing}
              activeOpacity={0.7}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <>
                  <Ionicons name="play-circle" size={20} color={colors.background} />
                  <Text style={[styles.actionButtonText, { color: colors.background }]}>
                    {t('workOrders.startService') || 'Iniciar Serviço'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {workOrder.status === 'in_progress' && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.success }]}
              onPress={handleFinishService}
              disabled={isProcessing}
              activeOpacity={0.7}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={colors.background} />
                  <Text style={[styles.actionButtonText, { color: colors.background }]}>
                    {t('workOrders.finishService') || 'Finalizar Serviço'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.border }]}
            onPress={handleEdit}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.error }]}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={24} color={colors.error} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Signature Modal */}
      <Modal
        visible={showSignatureModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowSignatureModal(false);
          setClientName('');
          setSignatureBase64(null);
        }}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay || 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[styles.modalContent, styles.signatureModalContent, { backgroundColor: colors.background }]}>
            <View style={styles.signatureModalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t('workOrders.clientSignature') || 'Assinatura do Cliente'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowSignatureModal(false);
                  setClientName('');
                  setSignatureBase64(null);
                }}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              {t('workOrders.enterClientName') || 'Digite o nome completo do cliente:'}
            </Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
              value={clientName}
              onChangeText={setClientName}
              placeholder={t('workOrders.clientNamePlaceholder') || 'Nome do cliente'}
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={[styles.modalSubtitle, { color: colors.textSecondary, marginTop: theme.spacing.md }]}>
              {t('workOrders.signatureDrawing') || 'Desenhe a assinatura abaixo:'}
            </Text>
            
            <View style={[styles.signatureCanvasContainer, { backgroundColor: '#ffffff', borderColor: colors.border }]}>
              <SignatureCanvas
                ref={signatureRef}
                onOK={handleSignatureOK}
                onEmpty={handleSignatureEmpty}
                descriptionText=""
                clearText={t('workOrders.clearSignature') || 'Limpar'}
                confirmText={t('workOrders.saveSignature') || 'Salvar'}
                penColor="#000000"
                backgroundColor="#ffffff"
                minWidth={2}
                maxWidth={3}
                webStyle={`
                  .m-signature-pad {
                    box-shadow: none;
                    border: 1px solid ${colors.border};
                  }
                  .m-signature-pad--body {
                    border: none;
                  }
                  .m-signature-pad--footer {
                    display: flex;
                    justify-content: space-between;
                    padding: 10px;
                  }
                  .m-signature-pad--footer button {
                    background-color: ${colors.primary};
                    color: ${colors.background};
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                  }
                `}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                onPress={() => {
                  setShowSignatureModal(false);
                  setClientName('');
                  setSignatureBase64(null);
                }}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>
                  {t('common.cancel') || 'Cancel'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, { backgroundColor: colors.primary }]}
                onPress={handleConfirmSignature}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text style={[styles.modalButtonText, { color: colors.background }]}>
                    {t('common.confirm') || 'Confirm'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: theme.spacing.xs,
  },
  headerTitle: {
    flex: 1,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    textAlign: 'center',
    marginLeft: theme.spacing.md,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  headerCard: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  clientName: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  statusText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  serviceType: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  infoCard: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
    gap: theme.spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: theme.typography.fontSize.xs,
    marginBottom: theme.spacing.xs / 2,
  },
  infoValue: {
    fontSize: theme.typography.fontSize.sm,
  },
  infoSubtext: {
    fontSize: theme.typography.fontSize.xs,
    marginTop: theme.spacing.xs / 2,
  },
  descriptionText: {
    fontSize: theme.typography.fontSize.sm,
    lineHeight: theme.typography.lineHeight.sm * 1.5,
  },
  materialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  materialText: {
    fontSize: theme.typography.fontSize.sm,
    flex: 1,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  checklistContent: {
    flex: 1,
  },
  checklistTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  checklistDescription: {
    fontSize: theme.typography.fontSize.xs,
    marginTop: theme.spacing.xs / 2,
  },
  checklistMeta: {
    fontSize: theme.typography.fontSize.xs,
    marginTop: theme.spacing.xs / 2,
    fontStyle: 'italic',
  },
  photoContainer: {
    marginTop: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: 200,
    backgroundColor: '#f3f4f6',
  },
  activeTimerBadge: {
    marginLeft: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  activeTimerText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  signatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  signatureButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  totalTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: theme.spacing.sm,
  },
  totalTimeText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  timeStatusRow: {
    paddingVertical: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  timeStatusContent: {
    gap: theme.spacing.xs / 2,
  },
  timeStatusLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  pauseReason: {
    fontSize: theme.typography.fontSize.xs,
  },
  timeStatusMeta: {
    fontSize: theme.typography.fontSize.xs,
  },
  logRow: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: theme.spacing.xs,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs / 2,
  },
  logTypeBadge: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.xs || 4,
  },
  logTypeText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  logTime: {
    fontSize: theme.typography.fontSize.xs,
  },
  logText: {
    fontSize: theme.typography.fontSize.sm,
  },
  logAuthor: {
    fontSize: theme.typography.fontSize.xs,
    fontStyle: 'italic',
  },
  videoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
    padding: theme.spacing.sm,
    backgroundColor: '#f3f4f6',
    borderRadius: theme.borderRadius.sm,
  },
  videoText: {
    fontSize: theme.typography.fontSize.sm,
  },
  evidenceGroup: {
    marginBottom: theme.spacing.md,
  },
  evidenceTypeTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    marginBottom: theme.spacing.xs,
  },
  evidenceRow: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: theme.spacing.xs,
  },
  notesContainer: {
    marginTop: theme.spacing.xs,
  },
  notesLabel: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.medium,
    marginBottom: theme.spacing.xs / 2,
  },
  notesText: {
    fontSize: theme.typography.fontSize.sm,
  },
  evidenceMeta: {
    fontSize: theme.typography.fontSize.xs,
    marginTop: theme.spacing.xs,
  },
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  signatureImageContainer: {
    marginTop: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  signatureImage: {
    width: '100%',
    height: 150,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  actionButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.lg,
  },
  modalTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.sm,
  },
  modalSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    marginBottom: theme.spacing.md,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.typography.fontSize.md,
    marginBottom: theme.spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    borderWidth: 1,
  },
  modalButtonConfirm: {
    ...theme.shadows.sm,
  },
  modalButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  signatureModalContent: {
    maxHeight: '90%',
  },
  signatureModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  modalCloseButton: {
    padding: theme.spacing.xs,
  },
  signatureCanvasContainer: {
    height: 250,
    width: '100%',
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
  },
});
