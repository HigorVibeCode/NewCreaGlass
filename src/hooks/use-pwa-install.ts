import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// Chrome / Edge / Android fire `beforeinstallprompt` once, possibly before any
// component mounts, so the event is captured at module load and shared.
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

let deferredPrompt: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

const isStandalone = (): boolean =>
  isWeb &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

if (isWeb) {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });
}

export const isIosBrowser = (): boolean =>
  isWeb &&
  (/iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
    // iPadOS reports itself as a Mac with touch
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1));

export const usePwaInstall = () => {
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (!isWeb) return;
    const listener = () => setVersion((v) => v + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Offered only in the browser, while the app is not installed yet
  const canOfferInstall = isWeb && !installed && !isStandalone();

  // true: the browser showed its install dialog; false: show manual instructions
  const promptInstall = async (): Promise<boolean> => {
    const event = deferredPrompt;
    if (!event) return false;
    deferredPrompt = null;
    await event.prompt();
    const choice = await event.userChoice.catch(() => null);
    if (choice?.outcome === 'accepted') installed = true;
    notify();
    return true;
  };

  return { canOfferInstall, promptInstall, hasNativePrompt: !!deferredPrompt };
};
