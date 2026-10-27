import { expect, test } from 'bun:test';
import { ratingBands, ratingByKey, ratingFor } from './ratings.ts';

test('ratings partition 0..100 without gaps', () => {
  for (let n = 0; n <= 100; n++) {
    expect(ratingFor(n).key).toBeString();
  }
  expect(ratingFor(100).key).toBe('excellent');
  expect(ratingFor(80).key).toBe('excellent');
  expect(ratingFor(79).key).toBe('good');
  expect(ratingFor(55).key).toBe('good');
  expect(ratingFor(54).key).toBe('moderate');
  expect(ratingFor(30).key).toBe('moderate');
  expect(ratingFor(29).key).toBe('poor');
  expect(ratingFor(0).key).toBe('poor');
});

test('bands cover 0..100 in ascending order', () => {
  const bands = ratingBands();
  expect(bands.map((b) => [b.min, b.max])).toEqual([
    [0, 29],
    [30, 54],
    [55, 79],
    [80, 100],
  ]);
});

test('ratings can be looked up by key', () => {
  expect(ratingByKey('good').label).toBe('Gut');
});
