import { Track } from "../../domain/entities/Track";
import { PlayableMedia } from "../ports/PlayerPort";

/** Maps a domain Track to a provider-agnostic playable descriptor. */
export function toPlayableMedia(track: Track): PlayableMedia {
  return {
    provider: track.provider,
    videoId: track.videoId,
    filePath: track.filePath,
    mediaType: track.mediaType,
    title: track.title,
  };
}
