/** Daily weather for a place from Open-Meteo (free, no key, CORS enabled). */

import type { DayWeather } from '../model/types.ts';
import type { Place } from './places.ts';

export const TIMEZONE = 'Europe/Zurich';
/** 14 shown + 21 of warm-up for the water balance. */
export const PAST_DAYS = 35;
/** Today + 3. */
export const FORECAST_DAYS = 4;

const DAILY = [
  'temperature_2m_max',
  'temperature_2m_min',
  'temperature_2m_mean',
  'precipitation_sum',
] as const;

export interface Forecast {
  readonly days: Array<DayWeather>;
  /** Elevation Open-Meteo used for the coordinates (m a.s.l.). */
  readonly elevation: number | null;
}

export function forecastUrl(place: Pick<Place, 'lat' | 'lon'>): string {
  const params = new URLSearchParams({
    latitude: place.lat.toFixed(4),
    longitude: place.lon.toFixed(4),
    daily: DAILY.join(','),
    past_days: String(PAST_DAYS),
    forecast_days: String(FORECAST_DAYS),
    timezone: TIMEZONE,
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

/**
 * Historical daily weather (ERA5 based) for `days` days up to and including
 * `endDate`, for checking the model against past finds.
 */
export function archiveUrl(
  place: Pick<Place, 'lat' | 'lon'>,
  endDate: string,
  days = PAST_DAYS + 1,
): string {
  const end = Date.parse(`${endDate}T12:00:00Z`);
  const start = new Date(end - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const params = new URLSearchParams({
    latitude: place.lat.toFixed(4),
    longitude: place.lon.toFixed(4),
    daily: DAILY.join(','),
    start_date: start,
    end_date: endDate,
    timezone: TIMEZONE,
  });
  return `https://archive-api.open-meteo.com/v1/archive?${params}`;
}

type Daily = Record<(typeof DAILY)[number], Array<number | null>> & {
  time: Array<string>;
};

const valueAt = (series: Array<number | null> | undefined, i: number) => {
  const v = series?.[i];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};

export function parseForecast(json: unknown): Forecast {
  const body = json as { daily?: Partial<Daily>; elevation?: unknown } | null;
  const daily = body?.daily;
  if (!daily || !Array.isArray(daily.time)) {
    throw new Error('Unerwartete Antwort von Open-Meteo');
  }
  return {
    elevation: typeof body.elevation === 'number' ? body.elevation : null,
    days: daily.time.map((date, i) => ({
      date,
      tMax: valueAt(daily.temperature_2m_max, i),
      tMin: valueAt(daily.temperature_2m_min, i),
      tMean: valueAt(daily.temperature_2m_mean, i),
      precip: valueAt(daily.precipitation_sum, i),
    })),
  };
}

export async function loadForecast(
  place: Pick<Place, 'lat' | 'lon'>,
  { fetch: fetchImpl = fetch, signal }: { fetch?: typeof fetch; signal?: AbortSignal } = {},
): Promise<Forecast> {
  const res = await fetchImpl(forecastUrl(place), { signal });
  if (!res.ok) {
    throw new Error(`Open-Meteo antwortete mit ${res.status}`);
  }
  return parseForecast(await res.json());
}

/** Today's date in Switzerland, `YYYY-MM-DD`. */
export const todayIso = (now = new Date()) =>
  now.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
