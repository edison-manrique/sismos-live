import type {
  Bounds,
  EarthquakeEvent,
  EarthquakeSource,
  EventFilter,
  FeedStats,
  LatLng,
  MagnitudeBucket,
} from './types.js';

/** Bounding box ajustado de Perú para encuadre de cámara. */
export const PERU_BOUNDS: Bounds = {
  minLat: -18.4,
  maxLat: -0.05,
  minLon: -81.4,
  maxLon: -68.6,
};

/**
 * Polígono simplificado de los límites territoriales de Perú (fronteras terrestres + litoral).
 * Ordenado en sentido horario empezando en Tumbes (frontera con Ecuador).
 */
export const PERU_POLYGON: LatLng[] = [
  { lat: -3.41, lon: -80.28 }, // Boca de Capones / Zarumilla
  { lat: -3.48, lon: -80.20 },
  { lat: -3.85, lon: -80.18 },
  { lat: -4.08, lon: -80.44 },
  { lat: -4.44, lon: -80.22 },
  { lat: -4.39, lon: -79.96 }, // Macará
  { lat: -4.64, lon: -79.48 },
  { lat: -5.02, lon: -79.01 }, // Río Canchis / San Ignacio
  { lat: -4.60, lon: -78.55 },
  { lat: -4.00, lon: -78.38 }, // Cordillera del Cóndor
  { lat: -3.45, lon: -78.22 },
  { lat: -3.00, lon: -77.82 }, // Río Santiago
  { lat: -2.48, lon: -76.55 }, // Pastaza
  { lat: -2.10, lon: -76.02 },
  { lat: -1.62, lon: -75.85 }, // Tigre / Napo
  { lat: -0.96, lon: -75.20 },
  { lat: -0.10, lon: -75.24 }, // Güeppí
  { lat: -0.35, lon: -74.65 },
  { lat: -0.58, lon: -74.05 }, // Putumayo
  { lat: -1.15, lon: -73.40 },
  { lat: -1.58, lon: -72.80 },
  { lat: -2.35, lon: -71.50 },
  { lat: -2.78, lon: -70.45 },
  { lat: -3.78, lon: -70.12 },
  { lat: -4.22, lon: -69.94 }, // Santa Rosa / Trapecio Amazónico
  { lat: -4.45, lon: -71.40 }, // Río Yavarí
  { lat: -5.22, lon: -72.82 },
  { lat: -6.15, lon: -73.20 },
  { lat: -6.82, lon: -73.72 },
  { lat: -7.38, lon: -73.96 }, // Sierra del Divisor
  { lat: -8.32, lon: -73.15 },
  { lat: -9.42, lon: -72.72 }, // Alto Juruá
  { lat: -9.80, lon: -72.10 },
  { lat: -9.75, lon: -70.62 },
  { lat: -10.52, lon: -70.50 },
  { lat: -10.95, lon: -69.57 }, // Iñapari / Río Acre
  { lat: -11.90, lon: -69.05 },
  { lat: -12.50, lon: -68.66 }, // Río Heath
  { lat: -13.60, lon: -68.88 },
  { lat: -14.55, lon: -69.12 },
  { lat: -15.48, lon: -69.25 },
  { lat: -16.18, lon: -68.92 }, // Lago Titicaca
  { lat: -16.58, lon: -69.04 }, // Desaguadero
  { lat: -17.49, lon: -69.47 }, // Tripartito
  { lat: -17.95, lon: -69.85 },
  { lat: -18.35, lon: -70.38 }, // Hito de la Concordia (Tacna)
  { lat: -17.85, lon: -71.08 },
  { lat: -17.65, lon: -71.36 }, // Ilo
  { lat: -17.02, lon: -72.02 }, // Mollendo
  { lat: -16.65, lon: -72.65 }, // Camaná
  { lat: -16.25, lon: -73.60 }, // Atico
  { lat: -15.80, lon: -74.35 }, // Chala
  { lat: -15.35, lon: -75.16 }, // Marcona
  { lat: -14.65, lon: -75.95 }, // Nazca litoral
  { lat: -14.08, lon: -76.28 }, // Paracas
  { lat: -13.70, lon: -76.22 }, // Pisco
  { lat: -13.08, lon: -76.39 }, // Cañete
  { lat: -12.05, lon: -77.16 }, // Callao / Lima
  { lat: -11.12, lon: -77.61 }, // Huacho
  { lat: -10.75, lon: -77.78 }, // Barranca
  { lat: -10.07, lon: -78.16 }, // Huarmey
  { lat: -9.10, lon: -78.58 }, // Chimbote
  { lat: -8.12, lon: -79.05 }, // Trujillo
  { lat: -7.40, lon: -79.58 }, // Pacasmayo
  { lat: -6.90, lon: -79.88 }, // Chiclayo / Pimentel
  { lat: -5.85, lon: -81.10 }, // Punta Aguja
  { lat: -5.08, lon: -81.12 }, // Paita
  { lat: -4.68, lon: -81.33 }, // Punta Pariñas
  { lat: -4.10, lon: -81.08 }, // Máncora
  { lat: -3.55, lon: -80.50 }, // Zorritos
];

