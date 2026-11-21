import { EmscSocket } from './emsc.js';
import { fetchUsgsEvents, type UsgsQueryOptions } from './usgs.js';
import { computeStats, matchesFilter, sortByTimeDesc } from './utils.js';
import type {
  EarthquakeEvent,
  EmscAction,
  EventFilter,
  FeedSnapshot,
  FeedStats,
} from './types.js';

export interface FeedEventMeta {
  isNew: boolean;
  action?: EmscAction;
  receivedAt: number;
}

export interface FeedOptions {
  filter?: EventFilter;
  /** Configuración de la carga inicial USGS. `false` la desactiva. */
  usgs?: UsgsQueryOptions | false;
  /** Ventana de días para la consulta USGS por defecto (7). */
  usgsDays?: number;
  /** URL del WebSocket de EMSC; `null` o `false` desactiva el live. */
  emscUrl?: string | null | false;
  pingInterval?: number;
  /** Máximo de eventos en memoria (por defecto 3000). */
  maxEvents?: number;
  /**
   * Mientras el socket está caído se refresca USGS con este intervalo (ms).
   * `0` desactiva el polling. Por defecto 90000.
   */
  pollInterval?: number;
  fetchImpl?: typeof fetch;
  WebSocketImpl?: typeof WebSocket;
  onSnapshot?: (snapshot: FeedSnapshot) => void;
  onEvent?: (event: EarthquakeEvent, meta: FeedEventMeta) => void;
}

const DEFAULT_MAX_EVENTS = 3000;
const DEFAULT_POLL_INTERVAL = 90_000;
const DAY_MS = 86_400_000;

/**
 * Feed unificado: carga inicial desde USGS, streaming en vivo desde EMSC,
 * deduplicación/upsert por `id` y filtrado en memoria.
 *
 * ```ts
 * const feed = new EarthquakeFeed({ filter: { bounds: PERU_BOUNDS } });
 * feed.subscribe((snapshot) => console.log(snapshot.events));
 * feed.start();
 * ```
 */
export class EarthquakeFeed {
  private readonly options: FeedOptions;
  private readonly usgsOptions: UsgsQueryOptions | false;
  private readonly usgsDays: number;
  private readonly hasCustomStart: boolean;
  private readonly maxEvents: number;
  private readonly listeners = new Set<(snapshot: FeedSnapshot) => void>();

  private readonly events = new Map<string, EarthquakeEvent>();
  private filter: EventFilter;
  private socket: EmscSocket | null = null;
  private abort: AbortController | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  private started = false;
  private dirty = true;
  private emitScheduled = false;
  private loading = false;
  private error: string | null = null;
  private lastEventAt: number | null = null;
  private lastSyncAt: number | null = null;
  private reconnectAttempt = 0;
  private snapshot: FeedSnapshot;

  constructor(options: FeedOptions = {}) {
    this.options = options;
    this.usgsDays = options.usgsDays ?? 7;
    this.maxEvents = options.maxEvents ?? DEFAULT_MAX_EVENTS;
    this.usgsOptions = options.usgs === false ? false : { ...options.usgs };
    this.hasCustomStart = this.usgsOptions !== false && this.usgsOptions.startTime != null;
    this.filter = { ...options.filter };
    this.snapshot = this.buildSnapshot();
  }

