import type { LatLng } from './types.js';
import { PERU_POLYGON, PERU_SEISMIC_POLYGON } from './utils.js';

const OPENDATASOFT_PERU_URL =
  'https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/world-administrative-boundaries/records?where=iso3%3D%22PER%22&limit=1';
const GEOBOUNDARIES_DIRECT_URL =
  'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/gbOpen/PER/ADM0/geoBoundaries-PER-ADM0_simplified.geojson';
const GEOBOUNDARIES_API_URL = 'https://www.geoboundaries.org/api/current/gbOpen/PER/ADM0/';
const NOMINATIM_PERU_URL =
  'https://nominatim.openstreetmap.org/search?country=Peru&polygon_geojson=1&format=json&polygon_threshold=0.008';

const CACHE_KEY = 'sismos-live.peru-boundaries.v2';
const LEGACY_CACHE_KEY = 'sismos-live.peru-boundaries.v1';
const CACHE_TTL_MS = 7 * 86_400_000;

export interface PeruBoundaries {
  /** Anillos del contorno territorial y litoral de Perú (sin zona marítima). */
  visualRings: LatLng[][];
  /** Polígono con cobertura marítima (para filtrar sismos costeros y terrestres de Perú). */
  seismicPolygon: LatLng[];
  source: 'opendatasoft' | 'geoBoundaries' | 'fallback';
}

interface GeoJsonGeometry {
  type?: string;
  coordinates?: unknown;
}

function toLatLngRing(ring: unknown): LatLng[] {
  if (!Array.isArray(ring)) return [];
  const points: LatLng[] = [];
  for (const coord of ring) {
    if (!Array.isArray(coord) || coord.length < 2) continue;
    const lon = Number(coord[0]);
    const lat = Number(coord[1]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      points.push({ lat, lon });
    }
  }
  return points;
}

function extractRings(geometry: GeoJsonGeometry | null | undefined): LatLng[][] {
  if (!geometry || !geometry.coordinates) return [];
  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
    const outer = toLatLngRing(geometry.coordinates[0]);
    return outer.length >= 3 ? [outer] : [];
  }
  if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) {
    const rings: LatLng[][] = [];
    for (const poly of geometry.coordinates) {
      if (!Array.isArray(poly) || !poly.length) continue;
      const outer = toLatLngRing(poly[0]);
      if (outer.length >= 3) rings.push(outer);
    }
    return rings;
  }
  return [];
}

function largestRing(rings: LatLng[][]): LatLng[] {
  let best: LatLng[] = [];
  for (const ring of rings) {
    if (ring.length > best.length) best = ring;
  }
  return best;
}

/**
 * Comprueba que los anillos correspondan solo al contorno terrestre/litoral de Perú
 * (sin incluir las 200 millas marítimas que exceden -81.6°O).
 */
function isTerrestrialPeru(rings: LatLng[][]): boolean {
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const ring of rings) {
    for (const pt of ring) {
      if (pt.lon < minLon) minLon = pt.lon;
      if (pt.lon > maxLon) maxLon = pt.lon;
    }
  }
  return minLon >= -81.6 && maxLon <= -68.0;
}

