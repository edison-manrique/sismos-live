import { Show, createSignal, onCleanup, onMount } from 'solid-js';
import { formatClock, formatNumber } from '@sismos/seismic';
import { TIME_WINDOWS, useApp } from '../state';
import StatsPanel from './StatsPanel';
import FiltersPanel from './FiltersPanel';
import EventList from './EventList';
import { IconChevron } from './Icons';
import styles from './Sidebar.module.css';

function SidebarFooter() {
  const app = useApp();
  return (
    <footer class={styles.footer}>
      <div class={styles.footerRow}>
        <span class={styles.footerSource}>
          <span class={styles.footerDot} data-source="USGS" />
          USGS REST
        </span>
        <span class={styles.footerSource}>
          <span class={styles.footerDot} data-source="EMSC" />
          EMSC WS
        </span>
        <span class={styles.footerMemory}>
          {formatNumber(app.snapshot().total)} en memoria
        </span>
      </div>
      <div class={styles.footerRow}>
        <span class={styles.footerNote}>
          Última sincronización{' '}
          {app.snapshot().lastSyncAt ? formatClock(app.snapshot().lastSyncAt!) : '—'}
        </span>
        <span class={styles.footerNote}>
          {app.filters.region === 'peru' ? 'Límites Perú' : 'Global'}
        </span>
      </div>
    </footer>
  );
}

export default function Sidebar() {
  const app = useApp();
  const media = window.matchMedia('(max-width: 820px)');
  const [filtersOpen, setFiltersOpen] = createSignal(!media.matches);

  onMount(() => {
    const onChange = (event: MediaQueryListEvent) => {
      if (!event.matches) setFiltersOpen(true);
    };
    media.addEventListener('change', onChange);
    onCleanup(() => media.removeEventListener('change', onChange));
  });

  const rangeLabel = () =>
    TIME_WINDOWS.find((item) => item.id === app.filters.range)?.label ?? '';
  const sourceLabel = () =>
    app.filters.source === 'all' ? 'Todas' : app.filters.source;

  return (
    <aside class={styles.sidebar} data-filters-open={filtersOpen() ? 'true' : 'false'}>
      <div class={styles.statsWrap}>
        <StatsPanel />
      </div>

      <div class={styles.filtersToggleRow}>
        <button
          type="button"
          class={styles.filtersToggle}
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen()}
          aria-controls="filters-panel"
        >
          <IconChevron
            size={13}
            class={`${styles.filtersChevron} ${filtersOpen() ? styles.filtersChevronOpen : ''}`}
          />
          <span class={styles.filtersLabel}>Filtros</span>
          <span class={styles.filtersSummary}>
            M{app.filters.minMagnitude.toFixed(1)}+ · {rangeLabel()} · {sourceLabel()}
          </span>
        </button>
        <button
          type="button"
          class={styles.filtersClear}
          onClick={() => app.resetFilters()}
        >
          Limpiar
        </button>
      </div>

      <Show when={filtersOpen()}>
        <div id="filters-panel" class={styles.filtersWrap}>
          <FiltersPanel />
        </div>
      </Show>

      <EventList />
      <SidebarFooter />
    </aside>
  );
}
