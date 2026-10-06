import { supabase } from '../services/supabase';

const BUCKET_NAME = 'documents';
const CACHE_TTL = 50 * 60 * 1000; // 50 min (signed URLs expire in 60 min)

interface CacheEntry {
  url: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<string>>();

function getCacheKey(bucket: string, path: string): string {
  return `${bucket}::${path}`;
}

/**
 * Returns a cached signed URL or fetches a new one from Supabase Storage.
 * Deduplicates concurrent requests for the same path.
 */
export async function getCachedSignedUrl(
  storagePath: string,
  expiresIn = 3600,
  bucket = BUCKET_NAME,
): Promise<string> {
  if (!storagePath) return '';
  if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) return storagePath;

  const key = getCacheKey(bucket, storagePath);

  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const pending = pendingRequests.get(key);
  if (pending) return pending;

  const request = (async () => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, expiresIn);

      if (error) {
        console.warn('[SignedUrlCache] Error signing:', storagePath, error.message);
        return '';
      }

      const url = data?.signedUrl ?? '';
      if (url) {
        cache.set(key, { url, expiresAt: Date.now() + CACHE_TTL });
      }
      return url;
    } finally {
      pendingRequests.delete(key);
    }
  })();

  pendingRequests.set(key, request);
  return request;
}

/**
 * Pre-fetches signed URLs for multiple storage paths in a single batch request.
 * Results are stored in the cache for instant retrieval later.
 */
export async function prefetchSignedUrls(
  storagePaths: string[],
  expiresIn = 3600,
  bucket = BUCKET_NAME,
): Promise<void> {
  const pathsToFetch = storagePaths.filter((p) => {
    if (!p || p.startsWith('http://') || p.startsWith('https://')) return false;
    const cached = cache.get(getCacheKey(bucket, p));
    return !cached || cached.expiresAt <= Date.now();
  });

  if (pathsToFetch.length === 0) return;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(pathsToFetch, expiresIn);

  if (error) {
    console.warn('[SignedUrlCache] Batch sign error:', error.message);
    return;
  }

  if (data) {
    for (const entry of data) {
      if (entry.signedUrl && entry.path) {
        const key = getCacheKey(bucket, entry.path);
        cache.set(key, { url: entry.signedUrl, expiresAt: Date.now() + CACHE_TTL });
      }
    }
  }
}

/**
 * Invalidates a specific path from the cache (e.g. after upload/delete).
 */
export function invalidateSignedUrl(storagePath: string, bucket = BUCKET_NAME): void {
  cache.delete(getCacheKey(bucket, storagePath));
}

/**
 * Clears the entire signed URL cache.
 */
export function clearSignedUrlCache(): void {
  cache.clear();
}
