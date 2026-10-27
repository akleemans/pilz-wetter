/**
 * Step 3 of the model: the water and temperature factors of one day, each
 * computed from the water balance up to and including that day.
 */

import { ramp, temperatureSuitability } from './curves.ts';
import type { ModelParams } from './params.ts';
import type { WaterDay } from './water-balance.ts';

const mean = (values: ReadonlyArray<number>) =>
  values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;

/** The last `length` entries up to and including index `i`. */
const trailing = <T>(series: ReadonlyArray<T>, i: number, length: number) =>
  series.slice(Math.max(0, i + 1 - Math.max(1, length)), i + 1);

/** Is the ground wet today? */
export function moistureFactor(soil: number, params: ModelParams): number {
  return ramp(soil, params.moistureRamp);
}

/**
 * Has it stayed damp for weeks, so the mycelium could charge up? The mean
 * per-day wetness over the trailing window: what separates "rained often" from
 * "rained hard three times".
 */
export function sustainFactor(
  water: ReadonlyArray<WaterDay>,
  i: number,
  params: ModelParams,
): number {
  const window = trailing(water, i, params.sustainWindow);
  const wetness = mean(window.map((d) => ramp(d.soil, params.sustainWetRamp)));
  return ramp(wetness, params.sustainRamp);
}

/** Lower bound applied to the sustain factor before it enters the score. */
export const effectiveSustain = (sustain: number, params: ModelParams) =>
  params.sustainFloor + (1 - params.sustainFloor) * sustain;

/**
 * How sodden the stand has been lately: 0 = drains freely, 1 = at field
 * capacity every day of the window.
 */
export function saturationLevel(
  water: ReadonlyArray<WaterDay>,
  i: number,
  params: ModelParams,
): number {
  const window = trailing(water, i, params.saturationWindow);
  const from = params.saturationLevel * params.fieldCapacity;
  return mean(window.map((d) => ramp(d.soil, [from, params.fieldCapacity])));
}

/** Kernel-weighted effective rain (mm) of the days before `i`. */
export function flushRain(water: ReadonlyArray<WaterDay>, i: number, params: ModelParams): number {
  let sum = 0;
  for (let lag = 1; lag < params.flushKernel.length && i - lag >= 0; lag++) {
    sum += (water[i - lag]?.infiltrated ?? 0) * (params.flushKernel[lag] ?? 0);
  }
  return sum;
}

/** Was there a soaking rain in the flush window (by default 3–10 days ago)? */
export const flushFactor = (rain: number, params: ModelParams) => ramp(rain, params.flushRamp);

export interface TemperatureFactor {
  /** Suitability of today's mean alone. */
  readonly today: number;
  /** Blend of today and the trailing history: what enters the gate. */
  readonly blended: number;
}

/**
 * Temperature suitability, blending today with the previous days, because the
 * mycelium responds to the weather of the last week or so, not one afternoon.
 */
export function temperatureFactor(
  water: ReadonlyArray<WaterDay>,
  i: number,
  params: ModelParams,
): TemperatureFactor {
  const today = temperatureSuitability(water[i]?.tMean ?? null, params);
  const history = water
    .slice(Math.max(0, i - params.tempHistoryDays), i)
    .map((d) => temperatureSuitability(d.tMean, params));
  const past = history.length ? mean(history) : today;
  return {
    today,
    blended: params.tempTodayWeight * today + (1 - params.tempTodayWeight) * past,
  };
}

/**
 * The temperature gate: nothing fruits in a frozen or baking forest, whatever
 * the soil is doing. The floor leaves room for late species.
 */
export const temperatureGate = (temperature: number, params: ModelParams) =>
  params.temperatureGateFloor + (1 - params.temperatureGateFloor) * temperature;

/**
 * The three water factors combine as a weighted geometric mean (Liebig's law
 * of the minimum: none of them can stand in for another). Moisture and flush
 * are floored at a tiny epsilon so a zero does not produce NaN from 0^0.
 */
export function waterScore(
  moisture: number,
  sustain: number,
  flush: number,
  params: ModelParams,
): number {
  return (
    Math.max(moisture, 1e-6) ** params.weightMoisture *
    effectiveSustain(sustain, params) ** params.weightSustain *
    Math.max(flush, 1e-6) ** params.weightFlush
  );
}
