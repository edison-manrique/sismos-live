import type { Bounds } from './types.js';

export const TILE_SIZE = 256;
/** Latitud máxima representable en Web Mercator. */
export const MAX_LATITUDE = 85.0511287798066;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampLat(lat: number): number {
  return clamp(lat, -MAX_LATITUDE, MAX_LATITUDE);
}

/** Normaliza una longitud al rango [-180, 180). */
export function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/** Longitud → píxel X en el mundo (256 · 2^zoom). */
export function lonToWorldX(lon: number, zoom: number, tileSize = TILE_SIZE): number {
  return ((lon + 180) / 360) * tileSize * 2 ** zoom;
}

/** Latitud → píxel Y en el mundo (Web Mercator). */
export function latToWorldY(lat: number, zoom: number, tileSize = TILE_SIZE): number {
  const radians = (clampLat(lat) * Math.PI) / 180;
  const sin = Math.sin(radians);
  return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * tileSize * 2 ** zoom;
}

export function worldXToLon(x: number, zoom: number, tileSize = TILE_SIZE): number {
  return (x / (tileSize * 2 ** zoom)) * 360 - 180;
}

export function worldYToLat(y: number, zoom: number, tileSize = TILE_SIZE): number {
  const worldSize = tileSize * 2 ** zoom;
  const n = Math.PI * (1 - (2 * y) / worldSize);
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

/** Metros por píxel a una latitud y zoom dados. */
export function metersPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

/** Zoom necesario para encajar una caja geográfica en un viewport. */
export function zoomToFit(
  bounds: Bounds,
  width: number,
  height: number,
  padding = 48,
  tileSize = TILE_SIZE,
  minZoom = 1,
  maxZoom = 18,
): number {
  const lonSpan = Math.max(1e-6, Math.abs(bounds.maxLon - bounds.minLon));
  const latTop = latToWorldY(bounds.maxLat, 0, tileSize);
  const latBottom = latToWorldY(bounds.minLat, 0, tileSize);
  const latSpan = Math.max(1e-6, Math.abs(latBottom - latTop));
  const availableWidth = Math.max(32, width - padding * 2);
  const availableHeight = Math.max(32, height - padding * 2);
  const zoomX = Math.log2(availableWidth / (tileSize * (lonSpan / 360)));
  const zoomY = Math.log2(availableHeight / latSpan);
  return clamp(Math.min(zoomX, zoomY), minZoom, maxZoom);
}
