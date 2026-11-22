import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import {
  formatCoords,
  formatDateTime,
  formatDepth,
  formatMagnitude,
  formatNumber,
  magnitudeColor,
  timeAgo,
} from '@sismos/seismic';
import { useApp } from '../state';
import { IconAlert, IconChevron, IconTsunami } from './Icons';
import styles from '../styles/components/EventList.module.css';

const PAGE_SIZE = 80;

export default function EventList() {
  const app = useApp();
  const [limit, setLimit] = createSignal(PAGE_SIZE);

  // Reinicia el paginado cuando cambia cualquier filtro.
  createEffect(() => {
    app.filters.minMagnitude;
    app.filters.range;
    app.filters.region;
    app.filters.source;
    app.filters.search;
    app.filters.sort;
    setLimit(PAGE_SIZE);
  });

  const visible = createMemo(() => app.events().slice(0, limit()));
  const remaining = createMemo(() => Math.max(0, app.events().length - limit()));

  return (
    <section class={styles.wrap} aria-label="Lista de sismos">
      <div class={styles.head}>
        <div class={styles.count}>
          <span class={styles.countValue}>{formatNumber(app.events().length)}</span>
          <span class={styles.countLabel}>eventos</span>
        </div>
        <div class={styles.sort} role="group" aria-label="Ordenar por">
          <button
            type="button"
            class={styles.sortBtn}
            classList={{ [styles.sortActive]: app.filters.sort === 'time' }}
            onClick={() => app.setFilters('sort', 'time')}
          >
            Recientes
          </button>
          <button
            type="button"
            class={styles.sortBtn}
            classList={{ [styles.sortActive]: app.filters.sort === 'magnitude' }}
            onClick={() => app.setFilters('sort', 'magnitude')}
          >
            Intensidad
          </button>
        </div>
      </div>

      <div class={styles.scroll}>
        <Show
          when={app.events().length > 0}
          fallback={
            <div class={styles.empty}>
              <div class={styles.emptyRings}>
                <span />
                <span />
                <span />
              </div>
              <strong class={styles.emptyTitle}>Sin sismos para mostrar</strong>
              <p class={styles.emptyText}>
                Ajusta la magnitud, la ventana temporal o la región para ampliar la búsqueda.
              </p>
              <button type="button" class={styles.emptyBtn} onClick={() => app.resetFilters()}>
                Restablecer filtros
              </button>
            </div>
          }
        >
          <For each={visible()}>
            {(event) => {
              const color = magnitudeColor(event.magnitude);
              const selected = () => app.selectedId() === event.id;
              const isNew = () => app.now() - event.timestamp < 10 * 60_000;

              return (
                <button
                  type="button"
                  class={styles.item}
                  classList={{ [styles.itemActive]: selected() }}
                  onClick={() => app.select(event.id)}
                  aria-current={selected() ? 'true' : undefined}
                  title={`${event.place} · ${formatCoords(event.lat, event.lon)} · ${formatDateTime(event.timestamp)}`}
                >
                  <span class={styles.mag} style={{ '--mag-color': color }}>
                    <span class={styles.magValue}>{formatMagnitude(event.magnitude)}</span>
                    <span class={styles.magUnit}>M</span>
                  </span>

                  <span class={styles.body}>
                    <span class={styles.place}>{event.place}</span>
                    <span class={styles.meta}>
                      <span class={styles.time}>{timeAgo(event.timestamp, app.now())}</span>
                      <span class={styles.sep}>·</span>
                      <span class={styles.depth}>{formatDepth(event.depth)}</span>
                      <span class={styles.sep}>·</span>
                      <span class={styles.source} data-source={event.source}>
                        {event.source}
                      </span>
                      <Show when={isNew()}>
                        <span class={styles.sep}>·</span>
                        <span class={styles.newLabel} title="Evento reciente">
                          Nuevo
                        </span>
                      </Show>
                      <Show when={event.tsunami}>
                        <span class={styles.flag} title="Aviso de tsunami">
                          <IconTsunami size={12} />
                        </span>
                      </Show>
                      <Show when={event.alert}>
                        <span
                          class={styles.flag}
                          data-alert={event.alert}
                          title={`Alerta ${event.alert}`}
                        >
                          <IconAlert size={12} />
                        </span>
                      </Show>
                    </span>
                  </span>

                  <IconChevron size={14} class={styles.chevron} />
                </button>
              );
            }}
          </For>

          <Show when={remaining() > 0}>
            <button
              type="button"
              class={styles.more}
              onClick={() => setLimit((current) => current + PAGE_SIZE)}
            >
              Mostrar {formatNumber(Math.min(remaining(), PAGE_SIZE))} más
              <span class={styles.moreTotal}>de {formatNumber(app.events().length)}</span>
            </button>
          </Show>
        </Show>
      </div>
    </section>
  );
}
