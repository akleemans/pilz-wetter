import { describe, expect, test } from 'bun:test';
import {
  clamp,
  dayOfYear,
  infiltration,
  ramp,
  seasonFactor,
  temperatureSuitability,
} from './curves.ts';
import { DEFAULT_PARAMS, resolveParams } from './params.ts';

describe('ramp', () => {
  test('is 0 below, 1 above and smooth in between', () => {
    expect(ramp(0, [10, 20])).toBe(0);
    expect(ramp(10, [10, 20])).toBe(0);
    expect(ramp(15, [10, 20])).toBeCloseTo(0.5);
    expect(ramp(20, [10, 20])).toBe(1);
    expect(ramp(99, [10, 20])).toBe(1);
  });

  test('is monotone', () => {
    let previous = -1;
    for (let x = 0; x <= 30; x += 0.5) {
      const y = ramp(x, [10, 20]);
      expect(y).toBeGreaterThanOrEqual(previous);
      previous = y;
    }
  });

  test('degenerates to a step when the range is empty or inverted', () => {
    expect(ramp(4, [5, 5])).toBe(0);
    expect(ramp(5, [5, 5])).toBe(1);
    expect(ramp(4, [8, 3])).toBe(1);
  });
});

test('clamp keeps values inside the bounds', () => {
  expect(clamp(-1, 0, 1)).toBe(0);
  expect(clamp(0.4, 0, 1)).toBe(0.4);
  expect(clamp(2, 0, 1)).toBe(1);
});

describe('infiltration', () => {
  test('the soil cannot swallow a cloudburst', () => {
    expect(infiltration(5)).toBeGreaterThan(4.8);
    expect(infiltration(10)).toBeGreaterThan(9);
    expect(infiltration(60)).toBeLessThan(19);
    // 3 x 40 mm delivers far less usable water than 15 x 8 mm.
    expect(3 * infiltration(40)).toBeLessThan(0.7 * 15 * infiltration(8));
  });

  test('is zero for no, negative or missing rain', () => {
    expect(infiltration(0)).toBe(0);
    expect(infiltration(-3)).toBe(0);
    expect(infiltration(Number.NaN)).toBe(0);
  });

  test('a smaller saturation punishes downpours harder', () => {
    expect(infiltration(40, 10)).toBeLessThan(infiltration(40, 19));
  });
});

const t = (x: number | null) => temperatureSuitability(x, DEFAULT_PARAMS);
const s = (date: string, elevation: number | null = null) =>
  seasonFactor(date, DEFAULT_PARAMS, elevation);

describe('temperatureSuitability', () => {
  test('peaks at 12–18 °C and vanishes at the edges', () => {
    expect(t(12)).toBe(1);
    expect(t(15)).toBe(1);
    expect(t(18)).toBe(1);
    expect(t(8)).toBeGreaterThan(0.2);
    expect(t(8)).toBeLessThan(0.9);
    expect(t(23)).toBeGreaterThan(0.2);
    expect(t(23)).toBeLessThan(0.9);
    expect(t(1)).toBe(0);
    expect(t(28)).toBe(0);
  });

  test('a missing temperature is unsuitable, not an error', () => {
    expect(t(null)).toBe(0);
    expect(t(Number.NaN)).toBe(0);
  });

  test('follows the configured ramps', () => {
    const params = resolveParams({ tempColdRamp: [5, 8] });
    expect(temperatureSuitability(8, params)).toBe(1);
  });
});

describe('dayOfYear', () => {
  test('counts from 1 January', () => {
    expect(dayOfYear('2026-01-01')).toBe(1);
    expect(dayOfYear('2026-09-01')).toBe(244);
    expect(dayOfYear('2026-12-31')).toBe(365);
  });

  test('treats leap years like any other year', () => {
    expect(dayOfYear('2024-03-01')).toBe(dayOfYear('2026-03-01'));
  });

  test('rejects malformed dates', () => {
    expect(() => dayOfYear('yesterday')).toThrow();
  });
});

describe('seasonFactor', () => {
  test('peaks in late summer and autumn, bottoms out in winter', () => {
    expect(s('2026-08-15')).toBeGreaterThan(0.95);
    expect(s('2026-09-15')).toBeGreaterThan(0.95);
    expect(s('2026-01-15')).toBeLessThan(0.2);
    expect(s('2026-06-15')).toBeGreaterThan(s('2026-04-15'));
  });

  test('matches the monthly table at mid-month', () => {
    DEFAULT_PARAMS.seasonByMonth.forEach((value, month) => {
      const date = `2026-${String(month + 1).padStart(2, '0')}-15`;
      expect(s(date)).toBeCloseTo(value, 1);
    });
  });

  test('is continuous across the year', () => {
    let previous = s('2026-01-01');
    for (let day = 1; day <= 365; day++) {
      const date = new Date(Date.UTC(2026, 0, day)).toISOString().slice(0, 10);
      const value = s(date);
      expect(Math.abs(value - previous)).toBeLessThan(0.02);
      previous = value;
    }
  });

  test('the reference elevation and an unknown elevation agree', () => {
    for (const date of ['2026-03-10', '2026-07-01', '2026-10-20']) {
      expect(s(date, DEFAULT_PARAMS.seasonReferenceElevation)).toBeCloseTo(s(date), 10);
    }
  });

  test('higher up, the season starts later and ends earlier', () => {
    expect(s('2026-05-15', 1500)).toBeLessThan(s('2026-05-15', 550));
    expect(s('2026-10-20', 1500)).toBeLessThan(s('2026-10-20', 550));
    expect(s('2026-10-20', 2000)).toBeLessThan(s('2026-10-20', 1500));
    // …while the peak itself is untouched.
    expect(s('2026-09-01', 1800)).toBeCloseTo(s('2026-09-01', 550), 5);
  });

  test('below the reference elevation, the season widens', () => {
    expect(s('2026-11-10', 400)).toBeGreaterThan(s('2026-11-10', 550));
  });

  test('the elevation shift can be switched off', () => {
    const flat = resolveParams({ seasonShiftDaysPer100m: 0 });
    expect(seasonFactor('2026-10-20', flat, 2000)).toBeCloseTo(s('2026-10-20'), 10);
  });

  test('extreme elevations stay in winter rather than wrapping round', () => {
    // Stretched far enough, every off-peak date reads the winter end of the
    // table (at most the far side of the year from the peak).
    for (const date of ['2026-06-01', '2026-11-15', '2026-03-02']) {
      expect(s(date, 5000)).toBeLessThan(0.25);
    }
  });
});
