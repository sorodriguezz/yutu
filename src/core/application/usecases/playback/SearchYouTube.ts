import { YouTubeSearchPort } from "../../ports/YouTubeSearchPort";

export class SearchYouTube {
  constructor(private readonly youtubeSearch: YouTubeSearchPort) {}

  async execute(query: string, maxResults: number = 20) {
    if (!query || query.trim().length === 0) {
      throw new Error("Search query cannot be empty");
    }

    const results = await this.youtubeSearch.search(query.trim(), maxResults);
    return results;
  }
}
