import { expect, test } from 'bun:test';
import { DEFAULT_PLACE, filterPlaces, findPlace, normalize, PLACES, samePlace } from './places.ts';

test('the list is one alphabetical list without duplicates', () => {
  const names = PLACES.map((p) => p.name);
  expect(names).toEqual([...names].sort(new Intl.Collator('de-CH').compare));
  expect(new Set(names).size).toBe(names.length);
  expect(names[0]).toBe('Aarberg');
});

test('every place lies in or near the canton of Bern', () => {
  for (const p of PLACES) {
    expect(p.lat).toBeGreaterThan(46.3);
    expect(p.lat).toBeLessThan(47.4);
    expect(p.lon).toBeGreaterThan(6.8);
    expect(p.lon).toBeLessThan(8.5);
  }
});

test('the default is Bern', () => {
  expect(DEFAULT_PLACE.name).toBe('Bern');
});

test('normalize ignores case, accents and whitespace', () => {
  expect(normalize('  Lüderenalp ')).toBe('luderenalp');
  expect(normalize('ÄTZLISCHWAND')).toBe('atzlischwand');
});

test('findPlace matches names loosely', () => {
  expect(findPlace('thun')?.name).toBe('Thun');
  expect(findPlace('Muhleberg')?.name).toBe('Mühleberg');
  expect(findPlace('Atlantis')).toBeUndefined();
});

test('filterPlaces matches every word, prefix matches first', () => {
  expect(filterPlaces('')).toHaveLength(PLACES.length);
  expect(filterPlaces('krauch').map((p) => p.name)).toEqual([
    'Krauchthal, Dieterswald',
    'Krauchthal, Lindenfeld',
  ]);
  expect(filterPlaces('krauch linden').map((p) => p.name)).toEqual(['Krauchthal, Lindenfeld']);
  // "Ins" and "Interlaken" start with "in", "Grindelwald" only contains it.
  const names = filterPlaces('in').map((p) => p.name);
  expect(names.slice(0, 2)).toEqual(['Ins', 'Interlaken']);
  expect(names).toContain('Grindelwald, Oberläger');
  expect(filterPlaces('xyz')).toEqual([]);
});

test('samePlace allows a few hundred metres', () => {
  const thun = findPlace('Thun')!;
  expect(samePlace(thun, { ...thun, lat: thun.lat + 0.002 })).toBe(true);
  expect(samePlace(thun, { ...thun, lat: thun.lat + 0.02 })).toBe(false);
});
