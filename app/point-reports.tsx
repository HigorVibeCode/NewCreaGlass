import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useI18n } from '../src/hooks/use-i18n';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { useAppTheme } from '../src/hooks/use-app-theme';
import { useAuth } from '../src/store/auth-store';
import { useAllTimeEntriesQuery, useUsersQuery } from '../src/services/queries';
import { Button } from '../src/components/shared/Button';
import { ScreenWrapper } from '../src/components/shared/ScreenWrapper';
import { Dropdown, DropdownOption } from '../src/components/shared/Dropdown';
import { DatePicker } from '../src/components/shared/DatePicker';
import { theme } from '../src/theme';
import { TimeEntry } from '../src/types';
import {
  buildDayRows,
  totalHoursInPeriod,
  buildPointReportHtml,
  getEffectiveRecordedAt,
} from '../src/utils/point-report-pdf';
import { getLogoBase64 } from '../src/utils/logo-base64';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatEmittedAt(): string {
  return new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function PointReportsScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const colors = useThemeColors();
  const { effectiveTheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [exportingPdf, setExportingPdf] = useState(false);

  const isMaster = user?.userType === 'Master';
  const { data: users = [] } = useUsersQuery();
  const fromIso = dateFrom
    ? new Date(dateFrom + 'T00:00:00').toISOString()
    : undefined;
  const toIso = dateTo
    ? new Date(dateTo + 'T23:59:59.999').toISOString()
    : undefined;

  const { data: entries = [], isLoading } = useAllTimeEntriesQuery({
    from: fromIso,
    to: toIso,
    userId: isMaster ? selectedUserId || undefined : undefined,
    enabled: !!user,
  });

  const userOptions: DropdownOption[] = [
    { label: t('point.allUsers'), value: '' },
    ...users.map((u) => ({ label: u.username, value: u.id })),
  ];

  const dayRows = buildDayRows(entries);
  const { label: totalLabel } = totalHoursInPeriod(dayRows);

  const getIdentification = (): string => {
    if (isMaster && selectedUserId) {
      const u = users.find((x) => x.id === selectedUserId);
      return u?.username ?? selectedUserId;
    }
    if (isMaster && !selectedUserId) return t('point.allUsers');
    return user?.username ?? '';
  };

  const handleExportPdf = useCallback(async () => {
    const periodFrom = dateFrom
      ? new Date(dateFrom + 'T00:00:00').toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '—';
    const periodTo = dateTo
      ? new Date(dateTo + 'T00:00:00').toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '—';
    const emittedAt = formatEmittedAt();
    const identification = getIdentification();
    const logoBase64 = await Promise.race([
      getLogoBase64(),
      new Promise<string>((r) => setTimeout(() => r(''), 3000)),
    ]);
    const html = buildPointReportHtml({
      periodFrom,
      periodTo,
      emittedAt,
      identification,
      dayRows,
      totalLabel,
      logoBase64: logoBase64 || undefined,
    });
    setExportingPdf(true);
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank', 'noopener,noreferrer');
        if (printWindow) {
          printWindow.onload = () => {
            setTimeout(() => {
              if (printWindow && !printWindow.closed) {
                printWindow.focus();
                printWindow.print();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }
            }, 500);
          };
          setTimeout(() => {
            if (printWindow && !printWindow.closed) {
              printWindow.focus();
              printWindow.print();
              URL.revokeObjectURL(url);
            }
          }, 1000);
          Alert.alert(t('common.success'), t('point.pdfPrintDialog'));
        } else {
          const { uri } = await Print.printToFileAsync({ html });
          Alert.alert(t('common.success'), `${t('point.pdfSaved')} ${uri}`);
        }
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: t('point.exportPdf'),
          });
        } else {
          Alert.alert(t('common.success'), t('point.pdfSaved'));
        }
      }
    } catch (e) {
      Alert.alert(t('common.error'), t('point.pdfError'));
    } finally {
      setExportingPdf(false);
    }
  }, [entries, dateFrom, dateTo, isMaster, selectedUserId, users, user, dayRows, totalLabel, t]);

  return (
    <ScreenWrapper>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + theme.spacing.md,
            borderBottomWidth: 1,
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
            <View style={[styles.headerIconContainer, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="bar-chart" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {t('point.reportsTitle')}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.filters}>
          <DatePicker
            label={t('point.dateFrom')}
            value={dateFrom}
            onSelect={setDateFrom}
            placeholder={t('point.dateFrom')}
          />
          <DatePicker
            label={t('point.dateTo')}
            value={dateTo}
            onSelect={setDateTo}
            placeholder={t('point.dateTo')}
          />
          {isMaster && (
            <Dropdown
              label={t('point.filterUser')}
              value={selectedUserId}
              options={userOptions}
              onSelect={setSelectedUserId}
            />
          )}
        </View>

        {(entries.length > 0 || dayRows.length > 0) && (
          <Button
            title={t('point.exportPdf')}
            variant="outline"
            onPress={handleExportPdf}
            loading={exportingPdf}
            disabled={exportingPdf}
            style={styles.exportButton}
          />
        )}

        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
        ) : entries.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={40} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('point.noEntriesToShow')}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {entries.map((entry: TimeEntry) => (
              <View
                key={entry.id}
                style={[styles.card, { backgroundColor: colors.cardBackground }]}
              >
                <View style={styles.cardRow}>
                  <Text style={[styles.cardUser, { color: colors.text }]}>{entry.userName}</Text>
                  <Text style={[styles.cardDateTime, { color: colors.primary }]}>
                    {formatDateTime(getEffectiveRecordedAt(entry))}
                    {entry.isAdjusted ? ` (${t('point.adjusted')})` : ''}
                  </Text>
                </View>
                {entry.locationAddress ? (
                  <View style={styles.cardRow}>
                    <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.cardAddress, { color: colors.textSecondary }]} numberOfLines={2}>
                      {entry.locationAddress}
                    </Text>
                  </View>
                ) : null}
                {entry.locationAddress && (
                  <TouchableOpacity
                    style={styles.mapLink}
                    onPress={() => {
                      const q = encodeURIComponent(entry.locationAddress!);
                      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
                    }}
                  >
                    <Ionicons name="map-outline" size={16} color={colors.primary} />
                    <Text style={[styles.mapLinkText, { color: colors.primary }]}>
                      {t('point.openMap')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
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
  scroll: { flex: 1 },
  content: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  filters: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  exportButton: {
    marginBottom: theme.spacing.md,
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
  list: { gap: theme.spacing.sm },
  card: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  cardUser: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.medium,
    flex: 1,
  },
  cardDateTime: {
    fontSize: theme.typography.fontSize.sm,
  },
  cardAddress: {
    fontSize: theme.typography.fontSize.sm,
    flex: 1,
    marginLeft: 20,
    marginBottom: theme.spacing.xs,
  },
  mapLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  mapLinkText: {
    fontSize: theme.typography.fontSize.sm,
  },
});
