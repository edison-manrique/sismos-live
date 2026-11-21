import styles from './TileMap.module.css';
import {
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
import { THEME_META, buildTileUrl } from './themes.js';
import type {
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

const DEFAULT_CENTER: LatLng = { lat: -9.19, lon: -75.02 };
const MARKER_COLORS: Array<[number, string]> = [
  [7, '#ff3b5c'],
  [6, '#ff5f3d'],
  [5, '#ff8a3d'],
  [4, '#ffb020'],
  [3, '#ffd93d'],
  [2, '#7ee787'],
  [Number.NEGATIVE_INFINITY, '#56c8f5'],
];

function colorForMagnitude(magnitude = 0): string {
  for (const [min, color] of MARKER_COLORS) {
    if (magnitude >= min) return color;
  }
  return '#56c8f5';
}

function div(className: string): HTMLDivElement {
  const element = document.createElement('div');
  element.className = className;
  return element;
}

interface MarkerEntry {
  wrap: HTMLDivElement;
  button: HTMLButtonElement;
  dot: HTMLSpanElement;
  label: HTMLSpanElement;
  marker: MapMarker;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  startCenter: LatLng;
  moved: boolean;
}

interface PinchState {
  distance: number;
  zoom: number;
  anchor: LatLng;
}

type Listener = (payload: unknown) => void;

/**
 * Motor de mapas de teselas sin dependencias.
 *
 * - Proyección Web Mercator y zoom fraccional.
 * - Pan con puntero, rueda, pinch, teclado y doble clic.
 * - Marcadores DOM reutilizados (diff por `id`) y caja de selección.
 * - Temas CARTO (voyager/dark/light) y satélite Esri.
 */
export class TileMap {
  private readonly root: HTMLDivElement;
  private readonly tileLayer: HTMLDivElement;
  private readonly selectionLayer: HTMLDivElement;
  private readonly markerLayer: HTMLDivElement;
  private readonly scaleEl: HTMLDivElement;
  private readonly scaleBar: HTMLDivElement;
  private readonly scaleLabel: HTMLSpanElement;
  private readonly attributionEl: HTMLDivElement;
  private readonly options: TileMapOptions;
  private readonly tileSize: number;
  private readonly retina: boolean;
  private readonly minZoom: number;
  private readonly maxZoom: number;
  private readonly resizeObserver: ResizeObserver;
  private readonly listeners = new Map<keyof MapEventMap, Set<Listener>>();
  private readonly markerEls = new Map<string, MarkerEntry>();
  private readonly tileEls = new Map<string, HTMLImageElement>();
  private readonly pointers = new Map<number, Point>();

  private center: LatLng;
  private zoom: number;
  private theme: MapTheme;
  private interactive: boolean;
  private width = 1;
  private height = 1;
  private tileZoom = -1;
  private selectionBounds: Bounds | null = null;
  private selectedId: string | null = null;
  private drag: DragState | null = null;
  private pinch: PinchState | null = null;
  private animationRaf: number | null = null;
  private destroyed = false;

  constructor(container: HTMLElement, options: TileMapOptions = {}) {
    this.options = options;
    this.minZoom = options.minZoom ?? 2;
    this.maxZoom = options.maxZoom ?? 18;
    this.zoom = clamp(options.zoom ?? 5, this.minZoom, this.maxZoom);
    this.center = { ...(options.center ?? DEFAULT_CENTER) };
    this.theme = options.theme ?? 'dark';
    this.interactive = options.interactive ?? true;
    this.tileSize = options.tileSize ?? 256;
    this.retina =
      options.retina ?? (typeof window !== 'undefined' && window.devicePixelRatio > 1);
    this.selectionBounds = options.selectionBounds ?? null;

    this.root = div(styles.map);
    this.root.tabIndex = 0;
    this.root.dataset.theme = this.theme;
    this.root.setAttribute('role', 'application');
    this.root.setAttribute('aria-label', 'Mapa sísmico interactivo');

    this.tileLayer = div(styles.tiles);
    this.selectionLayer = div(styles.overlays);
    this.markerLayer = div(styles.markers);

    this.scaleEl = div(styles.scale);
    this.scaleBar = div(styles.scaleBar);
    this.scaleLabel = document.createElement('span');
    this.scaleLabel.className = styles.scaleLabel;
    this.scaleEl.append(this.scaleLabel, this.scaleBar);

    this.attributionEl = div(styles.attribution);

    this.root.append(
      this.tileLayer,
      this.selectionLayer,
      this.markerLayer,
      this.scaleEl,
      this.attributionEl,
    );
    container.appendChild(this.root);

    this.updateAttribution();
    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.measure());
    this.resizeObserver.observe(container);
    this.measure();
    if (options.markers) this.setMarkers(options.markers);
    this.render();
  }

  // ── API pública ────────────────────────────────────────────────────────────

  on<K extends keyof MapEventMap>(type: K, handler: (payload: MapEventMap[K]) => void): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set<Listener>();
      this.listeners.set(type, set);
    }
    set.add(handler as Listener);
    return () => {
      set?.delete(handler as Listener);
    };
  }

  setTheme(theme: MapTheme): void {
    if (theme === this.theme) return;
    this.theme = theme;
    this.root.dataset.theme = theme;
    this.updateAttribution();
    this.clearTiles();
    this.tileZoom = -1;
    this.render();
    this.emit('theme-change', { theme });
  }

  getTheme(): MapTheme {
    return this.theme;
  }

  setAttribution(html?: string): void {
    this.options.attribution = html;
    this.updateAttribution();
  }

  setView(view: MapView, options: { animate?: boolean; duration?: number } = {}): void {
    const center = { lat: clampLat(view.center.lat), lon: wrapLon(view.center.lon) };
    const zoom = clamp(view.zoom, this.minZoom, this.maxZoom);
    if (options.animate) {
      this.flyTo(center, zoom, options.duration);
      return;
    }
    this.cancelAnimation();
    this.center = center;
    this.zoom = zoom;
    this.render();
    this.emit('zoom-end', this.viewInfo());
  }

  getView(): MapView {
    return { center: { ...this.center }, zoom: this.zoom };
  }

  getBounds(): Bounds {
    return this.viewInfo().bounds;
  }

  flyTo(center: LatLng, zoom = this.zoom, duration = 700): void {
    this.cancelAnimation();
    const fromCenter = { ...this.center };
    const fromZoom = this.zoom;
    const targetZoom = clamp(zoom, this.minZoom, this.maxZoom);
    const targetLat = clampLat(center.lat);
    let deltaLon = center.lon - fromCenter.lon;
    if (deltaLon > 180) deltaLon -= 360;
    if (deltaLon < -180) deltaLon += 360;

    const start = performance.now();
    const step = (now: number) => {
      if (this.destroyed) return;
      const t = Math.min(1, (now - start) / Math.max(1, duration));
      const k = 1 - (1 - t) ** 3;
      this.center = {
        lat: fromCenter.lat + (targetLat - fromCenter.lat) * k,
        lon: wrapLon(fromCenter.lon + deltaLon * k),
      };
      this.zoom = fromZoom + (targetZoom - fromZoom) * k;
      this.render();
      if (t < 1) {
        this.animationRaf = requestAnimationFrame(step);
      } else {
        this.animationRaf = null;
        this.emit('zoom-end', this.viewInfo());
      }
    };
    this.animationRaf = requestAnimationFrame(step);
  }

  fitBounds(bounds: Bounds, padding = 56, animate = true): void {
    const center: LatLng = {
      lat: (bounds.minLat + bounds.maxLat) / 2,
      lon: (bounds.minLon + bounds.maxLon) / 2,
    };
    const zoom = zoomToFit(
      bounds,
      this.width,
      this.height,
      padding,
      this.tileSize,
      this.minZoom,
      this.maxZoom,
    );
    this.setView({ center, zoom }, { animate });
  }

  zoomIn(): void {
    this.flyTo(this.center, this.zoom + 1, 300);
  }

  zoomOut(): void {
    this.flyTo(this.center, this.zoom - 1, 300);
  }

  /** Desplaza el contenido del mapa `dx`/`dy` píxeles. */
  panBy(dx: number, dy: number): void {
    this.panByPixels(dx, dy);
  }

  setMarkers(markers: MapMarker[]): void {
    const seen = new Set<string>();
    for (const marker of markers) {
      seen.add(marker.id);
      let entry = this.markerEls.get(marker.id);
      if (!entry) {
        entry = this.createMarkerEl(marker);
        this.markerEls.set(marker.id, entry);
        this.markerLayer.appendChild(entry.wrap);
      }
      entry.marker = marker;
      this.updateMarkerEl(entry);
    }
    for (const [id, entry] of this.markerEls) {
      if (!seen.has(id)) {
        entry.wrap.remove();
        this.markerEls.delete(id);
      }
    }
    const { z, scale } = this.scaleInfo();
    this.positionMarkers(z, this.offsetFor(z, scale), scale);
  }

  setSelected(id: string | null): void {
    this.selectedId = id;
    for (const entry of this.markerEls.values()) {
      entry.button.classList.toggle(styles.selected, entry.marker.id === id);
    }
  }

  setSelectionBounds(bounds: Bounds | null): void {
    this.selectionBounds = bounds;
    this.renderSelection();
  }

  setInteractive(interactive: boolean): void {
    this.interactive = interactive;
    this.root.classList.toggle(styles.static, !interactive);
  }

  project(lat: number, lon: number): Point {
    const { z, scale } = this.scaleInfo();
    const offset = this.offsetFor(z, scale);
    return {
      x: lonToWorldX(lon, z, this.tileSize) * scale + offset.x,
      y: latToWorldY(lat, z, this.tileSize) * scale + offset.y,
    };
  }

  unproject(x: number, y: number): LatLng {
    const { z, scale } = this.scaleInfo();
    const offset = this.offsetFor(z, scale);
    return {
      lon: worldXToLon((x - offset.x) / scale, z, this.tileSize),
      lat: worldYToLat((y - offset.y) / scale, z, this.tileSize),
    };
  }

  resize(): void {
    this.measure();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelAnimation();
    this.resizeObserver.disconnect();
    this.unbindEvents();
    this.clearTiles();
    this.markerEls.clear();
    this.listeners.clear();
    this.root.remove();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  private render(): void {
    if (this.destroyed) return;
    const { z, scale } = this.scaleInfo();
    if (z !== this.tileZoom) {
      this.clearTiles();
      this.tileZoom = z;
    }
    const offset = this.offsetFor(z, scale);
    this.tileLayer.style.transform = `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`;
    this.syncTiles(z, offset, scale);
    this.positionMarkers(z, offset, scale);
    this.renderSelection();
    this.updateScale();
    this.emit('move', this.viewInfo());
  }

  private scaleInfo(): { z: number; scale: number } {
    const z = clamp(Math.round(this.zoom), 0, 22);
    return { z, scale: 2 ** (this.zoom - z) };
  }

  private offsetFor(z: number, scale: number): Point {
    const centerX = lonToWorldX(this.center.lon, z, this.tileSize);
    const centerY = latToWorldY(this.center.lat, z, this.tileSize);
    return { x: this.width / 2 - centerX * scale, y: this.height / 2 - centerY * scale };
  }

  private syncTiles(z: number, offset: Point, scale: number): void {
    const size = this.tileSize;
    const tileCount = 2 ** z;
    const x0 = Math.floor(-offset.x / scale / size);
    const x1 = Math.ceil((this.width - offset.x) / scale / size) - 1;
    const y0 = Math.max(0, Math.floor(-offset.y / scale / size));
    const y1 = Math.min(tileCount - 1, Math.ceil((this.height - offset.y) / scale / size) - 1);
    const needed = new Set<string>();
    const retina = this.retina && THEME_META[this.theme].retina;

    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const key = `${z}:${x}:${y}`;
        needed.add(key);
        if (this.tileEls.has(key)) continue;

        const image = document.createElement('img');
        image.className = styles.tile;
        image.alt = '';
        image.draggable = false;
        image.decoding = 'async';
        image.style.width = `${size}px`;
        image.style.height = `${size}px`;
        image.style.left = `${x * size}px`;
        image.style.top = `${y * size}px`;

        const wrappedX = ((x % tileCount) + tileCount) % tileCount;
        image.src = buildTileUrl(this.theme, wrappedX, y, z, { retina });
        if (image.complete) image.classList.add(styles.loaded);
        else {
          image.addEventListener('load', () => image.classList.add(styles.loaded), {
            once: true,
          });
        }
        image.addEventListener(
          'error',
          () => {
            image.style.visibility = 'hidden';
          },
          { once: true },
        );

        this.tileLayer.appendChild(image);
        this.tileEls.set(key, image);
      }
    }

    for (const [key, element] of this.tileEls) {
      if (!needed.has(key)) {
        element.remove();
        this.tileEls.delete(key);
      }
    }
  }

  private clearTiles(): void {
    for (const element of this.tileEls.values()) element.remove();
    this.tileEls.clear();
  }

  private positionMarkers(z: number, offset: Point, scale: number): void {
    for (const entry of this.markerEls.values()) {
      const x = lonToWorldX(entry.marker.lon, z, this.tileSize) * scale + offset.x;
      const y = latToWorldY(entry.marker.lat, z, this.tileSize) * scale + offset.y;
      entry.wrap.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      const visible = x > -80 && x < this.width + 80 && y > -80 && y < this.height + 80;
      entry.wrap.style.visibility = visible ? 'visible' : 'hidden';
    }
  }

  private renderSelection(): void {
    this.selectionLayer.replaceChildren();
    if (!this.selectionBounds) return;
    const nw = this.project(this.selectionBounds.maxLat, this.selectionBounds.minLon);
    const se = this.project(this.selectionBounds.minLat, this.selectionBounds.maxLon);
    const width = se.x - nw.x;
    const height = se.y - nw.y;
    if (width <= 0 || height <= 0) return;

    const rect = div(styles.selection);
    rect.style.left = `${nw.x}px`;
    rect.style.top = `${nw.y}px`;
    rect.style.width = `${width}px`;
    rect.style.height = `${height}px`;
    this.selectionLayer.appendChild(rect);
  }

  private updateScale(): void {
    const mpp = metersPerPixel(this.center.lat, this.zoom);
    const raw = mpp * 96;
    const power = 10 ** Math.floor(Math.log10(Math.max(1e-6, raw)));
    const normalized = raw / power;
    const nice = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1;
    const meters = nice * power;
    const width = Math.min(160, meters / mpp);

    this.scaleBar.style.width = `${width.toFixed(1)}px`;
    const label =
      meters >= 1000
        ? `${new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 }).format(meters / 1000)} km`
        : `${Math.round(meters)} m`;
    this.scaleLabel.textContent = label;
  }

  private updateAttribution(): void {
    this.attributionEl.innerHTML = this.options.attribution ?? THEME_META[this.theme].attribution;
  }

  private viewInfo(): ViewInfo {
    const nw = this.unproject(0, 0);
    const se = this.unproject(this.width, this.height);
    return {
      center: { ...this.center },
      zoom: this.zoom,
      width: this.width,
      height: this.height,
      bounds: {
        minLat: clampLat(se.lat),
        maxLat: clampLat(nw.lat),
        minLon: nw.lon,
        maxLon: se.lon,
      },
    };
  }

  // ── Marcadores ─────────────────────────────────────────────────────────────

  private createMarkerEl(marker: MapMarker): MarkerEntry {
    const wrap = div(styles.markerWrap);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = styles.marker;

    const ring = document.createElement('span');
    ring.className = styles.ring;
    ring.setAttribute('aria-hidden', 'true');

    const dot = document.createElement('span');
    dot.className = styles.dot;

    const label = document.createElement('span');
    label.className = styles.markerLabel;
    dot.appendChild(label);
    button.append(ring, dot);
    wrap.appendChild(button);

    const id = marker.id;

    button.addEventListener('pointerdown', (event) => event.stopPropagation());
    button.addEventListener('pointerup', (event) => event.stopPropagation());
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const entry = this.markerEls.get(id);
      if (!entry) return;
      this.emit('marker-click', {
        marker: entry.marker,
        screen: this.project(entry.marker.lat, entry.marker.lon),
      });
    });
    button.addEventListener('pointerenter', () => {
      const entry = this.markerEls.get(id);
      if (!entry) return;
      this.emit('marker-hover', {
        marker: entry.marker,
        screen: this.project(entry.marker.lat, entry.marker.lon),
      });
    });
    button.addEventListener('pointerleave', () => {
      this.emit('marker-hover', { marker: null, screen: null });
    });

    return { wrap, button, dot, label, marker };
  }

  private updateMarkerEl(entry: MarkerEntry): void {
    const { marker, button, dot, label } = entry;
    const size = clamp(
      marker.size ?? (marker.magnitude != null ? 10 + marker.magnitude * 2.6 : 12),
      8,
      40,
    );
    const color = marker.color ?? colorForMagnitude(marker.magnitude ?? 0);
    const magnitudeText = marker.magnitude != null ? marker.magnitude.toFixed(1) : '?';
    const title =
      marker.title ??
      `M${magnitudeText} · ${marker.lat.toFixed(2)}, ${marker.lon.toFixed(2)}`;

    button.style.setProperty('--marker-size', `${size.toFixed(1)}px`);
    button.style.setProperty('--marker-color', color);
    button.title = title;
    button.setAttribute('aria-label', title);
    button.classList.toggle(styles.pulse, Boolean(marker.pulse));
    button.classList.toggle(styles.selected, this.selectedId === marker.id);

    label.textContent = marker.label ?? '';
    const showLabel = Boolean(marker.label) && size >= 16;
    label.style.display = showLabel ? '' : 'none';
    dot.classList.toggle(styles.hasLabel, showLabel);
  }

  // ── Interacción ────────────────────────────────────────────────────────────

  private bindEvents(): void {
    this.root.addEventListener('pointerdown', this.onPointerDown);
    this.root.addEventListener('pointermove', this.onPointerMove);
    this.root.addEventListener('pointerup', this.onPointerUp);
    this.root.addEventListener('pointercancel', this.onPointerUp);
    this.root.addEventListener('wheel', this.onWheel, { passive: false });
    this.root.addEventListener('dblclick', this.onDoubleClick);
    this.root.addEventListener('keydown', this.onKeyDown);
    this.root.addEventListener('contextmenu', this.preventDefault);
  }

  private unbindEvents(): void {
    this.root.removeEventListener('pointerdown', this.onPointerDown);
    this.root.removeEventListener('pointermove', this.onPointerMove);
    this.root.removeEventListener('pointerup', this.onPointerUp);
    this.root.removeEventListener('pointercancel', this.onPointerUp);
    this.root.removeEventListener('wheel', this.onWheel);
    this.root.removeEventListener('dblclick', this.onDoubleClick);
    this.root.removeEventListener('keydown', this.onKeyDown);
    this.root.removeEventListener('contextmenu', this.preventDefault);
  }

  private preventDefault = (event: Event): void => {
    event.preventDefault();
  };

  private localPoint(event: { clientX: number; clientY: number }): Point {
    return this.localPointFromPoint({ x: event.clientX, y: event.clientY });
  }

  private localPointFromPoint(point: Point): Point {
    const rect = this.root.getBoundingClientRect();
    return { x: point.x - rect.left, y: point.y - rect.top };
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.interactive) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.root.focus({ preventScroll: true });
    this.cancelAnimation();
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pointers.size === 1) {
      this.drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startCenter: { ...this.center },
        moved: false,
      };
      this.root.classList.add(styles.dragging);
      try {
        this.root.setPointerCapture(event.pointerId);
      } catch {
        /* noop */
      }
    } else if (this.pointers.size === 2) {
      this.drag = null;
      const [a, b] = [...this.pointers.values()];
      const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const local = this.localPointFromPoint(midpoint);
      this.pinch = {
        distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        zoom: this.zoom,
        anchor: this.unproject(local.x, local.y),
      };
    }
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pointers.size >= 2 && this.pinch) {
      const [a, b] = [...this.pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const ratio = distance / this.pinch.distance;
      this.zoom = clamp(this.pinch.zoom + Math.log2(Math.max(0.01, ratio)), this.minZoom, this.maxZoom);

      const local = this.localPointFromPoint({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      const anchor = this.project(this.pinch.anchor.lat, this.pinch.anchor.lon);
      this.panByPixels(anchor.x - local.x, anchor.y - local.y);
      return;
    }

    if (!this.drag || this.drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - this.drag.startX;
    const dy = event.clientY - this.drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) this.drag.moved = true;

    const { z, scale } = this.scaleInfo();
    const centerX = lonToWorldX(this.drag.startCenter.lon, z, this.tileSize) - dx / scale;
    const centerY = latToWorldY(this.drag.startCenter.lat, z, this.tileSize) - dy / scale;
    this.center = {
      lat: clampLat(worldYToLat(centerY, z, this.tileSize)),
      lon: wrapLon(worldXToLon(centerX, z, this.tileSize)),
    };
    this.render();
  };

  private onPointerUp = (event: PointerEvent): void => {
    const wasDragging = this.drag?.pointerId === event.pointerId;
    const moved = this.drag?.moved ?? false;
    this.pointers.delete(event.pointerId);

    if (wasDragging) {
      this.drag = null;
      this.root.classList.remove(styles.dragging);
      try {
        this.root.releasePointerCapture(event.pointerId);
      } catch {
        /* noop */
      }
      if (!moved && this.pointers.size === 0) {
        const local = this.localPoint(event);
        const coords = this.unproject(local.x, local.y);
        this.emit('click', { lat: coords.lat, lon: coords.lon, screen: local });
      }
    }
    if (this.pointers.size < 2) this.pinch = null;
  };

  private onWheel = (event: WheelEvent): void => {
    if (!this.interactive) return;
    event.preventDefault();
    this.cancelAnimation();

    const local = this.localPoint(event);
    const before = this.unproject(local.x, local.y);
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    const nextZoom = clamp(this.zoom - delta * 0.0022, this.minZoom, this.maxZoom);
    if (nextZoom === this.zoom) return;

    this.zoom = nextZoom;
    const after = this.project(before.lat, before.lon);
    this.panByPixels(after.x - local.x, after.y - local.y);
  };

  private onDoubleClick = (event: MouseEvent): void => {
    if (!this.interactive) return;
    event.preventDefault();
    const local = this.localPoint(event);
    const before = this.unproject(local.x, local.y);
    const nextZoom = clamp(this.zoom + 1, this.minZoom, this.maxZoom);
    if (nextZoom === this.zoom) return;
    this.zoom = nextZoom;
    const after = this.project(before.lat, before.lon);
    this.panByPixels(after.x - local.x, after.y - local.y);
    this.emit('zoom-end', this.viewInfo());
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.interactive) return;
    const step = 96;
    switch (event.key) {
      case '+':
      case '=':
        event.preventDefault();
        this.zoomIn();
        break;
      case '-':
      case '_':
        event.preventDefault();
        this.zoomOut();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.panBy(0, step);
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.panBy(0, -step);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.panBy(step, 0);
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.panBy(-step, 0);
        break;
      default:
        break;
    }
  };

  private panByPixels(dx: number, dy: number): void {
    const { z, scale } = this.scaleInfo();
    const centerX = lonToWorldX(this.center.lon, z, this.tileSize) - dx / scale;
    const centerY = latToWorldY(this.center.lat, z, this.tileSize) - dy / scale;
    this.center = {
      lat: clampLat(worldYToLat(centerY, z, this.tileSize)),
      lon: wrapLon(worldXToLon(centerX, z, this.tileSize)),
    };
    this.render();
  }

  private measure(): void {
    if (this.destroyed) return;
    const rect = this.root.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.render();
  }

  private cancelAnimation(): void {
    if (this.animationRaf != null) {
      cancelAnimationFrame(this.animationRaf);
      this.animationRaf = null;
    }
  }

  private emit<K extends keyof MapEventMap>(type: K, payload: MapEventMap[K]): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(payload);
      } catch (error) {
        console.error('[geomap] Error en listener', type, error);
      }
    }
  }
}
