import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

/**
 * Tenta autenticação por biometria (FaceID/TouchID/Android Biometric).
 * Retorna true se autenticado com sucesso, false se cancelado ou indisponível.
 */
export async function tryBiometricAuth(promptMessage?: string): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: promptMessage ?? 'Confirme sua identidade para registrar o ponto',
      cancelLabel: 'Usar senha',
    });
    return result.success;
  } catch {
    return false;
  }
}

export function isBiometricAvailable(): Promise<boolean> {
  return LocalAuthentication.hasHardwareAsync().then(
    (has) => has && LocalAuthentication.isEnrolledAsync()
  );
}
