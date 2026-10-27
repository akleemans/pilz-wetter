/** Which of the fetched days the page shows, and how. */

import type { DayScore } from '../model/score.ts';
import type { DayWeather } from '../model/types.ts';

export const SHOWN_PAST_DAYS = 14;

export type Row = DayWeather &
  DayScore & {
    readonly isToday: boolean;
    readonly isForecast: boolean;
  };

/**
 * The last 14 days, today and the forecast. If today is not in the data (a
 * clock off by a day, a stale response), the API's own split is used: the
 * forecast days are the last `forecastDays` entries.
 */
export function visibleRows(
  days: ReadonlyArray<DayWeather>,
  scores: ReadonlyArray<DayScore>,
  today: string,
  forecastDays: number,
): Array<Row> {
  let todayIdx = days.findIndex((d) => d.date === today);
  if (todayIdx < 0) {
    todayIdx = Math.max(0, days.length - forecastDays);
  }
  const from = Math.max(0, todayIdx - SHOWN_PAST_DAYS);
  return days.slice(from).map((day, k) => {
    const i = from + k;
    return {
      ...day,
      ...scores[i]!,
      isToday: i === todayIdx,
      isForecast: i > todayIdx,
    };
  });
}