  /** Suscribe a cada instantánea. Devuelve la función para desuscribirse. */
  subscribe(listener: (snapshot: FeedSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  /** Arranca la carga inicial y el streaming (idempotente). */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.connectSocket();
    this.startPolling();
    void this.loadInitial();
  }

  /** Detiene el streaming, el polling y las peticiones en curso. */
  stop(): void {
    this.started = false;
    this.abort?.abort();
    this.abort = null;
    this.loading = false;
    if (this.pollTimer != null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.socket?.close();
    this.socket = null;
    this.notify();
  }

  /** Libera también las suscripciones. */
  destroy(): void {
    this.stop();
    this.listeners.clear();
  }

  get isStarted(): boolean {
    return this.started;
  }

  /** Fuerza una nueva consulta REST a USGS. */
  async refresh(): Promise<void> {
    await this.loadInitial();
  }

  /** Actualiza parcialmente el filtro (se aplica en memoria, sin reconectar). */
  setFilter(partial: EventFilter): void {
    this.filter = { ...this.filter, ...partial };
    this.notify();
  }

  getFilter(): EventFilter {
    return { ...this.filter };
  }

  /** Instantánea actual (se recalcula solo si hubo cambios). */
  getSnapshot(): FeedSnapshot {
    if (this.dirty) {
      this.snapshot = this.buildSnapshot();
      this.dirty = false;
    }
    return this.snapshot;
  }

  /** Eventos en memoria, sin filtrar. */
  getAllEvents(): EarthquakeEvent[] {
    return [...this.events.values()];
  }

  private connectSocket(): void {
    if (this.socket) return;
    const { emscUrl } = this.options;
    if (emscUrl === false || emscUrl === null) return;

    this.socket = new EmscSocket({
      url: typeof emscUrl === 'string' ? emscUrl : undefined,
      pingInterval: this.options.pingInterval,
      WebSocketImpl: this.options.WebSocketImpl,
      onEvent: (event, action) => this.ingest(event, action),
      onStatus: (status, detail) => {
        if (status === 'open') this.error = null;
        this.reconnectAttempt = detail.attempt;
        this.notify();
      },
      onError: (error) => {
        this.error = `EMSC: ${error.message}`;
        this.notify();
      },
    });
    this.socket.connect();
  }

  private startPolling(): void {
    const interval = this.options.pollInterval ?? DEFAULT_POLL_INTERVAL;
    if (interval <= 0 || this.pollTimer != null) return;
    this.pollTimer = setInterval(() => {
      if (!this.started) return;
      if (this.socket?.status !== 'open') void this.refresh();
    }, interval);
  }

  private async loadInitial(): Promise<void> {
    if (this.usgsOptions === false) {
      this.loading = false;
      this.notify();
      return;
    }

    this.abort?.abort();
    const controller = new AbortController();
    this.abort = controller;
    this.loading = true;
    this.notify();

    const startTime = this.hasCustomStart
      ? this.usgsOptions.startTime
      : Date.now() - this.usgsDays * DAY_MS;

    try {
      const result = await fetchUsgsEvents({
        ...this.usgsOptions,
        startTime,
        signal: controller.signal,
        fetchImpl: this.options.fetchImpl,
      });
      if (controller.signal.aborted) return;

      for (const event of result.events) {
        const existing = this.events.get(event.id);
        if (!existing) {
          this.events.set(event.id, event);
        } else if (event.updatedAt > existing.updatedAt) {
          this.events.set(event.id, { ...existing, ...event });
        }
      }

      this.lastSyncAt = result.fetchedAt;
      this.error = null;
      this.prune();
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return;
      this.error = `USGS: ${(error as Error).message}`;
    } finally {
      if (this.abort === controller) {
        this.abort = null;
        this.loading = false;
        this.notify();
      }
    }
  }

  private ingest(event: EarthquakeEvent, action: EmscAction): void {
    const existing = this.events.get(event.id);
    const merged: EarthquakeEvent = existing
      ? {
          ...existing,
          ...event,
          // EMSC no envía alerta/tsunami: conserva lo que ya sabíamos.
          alert: event.alert ?? existing.alert,
          tsunami: event.tsunami || existing.tsunami,
          url: event.url ?? existing.url,
        }
      : event;

    this.events.set(event.id, merged);
    this.lastEventAt = Date.now();
    this.error = null;
    this.prune();
    this.notify();
    this.options.onEvent?.(merged, {
      isNew: !existing,
      action,
      receivedAt: this.lastEventAt,
    });
  }

  private prune(): void {
    if (this.events.size <= this.maxEvents) return;
    const ordered = [...this.events.values()].sort((a, b) => b.timestamp - a.timestamp);
    for (let index = this.maxEvents; index < ordered.length; index += 1) {
      this.events.delete(ordered[index].id);
    }
  }

  private notify(): void {
    this.dirty = true;
    if (this.emitScheduled) return;
    this.emitScheduled = true;
    queueMicrotask(() => {
      this.emitScheduled = false;
      if (!this.dirty) return;
      const snapshot = this.getSnapshot();
      this.options.onSnapshot?.(snapshot);
      for (const listener of this.listeners) listener(snapshot);
    });
  }

  private buildSnapshot(): FeedSnapshot {
    const all = [...this.events.values()];
    const filtered = sortByTimeDesc(all.filter((event) => matchesFilter(event, this.filter)));
    const stats: FeedStats = computeStats(filtered);

    return {
      events: filtered,
      total: all.length,
      filter: { ...this.filter },
      stats,
      connection: this.socket?.status ?? 'idle',
      lastEventAt: this.lastEventAt,
      lastSyncAt: this.lastSyncAt,
      loading: this.loading,
      reconnectAttempt: this.socket?.reconnectAttempt ?? this.reconnectAttempt,
      error: this.error,
    };
  }
}
