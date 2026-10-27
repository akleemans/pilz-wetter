/**
 * Every tunable constant of the mushroom model, with its documentation.
 *
 * `PARAMS` is the single source of truth: the defaults the model runs with, the
 * labels and help texts of the in-page parameter panel, and the parameter
 * reference in MODEL.md (regenerated with `bun run docs:params`). Labels and
 * descriptions are German because the panel shows them to foragers; the test
 * suite checks that every parameter is documented and that MODEL.md is current.
 *
 * Parameters are plain numbers or fixed-length number lists (ramps, kernels,
 * monthly tables), so overrides can be stored and shared as plain JSON.
 */

export type ParamValue = number | ReadonlyArray<number>;

export interface ParamSpec {
  readonly group: ParamGroup;
  readonly label: string;
  readonly description: string;
  readonly unit?: string;
  readonly default: ParamValue;
  /** Labels for the entries of a list parameter (ramps: ['von', 'bis']). */
  readonly items?: ReadonlyArray<string>;
  readonly min?: number;
  readonly max?: number;
  readonly step: number;
}

export const PARAM_GROUPS = {
  water: 'Wasserhaushalt',
  moisture: 'Feuchte-Faktoren',
  flush: 'Auslösender Regen',
  combine: 'Gewichtung',
  temperature: 'Temperatur',
  waterlogging: 'Staunässe',
  frost: 'Frost',
  heat: 'Hitze',
  rain: 'Regen am Tag selbst',
  diurnal: 'Tag/Nacht-Auslöser',
  season: 'Saison',
} as const;

export type ParamGroup = keyof typeof PARAM_GROUPS;

const RAMP = ['von', 'bis'] as const;
const MONTHS = [
  'Jan',
  'Feb',
  'Mär',
  'Apr',
  'Mai',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Okt',
  'Nov',
  'Dez',
] as const;

