import { shell } from "electron";
import http from "node:http";
import crypto from "node:crypto";
import { AddressInfo } from "node:net";
import {
  AuthPort,
  AuthProfile,
  RemotePlaylist,
} from "../../../core/application/ports/AuthPort";
import {
  SettingsRepository,
  AuthState,
} from "../../../core/application/ports/SettingsRepository";
import {
  DEFAULT_GOOGLE_CLIENT_ID,
  DEFAULT_GOOGLE_CLIENT_SECRET,
} from "../../config";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";
const YT_API = "https://www.googleapis.com/youtube/v3";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/youtube.readonly",
].join(" ");

/**
 * Google OAuth 2.0 for installed apps (loopback redirect + PKCE).
 * The consent screen opens in the user's default browser; a temporary
 * localhost server captures the redirect with the authorization code.
 */
export class GoogleAuthAdapter implements AuthPort {
  constructor(private readonly settingsRepo: SettingsRepository) {}

  private base64url(buf: Buffer): string {
    return buf
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  async signIn(): Promise<AuthProfile> {
    const settings = await this.settingsRepo.get();
    const clientId = (settings.googleClientId || DEFAULT_GOOGLE_CLIENT_ID).trim();
    const clientSecret = (settings.googleClientSecret || DEFAULT_GOOGLE_CLIENT_SECRET).trim();
    if (!clientId) {
      throw new Error(
        "Falta el Google Client ID. Configúralo en Ajustes → Cuenta de Google."
      );
    }

    const verifier = this.base64url(crypto.randomBytes(32));
    const challenge = this.base64url(
      crypto.createHash("sha256").update(verifier).digest()
    );
    const stateParam = this.base64url(crypto.randomBytes(16));

    const { code, redirectUri } = await this.runLoopbackFlow(
      clientId,
      challenge,
      stateParam
    );

    const tokens = await this.exchangeCode(
      clientId,
      clientSecret,
      code,
      verifier,
      redirectUri
    );

    const profile = await this.fetchUserInfo(tokens.access_token);

    const auth: AuthState = {
      profile,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiry: Date.now() + (tokens.expires_in || 3600) * 1000,
      scope: tokens.scope,
    };

    const fresh = await this.settingsRepo.get();
    await this.settingsRepo.save({ ...fresh, auth });

    return profile;
  }

  async signOut(): Promise<void> {
    const settings = await this.settingsRepo.get();
    const next = { ...settings };
    delete next.auth;
    await this.settingsRepo.save(next);
  }

  async getProfile(): Promise<AuthProfile | null> {
    const settings = await this.settingsRepo.get();
    return settings.auth?.profile ?? null;
  }

  async listYouTubePlaylists(): Promise<RemotePlaylist[]> {
    const token = await this.ensureAccessToken();
    const url = new URL(`${YT_API}/playlists`);
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("mine", "true");
    url.searchParams.set("maxResults", "50");

    const playlists: RemotePlaylist[] = [];
    let pageToken: string | undefined;

    do {
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(`YouTube API ${res.status}: ${await res.text()}`);
      }
      const data: any = await res.json();
      for (const item of data.items || []) {
        playlists.push({
          id: item.id,
          title: item.snippet?.title || "Sin título",
          itemCount: item.contentDetails?.itemCount || 0,
        });
      }
      pageToken = data.nextPageToken;
    } while (pageToken && playlists.length < 200);

    return playlists;
  }

  async getYouTubePlaylistItems(
    playlistId: string
  ): Promise<
    { videoId: string; title: string; author?: string; thumbnail?: string }[]
  > {
    const token = await this.ensureAccessToken();
    const items: {
      videoId: string;
      title: string;
      author?: string;
      thumbnail?: string;
    }[] = [];
    let pageToken: string | undefined;

    do {
      const url = new URL(`${YT_API}/playlistItems`);
      url.searchParams.set("part", "snippet,contentDetails");
      url.searchParams.set("playlistId", playlistId);
      url.searchParams.set("maxResults", "50");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(`YouTube API ${res.status}: ${await res.text()}`);
      }
      const data: any = await res.json();
      for (const item of data.items || []) {
        const videoId = item.contentDetails?.videoId;
        if (!videoId) continue;
        items.push({
          videoId,
          title: item.snippet?.title || videoId,
          author: item.snippet?.videoOwnerChannelTitle,
          thumbnail:
            item.snippet?.thumbnails?.medium?.url ||
            item.snippet?.thumbnails?.default?.url,
        });
      }
      pageToken = data.nextPageToken;
    } while (pageToken && items.length < 500);

