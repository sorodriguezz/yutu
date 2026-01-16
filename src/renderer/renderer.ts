type Playlist = { id: string; name: string; items: any[] };
type Settings = { accentColor: string; volumeDefault: number };

let playlists: Playlist[] = [];
let settings: Settings = { accentColor: "#4f46e5", volumeDefault: 60 };

let queue: any[] = [];
let queueIndex = -1;
let shuffle = false;
let repeat: "off" | "all" | "one" = "off";
let isMuted = false;
let volumeBeforeMute = 60;

const el = {
  newPlaylistName: document.getElementById("newPlaylistName") as HTMLInputElement,
  btnCreatePlaylist: document.getElementById("btnCreatePlaylist") as HTMLButtonElement,
  playlistList: document.getElementById("playlistList") as HTMLDivElement,

  ytInput: document.getElementById("ytInput") as HTMLInputElement,
  btnAddToQueue: document.getElementById("btnAddToQueue") as HTMLButtonElement,

  btnPrev: document.getElementById("btnPrev") as HTMLButtonElement,
  btnPlay: document.getElementById("btnPlay") as HTMLButtonElement,
  btnPause: document.getElementById("btnPause") as HTMLButtonElement,
  btnNext: document.getElementById("btnNext") as HTMLButtonElement,

  btnShuffle: document.getElementById("btnShuffle") as HTMLButtonElement,
  btnRepeat: document.getElementById("btnRepeat") as HTMLButtonElement,

  progress: document.getElementById("progress") as HTMLInputElement,
  timeLabel: document.getElementById("timeLabel") as HTMLSpanElement,
  volume: document.getElementById("volume") as HTMLInputElement,

  nowTitle: document.getElementById("nowTitle") as HTMLDivElement,
  nowMeta: document.getElementById("nowMeta") as HTMLDivElement,

  queueList: document.getElementById("queueList") as HTMLDivElement,

  accentColor: document.getElementById("accentColor") as HTMLInputElement,
  btnSaveTheme: document.getElementById("btnSaveTheme") as HTMLButtonElement,

  btnExportPlaylist: document.getElementById("btnExportPlaylist") as HTMLButtonElement,
  btnImportPlaylist: document.getElementById("btnImportPlaylist") as HTMLButtonElement,

  btnMute: document.getElementById("btnMute") as HTMLButtonElement,
  volumeIcon: document.getElementById("volumeIcon") as unknown as SVGElement,
  muteIcon: document.getElementById("muteIcon") as unknown as SVGElement
};

function setAccent(color: string) {
  document.documentElement.style.setProperty("--accent", color);
}

function updateMuteUI() {
  if (isMuted) {
    el.volumeIcon.style.display = "none";
    el.muteIcon.style.display = "block";
    el.btnMute.title = "Activar sonido";
  } else {
    el.volumeIcon.style.display = "block";
    el.muteIcon.style.display = "none";
    el.btnMute.title = "Silenciar";
  }
}

function fmtTime(sec: number) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function refreshState() {
  const state = await window.api.getState();
  playlists = state.playlists;
  settings = state.settings;

  const qs = state.queue;
  queue = qs.queue;
  queueIndex = qs.index;
  shuffle = qs.shuffle;
  repeat = qs.repeat;

  setAccent(settings.accentColor);
  el.accentColor.value = settings.accentColor;
  el.volume.value = String(settings.volumeDefault);

  renderPlaylists();
  renderQueue();
  syncPlaybackFlags();
}

function syncPlaybackFlags() {
  el.btnShuffle.textContent = `Shuffle: ${shuffle ? "on" : "off"}`;
  el.btnRepeat.textContent = `Repeat: ${repeat}`;
}

function renderPlaylists() {
  el.playlistList.innerHTML = "";
  playlists.forEach(pl => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div>
        <div><b>${pl.name}</b></div>
        <div class="meta">${pl.items.length} items</div>
      </div>
      <div class="row">
        <button data-act="enqueue" data-id="${pl.id}" class="accent">▶ Cola</button>
        <button data-act="export" data-id="${pl.id}">Export</button>
        <button data-act="delete" data-id="${pl.id}">🗑</button>
      </div>
    `;
    el.playlistList.appendChild(div);
  });

  el.playlistList.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", async () => {
      const act = (btn as HTMLButtonElement).dataset.act!;
      const id = (btn as HTMLButtonElement).dataset.id!;

      if (act === "enqueue") await window.api.queue.enqueuePlaylist(id);
      if (act === "export") await window.api.playlist.export(id);
      if (act === "delete") await window.api.playlist.delete(id);

      await refreshState();
      if (queueIndex === 0 && queue.length > 0) await window.api.queue.playAt(0);
    });
  });
}

function renderQueue() {
  el.queueList.innerHTML = "";
  queue.forEach((it, idx) => {
    const title = it.title ?? it.videoId;
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div>
        <div><b>${idx === queueIndex ? "▶ " : ""}${title}</b></div>
        <div class="meta">${it.videoId}</div>
      </div>
      <div class="row">
        <button data-act="play" data-idx="${idx}" class="accent">Play</button>
        <button data-act="addToPlaylist" data-idx="${idx}">+Playlist</button>
      </div>
    `;
    el.queueList.appendChild(div);
  });

  el.queueList.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", async () => {
      const act = (btn as HTMLButtonElement).dataset.act!;
      const idx = Number((btn as HTMLButtonElement).dataset.idx);
      const item = queue[idx];
      if (!item) return;

      if (act === "play") {
        await window.api.queue.playAt(idx);
      }

      if (act === "addToPlaylist") {
        const name = prompt("Nombre exacto de playlist:");
        if (!name) return;
        const pl = playlists.find(p => p.name.toLowerCase() === name.toLowerCase());
        if (!pl) return alert("No encontrada.");

        await window.api.playlist.addTrack({ playlistId: pl.id, videoId: item.videoId, title: item.title });
      }

      await refreshState();
    });
  });
}

