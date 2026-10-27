import { expect, test } from 'bun:test';
import { DEFAULT_PLACE, findPlace } from './places.ts';
import { parseStoredPlace, placeFromSearch, urlWithPlace } from './state.ts';

const BASE = 'https://example.github.io/pilz-wetter/';

test('a listed place needs only its name in the URL', () => {
  const thun = findPlace('Thun')!;
  const url = urlWithPlace(BASE, thun);
  expect(url).toBe(`${BASE}?ort=Thun`);
  expect(placeFromSearch(new URL(url).search)).toEqual(thun);
});

test('the default place keeps the URL clean', () => {
  expect(urlWithPlace(`${BASE}?ort=Thun&station=BER`, DEFAULT_PLACE)).toBe(BASE);
});

test('any other place travels with its coordinates', () => {
  const jaunpass = { name: 'Jaunpass', lat: 46.59196, lon: 7.33841 };
  const url = urlWithPlace(BASE, jaunpass);
  expect(url).toContain('ort=Jaunpass');
  expect(url).toContain('lat=46.5920');
  expect(placeFromSearch(new URL(url).search)).toEqual({
    name: 'Jaunpass',
    lat: 46.592,
    lon: 7.3384,
  });
});

test('other query parameters survive', () => {
  expect(urlWithPlace(`${BASE}?debug=1`, findPlace('Ins')!)).toBe(`${BASE}?debug=1&ort=Ins`);
});

test('unusable URLs name nothing', () => {
  expect(placeFromSearch('')).toBeNull();
  expect(placeFromSearch('?ort=Atlantis')).toBeNull();
  expect(placeFromSearch('?lat=0&lon=0')).toBeNull();
  expect(placeFromSearch('?lat=46.9&lon=abc')).toBeNull();
});

test('coordinates without a name get one', () => {
  expect(placeFromSearch('?lat=46.9&lon=7.4')?.name).toBe('46.900, 7.400');
});

test('stored places are validated', () => {
  const stored = { name: 'Jaunpass', lat: 46.592, lon: 7.338, detail: 'Pass' };
  expect(parseStoredPlace(JSON.stringify(stored))).toEqual(stored);
  expect(parseStoredPlace(null)).toBeNull();
  expect(parseStoredPlace('{broken')).toBeNull();
  expect(parseStoredPlace('{"name":"x","lat":"1","lon":2}')).toBeNull();
  expect(parseStoredPlace('{"name":"Paris","lat":48.86,"lon":2.35}')).toBeNull();
});
