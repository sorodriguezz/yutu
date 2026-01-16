export const Channels = {
  App_GetState: "app:getState",

  Playlist_Create: "playlist:create",
  Playlist_Delete: "playlist:delete",
  Playlist_AddTrack: "playlist:addTrack",
  Playlist_RemoveTrack: "playlist:removeTrack",
  Playlist_Export: "playlist:export",
  Playlist_Import: "playlist:import",

  Queue_EnqueueTrack: "queue:enqueueTrack",
  Queue_EnqueuePlaylist: "queue:enqueuePlaylist",
  Queue_PlayAt: "queue:playAt",
  Queue_Next: "queue:next",
  Queue_Prev: "queue:prev",
  Queue_ToggleShuffle: "queue:toggleShuffle",
  Queue_CycleRepeat: "queue:cycleRepeat",

  Player_Play: "player:play",
  Player_Pause: "player:pause",
  Player_Seek: "player:seek",
  Player_SetVolume: "player:setVolume",

  Settings_SetAccent: "settings:setAccent",
  Settings_SetVolumeDefault: "settings:setVolumeDefault",

  Util_ParseVideoId: "util:parseVideoId",

  Player_Event: "player:event",
  Player_Emit: "player:emit"
} as const;