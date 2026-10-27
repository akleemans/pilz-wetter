/** Swiss German date and number formatting, and HTML escaping. */

const at = (iso: string) => new Date(`${iso}T12:00:00`);

/** Weekday, day and month as separate pieces, so the axis can stack them. */
export function dayParts(iso: string) {
  const d = at(iso);
  return {
    weekday: d.toLocaleDateString('de-CH', { weekday: 'short' }).replace('.', ''),
    day: `${d.getDate()}.`,
    month: d.toLocaleDateString('de-CH', { month: 'short' }).replace('.', ''),
  };
}

export const formatShort = (iso: string) => {
  const p = dayParts(iso);
  return `${p.weekday} ${p.day} ${p.month}`;
};

export const formatDay = (iso: string) =>
  at(iso).toLocaleDateString('de-CH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

/** `12,3`, or an en dash for a missing value. */
export const formatNumber = (v: number | null | undefined, digits = 1) =>
  v == null || Number.isNaN(v) ? '–' : v.toFixed(digits).replace('.', ',');

export const formatPercent = (v: number) => `${Math.round(v * 100)} %`;

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** For anything that reaches innerHTML: place names come from URLs and searches. */
export const escapeHtml = (text: string) => text.replaceAll(/[&<>"']/g, (c) => ENTITIES[c]!);
