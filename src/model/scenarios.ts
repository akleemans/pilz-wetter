/**
 * Reference scenarios: synthetic six-week weather histories, each with the
 * rating an experienced forager would expect for its last day.
 *
 * They serve three audiences at once:
 *  - the test suite asserts every scenario lands in its expected band and every
 *    comparison holds (scenarios.test.ts),
 *  - `bun run scenarios` prints the scored breakdown as a table,
 *  - scenarios.html shows them with charts, so people with years in the woods
 *    can review the model without reading code, and send back their verdict.
 *
 * Titles and texts are German because that is who reviews them.
 *
 * A scenario marked `open` is a known disagreement: the expectation is a
 * hypothesis the current model does not meet. The tests list those as todos
 * instead of failing, until a forager confirms the hypothesis (then fix the
 * model) or rejects it (then fix the expectation).
 */

import type { RatingKey } from './ratings.ts';
import type { DayWeather } from './types.ts';

export interface Scenario {
  readonly key: string;
  readonly title: string;
  /** What happened, in plain words. */
  readonly story: string;
  /** Lowest and highest acceptable rating for the last day. */
  readonly expect: readonly [RatingKey, RatingKey];
  /** Why that rating is expected. */
  readonly why: string;
  /** Set when the model currently disagrees: the question for the reviewers. */
  readonly open?: string;
  readonly elevation?: number;
  readonly days: ReadonlyArray<DayWeather>;
}

export interface Comparison {
  readonly better: string;
  readonly worse: string;
  /** Minimum score difference. */
  readonly by: number;
  readonly why: string;
}

type DaySpec = Omit<DayWeather, 'date'>;

const DAY_MS = 86_400_000;

/**
 * A day series ending on `endDate`, oldest first. `dayFn` gets `i` counting up
 * from the oldest day and `age` counting days back from the last one.
 */
export function series(
  endDate: string,
  length: number,
  dayFn: (i: number, age: number) => DaySpec,
): Array<DayWeather> {
  const end = Date.parse(`${endDate}T12:00:00Z`);
  return Array.from({ length }, (_, i) => {
    const age = length - 1 - i;
    const date = new Date(end - age * DAY_MS).toISOString().slice(0, 10);
    return { date, ...dayFn(i, age) };
  });
}

/** A mild autumn day (9 / 14 / 19 °C, dry); override any field. */
export const mild = (over: Partial<DaySpec> = {}): DaySpec => ({
  tMin: 9,
  tMean: 14,
  tMax: 19,
  precip: 0,
  ...over,
});

/** Three weeks of warm-up for the water balance plus three of scenario. */
const LENGTH = 42;
/** Peak season, so the season factor is ~1. */
const END = '2026-09-20';

const scenario = (
  spec: Omit<Scenario, 'days'> & {
    end?: string;
    day: (i: number, age: number) => DaySpec;
  },
): Scenario => {
  const { end = END, day, ...rest } = spec;
  return { ...rest, days: series(end, LENGTH, day) };
};

