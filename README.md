# YT Local Player

🎵 Reproductor de música desde YouTube con gestión avanzada de playlists locales.

## Características principales (MVP v0.1)

### ✅ Reproducción desde YouTube
- Pega URL o VideoId de YouTube para reproducir
- Soporta formatos:
  - `https://www.youtube.com/watch?v=VIDEOID`
  - `https://youtu.be/VIDEOID`
  - `https://www.youtube.com/shorts/VIDEOID`
  - VideoId directo (11 caracteres)

### ✅ Controles de reproducción
- ▶️ Play / Pause
- ⏭️ Siguiente
- ⏮️ Anterior
- 🔊 Control de volumen (0-100)
- Barra de progreso con seek
- Tiempo actual / duración

### ✅ Cola de reproducción
- Agregar tracks a la cola
- Visualizar cola completa
- Reproducir cualquier track haciendo clic
- Contador de canciones en cola

### ✅ Shuffle y Repeat
- 🔀 **Shuffle**: Aleatorio on/off
- 🔁 **Repeat**: Ciclo off → all → one
  - **Off**: Se detiene al final
  - **All**: Vuelve al inicio al terminar
  - **One**: Repite el mismo track

### ✅ Playlists locales
- 📁 Crear playlists con nombre
- 🗑️ Eliminar playlists
- ➕ Agregar tracks desde la cola a playlists
- ▶️ Encolar playlist completa
- 📥 Exportar playlist a JSON
- 📤 Importar playlist desde JSON

### ✅ Personalización
- 🎨 Cambiar color de acento
- 🔊 Configurar volumen por defecto
- Persistencia de configuración local

## Arquitectura

El proyecto sigue **Clean Architecture** con separación clara de responsabilidades:

```
src/
├── core/                    # Lógica de negocio pura
│   ├── domain/             # Entidades y value objects
│   │   ├── entities/       # Track, Playlist
│   │   └── valueObjects/   # VideoId
│   └── application/        # Casos de uso
│       ├── ports/          # Interfaces (abstracciones)
│       ├── services/       # QueueService
│       └── usecases/       # Casos de uso específicos
│           ├── playback/   # EnqueueTrack, PlayPause, Next, etc.
│           ├── playlists/  # CreatePlaylist, AddTrack, Export, etc.
│           └── settings/   # UpdateAccentColor, etc.
│
├── main/                    # Main process (Electron)
│   ├── main.ts             # Punto de entrada
│   ├── di/                 # Inyección de dependencias
│   ├── infra/              # Adaptadores de infraestructura
│   │   ├── player/         # YouTube Player (IPC)
│   │   ├── persistence/    # JSON Database
│   │   ├── io/             # File dialogs
│   │   └── logging/        # Console logger
│   └── ipc/                # Comunicación IPC
│
├── renderer/                # Renderer process (UI)
│   ├── index.html          # Estructura HTML
│   ├── styles.css          # Estilos modernos
│   └── renderer.js         # Lógica de UI
│
├── player/                  # Player window (YouTube embed)
│   ├── player.html         # IFrame de YouTube
│   ├── player.js           # API de YouTube
│   └── player-preload.js   # Preload del player
│
└── preload/                 # Security layer
    └── preload.js          # API expuesta al renderer
```

## Tecnologías

- **Electron** - Framework multiplataforma
- **TypeScript** - Type safety en el backend
- **YouTube IFrame API** - Reproducción de videos
- **JSON** - Persistencia local simple
- **IPC** - Comunicación segura entre procesos

## Principio legal

⚠️ **La app NO elimina anuncios ni modifica YouTube**

- Si el usuario tiene **YouTube Premium** y está logueado → Sin anuncios
- Si no → Reproducción normal con anuncios

## Comandos

```bash
# Instalar dependencias
npm install

# Compilar y ejecutar
npm start

# Solo compilar
npm run build

# Generar distribución
npm run dist
```

## Estructura de datos

### Track
```typescript
{
  id: string;           // UUID
  provider: "youtube";
  videoId: string;      // 11 caracteres
  title?: string;
  addedAt: number;      // timestamp
}
```

### Playlist
```typescript
{
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  items: Track[];
}
```

### Settings
```typescript
{
  accentColor: string;    // hex color
  volumeDefault: number;  // 0-100
}
```

## Export/Import de playlists

Las playlists se exportan como archivos `.json` con toda la información:
- Nombre de la playlist
- Timestamps de creación/actualización
- Lista completa de tracks (videoId, título, etc.)

Al importar:
- Si el ID ya existe, se genera uno nuevo
- Se valida estructura mínima del JSON
- Se agrega a la colección local

## Diseño UI

El diseño utiliza un **tema moderno oscuro** con:

- 🎨 **Gradientes sutiles** en backgrounds
- 💎 **Glassmorphism** en paneles
- 🌊 **Animaciones suaves** en hover/click
- 📱 **Layout responsive** con sidebar fijo
- 🎯 **Controles grandes** y accesibles
- 🔵 **Color de acento configurable**

### Paleta de colores por defecto
- Acento: `#6366f1` (Indigo)
- Fondo principal: `#0f0f23`
- Paneles: `#1a1a2e` / `#25254a`
- Texto: `#f0f0f5`
- Texto muted: `#9ca3af`

## Historias de usuario cumplidas

✅ US-01: Reproducir track pegando link  
✅ US-02: Controlar reproducción (play/pause/next/prev)  
✅ US-03: Ajustar volumen  
✅ US-04: Ver progreso y hacer seek  
✅ US-05: Shuffle y Repeat  
✅ US-06: Crear y eliminar playlists  
✅ US-07: Agregar tracks a playlists desde la cola  
✅ US-08: Encolar playlist  
✅ US-09: Exportar playlist a JSON  
✅ US-10: Importar playlist desde JSON  
✅ US-11: Cambiar color de acento  

## Seguridad

- ✅ **Context Isolation** habilitado
- ✅ **Node Integration** deshabilitado
- ✅ **Preload scripts** con APIs expuestas de forma segura
- ✅ **IPC** para comunicación main ↔ renderer
- ✅ Sin acceso directo a APIs de Node desde el renderer

## Próximas mejoras (fuera del MVP)

- 🔍 Búsqueda en YouTube desde la app
- 🎵 Metadata completa (thumbnails, duración real, etc.)
- ☁️ Sincronización con playlists de YouTube
- 🔐 OAuth login con Google
- ⌨️ Media keys support
- 📌 Tray icon / Mini player
- 🔄 Auto-update
- 💾 Cache de metadata local

## Builds multiplataforma

```bash
npm run dist
```

Genera builds para:
- 🪟 **Windows** (NSIS installer)
- 🍎 **macOS** (DMG + ZIP, Apple Silicon ready)
- 🐧 **Linux** (AppImage + deb)

---

**MVP v0.1** - YT Local Player  
Compatible con YouTube Premium • Playlists exportables • Control total de reproducción
