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
    if (res.status === 404) throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
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
  | { ok: false; error: 'LIMIT_REACHED' | 'NOT_FOUND' | 'UNKNOWN' };

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

// ─── offscreen document (Tesseract OCR) ──────────────────────────────────────

async function ensureOffscreenDocument(): Promise<void> {
  const existing = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  if (existing.length === 0) {
    await chrome.offscreen.createDocument({
      url: 'offscreen/offscreen.html',
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: 'Run Tesseract.js OCR worker in extension context to avoid page CSP',
    });
  }
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
  (message: CheckVrmMessage | { type: 'CAPTURE_TAB' | 'LAUNCH_OCR' | 'OCR_RECOGNIZE'; dataUrl?: string }, _sender, sendResponse) => {
    if (message.type === 'CHECK_VRM') {
      handleCheckVrm((message as CheckVrmMessage).vrm, (message as CheckVrmMessage).source)
        .then(sendResponse)
        .catch((err: unknown) => {
          if (err instanceof Error && (err as Error & { code?: string }).code === 'NOT_FOUND') {
            sendResponse({ ok: false, error: 'NOT_FOUND' });
            return;
          }
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[CarCheck] CHECK_VRM failed:', msg);
          sendResponse({ ok: false, error: 'UNKNOWN', detail: msg });
        });
      return true;
    }

    if (message.type === 'OCR_RECOGNIZE') {
      ensureOffscreenDocument()
        .then(() => chrome.runtime.sendMessage({ type: 'OFFSCREEN_OCR', dataUrl: message.dataUrl }))
        .then(sendResponse)
        .catch((err: unknown) => sendResponse({ error: err instanceof Error ? err.message : String(err) }));
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