export const SCENARIOS: ReadonlyArray<Scenario> = [
  /* ------------------------------------------------------------ the basics */
  scenario({
    key: 'ideal-autumn',
    title: 'Lehrbuch-Herbst',
    story:
      'Sechs Wochen lang jeden zweiten Tag 10 mm Regen, Tagesmittel 14 °C, Nächte um 9 °C. Mitte September.',
    expect: ['excellent', 'excellent'],
    why: 'Feuchter Boden, regelmässiger Regen, ideale Temperatur, Hochsaison.',
    day: (i) => mild({ precip: i % 2 === 0 ? 10 : 0 }),
  }),
  scenario({
    key: 'decent-autumn',
    title: 'Ordentlicher Herbst',
    story: 'Wie der Lehrbuch-Herbst, aber nur 6 mm jeden zweiten Tag.',
    expect: ['good', 'excellent'],
    why: 'Genug Feuchte, aber weniger kräftiger Auslöser.',
    day: (i) => mild({ precip: i % 2 === 0 ? 6 : 0 }),
  }),
  scenario({
    key: 'drought-warm',
    title: 'Drei Wochen trocken und warm',
    story: 'Kein Tropfen Regen, Tagesmittel 24 °C, Höchstwerte um 30 °C.',
    expect: ['poor', 'poor'],
    why: 'Nichts ist angeregt, der Boden ist ausgetrocknet.',
    day: () => mild({ tMin: 15, tMean: 24, tMax: 30 }),
  }),

  /* -------------------------------------------- how the rain is distributed */
  scenario({
    key: 'spread-rain',
    title: '120 mm verteilt auf 15 Tage',
    story: 'In den letzten drei Wochen 15 Regentage mit je 8 mm, zuletzt vorgestern. 14 °C.',
    expect: ['excellent', 'excellent'],
    why: 'Der Boden nimmt alles auf und bleibt durchgehend feucht.',
    day: (_i, age) =>
      mild({
        precip: age >= 2 && age <= 20 && ![5, 10, 15, 20].includes(age) ? 8 : 0,
      }),
  }),
  scenario({
    key: 'burst-rain',
    title: '120 mm als drei Wolkenbrüche',
    story: 'Dieselbe Menge wie oben, aber als drei Güsse zu 40 mm vor 16, 10 und 5 Tagen.',
    expect: ['moderate', 'good'],
    why: 'Vom Wolkenbruch fliesst das meiste ab, zwischen den Güssen trocknet der Boden ab.',
    day: (_i, age) => mild({ precip: [16, 10, 5].includes(age) ? 40 : 0 }),
  }),
  scenario({
    key: 'waterlogged',
    title: 'Drei Wochen Dauerregen',
    story: 'Drei Wochen lang jeden Tag 20 mm, insgesamt über 400 mm.',
    expect: ['moderate', 'moderate'],
    why: 'Gesättigter, saurer Boden; was steht, fault. Aber keine Dürre.',
    day: (_i, age) => mild({ precip: age <= 21 ? 20 : 0 }),
  }),

  /* ------------------------- timing: one soaking rain on a damp baseline */
  scenario({
    key: 'baseline-damp',
    title: 'Feuchte Grundlage ohne kräftigen Regen',
    story: 'Jeden Tag 2 mm Niesel, sechs Wochen lang. Referenz für die drei folgenden Szenarien.',
    expect: ['moderate', 'moderate'],
    why: 'Der Boden ist feucht, aber nichts löst einen Schub aus.',
    day: () => mild({ precip: 2 }),
  }),
  scenario({
    key: 'rain-yesterday',
    title: 'Kräftiger Regen gestern',
    story: 'Feuchte Grundlage wie oben, dazu gestern 32 mm.',
    expect: ['moderate', 'good'],
    why: 'Der Schub braucht Tage. Der Regen von gestern zählt noch kaum.',
    day: (_i, age) => mild({ precip: age === 1 ? 32 : 2 }),
  }),
  scenario({
    key: 'rain-six-days-ago',
    title: 'Kräftiger Regen vor sechs Tagen',
    story: 'Feuchte Grundlage, dazu vor sechs Tagen 32 mm.',
    expect: ['excellent', 'excellent'],
    why: 'Genau im Schubfenster von 3–10 Tagen.',
    day: (_i, age) => mild({ precip: age === 6 ? 32 : 2 }),
  }),
  scenario({
    key: 'rain-eighteen-days-ago',
    title: 'Kräftiger Regen vor 18 Tagen',
    story: 'Feuchte Grundlage, dazu vor 18 Tagen 32 mm.',
    expect: ['moderate', 'moderate'],
    why: 'Dieser Schub ist vorbei, zurück auf dem Niveau der Grundlage.',
    day: (_i, age) => mild({ precip: age === 18 ? 32 : 2 }),
  }),

  /* ------------------------------------------------------- after a drought */
  scenario({
    key: 'first-rain-after-drought',
    title: 'Ein Regen nach langer Trockenheit',
    story: 'Wochenlang trocken bei 20 °C, dann vor sechs Tagen ein einziger Regen mit 35 mm.',
    expect: ['poor', 'poor'],
    why: 'Ein Regen macht noch keine Saison: das Myzel war lange trocken.',
    day: (_i, age) => mild({ tMin: 13, tMean: 20, tMax: 27, precip: age === 6 ? 35 : 0 }),
  }),
  scenario({
    key: 'drought-broken-recently',
    title: 'Trockenheit vor wenigen Tagen gebrochen',
    story: 'Fünf Wochen trocken, dann vor 7 bis 3 Tagen fünf Regentage mit je 12 mm. 14 °C.',
    expect: ['poor', 'moderate'],
    why: 'Nach langer Trockenheit braucht das Myzel länger (oft 2–3 Wochen) bis zum ersten Schub.',
    open: 'Das Modell gibt hier «Hervorragend», weil der Regen genau im üblichen Schubfenster liegt. Kommen nach einer langen Trockenheit wirklich schon nach 3–7 Tagen Pilze?',
    day: (_i, age) => mild({ precip: age >= 3 && age <= 7 ? 12 : 0 }),
  }),
  scenario({
    key: 'drought-broken-week-ago',
    title: 'Trockenheit vor gut einer Woche gebrochen',
    story: 'Vier Wochen trocken, dann vor 11 bis 7 Tagen fünf Regentage mit je 12 mm. 14 °C.',
    expect: ['good', 'excellent'],
    why: 'Eine Woche Landregen, danach eine Woche Zeit für den Schub.',
    day: (_i, age) => mild({ precip: age >= 7 && age <= 11 ? 12 : 0 }),
  }),
  scenario({
    key: 'drought-broken-two-weeks-ago',
    title: 'Trockenheit vor zwei Wochen gebrochen',
    story:
      'Dreieinhalb Wochen trocken, dann vor 16 bis 12 Tagen fünf Regentage mit je 12 mm, seither trocken. 14 °C.',
    expect: ['moderate', 'good'],
    why: 'Der erste Schub nach einer Trockenheit (z. B. Pfifferlinge) kommt oft erst 2–3 Wochen nach dem Regen.',
    open: 'Das Modell gibt hier «Schlecht», weil der Regen aus dem Schubfenster herausgefallen ist und der Boden wieder abtrocknet. Kommt der erste richtige Schub nach einer Trockenheit erst zwei bis drei Wochen nach dem Regen, auch wenn es seither wieder trocken ist?',
    day: (_i, age) => mild({ precip: age >= 12 && age <= 16 ? 12 : 0 }),
  }),
  scenario({
    key: 'dry-spell-after-wet',
    title: 'Zehn trockene Tage nach nassen Wochen',
    story: 'Vier Wochen lang jeden zweiten Tag 8 mm, dann zehn trockene, milde Tage.',
    expect: ['moderate', 'moderate'],
    why: 'Der letzte Schub ist am Ausklingen, der Oberboden trocknet ab, aber es steht noch einiges.',
    open: 'Das Modell gibt hier fast 0 Punkte, weil seit zehn Tagen kein Regen mehr im Schubfenster liegt. Findet man nach einer nassen Phase zehn Tage nach dem letzten Regen wirklich kaum mehr etwas?',
    day: (i, age) => mild({ precip: age >= 10 && i % 2 === 0 ? 8 : 0 }),
  }),
  scenario({
    key: 'drying-out',
    title: 'Guter Regen vor drei Wochen, seither heiss',
    story:
      'Vor 27 bis 21 Tagen täglich 15 mm, seither trocken bei 24 °C Tagesmittel und über 30 °C am Nachmittag.',
    expect: ['poor', 'poor'],
    why: 'Die Feuchte ist längst verdunstet.',
    day: (_i, age) =>
      mild({
        tMin: 16,
        tMean: 24,
        tMax: 31,
        precip: age >= 21 && age <= 27 ? 15 : 0,
      }),
  }),

  /* ------------------------------------------------------------ temperature */
  scenario({
    key: 'wet-cold',
    title: 'Feucht, aber kalt',
    story: 'Regen wie im ordentlichen Herbst, aber 3 °C Tagesmittel.',
    expect: ['poor', 'poor'],
    why: 'Zu kalt für die Fruchtkörperbildung.',
    day: (i) => mild({ tMin: 0, tMean: 3, tMax: 6, precip: i % 2 === 0 ? 6 : 0 }),
  }),
  scenario({
    key: 'wet-hot',
    title: 'Feucht, aber heiss',
    story: 'Regen wie im ordentlichen Herbst, aber 27 °C Tagesmittel.',
    expect: ['poor', 'poor'],
    why: 'Zu warm, die Streuschicht trocknet zwischen den Schauern aus.',
    day: (i) => mild({ tMin: 19, tMean: 27, tMax: 33, precip: i % 2 === 0 ? 6 : 0 }),
  }),
  scenario({
    key: 'summer-thunderstorms',
    title: 'Sommer mit Gewittern',
    story:
      'Mitte Juli, alle vier Tage ein Gewitter mit 25 mm, dazwischen 28 °C am Nachmittag, 21 °C Tagesmittel.',
    expect: ['moderate', 'good'],
    why: 'Feucht genug und Saison, aber die Hitze trocknet den Oberboden schnell.',
    end: '2026-07-20',
    day: (i) => mild({ tMin: 15, tMean: 21, tMax: 28, precip: i % 4 === 0 ? 25 : 0 }),
  }),
  scenario({
    key: 'frost',
    title: 'Herbst, dann strenger Frost',
    story: 'Ordentlicher Herbst, aber letzte Nacht −7 °C.',
    expect: ['poor', 'poor'],
    why: 'Strenger Frost beendet die Saison für die meisten Speisepilze.',
    day: (i, age) =>
      mild({
        precip: i % 2 === 0 ? 6 : 0,
        ...(age === 0 ? { tMin: -7, tMean: -1, tMax: 4 } : {}),
      }),
  }),
  scenario({
    key: 'snow-then-thaw',
    title: 'Zwei Wochen Schnee, dann Tauwetter',
    story: 'Vor 24 bis 11 Tagen täglich 8 mm Schnee bei −4 °C, seither mild (11 °C) und trocken.',
    expect: ['good', 'excellent'],
    why: 'Der Schnee zählt erst, wenn er schmilzt, dann aber als kräftiger Regen.',
    day: (_i, age) => {
      if (age >= 11 && age <= 24) {
        return mild({ tMin: -8, tMean: -4, tMax: -1, precip: 8 });
      }
      if (age > 24) {
        return mild({ tMin: 2, tMean: 6, tMax: 10 });
      }
      return mild({ tMin: 6, tMean: 11, tMax: 16 });
    },
  }),

  /* ----------------------------------------------------- season and altitude */
  scenario({
    key: 'winter-ideal',
    title: 'Herbstwetter im Januar',
    story: 'Wetter wie im ordentlichen Herbst, aber Mitte Januar.',
    expect: ['poor', 'poor'],
    why: 'Falsche Jahreszeit: der Saisonfaktor hält die Bewertung tief.',
    end: '2026-01-20',
    day: (i) => mild({ precip: i % 2 === 0 ? 6 : 0 }),
  }),
  scenario({
    key: 'spring-may',
    title: 'Feuchter Mai',
    story: 'Mitte Mai, jeden zweiten Tag 6 mm, 12 °C Tagesmittel, Nächte um 6 °C.',
    expect: ['moderate', 'moderate'],
    why: 'Frühjahrsarten (Morcheln, Maipilz), aber die grosse Saison kommt später.',
    end: '2026-05-15',
    day: (i) => mild({ tMin: 6, tMean: 12, tMax: 17, precip: i % 2 === 0 ? 6 : 0 }),
  }),
  scenario({
    key: 'november-mild',
    title: 'Milder, nasser November',
    story: 'Ende November, alle drei Tage 8 mm, 7 °C Tagesmittel.',
    expect: ['poor', 'moderate'],
    why: 'Noch Spätherbstarten (Trompetenpfifferling, Nebelkappe), aber kühl und spät.',
    end: '2026-11-20',
    day: (i) => mild({ tMin: 4, tMean: 7, tMax: 10, precip: i % 3 === 0 ? 8 : 0 }),
  }),
  scenario({
    key: 'october-lowland',
    title: 'Mitte Oktober im Mittelland (550 m)',
    story:
      'Mitte Oktober, Wetter wie im Lehrbuch-Herbst, auf 550 m ü. M. Vergleich zum nächsten Szenario.',
    expect: ['good', 'excellent'],
    why: 'Im Mittelland ist Mitte Oktober noch gute Saison.',
    end: '2026-10-15',
    elevation: 550,
    day: (i) => mild({ precip: i % 2 === 0 ? 10 : 0 }),
  }),
  scenario({
    key: 'october-alpine',
    title: 'Mitte Oktober auf 1500 m',
    story: 'Dasselbe Wetter wie im Mittelland, aber auf 1500 m ü. M. (etwa Jaunpass).',
    expect: ['good', 'excellent'],
    why: 'In der Höhe endet die Saison früher, bei gleichem Wetter also etwas tiefer als im Mittelland (siehe Vergleiche). Dass es in der Höhe meist kälter ist, kommt über die Wetterdaten ohnehin dazu.',
    end: '2026-10-15',
    elevation: 1500,
    day: (i) => mild({ precip: i % 2 === 0 ? 10 : 0 }),
  }),
];

