// Content script — listing detection, OCR overlay, verdict bar, result panel, onboarding

import { isValidVRM, normalise } from '../utils/vrm';
import { showOCROverlay } from '../ocr/capture';
import type { ScanResult, Flag, MotTest } from '../types/mot';

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

// ─── helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatMileage(v: number, u: string): string {
  return `${v.toLocaleString()} ${u === 'KM' ? 'km' : 'mi'}`;
}

function formatVRM(vrm: string): string {
  // Current format AB12CDE → AB12 CDE
  if (/^[A-Z]{2}\d{2}[A-Z]{3}$/.test(vrm)) return `${vrm.slice(0, 4)} ${vrm.slice(4)}`;
  return vrm;
}

function getCleanStreak(tests: MotTest[]): number {
  let streak = 0;
  for (const t of tests) {
    if (t.testResult === 'PASSED') streak++;
    else break;
  }
  return streak;
}

// ─── bar styles & html ────────────────────────────────────────────────────────

const BAR_STYLES = `
  :host { all: initial; }
  #cc-bar {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 2147483647;
    background: #00327d;
    color: #fff;
    font-family: Inter, system-ui, sans-serif;
    font-size: 15px;
    display: flex;
    flex-direction: column;
    padding: 10px 16px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.25);
  }
  #cc-bar-row {
    display: flex;
    align-items: center;
    gap: 12px;
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
  #cc-btn:disabled { opacity: 0.5; cursor: default; }
  #cc-status { flex: 1; font-size: 14px; opacity: 0.9; }
  #cc-badge {
    display: none;
    align-items: center;
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
  #cc-ocr-btn.active { background: #fbbf24; color: #1a1a1a; border-color: #fbbf24; }
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
  #cc-flags {
    display: none;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }
  .cc-flag {
    display: inline-flex;
    flex-direction: column;
    padding: 3px 9px;
    border-radius: 4px;
    border-left: 3px solid transparent;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    user-select: none;
  }
  .cc-flag--critical { background: #ffdad6; border-color: #ba1a1a; color: #ba1a1a; }
  .cc-flag--warning  { background: #fff7ed; border-color: #ea580c; color: #ea580c; }
  .cc-flag--info     { background: #f0fdf4; border-color: #16a34a; color: #16a34a; }
  .cc-flag-detail {
    display: none;
    font-size: 11px;
    font-weight: 400;
    margin-top: 3px;
    opacity: 0.85;
  }
  .cc-flag.open .cc-flag-detail { display: block; }
`;

const BAR_HTML = `
  <div id="cc-bar">
    <div id="cc-bar-row">
      <label>CarCheck</label>
      <input id="cc-input" type="text" placeholder="AB12 CDE" maxlength="8" spellcheck="false" />
      <button id="cc-btn">Check</button>
      <button id="cc-ocr-btn" title="Drag to select a number plate (Alt+C)">Scan plate</button>
      <span id="cc-status"></span>
      <span id="cc-badge"></span>
      <button id="cc-close" title="Close">×</button>
    </div>
    <div id="cc-flags"></div>
  </div>
`;

// ─── result panel ─────────────────────────────────────────────────────────────

