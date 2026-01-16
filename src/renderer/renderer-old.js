// Renderer process - UI logic
console.log('=== RENDERER.JS LOADED ===');
console.log('window.api:', window.api);

let state = {
  playlists: [],
  settings: { accentColor: '#1db954', volumeDefault: 60 },
  queue: { items: [], currentIndex: -1, shuffle: false, repeat: 'off' },
  playback: { isPlaying: false, currentTime: 0, duration: 0 },
  videoVisible: true
};

console.log('Initial state:', state);

// Make createPlaylist globally available
window.createPlaylist = async function() {
  alert('createPlaylist ejecutada!');
  const input = document.getElementById('newPlaylistName');
  if (!input) {
    alert('ERROR: No se encontró el campo de texto');
    return;
  }
  const name = input.value.trim();
  if (!name) {
    alert('Por favor escribe un nombre');
    return;
  }

  try {
    if (!window.api || !window.api.createPlaylist) {
      alert('ERROR: window.api.createPlaylist no está disponible');
      return;
    }
    alert('Creando playlist: ' + name);
    await window.api.createPlaylist(name);
    alert('Playlist creada!');
    input.value = '';
    await loadState();
    render();
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

// Also make importPlaylist global
window.importPlaylist = async function() {
  try {
    await window.api.importPlaylist();
    await loadState();
    render();
  } catch (err) {
    alert('Error al importar: ' + err.message);
  }
};

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', async () => {
  console.log('=== DOM CONTENT LOADED ===');
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
    
    // Map queue state to include currentIndex
    const queueData = data.queue || { queue: [], index: -1, shuffle: false, repeat: 'off' };
    state.queue = {
      items: queueData.queue || [],
      currentIndex: queueData.index !== undefined ? queueData.index : -1,
      shuffle: queueData.shuffle || false,
      repeat: queueData.repeat || 'off'
    };
    
    // Apply saved accent color
    document.documentElement.style.setProperty('--accent', state.settings.accentColor);
  } catch (err) {
    console.error('Failed to load state:', err);
  }
}

// === EVENT LISTENERS ===
function setupEventListeners() {
  console.log('=== SETTING UP EVENT LISTENERS ===');
  
  // Add to queue (search bar)
  const searchInput = document.getElementById('searchInput');
  console.log('searchInput:', searchInput);
  if (searchInput) {
    searchInput.onkeypress = (e) => {
      if (e.key === 'Enter') addToQueue();
    };
  }

  // Settings panel toggle
  const btnSettings = document.getElementById('btnSettings');
  console.log('btnSettings:', btnSettings);
  if (btnSettings) {
    btnSettings.onclick = () => {
      document.getElementById('settingsPanel').classList.toggle('hidden');
    };
  }

  // Video toggle
  const btnToggleVideo = document.getElementById('btnToggleVideo');
  console.log('btnToggleVideo:', btnToggleVideo);
  if (btnToggleVideo) {
    btnToggleVideo.onclick = toggleVideo;
  }

  // Playback controls (player bar)
  document.getElementById('btnPlayPause').onclick = () => window.api.playPause();
  document.getElementById('btnNext').onclick = () => window.api.next();
  document.getElementById('btnPrev').onclick = () => window.api.prev();
  document.getElementById('btnShuffle').onclick = toggleShuffle;
  document.getElementById('btnRepeat').onclick = cycleRepeat;

  // Volume
  const volumeSlider = document.getElementById('volumeSlider');
  volumeSlider.oninput = (e) => {
    const vol = parseInt(e.target.value);
    document.getElementById('volumeValue').textContent = vol;
    window.api.setVolume(vol);
  };

  // Progress/Seek
  const progressSlider = document.getElementById('progressSlider');
  progressSlider.onchange = (e) => {
    if (state.playback.duration > 0) {
      const pos = (parseInt(e.target.value) / 1000) * state.playback.duration;
      window.api.seek(pos);
    }
  };

  // Playlists
  const btnCreate = document.getElementById('btnCreatePlaylist');
  const inputName = document.getElementById('newPlaylistName');
  const btnImport = document.getElementById('btnImportPlaylist');
  
  if (btnCreate) {
    btnCreate.onclick = createPlaylist;
  } else {
    console.error('btnCreatePlaylist not found');
  }
  
  if (inputName) {
    inputName.onkeypress = (e) => {
      if (e.key === 'Enter') createPlaylist();
    };
  } else {
    console.error('newPlaylistName not found');
  }
  
  if (btnImport) {
    btnImport.onclick = importPlaylist;
  } else {
    console.error('btnImportPlaylist not found');
  }

  // Settings
  document.getElementById('accentColor').onchange = async (e) => {
    const color = e.target.value;
    document.documentElement.style.setProperty('--accent', color);
    await window.api.setAccentColor(color);
    state.settings.accentColor = color;
  };

  document.getElementById('volumeDefault').oninput = async (e) => {
    const vol = parseInt(e.target.value);
    document.getElementById('volumeDefaultValue').textContent = vol;
    await window.api.setVolumeDefault(vol);
    state.settings.volumeDefault = vol;
  };

  // Listen to player state updates
  window.api.onPlayerState((newState) => {
    state.playback.isPlaying = newState === 'playing';
    updatePlayPauseButton();
  });

  window.api.onTimeUpdate((data) => {
    state.playback.currentTime = data.current;
    state.playback.duration = data.duration;
  });

  window.api.onQueueUpdate((queue) => {
    state.queue = {
      items: queue.queue || [],
      currentIndex: queue.index !== undefined ? queue.index : -1,
      shuffle: queue.shuffle || false,
      repeat: queue.repeat || 'off'
    };
    renderQueue();
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
    // Update icon based on visibility
    icon.innerHTML = state.videoVisible 
      ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>'
      : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
  } catch (err) {
    console.error('Error toggling video:', err);
  }
}

// === ADD TO QUEUE ===
async function addToQueue() {
  const input = document.getElementById('searchInput');
  const value = input.value.trim();
  if (!value) return;

  try {
    await window.api.enqueueTrack(value);
    input.value = '';
  } catch (err) {
    alert('Error al agregar: ' + err.message);
  }
}

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
  btn.classList.toggle('active', state.queue.shuffle);
}

