// Dual-mode player: YouTube IFrame API + native <video>/<audio> for local files.
// El audio local usa DOS elementos (A/B) para poder hacer crossfade entre canciones.

let ytPlayer = null;
let ytReady = false;
let pendingCommands = [];
let currentMode = 'youtube'; // 'youtube' | 'local'
let lastVolume = 60; // 0..100
let lastRate = 1;    // velocidad de reproducción

const elA = document.getElementById('localMedia');   // <video> — video + audio
const elB = document.getElementById('localMediaB');   // <audio> — pareja de crossfade
const audioScene = document.getElementById('audioScene');
const ytContainer = document.getElementById('player');

// Elemento de audio local activo (el que “cuenta” para tiempo/estado/fin).
let activeEl = elA;
const otherAudio = (el) => (el === elA ? elB : elA);

// ---------- YouTube ----------
window.onYouTubeIframeAPIReady = function () {
  ytPlayer = new YT.Player('player', {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 0,
      controls: 1,
      modestbranding: 1,
      rel: 0,
      enablejsapi: 1,
      origin: window.location.origin
    },
    events: {
      onReady: onYtReady,
      onStateChange: onYtStateChange,
      onError: onYtError
    }
  });
};

function onYtReady() {
  ytReady = true;
  while (pendingCommands.length > 0) {
    const cmd = pendingCommands.shift();
    cmd();
  }

  setInterval(() => {
    if (currentMode !== 'youtube') return;
    if (ytPlayer && ytReady && ytPlayer.getDuration) {
      try {
        const current = ytPlayer.getCurrentTime() || 0;
        const duration = ytPlayer.getDuration() || 0;
        if (window.playerApi) window.playerApi.sendTimeUpdate({ current, duration });
      } catch (err) {}
    }
  }, 500);
}

function onYtStateChange(event) {
  if (currentMode !== 'youtube') return;
  const states = { '-1': 'unstarted', '0': 'ended', '1': 'playing', '2': 'paused', '3': 'buffering', '5': 'cued' };
  const state = states[event.data] || 'unknown';
  if (window.playerApi) {
    window.playerApi.sendPlayerState(state);
    if (event.data === 0) window.playerApi.notifyEnded();
  }
}

function onYtError() {
  if (currentMode === 'youtube' && window.playerApi) window.playerApi.sendPlayerState('error');
}

// ---------- Eventos de los elementos locales (gated por activeEl) ----------
function wireLocalEvents(el) {
  el.addEventListener('timeupdate', () => {
    if (currentMode !== 'local' || el !== activeEl) return;
    if (window.playerApi) {
      window.playerApi.sendTimeUpdate({
        current: el.currentTime || 0,
        duration: isFinite(el.duration) ? el.duration : 0
      });
    }
  });
  el.addEventListener('play', () => {
    if (currentMode === 'local' && el === activeEl && window.playerApi) window.playerApi.sendPlayerState('playing');
  });
  el.addEventListener('pause', () => {
    if (currentMode === 'local' && el === activeEl && window.playerApi) window.playerApi.sendPlayerState('paused');
  });
  el.addEventListener('ended', () => {
    if (currentMode === 'local' && el === activeEl && window.playerApi) {
      window.playerApi.sendPlayerState('ended');
      window.playerApi.notifyEnded();
    }
  });
  el.addEventListener('error', () => {
    if (currentMode === 'local' && el === activeEl && window.playerApi) window.playerApi.sendPlayerState('error');
  });
}
wireLocalEvents(elA);
wireLocalEvents(elB);

// ---------- Web Audio: visualizador + ecualizador + crossfade ----------
let audioCtx = null, mixBus = null, analyser = null, eqFilters = [], vizRunning = false;
const gainNodes = new Map(); // elemento -> GainNode (para el fundido)
const srcNodes = new Map();  // elemento -> MediaElementSourceNode
const EQ_FREQS = [60, 230, 910, 3600, 14000];
const VIZ_BARS = 48;

function ensureCtx() {
  if (audioCtx) return true;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    audioCtx = new AC();
    mixBus = audioCtx.createGain();
    let node = mixBus;
    eqFilters = EQ_FREQS.map((f) => {
      const biq = audioCtx.createBiquadFilter();
      biq.type = 'peaking'; biq.frequency.value = f; biq.Q.value = 1; biq.gain.value = 0;
      node.connect(biq); node = biq; return biq;
    });
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.8;
    node.connect(analyser);
    analyser.connect(audioCtx.destination);
    startVisualizer();
    return true;
  } catch (e) { audioCtx = null; return false; }
}

