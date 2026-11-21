import { For, Show, createEffect, createMemo, createSignal, on, onCleanup, onMount } from 'solid-js';
import {
  PERU_BOUNDS,
  PERU_POLYGON,
  WORLD_BOUNDS,
  formatCoords,
  formatDateTime,
  formatDepth,
  formatMagnitude,
  magnitudeColor,
  magnitudeRadius,
  timeAgo,
} from '@sismos/seismic';
import {
  MAP_THEMES,
  THEME_META,
  TileMap,
  clamp,
  type MapMarker,
  type MapTheme,
  type ViewInfo,
} from '@sismos/geomap';
import { useApp } from '../state';
import {
  IconAlert,
  IconClose,
  IconCrosshair,
  IconExternal,
  IconLayers,
  IconMinus,
  IconPlus,
  IconTsunami,
  IconWave,
} from './Icons';
import styles from './MapPanel.module.css';

const REGION_LABEL = { peru: 'Perú', world: 'Global' } as const;

export default function MapPanel() {
  const app = useApp();
  let host!: HTMLDivElement;

  const [map, setMap] = createSignal<TileMap | null>(null);
  const [view, setView] = createSignal<ViewInfo | null>(null);
  const [themesOpen, setThemesOpen] = createSignal(false);

  const markers = createMemo<MapMarker[]>(() =>
    app.events().map((event) => ({
      id: event.id,
      lat: event.lat,
      lon: event.lon,
      magnitude: event.magnitude,
      color: magnitudeColor(event.magnitude),
      size: Math.max(19, magnitudeRadius(event.magnitude, 13, 2.5)),
      label: formatMagnitude(event.magnitude),
      pulse: event.magnitude >= 4.5 && app.now() - event.timestamp < 20 * 60_000,
      title: `M${formatMagnitude(event.magnitude)} · ${event.place}`,
      data: event.id,
    })),
  );

  const latest = createMemo(() => app.events()[0] ?? null);

  const popup = createMemo(() => {
    const event = app.selected();
    const info = view();
    const instance = map();
    if (!event || !info || !instance) return null;
    const point = instance.project(event.lat, event.lon);
    const width = 344;
    const half = width / 2 + 14;
    return {
      event,
      x: clamp(point.x, half, Math.max(half, info.width - half)),
      y: clamp(point.y, 12, Math.max(12, info.height - 12)),
      below: point.y < 360,
    };
  });

  const regionBounds = () => (app.filters.region === 'peru' ? PERU_BOUNDS : WORLD_BOUNDS);

  onMount(() => {
    const instance = new TileMap(host, {
      theme: app.ui.theme,
      center: { lat: -9.19, lon: -75.02 },
      zoom: 5,
      minZoom: 2,
      maxZoom: 17,
      selectionPolygon: app.filters.region === 'peru' ? PERU_POLYGON : null,
    });

    instance.on('move', (info) => setView(info));
    instance.on('zoom-end', (info) => setView(info));
    instance.on('marker-click', ({ marker }) => app.select(marker.id));
    instance.on('click', () => app.select(null));
    instance.fitBounds(PERU_BOUNDS, 48, false);
    setMap(instance);

    onCleanup(() => {
      instance.destroy();
      setMap(null);
    });
  });

  createEffect(() => {
    const instance = map();
    if (instance) instance.setTheme(app.ui.theme);
  });

  createEffect(() => {
    const instance = map();
    if (instance) instance.setMarkers(markers());
  });

  createEffect(() => {
    const instance = map();
    if (instance) instance.setSelected(app.selectedId());
  });

  // Al cambiar de región, encuadra y ajusta el límite geográfico resaltado.
  createEffect(
    on(
      () => app.filters.region,
      (region) => {
        const instance = map();
        if (!instance) return;
        instance.setSelectionPolygon(region === 'peru' ? PERU_POLYGON : null);
        instance.fitBounds(region === 'peru' ? PERU_BOUNDS : WORLD_BOUNDS, region === 'peru' ? 48 : 22, true);
      },
      { defer: true },
    ),
  );

  // Al seleccionar un evento, vuela hacia él.
  createEffect(
    on(
      () => app.selectedId(),
      (id) => {
        const instance = map();
        if (!instance || !id) return;
        const event = app.events().find((item) => item.id === id);
        if (!event) return;
        instance.flyTo(
          { lat: event.lat, lon: event.lon },
          Math.max(instance.getView().zoom, 6),
          850,
        );
      },
      { defer: true },
    ),
  );

  const zoomTo = (event: { lat: number; lon: number }) => {
    map()?.flyTo(event, Math.max(map()?.getView().zoom ?? 6, 9), 700);
  };

  return (
    <section class={styles.panel} aria-label="Mapa sísmico">
      <div class={styles.mapHost} ref={host} />

      <div class={styles.topLeft}>
        <div class={styles.regionBadge}>
          <IconWave size={13} />
          <strong>{REGION_LABEL[app.filters.region]}</strong>
          <span class={styles.regionCount}>{app.events().length}</span>
        </div>

        <Show when={latest()}>
          {(event) => (
            <button
              type="button"
              class={styles.latestChip}
              onClick={() => app.select(event().id)}
              title={`Ir a ${event().place}`}
            >
              <span
                class={styles.latestMag}
                style={{ color: magnitudeColor(event().magnitude) }}
              >
                M {formatMagnitude(event().magnitude)}
              </span>
              <span class={styles.latestPlace}>{event().place}</span>
              <span class={styles.latestTime}>{timeAgo(event().timestamp, app.now())}</span>
            </button>
          )}
        </Show>

        <Show when={view()}>
          {(info) => (
            <span class={styles.viewMeta}>
              z{info().zoom.toFixed(1)} · {formatCoords(info().center.lat, info().center.lon)}
            </span>
          )}
        </Show>
      </div>

      <div class={styles.controls}>
        <button
          type="button"
          class={styles.controlBtn}
          classList={{ [styles.controlActive]: themesOpen() }}
          onClick={() => setThemesOpen((open) => !open)}
          title="Capas del mapa"
          aria-label="Cambiar capa del mapa"
          aria-expanded={themesOpen()}
        >
          <IconLayers size={16} />
        </button>

        <Show when={themesOpen()}>
          <div class={styles.themePanel}>
            <For each={MAP_THEMES}>
              {(theme: MapTheme) => (
                <button
                  type="button"
                  class={styles.themeOption}
                  classList={{ [styles.themeActive]: app.ui.theme === theme }}
                  onClick={() => {
                    app.setUi('theme', theme);
                    setThemesOpen(false);
                  }}
                >
                  <span class={styles.swatch} data-theme={theme} />
                  <span>{THEME_META[theme].label}</span>
                  <Show when={app.ui.theme === theme}>
                    <span class={styles.themeCheck} />
                  </Show>
                </button>
              )}
            </For>
          </div>
        </Show>

        <div class={styles.zoomGroup}>
          <button
            type="button"
            class={styles.controlBtn}
            onClick={() => map()?.zoomIn()}
            title="Acercar"
            aria-label="Acercar"
          >
            <IconPlus size={16} />
          </button>
          <button
            type="button"
            class={styles.controlBtn}
            onClick={() => map()?.zoomOut()}
            title="Alejar"
            aria-label="Alejar"
          >
            <IconMinus size={16} />
          </button>
        </div>

        <button
          type="button"
          class={styles.controlBtn}
          onClick={() =>
            map()?.fitBounds(regionBounds(), app.filters.region === 'peru' ? 48 : 22, true)
          }
          title="Recentrar en la región"
          aria-label="Recentrar en la región"
        >
          <IconCrosshair size={16} />
        </button>
      </div>

      <div class={styles.legend} aria-label="Escala de magnitudes">
        <span class={styles.legendTitle}>Magnitud</span>
        <div class={styles.legendItems}>
          <For each={[2, 3, 4, 5, 6, 7]}>
            {(magnitude) => (
              <span class={styles.legendItem}>
                <i
                  style={{
                    background: magnitudeColor(magnitude),
                    width: `${5 + magnitude * 1.4}px`,
                    height: `${5 + magnitude * 1.4}px`,
                  }}
                />
                {magnitude}
              </span>
            )}
          </For>
        </div>
      </div>

      <Show when={app.snapshot().loading && !app.snapshot().lastSyncAt}>
        <div class={styles.loading}>
          <span class={styles.spinner} />
          Sincronizando USGS…
        </div>
      </Show>

      <Show when={app.snapshot().error && !app.isLive()}>
        <div class={styles.banner}>
          <IconAlert size={14} />
          <span class={styles.bannerText}>{app.snapshot().error}</span>
          <button type="button" class={styles.bannerBtn} onClick={() => app.refresh()}>
            Reintentar
          </button>
        </div>
      </Show>

      <Show when={popup()}>
        {(data) => {
          const event = () => data().event;
          const depthClass = () => {
            const d = event().depth;
            if (!Number.isFinite(d)) return null;
            if (d < 70) return 'Superficial';
            if (d <= 300) return 'Intermedio';
            return 'Profundo';
          };
          const statusLabel = () => {
            const s = event().status?.toLowerCase();
            if (!s) return null;
            if (s === 'reviewed') return 'Revisado';
            if (s === 'automatic') return 'Automático';
            if (s === 'confirmado') return 'Confirmado';
            return event().status;
          };
          const alertLabel = () => {
            switch (event().alert) {
              case 'green':
                return 'Verde';
              case 'yellow':
                return 'Amarilla';
              case 'orange':
                return 'Naranja';
              case 'red':
                return 'Roja';
              default:
                return 'Sin alerta';
            }
          };
          const hasTelemetry = () =>
            event().felt != null ||
            event().mmi != null ||
            event().cdi != null ||
            event().stations != null ||
            event().gap != null ||
            event().rms != null ||
            event().nearestStationKm != null ||
            event().significance != null;

          return (
            <article
              class={styles.popup}
              classList={{ [styles.popupBelow]: data().below }}
              style={{ left: `${data().x}px`, top: `${data().y}px` }}
            >
              <button
                type="button"
                class={styles.popupClose}
                onClick={() => app.select(null)}
                aria-label="Cerrar detalle"
              >
                <IconClose size={13} />
              </button>

              <header class={styles.popupHead}>
                <span
                  class={styles.popupMag}
                  style={`--mag-color:${magnitudeColor(event().magnitude)}`}
                >
                  {formatMagnitude(event().magnitude)}
                  <small>{event().magType ? event().magType!.toUpperCase() : 'M'}</small>
                </span>
                <div class={styles.popupTitle}>
                  <strong class={styles.popupPlace}>{event().place}</strong>
                  <span class={styles.popupWhen}>
                    {timeAgo(event().timestamp, app.now())} ·{' '}
                    {formatDateTime(event().timestamp)}
                  </span>
                  <div class={styles.popupBadges}>
                    <span class={styles.popupBadge} data-source={event().source}>
                      {event().source}
                      {event().agency ? ` · ${event().agency}` : ''}
                    </span>
                    <Show when={statusLabel()}>
                      <span class={styles.popupBadge}>{statusLabel()}</span>
                    </Show>
                    <Show when={event().sourceCatalog}>
                      <span class={styles.popupBadge}>{event().sourceCatalog}</span>
                    </Show>
                  </div>
                </div>
              </header>

              <div class={styles.popupGrid}>
                <div>
                  <span>Profundidad</span>
                  <strong>
                    {formatDepth(event().depth)}
                    {depthClass() ? ` · ${depthClass()}` : ''}
                  </strong>
                </div>
                <div>
                  <span>Coordenadas</span>
                  <strong>{formatCoords(event().lat, event().lon)}</strong>
                </div>
                <div>
                  <span>Alerta PAGER</span>
                  <strong class={styles.popupAlert} data-alert={event().alert ?? undefined}>
                    {alertLabel()}
                  </strong>
                </div>
                <div>
                  <span>Actualizado</span>
                  <strong>{timeAgo(event().updatedAt, app.now())}</strong>
                </div>
              </div>

              <Show when={hasTelemetry()}>
                <div class={styles.popupTelemetry}>
                  <Show when={event().mmi != null || event().cdi != null}>
                    <div>
                      <span>Intensidad</span>
                      <strong>
                        {event().mmi != null ? `MMI ${event().mmi!.toFixed(1)}` : ''}
                        {event().mmi != null && event().cdi != null ? ' · ' : ''}
                        {event().cdi != null ? `CDI ${event().cdi!.toFixed(1)}` : ''}
                      </strong>
                    </div>
                  </Show>
                  <Show when={event().felt != null}>
                    <div>
                      <span>Reportes ("Lo sentí")</span>
                      <strong>{event().felt} personas</strong>
                    </div>
                  </Show>
                  <Show when={event().stations != null || event().gap != null}>
                    <div>
                      <span>Red / Brecha</span>
                      <strong>
                        {event().stations != null ? `${event().stations} est.` : '—'}
                        {event().gap != null ? ` · ${Math.round(event().gap!)}°` : ''}
                      </strong>
                    </div>
                  </Show>
                  <Show when={event().rms != null || event().nearestStationKm != null}>
                    <div>
                      <span>RMS / Est. cercana</span>
                      <strong>
                        {event().rms != null ? `${event().rms!.toFixed(2)} s` : '—'}
                        {event().nearestStationKm != null
                          ? ` · ${event().nearestStationKm} km`
                          : ''}
                      </strong>
                    </div>
                  </Show>
                  <Show when={event().significance != null}>
                    <div>
                      <span>Relevancia</span>
                      <strong>{event().significance} pts</strong>
                    </div>
                  </Show>
                </div>
              </Show>

              <Show when={event().tsunami}>
                <div class={styles.tsunami}>
                  <IconTsunami size={12} /> Aviso de tsunami asociado
                </div>
              </Show>

              <footer class={styles.popupActions}>
                <button
                  type="button"
                  class={styles.popupPrimary}
                  onClick={() => zoomTo({ lat: event().lat, lon: event().lon })}
                >
                  Acercar
                </button>
                <Show when={event().url}>
                  <a
                    class={styles.popupLink}
                    href={event().url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver ficha <IconExternal size={12} />
                  </a>
                </Show>
              </footer>
            </article>
          );
        }}
      </Show>
    </section>
  );
}
