/**
 * Places to pick from. The weather always comes from Open-Meteo for the
 * place's coordinates; the list is only a convenient set of starting points,
 * spread over the canton of Bern from the Jura to the Oberland (originally the
 * canton's precipitation network, hence a few places just over the border).
 */

export interface Place {
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  /** Extra context for search results, e.g. "Gemeinde Boltigen (BE)". */
  readonly detail?: string;
}

const UNSORTED: ReadonlyArray<Place> = [
  { name: 'Aarberg', lat: 47.057969, lon: 7.28535 },
  { name: 'Adelboden', lat: 46.491703, lon: 7.560703 },
  { name: 'Affoltern i. E.', lat: 47.063125, lon: 7.740614 },
  { name: 'Belp', lat: 46.906094, lon: 7.505339 },
  { name: 'Bern', lat: 46.948, lon: 7.4474 },
  { name: 'Boltigen', lat: 46.623519, lon: 7.384206 },
  { name: 'Brienz', lat: 46.740719, lon: 8.060864 },
  { name: 'Chasseral', lat: 47.131761, lon: 7.054367 },
  { name: 'Chaumont (NE)', lat: 47.049169, lon: 6.978825 },
  { name: 'Frutigen', lat: 46.599003, lon: 7.657542 },
  { name: 'Gadmen', lat: 46.736835, lon: 8.351221 },
  { name: 'Gantrisch (Untere Gantrischhütte)', lat: 46.717975, lon: 7.440259 },
  { name: 'Grenchen (SO)', lat: 47.179097, lon: 7.415144 },
  { name: 'Grimsel Hospiz', lat: 46.571689, lon: 8.333256 },
  { name: 'Grindelwald, Oberläger', lat: 46.665007, lon: 8.081294 },
  { name: 'Gsteig', lat: 46.376533, lon: 7.278592 },
  { name: 'Guggisberg, Riffenmatt', lat: 46.76027, lon: 7.357102 },
  { name: 'Guttannen', lat: 46.656444, lon: 8.291717 },
  { name: 'Habkern', lat: 46.727659, lon: 7.852844 },
  { name: 'Hasliberg', lat: 46.7497, lon: 8.191977 },
  { name: 'Huttwil', lat: 47.114003, lon: 7.837364 },
  { name: 'Ins', lat: 46.998388, lon: 7.108512 },
  { name: 'Interlaken', lat: 46.672033, lon: 7.87045 },
  { name: 'Kandersteg', lat: 46.493842, lon: 7.677167 },
  { name: 'Kiental', lat: 46.582677, lon: 7.727203 },
  { name: 'Kiesen', lat: 46.820811, lon: 7.573036 },
  { name: 'Kleine Scheidegg', lat: 46.5842, lon: 7.959112 },
  { name: 'Koppigen', lat: 47.11885, lon: 7.605503 },
  { name: 'Krauchthal, Dieterswald', lat: 47.009542, lon: 7.588538 },
  { name: 'Krauchthal, Lindenfeld', lat: 46.999827, lon: 7.557508 },
  { name: 'Landiswil, Ätzlischwand', lat: 46.948374, lon: 7.6955 },
  { name: 'Langnau i. E.', lat: 46.939633, lon: 7.806425 },
  { name: 'Laupen', lat: 46.916764, lon: 7.240475 },
  { name: 'Lauterbrunnen', lat: 46.592917, lon: 7.906464 },
  { name: 'Lüderenalp, Oberrafrüti', lat: 46.998235, lon: 7.815672 },
  { name: 'Magglingen', lat: 47.1408, lon: 7.215022 },
  { name: 'Marbachegg', lat: 46.827661, lon: 7.904557 },
  { name: 'Meiringen', lat: 46.732222, lon: 8.169247 },
  { name: 'Mühleberg', lat: 46.973278, lon: 7.278217 },
  { name: 'Napf', lat: 47.004667, lon: 7.940117 },
  { name: 'Nesselboden (SO)', lat: 47.245169, lon: 7.508581 },
  { name: 'Plaffeien (FR)', lat: 46.747717, lon: 7.266264 },
  { name: 'Riedholz-Wallierhof (SO)', lat: 47.234278, lon: 7.562697 },
  { name: 'Schallenberg', lat: 46.826459, lon: 7.796083 },
  { name: 'Schüpfheim (LU)', lat: 46.947042, lon: 8.012442 },
  { name: 'Thun', lat: 46.749853, lon: 7.585222 },
  { name: 'Villeret', lat: 47.163819, lon: 7.035747 },
  { name: 'Wynau', lat: 47.255025, lon: 7.787475 },
  { name: 'Zollikofen', lat: 46.990744, lon: 7.464061 },
  { name: 'Zweisimmen', lat: 46.550511, lon: 7.38493 },
];

const collator = new Intl.Collator('de-CH', { sensitivity: 'base' });

export const PLACES: ReadonlyArray<Place> = [...UNSORTED].sort((a, b) =>
  collator.compare(a.name, b.name),
);

export const DEFAULT_PLACE: Place = PLACES.find((p) => p.name === 'Bern')!;

/** Lower-case, without diacritics: "Lüderenalp" matches "luder". */
export const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

export const findPlace = (name: string): Place | undefined => {
  const wanted = normalize(name);
  return PLACES.find((p) => normalize(p.name) === wanted);
};

/** Places whose name contains every word of the query; prefix matches first. */
export function filterPlaces(query: string): Array<Place> {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) {
    return [...PLACES];
  }
  const matches = PLACES.filter((p) => {
    const name = normalize(p.name);
    return words.every((w) => name.includes(w));
  });
  const first = words[0]!;
  return [
    ...matches.filter((p) => normalize(p.name).startsWith(first)),
    ...matches.filter((p) => !normalize(p.name).startsWith(first)),
  ];
}

/** Same place for our purposes: within ~500 m. */
export const samePlace = (a: Place, b: Place) =>
  Math.abs(a.lat - b.lat) < 0.005 && Math.abs(a.lon - b.lon) < 0.007;