// Conecta un elemento al grafo (una sola vez) y devuelve su GainNode de fundido.
const srcAttempted = new Set();
function gainFor(el) {
  if (!ensureCtx()) return null;
  if (gainNodes.has(el)) return gainNodes.get(el);
  // createMediaElementSource solo puede llamarse UNA vez por elemento; si ya falló,
  // no reintentar (lanzaría InvalidStateError). El elemento sigue sonando directo.
  if (srcAttempted.has(el)) return null;
  srcAttempted.add(el);
  try {
    const src = audioCtx.createMediaElementSource(el);
    const g = audioCtx.createGain();
    g.gain.value = 1;
    src.connect(g); g.connect(mixBus);
    srcNodes.set(el, src);
    gainNodes.set(el, g);
    return g;
  } catch (e) { return null; }
}

function setGain(el, value, atTime) {
  const g = gainFor(el);
  if (!g) return;
  try {
    if (atTime != null) {
      g.gain.setValueAtTime(value, atTime);
    } else {
      // Set directo: cancela cualquier rampa programada (p. ej. un crossfade
      // interrumpido por un salto manual) para fijar el valor exacto.
      const now = audioCtx ? audioCtx.currentTime : 0;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(value, now);
    }
  } catch (e) { try { g.gain.value = value; } catch (_) {} }
}

function resumeCtx() {
  try { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) {}
}

function startVisualizer() {
  if (vizRunning || !analyser) return; vizRunning = true;
  const data = new Uint8Array(analyser.frequencyBinCount);
  let last = 0;
  function tick() {
    requestAnimationFrame(tick);
    const now = performance.now();
    if (now - last < 33) return; last = now; // ~30 fps
    const playing = currentMode === 'local' && activeEl && !activeEl.paused;
    if (!analyser || !playing) {
      if (window.playerApi) window.playerApi.sendLevels([]);
      return;
    }
    analyser.getByteFrequencyData(data);
    // Usa solo la parte baja-media del espectro (más energía visible en música)
    const usable = Math.floor(data.length * 0.72);
    const step = Math.max(1, Math.floor(usable / VIZ_BARS));
    const out = [];
    for (let i = 0; i < VIZ_BARS; i++) {
      let s = 0; for (let j = 0; j < step; j++) s += data[i * step + j] || 0;
      out.push(Math.round((s / step) / 255 * 100));
    }
    if (window.playerApi) window.playerApi.sendLevels(out);
  }
  tick();
}

// ---------- Mode switching ----------
function stopAudio(el) {
  try { el.pause(); } catch (e) {}
  try { el.removeAttribute('src'); el.load(); } catch (e) {}
}

function switchToYouTube() {
  currentMode = 'youtube';
  stopAudio(elA); stopAudio(elB);
  elA.style.display = 'none';
  audioScene.style.display = 'none';
  ytContainer.style.display = 'block';
}

function switchToLocal(isVideo) {
  currentMode = 'local';
  try { if (ytPlayer && ytReady) ytPlayer.pauseVideo(); } catch (e) {}
  ytContainer.style.display = 'none';
  elA.style.display = isVideo ? 'block' : 'none';
  audioScene.style.display = isVideo ? 'none' : 'block';
}

// ---------- Carga normal (corte seco / video / salto manual) ----------
function loadLocal(media) {
  const isVideo = media.mediaType === 'video';
  // El video siempre usa elA; el audio usa el elemento activo actual.
  const target = isVideo ? elA : activeEl;
  const other = otherAudio(target);

  // Cancela cualquier fundido en curso: silencia y detén el otro elemento.
  stopAudio(other);
  setGain(other, 0);

  activeEl = target;
  switchToLocal(isVideo);

  setGain(target, 1);
  target.src = '/media?src=' + encodeURIComponent(media.filePath);
  target.volume = Math.max(0, Math.min(1, lastVolume / 100));

  const tryPlay = () => {
    try { target.playbackRate = lastRate; } catch (e) {}
    ensureCtx(); gainFor(target); resumeCtx();
    target.play().catch(() => {});
  };
  target.oncanplay = tryPlay;
  tryPlay();
}

