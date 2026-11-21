import type { MapTheme } from './types.js';

/** Plantillas de teselas de los temas soportados (proveedores gratuitos sin API key). */
export const THEMES: Record<MapTheme, string> = {
  voyager: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  light: 'https://{s}.tile.openstreetmap.de/tiles/osmde/{z}/{x}/{y}.png',
  dark: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  satellite:
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
};

/** Subdominios válidos por proveedor (evita d.tile.openstreetmap.org que falla). */
export const THEME_SUBDOMAINS: Record<MapTheme, string[]> = {
  voyager: ['a', 'b', 'c'],
  light: ['a', 'b', 'c'],
  dark: ['a', 'b', 'c'],
  satellite: [],
};

export const MAP_THEMES: MapTheme[] = ['voyager', 'light', 'satellite', 'dark'];

export interface ThemeMeta {
  label: string;
  attribution: string;
  dark: boolean;
  /** Si el proveedor sirve teselas @2x. */
  retina: boolean;
}

export const THEME_META: Record<MapTheme, ThemeMeta> = {
  dark: {
    label: 'Topográfico',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> &middot; &copy; <a href="https://opentopomap.org" target="_blank" rel="noreferrer">OpenTopoMap</a> (CC-BY-SA)',
    dark: false,
    retina: false,
  },
  voyager: {
    label: 'Estándar',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    dark: false,
    retina: false,
  },
  light: {
    label: 'Claro (OSM DE)',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> &middot; Style by <a href="https://openstreetmap.de" target="_blank" rel="noreferrer">OpenStreetMap DE</a>',
    dark: false,
    retina: false,
  },
  satellite: {
    label: 'Satélite',
    attribution:
      'Imágenes &copy; <a href="https://www.esri.com/" target="_blank" rel="noreferrer">Esri</a>, Maxar, Earthstar Geographics',
    dark: true,
    retina: false,
  },
};

export interface TileUrlOptions {
  retina?: boolean;
  subdomains?: string[];
}

/** Construye la URL final de una tesela reemplazando `{s}`, `{z}`, `{x}`, `{y}` y `{r}`. */
export function buildTileUrl(
  theme: MapTheme,
  x: number,
  y: number,
  z: number,
  options: TileUrlOptions = {},
): string {
  const template = THEMES[theme] ?? THEMES.voyager;
  const defaultSubdomains = THEME_SUBDOMAINS[theme] ?? ['a', 'b', 'c'];
  const subdomains = options.subdomains ?? defaultSubdomains;
  const subdomain = subdomains.length > 0
    ? subdomains[Math.abs(x + y) % subdomains.length]
    : '';
  return template
    .replace('{s}', subdomain)
    .replace('{r}', options.retina ? '@2x' : '')
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}
