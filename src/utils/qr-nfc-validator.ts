import { z } from 'zod';
import { QRScanResult } from '../platform/qr';
import { NFCReadResult } from '../platform/nfc';

// Schema for validating scanned data
const scannedDataSchema = z.object({
  data: z.string().min(1),
  type: z.string().optional(),
});

export function validateScannedData(
  result: QRScanResult | NFCReadResult | null
): { valid: boolean; data?: string; error?: string } {
  if (!result) {
    return { valid: false, error: 'No data scanned' };
  }

  try {
    const validated = scannedDataSchema.parse(result);
    // Additional validation can be added here
    // For example, checking data format, sanitizing, etc.
    return { valid: true, data: validated.data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: 'Invalid data format' };
    }
    return { valid: false, error: 'Validation error' };
  }
}

export function sanitizeScannedData(data: string): string {
  // Remove potentially dangerous characters
  return data.trim().replace(/[<>]/g, '');
}
