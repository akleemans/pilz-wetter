/**
 * Step 1 and 2 of the model: what reaches the soil, and what the soil keeps.
 *
 * The soil store is an antecedent precipitation index with a cap: every day it
 * keeps a temperature-dependent fraction of yesterday's water and adds what
 * infiltrated today, up to field capacity. Precipitation on freezing days is
 * banked as snow and released by degree-day melt.
 */

import { clamp, infiltration } from './curves.ts';
import type { ModelParams } from './params.ts';
import type { DayWeather } from './types.ts';

export interface WaterDay {
  /** Daily mean temperature used throughout, after filling gaps. */
  readonly tMean: number | null;
  /** Precipitation that fell (mm, never negative). */
  readonly precip: number;
  /** Water that entered the soil today (mm), after snow and infiltration. */
  readonly infiltrated: number;
  /** Soil store at the end of the day (mm, 0..field capacity). */
  readonly soil: number;
  /** Water lost past the rooting zone today because the store was full (mm). */
  readonly drainage: number;
  /** Snowpack at the end of the day (mm water equivalent). */
  readonly snowpack: number;
}

/** Daily mean, falling back to the min/max midpoint, then to whichever exists. */
export function meanTemperature(day: DayWeather): number | null {
  if (day.tMean != null) {
    return day.tMean;
  }
  if (day.tMax != null && day.tMin != null) {
    return (day.tMax + day.tMin) / 2;
  }
  return day.tMax ?? day.tMin ?? null;
}

export function dailyRetention(
  tMean: number,
  params: Pick<
    ModelParams,
    'retentionBase' | 'retentionPerDegree' | 'retentionReferenceTemp' | 'retentionRange'
  >,
): number {
  const [lo, hi] = params.retentionRange;
  return clamp(
    params.retentionBase - params.retentionPerDegree * (tMean - params.retentionReferenceTemp),
    lo ?? 0,
    hi ?? 1,
  );
}

export function waterBalance(
  days: ReadonlyArray<DayWeather>,
  params: ModelParams,
): Array<WaterDay> {
  const out: Array<WaterDay> = [];
  let soil = 0;
  let snowpack = 0;
  let lastMean: number | null = null;

  for (const day of days) {
    // A missing temperature borrows yesterday's, so one gap does not read as
    // a frozen day.
    const tMean: number | null = meanTemperature(day) ?? lastMean;
    lastMean = tMean;
    const precip = Math.max(0, day.precip ?? 0);

    let liquid = precip;
    if (day.tMax != null && day.tMax < params.snowMaxTemp) {
      snowpack += precip;
      liquid = 0;
    } else if (snowpack > 0) {
      const melt = Math.min(snowpack, Math.max(0, tMean ?? 0) * params.meltPerDegreeDay);
      snowpack -= melt;
      liquid += melt;
    }

    const infiltrated = infiltration(liquid, params.infiltrationSaturation);
    const retention = dailyRetention(tMean ?? params.retentionReferenceTemp, params);
    // The rooting zone holds a finite amount of water and the rest drains past
    // it: most of a cloudburst is simply gone.
    const filled = soil * retention + infiltrated;
    soil = Math.min(filled, params.fieldCapacity);

    out.push({
      tMean,
      precip,
      infiltrated,
      soil,
      drainage: filled - soil,
      snowpack,
    });
  }
  return out;
}
