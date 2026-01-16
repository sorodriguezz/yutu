// Player for HTTP server
let player = null;
let playerReady = false;
let pendingCommands = [];

window.onYouTubeIframeAPIReady = function() {
  player = new YT.Player('player', {
    height: '100%',
    width: '100%',
    videoId: 'dQw4w9WgXcQ', // Default video to initialize
    playerVars: {
      autoplay: 0,
      controls: 1,
      modestbranding: 1,
      rel: 0,
      enablejsapi: 1,
      origin: window.location.origin
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
  
  // Execute any pending commands
  while (pendingCommands.length > 0) {
    const cmd = pendingCommands.shift();
    cmd.fn();
  }
  
  setInterval(() => {
    if (player && playerReady && player.getDuration) {
      try {
        const current = player.getCurrentTime() || 0;
        const duration = player.getDuration() || 0;
        if (window.playerApi) {
          window.playerApi.sendTimeUpdate({ current, duration });
        }
      } catch (err) {}
    }
  }, 500);
}

function onPlayerStateChange(event) {
  const states = { '-1': 'unstarted', '0': 'ended', '1': 'playing', '2': 'paused', '3': 'buffering', '5': 'cued' };
  const state = states[event.data] || 'unknown';
  if (window.playerApi) {
    window.playerApi.sendPlayerState(state);
    if (event.data === 0) window.playerApi.notifyEnded();
  }
}

function onPlayerError(event) {
  if (window.playerApi) window.playerApi.sendPlayerState('error');
}

// Register command listeners - wait for playerApi to be available
function registerCommandListeners() {
  if (!window.playerApi) {
    setTimeout(registerCommandListeners, 100);
    return;
  }
  
  window.playerApi.onLoad((videoId) => {
    const executeLoad = () => {
      if (player && playerReady) {
        player.loadVideoById(videoId);
      } else {
        pendingCommands.push({ type: 'load', fn: executeLoad });
      }
    };
    executeLoad();
  });
  
  window.playerApi.onPlay(() => {
    const executePlay = () => {
      if (player && playerReady) {
        player.playVideo();
      } else {
        pendingCommands.push({ type: 'play', fn: executePlay });
      }
    };
    executePlay();
  });
  
  window.playerApi.onPause(() => {
    if (player && playerReady) player.pauseVideo();
  });
  
  window.playerApi.onSeek((seconds) => {
    if (player && playerReady) player.seekTo(seconds, true);
  });
  
  window.playerApi.onSetVolume((volume) => {
    if (player && playerReady) player.setVolume(volume);
  });
}

// Start trying to register listeners
registerCommandListeners();
