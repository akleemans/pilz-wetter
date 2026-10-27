import { describe, expect, test } from 'bun:test';
import { DEFAULT_PARAMS, resolveParams } from './params.ts';
import { mild, scenarioByKey, series } from './scenarios.ts';
import { computeScores, type ScoreOptions } from './score.ts';
import type { DayWeather } from './types.ts';

const lastOf = (days: ReadonlyArray<DayWeather>, options?: ScoreOptions) =>
  computeScores(days, options).at(-1)!;
const scoreOf = (key: string, options?: ScoreOptions) =>
  lastOf(scenarioByKey(key).days, options).score;
const totalRain = (days: ReadonlyArray<DayWeather>) =>
  days.reduce((s, d) => s + (d.precip ?? 0), 0);
const sept = (day: (i: number, age: number) => Partial<DayWeather>) =>
  series('2026-09-20', 42, (i, age) => mild(day(i, age)));

describe('output shape', () => {
  const scores = computeScores(scenarioByKey('ideal-autumn').days);

  test('one integer score in 0..100 per input day, aligned by date', () => {
    const days = scenarioByKey('ideal-autumn').days;
    expect(scores).toHaveLength(days.length);
    scores.forEach((s, i) => {
      expect(s.date).toBe(days[i]!.date);
      expect(Number.isInteger(s.score)).toBe(true);
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
    });
  });

  test('the rating matches the score', () => {
    const top = scores.at(-1)!;
    expect(top.rating.key).toBe('excellent');
  });

  test('an empty series scores nothing', () => {
    expect(computeScores([])).toEqual([]);
  });

  test('warms up once a full sustain window lies behind a day', () => {
    expect(scores[DEFAULT_PARAMS.sustainWindow - 1]!.warmedUp).toBe(false);
    expect(scores[DEFAULT_PARAMS.sustainWindow]!.warmedUp).toBe(true);
  });
});

describe('the water story', () => {
  test('the same rainfall spread out beats a few downpours', () => {
    // Same total; the difference is the infiltration curve (see water-balance).
    expect(totalRain(scenarioByKey('burst-rain').days)).toBe(
      totalRain(scenarioByKey('spread-rain').days),
    );
    expect(scoreOf('spread-rain')).toBeGreaterThan(scoreOf('burst-rain') + 15);
  });

  test('rain yesterday barely moves the damp baseline', () => {
    expect(scoreOf('rain-yesterday') - scoreOf('baseline-damp')).toBeLessThan(20);
  });

  test('eighteen days on, a soaking rain has faded to the baseline', () => {
    expect(Math.abs(scoreOf('rain-eighteen-days-ago') - scoreOf('baseline-damp'))).toBeLessThan(15);
  });

  test('the flush response peaks 4–10 days after a soaking rain', () => {
    const curve = Array.from(
      { length: 18 },
      (_, lag) => lastOf(sept((_i, age) => ({ precip: age === lag ? 32 : 2 }))).score,
    );
    const best = curve.indexOf(Math.max(...curve));
    expect(best).toBeGreaterThanOrEqual(4);
    expect(best).toBeLessThanOrEqual(10);
    expect(curve[0]!).toBeLessThan(curve[best]!);
    expect(curve[1]!).toBeLessThan(curve[best]! - 20);
    expect(curve[17]!).toBeLessThan(curve[best]! - 20);
  });

  test('adding moderate rain in the flush window never hurts a dry stand', () => {
    const base = sept(() => ({}));
    const baseScore = lastOf(base).score;
    for (let lag = 3; lag <= 12; lag++) {
      const wetter = base.map((d, i) => (i === base.length - 1 - lag ? { ...d, precip: 8 } : d));
      expect(lastOf(wetter).score).toBeGreaterThanOrEqual(baseScore);
    }
  });

  test('daily rainfall has an interior optimum, not "more is better"', () => {
    const rates = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 15, 20, 30];
    const curve = rates.map((mm) => lastOf(sept(() => ({ precip: mm }))).score);
    const bestAt = rates[curve.indexOf(Math.max(...curve))]!;
    expect(bestAt).toBeGreaterThanOrEqual(3);
    expect(bestAt).toBeLessThanOrEqual(8);
    // Rising up to the optimum…
    for (let i = 1; rates[i]! < bestAt; i++) {
      expect(curve[i]!).toBeGreaterThanOrEqual(curve[i - 1]!);
    }
    // …falling beyond it, and no cliff on the way down.
    expect(curve.at(-1)!).toBeLessThan(curve[rates.indexOf(5)]! - 20);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]! - curve[i - 1]!).toBeGreaterThan(-30);
    }
  });

  test('snow is banked, not counted, until it melts', () => {
    const scores = computeScores(scenarioByKey('snow-then-thaw').days);
    const frozen = scores[30]!; // two weeks of snowfall behind it
    expect(frozen.snowpack).toBeGreaterThan(100);
    expect(frozen.components.moisture).toBeLessThan(0.2);
    expect(frozen.score).toBeLessThan(10);
    const thawed = scores.at(-1)!;
    expect(thawed.snowpack).toBeLessThan(1);
    expect(thawed.components.moisture).toBeGreaterThan(0.8);
  });
});

