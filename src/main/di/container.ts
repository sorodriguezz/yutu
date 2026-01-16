import path from "node:path";
import { app, BrowserWindow, WebContentsView } from "electron";

import { JsonDb } from "../infra/persistence/jsonDb";
import { PlaylistRepositoryJson } from "../infra/persistence/playlistRepositoryJson";
import { SettingsRepositoryJson } from "../infra/persistence/settingsRepositoryJson";
import { ElectronFileDialog } from "../infra/io/fileDialogElectron";
import { ElectronYouTubePlayer } from "../infra/player/youtubePlayerElectron";
import { ConsoleLogger } from "../infra/logging/consoleLogger";
import { makeId } from "../infra/util/ids";

import { QueueService } from "../../core/application/services/QueueService";

import { CreatePlaylist } from "../../core/application/usecases/playlists/CreatePlaylist";
import { DeletePlaylist } from "../../core/application/usecases/playlists/DeletePlaylist";
import { AddTrackToPlaylist } from "../../core/application/usecases/playlists/AddTrackToPlaylist";
import { RemoveTrackFromPlaylist } from "../../core/application/usecases/playlists/RemoveTrackFromPlaylist";
import { ExportPlaylist } from "../../core/application/usecases/playlists/ExportPlaylist";
import { ImportPlaylist } from "../../core/application/usecases/playlists/ImportPlaylist";

import { EnqueueTrack } from "../../core/application/usecases/playback/EnqueueTrack";
import { EnqueuePlaylist } from "../../core/application/usecases/playback/EnqueuePlaylist";
import { PlayAtIndex } from "../../core/application/usecases/playback/PlayAtIndex";
import { PlayPause } from "../../core/application/usecases/playback/PlayPause";
import { Next } from "../../core/application/usecases/playback/Next";
import { Prev } from "../../core/application/usecases/playback/Prev";
import { Seek } from "../../core/application/usecases/playback/Seek";
import { SetVolume } from "../../core/application/usecases/playback/SetVolume";
import { ToggleShuffle } from "../../core/application/usecases/playback/ToggleShuffle";
import { CycleRepeat } from "../../core/application/usecases/playback/CycleRepeat";

import { UpdateAccentColor } from "../../core/application/usecases/settings/UpdateAccentColor";
import { UpdateVolumeDefault } from "../../core/application/usecases/settings/UpdateVolumeDefault";
import { UpdateYouTubeApiKey } from "../../core/application/usecases/settings/UpdateYouTubeApiKey";
import { SearchYouTube } from "../../core/application/usecases/playback/SearchYouTube";

import { YouTubeSearchAdapter } from "../infra/youtube/youtubeSearchAdapter";

export type AppContainer = ReturnType<typeof buildContainer>;

export function buildContainer(opts: {
  getWindow: () => BrowserWindow | null;
  playerView: WebContentsView;
}) {
  const logger = new ConsoleLogger();

  const dbFile = path.join(app.getPath("userData"), "db.json");
  const db = new JsonDb(dbFile, {
    playlists: [],
    settings: { accentColor: "#4f46e5", volumeDefault: 60, youtubeApiKey: "" }
  });

  const playlistRepo = new PlaylistRepositoryJson(db);
  const settingsRepo = new SettingsRepositoryJson(db);
  const fileDialog = new ElectronFileDialog(opts.getWindow);
  const player = new ElectronYouTubePlayer(opts.playerView.webContents);
  
  // YouTube search adapter will be initialized with API key from settings
  const youtubeSearch = new YouTubeSearchAdapter(""); // Will be updated via setApiKey

  const queue = new QueueService();

  // Use cases
  const uc = {
    app: {
      getState: async () => {
        const playlists = await playlistRepo.getAll();
        const settings = await settingsRepo.get();
        const queueState = queue.getState();
        return { playlists, settings, queue: queueState };
      }
    },
    playlist: {
      create: new CreatePlaylist(playlistRepo, makeId),
      delete: new DeletePlaylist(playlistRepo),
      addTrack: new AddTrackToPlaylist(playlistRepo, makeId),
      removeTrack: new RemoveTrackFromPlaylist(playlistRepo),
      export: new ExportPlaylist(playlistRepo, fileDialog),
      import: new ImportPlaylist(playlistRepo, fileDialog, makeId)
    },
    playback: {
      enqueueTrack: new EnqueueTrack(queue),
      enqueuePlaylist: new EnqueuePlaylist(playlistRepo, queue),
      playAt: new PlayAtIndex(queue, player),
      playPause: new PlayPause(player),
      next: new Next(queue, player),
      prev: new Prev(queue, player),
      seek: new Seek(player),
      setVolume: new SetVolume(player),
      toggleShuffle: new ToggleShuffle(queue),
      cycleRepeat: new CycleRepeat(queue),
      searchYouTube: new SearchYouTube(youtubeSearch)
    },
    settings: {
      setAccent: new UpdateAccentColor(settingsRepo),
      setVolumeDefault: new UpdateVolumeDefault(settingsRepo),
      setYouTubeApiKey: new UpdateYouTubeApiKey(settingsRepo)
    },
    ports: { logger, youtubeSearch }
  };

  return { uc, playlistRepo, settingsRepo, queue, player, fileDialog, logger, youtubeSearch };
}