/**
 * Four bands, not five: a five-step red→amber→green ramp cannot keep adjacent
 * bands far enough apart to be told apart reliably, and the exact number is
 * printed on the bar anyway.
 */

export const RATINGS = [
  { min: 80, key: 'excellent', label: 'Hervorragend' },
  { min: 55, key: 'good', label: 'Gut' },
  { min: 30, key: 'moderate', label: 'Mässig' },
  { min: 0, key: 'poor', label: 'Schlecht' },
] as const;

export type Rating = (typeof RATINGS)[number];

const LOWEST: Rating = RATINGS[3];
export type RatingKey = Rating['key'];

export function ratingFor(score: number): Rating {
  return RATINGS.find((r) => score >= r.min) ?? LOWEST;
}

/** The inclusive score range of each band, lowest first. */
export function ratingBands(): Array<Rating & { max: number }> {
  const ascending = [...RATINGS].reverse();
  return ascending.map((r, i) => ({
    ...r,
    max: (ascending[i + 1]?.min ?? 101) - 1,
  }));
}

export const ratingByKey = (key: RatingKey): Rating => RATINGS.find((r) => r.key === key) ?? LOWEST;
