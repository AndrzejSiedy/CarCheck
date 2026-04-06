// esbuild config — compiles src/ TypeScript to dist/
// Run: node build.js [--watch]
//
// Output structure mirrors src/ — Chrome loads the extension from dist/

import * as esbuild from 'esbuild';
import { cpSync, mkdirSync } from 'fs';

const watch = process.argv.includes('--watch');

const sharedConfig = {
  bundle: true,
  target: 'chrome120',
  format: /** @type {const} */ ('iife'),
  sourcemap: watch ? 'inline' : false,
};

// TypeScript entry points → compiled JS bundles
const entryPoints = [
  { in: 'src/background/background.ts', out: 'dist/background/background' },
  { in: 'src/content/content.ts',       out: 'dist/content/content' },
  { in: 'src/popup/popup.ts',           out: 'dist/popup/popup' },
  { in: 'src/ocr/capture.ts',           out: 'dist/ocr/capture' },
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

if (watch) {
  const ctx = await esbuild.context({ ...sharedConfig, entryPoints });
  await ctx.watch();
  copyStatic();
  console.log('Watching for changes...');
} else {
  await esbuild.build({ ...sharedConfig, entryPoints });
  copyStatic();
  console.log('Build complete → dist/');
}
