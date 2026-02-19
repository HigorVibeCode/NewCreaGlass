import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator, Animated, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRouteParams } from '../src/hooks/use-route-params';
import { useI18n } from '../src/hooks/use-i18n';
import { useAuth } from '../src/store/auth-store';
import { usePermissions } from '../src/hooks/use-permissions';
import { Button } from '../src/components/shared/Button';
import { repos } from '../src/services/container';
import { theme } from '../src/theme';
import { useThemeColors } from '../src/hooks/use-theme-colors';

const TIMER_SECONDS = 10;

const UnreadPulse: React.FC = () => {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={[styles.unreadDot, { opacity: anim }]} />
  );
};

export default function BloodPriorityScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const { manage } = useRouteParams<{ manage?: string }>('/blood-priority');
  const { hasPermission } = usePermissions();
  const colors = useThemeColors();
  const isManageMode = manage === '1' && (user?.userType === 'Master' || hasPermission('bloodPriority.create'));
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [timer, setTimer] = useState(TIMER_SECONDS);
  const [canConfirm, setCanConfirm] = useState(false);
  const [userReads, setUserReads] = useState<any[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const cardRefs = useRef<{ [key: string]: any }>({});

  useEffect(() => {
    if (user) {
      loadMessages();
    }
  }, [user?.id]);

  useEffect(() => {
    if (selectedMessageId && timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            setCanConfirm(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [selectedMessageId, timer]);

  const loadMessages = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [allMessages, reads] = await Promise.all([
        repos.bloodPriorityRepo.getAllMessages(),
        repos.bloodPriorityRepo.getUserReads(user.id),
      ]);
      setMessages(allMessages);
      setUserReads(reads);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const handleOpenMessage = async (messageId: string) => {
    if (!user) return;
    setSelectedMessageId(messageId);
    setTimer(TIMER_SECONDS);
    setCanConfirm(false);
    try {
      await repos.bloodPriorityRepo.openMessage(messageId, user.id);
      
      // Scroll to the selected card after a short delay to ensure it's rendered
      setTimeout(() => {
        const cardRef = cardRefs.current[messageId];
        if (cardRef && scrollViewRef.current) {
          // Try to measure and scroll to the card
          try {
            cardRef.measureLayout(
              scrollViewRef.current as any,
              (x: number, y: number) => {
                scrollViewRef.current?.scrollTo({ y: Math.max(0, y - theme.spacing.lg), animated: true });
              },
              () => {
                // Fallback: estimate position based on card index
                const messageIndex = messages.findIndex(m => m.id === messageId);
                if (messageIndex >= 0) {
                  // Estimate: each card is ~80px + gap, detail is ~300px
                  const cardHeight = 80;
                  const gap = theme.spacing.md;
                  const estimatedY = messageIndex * (cardHeight + gap);
                  scrollViewRef.current?.scrollTo({ y: Math.max(0, estimatedY - theme.spacing.lg), animated: true });
                }
              }
            );
          } catch (error) {
            // Fallback: estimate position
            const messageIndex = messages.findIndex(m => m.id === messageId);
            if (messageIndex >= 0) {
              const cardHeight = 80;
              const gap = theme.spacing.md;
              const estimatedY = messageIndex * (cardHeight + gap);
              scrollViewRef.current?.scrollTo({ y: Math.max(0, estimatedY - theme.spacing.lg), animated: true });
            }
          }
        }
      }, 150);
    } catch (error) {
      console.error('Error opening message:', error);
    }
  };

  const handleConfirmRead = async () => {
    if (!user || !selectedMessageId) return;
    try {
      await repos.bloodPriorityRepo.confirmRead(selectedMessageId, user.id);
      setSelectedMessageId(null);
      setCanConfirm(false);
      loadMessages();
    } catch (error) {
      console.error('Error confirming read:', error);
    }
  };

  const handleDeleteMessage = (messageId: string, messageTitle: string) => {
    Alert.alert(
      t('bloodPriority.deleteMessage'),
      t('bloodPriority.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await repos.bloodPriorityRepo.deleteMessage(messageId);
              if (selectedMessageId === messageId) {
                setSelectedMessageId(null);
              }
              Alert.alert(t('common.success'), t('bloodPriority.messageDeleted'));
              loadMessages();
            } catch (error) {
              console.error('Error deleting message:', error);
              Alert.alert(t('common.error'), String(error));
            }
          },
        },
      ],
    );
  };

  const isMessageRead = (messageId: string): boolean => {
    const read = userReads.find(r => r.messageId === messageId && r.confirmedAt);
    return !!read;
  };

  return (
    <ScrollView 
      ref={scrollViewRef}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.content}>
        {isManageMode && (
          <View style={styles.createButtonRow}>
            <Button
              title={t('permissions.bloodPriority.create')}
              onPress={() => router.push('/blood-priority-create')}
            />
          </View>
        )}
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('bloodPriority.noMessages')}</Text>
          </View>
        ) : (
          <View style={styles.messagesList}>
            {messages.map((message) => {
              const isRead = isMessageRead(message.id);
              const isSelected = selectedMessageId === message.id;
              return (
                <React.Fragment key={message.id}>
                  <TouchableOpacity
                    ref={(ref) => {
                      if (ref) {
                        cardRefs.current[message.id] = ref;
                      }
                    }}
                    style={[
                      styles.messageCard,
                      { backgroundColor: colors.cardBackground },
                      !isRead && { borderLeftWidth: 4, borderLeftColor: '#EF4444', backgroundColor: '#EF4444' + '0D' },
                      isRead && styles.messageCardRead,
                      isSelected && { borderWidth: 2, borderColor: colors.primary },
                    ]}
                    onPress={() => handleOpenMessage(message.id)}
                  >
                    <View style={styles.messageHeader}>
                      {!isRead && <UnreadPulse />}
                      <Text
                        style={[
                          styles.messageTitle,
                          { color: colors.text },
                          !isRead && { fontWeight: '800' },
                        ]}
                      >
                        {message.title}
                      </Text>
                      {isRead ? (
                        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                      ) : (
                        <View style={styles.unreadBadge}>
                          <Ionicons name="alert-circle" size={14} color="#fff" />
                        </View>
                      )}
                      {isManageMode && (
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => handleDeleteMessage(message.id, message.title)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash-outline" size={18} color={colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                  
                  {isSelected && (
                    <View style={[styles.messageDetail, { backgroundColor: colors.cardBackground }]}>
                      <Text style={[styles.messageDetailTitle, { color: colors.text }]}>{message.title}</Text>
                      <Text style={[styles.messageDetailBody, { color: colors.text }]}>{message.body}</Text>
                      <View style={[styles.timerContainer, { backgroundColor: colors.warning + '20' }]}>
                        <Text style={[styles.timerText, { color: colors.warning }]}>
                          {t('bloodPriority.timerWarning', { seconds: timer })}
                        </Text>
                      </View>
                      <Button
                        title={t('bloodPriority.confirmRead')}
                        onPress={handleConfirmRead}
                        disabled={!canConfirm}
                      />
                    </View>
                  )}
                </React.Fragment>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.lg,
  },
  createButtonRow: {
    marginBottom: theme.spacing.lg,
  },
  emptyState: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: theme.typography.fontSize.md,
  },
  messagesList: {
    gap: theme.spacing.md,
  },
  messageCard: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  messageCardRead: {
    opacity: 0.6,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  messageTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
    flex: 1,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  unreadBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    marginLeft: theme.spacing.sm,
    padding: theme.spacing.xs,
  },
  messageBody: {
    fontSize: theme.typography.fontSize.md,
  },
  messageDetail: {
    marginTop: theme.spacing.xl,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.md,
  },
  messageDetailTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.md,
  },
  messageDetailBody: {
    fontSize: theme.typography.fontSize.md,
    marginBottom: theme.spacing.lg,
    lineHeight: theme.typography.lineHeight.md,
  },
  timerContainer: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
  },
  timerText: {
    fontSize: theme.typography.fontSize.sm,
    textAlign: 'center',
  },
});
