import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  untrack,
  useContext,
  type Accessor,
  type JSX,
} from 'solid-js';
import { createStore, type SetStoreFunction } from 'solid-js/store';
import {
  EarthquakeFeed,
  PERU_BOUNDS,
  PERU_SEISMIC_POLYGON,
  computeStats,
  formatDepth,
  formatMagnitude,
  matchesFilter,
  sortByMagnitudeDesc,
  sortByTimeDesc,
  type Bounds,
  type EarthquakeEvent,
  type EarthquakeSource,
  type FeedSnapshot,
  type FeedStats,
  type LatLng,
} from '@sismos/seismic';
import type { MapTheme } from '@sismos/geomap';

export const TIME_WINDOWS = [
  { id: '1h', label: '1 h', ms: 3_600_000 },
  { id: '24h', label: '24 h', ms: 86_400_000 },
  { id: '7d', label: '7 d', ms: 604_800_000 },
  { id: 'all', label: 'Todo', ms: null },
] as const;

export type TimeWindow = (typeof TIME_WINDOWS)[number]['id'];
export type RegionMode = 'peru' | 'world';
export type SourceMode = 'all' | EarthquakeSource;
export type SortMode = 'time' | 'magnitude';

export interface Filters {
  minMagnitude: number;
  range: TimeWindow;
  region: RegionMode;
  source: SourceMode;
  search: string;
  sort: SortMode;
}

export interface UiSettings {
  theme: MapTheme;
  sound: boolean;
  notifications: boolean;
}

export interface QuakeToast {
  id: string;
  event: EarthquakeEvent;
  createdAt: number;
}

export interface AppState {
  snapshot: Accessor<FeedSnapshot>;
  events: Accessor<EarthquakeEvent[]>;
  stats: Accessor<FeedStats>;
  selected: Accessor<EarthquakeEvent | null>;
  selectedId: Accessor<string | null>;
  filters: Filters;
  setFilters: SetStoreFunction<Filters>;
  resetFilters: () => void;
  ui: UiSettings;
  setUi: SetStoreFunction<UiSettings>;
  toggleSound: () => void;
  toggleNotifications: () => void;
  bounds: Accessor<Bounds | null>;
  polygon: Accessor<LatLng[] | null>;
  now: Accessor<number>;
  clockNow: Accessor<number>;
  isLive: Accessor<boolean>;
  toasts: Accessor<QuakeToast[]>;
  dismissToast: (id: string) => void;
  select: (id: string | null) => void;
  refresh: () => void;
}

const DEFAULT_FILTERS: Filters = {
  minMagnitude: 2.5,
  range: '7d',
  region: 'peru',
  source: 'all',
  search: '',
  sort: 'time',
};

const UI_STORAGE_KEY = 'sismos-live.ui.v2';
const LEGACY_UI_STORAGE_KEY = 'sismos-live.ui.v1';
const VALID_THEMES: MapTheme[] = ['voyager', 'light', 'satellite', 'dark'];

const feed = new EarthquakeFeed({
  usgs: { minMagnitude: 2.5, limit: 1500, orderBy: 'time' },
  usgsDays: 7,
  maxEvents: 4000,
  pollInterval: 90_000,
});

function loadUi(): UiSettings {
  const fallback: UiSettings = { theme: 'voyager', sound: true, notifications: true };
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UiSettings>;
      return {
        theme: parsed.theme && VALID_THEMES.includes(parsed.theme) ? parsed.theme : fallback.theme,
        sound: typeof parsed.sound === 'boolean' ? parsed.sound : fallback.sound,
        notifications:
          typeof parsed.notifications === 'boolean' ? parsed.notifications : fallback.notifications,
      };
    }

    const legacyRaw = localStorage.getItem(LEGACY_UI_STORAGE_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as Partial<UiSettings>;
      return {
        theme: legacy.theme && VALID_THEMES.includes(legacy.theme) ? legacy.theme : fallback.theme,
        sound: fallback.sound,
        notifications:
          typeof legacy.notifications === 'boolean' ? legacy.notifications : fallback.notifications,
      };
    }

    return fallback;
  } catch {
    return fallback;
  }
}

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audioContext ??= new Ctor();
  return audioContext;
}

