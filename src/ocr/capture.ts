// OCR capture — drag-to-select overlay, Tesseract.js integration
// Phase 2: free tier client-side OCR via Tesseract.js (lazy-loaded).

import { isValidVRM, normalise } from '../utils/vrm';

// ─── overlay styles ───────────────────────────────────────────────────────────

const OVERLAY_STYLES = `
  :host { all: initial; }

  #cc-ocr-overlay {
    position: fixed;
    inset: 0;
    z-index: 2147483646;
    cursor: crosshair;
    user-select: none;
    background: rgba(0, 0, 0, 0.5);
    font-family: Inter, system-ui, sans-serif;
  }

  #cc-hint {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #00327d;
    color: #fff;
    padding: 10px 20px;
    border-radius: 999px;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.02em;
    pointer-events: none;
    white-space: nowrap;
  }

  #cc-selection {
    position: absolute;
    border: 2px dashed #00327d;
    background: rgba(0, 50, 125, 0.08);
    display: none;
  }

  .cc-corner {
    position: absolute;
    width: 8px;
    height: 8px;
    background: #00327d;
  }
  .cc-corner.tl { top: -2px; left: -2px; }
  .cc-corner.tr { top: -2px; right: -2px; }
  .cc-corner.bl { bottom: -2px; left: -2px; }
  .cc-corner.br { bottom: -2px; right: -2px; }

  #cc-scan-status {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    background: #00327d;
    color: #fff;
    padding: 4px 12px;
    border-radius: 2px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    display: none;
  }

  #cc-vrm-confirm {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    background: #fff;
    border: 2px solid #00327d;
    border-radius: 2px;
    display: none;
    align-items: center;
    gap: 6px;
    padding: 4px 6px;
  }

  #cc-vrm-input {
    border: none;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    outline: none;
    width: 120px;
    color: #191c1e;
  }

  #cc-vrm-ok {
    background: #00327d;
    color: #fff;
    border: none;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    border-radius: 2px;
  }

  #cc-cancel {
    position: fixed;
    top: 12px;
    right: 16px;
    background: rgba(255,255,255,0.15);
    color: #fff;
    border: none;
    padding: 6px 14px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border-radius: 2px;
    font-family: inherit;
  }
  #cc-cancel:hover { background: rgba(255,255,255,0.25); }
`;

const OVERLAY_HTML = `
  <div id="cc-ocr-overlay">
    <div id="cc-hint">Drag over the number plate</div>
    <div id="cc-selection">
      <div class="cc-corner tl"></div>
      <div class="cc-corner tr"></div>
      <div class="cc-corner bl"></div>
      <div class="cc-corner br"></div>
      <div id="cc-scan-status">Scanning…</div>
      <div id="cc-vrm-confirm">
        <input id="cc-vrm-input" type="text" maxlength="8" spellcheck="false" />
        <button id="cc-vrm-ok">Use</button>
      </div>
    </div>
    <button id="cc-cancel">✕ Cancel (Esc)</button>
  </div>
`;


function extractVRM(text: string): string | null {
  const cleaned = text.replace(/[^A-Z0-9]/gi, ' ').toUpperCase();
  const patterns = [
    /\b[A-Z]{2}[0-9]{2}[A-Z]{3}\b/,
    /\b[A-Z][0-9]{1,3}[A-Z]{3}\b/,
    /\b[A-Z]{3}[0-9]{1,3}[A-Z]\b/,
  ];
  for (const p of patterns) {
    const m = cleaned.match(p);
    if (m) return m[0];
  }
  return null;
}

function cropScreenshot(
  fullDataUrl: string,
  rect: { x: number; y: number; width: number; height: number },
  dpr: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = rect.width  * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img,
        rect.x * dpr, rect.y * dpr, rect.width * dpr, rect.height * dpr,
        0, 0, canvas.width, canvas.height
      );
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = fullDataUrl;
  });
}

// ─── main export ──────────────────────────────────────────────────────────────

