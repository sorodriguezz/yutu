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
   * Search without an API key by scraping the results page (ytInitialData).
   * No key required — works out of the box.
   */
  private async searchWithoutApi(
    query: string,
    maxResults: number
  ): Promise<YouTubeSearchResult[]> {
    try {
      const searchUrl =
        `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` +
        `&hl=en&gl=US`;

      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
          // Skip the EU consent interstitial that otherwise hides the results
          Cookie: "CONSENT=YES+cb.20210328-17-p0.en+FX+000",
        },
      });

      if (!response.ok) throw new Error(`YouTube responded ${response.status}`);
      const html = await response.text();

      // Extract the embedded ytInitialData JSON
      let jsonStr: string | null = null;
      let m = html.match(/var ytInitialData = (\{.+?\});<\/script>/s);
      if (!m) m = html.match(/window\["ytInitialData"\]\s*=\s*(\{.+?\});<\/script>/s);
      if (!m) m = html.match(/ytInitialData"\]\s*=\s*(\{.+?\});/s);
      if (m) jsonStr = m[1];
      if (!jsonStr) return [];

      const data = JSON.parse(jsonStr);

      // Recursively collect every videoRenderer node (robust to layout changes)
      const renderers: any[] = [];
      const walk = (node: any) => {
        if (!node || typeof node !== "object" || renderers.length >= maxResults * 2) return;
        if (node.videoRenderer && node.videoRenderer.videoId) renderers.push(node.videoRenderer);
        if (Array.isArray(node)) {
          for (const c of node) walk(c);
        } else {
          for (const k of Object.keys(node)) walk(node[k]);
        }
      };
      walk(data);

      const results: YouTubeSearchResult[] = [];
      for (const v of renderers) {
        if (results.length >= maxResults) break;
        const videoId = v.videoId;
        const title =
          v.title?.runs?.[0]?.text || v.title?.simpleText || videoId;
        const author =
          v.ownerText?.runs?.[0]?.text ||
          v.longBylineText?.runs?.[0]?.text ||
          "YouTube";
        const thumbs = v.thumbnail?.thumbnails;
        const thumbnail =
          (thumbs && thumbs[thumbs.length - 1]?.url) ||
          `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
        const lengthText = v.lengthText?.simpleText || "";
        results.push({
          videoId,
          title,
          author,
          thumbnail,
          duration: this.parseClockDuration(lengthText),
        });
      }

      return results;
    } catch (error) {
      console.error("Error in keyless search:", error);
      return [];
    }
  }

  /** Parse "m:ss" or "h:mm:ss" into seconds. */
  private parseClockDuration(text: string): number {
    if (!text) return 0;
    const parts = text.split(":").map((p) => parseInt(p, 10));
    if (parts.some((n) => isNaN(n))) return 0;
    return parts.reduce((acc, n) => acc * 60 + n, 0);
  }

  /**
   * Importa una playlist de YouTube desde su URL (sin API key, scraping de
   * ytInitialData). Devuelve el título y los videos.
   */
  async getPlaylistFromUrl(
    url: string
  ): Promise<{ title: string; items: { videoId: string; title: string; author?: string; thumbnail?: string }[] }> {
    let listId = "";
    try { listId = new URL(url).searchParams.get("list") || ""; } catch {}
    if (!listId) { const m = url.match(/[?&]list=([^&]+)/); if (m) listId = m[1]; }
    if (!listId) return { title: "Playlist", items: [] };

    try {
      const res = await fetch(`https://www.youtube.com/playlist?list=${listId}&hl=en&gl=US`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
          "Accept-Language": "en-US,en;q=0.9",
          Cookie: "CONSENT=YES+cb",
        },
      });
      if (!res.ok) return { title: "Playlist", items: [] };
      const html = await res.text();
      let m = html.match(/var ytInitialData = (\{.+?\});<\/script>/s);
      if (!m) m = html.match(/ytInitialData"\]\s*=\s*(\{.+?\});/s);
      if (!m) return { title: "Playlist", items: [] };
      const data = JSON.parse(m[1]);

      let title = "Playlist";
      try {
        title =
          data?.metadata?.playlistMetadataRenderer?.title ||
          data?.header?.playlistHeaderRenderer?.title?.simpleText ||
          title;
      } catch {}

      const items: { videoId: string; title: string; author?: string; thumbnail?: string }[] = [];
      const walk = (node: any) => {
        if (!node || typeof node !== "object" || items.length >= 300) return;
        const v = node.playlistVideoRenderer;
        if (v && v.videoId) {
          items.push({
            videoId: v.videoId,
            title: v.title?.runs?.[0]?.text || v.title?.simpleText || v.videoId,
            author: v.shortBylineText?.runs?.[0]?.text,
            thumbnail: `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`,
          });
        }
        if (Array.isArray(node)) { for (const c of node) walk(c); }
        else { for (const k of Object.keys(node)) walk(node[k]); }
      };
      walk(data);
      return { title, items };
    } catch (e) {
      console.error("Error importing playlist:", e);
      return { title: "Playlist", items: [] };
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