export const PARAMS = {
  /* ---------------------------------------------------------- water balance */
  infiltrationSaturation: {
    group: 'water',
    label: 'Sättigung der Versickerung',
    description:
      'Wie viel Regen pro Tag höchstens in den Boden gelangt. Wirksamer Regen = S · tanh(Regen / S): 8 mm zählen fast voll, von 40 mm kommt weniger als die Hälfte an. Kleinere Werte bestrafen Wolkenbrüche stärker.',
    unit: 'mm',
    default: 19,
    min: 1,
    step: 1,
  },
  fieldCapacity: {
    group: 'water',
    label: 'Feldkapazität',
    description:
      'Wie viel Wasser der Wurzelraum halten kann. Was darüber hinausgeht, versickert und ist verloren.',
    unit: 'mm',
    default: 85,
    min: 10,
    step: 1,
  },
  retentionBase: {
    group: 'water',
    label: 'Speicherrate',
    description:
      'Anteil des Bodenwassers, der bei der Referenztemperatur von einem Tag zum nächsten erhalten bleibt (der Rest verdunstet oder wird von den Pflanzen aufgenommen).',
    default: 0.95,
    min: 0,
    max: 1,
    step: 0.005,
  },
  retentionPerDegree: {
    group: 'water',
    label: 'Verdunstung pro Grad',
    description:
      'Wie stark die tägliche Speicherrate pro Grad Tagesmittel über der Referenztemperatur sinkt. Wärmere Tage trocknen den Boden schneller aus.',
    unit: '1/°C',
    default: 0.004,
    min: 0,
    step: 0.001,
  },
  retentionReferenceTemp: {
    group: 'water',
    label: 'Referenztemperatur der Verdunstung',
    description: 'Tagesmittel, bei dem genau die Speicherrate gilt.',
    unit: '°C',
    default: 8,
    step: 0.5,
  },
  retentionRange: {
    group: 'water',
    label: 'Grenzen der Speicherrate',
    description: 'Die temperaturabhängige Speicherrate bleibt immer in diesem Bereich.',
    default: [0.8, 0.96],
    items: ['min', 'max'],
    min: 0,
    max: 1,
    step: 0.005,
  },
  snowMaxTemp: {
    group: 'water',
    label: 'Schneegrenze (Tagesmaximum)',
    description:
      'Liegt das Tagesmaximum darunter, fällt der Niederschlag als Schnee. Er wird als Schneedecke gespeichert und zählt erst, wenn er schmilzt.',
    unit: '°C',
    default: 1,
    step: 0.5,
  },
  meltPerDegreeDay: {
    group: 'water',
    label: 'Schneeschmelze',
    description: 'Schmelzwasser pro Grad Tagesmittel über 0 °C (Gradtagverfahren).',
    unit: 'mm/°C',
    default: 3,
    min: 0,
    step: 0.5,
  },

  /* --------------------------------------------------------- moisture terms */
  moistureRamp: {
    group: 'moisture',
    label: 'Bodenfeuchte',
    description:
      'Bodenwasserspeicher, ab dem der Boden als feucht gilt (von) und ab dem er voll zählt (bis).',
    unit: 'mm',
    default: [8, 40],
    items: RAMP,
    min: 0,
    step: 1,
  },
  sustainWindow: {
    group: 'moisture',
    label: 'Fenster der anhaltenden Feuchte',
    description:
      'Über wie viele Tage das Myzel feucht gewesen sein muss, um Fruchtkörper bilden zu können.',
    unit: 'Tage',
    default: 21,
    min: 1,
    step: 1,
  },
  sustainWetRamp: {
    group: 'moisture',
    label: 'Feuchter Tag',
    description:
      'Bodenwasserspeicher, ab dem ein einzelner Tag im Fenster als feucht zählt (von) bzw. als voll feucht (bis).',
    unit: 'mm',
    default: [12, 36],
    items: RAMP,
    min: 0,
    step: 1,
  },
  sustainRamp: {
    group: 'moisture',
    label: 'Anhaltende Feuchte',
    description:
      'Mittlere Feuchte im Fenster (0 = immer trocken, 1 = immer feucht), ab der der Faktor zu wirken beginnt (von) und voll ist (bis).',
    default: [0.15, 0.7],
    items: RAMP,
    min: 0,
    max: 1,
    step: 0.05,
  },
  sustainFloor: {
    group: 'moisture',
    label: 'Untergrenze anhaltende Feuchte',
    description:
      'Ein trockener Monat verhindert einen Schub nicht ganz, er bremst ihn nur. Der Faktor sinkt nie unter diesen Wert.',
    default: 0.45,
    min: 0,
    max: 1,
    step: 0.05,
  },

  /* ------------------------------------------------------------ flush trigger */
  flushKernel: {
    group: 'flush',
    label: 'Verzögerung des Schubs',
    description:
      'Wie stark Regen von vor n Tagen zum Schub von heute beiträgt (Index = Tage zurück). Höchstwert bei 6–7 Tagen, der Regen von heute zählt nicht.',
    default: [
      0.0, 0.05, 0.15, 0.45, 0.75, 0.95, 1.0, 1.0, 0.95, 0.85, 0.7, 0.55, 0.4, 0.28, 0.18, 0.1,
      0.05,
    ],
    items: Array.from({ length: 17 }, (_, lag) => `${lag} T.`),
    min: 0,
    max: 1,
    step: 0.05,
  },
  flushRamp: {
    group: 'flush',
    label: 'Auslösender Regen',
    description:
      'Gewichtete Regensumme (mm) im Schubfenster, ab der der Faktor zu wirken beginnt (von) und voll ist (bis).',
    unit: 'mm',
    default: [6, 42],
    items: RAMP,
    min: 0,
    step: 1,
  },

  /* ---------------------------------------------------------------- combine */
  weightMoisture: {
    group: 'combine',
    label: 'Gewicht Bodenfeuchte',
    description:
      'Exponent im gewichteten geometrischen Mittel der drei Wasserfaktoren. Die drei Gewichte sollten zusammen 1 ergeben.',
    default: 0.28,
    min: 0,
    max: 1,
    step: 0.01,
  },
  weightSustain: {
    group: 'combine',
    label: 'Gewicht anhaltende Feuchte',
    description: 'Exponent der anhaltenden Feuchte (siehe oben).',
    default: 0.3,
    min: 0,
    max: 1,
    step: 0.01,
  },
  weightFlush: {
    group: 'combine',
    label: 'Gewicht auslösender Regen',
    description: 'Exponent des auslösenden Regens (siehe oben).',
    default: 0.42,
    min: 0,
    max: 1,
    step: 0.01,
  },

  /* ------------------------------------------------------------ temperature */
  tempColdRamp: {
    group: 'temperature',
    label: 'Kälteschwelle (Tagesmittel)',
    description: 'Unter «von» bilden sich keine Fruchtkörper, ab «bis» ist es warm genug.',
    unit: '°C',
    default: [2, 12],
    items: RAMP,
    step: 0.5,
  },
  tempWarmRamp: {
    group: 'temperature',
    label: 'Wärmeschwelle (Tagesmittel)',
    description: 'Bis «von» ideal, ab «bis» zu warm.',
    unit: '°C',
    default: [18, 27],
    items: RAMP,
    step: 0.5,
  },
  tempTodayWeight: {
    group: 'temperature',
    label: 'Gewicht der heutigen Temperatur',
    description:
      'Anteil der heutigen Temperatur gegenüber dem Mittel der vorangehenden Tage. Das Myzel reagiert auf die Witterung, nicht auf einen einzelnen Nachmittag.',
    default: 0.55,
    min: 0,
    max: 1,
    step: 0.05,
  },
  tempHistoryDays: {
    group: 'temperature',
    label: 'Temperatur-Gedächtnis',
    description: 'Über wie viele vorangehende Tage die Temperatur gemittelt wird.',
    unit: 'Tage',
    default: 10,
    min: 1,
    step: 1,
  },
  temperatureGateFloor: {
    group: 'temperature',
    label: 'Untergrenze Temperaturschranke',
    description:
      'Auch bei ungeeigneter Temperatur bleibt dieser Anteil übrig, für späte Arten, die bei wenigen Grad noch erscheinen.',
    default: 0.15,
    min: 0,
    max: 1,
    step: 0.05,
  },

  /* ----------------------------------------------------------- waterlogging */
  saturationLevel: {
    group: 'waterlogging',
    label: 'Beginn der Staunässe',
    description: 'Anteil der Feldkapazität, ab dem der Boden als durchnässt gilt.',
    default: 0.75,
    min: 0,
    max: 1,
    step: 0.05,
  },
  saturationWindow: {
    group: 'waterlogging',
    label: 'Fenster der Staunässe',
    description: 'Über wie viele Tage durchnässte Tage gezählt werden.',
    unit: 'Tage',
    default: 10,
    min: 1,
    step: 1,
  },
  saturationPenalty: {
    group: 'waterlogging',
    label: 'Abzug bei Staunässe',
    description: 'Grösster Abzug, wenn der Boden im ganzen Fenster gesättigt war (0,45 = −45 %).',
    default: 0.45,
    min: 0,
    max: 1,
    step: 0.05,
  },

  /* ------------------------------------------------------------------- frost */
  frostLightBelow: {
    group: 'frost',
    label: 'Leichter Frost unter',
    description: 'Tagesminimum, unter dem leichter Nachtfrost gilt.',
    unit: '°C',
    default: 0,
    step: 0.5,
  },
  frostLightFactor: {
    group: 'frost',
    label: 'Faktor leichter Frost',
    description: 'Multiplikator für einen Tag mit leichtem Nachtfrost.',
    default: 0.75,
    min: 0,
    max: 1,
    step: 0.05,
  },
  frostModerateBelow: {
    group: 'frost',
    label: 'Frost unter',
    description: 'Tagesminimum, unter dem die Fruchtkörper Schaden nehmen.',
    unit: '°C',
    default: -2,
    step: 0.5,
  },
  frostModerateFactor: {
    group: 'frost',
    label: 'Faktor Frost',
    description: 'Multiplikator für einen Frosttag.',
    default: 0.4,
    min: 0,
    max: 1,
    step: 0.05,
  },
  frostHardBelow: {
    group: 'frost',
    label: 'Strenger Frost unter',
    description: 'Tagesminimum, unter dem für die meisten Speisepilze die Saison endet.',
    unit: '°C',
    default: -5,
    step: 0.5,
  },
  frostHardFactor: {
    group: 'frost',
    label: 'Faktor strenger Frost',
    description: 'Multiplikator für einen Tag mit strengem Frost.',
    default: 0.15,
    min: 0,
    max: 1,
    step: 0.05,
  },
  frostAftermathDays: {
    group: 'frost',
    label: 'Nachwirkung strenger Frost',
    description: 'So viele Tage nach strengem Frost wirkt er noch nach.',
    unit: 'Tage',
    default: 5,
    min: 0,
    step: 1,
  },
  frostAftermathFactor: {
    group: 'frost',
    label: 'Faktor Nachwirkung',
    description: 'Multiplikator in den Tagen nach strengem Frost.',
    default: 0.5,
    min: 0,
    max: 1,
    step: 0.05,
  },

  /* -------------------------------------------------------------------- heat */
  heatWarmFrom: {
    group: 'heat',
    label: 'Warmer Tag ab',
    description: 'Tagesmaximum, ab dem der Oberboden schnell austrocknet.',
    unit: '°C',
    default: 28,
    step: 0.5,
  },
  heatWarmFactor: {
    group: 'heat',
    label: 'Faktor warmer Tag',
    description: 'Multiplikator für einen warmen Tag.',
    default: 0.85,
    min: 0,
    max: 1,
    step: 0.05,
  },
  heatHotFrom: {
    group: 'heat',
    label: 'Hitzetag ab',
    description: 'Tagesmaximum, ab dem die Streuschicht austrocknet.',
    unit: '°C',
    default: 32,
    step: 0.5,
  },
  heatHotFactor: {
    group: 'heat',
    label: 'Faktor Hitzetag',
    description: 'Multiplikator für einen Hitzetag.',
    default: 0.7,
    min: 0,
    max: 1,
    step: 0.05,
  },

  /* ----------------------------------------------------------- rain on the day */
  rainHeavyFrom: {
    group: 'rain',
    label: 'Starkregen ab',
    description:
      'Tagesniederschlag, ab dem die Fruchtkörper sich vollsaugen (und das Sammeln wenig Freude macht).',
    unit: 'mm',
    default: 20,
    min: 0,
    step: 1,
  },
  rainHeavyFactor: {
    group: 'rain',
    label: 'Faktor Starkregen',
    description: 'Multiplikator für einen Starkregentag.',
    default: 0.85,
    min: 0,
    max: 1,
    step: 0.05,
  },
  rainCloudburstFrom: {
    group: 'rain',
    label: 'Wolkenbruch ab',
    description: 'Tagesniederschlag, ab dem ein Wolkenbruch gilt.',
    unit: 'mm',
    default: 40,
    min: 0,
    step: 1,
  },
  rainCloudburstFactor: {
    group: 'rain',
    label: 'Faktor Wolkenbruch',
    description: 'Multiplikator für einen Wolkenbruchtag.',
    default: 0.75,
    min: 0,
    max: 1,
    step: 0.05,
  },

  /* ------------------------------------------------------------ diurnal trigger */
  diurnalSpreadRange: {
    group: 'diurnal',
    label: 'Tagesgang',
    description:
      'Spanne zwischen Tagesmaximum und -minimum, in der der Auslöser «warme Tage, kühle Nächte» greift.',
    unit: '°C',
    default: [6, 15],
    items: ['min', 'max'],
    step: 0.5,
  },
  diurnalNightRange: {
    group: 'diurnal',
    label: 'Kühle Nacht',
    description: 'Bereich des Tagesminimums für den Auslöser (frostfrei, kühl).',
    unit: '°C',
    default: [5, 14],
    items: ['min', 'max'],
    step: 0.5,
  },
  diurnalMaxDay: {
    group: 'diurnal',
    label: 'Höchstens so warm am Tag',
    description: 'Tagesmaximum, über dem der Auslöser nicht mehr greift.',
    unit: '°C',
    default: 25,
    step: 0.5,
  },
  diurnalBonus: {
    group: 'diurnal',
    label: 'Bonus',
    description: 'Multiplikator, wenn die Bedingungen erfüllt sind (1,05 = +5 %).',
    default: 1.05,
    min: 1,
    max: 1.5,
    step: 0.01,
  },

  /* ------------------------------------------------------------------ season */
  seasonByMonth: {
    group: 'season',
    label: 'Saisonfaktor (Monatsmitte)',
    description:
      'Wie viele Speisepilze die Jahreszeit hergibt, jeweils zur Monatsmitte, auf Referenzhöhe. Dazwischen wird linear interpoliert.',
    default: [0.15, 0.15, 0.28, 0.45, 0.6, 0.75, 0.9, 1.0, 1.0, 0.95, 0.6, 0.25],
    items: MONTHS,
    min: 0,
    max: 1,
    step: 0.05,
  },
  seasonReferenceElevation: {
    group: 'season',
    label: 'Referenzhöhe',
    description:
      'Höhe, für die die Saisontabelle gilt (Mittelland). Höher gelegene Orte haben eine kürzere Saison.',
    unit: 'm ü. M.',
    default: 550,
    step: 50,
  },
  seasonPeakDay: {
    group: 'season',
    label: 'Saisonhöhepunkt',
    description:
      'Tag im Jahr, um den sich die Saison in der Höhe zusammenzieht (244 = 1. September).',
    unit: 'Tag im Jahr',
    default: 244,
    min: 1,
    max: 365,
    step: 1,
  },
  seasonShiftDaysPer100m: {
    group: 'season',
    label: 'Saisonverschiebung pro 100 m',
    description:
      'Um so viele Tage pro 100 m über der Referenzhöhe beginnt die Saison später und endet früher (gemessen 120 Tage vom Höhepunkt entfernt, näher am Höhepunkt entsprechend weniger). 0 schaltet die Höhenkorrektur ab.',
    unit: 'Tage',
    default: 3,
    min: 0,
    step: 0.5,
  },
} as const satisfies Record<string, ParamSpec>;

