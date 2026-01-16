# YT Local Player

🎵 Reproductor de música desde YouTube con gestión de playlists locales y una interfaz moderna estilo Spotify.

## Características

### 🎬 Reproducción desde YouTube
- Pega cualquier URL de YouTube para reproducir
- Soporta múltiples formatos:
  - `https://www.youtube.com/watch?v=VIDEOID`
  - `https://youtu.be/VIDEOID`
  - `https://www.youtube.com/shorts/VIDEOID`
  - VideoId directo (11 caracteres)
- Obtención automática de título y autor del video

### 🎛️ Controles de reproducción
- ▶️ Play / ⏸️ Pause
- ⏭️ Siguiente / ⏮️ Anterior
- 🔊 Control de volumen con slider
- 🔇 Botón de Mute/Unmute
- Barra de progreso con seek
- Tiempo actual / duración en formato `m:ss`

### 📋 Cola de reproducción
- Agregar videos a la cola desde URL
- Ver lista completa de canciones en cola
- Reproducir cualquier canción haciendo clic
- 📎 **Copiar link de YouTube** de cualquier canción
- ❌ Eliminar canciones de la cola
- Contador de canciones

### 🔀 Shuffle y Repeat
- **Shuffle**: Reproducción aleatoria on/off
- **Repeat**: Ciclo de repetición
  - `off` → Se detiene al final
  - `all` → Repite toda la cola
  - `one` → Repite la canción actual

### 📁 Playlists locales
- ➕ Crear playlists con nombre personalizado
- 🗑️ Eliminar playlists
- Agregar canciones desde la cola a cualquier playlist
- ▶️ Encolar playlist completa para reproducir
- 📥 **Exportar** playlist a archivo JSON
- 📤 **Importar** playlist desde archivo JSON

### ⚙️ Configuración
- 🎨 Color de acento personalizable
- 🔊 Volumen por defecto (se guarda y restaura al iniciar)
- 📺 Mostrar/ocultar ventana del video
- Persistencia automática de todas las configuraciones

### 🎨 Interfaz moderna
- Tema oscuro estilo Spotify
- Animaciones suaves
- Controles grandes y accesibles
- Layout con sidebar + área principal + barra de reproductor
- Notificaciones toast para feedback visual

## Capturas de pantalla

La interfaz incluye:
- **Sidebar izquierdo**: Logo, biblioteca de playlists, botón importar
- **Área principal**: Barra de búsqueda, información del track actual, cola de reproducción
- **Barra inferior**: Controles de reproducción, progreso, volumen

## Instalación

```bash
# Clonar repositorio
git clone <repo-url>
cd yutu

# Instalar dependencias
npm install

# Compilar y ejecutar
npm start

# Solo compilar
npm run build

# Generar distribución
npm run dist
```

## Arquitectura

El proyecto sigue **Clean Architecture** con separación clara:

```
src/
├── core/                    # Lógica de negocio pura
│   ├── domain/             # Entidades (Track, Playlist)
│   └── application/        # Casos de uso y puertos
│
├── main/                    # Main process (Electron)
│   ├── main.ts             # Punto de entrada
│   ├── di/                 # Inyección de dependencias
│   ├── infra/              # Adaptadores (player, persistence, io)
│   └── ipc/                # Comunicación IPC
│
├── renderer/                # Renderer process (UI)
│   ├── index.html          # Estructura HTML
│   ├── styles.css          # Estilos CSS
│   └── renderer.js         # Lógica de interfaz
│
├── player/                  # Ventana del reproductor YouTube
│   ├── player-http.html    # HTML del player
│   └── player-http.js      # YouTube IFrame API
│
└── preload/                 # Capa de seguridad
    └── preload.ts          # API expuesta al renderer
```

## Tecnologías

- **Electron** - Framework de apps de escritorio
- **TypeScript** - Tipado estático en el backend
- **YouTube IFrame API** - Reproducción de videos
- **JSON** - Persistencia local
- **IPC** - Comunicación segura entre procesos

## Principio legal

⚠️ **La app NO elimina anuncios ni modifica YouTube**

- Usuario con **YouTube Premium** logueado → Sin anuncios
- Usuario sin Premium → Reproducción normal con anuncios de YouTube

## Estructuras de datos

### Track
```typescript
{
  id: string;           // UUID único
  provider: "youtube";
  videoId: string;      // ID de 11 caracteres
  title?: string;       // Título del video
  author?: string;      // Canal/autor
  addedAt: number;      // Timestamp
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
  accentColor: string;    // Color hex (#RRGGBB)
  volumeDefault: number;  // 0-100
}
```

## Seguridad

- ✅ **Context Isolation** habilitado
- ✅ **Node Integration** deshabilitado
- ✅ **Preload scripts** seguros
- ✅ **IPC** para comunicación main ↔ renderer
- ✅ Sin acceso directo a Node desde el renderer

## Builds multiplataforma

```bash
npm run dist
```

Genera instaladores para:
- 🪟 **Windows** - NSIS installer
- 🍎 **macOS** - DMG + ZIP (Apple Silicon compatible)
- 🐧 **Linux** - AppImage + deb

## Próximas mejoras

- 🔍 Búsqueda integrada en YouTube
- 🖼️ Thumbnails de videos
- ⌨️ Soporte para media keys del teclado
- 📌 Mini player / Tray icon
- 🔄 Auto-actualización

---

**YT Local Player** v1.0  
Playlists locales • Control total • Compatible con YouTube Premium
