# @sismos/seismic

Librería TypeScript para consumo y normalización de actividad sísmica en tiempo real desde **EMSC (WebSocket)** y **USGS (REST GeoJSON)**. Incluye feed reactivo unificado, filtrado espacial por polígono o bounding box, utilidades de límites geográficos de Perú, telemetría sísmica extendida y estadísticas agregadas.

---

## Características principales

- **EMSC WebSocket (`EmscSocket`)**: conexión persistente a `wss://www.seismicportal.eu/standing_order/websocket` con *keep-alive* `ping` cada 15 s, reconexión exponencial con jitter y generación automática de enlace oficial EMSC a partir de `properties.source_id` (con respaldo a SeismicPortal por `unid`).
- **USGS REST (`fetchUsgsEvents`)**: consulta directa al endpoint FDSN (`https://earthquake.usgs.gov/fdsnws/event/1/query`) con soporte para ventana temporal, magnitud mínima, caja geográfica y paginación.
- **Normalización unificada (`EarthquakeEvent`)**: combina metadatos básicos (magnitud, escala, profundidad, coordenadas, timestamp, alerta PAGER, tsunami) con telemetría avanzada (`status`, `agency`, `felt`, `cdi`, `mmi`, `significance`, `stations`, `gap`, `rms`, `nearestStationKm`).
- **Feed reactivo (`EarthquakeFeed`)**: sincronización inicial USGS + streaming EMSC + polling de respaldo configurable cuando el socket no está abierto, con control máximo de memoria (`maxEvents`).
- **Límites geográficos de Perú (`peruBorder.ts` + `utils.ts`)**: obtención de fronteras terrestres reales sin API key (**geoBoundaries** y **OpenDataSoft** con caché en `localStorage`) separadas del polígono de cobertura marítima (Nominatim / respaldo local) para capturar sismos de subducción costera sin invadir países vecinos.

---

## Instalación e importación

```bash
npm install @sismos/seismic
```

```ts
import {
  EarthquakeFeed,
  PERU_BOUNDS,
  PERU_SEISMIC_POLYGON,
  fetchPeruBoundaries,
  type EarthquakeEvent,
  type EventFilter,
} from '@sismos/seismic';
```

---

## Uso rápido

```ts
const feed = new EarthquakeFeed({
  filter: { polygon: PERU_SEISMIC_POLYGON, minMagnitude: 2.5 },
  usgs: { minMagnitude: 2.5, limit: 1500, orderBy: 'time' },
  usgsDays: 7,
  maxEvents: 4000,
  pollInterval: 90_000,
});

const unsubscribe = feed.subscribe((snapshot) => {
  console.log(`${snapshot.events.length} eventos filtrados de ${snapshot.total} en memoria`);
  console.log(`Estado EMSC: ${snapshot.connection}`);
});

feed.start();

// Cargar límites terrestres exactos desde APIs públicas abiertas
const boundaries = await fetchPeruBoundaries();
feed.setFilter({ polygon: boundaries.seismicPolygon });

// Al desmontar
unsubscribe();
feed.destroy();
```

---

## API principal

### `EarthquakeFeed`

```ts
interface FeedOptions {
  filter?: EventFilter;
  usgs?: UsgsQueryOptions | false;
  usgsDays?: number;                // Por defecto: 7
  emscUrl?: string | null | false;
  pingInterval?: number;            // Por defecto: 15000 ms
  maxEvents?: number;               // Por defecto: 3000
  pollInterval?: number;            // Por defecto: 90000 ms (0 desactiva)
  fetchImpl?: typeof fetch;
  WebSocketImpl?: typeof WebSocket;
  onSnapshot?: (snapshot: FeedSnapshot) => void;
  onEvent?: (event: EarthquakeEvent, meta: FeedEventMeta) => void;
}
```

