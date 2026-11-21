import { createMemo, Show } from 'solid-js';
import { formatClock, formatMagnitude, formatNumber, magnitudeColor } from '@sismos/seismic';
import { useApp } from '../state';
import {
  IconBell,
  IconBellOff,
  IconRefresh,
  IconSound,
  IconSoundOff,
  LogoMark,
} from './Icons';
import styles from './Header.module.css';

type Tone = 'live' | 'warn' | 'error' | 'idle';

export default function Header() {
  const app = useApp();

  const status = createMemo<{ label: string; tone: Tone; hint: string }>(() => {
    const snapshot = app.snapshot();
    switch (snapshot.connection) {
      case 'open':
        return { label: 'En vivo', tone: 'live', hint: 'WebSocket EMSC conectado' };
      case 'connecting':
        return { label: 'Conectando', tone: 'warn', hint: 'Abriendo WebSocket EMSC…' };
      case 'reconnecting':
        return {
          label: 'Reconectando',
          tone: 'warn',
          hint: `Intento ${snapshot.reconnectAttempt} · backoff exponencial`,
        };
      case 'error':
        return { label: 'Error', tone: 'error', hint: snapshot.error ?? 'Fallo de conexión' };
      case 'closed':
        return { label: 'Sin conexión', tone: 'error', hint: 'WebSocket cerrado' };
      default:
        return { label: 'Iniciando', tone: 'idle', hint: 'Preparando el monitor' };
    }
  });

  const maxMagnitude = () => (app.stats().total ? formatMagnitude(app.stats().maxMagnitude) : '—');

  return (
    <header class={styles.header}>
      <div class={styles.brand}>
        <div class={styles.logo}>
          <LogoMark size={26} />
        </div>
        <div class={styles.brandText}>
          <div class={styles.title}>
            SISMOS <span class={styles.liveTag}>LIVE</span>
          </div>
          <div class={styles.subtitle}>EMSC · USGS · tiempo real</div>
        </div>
      </div>

      <div class={styles.metrics} aria-label="Resumen sísmico">
        <div class={styles.metric}>
          <span class={styles.metricLabel}>Eventos</span>
          <strong class={styles.metricValue}>{formatNumber(app.stats().total)}</strong>
        </div>
        <div class={styles.metricDivider} />
        <div class={styles.metric}>
          <span class={styles.metricLabel}>Mayor</span>
          <strong
            class={styles.metricValue}
            style={{ color: app.stats().total ? magnitudeColor(app.stats().maxMagnitude) : undefined }}
          >
            M {maxMagnitude()}
          </strong>
        </div>
        <div class={styles.metricDivider} />
        <div class={styles.metric}>
          <span class={styles.metricLabel}>Última hora</span>
          <strong class={styles.metricValue}>{app.stats().lastHour}</strong>
        </div>
      </div>

      <div class={styles.actions}>
        <div class={styles.regionToggle} role="group" aria-label="Región">
          <button
            type="button"
            class={styles.regionBtn}
            classList={{ [styles.regionActive]: app.filters.region === 'peru' }}
            onClick={() => app.setFilters('region', 'peru')}
          >
            Perú
          </button>
          <button
            type="button"
            class={styles.regionBtn}
            classList={{ [styles.regionActive]: app.filters.region === 'world' }}
            onClick={() => app.setFilters('region', 'world')}
          >
            Global
          </button>
        </div>

        <div class={styles.divider} />

        <button
          type="button"
          class={styles.iconBtn}
          classList={{ [styles.iconActive]: app.ui.sound }}
          onClick={() => app.setUi('sound', !app.ui.sound)}
          aria-pressed={app.ui.sound}
          title={app.ui.sound ? 'Silenciar alertas sonoras' : 'Activar alertas sonoras'}
          aria-label="Alertas sonoras"
        >
          <Show when={app.ui.sound} fallback={<IconSoundOff size={17} />}>
            <IconSound size={17} />
          </Show>
        </button>

        <button
          type="button"
          class={styles.iconBtn}
          classList={{ [styles.iconActive]: app.ui.notifications }}
          onClick={() => app.setUi('notifications', !app.ui.notifications)}
          aria-pressed={app.ui.notifications}
          title={app.ui.notifications ? 'Desactivar avisos' : 'Activar avisos'}
          aria-label="Avisos de nuevos sismos"
        >
          <Show when={app.ui.notifications} fallback={<IconBellOff size={17} />}>
            <IconBell size={17} />
          </Show>
        </button>

        <button
          type="button"
          class={styles.iconBtn}
          onClick={() => app.refresh()}
          title="Volver a consultar USGS"
          aria-label="Actualizar datos"
        >
          <IconRefresh size={17} class={app.snapshot().loading ? styles.spinning : undefined} />
        </button>

        <div class={styles.clock}>
          <span class={styles.clockValue}>{formatClock(app.now())}</span>
          <span class={styles.clockLabel}>hora local</span>
        </div>

        <div class={styles.statusPill} data-tone={status().tone} title={status().hint}>
          <span class={styles.statusDot} />
          <span class={styles.statusLabel}>{status().label}</span>
        </div>
      </div>
    </header>
  );
}
