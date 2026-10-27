import { describe, expect, test } from 'bun:test';
import {
  effectiveSustain,
  flushFactor,
  flushRain,
  moistureFactor,
  saturationLevel,
  sustainFactor,
  temperatureFactor,
  temperatureGate,
  waterScore,
} from './factors.ts';
import { DEFAULT_PARAMS as P, resolveParams } from './params.ts';
import { mild, series } from './scenarios.ts';
import { type WaterDay, waterBalance } from './water-balance.ts';

const water = (length: number, day: (i: number, age: number) => Parameters<typeof mild>[0]) =>
  waterBalance(
    series('2026-09-20', length, (i, a) => mild(day(i, a))),
    P,
  );

const last = (w: Array<WaterDay>) => w.length - 1;

test('moisture follows the soil store', () => {
  expect(moistureFactor(0, P)).toBe(0);
  expect(moistureFactor(P.moistureRamp[1], P)).toBe(1);
  expect(moistureFactor(24, P)).toBeGreaterThan(0.3);
});

describe('sustainFactor', () => {
  test('is 0 for a dry month and 1 for a wet one', () => {
    const dry = water(30, () => ({}));
    const wet = water(30, () => ({ precip: 8 }));
    expect(sustainFactor(dry, last(dry), P)).toBe(0);
    expect(sustainFactor(wet, last(wet), P)).toBe(1);
  });

  test('only looks at the trailing window', () => {
    // A synthetic soil series: soaked long ago, bone dry for a full window.
    const soil = [...Array(10).fill(80), ...Array(P.sustainWindow).fill(0)];
    const w = soil.map((value: number) => ({
      tMean: 14,
      precip: 0,
      infiltrated: 0,
      soil: value,
      drainage: 0,
      snowpack: 0,
    }));
    expect(sustainFactor(w, last(w), P)).toBe(0);
    expect(sustainFactor(w, 10, P)).toBe(1);
  });

  test('the floor keeps a dry month from vetoing everything', () => {
    expect(effectiveSustain(0, P)).toBe(P.sustainFloor);
    expect(effectiveSustain(1, P)).toBe(1);
  });
});

describe('saturationLevel', () => {
  test('is 0 for ordinary rain and approaches 1 under a monsoon', () => {
    const ordinary = water(30, (i) => ({ precip: i % 2 ? 0 : 6 }));
    const monsoon = water(30, () => ({ precip: 30 }));
    expect(saturationLevel(ordinary, last(ordinary), P)).toBe(0);
    expect(saturationLevel(monsoon, last(monsoon), P)).toBeGreaterThan(0.9);
  });
});

/** Flush rain today after a single 10 mm rain `lag` days ago. */
const flushAfter = (lag: number) => {
  const w = water(30, (_i, age) => ({ precip: age === lag ? 10 : 0 }));
  return flushRain(w, last(w), P);
};

describe('flushRain', () => {
  test('ignores the day itself and weights by lag', () => {
    const at = flushAfter;
    expect(at(0)).toBe(0);
    expect(at(6)).toBeGreaterThan(at(2));
    expect(at(6)).toBeGreaterThan(at(14));
    expect(at(P.flushKernel.length)).toBe(0);
  });

  test('copes with the first days of a series', () => {
    const w = water(2, () => ({ precip: 10 }));
    expect(flushRain(w, 0, P)).toBe(0);
    expect(flushRain(w, 1, P)).toBeGreaterThanOrEqual(0);
  });

  test('a custom kernel moves the peak', () => {
    const early = resolveParams({
      flushKernel: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    const w = water(30, (_i, age) => ({ precip: age === 1 ? 10 : 0 }));
    expect(flushRain(w, last(w), early)).toBeCloseTo(w.at(-2)!.infiltrated);
  });

  test('the factor ramps over the configured range', () => {
    expect(flushFactor(0, P)).toBe(0);
    expect(flushFactor(P.flushRamp[1], P)).toBe(1);
  });
});

describe('temperatureFactor', () => {
  test('blends today with the previous days', () => {
    // Ten mild days, then a cold one: the history softens the drop.
    const w = water(11, (_i, age) => (age === 0 ? { tMin: -1, tMean: 2, tMax: 5 } : {}));
    const t = temperatureFactor(w, last(w), P);
    expect(t.today).toBe(0);
    expect(t.blended).toBeCloseTo(1 - P.tempTodayWeight);
  });

  test('the first day has no history and stands alone', () => {
    const w = water(1, () => ({}));
    expect(temperatureFactor(w, 0, P)).toEqual({ today: 1, blended: 1 });
  });

  test('the gate never closes completely', () => {
    expect(temperatureGate(0, P)).toBe(P.temperatureGateFloor);
    expect(temperatureGate(1, P)).toBe(1);
  });
});

describe('waterScore', () => {
  test('is 1 when every factor is perfect', () => {
    expect(waterScore(1, 1, 1, P)).toBeCloseTo(1);
  });

  test('no factor can stand in for another', () => {
    expect(waterScore(0, 1, 1, P)).toBeLessThan(0.05);
    expect(waterScore(1, 1, 0, P)).toBeLessThan(0.01);
  });

  test('never returns NaN, even with zero weights', () => {
    const flat = resolveParams({ weightMoisture: 0, weightFlush: 0 });
    expect(waterScore(0, 0, 0, flat)).toBeCloseTo(flat.sustainFloor ** 0.3);
  });
});
