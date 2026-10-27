/**
 * `bun run observations` — checks the model against real finds.
 *
 * calibration/observations.json lists what foragers actually saw, e.g.
 *
 *   [{ "place": "Jaunpass", "lat": 46.592, "lon": 7.338, "date": "2025-09-12",
 *      "observed": "excellent", "note": "Steinpilze und Pfifferlinge" }]
 *
 * with `observed` one of poor / moderate / good / excellent. For each entry
 * this fetches the historical weather from the Open-Meteo archive, scores the
 * day with the current default parameters (or the overrides in an optional
 * JSON file given as argument) and prints model and observation side by side.
 */

import { DEFAULT_PARAMS, resolveParams } from '../src/model/params.ts';
import { RATINGS, type RatingKey, ratingByKey } from '../src/model/ratings.ts';
import { computeScores } from '../src/model/score.ts';
import { archiveUrl, parseForecast } from '../src/app/weather.ts';

interface Observation {
  place: string;
  lat: number;
  lon: number;
  date: string;
  observed: RatingKey;
  note?: string;
}

const root = new URL('..', import.meta.url).pathname;
const observations = (await Bun.file(
  `${root}calibration/observations.json`,
).json()) as Array<Observation>;
const params = process.argv[2]
  ? resolveParams(await Bun.file(process.argv[2]).json())
  : DEFAULT_PARAMS;

if (!observations.length) {
  console.log(
    'calibration/observations.json is empty. See the comment in scripts/observations.ts.',
  );
  process.exit(0);
}

const order = (key: RatingKey) => RATINGS.length - RATINGS.findIndex((r) => r.key === key);
let agree = 0;

for (const o of observations) {
  const res = await fetch(archiveUrl(o, o.date));
  if (!res.ok) {
    console.error(`${o.place} ${o.date}: archive answered ${res.status}`);
    continue;
  }
  const { days, elevation } = parseForecast(await res.json());
  const day = computeScores(days, { params, elevation }).at(-1)!;
  const diff = order(day.rating.key) - order(o.observed);
  agree += diff === 0 ? 1 : 0;
  const mark = diff === 0 ? '✓' : diff > 0 ? '↑ model too high' : '↓ model too low';
  console.log(
    `${o.date} ${o.place.padEnd(24)} model ${String(day.score).padStart(3)} ${day.rating.label.padEnd(13)}` +
      `observed ${ratingByKey(o.observed).label.padEnd(13)} ${mark}${o.note ? `  (${o.note})` : ''}`,
  );
}
console.log(`\n${agree}/${observations.length} in the same band.`);