// ---------- Crossfade (audio local → audio local) ----------
function crossfadeTo(media, durationSec) {
  if (!media || !media.filePath) return;
  if (!ensureCtx()) { loadLocal(media); return; }

  const dur = Math.max(0.5, Math.min(12, Number(durationSec) || 4));
  const incoming = otherAudio(activeEl);
  const former = activeEl;

  switchToLocal(false); // escena de audio

  // El entrante arranca en silencio (gain 0) y sube; el saliente baja a 0.
  incoming.src = '/media?src=' + encodeURIComponent(media.filePath);
  incoming.volume = Math.max(0, Math.min(1, lastVolume / 100));
  gainFor(incoming);
  setGain(incoming, 0);

  // A partir de aquí el entrante es el activo: su tiempo/fin son los que cuentan.
  activeEl = incoming;

  const begin = () => {
    incoming.oncanplay = null;
    try { incoming.playbackRate = lastRate; } catch (e) {}
    resumeCtx();
    incoming.play().catch(() => {});
    const t0 = audioCtx.currentTime;
    const gIn = gainFor(incoming), gOut = gainFor(former);
    try {
      if (gIn) { gIn.gain.cancelScheduledValues(t0); gIn.gain.setValueAtTime(0, t0); gIn.gain.linearRampToValueAtTime(1, t0 + dur); }
      if (gOut) { gOut.gain.cancelScheduledValues(t0); gOut.gain.setValueAtTime(gOut.gain.value, t0); gOut.gain.linearRampToValueAtTime(0, t0 + dur); }
    } catch (e) {}
    // Al terminar el fundido, apaga el saliente.
    setTimeout(() => {
      if (activeEl !== former) { stopAudio(former); setGain(former, 0); }
    }, dur * 1000 + 120);
  };

  incoming.oncanplay = begin;
  // Si ya hay datos suficientes, arranca de inmediato.
  if (incoming.readyState >= 2) begin();
}

// ---------- Command listeners ----------
function registerCommandListeners() {
  if (!window.playerApi) {
    setTimeout(registerCommandListeners, 100);
    return;
  }

  window.playerApi.onLoad((media) => {
    // Back-compat: a bare string means a YouTube videoId
    if (typeof media === 'string') media = { provider: 'youtube', videoId: media };
    media = media || {};

    if (media.provider === 'local' && media.filePath) {
      loadLocal(media);
    } else if (media.videoId) {
      switchToYouTube();
      const exec = () => {
        if (ytPlayer && ytReady) {
          ytPlayer.loadVideoById(media.videoId);
          try { if (lastRate !== 1 && ytPlayer.setPlaybackRate) ytPlayer.setPlaybackRate(lastRate); } catch (e) {}
        } else pendingCommands.push(exec);
      };
      exec();
    } else {
      // Nada válido que reproducir: detener todo.
      try { if (ytPlayer && ytReady) ytPlayer.stopVideo(); } catch (e) {}
      stopAudio(elA); stopAudio(elB);
      if (window.playerApi) window.playerApi.sendPlayerState('paused');
    }
  });

  window.playerApi.onCrossfade((payload) => {
    payload = payload || {};
    if (payload.media && payload.media.filePath) crossfadeTo(payload.media, payload.durationSec);
  });

  window.playerApi.onPlay(() => {
    if (currentMode === 'local') {
      activeEl.play().catch(() => {});
    } else {
      const exec = () => {
        if (ytPlayer && ytReady) ytPlayer.playVideo();
        else pendingCommands.push(exec);
      };
      exec();
    }
  });

  window.playerApi.onPause(() => {
    if (currentMode === 'local') activeEl.pause();
    else if (ytPlayer && ytReady) ytPlayer.pauseVideo();
  });

  window.playerApi.onSeek((seconds) => {
    if (currentMode === 'local') {
      try { activeEl.currentTime = seconds; } catch (e) {}
    } else if (ytPlayer && ytReady) {
      ytPlayer.seekTo(seconds, true);
    }
  });

  window.playerApi.onSetVolume((volume) => {
    lastVolume = volume;
    const v = Math.max(0, Math.min(1, volume / 100));
    if (currentMode === 'local') { elA.volume = v; elB.volume = v; }
    else if (ytPlayer && ytReady) ytPlayer.setVolume(volume);
  });

  window.playerApi.onSetRate((rate) => {
    lastRate = rate;
    try { elA.playbackRate = rate; } catch (e) {}
    try { elB.playbackRate = rate; } catch (e) {}
    try { if (ytPlayer && ytReady && ytPlayer.setPlaybackRate) ytPlayer.setPlaybackRate(rate); } catch (e) {}
  });

  window.playerApi.onSetEq((gains) => {
    if (!ensureCtx()) return;
    for (let i = 0; i < eqFilters.length; i++) {
      const g = (gains && typeof gains[i] === 'number') ? gains[i] : 0;
      try { eqFilters[i].gain.value = Math.max(-12, Math.min(12, g)); } catch (e) {}
    }
  });
}

registerCommandListeners();
