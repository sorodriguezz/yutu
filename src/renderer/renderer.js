// Renderer process - UI logic

let state = {
  playlists: [],
  settings: { accentColor: '#1db954', volumeDefault: 60 },
  queue: { items: [], currentIndex: -1, shuffle: false, repeat: 'off' },
  playback: { isPlaying: false, currentTime: 0, duration: 0 },
  videoVisible: true, // Start visible
  selectedPlaylist: null, // Currently viewed playlist
  viewMode: 'queue' // 'queue' or 'playlist'
};

// Track last queue state to avoid unnecessary re-renders
let lastQueueHash = '';
function getQueueHash(queue) {
  return JSON.stringify({
    items: queue.items.map(t => t.videoId),
    index: queue.currentIndex,
    shuffle: queue.shuffle,
    repeat: queue.repeat
  });
}

// Cache for video metadata to avoid repeated fetches
const metadataCache = new Map();

// Debounce utility to prevent rapid re-renders
let renderTimeout = null;
function debouncedRender() {
  if (renderTimeout) clearTimeout(renderTimeout);
  renderTimeout = setTimeout(() => {
    render();
  }, 100);
}

// === HELPER: FETCH VIDEO METADATA ===
async function fetchVideoMetadata(videoId) {
  // Check cache first
  if (metadataCache.has(videoId)) {
    return metadataCache.get(videoId);
  }
  
  try {
    // Use YouTube oEmbed API (no API key required)
    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (!response.ok) {
      throw new Error('Failed to fetch video metadata');
    }
    const data = await response.json();
    const metadata = {
      title: data.title,
      author: data.author_name
    };
    metadataCache.set(videoId, metadata);
    return metadata;
  } catch (err) {
    const fallback = { title: videoId, author: 'YouTube' };
    metadataCache.set(videoId, fallback);
    return fallback;
  }
}

// Fetch metadata for multiple tracks in parallel (limited concurrency)
async function fetchMetadataForTracks(tracks) {
  // First, apply cached metadata to tracks that don't have titles
  for (const track of tracks) {
    if ((!track.title || track.title === track.videoId) && metadataCache.has(track.videoId)) {
      const cached = metadataCache.get(track.videoId);
      track.title = cached.title;
      track.author = cached.author;
    }
  }
  
  // Find tracks that still need fetching
  const needsFetch = tracks.filter(t => 
    (!t.title || t.title === t.videoId) && !metadataCache.has(t.videoId)
  );
  
  if (needsFetch.length === 0) return;
  
  // Fetch in parallel with limit of 3 concurrent requests
  const batchSize = 3;
  for (let i = 0; i < needsFetch.length; i += batchSize) {
    const batch = needsFetch.slice(i, i + batchSize);
    await Promise.all(batch.map(async (track) => {
      const metadata = await fetchVideoMetadata(track.videoId);
      track.title = metadata.title;
      track.author = metadata.author;
    }));
  }
}

// Update track titles in the DOM without full re-render
function updateTrackTitles() {
  const items = document.querySelectorAll('.queue-item');
  items.forEach((item, i) => {
    if (state.queue.items[i]) {
      const track = state.queue.items[i];
      const titleEl = item.querySelector('.queue-item-title');
      const metaEl = item.querySelector('.queue-item-meta');
      if (titleEl && track.title) {
        titleEl.textContent = track.title;
      }
      if (metaEl && track.author) {
        metaEl.textContent = track.author;
      }
    }
  });
  // Also update player bar
  updateNowPlaying();
  updatePlayerBarInfo();
}

// Make functions globally available for onclick handlers
window.createPlaylist = async function() {
  const input = document.getElementById('newPlaylistName');
  if (!input) return;
  
  const name = input.value.trim();
  if (!name) return;

  try {
    await window.api.createPlaylist(name);
    input.value = '';
    await loadState();
    render();
  } catch (err) {
    alert('Error al crear playlist: ' + err.message);
  }
};

window.importPlaylist = async function() {
  try {
    await window.api.importPlaylist();
    await loadState();
    render();
  } catch (err) {
    alert('Error al importar: ' + err.message);
  }
};

window.deletePlaylist = async function(id) {
  if (!confirm('¿Eliminar esta playlist?')) return;
  try {
    await window.api.deletePlaylist(id);
    await loadState();
    render();
  } catch (err) {
    alert('Error al eliminar: ' + err.message);
  }
};