async function fetchOpenDataSoftRings(
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<LatLng[][]> {
  const res = await fetchImpl(OPENDATASOFT_PERU_URL, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`OpenDataSoft ${res.status}`);
  const payload = (await res.json()) as {
    results?: Array<{ geo_shape?: { geometry?: GeoJsonGeometry } }>;
  };
  const geometry = payload.results?.[0]?.geo_shape?.geometry;
  const rings = extractRings(geometry);
  if (!rings.length || !isTerrestrialPeru(rings)) {
    throw new Error('OpenDataSoft devolvió geometría inválida');
  }
  return rings;
}

function normalizeGeoBoundariesUrl(rawUrl: string): string {
  // Evita la redirección 302 sin CORS de github.com/.../raw/... apuntando directo a media.githubusercontent.com
  return rawUrl.replace(
    /^https:\/\/github\.com\/([^/]+\/[^/]+)\/raw\//,
    'https://media.githubusercontent.com/media/$1/',
  );
}

async function fetchGeoBoundariesRings(
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<LatLng[][]> {
  const tryGeoUrl = async (url: string): Promise<LatLng[][]> => {
    const geoRes = await fetchImpl(url, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!geoRes.ok) throw new Error(`geoBoundaries GeoJSON ${geoRes.status}`);
    const collection = (await geoRes.json()) as {
      features?: Array<{ geometry?: GeoJsonGeometry }>;
      geometry?: GeoJsonGeometry;
    };
    const geometry = collection.features?.[0]?.geometry ?? collection.geometry;
    const rings = extractRings(geometry);
    if (!rings.length || !isTerrestrialPeru(rings)) {
      throw new Error('geoBoundaries devolvió geometría inválida');
    }
    return rings;
  };

  try {
    return await tryGeoUrl(GEOBOUNDARIES_DIRECT_URL);
  } catch {
    const metaRes = await fetchImpl(GEOBOUNDARIES_API_URL, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!metaRes.ok) throw new Error(`geoBoundaries ${metaRes.status}`);
    const meta = (await metaRes.json()) as {
      simplifiedGeometryGeoJSON?: string;
      gjDownloadURL?: string;
    };
    const geoUrl = meta.simplifiedGeometryGeoJSON || meta.gjDownloadURL;
    if (!geoUrl) throw new Error('geoBoundaries sin URL de GeoJSON');
    return await tryGeoUrl(normalizeGeoBoundariesUrl(geoUrl));
  }
}

async function fetchNominatimRings(
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<LatLng[][]> {
  const res = await fetchImpl(NOMINATIM_PERU_URL, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const results = (await res.json()) as Array<{ geojson?: GeoJsonGeometry }>;
  const rings = extractRings(results?.[0]?.geojson);
  if (!rings.length) throw new Error('Nominatim devolvió geometría vacía');
  return rings;
}

export function loadCachedPeruBoundaries(): PeruBoundaries | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    localStorage.removeItem(LEGACY_CACHE_KEY);
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      savedAt?: number;
      data?: PeruBoundaries;
    };
    if (!parsed?.savedAt || !parsed?.data) return null;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    if (!Array.isArray(parsed.data.visualRings) || !parsed.data.visualRings.length) return null;
    if (!isTerrestrialPeru(parsed.data.visualRings)) return null;
    if (!Array.isArray(parsed.data.seismicPolygon) || parsed.data.seismicPolygon.length < 3) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function saveCachedPeruBoundaries(data: PeruBoundaries): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    /* almacenamiento no disponible */
  }
}

/**
 * Obtiene los límites geográficos reales de Perú usando APIs públicas gratuitas sin API key:
 * - OpenDataSoft / geoBoundaries (contorno terrestre y litoral oficial, sin mar territorial)
 * - Nominatim / OpenStreetMap (polígono con dominio marítimo de 200 millas solo para filtrar sismos)
 */
export async function fetchPeruBoundaries(
  options: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {},
): Promise<PeruBoundaries> {
  const cached = loadCachedPeruBoundaries();
  if (cached) return cached;

  const doFetch = options.fetchImpl ?? fetch;

  const [odsResult, geoResult, nomResult] = await Promise.allSettled([
    fetchOpenDataSoftRings(doFetch, options.signal),
    fetchGeoBoundariesRings(doFetch, options.signal),
    fetchNominatimRings(doFetch, options.signal),
  ]);

  const odsRings = odsResult.status === 'fulfilled' ? odsResult.value : null;
  const geoRings = geoResult.status === 'fulfilled' ? geoResult.value : null;
  const nomRings = nomResult.status === 'fulfilled' ? nomResult.value : null;

  const nomMain = nomRings ? largestRing(nomRings) : null;
  const seismicPolygon =
    nomMain && nomMain.length >= 3 ? nomMain : PERU_SEISMIC_POLYGON;

  if (geoRings || odsRings) {
    const visualRings = geoRings ?? odsRings!;
    const result: PeruBoundaries = {
      visualRings,
      seismicPolygon,
      source: geoRings ? 'geoBoundaries' : 'opendatasoft',
    };
    saveCachedPeruBoundaries(result);
    return result;
  }

  return {
    visualRings: [PERU_POLYGON],
    seismicPolygon,
    source: 'fallback',
  };
}
