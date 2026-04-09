// Popup — shortlist of recent checks, read from chrome.storage.local cache

import type { ScanResult, MotTest } from '../types/mot';

// ─── types ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  result: ScanResult;
  expiresAt: number;
}

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

function formatMileage(v: number, u: string): string {
  return `${v.toLocaleString()} ${u === 'KM' ? 'km' : 'mi'}`;
}

function formatVRM(vrm: string): string {
  if (/^[A-Z]{2}\d{2}[A-Z]{3}$/.test(vrm)) return `${vrm.slice(0, 4)} ${vrm.slice(4)}`;
  return vrm;
}

// ─── verdict styles ───────────────────────────────────────────────────────────

const VERDICT: Record<string, { label: string; bg: string; border: string; color: string }> = {
  great:   { label: 'Great',   bg: '#f0fdf4', border: '#16a34a', color: '#16a34a' },
  ok:      { label: 'OK',      bg: '#fffcf0', border: '#d4a017', color: '#d4a017' },
  caution: { label: 'Caution', bg: '#fff7ed', border: '#ea580c', color: '#ea580c' },
  avoid:   { label: 'Avoid',   bg: '#ffdad6', border: '#ba1a1a', color: '#ba1a1a' },
};

const SOURCE_LABEL: Record<string, string> = {
  autotrader: 'AutoTrader',
  ebay:       'eBay',
  gumtree:    'Gumtree',
  facebook:   'Facebook',
};

// ─── render ───────────────────────────────────────────────────────────────────

function renderEmpty(container: HTMLElement): void {
  container.innerHTML = `
    <div class="empty">
      <div class="empty-title">No checks yet</div>
      <div class="empty-sub">Visit AutoTrader, eBay, Gumtree, or Facebook Marketplace and check a plate to get started.</div>
    </div>`;
}

function renderCard(r: ScanResult): HTMLElement {
  const v = VERDICT[r.verdict] ?? VERDICT.caution;
  const latest: MotTest | undefined = r.motHistory.motTests[0];
  const mileage = latest ? formatMileage(latest.odometerValue, latest.odometerUnit) : '—';

  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div class="card-top">
      <span class="vrm-plate">${formatVRM(r.vrm)}</span>
      <span class="verdict-badge"
        style="background:${v.bg};border-color:${v.border};color:${v.color}"
      >${v.label}</span>
    </div>
    <div class="card-vehicle">${r.make} ${r.model}</div>
    <div class="card-meta">
      <span>${mileage}</span>
      <span class="dot">·</span>
      <span>${SOURCE_LABEL[r.source] ?? r.source}</span>
      <span class="spacer"></span>
      <span class="time">${timeAgo(r.scannedAt)}</span>
    </div>`;
  return card;
}

// ─── data loading ─────────────────────────────────────────────────────────────

async function loadResults(): Promise<ScanResult[]> {
  const all = await chrome.storage.local.get(null) as Record<string, unknown>;
  const now = Date.now();
  return Object.entries(all)
    .filter(([k]) => k.startsWith('vrm_'))
    .map(([, v]) => v as CacheEntry)
    .filter(e => e?.result && e.expiresAt > now)
    .map(e => e.result)
    .sort((a, b) => b.scannedAt - a.scannedAt);
}

async function loadUsage(): Promise<number> {
  const now = new Date();
  const key = `usage_${now.getFullYear()}_${now.getMonth() + 1}`;
  const data = await chrome.storage.local.get(key);
  return (data[key] as number | undefined) ?? 0;
}

// ─── init ─────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  const list    = document.getElementById('cc-list')!;
  const usageEl = document.getElementById('cc-usage');

  const [results, used] = await Promise.all([loadResults(), loadUsage()]);

  if (usageEl) usageEl.textContent = `${used} / 3 free`;

  if (results.length === 0) {
    renderEmpty(list);
    return;
  }

  const frag = document.createDocumentFragment();
  results.forEach(r => frag.appendChild(renderCard(r)));
  list.appendChild(frag);
}

init();