export function showOCROverlay(
  onVRM: (vrm: string) => void,
  onCancel: () => void
): void {
  if (document.getElementById('carcheck-ocr-host')) return;

  const host = document.createElement('div');
  host.id = 'carcheck-ocr-host';
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = OVERLAY_STYLES;
  shadow.appendChild(style);

  const wrapper = document.createElement('div');
  wrapper.innerHTML = OVERLAY_HTML;
  shadow.appendChild(wrapper);
  document.body.appendChild(host);

  const hint       = shadow.getElementById('cc-hint')!;
  const selection  = shadow.getElementById('cc-selection')!;
  const scanStatus = shadow.getElementById('cc-scan-status')!;
  const vrmConfirm = shadow.getElementById('cc-vrm-confirm')!;
  const vrmInput   = shadow.getElementById('cc-vrm-input') as HTMLInputElement;
  const vrmOk      = shadow.getElementById('cc-vrm-ok')!;
  const cancelBtn  = shadow.getElementById('cc-cancel')!;
  const overlay    = shadow.getElementById('cc-ocr-overlay')!;

  let startX = 0, startY = 0, dragging = false;

  function dismiss() { host.remove(); }
  function cancel()  { dismiss(); onCancel(); }

  cancelBtn.addEventListener('click', cancel);

  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { document.removeEventListener('keydown', escHandler); cancel(); }
  };
  document.addEventListener('keydown', escHandler);

  overlay.addEventListener('mousedown', (e: MouseEvent) => {
    // Only start a new drag when clicking directly on the overlay background.
    // Clicks on the cancel button, confirm box, or selection box must not reset state.
    const target = e.target as Element;
    if (target.id !== 'cc-ocr-overlay') return;
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    hint.style.display = 'none';
    selection.style.display = 'block';
    scanStatus.style.display = 'none';
    vrmConfirm.style.display = 'none';
    updateSelection(e.clientX, e.clientY);
  });

  overlay.addEventListener('mousemove', (e: MouseEvent) => {
    if (dragging) updateSelection(e.clientX, e.clientY);
  });

  overlay.addEventListener('mouseup', async (e: MouseEvent) => {
    if (!dragging) return;
    dragging = false;

    const rect = getRect(startX, startY, e.clientX, e.clientY);
    if (rect.width < 20 || rect.height < 10) return;

    scanStatus.textContent = 'Scanning…';
    scanStatus.style.display = 'block';
    vrmConfirm.style.display = 'none';

    try {
      const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_TAB' });
      if (!response?.dataUrl) throw new Error('No screenshot returned');

      const dpr = window.devicePixelRatio || 1;
      const cropped = await cropScreenshot(response.dataUrl, rect, dpr);

      const ocrResult = await chrome.runtime.sendMessage({ type: 'OCR_RECOGNIZE', dataUrl: cropped });
      if (ocrResult?.error) throw new Error(ocrResult.error);
      const vrm = extractVRM(ocrResult.text);

      scanStatus.style.display = 'none';

      if (vrm && isValidVRM(vrm)) {
        vrmInput.value = normalise(vrm);
      } else {
        vrmInput.value = ocrResult.text.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 8);
      }
      vrmConfirm.style.display = 'flex';
      vrmInput.focus();

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[CarCheck OCR]', msg);
      scanStatus.textContent = `Scan failed: ${msg}`;
    }
  });

  function submitVRM() {
    const vrm = normalise(vrmInput.value);
    if (!vrm) return;
    dismiss();
    onVRM(vrm);
  }

  vrmOk.addEventListener('click', submitVRM);
  vrmInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') submitVRM();
  });

  function getRect(x1: number, y1: number, x2: number, y2: number) {
    return { x: Math.min(x1,x2), y: Math.min(y1,y2), width: Math.abs(x2-x1), height: Math.abs(y2-y1) };
  }

  function updateSelection(cx: number, cy: number) {
    const r = getRect(startX, startY, cx, cy);
    Object.assign(selection.style, { left: r.x+'px', top: r.y+'px', width: r.width+'px', height: r.height+'px' });
  }
}
