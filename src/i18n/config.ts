import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Platform } from 'react-native';
import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import it from './locales/it.json';
import pt from './locales/pt.json';
import es from './locales/es.json';

const resources = {
  en: { translation: en },
  de: { translation: de },
  fr: { translation: fr },
  it: { translation: it },
  pt: { translation: pt },
  es: { translation: es },
};

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
    };
  } else {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    return AsyncStorage;
  }
};

// Supported language codes
const SUPPORTED_LANGUAGES = ['en', 'de', 'fr', 'it', 'pt', 'es'];

// Load saved language with fallbacks
export const loadSavedLanguage = async (): Promise<string> => {
  try {
    const storage = getStorage();
    
    // 1. Try to read "app.language" (our explicit storage)
    const appLanguage = await storage.getItem('app.language');
    if (appLanguage && SUPPORTED_LANGUAGES.includes(appLanguage)) {
      return appLanguage;
    }
    
    // 2. Try to read "i18nextLng" (i18next default key)
    const i18nextLng = await storage.getItem('i18nextLng');
    if (i18nextLng && SUPPORTED_LANGUAGES.includes(i18nextLng)) {
      // Migrate to our key
      await saveLanguage(i18nextLng);
      return i18nextLng;
    }
    
    // 3. Use 'en' as fallback
    return 'en';
  } catch (error) {
    console.warn('Error loading saved language:', error);
    return 'en';
  }
};

// Save language to storage
export const saveLanguage = async (lang: string): Promise<void> => {
  try {
    const storage = getStorage();
    await storage.setItem('app.language', lang);
  } catch (error) {
    console.warn('Error saving language:', error);
  }
};

// Initialize i18n with saved language
let i18nInitialized = false;
let i18nInitPromise: Promise<void> | null = null;

export const initI18n = async (): Promise<void> => {
  if (i18nInitialized) {
    return;
  }
  
  if (i18nInitPromise) {
    return i18nInitPromise;
  }
  
  i18nInitPromise = (async () => {
    const savedLanguage = await loadSavedLanguage();
    
    if (!i18nInitialized) {
      await i18n.use(initReactI18next).init({
        resources,
        lng: savedLanguage,
        fallbackLng: 'en',
        interpolation: {
          escapeValue: false,
        },
        compatibilityJSON: 'v3',
      });
      i18nInitialized = true;
    }
  })();
  
  return i18nInitPromise;
};

export default i18n;
