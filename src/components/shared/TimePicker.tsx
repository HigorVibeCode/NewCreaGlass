import React, { useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { theme } from '../../theme';
import { useThemeColors } from '../../hooks/use-theme-colors';
import { useI18n } from '../../hooks/use-i18n';

interface TimePickerProps {
  label: string;
  value: string;
  onSelect: (time: string) => void;
  placeholder?: string;
  compact?: boolean;
  /** Identificador estável (ex.: tabela de ajuste) — evita remount do input web */
  pickerKey?: string;
}

function parseTimeToDate(timeString: string): Date {
  const now = new Date();
  if (!timeString || !/^\d{1,2}:\d{2}$/.test(timeString)) return now;
  const [h, m] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(h ?? 0, m ?? 0, 0, 0);
  return date;
}

function formatTimeFromDate(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export const TimePicker: React.FC<TimePickerProps> = ({
  label,
  value,
  onSelect,
  placeholder,
  compact,
  pickerKey,
}) => {
  const { t } = useI18n();
  const colors = useThemeColors();
  const [showIosPicker, setShowIosPicker] = useState(false);
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const displayValue = /^\d{2}:\d{2}$/.test(value) ? value : '';
  const currentTime = parseTimeToDate(displayValue || value);

  const applySelectedTime = useCallback((date: Date) => {
    onSelectRef.current(formatTimeFromDate(date));
  }, []);

  const handlePickerChange = useCallback((event: DateTimePickerEvent, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowAndroidPicker(false);
    } else {
      setShowIosPicker(false);
    }

    if (event.type === 'dismissed' || !selectedTime) {
      return;
    }

    applySelectedTime(selectedTime);
  }, [applySelectedTime]);

  const handleWebTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedTime = e.target.value;
    if (selectedTime) {
      onSelectRef.current(selectedTime);
    }
  };

  const normalizeTimeForWeb = (timeValue: string): string => {
    if (/^\d{2}:\d{2}$/.test(timeValue)) return timeValue;
    return '';
  };

  const openPicker = () => {
    if (Platform.OS === 'android') {
      setShowAndroidPicker(true);
    } else if (Platform.OS === 'ios') {
      setShowIosPicker(true);
    }
  };

  const formatDisplayTime = (timeString: string): string => {
    if (/^\d{2}:\d{2}$/.test(timeString)) return timeString;
    return placeholder || t('common.select');
  };

  if (Platform.OS === 'web') {
    const normalizedValue = normalizeTimeForWeb(displayValue);

    return (
      <View
        key={pickerKey}
        style={[styles.container, compact && styles.containerCompact]}
      >
        {!compact && label ? (
          <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
        ) : null}
        <View
          style={[
            styles.timePicker,
            compact && styles.timePickerCompact,
            { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
          ]}
        >
          <View style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            {React.createElement('input', {
              type: 'time',
              value: normalizedValue,
              onChange: handleWebTimeChange,
              onClick: (e: React.MouseEvent) => e.stopPropagation(),
              onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
              placeholder: placeholder || t('common.select'),
              style: {
                flex: 1,
                fontSize: `${compact ? theme.typography.fontSize.sm : theme.typography.fontSize.md}px`,
                fontFamily:
                  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                fontWeight: theme.typography.fontWeight.regular,
                color: normalizedValue ? colors.text : colors.textTertiary,
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                padding: '0px',
                margin: '0px',
                cursor: 'pointer',
                width: '100%',
                minHeight: '20px',
                lineHeight: '20px',
              } as React.CSSProperties,
            })}
          </View>
          <Ionicons
            name="time-outline"
            size={20}
            color={colors.textSecondary}
            style={{ marginLeft: theme.spacing.xs, flexShrink: 0 }}
          />
        </View>
      </View>
    );
  }

  return (
    <View
      key={pickerKey}
      style={[styles.container, compact && styles.containerCompact]}
    >
      {!compact && label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      ) : null}
      <TouchableOpacity
        style={[
          styles.timePicker,
          compact && styles.timePickerCompact,
          { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
        ]}
        onPress={openPicker}
        activeOpacity={0.7}
      >
        <Text
          style={[
            compact ? styles.selectedTextCompact : styles.selectedText,
            { color: displayValue ? colors.text : colors.textTertiary },
          ]}
        >
          {formatDisplayTime(displayValue || value)}
        </Text>
        <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      {Platform.OS === 'android' && showAndroidPicker && (
        <DateTimePicker
          value={currentTime}
          mode="time"
          is24Hour
          display="default"
          onChange={handlePickerChange}
        />
      )}

      {Platform.OS === 'ios' && showIosPicker && (
        <DateTimePicker
          value={currentTime}
          mode="time"
          display="spinner"
          onChange={handlePickerChange}
          style={compact ? styles.iosPickerCompact : styles.iosPicker}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  containerCompact: {
    marginBottom: 0,
    flex: 1,
    width: '100%',
    minWidth: 0,
  },
  timePickerCompact: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    minHeight: 40,
    width: '100%',
  },
  label: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    marginBottom: theme.spacing.xs,
  },
  timePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
  },
  selectedText: {
    fontSize: theme.typography.fontSize.md,
    flex: 1,
  },
  selectedTextCompact: {
    fontSize: theme.typography.fontSize.sm,
    flex: 1,
    fontVariant: ['tabular-nums'],
  },
  iosPicker: {
    width: '100%',
    height: 200,
  },
  iosPickerCompact: {
    width: '100%',
    height: 140,
  },
});
