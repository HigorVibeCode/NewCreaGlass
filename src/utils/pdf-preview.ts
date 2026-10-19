import { Platform } from 'react-native';

// PDF rendering on web with pdf.js (3.11.174 legacy build, served from public/pdfjs and
// loaded only when a PDF is shown). Used for WhatsApp-style thumbnails and for showing
// PDFs inside the app on phones, where Chrome on Android cannot display a PDF in an iframe.
const PDFJS_BASE = '/pdfjs';

interface PdfPage {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  render: (options: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
}

interface PdfDocument {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
  destroy: () => Promise<void>;
}

interface PdfJsLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: { url: string; standardFontDataUrl?: string }) => { promise: Promise<PdfDocument> };
}

export interface RenderedPdfPage {
  uri: string; // data: URL (JPEG)
  width: number;
  height: number;
}

export interface PdfThumbnail extends RenderedPdfPage {
  numPages: number;
}

export const canRenderPdf = Platform.OS === 'web' && typeof document !== 'undefined';

let pdfJsPromise: Promise<PdfJsLib> | null = null;

const loadPdfJs = (): Promise<PdfJsLib> => {
  if (pdfJsPromise) return pdfJsPromise;
  pdfJsPromise = new Promise<PdfJsLib>((resolve, reject) => {
    const existing = (window as unknown as { pdfjsLib?: PdfJsLib }).pdfjsLib;
    if (existing) {
      resolve(existing);
      return;
    }
    const script = document.createElement('script');
    script.src = `${PDFJS_BASE}/pdf.min.js`;
    script.async = true;
    script.onload = () => {
      const lib = (window as unknown as { pdfjsLib?: PdfJsLib }).pdfjsLib;
      if (!lib) {
        reject(new Error('pdf.js not available'));
        return;
      }
      lib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.js`;
      resolve(lib);
    };
    script.onerror = () => reject(new Error('Failed to load pdf.js'));
    document.head.appendChild(script);
  }).catch((error) => {
    pdfJsPromise = null; // allow a retry later (e.g. offline)
    throw error;
  });
  return pdfJsPromise;
};

const renderPage = async (page: PdfPage, targetWidth: number): Promise<RenderedPdfPage> => {
  const base = page.getViewport({ scale: 1 });
  const scale = targetWidth / base.width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas not supported');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport }).promise;
  const uri = canvas.toDataURL('image/jpeg', 0.85);
  // Free the canvas memory right away
  canvas.width = 0;
  canvas.height = 0;
  return { uri, width: viewport.width, height: viewport.height };
};

const thumbnailCache = new Map<string, Promise<PdfThumbnail>>();

/** First page as an image, cached per key (storage path) for the session */
export const getPdfThumbnail = (cacheKey: string, url: string, width = 640): Promise<PdfThumbnail> => {
  const cached = thumbnailCache.get(cacheKey);
  if (cached) return cached;
  const promise = (async () => {
    const lib = await loadPdfJs();
    const pdf = await lib.getDocument({ url, standardFontDataUrl: `${PDFJS_BASE}/standard_fonts/` }).promise;
    try {
      const first = await renderPage(await pdf.getPage(1), width);
      return { ...first, numPages: pdf.numPages };
    } finally {
      pdf.destroy().catch(() => undefined);
    }
  })();
  thumbnailCache.set(cacheKey, promise);
  promise.catch(() => thumbnailCache.delete(cacheKey));
  return promise;
};

/** All pages (up to maxPages) as images, reported one by one as they finish */
export const renderPdfPages = async (
  url: string,
  width: number,
  onPage: (page: RenderedPdfPage, index: number, numPages: number) => void,
  isCancelled: () => boolean,
  maxPages = 50
): Promise<number> => {
  const lib = await loadPdfJs();
  const pdf = await lib.getDocument({ url, standardFontDataUrl: `${PDFJS_BASE}/standard_fonts/` }).promise;
  try {
    const total = Math.min(pdf.numPages, maxPages);
    for (let i = 1; i <= total; i++) {
      if (isCancelled()) break;
      const rendered = await renderPage(await pdf.getPage(i), width);
      if (isCancelled()) break;
      onPage(rendered, i - 1, pdf.numPages);
    }
    return pdf.numPages;
  } finally {
    pdf.destroy().catch(() => undefined);
  }
};
