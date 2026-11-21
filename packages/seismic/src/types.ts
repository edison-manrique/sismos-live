/**
 * Tipos públicos de @sismos/seismic.
 */

export type EarthquakeSource = 'EMSC' | 'USGS';

export type AlertLevel = 'green' | 'yellow' | 'orange' | 'red';

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'closed'
  | 'error';

export interface LatLng {
  lat: number;
  lon: number;
}

/** Caja geográfica en grados decimales. */
export interface Bounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/** Interfaz única a la que se normalizan EMSC y USGS. */
export interface EarthquakeEvent {
  /** Identificador estable (EMSC: unid; USGS: feature.id). */
  id: string;
  magnitude: number;
  /** Descripción legible: "NEAR COAST OF CENTRAL PERU" / "45 km WSW of Lima, Peru". */
  place: string;
  /** Región corta (flynn_region de EMSC o place de USGS). */
  region: string;
  lat: number;
  lon: number;
  /** Profundidad en km. */
  depth: number;
  /** Epoch en milisegundos. */
  timestamp: number;
  /** Última actualización (epoch ms). */
  updatedAt: number;
  source: EarthquakeSource;
  sourceCatalog?: string;
  magType?: string;
  alert: AlertLevel | null;
  tsunami: boolean;
  /** Enlace a la ficha oficial cuando existe. */
  url?: string;
  /** Estado de revisión (reviewed, automatic, etc.). */
  status?: string;
  /** Agencia o red sísmica reportante (IGP, us, ci, EMSC, etc.). */
  agency?: string;
  /** Cantidad de reportes "Lo sentí" (DYFI de USGS). */
  felt?: number | null;
  /** Intensidad máxima percibida (CDI, escala MMI). */
  cdi?: number | null;
  /** Intensidad instrumental estimada (ShakeMap MMI). */
  mmi?: number | null;
  /** Índice de relevancia USGS (0-1000+). */
  significance?: number | null;
  /** Número de estaciones sísmicas utilizadas. */
  stations?: number | null;
  /** Brecha azimutal máxima entre estaciones (grados). */
  gap?: number | null;
  /** Residual RMS de tiempo de viaje (segundos). */
  rms?: number | null;
  /** Distancia a la estación más cercana (km). */
  nearestStationKm?: number | null;
}

/** Filtro aplicable en memoria (también usado por el feed). */
export interface EventFilter {
  minMagnitude?: number;
  maxMagnitude?: number;
  /** Epoch ms mínimo. */
  since?: number | null;
  /** Epoch ms máximo. */
  until?: number | null;
  bounds?: Bounds | null;
  polygon?: LatLng[] | null;
  sources?: EarthquakeSource[] | null;
  /** Búsqueda de texto libre sobre place/region. */
  search?: string;
}

export interface MagnitudeBucket {
  label: string;
  min: number;
  max: number;
  count: number;
  color: string;
}

export interface FeedStats {
  total: number;
  maxMagnitude: number;
  avgMagnitude: number;
  avgDepth: number;
  lastHour: number;
  lastDay: number;
  bySource: Record<EarthquakeSource, number>;
  byBucket: MagnitudeBucket[];
  strongest: EarthquakeEvent | null;
}

/** Instantánea inmutable que reciben los suscriptores del feed. */
export interface FeedSnapshot {
  /** Eventos ya filtrados y ordenados por tiempo descendente. */
  events: EarthquakeEvent[];
  /** Total de eventos en memoria (antes de filtrar). */
  total: number;
  filter: EventFilter;
  stats: FeedStats;
  connection: ConnectionStatus;
  /** Última vez que llegó un evento (live o REST). */
  lastEventAt: number | null;
  /** Última sincronización REST exitosa. */
  lastSyncAt: number | null;
  loading: boolean;
  reconnectAttempt: number;
  error: string | null;
}

/** Acción de un mensaje EMSC. */
export type EmscAction = 'create' | 'update';

/** Payload crudo del WebSocket de EMSC SeismicPortal. */
export interface EmscMessage {
  action: EmscAction | string;
  data: {
    type: 'Feature';
    id?: string;
    geometry: {
      type: 'Point';
      /** [longitud, latitud, profundidad_km] */
      coordinates: [number, number, number?];
    };
    properties: {
      unid?: string;
      source_id?: string;
      source_catalog?: string;
      lastupdate?: string;
      time: string;
      flynn_region?: string;
      region?: string;
      lat?: number;
      lon?: number;
      depth?: number;
      mag?: number | null;
      magtype?: string;
      auth?: string;
      evtype?: string;
      [key: string]: unknown;
    };
  };
}

/** Feature GeoJSON de la API de USGS. */
export interface UsgsFeature {
  id: string;
  type: 'Feature';
  properties: {
    mag: number | null;
    place: string | null;
    time: number;
    updated?: number;
    url?: string;
    alert?: AlertLevel | null;
    tsunami?: number;
    magType?: string;
    type?: string;
    status?: string;
    net?: string;
    felt?: number | null;
    cdi?: number | null;
    mmi?: number | null;
    sig?: number | null;
    nst?: number | null;
    gap?: number | null;
    rms?: number | null;
    dmin?: number | null;
    [key: string]: unknown;
  };
  geometry: {
    type: 'Point';
    /** [longitud, latitud, profundidad_km] */
    coordinates: [number, number, number?];
  };
}

export interface UsgsFeatureCollection {
  type: 'FeatureCollection';
  metadata?: {
    generated?: number;
    url?: string;
    title?: string;
    status?: number;
    count?: number;
    [key: string]: unknown;
  };
  features: UsgsFeature[];
}
