import {
  YouTubeSearchPort,
  YouTubeSearchResult,
} from "../../../core/application/ports/YouTubeSearchPort";

/**
 * YouTube Search adapter using public API
 * Uses YouTube Data API v3 with API key from environment or default public scraping
 */
export class YouTubeSearchAdapter implements YouTubeSearchPort {
  private apiKey: string;

  constructor(apiKey?: string) {
    // Use provided API key or fallback to environment variable
    this.apiKey = apiKey || process.env.YOUTUBE_API_KEY || "";
  }

  /**
   * Update the API key (useful when user configures it in settings)
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey || "";
  }

  async search(
    query: string,
    maxResults: number = 20
  ): Promise<YouTubeSearchResult[]> {
    if (!this.apiKey) {
      // Fallback to scraping if no API key
      return this.searchWithoutApi(query, maxResults);
    }

    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("q", query);
      url.searchParams.set("type", "video");
      url.searchParams.set("maxResults", maxResults.toString());
      url.searchParams.set("key", this.apiKey);
      url.searchParams.set("videoCategoryId", "10"); // Music category

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        return [];
      }

      // Get video details for duration
      const videoIds = data.items.map((item: any) => item.id.videoId).join(",");
      const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
      detailsUrl.searchParams.set("part", "contentDetails,snippet");
      detailsUrl.searchParams.set("id", videoIds);
      detailsUrl.searchParams.set("key", this.apiKey);

      const detailsResponse = await fetch(detailsUrl.toString());
      const detailsData = await detailsResponse.json();

      const results: YouTubeSearchResult[] = detailsData.items.map(
        (item: any) => ({
          videoId: item.id,
          title: item.snippet.title,
          author: item.snippet.channelTitle,
          thumbnail:
            item.snippet.thumbnails.medium?.url ||
            item.snippet.thumbnails.default.url,
          duration: this.parseDuration(item.contentDetails.duration),
        })
      );

      return results;
    } catch (error) {
      console.error("Error searching YouTube:", error);
      // Fallback to scraping
      return this.searchWithoutApi(query, maxResults);
    }
  }

  async getVideoInfo(videoId: string): Promise<YouTubeSearchResult> {
    if (!this.apiKey) {
      return this.getVideoInfoWithoutApi(videoId);
    }

    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/videos");
      url.searchParams.set("part", "snippet,contentDetails");
      url.searchParams.set("id", videoId);
      url.searchParams.set("key", this.apiKey);

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        throw new Error("Video not found");
      }

      const item = data.items[0];

      return {
        videoId: item.id,
        title: item.snippet.title,
        author: item.snippet.channelTitle,
        thumbnail:
          item.snippet.thumbnails.medium?.url ||
          item.snippet.thumbnails.default.url,
        duration: this.parseDuration(item.contentDetails.duration),
      };
    } catch (error) {
      console.error("Error getting video info:", error);
      return this.getVideoInfoWithoutApi(videoId);
    }
  }

  /**
   * Fallback search without API key using oEmbed and basic scraping
   */
  private async searchWithoutApi(
    query: string,
    maxResults: number
  ): Promise<YouTubeSearchResult[]> {
    try {
      // Use YouTube's autocomplete/suggestions as a simple search
      // This is a simplified version - in production you might want a better solution
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
        query
      )}`;

      // For now, return empty array and suggest user to add API key
      console.warn(
        "YouTube API key not configured. Add YOUTUBE_API_KEY to environment variables for search functionality."
      );
      return [];
    } catch (error) {
      console.error("Error in fallback search:", error);
      return [];
    }
  }

  /**
   * Get video info using oEmbed (no API key required, but limited info)
   */
  private async getVideoInfoWithoutApi(
    videoId: string
  ): Promise<YouTubeSearchResult> {
    try {
      const url = new URL("https://www.youtube.com/oembed");
      url.searchParams.set("url", `https://www.youtube.com/watch?v=${videoId}`);
      url.searchParams.set("format", "json");

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error("Failed to fetch video info");
      }

      const data = await response.json();

      return {
        videoId,
        title: data.title,
        author: data.author_name,
        thumbnail: data.thumbnail_url,
        duration: 0, // oEmbed doesn't provide duration
      };
    } catch (error) {
      console.error("Error getting video info without API:", error);
      // Return basic info
      return {
        videoId,
        title: "Unknown Title",
        author: "Unknown Author",
        thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        duration: 0,
      };
    }
  }

  /**
   * Parse ISO 8601 duration to seconds
   * Example: PT4M13S = 253 seconds
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;

    return hours * 3600 + minutes * 60 + seconds;
  }
}
