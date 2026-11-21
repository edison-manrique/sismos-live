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

function emscUrl(sourceId: string | undefined, unid: string): string | undefined {
  const numericId = sourceId?.trim();
  if (numericId && /^\d+$/.test(numericId)) {
    return `https://www.emsc-csem.org/Earthquake_information/earthquake.php?id=${encodeURIComponent(numericId)}`;
  }
  if (unid && !unid.includes(':')) {
    return `https://www.seismicportal.eu/eventdetails.html?unid=${encodeURIComponent(unid)}`;
  }
  return undefined;
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

  const sourceId = props.source_id != null ? String(props.source_id) : undefined;
  const unid = String(props.unid ?? feature.id ?? sourceId ?? `${lat}:${lon}:${timestamp}`);
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
    url: emscUrl(sourceId, unid),
    agency: typeof props.auth === 'string' && props.auth.trim() ? props.auth.trim() : undefined,
    status: typeof props.evtype === 'string' && props.evtype === 'ke' ? 'confirmado' : undefined,
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
  const dmin = finite(props.dmin);

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
    status: typeof props.status === 'string' ? props.status : undefined,
    agency: typeof props.net === 'string' && props.net.trim() ? props.net.toUpperCase() : undefined,
    felt: finite(props.felt),
    cdi: finite(props.cdi),
    mmi: finite(props.mmi),
    significance: finite(props.sig),
    stations: finite(props.nst),
    gap: finite(props.gap),
    rms: finite(props.rms),
    nearestStationKm: dmin !== null ? Math.round(dmin * 111.19) : null,
  };
}