/** Pairs whose order matters more than their exact scores. */
export const COMPARISONS: ReadonlyArray<Comparison> = [
  {
    better: 'spread-rain',
    worse: 'burst-rain',
    by: 15,
    why: 'Dieselbe Regenmenge ist verteilt viel mehr wert als in Güssen.',
  },
  {
    better: 'rain-six-days-ago',
    worse: 'rain-yesterday',
    by: 25,
    why: 'Der Schub braucht Tage: Regen von vor sechs Tagen schlägt den von gestern deutlich.',
  },
  {
    better: 'rain-six-days-ago',
    worse: 'rain-eighteen-days-ago',
    by: 25,
    why: 'Nach zweieinhalb Wochen ist der Schub vorbei.',
  },
  {
    better: 'rain-six-days-ago',
    worse: 'first-rain-after-drought',
    by: 40,
    why: 'Derselbe Regen ist auf feuchtem Boden viel mehr wert als nach einer Trockenheit.',
  },
  {
    better: 'ideal-autumn',
    worse: 'waterlogged',
    by: 1,
    why: 'Gut bewässert schlägt durchnässt.',
  },
  {
    better: 'decent-autumn',
    worse: 'november-mild',
    by: 20,
    why: 'Ende November ist es kühler und spät im Jahr.',
  },
  {
    better: 'october-lowland',
    worse: 'october-alpine',
    by: 5,
    why: 'Bei gleichem Wetter ist die Saison in der Höhe Mitte Oktober weiter fortgeschritten.',
  },
];

export function scenarioByKey(key: string): Scenario {
  const found = SCENARIOS.find((s) => s.key === key);
  if (!found) {
    throw new Error(`Unknown scenario: ${key}`);
  }
  return found;
}
