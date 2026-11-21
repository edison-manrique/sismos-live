export type MapTheme = 'voyager' | 'dark' | 'light' | 'satellite';

export interface LatLng {
  lat: number;
  lon: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface MapView {
  center: LatLng;
  zoom: number;
}

export interface ViewInfo extends MapView {
  bounds: Bounds;
  width: number;
  height: number;
}

export interface MapMarker {
  id: string;
  lat: number;
  lon: number;
  magnitude?: number;
  /** Color del marcador; por defecto se deriva de la magnitud. */
  color?: string;
  /** Diámetro del punto en px (10–30). */
  size?: number;
  /** Texto dentro del punto (p. ej. "4.8"). */
  label?: string;
  /** Anillo animado para eventos recientes. */
  pulse?: boolean;
  title?: string;
  data?: unknown;
}

export interface MapEventMap {
  move: ViewInfo;
  click: { lat: number; lon: number; screen: Point };
  'marker-click': { marker: MapMarker; screen: Point };
  'marker-hover': { marker: MapMarker | null; screen: Point | null };
  'zoom-end': ViewInfo;
  'theme-change': { theme: MapTheme };
}

export interface TileMapOptions {
  center?: LatLng;
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  theme?: MapTheme;
  markers?: MapMarker[];
  interactive?: boolean;
  /** HTML de atribución; si se omite se usa el del tema. */
  attribution?: string;
  tileSize?: number;
  /** Usa teselas @2x cuando el tema lo soporta. Por defecto `devicePixelRatio > 1`. */
  retina?: boolean;
  /** Caja resaltada (p. ej. el área filtrada). */
  selectionBounds?: Bounds | null;
  /** Polígono resaltado (p. ej. límites de un país). */
  selectionPolygon?: LatLng[] | null;
}