function bindUI() {
  el.btnCreatePlaylist.addEventListener("click", async () => {
    await window.api.playlist.create(el.newPlaylistName.value);
    el.newPlaylistName.value = "";
    await refreshState();
  });

  el.btnAddToQueue.addEventListener("click", async () => {
    const vid = await window.api.util.parseVideoId(el.ytInput.value);
    if (!vid) return alert("URL/VideoId inválido.");

    await window.api.queue.enqueueTrack({
      id: cryptoRandomId(),
      provider: "youtube",
      videoId: vid,
      title: undefined,
      addedAt: Date.now()
    });

    el.ytInput.value = "";
    await refreshState();

    // autoplay primer item
    if (queueIndex === 0 && queue.length > 0) await window.api.queue.playAt(0);
  });

  el.btnPlay.addEventListener("click", async () => window.api.player.play());
  el.btnPause.addEventListener("click", async () => window.api.player.pause());
  el.btnNext.addEventListener("click", async () => { await window.api.queue.next(); await refreshState(); });
  el.btnPrev.addEventListener("click", async () => { await window.api.queue.prev(); await refreshState(); });

  el.btnShuffle.addEventListener("click", async () => {
    await window.api.queue.toggleShuffle();
    await refreshState();
  });

  el.btnRepeat.addEventListener("click", async () => {
    await window.api.queue.cycleRepeat();
    await refreshState();
  });

  el.progress.addEventListener("change", async () => {
    const seconds = Number(el.progress.value) / 1000;
    await window.api.player.seek(seconds);
  });

  el.volume.addEventListener("input", async () => {
    const v = Number(el.volume.value);
    await window.api.player.setVolume(v);
    await window.api.settings.setVolumeDefault(v);
    
    // Si cambiamos el volumen manualmente, desactivar mute
    if (isMuted && v > 0) {
      isMuted = false;
      updateMuteUI();
    }
  });

  el.btnMute.addEventListener("click", async () => {
    if (isMuted) {
      // Unmute: restaurar volumen anterior
      isMuted = false;
      el.volume.value = String(volumeBeforeMute);
      await window.api.player.setVolume(volumeBeforeMute);
    } else {
      // Mute: guardar volumen actual y poner en 0
      volumeBeforeMute = Number(el.volume.value) || 60;
      isMuted = true;
      el.volume.value = "0";
      await window.api.player.setVolume(0);
    }
    updateMuteUI();
  });

  el.btnSaveTheme.addEventListener("click", async () => {
    await window.api.settings.setAccent(el.accentColor.value);
    await refreshState();
  });

  el.btnExportPlaylist.addEventListener("click", async () => {
    const name = prompt("Nombre exacto de playlist a exportar:");
    if (!name) return;
    const pl = playlists.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (!pl) return alert("No encontrada.");
    await window.api.playlist.export(pl.id);
  });

  el.btnImportPlaylist.addEventListener("click", async () => {
    await window.api.playlist.import();
    await refreshState();
  });

  window.api.onPlayerEvent(async (evt: any) => {
    if (evt.type === "time") {
      const cur = Number(evt.data.current) || 0;
      const dur = Number(evt.data.duration) || 0;

      if (!el.progress.matches(":active")) {
        el.progress.max = String(Math.max(1, Math.floor(dur * 1000)));
        el.progress.value = String(Math.floor(cur * 1000));
      }
      el.timeLabel.textContent = `${fmtTime(cur)} / ${fmtTime(dur)}`;
    }

    if (evt.type === "ended") {
      await window.api.queue.next();
      await refreshState();
    }
  });
}

function cryptoRandomId(): string {
  // Renderer no tiene Node crypto; esto es suficiente para IDs temporales en cola.
  // Los IDs definitivos de playlist tracks se generan en Main.
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

async function bootstrap() {
  bindUI();
  await refreshState();
}

bootstrap().catch(console.error);