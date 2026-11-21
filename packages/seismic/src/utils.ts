import type {
  Bounds,
  EarthquakeEvent,
  EarthquakeSource,
  EventFilter,
  FeedStats,
  MagnitudeBucket,
} from './types.js';

/** Bounding box por defecto (Perú), según la especificación del proyecto. */
export const PERU_BOUNDS: Bounds = {
  minLat: -18.5,
  maxLat: 0,
  minLon: -81.5,
  maxLon: -68.5,
};

/** Límites aproximados del mundo. */
export const WORLD_BOUNDS: Bounds = {
  minLat: -85,
  maxLat: 85,
  minLon: -180,
  maxLon: 180,
};

/** Paleta sísmica compartida por la app y el mapa. */
export const MAGNITUDE_COLORS = [
  { min: 7, color: '#ff3b5c' },
  { min: 6, color: '#ff5f3d' },
  { min: 5, color: '#ff8a3d' },
  { min: 4, color: '#ffb020' },
  { min: 3, color: '#ffd93d' },
  { min: 2, color: '#7ee787' },
  { min: Number.NEGATIVE_INFINITY, color: '#56c8f5' },
] as const;

export const MAGNITUDE_BUCKETS: MagnitudeBucket[] = [
  { label: '<2', min: 0, max: 2, count: 0, color: '#56c8f5' },
  { label: '2', min: 2, max: 3, count: 0, color: '#7ee787' },
  { label: '3', min: 3, max: 4, count: 0, color: '#ffd93d' },
  { label: '4', min: 4, max: 5, count: 0, color: '#ffb020' },
  { label: '5', min: 5, max: 6, count: 0, color: '#ff8a3d' },
  { label: '6', min: 6, max: 7, count: 0, color: '#ff5f3d' },
  { label: '7+', min: 7, max: Infinity, count: 0, color: '#ff3b5c' },
];

export function magnitudeColor(magnitude: number): string {
  for (const entry of MAGNITUDE_COLORS) {
    if (magnitude >= entry.min) return entry.color;
  }
  return '#56c8f5';
}

/** Radio sugerido (px) para un marcador sísmico. */
export function magnitudeRadius(magnitude: number, base = 6, factor = 2.6): number {
  const safe = Number.isFinite(magnitude) ? magnitude : 0;
  return Math.max(8, Math.min(30, base + Math.max(0, safe) * factor));
}

export function isWithinBounds(bounds: Bounds | null | undefined, lat: number, lon: number): boolean {
  if (!bounds) return true;
  return (
    lat >= bounds.minLat &&
    lat <= bounds.maxLat &&
    lon >= bounds.minLon &&
    lon <= bounds.maxLon
  );
}

export function matchesFilter(event: EarthquakeEvent, filter: EventFilter = {}): boolean {
  if (filter.minMagnitude != null && event.magnitude < filter.minMagnitude) return false;
  if (filter.maxMagnitude != null && event.magnitude > filter.maxMagnitude) return false;
  if (filter.since != null && event.timestamp < filter.since) return false;
  if (filter.until != null && event.timestamp > filter.until) return false;
  if (filter.bounds && !isWithinBounds(filter.bounds, event.lat, event.lon)) return false;
  if (filter.sources?.length && !filter.sources.includes(event.source)) return false;
  if (filter.search) {
    const needle = filter.search.trim().toLowerCase();
    if (needle && !`${event.place} ${event.region}`.toLowerCase().includes(needle)) {
      return false;
    }
  }
  return true;
}

export function sortByTimeDesc(events: EarthquakeEvent[]): EarthquakeEvent[] {
  return [...events].sort((a, b) => b.timestamp - a.timestamp);
}

export function sortByMagnitudeDesc(events: EarthquakeEvent[]): EarthquakeEvent[] {
  return [...events].sort((a, b) => b.magnitude - a.magnitude || b.timestamp - a.timestamp);
}

