import { fromEmscMessage } from './normalize.js';
import type {
  ConnectionStatus,
  EarthquakeEvent,
  EmscAction,
  EmscMessage,
} from './types.js';

/** Endpoint WebSocket de EMSC SeismicPortal (eventos globales, sin filtros). */
export const EMSC_WS_URL = 'wss://www.seismicportal.eu/standing_order/websocket';

/** Keep-alive exigido por el servidor: `ping` cada 15 s. */
export const EMSC_PING_INTERVAL = 15_000;

export interface EmscStatusDetail {
  attempt: number;
  delay?: number;
  error?: Error;
}

export interface EmscSocketOptions {
  url?: string;
  /** Intervalo de keep-alive en ms (por defecto 15000). */
  pingInterval?: number;
  /** Tope del backoff exponencial en ms (por defecto 30000). */
  maxReconnectDelay?: number;
  /** Inyectable para tests/SSR. */
  WebSocketImpl?: typeof WebSocket;
  onEvent?: (event: EarthquakeEvent, action: EmscAction) => void;
  onStatus?: (status: ConnectionStatus, detail: EmscStatusDetail) => void;
  onError?: (error: Error) => void;
}

/**
 * Cliente resiliente para el WebSocket de EMSC:
 * keep-alive cada 15 s, reconexión con backoff exponencial + jitter y
 * normalización de cada mensaje a {@link EarthquakeEvent}.
 *
 * El filtrado geográfico/magnitud se hace en el cliente (ver `EarthquakeFeed`).
 */
export class EmscSocket {
  private readonly url: string;
  private readonly pingInterval: number;
  private readonly maxReconnectDelay: number;
  private readonly WebSocketImpl: typeof WebSocket;
  private readonly options: EmscSocketOptions;

  private socket: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyClosed = false;
  private attempts = 0;

  status: ConnectionStatus = 'idle';

  constructor(options: EmscSocketOptions = {}) {
    this.options = options;
    this.url = options.url ?? EMSC_WS_URL;
    this.pingInterval = options.pingInterval ?? EMSC_PING_INTERVAL;
    this.maxReconnectDelay = options.maxReconnectDelay ?? 30_000;
    this.WebSocketImpl = options.WebSocketImpl ?? WebSocket;
  }

  get isOpen(): boolean {
    return this.socket?.readyState === 1;
  }

  /** Número de intentos de reconexión consecutivos. */
  get reconnectAttempt(): number {
    return this.attempts;
  }

  connect(): void {
    this.manuallyClosed = false;
    if (this.socket && (this.socket.readyState === 0 || this.socket.readyState === 1)) return;

    this.clearReconnectTimer();
    this.setStatus(this.attempts > 0 ? 'reconnecting' : 'connecting');

    let socket: WebSocket;
    try {
      socket = new this.WebSocketImpl(this.url);
    } catch (error) {
      this.reportError(error as Error);
      this.scheduleReconnect();
      return;
    }

    this.socket = socket;

    socket.onopen = () => {
      this.attempts = 0;
      this.setStatus('open');
      this.startPing();
    };

    socket.onmessage = (event: MessageEvent) => {
      this.handleMessage(event);
    };

    socket.onerror = () => {
      // El evento `close` suele llegar después y dispara la reconexión.
      this.reportError(new Error('Error de conexión con EMSC'));
    };

    socket.onclose = (event: CloseEvent) => {
      this.stopPing();
      this.socket = null;
      if (this.manuallyClosed) {
        this.setStatus('closed');
        return;
      }
      this.reportError(
        new Error(`WebSocket cerrado${event.code ? ` (código ${event.code})` : ''}`),
      );
      this.scheduleReconnect();
    };
  }

  /** Cierra el socket y cancela cualquier reconexión pendiente. */
  close(): void {
    this.manuallyClosed = true;
    this.stopPing();
    this.clearReconnectTimer();
    const socket = this.socket;
    this.socket = null;
    if (socket && (socket.readyState === 0 || socket.readyState === 1)) {
      socket.close(1000, 'cliente cerrado');
    }
    this.setStatus('closed');
  }

  private handleMessage(event: MessageEvent): void {
    if (typeof event.data !== 'string') return;
    const text = event.data.trim();
    if (!text || text === 'ping' || text === 'pong') return;

    let message: EmscMessage;
    try {
      message = JSON.parse(text) as EmscMessage;
    } catch {
      return; // mensajes de control no JSON
    }

    if (!message || typeof message !== 'object' || !message.data) return;
    const action: EmscAction = message.action === 'update' ? 'update' : 'create';
    const normalized = fromEmscMessage(message);
    if (normalized) this.options.onEvent?.(normalized, action);
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (!this.isOpen) return;
      try {
        this.socket?.send('ping');
      } catch {
        // Si falla, `close` disparará la reconexión.
      }
    }, this.pingInterval);
  }

  private stopPing(): void {
    if (this.pingTimer != null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.manuallyClosed) return;
    this.clearReconnectTimer();

    const base = Math.min(1000 * 2 ** this.attempts, this.maxReconnectDelay);
    const delay = Math.round(base * (0.75 + Math.random() * 0.5));
    this.attempts += 1;
    this.setStatus('reconnecting', { attempt: this.attempts, delay });
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setStatus(status: ConnectionStatus, detail: Partial<EmscStatusDetail> = {}): void {
    this.status = status;
    this.options.onStatus?.(status, { attempt: this.attempts, ...detail });
  }

  private reportError(error: Error): void {
    this.options.onError?.(error);
  }
}
