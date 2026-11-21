import { fromUsgsFeature } from './normalize.js';
import type { Bounds, EarthquakeEvent, UsgsFeatureCollection } from './types.js';

/**
 * Endpoint FDSN de USGS.
 *
 * Nota: la especificación del proyecto mostraba `https://usgs.govquery`, que es
 * un marcador de posición. El endpoint real y con CORS habilitado es este.
 */
export const USGS_ENDPOINT = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

export interface UsgsQueryOptions {
  startTime?: string | number | Date;
  endTime?: string | number | Date;
  minMagnitude?: number;
  maxMagnitude?: number;
  bounds?: Bounds | null;
  limit?: number;
  orderBy?: 'time' | 'time-asc' | 'magnitude' | 'magnitude-asc';
  minDepth?: number;
  maxDepth?: number;
  /** Permite apuntar a un proxy o a un endpoint de pruebas. */
  baseUrl?: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export interface UsgsResult {
  events: EarthquakeEvent[];
  url: string;
  fetchedAt: number;
}

function toIso(value: string | number | Date): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') return new Date(value).toISOString();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : value;
}

/** Construye la URL de consulta GeoJSON de USGS. */
export function buildUsgsUrl(options: UsgsQueryOptions = {}): string {
  const base = options.baseUrl ?? USGS_ENDPOINT;
  const params = new URLSearchParams({
    format: 'geojson',
    orderby: options.orderBy ?? 'time',
  });

  if (options.startTime != null) params.set('starttime', toIso(options.startTime));
  if (options.endTime != null) params.set('endtime', toIso(options.endTime));
  if (options.minMagnitude != null) params.set('minmagnitude', String(options.minMagnitude));
  if (options.maxMagnitude != null) params.set('maxmagnitude', String(options.maxMagnitude));
  if (options.minDepth != null) params.set('mindepth', String(options.minDepth));
  if (options.maxDepth != null) params.set('maxdepth', String(options.maxDepth));
  if (options.limit != null) params.set('limit', String(options.limit));

  if (options.bounds) {
    params.set('minlatitude', String(options.bounds.minLat));
    params.set('maxlatitude', String(options.bounds.maxLat));
    params.set('minlongitude', String(options.bounds.minLon));
    params.set('maxlongitude', String(options.bounds.maxLon));
  }

  return `${base}?${params.toString()}`;
}

/**
 * Descarga eventos desde la API REST de USGS y los normaliza.
 * Lanza un error legible si la respuesta no es satisfactoria.
 */
export async function fetchUsgsEvents(options: UsgsQueryOptions = {}): Promise<UsgsResult> {
  const url = buildUsgsUrl(options);
  const doFetch = options.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await doFetch(url, {
      signal: options.signal,
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new Error(`No se pudo conectar con USGS: ${(error as Error).message}`);
  }

  // USGS responde 204 cuando la consulta no devuelve eventos.
  if (response.status === 204) {
    return { events: [], url, fetchedAt: Date.now() };
  }

  if (!response.ok) {
    throw new Error(`USGS respondió ${response.status} ${response.statusText || ''}`.trim());
  }

  const payload = (await response.json()) as UsgsFeatureCollection;
  const features = Array.isArray(payload?.features) ? payload.features : [];
  const events = features
    .map(fromUsgsFeature)
    .filter((event): event is EarthquakeEvent => event !== null);

  return { events, url, fetchedAt: Date.now() };
}
