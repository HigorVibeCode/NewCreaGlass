import { ProductionAttachment } from '../types';

const STORAGE_KEY_SEPARATOR = '__';

/** Imagens, PDF e vídeos por ordem de produção */
export const MAX_PRODUCTION_MEDIA_ATTACHMENTS = 10;

/** Arquivos DXF por ordem de produção */
export const MAX_PRODUCTION_DXF_ATTACHMENTS = 100;

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

export function getDxfAttachments(attachments: ProductionAttachment[]): ProductionAttachment[] {
  return attachments.filter((att) =>
    isDxfFile(att.originalName || att.filename, att.mimeType)
  );
}

export function getMediaAttachments(attachments: ProductionAttachment[]): ProductionAttachment[] {
  return attachments.filter(
    (att) => !isDxfFile(att.originalName || att.filename, att.mimeType)
  );
}

export function isProductionImageAttachment(att: ProductionAttachment): boolean {
  return att.mimeType?.startsWith('image/') ?? false;
}

export function isProductionPdfOrDocumentAttachment(att: ProductionAttachment): boolean {
  if (isDxfFile(att.originalName || att.filename, att.mimeType)) return false;
  if (isProductionImageAttachment(att)) return false;
  return true;
}

export function partitionProductionAttachments(attachments: ProductionAttachment[]) {
  const images: ProductionAttachment[] = [];
  const documents: ProductionAttachment[] = [];
  const dxf: ProductionAttachment[] = [];

  for (const att of attachments) {
    if (isDxfFile(att.originalName || att.filename, att.mimeType)) {
      dxf.push(att);
    } else if (isProductionImageAttachment(att)) {
      images.push(att);
    } else {
      documents.push(att);
    }
  }

  return { images, documents, dxf };
}
