import type { EmscMessage, EarthquakeEvent, UsgsFeature } from './types.js';

const ALERT_LEVELS = new Set(['green', 'yellow', 'orange', 'red']);

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function cleanAlert(value: unknown): EarthquakeEvent['alert'] {
  return typeof value === 'string' && ALERT_LEVELS.has(value)
    ? (value as EarthquakeEvent['alert'])
    : null;
}

function emscUrl(unid: string): string | undefined {
  if (!unid) return undefined;
  return `https://www.emsc-csem.org/Earthquake/earthquake.php?id=${encodeURIComponent(unid)}`;
}

/**
 * Normaliza un mensaje de EMSC SeismicPortal a {@link EarthquakeEvent}.
 * Devuelve `null` si el evento no tiene magnitud o coordenadas válidas.
 */
export function fromEmscMessage(message: EmscMessage): EarthquakeEvent | null {
  const feature = message?.data;
  if (!feature?.properties || !feature.geometry) return null;

  const props = feature.properties;
  const coords = feature.geometry.coordinates ?? [];
  const lon = finite(props.lon) ?? finite(coords[0]);
  const lat = finite(props.lat) ?? finite(coords[1]);
  const magnitude = finite(props.mag);
  const timestamp = Date.parse(props.time);

  if (lat === null || lon === null || magnitude === null) return null;
  if (!Number.isFinite(timestamp)) return null;

  const unid = String(props.unid ?? feature.id ?? props.source_id ?? `${lat}:${lon}:${timestamp}`);
  const updated = props.lastupdate ? Date.parse(props.lastupdate) : NaN;
  const depth = finite(props.depth) ?? finite(coords[2]) ?? 0;
  const place = String(props.flynn_region ?? props.region ?? 'Evento sísmico');

  return {
    id: unid,
    magnitude,
    place,
    region: place,
    lat,
    lon,
    depth,
    timestamp,
    updatedAt: Number.isFinite(updated) ? updated : timestamp,
    source: 'EMSC',
    sourceCatalog: typeof props.source_catalog === 'string' ? props.source_catalog : 'EMSC-RTS',
    magType: typeof props.magtype === 'string' ? props.magtype : undefined,
    alert: null,
    tsunami: false,
    url: emscUrl(unid),
  };
}

/**
 * Normaliza una feature GeoJSON de USGS a {@link EarthquakeEvent}.
 * Devuelve `null` si el evento no tiene magnitud o coordenadas válidas.
 */
export function fromUsgsFeature(feature: UsgsFeature): EarthquakeEvent | null {
  if (!feature?.properties || !feature.geometry) return null;

  const props = feature.properties;
  const coords = feature.geometry.coordinates ?? [];
  const magnitude = finite(props.mag);
  const lon = finite(coords[0]);
  const lat = finite(coords[1]);
  const timestamp = finite(props.time);

  if (magnitude === null || lat === null || lon === null || timestamp === null) return null;

  const place = props.place?.trim() || 'Ubicación desconocida';
  const id = feature.id || `${lat}:${lon}:${timestamp}`;

  return {
    id,
    magnitude,
    place,
    region: place,
    lat,
    lon,
    depth: finite(coords[2]) ?? 0,
    timestamp,
    updatedAt: finite(props.updated) ?? timestamp,
    source: 'USGS',
    magType: typeof props.magType === 'string' ? props.magType : undefined,
    alert: cleanAlert(props.alert),
    tsunami: props.tsunami === 1,
    url: typeof props.url === 'string' ? props.url : undefined,
  };
}
