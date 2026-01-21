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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useI18n } from '../src/hooks/use-i18n';
import { useAuth } from '../src/store/auth-store';
import { Button } from '../src/components/shared/Button';
import { Input } from '../src/components/shared/Input';
import { Dropdown, DropdownOption } from '../src/components/shared/Dropdown';
import { DatePicker } from '../src/components/shared/DatePicker';
import { TimePicker } from '../src/components/shared/TimePicker';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { repos } from '../src/services/container';
import { Event, EventType, EventAttachment } from '../src/types';
import { theme } from '../src/theme';
import { useThemeColors } from '../src/hooks/use-theme-colors';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_ATTACHMENTS = 3;

export default function EventCreateScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<EventType | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [people, setPeople] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<EventAttachment[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Load event data if in edit mode
  useEffect(() => {
    if (eventId) {
      setIsEditMode(true);
      loadEvent();
    }
  }, [eventId]);

  const loadEvent = async () => {
    if (!eventId) return;
    setIsLoading(true);
    try {
      const eventData = await repos.eventsRepo.getEventById(eventId);
      if (eventData) {
        setTitle(eventData.title || '');
        setType(eventData.type || '');
        setStartDate(eventData.startDate || '');
        setEndDate(eventData.endDate || '');
        setStartTime(eventData.startTime || '');
        setEndTime(eventData.endTime || '');
        setLocation(eventData.location || '');
        setPeople(eventData.people || '');
        setDescription(eventData.description || '');
        // Only load attachments that have storage paths (existing attachments)
        // New attachments added in edit mode will have temporary IDs
        setAttachments(eventData.attachments || []);
      } else {
        Alert.alert(t('common.error'), 'Event not found', [
          { text: t('common.confirm'), onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      console.error('Error loading event:', error);
      Alert.alert(t('common.error'), 'Failed to load event');
    } finally {
      setIsLoading(false);
    }
  };

  const typeOptions: DropdownOption[] = [
    { label: t('common.select'), value: '' },
    { label: t('events.types.meeting'), value: 'meeting' },
    { label: t('events.types.training'), value: 'training' },
    { label: t('events.types.maintenance'), value: 'maintenance' },
    { label: t('events.types.installation'), value: 'installation' },
    { label: t('events.types.inspection'), value: 'inspection' },
    { label: t('events.types.other'), value: 'other' },
  ];

  const validateForm = (): boolean => {
    if (!title.trim()) {
      Alert.alert(t('common.error'), t('events.fillRequiredFields'));
      return false;
    }

    if (!type) {
      Alert.alert(t('common.error'), t('events.fillRequiredFields'));
      return false;
    }

    if (!startDate.trim()) {
      Alert.alert(t('common.error'), t('events.fillRequiredFields'));
      return false;
    }

    if (!startTime.trim()) {
      Alert.alert(t('common.error'), t('events.fillRequiredFields'));
      return false;
    }

    if (!location.trim()) {
      Alert.alert(t('common.error'), t('events.fillRequiredFields'));
      return false;
    }

    return true;
  };

  const handleTakePhoto = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      Alert.alert(t('common.error'), t('events.maxAttachments'));
      return;
    }
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.error'), t('events.cameraPermissionDenied') || 'Permissão da câmera negada');
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

      const newAttachment: EventAttachment = {
        id: 'attach-' + Date.now(),
        filename,
        mimeType,
        storagePath: asset.uri,
        createdAt: new Date().toISOString(),
      };

      setAttachments([...attachments, newAttachment]);
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert(t('common.error'), t('events.addAttachmentError'));
    }
  };

  const handleChooseFromLibrary = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      Alert.alert(t('common.error'), t('events.maxAttachments'));
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.error'), t('events.mediaPermissionDenied') || 'Permissão da galeria negada');
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

      const newAttachment: EventAttachment = {
        id: 'attach-' + Date.now(),
        filename,
        mimeType,
        storagePath: asset.uri,
        createdAt: new Date().toISOString(),
      };

      setAttachments([...attachments, newAttachment]);
    } catch (error) {
      console.error('Error choosing from library:', error);
      Alert.alert(t('common.error'), t('events.addAttachmentError'));
    }
  };

  const handleChooseDocument = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      Alert.alert(t('common.error'), t('events.maxAttachments'));
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
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      
      // Verificar se o tipo é permitido após seleção
      const fileMimeType = file.mimeType || 'application/octet-stream';
      const fileExtension = file.name?.split('.').pop()?.toLowerCase() || '';
      
      // Verificar extensão e MIME type
      const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(fileExtension) || 
                      fileMimeType.startsWith('image/');
      const isPDF = fileExtension === 'pdf' || fileMimeType === 'application/pdf';
      
      if (!isImage && !isPDF) {
        Alert.alert(
          t('common.error'), 
          t('documents.allowedTypes') || 'Apenas imagens (JPG, PNG, WEBP) e PDF são permitidos'
        );
        return;
      }

      const newAttachment: EventAttachment = {
        id: 'attach-' + Date.now(),
        filename: file.name,
        mimeType: fileMimeType,
        storagePath: file.uri,
        createdAt: new Date().toISOString(),
      };

      setAttachments([...attachments, newAttachment]);
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert(t('common.error'), t('events.addAttachmentError'));
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(attachments.filter((att) => att.id !== id));
  };

  const handleSaveEvent = async () => {
    if (!user) return;

    if (!validateForm()) return;

    setIsCreating(true);
    try {
      if (isEditMode && eventId) {
        // Update existing event
        const updates: Partial<Event> = {
          title: title.trim(),
          type: type as EventType,
          startDate,
          endDate: endDate || '',
          startTime,
          endTime: endTime || '',
          location: location.trim(),
          people: people.trim(),
          description: description.trim() || undefined,
          attachments, // Attachments will be replaced (not merged)
        };

        await repos.eventsRepo.updateEvent(eventId, updates);
        Alert.alert(t('common.success'), t('events.eventUpdated') || 'Event updated successfully', [
          { 
            text: t('common.confirm'), 
            onPress: () => router.replace({
              pathname: '/event-detail',
              params: { eventId },
            }),
          },
        ]);
      } else {
        // Create new event
        const newEvent: Omit<Event, 'id' | 'createdAt'> = {
          title: title.trim(),
          type: type as EventType,
          startDate,
          endDate: endDate || '',
          startTime,
          endTime: endTime || '',
          location: location.trim(),
          people: people.trim(),
          description: description.trim() || undefined,
          attachments,
          createdBy: user.id,
        };

        const createdEvent = await repos.eventsRepo.createEvent(newEvent);
        Alert.alert(t('common.success'), t('events.eventCreated'), [
          { 
            text: t('common.confirm'), 
            onPress: () => router.replace({
              pathname: '/event-detail',
              params: { eventId: createdEvent.id },
            }),
          },
        ]);
      }
    } catch (error: any) {
      console.error('Error saving event:', error);
      const errorMessage = error?.message || (isEditMode ? t('events.updateEventError') : t('events.createEventError'));
      Alert.alert(t('common.error'), errorMessage, [{ text: t('common.confirm') }]);
    } finally {
      setIsCreating(false);
    }
  };

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
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isEditMode ? (t('events.editEvent') || 'Edit Event') : t('events.createEvent')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.md }]}
        >
        <Input
          label={t('events.eventTitle')}
          value={title}
          onChangeText={setTitle}
          placeholder={t('events.titlePlaceholder')}
        />

        <Dropdown
          label={t('events.type')}
          value={type}
          options={typeOptions}
          onSelect={(value) => setType(value as EventType | '')}
        />

        <View style={styles.dateTimeRow}>
          <View style={styles.dateTimeColumn}>
            <DatePicker
              label={t('events.startDate')}
              value={startDate}
              onSelect={setStartDate}
              placeholder={t('common.select')}
            />
          </View>
          <View style={styles.dateTimeColumn}>
            <TimePicker
              label={t('events.startTime')}
              value={startTime}
              onSelect={setStartTime}
              placeholder={t('common.select')}
            />
          </View>
        </View>

        <View style={styles.dateTimeRow}>
          <View style={styles.dateTimeColumn}>
            <DatePicker
              label={t('events.endDateOptional')}
              value={endDate}
              onSelect={setEndDate}
              placeholder={t('common.select')}
            />
          </View>
          <View style={styles.dateTimeColumn}>
            <TimePicker
              label={t('events.endTimeOptional')}
              value={endTime}
              onSelect={setEndTime}
              placeholder={t('common.select')}
            />
          </View>
        </View>

        <Input
          label={t('events.location')}
          value={location}
          onChangeText={setLocation}
          placeholder={t('events.locationPlaceholder')}
        />

        <Input
          label={t('events.people')}
          value={people}
          onChangeText={setPeople}
          placeholder={t('events.selectPeople')}
          multiline
          numberOfLines={3}
        />

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('events.attachments')} ({attachments.length}/{MAX_ATTACHMENTS})
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
                  {t('events.takePhoto') || 'Tirar Foto'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.attachmentOption, { backgroundColor: colors.backgroundSecondary }]}
                onPress={handleChooseFromLibrary}
                activeOpacity={0.7}
              >
                <Ionicons name="image" size={28} color={colors.primary} />
                <Text style={[styles.attachmentOptionLabel, { color: colors.text }]}>
                  {t('events.chooseFromLibrary') || 'Galeria'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.attachmentOption, { backgroundColor: colors.backgroundSecondary }]}
                onPress={handleChooseDocument}
                activeOpacity={0.7}
              >
                <Ionicons name="document-text" size={28} color={colors.primary} />
                <Text style={[styles.attachmentOptionLabel, { color: colors.text }]}>
                  {t('events.chooseDocument') || 'PDF'}
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

        <Input
          label={t('events.additionalInfo')}
          value={description}
          onChangeText={setDescription}
          placeholder={t('events.additionalInfoPlaceholder')}
          multiline
          numberOfLines={4}
        />

        <View style={styles.buttonContainer}>
          <Button
            title={t('common.cancel')}
            onPress={() => router.back()}
            variant="outline"
            style={styles.button}
          />
          <Button
            title={isEditMode ? (t('common.save') || 'Save') : t('common.create')}
            onPress={handleSaveEvent}
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
    marginBottom: theme.spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    marginBottom: theme.spacing.sm,
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  attachmentName: {
    flex: 1,
    fontSize: theme.typography.fontSize.md,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.sm,
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
