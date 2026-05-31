import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '../src/hooks/use-i18n';
import { useAuth } from '../src/store/auth-store';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { theme } from '../src/theme';
import { MailboxRow } from '../src/types';
import {
  useDirectMessageUnreadQuery,
  useReceivedMailboxQuery,
  useSentMailboxQuery,
  useUsersQuery,
} from '../src/services/queries';
import { formatDateTime } from '../src/utils/date-format';
import { pushWithParams } from '../src/utils/navigation';
import {
  UserMessageModalPanel,
  userMessageModalPanelInner,
} from '../src/components/shared/UserMessageModalPanel';

export default function UserMessagesScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const colors = useThemeColors();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'received' | 'sent'>('received');
  const [pickOpen, setPickOpen] = useState(false);
  const [userFilter, setUserFilter] = useState('');

  const {
    data: received = [],
    isLoading: loadingIn,
    refetch: refetchIn,
  } = useReceivedMailboxQuery(user?.id);
  const {
    data: sent = [],
    isLoading: loadingOut,
    refetch: refetchOut,
  } = useSentMailboxQuery(user?.id);
  const { refetch: refetchUnread } = useDirectMessageUnreadQuery(user?.id);
  const { data: users = [], isLoading: usersLoading } = useUsersQuery();

  useFocusEffect(
    useCallback(() => {
      void refetchIn();
      void refetchOut();
      void refetchUnread();
    }, [refetchIn, refetchOut, refetchUnread])
  );

  const list = tab === 'received' ? received : sent;
  const loading = tab === 'received' ? loadingIn : loadingOut;

  const eligibleUsers = useMemo(() => {
    const term = userFilter.trim().toLowerCase();
    return users.filter(
      (u) =>
        u.isActive &&
        u.id !== user?.id &&
        (!term || u.username.toLowerCase().includes(term))
    );
  }, [users, user?.id, userFilter]);

  const openCompose = useCallback(() => {
    setPickOpen(false);
    qc.invalidateQueries({ queryKey: ['directMessages'] });
    router.push('/user-messages-compose');
  }, [router, qc]);

  const chooseRecipientCompose = useCallback(
    (peerId: string, peerUsername: string) => {
      setPickOpen(false);
      pushWithParams(router, '/user-messages-compose', { recipientId: peerId, recipientUsername });
    },
    [router]
  );

  const openMessage = useCallback(
    (row: MailboxRow) => {
      pushWithParams(router, '/user-message-detail', {
        messageId: row.id,
      });
    },
    [router]
  );

  const renderRow = ({ item }: { item: MailboxRow }) => {
    const unread = tab === 'received' && item.direction === 'received' && !item.readAt;
    return (
      <TouchableOpacity
        style={[styles.row, { backgroundColor: colors.cardBackground, borderColor: unread ? colors.primary : colors.border }]}
        onPress={() => openMessage(item)}
        activeOpacity={0.7}
      >
        <View style={styles.rowInner}>
          <View style={[styles.folderIcon, { backgroundColor: colors.backgroundSecondary }]}>
            <Ionicons name="mail-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.rowText}>
            <View style={styles.rowTop}>
              <Text style={[styles.peer, { color: colors.text }, unread && styles.peerUnread]} numberOfLines={1}>
                {tab === 'received' ? t('userMessages.fromPrefix') : t('userMessages.toPrefix')}{' '}
                <Text style={styles.peerName}>{item.counterpartName}</Text>
              </Text>
              <Text style={[styles.dt, { color: colors.textTertiary }]}>
                {formatDateTime(item.createdAt)}
              </Text>
            </View>
            <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={2}>
              {item.preview}
            </Text>
          </View>
          {unread && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
    <UserMessageModalPanel onClose={() => router.back()} backdropAccessibilityLabel={t('common.close')}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>{t('userMessages.mailboxTitle')}</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.tab, tab === 'received' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => setTab('received')}
            >
              <Text style={[styles.tabLabel, { color: tab === 'received' ? colors.primary : colors.textSecondary }]}>
                {t('userMessages.tabReceived')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'sent' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => setTab('sent')}
            >
              <Text style={[styles.tabLabel, { color: tab === 'sent' ? colors.primary : colors.textSecondary }]}>
                {t('userMessages.tabSent')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.panelBody}>
            {loading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : list.length === 0 ? (
              <View style={styles.centered}>
                <Ionicons name="mail-open-outline" size={48} color={colors.textTertiary} />
                <Text style={[styles.empty, { color: colors.textSecondary }]}>
                  {tab === 'received' ? t('userMessages.emptyReceived') : t('userMessages.emptySent')}
                </Text>
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={openCompose}>
                  <Text style={styles.primaryBtnText}>{t('userMessages.compose')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <FlatList
                  data={list}
                  keyExtractor={(m) => m.id}
                  renderItem={renderRow}
                  contentContainerStyle={styles.listContent}
                  refreshing={loading}
                  onRefresh={() => {
                    void tab === 'received' ? refetchIn() : refetchOut();
                    void refetchUnread();
                  }}
                />
                <TouchableOpacity
                  style={[styles.fab, { backgroundColor: colors.primary }]}
                  onPress={() => setPickOpen(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={28} color={colors.textInverse || '#fff'} />
                </TouchableOpacity>
              </>
            )}
          </View>
    </UserMessageModalPanel>

      <Modal visible={pickOpen} animationType="fade" transparent onRequestClose={() => setPickOpen(false)}>
        <UserMessageModalPanel onClose={() => setPickOpen(false)} backdropAccessibilityLabel={t('common.cancel')}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setPickOpen(false)}>
              <Text style={[styles.modalCancel, { color: colors.primary }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>{t('userMessages.chooseRecipient')}</Text>
            <View style={{ width: 72 }} />
          </View>
          <TouchableOpacity style={[styles.composeLink, { backgroundColor: colors.backgroundSecondary }] } onPress={() => openCompose()}>
            <Ionicons name="create-outline" size={22} color={colors.primary} />
            <Text style={[styles.composeLinkText, { color: colors.primary }]}>{t('userMessages.composeManual')}</Text>
          </TouchableOpacity>
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
                    onPress={() => chooseRecipientCompose(item.id, item.username)}
                  >
                    <Ionicons name="person-circle-outline" size={36} color={colors.primary} />
                    <Text style={[styles.userName, { color: colors.text }]}>{item.username}</Text>
                    <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={[styles.empty, { color: colors.textSecondary, marginTop: 24 }]}>
                    {t('userMessages.noEligibleUsers')}
                  </Text>
                }
              />
            )}
          </View>
        </UserMessageModalPanel>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  panelBody: {
    flex: 1,
    minHeight: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    minHeight: 48,
  },
  backBtn: { padding: theme.spacing.xs },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  tabLabel: { fontWeight: theme.typography.fontWeight.semibold, fontSize: theme.typography.fontSize.sm },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  empty: {
    fontSize: theme.typography.fontSize.md,
    textAlign: 'center',
  },
  primaryBtn: {
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: theme.typography.fontWeight.semibold,
  },
  listContent: { padding: theme.spacing.md, paddingBottom: 88 },
  row: {
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    marginBottom: theme.spacing.sm,
    overflow: 'hidden',
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  folderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowText: { flex: 1 },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  peer: { fontSize: theme.typography.fontSize.sm },
  peerUnread: { fontWeight: '700' },
  peerName: { fontWeight: '600' },
  dt: { fontSize: 11, flexShrink: 0 },
  preview: { fontSize: theme.typography.fontSize.sm, lineHeight: 18 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  fab: {
    position: 'absolute',
    right: theme.spacing.lg,
    bottom: theme.spacing.xl + 8,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6 },
      android: { elevation: 6 },
    }),
  },
  modalCancel: { fontSize: theme.typography.fontSize.md },
  composeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  composeLinkText: { fontWeight: '600', fontSize: theme.typography.fontSize.md },
  hint: { paddingHorizontal: theme.spacing.md, marginBottom: theme.spacing.xs, fontSize: theme.typography.fontSize.sm },
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
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  userName: { flex: 1, fontSize: theme.typography.fontSize.md, fontWeight: '500' },
});