const PANEL_STYLES = `
  :host { all: initial; }
  *, *::before, *::after { box-sizing: border-box; }
  #cc-panel {
    position: fixed;
    right: 0; top: 0; bottom: 0;
    width: 360px;
    z-index: 2147483646;
    display: flex;
    flex-direction: column;
    background: #fff;
    box-shadow: -8px 0 32px rgba(0,0,0,0.18);
    font-family: Inter, system-ui, sans-serif;
    color: #191c1e;
    font-size: 13px;
  }
  /* Header — same blue as bar so they merge visually at top */
  #cc-ph {
    background: #00327d;
    color: #fff;
    padding: 52px 16px 16px;
    flex-shrink: 0;
  }
  .cc-ph-row1 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }
  .cc-vrm-plate {
    background: #FFD500;
    color: #000;
    font-weight: 800;
    font-size: 17px;
    letter-spacing: 0.1em;
    padding: 5px 11px;
    border-radius: 2px;
  }
  .cc-pass-chip {
    padding: 3px 8px;
    border-radius: 2px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
  }
  .cc-pass-chip.pass { background: #f0fdf4; color: #16a34a; }
  .cc-pass-chip.fail { background: #ffdad6; color: #ba1a1a; }
  #cc-panel-close {
    margin-left: auto;
    background: rgba(255,255,255,0.15);
    border: none;
    color: #fff;
    width: 28px; height: 28px;
    border-radius: 2px;
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    font-family: inherit;
  }
  #cc-panel-close:hover { background: rgba(255,255,255,0.28); }
  .cc-vehicle-name {
    font-size: 21px;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-bottom: 10px;
    line-height: 1.2;
  }
  .cc-score-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .cc-score-num {
    font-size: 42px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1;
  }
  .cc-score-cap { font-size: 15px; opacity: 0.5; }
  .cc-verdict-pill {
    display: inline-flex;
    align-items: center;
    height: 22px;
    padding: 0 8px;
    border-radius: 11px;
    border-left: 3px solid transparent;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    margin-left: 6px;
  }
  .cc-verdict-pill.great   { background: #f0fdf4; color: #16a34a; border-color: #16a34a; }
  .cc-verdict-pill.ok      { background: #fffcf0; color: #d4a017; border-color: #d4a017; }
  .cc-verdict-pill.caution { background: #fff7ed; color: #ea580c; border-color: #ea580c; }
  .cc-verdict-pill.avoid   { background: #ffdad6; color: #ba1a1a; border-color: #ba1a1a; }
  .cc-timestamp { font-size: 10px; opacity: 0.5; margin-top: 6px; }
  /* Scrollable body */
  #cc-pb {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .cc-sect {
    padding: 14px 16px;
    border-top: 1px solid rgba(195,198,213,0.3);
  }
  .cc-sect:first-child { border-top: none; }
  .cc-sect-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #515f74;
    margin-bottom: 12px;
  }
  /* MOT Timeline */
  .cc-timeline {
    display: flex;
    align-items: flex-start;
    overflow-x: auto;
    padding-bottom: 2px;
  }
  .cc-tl-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
  }
  .cc-tl-dot {
    width: 13px; height: 13px;
    border-radius: 50%;
  }
  .cc-tl-dot.pass { background: #16a34a; }
  .cc-tl-dot.fail { background: #ba1a1a; }
  .cc-tl-year { font-size: 10px; color: #515f74; font-weight: 500; white-space: nowrap; }
  .cc-tl-line {
    width: 18px;
    flex-shrink: 0;
    height: 2px;
    background: #e0e3e5;
    margin-top: 6px;
    align-self: flex-start;
  }
  /* Alerts */
  .cc-alert {
    padding: 8px 10px;
    border-radius: 2px;
    border-left: 3px solid transparent;
    margin-bottom: 6px;
  }
  .cc-alert:last-child { margin-bottom: 0; }
  .cc-alert.critical { background: #ffdad6; border-color: #ba1a1a; }
  .cc-alert.warning  { background: #fff7ed; border-color: #ea580c; }
  .cc-alert.info     { background: #f0fdf4; border-color: #16a34a; }
  .cc-alert-label { font-weight: 600; font-size: 12px; margin-bottom: 2px; }
  .cc-alert-detail { font-size: 11px; opacity: 0.75; line-height: 1.4; }
  /* Bento breakdown */
  .cc-bento {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .cc-chip {
    background: #f2f4f6;
    border-radius: 2px;
    padding: 9px 11px;
  }
  .cc-chip-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #515f74;
    margin-bottom: 3px;
  }
  .cc-chip-value {
    font-size: 14px;
    font-weight: 700;
    color: #191c1e;
    letter-spacing: -0.01em;
  }
  /* Footer */
  #cc-pf {
    padding: 12px 16px;
    display: flex;
    gap: 8px;
    border-top: 1px solid rgba(195,198,213,0.3);
    flex-shrink: 0;
  }
  .cc-btn-prim {
    flex: 1;
    background: #00327d;
    color: #fff;
    border: none;
    border-radius: 2px;
    padding: 10px 8px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    font-family: Inter, system-ui, sans-serif;
    letter-spacing: 0.02em;
    transition: background 0.15s;
  }
  .cc-btn-prim:hover { background: #0047ab; }
  .cc-btn-prim:disabled { background: #515f74; cursor: default; }
  .cc-btn-out {
    flex: 1;
    background: transparent;
    color: #00327d;
    border: 1.5px solid #00327d;
    border-radius: 2px;
    padding: 10px 8px;
    font-size: 12px;
    font-weight: 700;
    font-family: Inter, system-ui, sans-serif;
    letter-spacing: 0.02em;
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

function buildTimelineHTML(tests: MotTest[]): string {
  if (!tests.length) return '';
  const shown = tests.slice(0, 8).reverse(); // oldest → newest, left → right
  const inner = shown.map((t, i) =>
    `<div class="cc-tl-item">
       <div class="cc-tl-dot ${t.testResult === 'PASSED' ? 'pass' : 'fail'}"></div>
       <span class="cc-tl-year">${t.completedDate.slice(0, 4)}</span>
     </div>${i < shown.length - 1 ? '<div class="cc-tl-line"></div>' : ''}`
  ).join('');
  return `
    <div class="cc-sect">
      <div class="cc-sect-label">MOT History · ${tests.length} test${tests.length !== 1 ? 's' : ''} on record</div>
      <div class="cc-timeline">${inner}</div>
    </div>`;
}

function buildAlertsHTML(flags: Flag[]): string {
  if (!flags.length) return '';
  const items = flags.map(f =>
    `<div class="cc-alert ${f.severity}">
       <div class="cc-alert-label">${f.label}</div>
       <div class="cc-alert-detail">${f.detail}</div>
     </div>`
  ).join('');
  return `
    <div class="cc-sect">
      <div class="cc-sect-label">System Alerts</div>
      ${items}
    </div>`;
}

function buildBreakdownHTML(r: ScanResult, streak: number): string {
  const t = r.motHistory.motTests[0];
  const chips: Array<{ label: string; value: string }> = [
    { label: 'Latest Test',     value: t ? formatDate(t.completedDate) : '—' },
    { label: 'Advisories',      value: t ? `${t.advisories.length} found` : '—' },
    { label: 'Last Mileage',    value: t ? formatMileage(t.odometerValue, t.odometerUnit) : '—' },
    { label: 'Tests on Record', value: `${r.motHistory.motTests.length}` },
    { label: 'Clean Streak',    value: streak >= 3 ? `${streak} passes` : 'Under 3' },
    { label: 'Score',           value: `${r.score} / 100` },
  ];
  const html = chips.map(c =>
    `<div class="cc-chip">
       <div class="cc-chip-label">${c.label}</div>
       <div class="cc-chip-value">${c.value}</div>
     </div>`
  ).join('');
  return `
    <div class="cc-sect">
      <div class="cc-sect-label">Score Breakdown</div>
      <div class="cc-bento">${html}</div>
    </div>`;
}

function buildPanelHTML(r: ScanResult): string {
  const latest = r.motHistory.motTests[0];
  const passText  = latest?.testResult === 'PASSED' ? 'PASS' : 'FAIL';
  const passClass = latest?.testResult === 'PASSED' ? 'pass' : 'fail';
  const streak = getCleanStreak(r.motHistory.motTests);
  const vs = VERDICT_STYLE[r.verdict] ?? VERDICT_STYLE.caution;

  return `
    <div id="cc-panel">
      <div id="cc-ph">
        <div class="cc-ph-row1">
          <span class="cc-vrm-plate">${formatVRM(r.vrm)}</span>
          <span class="cc-pass-chip ${passClass}">${passText}</span>
          <button id="cc-panel-close">×</button>
        </div>
        <div class="cc-vehicle-name">${r.make} ${r.model}</div>
        <div class="cc-score-row">
          <span class="cc-score-num">${r.score}</span>
          <span class="cc-score-cap">/ 100</span>
          <span class="cc-verdict-pill ${r.verdict}">${vs.label}</span>
        </div>
        <div class="cc-timestamp">Checked ${timeAgo(r.scannedAt)}${r.cached ? ' · cached' : ''}</div>
      </div>
      <div id="cc-pb">
        ${buildTimelineHTML(r.motHistory.motTests)}
        ${buildAlertsHTML(r.flags)}
        ${buildBreakdownHTML(r, streak)}
      </div>
      <div id="cc-pf">
        <button id="cc-save-btn" class="cc-btn-prim">Save to Shortlist</button>
        <button class="cc-btn-out" title="Upgrade to access full reports">Full Report ↗</button>
      </div>
    </div>`;
}

function showResultPanel(r: ScanResult): void {
  document.getElementById('carcheck-panel-host')?.remove();

  const host = document.createElement('div');
  host.id = 'carcheck-panel-host';
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = PANEL_STYLES;
  shadow.appendChild(style);

  const wrapper = document.createElement('div');
  wrapper.innerHTML = buildPanelHTML(r);
  shadow.appendChild(wrapper);

  document.body.appendChild(host);

  shadow.getElementById('cc-panel-close')?.addEventListener('click', () => host.remove());

  const saveBtn = shadow.getElementById('cc-save-btn') as HTMLButtonElement | null;
  saveBtn?.addEventListener('click', () => {
    if (saveBtn) {
      saveBtn.textContent = 'Saved ✓';
      saveBtn.disabled = true;
    }
  });
}

// ─── onboarding ───────────────────────────────────────────────────────────────

const ONBOARDING_STEPS = [
  {
    title: 'CarCheck is ready',
    body: 'Instant MOT history for any UK listing — no tab-switching, no manual lookups.',
  },
  {
    title: 'Scan a plate',
    body: 'Click "Scan plate" in the bar above (or press Alt+C), then drag over any number plate image.',
  },
  {
    title: 'Read the verdict',
    body: 'A 0–100 score with colour-coded flags tells you exactly what\'s in the MOT history.',
  },
];

const ONBOARDING_STYLES = `
  :host { all: initial; }
  #cc-ob-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(25,28,30,0.5);
    backdrop-filter: blur(3px);
    z-index: 2147483645;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: Inter, system-ui, sans-serif;
  }
  #cc-ob-card {
    background: #fff;
    border-radius: 4px;
    width: 320px;
    padding: 28px 24px 20px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.22);
    color: #191c1e;
  }
  .cc-ob-progress {
    display: flex;
    gap: 4px;
    margin-bottom: 22px;
  }
  .cc-ob-pip {
    height: 4px;
    border-radius: 2px;
    flex: 1;
    background: #e0e3e5;
    transition: background 0.2s;
  }
  .cc-ob-pip.active { background: #00327d; }
  .cc-ob-title {
    font-size: 19px;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-bottom: 8px;
  }
  .cc-ob-body {
    font-size: 13px;
    color: #434653;
    line-height: 1.6;
    margin-bottom: 24px;
  }
  .cc-ob-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .cc-ob-skip {
    background: none;
    border: none;
    font-family: inherit;
    font-size: 12px;
    color: #515f74;
    cursor: pointer;
    padding: 0;
  }
  .cc-ob-skip:hover { color: #191c1e; }
  .cc-ob-next {
    background: #00327d;
    color: #fff;
    border: none;
    border-radius: 2px;
    padding: 9px 20px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    letter-spacing: 0.02em;
  }
  .cc-ob-next:hover { background: #0047ab; }
`;

function showOnboarding(): void {
  const host = document.createElement('div');
  host.id = 'carcheck-onboarding-host';
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = ONBOARDING_STYLES;
  shadow.appendChild(style);

  const wrapper = document.createElement('div');
  shadow.appendChild(wrapper);

  let step = 0;

  function render(): void {
    const s = ONBOARDING_STEPS[step];
    const isLast = step === ONBOARDING_STEPS.length - 1;
    const pips = ONBOARDING_STEPS.map((_, i) =>
      `<div class="cc-ob-pip${i <= step ? ' active' : ''}"></div>`
    ).join('');

    wrapper.innerHTML = `
      <div id="cc-ob-backdrop">
        <div id="cc-ob-card">
          <div class="cc-ob-progress">${pips}</div>
          <div class="cc-ob-title">${s.title}</div>
          <div class="cc-ob-body">${s.body}</div>
          <div class="cc-ob-actions">
            <button class="cc-ob-skip" id="cc-ob-skip">Skip tour</button>
            <button class="cc-ob-next" id="cc-ob-next">${isLast ? 'Get started' : 'Next →'}</button>
          </div>
        </div>
      </div>`;

    shadow.getElementById('cc-ob-next')?.addEventListener('click', () => {
      if (isLast) {
        host.remove();
        chrome.storage.local.set({ onboardingComplete: true });
      } else {
        step++;
        render();
      }
    });
    shadow.getElementById('cc-ob-skip')?.addEventListener('click', () => {
      host.remove();
      chrome.storage.local.set({ onboardingComplete: true });
    });
  }

  render();
  document.body.appendChild(host);
}

async function checkAndShowOnboarding(): Promise<void> {
  const data = await chrome.storage.local.get('onboardingComplete');
  if (!data.onboardingComplete) {
    setTimeout(showOnboarding, 700); // let bar render first
  }
}

// ─── inject ───────────────────────────────────────────────────────────────────

function inject(source: Source): void {
  if (document.getElementById('carcheck-host')) return;

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

  const input  = shadow.getElementById('cc-input')   as HTMLInputElement;
  const btn    = shadow.getElementById('cc-btn')      as HTMLButtonElement;
  const ocrBtn = shadow.getElementById('cc-ocr-btn')  as HTMLButtonElement;
  const status = shadow.getElementById('cc-status')   as HTMLSpanElement;
  const badge  = shadow.getElementById('cc-badge')    as HTMLSpanElement;
  const flags  = shadow.getElementById('cc-flags')    as HTMLDivElement;
  const close  = shadow.getElementById('cc-close')    as HTMLButtonElement;

  close.addEventListener('click', () => {
    host.remove();
    document.getElementById('carcheck-panel-host')?.remove();
  });

  function setOcrActive(active: boolean): void {
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
    flags.style.display = 'none';
    flags.innerHTML = '';
    btn.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({ type: 'CHECK_VRM', vrm, source });

      if (!response.ok) {
        status.textContent = response.error === 'LIMIT_REACHED'
          ? '3 free checks used — upgrade for more'
          : `Error: ${(response as { detail?: string }).detail ?? 'unknown'}`;
        return;
      }

      const result: ScanResult = response.result;
      const vs = VERDICT_STYLE[result.verdict] ?? VERDICT_STYLE.caution;

      status.textContent = `${result.make} ${result.model} · ${result.score}/100`;
      badge.style.display = 'inline-flex';
      badge.style.background = vs.bg;
      badge.style.borderColor = vs.border;
      badge.style.color = vs.border;
      badge.textContent = vs.label;

      // Flag chips in bar
      const sorted = [...result.flags].sort((a, b) => {
        const ord: Record<string, number> = { critical: 0, warning: 1, info: 2 };
        return ord[a.severity] - ord[b.severity];
      });
      sorted.slice(0, 3).forEach(f => {
        const chip = document.createElement('span');
        chip.className = `cc-flag cc-flag--${f.severity}`;
        chip.innerHTML = `${f.label}<span class="cc-flag-detail">${f.detail}</span>`;
        chip.addEventListener('click', () => chip.classList.toggle('open'));
        flags.appendChild(chip);
      });
      if (sorted.length > 0) flags.style.display = 'flex';

      // Open result panel
      showResultPanel(result);

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

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.altKey && (e.key === 'c' || e.key === 'C' || e.code === 'KeyC')) {
      e.preventDefault();
      triggerOCR();
    }
  }, true);

  function triggerOCR(): void {
    setOcrActive(true);
    showOCROverlay(
      (vrm) => { setOcrActive(false); input.value = vrm; submit(); },
      ()    => setOcrActive(false)
    );
  }

  checkAndShowOnboarding();
}

// ─── Chrome command listener ──────────────────────────────────────────────────

function launchOCR(): void {
  const currentSource = detectSource();
  if (currentSource && !document.getElementById('carcheck-host')) inject(currentSource);
  const host = document.getElementById('carcheck-host');
  if (!host) return;
  const ocrBtn = host.shadowRoot!.getElementById('cc-ocr-btn') as HTMLButtonElement | null;
  ocrBtn?.click();
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'LAUNCH_OCR') launchOCR();
});

// ─── entry point ──────────────────────────────────────────────────────────────

const source = detectSource();
if (source) inject(source);
