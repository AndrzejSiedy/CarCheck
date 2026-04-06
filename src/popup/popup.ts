// Popup logic — Phase 0: show monthly free-tier usage count

async function getMonthlyUsage(): Promise<number> {
  const now = new Date();
  const key = `usage_${now.getFullYear()}_${now.getMonth() + 1}`;
  const data = await chrome.storage.local.get(key);
  return (data[key] as number | undefined) ?? 0;
}

const el = document.getElementById('usage');
if (el) {
  getMonthlyUsage().then(n => { el.textContent = String(n); });
}
