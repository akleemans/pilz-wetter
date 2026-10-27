import { describe, expect, test } from 'bun:test';
import bremg from './fixtures/swisstopo-bremg.json';
import jaunpa from './fixtures/swisstopo-jaunpa.json';
import { parseLabel, parseResults, searchPlaces, searchUrl } from './geosearch.ts';

describe('parseLabel', () => {
  test('reads gazetteer labels', () => {
    expect(parseLabel('<i>Pass</i> <b>Jaunpass</b> (BE) - Boltigen', 'gazetteer')).toEqual({
      name: 'Jaunpass',
      type: 'Pass',
      canton: 'BE',
      municipality: 'Boltigen',
    });
  });

  test('reads municipality labels', () => {
    expect(parseLabel('<b>Thun (BE)</b>', 'gg25')).toEqual({
      name: 'Thun',
      type: 'Gemeinde',
      canton: 'BE',
      municipality: null,
    });
  });

  test('copes with line breaks and a repeated canton', () => {
    expect(
      parseLabel('<i>Ort</i> <b>Fohlenweid\n</b> (AG) - Bremgarten (AG)', 'gazetteer'),
    ).toMatchObject({ name: 'Fohlenweid', municipality: 'Bremgarten' });
  });

  test('rejects labels without a name', () => {
    expect(parseLabel('<i>Ort</i>', 'gazetteer')).toBeNull();
    expect(parseLabel('Thun', 'gg25')).toBeNull();
  });
});

describe('parseResults', () => {
  test('finds Jaunpass once, although swisstopo lists it six times', () => {
    const places = parseResults(jaunpa);
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({
      name: 'Jaunpass',
      canton: 'BE',
      detail: 'Ort · Boltigen (BE)',
    });
    expect(places[0]!.lat).toBeCloseTo(46.592, 2);
    expect(places[0]!.lon).toBeCloseTo(7.338, 2);
  });

  test('puts places in the canton of Bern first', () => {
    const places = parseResults(bremg);
    expect(places[0]!.name).toBe('Bremgarten bei Bern');
    const firstElsewhere = places.findIndex((p) => p.canton !== 'BE');
    expect(places.slice(firstElsewhere).every((p) => p.canton !== 'BE')).toBe(true);
  });

  test('drops near-duplicates and feature types nobody forages at', () => {
    const places = parseResults({
      results: [
        { attrs: { label: '<b>Thun (BE)</b>', origin: 'gg25', lat: 46.74, lon: 7.61 } },
        {
          attrs: {
            label: '<i>Ausfahrt</i> <b>Thun-Nord</b> (BE) - Heimberg',
            origin: 'gazetteer',
            lat: 46.78,
            lon: 7.6,
          },
        },
        {
          attrs: {
            label: '<b>Thun</b> (BE) - Heimberg,Thun',
            origin: 'gazetteer',
            lat: 46.751,
            lon: 7.617,
          },
        },
        { attrs: { label: '<i>Gipfel</i> <b>Niesen</b> (BE) - Reichenbach', origin: 'gazetteer' } },
      ],
    });
    expect(places.map((p) => p.name)).toEqual(['Thun']);
  });

  test('tolerates garbage', () => {
    expect(parseResults(null)).toEqual([]);
    expect(parseResults({ results: [{}, { attrs: {} }] })).toEqual([]);
  });
});

describe('searchPlaces', () => {
  test('asks swisstopo for municipalities and gazetteer names', () => {
    const url = new URL(searchUrl('Jaunpass'));
    expect(url.host).toBe('api3.geo.admin.ch');
    expect(url.searchParams.get('searchText')).toBe('Jaunpass');
    expect(url.searchParams.get('sr')).toBe('4326');
  });

  test('skips the request for queries shorter than two characters', async () => {
    let called = false;
    const fetchStub = (async () => {
      called = true;
      return Response.json(jaunpa);
    }) as unknown as typeof fetch;
    expect(await searchPlaces(' j ', { fetch: fetchStub })).toEqual([]);
    expect(called).toBe(false);
  });

  test('returns parsed places', async () => {
    const fetchStub = (async () => Response.json(jaunpa)) as unknown as typeof fetch;
    const places = await searchPlaces('Jaunpa', { fetch: fetchStub });
    expect(places.map((p) => p.name)).toEqual(['Jaunpass']);
  });

  test('reports HTTP errors', async () => {
    const fetchStub = (async () =>
      new Response('nope', { status: 503 })) as unknown as typeof fetch;
    expect(searchPlaces('Jaunpa', { fetch: fetchStub })).rejects.toThrow('503');
  });
});
