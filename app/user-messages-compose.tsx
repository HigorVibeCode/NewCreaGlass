import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
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
import { useUsersQuery } from '../src/services/queries';
import {
  UserMessageModalPanel,
  userMessageModalPanelInner,
} from '../src/components/shared/UserMessageModalPanel';

export default function UserMessagesComposeScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const colors = useThemeColors();
  const router = useRouter();
  const qc = useQueryClient();

  const params = useRouteParams<{ recipientId?: string; recipientUsername?: string }>(
    '/user-messages-compose'
  );

  const [recipientId, setRecipientId] = useState<string | undefined>(params.recipientId);
  const [recipientName, setRecipientName] = useState(params.recipientUsername ?? '');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  /** Confirmação visual após envio (substitui alert pouco fiável em web/modais). */
  const [sendSucceeded, setSendSucceeded] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [userFilter, setUserFilter] = useState('');

  const { data: users = [], isLoading: usersLoading } = useUsersQuery();

  useEffect(() => {
    if (params.recipientId && params.recipientUsername) {
      setRecipientId(params.recipientId);
      setRecipientName(params.recipientUsername);
    }
  }, [params.recipientId, params.recipientUsername]);

  useEffect(() => {
    if (!sendSucceeded) return;
    const timer = setTimeout(() => router.back(), 2300);
    return () => clearTimeout(timer);
  }, [sendSucceeded, router]);

  const eligibleUsers = useMemo(() => {
    const term = userFilter.trim().toLowerCase();
    return users.filter(
      (u) =>
        u.isActive &&
        u.id !== user?.id &&
        (!term || u.username.toLowerCase().includes(term))
    );
  }, [users, user?.id, userFilter]);

  const pickRecipient = useCallback((id: string, name: string) => {
    setRecipientId(id);
    setRecipientName(name);
    setPickOpen(false);
    setUserFilter('');
  }, []);

  const submit = async () => {
    if (!recipientId) {
      Alert.alert(t('common.error'), t('userMessages.selectRecipient'));
      return;
    }
    const text = body.trim();
    if (!text) {
      Alert.alert(t('common.error'), t('userMessages.emptyBody'));
      return;
    }
    setSending(true);
    try {
      await repos.directMessagesRepo.sendMessage(recipientId, text);
      qc.invalidateQueries({ queryKey: ['directMessages'] });
      Keyboard.dismiss();
      setBody('');
      setSendSucceeded(true);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || t('userMessages.sendError'));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <UserMessageModalPanel onClose={() => router.back()} backdropAccessibilityLabel={t('common.close')}>
        {sendSucceeded ? (
          <View style={[userMessageModalPanelInner.inner, styles.successWrap]} accessibilityLiveRegion="polite">
            <Ionicons name="checkmark-circle" size={72} color={colors.success} />
            <Text style={[styles.successTitle, { color: colors.text }]}>{t('common.success')}</Text>
            <Text style={[styles.successBody, { color: colors.textSecondary }]}>{t('userMessages.sent')}</Text>
            <Text style={[styles.successHint, { color: colors.textTertiary }]}>{t('userMessages.sentAutoCloseHint')}</Text>
          </View>
        ) : (
        <KeyboardAvoidingView
          style={[userMessageModalPanelInner.inner, styles.keyboardRoot]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.header, { paddingTop: theme.spacing.sm, borderBottomColor: colors.border }]}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>{t('userMessages.compose')}</Text>
            <View style={{ width: 40 }} />
          </View>

          <TouchableOpacity style={[styles.toRow, { borderBottomColor: colors.border }]} onPress={() => setPickOpen(true)}>
            <Text style={[styles.toLabel, { color: colors.textSecondary }]}>{t('userMessages.fieldTo')}</Text>
            <Text style={[styles.toValue, { color: recipientId ? colors.text : colors.textTertiary }]} numberOfLines={1}>
              {recipientName || t('userMessages.tapToChoose')}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          <TextInput
            style={[styles.bodyInput, { color: colors.text }]}
            multiline
            textAlignVertical="top"
            maxLength={5000}
            placeholder={t('userMessages.bodyPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            value={body}
            onChangeText={setBody}
          />

          <View style={[styles.footer, { paddingBottom: theme.spacing.md, borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[
                styles.sendBtn,
                { backgroundColor: colors.primary },
                (!recipientId || !body.trim() || sending) && { opacity: 0.55 },
              ]}
              disabled={!recipientId || !body.trim() || sending}
              onPress={() => void submit()}
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.sendBtnText}>{t('userMessages.send')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
        )}
      </UserMessageModalPanel>

      <Modal visible={pickOpen} animationType="fade" transparent onRequestClose={() => setPickOpen(false)}>
        <View style={{ flex: 1 }}>
          <UserMessageModalPanel onClose={() => setPickOpen(false)} backdropAccessibilityLabel={t('common.cancel')}>
            <View style={[styles.header, { paddingTop: theme.spacing.sm, borderBottomColor: colors.border }]}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setPickOpen(false)}>
                <Text style={{ color: colors.primary }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <Text style={[styles.title, { color: colors.text }]}>{t('userMessages.chooseRecipient')}</Text>
              <View style={{ width: 64 }} />
            </View>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('userMessages.activeUsersOnly')}</Text>
            <TextInput
              style={[styles.search, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary, color: colors.text }]}
              placeholder={t('common.search')}
              placeholderTextColor={colors.textTertiary}
              value={userFilter}
              onChangeText={setUserFilter}
            />
            <View style={userMessageModalPanelInner.inner}>
              {usersLoading ? (
                <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
              ) : (
                <FlatList
                  data={eligibleUsers}
                  style={{ flex: 1 }}
                  keyExtractor={(u) => u.id}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.userRow, { borderBottomColor: colors.borderLight }]}
                      onPress={() => pickRecipient(item.id, item.username)}
                    >
                      <Text style={[styles.userName, { color: colors.text }]}>{item.username}</Text>
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color={recipientId === item.id ? colors.primary : colors.border}
                      />
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          </UserMessageModalPanel>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  successWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  successTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  successBody: {
    fontSize: theme.typography.fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  successHint: {
    fontSize: theme.typography.fontSize.sm,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  keyboardRoot: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
  },
  backBtn: { padding: theme.spacing.xs },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
  },
  toRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: theme.spacing.sm,
  },
  toLabel: { fontSize: 12, fontWeight: '700', width: 48 },
  toValue: { flex: 1, fontSize: theme.typography.fontSize.md, fontWeight: '600' },
  bodyInput: {
    flex: 1,
    minHeight: 120,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    fontSize: theme.typography.fontSize.md,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: theme.typography.fontSize.md },
  hint: {
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    fontSize: theme.typography.fontSize.sm,
    marginTop: theme.spacing.sm,
  },
  search: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: theme.typography.fontSize.md,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  userName: { fontSize: theme.typography.fontSize.md },
});