window.enqueuePlaylist = async function(id) {
  try {
    await window.api.enqueuePlaylist(id);
  } catch (err) {
    alert('Error al encolar playlist: ' + err.message);
  }
};

// Open playlist view
window.openPlaylist = function(id) {
  const playlist = state.playlists.find(p => p.id === id);
  if (playlist) {
    state.selectedPlaylist = playlist;
    state.viewMode = 'playlist';
    render();
  }
};

// Back to queue view
window.backToQueue = function() {
  state.selectedPlaylist = null;
  state.viewMode = 'queue';
  render();
};

// Play track from playlist view - replaces queue with playlist and starts at trackIndex
window.playFromPlaylist = async function(playlistId, trackIndex) {
  try {
    // This replaces the queue with the playlist and sets the starting index
    await window.api.enqueuePlaylist(playlistId, trackIndex);
    // Play the track at the specified index
    await window.api.playAtIndex(trackIndex);
    // Switch to queue view
    backToQueue();
  } catch (err) {
    alert('Error al reproducir: ' + err.message);
  }
};

// Remove track from queue
window.removeFromQueue = async function(index) {
  try {
    // Remove from state and update
    state.queue.items.splice(index, 1);
    // Adjust current index if needed
    if (state.queue.currentIndex >= index && state.queue.currentIndex > 0) {
      state.queue.currentIndex--;
    }
    renderQueue();
    updateNowPlaying();
    updatePlayerBarInfo();
  } catch (err) {
    alert('Error al eliminar de la cola: ' + err.message);
  }
};

// Remove track from playlist
window.removeFromPlaylist = async function(playlistId, trackId) {
  try {
    await window.api.removeTrackFromPlaylist(playlistId, trackId);
    await loadState();
    // Update selected playlist if still viewing it
    if (state.selectedPlaylist && state.selectedPlaylist.id === playlistId) {
      state.selectedPlaylist = state.playlists.find(p => p.id === playlistId);
    }
    render();
  } catch (err) {
    alert('Error al eliminar de playlist: ' + err.message);
  }
};

window.exportPlaylist = async function(id) {
  try {
    await window.api.exportPlaylist(id);
  } catch (err) {
    alert('Error al exportar: ' + err.message);
  }
};

window.addTrackToPlaylist = async function(trackIndex, playlistId) {
  const track = state.queue.items[trackIndex];
  if (!track || !playlistId) return;

  try {
    await window.api.addTrackToPlaylist(playlistId, {
      videoId: track.videoId,
      title: track.title || track.videoId
    });
    await loadState();
    render();
  } catch (err) {
    alert('Error al agregar a playlist: ' + err.message);
  }
};

window.playAtIndex = async function(index) {
  try {
    await window.api.playAtIndex(index);
  } catch (err) {
    alert('Error al reproducir: ' + err.message);
  }
};

window.toggleSettings = function() {
  const panel = document.getElementById('settingsPanel');
  if (panel) {
    panel.classList.toggle('hidden');
  }
};

// === ADD TO PLAYLIST MODAL ===
let pendingTrackForPlaylist = null;

window.showAddToPlaylistModal = function(track) {
  pendingTrackForPlaylist = track;
  const modal = document.getElementById('addToPlaylistModal');
  const trackName = document.getElementById('addedTrackName');
  const playlistOptions = document.getElementById('playlistOptions');
  
  if (!modal) return;
  
  if (trackName) {
    trackName.textContent = track.title || track.videoId;
  }
  
  if (playlistOptions) {
    if (state.playlists.length === 0) {
      playlistOptions.innerHTML = '<p class="no-playlists">No tienes playlists. Crea una primero.</p>';
    } else {
      playlistOptions.innerHTML = state.playlists.map(pl => `
        <div class="playlist-option" onclick="addPendingTrackToPlaylist('${pl.id}')">
          <span class="playlist-option-icon">🎵</span>
          <span class="playlist-option-name">${escapeHtml(pl.name)}</span>
        </div>
      `).join('');
    }
  }
  
  modal.classList.remove('hidden');
};

window.closeAddToPlaylistModal = function() {
  const modal = document.getElementById('addToPlaylistModal');
  if (modal) {
    modal.classList.add('hidden');
  }
  pendingTrackForPlaylist = null;
};

window.addPendingTrackToPlaylist = async function(playlistId) {
  if (!pendingTrackForPlaylist) return;
  
  try {
    await window.api.addTrackToPlaylist(playlistId, {
      videoId: pendingTrackForPlaylist.videoId,
      title: pendingTrackForPlaylist.title || pendingTrackForPlaylist.videoId
    });
    await loadState();
    render();
    closeAddToPlaylistModal();
  } catch (err) {
    alert('Error al agregar a playlist: ' + err.message);
  }
};

