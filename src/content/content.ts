// Content script — listing detection, OCR overlay injection, verdict display
// Phase 0: floating "Check MOT" text input bar, injected via Shadow DOM.
// Phase 2: Alt+C triggers OCR drag-select overlay.

import { isValidVRM, normalise } from '../utils/vrm';
import { showOCROverlay } from '../ocr/capture';
import type { ScanResult } from '../types/mot';

// ─── listing site detection ───────────────────────────────────────────────────

type Source = ScanResult['source'];

function detectSource(): Source | null {
  const host = location.hostname;
  if (host.includes('autotrader'))  return 'autotrader';
  if (host.includes('ebay'))        return 'ebay';
  if (host.includes('gumtree'))     return 'gumtree';
  if (host.includes('facebook'))    return 'facebook';
  return null;
}

// ─── verdict colour mapping ───────────────────────────────────────────────────

const VERDICT_STYLE: Record<string, { bg: string; border: string; label: string }> = {
  great:   { bg: '#f0fdf4', border: '#16a34a', label: 'Great'   },
  ok:      { bg: '#fffcf0', border: '#d4a017', label: 'OK'      },
  caution: { bg: '#fff7ed', border: '#ea580c', label: 'Caution' },
  avoid:   { bg: '#ffdad6', border: '#ba1a1a', label: 'Avoid'   },
};

// ─── Shadow DOM UI ────────────────────────────────────────────────────────────

const BAR_STYLES = `
  :host { all: initial; }
  #cc-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 2147483647;
    background: #00327d;
    color: #fff;
    font-family: Inter, system-ui, sans-serif;
    font-size: 15px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.25);
  }
  #cc-bar label { font-weight: 700; font-size: 15px; letter-spacing: 0.03em; white-space: nowrap; }
  #cc-input {
    background: #fff;
    border: none;
    border-radius: 2px;
    padding: 7px 12px;
    font-size: 15px;
    font-family: inherit;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    width: 140px;
    outline: none;
  }
  #cc-btn {
    background: #fff;
    color: #00327d;
    border: none;
    border-radius: 2px;
    padding: 7px 16px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.04em;
  }
  #cc-btn:hover { background: #e0e3e5; }
  #cc-status { flex: 1; font-size: 14px; opacity: 0.9; }
  #cc-badge {
    display: none;
    align-items: center;
    gap: 6px;
    padding: 3px 10px 3px 7px;
    border-radius: 999px;
    border-left: 3px solid transparent;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  #cc-ocr-btn {
    background: rgba(255,255,255,0.15);
    color: #fff;
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 2px;
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }
  #cc-ocr-btn:hover { background: rgba(255,255,255,0.25); }
  #cc-ocr-btn.active {
    background: #fbbf24;
    color: #1a1a1a;
    border-color: #fbbf24;
  }
  #cc-close {
    background: none;
    border: none;
    color: rgba(255,255,255,0.7);
    font-size: 16px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    margin-left: auto;
  }
  #cc-close:hover { color: #fff; }
`;

const BAR_HTML = `
  <div id="cc-bar">
    <label>CarCheck</label>
    <input id="cc-input" type="text" placeholder="AB12 CDE" maxlength="8" spellcheck="false" />
    <button id="cc-btn">Check</button>
    <button id="cc-ocr-btn" title="Drag to select a number plate (Alt+C)">Scan plate</button>
    <span id="cc-status"></span>
    <span id="cc-badge"></span>
    <button id="cc-close" title="Close">×</button>
  </div>
`;

// ─── inject ───────────────────────────────────────────────────────────────────

function inject(source: Source): void {
  if (document.getElementById('carcheck-host')) return; // already injected

  const host = document.createElement('div');
  host.id = 'carcheck-host';
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = BAR_STYLES;
  shadow.appendChild(style);

  const wrapper = document.createElement('div');
  wrapper.innerHTML = BAR_HTML;
  shadow.appendChild(wrapper);

  document.body.insertBefore(host, document.body.firstChild);

  const input   = shadow.getElementById('cc-input')   as HTMLInputElement;
  const btn     = shadow.getElementById('cc-btn')      as HTMLButtonElement;
  const ocrBtn  = shadow.getElementById('cc-ocr-btn')  as HTMLButtonElement;
  const status  = shadow.getElementById('cc-status')   as HTMLSpanElement;
  const badge   = shadow.getElementById('cc-badge')    as HTMLSpanElement;
  const close   = shadow.getElementById('cc-close')    as HTMLButtonElement;

  close.addEventListener('click', () => host.remove());

  function setOcrActive(active: boolean) {
    ocrBtn.classList.toggle('active', active);
    ocrBtn.textContent = active ? 'Scanning… (Esc)' : 'Scan plate';
  }

  ocrBtn.addEventListener('click', () => triggerOCR());

  async function submit(): Promise<void> {
    const raw = input.value.trim();
    if (!isValidVRM(raw)) {
      status.textContent = 'Invalid plate — try again';
      return;
    }

    const vrm = normalise(raw);
    status.textContent = `Checking ${vrm}…`;
    badge.style.display = 'none';
    btn.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({ type: 'CHECK_VRM', vrm, source });

      if (!response.ok) {
        if (response.error === 'LIMIT_REACHED') {
          status.textContent = '3 free checks used — upgrade for more';
        } else {
          status.textContent = `Error: ${(response as { detail?: string }).detail ?? 'unknown'}`;
        }
        return;
      }

      const result: ScanResult = response.result;
      const style_v = VERDICT_STYLE[result.verdict] ?? VERDICT_STYLE.caution;

      status.textContent = `${result.make} ${result.model} · ${result.score}/100`;

      badge.style.display = 'inline-flex';
      badge.style.background = style_v.bg;
      badge.style.borderColor = style_v.border;
      badge.style.color = style_v.border;
      badge.textContent = style_v.label;

    } catch {
      status.textContent = 'Error contacting extension background';
    } finally {
      btn.disabled = false;
    }
  }

  btn.addEventListener('click', submit);
  input.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') submit();
  });

  // Alt+C — show OCR drag-select overlay
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.altKey && (e.key === 'c' || e.key === 'C' || e.code === 'KeyC')) {
      e.preventDefault();
      triggerOCR();
    }
  }, true); // capture phase — fires before site handlers can stop it

  function triggerOCR() {
    setOcrActive(true);
    showOCROverlay(
      (vrm) => {
        setOcrActive(false);
        input.value = vrm;
        submit();
      },
      () => setOcrActive(false)
    );
  }
}

// ─── Chrome command listener (Alt+C registered in manifest) ──────────────────

function launchOCR() {
  // Re-inject bar if it was dismissed, so the VRM result has somewhere to go
  const currentSource = detectSource();
  if (currentSource && !document.getElementById('carcheck-host')) inject(currentSource);
  // triggerOCR is scoped inside inject(); re-fire via keydown simulation isn't clean,
  // so we directly call showOCROverlay here for the command path.
  const host = document.getElementById('carcheck-host');
  if (!host) return;
  const shadow = host.shadowRoot!;
  const ocrBtn = shadow.getElementById('cc-ocr-btn') as HTMLButtonElement;
  ocrBtn?.click();
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'LAUNCH_OCR') launchOCR();
});

// ─── entry point ──────────────────────────────────────────────────────────────

const source = detectSource();
if (source) inject(source);