Métodos principales:
- `subscribe(listener) => () => void`
- `start()` / `stop()` / `destroy()`
- `refresh(): Promise<void>`
- `setFilter(partial: EventFilter)` / `getFilter(): EventFilter`
- `getSnapshot(): FeedSnapshot`
- `getAllEvents(): EarthquakeEvent[]`

### `EmscSocket` y `fetchUsgsEvents`

```ts
const socket = new EmscSocket({
  url: 'wss://www.seismicportal.eu/standing_order/websocket',
  pingInterval: 15_000,
  maxReconnectDelay: 30_000,
  onEvent: (event, action) => console.log(action, event),
  onStatus: (status, detail) => console.log(status, detail),
});
socket.connect();

const usgsResult = await fetchUsgsEvents({
  startTime: Date.now() - 7 * 86_400_000,
  minMagnitude: 2.5,
  bounds: PERU_BOUNDS,
  limit: 1500,
  orderBy: 'time',
});
```

### `fetchPeruBoundaries` / `loadCachedPeruBoundaries`

- `loadCachedPeruBoundaries(): PeruBoundaries | null` — lectura síncrona desde caché local (`localStorage`).
- `fetchPeruBoundaries(options?: { signal?: AbortSignal; fetchImpl?: typeof fetch }): Promise<PeruBoundaries>` — consulta **geoBoundaries** y **OpenDataSoft** para contorno terrestre (`visualRings`), y **Nominatim** para polígono sísmico costero (`seismicPolygon`), con respaldo local (`PERU_POLYGON` y `PERU_SEISMIC_POLYGON`).

---

## Modelos de datos

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
  timestamp: number;
  updatedAt: number;
  source: EarthquakeSource;
  sourceCatalog?: string;
  magType?: string;
  alert: AlertLevel | null;
  tsunami: boolean;
  url?: string;
  status?: string;
  agency?: string;
  felt?: number | null;
  cdi?: number | null;
  mmi?: number | null;
  significance?: number | null;
  stations?: number | null;
  gap?: number | null;
  rms?: number | null;
  nearestStationKm?: number | null;
}

interface EventFilter {
  minMagnitude?: number;
  maxMagnitude?: number;
  since?: number | null;
  until?: number | null;
  bounds?: Bounds | null;
  polygon?: LatLng[] | null;
  sources?: EarthquakeSource[] | null;
  search?: string;
}
```

---

## Utilidades exportadas (`utils.ts`)

| Grupo | Símbolos |
|-------|----------|
| **Geografía** | `PERU_BOUNDS` (`-18.4..-0.05`, `-81.4..-68.6`), `PERU_POLYGON`, `PERU_SEISMIC_POLYGON`, `WORLD_BOUNDS`, `isWithinBounds`, `isPointInPolygon`, `boundsCenter`, `boundsSpan`, `boundsOfEvents` |
| **Filtrado y orden** | `matchesFilter`, `sortByTimeDesc`, `sortByMagnitudeDesc`, `computeStats` |
| **Magnitud y color** | `MAGNITUDE_COLORS`, `MAGNITUDE_BUCKETS`, `magnitudeColor`, `magnitudeRadius`, `bucketForMagnitude` |
| **Formateo (`es-PE`)** | `formatMagnitude`, `formatDepth`, `formatCoords`, `formatDateTime`, `formatClock`, `formatNumber`, `timeAgo` |

---

## Notas técnicas

- **Fichas oficiales EMSC**: `fromEmscMessage` construye `https://www.emsc-csem.org/Earthquake_information/earthquake.php?id=<source_id>` cuando `properties.source_id` es numérico, evitando enlaces rotos basados en `unid`, y usa `https://www.seismicportal.eu/eventdetails.html?unid=<unid>` únicamente como respaldo.
- **Normalización temporal**: EMSC entrega timestamps ISO 8601 y USGS entrega epoch en milisegundos; toda la librería trabaja en epoch ms (`number`).

---

## Licencia

MIT — Autor: **Edison Manrique Chocce**