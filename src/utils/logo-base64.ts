import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

/** Retorna a logo da empresa em data URL (base64) para uso em HTML/PDF. */
export async function getLogoBase64(): Promise<string> {
  try {
    const logoModule = require('../../assets/images/login-logo.png');
    if (Platform.OS === 'web') {
      let logoUrl: string =
        typeof logoModule === 'string'
          ? logoModule
          : (logoModule?.default ?? logoModule?.uri ?? logoModule?.src ?? '');
      if (logoUrl) {
        const response = await fetch(logoUrl);
        if (response.ok) {
          const blob = await response.blob();
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string) ?? '');
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      }
      return '';
    }
    const uri = typeof logoModule === 'object' ? logoModule?.uri ?? logoModule?.default : logoModule;
    if (!uri) return '';
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/png;base64,${base64}`;
  } catch {
    return '';
  }
}
