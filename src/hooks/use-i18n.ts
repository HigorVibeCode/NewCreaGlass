import { useTranslation } from 'react-i18next';
import { saveLanguage } from '../i18n/config';

export const useI18n = () => {
  const { t, i18n } = useTranslation();
  
  const changeLanguage = async (lang: string) => {
    i18n.changeLanguage(lang);
    // Explicitly save to our storage key
    await saveLanguage(lang);
  };
  
  return {
    t,
    changeLanguage,
    currentLanguage: i18n.language,
  };
};
