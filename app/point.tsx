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
  Pressable,
  Platform,
  KeyboardAvoidingView,
  useWindowDimensions,
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
import { DayAdjustTimeInput } from '../src/components/shared/DayAdjustTimeInput';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { getEffectiveRecordedAt } from '../src/utils/point-report-pdf';
import {
  toSwissDateKeyFromDate,
  toDateKey,
  isWeekend,
  pendingWeekdayKeys,
  weekdayShort,
  getDayStatus,
  hasCompletedDayAdjustment,
  timesFromDayEntries,
  validateDayAdjustTimes,
  computeNetWorkMs,
  DEFAULT_DAY_TIMES,
  DayAdjustTimes,
  DayStatus,
} from '../src/utils/point-day';
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
  dateKey: string;
  dateLabel: string;
  weekday: string;
  clockIn: TimeEntry | null;
  clockOut: TimeEntry | null;
  coffeeStart: TimeEntry | null;
  coffeeEnd: TimeEntry | null;
  lunchStart: TimeEntry | null;
  lunchEnd: TimeEntry | null;
  isToday: boolean;
  isAutomatic: boolean;
  status: DayStatus;
  hasDayAdjustment: boolean;
}

interface MonthGroup {
  monthKey: string;           // YYYY-MM
  monthLabel: string;         // "Abril 2026"
  totalWorkedMs: number;
  days: DayGroup[];
}

