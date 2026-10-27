/** Entry point of index.html: the forecast for one place. */

import { noteText } from '../model/notes.ts';
import type { ModelParams } from '../model/params.ts';
import { ratingBands } from '../model/ratings.ts';
import { computeScores } from '../model/score.ts';
import { renderVersion } from '../app/build-info.ts';
import { MainChart, ratingColor } from '../app/chart.ts';
import { escapeHtml, formatDay, formatNumber, formatShort } from '../app/format.ts';
import { ParamsPanel } from '../app/params-panel.ts';
import { PlacePicker } from '../app/place-picker.ts';
import type { Place } from '../app/places.ts';
import { initialPlace, rememberPlace } from '../app/state.ts';
import { type Row, visibleRows } from '../app/timeline.ts';
import { FORECAST_DAYS, type Forecast, loadForecast, todayIso } from '../app/weather.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** Everything the current view is drawn from. */
const view: {
  place: Place;
  forecast: Forecast | null;
  rows: Array<Row> | null;
  params: ModelParams;
  request: AbortController | null;
} = { place: initialPlace(), forecast: null, rows: null, params: undefined!, request: null };

const chart = new MainChart($('chart'));

/* ------------------------------------------------------------------ render */

function renderMeta() {
  const { place, forecast } = view;
  const parts = [
    place.name,
    `${place.lat.toFixed(2)} °N, ${place.lon.toFixed(2)} °O`,
    ...(forecast?.elevation != null ? [`${Math.round(forecast.elevation)} m ü. M.`] : []),
  ];
  $('place-meta').textContent = parts.join(' · ');
  $('chart').setAttribute(
    'aria-label',
    `Temperatur, Niederschlag und Pilz-Index für ${place.name}`,
  );
}

function renderToday(rows: Array<Row>) {
  const today = rows.find((r) => r.isToday) ?? rows.at(-1)!;
  const ahead = rows.filter((r) => r.isForecast);
  const headline = today.notes[0]
    ? noteText(today.notes[0])
    : 'Feuchte, Timing und Temperatur passen zusammen — es lohnt sich, nachzuschauen.';

  $('today').innerHTML = `
    <div class="today-figure">${today.score}<span class="out-of">/100</span></div>
    <div class="today-body">
      <p class="today-date">${formatDay(today.date)} · ${escapeHtml(view.place.name)}</p>
      <h2><span class="dot" style="background:${ratingColor(today.rating.key)}"></span>${today.rating.label}</h2>
      <p>${headline}</p>
      <p class="custom-params-note">Berechnet mit angepassten Modellparametern (siehe unten).</p>
    </div>
    <div class="next-days">
      ${ahead
        .map(
          (d) => `
        <div class="next-day">
          <span class="label">${formatShort(d.date)}</span>
          <span class="value"><span class="dot" style="background:${ratingColor(d.rating.key)}"></span>${d.score}</span>
          <span class="rating">${d.rating.label}</span>
        </div>`,
        )
        .join('')}
    </div>`;
}

function renderScale() {
  $('scale').innerHTML = ratingBands()
    .map(
      (r) => `<span>
        <span class="dot" style="background:${ratingColor(r.key)}"></span>
        ${r.label} <span class="muted">${r.min}–${r.max}</span>
      </span>`,
    )
    .join('');
}

function renderTable(rows: Array<Row>) {
  const body = rows
    .map(
      (r) => `
      <tr class="${r.isForecast ? 'is-forecast' : ''}">
        <td>${formatShort(r.date)}${r.isToday ? ' (heute)' : ''}</td>
        <td>${formatNumber(r.tMin)}</td><td>${formatNumber(r.tMean)}</td><td>${formatNumber(r.tMax)}</td>
        <td>${formatNumber(r.precip)}</td><td>${r.soilIndex.toFixed(0)}</td>
        <td>${r.score}</td>
        <td><span class="rating-cell"><span class="dot" style="background:${ratingColor(r.rating.key)}"></span>${r.rating.label}</span></td>
      </tr>`,
    )
    .join('');
  $('table-wrap').innerHTML = `<table>
    <thead><tr>
      <th>Tag</th><th>Min °C</th><th>Mittel °C</th><th>Max °C</th>
      <th>Regen mm</th><th>Boden mm</th><th>Index</th><th>Bewertung</th>
    </tr></thead>
    <tbody>${body}</tbody></table>`;
}

/** Scores the cached forecast with the current parameters and draws it. */
function renderAll() {
  renderMeta();
  const { forecast } = view;
  if (!forecast) {
    return;
  }
  const scores = computeScores(forecast.days, {
    params: view.params,
    elevation: forecast.elevation,
  });
  view.rows = visibleRows(forecast.days, scores, todayIso(), FORECAST_DAYS);
  renderToday(view.rows);
  renderScale();
  chart.render(view.rows, view.params);
  renderTable(view.rows);
}

/* -------------------------------------------------------------------- data */

async function showPlace(place: Place) {
  view.request?.abort();
  const request = new AbortController();
  view.request = request;
  view.place = place;
  view.forecast = null;
  renderMeta();
  $('today').innerHTML =
    `<p class="today-loading">Wetterdaten für ${escapeHtml(place.name)} werden geladen…</p>`;

  try {
    view.forecast = await loadForecast(place, { signal: request.signal });
  } catch (error) {
    if (request.signal.aborted) {
      return; // a newer request took over
    }
    $('today').innerHTML = `<p class="today-error">Die Wetterdaten konnten nicht geladen werden
      (${escapeHtml(error instanceof Error ? error.message : String(error))}).
      Bitte die Verbindung prüfen und die Seite neu laden.</p>`;
    return;
  }
  renderAll();
  $('updated').textContent = `Aktualisiert ${new Date().toLocaleString('de-CH', {
    timeStyle: 'short',
    dateStyle: 'medium',
  })}.`;
}

/* -------------------------------------------------------------------- boot */

function wireTableToggle() {
  const button = $<HTMLButtonElement>('table-toggle');
  const wrap = $('table-wrap');
  button.addEventListener('click', () => {
    const open = wrap.hidden;
    wrap.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    button.textContent = open ? 'Tabelle ausblenden' : 'Zahlen als Tabelle anzeigen';
  });
}

const panel = new ParamsPanel($('params'), (params) => {
  view.params = params;
  renderAll();
});
view.params = panel.current;

new PlacePicker($('place-picker'), {
  initial: view.place,
  onSelect: (place) => {
    rememberPlace(place);
    void showPlace(place);
  },
});

wireTableToggle();
renderVersion($('page-version'));
// Re-render on a theme switch: the chart reads its colours from CSS.
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => renderAll());
void showPlace(view.place);
