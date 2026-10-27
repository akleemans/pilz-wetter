/** Entry point of scenarios.html: the reference scenarios, for review. */

import { evaluateAll, type ScenarioResult } from '../model/evaluate.ts';
import { noteText } from '../model/notes.ts';
import type { ModelParams } from '../model/params.ts';
import { RATINGS, ratingByKey, type RatingKey } from '../model/ratings.ts';
import { renderVersion } from '../app/build-info.ts';
import { ratingColor } from '../app/chart.ts';
import { getInstanceByDom } from '../app/echarts.ts';
import { escapeHtml, formatPercent } from '../app/format.ts';
import { renderMiniChart } from '../app/mini-chart.ts';
import { ParamsPanel } from '../app/params-panel.ts';
import { loadReview, type Review, reviewText, saveReview } from '../app/review.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const review: Review = loadReview();
let latest: ReturnType<typeof evaluateAll>;
let params: ModelParams;

const status = (r: ScenarioResult) =>
  r.meetsExpectation
    ? { key: 'ok', text: 'Wie erwartet' }
    : r.scenario.open
      ? { key: 'open', text: 'Offene Frage' }
      : { key: 'off', text: 'Weicht ab' };

const band = ([lo, hi]: readonly [RatingKey, RatingKey]) =>
  lo === hi ? ratingByKey(lo).label : `${ratingByKey(lo).label} bis ${ratingByKey(hi).label}`;

/** Static card markup; the dynamic parts are filled in by `update`. */
function card(r: ScenarioResult): string {
  const s = r.scenario;
  const answer = review.scenarios[s.key] ?? {};
  const options = RATINGS.slice()
    .reverse()
    .map(
      (x) =>
        `<option value="${x.key}"${answer.rating === x.key ? ' selected' : ''}>${x.label}</option>`,
    )
    .join('');
  return `
    <article class="card scenario" id="${s.key}" data-key="${s.key}">
      <header class="scenario-head">
        <div>
          <h3>${escapeHtml(s.title)}</h3>
          <p class="scenario-story">${escapeHtml(s.story)}${s.elevation ? ` (${s.elevation} m ü. M.)` : ''}</p>
        </div>
        <div class="scenario-score" data-score></div>
      </header>
      ${s.open ? `<p class="scenario-question"><strong>Frage:</strong> ${escapeHtml(s.open)}</p>` : ''}
      <div class="mini-chart" data-chart role="img" aria-label="Regen, Temperatur und Index der letzten sechs Wochen"></div>
      <p class="scenario-expect">
        <strong>Erwartet:</strong> ${band(s.expect)} (${r.range[0]}–${r.range[1]}). ${escapeHtml(s.why)}
      </p>
      <details class="scenario-details">
        <summary>Aufschlüsselung</summary>
        <div data-breakdown></div>
      </details>
      <div class="scenario-review">
        <label>
          <span>Ihre Einschätzung</span>
          <select data-rating>
            <option value="">—</option>
            ${options}
          </select>
        </label>
        <label class="grow">
          <span>Kommentar</span>
          <textarea data-comment rows="2" placeholder="Was erwarten Sie aus Erfahrung, und warum?">${escapeHtml(answer.comment ?? '')}</textarea>
        </label>
      </div>
      <p class="scenario-key">Szenario <code>${s.key}</code></p>
    </article>`;
}

const row = (label: string, value: string) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;

function breakdown(r: ScenarioResult): string {
  const c = r.last.components;
  return `<dl class="breakdown">
      ${row('Bodenfeuchte', formatPercent(c.moisture))}
      ${row('Anhaltende Feuchte', formatPercent(c.sustain))}
      ${row('Auslösender Regen', formatPercent(c.flush))}
      ${row('Temperatur', formatPercent(c.temperature))}
      ${row('Ereignisse (Frost, Hitze …)', formatPercent(c.modifier))}
      ${row('Saison', formatPercent(c.season))}
      ${row('Bodenwasserspeicher', `${r.last.soilIndex.toFixed(0)} mm`)}
    </dl>
    ${r.last.notes.length ? `<p class="muted">${r.last.notes.map(noteText).join(' · ')}</p>` : ''}`;
}

