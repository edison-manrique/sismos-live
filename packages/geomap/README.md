# @sismos/geomap

Motor de mapas ráster ligero, **sin dependencias externas**, escrito en TypeScript sobre proyección **Web Mercator (EPSG:3857)**. Ofrece pirámide multizoom retenida para evitar parpadeos o pantallas negras en transiciones, marcadores DOM con diffing por `id`, polígonos SVG de selección territorial y cambio de tema en caliente.

---

## Características principales

- **Proyección Web Mercator** con zoom fraccional fluido durante animaciones y asentamiento en niveles enteros alineados a píxel para máxima nitidez.
- **Pirámide de teselas retenida**: conserva temporalmente el nivel de zoom anterior escalado bajo las nuevas teselas hasta que terminan de descargar, evitando destellos o fondos negros durante `flyTo`, zoom rápido o cambio de región, e incluye reintento ante errores transitorios.
- **Zoom centrado en el cursor**: rueda del ratón, doble clic y controles respetan la posición del puntero dentro del viewport.
- **Interacción completa**: arrastre con puntero, gesto pinch multitáctil, navegación por teclado (`+`, `-`, flechas direccionales).
- **Marcadores DOM reutilizados**: actualización incremental por `id`, etiqueta de magnitud escalada, pulso animado configurable y eventos tipados de clic/hover.
- **Superposiciones vectoriales y cajas**: polígonos SVG (`selectionPolygon`) para límites territoriales sin relleno y rectángulos `selectionBounds`.
- **Controles integrados**: barra de escala métrica dinámica y atribución automática por proveedor.

---

## Instalación e importación

```bash
npm install @sismos/geomap
```

Uso *source-first* dentro del monorepo:

```ts
import {
  TileMap,
  MAP_THEMES,
  THEME_META,
  type MapMarker,
  type MapTheme,
} from '@sismos/geomap';
```

---

## Ejemplo de uso

```ts
import { TileMap, type MapMarker } from '@sismos/geomap';

const container = document.getElementById('map')!;

const markers: MapMarker[] = [
  {
    id: 'eq-1',
    lat: -12.05,
    lon: -77.04,
    magnitude: 6.1,
    color: '#ff5f3d',
    size: 24,
    label: '6.1',
    pulse: true,
    title: 'M6.1 · Lima, Perú',
  },
];

const map = new TileMap(container, {
  theme: 'voyager',
  center: { lat: -9.19, lon: -75.02 },
  zoom: 5,
  minZoom: 2,
  maxZoom: 17,
  markers,
});

const stopMove = map.on('move', (view) => console.log(view.center, view.zoom));
const stopMarker = map.on('marker-click', ({ marker, screen }) => {
  console.log(marker.id, screen);
  map.flyTo({ lat: marker.lat, lon: marker.lon }, 10, 700);
});

map.setTheme('satellite');
map.setSelectionPolygon([
  { lat: -3.41, lon: -80.28 },
  { lat: -18.35, lon: -70.38 },
  { lat: -12.05, lon: -77.16 },
]);

// Limpieza al desmontar
stopMove();
stopMarker();
map.destroy();
```

---

## API pública

### `TileMap(container, options?)`

#### `TileMapOptions`

```ts
interface TileMapOptions {
  center?: LatLng;                         // Por defecto: { lat: -9.19, lon: -75.02 }
  zoom?: number;                           // Por defecto: 5
  minZoom?: number;                        // Por defecto: 2
  maxZoom?: number;                        // Por defecto: 18
  theme?: MapTheme;                        // Por defecto: 'dark'
  markers?: MapMarker[];
  interactive?: boolean;                   // Por defecto: true
  attribution?: string;                    // Sobrescribe atribución HTML del tema
  tileSize?: number;                       // Por defecto: 256
  retina?: boolean;                        // Por defecto: window.devicePixelRatio > 1
  selectionBounds?: Bounds | null;         // Caja geográfica resaltada
  selectionPolygon?: LatLng[] | LatLng[][] | null; // Anillo o multianillo SVG
}
```

#### Métodos principales

