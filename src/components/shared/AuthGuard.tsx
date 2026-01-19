import { useRouter, useSegments } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { useRealtime } from '../../hooks/use-realtime';
import { useThemeColors } from '../../hooks/use-theme-colors';
import { repos } from '../../services/container';
import { useAuth, useAuthStore } from '../../store/auth-store';

// Platform-specific storage helper
const getStorage = () => {
  if (Platform.OS === 'web') {
    return {
      removeItem: (key: string) => {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(key);
        }
        return Promise.resolve();
      },
    };
  } else {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    return AsyncStorage;
  }
};

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, setSession } = useAuth();
  const hasInitialized = useAuthStore((state) => state.hasInitialized);
  const setInitialized = useAuthStore((state) => state.setInitialized);
  const segments = useSegments();
  const router = useRouter();
  const colors = useThemeColors();
  const [isChecking, setIsChecking] = useState(true);
  const isProcessingRef = useRef(false);
  const lastSegmentsRef = useRef<string[]>([]);
  
  // Ativar Realtime subscriptions quando o usuário estiver autenticado
  useRealtime();

  useEffect(() => {
    let isMounted = true;
    let navigationTimeout: NodeJS.Timeout | null = null;

    const checkAuth = async () => {
      // Prevent multiple simultaneous executions
      if (isProcessingRef.current) {
        return;
      }

      // Check if segments actually changed
      const segmentsStr = JSON.stringify(segments);
      const lastSegmentsStr = JSON.stringify(lastSegmentsRef.current);
      if (segmentsStr === lastSegmentsStr && hasInitialized && session !== null) {
        // Nothing changed, skip
        if (!isChecking) {
          setIsChecking(false);
        }
        return;
      }

      isProcessingRef.current = true;
      lastSegmentsRef.current = segments;

      try {
        if (!isMounted) {
          isProcessingRef.current = false;
          return;
        }
        
        setIsChecking(true);
        
        // Initialize: Clear any persisted session on first load
        if (!hasInitialized) {
          try {
            await repos.authRepo.logout();
            setSession(null);
            // Clear storage with error handling
            try {
              const storage = getStorage();
              await storage.removeItem('auth-storage');
              await storage.removeItem('mock_auth_session');
            } catch (storageError) {
              // Continue even if storage fails
              if (Platform.OS !== 'web') {
                console.warn('Error clearing storage:', storageError);
              }
            }
          } catch (error) {
            console.error('Error clearing session on init:', error);
          }
          
          if (!isMounted) return;
          setInitialized(true);
          
          // Wait for router to be ready - use longer delay to ensure Stack is mounted
          await new Promise(resolve => setTimeout(resolve, Platform.OS === 'web' ? 500 : 300));
          
          if (!isMounted) return;
          
          // Only navigate if segments are available (router is ready)
          if (segments && segments.length > 0) {
            const currentRoute = segments[0] || '';
            if (currentRoute !== 'login') {
              navigationTimeout = setTimeout(() => {
                if (isMounted) {
                  try {
                    router.replace('/login');
                  } catch (error) {
                    // Router might not be ready yet, will retry on next effect
                    console.warn('Router not ready yet, will retry');
                  }
                }
              }, 100);
            }
          }
          
          setIsChecking(false);
          isProcessingRef.current = false;
          return;
        }

        // Wait for router to be ready (especially on Web)
        if (Platform.OS === 'web') {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        if (!isMounted) {
          isProcessingRef.current = false;
          return;
        }
        
        // Critical: Always require session - if no session, redirect to login
        // Don't wait for segments if we don't have a session
        if (!session) {
          console.log('AuthGuard: No session found, redirecting to login');
          // Wait a bit more for router to be ready, then redirect
          await new Promise(resolve => setTimeout(resolve, Platform.OS === 'web' ? 300 : 200));
          
          if (!isMounted) {
            isProcessingRef.current = false;
            return;
          }
          
          // Only proceed if segments are available (router is ready)
          const currentRoute = segments && segments.length > 0 ? segments[0] : '';
          const inAuthGroup = currentRoute === 'login';
          
          // If already on login, just stop checking
          if (inAuthGroup) {
            setIsChecking(false);
            isProcessingRef.current = false;
            return;
          }
          
          // Redirect to login
          navigationTimeout = setTimeout(() => {
            if (isMounted) {
              try {
                console.log('AuthGuard: Redirecting to /login');
                router.replace('/login');
              } catch (error) {
                console.warn('Router not ready for navigation:', error);
              } finally {
                setTimeout(() => {
                  isProcessingRef.current = false;
                }, 500);
              }
            }
          }, 100);
          setIsChecking(false);
          return;
        }
        
        // Only proceed if segments are available (router is ready)
        if (!segments || segments.length === 0) {
          setIsChecking(false);
          isProcessingRef.current = false;
          return;
        }
        
        const currentRoute = segments[0] || '';
        const inAuthGroup = currentRoute === 'login';
        
        // Has session - validate it
        try {
          const isValid = await repos.authRepo.validateSession(session);
          if (!isMounted) return;
          
          if (!isValid) {
            // Session is invalid, clear it
            await repos.authRepo.logout();
            setSession(null);
            setIsChecking(false);
            if (!inAuthGroup && segments && segments.length > 0) {
              navigationTimeout = setTimeout(() => {
                if (isMounted && !isProcessingRef.current) {
                  isProcessingRef.current = true;
                  try {
                    router.replace('/login');
                  } catch (error) {
                    console.warn('Router not ready for navigation:', error);
                  } finally {
                    setTimeout(() => {
                      isProcessingRef.current = false;
                    }, 500);
                  }
                }
              }, 100);
            }
            isProcessingRef.current = false;
            return;
          }
          
          // Valid session - redirect away from login if needed
          if (inAuthGroup) {
            setIsChecking(false);
            // Delay to ensure router is ready
            navigationTimeout = setTimeout(() => {
              if (isMounted && !isProcessingRef.current) {
                isProcessingRef.current = true;
                try {
                  router.replace('/(tabs)/production');
                } catch (error) {
                  console.warn('Router not ready for navigation:', error);
                } finally {
                  setTimeout(() => {
                    isProcessingRef.current = false;
                  }, 500);
                }
              }
            }, 200);
            isProcessingRef.current = false;
            return;
          }
        } catch (error) {
          console.error('Error validating session:', error);
          await repos.authRepo.logout();
          setSession(null);
          setIsChecking(false);
          if (!isMounted) {
            isProcessingRef.current = false;
            return;
          }
          
          if (!inAuthGroup && segments && segments.length > 0) {
            navigationTimeout = setTimeout(() => {
              if (isMounted && !isProcessingRef.current) {
                isProcessingRef.current = true;
                try {
                  router.replace('/login');
                } catch (error) {
                  console.warn('Router not ready for navigation:', error);
                } finally {
                  setTimeout(() => {
                    isProcessingRef.current = false;
                  }, 500);
                }
              }
            }, 100);
          }
          isProcessingRef.current = false;
          return;
        }
        
        if (isMounted) {
          setIsChecking(false);
        }
        isProcessingRef.current = false;
      } catch (error) {
        console.error('Error in checkAuth:', error);
        if (isMounted) {
          setIsChecking(false);
          if (segments && segments.length > 0) {
            navigationTimeout = setTimeout(() => {
              if (isMounted && !isProcessingRef.current) {
                isProcessingRef.current = true;
                try {
                  router.replace('/login');
                } catch (redirectError) {
                  console.warn('Router not ready for navigation:', redirectError);
                } finally {
                  setTimeout(() => {
                    isProcessingRef.current = false;
                  }, 500);
                }
              }
            }, 100);
          }
        }
        isProcessingRef.current = false;
      }
    };

    // Only run if not already processing
    if (!isProcessingRef.current) {
      checkAuth();
    }

    return () => {
      isMounted = false;
      isProcessingRef.current = false;
      if (navigationTimeout) {
        clearTimeout(navigationTimeout);
      }
    };
    // Only depend on session and hasInitialized, not segments (to avoid loops)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, hasInitialized]);

  // Show loading indicator while checking authentication
  if (isChecking) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