window.togglePlayPause = async function() {
  const result = await window.api.playPause();
  if (result && result.isPlaying !== undefined) {
    state.playback.isPlaying = result.isPlaying;
    updatePlayPauseButton();
  }
};

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
  setupEventListeners();
  render();
  startProgressUpdate();
});

async function loadState() {
  try {
    const data = await window.api.getState();
    state.playlists = data.playlists || [];
    state.settings = data.settings || state.settings;
    
    const queueData = data.queue || { queue: [], index: -1, shuffle: false, repeat: 'off' };
    state.queue = {
      items: queueData.queue || [],
      currentIndex: queueData.index !== undefined ? queueData.index : -1,
      shuffle: queueData.shuffle || false,
      repeat: queueData.repeat || 'off'
    };
    
    // Fetch metadata in background (don't block, don't re-render whole queue)
    fetchMetadataForTracks(state.queue.items).then(() => {
      // Just update the text content of existing elements instead of full re-render
      updateTrackTitles();
    });
    
    document.documentElement.style.setProperty('--accent', state.settings.accentColor);
    
    // Initialize settings UI with saved values
    initializeSettingsUI();
  } catch (err) {}
}

// Initialize settings panel with saved values
function initializeSettingsUI() {
  const accentColor = document.getElementById('accentColor');
  const volumeDefault = document.getElementById('volumeDefault');
  const volumeDefaultLabel = document.getElementById('volumeDefaultLabel');
  const colorPreview = document.getElementById('colorPreview');
  
  if (accentColor) {
    accentColor.value = state.settings.accentColor;
  }
  
  if (colorPreview) {
    colorPreview.style.background = state.settings.accentColor;
  }
  
  if (volumeDefault) {
    volumeDefault.value = state.settings.volumeDefault;
    updateSliderBackground(volumeDefault, state.settings.volumeDefault, 100);
  }
  
  if (volumeDefaultLabel) {
    volumeDefaultLabel.textContent = state.settings.volumeDefault;
  }
}

