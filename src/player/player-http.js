// Dual-mode player: YouTube IFrame API + native <video>/<audio> for local files.

let ytPlayer = null;
let ytReady = false;
let pendingCommands = [];
let currentMode = 'youtube'; // 'youtube' | 'local'
let lastVolume = 60; // 0..100

const localMedia = document.getElementById('localMedia');
const audioScene = document.getElementById('audioScene');
const ytContainer = document.getElementById('player');

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

// ---------- Local media ----------
localMedia.addEventListener('timeupdate', () => {
  if (currentMode !== 'local') return;
  if (window.playerApi) {
    window.playerApi.sendTimeUpdate({
      current: localMedia.currentTime || 0,
      duration: isFinite(localMedia.duration) ? localMedia.duration : 0
    });
  }
});
localMedia.addEventListener('play', () => {
  if (currentMode === 'local' && window.playerApi) window.playerApi.sendPlayerState('playing');
});
localMedia.addEventListener('pause', () => {
  if (currentMode === 'local' && window.playerApi) window.playerApi.sendPlayerState('paused');
});
localMedia.addEventListener('ended', () => {
  if (currentMode === 'local' && window.playerApi) {
    window.playerApi.sendPlayerState('ended');
    window.playerApi.notifyEnded();
  }
});
localMedia.addEventListener('error', () => {
  if (currentMode === 'local' && window.playerApi) window.playerApi.sendPlayerState('error');
});

// ---------- Mode switching ----------
function switchToYouTube() {
  currentMode = 'youtube';
  try { localMedia.pause(); } catch (e) {}
  localMedia.removeAttribute('src');
  localMedia.load();
  localMedia.style.display = 'none';
  audioScene.style.display = 'none';
  ytContainer.style.display = 'block';
}

function switchToLocal(isVideo) {
  currentMode = 'local';
  try {
    if (ytPlayer && ytReady) ytPlayer.pauseVideo();
  } catch (e) {}
  ytContainer.style.display = 'none';
  localMedia.style.display = isVideo ? 'block' : 'none';
  audioScene.style.display = isVideo ? 'none' : 'block';
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
      const isVideo = media.mediaType === 'video';
      switchToLocal(isVideo);
      const src = '/media?src=' + encodeURIComponent(media.filePath);
      localMedia.src = src;
      localMedia.volume = Math.max(0, Math.min(1, lastVolume / 100));
      const tryPlay = () => { localMedia.play().catch(() => {}); };
      localMedia.oncanplay = tryPlay;
      tryPlay();
    } else if (media.videoId) {
      switchToYouTube();
      const exec = () => {
        if (ytPlayer && ytReady) ytPlayer.loadVideoById(media.videoId);
        else pendingCommands.push(exec);
      };
      exec();
    } else {
      // Nada válido que reproducir (p. ej. item roto sin videoId/filePath):
      // detener lo que esté sonando en vez de dejar el video por defecto.
      try { if (ytPlayer && ytReady) ytPlayer.stopVideo(); } catch (e) {}
      try { localMedia.pause(); } catch (e) {}
      if (window.playerApi) window.playerApi.sendPlayerState('paused');
    }
  });

  window.playerApi.onPlay(() => {
    if (currentMode === 'local') {
      localMedia.play().catch(() => {});
    } else {
      const exec = () => {
        if (ytPlayer && ytReady) ytPlayer.playVideo();
        else pendingCommands.push(exec);
      };
      exec();
    }
  });

  window.playerApi.onPause(() => {
    if (currentMode === 'local') localMedia.pause();
    else if (ytPlayer && ytReady) ytPlayer.pauseVideo();
  });

  window.playerApi.onSeek((seconds) => {
    if (currentMode === 'local') {
      try { localMedia.currentTime = seconds; } catch (e) {}
    } else if (ytPlayer && ytReady) {
      ytPlayer.seekTo(seconds, true);
    }
  });

  window.playerApi.onSetVolume((volume) => {
    lastVolume = volume;
    if (currentMode === 'local') localMedia.volume = Math.max(0, Math.min(1, volume / 100));
    else if (ytPlayer && ytReady) ytPlayer.setVolume(volume);
  });
}

registerCommandListeners();
