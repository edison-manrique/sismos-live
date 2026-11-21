# @sismos/seismic

Librería de datos sísmicos en tiempo real para **EMSC (WebSocket)** y **USGS (REST)**. Proporciona normalización, filtrado en cliente, estadísticas y un feed reactivo unificado.

## Características

- **EMSC WebSocket**: Conexión a `wss://www.seismicportal.eu/standing_order/websocket` con keep-alive `ping` cada 15 s, reconexión exponencial con jitter y deduplicación por `properties.unid`.
- **USGS REST**: Cliente para `https://earthquake.usgs.gov/fdsnws/event/1/query` (GeoJSON, CORS), con soporte para ventanas temporales, bounding boxes, magnitud y paginación.
- **Normalización unificada**: Ambos orígenes se convierten a `EarthquakeEvent` (timestamp en epoch ms, coordenadas, magnitud, lugar, alerta, tsunami, URL oficial).
- **Feed reactivo (`EarthquakeFeed`)**: Carga inicial USGS + streaming EMSC, upsert por `id`, filtrado en memoria (`EventFilter`), estadísticas agregadas (`FeedStats`) y snapshot inmutable (`FeedSnapshot`).
- **Utilidades**: Formateo (magnitud, coordenadas, profundidad, tiempo relativo, reloj), paleta de colores sísmica, buckets de magnitud, ordenación, coincidencia de filtros, bounding boxes (Perú por defecto, mundo).

## Instalación

```bash
# Desde el monorepo (pnpm/npm workspaces)
npm install @sismos/seismic
```

Uso directo en código (source-first, sin build intermedio):

```ts
import {
  EarthquakeFeed,
  PERU_BOUNDS,
  type EarthquakeEvent,
  type EventFilter,
} from '@sismos/seismic';
```

## Uso rápido

```ts
const feed = new EarthquakeFeed({
  filter: { bounds: PERU_BOUNDS, minMagnitude: 2.5 },
  usgs: { minMagnitude: 2.5, limit: 1500, orderBy: 'time' },
  usgsDays: 7,
  maxEvents: 4000,
  pollInterval: 90_000, // polling USGS mientras WS caído
});

feed.subscribe((snapshot) => {
  console.log(`${snapshot.events.length} eventos filtrados`);
  console.log(`Total en memoria: ${snapshot.total}`);
  console.log(`Conexión EMSC: ${snapshot.connection}`);
});

feed.start();
// ... más tarde
feed.stop();
feed.destroy();
```

## API principal

### `EarthquakeFeed`

```ts
interface FeedOptions {
  filter?: EventFilter;
  usgs?: UsgsQueryOptions | false;  // false desactiva carga inicial
  usgsDays?: number;                // default 7
  emscUrl?: string | null | false;  // null/false desactiva live
  pingInterval?: number;            // default 15000
  maxEvents?: number;               // default 3000
  pollInterval?: number;            // default 90000 (0 desactiva)
  fetchImpl?: typeof fetch;
  WebSocketImpl?: typeof WebSocket;
  onSnapshot?: (s: FeedSnapshot) => void;
  onEvent?: (e: EarthquakeEvent, meta: FeedEventMeta) => void;
}
```

Métodos:
- `subscribe(listener) => () => void`
- `start(): void`
- `stop(): void`
- `destroy(): void`
- `refresh(): Promise<void>`
- `setFilter(partial: EventFilter): void`
- `getFilter(): EventFilter`
- `getSnapshot(): FeedSnapshot`
- `getAllEvents(): EarthquakeEvent[]`

### `EmscSocket`

Cliente WebSocket de bajo nivel (uso directo si no necesitas feed unificado).

```ts
const socket = new EmscSocket({
  url: 'wss://www.seismicportal.eu/standing_order/websocket',
  pingInterval: 15_000,
  maxReconnectDelay: 30_000,
  onEvent: (event, action) => { /* create | update */ },
  onStatus: (status, detail) => { /* idle | connecting | open | reconnecting | closed | error */ },
  onError: (err) => { },
});
socket.connect();
socket.close();
```

Propiedades:
- `status: ConnectionStatus`
- `isOpen: boolean`
- `reconnectAttempt: number`

### `fetchUsgsEvents` / `buildUsgsUrl`

```ts
const result = await fetchUsgsEvents({
  startTime: Date.now() - 7 * 86_400_000,
  minMagnitude: 2.5,
  bounds: PERU_BOUNDS,
  limit: 1500,
  orderBy: 'time',
});
// result: { events: EarthquakeEvent[], url: string, fetchedAt: number }
```

### Tipos exportados

```ts
type EarthquakeSource = 'EMSC' | 'USGS';
type AlertLevel = 'green' | 'yellow' | 'orange' | 'red';
type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed' | 'error';

interface EarthquakeEvent {
  id: string;
  magnitude: number;
  place: string;
  region: string;
  lat: number;
  lon: number;
  depth: number;
  timestamp: number;      // epoch ms
  updatedAt: number;
  source: EarthquakeSource;
  sourceCatalog?: string;
  magType?: string;
  alert: AlertLevel | null;
  tsunami: boolean;
  url?: string;
}

interface EventFilter {
  minMagnitude?: number;
  maxMagnitude?: number;
  since?: number | null;
  until?: number | null;
  bounds?: Bounds | null;
  sources?: EarthquakeSource[] | null;
  search?: string;
}

interface FeedSnapshot {
  events: EarthquakeEvent[];        // ya filtrados y ordenados (time desc)
  total: number;                    // en memoria (sin filtrar)
  filter: EventFilter;
  stats: FeedStats;
  connection: ConnectionStatus;
  lastEventAt: number | null;
  lastSyncAt: number | null;
  loading: boolean;
  reconnectAttempt: number;
  error: string | null;
}
```

### Utilidades de formato y colores

```ts
import {
  formatMagnitude,    // "4.8"
  formatCoords,       // "9.19°S, 75.02°W"
  formatDepth,        // "108 km"
  formatDateTime,     // "2024-01-15 14:32:05"
  formatClock,        // "14:32"
  formatNumber,       // "1,234"
  timeAgo,            // "hace 5 min"
  magnitudeColor,     // "#ff8a3d"
  magnitudeRadius,    // px para marcador
  magnitudeBucket,    // { label, min, max, color }
  PERU_BOUNDS,        // { minLat: -18.5, maxLat: 0, minLon: -81.5, maxLon: -68.5 }
  WORLD_BOUNDS,
  matchesFilter,
  sortByTimeDesc,
  sortByMagnitudeDesc,
  computeStats,
} from '@sismos/seismic';
```

## Notas de endpoints

- **EMSC**: `wss://www.seismicportal.eu/standing_order/websocket` — eventos globales sin filtro servidor; el filtrado geográfico/magnitud es cliente.
- **USGS**: `https://earthquake.usgs.gov/fdsnws/event/1/query` — endpoint FDSN oficial con CORS. La especificación original mostraba `https://usgs.govquery` como placeholder; este es el endpoint real.
- **Timestamps**: EMSC envía ISO 8601 en `properties.time`; USGS envía epoch ms en `properties.time`. La librería normaliza todo a epoch ms (`number`).

## Licencia

MIT