export type ParamKey = keyof typeof PARAMS;

/** Widens literal defaults (`19`, `[8, 40]`) to the types overrides may use. */
type Widen<T> = T extends number
  ? number
  : T extends ReadonlyArray<number>
    ? { readonly [K in keyof T]: number }
    : never;

export type ModelParams = {
  readonly [K in ParamKey]: Widen<(typeof PARAMS)[K]['default']>;
};

export type ParamOverrides = Partial<{
  -readonly [K in ParamKey]: number | Array<number>;
}>;

export const PARAM_KEYS = Object.keys(PARAMS) as Array<ParamKey>;

export const DEFAULT_PARAMS: ModelParams = Object.freeze(
  Object.fromEntries(PARAM_KEYS.map((key) => [key, PARAMS[key].default])) as ModelParams,
);

const isValidValue = (spec: ParamSpec, value: unknown): value is ParamValue => {
  if (typeof spec.default === 'number') {
    return typeof value === 'number' && Number.isFinite(value);
  }
  return (
    Array.isArray(value) &&
    value.length === spec.default.length &&
    value.every((v) => typeof v === 'number' && Number.isFinite(v))
  );
};

/**
 * Defaults with `overrides` applied. Unknown keys and values of the wrong shape
 * are dropped rather than trusted, because overrides come from localStorage and
 * from JSON pasted in by hand.
 */
export function resolveParams(overrides: unknown = {}): ModelParams {
  if (overrides == null || typeof overrides !== 'object') {
    return DEFAULT_PARAMS;
  }
  const merged: Record<string, ParamValue> = { ...DEFAULT_PARAMS };
  for (const [key, value] of Object.entries(overrides)) {
    const spec: ParamSpec | undefined = PARAMS[key as ParamKey];
    if (spec && isValidValue(spec, value)) {
      merged[key] = Array.isArray(value) ? [...value] : value;
    }
  }
  return merged as ModelParams;
}

const sameValue = (a: ParamValue, b: ParamValue) =>
  typeof a === 'number' || typeof b === 'number'
    ? a === b
    : a.length === b.length && a.every((v, i) => v === b[i]);

/** Only the parameters that differ from the defaults, for storing and sharing. */
export function diffParams(params: ModelParams): ParamOverrides {
  const out: Record<string, ParamValue> = {};
  for (const key of PARAM_KEYS) {
    if (!sameValue(params[key], DEFAULT_PARAMS[key])) {
      const value = params[key];
      out[key] = typeof value === 'number' ? value : [...value];
    }
  }
  return out as ParamOverrides;
}
