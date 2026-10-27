/** Replaced at build time by scripts/build.ts; absent in the dev server. */
declare const __BUILD_TIME__: string | undefined;

export const BUILD_TIME = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : null;

/** "Version vom 24.10.2026, 18:00." for the footer, or nothing in dev. */
export function renderVersion(el: HTMLElement | null) {
  if (el && BUILD_TIME) {
    el.textContent = `Version vom ${new Date(BUILD_TIME).toLocaleString('de-CH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })}.`;
  }
}
