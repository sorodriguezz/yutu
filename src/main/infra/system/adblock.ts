import { Session } from "electron";

// Patrones de red de anuncios/tracking (estilo lista de bloqueo). El filtro de
// `onBeforeRequest` solo se invoca para estas URLs, así que el resto del tráfico
// (incluido el audio real de googlevideo) nunca se toca.
export const AD_URL_PATTERNS = [
  "*://*.doubleclick.net/*",
  "*://*.googleadservices.com/*",
  "*://*.googlesyndication.com/*",
  "*://*.google-analytics.com/*",
  "*://*.googletagservices.com/*",
  "*://*.googletagmanager.com/*",
  "*://*.moatads.com/*",
  "*://*.youtube.com/pagead/*",
  "*://*.youtube.com/ptracking*",
  "*://*.youtube.com/api/stats/ads*",
  "*://*.youtube.com/get_midroll_info*",
  "*://m.youtube.com/api/stats/ads*",
  "*://music.youtube.com/pagead/*",
  "*://music.youtube.com/api/stats/ads*",
];

// Registra UNA vez el filtro sobre la sesión. El bloqueo se activa/desactiva en
// caliente leyendo `isEnabled()` dentro del callback.
export function applyAdBlock(ses: Session, isEnabled: () => boolean) {
  try {
    ses.webRequest.onBeforeRequest({ urls: AD_URL_PATTERNS }, (_details, callback) => {
      callback({ cancel: !!isEnabled() });
    });
  } catch (e) {
    // sesión no disponible / ya con un listener: ignora
  }
}

// Script que se inyecta en la página de YouTube Music para ocultar la UI de
// anuncios y saltar los pre/mid-roll automáticamente. Complementa el bloqueo de red.
export const AD_SKIP_SCRIPT = `(() => {
  if (window.__yutuAdSkip) return; window.__yutuAdSkip = true;
  const tick = () => {
    try {
      // Saltar anuncios de video
      const skip = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button');
      if (skip) skip.click();
      // Si hay un anuncio reproduciéndose, adelanta el video al final
      const ad = document.querySelector('.ad-showing, .ytp-ad-player-overlay');
      if (ad) {
        const v = document.querySelector('video');
        if (v && isFinite(v.duration) && v.duration > 0) { try { v.currentTime = v.duration; } catch (e) {} }
      }
      // Ocultar banners/promos
      document.querySelectorAll('.ytmusic-mealbar-promo-renderer, ytmusic-popup-container tp-yt-paper-dialog, .ytp-ad-overlay-slot, ytmusic-statement-banner-renderer').forEach((el) => { el.style.display = 'none'; });
    } catch (e) {}
  };
  setInterval(tick, 800);
})();`;