function renderRepeatButton() {
  const btn = document.getElementById('btnRepeat');
  btn.classList.toggle('active', state.queue.repeat !== 'off');
  // Change icon based on mode
  const svg = btn.querySelector('svg');
  if (state.queue.repeat === 'one') {
    svg.innerHTML = '<path d="M17 2l4 4-4 4"></path><path d="M3 11v-1a4 4 0 0 1 4-4h14"></path><path d="M7 22l-4-4 4-4"></path><path d="M21 13v1a4 4 0 0 1-4 4H3"></path><text x="12" y="16" font-size="8" text-anchor="middle" fill="currentColor">1</text>';
  } else {
    svg.innerHTML = '<path d="M17 2l4 4-4 4"></path><path d="M3 11v-1a4 4 0 0 1 4-4h14"></path><path d="M7 22l-4-4 4-4"></path><path d="M21 13v1a4 4 0 0 1-4 4H3"></path>';
  }
}

function updatePlayPauseButton() {
  const btn = document.getElementById('btnPlayPause');
  const svg = btn.querySelector('svg');
  
  if (state.playback.isPlaying) {
    // Pause icon
    svg.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
  } else {
    // Play icon
    svg.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
  }
}

// === PLAYLISTS ===
async function createPlaylist() {
  alert('Función createPlaylist ejecutada!');
  console.log('createPlaylist called');
  const input = document.getElementById('newPlaylistName');
  console.log('input element:', input);
  if (!input) {
    alert('ERROR: No se encontró el input!');
    console.error('Input element not found!');
    return;
  }
  const name = input.value.trim();
  console.log('playlist name:', name);
  if (!name) {
    alert('Por favor escribe un nombre para la playlist');
    console.log('No name provided');
    return;
  }

  try {
    console.log('Calling api.createPlaylist with:', name);
    alert('Intentando crear playlist: ' + name);
    await window.api.createPlaylist(name);
    alert('Playlist creada exitosamente!');
    input.value = '';
    await loadState();
    render();
    console.log('Playlist created successfully');
  } catch (err) {
    console.error('Error creating playlist:', err);
    alert('Error al crear playlist: ' + err.message);
  }
}

async function deletePlaylist(id) {
  if (!confirm('¿Eliminar esta playlist?')) return;
  try {
    await window.api.deletePlaylist(id);
    await loadState();
    render();
  } catch (err) {
    alert('Error al eliminar: ' + err.message);
  }
}

async function enqueuePlaylist(id) {
  try {
    await window.api.enqueuePlaylist(id);
  } catch (err) {
    alert('Error al encolar playlist: ' + err.message);
  }
}

async function exportPlaylist(id) {
  try {
    await window.api.exportPlaylist(id);
  } catch (err) {
    alert('Error al exportar: ' + err.message);
  }
}

async function importPlaylist() {
  try {
    await window.api.importPlaylist();
    await loadState();
    render();
  } catch (err) {
    alert('Error al importar: ' + err.message);
  }
}

async function addTrackToPlaylist(trackIndex, playlistId) {
  const track = state.queue.items[trackIndex];
  if (!track) return;

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
}

