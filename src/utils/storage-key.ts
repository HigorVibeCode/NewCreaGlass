// Supabase Storage only accepts ASCII object keys (letters, digits and a few symbols).
// Names like "Auftragsbestätigung.pdf" or "Plan #2 – Müller.dxf" are rejected with
// "Invalid key", so uploads use a sanitized copy of the name; the original name is
// stored separately in the database for display.
const MAX_NAME_LENGTH = 120;

export function toStorageSafeName(name: string, fallback = 'file'): string {
  const ascii = (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // ä -> a, é -> e
    .replace(/ß/g, 'ss')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/_+\./g, '.')
    .replace(/^[_.]+|_+$/g, '');

  if (!ascii) return fallback;
  if (ascii.length <= MAX_NAME_LENGTH) return ascii;

  // Keep the extension when shortening
  const dot = ascii.lastIndexOf('.');
  const ext = dot > 0 && ascii.length - dot <= 10 ? ascii.slice(dot) : '';
  return ascii.slice(0, MAX_NAME_LENGTH - ext.length) + ext;
}
