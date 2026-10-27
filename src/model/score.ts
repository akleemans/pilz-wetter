/**
 * The mushroom foraging score ("Pilz-Index") for a daily weather series.
 *
 * A small water-balance + phenology model, see MODEL.md for the reasoning and
 * the sources. In short, for every day:
 *
 *   1. rain infiltrates through a saturating curve (snow waits for the thaw),
 *   2. a capped soil store keeps a temperature-dependent share of it,
 *   3. three water factors (moisture today, sustained wetness, a trigger rain
 *      3–10 days ago) combine as a weighted geometric mean,
 *   4. temperature gates the result, weather events modify it, and the season
 *      (shifted for elevation) scales it.
 *
 * Everything is pure: the browser, the tests and the scenario report run the
 * identical code with whatever parameters they pass in.
 */

import { clamp, seasonFactor } from './curves.ts';
import {
  flushFactor,
  flushRain,
  moistureFactor,
  saturationLevel,
  sustainFactor,
  temperatureFactor,
  temperatureGate,
  waterScore,
} from './factors.ts';
import {
  diurnalModifier,
  frostAftermathModifier,
  frostModifier,
  heatModifier,
  type Modifier,
  rainTodayModifier,
  waterloggingModifier,
} from './modifiers.ts';
import type { NoteCode } from './notes.ts';
import { DEFAULT_PARAMS, type ModelParams } from './params.ts';
import { type Rating, ratingFor } from './ratings.ts';
import type { DayWeather, ScoreComponents } from './types.ts';
import { waterBalance } from './water-balance.ts';

export interface ScoreOptions {
  readonly params?: ModelParams;
  /** Elevation of the place (m a.s.l.), for the season shift. */
  readonly elevation?: number | null;
  /** Set to false to score as if every day were peak season. */
  readonly useSeason?: boolean;
}

export interface DayScore {
  readonly date: string;
  /** 0..100, rounded. */
  readonly score: number;
  readonly rating: Rating;
  /** True once the day has a full sustain window of history behind it. */
  readonly warmedUp: boolean;
  readonly components: ScoreComponents;
  /** Soil store at the end of the day (mm). */
  readonly soilIndex: number;
  /** Kernel-weighted effective rain of the flush window (mm). */
  readonly flushRain: number;
  readonly snowpack: number;
  readonly drainage: number;
  readonly saturation: number;
  /** Explanations, most important first. */
  readonly notes: ReadonlyArray<NoteCode>;
}

/** Below this, a factor is weak enough to be worth explaining. */
const WEAK = 0.35;

export function computeScores(
  days: ReadonlyArray<DayWeather>,
  options: ScoreOptions = {},
): Array<DayScore> {
  const params = options.params ?? DEFAULT_PARAMS;
  const { elevation = null, useSeason = true } = options;
  const water = waterBalance(days, params);
  const maxModifier = Math.max(1, params.diurnalBonus);

  return days.map((day, i) => {
    const w = water[i]!;

    const moisture = moistureFactor(w.soil, params);
    const sustain = sustainFactor(water, i, params);
    const saturation = saturationLevel(water, i, params);
    const rain = flushRain(water, i, params);
    const flush = flushFactor(rain, params);
    const temperature = temperatureFactor(water, i, params);
    const tempGate = temperatureGate(temperature.blended, params);

    const modifiers: Array<Modifier> = [
      frostModifier(day.tMin, params),
      frostAftermathModifier(days, i, params),
      heatModifier(day.tMax, params),
      rainTodayModifier(w.precip, params),
      waterloggingModifier(saturation, params),
      diurnalModifier(day, params),
    ];
    const modifier = clamp(
      modifiers.reduce((p, m) => p * m.factor, 1),
      0,
      maxModifier,
    );

    const season = useSeason ? seasonFactor(day.date, params, elevation) : 1;

    const score = clamp(
      Math.round(100 * waterScore(moisture, sustain, flush, params) * tempGate * modifier * season),
      0,
      100,
    );

    // Headline notes first: the limiting factors, then the day's events.
    const notes: Array<NoteCode> = [];
    const tMean = w.tMean ?? 0;
    if (temperature.today < WEAK) {
      notes.push(tMean < 10 ? 'too-cold' : 'too-warm');
    }
    if (flush < 0.3 && moisture >= WEAK) {
      notes.push('no-trigger');
    }
    if (sustain < WEAK && moisture >= WEAK) {
      notes.push('short-wet');
    }
    if (saturation > 0.5) {
      notes.push('saturated');
    } else if (moisture < WEAK) {
      notes.push('too-dry');
    }
    for (const m of modifiers) {
      if (m.note) {
        notes.push(m.note);
      }
    }

    return {
      date: day.date,
      score,
      rating: ratingFor(score),
      warmedUp: i >= params.sustainWindow,
      components: {
        moisture,
        sustain,
        flush,
        temperature: temperature.blended,
        tempGate,
        modifier,
        season,
      },
      soilIndex: w.soil,
      flushRain: rain,
      snowpack: w.snowpack,
      drainage: w.drainage,
      saturation,
      notes,
    };
  });
}
