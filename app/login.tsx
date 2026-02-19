import { Image as ExpoImage } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '../src/components/shared/Button';
import { Input } from '../src/components/shared/Input';
import { useI18n } from '../src/hooks/use-i18n';
import { useThemeColors } from '../src/hooks/use-theme-colors';
import { repos } from '../src/services/container';
import { useAuth } from '../src/store/auth-store';
import { theme } from '../src/theme';
import { clearSavedLogin, getSavedLogin, saveLogin } from '../src/utils/saved-login';

const AUTO_LOGIN_TIMEOUT_MS = 5000;

export default function LoginScreen() {
  'use no memo';
  const { t } = useI18n();
  const { session, setSession, setLoading, isLoading } = useAuth();
  const colors = useThemeColors();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [autoLoggingIn, setAutoLoggingIn] = useState(true);
  const autoLoginAttempted = useRef(false);

  // If AuthGuard already restored a session, stop showing loading immediately
  // (AuthGuard's navigation guard will redirect to production)
  useEffect(() => {
    if (session) {
      setAutoLoggingIn(false);
    }
  }, [session]);

  useEffect(() => {
    if (session || autoLoginAttempted.current) return;
    autoLoginAttempted.current = true;

    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const tryAutoLogin = async () => {
      timeoutId = setTimeout(() => {
        if (isMounted) {
          console.warn('[Login] Auto-login timed out');
          setLoading(false);
          setAutoLoggingIn(false);
        }
      }, AUTO_LOGIN_TIMEOUT_MS);

      try {
        const saved = await getSavedLogin();
        if (!isMounted) return;

        if (saved.username && saved.password) {
          setUsername(saved.username);
          setPassword(saved.password);
          setKeepLoggedIn(true);

          try {
            setLoading(true);
            const loginSession = await repos.authRepo.login(saved.username, saved.password);
            if (!isMounted) return;
            setSession(loginSession);
            return;
          } catch (loginErr) {
            console.warn('Auto-login failed:', loginErr);
            if (!isMounted) return;
            await clearSavedLogin();
            setKeepLoggedIn(false);
          } finally {
            if (isMounted) setLoading(false);
          }
        }
      } catch (err) {
        console.warn('Error during auto-login:', err);
      }
      if (isMounted) setAutoLoggingIn(false);
    };

    tryAutoLogin();
    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [session]);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError(t('auth.invalidCredentials'));
      return;
    }

    setError('');
    setLoading(true);

    try {
      const loginSession = await repos.authRepo.login(username.trim(), password);
      
      // Save or clear credentials based on keepLoggedIn toggle
      if (keepLoggedIn) {
        await saveLogin(username.trim(), password);
      } else {
        await clearSavedLogin();
      }
      
      setSession(loginSession);
      // AuthGuard navigation guard will redirect to production
    } catch (error: any) {
      console.error('Login error:', error);
      setError(t('auth.invalidCredentials'));
      Alert.alert(t('common.error'), error.message || t('auth.loginError'));
    } finally {
      setLoading(false);
    }
  };

  // Show loading screen while attempting auto-login
  if (autoLoggingIn) {
    return (
      <View style={[styles.container, styles.autoLoginContainer, { backgroundColor: colors.background }]}>
        <ExpoImage
          source={require('../assets/images/login-logo.png')}
          style={styles.logo}
          contentFit="contain"
          transition={200}
          cachePolicy="memory-disk"
          priority="high"
        />
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: theme.spacing.xl }} />
      </View>
    );
  }

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
          
          {/* Keep Logged In Toggle */}
          <TouchableOpacity
            style={styles.rememberContainer}
            onPress={() => setKeepLoggedIn(!keepLoggedIn)}
            activeOpacity={0.7}
          >
            <Switch
              value={keepLoggedIn}
              onValueChange={setKeepLoggedIn}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={Platform.OS === 'android' ? colors.background : undefined}
            />
            <Text style={[styles.rememberText, { color: colors.text }]}>
              {t('auth.keepLoggedIn')}
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
  autoLoginContainer: {
    justifyContent: 'center',
    alignItems: 'center',
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
