// Player window - YouTube IFrame API
let player = null;
let playerReady = false;

// Called by YouTube IFrame API when ready
window.onYouTubeIframeAPIReady = function() {
  player = new YT.Player('player', {
    height: '100%',
    width: '100%',
    videoId: 'dQw4w9WgXcQ', // Video por defecto para evitar error 153
    playerVars: {
      autoplay: 0,
      controls: 1, // Mostrar controles para debug
      disablekb: 0,
      fs: 1,
      modestbranding: 1,
      rel: 0,
      showinfo: 0,
      enablejsapi: 1
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
      onError: onPlayerError
    }
  });
};

function onPlayerReady(event) {
  playerReady = true;
  
  // Start time update interval
  setInterval(() => {
    if (player && playerReady && player.getDuration) {
      try {
        const current = player.getCurrentTime() || 0;
        const duration = player.getDuration() || 0;
        window.playerApi.sendTimeUpdate({ current, duration });
      } catch (err) {
        // Ignore errors
      }
    }
  }, 500);
}

function onPlayerStateChange(event) {
  const states = {
    '-1': 'unstarted',
    '0': 'ended',
    '1': 'playing',
    '2': 'paused',
    '3': 'buffering',
    '5': 'cued'
  };
  
  const state = states[event.data] || 'unknown';
  window.playerApi.sendPlayerState(state);

  // Auto-advance on ended
  if (event.data === 0) {
    window.playerApi.notifyEnded();
  }
}

function onPlayerError(event) {
  window.playerApi.sendPlayerState('error');
}

// Commands from main process
window.playerApi.onLoad((videoId) => {
  if (player && playerReady) {
    player.loadVideoById(videoId);
  }
});

window.playerApi.onPlay(() => {
  if (player && playerReady) {
    player.playVideo();
  }
});

window.playerApi.onPause(() => {
  if (player && playerReady) {
    player.pauseVideo();
  }
});

window.playerApi.onSeek((seconds) => {
  if (player && playerReady) {
    player.seekTo(seconds, true);
  }
});

window.playerApi.onSetVolume((volume) => {
  if (player && playerReady) {
    player.setVolume(volume);
  }
});
