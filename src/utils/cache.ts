// chrome.storage.local wrapper — scan cache (24hr TTL) + free tier usage metering

import type { ScanResult } from '../types/mot';

const TTL_MS = 24 * 60 * 60 * 1000;       // 24 hours
const FREE_MONTHLY_LIMIT = 3;

function cacheKey(vrm: string): string {
  return `vrm_${vrm}`;
}

function usageKey(): string {
  const now = new Date();
  return `usage_${now.getFullYear()}_${now.getMonth() + 1}`;
}

// ─── scan cache ───────────────────────────────────────────────────────────────

export async function getCached(vrm: string): Promise<ScanResult | null> {
  const key = cacheKey(vrm);
  const data = await chrome.storage.local.get(key);
  const entry = data[key] as { result: ScanResult; expiresAt: number } | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    await chrome.storage.local.remove(key);
    return null;
  }
  return entry.result;
}

export async function setCache(vrm: string, result: ScanResult): Promise<void> {
  const key = cacheKey(vrm);
  await chrome.storage.local.set({
    [key]: { result, expiresAt: Date.now() + TTL_MS },
  });
}

// ─── usage metering ───────────────────────────────────────────────────────────

export async function getMonthlyUsage(): Promise<number> {
  const key = usageKey();
  const data = await chrome.storage.local.get(key);
  return (data[key] as number | undefined) ?? 0;
}

export async function incrementUsage(): Promise<void> {
  const key = usageKey();
  const current = await getMonthlyUsage();
  await chrome.storage.local.set({ [key]: current + 1 });
}

export async function isWithinFreeLimit(): Promise<boolean> {
  return (await getMonthlyUsage()) < FREE_MONTHLY_LIMIT;
}
