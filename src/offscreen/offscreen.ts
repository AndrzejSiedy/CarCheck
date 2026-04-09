// Offscreen document — runs Tesseract.js in extension context (bypasses page CSP)
// Created on demand by the background service worker.

import { createWorker } from 'tesseract.js';

let worker: Awaited<ReturnType<typeof createWorker>> | null = null;

async function getWorker() {
  if (worker) return worker;
  worker = await createWorker('eng', 1, {
    workerPath:    chrome.runtime.getURL('lib/worker.min.js'),
    corePath:      chrome.runtime.getURL('lib/'),
    langPath:      chrome.runtime.getURL('lib/'),
    workerBlobURL: false,
    cacheMethod:   'none',
    logger:        () => {},
  });
  return worker;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'OFFSCREEN_OCR') return false;
  getWorker()
    .then(w => w.recognize(msg.dataUrl))
    .then(({ data }) => sendResponse({ text: data.text }))
    .catch((err: unknown) => sendResponse({ error: err instanceof Error ? err.message : String(err) }));
  return true;
});
