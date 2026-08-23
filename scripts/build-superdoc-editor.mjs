import esbuild from 'esbuild';
import {cpSync, mkdirSync} from 'node:fs';

const OUT = 'android/app/src/main/assets/superdoc';
mkdirSync(OUT, {recursive: true});

await esbuild.build({
  entryPoints: ['src/components/editor/superdoc/bridge/index.ts'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['chrome90'],
  outfile: `${OUT}/superdoc.js`,
  legalComments: 'inline',
});

cpSync('src/components/editor/superdoc/shell/index.html', `${OUT}/index.html`);
console.log(`[build-superdoc-editor] wrote ${OUT}/superdoc.{js,css} and index.html`);