// === EVENT LISTENERS ===
function setupEventListeners() {
  // Search bar
  const searchInput = document.getElementById('ytInput');
  if (searchInput) {
    searchInput.onkeypress = (e) => {
      if (e.key === 'Enter') window.addToQueue();
    };
  }

  // Settings panel
  const btnSettings = document.getElementById('btnSettings');
  if (btnSettings) {
    btnSettings.onclick = () => {
      document.getElementById('settingsPanel').classList.toggle('hidden');
    };
  }

  // Video toggle
  const btnToggleVideo = document.getElementById('btnToggleVideo');
  if (btnToggleVideo) {
    btnToggleVideo.onclick = toggleVideo;
  }

  // Delegated event listener for add-to-playlist selects
  document.addEventListener('change', async (e) => {
    if (e.target.classList.contains('add-to-playlist-select')) {
      const trackIndex = parseInt(e.target.dataset.trackIndex);
      const playlistId = e.target.value;
      if (playlistId) {
        await window.addTrackToPlaylist(trackIndex, playlistId);
        e.target.value = ''; // Reset after adding
      }
    }
  });

  // Player controls
  const btnPlayPause = document.getElementById('btnPlayPause');
  const btnNext = document.getElementById('btnNext');
  const btnPrev = document.getElementById('btnPrev');
  const btnShuffle = document.getElementById('btnShuffle');
  const btnRepeat = document.getElementById('btnRepeat');

  if (btnPlayPause) btnPlayPause.onclick = () => window.api.playPause();
  if (btnNext) btnNext.onclick = () => window.api.next();
  if (btnPrev) btnPrev.onclick = () => window.api.prev();
  if (btnShuffle) btnShuffle.onclick = toggleShuffle;
  if (btnRepeat) btnRepeat.onclick = cycleRepeat;

  // Volume
  const volumeSlider = document.getElementById('volume');
  if (volumeSlider) {
    volumeSlider.oninput = (e) => {
      const vol = parseInt(e.target.value);
      const volumeLabel = document.getElementById('volumeLabel');
      if (volumeLabel) volumeLabel.textContent = vol;
      updateSliderBackground(volumeSlider, vol, 100);
      window.api.setVolume(vol);
    };
    // Initialize volume slider background
    updateSliderBackground(volumeSlider, 60, 100);
  }

  // Progress/Seek
  const progressSlider = document.getElementById('progress');
  if (progressSlider) {
    progressSlider.onchange = (e) => {
      if (state.playback.duration > 0) {
        const pos = (parseInt(e.target.value) / 1000) * state.playback.duration;
        window.api.seek(pos);
      }
    };
  }

  // Settings
  const accentColor = document.getElementById('accentColor');
  const volumeDefault = document.getElementById('volumeDefault');

  if (accentColor) {
    accentColor.onchange = async (e) => {
      const color = e.target.value;
      document.documentElement.style.setProperty('--accent', color);
      const colorPreview = document.getElementById('colorPreview');
      if (colorPreview) colorPreview.style.background = color;
      await window.api.setAccentColor(color);
      state.settings.accentColor = color;
    };
  }

  if (volumeDefault) {
    volumeDefault.oninput = async (e) => {
      const vol = parseInt(e.target.value);
      const volumeDefaultLabel = document.getElementById('volumeDefaultLabel');
      if (volumeDefaultLabel) volumeDefaultLabel.textContent = vol;
      updateSliderBackground(volumeDefault, vol, 100);
      await window.api.setVolumeDefault(vol);
      state.settings.volumeDefault = vol;
    };
  }

  // Listen to player events
  window.api.onPlayerState((newState) => {
    state.playback.isPlaying = newState === 'playing';
    updatePlayPauseButton();
  });

  window.api.onTimeUpdate((data) => {
    state.playback.currentTime = data.current;
    state.playback.duration = data.duration;
  });

  window.api.onQueueUpdate(async (queue) => {
    const newQueue = {
      items: queue.queue || [],
      currentIndex: queue.index !== undefined ? queue.index : -1,
      shuffle: queue.shuffle || false,
      repeat: queue.repeat || 'off'
    };
    
    const newHash = getQueueHash(newQueue);
    const queueChanged = newHash !== lastQueueHash;
    
    // Only update state and render if queue actually changed
    if (queueChanged) {
      lastQueueHash = newHash;
      state.queue = newQueue;
      
      if (state.viewMode === 'queue') {
        renderQueue();
      }
      
      // Fetch metadata in background without re-rendering
      fetchMetadataForTracks(state.queue.items).then(() => {
        updateTrackTitles();
      });
    }
    
    // Always update now playing info (for current index changes)
    updateNowPlaying();
    updatePlayerBarInfo();
  });
}

// === VIDEO TOGGLE ===
async function toggleVideo() {
  state.videoVisible = !state.videoVisible;
  try {
    await window.api.toggleVideo(state.videoVisible);
    const icon = document.getElementById('btnToggleVideo').querySelector('svg');
    icon.innerHTML = state.videoVisible 
      ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>'
      : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
  } catch (err) {}
}

// === ADD TO QUEUE ===
window.addToQueue = async function() {
  const input = document.getElementById('ytInput');
  if (!input) {
    alert('No se encontró el campo de búsqueda');
    return;
  }
  
  const value = input.value.trim();
  if (!value) {
    alert('Por favor ingresa una URL o ID de video');
    return;
  }

  try {
    const wasEmpty = state.queue.items.length === 0;
    await window.api.enqueueTrack(value);
    input.value = '';
    
    // Wait for queue to update, then get the added track and show modal
    setTimeout(async () => {
      // Get the last added track
      const addedTrack = state.queue.items[state.queue.items.length - 1];
      
      // Fetch metadata for the track if not available
      if (addedTrack && (!addedTrack.title || addedTrack.title === addedTrack.videoId)) {
        const metadata = await fetchVideoMetadata(addedTrack.videoId);
        addedTrack.title = metadata.title;
        addedTrack.author = metadata.author;
      }
      
      // Show modal to optionally add to playlist
      if (addedTrack && state.playlists.length > 0) {
        showAddToPlaylistModal(addedTrack);
      }
      
      // Auto-play if queue was empty before adding
      if (wasEmpty) {
        await window.api.playAtIndex(0);
      }
    }, 500);
  } catch (err) {
    alert('Error al agregar: ' + err.message);
  }
};

// === SHUFFLE & REPEAT ===
async function toggleShuffle() {
  await window.api.toggleShuffle();
  state.queue.shuffle = !state.queue.shuffle;
  renderShuffleButton();
}

