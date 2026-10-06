import { useTranslation } from 'react-i18next';
import { saveLanguage } from '../i18n/config';
import { useAuth } from '../store/auth-store';

export const useI18n = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  
  const changeLanguage = async (lang: string) => {
    i18n.changeLanguage(lang);
    // Explicitly save to our storage key
    await saveLanguage(lang);

    // Sync language preference to database for push notification translations
    if (user?.id) {
      try {
        const { repos } = await import('../services/container');
        await repos.usersRepo.updatePreferredLanguage(user.id, lang);
      } catch (err) {
        console.warn('[useI18n] Failed to sync language to database:', err);
        // Non-critical - don't block UI
      }
    }
  };
  
  return {
    t,
    changeLanguage,
    currentLanguage: i18n.language,
  };
};
