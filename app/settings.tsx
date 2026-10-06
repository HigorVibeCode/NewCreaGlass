import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useI18n } from '../src/hooks/use-i18n';
import { Dropdown, DropdownOption } from '../src/components/shared/Dropdown';
import { theme } from '../src/theme';
import { useThemeColors } from '../src/hooks/use-theme-colors';

const LANGUAGE_CODES = ['en', 'de', 'fr', 'it', 'pt', 'es'] as const;
const LANGUAGE_LABELS = {
  en: 'english',
  de: 'german',
  fr: 'french',
  it: 'italian',
  pt: 'portuguese',
  es: 'spanish',
} as const;

export default function SettingsScreen() {
  const { t, changeLanguage, currentLanguage } = useI18n();
  const colors = useThemeColors();

  const languageOptions: DropdownOption[] = LANGUAGE_CODES.map(code => ({
    label: t(`settings.${LANGUAGE_LABELS[code]}`),
    value: code,
  }));

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.section}>
          <Dropdown
            label={t('settings.language')}
            value={currentLanguage}
            options={languageOptions}
            onSelect={(value) => changeLanguage(value)}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
});
