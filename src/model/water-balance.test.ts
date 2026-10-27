import { describe, expect, test } from 'bun:test';
import { DEFAULT_PARAMS, resolveParams } from './params.ts';
import { mild, series } from './scenarios.ts';
import { dailyRetention, meanTemperature, waterBalance } from './water-balance.ts';

describe('meanTemperature', () => {
  const day = { date: '2026-09-01', precip: 0 };

  test('prefers the reported mean', () => {
    expect(meanTemperature({ ...day, tMin: 0, tMean: 7, tMax: 20 })).toBe(7);
  });

  test('falls back to the min/max midpoint, then to whatever exists', () => {
    expect(meanTemperature({ ...day, tMin: 4, tMean: null, tMax: 12 })).toBe(8);
    expect(meanTemperature({ ...day, tMin: null, tMean: null, tMax: 12 })).toBe(12);
    expect(meanTemperature({ ...day, tMin: null, tMean: null, tMax: null })).toBeNull();
  });
});

describe('dailyRetention', () => {
  test('warm days lose more water than cool ones', () => {
    expect(dailyRetention(25, DEFAULT_PARAMS)).toBeLessThan(dailyRetention(5, DEFAULT_PARAMS));
  });

  test('stays inside the configured range', () => {
    expect(dailyRetention(60, DEFAULT_PARAMS)).toBe(0.8);
    expect(dailyRetention(-30, DEFAULT_PARAMS)).toBe(0.96);
  });
});

describe('waterBalance', () => {
  test('a dry series keeps the store empty', () => {
    const water = waterBalance(
      series('2026-09-20', 10, () => mild()),
      DEFAULT_PARAMS,
    );
    expect(water.every((d) => d.soil === 0)).toBe(true);
  });

  test('the store decays day by day after rain', () => {
    const water = waterBalance(
      series('2026-09-20', 10, (i) => mild({ precip: i === 0 ? 10 : 0 })),
      DEFAULT_PARAMS,
    );
    for (let i = 1; i < water.length; i++) {
      expect(water[i]!.soil).toBeLessThan(water[i - 1]!.soil);
    }
  });

  test('never exceeds field capacity, and the overflow is drainage', () => {
    const water = waterBalance(
      series('2026-09-20', 20, () => mild({ precip: 40 })),
      DEFAULT_PARAMS,
    );
    expect(Math.max(...water.map((d) => d.soil))).toBe(DEFAULT_PARAMS.fieldCapacity);
    expect(water.at(-1)!.drainage).toBeGreaterThan(0);
  });

  test('a cloudburst loses water that steady rain keeps', () => {
    const burst = waterBalance(
      series('2026-09-20', 15, (i) => mild({ precip: i === 0 ? 120 : 0 })),
      DEFAULT_PARAMS,
    );
    const steady = waterBalance(
      series('2026-09-20', 15, () => mild({ precip: 8 })),
      DEFAULT_PARAMS,
    );
    const total = (w: typeof burst) => w.reduce((s, d) => s + d.infiltrated, 0);
    expect(total(burst)).toBeLessThan(0.25 * total(steady));
  });

  test('snow is banked until it melts', () => {
    const days = series('2026-02-20', 12, (i) =>
      i < 6
        ? { tMin: -6, tMean: -3, tMax: -1, precip: 10 }
        : { tMin: 2, tMean: 6, tMax: 10, precip: 0 },
    );
    const water = waterBalance(days, DEFAULT_PARAMS);
    expect(water[5]!.snowpack).toBe(60);
    expect(water[5]!.soil).toBe(0);
    // 6 °C mean at 3 mm/°C melts 18 mm a day: the pack is gone after 4 days.
    expect(water[6]!.snowpack).toBe(42);
    expect(water[6]!.infiltrated).toBeGreaterThan(0);
    expect(water[9]!.snowpack).toBe(0);
  });

  test('a missing temperature borrows the previous day', () => {
    const days = series('2026-09-20', 3, () => mild({ precip: 5 }));
    const gappy = days.map((d, i) => (i === 1 ? { ...d, tMin: null, tMean: null, tMax: null } : d));
    const water = waterBalance(gappy, DEFAULT_PARAMS);
    expect(water[1]!.tMean).toBe(14);
    expect(water.map((d) => d.soil)).toEqual(waterBalance(days, DEFAULT_PARAMS).map((d) => d.soil));
  });

  test('missing or negative precipitation counts as dry', () => {
    const days = series('2026-09-20', 2, () => mild()).map((d, i) => ({
      ...d,
      precip: i === 0 ? null : -4,
    }));
    expect(waterBalance(days, DEFAULT_PARAMS).every((d) => d.soil === 0)).toBe(true);
  });

  test('a larger field capacity stores more', () => {
    const days = series('2026-09-20', 20, () => mild({ precip: 30 }));
    const big = waterBalance(days, resolveParams({ fieldCapacity: 150 }));
    expect(big.at(-1)!.soil).toBeGreaterThan(DEFAULT_PARAMS.fieldCapacity);
  });
});
