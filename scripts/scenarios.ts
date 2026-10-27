/**
 * `bun run scenarios` — prints how every reference scenario scores, with the
 * factor breakdown, so the model can be sanity-checked by eye.
 *
 * Pass a JSON file of parameter overrides to see what a tweak changes:
 *   bun run scenarios my-params.json
 */

import { evaluateAll } from '../src/model/evaluate.ts';
import { noteText } from '../src/model/notes.ts';
import { DEFAULT_PARAMS, resolveParams } from '../src/model/params.ts';

const overridesPath = process.argv[2];
const params = overridesPath ? resolveParams(await Bun.file(overridesPath).json()) : DEFAULT_PARAMS;
const baseline = overridesPath ? evaluateAll(DEFAULT_PARAMS) : null;

const pct = (v: number) => `${String(Math.round(v * 100)).padStart(3)}%`;
const bar = (score: number) => {
  const filled = Math.round(score / 5);
  return '█'.repeat(filled) + '·'.repeat(20 - filled);
};

const { results, comparisons } = evaluateAll(params);

console.log(
  `\n${'scenario'.padEnd(30)} score ${baseline ? ' (was)' : ''} ${'expected'.padEnd(9)} ${'bar'.padEnd(20)}  moist  sust flush  temp  gate   mod  seas  soil`,
);
console.log('─'.repeat(baseline ? 128 : 122));

for (const r of results) {
  const c = r.last.components;
  const was = baseline?.results.find((b) => b.scenario.key === r.scenario.key)?.last.score;
  const mark = r.meetsExpectation ? ' ' : r.scenario.open ? '?' : '✗';
  console.log(
    `${r.scenario.key.padEnd(30)} ${String(r.last.score).padStart(4)}${mark}` +
      `${baseline ? ` (${String(was).padStart(3)})` : ''} ` +
      `${`${r.range[0]}–${r.range[1]}`.padEnd(9)} ${bar(r.last.score)}  ` +
      `${[c.moisture, c.sustain, c.flush, c.temperature, c.tempGate, c.modifier, c.season].map(pct).join('  ')}  ` +
      `${r.last.soilIndex.toFixed(0).padStart(4)}`,
  );
  if (r.last.notes.length) {
    console.log(`    ${r.last.notes.map(noteText).join(' · ')}`);
  }
  if (r.scenario.open && !r.meetsExpectation) {
    console.log(`    ? offene Frage: ${r.scenario.open}`);
  }
}

console.log('\ncomparisons');
for (const c of comparisons) {
  console.log(
    `  ${c.holds ? '✓' : '✗'} ${c.comparison.better} (${c.better}) ≥ ${c.comparison.worse} (${c.worse}) + ${c.comparison.by}`,
  );
}

const failed = results.filter((r) => !r.meetsExpectation && !r.scenario.open);
const open = results.filter((r) => !r.meetsExpectation && r.scenario.open);
console.log(
  `\n${results.length - failed.length - open.length}/${results.length} scenarios as expected, ${open.length} open question(s), ${failed.length} failing; ` +
    `${comparisons.filter((c) => c.holds).length}/${comparisons.length} comparisons hold.\n`,
);
