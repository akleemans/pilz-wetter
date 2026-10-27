import { expect, test } from 'bun:test';
import { dayParts, escapeHtml, formatNumber, formatPercent, formatShort } from './format.ts';

test('dates read the Swiss way', () => {
  // The month abbreviation depends on the ICU version ("Sep" or "Sept").
  const parts = dayParts('2026-09-20');
  expect(parts.weekday).toBe('So');
  expect(parts.day).toBe('20.');
  expect(parts.month).toStartWith('Sep');
  expect(formatShort('2026-09-20')).toBe(`So 20. ${parts.month}`);
});

test('numbers use a decimal comma and a dash for gaps', () => {
  expect(formatNumber(12.34)).toBe('12,3');
  expect(formatNumber(12.34, 0)).toBe('12');
  expect(formatNumber(null)).toBe('–');
  expect(formatNumber(Number.NaN)).toBe('–');
  expect(formatPercent(0.456)).toBe('46 %');
});

test('escapeHtml neutralises markup', () => {
  expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe(
    '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;',
  );
});