async function playAtIndex(index) {
  try {
    await window.api.playAtIndex(index);
  } catch (err) {
    alert('Error al reproducir: ' + err.message);
  }
}

// === RENDER ===
function render() {
  renderPlaylists();
  renderQueue();
  renderShuffleButton();
  renderRepeatButton();
  updateNowPlaying();
  updatePlayerBarInfo();
}

function renderPlaylists() {
  const container = document.getElementById('playlistList');
  if (!state.playlists.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📁</div>
        <div class="empty-state-text">No hay playlists</div>
      </div>
    `;
    return;
  }

  container.innerHTML = state.playlists.map(pl => `
    <div class="playlist-item" onclick="enqueuePlaylist('${pl.id}')">
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
  `).join('');
}

function renderQueue() {
  const container = document.getElementById('queueItems');
  const count = document.getElementById('queueCount');
  
  count.textContent = `${state.queue.items.length} ${state.queue.items.length === 1 ? 'canción' : 'canciones'}`;

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

    return `
      <div class="queue-item ${isActive ? 'active' : ''}" onclick="playAtIndex(${i})">
        <div class="queue-item-index">${isActive ? '▶' : i + 1}</div>
        <div class="queue-item-info">
          <div class="queue-item-title">${escapeHtml(track.title || track.videoId)}</div>
          <div class="queue-item-meta">${track.videoId}</div>
        </div>
        <div class="queue-item-actions">
          ${state.playlists.length > 0 ? `
            <select onchange="addTrackToPlaylist(${i}, this.value); this.value='';" onclick="event.stopPropagation();">
              <option value="">+ Playlist</option>
              ${playlistOptions}
            </select>
          ` : ''}
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
    titleEl.textContent = track.title || track.videoId;
    artistEl.textContent = `YouTube • ${track.videoId}`;
  } else {
    titleEl.textContent = 'Sin reproducción';
    artistEl.textContent = 'Agrega un video a la cola para comenzar';
  }
}

function updatePlayerBarInfo() {
  const nameEl = document.getElementById('playerTrackName');
  const metaEl = document.getElementById('playerTrackMeta');

  if (state.queue.currentIndex >= 0 && state.queue.items[state.queue.currentIndex]) {
    const track = state.queue.items[state.queue.currentIndex];
    nameEl.textContent = track.title || track.videoId;
    metaEl.textContent = `YouTube`;
  } else {
    nameEl.textContent = 'Sin reproducción';
    metaEl.textContent = 'Agrega videos para comenzar';
  }
}

