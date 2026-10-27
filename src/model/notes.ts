/**
 * Short explanations attached to a scored day. The model emits codes; the
 * German wording lives here so tests can assert on codes, not on prose.
 */

export const NOTE_TEXT = {
  'too-cold': 'Zu kalt für die meisten Arten',
  'too-warm': 'Zu warm für die meisten Arten',
  'no-trigger': 'Kein durchdringender Regen im Schubfenster von 3–10 Tagen',
  'short-wet': 'Nur kurz feucht — dem Myzel fehlte die lange Feuchtphase',
  saturated: 'Boden gesättigt — saurer Grund, und was steht, fault rasch',
  'too-dry': 'Der Oberboden ist derzeit zu trocken',
  'hard-frost': 'Strenger Frost — für die meisten Speisepilze ist das Jahr gelaufen',
  frost: 'Frost über Nacht — die Fruchtkörper nehmen Schaden',
  'light-frost': 'Leichter Nachtfrost',
  'recent-hard-frost': 'Strenger Frost in den letzten Tagen',
  hot: 'Hitze über 32 °C trocknet die Streuschicht aus',
  warm: 'Warmer Tag — der Oberboden trocknet schnell aus',
  cloudburst: 'Wolkenbruch heute — durchnässte Fruchtkörper halten schlecht',
  'heavy-rain': 'Starkregen heute — die Fruchtkörper saugen sich voll',
  waterlogged: 'Der Boden ist seit Tagen durchnässt',
  'diurnal-trigger': 'Warme Tage, kühle Nächte — der klassische Auslöser für einen Schub',
} as const;

export type NoteCode = keyof typeof NOTE_TEXT;

export const noteText = (code: NoteCode) => NOTE_TEXT[code];
