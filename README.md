# Sismos Live

**Monitor sísmico en tiempo real** que combina streaming **EMSC SeismicPortal (WebSocket)** y consultas **USGS FDSN (REST GeoJSON)** en una interfaz de pantalla completa (`100vw × 100vh`) con motor cartográfico propio, límites geográficos terrestres de Perú, alertas sonoras diferenciadas y telemetría sísmica detallada.

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%3E%3D20.19-green.svg)](https://nodejs.org/)
[![SolidJS](https://img.shields.io/badge/SolidJS-1.9-2c4f7c.svg)](https://solidjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6.svg)](https://www.typescriptlang.org/)

---

## Características principales

- **Fuentes duales en tiempo real**: recepción continua vía WebSocket desde **EMSC SeismicPortal** (`ping` keep-alive cada 15 s, watchdog de inactividad y reconexión exponencial con jitter) combinada con recuperación inmediata al volver a estar en línea o visible la pestaña, y sincronización **USGS FDSN** adaptativa e incremental (deltas de 30 min cada 5 min con WS sano o respaldo cada 90 s si cae).
- **Foco territorial de Perú**: visualización de límites terrestres reales obtenidos desde APIs públicas abiertas (**geoBoundaries** y **OpenDataSoft**, sin relleno interior) y filtrado sísmico que abarca territorio nacional más franja de subducción costera.
- **Motor cartográfico propio (`@sismos/geomap`)**: proyección Web Mercator sin dependencias externas, pirámide de teselas retenida entre niveles de zoom (sin parpadeos ni fondos en negro durante `flyTo`), zoom centrado en el cursor y asentamiento en niveles enteros nítidos.
- **Cuatro capas base sin API key**: **Estándar** (OSM Standard), **Claro** (OSM DE), **Satélite** (Esri World Imagery) y **Topográfico** (OpenTopoMap).
- **Sistema de alarmas y alertas**: notificaciones toast persistentes con acción directa (`Ver`), alarma WebAudio escalonada por magnitud (tono estándar, pulso urgente para `M ≥ 4.5` y sirena de emergencia de 12 s para `M ≥ 6.0` con control anti-solapamiento), protección ante lotes históricos tras recuperación de red y notificaciones del navegador.
- **Ficha técnica y filtros refinados**: controles segmentados alineados para ventana temporal (`1 h`, `24 h`, `7 d`, `Todo`) y fuente (`Todas`, `EMSC`, `USGS`), deslizador de magnitud con atajos rápidos (`M 0` a `M 7.5`), ficha enriquecida (`Mw`, `ML`, `mb`, agencia, estado, PAGER, `MMI`/`CDI`, reportes *"Lo sentí"*, estaciones/gap/RMS y enlace oficial EMSC por `source_id`) y badges de magnitud calibrados en **JetBrains Mono** (`tabular-nums`).
- **Tipografía e interfaz modular**: sistema de tokens centralizado (`styles/tokens.css`) con **Plus Jakarta Sans** (UI), **Gemunu Libre** (display de marca) y **JetBrains Mono** (telemetría y grados sísmicos), reloj de ancho constante, selección protegida y persistencia local de preferencias (`localStorage`).

---

## Arquitectura y stack

| Capa | Tecnología |
|------|------------|
| **Framework** | Vite 7 + SolidJS 1.9 (TypeScript, JSX, CSS Modules) |
| **Monorepo** | npm workspaces (*source-first*, alias directos a `src/index.ts`) |
| **Datos (`@sismos/seismic`)** | EMSC WebSocket + USGS FDSN REST + límites geoBoundaries/OpenDataSoft/Nominatim |
| **Mapa (`@sismos/geomap`)** | Motor Web Mercator DOM/SVG propio, pirámide multizoom, marcadores con diffing |

### Estructura del proyecto

```text
sismos-live/
├── package.json                        # Workspaces y scripts del monorepo
├── tsconfig.base.json
├── LICENSE
├── packages/
│   ├── seismic/                        # @sismos/seismic
│   │   ├── src/
│   │   │   ├── index.ts                # Exports públicos
│   │   │   ├── types.ts                # EarthquakeEvent, EventFilter, FeedSnapshot...
│   │   │   ├── feed.ts                 # EarthquakeFeed unificado
│   │   │   ├── emsc.ts                 # EmscSocket (WS + keep-alive + backoff)
│   │   │   ├── usgs.ts                 # fetchUsgsEvents, buildUsgsUrl
│   │   │   ├── normalize.ts            # fromEmscMessage, fromUsgsFeature
│   │   │   ├── peruBorder.ts           # Límites terrestres (geoBoundaries / OpenDataSoft) + cobertura marítima
│   │   │   └── utils.ts                # Polígonos, filtros, estadísticas y formateo
│   │   ├── tsconfig.json
│   │   └── README.md
│   └── geomap/                         # @sismos/geomap
│       ├── src/
│       │   ├── index.ts
│       │   ├── types.ts                # MapTheme, MapMarker, TileMapOptions...
│       │   ├── TileMap.ts              # Motor ráster Web Mercator con pirámide de teselas
│       │   ├── TileMap.module.css
│       │   ├── themes.ts               # THEMES, MAP_THEMES, THEME_META, buildTileUrl
│       │   └── mercator.ts             # Utilidades matemáticas Web Mercator
│       ├── tsconfig.json
│       └── README.md
└── apps/
    └── web/                            # @sismos/web
        ├── public/                     # Favicons SVG/PNG, Apple Touch Icon, manifest y OG card
        ├── src/
        │   ├── main.tsx
        │   ├── App.tsx
        │   ├── state.tsx               # Store reactivo, audio WebAudio, toasts y filtros
        │   ├── styles/
        │   │   ├── tokens.css          # Variables globales (fuentes, colores, escala, radios)
        │   │   ├── global.css          # Base, resets y scrollbars
        │   │   └── components/         # CSS Modules de App, Header, Sidebar, StatsPanel, FiltersPanel, EventList, MapPanel, Toasts
        │   └── components/             # Header, Sidebar, StatsPanel, FiltersPanel, EventList, MapPanel, Toasts, Icons
        ├── vite.config.ts
        ├── tsconfig.json
        └── index.html
```

---

## Requisitos

- **Node.js** `>= 20.19`
- **npm** `>= 10` (compatible con pnpm, yarn o bun con soporte para workspaces)

---

## Instalación y comandos

```bash
git clone https://github.com/edison-manrique/sismos-live.git
cd sismos-live
npm install

# Servidor de desarrollo en http://localhost:3000
npm run dev

# Verificación de tipos en todos los paquetes
npm run typecheck

# Compilación de producción (genera apps/web/dist/)
npm run build

# Previsualización del build en http://localhost:4173
npm run preview
```

> **Arquitectura source-first**: `apps/web/vite.config.ts` resuelve `@sismos/seismic` y `@sismos/geomap` directamente hacia sus archivos `src/index.ts`, eliminando pasos intermedios de empaquetado durante el desarrollo.

---

## Configuración por defecto

```ts
// apps/web/src/state.tsx
const feed = new EarthquakeFeed({
  usgs: { minMagnitude: 2.5, limit: 1500, orderBy: 'time' },
  usgsDays: 7,
  maxEvents: 4000,
  pollInterval: 90_000, // Respaldo rápido si el WS cae; deltas cada 5 min con WS sano
});

const DEFAULT_FILTERS = {
  minMagnitude: 2.5,
  range: '7d',          // '1h' | '24h' | '7d' | 'all'
  region: 'peru',       // 'peru' | 'world'
  source: 'all',        // 'all' | 'EMSC' | 'USGS'
  search: '',
  sort: 'time',         // 'time' | 'magnitude'
};
```

Variables de entorno opcionales:

```env
VITE_EMSC_WS_URL=wss://www.seismicportal.eu/standing_order/websocket
VITE_USGS_ENDPOINT=https://earthquake.usgs.gov/fdsnws/event/1/query
VITE_BASE_PATH=/
```

---

## Endpoints y proveedores externos (sin API key)

| Servicio | Endpoint / Proveedor | Protocolo | Uso |
|----------|----------------------|-----------|-----|
| **EMSC** | `wss://www.seismicportal.eu/standing_order/websocket` | WebSocket | Streaming global en vivo (keep-alive 15 s + watchdog) |
| **USGS** | `https://earthquake.usgs.gov/fdsnws/event/1/query` | HTTPS REST | Carga inicial de 7 días y sincronización delta adaptativa |
| **Límites terrestres** | geoBoundaries (`v6.0.0`) / OpenDataSoft | HTTPS JSON | Contorno terrestre exacto de Perú |
| **Límite sísmico marítimo** | Nominatim (OpenStreetMap) | HTTPS JSON | Cobertura costera de subducción en el Pacífico |
| **Teselas base** | OSM Standard · OSM DE · Esri World Imagery · OpenTopoMap | HTTPS PNG/JPG | Capas cartográficas del mapa |

---

## Despliegue

```bash
npm run build
```

El resultado estático se genera en `apps/web/dist/`, listo para publicarse en **GitHub Pages** (flujo automatizado en `.github/workflows/deploy-pages.yml`), Cloudflare Pages, Vercel, Netlify o cualquier servidor HTTP estático.

---

## Licencia

Distribuido bajo licencia **MIT**. Consulta [`LICENSE`](LICENSE) para más detalles.

## Autor

**Edison Manrique Chocce** — [@edison-manrique](https://github.com/edison-manrique)