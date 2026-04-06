// Service worker — message routing, API calls, caching, auth
// Phase 0: returns mock DVSA data. Phase 1: real DVSA API fetch.

import { score } from '../scoring/engine';
import { getCached, setCache, isWithinFreeLimit, incrementUsage } from '../utils/cache';
import type { MotHistory, ScanResult } from '../types/mot';

// ─── Phase 0 mock data ────────────────────────────────────────────────────────
// Returned for any VRM until Phase 1 replaces this with a real API call.

const MOCK_HISTORY: MotHistory = {
  registration: 'LD19KXA',
  make: 'PORSCHE',
  model: '911 CARRERA S',
  firstUsedDate: '2019-04-01',
  motTests: [
    {
      completedDate: '2024-03-15',
      testResult: 'PASSED',
      odometerValue: 28500,
      odometerUnit: 'MI',
      advisories: ['Tyre worn close to legal limit nearside rear'],
      testStation: 'Porsche Centre London',
    },
    {
      completedDate: '2023-03-10',
      testResult: 'PASSED',
      odometerValue: 21200,
      odometerUnit: 'MI',
      advisories: [],
      testStation: 'Porsche Centre London',
    },
    {
      completedDate: '2022-03-08',
      testResult: 'PASSED',
      odometerValue: 14800,
      odometerUnit: 'MI',
      advisories: [],
      testStation: 'Porsche Centre London',
    },
  ],
};

// ─── message handler ──────────────────────────────────────────────────────────

interface CheckVrmMessage {
  type: 'CHECK_VRM';
  vrm: string;
  source: ScanResult['source'];
}

type CheckVrmResponse =
  | { ok: true;  result: ScanResult }
  | { ok: false; error: 'LIMIT_REACHED' | 'UNKNOWN' };

async function handleCheckVrm(vrm: string, source: ScanResult['source']): Promise<CheckVrmResponse> {
  // 1. Check cache
  const cached = await getCached(vrm);
  if (cached) {
    return { ok: true, result: { ...cached, cached: true } };
  }

  // 2. Check free tier limit
  if (!(await isWithinFreeLimit())) {
    return { ok: false, error: 'LIMIT_REACHED' };
  }

  // 3. Fetch MOT data (Phase 0: mock)
  const history: MotHistory = { ...MOCK_HISTORY, registration: vrm };

  // 4. Score
  const { score: points, verdict, flags } = score(history);

  const result: ScanResult = {
    vrm,
    make: history.make,
    model: history.model,
    scannedAt: Date.now(),
    source,
    score: points,
    verdict,
    flags,
    motHistory: history,
    cached: false,
  };

  // 5. Cache + meter
  await setCache(vrm, result);
  await incrementUsage();

  return { ok: true, result };
}

// ─── keyboard command relay ───────────────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'activate-ocr') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'LAUNCH_OCR' });
  }
});

// ─── message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: CheckVrmMessage | { type: 'CAPTURE_TAB' | 'LAUNCH_OCR' }, _sender, sendResponse) => {
    if (message.type === 'CHECK_VRM') {
      handleCheckVrm((message as CheckVrmMessage).vrm, (message as CheckVrmMessage).source)
        .then(sendResponse)
        .catch(() => sendResponse({ ok: false, error: 'UNKNOWN' }));
      return true;
    }

    if (message.type === 'CAPTURE_TAB') {
      chrome.tabs.captureVisibleTab({ format: 'png' })
        .then(dataUrl => sendResponse({ dataUrl }))
        .catch(() => sendResponse({ dataUrl: null }));
      return true;
    }
  }
);
