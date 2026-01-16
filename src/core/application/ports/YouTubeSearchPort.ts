export type YouTubeSearchResult = {
  videoId: string;
  title: string;
  author: string;
  thumbnail: string;
  duration: number; // in seconds
};

export interface YouTubeSearchPort {
  search(query: string, maxResults?: number): Promise<YouTubeSearchResult[]>;
  getVideoInfo(videoId: string): Promise<YouTubeSearchResult>;
}
