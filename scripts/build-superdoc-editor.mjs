import esbuild from 'esbuild';
import {cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';

const OUT = 'android/app/src/main/assets/superdoc';
const ENGINE_ASSETS = 'node_modules/@superdoc/docx-engine/dist/assets';

mkdirSync(OUT, {recursive: true});

await esbuild.build({
  entryPoints: ['src/components/editor/superdoc/bridge/index.ts'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['chrome90'],
  alias: {
    '@': './src',
  },
  // The DOCX engine resolves its worker chunk relative to import.meta.url,
  // which does not exist in a classic IIFE script. Every use is a URL base
  // next to the shell page, so the shell location is the correct stand-in.
  define: {
    'import.meta.url': 'window.location.href',
  },
  outfile: `${OUT}/superdoc.js`,
  legalComments: 'inline',
});

// Ship the engine's module workers next to the bundle and record the
// content-hashed browser-worker entry so the bridge can install SuperDoc's
// documented __SUPERDOC_V2_BROWSER_WORKER_URL__ override at runtime.
cpSync(ENGINE_ASSETS, `${OUT}/assets`, {recursive: true});
const entries = readdirSync(`${OUT}/assets`).filter(name =>
  /^browser-worker-entry-.*\.js$/.test(name),
);
if (entries.length !== 1) {
  throw new Error(
    `[build-superdoc-editor] expected exactly one browser worker entry in ${ENGINE_ASSETS}, found: ${entries.join(', ') || 'none'}`,
  );
}

let html = readFileSync('src/components/editor/superdoc/shell/index.html', 'utf8');
const metaTag = `    <meta name="superdoc-worker-entry" content="assets/${entries[0]}" />\n  `;
if (html.includes('superdoc-worker-entry')) {
  html = html.replace(
    /<meta name="superdoc-worker-entry" content="[^"]*" \/>/,
    `<meta name="superdoc-worker-entry" content="assets/${entries[0]}" />`,
  );
} else if (!html.includes('</head>')) {
  throw new Error('[build-superdoc-editor] shell index.html has no </head>');
} else {
  html = html.replace('</head>', `${metaTag}</head>`);
}
writeFileSync(`${OUT}/index.html`, html);

console.log(`[build-superdoc-editor] wrote ${OUT}/superdoc.{js,css}, index.html and assets/`);
