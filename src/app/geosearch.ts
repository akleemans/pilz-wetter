/**
 * Free-text place search via the swisstopo location search
 * (api3.geo.admin.ch, no key, CORS enabled). It knows every Swiss locality,
 * pass, summit and field name, so "Jaunpass" or "Gurnigel" just work. Results
 * from the canton of Bern come first.
 */

import { type Place, samePlace } from './places.ts';

const ENDPOINT = 'https://api3.geo.admin.ch/rest/services/api/SearchServer';

/**
 * Gazetteer feature types worth suggesting for a walk in the woods; buildings,
 * motorway exits, campsites and the like are dropped.
 */
const USEFUL_TYPES = new Set([
  'Ort',
  'Pass',
  'Strassenpass',
  'Gipfel',
  'Hauptgipfel',
  'Alpiner Gipfel',
  'Huegel',
  'Haupthuegel',
  'Huegelzug',
  'Aussichtspunkt',
  'Gebiet',
  'Grat',
  'Tal',
  'Haupttal',
  'Graben',
  'Wald',
  'Alp',
  'Flurname swisstopo',
  'Lokalname swisstopo',
]);

/** German display names for the feature types we keep. */
const TYPE_LABEL: Record<string, string> = {
  Strassenpass: 'Pass',
  Hauptgipfel: 'Gipfel',
  'Alpiner Gipfel': 'Gipfel',
  Huegel: 'Hügel',
  Haupthuegel: 'Hügel',
  Huegelzug: 'Hügelzug',
  Haupttal: 'Tal',
  'Flurname swisstopo': 'Flurname',
  'Lokalname swisstopo': 'Lokalname',
};

export interface SearchResult extends Place {
  readonly canton: string | null;
}

interface RawResult {
  attrs?: {
    label?: string;
    origin?: string;
    lat?: number;
    lon?: number;
  };
}

const stripTags = (html: string) =>
  html
    .replaceAll(/<[^>]*>/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim();

/**
 * Parses a swisstopo label. The service returns them as HTML:
 *   gazetteer: `<i>Pass</i> <b>Jaunpass</b> (BE) - Boltigen`
 *   gg25:      `<b>Thun (BE)</b>`
 */
export function parseLabel(
  label: string,
  origin: string,
): {
  name: string;
  type: string | null;
  canton: string | null;
  municipality: string | null;
} | null {
  if (origin === 'gg25') {
    const match = /^(.*?)\s*\(([A-Z]{2})\)$/.exec(stripTags(label));
    return match
      ? { name: match[1]!, type: 'Gemeinde', canton: match[2]!, municipality: null }
      : null;
  }
  const type = /<i>(.*?)<\/i>/.exec(label)?.[1]?.trim() ?? null;
  const name = /<b>([\s\S]*?)<\/b>/.exec(label)?.[1];
  if (!name) {
    return null;
  }
  const rest = stripTags(label.slice(label.lastIndexOf('</b>') + 4));
  const match = /^\(([A-Z]{2})\)\s*(?:-\s*(.*))?$/.exec(rest);
  return {
    name: stripTags(name),
    type,
    canton: match?.[1] ?? null,
    // "Bremgarten (AG)": the canton is already given once.
    municipality: match?.[2]?.replace(/\s*\([A-Z]{2}\)$/, '').trim() || null,
  };
}

/** Raw service results to deduplicated places, canton of Bern first. */
export function parseResults(raw: unknown): Array<SearchResult> {
  const results = (raw as { results?: Array<RawResult> } | null)?.results ?? [];
  const seen = new Set<string>();
  const places: Array<SearchResult> = [];

  for (const { attrs } of results) {
    if (!attrs?.label || attrs.lat == null || attrs.lon == null) {
      continue;
    }
    const parsed = parseLabel(attrs.label, attrs.origin ?? '');
    if (!parsed) {
      continue;
    }
    const isMunicipality = attrs.origin === 'gg25';
    if (!isMunicipality && !(parsed.type && USEFUL_TYPES.has(parsed.type))) {
      continue;
    }
    // The same place often comes as municipality, locality and pass.
    const key = `${parsed.name}|${parsed.canton}`.toLowerCase();
    const place = { name: parsed.name, lat: attrs.lat, lon: attrs.lon };
    if (seen.has(key) || places.some((p) => p.canton === parsed.canton && samePlace(p, place))) {
      continue;
    }
    seen.add(key);

    const type = TYPE_LABEL[parsed.type ?? ''] ?? parsed.type;
    const where =
      parsed.municipality && parsed.municipality !== parsed.name ? ` · ${parsed.municipality}` : '';
    places.push({
      ...place,
      canton: parsed.canton,
      detail: `${type}${where}${parsed.canton ? ` (${parsed.canton})` : ''}`,
    });
  }

  // Stable: keeps swisstopo's own ranking within each group.
  return [...places.filter((p) => p.canton === 'BE'), ...places.filter((p) => p.canton !== 'BE')];
}

export function searchUrl(query: string, limit = 30): string {
  const params = new URLSearchParams({
    searchText: query,
    type: 'locations',
    origins: 'gg25,gazetteer',
    sr: '4326',
    limit: String(limit),
  });
  return `${ENDPOINT}?${params}`;
}

export async function searchPlaces(
  query: string,
  { fetch: fetchImpl = fetch, signal }: { fetch?: typeof fetch; signal?: AbortSignal } = {},
): Promise<Array<SearchResult>> {
  if (query.trim().length < 2) {
    return [];
  }
  const res = await fetchImpl(searchUrl(query.trim()), { signal });
  if (!res.ok) {
    throw new Error(`Ortssuche antwortete mit ${res.status}`);
  }
  return parseResults(await res.json());
}
