# Sismos Live

Monitoreo sísmico en tiempo real para Perú y el mundo. Combina **EMSC (WebSocket live)** y **USGS (REST)** en una única interfaz 100vw × 100vh con mapa interactivo propio (sin Leaflet), panel lateral con estadísticas, filtros y lista paginada.

![Captura](apps/web/public/og.png)

## Stack

- **Vite + SolidJS** (TypeScript, JSX, CSS Modules)
- **Arquitectura monorepo** (npm workspaces):
  - `packages/seismic` → `@sismos/seismic` — datos (EMSC WS + USGS REST, feed reactivo)
  - `packages/geomap` → `@sismos/geomap` — motor de mapas ráster (Web Mercator, temas OSM/Esri)
  - `apps/web` → `@sismos/web` — aplicación SolidJS

## Requisitos

- Node ≥ 20.19
- npm ≥ 10 (o pnpm/yarn/bun con workspaces)

## Instalación y scripts

```bash
# Clona e instala (desde la raíz del monorepo)
git clone https://github.com/tu-usuario/sismos.git
cd sismos
npm install

# Desarrollo (Vite HMR en :5173)
npm run dev

# Type-check (todos los workspaces)
npm run typecheck

# Build producción (solo apps/web)
npm run build

# Preview build
npm run preview
```

> **Nota**: El proyecto usa `source-first` (importa `src/index.ts` directo vía aliases de Vite). No hay step de build de librerías; los tipos vienen de los `.ts` originales.

## Estructura

```
sismos/
├── package.json              # workspaces + scripts raíz
├── packages/
│   ├── seismic/              # @sismos/seismic
│   │   ├── src/
│   │   │   ├── index.ts      # exports públicos
│   │   │   ├── types.ts      # EarthquakeEvent, EventFilter, FeedSnapshot...
│   │   │   ├── feed.ts       # EarthquakeFeed (unificado)
│   │   │   ├── emsc.ts       # EmscSocket (WS + keep-alive + backoff)
│   │   │   ├── usgs.ts       # fetchUsgsEvents, buildUsgsUrl
│   │   │   ├── normalize.ts  # fromEmscMessage, fromUsgsFeature
│   │   │   └── utils.ts      # format, color, stats, bounds, filters
│   │   ├── tsconfig.json
│   │   └── README.md
│   └── geomap/               # @sismos/geomap
│       ├── src/
│       │   ├── index.ts
│       │   ├── types.ts      # MapTheme, MapMarker, TileMapOptions...
│       │   ├── TileMap.ts    # motor principal
│       │   ├── TileMap.module.css
│       │   ├── themes.ts     # THEMES, THEME_META, buildTileUrl
│       │   └── mercator.ts   # Web Mercator math
│       ├── tsconfig.json
│       └── README.md
└── apps/
    └── web/                  # @sismos/web
        ├── src/
        │   ├── main.tsx
        │   ├── App.tsx
        │   ├── App.module.css
        │   ├── global.css
        │   ├── state.tsx     # feed singleton, filtros, toasts, persistencia
        │   ├── components/
        │   │   ├── Header.tsx
        │   │   ├── Sidebar.tsx
        │   │   ├── StatsPanel.tsx
        │   │   ├── FiltersPanel.tsx
        │   │   ├── EventList.tsx
        │   │   ├── MapPanel.tsx
        │   │   ├── Toasts.tsx
        │   │   └── Icons.tsx
        │   └── vite-env.d.ts
        ├── vite.config.ts    # aliases @sismos/*
        ├── tsconfig.json
        └── index.html
```

## Funcionalidades

### Datos (EMSC + USGS)
- **EMSC WebSocket**: `wss://www.seismicportal.eu/standing_order/websocket`
  - `ping` cada 15 s (keep-alive obligatorio)
  - Reconexión exponencial con jitter (base 1s → tope 30s)
  - Deduplicación/upsert por `properties.unid`
- **USGS REST**: `https://earthquake.usgs.gov/fdsnws/event/1/query` (GeoJSON, CORS)
  - Carga inicial configurable (ventana, magnitud, bbox, límite)
  - Polling de respaldo (90 s) mientras el WS está caído
- **Normalización**: ambos → `EarthquakeEvent` (epoch ms, lat/lon, magnitud, place, alert, tsunami, URL oficial)
- **Feed unificado**: `EarthquakeFeed` con snapshot inmutable, filtrado en memoria, stats, histograma de magnitud

### Mapa (`@sismos/geomap`)
- Motor propio **sin dependencias** (Web Mercator, zoom fraccional)
- Temas ráster **sin API key**:
  - `dark` — **OpenTopoMap** (topográfico)
  - `voyager` — **OpenStreetMap Standard**
  - `light` — **OpenStreetMap DE** (estilo claro)
  - `satellite` — **Esri World Imagery**