    return items;
  }

  // ---------- internals ----------

  private runLoopbackFlow(
    clientId: string,
    codeChallenge: string,
    stateParam: string
  ): Promise<{ code: string; redirectUri: string }> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        try {
          const reqUrl = new URL(req.url || "/", "http://127.0.0.1");
          if (reqUrl.pathname !== "/") {
            res.writeHead(404);
            res.end();
            return;
          }
          const code = reqUrl.searchParams.get("code");
          const returnedState = reqUrl.searchParams.get("state");
          const error = reqUrl.searchParams.get("error");

          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(this.resultPage(!!code && !error));

          server.close();

          if (error) return reject(new Error(`OAuth: ${error}`));
          if (!code) return reject(new Error("No se recibió el código de autorización."));
          if (returnedState !== stateParam)
            return reject(new Error("State inválido (posible CSRF)."));

          const addr = server.address() as AddressInfo;
          resolve({ code, redirectUri: `http://127.0.0.1:${addr.port}` });
        } catch (e) {
          reject(e as Error);
        }
      });

      server.on("error", reject);

      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as AddressInfo;
        const redirectUri = `http://127.0.0.1:${addr.port}`;

        const authUrl = new URL(AUTH_ENDPOINT);
        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("scope", SCOPES);
        authUrl.searchParams.set("code_challenge", codeChallenge);
        authUrl.searchParams.set("code_challenge_method", "S256");
        authUrl.searchParams.set("state", stateParam);
        authUrl.searchParams.set("access_type", "offline");
        authUrl.searchParams.set("prompt", "consent");

        shell.openExternal(authUrl.toString());
      });

      // Safety timeout (5 min)
      setTimeout(() => {
        try { server.close(); } catch (e) {}
        reject(new Error("Tiempo de espera agotado para el inicio de sesión."));
      }, 5 * 60 * 1000);
    });
  }

  private async exchangeCode(
    clientId: string,
    clientSecret: string,
    code: string,
    codeVerifier: string,
    redirectUri: string
  ): Promise<any> {
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    });
    if (clientSecret) body.set("client_secret", clientSecret);

    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) {
      throw new Error(`Token exchange ${res.status}: ${await res.text()}`);
    }
    return res.json();
  }

  private async fetchUserInfo(accessToken: string): Promise<AuthProfile> {
    const res = await fetch(USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`UserInfo ${res.status}: ${await res.text()}`);
    }
    const data: any = await res.json();
    return {
      id: data.sub,
      name: data.name || data.email || "Usuario",
      email: data.email || "",
      picture: data.picture,
    };
  }

  private async ensureAccessToken(): Promise<string> {
    const settings = await this.settingsRepo.get();
    const auth = settings.auth;
    if (!auth) throw new Error("No has iniciado sesión con Google.");

    // Still valid (60s margin)
    if (auth.expiry - 60_000 > Date.now()) return auth.accessToken;

    if (!auth.refreshToken) return auth.accessToken; // best effort

    const clientId = (settings.googleClientId || DEFAULT_GOOGLE_CLIENT_ID).trim();
    const clientSecret = (settings.googleClientSecret || DEFAULT_GOOGLE_CLIENT_SECRET).trim();

    const body = new URLSearchParams({
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: auth.refreshToken,
    });
    if (clientSecret) body.set("client_secret", clientSecret);

    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) {
      throw new Error(`Refresh ${res.status}: ${await res.text()}`);
    }
    const data: any = await res.json();

    const updated: AuthState = {
      ...auth,
      accessToken: data.access_token,
      expiry: Date.now() + (data.expires_in || 3600) * 1000,
      scope: data.scope || auth.scope,
    };
    await this.settingsRepo.save({ ...settings, auth: updated });
    return updated.accessToken;
  }

  private resultPage(ok: boolean): string {
    const title = ok ? "¡Listo!" : "Algo salió mal";
    const msg = ok
      ? "Sesión iniciada en Yutu. Ya puedes cerrar esta pestaña."
      : "No se pudo completar el inicio de sesión. Vuelve a la app e inténtalo de nuevo.";
    return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Yutu</title><style>
  body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  background:radial-gradient(120% 90% at 50% 10%,#2a1150,#160a2e 55%,#0a0613);color:#fff;}
  .card{text-align:center;padding:48px 56px;border-radius:20px;
  background:rgba(255,255,255,.04);border:1px solid rgba(255,90,180,.35);
  box-shadow:0 0 60px rgba(177,75,255,.35);}
  h1{font-size:28px;margin:0 0 10px;background:linear-gradient(90deg,#ff7ac6,#00f0ff);
  -webkit-background-clip:text;background-clip:text;color:transparent;}
  p{opacity:.85;margin:0;max-width:320px;}
</style></head><body><div class="card"><h1>${title}</h1><p>${msg}</p></div></body></html>`;
  }
}
