// ════════════════════════════════════════════════════════════
// YUTU · Synthwave Player — renderer logic
// ════════════════════════════════════════════════════════════

let state = {
  playlists: [],
  settings: { accentColor: '#ff2e97', volumeDefault: 60 },
  queue: { items: [], currentIndex: -1, shuffle: false, repeat: 'off' },
  playback: { isPlaying: false, currentTime: 0, duration: 0 },
  profile: null,
  videoVisible: false,
  selectedPlaylist: null,
  viewMode: 'queue'
};

let isMuted = false;
let volumeBeforeMute = 60;
let lastQueueHash = '';
let isSeeking = false;

// Signature of the queue so the 1s background sync doesn't re-render
// (and destroy open dropdowns) when nothing actually changed.
function queueHash(q) {
  return JSON.stringify({
    ids: (q.items || []).map(t => t.id),
    i: q.currentIndex,
    sh: q.shuffle,
    rp: q.repeat
  });
}

// ─── helpers ───────────────────────────────────────────────
function $(id) { return document.getElementById(id); }

// ─── SVG line icons (currentColor, estilo del resto de la UI) ──
const ICONS = {
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  film: '<rect x="2.5" y="3.5" width="19" height="17" rx="2"/><line x1="7" y1="3.5" x2="7" y2="20.5"/><line x1="17" y1="3.5" x2="17" y2="20.5"/><line x1="2.5" y1="12" x2="21.5" y2="12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  play: '<polygon points="6 4 20 12 6 20" fill="currentColor" stroke="none"/>',
  back: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  warning: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
};
function icon(name, size) {
  size = size || 16;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

function formatTime(seconds) {
  if (!seconds || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function isLocal(track) { return track && track.provider === 'local'; }

function trackThumb(track) {
  if (!track) return null;
  if (track.thumbnail) return track.thumbnail;
  if (track.provider === 'youtube' && track.videoId) return `https://i.ytimg.com/vi/${track.videoId}/mqdefault.jpg`;
  return null;
}

// Full descriptor so local files keep provider/filePath/mediaType when saved
function trackPayload(t) {
  return {
    provider: t.provider,
    videoId: t.videoId,
    filePath: t.filePath,
    mediaType: t.mediaType,
    title: t.title,
    author: t.author,
    thumbnail: t.thumbnail,
    duration: t.duration,
  };
}

// ─── toast / confirm ───────────────────────────────────────
function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

function showConfirm(message, onConfirm) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-card confirm-card">
      <div class="confirm-icon" style="color:var(--neon-pink)">${icon('warning', 34)}</div>
      <div class="confirm-message">${escapeHtml(message)}</div>
      <div class="confirm-actions">
        <button class="pill-btn ghost" data-act="cancel">Cancelar</button>
        <button class="pill-btn" data-act="ok">Aceptar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('[data-act="cancel"]').onclick = () => modal.remove();
  modal.querySelector('[data-act="ok"]').onclick = () => { modal.remove(); onConfirm && onConfirm(); };
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

// ─── metadata (YouTube oEmbed for missing titles) ──────────
const metadataCache = new Map();
async function fetchVideoMetadata(videoId) {
  if (metadataCache.has(videoId)) return metadataCache.get(videoId);
  try {
    const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (!r.ok) throw new Error('meta');
    const d = await r.json();
    const m = { title: d.title, author: d.author_name };
    metadataCache.set(videoId, m);
    return m;
  } catch {
    const fb = { title: videoId, author: 'YouTube' };
    metadataCache.set(videoId, fb);
    return fb;
  }
}
async function fetchMetadataForTracks(tracks) {
  const need = tracks.filter(t => t.provider === 'youtube' && (!t.title || t.title === t.videoId));
  for (const t of need) {
    const m = await fetchVideoMetadata(t.videoId);
    t.title = m.title; t.author = m.author;
  }
}

// ════ INIT ════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
  setupEventListeners();
  render();
  startProgressLoop();
});

async function loadState() {
  try {
    const data = await window.api.getState();
    state.playlists = data.playlists || [];
    state.settings = data.settings || state.settings;

    const q = data.queue || { queue: [], index: -1, shuffle: false, repeat: 'off' };
    state.queue = {
      items: q.queue || [],
      currentIndex: q.index !== undefined ? q.index : -1,
      shuffle: !!q.shuffle,
      repeat: q.repeat || 'off'
    };

    applyAccent(state.settings.accentColor || '#ff2e97');
    initSettingsUI();

    fetchMetadataForTracks(state.queue.items).then(() => render());
  } catch (err) { console.error('loadState', err); }
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
}
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

// Deriva una paleta synthwave armónica del color de acento:
// acento (primario) + complementario (pop) + sombra del mismo tono (profundidad).
function applyAccent(color) {
  const root = document.documentElement.style;
  const [ar, ag, ab] = hexToRgb(color);
  const [h, s, l] = rgbToHsl(ar, ag, ab);

  root.setProperty('--accent', color);
  root.setProperty('--accent-rgb', `${ar}, ${ag}, ${ab}`);
  const lum = 0.2126 * ar / 255 + 0.7152 * ag / 255 + 0.0722 * ab / 255;
  root.setProperty('--accent-text', lum > 0.62 ? '#0a0613' : '#ffffff');

  const soft = hslToRgb(h, Math.min(s, 95), Math.min(l + 16, 88));
  root.setProperty('--neon-pink-soft', `rgb(${soft[0]}, ${soft[1]}, ${soft[2]})`);

  const comp = hslToRgb(h + 180, Math.max(s, 72), 58); // complementario vibrante
  root.setProperty('--neon-cyan', `rgb(${comp[0]}, ${comp[1]}, ${comp[2]})`);
  root.setProperty('--cyan-rgb', `${comp[0]}, ${comp[1]}, ${comp[2]}`);

  const deep = hslToRgb(h, Math.max(s - 6, 45), Math.max(l - 26, 24)); // sombra para gradientes
  root.setProperty('--neon-purple', `rgb(${deep[0]}, ${deep[1]}, ${deep[2]})`);
  root.setProperty('--purple-rgb', `${deep[0]}, ${deep[1]}, ${deep[2]}`);
}

function initSettingsUI() {
  const s = state.settings;
  if ($('accentColor')) $('accentColor').value = s.accentColor || '#ff2e97';
  if ($('volumeDefault')) { $('volumeDefault').value = s.volumeDefault; updateSlider($('volumeDefault'), s.volumeDefault, 100); }
  if ($('volumeDefaultLabel')) $('volumeDefaultLabel').textContent = s.volumeDefault;

  const vol = $('volume'); const volLabel = $('volumeLabel');
  if (vol) { vol.value = s.volumeDefault; updateSlider(vol, s.volumeDefault, 100); }
  if (volLabel) volLabel.textContent = s.volumeDefault;
  window.api.setVolume(s.volumeDefault);
  volumeBeforeMute = s.volumeDefault;
}

// ════ EVENT LISTENERS ═════════════════════════════════════
function setupEventListeners() {
  const ytInput = $('ytInput');
  // Enter = buscar en YouTube. Para pegar una URL/ID usa el botón "+ URL".
  if (ytInput) ytInput.onkeypress = (e) => { if (e.key === 'Enter') { e.preventDefault(); searchYouTube(); } };

  if ($('btnToggleVideo')) $('btnToggleVideo').onclick = toggleVideo;
  if ($('btnPlayPause')) $('btnPlayPause').onclick = togglePlayPause;
  // shuffle / prev / next / repeat usan onclick inline en el HTML (binding garantizado)
  if ($('btnNext')) $('btnNext').onclick = nextTrack;
  if ($('btnPrev')) $('btnPrev').onclick = prevTrack;
  if ($('btnShuffle')) $('btnShuffle').onclick = toggleShuffle;
  if ($('btnRepeat')) $('btnRepeat').onclick = cycleRepeat;

  const vol = $('volume');
  if (vol) vol.oninput = (e) => {
    const v = parseInt(e.target.value);
    if ($('volumeLabel')) $('volumeLabel').textContent = v;
    updateSlider(vol, v, 100);
    window.api.setVolume(v);
    if (isMuted && v > 0) { isMuted = false; updateMuteUI(); }
  };

  const btnMute = $('btnMute');
  if (btnMute) btnMute.onclick = () => {
    const vol = $('volume');
    if (isMuted) {
      isMuted = false; vol.value = volumeBeforeMute; updateSlider(vol, volumeBeforeMute, 100);
      if ($('volumeLabel')) $('volumeLabel').textContent = volumeBeforeMute;
      window.api.setVolume(volumeBeforeMute);
    } else {
      volumeBeforeMute = parseInt(vol.value) || 60; isMuted = true;
      vol.value = 0; updateSlider(vol, 0, 100);
      if ($('volumeLabel')) $('volumeLabel').textContent = '0';
      window.api.setVolume(0);
    }
    updateMuteUI();
  };

  const progress = $('progress');
  if (progress) {
    // Mientras arrastras, marca "seeking" para que el timer no pelee con tu dedo
    progress.oninput = (e) => {
      isSeeking = true;
      const v = parseInt(e.target.value);
      updateSlider(progress, v, 1000);
      const tl = $('timeLabel');
      if (tl && state.playback.duration > 0) tl.textContent = formatTime((v / 1000) * state.playback.duration);
    };
    progress.onchange = (e) => {
      if (state.playback.duration > 0) window.api.seek((parseInt(e.target.value) / 1000) * state.playback.duration);
      isSeeking = false;
    };
  }

  if ($('accentColor')) $('accentColor').oninput = async (e) => {
    applyAccent(e.target.value); await window.api.setAccentColor(e.target.value); state.settings.accentColor = e.target.value;
  };
  if ($('volumeDefault')) $('volumeDefault').oninput = async (e) => {
    const v = parseInt(e.target.value);
    if ($('volumeDefaultLabel')) $('volumeDefaultLabel').textContent = v;
    updateSlider($('volumeDefault'), v, 100);
    await window.api.setVolumeDefault(v); state.settings.volumeDefault = v;
  };

  // delegated add-to-playlist select
  document.addEventListener('change', async (e) => {
    if (e.target.classList && e.target.classList.contains('add-to-playlist-select')) {
      const i = parseInt(e.target.dataset.trackIndex);
      const pid = e.target.value;
      const source = e.target.dataset.source || 'queue';
      if (pid) { await addTrackToPlaylist(i, pid, source); e.target.value = ''; }
    }
  });

  window.api.onPlayerState((s) => { setPlaying(s === 'playing'); });
  window.api.onTimeUpdate((d) => { state.playback.currentTime = d.current; state.playback.duration = d.duration; });
  window.api.onQueueUpdate((q) => {
    const nq = { items: q.queue || [], currentIndex: q.index ?? -1, shuffle: !!q.shuffle, repeat: q.repeat || 'off' };
    const h = queueHash(nq);
    if (h === lastQueueHash) return; // nada cambió → no re-render (evita el parpadeo del select)
    lastQueueHash = h;
    state.queue = nq;
    fetchMetadataForTracks(state.queue.items).then(() => render());
    render();
  });
}

function setPlaying(playing) {
  state.playback.isPlaying = playing;
  document.body.classList.toggle('playing', playing);
  const pi = $('playIcon'), pa = $('pauseIcon');
  if (pi && pa) { pi.style.display = playing ? 'none' : 'block'; pa.style.display = playing ? 'block' : 'none'; }
}

// ════ ACTIONS ═════════════════════════════════════════════
window.addLocalFiles = async function () {
  try {
    const res = await window.api.addLocalFiles();
    if (res && res.added > 0) { await loadState(); render(); showToast(`🎧 ${res.added} archivo(s) agregado(s)`); }
  } catch (err) { showToast('❌ ' + err.message); }
};

window.createPlaylistPrompt = function () {
  const i = $('newPlaylistName');
  if (!i) return;
  if (i.value.trim()) createPlaylist(); // si ya hay nombre, crea
  else i.focus();                       // si está vacío, enfoca para escribir
};

window.createPlaylist = async function () {
  const input = $('newPlaylistName');
  const name = input ? input.value.trim() : '';
  if (!name) return;
  try { await window.api.createPlaylist(name); input.value = ''; await loadState(); render(); showToast('✅ Playlist creada'); }
  catch (err) { showToast('❌ ' + err.message); }
};

window.importPlaylist = async function () {
  try { await window.api.importPlaylist(); await loadState(); render(); showToast('✅ Playlist importada'); }
  catch (err) { showToast('❌ ' + err.message); }
};

window.deletePlaylist = function (id) {
  showConfirm('¿Eliminar esta playlist?', async () => {
    try {
      await window.api.deletePlaylist(id);
      // si estabas viendo esa playlist, vuelve a la cola; y fuerza refresco
      if (state.selectedPlaylist && state.selectedPlaylist.id === id) { state.selectedPlaylist = null; state.viewMode = 'queue'; }
      lastQueueHash = '';
      state.playback = { isPlaying: false, currentTime: 0, duration: 0 };
      setPlaying(false);
      await loadState(); render(); showToast('🗑 Playlist eliminada');
    } catch (err) { showToast('❌ ' + err.message); }
  });
};

window.exportPlaylist = async function (id) {
  try { await window.api.exportPlaylist(id); showToast('⬇ Playlist exportada'); }
  catch (err) { showToast('❌ ' + err.message); }
};

window.openPlaylist = function (id) {
  const pl = state.playlists.find(p => p.id === id);
  if (pl) { state.selectedPlaylist = pl; state.viewMode = 'playlist'; render(); }
};
window.backToQueue = function () { state.selectedPlaylist = null; state.viewMode = 'queue'; render(); };

window.playFromPlaylist = async function (playlistId, index) {
  try { await window.api.enqueuePlaylist(playlistId, index); await window.api.playAtIndex(index); backToQueue(); }
  catch (err) { showToast('❌ ' + err.message); }
};

window.removeFromPlaylist = async function (playlistId, trackId) {
  try {
    await window.api.removeTrackFromPlaylist(playlistId, trackId);
    await loadState();
    if (state.selectedPlaylist && state.selectedPlaylist.id === playlistId)
      state.selectedPlaylist = state.playlists.find(p => p.id === playlistId);
    render(); showToast('🗑 Eliminada de la playlist');
  } catch (err) { showToast('❌ ' + err.message); }
};

window.playAtIndex = async function (i) {
  try { await window.api.playAtIndex(i); } catch (err) { showToast('❌ ' + err.message); }
};

window.removeFromQueue = function (index) {
  state.queue.items.splice(index, 1);
  if (state.queue.currentIndex >= index && state.queue.currentIndex > 0) state.queue.currentIndex--;
  render();
};

window.copyYoutubeLink = async function (videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  try { await navigator.clipboard.writeText(url); showToast('🔗 Link copiado'); }
  catch { showToast('🔗 ' + url); }
};

window.togglePlayPause = async function () {
  const r = await window.api.playPause();
  if (r && r.isPlaying !== undefined) setPlaying(r.isPlaying);
};

window.addToQueue = async function () {
  const input = $('ytInput');
  const value = input ? input.value.trim() : '';
  if (!value) { showToast('⚠️ Ingresa una URL o ID'); return; }
  try {
    const wasEmpty = state.queue.items.length === 0;
    await window.api.enqueueTrack(value);
    input.value = '';
    setTimeout(async () => {
      const added = state.queue.items[state.queue.items.length - 1];
      if (added && added.provider === 'youtube' && (!added.title || added.title === added.videoId)) {
        const m = await fetchVideoMetadata(added.videoId); added.title = m.title; added.author = m.author;
      }
      if (added && state.playlists.length > 0) showAddToPlaylistModal(added);
      if (wasEmpty) await window.api.playAtIndex(0);
    }, 500);
  } catch (err) { showToast('❌ ' + err.message); }
};

window.nextTrack = function () { window.api.next().catch((e) => console.error('next', e)); };
window.prevTrack = function () { window.api.prev().catch((e) => console.error('prev', e)); };

window.toggleShuffle = async function () {
  state.queue.shuffle = !state.queue.shuffle; // optimista: feedback inmediato
  renderTransport();
  try { await window.api.toggleShuffle(); } catch (e) { console.error('shuffle', e); }
};
window.cycleRepeat = async function () {
  const modes = ['off', 'all', 'one'];
  state.queue.repeat = modes[(modes.indexOf(state.queue.repeat) + 1) % 3]; // optimista
  renderTransport();
  try { await window.api.cycleRepeat(); } catch (e) { console.error('repeat', e); }
};

async function toggleVideo() {
  state.videoVisible = !state.videoVisible;
  try { await window.api.toggleVideo(state.videoVisible); } catch {}
  const b = $('btnToggleVideo');
  if (b) b.classList.toggle('active', state.videoVisible);
}

// ════ ADD-TO-PLAYLIST MODAL ═══════════════════════════════
let pendingTrack = null;
window.showAddToPlaylistModal = function (track) {
  pendingTrack = track;
  const modal = $('addToPlaylistModal');
  $('addedTrackName').textContent = track.title || track.videoId || 'Pista';
  const opts = $('playlistOptions');
  if (!state.playlists.length) opts.innerHTML = '<p class="no-playlists">No tienes playlists todavía.</p>';
  else opts.innerHTML = state.playlists.map(pl => `
    <div class="opt" onclick="addPendingToPlaylist('${pl.id}')">
      <div class="opt-ico">${icon('music', 16)}</div>
      <div style="flex:1"><div class="opt-name">${escapeHtml(pl.name)}</div><div class="opt-sub">${pl.items.length} pistas</div></div>
    </div>`).join('');
  modal.classList.remove('hidden');
};
window.closeAddToPlaylistModal = function () { $('addToPlaylistModal').classList.add('hidden'); pendingTrack = null; };
window.addPendingToPlaylist = async function (pid) {
  if (!pendingTrack) return;
  try {
    await window.api.addTrackToPlaylist(pid, trackPayload(pendingTrack));
    await loadState(); render(); closeAddToPlaylistModal(); showToast('✅ Agregado a playlist');
  } catch (err) { showToast('❌ ' + err.message); }
};
window.addTrackToPlaylist = async function (index, pid, source) {
  const list = (source === 'playlist' && state.selectedPlaylist) ? state.selectedPlaylist.items : state.queue.items;
  const t = list[index];
  if (!t || !pid) return;
  try { await window.api.addTrackToPlaylist(pid, trackPayload(t)); await loadState(); render(); showToast('✅ Agregado a playlist'); }
  catch (err) { showToast('❌ ' + err.message); }
};

// ════ SETTINGS ════════════════════════════════════════════
window.toggleSettings = function () { $('settingsPanel').classList.toggle('hidden'); };

// ════ YOUTUBE SEARCH ══════════════════════════════════════
window.searchYouTube = async function () {
  const q = ($('ytInput').value || '').trim();
  if (!q) { showToast('⚠️ Escribe algo para buscar'); return; }
  const panel = $('searchResults'), content = $('searchResultsContent');
  panel.classList.remove('hidden');
  content.innerHTML = '<div class="search-loading">Buscando en YouTube…</div>';
  try {
    const results = await window.api.searchYouTube(q);
    if (!results || !results.length) {
      content.innerHTML = '<div class="search-empty">Sin resultados. Intenta con otra búsqueda.</div>';
      return;
    }
    content.innerHTML = results.map(r => `
      <div class="search-result-item" onclick="addSearchResultToQueue('${r.videoId}')">
        <img class="search-result-thumb" src="${r.thumbnail}" alt="">
        <div class="search-result-info">
          <div class="search-result-title">${escapeHtml(r.title)}</div>
          <div class="search-result-author">${escapeHtml(r.author)}</div>
        </div>
      </div>`).join('');
  } catch (err) {
    content.innerHTML = '<div class="search-error">Error al buscar.</div>';
  }
};
window.addSearchResultToQueue = async function (videoId) {
  try { await window.api.enqueueTrack(videoId); showToast('✅ Agregado a la cola'); closeSearchResults(); }
  catch { showToast('❌ Error al agregar'); }
};
window.closeSearchResults = function () { $('searchResults').classList.add('hidden'); $('ytInput').value = ''; };

// ════ RENDER ══════════════════════════════════════════════
function render() {
  renderPlaylists();
  if (state.viewMode === 'playlist' && state.selectedPlaylist) renderPlaylistView();
  else renderQueue();
  renderTransport();
  renderNowPlaying();
}

function renderPlaylists() {
  const c = $('playlistList');
  if (!c) return;
  if (!state.playlists.length) {
    c.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${icon('folder', 30)}</div><div class="empty-state-text">Sin playlists aún</div></div>`;
    return;
  }
  c.innerHTML = state.playlists.map(pl => `
    <div class="playlist-item" onclick="openPlaylist('${pl.id}')">
      <div class="playlist-cover">${icon('music', 18)}</div>
      <div class="playlist-details">
        <div class="playlist-name">${escapeHtml(pl.name)}</div>
        <div class="playlist-meta">${pl.items.length} pistas</div>
      </div>
      <div class="playlist-actions">
        <button onclick="event.stopPropagation(); exportPlaylist('${pl.id}')" title="Exportar">${icon('download', 15)}</button>
        <button onclick="event.stopPropagation(); deletePlaylist('${pl.id}')" title="Eliminar">${icon('trash', 15)}</button>
      </div>
    </div>`).join('');
}

function queueItemHtml(track, i, opts) {
  const active = opts.active;
  const local = isLocal(track);
  const thumb = trackThumb(track);
  const thumbHtml = thumb
    ? `<img src="${thumb}" alt="">`
    : `<span class="ph">${local && track.mediaType === 'video' ? icon('film', 18) : icon('music', 18)}</span>`;
  const tag = local ? '<span class="tag local">Local</span>' : '<span class="tag yt">YouTube</span>';
  const author = escapeHtml(track.author || (local ? 'Archivo local' : 'YouTube'));
  // En la vista de una playlist no ofrezcas la playlist actual (evita duplicar)
  const curPlId = (state.viewMode === 'playlist' && state.selectedPlaylist) ? state.selectedPlaylist.id : null;
  const addable = state.playlists.filter(pl => pl.id !== curPlId);
  const plOpts = addable.map(pl => `<option value="${pl.id}">${escapeHtml(pl.name)}</option>`).join('');
  const copyBtn = (!local && track.videoId)
    ? `<button onclick="event.stopPropagation(); copyYoutubeLink('${track.videoId}')" title="Copiar link">${icon('link', 14)}</button>` : '';
  const plSelect = addable.length
    ? `<select class="add-to-playlist-select" data-track-index="${i}" data-source="${curPlId ? 'playlist' : 'queue'}" onclick="event.stopPropagation();"><option value="">+ Playlist</option>${plOpts}</select>` : '';
  return `
    <div class="queue-item ${active ? 'active' : ''}" onclick="${opts.onclick}">
      <div class="queue-item-index">${active ? icon('play', 11) : i + 1}</div>
      <div class="queue-thumb">${thumbHtml}</div>
      <div class="queue-item-info">
        <div class="queue-item-title">${escapeHtml(track.title || track.videoId || 'Pista')}</div>
        <div class="queue-item-meta">${tag}${author}</div>
      </div>
      <div class="queue-item-actions">
        ${copyBtn}${plSelect}
        ${opts.removeBtn}
      </div>
    </div>`;
}

function renderQueue() {
  const c = $('queueItems'), count = $('queueCount'), title = $('queueTitle');
  if (title) title.textContent = 'Cola de reproducción';
  if (count) count.textContent = `${state.queue.items.length} ${state.queue.items.length === 1 ? 'pista' : 'pistas'}`;
  if (!c) return;
  if (!state.queue.items.length) {
    c.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${icon('music', 30)}</div><div class="empty-state-text">Cola vacía. Agrega música local o de YouTube.</div></div>`;
    return;
  }
  c.innerHTML = state.queue.items.map((t, i) => queueItemHtml(t, i, {
    active: i === state.queue.currentIndex,
    onclick: `playAtIndex(${i})`,
    removeBtn: `<button onclick="event.stopPropagation(); removeFromQueue(${i})" title="Quitar">${icon('x', 14)}</button>`
  })).join('');
}

function renderPlaylistView() {
  const c = $('queueItems'), count = $('queueCount'), title = $('queueTitle');
  const pl = state.selectedPlaylist;
  if (!pl || !c) return;
  if (title) title.innerHTML = `<button class="back-btn" onclick="backToQueue()" title="Volver">${icon('back', 18)}</button>${escapeHtml(pl.name)}`;
  if (count) count.textContent = `${pl.items.length} ${pl.items.length === 1 ? 'pista' : 'pistas'}`;
  if (!pl.items.length) {
    c.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${icon('folder', 30)}</div><div class="empty-state-text">Playlist vacía.</div></div>`;
    return;
  }
  c.innerHTML = `<button class="play-all-btn" onclick="playFromPlaylist('${pl.id}', 0)">${icon('play', 14)} Reproducir todo</button>` +
    pl.items.map((t, i) => queueItemHtml(t, i, {
      active: false,
      onclick: `playFromPlaylist('${pl.id}', ${i})`,
      removeBtn: `<button onclick="event.stopPropagation(); removeFromPlaylist('${pl.id}', '${t.id}')" title="Quitar">${icon('trash', 15)}</button>`
    })).join('');
}

function repeatIconSvg(one) {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    `<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>` +
    (one ? `<text x="12" y="14.5" font-size="9" font-weight="800" text-anchor="middle" fill="currentColor" stroke="none">1</text>` : '') +
    `</svg>`;
}

function renderTransport() {
  const sh = $('btnShuffle'); if (sh) sh.classList.toggle('active', state.queue.shuffle);
  const rp = $('btnRepeat');
  if (rp) {
    rp.classList.toggle('active', state.queue.repeat !== 'off');
    rp.title = state.queue.repeat === 'one' ? 'Repetir una' : state.queue.repeat === 'all' ? 'Repetir todo' : 'Repetir';
    rp.innerHTML = repeatIconSvg(state.queue.repeat === 'one');
  }
}

function renderNowPlaying() {
  const cur = state.queue.currentIndex >= 0 ? state.queue.items[state.queue.currentIndex] : null;
  const heroImg = $('heroImg'), heroFallback = $('heroFallback'), heroBadge = $('heroBadge');
  const pbImg = $('playerThumbImg'), pbIcon = $('playerThumbIcon');

  if (cur) {
    const thumb = trackThumb(cur);
    if (thumb) {
      heroImg.src = thumb; heroImg.style.display = 'block'; heroFallback.style.display = 'none';
      pbImg.src = thumb; pbImg.style.display = 'block'; pbIcon.style.display = 'none';
    } else {
      heroImg.style.display = 'none'; heroFallback.style.display = 'grid';
      pbImg.style.display = 'none'; pbIcon.style.display = 'grid';
    }
    heroBadge.classList.remove('hidden');
    heroBadge.textContent = isLocal(cur) ? 'Local' : 'YouTube';
    heroBadge.className = 'src-badge ' + (isLocal(cur) ? 'local' : 'yt');
    $('nowTitle').textContent = cur.title || cur.videoId || 'Pista';
    $('nowMeta').textContent = cur.author || (isLocal(cur) ? 'Archivo local' : 'YouTube');
    $('playerTrackName').textContent = cur.title || cur.videoId || 'Pista';
    $('playerTrackMeta').textContent = cur.author || (isLocal(cur) ? 'Archivo local' : 'YouTube');
  } else {
    heroImg.style.display = 'none'; heroFallback.style.display = 'grid'; heroBadge.classList.add('hidden');
    pbImg.style.display = 'none'; pbIcon.style.display = 'grid';
    $('nowTitle').textContent = 'Nada sonando';
    $('nowMeta').textContent = 'Agrega música local o de YouTube para empezar';
    $('playerTrackName').textContent = '—';
    $('playerTrackMeta').textContent = '—';
  }
}

// ════ SLIDERS / PROGRESS ══════════════════════════════════
function updateSlider(slider, value, max) {
  const pct = (value / max) * 100;
  slider.style.background = `linear-gradient(to right, var(--accent) ${pct}%, rgba(255,255,255,0.12) ${pct}%)`;
}

function updateMuteUI() {
  const v = $('volumeIcon'), m = $('muteIcon');
  if (v && m) { v.style.display = isMuted ? 'none' : 'block'; m.style.display = isMuted ? 'block' : 'none'; }
}

function startProgressLoop() {
  setInterval(() => {
    if (isSeeking) return; // no pelear con el arrastre del usuario
    const p = $('progress'), tl = $('timeLabel'), dl = $('durationLabel');
    if (state.playback.duration > 0) {
      const pct = (state.playback.currentTime / state.playback.duration) * 1000;
      if (p) { p.value = pct; updateSlider(p, pct, 1000); }
      if (tl) tl.textContent = formatTime(state.playback.currentTime);
      if (dl) dl.textContent = formatTime(state.playback.duration);
    } else {
      if (p) { p.value = 0; updateSlider(p, 0, 1000); }
      if (tl) tl.textContent = '0:00';
      if (dl) dl.textContent = '0:00';
    }
  }, 250);
}
