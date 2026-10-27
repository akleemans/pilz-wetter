/**
 * Step 4 of the model: multiplicative modifiers for the day's weather events.
 * Each returns a factor (1 = no effect) and the note explaining it, so the
 * score breakdown can show exactly which event cost how much.
 */

import type { NoteCode } from './notes.ts';
import type { ModelParams } from './params.ts';
import type { DayWeather } from './types.ts';

export interface Modifier {
  readonly factor: number;
  readonly note?: NoteCode;
}

const NONE: Modifier = { factor: 1 };

/** Night frost today. Hard frost ends the season for most edible species. */
export function frostModifier(tMin: number | null, params: ModelParams): Modifier {
  if (tMin == null) {
    return NONE;
  }
  if (tMin < params.frostHardBelow) {
    return { factor: params.frostHardFactor, note: 'hard-frost' };
  }
  if (tMin < params.frostModerateBelow) {
    return { factor: params.frostModerateFactor, note: 'frost' };
  }
  if (tMin < params.frostLightBelow) {
    return { factor: params.frostLightFactor, note: 'light-frost' };
  }
  return NONE;
}

/** A hard frost in the previous days lingers, unless today is one itself. */
export function frostAftermathModifier(
  days: ReadonlyArray<DayWeather>,
  i: number,
  params: ModelParams,
): Modifier {
  const today = days[i]?.tMin;
  if (today != null && today < params.frostHardBelow) {
    return NONE; // already counted by frostModifier
  }
  const recent = days.slice(Math.max(0, i - params.frostAftermathDays), i);
  return recent.some((d) => d.tMin != null && d.tMin < params.frostHardBelow)
    ? { factor: params.frostAftermathFactor, note: 'recent-hard-frost' }
    : NONE;
}

/** Heat dries the litter layer and rots what is already up. */
export function heatModifier(tMax: number | null, params: ModelParams): Modifier {
  if (tMax == null) {
    return NONE;
  }
  if (tMax >= params.heatHotFrom) {
    return { factor: params.heatHotFactor, note: 'hot' };
  }
  if (tMax >= params.heatWarmFrom) {
    return { factor: params.heatWarmFactor, note: 'warm' };
  }
  return NONE;
}

/** Heavy rain on the day itself: soaked fruit bodies keep badly. */
export function rainTodayModifier(precip: number, params: ModelParams): Modifier {
  if (precip >= params.rainCloudburstFrom) {
    return { factor: params.rainCloudburstFactor, note: 'cloudburst' };
  }
  if (precip >= params.rainHeavyFrom) {
    return { factor: params.rainHeavyFactor, note: 'heavy-rain' };
  }
  return NONE;
}

/** Ground that never drains goes anaerobic, and what is up rots. */
export function waterloggingModifier(saturation: number, params: ModelParams): Modifier {
  if (!(saturation > 0)) {
    return NONE;
  }
  return {
    factor: 1 - params.saturationPenalty * saturation,
    ...(saturation > 0.5 ? { note: 'waterlogged' as const } : {}),
  };
}

const within = (x: number, [lo, hi]: ReadonlyArray<number>) =>
  lo !== undefined && hi !== undefined && x >= lo && x <= hi;

/** Warm days with cool, frost-free nights: the classic flush trigger. */
export function diurnalModifier(day: DayWeather, params: ModelParams): Modifier {
  if (day.tMin == null || day.tMax == null) {
    return NONE;
  }
  const spread = day.tMax - day.tMin;
  return within(spread, params.diurnalSpreadRange) &&
    within(day.tMin, params.diurnalNightRange) &&
    day.tMax <= params.diurnalMaxDay
    ? { factor: params.diurnalBonus, note: 'diurnal-trigger' }
    : NONE;
}
