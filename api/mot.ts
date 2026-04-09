// Vercel Edge Function — DVSA MOT History proxy
// Keeps OAuth2 credentials server-side (no cross-origin token issue from extension).
// GET /api/mot?vrm=LW64ETE

export const config = { runtime: 'edge' };

const CLIENT_ID     = process.env.DVSA_CLIENT_ID!;
const CLIENT_SECRET = process.env.DVSA_CLIENT_SECRET!;
const TOKEN_URL     = process.env.DVSA_TOKEN_URL!;
const SCOPE         = process.env.DVSA_SCOPE_URL!;
const API_KEY       = process.env.DVSA_API_KEY!;
const DVSA_BASE     = 'https://history.mot.api.gov.uk/v1/trade/vehicles/registration';

const VRM_RE = /^[A-Z0-9]{2,7}$/;

async function getToken(): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, scope: SCOPE }).toString(),
  });
  if (!res.ok) throw new Error(`Token error: ${res.status}`);
  const { access_token } = await res.json() as { access_token: string };
  return access_token;
}

export default async function handler(req: Request): Promise<Response> {
  const cors = {
    'Access-Control-Allow-Origin': 'chrome-extension://aldblomfnecklgjagnddnjkgnfaooahj',
    'Access-Control-Allow-Methods': 'GET',
  };

  const vrm = new URL(req.url).searchParams.get('vrm')?.toUpperCase().replace(/\s+/g, '');
  if (!vrm || !VRM_RE.test(vrm)) {
    return Response.json({ error: 'Invalid VRM' }, { status: 400, headers: cors });
  }

  try {
    const token = await getToken();
    const res = await fetch(`${DVSA_BASE}/${encodeURIComponent(vrm)}`, {
      headers: { Authorization: `Bearer ${token}`, 'x-api-key': API_KEY },
    });
    const data = await res.json();
    if (!res.ok) return Response.json({ error: data }, { status: res.status, headers: cors });
    return Response.json(data, { headers: cors });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500, headers: cors });
  }
}
