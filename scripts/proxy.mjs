// Local DVSA proxy — run with: node scripts/proxy.mjs
// Handles OAuth2 token fetch server-side (avoids Chrome extension cross-origin block).
// Listens on http://localhost:3000

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
try {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) env[m[1]] = m[2].trim();
  }
} catch { /* no .env */ }

const { DVSA_CLIENT_ID, DVSA_CLIENT_SECRET, DVSA_TOKEN_URL, DVSA_SCOPE_URL, DVSA_API_KEY } = env;
const DVSA_BASE = 'https://history.mot.api.gov.uk/v1/trade/vehicles/registration';

let tokenCache = null;

async function getToken() {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) return tokenCache.token;

  const res = await fetch(DVSA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: DVSA_CLIENT_ID,
      client_secret: DVSA_CLIENT_SECRET,
      scope: DVSA_SCOPE_URL,
    }).toString(),
  });
  if (!res.ok) throw new Error(`Token error: ${res.status} ${await res.text()}`);
  const { access_token, expires_in } = await res.json();
  tokenCache = { token: access_token, expiresAt: now + expires_in * 1000 };
  console.log('[proxy] Token refreshed, valid for', expires_in, 's');
  return tokenCache.token;
}

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, 'http://localhost:3000');
  if (url.pathname !== '/api/mot') {
    res.writeHead(404); res.end('Not found'); return;
  }

  const vrm = url.searchParams.get('vrm')?.toUpperCase().replace(/\s+/g, '');
  if (!vrm || !/^[A-Z0-9]{2,7}$/.test(vrm)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid VRM' })); return;
  }

  try {
    const token = await getToken();
    const dvsaRes = await fetch(`${DVSA_BASE}/${encodeURIComponent(vrm)}`, {
      headers: { Authorization: `Bearer ${token}`, 'x-api-key': DVSA_API_KEY },
    });
    const data = await dvsaRes.json();
    console.log(`[proxy] ${vrm} → ${dvsaRes.status}`);
    res.writeHead(dvsaRes.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  } catch (err) {
    console.error('[proxy] Error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(3000, () => console.log('[proxy] Running on http://localhost:3000'));
