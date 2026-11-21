import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  useContext,
  type Accessor,
  type JSX,
} from 'solid-js';
import { createStore, type SetStoreFunction } from 'solid-js/store';
import {
  EarthquakeFeed,
  PERU_BOUNDS,
  computeStats,
  matchesFilter,
  sortByMagnitudeDesc,
  sortByTimeDesc,
  type Bounds,
  type EarthquakeEvent,
  type EarthquakeSource,
  type FeedSnapshot,
  type FeedStats,
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
  bounds: Accessor<Bounds | null>;
  now: Accessor<number>;
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

const UI_STORAGE_KEY = 'sismos-live.ui.v1';
const VALID_THEMES: MapTheme[] = ['voyager', 'light', 'satellite', 'dark'];

const feed = new EarthquakeFeed({
  usgs: { minMagnitude: 2.5, limit: 1500, orderBy: 'time' },
  usgsDays: 7,
  maxEvents: 4000,
  pollInterval: 90_000,
});

function loadUi(): UiSettings {
  const fallback: UiSettings = { theme: 'voyager', sound: false, notifications: true };
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<UiSettings>;
    return {
      theme: parsed.theme && VALID_THEMES.includes(parsed.theme) ? parsed.theme : fallback.theme,
      sound: typeof parsed.sound === 'boolean' ? parsed.sound : fallback.sound,
      notifications:
        typeof parsed.notifications === 'boolean' ? parsed.notifications : fallback.notifications,
    };
  } catch {
    return fallback;
  }
}

let audioContext: AudioContext | null = null;

/** Doble tono discreto para alertas sísmicas. */
function playChime(): void {
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === 'suspended') void audioContext.resume();
    const start = audioContext.currentTime;
    [784, 1175].forEach((frequency, index) => {
      const oscillator = audioContext!.createOscillator();
      const gain = audioContext!.createGain();
      const at = start + index * 0.13;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.11, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
      oscillator.connect(gain).connect(audioContext!.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.32);
    });
  } catch {
    /* El navegador puede bloquear el audio sin interacción previa. */
  }
}

function createAppState(): AppState {
  const [snapshot, setSnapshot] = createSignal<FeedSnapshot>(feed.getSnapshot());
  const [filters, setFilters] = createStore<Filters>({ ...DEFAULT_FILTERS });
  const [ui, setUi] = createStore<UiSettings>(loadUi());
  const [selectedId, setSelectedId] = createSignal<string | null>(null);
  const [toasts, setToasts] = createSignal<QuakeToast[]>([]);
  const [now, setNow] = createSignal(Date.now());

  const toastTimers = new Map<string, number>();
  const knownIds = new Set<string>();
  let baselineReady = false;

  const bounds = createMemo<Bounds | null>(() =>
    filters.region === 'peru' ? PERU_BOUNDS : null,
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
        bounds: bounds(),
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

  const pushToast = (event: EarthquakeEvent): void => {
    if (!ui.notifications) return;
    const id = `${event.id}:${Date.now()}`;
    setToasts((current) => [{ id, event, createdAt: Date.now() }, ...current].slice(0, 3));
    toastTimers.set(
      id,
      window.setTimeout(() => dismissToast(id), 14_000),
    );
    if (ui.sound && event.magnitude >= 5) playChime();
  };

  // Detecta eventos nuevos después de la carga inicial para lanzar avisos.
  createEffect(() => {
    const snap = snapshot();
    if (!baselineReady) {
      if (snap.lastSyncAt != null || snap.total > 0) {
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

    for (const event of fresh) {
      if (event.magnitude < 4.5) continue;
      if (Date.now() - event.timestamp > 15 * 60_000) continue;
      if (!matchesFilter(event, { bounds: bounds(), minMagnitude: 4.5 })) continue;
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
    onCleanup(() => {
      unsubscribe();
      feed.stop();
      clearInterval(ticker);
      for (const timer of toastTimers.values()) clearTimeout(timer);
      toastTimers.clear();
    });
  });

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
    bounds,
    now,
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
