import { useThemeStore } from '../store/theme-store';

export const useAppTheme = () => {
  const { themeMode, setThemeMode } = useThemeStore();

  return {
    themeMode,
    setThemeMode,
    effectiveTheme: 'dark' as const,
  };
};
