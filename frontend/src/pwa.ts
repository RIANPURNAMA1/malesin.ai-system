/**
 * Registers the PWA service worker.
 * Only enabled in production builds so Vite dev (HMR) is never cached.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      console.warn('[pwa] Service worker registration failed:', error);
    });
  });
}
