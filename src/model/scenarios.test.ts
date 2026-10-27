import { describe, expect, test } from 'bun:test';
import { bandRange, evaluateAll } from './evaluate.ts';
import { ratingBands } from './ratings.ts';
import { COMPARISONS, SCENARIOS, scenarioByKey, series } from './scenarios.ts';

const { results, comparisons } = evaluateAll();

describe('scenario catalogue', () => {
  test('keys are unique and every scenario is six weeks long', () => {
    expect(new Set(SCENARIOS.map((s) => s.key)).size).toBe(SCENARIOS.length);
    for (const s of SCENARIOS) {
      expect(s.days).toHaveLength(42);
    }
  });

  test('every scenario explains itself', () => {
    for (const s of SCENARIOS) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.story.length).toBeGreaterThan(0);
      expect(s.why.length).toBeGreaterThan(0);
    }
  });

  test('expected bands are ordered low to high', () => {
    for (const s of SCENARIOS) {
      const [lo, hi] = bandRange(s.expect);
      expect(lo).toBeLessThan(hi);
    }
  });

  test('comparisons refer to existing scenarios', () => {
    for (const c of COMPARISONS) {
      expect(() => scenarioByKey(c.better)).not.toThrow();
      expect(() => scenarioByKey(c.worse)).not.toThrow();
    }
  });

  test('series builds consecutive dates ending on the given day', () => {
    const days = series('2026-03-02', 3, () => ({
      tMin: 0,
      tMean: 0,
      tMax: 0,
      precip: 0,
    }));
    expect(days.map((d) => d.date)).toEqual(['2026-02-28', '2026-03-01', '2026-03-02']);
  });
});

test('bandRange spans whole rating bands', () => {
  expect(bandRange(['poor', 'poor'])).toEqual([0, 29]);
  expect(bandRange(['moderate', 'good'])).toEqual([30, 79]);
  expect(bandRange(['excellent', 'excellent'])).toEqual([80, 100]);
  expect(ratingBands()).toHaveLength(4);
});

describe('each scenario lands in its expected band', () => {
  for (const r of results) {
    const name = `${r.scenario.key}: ${r.scenario.title} → ${r.range[0]}–${r.range[1]}`;
    if (r.scenario.open && !r.meetsExpectation) {
      // Known disagreement, waiting for a forager's verdict (see scenarios.ts).
      // `bun test --todo` runs it and shows how far off the model is.
      test.todo(`${name} (open question, currently ${r.last.score})`, () => {
        expect(r.last.score).toBeGreaterThanOrEqual(r.range[0]);
        expect(r.last.score).toBeLessThanOrEqual(r.range[1]);
      });
    } else {
      test(name, () => {
        expect(r.last.score).toBeGreaterThanOrEqual(r.range[0]);
        expect(r.last.score).toBeLessThanOrEqual(r.range[1]);
      });
    }
  }
});

test('open scenarios that now meet their expectation should be closed', () => {
  const resolved = results.filter((r) => r.scenario.open && r.meetsExpectation);
  expect(resolved.map((r) => r.scenario.key)).toEqual([]);
});

describe('comparisons hold', () => {
  for (const c of comparisons) {
    test(`${c.comparison.better} beats ${c.comparison.worse} by ≥ ${c.comparison.by}`, () => {
      expect(c.better - c.worse).toBeGreaterThanOrEqual(c.comparison.by);
    });
  }
});

/*
 * Pins the exact score of every scenario. This is not a statement that the
 * numbers are right (the bands above are), it makes every effect of a
 * parameter change visible in review. After an intentional change, run
 * `bun test --update-snapshots` and commit the new snapshot.
 */
test('scenario scores (snapshot)', () => {
  expect(Object.fromEntries(results.map((r) => [r.scenario.key, r.last.score]))).toMatchSnapshot();
});
