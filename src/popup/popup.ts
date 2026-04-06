// Popup logic — Phase 0: show monthly free-tier usage count + site status

const SUPPORTED = ['autotrader.co.uk', 'ebay.co.uk', 'gumtree.com', 'facebook.com/marketplace'];

async function getMonthlyUsage(): Promise<number> {
  const now = new Date();
  const key = `usage_${now.getFullYear()}_${now.getMonth() + 1}`;
  const data = await chrome.storage.local.get(key);
  return (data[key] as number | undefined) ?? 0;
}

async function setStatusMessage(): Promise<void> {
  const msg = document.getElementById('cc-msg');
  if (!msg) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ?? '';
    const onSite = SUPPORTED.some(s => url.includes(s));
    msg.textContent = onSite
      ? 'Active on this page — type a plate or press Alt+C to scan.'
      : 'Visit AutoTrader, eBay, Gumtree, or Facebook Marketplace to check a plate.';
  } catch {
    msg.textContent = 'Open a listing page to check a plate.';
  }
}

const usageEl = document.getElementById('usage');
if (usageEl) {
  getMonthlyUsage().then(n => { usageEl.textContent = String(n); });
}
setStatusMessage();
