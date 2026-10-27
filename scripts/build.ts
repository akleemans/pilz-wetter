/**
 * `bun run build` — bundles both pages into docs/, which GitHub Pages serves
 * as-is (Settings → Pages → Deploy from a branch → main, /docs).
 */

import { rm } from 'node:fs/promises';

const root = new URL('..', import.meta.url).pathname;
const outdir = `${root}docs`;

await rm(outdir, { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: [`${root}index.html`, `${root}scenarios.html`],
  outdir,
  minify: true,
  // Both pages share the model and ECharts.
  splitting: true,
  // docs/ is committed: no source maps, they would triple its size.
  sourcemap: 'none',
  naming: { asset: 'assets/[name]-[hash].[ext]', chunk: 'assets/[name]-[hash].[ext]' },
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

// No Jekyll: serve the files exactly as built.
await Bun.write(`${outdir}/.nojekyll`, '');

for (const output of result.outputs) {
  const kb = (output.size / 1024).toFixed(1).padStart(7);
  console.log(`${kb} kB  ${output.path.replace(`${root}`, '')}`);
}
