import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { theme } from '../../theme';
import { useThemeColors } from '../../hooks/use-theme-colors';
import { useI18n } from '../../hooks/use-i18n';

interface DatePickerProps {
  label: string;
  value: string;
  onSelect: (date: string) => void;
  placeholder?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({ label, value, onSelect, placeholder }) => {
  const { t } = useI18n();
  const colors = useThemeColors();
  const [showPicker, setShowPicker] = useState(false);

  const parseDate = (dateString: string): Date => {
    if (!dateString) return new Date();
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? new Date() : date;
  };

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDisplayDate = (dateString: string): string => {
    if (!dateString) return placeholder || t('common.select');
    return formatDate(parseDate(dateString));
  };

  const currentDate = parseDate(value);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.dismiss('date');
    } else {
      setShowPicker(false);
    }

    if (event.type === 'set' && selectedDate) {
      onSelect(formatDate(selectedDate));
    }
  };

  const handleWebDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDate = e.target.value;
    if (selectedDate) {
      onSelect(selectedDate);
    }
  };

  // Normalizar valor para formato YYYY-MM-DD esperado pelo input HTML
  const normalizeDateForWeb = (dateValue: string): string => {
    if (!dateValue) return '';
    
    // Se já está no formato YYYY-MM-DD, retornar como está
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }
    
    // Tentar parsear como Date e formatar
    try {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return formatDate(date);
      }
    } catch {
      // Se falhar, retornar vazio
    }
    
    return '';
  };

  const showDatePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: currentDate,
        mode: 'date',
        onChange: handleDateChange,
        display: 'default', // Opens calendar dialog
      });
    } else if (Platform.OS === 'ios') {
      // iOS - show inline picker
      setShowPicker(true);
    }
    // Web: input type="date" já mostra o calendário nativamente
  };

  // Web: usar input HTML nativo
  if (Platform.OS === 'web') {
    const normalizedValue = normalizeDateForWeb(value);
    
    return (
      <View style={styles.container}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
        <View style={[styles.datePicker, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <View style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            {React.createElement('input', {
              type: 'date',
              value: normalizedValue,
              onChange: handleWebDateChange,
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
          <Ionicons name="calendar" size={20} color={colors.textSecondary} style={{ marginLeft: theme.spacing.xs, flexShrink: 0 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TouchableOpacity
        style={[styles.datePicker, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
        onPress={showDatePicker}
        activeOpacity={0.7}
      >
        <Text style={[styles.selectedText, { color: value ? colors.text : colors.textTertiary }]}>
          {formatDisplayDate(value)}
        </Text>
        <Ionicons name="calendar" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      {Platform.OS === 'ios' && showPicker && (
        <DateTimePicker
          value={currentDate}
          mode="date"
          display="default" // iOS 14+ shows calendar by default
          onChange={handleDateChange}
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
  datePicker: {
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
