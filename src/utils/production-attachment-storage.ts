const STORAGE_KEY_SEPARATOR = '__';

export function randomUuidV4(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Gera chave única no storage: {uuid}__{nome_original} */
export function buildProductionStorageKey(originalName: string): string {
  const safeName = (originalName || 'file').replace(/[/\\]/g, '_').trim() || 'file';
  return `${randomUuidV4()}${STORAGE_KEY_SEPARATOR}${safeName}`;
}

/** Extrai nome original de uma storage_path no formato uuid__nome.ext */
export function getOriginalNameFromStorageKey(storageKey: string): string | null {
  const base = storageKey.split('/').pop() || storageKey;
  const idx = base.indexOf(STORAGE_KEY_SEPARATOR);
  if (idx === -1) return null;
  const name = base.slice(idx + STORAGE_KEY_SEPARATOR.length);
  return name || null;
}

export function isDxfFile(name: string, mimeType?: string | null): boolean {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'dxf') return true;
  const mime = (mimeType || '').toLowerCase();
  return mime.includes('dxf') || mime === 'application/x-dxf' || mime === 'image/vnd.dxf';
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
