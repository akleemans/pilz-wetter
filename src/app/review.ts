/**
 * Reviewer answers on the scenario page: a rating and a comment per scenario,
 * kept in localStorage, and exported as plain text to send back.
 */

import { diffParams, type ModelParams } from '../model/params.ts';
import { RATINGS, type RatingKey } from '../model/ratings.ts';
import type { ScenarioResult } from '../model/evaluate.ts';

const KEY = 'pilzwetter.review';

export interface ScenarioReview {
  rating?: RatingKey;
  comment?: string;
}

export interface Review {
  reviewer?: string;
  scenarios: Record<string, ScenarioReview>;
}

const isRating = (v: unknown): v is RatingKey => RATINGS.some((r) => r.key === v);

export function parseReview(raw: string | null): Review {
  try {
    const data = JSON.parse(raw ?? '') as Partial<Review>;
    const scenarios: Record<string, ScenarioReview> = {};
    for (const [key, value] of Object.entries(data.scenarios ?? {})) {
      scenarios[key] = {
        ...(isRating(value?.rating) ? { rating: value.rating } : {}),
        ...(typeof value?.comment === 'string' ? { comment: value.comment } : {}),
      };
    }
    return { ...(typeof data.reviewer === 'string' ? { reviewer: data.reviewer } : {}), scenarios };
  } catch {
    return { scenarios: {} };
  }
}

export function loadReview(): Review {
  try {
    return parseReview(localStorage.getItem(KEY));
  } catch {
    return { scenarios: {} };
  }
}

export function saveReview(review: Review) {
  try {
    localStorage.setItem(KEY, JSON.stringify(review));
  } catch {
    /* the export still works for this visit */
  }
}

const label = (key: RatingKey) => RATINGS.find((r) => r.key === key)!.label;

/** The review as plain text, ready to paste into a mail. */
export function reviewText(
  review: Review,
  results: ReadonlyArray<ScenarioResult>,
  params: ModelParams,
): string {
  const lines = [
    'Rückmeldung zu den Pilzwetter-Prüfszenarien',
    ...(review.reviewer?.trim() ? [`Von: ${review.reviewer.trim()}`] : []),
    '',
  ];
  let answered = 0;
  for (const r of results) {
    const answer = review.scenarios[r.scenario.key];
    if (!answer?.rating && !answer?.comment?.trim()) {
      continue;
    }
    answered++;
    lines.push(
      `## ${r.scenario.title} (${r.scenario.key})`,
      `Modell: ${r.last.score} (${r.last.rating.label})`,
    );
    if (answer.rating) {
      lines.push(`Meine Einschätzung: ${label(answer.rating)}`);
    }
    if (answer.comment?.trim()) {
      lines.push(`Kommentar: ${answer.comment.trim()}`);
    }
    lines.push('');
  }
  if (!answered) {
    lines.push('(Noch keine Szenarien bewertet.)', '');
  }
  const overrides = diffParams(params);
  if (Object.keys(overrides).length) {
    lines.push('Berechnet mit angepassten Parametern:', JSON.stringify(overrides));
  }
  return lines.join('\n').trimEnd();
}
