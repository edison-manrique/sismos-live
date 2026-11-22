import { For, Show, createMemo } from 'solid-js';
import { useApp, TIME_WINDOWS, type SourceMode } from '../state';
import { IconClose, IconSearch } from './Icons';
import styles from '../styles/components/FiltersPanel.module.css';

const SOURCES: Array<{ id: SourceMode; label: string; tone: string }> = [
  { id: 'all', label: 'Todas', tone: 'var(--text-dim)' },
  { id: 'EMSC', label: 'EMSC', tone: 'var(--accent)' },
  { id: 'USGS', label: 'USGS', tone: 'var(--cyan)' },
];

const MAG_TICKS = [0, 2.5, 5, 7.5] as const;

export default function FiltersPanel() {
  const app = useApp();

  const fill = createMemo(() => `${(app.filters.minMagnitude / 7.5) * 100}%`);
  const dirty = createMemo(
    () =>
      app.filters.minMagnitude !== 2.5 ||
      app.filters.range !== '7d' ||
      app.filters.source !== 'all' ||
      app.filters.search !== '' ||
      app.filters.region !== 'peru',
  );

  return (
    <section class={styles.panel} aria-label="Filtros">
      <div class={styles.head}>
        <h2 class={styles.title}>Filtros</h2>
        <button
          type="button"
          class={styles.clear}
          disabled={!dirty()}
          onClick={() => app.resetFilters()}
        >
          Limpiar
        </button>
      </div>

      <div class={styles.searchWrap}>
        <IconSearch size={15} class={styles.searchIcon} />
        <input
          class={styles.search}
          type="search"
          placeholder="Buscar lugar o región…"
          value={app.filters.search}
          onInput={(event) => app.setFilters('search', event.currentTarget.value)}
          aria-label="Buscar eventos por lugar"
        />
        <Show when={app.filters.search}>
          <button
            type="button"
            class={styles.clearSearch}
            onClick={() => app.setFilters('search', '')}
            aria-label="Limpiar búsqueda"
          >
            <IconClose size={13} />
          </button>
        </Show>
      </div>

      <div class={styles.sliderBlock}>
        <div class={styles.sliderHead}>
          <label class={styles.label} for="magnitude-range">
            Magnitud mínima
          </label>
          <span class={styles.sliderValue}>M {app.filters.minMagnitude.toFixed(1)}+</span>
        </div>
        <div class={styles.rangeTrackWrap}>
          <input
            id="magnitude-range"
            class={styles.range}
            type="range"
            min="0"
            max="7.5"
            step="0.1"
            value={app.filters.minMagnitude}
            style={`--fill:${fill()}`}
            onInput={(event) =>
              app.setFilters('minMagnitude', Number(event.currentTarget.value))
            }
          />
        </div>
        <div class={styles.rangeScale} aria-label="Atajos de magnitud mínima">
          <For each={MAG_TICKS}>
            {(tick) => (
              <button
                type="button"
                class={styles.scaleTick}
                classList={{
                  [styles.scaleTickActive]: Math.abs(app.filters.minMagnitude - tick) < 0.05,
                }}
                onClick={() => app.setFilters('minMagnitude', tick)}
                title={`Filtrar desde M ${tick.toFixed(1)}`}
              >
                M {tick === 0 || tick === 5 ? tick : tick.toFixed(1)}
              </button>
            )}
          </For>
        </div>
      </div>

      <div class={styles.group}>
        <span class={styles.label}>Ventana temporal</span>
        <div
          class={`${styles.segmented} ${styles.segmented4}`}
          role="group"
          aria-label="Ventana temporal"
        >
          <For each={TIME_WINDOWS}>
            {(window) => (
              <button
                type="button"
                class={styles.segmentBtn}
                classList={{ [styles.segmentActive]: app.filters.range === window.id }}
                onClick={() => app.setFilters('range', window.id)}
              >
                {window.label}
              </button>
            )}
          </For>
        </div>
      </div>

      <div class={styles.group}>
        <span class={styles.label}>Fuente de datos</span>
        <div
          class={`${styles.segmented} ${styles.segmented3}`}
          role="group"
          aria-label="Fuente de datos"
        >
          <For each={SOURCES}>
            {(source) => (
              <button
                type="button"
                class={styles.segmentBtn}
                classList={{ [styles.segmentActive]: app.filters.source === source.id }}
                onClick={() => app.setFilters('source', source.id)}
              >
                <span class={styles.sourceDot} style={{ background: source.tone }} />
                {source.label}
              </button>
            )}
          </For>
        </div>
      </div>
    </section>
  );
}
