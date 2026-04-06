// esbuild config — compiles src/ TypeScript to dist/
// Run: node build.js [--watch]
//
// Output structure mirrors src/ — Chrome loads the extension from dist/

import * as esbuild from 'esbuild';
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'fs';

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
  { in: 'src/background/background.ts', out: 'background/background' },
  { in: 'src/content/content.ts',       out: 'content/content' },
  { in: 'src/popup/popup.ts',           out: 'popup/popup' },
  { in: 'src/ocr/capture.ts',           out: 'ocr/capture' },
];

// Copy static assets from src/ to dist/
function copyStatic() {
  mkdirSync('dist/popup', { recursive: true });
  mkdirSync('dist/content', { recursive: true });
  mkdirSync('dist/icons', { recursive: true });
  cpSync('src/manifest.json', 'dist/manifest.json');
  cpSync('src/popup/popup.html', 'dist/popup/popup.html');
  cpSync('src/popup/popup.css', 'dist/popup/popup.css');
  cpSync('src/content/content.css', 'dist/content/content.css');
}

// Copy Tesseract.js worker + WASM core files to dist/lib/
// Chrome supports SIMD, so use the simd-lstm variant (best accuracy).
function copyTesseract() {
  mkdirSync('dist/lib', { recursive: true });
  cpSync('node_modules/tesseract.js/dist/worker.min.js',
         'dist/lib/worker.min.js');
  cpSync('node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm',
         'dist/lib/tesseract-core-simd-lstm.wasm');
  cpSync('node_modules/tesseract.js-core/tesseract-core-simd-lstm.js',
         'dist/lib/tesseract-core-simd-lstm.js');
  // Fallback for browsers without SIMD
  cpSync('node_modules/tesseract.js-core/tesseract-core-lstm.wasm',
         'dist/lib/tesseract-core-lstm.wasm');
  cpSync('node_modules/tesseract.js-core/tesseract-core-lstm.js',
         'dist/lib/tesseract-core-lstm.js');
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

const buildConfig = { ...sharedConfig, entryPoints, outdir: 'dist' };

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
