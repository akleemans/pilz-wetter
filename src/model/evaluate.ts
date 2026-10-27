/**
 * Scores the reference scenarios and checks them against their expectations.
 * Shared by the tests, the CLI report and the scenario page.
 */

import { DEFAULT_PARAMS, type ModelParams } from './params.ts';
import { ratingBands, ratingFor, type RatingKey } from './ratings.ts';
import { COMPARISONS, type Comparison, SCENARIOS, type Scenario } from './scenarios.ts';
import { computeScores, type DayScore } from './score.ts';

export interface ScenarioResult {
  readonly scenario: Scenario;
  readonly scores: ReadonlyArray<DayScore>;
  readonly last: DayScore;
  /** Inclusive score range of the expected bands. */
  readonly range: readonly [number, number];
  readonly meetsExpectation: boolean;
}

export interface ComparisonResult {
  readonly comparison: Comparison;
  readonly better: number;
  readonly worse: number;
  readonly holds: boolean;
}

/** Inclusive score range spanned by two rating bands. */
export function bandRange([low, high]: readonly [RatingKey, RatingKey]): [number, number] {
  const bands = ratingBands();
  const band = (key: RatingKey) => bands.find((b) => b.key === key)!;
  return [band(low).min, band(high).max];
}

export function evaluateScenario(
  scenario: Scenario,
  params: ModelParams = DEFAULT_PARAMS,
): ScenarioResult {
  const scores = computeScores(scenario.days, {
    params,
    elevation: scenario.elevation ?? null,
  });
  const last = scores.at(-1)!;
  const range = bandRange(scenario.expect);
  return {
    scenario,
    scores,
    last,
    range,
    meetsExpectation: last.score >= range[0] && last.score <= range[1],
  };
}

export function evaluateAll(params: ModelParams = DEFAULT_PARAMS) {
  const results = SCENARIOS.map((s) => evaluateScenario(s, params));
  const scoreOf = (key: string) =>
    results.find((r) => r.scenario.key === key)?.last.score ?? Number.NaN;
  const comparisons: Array<ComparisonResult> = COMPARISONS.map((comparison) => {
    const better = scoreOf(comparison.better);
    const worse = scoreOf(comparison.worse);
    return { comparison, better, worse, holds: better - worse >= comparison.by };
  });
  return { results, comparisons };
}

export { ratingFor };
