# @sismos/geomap

Motor de mapas de teselas (raster) ligero, **sin dependencias**, escrito en TypeScript. Implementa **Web Mercator** con zoom fraccional, pan/zoom/pinch/teclado, marcadores con diffing, capa de selección (bounds) y cambio de tema en caliente.

Diseñado para reemplazar a Leaflet cuando solo se necesitan teselas ráster y marcadores, con una API mínima y ~8 KB gzipped.

## Características

- **Proyección Web Mercator** (EPSG:3857) con `zoom` fraccional (p. ej. 5.3) y transiciones suaves (`flyTo`).
- **Teselas ráster** (`<img>`) con carga perezosa, subdominios configurables y limpieza automática fuera de viewport.
- **Temas integrados** (sin API key):
  - `dark` → **OpenTopoMap** (topográfico, curvas de nivel)
  - `voyager` → **OpenStreetMap Standard** (callejero clásico)
  - `light` → **OpenStreetMap DE** (estilo claro alemán)
  - `satellite` → **Esri World Imagery**
- **Interacción**: arrastrar (pointer), rueda (zoom centrado), doble clic (zoom in), pinch (touch), teclado (flechas, `+/-`).
- **Marcadores**: diffing por `id`, etiqueta de magnitud, pulso animado para eventos recientes, click/hover con eventos.
- **Capa de selección**: resalta un `Bounds` (p. ej. bbox de filtro).
- **Controles UI opcionales**: barra de escala, atribución dinámica por tema.
- **Eventos tipados**: `move`, `click`, `marker-click`, `marker-hover`, `zoom-end`, `theme-change`.
- **SSR-safe**: sin acceso a `window`/`document` en importación; instanciación lazy en cliente.

## Instalación

```bash
npm install @sismos/geomap
```

Uso directo (source-first):

```ts
import { TileMap, MAP_THEMES, THEME_META, type MapMarker, type MapTheme } from '@sismos/geomap';
import '@sismos/geomap/styles.css'; // o importa el .module.css desde tu bundler
```

> **Nota**: El CSS se entrega como `TileMap.module.css` (CSS Modules). Si tu bundler no soporta CSS Modules, copia el contenido a un `.css` global y ajusta los nombres de clase.

## Uso rápido

```ts
import { TileMap, MAP_THEMES, type MapMarker, type LatLng } from '@sismos/geomap';

const container = document.getElementById('map')!;

const markers: MapMarker[] = [
  { id: 'eq-1', lat: -9.19, lon: -75.02, magnitude: 6.7, color: '#ff5f3d', size: 22, label: '6.7', title: 'M6.7 · Perú' },
];

const map = new TileMap(container, {
  theme: 'dark',
  center: { lat: -9.19, lon: -75.02 },
  zoom: 5,
  minZoom: 2,
  maxZoom: 17,
  markers,
  selectionBounds: { minLat: -18.5, maxLat: 0, minLon: -81.5, maxLon: -68.5 },
});

// Suscripciones tipadas
const unmove = map.on('move', (info) => console.log('center', info.center, 'zoom', info.zoom));
const unclick = map.on('marker-click', ({ marker, screen }) => console.log(marker.id, screen));

// Cambiar tema en caliente
map.setTheme('satellite');

// Volar a coordenadas
map.flyTo({ lat: -12.05, lon: -77.03 }, 8, 800);

// Ajustar a bounds
map.fitBounds({ minLat: -20, maxLat: -10, minLon: -80, maxLon: -70 }, 56, true);

// Limpieza
unmove();
unclick();
map.destroy();
```

## API

### `TileMap`

```ts
constructor(container: HTMLElement, options: TileMapOptions = {})
```

#### `TileMapOptions`

```ts
interface TileMapOptions {
  center?: LatLng;           // default: { lat: 0, lon: 0 }
  zoom?: number;             // default: 5 (fraccional permitido)
  minZoom?: number;          // default: 2
  maxZoom?: number;          // default: 18
  theme?: MapTheme;          // 'dark' | 'voyager' | 'light' | 'satellite'
  markers?: MapMarker[];     // array inicial
  interactive?: boolean;     // default: true
  attribution?: string;      // override atribución HTML
  tileSize?: number;         // default: 256
  retina?: boolean;          // default: devicePixelRatio > 1 (solo temas que lo soporten)
  selectionBounds?: Bounds | null;
}
```

#### Métodos públicos

| Método | Descripción |
|--------|-------------|
| `setTheme(theme: MapTheme)` | Cambia tema, recarga teselas, emite `theme-change` |
| `getTheme(): MapTheme` | Tema actual |
| `setAttribution(html?: string)` | Sobrescribe atribución |
| `setView(view, { animate?, duration? })` | Centro + zoom (con/sin animación) |
| `getView(): MapView` | `{ center, zoom }` actual |
| `getBounds(): Bounds` | Bounds del viewport actual |
| `flyTo(center, zoom?, duration?)` | Animación suave (ease-out cúbico) |
| `fitBounds(bounds, padding?, animate?)` | Calcula zoom/centro para encajar bounds |
| `zoomIn() / zoomOut()` | ±1 nivel con animación corta |
| `panBy(dx, dy)` | Desplaza píxeles en plano de pantalla |
| `setMarkers(markers: MapMarker[])` | Diffing por `id`: crea/actualiza/elimina |
| `setSelected(id \| null)` | Resalta marcador (clase CSS `.selected`) |
| `setSelectionBounds(bounds \| null)` | Dibuja/oculta rectángulo de selección |
| `setInteractive(boolean)` | Activa/desactiva interacción + clase `.static` |
| `project(lat, lon): Point` | Coordenadas geo → píxeles en contenedor |
| `unproject(x, y): LatLng` | Píxeles → coordenadas geo |
| `resize()` | Fuerza recálculo de tamaño (ResizeObserver interno) |
| `destroy()` | Limpia DOM, listeners, timers, observers |

