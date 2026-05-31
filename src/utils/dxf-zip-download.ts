import JSZip from 'jszip';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { ProductionAttachment } from '../types';
import { extractStorageObjectKey, getSignedUrlFromStorage } from './attachments';
import { getDxfAttachments } from './production-attachment-storage';

export { getDxfAttachments } from './production-attachment-storage';

function sanitizeZipFilename(filename: string): string {
  return filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim() || 'arquivos-dxf';
}

function ensureDxfExtension(filename: string): string {
  const lower = filename.toLowerCase();
  return lower.endsWith('.dxf') ? filename : `${filename.replace(/\.+$/, '')}.dxf`;
}

function uniqueZipEntryName(displayName: string, used: Set<string>): string {
  const safe = ensureDxfExtension(sanitizeZipFilename(displayName));
  if (!used.has(safe)) {
    used.add(safe);
    return safe;
  }
  const base = safe.replace(/\.dxf$/i, '');
  let index = 2;
  while (used.has(`${base} (${index}).dxf`)) {
    index += 1;
  }
  const unique = `${base} (${index}).dxf`;
  used.add(unique);
  return unique;
}

/**
 * Baixa todos os anexos DXF e entrega um único arquivo ZIP.
 * Requer pelo menos 2 arquivos DXF.
 */
export async function downloadAllDxfAttachmentsAsZip(
  attachments: ProductionAttachment[],
  zipBaseName: string
): Promise<void> {
  const dxfList = getDxfAttachments(attachments);
  if (dxfList.length < 2) {
    throw new Error('At least two DXF attachments are required');
  }

  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const att of dxfList) {
    const storageKey =
      att.originalStoragePath ||
      extractStorageObjectKey(att.storagePath) ||
      att.storagePath;
    const displayName = att.originalName || att.filename;

    const signedUrl = await getSignedUrlFromStorage(storageKey, displayName);
    if (!signedUrl || (!signedUrl.startsWith('http://') && !signedUrl.startsWith('https://'))) {
      throw new Error(`Não foi possível obter URL para ${displayName}`);
    }

    const response = await fetch(signedUrl);
    if (!response.ok) {
      throw new Error(`Falha ao baixar ${displayName}: ${response.status}`);
    }

    const blob = await response.blob();
    const entryName = uniqueZipEntryName(displayName, usedNames);
    zip.file(entryName, blob);
  }

  const zipFilename = sanitizeZipFilename(`${zipBaseName}-DXF.zip`);

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      throw new Error('Download ZIP não suportado neste ambiente');
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const blobUrl = window.URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = zipFilename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    }, 100);
    return;
  }

  const base64 = await zip.generateAsync({ type: 'base64' });
  const zipPath = `${FileSystemLegacy.cacheDirectory}${zipFilename}`;
  await FileSystemLegacy.writeAsStringAsync(zipPath, base64, {
    encoding: FileSystemLegacy.EncodingType.Base64,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Compartilhamento não disponível neste dispositivo');
  }

  await Sharing.shareAsync(zipPath, {
    mimeType: 'application/zip',
    dialogTitle: zipFilename,
  });
}
