import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
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
import { useRouteParams } from '../src/hooks/use-route-params';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDate as formatDateUtil, formatTime as formatTimeUtil } from '../src/utils/date-format';
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
import { useGoBack } from '../src/hooks/use-go-back';
import { theme } from '../src/theme';
import { TimeEntry, EntryType } from '../src/types';

// Lazy import expo-notifications
let Notifications: typeof import('expo-notifications') | null = null;
try { Notifications = require('expo-notifications'); } catch { /* noop */ }

/* ─── Constantes de pausa ─── */
const COFFEE_DURATION_MS = 15 * 60 * 1000; // 15 min
const LUNCH_DURATION_MS = 45 * 60 * 1000;  // 45 min
const WARN_BEFORE_MS = 3 * 60 * 1000;      // 3 min antes

/* ─── Tipos auxiliares ─── */
interface DayGroup {
  dateKey: string;            // YYYY-MM-DD
  dateLabel: string;          // "11 Feb 2026"
  weekday: string;            // "Tue"
  clockIn: TimeEntry | null;
  clockOut: TimeEntry | null;
  coffeeStart: TimeEntry | null;
  coffeeEnd: TimeEntry | null;
  lunchStart: TimeEntry | null;
  lunchEnd: TimeEntry | null;
  isToday: boolean;
  isAutomatic: boolean;       // qualquer entry com locationAddress === 'Automático'
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isWeekend(dateKey: string): boolean {
  const d = new Date(dateKey + 'T12:00:00');
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

function formatHourMin(totalMs: number): string {
  if (!Number.isFinite(totalMs) || totalMs < 0) return '00:00';
  const totalMin = Math.floor(totalMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/* ─── Timer hook (subtrai pausas completas + pausa ativa limitada à duração fixa) ─── */
function useLiveTimer(
  startIso: string | null,
  completedPauseMs: number,
  activePauseStartIso: string | null,
  activePauseCapMs: number,
): string {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startIso) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startIso]);
  if (!startIso) return '00:00:00';
  const elapsed = Math.max(0, now - new Date(startIso).getTime());
  let totalPause = completedPauseMs;
  if (activePauseStartIso) {
    const activeElapsed = Math.max(0, now - new Date(activePauseStartIso).getTime());
    totalPause += Math.min(activeElapsed, activePauseCapMs);
  }
  const effective = Math.max(0, elapsed - totalPause);
  const s = Math.floor(effective / 1000) % 60;
  const m = Math.floor(effective / 60000) % 60;
  const h = Math.floor(effective / 3600000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ─── Countdown hook para pausas ─── */
function usePauseCountdown(startIso: string | null, durationMs: number): { remaining: string; finished: boolean } {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startIso) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startIso]);
  if (!startIso) return { remaining: '00:00', finished: true };
  const elapsed = now - new Date(startIso).getTime();
  const left = Math.max(0, durationMs - elapsed);
  const finished = left <= 0;
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return { remaining: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`, finished };
}

export default function PointScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useRouteParams<{ nfc?: string }>('/point'); // nfc=clock_in | clock_out | 1 (legado)
  const colors = useThemeColors();
  const { effectiveTheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const goBack = useGoBack();
  const isMaster = user?.userType === 'Master';
  const nfcHandledRef = useRef(false);

  const { data: entries = [], isLoading } = useMyTimeEntriesQuery(user?.id);
  const [registering, setRegistering] = useState(false);
  const [pendingEntryType, setPendingEntryType] = useState<EntryType>('clock_in');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustEntry, setAdjustEntry] = useState<TimeEntry | null>(null);
  const [adjustTime, setAdjustTime] = useState('');
  const [adjustDescription, setAdjustDescription] = useState('');
  const [savingAdjust, setSavingAdjust] = useState(false);
  const [nfcMode, setNfcMode] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<'clock_in' | 'clock_out'>('clock_in');
  // Estado local para ativar o timer do botão imediatamente (sem esperar refetch)
  const [localCoffeePauseStart, setLocalCoffeePauseStart] = useState<string | null>(null);
  const [localLunchPauseStart, setLocalLunchPauseStart] = useState<string | null>(null);

  /* ─── Agrupar entries por dia ─── */
  const todayKey = new Date().toISOString().slice(0, 10);

  const dayGroups: DayGroup[] = useMemo(() => {
    const map = new Map<string, {
      clockIn: TimeEntry | null; clockOut: TimeEntry | null;
      coffeeStart: TimeEntry | null; coffeeEnd: TimeEntry | null;
      lunchStart: TimeEntry | null; lunchEnd: TimeEntry | null;
    }>();
    for (const e of entries) {
      const eff = getEffectiveRecordedAt(e);
      if (!eff) continue;
      const dk = toDateKey(eff);
      if (!map.has(dk)) map.set(dk, { clockIn: null, clockOut: null, coffeeStart: null, coffeeEnd: null, lunchStart: null, lunchEnd: null });
      const group = map.get(dk)!;
      if (e.entryType === 'clock_in') group.clockIn = e;
      else if (e.entryType === 'clock_out') group.clockOut = e;
      else if (e.entryType === 'coffee_start') group.coffeeStart = e;
      else if (e.entryType === 'coffee_end') group.coffeeEnd = e;
      else if (e.entryType === 'lunch_start') group.lunchStart = e;
      else if (e.entryType === 'lunch_end') group.lunchEnd = e;
      else {
        // Fallback legado: sem entry_type
        if (!group.clockIn) group.clockIn = e;
        else if (!group.clockOut) group.clockOut = e;
      }
    }
    const result: DayGroup[] = [];
    for (const [dk, g] of map) {
      const hasManualEntry = (g.clockIn && g.clockIn.locationAddress !== 'Automático') ||
                             (g.clockOut && g.clockOut.locationAddress !== 'Automático');
      if (isWeekend(dk) && !hasManualEntry) continue;

      const refEntry = g.clockIn || g.clockOut;
      const refIso = refEntry ? getEffectiveRecordedAt(refEntry) : dk;
      const d = new Date(refIso || dk);
      result.push({
        dateKey: dk,
        dateLabel: formatDateUtil(refIso || dk),
        weekday: WEEKDAY_SHORT[d.getDay()] || '',
        clockIn: g.clockIn,
        clockOut: g.clockOut,
        coffeeStart: g.coffeeStart,
        coffeeEnd: g.coffeeEnd,
        lunchStart: g.lunchStart,
        lunchEnd: g.lunchEnd,
        isToday: dk === todayKey,
        isAutomatic:
          (g.clockIn?.locationAddress === 'Automático') ||
          (g.clockOut?.locationAddress === 'Automático') || false,
      });
    }
    result.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    return result;
  }, [entries, todayKey]);

  const todayGroup = dayGroups.find((g) => g.isToday) || null;
  const hasTodayClockIn = todayGroup?.clockIn != null;
  const hasTodayClockOut = todayGroup?.clockOut != null;

  // Pausas de hoje (estado do banco OU estado local imediato)
  const dbCoffeeActive = !!(todayGroup?.coffeeStart && !todayGroup?.coffeeEnd);
  const dbLunchActive = !!(todayGroup?.lunchStart && !todayGroup?.lunchEnd);
  const coffeeActive = dbCoffeeActive || !!localCoffeePauseStart;
  const lunchActive = dbLunchActive || !!localLunchPauseStart;
  const anyPauseActive = coffeeActive || lunchActive;
  const hasCoffeeToday = todayGroup?.coffeeStart != null || !!localCoffeePauseStart;
  const hasLunchToday = todayGroup?.lunchStart != null || !!localLunchPauseStart;

  // Sincronizar: quando o banco confirmar a pausa, limpar estado local
  useEffect(() => {
    if (todayGroup?.coffeeStart && localCoffeePauseStart) setLocalCoffeePauseStart(null);
  }, [todayGroup?.coffeeStart, localCoffeePauseStart]);
  useEffect(() => {
    if (todayGroup?.lunchStart && localLunchPauseStart) setLocalLunchPauseStart(null);
  }, [todayGroup?.lunchStart, localLunchPauseStart]);
  // Limpar se a pausa encerrou
  useEffect(() => {
    if (todayGroup?.coffeeEnd) setLocalCoffeePauseStart(null);
  }, [todayGroup?.coffeeEnd]);
  useEffect(() => {
    if (todayGroup?.lunchEnd) setLocalLunchPauseStart(null);
  }, [todayGroup?.lunchEnd]);

  // Dedução fixa para pausas completas (15 min café, 45 min almoço)
  const todayPauseMs = useMemo(() => {
    if (!todayGroup) return 0;
    let total = 0;
    if (todayGroup.coffeeStart && todayGroup.coffeeEnd) total += COFFEE_DURATION_MS;
    if (todayGroup.lunchStart && todayGroup.lunchEnd) total += LUNCH_DURATION_MS;
    return total;
  }, [todayGroup]);

  // Countdowns das pausas ativas (usa dado do banco se disponível, senão o estado local)
  const coffeeStartIso = coffeeActive
    ? (todayGroup?.coffeeStart ? getEffectiveRecordedAt(todayGroup.coffeeStart) : localCoffeePauseStart)
    : null;
  const lunchStartIso = lunchActive
    ? (todayGroup?.lunchStart ? getEffectiveRecordedAt(todayGroup.lunchStart) : localLunchPauseStart)
    : null;

  // ISO de início da pausa ativa (para o timer subtrair em tempo real)
  const activePauseStartIso = coffeeStartIso || lunchStartIso;
  // Cap fixo da pausa ativa: 15 min para café, 45 min para almoço
  const activePauseCapMs = coffeeStartIso ? COFFEE_DURATION_MS : (lunchStartIso ? LUNCH_DURATION_MS : 0);

  // Timer ao vivo
  const liveTimerStartIso =
    todayGroup?.clockIn && !todayGroup?.clockOut
      ? getEffectiveRecordedAt(todayGroup.clockIn)
      : null;
  const liveTimerLabel = useLiveTimer(liveTimerStartIso, todayPauseMs, activePauseStartIso, activePauseCapMs);
  const coffeeCountdown = usePauseCountdown(coffeeStartIso, COFFEE_DURATION_MS);
  const lunchCountdown = usePauseCountdown(lunchStartIso, LUNCH_DURATION_MS);

  // Encerrar pausa vencida com timestamp correto (start + duração fixa)
  const autoEndOverduePause = useCallback(async (entryType: EntryType, correctEndIso: string) => {
    if (!user) return;
    try {
      await repos.timeEntriesRepo.createTimeEntry({
        userId: user.id,
        userName: user.username,
        recordedAt: correctEndIso,
        entryType,
        locationAddress: null,
        gpsAccuracy: null,
        gpsSource: null,
      });
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
    } catch (err: any) {
      console.warn('Auto-end overdue pause failed:', err);
    }
  }, [user, queryClient]);

  // Auto-encerrar pausa quando o tempo acabar (usa timestamp correto: start + duração fixa)
  const coffeeAutoEndRef = useRef(false);
  const lunchAutoEndRef = useRef(false);

  useEffect(() => {
    if (coffeeCountdown.finished && coffeeActive && !coffeeAutoEndRef.current) {
      coffeeAutoEndRef.current = true;
      setLocalCoffeePauseStart(null);
      const startIso = todayGroup?.coffeeStart
        ? getEffectiveRecordedAt(todayGroup.coffeeStart)
        : localCoffeePauseStart;
      if (startIso) {
        const correctEnd = new Date(new Date(startIso).getTime() + COFFEE_DURATION_MS).toISOString();
        autoEndOverduePause('coffee_end', correctEnd);
      }
    }
    if (!coffeeActive) coffeeAutoEndRef.current = false;
  }, [coffeeCountdown.finished, coffeeActive, autoEndOverduePause, todayGroup?.coffeeStart, localCoffeePauseStart]);

  useEffect(() => {
    if (lunchCountdown.finished && lunchActive && !lunchAutoEndRef.current) {
      lunchAutoEndRef.current = true;
      setLocalLunchPauseStart(null);
      const startIso = todayGroup?.lunchStart
        ? getEffectiveRecordedAt(todayGroup.lunchStart)
        : localLunchPauseStart;
      if (startIso) {
        const correctEnd = new Date(new Date(startIso).getTime() + LUNCH_DURATION_MS).toISOString();
        autoEndOverduePause('lunch_end', correctEnd);
      }
    }
    if (!lunchActive) lunchAutoEndRef.current = false;
  }, [lunchCountdown.finished, lunchActive, autoEndOverduePause, todayGroup?.lunchStart, localLunchPauseStart]);

  // NFC auto-trigger: ?nfc=clock_in | clock_out | 1 (legado = clock_in)
  useEffect(() => {
    if (!params.nfc || !user || nfcHandledRef.current) return;
    const nfcParam = params.nfc;
    let nfcEntryType: EntryType;
    if (nfcParam === 'clock_out') {
      nfcEntryType = 'clock_out';
    } else if (nfcParam === 'clock_in' || nfcParam === '1') {
      nfcEntryType = 'clock_in';
    } else {
      return; // parâmetro inválido
    }
    nfcHandledRef.current = true;
    setNfcMode(true);
    setPendingEntryType(nfcEntryType);
    const timer = setTimeout(() => {
      if (Platform.OS === 'web') {
        setShowPasswordModal(true);
      } else {
        tryBiometricAuth(t('point.biometricPrompt')).then((ok) => {
          if (ok) {
            performRegister(nfcEntryType);
          } else {
            setShowPasswordModal(true);
          }
        });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [params.nfc, user]);

  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
  const canAdjustEntry = useCallback(
    (entry: TimeEntry | null) => {
      if (!entry || !user) return false;
      if (entry.isAdjusted) return false;
      const isOwner = entry.userId === user.id;
      if (!isOwner && !isMaster) return false;
      const created = new Date(entry.createdAt).getTime();
      if (Date.now() - created >= TWO_DAYS_MS) return false;
      return true;
    },
    [user, isMaster]
  );

  const openAdjustModal = useCallback((entry: TimeEntry, target: 'clock_in' | 'clock_out') => {
    const d = new Date(getEffectiveRecordedAt(entry));
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    setAdjustEntry(entry);
    setAdjustTarget(target);
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

  /* ─── Agendar notificação local para fim de pausa ─── */
  const schedulePauseNotification = useCallback(async (pauseType: 'coffee' | 'lunch') => {
    if (Platform.OS === 'web' || !Notifications) return;
    const durationMs = pauseType === 'coffee' ? COFFEE_DURATION_MS : LUNCH_DURATION_MS;
    const triggerMs = durationMs - WARN_BEFORE_MS; // 12min (café) ou 42min (almoço)
    const title = pauseType === 'coffee' ? t('point.coffeeEndingSoon') : t('point.lunchEndingSoon');
    const body = t('point.pauseEndingIn3Min');
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: 'default' },
        trigger: { seconds: Math.floor(triggerMs / 1000), type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL },
      });
    } catch (err) {
      console.warn('Failed to schedule pause notification:', err);
    }
  }, [t]);

  const performRegister = useCallback(async (entryType: EntryType) => {
    if (!user) return;
    setRegistering(true);
    const isPauseEntry = ['coffee_start', 'coffee_end', 'lunch_start', 'lunch_end'].includes(entryType);

    // Ativar timer local IMEDIATAMENTE (otimista, antes do DB)
    const nowIso = new Date().toISOString();
    if (entryType === 'coffee_start') setLocalCoffeePauseStart(nowIso);
    if (entryType === 'lunch_start') setLocalLunchPauseStart(nowIso);

    try {
      const serverTime = await repos.timeEntriesRepo.getServerTime();
      let locationAddress: string | null = null;
      let gpsAccuracy: number | null = null;
      let gpsSource: string | null = null;

      if (!isPauseEntry) {
        if (Platform.OS === 'web') {
          try {
            const location = await getCurrentLocationForEntry();
            locationAddress = location.locationAddress;
            gpsAccuracy = location.gpsAccuracy;
            gpsSource = location.gpsSource;
          } catch {
            // Prosseguir sem localização na web
          }
        } else {
          const location = await getCurrentLocationForEntry();
          locationAddress = location.locationAddress;
          gpsAccuracy = location.gpsAccuracy;
          gpsSource = location.gpsSource;
        }
      }

      await repos.timeEntriesRepo.createTimeEntry({
        userId: user.id,
        userName: user.username,
        recordedAt: serverTime,
        entryType,
        locationAddress,
        gpsAccuracy,
        gpsSource,
      });

      // Atualizar o ISO local com o server time real (mais preciso)
      if (entryType === 'coffee_start') setLocalCoffeePauseStart(serverTime);
      if (entryType === 'lunch_start') setLocalLunchPauseStart(serverTime);

      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      setShowPasswordModal(false);
      setPassword('');

      if (entryType === 'coffee_start') {
        schedulePauseNotification('coffee');
      } else if (entryType === 'lunch_start') {
        schedulePauseNotification('lunch');
      }
      if (!isPauseEntry) {
        Alert.alert(t('common.success'), t('point.registered'));
      }
    } catch (err: any) {
      // Rollback: reverter estado local otimista se o DB falhou
      if (entryType === 'coffee_start') setLocalCoffeePauseStart(null);
      if (entryType === 'lunch_start') setLocalLunchPauseStart(null);

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
  }, [user, t, queryClient, schedulePauseNotification]);

  const handleRegisterPress = useCallback(async (entryType: EntryType) => {
    if (!user) return;
    setPendingEntryType(entryType);
    if (Platform.OS === 'web') {
      setShowPasswordModal(true);
      return;
    }
    const ok = await tryBiometricAuth(t('point.biometricPrompt'));
    if (ok) {
      await performRegister(entryType);
      return;
    }
    setShowPasswordModal(true);
  }, [user, t, performRegister]);

  const handlePausePress = useCallback(async (pauseType: 'coffee' | 'lunch') => {
    if (!user) return;
    const startType: EntryType = pauseType === 'coffee' ? 'coffee_start' : 'lunch_start';
    setPendingEntryType(startType);
    if (Platform.OS === 'web') {
      // Na web, exigir senha como nos outros botões
      setShowPasswordModal(true);
      return;
    }
    // Em mobile, tentar biometria primeiro
    const ok = await tryBiometricAuth(t('point.biometricPrompt'));
    if (ok) {
      await performRegister(startType);
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
    await performRegister(pendingEntryType);
  }, [password, t, performRegister, pendingEntryType]);

  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries', 'my'] });
    }, [queryClient])
  );

  /* ─── Render helpers ─── */
  const renderDayCard = (group: DayGroup) => {
    const { clockIn, clockOut, coffeeStart, coffeeEnd, lunchStart, lunchEnd, dateLabel, weekday, isToday, isAutomatic, dateKey } = group;
    const clockInTime = clockIn ? formatTimeUtil(getEffectiveRecordedAt(clockIn)) : '—';
    const clockOutTime = clockOut ? formatTimeUtil(getEffectiveRecordedAt(clockOut)) : '—';

    // Dedução fixa: 15 min se café foi ativado, 45 min se almoço foi ativado
    let dayPauseMs = 0;
    if (coffeeStart) dayPauseMs += COFFEE_DURATION_MS;
    if (lunchStart) dayPauseMs += LUNCH_DURATION_MS;

    // Calcular total (subtraindo pausas)
    let totalLabel = '—';
    if (clockIn && clockOut) {
      const inMs = new Date(getEffectiveRecordedAt(clockIn)).getTime();
      const outMs = new Date(getEffectiveRecordedAt(clockOut)).getTime();
      if (outMs > inMs) totalLabel = formatHourMin(outMs - inMs - dayPauseMs);
    }

    const canAdjustIn = canAdjustEntry(clockIn);
    const canAdjustOut = canAdjustEntry(clockOut);
    const hasAnyAdjust = canAdjustIn || canAdjustOut;

    return (
      <View
        key={dateKey}
        style={[
          styles.dayCard,
          { backgroundColor: colors.cardBackground },
          isToday && { borderLeftWidth: 3, borderLeftColor: colors.primary },
        ]}
      >
        {/* Cabeçalho do dia */}
        <View style={styles.dayCardHeader}>
          <View style={styles.dayDateWrap}>
            <Text style={[styles.dayDateText, { color: colors.text }]}>
              {dateLabel}
            </Text>
            <Text style={[styles.dayWeekday, { color: colors.textTertiary }]}>
              {weekday}
            </Text>
            {isToday && (
              <View style={[styles.todayBadge, { backgroundColor: colors.primary + '20' }]}>
                <Text style={[styles.todayBadgeText, { color: colors.primary }]}>
                  {t('point.today')}
                </Text>
              </View>
            )}
          </View>
          {isAutomatic && (
            <View style={styles.autoBadge}>
              <Ionicons name="flash-outline" size={12} color="#f59e0b" />
              <Text style={styles.autoBadgeText}>{t('point.automatic')}</Text>
            </View>
          )}
        </View>

        {/* Linha: Entrada | Saída | Total */}
        <View style={styles.dayRow}>
          <View style={styles.dayCol}>
            <Text style={[styles.dayColLabel, { color: colors.textTertiary }]}>
              {t('point.clockIn')}
            </Text>
            <View style={styles.dayTimeRow}>
              <Ionicons name="log-in-outline" size={16} color="#22c55e" />
              <Text style={[styles.dayTimeText, { color: colors.text }]}>
                {clockInTime}
              </Text>
              {clockIn?.isAdjusted && (
                <Text style={[styles.adjustedTag, { color: colors.textTertiary }]}>
                  ({t('point.adjusted')})
                </Text>
              )}
            </View>
          </View>

          <View style={[styles.daySep, { backgroundColor: colors.border }]} />

          <View style={styles.dayCol}>
            <Text style={[styles.dayColLabel, { color: colors.textTertiary }]}>
              {t('point.clockOut')}
            </Text>
            <View style={styles.dayTimeRow}>
              <Ionicons name="log-out-outline" size={16} color="#ef4444" />
              <Text style={[styles.dayTimeText, { color: colors.text }]}>
                {clockOutTime}
              </Text>
              {clockOut?.isAdjusted && (
                <Text style={[styles.adjustedTag, { color: colors.textTertiary }]}>
                  ({t('point.adjusted')})
                </Text>
              )}
            </View>
          </View>

          <View style={[styles.daySep, { backgroundColor: colors.border }]} />

          <View style={styles.dayCol}>
            <Text style={[styles.dayColLabel, { color: colors.textTertiary }]}>
              {t('point.totalHours')}
            </Text>
            {isToday && liveTimerStartIso && !clockOut ? (
              <View style={styles.dayTimeRow}>
                <Ionicons name="timer-outline" size={16} color={colors.primary} />
                <Text style={[styles.dayTimeText, { color: colors.primary, fontVariant: ['tabular-nums'] }]}>
                  {liveTimerLabel}
                </Text>
              </View>
            ) : (
              <Text style={[styles.dayTimeText, { color: colors.text }]}>
                {totalLabel}
              </Text>
            )}
          </View>
        </View>

        {/* Info de pausas do dia (fim = início + duração fixa) */}
        {(coffeeStart || lunchStart) && (
          <View style={styles.pauseInfoRow}>
            {coffeeStart && (
              <View style={styles.pauseInfoItem}>
                <Ionicons name="cafe-outline" size={13} color="#92400e" />
                <Text style={[styles.pauseInfoText, { color: colors.textSecondary }]}>
                  {formatTimeUtil(getEffectiveRecordedAt(coffeeStart))}
                  {(coffeeEnd || isToday) ? ` — ${formatTimeUtil(
                    new Date(new Date(getEffectiveRecordedAt(coffeeStart)).getTime() + COFFEE_DURATION_MS).toISOString()
                  )}` : ` — …`}
                </Text>
              </View>
            )}
            {lunchStart && (
              <View style={styles.pauseInfoItem}>
                <Ionicons name="restaurant-outline" size={13} color="#0369a1" />
                <Text style={[styles.pauseInfoText, { color: colors.textSecondary }]}>
                  {formatTimeUtil(getEffectiveRecordedAt(lunchStart))}
                  {(lunchEnd || isToday) ? ` — ${formatTimeUtil(
                    new Date(new Date(getEffectiveRecordedAt(lunchStart)).getTime() + LUNCH_DURATION_MS).toISOString()
                  )}` : ` — …`}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Botões de ajuste */}
        {hasAnyAdjust && (
          <View style={styles.adjustRow}>
            {canAdjustIn && clockIn && (
              <TouchableOpacity
                style={[styles.adjustBtn, { borderColor: '#22c55e' }]}
                onPress={() => openAdjustModal(clockIn, 'clock_in')}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={14} color="#22c55e" />
                <Text style={[styles.adjustBtnText, { color: '#22c55e' }]}>
                  {t('point.adjustClockIn')}
                </Text>
              </TouchableOpacity>
            )}
            {canAdjustOut && clockOut && (
              <TouchableOpacity
                style={[styles.adjustBtn, { borderColor: '#ef4444' }]}
                onPress={() => openAdjustModal(clockOut, 'clock_out')}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={14} color="#ef4444" />
                <Text style={[styles.adjustBtnText, { color: '#ef4444' }]}>
                  {t('point.adjustClockOut')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
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
            onPress={goBack}
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
        {nfcMode && (
          <View style={[styles.nfcBanner, {
            backgroundColor: pendingEntryType === 'clock_out' ? '#ef444415' : '#22c55e15',
          }]}>
            <Ionicons
              name="radio-outline"
              size={20}
              color={pendingEntryType === 'clock_out' ? '#ef4444' : '#22c55e'}
            />
            <Text style={[styles.nfcBannerText, {
              color: pendingEntryType === 'clock_out' ? '#ef4444' : '#22c55e',
            }]}>
              {pendingEntryType === 'clock_out'
                ? `NFC — ${t('point.clockOut')}`
                : `NFC — ${t('point.clockIn')}`}
            </Text>
          </View>
        )}

        {/* Botões: Clock In → Coffee → Lunch → Clock Out */}
        <View style={styles.buttonsRow}>
          {/* 1. Clock In */}
          <TouchableOpacity
            style={[styles.seqButton, { backgroundColor: '#22c55e' }, hasTodayClockIn && styles.seqButtonDone]}
            onPress={() => handleRegisterPress('clock_in')}
            disabled={registering || hasTodayClockIn}
            activeOpacity={0.8}
          >
            {registering && pendingEntryType === 'clock_in' ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={20} color="#fff" />
                <Text style={styles.seqButtonText}>{t('point.clockIn')}</Text>
                <Text style={styles.seqButtonHint}>7:30h</Text>
              </>
            )}
          </TouchableOpacity>

          {/* 2. Coffee Pause / Timer */}
          {coffeeActive ? (
            <View style={[styles.seqButton, styles.seqButtonTimer, { borderColor: '#92400e' }]}>
              <Ionicons name="cafe" size={18} color="#92400e" />
              <Text style={[styles.seqTimerValue, { color: '#92400e' }]}>
                {coffeeCountdown.remaining}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.seqButton,
                { backgroundColor: '#92400e' },
                (!hasTodayClockIn || hasCoffeeToday || hasTodayClockOut || lunchActive) && styles.seqButtonDone,
              ]}
              onPress={() => handlePausePress('coffee')}
              disabled={registering || !hasTodayClockIn || hasCoffeeToday || hasTodayClockOut || !!lunchActive}
              activeOpacity={0.8}
            >
              <Ionicons name="cafe-outline" size={20} color="#fff" />
              <Text style={styles.seqButtonText}>{t('point.coffeePause')}</Text>
              <Text style={styles.seqButtonHint}>9:00h · 15m</Text>
            </TouchableOpacity>
          )}

          {/* 3. Lunch Pause / Timer */}
          {lunchActive ? (
            <View style={[styles.seqButton, styles.seqButtonTimer, { borderColor: '#0369a1' }]}>
              <Ionicons name="restaurant" size={18} color="#0369a1" />
              <Text style={[styles.seqTimerValue, { color: '#0369a1' }]}>
                {lunchCountdown.remaining}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.seqButton,
                { backgroundColor: '#0369a1' },
                (!hasTodayClockIn || hasLunchToday || hasTodayClockOut || coffeeActive) && styles.seqButtonDone,
              ]}
              onPress={() => handlePausePress('lunch')}
              disabled={registering || !hasTodayClockIn || hasLunchToday || hasTodayClockOut || !!coffeeActive}
              activeOpacity={0.8}
            >
              <Ionicons name="restaurant-outline" size={20} color="#fff" />
              <Text style={styles.seqButtonText}>{t('point.lunchPause')}</Text>
              <Text style={styles.seqButtonHint}>12:15h · 45m</Text>
            </TouchableOpacity>
          )}

          {/* 4. Clock Out */}
          <TouchableOpacity
            style={[styles.seqButton, { backgroundColor: '#ef4444' }, hasTodayClockOut && styles.seqButtonDone]}
            onPress={() => handleRegisterPress('clock_out')}
            disabled={registering || hasTodayClockOut}
            activeOpacity={0.8}
          >
            {registering && pendingEntryType === 'clock_out' ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={20} color="#fff" />
                <Text style={styles.seqButtonText}>{t('point.clockOut')}</Text>
                <Text style={styles.seqButtonHint}>17:00h</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Timer ao vivo (sempre visível enquanto jornada ativa) */}
        {liveTimerStartIso && (
          <View style={[
            styles.liveTimerCard,
            anyPauseActive
              ? { backgroundColor: '#f59e0b15', borderColor: '#f59e0b30' }
              : { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' },
          ]}>
            <Ionicons
              name={anyPauseActive ? 'pause-circle-outline' : 'timer-outline'}
              size={22}
              color={anyPauseActive ? '#f59e0b' : colors.primary}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.liveTimerLabel, { color: colors.textSecondary }]}>
                {anyPauseActive ? t('point.timerPaused') : t('point.workInProgress')}
              </Text>
              <Text style={[styles.liveTimerValue, {
                color: anyPauseActive ? '#f59e0b' : colors.primary,
                fontVariant: ['tabular-nums'],
              }]}>
                {liveTimerLabel}
              </Text>
            </View>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {t('point.myEntries')}
        </Text>

        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
        ) : dayGroups.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={40} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('point.noEntries')}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {dayGroups.map(renderDayCard)}
          </View>
        )}
      </ScrollView>

      {/* Modal senha */}
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

      {/* Modal ajuste */}
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
                  {adjustTarget === 'clock_in' ? t('point.adjustClockIn') : t('point.adjustClockOut')}
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
  nfcBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  nfcBannerText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  seqButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: 2,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  seqButtonText: {
    color: '#fff',
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
    textAlign: 'center',
  },
  seqButtonHint: {
    color: '#ffffffa0',
    fontSize: 9,
    fontWeight: theme.typography.fontWeight.medium,
    textAlign: 'center',
    marginTop: 1,
  },
  seqButtonTimer: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    justifyContent: 'center',
  },
  seqTimerValue: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  seqButtonDone: {
    opacity: 0.35,
  },
  /* Timer ao vivo */
  liveTimerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    marginBottom: theme.spacing.lg,
  },
  liveTimerLabel: {
    fontSize: theme.typography.fontSize.xs,
  },
  liveTimerValue: {
    fontSize: theme.typography.fontSize.xl,
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
  /* Day card */
  dayCard: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },
  dayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  dayDateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  dayDateText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
  },
  dayWeekday: {
    fontSize: theme.typography.fontSize.sm,
  },
  todayBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  todayBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  autoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  autoBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    color: '#f59e0b',
    fontWeight: theme.typography.fontWeight.medium,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
  },
  dayColLabel: {
    fontSize: theme.typography.fontSize.xs,
    marginBottom: 4,
  },
  dayTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dayTimeText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  adjustedTag: {
    fontSize: theme.typography.fontSize.xs,
  },
  daySep: {
    width: 1,
    height: 32,
    alignSelf: 'center',
  },
  pauseInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
  },
  pauseInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pauseInfoText: {
    fontSize: theme.typography.fontSize.xs,
  },
  adjustRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  adjustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
  },
  adjustBtnText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.medium,
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
