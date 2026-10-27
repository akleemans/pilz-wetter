import { describe, expect, test } from 'bun:test';
import forecast from './fixtures/open-meteo-jaunpass.json';
import {
  archiveUrl,
  FORECAST_DAYS,
  forecastUrl,
  loadForecast,
  PAST_DAYS,
  parseForecast,
  todayIso,
} from './weather.ts';

describe('forecastUrl', () => {
  test('asks for the four daily series, history and forecast', () => {
    const url = new URL(forecastUrl({ lat: 46.59196, lon: 7.33841 }));
    expect(url.host).toBe('api.open-meteo.com');
    expect(url.searchParams.get('latitude')).toBe('46.5920');
    expect(url.searchParams.get('longitude')).toBe('7.3384');
    expect(url.searchParams.get('daily')?.split(',')).toHaveLength(4);
    expect(url.searchParams.get('past_days')).toBe(String(PAST_DAYS));
    expect(url.searchParams.get('forecast_days')).toBe(String(FORECAST_DAYS));
    expect(url.searchParams.get('timezone')).toBe('Europe/Zurich');
  });
});

describe('parseForecast', () => {
  test('reads a real response', () => {
    const { days, elevation } = parseForecast(forecast);
    expect(days).toHaveLength(PAST_DAYS + FORECAST_DAYS);
    expect(elevation).toBeGreaterThan(1400);
    for (const d of days) {
      expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(d.precip).toBeGreaterThanOrEqual(0);
    }
  });

  test('turns missing values into null', () => {
    const { days, elevation } = parseForecast({
      daily: {
        time: ['2026-09-01'],
        temperature_2m_max: [null],
        temperature_2m_min: [3],
        temperature_2m_mean: [],
        precipitation_sum: ['x'],
      },
    });
    expect(elevation).toBeNull();
    expect(days).toEqual([{ date: '2026-09-01', tMax: null, tMin: 3, tMean: null, precip: null }]);
  });

  test('rejects responses without daily data', () => {
    expect(() => parseForecast({ error: true, reason: 'x' })).toThrow();
    expect(() => parseForecast(null)).toThrow();
  });
});

test('loadForecast reports HTTP errors', async () => {
  const fetchStub = (async () => new Response('{}', { status: 429 })) as unknown as typeof fetch;
  expect(loadForecast({ lat: 46.9, lon: 7.4 }, { fetch: fetchStub })).rejects.toThrow('429');
});

test('todayIso uses Swiss time', () => {
  // 23:30 UTC on 31 December is already New Year in Zurich.
  expect(todayIso(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
});

test('archiveUrl covers the warm-up window up to the given day', () => {
  const url = new URL(archiveUrl({ lat: 46.6, lon: 7.3 }, '2025-09-12'));
  expect(url.host).toBe('archive-api.open-meteo.com');
  expect(url.searchParams.get('end_date')).toBe('2025-09-12');
  expect(url.searchParams.get('start_date')).toBe('2025-08-08');
});
