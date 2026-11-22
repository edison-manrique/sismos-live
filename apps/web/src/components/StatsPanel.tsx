import { For, createMemo } from 'solid-js';
import {
  formatDepth,
  formatMagnitude,
  formatNumber,
  magnitudeColor,
  timeAgo,
} from '@sismos/seismic';
import { TIME_WINDOWS, useApp } from '../state';
import styles from '../styles/components/StatsPanel.module.css';

export default function StatsPanel() {
  const app = useApp();

  const windowLabel = createMemo(
    () => TIME_WINDOWS.find((item) => item.id === app.filters.range)?.label ?? '',
  );
  const regionLabel = () => (app.filters.region === 'peru' ? 'Perú' : 'Global');
  const maxBucket = createMemo(() =>
    Math.max(1, ...app.stats().byBucket.map((bucket) => bucket.count)),
  );
  const latest = createMemo(() => app.events()[0] ?? null);

  return (
    <section class={styles.panel} aria-label="Resumen de actividad">
      <div class={styles.head}>
        <h2 class={styles.title}>Actividad sísmica</h2>
        <span class={styles.scope}>
          {regionLabel()} · {windowLabel()}
        </span>
      </div>

      <div class={styles.hero}>
        <div class={styles.total}>
          <strong class={styles.totalValue}>{formatNumber(app.stats().total)}</strong>
          <span class={styles.totalLabel}>eventos</span>
        </div>

        <button
          type="button"
          class={styles.strongest}
          disabled={!app.stats().strongest}
          onClick={() => app.select(app.stats().strongest?.id ?? null)}
          title={
            app.stats().strongest
              ? `Ir a ${app.stats().strongest?.place}`
              : 'Sin eventos en el filtro actual'
          }
        >
          <span class={styles.strongestLabel}>Mayor magnitud</span>
          <span
            class={styles.strongestValue}
            style={{
              color: app.stats().total
                ? magnitudeColor(app.stats().maxMagnitude)
                : 'var(--text-mute)',
            }}
          >
            M {app.stats().total ? formatMagnitude(app.stats().maxMagnitude) : '—'}
          </span>
          <span class={styles.strongestPlace}>
            {app.stats().strongest?.place ?? 'Sin datos'}
          </span>
        </button>
      </div>

      <div class={styles.chart} aria-label="Distribución por magnitud">
        <For each={app.stats().byBucket}>
          {(bucket) => (
            <div
              class={styles.barColumn}
              title={`${bucket.count} eventos entre M${bucket.label}`}
            >
              <div class={styles.barTrack}>
                <div
                  class={styles.bar}
                  style={{
                    height: `${Math.max(bucket.count ? 8 : 2, (bucket.count / maxBucket()) * 100)}%`,
                    background: bucket.color,
                    opacity: bucket.count ? 1 : 0.18,
                  }}
                />
              </div>
              <span class={styles.barLabel}>{bucket.label}</span>
              <span class={styles.barCount}>{bucket.count || ''}</span>
            </div>
          )}
        </For>
      </div>

      <div class={styles.meta}>
        <span class={styles.metaItem}>
          <span class={styles.metaLabel}>Últ. 24 h</span>
          <strong>{formatNumber(app.stats().lastDay)}</strong>
        </span>
        <span class={styles.metaItem}>
          <span class={styles.metaLabel}>Prof. media</span>
          <strong>{formatDepth(app.stats().avgDepth)}</strong>
        </span>
        <span class={styles.metaItem}>
          <span class={styles.metaLabel}>EMSC / USGS</span>
          <strong>
            {app.stats().bySource.EMSC} <span class={styles.metaSep}>/</span>{' '}
            {app.stats().bySource.USGS}
          </strong>
        </span>
      </div>

      {latest() ? (
        <div class={styles.latest}>
          <span class={styles.latestText}>
            Último: <strong>{latest()?.place}</strong>
          </span>
          <span class={styles.latestTime}>
            {timeAgo(latest()?.timestamp ?? 0, app.now())}
          </span>
        </div>
      ) : null}
    </section>
  );
}