// === PROGRESS UPDATE ===
function startProgressUpdate() {
  setInterval(() => {
    if (state.playback.duration > 0) {
      const percent = (state.playback.currentTime / state.playback.duration) * 1000;
      document.getElementById('progressSlider').value = percent;
      document.getElementById('currentTime').textContent = formatTime(state.playback.currentTime);
      document.getElementById('totalTime').textContent = formatTime(state.playback.duration);
    } else {
      document.getElementById('progressSlider').value = 0;
      document.getElementById('currentTime').textContent = '0:00';
      document.getElementById('totalTime').textContent = '0:00';
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


  // Listen to player state updates
  window.api.onPlayerState((newState) => {
    state.playback.isPlaying = newState === 'playing';
    updatePlayPauseButton();
  });

  window.api.onTimeUpdate((data) => {
    state.playback.currentTime = data.current;
    state.playback.duration = data.duration;
  });

  window.api.onQueueUpdate((queue) => {
    state.queue = {
      items: queue.queue || [],
      currentIndex: queue.index !== undefined ? queue.index : -1,
      shuffle: queue.shuffle || false,
      repeat: queue.repeat || 'off'
    };
    renderQueue();
    updateNowPlaying();
  });
}

// === ADD TO QUEUE ===
async function addToQueue() {
  const input = document.getElementById('ytInput');
  const value = input.value.trim();
  if (!value) return;

  try {
    await window.api.enqueueTrack(value);
    input.value = '';
  } catch (err) {
    alert('Error al agregar: ' + err.message);
  }
}

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
  const label = btn.querySelector('.label');
  label.textContent = state.queue.shuffle ? 'On' : 'Off';
  btn.classList.toggle('active', state.queue.shuffle);
}

function renderRepeatButton() {
  const btn = document.getElementById('btnRepeat');
  const label = btn.querySelector('.label');
  const modes = { off: 'Off', all: 'All', one: 'One' };
  label.textContent = modes[state.queue.repeat] || 'Off';
  btn.classList.toggle('active', state.queue.repeat !== 'off');
}

function updatePlayPauseButton() {
  const playBtn = document.getElementById('btnPlay');
  const pauseBtn = document.getElementById('btnPause');
  if (state.playback.isPlaying) {
    playBtn.style.display = 'none';
    pauseBtn.style.display = 'flex';
  } else {
    playBtn.style.display = 'flex';
    pauseBtn.style.display = 'none';
  }
}

// === PLAYLISTS ===
async function createPlaylist() {
  const input = document.getElementById('newPlaylistName');
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
}

async function deletePlaylist(id) {
  if (!confirm('¿Eliminar esta playlist?')) return;
  try {
    await window.api.deletePlaylist(id);
    await loadState();
    render();
  } catch (err) {
    alert('Error al eliminar: ' + err.message);
  }
}

async function enqueuePlaylist(id) {
  try {
    await window.api.enqueuePlaylist(id);
  } catch (err) {
    alert('Error al encolar playlist: ' + err.message);
  }
}

async function exportPlaylist(id) {
  try {
    await window.api.exportPlaylist(id);
  } catch (err) {
    alert('Error al exportar: ' + err.message);
  }
}

async function importPlaylist() {
  try {
    await window.api.importPlaylist();
    await loadState();
    render();
  } catch (err) {
    alert('Error al importar: ' + err.message);
  }
}

async function addTrackToPlaylist(trackIndex, playlistId) {
  const track = state.queue.items[trackIndex];
  if (!track) return;

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
}

async function playAtIndex(index) {
  try {
    await window.api.playAtIndex(index);
  } catch (err) {
    alert('Error al reproducir: ' + err.message);
  }
}

// === RENDER ===
function render() {
  renderPlaylists();
  renderQueue();
  renderShuffleButton();
  renderRepeatButton();
  updateNowPlaying();
}

function renderPlaylists() {
  const container = document.getElementById('playlistList');
  if (!state.playlists.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📂</div>
        <div class="empty-state-text">No hay playlists</div>
      </div>
    `;
    return;
  }

  container.innerHTML = state.playlists.map(pl => `
    <div class="item">
      <div class="info">
        <div class="name">${escapeHtml(pl.name)}</div>
        <div class="meta">${pl.items.length} canciones</div>
      </div>
      <div class="actions">
        <button onclick="enqueuePlaylist('${pl.id}')" title="Encolar">▶️</button>
        <button onclick="exportPlaylist('${pl.id}')" title="Exportar">📥</button>
        <button onclick="deletePlaylist('${pl.id}')" title="Eliminar">🗑️</button>
      </div>
    </div>
  `).join('');
}

function renderQueue() {
  const container = document.getElementById('queueList');
  const count = document.getElementById('queueCount');
  
  count.textContent = `${state.queue.items.length} ${state.queue.items.length === 1 ? 'canción' : 'canciones'}`;

  if (!state.queue.items.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎵</div>
        <div class="empty-state-text">Cola vacía. Agrega videos para comenzar.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = state.queue.items.map((track, i) => {
    const isActive = i === state.queue.currentIndex;
    const playlistOptions = state.playlists.map(pl => 
      `<option value="${pl.id}">${escapeHtml(pl.name)}</option>`
    ).join('');

    return `
      <div class="queue-item ${isActive ? 'active' : ''}" onclick="playAtIndex(${i})">
        <div class="queue-item-info">
          <div class="queue-item-title">${escapeHtml(track.title || track.videoId)}</div>
          <div class="queue-item-meta">Video ID: ${track.videoId}</div>
        </div>
        <div class="queue-item-actions">
          ${state.playlists.length > 0 ? `
            <select onchange="addTrackToPlaylist(${i}, this.value); this.value='';" onclick="event.stopPropagation();">
              <option value="">+ Playlist</option>
              ${playlistOptions}
            </select>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function updateNowPlaying() {
  const titleEl = document.getElementById('nowTitle');
  const metaEl = document.getElementById('nowMeta');

  if (state.queue.currentIndex >= 0 && state.queue.items[state.queue.currentIndex]) {
    const track = state.queue.items[state.queue.currentIndex];
    titleEl.textContent = track.title || track.videoId;
    metaEl.textContent = `Reproduciendo desde YouTube • ${state.queue.currentIndex + 1}/${state.queue.items.length}`;
  } else {
    titleEl.textContent = 'Sin reproducción';
    metaEl.textContent = 'Agrega un video a la cola para comenzar';
  }
}

// === PROGRESS UPDATE ===
function startProgressUpdate() {
  setInterval(() => {
    if (state.playback.duration > 0) {
      const percent = (state.playback.currentTime / state.playback.duration) * 1000;
      document.getElementById('progress').value = percent;
      document.getElementById('timeLabel').textContent = 
        `${formatTime(state.playback.currentTime)} / ${formatTime(state.playback.duration)}`;
    } else {
      document.getElementById('progress').value = 0;
      document.getElementById('timeLabel').textContent = '0:00 / 0:00';
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