function unlockAudio(): void {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }
  } catch {
    /* ignore */
  }
}

/** Alarma sonora sísmica: doble tono para sismos moderados y triple pulso urgente para M >= 4.5. */
async function playChime(magnitude = 4.0): Promise<void> {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    if (ctx.state !== 'running') return;

    const start = ctx.currentTime + 0.02;
    const isStrong = magnitude >= 4.5;
    const notes = isStrong ? [880, 1175, 880, 1175, 880] : [784, 1175];
    const step = isStrong ? 0.14 : 0.13;

    notes.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = start + index * step;
      oscillator.type = isStrong ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(isStrong ? 0.18 : 0.12, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.24);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.26);
    });
  } catch {
    /* El navegador puede bloquear el audio sin interacción previa. */
  }
}

function showBrowserNotification(event: EarthquakeEvent): void {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    new Notification(`Sismo M${formatMagnitude(event.magnitude)} · ${event.place}`, {
      body: `Profundidad ${formatDepth(event.depth)} · Fuente ${event.source}`,
      tag: event.id,
    });
  } catch {
    /* Entorno sin soporte de notificaciones */
  }
}

function createAppState(): AppState {
  const [snapshot, setSnapshot] = createSignal<FeedSnapshot>(feed.getSnapshot());
  const [filters, setFilters] = createStore<Filters>({ ...DEFAULT_FILTERS });
  const [ui, setUi] = createStore<UiSettings>(loadUi());
  const [selectedId, setSelectedId] = createSignal<string | null>(null);
  const [toasts, setToasts] = createSignal<QuakeToast[]>([]);
  const [now, setNow] = createSignal(Date.now());
  const [clockNow, setClockNow] = createSignal(Date.now());

  const toastTimers = new Map<string, number>();
  const knownIds = new Set<string>();
  const recentAlerted: Array<{ timestamp: number; lat: number; lon: number }> = [];
  let baselineReady = false;

  const bounds = createMemo<Bounds | null>(() =>
    filters.region === 'peru' ? PERU_BOUNDS : null,
  );

  const polygon = createMemo<LatLng[] | null>(() =>
    filters.region === 'peru' ? PERU_SEISMIC_POLYGON : null,
  );

  const windowStart = createMemo<number | null>(() => {
    const entry = TIME_WINDOWS.find((item) => item.id === filters.range);
    return entry?.ms == null ? null : now() - entry.ms;
  });

  const events = createMemo<EarthquakeEvent[]>(() => {
    const filtered = snapshot().events.filter((event) =>
      matchesFilter(event, {
        minMagnitude: filters.minMagnitude,
        since: windowStart(),
        polygon: polygon(),
        sources: filters.source === 'all' ? null : [filters.source],
        search: filters.search,
      }),
    );
    return filters.sort === 'magnitude'
      ? sortByMagnitudeDesc(filtered)
      : sortByTimeDesc(filtered);
  });

  const stats = createMemo<FeedStats>(() => computeStats(events(), now()));

  const selected = createMemo<EarthquakeEvent | null>(
    () => events().find((event) => event.id === selectedId()) ?? null,
  );

  const isLive = createMemo(() => snapshot().connection === 'open');

  const dismissToast = (id: string): void => {
    const timer = toastTimers.get(id);
    if (timer != null) {
      clearTimeout(timer);
      toastTimers.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const isDuplicateAlert = (event: EarthquakeEvent): boolean => {
    const cutoff = Date.now() - 10 * 60_000;
    while (recentAlerted.length > 0 && recentAlerted[0].timestamp < cutoff) {
      recentAlerted.shift();
    }
    const matched = recentAlerted.some(
      (prev) =>
        Math.abs(prev.timestamp - event.timestamp) < 120_000 &&
        Math.abs(prev.lat - event.lat) < 0.8 &&
        Math.abs(prev.lon - event.lon) < 0.8,
    );
    if (!matched) {
      recentAlerted.push({ timestamp: event.timestamp, lat: event.lat, lon: event.lon });
    }
    return matched;
  };

  const pushToast = (event: EarthquakeEvent): void => {
    if (ui.sound) {
      void playChime(event.magnitude);
    }
    if (!ui.notifications) return;

    const id = `${event.id}:${Date.now()}`;
    setToasts((current) => [{ id, event, createdAt: Date.now() }, ...current].slice(0, 3));
    toastTimers.set(
      id,
      window.setTimeout(() => dismissToast(id), 14_000),
    );
    showBrowserNotification(event);
  };

  // Detecta eventos nuevos después de completar la sincronización inicial para lanzar alarmas.
  createEffect(() => {
    const snap = snapshot();
    if (!baselineReady) {
      const initialSettled = snap.lastSyncAt != null || (!snap.loading && snap.error != null);
      if (initialSettled) {
        baselineReady = true;
        for (const event of snap.events) knownIds.add(event.id);
      }
      return;
    }

    const fresh: EarthquakeEvent[] = [];
    for (const event of snap.events) {
      if (knownIds.has(event.id)) continue;
      knownIds.add(event.id);
      fresh.push(event);
    }
    if (knownIds.size > 6000) {
      knownIds.clear();
      for (const event of snap.events) knownIds.add(event.id);
    }

    const activePolygon = untrack(() => polygon());
    const activeMinMag = untrack(() => filters.minMagnitude);
    const activeSources = untrack(() =>
      filters.source === 'all' ? null : [filters.source],
    );

    for (const event of fresh) {
      if (Date.now() - event.timestamp > 60 * 60_000) continue;
      if (
        !matchesFilter(event, {
          polygon: activePolygon,
          minMagnitude: activeMinMag,
          sources: activeSources,
        })
      ) {
        continue;
      }
      if (isDuplicateAlert(event)) continue;
      pushToast(event);
    }
  });

  createEffect(() => {
    const payload = JSON.stringify({
      theme: ui.theme,
      sound: ui.sound,
      notifications: ui.notifications,
    });
    try {
      localStorage.setItem(UI_STORAGE_KEY, payload);
    } catch {
      /* almacenamiento no disponible */
    }
  });

  onMount(() => {
    const unsubscribe = feed.subscribe(setSnapshot);
    feed.start();
    const ticker = window.setInterval(() => setNow(Date.now()), 30_000);
    const clockTicker = window.setInterval(() => setClockNow(Date.now()), 1_000);

    const onGesture = () => unlockAudio();
    window.addEventListener('pointerdown', onGesture, { passive: true });
    window.addEventListener('keydown', onGesture, { passive: true });

    onCleanup(() => {
      unsubscribe();
      feed.stop();
      clearInterval(ticker);
      clearInterval(clockTicker);
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      for (const timer of toastTimers.values()) clearTimeout(timer);
      toastTimers.clear();
    });
  });

  const toggleSound = (): void => {
    const next = !ui.sound;
    setUi('sound', next);
    if (next) {
      unlockAudio();
      void playChime(3.5);
    }
  };

  const toggleNotifications = (): void => {
    const next = !ui.notifications;
    setUi('notifications', next);
    if (next && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission().catch(() => undefined);
    }
  };

  return {
    snapshot,
    events,
    stats,
    selected,
    selectedId,
    filters,
    setFilters,
    resetFilters: () => setFilters({ ...DEFAULT_FILTERS }),
    ui,
    setUi,
    toggleSound,
    toggleNotifications,
    bounds,
    polygon,
    now,
    clockNow,
    isLive,
    toasts,
    dismissToast,
    select: (id) => setSelectedId(id),
    refresh: () => void feed.refresh(),
  };
}

const AppContext = createContext<AppState>();

export function AppProvider(props: { children: JSX.Element }) {
  const state = createAppState();
  return <AppContext.Provider value={state}>{props.children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp debe usarse dentro de <AppProvider>');
  return context;
}