describe('temperature, events and season', () => {
  test('temperature can veto otherwise good moisture', () => {
    const ideal = scoreOf('ideal-autumn');
    expect(scoreOf('wet-cold')).toBeLessThan(ideal / 2);
    expect(scoreOf('wet-hot')).toBeLessThan(ideal / 2);
  });

  test('a hard frost collapses the score and says so', () => {
    const day = lastOf(scenarioByKey('frost').days);
    expect(day.score).toBeLessThan(25);
    expect(day.notes).toContain('hard-frost');
  });

  test('identical weather scores far lower in January', () => {
    const january = scoreOf('winter-ideal');
    expect(january).toBeLessThan(0.4 * scoreOf('decent-autumn'));
    // …and disabling the season factor removes exactly that effect.
    expect(scoreOf('winter-ideal', { useSeason: false })).toBeGreaterThan(3 * january);
  });

  test('elevation shortens the season for the same weather', () => {
    const days = scenarioByKey('october-lowland').days;
    const at = (elevation: number) => lastOf(days, { elevation }).score;
    expect(at(1500)).toBeLessThan(at(550));
    expect(at(2000)).toBeLessThan(at(1500));
  });

  test('the modifier never exceeds the diurnal bonus', () => {
    for (const d of computeScores(scenarioByKey('ideal-autumn').days)) {
      expect(d.components.modifier).toBeLessThanOrEqual(DEFAULT_PARAMS.diurnalBonus);
    }
  });
});

describe('notes', () => {
  test('explain the limiting factor first', () => {
    expect(lastOf(scenarioByKey('wet-cold').days).notes[0]).toBe('too-cold');
    expect(lastOf(scenarioByKey('wet-hot').days).notes[0]).toBe('too-warm');
    expect(lastOf(scenarioByKey('drying-out').days).notes).toContain('too-dry');
    expect(lastOf(scenarioByKey('waterlogged').days).notes[0]).toBe('saturated');
    expect(lastOf(scenarioByKey('baseline-damp').days).notes[0]).toBe('no-trigger');
  });

  test('a good day needs no excuses', () => {
    expect(lastOf(scenarioByKey('ideal-autumn').days).notes).toEqual(['diurnal-trigger']);
  });
});

describe('parameters', () => {
  test('the defaults are used when none are passed', () => {
    const days = scenarioByKey('decent-autumn').days;
    expect(computeScores(days)).toEqual(computeScores(days, { params: DEFAULT_PARAMS }));
  });

  test('overrides change the outcome', () => {
    const days = scenarioByKey('decent-autumn').days;
    const thirsty = resolveParams({ moistureRamp: [30, 80] });
    expect(lastOf(days, { params: thirsty }).score).toBeLessThan(lastOf(days).score);
  });

  test('a harsher frost factor lowers a frosty day', () => {
    const days = scenarioByKey('frost').days;
    const harsh = resolveParams({ frostHardFactor: 0 });
    expect(lastOf(days, { params: harsh }).score).toBe(0);
  });
});

describe('incomplete data', () => {
  test('missing forecast fields degrade gracefully', () => {
    const days = series('2026-09-20', 30, () => ({
      tMin: 9,
      tMean: null,
      tMax: 19,
      precip: 4,
    }));
    const last = lastOf(days);
    expect(last.score).toBeGreaterThan(0);
    expect(last.score).toBeLessThanOrEqual(100);
  });

  test('a fully missing day never produces NaN', () => {
    const days = sept((i) => ({ precip: i % 2 ? 0 : 6 })).map((d, i) =>
      i === 40 ? { ...d, tMin: null, tMean: null, tMax: null, precip: null } : d,
    );
    for (const s of computeScores(days)) {
      expect(Number.isNaN(s.score)).toBe(false);
    }
  });
});