async function cycleRepeat() {
  await window.api.cycleRepeat();
  const modes = ['off', 'all', 'one'];
  const idx = modes.indexOf(state.queue.repeat);
  state.queue.repeat = modes[(idx + 1) % 3];
  renderRepeatButton();
}

function renderShuffleButton() {
  const btn = document.getElementById('btnShuffle');
  if (btn) btn.classList.toggle('active', state.queue.shuffle);
}

function renderRepeatButton() {
  const btn = document.getElementById('btnRepeat');
  if (!btn) return;
  
  btn.classList.toggle('active', state.queue.repeat !== 'off');
  const svg = btn.querySelector('svg');
  if (!svg) return;
  
  if (state.queue.repeat === 'one') {
    svg.innerHTML = '<path d="M17 2l4 4-4 4"></path><path d="M3 11v-1a4 4 0 0 1 4-4h14"></path><path d="M7 22l-4-4 4-4"></path><path d="M21 13v1a4 4 0 0 1-4 4H3"></path><text x="12" y="16" font-size="8" text-anchor="middle" fill="currentColor">1</text>';
  } else {
    svg.innerHTML = '<path d="M17 2l4 4-4 4"></path><path d="M3 11v-1a4 4 0 0 1 4-4h14"></path><path d="M7 22l-4-4 4-4"></path><path d="M21 13v1a4 4 0 0 1-4 4H3"></path>';
  }
}

function updatePlayPauseButton() {
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  
  if (playIcon && pauseIcon) {
    if (state.playback.isPlaying) {
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
    } else {
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
    }
  }
}

// === SLIDER BACKGROUND UPDATE ===
function updateSliderBackground(slider, value, max) {
  const percent = (value / max) * 100;
  slider.style.background = `linear-gradient(to right, var(--accent) ${percent}%, var(--border-subtle) ${percent}%)`;
}

// === RENDER ===
function render() {
  renderPlaylists();
  
  // Render either playlist view or queue view based on mode
  if (state.viewMode === 'playlist' && state.selectedPlaylist) {
    renderPlaylistView();
  } else {
    renderQueue();
  }
  
  renderShuffleButton();
  renderRepeatButton();
  updateNowPlaying();
  updatePlayerBarInfo();
}

function renderPlaylists() {
  const container = document.getElementById('playlistList');
  if (!container) return;
  
  if (!state.playlists.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📁</div>
        <div class="empty-state-text">No hay playlists</div>
      </div>
    `;
    return;
  }

  container.innerHTML = state.playlists.map(pl => {
    return `
    <div class="playlist-item" onclick="openPlaylist('${pl.id}')">
      <div class="playlist-cover">🎵</div>
      <div class="playlist-details">
        <div class="playlist-name">${escapeHtml(pl.name)}</div>
        <div class="playlist-meta">${pl.items.length} canciones</div>
      </div>
      <div class="playlist-actions">
        <button onclick="event.stopPropagation(); exportPlaylist('${pl.id}')" title="Exportar">⬇</button>
        <button onclick="event.stopPropagation(); deletePlaylist('${pl.id}')" title="Eliminar">🗑</button>
      </div>
    </div>
  `;
  }).join('');
}

// Render playlist view (when a playlist is selected)
function renderPlaylistView() {
  const container = document.getElementById('queueItems');
  const count = document.getElementById('queueCount');
  const title = document.querySelector('.queue-section h2');
  
  const pl = state.selectedPlaylist;
  if (!pl) return;
  
  // Update title
  if (title) {
    title.innerHTML = `<button class="back-btn" onclick="backToQueue()" title="Volver">←</button> ${escapeHtml(pl.name)}`;
  }
  
  if (count) {
    count.textContent = `${pl.items.length} ${pl.items.length === 1 ? 'canción' : 'canciones'}`;
  }

  if (!container) return;

  if (!pl.items.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📁</div>
        <div class="empty-state-text">Playlist vacía. Agrega canciones desde la cola.</div>
      </div>
      <button class="play-all-btn" onclick="backToQueue()">← Volver a la cola</button>
    `;
    return;
  }

  container.innerHTML = `
    <div class="playlist-header-actions">
      <button class="play-all-btn" onclick="playFromPlaylist('${pl.id}', 0)">▶ Reproducir todo</button>
    </div>
    ${pl.items.map((track, i) => `
      <div class="queue-item" onclick="playFromPlaylist('${pl.id}', ${i})" style="cursor: pointer;">
        <div class="queue-item-index">${i + 1}</div>
        <div class="queue-item-info">
          <div class="queue-item-title">${escapeHtml(track.title || track.videoId)}</div>
          <div class="queue-item-meta">YouTube</div>
        </div>
        <div class="queue-item-actions">
          <button onclick="event.stopPropagation(); removeFromPlaylist('${pl.id}', '${track.id}')" title="Eliminar de playlist">🗑</button>
        </div>
      </div>
    `).join('')}
  `;
}