/**
 * Polígono de cobertura sísmica para Perú: mantiene las fronteras terrestres exactas
 * con Ecuador, Colombia, Brasil, Bolivia y Chile, e incluye la franja marítima del Pacífico
 * (~180 km mar adentro) para capturar sismos costeros/subducción frente al litoral peruano.
 */
export const PERU_SEISMIC_POLYGON: LatLng[] = [
  { lat: -3.41, lon: -80.28 },
  { lat: -3.48, lon: -80.20 },
  { lat: -3.85, lon: -80.18 },
  { lat: -4.08, lon: -80.44 },
  { lat: -4.44, lon: -80.22 },
  { lat: -4.39, lon: -79.96 },
  { lat: -4.64, lon: -79.48 },
  { lat: -5.02, lon: -79.01 },
  { lat: -4.60, lon: -78.55 },
  { lat: -4.00, lon: -78.38 },
  { lat: -3.45, lon: -78.22 },
  { lat: -3.00, lon: -77.82 },
  { lat: -2.48, lon: -76.55 },
  { lat: -2.10, lon: -76.02 },
  { lat: -1.62, lon: -75.85 },
  { lat: -0.96, lon: -75.20 },
  { lat: -0.10, lon: -75.24 },
  { lat: -0.35, lon: -74.65 },
  { lat: -0.58, lon: -74.05 },
  { lat: -1.15, lon: -73.40 },
  { lat: -1.58, lon: -72.80 },
  { lat: -2.35, lon: -71.50 },
  { lat: -2.78, lon: -70.45 },
  { lat: -3.78, lon: -70.12 },
  { lat: -4.22, lon: -69.94 },
  { lat: -4.45, lon: -71.40 },
  { lat: -5.22, lon: -72.82 },
  { lat: -6.15, lon: -73.20 },
  { lat: -6.82, lon: -73.72 },
  { lat: -7.38, lon: -73.96 },
  { lat: -8.32, lon: -73.15 },
  { lat: -9.42, lon: -72.72 },
  { lat: -9.80, lon: -72.10 },
  { lat: -9.75, lon: -70.62 },
  { lat: -10.52, lon: -70.50 },
  { lat: -10.95, lon: -69.57 },
  { lat: -11.90, lon: -69.05 },
  { lat: -12.50, lon: -68.66 },
  { lat: -13.60, lon: -68.88 },
  { lat: -14.55, lon: -69.12 },
  { lat: -15.48, lon: -69.25 },
  { lat: -16.18, lon: -68.92 },
  { lat: -16.58, lon: -69.04 },
  { lat: -17.49, lon: -69.47 },
  { lat: -17.95, lon: -69.85 },
  { lat: -18.35, lon: -70.38 },
  // Franja marítima frente al litoral peruano (sin invadir Chile ni Ecuador)
  { lat: -18.35, lon: -72.25 },
  { lat: -17.20, lon: -73.95 },
  { lat: -15.40, lon: -76.95 },
  { lat: -13.80, lon: -78.10 },
  { lat: -12.05, lon: -79.00 },
  { lat: -9.10, lon: -80.40 },
  { lat: -6.90, lon: -81.75 },
  { lat: -5.00, lon: -83.00 },
  { lat: -3.45, lon: -82.25 },
];

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

/** Ray-casting para comprobar si un punto (lat, lon) está dentro de un polígono. */
export function isPointInPolygon(
  polygon: readonly LatLng[] | null | undefined,
  lat: number,
  lon: number,
): boolean {
  if (!polygon || polygon.length < 3) return true;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lon;
    const yi = polygon[i].lat;
    const xj = polygon[j].lon;
    const yj = polygon[j].lat;
    const intersects =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function matchesFilter(event: EarthquakeEvent, filter: EventFilter = {}): boolean {
  if (filter.minMagnitude != null && event.magnitude < filter.minMagnitude) return false;
  if (filter.maxMagnitude != null && event.magnitude > filter.maxMagnitude) return false;
  if (filter.since != null && event.timestamp < filter.since) return false;
  if (filter.until != null && event.timestamp > filter.until) return false;
  if (filter.bounds && !isWithinBounds(filter.bounds, event.lat, event.lon)) return false;
  if (filter.polygon && !isPointInPolygon(filter.polygon, event.lat, event.lon)) return false;
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
