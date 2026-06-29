import { app, BrowserWindow, dialog, ipcMain, Notification, shell, WebContentsView } from "electron";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parseVideoId } from "../infra/util/youtube";
import { AppContainer } from "../di/container";
import { Track } from "../../core/domain/entities/Track";
import { toPlayableMedia } from "../../core/application/services/toPlayableMedia";

const AUDIO_EXTS = new Set([
  ".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".opus", ".wma",
]);

// Carga un módulo ESM (music-metadata) desde CommonJS sin que tsc
// transforme el import() dinámico a require().
const importEsm = new Function("m", "return import(m)") as (m: string) => Promise<any>;

type YtmController = {
  setYtMusic: (visible: boolean) => boolean;
  getCurrentVideoId: () => Promise<string | null>;
  setBlockAds: (enabled: boolean) => boolean;
  home: () => void;
  goBack: () => void;
};

export function registerIpc(
  win: () => BrowserWindow | null,
  c: AppContainer,
  getPlayerView?: () => WebContentsView | null,
  toggleVideoHandler?: () => boolean,
  ytm?: YtmController
) {
  // Track player state
  let isPlaying = false;

  // Crossfade entre canciones (solo audio local). 0 = corte seco.
  let crossfadeSec = 0;
  let crossfading = false;

  // Initialize YouTube search with saved API key + crossfade preference
  (async () => {
    try {
      const settings = await c.settingsRepo.get();
      if (settings.youtubeApiKey) {
        c.youtubeSearch.setApiKey(settings.youtubeApiKey);
      }
      crossfadeSec = Math.max(0, Math.min(12, Number(settings.crossfadeSec) || 0));
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  })();

  // App state
  ipcMain.handle('app:getState', async () => c.uc.app.getState());

  // Playlists
  ipcMain.handle('playlist:create', async (_e, name: string) => 
    c.uc.playlist.create.execute(name));
  
  ipcMain.handle('playlist:delete', async (_e, playlistId: string) =>
    // Solo borra la playlist de la biblioteca. La cola y la reproducción
    // son independientes y NO se tocan.
    c.uc.playlist.delete.execute(playlistId));
  
  ipcMain.handle('playlist:addTrack', async (_e, playlistId: string, track: any) =>
    c.uc.playlist.addTrack.execute(playlistId, track)
  );
  
  ipcMain.handle('playlist:removeTrack', async (_e, playlistId: string, trackId: string) =>
    c.uc.playlist.removeTrack.execute(playlistId, trackId)
  );
  
  ipcMain.handle('playlist:export', async (_e, playlistId: string) => 
    c.uc.playlist.export.execute(playlistId));
  
  ipcMain.handle('playlist:import', async () =>
    c.uc.playlist.import.execute());

  ipcMain.handle('playlist:setCover', async (_e, playlistId: string, cover: string) =>
    c.uc.playlist.setCover.execute(playlistId, cover));

  // Queue/Playback
  ipcMain.handle('queue:enqueueTrack', async (_e, urlOrId: string) => {
    const videoId = parseVideoId(urlOrId);
    if (!videoId) throw new Error('URL o VideoId inválido');
    
    // Get video info from YouTube
    let videoInfo;
    try {
      videoInfo = await c.youtubeSearch.getVideoInfo(videoId);
    } catch (error) {
      console.warn('Could not fetch video info:', error);
    }
    
    const track = {
      id: crypto.randomUUID(),
      provider: 'youtube' as const,
      videoId,
      title: videoInfo?.title || videoId,
      author: videoInfo?.author,
      thumbnail: videoInfo?.thumbnail || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      duration: videoInfo?.duration,
      addedAt: Date.now()
    };
    return c.uc.playback.enqueueTrack.execute(track);
  });
  
  ipcMain.handle('queue:enqueuePlaylist', async (_e, playlistId: string, startIndex: number = 0) => {
    const result = await c.uc.playback.enqueuePlaylist.execute(playlistId, startIndex);
    sendQueueUpdate();
    return result;
  });
  
  ipcMain.handle('playback:next', async () => {
    crossfading = false; // un salto manual cancela cualquier fundido en curso
    await c.uc.playback.next.execute();
    sendQueueUpdate();
  });

  ipcMain.handle('playback:prev', async () => {
    crossfading = false;
    await c.uc.playback.prev.execute();
    sendQueueUpdate();
  });
  
  ipcMain.handle('queue:toggleShuffle', async () => {
    await c.uc.playback.toggleShuffle.execute();
    sendQueueUpdate();
  });
  
  ipcMain.handle('queue:cycleRepeat', async () => {
    await c.uc.playback.cycleRepeat.execute();
    sendQueueUpdate();
  });

  ipcMain.handle('queue:move', async (_e, from: number, to: number) => {
    crossfading = false;
    c.queue.move(from, to);
    sendQueueUpdate();
    return c.queue.getState();
  });

  // Quitar de la cola (de verdad): si era la actual, salta a la siguiente o detiene
  ipcMain.handle('queue:remove', async (_e, index: number) => {
    crossfading = false;
    const res = c.queue.removeAt(index);
    if (res.removedCurrent) {
      if (res.empty) {
        await c.player.load({ provider: 'youtube' }); // detiene/limpia
        isPlaying = false;
      } else {
        const st = c.queue.getState();
        await c.uc.playback.playAt.execute(st.index);
        isPlaying = true;
      }
    }
    sendQueueUpdate();
    return c.queue.getState();
  });

  // Agregar una playlist al final de la cola (sin reemplazarla)
  ipcMain.handle('queue:appendPlaylist', async (_e, playlistId: string) => {
    const playlists = await c.playlistRepo.getAll();
    const pl = playlists.find((p) => p.id === playlistId);
    if (!pl) return c.queue.getState();
    const wasEmpty = c.queue.getState().queue.length === 0;
    const now = Date.now();
    const tracks: Track[] = pl.items.map((t) => ({ ...t, id: crypto.randomUUID(), addedAt: now }));
    await c.uc.playback.enqueueTracks.execute(tracks);
    sendQueueUpdate();
    if (wasEmpty) { await c.uc.playback.playAt.execute(0); isPlaying = true; sendQueueUpdate(); }
    return c.queue.getState();
  });

  // Agregar UNA pista al final de la cola
  ipcMain.handle('queue:appendTrack', async (_e, track: any) => {
    if (!track) return c.queue.getState();
    const wasEmpty = c.queue.getState().queue.length === 0;
    const t: Track = { ...track, id: crypto.randomUUID(), addedAt: Date.now() };
    await c.uc.playback.enqueueTracks.execute([t]);
    sendQueueUpdate();
    if (wasEmpty) { await c.uc.playback.playAt.execute(0); isPlaying = true; sendQueueUpdate(); }
    return c.queue.getState();
  });

  // Reproducir una playlist en modo aleatorio
  ipcMain.handle('queue:playShuffled', async (_e, playlistId: string) => {
    const playlists = await c.playlistRepo.getAll();
    const pl = playlists.find((p) => p.id === playlistId);
    if (!pl || !pl.items.length) return c.queue.getState();
    c.queue.replaceQueue(pl.items, 0);
    c.queue.setShuffle(true);
    const start = Math.floor(Math.random() * pl.items.length);
    await c.uc.playback.playAt.execute(start);
    isPlaying = true;
    sendQueueUpdate();
    return c.queue.getState();
  });

  // Player controls
  ipcMain.handle('playback:playPause', async () => {
    if (isPlaying) {
      await c.player.pause();
    } else {
      await c.player.play();
    }
    // isPlaying will be updated by the player:stateChanged event
    return { isPlaying: !isPlaying };
  });
  
  // Update isPlaying when playAtIndex is called
  ipcMain.handle('playback:playAtIndex', async (_e, index: number) => {
    crossfading = false;
    const result = await c.uc.playback.playAt.execute(index);
    if (result) {
      isPlaying = true;
      sendQueueUpdate();
    }
    return result;
  });
  
  ipcMain.handle('playback:seek', async (_e, seconds: number) => 
    c.uc.playback.seek.execute(seconds));
  
  ipcMain.handle('playback:setVolume', async (_e, vol: number) =>
    c.uc.playback.setVolume.execute(vol));

  ipcMain.handle('playback:setRate', async (_e, rate: number) => c.player.setRate(rate));
  ipcMain.handle('playback:setEq', async (_e, gains: number[]) => c.player.setEq(gains));

  // Settings
  ipcMain.handle('settings:setAccent', async (_e, color: string) => 
    c.uc.settings.setAccent.execute(color));
  
  ipcMain.handle('settings:setVolumeDefault', async (_e, vol: number) => 
    c.uc.settings.setVolumeDefault.execute(vol));

  ipcMain.handle('settings:setYouTubeApiKey', async (_e, apiKey: string) => {
    await c.uc.settings.setYouTubeApiKey.execute(apiKey);
    // Update the YouTube search adapter with the new API key
    c.youtubeSearch.setApiKey(apiKey);
  });

  ipcMain.handle('settings:setCrossfade', async (_e, seconds: number) => {
    const updated = await c.uc.settings.setCrossfade.execute(seconds);
    crossfadeSec = updated.crossfadeSec ?? 0;
    return { crossfadeSec };
  });

  ipcMain.handle('settings:setLanguage', async (_e, lang: string) =>
    c.uc.settings.setLanguage.execute(lang));

  ipcMain.handle('settings:setTheme', async (_e, theme: any) =>
    c.uc.settings.setTheme.execute(theme || {}));

  ipcMain.handle('settings:setBlockAds', async (_e, enabled: boolean) => {
    await c.uc.settings.setBlockAds.execute(!!enabled);
    ytm?.setBlockAds(!!enabled);
    return { blockAds: !!enabled };
  });

  ipcMain.handle('settings:setDownloadDir', async (_e, dir: string) =>
    c.uc.settings.setDownloadDir.execute(dir));

  ipcMain.handle('settings:chooseDownloadDir', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    await c.uc.settings.setDownloadDir.execute(r.filePaths[0]);
    return r.filePaths[0];
  });

  // ───────── Modo YouTube Music + descargas ─────────
  const DOWNLOADS_PLAYLIST = 'Descargadas';

  async function resolveDownloadDir(): Promise<string> {
    const s = await c.settingsRepo.get();
    return s.downloadDir || path.join(app.getPath('music'), 'Yutu');
  }

  // Limpia el sufijo " [videoId]" del nombre para mostrar un título legible.
  function cleanTitle(filePath: string): string {
    const base = path.basename(filePath, path.extname(filePath));
    return base.replace(/\s*\[[A-Za-z0-9_-]{6,}\]\s*$/, '').trim() || base;
  }

  // Asegura la playlist "Descargadas" y devuelve su id.
  async function ensureDownloadsPlaylist(): Promise<string | null> {
    let playlists = await c.playlistRepo.getAll();
    let pl = playlists.find((p) => p.name === DOWNLOADS_PLAYLIST);
    if (!pl) {
      await c.uc.playlist.create.execute(DOWNLOADS_PLAYLIST);
      playlists = await c.playlistRepo.getAll();
      pl = playlists.find((p) => p.name === DOWNLOADS_PLAYLIST);
      if (pl) { try { await c.uc.playlist.setCover.execute(pl.id, '⬇️'); } catch (e) {} }
    }
    return pl ? pl.id : null;
  }

  // Notificación nativa del SO (visible aunque el modo YT Music tape la UI).
  function notify(title: string, body: string) {
    try { if (Notification.isSupported()) new Notification({ title, body, silent: false }).show(); } catch (e) {}
  }

  // Evita descargas simultáneas del mismo video (que se pisan el archivo .part).
  const inFlightDownloads = new Set<string>();

  async function doDownload(videoId: string) {
    if (!videoId) throw new Error('videoId requerido');
    if (inFlightDownloads.has(videoId)) throw new Error('Esta canción ya se está descargando');
    inFlightDownloads.add(videoId);
    try {
      const outDir = await resolveDownloadDir();
      const res = await c.uc.download.audio.execute({
        videoId, outDir,
        onProgress: (p) => win()?.webContents.send('download:progress', p),
      });
      // Va SOLO a la playlist "Descargadas" (no satura la cola de reproducción).
      try {
        const plId = await ensureDownloadsPlaylist();
        if (plId) await c.uc.playlist.addTrack.execute(plId, {
          provider: 'local', filePath: res.filePath, mediaType: 'audio',
          title: cleanTitle(res.filePath), author: 'Descargada',
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, // carátula de YouTube
        });
      } catch (e) {}
      notify('Yutu · Descarga completa', '✅ ' + cleanTitle(res.filePath));
      return res;
    } catch (err: any) {
      notify('Yutu · Error al descargar', String(err?.message || err));
      throw err;
    } finally {
      inFlightDownloads.delete(videoId);
    }
  }

  ipcMain.handle('ytm:toggle', async (_e, visible: boolean) => {
    const v = ytm ? ytm.setYtMusic(!!visible) : false;
    return { visible: v };
  });

  ipcMain.handle('ytm:home', async () => { ytm?.home(); });
  ipcMain.handle('ytm:back', async () => { ytm?.goBack(); });

  ipcMain.handle('download:byVideoId', async (_e, videoId: string) => doDownload(videoId));

  ipcMain.handle('download:currentYtm', async () => {
    if (!ytm) throw new Error('YT Music no disponible');
    const id = await ytm.getCurrentVideoId();
    if (!id) throw new Error('No hay una canción reproduciéndose en YouTube Music');
    return doDownload(id);
  });

  ipcMain.handle('download:openFolder', async () => {
    const dir = await resolveDownloadDir();
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
    return shell.openPath(dir);
  });

  // YouTube Search
  ipcMain.handle('youtube:search', async (_e, query: string) =>
    c.uc.playback.searchYouTube.execute(query));

  // Importar una playlist de YouTube por URL (scraping, sin API key)
  ipcMain.handle('youtube:importPlaylistUrl', async (_e, url: string) => {
    const pl = await c.youtubeSearch.getPlaylistFromUrl(url);
    if (!pl.items.length) return { added: 0, name: pl.title };
    const now = Date.now();
    const tracks: Track[] = pl.items.map((it) => ({
      id: crypto.randomUUID(),
      provider: "youtube" as const,
      videoId: it.videoId,
      title: it.title,
      author: it.author,
      thumbnail: it.thumbnail,
      addedAt: now,
    }));
    const playlists = await c.playlistRepo.getAll();
    const newPl = {
      id: crypto.randomUUID(),
      name: pl.title || "YouTube",
      createdAt: now,
      updatedAt: now,
      items: tracks,
    };
    await c.playlistRepo.saveAll([...playlists, newPl]);
    return { added: tracks.length, name: newPl.name };
  });

  // Helper: construye tracks locales desde rutas y los encola (autoplay si la cola está vacía)
  async function enqueueLocalPaths(paths: string[], autoplay = true) {
    const valid = (paths || []).filter((p) => typeof p === "string" && !!p);
    if (!valid.length) return { added: 0, queue: c.queue.getState() };

    const wasEmpty = c.queue.getState().queue.length === 0;
    const now = Date.now();
    const tracks: Track[] = valid.map((p) => {
      const ext = path.extname(p).toLowerCase();
      const mediaType: "audio" | "video" = AUDIO_EXTS.has(ext) ? "audio" : "video";
      const base = path.basename(p, path.extname(p));
      return {
        id: crypto.randomUUID(),
        provider: "local" as const,
        filePath: p,
        mediaType,
        title: base,
        author: "Archivo local",
        addedAt: now,
      };
    });

    await c.uc.playback.enqueueTracks.execute(tracks);
    sendQueueUpdate();
    if (autoplay && wasEmpty) {
      await c.uc.playback.playAt.execute(0);
      isPlaying = true;
      sendQueueUpdate();
    }
    enrichLocalMetadata(tracks); // ID3 + carátula en segundo plano
    return { added: tracks.length, queue: c.queue.getState() };
  }

  // Lee metadata (título, artista, carátula, duración) de los archivos locales
  // y la aplica a las pistas ya encoladas (mutación por referencia).
  async function enrichLocalMetadata(tracks: Track[]) {
    let mm: any;
    try { mm = await importEsm("music-metadata"); } catch { return; }
    let changed = false;
    for (const t of tracks) {
      if (!t.filePath) continue;
      try {
        const meta = await mm.parseFile(t.filePath, { duration: true });
        const common = meta.common || {};
        if (common.title) { t.title = common.title; changed = true; }
        if (common.artist) { t.author = common.artist; changed = true; }
        if (common.album) { t.album = common.album; changed = true; }
        if (common.year) { t.year = common.year; changed = true; }
        const pic = common.picture && common.picture[0];
        if (pic && pic.data) {
          const b64 = Buffer.from(pic.data).toString("base64");
          t.thumbnail = `data:${pic.format || "image/jpeg"};base64,${b64}`;
          changed = true;
        }
        if (meta.format && meta.format.duration) t.duration = Math.round(meta.format.duration);
      } catch (e) {}
    }
    if (changed) sendQueueUpdate();
  }

  // Local files: abrir diálogo
  ipcMain.handle('local:pickAndEnqueue', async () => {
    const paths = await c.fileDialog.pickMediaFiles();
    return enqueueLocalPaths(paths);
  });

  // Local files: arrastrar y soltar (rutas desde el renderer)
  ipcMain.handle('local:enqueuePaths', async (_e, paths: string[]) =>
    enqueueLocalPaths(paths));

  // Google account / auth
  ipcMain.handle('auth:signIn', async () => c.uc.auth.signIn.execute());
  ipcMain.handle('auth:signOut', async () => c.uc.auth.signOut.execute());
  ipcMain.handle('auth:getProfile', async () => c.uc.auth.getProfile.execute());
  ipcMain.handle('auth:listYouTubePlaylists', async () =>
    c.uc.auth.listYouTubePlaylists.execute());
  ipcMain.handle('auth:importYouTubePlaylist', async (_e, playlistId: string, name: string) =>
    c.uc.auth.importYouTubePlaylist.execute(playlistId, name));

  // Settings: Google credentials
  ipcMain.handle('settings:setGoogleCredentials', async (_e, clientId: string, clientSecret: string) =>
    c.uc.settings.setGoogleCredentials.execute(clientId, clientSecret));

  // Video visibility toggle
  ipcMain.handle('player:toggleVideo', async (_e, visible: boolean) => {
    if (toggleVideoHandler) {
      const newVisibility = toggleVideoHandler();
      return { success: true, visible: newVisibility };
    }
    return { success: false, visible };
  });

  // Player events from player window
  ipcMain.on('player:stateChanged', (_e, state: string) => {
    // Update isPlaying state to sync with actual player state
    isPlaying = state === 'playing';
    win()?.webContents.send('player:state', state);
  });

  ipcMain.on('player:timeUpdate', (_e, data: any) => {
    win()?.webContents.send('player:timeUpdate', data);
    maybeCrossfade(data);
  });

  // Cuando la pista actual (audio local) está por terminar, precarga la siguiente
  // (si también es audio local) y la funde, en vez de hacer un corte seco.
  function maybeCrossfade(data: any) {
    if (crossfadeSec <= 0 || crossfading) return;
    const st = c.queue.getState();
    if (st.repeat === 'one') return;
    const cur = c.queue.current();
    if (!cur || cur.provider !== 'local' || cur.mediaType === 'video') return;

    const duration = Number(data?.duration) || 0;
    const current = Number(data?.current) || 0;
    if (duration <= 1) return;
    const remaining = duration - current;
    // No fundir más allá de ~45% de la pista (evita fundidos absurdos en clips cortos)
    const fade = Math.min(crossfadeSec, Math.max(1, duration * 0.45));
    if (remaining > fade || remaining <= 0.25) return;

    const peek = c.queue.peekNext();
    if (!peek || !peek.track) return;
    const nt = peek.track;
    // El crossfade solo aplica audio local → audio local. El resto: corte normal.
    if (nt.provider !== 'local' || nt.mediaType === 'video') return;

    crossfading = true;
    isPlaying = true;
    c.player.crossfade(toPlayableMedia(nt), fade);
    c.queue.setIndex(peek.index);
    sendQueueUpdate();
    // Libera el cerrojo justo tras el fundido. Margen corto para no “tragarse”
    // el 'ended' legítimo de pistas entrantes cortas.
    setTimeout(() => { crossfading = false; }, fade * 1000 + 300);
  }

  ipcMain.on('player:levels', (_e, levels: number[]) => {
    win()?.webContents.send('player:levels', levels);
  });

  ipcMain.on('player:ended', async () => {
    // Si veníamos de un crossfade, la siguiente pista ya está sonando: ignora el "ended".
    if (crossfading) return;
    // Auto-advance logic based on repeat mode
    const queueState = c.queue.getState();
    if (queueState.repeat === 'one') {
      // Replay same track
      if (queueState.index >= 0) {
        await c.uc.playback.playAt.execute(queueState.index);
      }
    } else {
      // Try next
      await c.uc.playback.next.execute();
    }
    sendQueueUpdate();
  });

  function sendQueueUpdate() {
    const queueState = c.queue.getState();
    win()?.webContents.send('queue:update', queueState);
  }
  // Nota: no usamos un setInterval para reenviar la cola; cada acción ya llama
  // a sendQueueUpdate(). Evita IPC constante (importante con carátulas en base64).
}
