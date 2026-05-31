import * as Location from 'expo-location';
import { GpsSource } from '../types';

export interface LocationForEntry {
  locationAddress: string | null;
  gpsAccuracy: number | null;
  gpsSource: GpsSource | null;
}

/**
 * Obtém local atual para registro de ponto: endereço (reverse geocoding),
 * precisão e fonte (gps/network). Solicita permissão se necessário.
 */
export async function getCurrentLocationForEntry(): Promise<LocationForEntry> {
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') {
    const { status: requested } = await Location.requestForegroundPermissionsAsync();
    if (requested !== 'granted') {
      throw new Error('LOCATION_PERMISSION_DENIED');
    }
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const accuracy = position.coords.accuracy ?? null;
  const gpsSource: GpsSource = accuracy !== null && accuracy <= 100 ? 'gps' : 'network';

  let locationAddress: string | null = null;
  try {
    const addresses = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    if (addresses?.length) {
      const a = addresses[0];
      const parts = [
        a.name,
        a.street,
        a.district,
        a.city,
        a.region,
        a.postalCode,
        a.country,
      ].filter(Boolean);
      locationAddress = parts.join(', ') || null;
    }
  } catch {
    // keep null
  }

  return {
    locationAddress,
    gpsAccuracy: accuracy,
    gpsSource,
  };
}