function renderQueue() {
  const container = document.getElementById('queueItems');
  const count = document.getElementById('queueCount');
  const title = document.querySelector('.queue-section h2');
  
  // Reset title to queue
  if (title && !title.textContent.includes('Cola')) {
    title.innerHTML = 'Cola de reproducción';
  }
  
  if (count) {
    count.textContent = `${state.queue.items.length} ${state.queue.items.length === 1 ? 'canción' : 'canciones'}`;
  }

  if (!container) return;

  if (!state.queue.items.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎵</div>
        <div class="empty-state-text">Cola vacía. Busca y agrega videos para comenzar.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = state.queue.items.map((track, i) => {
    const isActive = i === state.queue.currentIndex;
    const playlistOptions = state.playlists.map(pl => 
      `<option value="${pl.id}">${escapeHtml(pl.name)}</option>`
    ).join('');

    const displayTitle = track.title || track.videoId;
    const displayAuthor = track.author || 'YouTube';

    return `
      <div class="queue-item ${isActive ? 'active' : ''}" onclick="playAtIndex(${i})">
        <div class="queue-item-index">${isActive ? '▶' : i + 1}</div>
        <div class="queue-item-info">
          <div class="queue-item-title">${escapeHtml(displayTitle)}</div>
          <div class="queue-item-meta">${escapeHtml(displayAuthor)}</div>
        </div>
        <div class="queue-item-actions">
          ${state.playlists.length > 0 ? `
            <select class="add-to-playlist-select" data-track-index="${i}" onclick="event.stopPropagation();">
              <option value="">+ Playlist</option>
              ${playlistOptions}
            </select>
          ` : ''}
          <button class="remove-btn" onclick="event.stopPropagation(); removeFromQueue(${i})" title="Eliminar de cola">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

function updateNowPlaying() {
  const titleEl = document.getElementById('trackTitle');
  const artistEl = document.getElementById('trackArtist');

  if (state.queue.currentIndex >= 0 && state.queue.items[state.queue.currentIndex]) {
    const track = state.queue.items[state.queue.currentIndex];
    if (titleEl) titleEl.textContent = track.title || track.videoId;
    if (artistEl) artistEl.textContent = track.author || 'YouTube';
  } else {
    if (titleEl) titleEl.textContent = 'Sin reproducción';
    if (artistEl) artistEl.textContent = 'Agrega un video a la cola para comenzar';
  }
}

function updatePlayerBarInfo() {
  const nameEl = document.getElementById('playerTrackName');
  const metaEl = document.getElementById('playerTrackMeta');

  if (state.queue.currentIndex >= 0 && state.queue.items[state.queue.currentIndex]) {
    const track = state.queue.items[state.queue.currentIndex];
    if (nameEl) nameEl.textContent = track.title || track.videoId;
    if (metaEl) metaEl.textContent = track.author || 'YouTube';
  } else {
    if (nameEl) nameEl.textContent = 'Sin reproducción';
    if (metaEl) metaEl.textContent = 'Agrega videos para comenzar';
  }
}

// === PROGRESS UPDATE ===
function startProgressUpdate() {
  setInterval(() => {
    const progressSlider = document.getElementById('progress');
    const timeLabel = document.getElementById('timeLabel');
    const durationLabel = document.getElementById('durationLabel');
    
    if (state.playback.duration > 0) {
      const percent = (state.playback.currentTime / state.playback.duration) * 1000;
      if (progressSlider) {
        progressSlider.value = percent;
        updateSliderBackground(progressSlider, percent, 1000);
      }
      if (timeLabel) timeLabel.textContent = formatTime(state.playback.currentTime);
      if (durationLabel) durationLabel.textContent = formatTime(state.playback.duration);
    } else {
      if (progressSlider) {
        progressSlider.value = 0;
        updateSliderBackground(progressSlider, 0, 1000);
      }
      if (timeLabel) timeLabel.textContent = '0:00';
      if (durationLabel) durationLabel.textContent = '0:00';
    }
  }, 500);
}

function formatTime(seconds) {
  if (!seconds || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
