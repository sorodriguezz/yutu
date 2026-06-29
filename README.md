# 🌆 Yutu — Synthwave Player

Reproductor de escritorio (Electron + TypeScript, **Clean Architecture**) con estética **synthwave/retro**. Reproduce **música y video locales (MP3/MP4…)**, videos de **YouTube**, gestiona playlists y te permite **iniciar sesión con Google** para importar tus playlists de YouTube.

![icono](build/icon.png)

## ✨ Características

- 🎧 **Reproducción local** — agrega tus archivos `MP3, WAV, FLAC, M4A, AAC, OGG, OPUS` (audio) y `MP4, WEBM, MKV, MOV, AVI` (video) desde tu PC. Streaming local con soporte de _seek_ (HTTP Range).
- 🏷️ **Metadatos embebidos** — lee título, artista, **álbum**, **año** y **carátula** desde las etiquetas del archivo y los muestra en la interfaz.
- 🎚️ **Crossfade / gapless** — fundido configurable (0–12 s) entre canciones de audio local, con doble buffer de Web Audio. Ajústalo en **⚙ Ajustes**.
- 📊 **Visualizador audio-reactivo** — barras en tiempo real (Web Audio `AnalyserNode`) que reaccionan al audio local, con glow y reflejo synthwave.
- 🔴 **YouTube** — pega cualquier URL/ID o busca con tu API Key. Reproducción vía YouTube IFrame API.
- 🟣 **Modo YouTube Music** — abre la web real de YouTube Music embebida (con login persistente) desde la barra superior, con **bloqueo de anuncios** integrado.
- ⬇️ **Descarga a MP3** — botón de descarga en cada pista de YouTube y en el modo YT Music; usa yt-dlp + ffmpeg y guarda el archivo en tu biblioteca local.
- 🟢 **Login con Google (OAuth 2.0 + PKCE)** — inicia sesión de forma segura (navegador del sistema + loopback). Importa tus **playlists de YouTube** a playlists locales.
- 🎨 **Paletas synthwave + color libre** — varios esquemas neón (Miami, Outrun, Vaporwave, Cyberpunk, Midnight, Laser) o tu propio color de acento.
- 🌐 **Bilingüe (ES / EN)** — interfaz traducida con cambio de idioma en caliente.
- ⏰ **Temporizador de apagado** — pausa la reproducción automáticamente a los 15, 30, 45 o 60 minutos.
- ⌨️ **Atajos de teclado y teclas multimedia** — controla la reproducción sin el mouse (pulsa `?` para ver la lista).
- 🔔 **Notificaciones de escritorio** — aviso al cambiar de canción.
- 🔄 **Actualizaciones automáticas** — la app se actualiza sola vía electron-updater.
- 🕹️ **Diseño synthwave** — sol neón, grid en perspectiva animado, scanlines, glassmorphism, glow y tipografía Orbitron. Badges por fuente (YouTube / Local) y vinilo girando.

## 🚀 Desarrollo

```bash
npm install        # dependencias
npm start          # compila y abre la app
npm run build      # solo compilar (tsc + copia de assets)
npm run dist       # generar instalador para tu plataforma actual
```

## 🎵 Cómo usar

| Acción | Dónde |
|---|---|
| Agregar MP3/MP4 locales | Sidebar → **Archivos locales** |
| Reproducir YouTube | Barra superior → pega URL → **+ URL**, o **Buscar** |
| Crear playlist | Sidebar → ＋ / campo "Nueva playlist" |
| Importar/Exportar playlist | Sidebar → **Importar** · ⬇ en cada playlist |
| Iniciar sesión Google | Sidebar → **Conectar con Google** |
| Importar playlists de YouTube | Perfil → botón **YT** |
| Temporizador de apagado | Barra superior → ⏰ |
| Ver atajos de teclado | Pulsa **?** |
| Color de acento, volumen, claves | Barra superior → ⚙ Ajustes |

### ⌨️ Atajos de teclado

| Tecla | Acción |
|---|---|
| `Espacio` | Play / Pausa |
| `→` / `←` | Siguiente / Anterior |
| `↑` / `↓` | Subir / bajar volumen |
| `M` | Silenciar |
| `S` | Aleatorio (shuffle) |
| `R` | Repetir |
| `/` | Ir al buscador de YouTube |
| `?` | Mostrar atajos |
| `Esc` | Cerrar menús/ventanas |

## 🔐 Configurar el login con Google

El login usa el flujo de **app instalada** (Authorization Code + PKCE). Necesitas tus propias credenciales (gratis):

