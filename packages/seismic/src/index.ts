/**
 * @sismos/seismic
 * Datos sísmicos en tiempo real: EMSC (WebSocket) + USGS (REST).
 */

export type {
  AlertLevel,
  Bounds,
  ConnectionStatus,
  EarthquakeEvent,
  EarthquakeSource,
  EmscAction,
  EmscMessage,
  EventFilter,
  FeedSnapshot,
  FeedStats,
  LatLng,
  MagnitudeBucket,
  UsgsFeature,
  UsgsFeatureCollection,
} from './types.js';

export {
  EMSC_PING_INTERVAL,
  EMSC_WS_URL,
  EmscSocket,
  type EmscSocketOptions,
  type EmscStatusDetail,
} from './emsc.js';

export {
  USGS_ENDPOINT,
  buildUsgsUrl,
  fetchUsgsEvents,
  type UsgsQueryOptions,
  type UsgsResult,
} from './usgs.js';

export { EarthquakeFeed, type FeedEventMeta, type FeedOptions } from './feed.js';

export { fromEmscMessage, fromUsgsFeature } from './normalize.js';

export {
  MAGNITUDE_BUCKETS,
  MAGNITUDE_COLORS,
  PERU_BOUNDS,
  PERU_POLYGON,
  PERU_SEISMIC_POLYGON,
  WORLD_BOUNDS,
  boundsCenter,
  boundsOfEvents,
  boundsSpan,
  bucketForMagnitude,
  computeStats,
  formatClock,
  formatCoords,
  formatDateTime,
  formatDepth,
  formatMagnitude,
  formatNumber,
  isPointInPolygon,
  isWithinBounds,
  magnitudeColor,
  magnitudeRadius,
  matchesFilter,
  sortByMagnitudeDesc,
  sortByTimeDesc,
  timeAgo,
} from './utils.js';
