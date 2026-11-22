import { For } from 'solid-js';
import { formatDepth, formatMagnitude, magnitudeColor, timeAgo } from '@sismos/seismic';
import { useApp } from '../state';
import { IconClose } from './Icons';
import styles from '../styles/components/Toasts.module.css';

export default function Toasts() {
  const app = useApp();

  return (
    <div class={styles.stack} aria-live="polite">
      <For each={app.toasts()}>
        {(toast) => (
          <div
            class={styles.toast}
            style={`--mag-color:${magnitudeColor(toast.event.magnitude)}`}
            role="status"
          >
            <span class={styles.badge}>
              <span class={styles.badgeValue}>{formatMagnitude(toast.event.magnitude)}</span>
              <span class={styles.badgeUnit}>M</span>
            </span>

            <button
              type="button"
              class={styles.body}
              onClick={() => {
                app.select(toast.event.id);
                app.dismissToast(toast.id);
              }}
            >
              <span class={styles.kicker}>Nuevo sismo</span>
              <strong class={styles.place}>{toast.event.place}</strong>
              <span class={styles.meta}>
                {timeAgo(toast.event.timestamp, app.now())} ·{' '}
                {formatDepth(toast.event.depth)} · {toast.event.source}
              </span>
            </button>

            <div class={styles.actions}>
              <button
                type="button"
                class={styles.view}
                onClick={() => {
                  app.select(toast.event.id);
                  app.dismissToast(toast.id);
                }}
              >
                Ver
              </button>
              <button
                type="button"
                class={styles.close}
                onClick={() => app.dismissToast(toast.id)}
                aria-label="Descartar aviso"
              >
                <IconClose size={12} />
              </button>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}
