import { Platform } from 'react-native';

const SAVED_USERNAME_KEY = 'saved_username';
const SAVED_PASSWORD_KEY = 'saved_password';
const REMEMBER_LOGIN_KEY = 'remember_login';

// Platform-specific storage adapter
const getStorage = () => {
  if (Platform.OS === 'web') {
    return {
      getItem: (key: string): Promise<string | null> => {
        if (typeof window !== 'undefined') {
          return Promise.resolve(window.localStorage.getItem(key));
        }
        return Promise.resolve(null);
      },
      setItem: (key: string, value: string): Promise<void> => {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, value);
        }
        return Promise.resolve();
      },
      removeItem: (key: string): Promise<void> => {
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

/**
 * Salva o username e senha para ser lembrado no próximo login
 * NOTA: A senha é salva em texto plano no storage local do dispositivo.
 * Isso é uma funcionalidade de conveniência e assume que o dispositivo está protegido.
 */
export const saveLogin = async (username: string, password: string): Promise<void> => {
  try {
    const storage = getStorage();
    await storage.setItem(SAVED_USERNAME_KEY, username);
    await storage.setItem(SAVED_PASSWORD_KEY, password);
    await storage.setItem(REMEMBER_LOGIN_KEY, 'true');
  } catch (error) {
    console.warn('Error saving login:', error);
  }
};

/**
 * @deprecated Use saveLogin instead
 * Salva o username para ser lembrado no próximo login
 */
export const saveUsername = async (username: string): Promise<void> => {
  try {
    const storage = getStorage();
    await storage.setItem(SAVED_USERNAME_KEY, username);
    await storage.setItem(REMEMBER_LOGIN_KEY, 'true');
  } catch (error) {
    console.warn('Error saving username:', error);
  }
};

/**
 * Carrega o username e senha salvos, se existirem
 */
export const getSavedLogin = async (): Promise<{ username: string | null; password: string | null }> => {
  try {
    const storage = getStorage();
    const shouldRemember = await storage.getItem(REMEMBER_LOGIN_KEY);
    if (shouldRemember === 'true') {
      const username = await storage.getItem(SAVED_USERNAME_KEY);
      const password = await storage.getItem(SAVED_PASSWORD_KEY);
      return { username, password };
    }
    return { username: null, password: null };
  } catch (error) {
    console.warn('Error loading saved login:', error);
    return { username: null, password: null };
  }
};

/**
 * Carrega o username salvo, se existir
 */
export const getSavedUsername = async (): Promise<string | null> => {
  try {
    const { username } = await getSavedLogin();
    return username;
  } catch (error) {
    console.warn('Error loading saved username:', error);
    return null;
  }
};

/**
 * Remove o username e senha salvos
 */
export const clearSavedLogin = async (): Promise<void> => {
  try {
    const storage = getStorage();
    await storage.removeItem(SAVED_USERNAME_KEY);
    await storage.removeItem(SAVED_PASSWORD_KEY);
    await storage.removeItem(REMEMBER_LOGIN_KEY);
  } catch (error) {
    console.warn('Error clearing saved login:', error);
  }
};

/**
 * @deprecated Use clearSavedLogin instead
 * Remove o username salvo
 */
export const clearSavedUsername = async (): Promise<void> => {
  await clearSavedLogin();
};

/**
 * Verifica se a opção "Salvar login" está habilitada
 */
export const isRememberLoginEnabled = async (): Promise<boolean> => {
  try {
    const storage = getStorage();
    const shouldRemember = await storage.getItem(REMEMBER_LOGIN_KEY);
    return shouldRemember === 'true';
  } catch (error) {
    console.warn('Error checking remember login status:', error);
    return false;
  }
};