#### Eventos (`map.on<K>(type, handler)`)

```ts
type MapEventMap = {
  move: ViewInfo;                    // cada frame durante pan/zoom
  click: { lat, lon, screen };       // click en mapa (sin marcador)
  'marker-click': { marker, screen };
  'marker-hover': { marker \| null, screen \| null };
  'zoom-end': ViewInfo;              // al terminar animación/zoom
  'theme-change': { theme: MapTheme };
};
```

`ViewInfo` extiende `MapView` con `bounds`, `width`, `height`.

### Temas

```ts
export const MAP_THEMES: MapTheme[] = ['dark', 'voyager', 'light', 'satellite'];

export const THEME_META: Record<MapTheme, ThemeMeta> = {
  dark: { label: 'Topográfico', attribution: '...', dark: false, retina: false },
  voyager: { label: 'Estándar', attribution: '...', dark: false, retina: false },
  light: { label: 'Claro (OSM DE)', attribution: '...', dark: false, retina: false },
  satellite: { label: 'Satélite', attribution: '...', dark: true, retina: false },
};
```

Puedes extender `THEMES` y `THEME_META` para añadir proveedores propios (ej. MapTiler con API key, Stadia Maps, etc.).

### Utilidades Mercator (`mercator.ts`)

```ts
import {
  TILE_SIZE,           // 256
  MAX_LATITUDE,        // 85.0511287798066
  clamp, clampLat, wrapLon,
  lonToWorldX, latToWorldY,
  worldXToLon, worldYToLat,
  metersPerPixel,      // resolución en m/px a dado zoom/lat
  zoomToFit,           // calcula zoom para encajar bounds en w×h
} from '@sismos/geomap';
```

### Tipos

```ts
type MapTheme = 'dark' | 'voyager' | 'light' | 'satellite';

interface LatLng { lat: number; lon: number; }
interface Point { x: number; y: number; }
interface Bounds { minLat, maxLat, minLon, maxLon: number; }
interface MapView { center: LatLng; zoom: number; }

interface MapMarker {
  id: string;
  lat: number; lon: number;
  magnitude?: number;
  color?: string;        // default: magnitudeColor(magnitude)
  size?: number;         // 10–30 px
  label?: string;        // ej. "6.7"
  pulse?: boolean;       // anillo animado
  title?: string;        // tooltip
  data?: unknown;        // payload arbitrario
}
```

## CSS / Estilos

El componente usa **CSS Modules** (`TileMap.module.css`). Clases clave:

- `.map` — contenedor raíz (`position: relative`, `touch-action: none`)
- `.tiles` — capa de teselas (`transform: translate3d() scale()`)
- `.markers` — capa de marcadores
- `.overlays` — capa de selección (bounds)
- `.scale` / `.scaleBar` / `.scaleLabel` — barra de escala
- `.attribution` — atribución HTML (bottom-right)
- `.tile` — `<img>` individual (`.loaded` cuando completa)
- `.markerWrap` — wrapper por marcador (`translate3d`)
- `.markerBtn` — botón del marcador (accesible, `aria-label`)
- `.markerPulse` — anillo animado (keyframes `pulse`)
- `.selection` — rectángulo de selección (stroke amarillo/ámbar)
- `.static` — clase en root cuando `interactive=false`

Para usar sin CSS Modules, extrae el CSS compilado (Vite lo inyecta) o copia el archivo `.module.css` renombrando las clases hash a nombres semánticos.

## Rendimiento y límites

- **Teselas**: se crean/destruyen solo las que entran/salen del viewport (`syncTiles`). Limpieza automática en `clearTiles()`.
- **Marcadores**: diffing O(n) por `id`; posición recalculada solo en `render()` (zoom/pan).
- **Zoom fraccional**: renderiza en `z = round(zoom)` y escala con `scale = 2^(zoom - z)` → transiciones fluidas sin recargar teselas en cada frame.
- **Memoria**: `maxEvents` en feed sísmico (default 3000/4000) evita crecimiento ilimitado.
- **Subdominios**: configurados por tema (`THEME_SUBDOMAINS`) para evitar `d.tile.openstreetmap.org` que falla.

## Proveedores de teselas (sin API key)

| Tema | Proveedor | URL base | Subdominios | Retina |
|------|-----------|----------|-------------|--------|
| `dark` | OpenTopoMap | `https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png` | a,b,c | No |
| `voyager` | OSM Standard | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` | a,b,c | No |
| `light` | OSM DE | `https://{s}.tile.openstreetmap.de/tiles/osmde/{z}/{x}/{y}.png` | a,b,c | No |
| `satellite` | Esri World Imagery | `https://server.arcgisonline.com/.../tile/{z}/{y}/{x}` | — | No |

> **Nota**: La especificación original usaba CARTO (`basemaps.cartocdn.com`) que ahora requiere API key para teselas ráster. Este paquete migra a proveedores gratuitos y abiertos. Los estilos vectoriales de CARTO para MapLibre GL siguen sin clave, pero este motor es solo ráster.

## Licencia

MIT