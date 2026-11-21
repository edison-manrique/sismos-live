# Sismos Live

**Monitor sísmico en tiempo real** que combina datos de **EMSC (WebSocket)** y **USGS (REST)** en una única interfaz full-screen (100vw × 100vh) con mapa interactivo propio, panel lateral con estadísticas, filtros avanzados y lista paginada de eventos.

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%3E%3D20.19-green.svg)](https://nodejs.org/)
[![SolidJS](https://img.shields.io/badge/SolidJS-1.9-2c4f7c.svg)](https://solidjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6.svg)](https://www.typescriptlang.org/)

---

## Qué hace la aplicación

- **Visualiza terremotos en vivo** a nivel global con foco inicial en Perú (bbox configurable).
- **Fuentes duales**: streaming persistente desde EMSC SeismicPortal (WebSocket) + carga histórica y polling de respaldo desde USGS FDSN (REST/GeoJSON).
- **Mapa interactivo sin dependencias** (motor propio Web Mercator): pan, zoom fraccional, pinch, teclado; 4 capas base (Estándar, Claro, Satélite, Topográfico).
- **Filtros en cliente**: magnitud mínima (slider), ventana temporal (1h/24h/7d/Todo), región (Perú/Mundo), fuente (EMSC/USGS/Todas), búsqueda textual.
- **Lista sincronizada** con el mapa: paginación (80 items), orden por tiempo o magnitud, badges de alerta/tsunami, indicador "nuevo" (<10 min).
- **Alertas opcionales**: toasts persistentes + chime WebAudio para eventos M≥4.5.
- **Persistencia** de preferencias (tema, sonido, notificaciones) en `localStorage`.
- **Responsive**: sidebar colapsable en móvil (<820px), header adaptativo (<1240px).
- **Accesible**: ARIA roles, navegación por teclado, contraste AA, scrollbars temáticos.

---

## Stack técnico

| Capa | Tecnología |
|------|------------|
| **Framework** | Vite + SolidJS (TypeScript, JSX, CSS Modules) |
| **Arquitectura** | Monorepo npm workspaces (source-first, sin build intermedio de librerías) |
| **Datos** | `@sismos/seismic` — EMSC WS + USGS REST, feed reactivo unificado |
| **Mapa** | `@sismos/geomap` — Motor ráster Web Mercator, temas OSM/Esri, sin Leaflet |
| **UI** | SolidJS stores, context, efectos reactivos, componentes modulares |

---

## Estructura del monorepo

```
sismos/
├── package.json              # workspaces + scripts raíz
├── LICENSE                   # MIT
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
        │   └── components/   # Header, Sidebar, StatsPanel, FiltersPanel, EventList, MapPanel, Toasts, Icons
        ├── vite.config.ts    # aliases @sismos/*
        ├── tsconfig.json
        └── index.html
```

---

## Requisitos

- **Node.js ≥ 20.19**
- **npm ≥ 10** (o pnpm/yarn/bun con soporte workspaces)

---

## Instalación y scripts

```bash
# Clona e instala (desde la raíz del monorepo)
git clone https://github.com/edison-manrique/sismos-live.git
cd sismos-live
npm install

# Desarrollo (Vite HMR en http://localhost:5173)
npm run dev

# Type-check (todos los workspaces)
npm run typecheck

# Build producción (genera apps/web/dist/)
npm run build

# Preview del build local
npm run preview
```

> **Nota**: El proyecto usa *source-first* — importa `src/index.ts` directamente vía aliases de Vite. No hay paso de build separado para las librerías; los tipos provienen de los archivos `.ts` originales.

---

## Configuración por defecto

```ts
// apps/web/src/state.tsx
const feed = new EarthquakeFeed({
  usgs: { minMagnitude: 2.5, limit: 1500, orderBy: 'time' },
  usgsDays: 7,
  maxEvents: 4000,
  pollInterval: 90_000,        // polling USGS mientras WS caído
});

const DEFAULT_FILTERS = {
  minMagnitude: 2.5,
  range: '7d',                 // 1h | 24h | 7d | all
  region: 'peru',              // peru | world
  source: 'all',               // all | EMSC | USGS
  search: '',
  sort: 'time',                // time | magnitude
};

// BBox Perú (configurable)
export const PERU_BOUNDS = {
  minLat: -18.5, maxLat: 0,
  minLon: -81.5, maxLon: -68.5,
};
```

Variables de entorno opcionales (`apps/web/.env`):

```env
VITE_EMSC_WS_URL=wss://www.seismicportal.eu/standing_order/websocket
VITE_USGS_ENDPOINT=https://earthquake.usgs.gov/fdsnws/event/1/query
```

---

## Endpoints de datos

| Origen | Endpoint | Auth | Formato | Notas |
|--------|----------|------|---------|-------|
| **EMSC** | `wss://www.seismicportal.eu/standing_order/websocket` | No | JSON (Feature) | Eventos globales sin filtro servidor; keep-alive `ping` cada 15 s obligatorio |
| **USGS** | `https://earthquake.usgs.gov/fdsnws/event/1/query` | No | GeoJSON | CORS habilitado; devuelve 204 si no hay resultados; `orderby=time` |

---

## Temas de mapa (sin API key)

| Tema | Proveedor | Estilo |
|------|-----------|--------|
| **Estándar** | OpenStreetMap Standard | Callejero clásico |
| **Claro** | OpenStreetMap DE | Estilo claro alemán |
| **Satélite** | Esri World Imagery | Imágenes satelitales |
| **Topográfico** | OpenTopoMap | Curvas de nivel y relieve |

> El orden por defecto en el selector es: **Estándar → Claro → Satélite → Topográfico**.

---

## Despliegue

```bash
npm run build
# Genera apps/web/dist/ (index.html + assets/* con hash)
```

Sirve la carpeta `apps/web/dist/` en cualquier hosting estático:
- **GitHub Pages** (workflow incluido en `.github/workflows/deploy-pages.yml`)
- Netlify, Vercel, Cloudflare Pages
- Nginx, Apache, Caddy
- Cualquier CDN/servidor de archivos estáticos

---

## Accesibilidad y UX

- **ARIA**: `role="application"` en mapa, `aria-label` en paneles, `aria-expanded` en toggles, `aria-current` en lista
- **Teclado**: mapa navegable (flechas, `+/-`), foco visible en botones/enlaces
- **Color**: paleta sísmica accesible (cian → verde → amarillo → naranja → rojo), estado no solo por color
- **Toasts**: auto-dismiss 14 s, click para cerrar, chime opcional (WebAudio, requiere interacción previa)
- **Scrollbars** finos y temáticos (`scrollbar-color` + `scrollbar-width: thin`)

---

## Licencia

**MIT** — Libre para uso personal y comercial. Ver [`LICENSE`](LICENSE).

---

## Créditos

- **Datos**: [EMSC Seismic Portal](https://www.seismicportal.eu/) · [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/)
- **Teselas**: [OpenStreetMap](https://www.openstreetmap.org/) · [OpenTopoMap](https://opentopomap.org/) · [OpenStreetMap DE](https://openstreetmap.de/) · [Esri](https://www.esri.com/)
- **Iconos**: SVG inline propios (sin dependencias externas)

---

## Autor

**Edison Manrique** — [@edison-manrique](https://github.com/edison-manrique)