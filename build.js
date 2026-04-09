// esbuild config — compiles src/ TypeScript to dist/
// Run: node build.js [--watch]
//
// Output structure mirrors src/ — Chrome loads the extension from dist/

import * as esbuild from 'esbuild';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

// Load .env into esbuild define map so env vars are inlined at build time.
// Only variables prefixed with DVSA_ or GOOGLE_ are injected (no accidental leaks).
function loadEnvDefines() {
  const defines = {};
  try {
    const raw = readFileSync('.env', 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^(PROXY_\w+|DVSA_\w+|GOOGLE_\w+)=(.*)$/);
      if (match) defines[`process.env.${match[1]}`] = JSON.stringify(match[2].trim());
    }
  } catch { /* no .env — CI will provide vars another way */ }
  return defines;
}

const watch = process.argv.includes('--watch');

const sharedConfig = {
  bundle: true,
  target: 'chrome120',
  format: /** @type {const} */ ('iife'),
  sourcemap: watch ? 'inline' : false,
};

// TypeScript entry points → compiled JS bundles
// 'out' paths are relative to outdir ('dist/')
const entryPoints = [
  { in: 'src/background/background.ts',  out: 'background/background' },
  { in: 'src/content/content.ts',        out: 'content/content' },
  { in: 'src/popup/popup.ts',            out: 'popup/popup' },
  { in: 'src/ocr/capture.ts',            out: 'ocr/capture' },
  { in: 'src/offscreen/offscreen.ts',    out: 'offscreen/offscreen' },
];

// Copy static assets from src/ to dist/
function copyStatic() {
  mkdirSync('dist/popup',     { recursive: true });
  mkdirSync('dist/content',   { recursive: true });
  mkdirSync('dist/icons',     { recursive: true });
  mkdirSync('dist/offscreen', { recursive: true });
  cpSync('src/manifest.json',               'dist/manifest.json');
  cpSync('src/popup/popup.html',            'dist/popup/popup.html');
  cpSync('src/popup/popup.css',             'dist/popup/popup.css');
  cpSync('src/content/content.css',         'dist/content/content.css');
  cpSync('src/offscreen/offscreen.html',    'dist/offscreen/offscreen.html');
}

// Copy Tesseract.js worker + WASM core files to dist/lib/
// Chrome supports SIMD, so use the simd-lstm variant (best accuracy).
function copyTesseract() {
  mkdirSync('dist/lib', { recursive: true });
  cpSync('node_modules/tesseract.js/dist/worker.min.js', 'dist/lib/worker.min.js');
  // Copy all core variants — Tesseract probes relaxedsimd → simd → fallback at runtime
  const cores = [
    'tesseract-core-relaxedsimd-lstm',
    'tesseract-core-simd-lstm',
    'tesseract-core-lstm',
  ];
  for (const name of cores) {
    cpSync(`node_modules/tesseract.js-core/${name}.wasm`,    `dist/lib/${name}.wasm`);
    cpSync(`node_modules/tesseract.js-core/${name}.wasm.js`, `dist/lib/${name}.wasm.js`);
    cpSync(`node_modules/tesseract.js-core/${name}.js`,      `dist/lib/${name}.js`);
  }
}

// Download eng.traineddata.gz if not already cached in dist/lib/
// ~4.7 MB, downloaded once and reused across builds.
async function ensureLanguageData() {
  const dest = 'dist/lib/eng.traineddata.gz';
  if (existsSync(dest)) return;
  console.log('Downloading eng.traineddata.gz (~4.7 MB, one-time)...');
  const res = await fetch('https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz');
  if (!res.ok) throw new Error(`Failed to fetch traineddata: ${res.status}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log('Language data ready.');
}

mkdirSync('dist/lib', { recursive: true });
copyTesseract();
await ensureLanguageData();

const buildConfig = { ...sharedConfig, entryPoints, outdir: 'dist', define: loadEnvDefines() };

if (watch) {
  const ctx = await esbuild.context(buildConfig);
  await ctx.watch();
  copyStatic();
  console.log('Watching for changes...');
} else {
  await esbuild.build(buildConfig);
  copyStatic();
  console.log('Build complete → dist/');
}
