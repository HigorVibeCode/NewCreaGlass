import React from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useI18n } from '../src/hooks/use-i18n';
import { useAuth } from '../src/store/auth-store';
import { Button } from '../src/components/shared/Button';
import { theme } from '../src/theme';
import { useThemeColors } from '../src/hooks/use-theme-colors';

export default function ProfileScreen() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const router = useRouter();
  const colors = useThemeColors();

  if (!user) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('profile.username')}</Text>
          <Text style={[styles.value, { color: colors.text }]}>{user.username}</Text>
        </View>
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('profile.userType')}</Text>
          <Text style={[styles.value, { color: colors.text }]}>{user.userType}</Text>
        </View>
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('profile.status')}</Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {user.isActive ? t('profile.active') : t('profile.inactive')}
          </Text>
        </View>
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Button
            title={t('navigation.settings') || 'Settings'}
            onPress={() => router.push('/settings')}
            variant="outline"
          />
        </View>
        <View style={styles.section}>
          <Button title={t('common.logout') || 'Logout'} onPress={handleLogout} variant="outline" />
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
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
  },
  label: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    marginBottom: theme.spacing.xs,
  },
  value: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.regular,
  },
});
