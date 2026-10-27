/** `bun run docs:params` — regenerates the parameter reference in MODEL.md. */

import { updateParamDocs } from '../src/model/param-docs.ts';

const path = new URL('../MODEL.md', import.meta.url).pathname;
const before = await Bun.file(path).text();
const after = updateParamDocs(before);
if (after === before) {
  console.log('MODEL.md is up to date.');
} else {
  await Bun.write(path, after);
  console.log('Updated the parameter reference in MODEL.md.');
}