- Interacción: drag, wheel (zoom centrado), dbl-click, pinch, teclado (flechas, `+/-`)
- Marcadores con diffing por `id`, etiqueta de magnitud, pulso animado (M≥4.5 reciente)
- Capa de selección (bbox Perú / mundo)
- Barra de escala, atribución dinámica por tema

### UI (SolidJS)
- **100vw × 100vh**, scrollbars personalizados (`scrollbar-color` + `scrollbar-width: thin`)
- **Header**: estado live (EN VIVO / RECONECTANDO / DESCONECTADO), toggle región Perú/Global, alertas sonoras (WebAudio, M≥4.5), notificaciones toast, refresh manual
- **Sidebar** (colapsable en móvil <820px):
  - Stats: total, máximo, promedio, última hora/día, por fuente, histograma
  - Filtros: magnitud (slider), ventana temporal (chips 1h/24h/7d/Todo), fuente (todas/EMSC/USGS), búsqueda textual, orden (tiempo/magnitud)
  - Lista: paginada (80 items), selección sincroniza mapa, badges tsunami/alerta, "nuevo" (<10 min)
  - Footer: fuentes activas, eventos en memoria, última sincronización, región
- **MapPanel**: tema selector, zoom +/-, recenter, leyenda de magnitudes, popup en click marcador/lista
- **Persistencia**: tema, sonido, notificaciones en `localStorage`
- **Responsive**: <820px → sidebar inferior con toggle de filtros, mapa arriba; <1240px → header compacto

## Configuración por defecto

```ts
// apps/web/src/state.tsx
const feed = new EarthquakeFeed({
  usgs: { minMagnitude: 2.5, limit: 1500, orderBy: 'time' },
  usgsDays: 7,
  maxEvents: 4000,
  pollInterval: 90_000,
});

// Filtros iniciales
const DEFAULT_FILTERS = {
  minMagnitude: 2.5,
  range: '7d',        // 1h | 24h | 7d | all
  region: 'peru',     // peru | world
  source: 'all',      // all | EMSC | USGS
  search: '',
  sort: 'time',       // time | magnitude
};

// BBox Perú (spec)
export const PERU_BOUNDS = {
  minLat: -18.5, maxLat: 0,
  minLon: -81.5, maxLon: -68.5,
};
```

## Endpoints y notas

| Origen | Endpoint | Auth | Formato | Notas |
|--------|----------|------|---------|-------|
| EMSC | `wss://www.seismicportal.eu/standing_order/websocket` | No | JSON (Feature) | Eventos globales sin filtro servidor; requiere `ping` 15s |
| USGS | `https://earthquake.usgs.gov/fdsnws/event/1/query` | No | GeoJSON | CORS habilitado; 204 si sin resultados; `orderby=time` |

> La especificación original (`desarrollar.md`) mostraba `https://usgs.govquery` como placeholder. El endpoint real documentado arriba es el usado en código.

## Accesibilidad y UX

- ARIA: `role="application"` en mapa, `aria-label` en paneles, `aria-expanded` en toggles, `aria-current` en lista
- Teclado: mapa navegable (flechas, +/-), foco visible en botones/enlaces
- Color: paleta sísmica accesible (cian → verde → amarillo → naranja → rojo), no solo color para estado
- Toasts: auto-dismiss 14s, click para cerrar, chime opcional (WebAudio, requiere interacción previa)
- Scrollbars finos y temáticos en Firefox/Chrome

## Build y despliegue

```bash
npm run build
# Genera apps/web/dist/ (index.html + assets/* con hash)
# Sirve estáticos con cualquier static host (Netlify, Vercel, Cloudflare Pages, Nginx, etc.)
```

Variables de entorno (opcionales, en `apps/web/.env`):

```env
VITE_EMSC_WS_URL=wss://www.seismicportal.eu/standing_order/websocket
VITE_USGS_ENDPOINT=https://earthquake.usgs.gov/fdsnws/event/1/query
```

## Licencia

MIT — Libre para uso personal y comercial.

## Créditos

- **Datos**: [EMSC Seismic Portal](https://www.seismicportal.eu/) · [USGS Earthquake Hazards](https://earthquake.usgs.gov/)
- **Teselas**: [OpenStreetMap](https://www.openstreetmap.org/) · [OpenTopoMap](https://opentopomap.org/) · [OpenStreetMap DE](https://openstreetmap.de/) · [Esri](https://www.esri.com/)
- **Iconos**: SVG inline (propios, sin dependencias)