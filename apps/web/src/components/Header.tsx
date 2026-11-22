import { Show } from 'solid-js';
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
import styles from '../styles/components/Header.module.css';

export default function Header() {
  const app = useApp();

  const maxMagnitude = () => (app.stats().total ? formatMagnitude(app.stats().maxMagnitude) : '—');

  return (
    <header class={styles.header}>
      <div class={styles.brand}>
        <div class={styles.logo}>
          <LogoMark size={22} />
        </div>
        <div class={styles.brandText}>
          <div class={styles.title}>
            SISMOS <span class={styles.titleAccent}>LIVE</span>
          </div>
          <div class={styles.subtitle}>EMSC · USGS · Monitoreo sísmico</div>
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

        <div class={styles.alertGroup} role="group" aria-label="Alertas">
          <button
            type="button"
            class={styles.groupIconBtn}
            classList={{ [styles.groupIconActive]: app.ui.sound }}
            onClick={() => app.toggleSound()}
            aria-pressed={app.ui.sound}
            title={app.ui.sound ? 'Silenciar alertas sonoras' : 'Activar alertas sonoras'}
            aria-label="Alertas sonoras"
          >
            <Show when={app.ui.sound} fallback={<IconSoundOff size={16} />}>
              <IconSound size={16} />
            </Show>
          </button>

          <button
            type="button"
            class={styles.groupIconBtn}
            classList={{ [styles.groupIconActive]: app.ui.notifications }}
            onClick={() => app.toggleNotifications()}
            aria-pressed={app.ui.notifications}
            title={app.ui.notifications ? 'Desactivar avisos' : 'Activar avisos'}
            aria-label="Avisos de nuevos sismos"
          >
            <Show when={app.ui.notifications} fallback={<IconBellOff size={16} />}>
              <IconBell size={16} />
            </Show>
          </button>
        </div>

        <button
          type="button"
          class={styles.iconBtn}
          onClick={() => app.refresh()}
          title="Volver a consultar USGS"
          aria-label="Actualizar datos"
        >
          <IconRefresh size={16} class={app.snapshot().loading ? styles.spinning : undefined} />
        </button>

        <div class={styles.divider} />

        <div class={styles.clock}>
          <span class={styles.clockValue}>{formatClock(app.clockNow())}</span>
          <span class={styles.clockLabel}>Hora local</span>
        </div>
      </div>
    </header>
  );
}