export function bucketForMagnitude(magnitude: number): MagnitudeBucket {
  return (
    MAGNITUDE_BUCKETS.find((bucket) => magnitude >= bucket.min && magnitude < bucket.max) ??
    MAGNITUDE_BUCKETS[MAGNITUDE_BUCKETS.length - 1]
  );
}

/** Calcula métricas agregadas para una lista de eventos. */
export function computeStats(events: EarthquakeEvent[], now = Date.now()): FeedStats {
  const buckets = MAGNITUDE_BUCKETS.map((bucket) => ({ ...bucket, count: 0 }));
  const bySource: Record<EarthquakeSource, number> = { EMSC: 0, USGS: 0 };
  let maxMagnitude = 0;
  let sumMagnitude = 0;
  let sumDepth = 0;
  let lastHour = 0;
  let lastDay = 0;
  let strongest: EarthquakeEvent | null = null;

  for (const event of events) {
    sumMagnitude += event.magnitude;
    sumDepth += event.depth;
    bySource[event.source] += 1;
    if (event.magnitude > maxMagnitude) maxMagnitude = event.magnitude;
    if (!strongest || event.magnitude > strongest.magnitude) strongest = event;
    const age = now - event.timestamp;
    if (age <= 3_600_000) lastHour += 1;
    if (age <= 86_400_000) lastDay += 1;

    const bucket =
      buckets.find((item) => event.magnitude >= item.min && event.magnitude < item.max) ??
      buckets[buckets.length - 1];
    bucket.count += 1;
  }

  return {
    total: events.length,
    maxMagnitude,
    avgMagnitude: events.length ? sumMagnitude / events.length : 0,
    avgDepth: events.length ? sumDepth / events.length : 0,
    lastHour,
    lastDay,
    bySource,
    byBucket: buckets,
    strongest,
  };
}

/** Centro geográfico de una caja. */
export function boundsCenter(bounds: Bounds): { lat: number; lon: number } {
  return {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lon: (bounds.minLon + bounds.maxLon) / 2,
  };
}

export function boundsSpan(bounds: Bounds): { lat: number; lon: number } {
  return {
    lat: Math.abs(bounds.maxLat - bounds.minLat),
    lon: Math.abs(bounds.maxLon - bounds.minLon),
  };
}

const dateFormatter = new Intl.DateTimeFormat('es-PE', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat('es-PE', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export function formatDateTime(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return '—';
  return dateFormatter.format(new Date(timestamp));
}

export function formatClock(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return '—';
  return timeFormatter.format(new Date(timestamp));
}

/** "ahora", "hace 4 min", "hace 2 h", "hace 3 d" o fecha corta. */
export function timeAgo(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 15) return 'ahora';
  if (seconds < 60) return `hace ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return formatDateTime(timestamp);
}

export function formatMagnitude(magnitude: number): string {
  return Number.isFinite(magnitude) ? magnitude.toFixed(1) : '—';
}

export function formatDepth(depth: number): string {
  return Number.isFinite(depth) ? `${depth.toFixed(0)} km` : '—';
}

export function formatCoords(lat: number, lon: number): string {
  const latLabel = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`;
  const lonLabel = `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'O'}`;
  return `${latLabel}, ${lonLabel}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-PE').format(value);
}

/** Bounds que contienen todos los eventos (con margen), útil para `fitBounds`. */
export function boundsOfEvents(events: EarthquakeEvent[], padding = 1): Bounds | null {
  if (!events.length) return null;
  let minLat = 90;
  let maxLat = -90;
  let minLon = 180;
  let maxLon = -180;
  for (const event of events) {
    minLat = Math.min(minLat, event.lat);
    maxLat = Math.max(maxLat, event.lat);
    minLon = Math.min(minLon, event.lon);
    maxLon = Math.max(maxLon, event.lon);
  }
  return {
    minLat: Math.max(-85, minLat - padding),
    maxLat: Math.min(85, maxLat + padding),
    minLon: Math.max(-180, minLon - padding),
    maxLon: Math.min(180, maxLon + padding),
  };
}
