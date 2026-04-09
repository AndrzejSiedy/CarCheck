// Service worker — message routing, API calls, caching, auth

import { score } from '../scoring/engine';
import { getCached, setCache, isWithinFreeLimit, incrementUsage } from '../utils/cache';
import type { MotHistory, ScanResult } from '../types/mot';

// ─── DVSA proxy ───────────────────────────────────────────────────────────────
// OAuth2 client credentials can't be redeemed cross-origin from a Chrome extension.
// All DVSA calls go through our Vercel proxy which holds the credentials server-side.

declare const process: { env: Record<string, string> };

const PROXY_BASE = process.env.PROXY_BASE_URL;

// ─── DVSA response → MotHistory mapper ───────────────────────────────────────

interface DvsaDefect { text: string; type: string; dangerous?: boolean }
interface DvsaTest {
  completedDate: string;
  testResult: string;
  odometerValue: string;
  odometerUnit: string;
  defects?: DvsaDefect[];
}
interface DvsaResponse {
  registration: string;
  make: string;
  model: string;
  firstUsedDate: string;
  motTests?: DvsaTest[];
}

function mapDvsaResponse(raw: DvsaResponse): MotHistory {
  return {
    registration: raw.registration,
    make: raw.make,
    model: raw.model,
    firstUsedDate: raw.firstUsedDate.substring(0, 10),
    motTests: (raw.motTests ?? []).map(t => ({
      completedDate: t.completedDate.substring(0, 10),
      testResult: t.testResult === 'PASSED' ? 'PASSED' : 'FAILED',
      odometerValue: parseInt(t.odometerValue, 10) || 0,
      odometerUnit: t.odometerUnit === 'KM' ? 'KM' : 'MI',
      advisories: (t.defects ?? [])
        .filter(d => d.type === 'ADVISORY')
        .map(d => d.text),
    })),
  };
}

async function fetchDvsaHistory(vrm: string): Promise<MotHistory> {
  const res = await fetch(`${PROXY_BASE}/api/mot?vrm=${encodeURIComponent(vrm)}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`DVSA proxy error: ${res.status} ${body}`);
  }
  return mapDvsaResponse(await res.json() as DvsaResponse);
}

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

  // 3. Fetch MOT data from DVSA API
  const history = await fetchDvsaHistory(vrm);

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
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[CarCheck] CHECK_VRM failed:', msg);
          sendResponse({ ok: false, error: 'UNKNOWN', detail: msg });
        });
      return true;
    }

    if (message.type === 'CAPTURE_TAB') {
      chrome.tabs.captureVisibleTab({ format: 'png' })
        .then(dataUrl => sendResponse({ dataUrl }))
        .catch((err: unknown) => {
          console.error('[CarCheck] CAPTURE_TAB failed:', err instanceof Error ? err.message : String(err));
          sendResponse({ dataUrl: null });
        });
      return true;
    }
  }
);