function formatHourMin(totalMs: number): string {
  if (!Number.isFinite(totalMs) || totalMs < 0) return '00:00';
  const totalMin = Math.floor(totalMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatMonthLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateKey.slice(0, 7);
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(d);
}

function getDayWorkedMs(group: DayGroup): number {
  if (!group.clockIn || !group.clockOut) return 0;
  const inMs = new Date(getEffectiveRecordedAt(group.clockIn)).getTime();
  const outMs = new Date(getEffectiveRecordedAt(group.clockOut)).getTime();
  if (!Number.isFinite(inMs) || !Number.isFinite(outMs) || outMs <= inMs) return 0;

  let pauseMs = 0;
  if (group.coffeeStart) pauseMs += COFFEE_DURATION_MS;
  if (group.lunchStart) pauseMs += LUNCH_DURATION_MS;

  return Math.max(0, outMs - inMs - pauseMs);
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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const adjustModalWidth = Math.min(480, windowWidth - theme.spacing.lg * 2);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const goBack = useGoBack();
  const nfcHandledRef = useRef(false);

  const { data: entries = [], isLoading } = useMyTimeEntriesQuery(user?.id);
  const [registering, setRegistering] = useState(false);
  const [pendingEntryType, setPendingEntryType] = useState<EntryType>('clock_in');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustDayGroup, setAdjustDayGroup] = useState<DayGroup | null>(null);
  const [adjustTimes, setAdjustTimes] = useState<DayAdjustTimes>(DEFAULT_DAY_TIMES);
  const [adjustDescription, setAdjustDescription] = useState('');
  const [savingAdjust, setSavingAdjust] = useState(false);
  const [nfcMode, setNfcMode] = useState(false);
  // Estado local para ativar o timer do botão imediatamente (sem esperar refetch)
  const [localCoffeePauseStart, setLocalCoffeePauseStart] = useState<string | null>(null);
  const [localLunchPauseStart, setLocalLunchPauseStart] = useState<string | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  /* ─── Agrupar entries por dia ─── */
  const todayKey = toSwissDateKeyFromDate(new Date());

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
      const dayEntries = [g.clockIn, g.clockOut, g.coffeeStart, g.coffeeEnd, g.lunchStart, g.lunchEnd];
      const isAutomatic =
        !!g.clockIn &&
        (g.clockIn.locationAddress === 'Automático') &&
        (!g.clockOut || g.clockOut.locationAddress === 'Automático');
      const dayHasAdjustment = hasCompletedDayAdjustment(dayEntries);
      result.push({
        dateKey: dk,
        dateLabel: formatDateUtil(refIso || dk),
        weekday: weekdayShort(dk),
        clockIn: g.clockIn,
        clockOut: g.clockOut,
        coffeeStart: g.coffeeStart,
        coffeeEnd: g.coffeeEnd,
        lunchStart: g.lunchStart,
        lunchEnd: g.lunchEnd,
        isToday: dk === todayKey,
        isAutomatic,
        hasDayAdjustment: dayHasAdjustment,
        status: getDayStatus(dk, g.clockIn, dayEntries, isAutomatic),
      });
    }

    for (const dk of pendingWeekdayKeys(result, todayKey)) {
      result.push({
        dateKey: dk,
        dateLabel: formatDateUtil(`${dk}T12:00:00`),
        weekday: weekdayShort(dk),
        clockIn: null,
        clockOut: null,
        coffeeStart: null,
        coffeeEnd: null,
        lunchStart: null,
        lunchEnd: null,
        isToday: dk === todayKey,
        isAutomatic: false,
        hasDayAdjustment: false,
        status: 'pending',
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

  const monthGroups: MonthGroup[] = useMemo(() => {
    const map = new Map<string, MonthGroup>();

    for (const group of dayGroups) {
      const monthKey = group.dateKey.slice(0, 7);
      if (!map.has(monthKey)) {
        map.set(monthKey, {
          monthKey,
          monthLabel: formatMonthLabel(group.dateKey),
          totalWorkedMs: 0,
          days: [],
        });
      }

      const monthGroup = map.get(monthKey)!;
      monthGroup.days.push(group);
      monthGroup.totalWorkedMs += getDayWorkedMs(group);
    }

    return Array.from(map.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [dayGroups]);

  const toggleMonthExpansion = useCallback((monthKey: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) {
        next.delete(monthKey);
      } else {
        next.add(monthKey);
      }
      return next;
    });
  }, []);

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

  const todayWorkedLabel = useMemo(() => {
    if (hasTodayClockIn && hasTodayClockOut && todayGroup?.clockIn && todayGroup?.clockOut) {
      const inMs = new Date(getEffectiveRecordedAt(todayGroup.clockIn)).getTime();
      const outMs = new Date(getEffectiveRecordedAt(todayGroup.clockOut)).getTime();
      if (Number.isFinite(inMs) && Number.isFinite(outMs) && outMs > inMs) {
        return formatHourMin(outMs - inMs - todayPauseMs);
      }
    }
    if (liveTimerStartIso) {
      return liveTimerLabel;
    }
    return '00:00:00';
  }, [
    hasTodayClockIn,
    hasTodayClockOut,
    todayGroup?.clockIn,
    todayGroup?.clockOut,
    todayPauseMs,
    liveTimerStartIso,
    liveTimerLabel,
  ]);

  const workStatusIcon = hasTodayClockOut
    ? 'stop-circle-outline'
    : anyPauseActive
      ? 'pause-circle-outline'
      : liveTimerStartIso
        ? 'play-circle-outline'
        : 'time-outline';

  const workStatusColor = hasTodayClockOut
    ? '#ef4444'
    : anyPauseActive
      ? '#f59e0b'
      : liveTimerStartIso
        ? '#22c55e'
        : colors.textSecondary;

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

  const buildAdjustTimesFromGroup = useCallback((group: DayGroup): DayAdjustTimes => {
    return timesFromDayEntries(
      group.clockIn,
      group.clockOut,
      group.coffeeStart,
      group.coffeeEnd,
      group.lunchStart,
      group.lunchEnd
    );
  }, []);

  const openDayAdjustModal = useCallback((group: DayGroup) => {
    const initialTimes = buildAdjustTimesFromGroup(group);
    setAdjustDayGroup(group);
    setAdjustTimes({ ...initialTimes });
    setAdjustDescription('');
    setShowAdjustModal(true);
  }, [buildAdjustTimesFromGroup]);

  const closeDayAdjustModal = useCallback(() => {
    setShowAdjustModal(false);
    setAdjustDayGroup(null);
    setAdjustDescription('');
    setAdjustTimes(DEFAULT_DAY_TIMES);
  }, []);

  const setAdjustTimeField = useCallback((field: keyof DayAdjustTimes, time: string) => {
    setAdjustTimes((prev) => ({ ...prev, [field]: time }));
  }, []);

  const adjustNetWorkLabel = useMemo(() => {
    const ms = computeNetWorkMs(adjustTimes);
    if (!Number.isFinite(ms) || ms <= 0) return '—';
    return formatHourMin(ms);
  }, [adjustTimes]);

  const handleSaveDayAdjust = useCallback(async () => {
    if (!adjustDayGroup || !user) return;
    const desc = adjustDescription.trim();
    if (!desc) {
      Alert.alert(t('common.error'), t('point.adjustDescriptionRequired'));
      return;
    }
    if (desc.length > 20) {
      Alert.alert(t('common.error'), t('point.adjustDescriptionMaxLength'));
      return;
    }
    const validation = validateDayAdjustTimes(adjustTimes);
    if (!validation.valid) {
      const msg =
        validation.error === 'clockOutBeforeIn'
          ? t('point.workDurationClockOutBeforeIn')
          : validation.error === 'coffeeInvalid'
            ? t('point.workDurationCoffeeInvalid')
            : validation.error === 'lunchInvalid'
              ? t('point.workDurationLunchInvalid')
              : validation.error === 'workDurationZero'
                ? t('point.workDurationZero')
                : t('point.workDurationInvalid');
      Alert.alert(t('common.error'), msg);
      return;
    }
    setSavingAdjust(true);
    try {
      await repos.timeEntriesRepo.saveDayTimeAdjustment({
        userId: user.id,
        userName: user.username,
        dateKey: adjustDayGroup.dateKey,
        adjustDescription: desc,
        times: adjustTimes,
        existingEntries: entries,
      });
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      closeDayAdjustModal();
      Alert.alert(t('common.success'), t('point.adjustSuccess'));
    } catch (err: any) {
      const msg =
        err?.message === 'DAY_ALREADY_ADJUSTED'
          ? t('point.dayAlreadyAdjusted')
          : err?.message || t('common.error');
      Alert.alert(t('common.error'), msg);
    } finally {
      setSavingAdjust(false);
    }
  }, [adjustDayGroup, adjustTimes, adjustDescription, user, entries, t, queryClient, closeDayAdjustModal]);

  const renderDayStatusBadge = (status: DayStatus) => {
    if (status === 'none') return null;
    if (status === 'automatic') {
      return (
        <View style={[styles.statusBadge, { backgroundColor: '#22c55e18' }]}>
          <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
          <Text style={[styles.statusBadgeText, { color: '#22c55e' }]}>
            {t('point.statusAutomatic')}
          </Text>
        </View>
      );
    }
    if (status === 'adjusted') {
      return (
        <View style={[styles.statusBadge, { backgroundColor: '#6366f118' }]}>
          <Ionicons name="create-outline" size={14} color="#6366f1" />
          <Text style={[styles.statusBadgeText, { color: '#6366f1' }]}>
            {t('point.statusAdjusted')}
          </Text>
        </View>
      );
    }
    return (
      <View style={[styles.statusBadge, { backgroundColor: '#f59e0b18' }]}>
        <Ionicons name="alert-circle-outline" size={14} color="#f59e0b" />
        <Text style={[styles.statusBadgeText, { color: '#f59e0b' }]}>
          {t('point.statusPending')}
        </Text>
      </View>
    );
  };

  /* ─── Agendar notificação local para fim de pausa ─── */
  const schedulePauseNotification = useCallback(async (pauseType: 'coffee' | 'lunch') => {
    if (Platform.OS === 'web' || !Notifications) return;
    const durationMs = pauseType === 'coffee' ? COFFEE_DURATION_MS : LUNCH_DURATION_MS;
    const triggerMs = durationMs - WARN_BEFORE_MS; // 12min (café) ou 42min (almoço)
    const title = pauseType === 'coffee' ? t('point.coffeeEndingSoon') : t('point.lunchEndingSoon');
    const endTime = formatTimeUtil(new Date(Date.now() + durationMs).toISOString());
    const body = `${t('point.pauseEndingIn3Min')} (${endTime})`;
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
  const renderDayTimeSlot = (
    icon: React.ComponentProps<typeof Ionicons>['name'],
    iconColor: string,
    label: string,
    time: string,
    highlight?: boolean
  ) => (
    <View style={styles.dayTimeSlot}>
      <Text style={[styles.dayColLabel, { color: colors.textTertiary }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.dayTimeValueRow}>
        <Ionicons name={icon} size={15} color={iconColor} style={styles.dayTimeIcon} />
        <Text
          style={[
            styles.dayTimeText,
            {
              color: highlight ? colors.primary : colors.text,
              fontVariant: ['tabular-nums'],
            },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {time}
        </Text>
      </View>
    </View>
  );

  const renderDayCard = (group: DayGroup) => {
    const {
      clockIn, clockOut, coffeeStart, coffeeEnd, lunchStart, lunchEnd,
      dateLabel, weekday, isToday, dateKey, status, hasDayAdjustment: dayAdjusted,
    } = group;
    const clockInTime = clockIn ? formatTimeUtil(getEffectiveRecordedAt(clockIn)) : '—';
    const clockOutTime = clockOut ? formatTimeUtil(getEffectiveRecordedAt(clockOut)) : '—';

    // Dedução fixa: 15 min se café foi ativado, 45 min se almoço foi ativado
    let dayPauseMs = 0;
    if (coffeeStart) dayPauseMs += COFFEE_DURATION_MS;
    if (lunchStart) dayPauseMs += LUNCH_DURATION_MS;

    let totalLabel = '—';
    if (clockIn && clockOut) {
      const inMs = new Date(getEffectiveRecordedAt(clockIn)).getTime();
      const outMs = new Date(getEffectiveRecordedAt(clockOut)).getTime();
      if (outMs > inMs) totalLabel = formatHourMin(outMs - inMs - dayPauseMs);
    }

    const totalDisplay =
      isToday && liveTimerStartIso && !clockOut ? liveTimerLabel : totalLabel;

    return (
      <View
        key={dateKey}
        style={[
          styles.dayCard,
          { backgroundColor: colors.cardBackground },
          isToday && { borderLeftWidth: 3, borderLeftColor: colors.primary },
        ]}
      >
        <View style={styles.dayCardHeader}>
          <View style={styles.dayHeaderMain}>
            <Text style={[styles.dayDateText, { color: colors.text }]} numberOfLines={1}>
              {dateLabel}
            </Text>
            <Text style={[styles.dayWeekday, { color: colors.textTertiary }]}>
              {weekday}
            </Text>
          </View>
          <View style={styles.dayHeaderBadges}>
            {isToday && (
              <View style={[styles.todayBadge, { backgroundColor: colors.primary + '20' }]}>
                <Text style={[styles.todayBadgeText, { color: colors.primary }]}>
                  {t('point.today')}
                </Text>
              </View>
            )}
            {renderDayStatusBadge(status)}
          </View>
        </View>

        <View style={[styles.dayTimesGrid, { borderColor: colors.border }]}>
          {renderDayTimeSlot('log-in-outline', '#22c55e', t('point.clockIn'), clockInTime)}
          {renderDayTimeSlot('log-out-outline', '#ef4444', t('point.clockOut'), clockOutTime)}
          {renderDayTimeSlot(
            'timer-outline',
            colors.primary,
            t('point.totalHours'),
            totalDisplay,
            !!(isToday && liveTimerStartIso && !clockOut)
          )}
        </View>

        {(coffeeStart || lunchStart) && (
          <View style={[styles.pauseInfoRow, { borderTopColor: colors.border }]}>
            {coffeeStart && (
              <View style={styles.pauseInfoItem}>
                <Ionicons name="cafe-outline" size={13} color="#92400e" />
                <Text
                  style={[styles.pauseInfoText, { color: colors.textSecondary }]}
                  numberOfLines={2}
                >
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
                <Text
                  style={[styles.pauseInfoText, { color: colors.textSecondary }]}
                  numberOfLines={2}
                >
                  {formatTimeUtil(getEffectiveRecordedAt(lunchStart))}
                  {(lunchEnd || isToday) ? ` — ${formatTimeUtil(
                    new Date(new Date(getEffectiveRecordedAt(lunchStart)).getTime() + LUNCH_DURATION_MS).toISOString()
                  )}` : ` — …`}
                </Text>
              </View>
            )}
          </View>
        )}

        {!isWeekend(dateKey) && (
          <View style={[styles.adjustRow, { borderTopColor: colors.border }]}>
            {dayAdjusted ? (
              <View style={[styles.adjustDoneHint, { backgroundColor: colors.backgroundSecondary }]}>
                <Ionicons name="lock-closed-outline" size={14} color={colors.textTertiary} />
                <Text
                  style={[styles.adjustDoneHintText, { color: colors.textTertiary }]}
                  numberOfLines={2}
                >
                  {t('point.dayAlreadyAdjusted')}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.adjustBtn, { borderColor: colors.primary }]}
                onPress={() => openDayAdjustModal(group)}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={14} color={colors.primary} />
                <Text style={[styles.adjustBtnText, { color: colors.primary }]}>
                  {t('point.adjust')}
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
          <View style={[styles.userTimerBadge, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <Text style={[styles.userTimerName, { color: colors.text }]} numberOfLines={1}>
              {user?.username || '-'}
            </Text>
            <View style={styles.userTimerStatusRow}>
              <Ionicons name={workStatusIcon as any} size={14} color={workStatusColor} />
              <Text style={[styles.userTimerValue, { color: workStatusColor }]}>
                {todayWorkedLabel}
              </Text>
            </View>
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
            {monthGroups.map((month) => (
              <View key={month.monthKey} style={styles.monthSection}>
                <TouchableOpacity
                  style={[styles.monthHeader, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                  onPress={() => toggleMonthExpansion(month.monthKey)}
                  activeOpacity={0.7}
                >
                  <View style={styles.monthHeaderLeft}>
                    <Ionicons
                      name={expandedMonths.has(month.monthKey) ? 'chevron-down' : 'chevron-forward'}
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.monthTitle, { color: colors.text }]}>
                      {month.monthLabel}
                    </Text>
                  </View>
                  <Text
                    style={[styles.monthTotal, { color: colors.primary }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {t('point.totalHours')}: {formatHourMin(month.totalWorkedMs)}
                  </Text>
                </TouchableOpacity>
                {expandedMonths.has(month.monthKey) && (
                  <View style={styles.monthDaysList}>
                    {month.days.map(renderDayCard)}
                  </View>
                )}
              </View>
            ))}
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

      {/* Modal ajuste do dia */}
      <Modal
        visible={showAdjustModal}
        transparent
        animationType="fade"
        onRequestClose={closeDayAdjustModal}
      >
        <KeyboardAvoidingView
          style={styles.modalKeyboardRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top}
        >
          <View
            style={[
              styles.modalOverlay,
              {
                backgroundColor: colors.overlay,
                paddingTop: insets.top + theme.spacing.sm,
                paddingBottom: insets.bottom + theme.spacing.sm,
              },
            ]}
            pointerEvents="box-none"
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={closeDayAdjustModal}
              accessibilityRole="button"
            />
            <View
              style={[
                styles.modalBoxAdjust,
                styles.modalBoxElevated,
                {
                  backgroundColor: colors.background,
                  width: adjustModalWidth,
                  maxHeight: windowHeight * 0.88,
                },
              ]}
              pointerEvents="auto"
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.adjustModalScrollContent}
              >
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {t('point.adjustDayTitle')}
                </Text>
                {adjustDayGroup && (
                  <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                    {adjustDayGroup.dateLabel}
                  </Text>
                )}
                <View style={[styles.adjustTableHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.adjustTableColNum, styles.adjustTableHeaderText, { color: colors.textTertiary }]}>
                    #
                  </Text>
                  <Text style={[styles.adjustTableColLabel, styles.adjustTableHeaderText, { color: colors.textTertiary }]}>
                    {t('point.adjustColType')}
                  </Text>
                  <Text style={[styles.adjustTableColTime, styles.adjustTableHeaderText, { color: colors.textTertiary }]}>
                    {t('point.adjustColStart')}
                  </Text>
                  <Text style={[styles.adjustTableColTime, styles.adjustTableHeaderText, styles.adjustTableHeaderEnd, { color: colors.textTertiary }]}>
                    {t('point.adjustColEnd')}
                  </Text>
                </View>
                {([
                  { key: 'workday' as const, label: t('point.rowWorkday'), startKey: 'clockIn' as const, endKey: 'clockOut' as const },
                  { key: 'coffee' as const, label: t('point.rowCoffee'), startKey: 'coffeeStart' as const, endKey: 'coffeeEnd' as const },
                  { key: 'lunch' as const, label: t('point.rowLunch'), startKey: 'lunchStart' as const, endKey: 'lunchEnd' as const },
                ]).map((row, index) => (
                  <View key={row.key} style={[styles.adjustTableRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.adjustTableColNum, styles.adjustTableRowNum, { color: colors.textTertiary }]}>
                      {index + 1}
                    </Text>
                    <Text style={[styles.adjustTableColLabel, styles.adjustTableRowLabel, { color: colors.text }]} numberOfLines={1}>
                      {row.label}
                    </Text>
                    <View style={styles.adjustTableColTime}>
                      <DayAdjustTimeInput
                        fieldKey={`${adjustDayGroup?.dateKey ?? 'day'}-${row.startKey}`}
                        value={adjustTimes[row.startKey]}
                        onChange={(v) => setAdjustTimeField(row.startKey, v)}
                      />
                    </View>
                    <View style={styles.adjustTableColTime}>
                      <DayAdjustTimeInput
                        fieldKey={`${adjustDayGroup?.dateKey ?? 'day'}-${row.endKey}`}
                        value={adjustTimes[row.endKey]}
                        onChange={(v) => setAdjustTimeField(row.endKey, v)}
                      />
                    </View>
                  </View>
                ))}
                <View style={[styles.workDurationRow, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                  <Text style={[styles.workDurationHint, { color: colors.textSecondary }]}>
                    {t('point.workDurationHint')}
                  </Text>
                  <Text style={[styles.workDurationValue, { color: colors.primary }]}>
                    {adjustNetWorkLabel}
                  </Text>
                </View>
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
                    onPress={closeDayAdjustModal}
                    style={styles.modalButton}
                  />
                  <Button
                    title={t('point.saveAdjust')}
                    onPress={handleSaveDayAdjust}
                    loading={savingAdjust}
                    disabled={!adjustDescription.trim()}
                    style={styles.modalButton}
                  />
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  userTimerBadge: {
    marginLeft: theme.spacing.xs,
    marginRight: theme.spacing.xs,
    borderWidth: 1,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    minWidth: 108,
    maxWidth: 148,
  },
  userTimerName: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  userTimerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  userTimerValue: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
    fontVariant: ['tabular-nums'],
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
  monthSection: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  monthHeader: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.xs,
  },
  monthHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    flexShrink: 1,
    minWidth: 0,
  },
  monthTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
    textTransform: 'capitalize',
    flexShrink: 1,
  },
  monthTotal: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    flexShrink: 0,
    maxWidth: '100%',
  },
  monthDaysList: {
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
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  dayHeaderMain: {
    flexShrink: 1,
    minWidth: 0,
  },
  dayHeaderBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing.xs,
    flexShrink: 0,
  },
  dayDateText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
  },
  dayWeekday: {
    fontSize: theme.typography.fontSize.sm,
    marginTop: 2,
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
  },
  statusBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  dayTimesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dayTimeSlot: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    maxWidth: '100%',
    paddingVertical: theme.spacing.xs,
  },
  dayColLabel: {
    fontSize: theme.typography.fontSize.xs,
    marginBottom: 4,
  },
  dayTimeValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  dayTimeIcon: {
    flexShrink: 0,
  },
  dayTimeText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    flexShrink: 1,
    minWidth: 0,
  },
  pauseInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pauseInfoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 140,
  },
  pauseInfoText: {
    fontSize: theme.typography.fontSize.xs,
  },
  adjustRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
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
  adjustDoneHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    flex: 1,
    maxWidth: '100%',
  },
  adjustDoneHintText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.medium,
  },
  modalKeyboardRoot: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  modalBox: {
    width: '100%',
    maxWidth: 340,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.lg,
  },
  modalBoxElevated: {
    zIndex: 1,
  },
  modalBoxAdjust: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.lg,
  },
  adjustModalScrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  modalTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.xs,
  },
  modalSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    marginBottom: theme.spacing.md,
  },
  adjustTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    borderBottomWidth: 1,
    gap: theme.spacing.xs,
  },
  adjustTableHeaderText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  adjustTableHeaderEnd: {
    textAlign: 'right',
  },
  adjustTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: theme.spacing.xs,
  },
  adjustTableColNum: {
    width: 22,
    flexShrink: 0,
  },
  adjustTableColLabel: {
    width: 58,
    flexShrink: 0,
  },
  adjustTableColTime: {
    flex: 1,
    minWidth: 0,
  },
  adjustTableRowNum: {
    fontSize: theme.typography.fontSize.xs,
    textAlign: 'center',
  },
  adjustTableRowLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  workDurationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
  },
  workDurationHint: {
    fontSize: theme.typography.fontSize.xs,
    flex: 1,
    flexShrink: 1,
  },
  workDurationValue: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.bold,
    fontVariant: ['tabular-nums'],
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