1. Entra a [Google Cloud Console](https://console.cloud.google.com/) y crea/elige un proyecto.
2. **APIs y servicios → Biblioteca** → habilita **YouTube Data API v3**.
3. **Pantalla de consentimiento OAuth** → tipo *Externo* → agrega tu correo como *usuario de prueba*.
4. **Credenciales → Crear credenciales → ID de cliente de OAuth → Tipo: _App de escritorio_**.
5. Copia el **Client ID** y el **Client Secret**.
6. En Yutu: **⚙ Ajustes → Cuenta de Google** → pega ambos → **Guardar credenciales**.
7. **Conectar con Google** en la barra lateral. Se abrirá tu navegador; al autorizar, vuelve a la app.

> El _Client Secret_ de un cliente de escritorio no es confidencial (Google lo asume así), pero Yutu **nunca** lo expone al proceso de UI: los tokens se guardan localmente en `db.json` y solo el proceso principal los maneja.

### YouTube API Key (búsqueda, opcional)

Para la búsqueda integrada: **⚙ Ajustes → YouTube API Key** (crea una _API Key_ en Cloud Console con YouTube Data API v3 habilitada). Sin ella, puedes seguir agregando videos por URL directa.

## 📦 Publicar un release

El release es **automático**: cada push a `main` revisa la versión de `package.json`. Si **no** existe aún un release para esa versión, se construyen y publican los instaladores; si ya existe, no hace nada.

```bash
# 1) Sube la versión en package.json (ej. 2.1.0 → 2.2.0)
# 2) Haz push a main:
git push origin main
```

Los workflows están en `.github/workflows/`:

- **`ci.yml`** — compila el proyecto en cada push/PR (verifica tipos + assets).
- **`release.yml`** — al detectar una versión nueva en `main`, construye y publica los instaladores en _GitHub Releases_ (3 jobs en paralelo: macOS, Windows y Linux).

> Para **firmar/notarizar** agrega los secrets `CSC_LINK`, `CSC_KEY_PASSWORD` (mac/win) y `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` (notarización mac) en el repositorio. La publicación a GitHub usa el `GITHUB_TOKEN` automático.

## 🧱 Arquitectura

Clean Architecture: el dominio y los casos de uso no conocen Electron.

```
src/
├── core/                         # Lógica pura (sin Electron)
│   ├── domain/
│   │   ├── entities/             # Track (youtube | local), Playlist
│   │   ├── valueObjects/         # tipos/valores del dominio
│   │   └── errors/               # errores de dominio
│   └── application/
│       ├── ports/                # PlayerPort, FileDialogPort, AuthPort, ...
│       ├── services/             # QueueService, toPlayableMedia
│       └── usecases/             # playback, playlists, auth, settings
│
├── main/                         # Proceso principal (Electron)
│   ├── main.ts                   # Ventana + servidor HTTP (player + streaming /media)
│   ├── di/container.ts           # Inyección de dependencias
│   ├── infra/
│   │   ├── player/               # ElectronMediaPlayer (YouTube + local)
│   │   ├── auth/                 # GoogleAuthAdapter (OAuth PKCE + loopback)
│   │   ├── system/               # teclas multimedia, auto-updater
│   │   ├── logging/ util/
│   │   └── io/ persistence/ youtube/
│   └── ipc/                      # Canales y handlers
│
├── player/                       # WebContentsView del reproductor
│   ├── player-http.html/.js      # Modo dual: iframe YouTube + <video> local
│   └── player-preload.ts
│
├── preload/preload.ts            # API segura expuesta al renderer
└── renderer/                     # UI synthwave (index.html, styles.css, renderer.js)
```

### ¿Cómo reproduce archivos locales?

El proceso principal levanta un pequeño servidor HTTP (`localhost:3456`) que ya servía el reproductor de YouTube. Se le añadió el endpoint **`/media?src=<ruta>`** que hace _streaming_ del archivo con soporte de **Range** (necesario para el _seek_). El `WebContentsView` reproduce YouTube (iframe) o archivos locales (`<video>`/`<audio>`) según la fuente de la pista, controlado por los mismos comandos play/pause/seek/volume.

## ⚖️ Nota legal y descargo de responsabilidad

Yutu es un proyecto independiente, **sin afiliación** con Google, YouTube ni YouTube Music.

El **modo YouTube Music**, el **bloqueo de anuncios** y la **descarga a MP3** son funciones que pueden **infringir los Términos de Servicio de Google/YouTube** y, según el contenido y tu jurisdicción, leyes de copyright. Estas funciones se ofrecen "tal cual", para uso personal y bajo tu propia responsabilidad. Úsalas solo con contenido que tengas derecho a descargar (propio, de dominio público, con licencia Creative Commons, etc.). El bloqueo de anuncios puede desactivarse en **⚙ Ajustes**.

La descarga requiere **yt-dlp** (se descarga automáticamente la primera vez) y **ffmpeg** (incluido vía `ffmpeg-static`).

## 🛠️ Tecnologías

Electron · TypeScript · YouTube IFrame API · OAuth 2.0 (PKCE) · electron-builder · electron-updater · GitHub Actions.

---

Hecho con 💜 en modo synthwave.
