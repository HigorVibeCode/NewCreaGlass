import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../src/hooks/use-i18n';
import { repos } from '../src/services/container';
import { Event, EventType } from '../src/types';
import { theme } from '../src/theme';
import { useThemeColors } from '../src/hooks/use-theme-colors';

export default function EventDetailScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleEdit = () => {
    if (!eventId) return;
    router.push({
      pathname: '/event-create',
      params: { eventId },
    });
  };

  const handleDelete = () => {
    Alert.alert(
      t('common.delete') || 'Delete',
      'Are you sure you want to delete this event?',
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('common.delete') || 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!eventId) return;
            try {
              await repos.eventsRepo.deleteEvent(eventId);
              Alert.alert(t('common.success') || 'Success', 'Event deleted successfully', [
                { text: t('common.confirm') || 'OK', onPress: () => router.back() },
              ]);
            } catch (error) {
              console.error('Error deleting event:', error);
              Alert.alert(t('common.error') || 'Error', 'Failed to delete event');
            }
          },
        },
      ]
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
    const dateObj = new Date(date);
    const dateStr = dateObj.toLocaleDateString();
    return time ? `${dateStr} ${time}` : dateStr;
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
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.background }]}>
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
            <Text style={[styles.eventTitle, { color: colors.text }]}>{event.title}</Text>
            <View style={styles.typeBadge}>
              <Text style={[styles.typeText, { color: '#2563eb' }]}>
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
  eventTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.sm,
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
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