| Método | Descripción |
|--------|-------------|
| `setTheme(theme)` | Cambia la capa base y recarga las teselas; emite `theme-change` |
| `getTheme()` | Devuelve el `MapTheme` activo |
| `setAttribution(html?)` | Sobrescribe o restaura la atribución HTML |
| `setView(view, { animate?, duration? })` | Posiciona cámara instantáneamente o mediante animación |
| `getView()` | Retorna `{ center, zoom }` actuales |
| `getBounds()` | Retorna el `Bounds` visible del viewport |
| `flyTo(center, zoom?, duration?)` | Desplaza cámara con ease-out cúbico conservando teselas base |
| `fitBounds(bounds, padding?, animate?)` | Calcula zoom entero y centro para encuadrar un área |
| `zoomIn()` / `zoomOut()` | Acerca o aleja un nivel anclado al cursor (si está dentro del mapa) |
| `panBy(dx, dy)` | Desplaza el mapa en píxeles de pantalla |
| `setMarkers(markers)` | Sincroniza marcadores con diffing O(n) por `id` |
| `setSelected(id \| null)` | Marca un marcador como seleccionado (`.selected`) |
| `setSelectionBounds(bounds \| null)` | Muestra u oculta el rectángulo de selección |
| `setSelectionPolygon(polygon \| null)` | Renderiza contorno SVG de uno o varios anillos geográficos |
| `setInteractive(boolean)` | Activa o desactiva eventos de usuario (`.static`) |
| `project(lat, lon)` / `unproject(x, y)` | Conversión entre coordenadas geográficas y píxeles locales |
| `resize()` / `destroy()` | Recalcula dimensiones o libera nodos DOM, observers y listeners |

#### Eventos (`map.on(type, handler)`)

| Evento | Payload | Cuándo se emite |
|--------|---------|-----------------|
| `move` | `ViewInfo` | En cada actualización de centro/zoom |
| `zoom-end` | `ViewInfo` | Al finalizar una animación de zoom o `setView` |
| `click` | `{ lat, lon, screen }` | Clic en el lienzo fuera de marcadores |
| `marker-click` | `{ marker, screen }` | Clic sobre un marcador |
| `marker-hover` | `{ marker \| null, screen \| null }` | Entrada/salida del puntero sobre un marcador |
| `theme-change` | `{ theme }` | Tras cambiar de capa base |

---

## Temas integrados (sin API key)

Orden en `MAP_THEMES`: `['voyager', 'light', 'satellite', 'dark']`.

| Clave | Etiqueta | Proveedor | Subdominios |
|-------|----------|-----------|-------------|
| `voyager` | Estándar | OpenStreetMap Standard | `a`, `b`, `c` |
| `light` | Claro (OSM DE) | OpenStreetMap DE | `a`, `b`, `c` |
| `satellite` | Satélite | Esri World Imagery | — |
| `dark` | Topográfico | OpenTopoMap | `a`, `b`, `c` |

---

## Utilidades Mercator (`mercator.ts`)

```ts
import {
  TILE_SIZE,
  MAX_LATITUDE,
  clamp,
  clampLat,
  wrapLon,
  lonToWorldX,
  latToWorldY,
  worldXToLon,
  worldYToLat,
  metersPerPixel,
  zoomToFit,
} from '@sismos/geomap';
```

---

## Clases CSS (`TileMap.module.css`)

- `.map` — contenedor raíz (`isolation: isolate`, `touch-action: none`, `user-select: none`)
- `.tiles` / `.tileLevel` / `.tile` / `.loaded` — capas multizoom de teselas ráster
- `.overlays` / `.selectionSvg` / `.selectionPath` / `.selection` — superposiciones vectoriales
- `.markers` / `.markerWrap` / `.marker` / `.dot` / `.ring` / `.pulse` / `.selected` / `.markerLabel` — marcadores interactivos
- `.scale` / `.scaleBar` / `.scaleLabel` — barra métrica de escala
- `.attribution` — bloque inferior derecho de atribución
- `.static` / `.dragging` — estados de interacción del mapa

---

## Licencia

MIT — Autor: **Edison Manrique Chocce**