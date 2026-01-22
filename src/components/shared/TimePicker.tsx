import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { theme } from '../../theme';
import { useThemeColors } from '../../hooks/use-theme-colors';
import { useI18n } from '../../hooks/use-i18n';

interface TimePickerProps {
  label: string;
  value: string;
  onSelect: (time: string) => void;
  placeholder?: string;
}

export const TimePicker: React.FC<TimePickerProps> = ({ label, value, onSelect, placeholder }) => {
  const { t } = useI18n();
  const colors = useThemeColors();
  const [showPicker, setShowPicker] = useState(false);

  const parseTime = (timeString: string): Date => {
    const now = new Date();
    if (!timeString) return now;
    
    const parts = timeString.split(':');
    if (parts.length === 2) {
      const hours = parseInt(parts[0] || '0', 10);
      const minutes = parseInt(parts[1] || '0', 10);
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      return date;
    }
    
    return now;
  };

  const formatTime = (date: Date): string => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const formatDisplayTime = (timeString: string): string => {
    if (!timeString) return placeholder || t('common.select');
    return timeString;
  };

  const currentTime = parseTime(value);

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.dismiss('time');
    } else {
      setShowPicker(false);
    }

    if (event.type === 'set' && selectedTime) {
      onSelect(formatTime(selectedTime));
    }
  };

  const handleWebTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedTime = e.target.value;
    if (selectedTime) {
      onSelect(selectedTime);
    }
  };

  // Normalizar valor para formato HH:MM esperado pelo input HTML
  const normalizeTimeForWeb = (timeValue: string): string => {
    if (!timeValue) return '';
    
    // Se já está no formato HH:MM, retornar como está
    if (/^\d{2}:\d{2}$/.test(timeValue)) {
      return timeValue;
    }
    
    // Tentar parsear e formatar
    try {
      const parts = timeValue.split(':');
      if (parts.length >= 2) {
        const hours = parseInt(parts[0] || '0', 10);
        const minutes = parseInt(parts[1] || '0', 10);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      }
    } catch {
      // Se falhar, retornar vazio
    }
    
    return '';
  };

  const showTimePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: currentTime,
        mode: 'time',
        is24Hour: true,
        onChange: handleTimeChange,
        display: 'default', // Opens spinner/wheel picker
      });
    } else if (Platform.OS === 'ios') {
      // iOS - show inline picker
      setShowPicker(true);
    }
    // Web: input type="time" já mostra o seletor nativamente
  };

  // Web: usar input HTML nativo
  if (Platform.OS === 'web') {
    const normalizedValue = normalizeTimeForWeb(value);
    
    return (
      <View style={styles.container}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
        <View style={[styles.timePicker, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <View style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            {React.createElement('input', {
              type: 'time',
              value: normalizedValue,
              onChange: handleWebTimeChange,
              placeholder: placeholder || t('common.select'),
              style: {
                flex: 1,
                fontSize: `${theme.typography.fontSize.md}px`,
                fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
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
                letterSpacing: 'normal',
              } as React.CSSProperties,
            })}
          </View>
          <Ionicons name="time-outline" size={20} color={colors.textSecondary} style={{ marginLeft: theme.spacing.xs, flexShrink: 0 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TouchableOpacity
        style={[styles.timePicker, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
        onPress={showTimePicker}
        activeOpacity={0.7}
      >
        <Text style={[styles.selectedText, { color: value ? colors.text : colors.textTertiary }]}>
          {formatDisplayTime(value)}
        </Text>
        <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      {Platform.OS === 'ios' && showPicker && (
        <DateTimePicker
          value={currentTime}
          mode="time"
          display="spinner" // iOS shows wheel/spinner picker
          onChange={handleTimeChange}
          style={styles.iosPicker}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
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
  iosPicker: {
    width: '100%',
    height: 200,
  },
});
