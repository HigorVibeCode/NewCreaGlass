import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useI18n } from '../src/hooks/use-i18n';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { useAuth } from '../src/store/auth-store';
import { useMyTimeEntriesQuery } from '../src/services/queries';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../src/components/shared/Button';
import { Input } from '../src/components/shared/Input';
import { TimePicker } from '../src/components/shared/TimePicker';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { getEffectiveRecordedAt } from '../src/utils/point-report-pdf';
import { repos } from '../src/services/container';
import { tryBiometricAuth } from '../src/utils/point-auth';
import { getCurrentLocationForEntry } from '../src/utils/point-location';
import { theme } from '../src/theme';
import { TimeEntry } from '../src/types';

export default function PointScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const { effectiveTheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMaster = user?.userType === 'Master';

  const { data: entries = [], isLoading } = useMyTimeEntriesQuery(user?.id);
  const [registering, setRegistering] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustEntry, setAdjustEntry] = useState<TimeEntry | null>(null);
  const [adjustTime, setAdjustTime] = useState('');
  const [adjustDescription, setAdjustDescription] = useState('');
  const [savingAdjust, setSavingAdjust] = useState(false);

  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
  const canAdjustEntry = useCallback(
    (entry: TimeEntry) => {
      if (!user) return false;
      if (entry.isAdjusted) return false;
      const isOwner = entry.userId === user.id;
      if (!isOwner && !isMaster) return false;
      const created = new Date(entry.createdAt).getTime();
      if (Date.now() - created >= TWO_DAYS_MS) return false;
      return true;
    },
    [user, isMaster]
  );

  const openAdjustModal = useCallback((entry: TimeEntry) => {
    const d = new Date(getEffectiveRecordedAt(entry));
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    setAdjustEntry(entry);
    setAdjustTime(`${h}:${m}`);
    setAdjustDescription('');
    setShowAdjustModal(true);
  }, []);

  const buildAdjustedIso = useCallback((entry: TimeEntry, timeStr: string): string => {
    const base = new Date(getEffectiveRecordedAt(entry));
    const [h, min] = timeStr.split(':').map(Number);
    base.setHours(h ?? 0, min ?? 0, 0, 0);
    return base.toISOString();
  }, []);

  const handleSaveAdjust = useCallback(async () => {
    if (!adjustEntry) return;
    const desc = adjustDescription.trim();
    if (!desc) {
      Alert.alert(t('common.error'), t('point.adjustDescription') + ' obrigatória.');
      return;
    }
    if (desc.length > 20) {
      Alert.alert(t('common.error'), 'Descrição deve ter no máximo 20 caracteres');
      return;
    }
    setSavingAdjust(true);
    try {
      await repos.timeEntriesRepo.updateTimeEntryAdjustment(adjustEntry.id, {
        adjustedRecordedAt: buildAdjustedIso(adjustEntry, adjustTime),
        adjustDescription: desc,
      });
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      setShowAdjustModal(false);
      setAdjustEntry(null);
      setAdjustDescription('');
      Alert.alert(t('common.success'), t('point.adjustSuccess'));
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message || t('common.error'));
    } finally {
      setSavingAdjust(false);
    }
  }, [adjustEntry, adjustTime, adjustDescription, t, queryClient, buildAdjustedIso]);

  const performRegister = useCallback(async () => {
    if (!user) return;
    setRegistering(true);
    try {
      const serverTime = await repos.timeEntriesRepo.getServerTime();
      const location = await getCurrentLocationForEntry();
      await repos.timeEntriesRepo.createTimeEntry({
        userId: user.id,
        userName: user.username,
        recordedAt: serverTime,
        locationAddress: location.locationAddress,
        gpsAccuracy: location.gpsAccuracy,
        gpsSource: location.gpsSource,
      });
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      setShowPasswordModal(false);
      setPassword('');
      Alert.alert(t('common.success'), t('point.registered'));
    } catch (err: any) {
      if (err?.message === 'LOCATION_PERMISSION_DENIED') {
        Alert.alert(
          t('point.locationRequired'),
          t('point.locationPermissionMessage')
        );
      } else {
        Alert.alert(t('common.error'), err?.message || t('common.error'));
      }
    } finally {
      setRegistering(false);
    }
  }, [user, t, queryClient]);

  const handleRegisterPress = useCallback(async () => {
    if (!user) return;
    const ok = await tryBiometricAuth(t('point.biometricPrompt'));
    if (ok) {
      await performRegister();
      return;
    }
    setShowPasswordModal(true);
  }, [user, t, performRegister]);

  const handlePasswordSubmit = useCallback(async () => {
    if (!password.trim()) return;
    const ok = await repos.authRepo.validatePassword(password);
    if (!ok) {
      Alert.alert(t('common.error'), t('point.invalidPassword'));
      return;
    }
    setShowPasswordModal(false);
    setPassword('');
    await performRegister();
  }, [password, t, performRegister]);

  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries', 'my'] });
    }, [queryClient])
  );

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <ScreenWrapper>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + theme.spacing.md,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <View
              style={[
                styles.headerIconContainer,
                { backgroundColor: effectiveTheme === 'dark' ? '#6366f140' : '#e0e7ff' },
              ]}
            >
              <Ionicons name="time-outline" size={20} color="#6366f1" />
            </View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {t('point.title')}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.reportsButton}
            onPress={() => router.push('/point-reports')}
            activeOpacity={0.7}
          >
            <Ionicons name="bar-chart-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={[styles.registerButton, { backgroundColor: colors.primary }]}
          onPress={handleRegisterPress}
          disabled={registering}
          activeOpacity={0.8}
        >
          {registering ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="finger-print" size={32} color="#fff" />
              <Text style={styles.registerButtonText}>
                {t('point.registerButton')}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {t('point.myEntries')}
        </Text>

        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
        ) : entries.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={40} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('point.noEntries')}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {entries.map((entry: TimeEntry) => (
              <View
                key={entry.id}
                style={[styles.card, { backgroundColor: colors.cardBackground }]}
              >
                <View style={[styles.cardRow, { justifyContent: 'space-between', alignItems: 'center' }]}>
                  <View style={styles.cardRowTime}>
                    <Ionicons name="time" size={18} color={colors.primary} />
                    <Text style={[styles.cardDateTime, { color: colors.text }]}>
                      {formatDateTime(getEffectiveRecordedAt(entry))}
                      {entry.isAdjusted ? ` (${t('point.adjusted')})` : ''}
                    </Text>
                  </View>
                  {canAdjustEntry(entry) && (
                    <TouchableOpacity
                      style={[styles.adjustButton, { borderColor: colors.primary }]}
                      onPress={() => openAdjustModal(entry)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.adjustButtonText, { color: colors.primary }]}>
                        {t('point.adjust')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                {entry.locationAddress ? (
                  <View style={styles.cardRow}>
                    <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.cardAddress, { color: colors.textSecondary }]} numberOfLines={2}>
                      {entry.locationAddress}
                    </Text>
                  </View>
                ) : null}
                {(entry.gpsAccuracy != null || entry.gpsSource) && (
                  <Text style={[styles.cardMeta, { color: colors.textTertiary }]}>
                    {entry.gpsSource ?? '—'} · {entry.gpsAccuracy != null ? `${Math.round(entry.gpsAccuracy)} m` : '—'}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowPasswordModal(false)}>
          <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalBox, { backgroundColor: colors.background }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {t('point.enterPassword')}
                </Text>
                <Input
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('auth.password')}
                  secureTextEntry
                  autoCapitalize="none"
                />
                <View style={styles.modalActions}>
                  <Button
                    title={t('common.cancel')}
                    variant="outline"
                    onPress={() => {
                      setShowPasswordModal(false);
                      setPassword('');
                    }}
                    style={styles.modalButton}
                  />
                  <Button
                    title={t('common.confirm')}
                    onPress={handlePasswordSubmit}
                    loading={registering}
                    disabled={!password.trim()}
                    style={styles.modalButton}
                  />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={showAdjustModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAdjustModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowAdjustModal(false)}>
          <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalBox, { backgroundColor: colors.background }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {t('point.adjustTitle')}
                </Text>
                <TimePicker
                  label={t('point.newTime')}
                  value={adjustTime}
                  onSelect={setAdjustTime}
                />
                <Input
                  value={adjustDescription}
                  onChangeText={(text) => setAdjustDescription(text.slice(0, 20))}
                  placeholder={t('point.adjustDescriptionPlaceholder')}
                  maxLength={20}
                />
                <View style={styles.modalActions}>
                  <Button
                    title={t('common.cancel')}
                    variant="outline"
                    onPress={() => {
                      setShowAdjustModal(false);
                      setAdjustEntry(null);
                      setAdjustDescription('');
                    }}
                    style={styles.modalButton}
                  />
                  <Button
                    title={t('point.saveAdjust')}
                    onPress={handleSaveAdjust}
                    loading={savingAdjust}
                    disabled={!adjustDescription.trim()}
                    style={styles.modalButton}
                  />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -theme.spacing.xs,
  },
  headerTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  reportsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.md,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.sm,
    marginBottom: theme.spacing.sm,
  },
  loader: { marginVertical: theme.spacing.md },
  empty: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.md,
    marginTop: theme.spacing.sm,
  },
  list: {
    gap: theme.spacing.sm,
  },
  card: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  cardRowTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    flex: 1,
  },
  adjustButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
  },
  adjustButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  cardDateTime: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.medium,
    flex: 1,
  },
  cardAddress: {
    fontSize: theme.typography.fontSize.sm,
    flex: 1,
  },
  cardMeta: {
    fontSize: theme.typography.fontSize.xs,
    marginTop: theme.spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalBox: {
    width: '100%',
    maxWidth: 340,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.lg,
  },
  modalTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  modalButton: {
    flex: 1,
  },
});
