import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { repos } from '../src/services/container';
import { formatDateTime as formatDateTimeUtil } from '../src/utils/date-format';
import { Event, EventType } from '../src/types';
import { theme } from '../src/theme';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { confirmDelete } from '../src/utils/confirm-dialog';

export default function EventDetailScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const showMsg = (message: string) => {
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert('', message);
    }
  };

  const handleToggleCompleted = async () => {
    if (!eventId || !event) return;
    const newStatus = event.status === 'completed' ? 'active' : 'completed';
    setIsProcessing(true);
    try {
      await repos.eventsRepo.updateEvent(eventId, { status: newStatus } as any);
      await loadEvent();
      showMsg(
        newStatus === 'completed'
          ? (t('events.eventCompleted') || 'Evento marcado como concluído')
          : (t('events.eventReactivated') || 'Evento reativado')
      );
    } catch (error) {
      console.error('Error updating event status:', error);
      showMsg(t('events.updateEventError') || 'Falha ao atualizar evento');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEdit = () => {
    if (!eventId) return;
    router.push({
      pathname: '/event-create',
      params: { eventId },
    });
  };

  const handleDelete = () => {
    if (!eventId) return;
    
    confirmDelete(
      t('common.delete') || 'Excluir',
      'Tem certeza que deseja excluir este evento?',
      async () => {
        await repos.eventsRepo.deleteEvent(eventId);
        router.back();
      },
      undefined,
      t('common.delete') || 'Excluir',
      t('common.cancel') || 'Cancelar',
      'Evento excluído com sucesso',
      'Falha ao excluir evento'
    );
  };

  useEffect(() => {
    if (eventId) {
      loadEvent();
    }
  }, [eventId]);

  const loadEvent = async () => {
    if (!eventId) return;
    setIsLoading(true);
    try {
      const eventData = await repos.eventsRepo.getEventById(eventId);
      if (eventData) {
        setEvent(eventData);
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

  const getTypeLabel = (type: EventType): string => {
    switch (type) {
      case 'meeting':
        return t('events.types.meeting');
      case 'training':
        return t('events.types.training');
      case 'maintenance':
        return t('events.types.maintenance');
      case 'installation':
        return t('events.types.installation');
      case 'inspection':
        return t('events.types.inspection');
      case 'other':
        return t('events.types.other');
      default:
        return type;
    }
  };

  const formatDateTime = (date: string, time: string): string => {
    if (!date) return '';
    return formatDateTimeUtil(date, time);
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!event) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.md, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Event Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={[styles.scrollView, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <View style={[styles.headerCard, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.headerRow}>
              <Text style={[styles.eventTitle, { color: colors.text, flex: 1 }]}>{event.title}</Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: event.status === 'completed' ? '#10b981' + '20' : '#ea580c' + '20' },
                ]}
              >
                <Ionicons
                  name={event.status === 'completed' ? 'checkmark-circle' : 'ellipse-outline'}
                  size={12}
                  color={event.status === 'completed' ? '#10b981' : '#ea580c'}
                />
                <Text
                  style={[
                    styles.statusText,
                    { color: event.status === 'completed' ? '#10b981' : '#ea580c' },
                  ]}
                >
                  {event.status === 'completed'
                    ? (t('events.statusCompleted') || 'Concluído')
                    : (t('events.statusActive') || 'Ativo')}
                </Text>
              </View>
            </View>
            <View style={styles.typeBadge}>
              <Text style={[styles.typeText, { color: '#ea580c' }]}>
                {getTypeLabel(event.type)}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Date & Time</Text>
            <View style={[styles.infoCard, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Start</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {formatDateTime(event.startDate, event.startTime)}
                  </Text>
                </View>
              </View>
              {event.endDate && (
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>End</Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {formatDateTime(event.endDate, event.endTime)}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {event.location && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Location</Text>
              <View style={[styles.infoCard, { backgroundColor: colors.cardBackground }]}>
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={20} color={colors.textSecondary} />
                  <Text style={[styles.infoValue, { color: colors.text, flex: 1 }]}>
                    {event.location}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {event.people && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>People</Text>
              <View style={[styles.infoCard, { backgroundColor: colors.cardBackground }]}>
                <View style={styles.infoRow}>
                  <Ionicons name="people-outline" size={20} color={colors.textSecondary} />
                  <Text style={[styles.infoValue, { color: colors.text, flex: 1 }]}>
                    {event.people}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {event.description && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Description</Text>
              <View style={[styles.infoCard, { backgroundColor: colors.cardBackground }]}>
                <Text style={[styles.descriptionText, { color: colors.text }]}>
                  {event.description}
                </Text>
              </View>
            </View>
          )}

          {event.attachments && event.attachments.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Attachments</Text>
              <View style={[styles.infoCard, { backgroundColor: colors.cardBackground }]}>
                {event.attachments.map((attachment) => (
                  <View key={attachment.id} style={styles.attachmentRow}>
                    <Ionicons name="document-outline" size={20} color={colors.textSecondary} />
                    <Text style={[styles.attachmentText, { color: colors.text }]}>
                      {attachment.filename}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: event.status === 'completed' ? '#ea580c' : '#10b981' },
            ]}
            onPress={handleToggleCompleted}
            disabled={isProcessing}
            activeOpacity={0.7}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons
                  name={event.status === 'completed' ? 'refresh-outline' : 'checkmark-circle'}
                  size={20}
                  color="#ffffff"
                />
                <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>
                  {event.status === 'completed'
                    ? (t('events.reactivateEvent') || 'Reativar')
                    : (t('events.completeEvent') || 'Concluir')}
                </Text>
              </>
            )}
          </TouchableOpacity>

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
    gap: theme.spacing.sm,
  },
  eventTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    flexShrink: 0,
  },
  statusText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  typeBadge: {
    alignSelf: 'flex-start',
  },
  typeText: {
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
  descriptionText: {
    fontSize: theme.typography.fontSize.sm,
    lineHeight: theme.typography.lineHeight.sm * 1.5,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  attachmentText: {
    fontSize: theme.typography.fontSize.sm,
    flex: 1,
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
});
