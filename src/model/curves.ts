/**
 * The response curves the model is built from. All pure, all parameterised,
 * so each one can be tested and tuned on its own.
 */

import type { ModelParams } from './params.ts';

type Range = readonly [number, number] | ReadonlyArray<number>;

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/**
 * Smoothstep ramp: 0 at or below `from`, 1 at or above `to`, an S-curve between.
 * Smooth rather than linear, so a factor eases in and out and small weather
 * changes never cause a kink in the score.
 */
export function ramp(x: number, [from, to]: Range): number {
  if (from === undefined || to === undefined) {
    throw new Error('ramp needs a [from, to] range');
  }
  if (!(to > from)) {
    return x >= to ? 1 : 0;
  }
  const t = clamp((x - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Effective infiltration (mm): the soil cannot swallow a cloudburst. */
export function infiltration(precipMm: number, saturation: number = 19): number {
  if (!(precipMm > 0) || !(saturation > 0)) {
    return 0;
  }
  return saturation * Math.tanh(precipMm / saturation);
}

/** Suitability (0..1) of a daily mean temperature for fruit-body formation. */
export function temperatureSuitability(
  tMean: number | null,
  params: Pick<ModelParams, 'tempColdRamp' | 'tempWarmRamp'>,
): number {
  if (tMean == null || Number.isNaN(tMean)) {
    return 0;
  }
  const cold = ramp(tMean, params.tempColdRamp);
  const warm = 1 - ramp(tMean, params.tempWarmRamp);
  return clamp(Math.min(cold, warm), 0, 1);
}

const DAY_MS = 86_400_000;
const YEAR_DAYS = 365;
/** Distance from the peak at which the elevation shift is measured, in days. */
const SEASON_HALF_SPAN = 120;

/** Day of the year, 1 = 1 January (non-leap: 29 February maps onto 1 March). */
export function dayOfYear(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) {
    throw new Error(`Invalid date: ${date}`);
  }
  const start = Date.UTC(2001, 0, 1); // any non-leap year
  const day = Date.UTC(2001, m - 1, d);
  return Math.round((day - start) / DAY_MS) + 1;
}

/** Mid-month table lookup, interpolated linearly, wrapping around the year. */
function seasonTable(day: number, table: ReadonlyArray<number>): number {
  // Fractional month index: 0 = mid-January (day 15), 1 = mid-February, …
  const pos = (((day - 15) / YEAR_DAYS) * 12 + 12) % 12;
  const lo = Math.floor(pos);
  const frac = pos - lo;
  const a = table[lo % 12] ?? 0;
  const b = table[(lo + 1) % 12] ?? 0;
  return a + (b - a) * frac;
}

/**
 * Seasonal availability of edible fungi (0..1) for a date and elevation.
 *
 * The monthly table is for the Mittelland. Higher up, the season starts later
 * and ends earlier: the calendar is stretched away from the peak day, so a date
 * `n` days from the peak reads the table `n · (1 + shift / 120)` days from it,
 * where `shift` is the configured days per 100 m above the reference elevation.
 * Below the reference elevation the season widens instead.
 */
export function seasonFactor(
  date: string,
  params: Pick<
    ModelParams,
    'seasonByMonth' | 'seasonReferenceElevation' | 'seasonPeakDay' | 'seasonShiftDaysPer100m'
  >,
  elevation: number | null = null,
): number {
  const day = dayOfYear(date);
  const shiftDays =
    elevation == null
      ? 0
      : ((elevation - params.seasonReferenceElevation) / 100) * params.seasonShiftDaysPer100m;
  // Never shrink the calendar to less than half, whatever the input.
  const stretch = Math.max(0.5, 1 + shiftDays / SEASON_HALF_SPAN);

  // Signed distance from the peak, taking the shorter way round the year.
  let fromPeak = day - params.seasonPeakDay;
  if (fromPeak > YEAR_DAYS / 2) {
    fromPeak -= YEAR_DAYS;
  } else if (fromPeak < -YEAR_DAYS / 2) {
    fromPeak += YEAR_DAYS;
  }
  // Stretched far enough, both sides land deep in winter; stop there rather
  // than wrapping round into the other half of the year.
  const stretched = clamp(fromPeak * stretch, -YEAR_DAYS / 2, YEAR_DAYS / 2);
  return seasonTable(params.seasonPeakDay + stretched, params.seasonByMonth);
}
