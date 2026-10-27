import { describe, expect, test } from 'bun:test';
import {
  diurnalModifier,
  frostAftermathModifier,
  frostModifier,
  heatModifier,
  rainTodayModifier,
  waterloggingModifier,
} from './modifiers.ts';
import { DEFAULT_PARAMS as P } from './params.ts';
import { mild, series } from './scenarios.ts';

describe('frostModifier', () => {
  test('grows harsher the colder the night', () => {
    expect(frostModifier(3, P)).toEqual({ factor: 1 });
    expect(frostModifier(-1, P)).toEqual({ factor: 0.75, note: 'light-frost' });
    expect(frostModifier(-3, P)).toEqual({ factor: 0.4, note: 'frost' });
    expect(frostModifier(-7, P)).toEqual({ factor: 0.15, note: 'hard-frost' });
  });

  test('the thresholds are exclusive', () => {
    expect(frostModifier(0, P).factor).toBe(1);
    expect(frostModifier(-2, P).note).toBe('light-frost');
    expect(frostModifier(-5, P).note).toBe('frost');
  });

  test('a missing minimum has no effect', () => {
    expect(frostModifier(null, P).factor).toBe(1);
  });
});

describe('frostAftermathModifier', () => {
  const days = series('2026-11-10', 10, (_i, age) => mild(age === 3 ? { tMin: -8 } : {}));

  test('lingers for the configured number of days', () => {
    const last = days.length - 1;
    expect(frostAftermathModifier(days, last, P).note).toBe('recent-hard-frost');
    // Day of the frost itself and the days before it are unaffected.
    expect(frostAftermathModifier(days, last - 3, P).factor).toBe(1);
    expect(frostAftermathModifier(days, last - 4, P).factor).toBe(1);
  });

  test('ends after the configured number of days', () => {
    const later = [...days, ...series('2026-11-20', 10, () => mild())];
    // The frost was on day 6: it still counts on day 6 + n, no longer after.
    expect(frostAftermathModifier(later, 6 + P.frostAftermathDays, P).factor).toBe(
      P.frostAftermathFactor,
    );
    expect(frostAftermathModifier(later, 6 + P.frostAftermathDays + 1, P).factor).toBe(1);
  });

  test('does not stack on a hard frost today', () => {
    const twice = days.map((d, i) => (i === days.length - 1 ? { ...d, tMin: -9 } : d));
    expect(frostAftermathModifier(twice, twice.length - 1, P).factor).toBe(1);
  });
});

test('heat dries the litter layer', () => {
  expect(heatModifier(25, P).factor).toBe(1);
  expect(heatModifier(28, P)).toEqual({ factor: 0.85, note: 'warm' });
  expect(heatModifier(33, P)).toEqual({ factor: 0.7, note: 'hot' });
  expect(heatModifier(null, P).factor).toBe(1);
});

test('heavy rain on the day costs a little', () => {
  expect(rainTodayModifier(10, P).factor).toBe(1);
  expect(rainTodayModifier(20, P)).toEqual({ factor: 0.85, note: 'heavy-rain' });
  expect(rainTodayModifier(45, P)).toEqual({ factor: 0.75, note: 'cloudburst' });
});

test('waterlogging scales with the saturation level', () => {
  expect(waterloggingModifier(0, P)).toEqual({ factor: 1 });
  expect(waterloggingModifier(0.4, P).factor).toBeCloseTo(1 - 0.45 * 0.4);
  expect(waterloggingModifier(0.4, P).note).toBeUndefined();
  expect(waterloggingModifier(1, P)).toEqual({
    factor: 1 - P.saturationPenalty,
    note: 'waterlogged',
  });
});

const day = (tMin: number | null, tMax: number | null) => ({
  date: '2026-09-20',
  tMin,
  tMean: null,
  tMax,
  precip: 0,
});

describe('diurnalModifier', () => {
  test('rewards warm days with cool nights', () => {
    expect(diurnalModifier(day(8, 19), P)).toEqual({
      factor: 1.05,
      note: 'diurnal-trigger',
    });
  });

  test('needs a frost-free night, a real spread and a day that is not hot', () => {
    expect(diurnalModifier(day(2, 15), P).factor).toBe(1);
    expect(diurnalModifier(day(12, 15), P).factor).toBe(1);
    expect(diurnalModifier(day(13, 27), P).factor).toBe(1);
    expect(diurnalModifier(day(null, 20), P).factor).toBe(1);
  });
});
