import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '../src/components/shared/Button';
import { Input } from '../src/components/shared/Input';
import { useI18n } from '../src/hooks/use-i18n';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { repos } from '../src/services/container';
import { useAuth } from '../src/store/auth-store';
import { theme } from '../src/theme';
import { clearSavedLogin, getSavedLogin, saveLogin } from '../src/utils/saved-login';

export default function LoginScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { setSession, setLoading, isLoading } = useAuth();
  const colors = useThemeColors();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [rememberLogin, setRememberLogin] = useState(false);

  // Load saved credentials on mount
  useEffect(() => {
    const loadSavedCredentials = async () => {
      try {
        const saved = await getSavedLogin();
        if (saved.username && saved.password) {
          setUsername(saved.username);
          setPassword(saved.password);
          setRememberLogin(true);
        }
      } catch (error) {
        console.warn('Error loading saved credentials:', error);
      }
    };
    loadSavedCredentials();
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError(t('auth.invalidCredentials'));
      return;
    }

    setError('');
    setLoading(true);

    try {
      const session = await repos.authRepo.login(username.trim(), password);
      
      // Save or clear credentials based on rememberLogin checkbox
      if (rememberLogin) {
        await saveLogin(username.trim(), password);
      } else {
        await clearSavedLogin();
      }
      
      setSession(session);
      router.replace('/(tabs)/production');
    } catch (error: any) {
      console.error('Login error:', error);
      setError(t('auth.invalidCredentials'));
      Alert.alert(t('common.error'), error.message || t('auth.loginError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <ExpoImage
            source={require('../assets/images/login-logo.png')}
            style={styles.logo}
            contentFit="contain"
            transition={200}
            cachePolicy="memory-disk"
            priority="high"
          />
        </View>

        <View style={styles.form}>
          <Input
            label={t('auth.username')}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Input
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          {/* Remember Login Checkbox */}
          <TouchableOpacity
            style={styles.rememberContainer}
            onPress={() => setRememberLogin(!rememberLogin)}
            activeOpacity={0.7}
          >
            <Switch
              value={rememberLogin}
              onValueChange={setRememberLogin}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={Platform.OS === 'android' ? colors.background : undefined}
            />
            <Text style={[styles.rememberText, { color: colors.text }]}>
              {t('auth.rememberLogin')}
            </Text>
          </TouchableOpacity>
          
          {error ? <View style={styles.errorContainer} /> : null}
          <Button
            title={t('auth.loginButton')}
            onPress={handleLogin}
            loading={isLoading}
            disabled={!username.trim() || !password.trim()}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  logo: {
    width: 320,
    height: 160,
    // contentFit="contain" mantém as proporções originais sem distorção
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  rememberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  rememberText: {
    marginLeft: theme.spacing.sm,
    fontSize: 14,
  },
  errorContainer: {
    marginBottom: theme.spacing.sm,
  },
});
