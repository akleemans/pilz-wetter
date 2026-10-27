/**
 * What the page remembers: the chosen place (in the URL, so links can be
 * shared, and in localStorage) and the model parameter overrides (in
 * localStorage, shared by the forecast and the scenario page).
 */

import { diffParams, type ModelParams, resolveParams } from '../model/params.ts';
import { DEFAULT_PLACE, findPlace, type Place } from './places.ts';

const PLACE_KEY = 'pilzwetter.place';
const PARAMS_KEY = 'pilzwetter.params';

/* Storage can be missing or throw (private mode, blocked site data). */
const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null) => {
  try {
    if (value == null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    /* the URL still works */
  }
};

const inSwitzerlandIsh = (lat: number, lon: number) =>
  lat > 45 && lat < 48.5 && lon > 5 && lon < 11;

/**
 * `?ort=Thun` names a listed place; `?ort=Jaunpass&lat=46.592&lon=7.338` any
 * place. Returns null when the URL names nothing usable.
 */
export function placeFromSearch(search: string): Place | null {
  const params = new URLSearchParams(search);
  const name = params.get('ort')?.trim();
  const lat = Number(params.get('lat'));
  const lon = Number(params.get('lon'));
  if (params.has('lat') && params.has('lon') && inSwitzerlandIsh(lat, lon)) {
    return { name: name || `${lat.toFixed(3)}, ${lon.toFixed(3)}`, lat, lon };
  }
  return name ? (findPlace(name) ?? null) : null;
}

/** The URL for `place`, keeping any other query parameters. */
export function urlWithPlace(href: string, place: Place): string {
  const url = new URL(href);
  url.searchParams.delete('ort');
  url.searchParams.delete('lat');
  url.searchParams.delete('lon');
  // Old links to the station list are dead weight now.
  url.searchParams.delete('station');
  const listed = findPlace(place.name);
  const isListed = listed && listed.lat === place.lat && listed.lon === place.lon;
  if (!(isListed && listed === DEFAULT_PLACE)) {
    url.searchParams.set('ort', place.name);
  }
  if (!isListed) {
    url.searchParams.set('lat', place.lat.toFixed(4));
    url.searchParams.set('lon', place.lon.toFixed(4));
  }
  return url.toString();
}

export function parseStoredPlace(raw: string | null): Place | null {
  if (!raw) {
    return null;
  }
  try {
    const p = JSON.parse(raw) as Partial<Place>;
    return typeof p.name === 'string' &&
      typeof p.lat === 'number' &&
      typeof p.lon === 'number' &&
      inSwitzerlandIsh(p.lat, p.lon)
      ? { name: p.name, lat: p.lat, lon: p.lon, ...(p.detail ? { detail: String(p.detail) } : {}) }
      : null;
  } catch {
    return null;
  }
}

/** The URL wins over the remembered place, which wins over the default. */
export function initialPlace(): Place {
  return placeFromSearch(location.search) ?? parseStoredPlace(read(PLACE_KEY)) ?? DEFAULT_PLACE;
}

export function rememberPlace(place: Place) {
  write(PLACE_KEY, JSON.stringify(place));
  history.replaceState(null, '', urlWithPlace(location.href, place));
}

export function loadParams(): ModelParams {
  const raw = read(PARAMS_KEY);
  if (!raw) {
    return resolveParams();
  }
  try {
    return resolveParams(JSON.parse(raw));
  } catch {
    return resolveParams();
  }
}

export function saveParams(params: ModelParams) {
  const overrides = diffParams(params);
  write(PARAMS_KEY, Object.keys(overrides).length ? JSON.stringify(overrides) : null);
}

/** Fires when another tab (e.g. the scenario page) changes the parameters. */
export function onParamsChangedElsewhere(callback: (params: ModelParams) => void) {
  window.addEventListener('storage', (event) => {
    if (event.key === PARAMS_KEY) {
      callback(loadParams());
    }
  });
}
