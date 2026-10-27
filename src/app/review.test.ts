import { expect, test } from 'bun:test';
import { evaluateAll } from '../model/evaluate.ts';
import { DEFAULT_PARAMS, resolveParams } from '../model/params.ts';
import { parseReview, reviewText } from './review.ts';

const { results } = evaluateAll();

test('parseReview keeps valid answers and drops the rest', () => {
  expect(parseReview(null)).toEqual({ scenarios: {} });
  expect(parseReview('{oops')).toEqual({ scenarios: {} });
  expect(
    parseReview(
      JSON.stringify({
        reviewer: 'Anna',
        scenarios: { a: { rating: 'good', comment: 'ok' }, b: { rating: 'superb', comment: 3 } },
      }),
    ),
  ).toEqual({ reviewer: 'Anna', scenarios: { a: { rating: 'good', comment: 'ok' }, b: {} } });
});

test('reviewText lists answered scenarios with the model verdict', () => {
  const text = reviewText(
    {
      reviewer: 'Anna',
      scenarios: {
        'drought-broken-recently': { rating: 'moderate', comment: 'Eher zwei Wochen.' },
        'ideal-autumn': {},
      },
    },
    results,
    DEFAULT_PARAMS,
  );
  expect(text).toContain('Von: Anna');
  expect(text).toContain('(drought-broken-recently)');
  expect(text).toContain('Meine Einschätzung: Mässig');
  expect(text).toContain('Kommentar: Eher zwei Wochen.');
  expect(text).not.toContain('ideal-autumn');
  expect(text).not.toContain('angepassten Parametern');
});

test('reviewText says so when nothing is answered, and names custom parameters', () => {
  const text = reviewText({ scenarios: {} }, results, resolveParams({ fieldCapacity: 99 }));
  expect(text).toContain('Noch keine Szenarien bewertet');
  expect(text).toContain('{"fieldCapacity":99}');
});
