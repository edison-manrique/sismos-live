/**
 * @sismos/geomap
 * Motor de mapas de teselas ligero, sin dependencias.
 */

export { TileMap } from './TileMap.js';
export {
  MAP_THEMES,
  THEMES,
  THEME_META,
  buildTileUrl,
  type ThemeMeta,
  type TileUrlOptions,
} from './themes.js';
export {
  MAX_LATITUDE,
  TILE_SIZE,
  clamp,
  clampLat,
  latToWorldY,
  lonToWorldX,
  metersPerPixel,
  worldXToLon,
  worldYToLat,
  wrapLon,
  zoomToFit,
} from './mercator.js';
export type {
  Bounds,
  LatLng,
  MapEventMap,
  MapMarker,
  MapTheme,
  MapView,
  Point,
  TileMapOptions,
  ViewInfo,
} from './types.js';
