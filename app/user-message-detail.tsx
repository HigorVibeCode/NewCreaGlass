import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '../src/hooks/use-i18n';
import { useAuth } from '../src/store/auth-store';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useRouteParams } from '../src/hooks/use-route-params';
import { theme } from '../src/theme';
import { repos } from '../src/services/container';
import { formatDateTime } from '../src/utils/date-format';
import { useDirectMessageDetailQuery } from '../src/services/queries';
import { pushWithParams } from '../src/utils/navigation';
import {
  UserMessageModalPanel,
  userMessageModalPanelInner,
} from '../src/components/shared/UserMessageModalPanel';

export default function UserMessageDetailScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const colors = useThemeColors();
  const router = useRouter();
  const qc = useQueryClient();

  const { messageId } = useRouteParams<{ messageId: string }>('/user-message-detail');

  const { data: msg, isLoading, error } = useDirectMessageDetailQuery(user?.id, messageId);

  useEffect(() => {
    if (!msg || !user?.id || !messageId) return;
    const isIncoming = msg.recipientId === user.id;
    if (isIncoming && !msg.readAt) {
      void (async () => {
        try {
          await repos.directMessagesRepo.markMessageRead(messageId);
          qc.invalidateQueries({ queryKey: ['directMessages'] });
        } catch (e) {
          console.warn('markMessageRead', e);
        }
      })();
    }
  }, [msg, user?.id, messageId, qc]);

  const onReply = () => {
    if (!msg || !user) return;
    const incoming = msg.recipientId === user.id;
    const replyToId = incoming ? msg.senderId : msg.recipientId;
    const replyToName = incoming ? msg.senderName : msg.recipientName;
    pushWithParams(router, '/user-messages-compose', {
      recipientId: replyToId,
      recipientUsername: replyToName,
    });
  };

  return (
    <UserMessageModalPanel onClose={() => router.back()} backdropAccessibilityLabel={t('common.close')}>
      {(isLoading || !messageId) && (
        <View style={[userMessageModalPanelInner.inner, styles.centeredInner]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
      {(error || !msg) && !isLoading && messageId && (
        <View style={[userMessageModalPanelInner.inner, styles.centeredInner]}>
          <Text style={{ color: colors.textSecondary }}>{t('userMessages.loadError')}</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: colors.primary, marginTop: 12 }}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      )}
      {!isLoading && !error && msg && (
        <>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t('userMessages.detailTitle')}</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            style={userMessageModalPanelInner.inner}
            contentContainerStyle={styles.scrollInner}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('userMessages.fieldFrom')}</Text>
            <Text style={[styles.value, { color: colors.text }]}>{msg.senderName}</Text>

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: theme.spacing.md }]}>
              {t('userMessages.fieldTo')}
            </Text>
            <Text style={[styles.value, { color: colors.text }]}>{msg.recipientName}</Text>

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: theme.spacing.md }]}>
              {t('userMessages.fieldDate')}
            </Text>
            <Text style={[styles.value, { color: colors.textSecondary }]}>{formatDateTime(msg.createdAt)}</Text>

            <View style={[styles.sep, { backgroundColor: colors.border }]} />

            <Text style={[styles.body, { color: colors.text }]}>{msg.body}</Text>

            <TouchableOpacity style={[styles.replyBtn, { backgroundColor: colors.primary }]} onPress={onReply}>
              <Ionicons name="return-down-forward" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.replyBtnText}>{t('userMessages.reply')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </>
      )}
    </UserMessageModalPanel>
  );
}

const styles = StyleSheet.create({
  centeredInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderBottomWidth: 1,
  },
  backBtn: { padding: theme.spacing.xs },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: theme.typography.fontWeight.bold,
    fontSize: theme.typography.fontSize.md,
  },
  scrollInner: { padding: theme.spacing.lg, paddingBottom: 40, flexGrow: 1 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  value: { fontSize: theme.typography.fontSize.md },
  sep: { height: StyleSheet.hairlineWidth, marginVertical: theme.spacing.lg },
  body: { fontSize: theme.typography.fontSize.md, lineHeight: 24 },
  replyBtn: {
    marginTop: theme.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  replyBtnText: { color: '#fff', fontWeight: '700', fontSize: theme.typography.fontSize.md },
});
