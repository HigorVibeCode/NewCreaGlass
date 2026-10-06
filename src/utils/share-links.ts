import { Linking, Platform, Share } from 'react-native';

type ShareEntity = 'production' | 'workOrder' | 'event' | 'inventoryItem';

interface ShareLinkConfig {
  entity: ShareEntity;
  params: Record<string, string>;
}

function buildPath(config: ShareLinkConfig): string {
  const qs = new URLSearchParams(config.params).toString();
  switch (config.entity) {
    case 'production':
      return `/production-detail?${qs}`;
    case 'workOrder':
      return `/work-order-detail?${qs}`;
    case 'event':
      return `/event-detail?${qs}`;
    case 'inventoryItem':
      return `/inventory-item-detail?${qs}`;
    default:
      return '/';
  }
}

function getWebBaseUrl(): string {
  const DEFAULT_SHARE_DOMAIN = 'https://www.creasolutions.online';

  const ensureAbsoluteUrl = (raw: string): string => {
    if (!raw) return DEFAULT_SHARE_DOMAIN;
    const trimmed = raw.trim().replace(/\/+$/, '');
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    return `https://${trimmed.replace(/^\/+/, '')}`;
  };

  const configuredUrl = process.env.EXPO_PUBLIC_APP_URL;
  if (configuredUrl && configuredUrl.trim()) {
    return ensureAbsoluteUrl(configuredUrl);
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    // Avoid sharing local/dev hosts when app runs via Expo web/dev server.
    if (!/localhost|127\.0\.0\.1|expo/i.test(origin)) {
      return ensureAbsoluteUrl(origin);
    }
  }

  return DEFAULT_SHARE_DOMAIN;
}

export function generateHybridLinks(config: ShareLinkConfig) {
  const path = buildPath(config);
  const webUrl = `${getWebBaseUrl()}${path}`;
  const deepLink = `crea-glass://${path.replace(/^\//, '')}`;
  return { webUrl, deepLink };
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback below
    }
  }

  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }

  return false;
}

async function showWebCopyDialog(link: string): Promise<void> {
  if (typeof document === 'undefined') return;

  await new Promise<void>((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.45)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '999999';

    const modal = document.createElement('div');
    modal.style.width = 'min(560px, 92vw)';
    modal.style.background = '#fff';
    modal.style.borderRadius = '12px';
    modal.style.padding = '16px';
    modal.style.boxShadow = '0 12px 30px rgba(0,0,0,0.22)';
    modal.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

    const title = document.createElement('div');
    title.textContent = 'Share link';
    title.style.fontSize = '16px';
    title.style.fontWeight = '600';
    title.style.marginBottom = '10px';

    const input = document.createElement('input');
    input.value = link;
    input.readOnly = true;
    input.style.width = '100%';
    input.style.boxSizing = 'border-box';
    input.style.padding = '10px 12px';
    input.style.border = '1px solid #d1d5db';
    input.style.borderRadius = '8px';
    input.style.marginBottom = '12px';
    input.onclick = () => input.select();

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.justifyContent = 'flex-end';
    actions.style.gap = '8px';

    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy link';
    copyBtn.style.padding = '8px 12px';
    copyBtn.style.border = '1px solid #d1d5db';
    copyBtn.style.background = '#f9fafb';
    copyBtn.style.borderRadius = '8px';
    copyBtn.style.cursor = 'pointer';
    copyBtn.onclick = async () => {
      const ok = await copyToClipboard(link);
      copyBtn.textContent = ok ? 'Copied!' : 'Copy failed';
      setTimeout(() => {
        copyBtn.textContent = 'Copy link';
      }, 1000);
    };

    const okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    okBtn.style.padding = '8px 14px';
    okBtn.style.border = 'none';
    okBtn.style.background = '#2563eb';
    okBtn.style.color = '#fff';
    okBtn.style.borderRadius = '8px';
    okBtn.style.cursor = 'pointer';
    okBtn.onclick = () => {
      document.body.removeChild(overlay);
      resolve();
    };

    actions.append(copyBtn, okBtn);
    modal.append(title, input, actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    input.focus();
    input.select();
  });
}

export async function shareViaWhatsApp(config: ShareLinkConfig, title?: string) {
  const { webUrl, deepLink } = generateHybridLinks(config);
  const shareTitle = title || 'Open item';
  // Production-first: share canonical HTTPS URL so Universal/App Links can open app directly.
  const text =
    `${webUrl}\n\n*${shareTitle}*`;

  if (Platform.OS === 'web') {
    // Web: show simple dialog with the link + copy + OK
    await showWebCopyDialog(webUrl);
    return;
  }

  // Prefer direct WhatsApp intent when available.
  try {
    const waUrl = `whatsapp://send?text=${encodeURIComponent(text)}`;
    const canOpenWhatsApp = await Linking.canOpenURL(waUrl);
    if (canOpenWhatsApp) {
      await Linking.openURL(waUrl);
      return;
    }
  } catch (error) {
    console.warn('Could not open WhatsApp directly, using share sheet:', error);
  }

  // Mobile: use native share sheet (Email, WhatsApp, Copy link, etc.)
  await Share.share({ message: text, url: webUrl, title: shareTitle });
}
