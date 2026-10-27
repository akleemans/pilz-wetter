import { expect, test } from 'bun:test';
import { mild, series } from '../model/scenarios.ts';
import { computeScores } from '../model/score.ts';
import { SHOWN_PAST_DAYS, visibleRows } from './timeline.ts';

const days = series('2026-09-23', 39, () => mild({ precip: 3 }));
const scores = computeScores(days);

test('shows two weeks back, today and the forecast', () => {
  const rows = visibleRows(days, scores, '2026-09-20', 4);
  expect(rows).toHaveLength(SHOWN_PAST_DAYS + 4);
  expect(rows.filter((r) => r.isToday).map((r) => r.date)).toEqual(['2026-09-20']);
  expect(rows.filter((r) => r.isForecast)).toHaveLength(3);
  expect(rows[0]!.date).toBe('2026-09-06');
});

test('rows carry both weather and score', () => {
  const row = visibleRows(days, scores, '2026-09-20', 4)[0]!;
  expect(row.precip).toBe(3);
  expect(row.score).toBe(scores[days.length - 18]!.score);
});

test('falls back to the API split when today is missing', () => {
  const rows = visibleRows(days, scores, '1999-01-01', 4);
  expect(rows.find((r) => r.isToday)?.date).toBe(days.at(-4)!.date);
});