function update() {
  latest = evaluateAll(params);
  const { results, comparisons } = latest;

  for (const r of results) {
    const el = document.querySelector<HTMLElement>(`[data-key="${r.scenario.key}"]`)!;
    const st = status(r);
    el.dataset.status = st.key;
    el.querySelector('[data-score]')!.innerHTML = `
      <span class="score-figure">${r.last.score}</span>
      <span class="score-rating"><span class="dot" style="background:${ratingColor(r.last.rating.key)}"></span>${r.last.rating.label}</span>
      <span class="badge badge-${st.key}">${st.text}</span>`;
    el.querySelector('[data-breakdown]')!.innerHTML = breakdown(r);
    renderMiniChart(el.querySelector('[data-chart]')!, r.scenario.days, r.scores);
  }

  const ok = results.filter((r) => r.meetsExpectation).length;
  const open = results.filter((r) => !r.meetsExpectation && r.scenario.open).length;
  const off = results.length - ok - open;
  $('summary').innerHTML = `
    <span><strong>${ok}</strong> von ${results.length} wie erwartet</span>
    <span><strong>${open}</strong> offene ${open === 1 ? 'Frage' : 'Fragen'}</span>
    ${off ? `<span class="is-off"><strong>${off}</strong> weichen ab</span>` : ''}
    <span><strong>${comparisons.filter((c) => c.holds).length}</strong> von ${comparisons.length} Vergleichen stimmen</span>`;

  const title = (key: string) =>
    escapeHtml(results.find((r) => r.scenario.key === key)!.scenario.title);
  $('comparisons').innerHTML = comparisons
    .map(
      (c) => `<li class="${c.holds ? 'holds' : 'fails'}">
        <span class="mark" aria-label="${c.holds ? 'stimmt' : 'stimmt nicht'}">${c.holds ? '✓' : '✗'}</span>
        <span><a href="#${c.comparison.better}">${title(c.comparison.better)}</a> (${c.better})
        mindestens ${c.comparison.by} Punkte vor
        <a href="#${c.comparison.worse}">${title(c.comparison.worse)}</a> (${c.worse}).
        <span class="muted">${escapeHtml(c.comparison.why)}</span></span>
      </li>`,
    )
    .join('');
}

function wireReview() {
  const reviewer = $<HTMLInputElement>('reviewer');
  reviewer.value = review.reviewer ?? '';
  reviewer.addEventListener('input', () => {
    review.reviewer = reviewer.value;
    saveReview(review);
  });

  document.addEventListener('input', (e) => {
    const target = e.target as HTMLElement;
    const key = target.closest<HTMLElement>('[data-key]')?.dataset.key;
    if (!key) {
      return;
    }
    const entry = (review.scenarios[key] ??= {});
    if (target.matches('[data-rating]')) {
      const value = (target as HTMLSelectElement).value;
      if (value) {
        entry.rating = value as RatingKey;
      } else {
        delete entry.rating;
      }
    } else if (target.matches('[data-comment]')) {
      entry.comment = (target as HTMLTextAreaElement).value;
    }
    saveReview(review);
  });

  $('copy-review').addEventListener('click', async () => {
    const text = reviewText(review, latest.results, params);
    const out = $<HTMLTextAreaElement>('review-text');
    out.value = text;
    out.hidden = false;
    try {
      await navigator.clipboard.writeText(text);
      $('review-status').textContent =
        'In die Zwischenablage kopiert. Einfach in eine Mail einfügen.';
    } catch {
      out.select();
      $('review-status').textContent = 'Bitte den Text unten markieren und kopieren.';
    }
  });
}

/* -------------------------------------------------------------------- boot */

const panel = new ParamsPanel($('params'), (next) => {
  params = next;
  update();
});
params = panel.current;

// Open questions first: they are what the reviewers are asked about.
const initial = evaluateAll(params).results;
const isOpen = (r: ScenarioResult) => Boolean(r.scenario.open);
$('open-scenarios').innerHTML = initial.filter(isOpen).map(card).join('');
$('all-scenarios').innerHTML = initial
  .filter((r) => !isOpen(r))
  .map(card)
  .join('');
$('scenario-count').textContent = String(initial.length);

update();
wireReview();
renderVersion($('page-version'));
window.addEventListener('resize', () => {
  for (const el of document.querySelectorAll<HTMLElement>('[data-chart]')) {
    getInstanceByDom(el)?.resize();
  }
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => update());
