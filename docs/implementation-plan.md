# CarCheck — Implementation Plan

Build order follows the **Walking Skeleton** principle: get one end-to-end slice working first, then layer on features. No phase is a dead end — each produces a loadable, testable extension.

---

## Phase 0 — Walking Skeleton

**Goal:** Load extension in Chrome, visit an AutoTrader listing, type a VRM, see a verdict badge injected on the page. No OCR, no real API, no backend.

### What to build

**`src/manifest.json`** — already scaffolded, no changes needed.

**`src/scoring/engine.ts`** — implement the five scoring rules against mock data:

```ts
// Input: MotHistory object (mock)
// Output: { score: number, verdict: string, flags: Flag[] }
function score(motHistory: MotHistory): ScoringResult { ... }
```

Five rules in order:
1. Latest test result (pass/fail) — base score
2. Advisory count (age-weighted)
3. Mileage delta year-on-year — detect rollback
4. Gap between test dates — flag > 13 months
5. Clean streak bonus — consecutive passes

**`src/scoring/dictionary.ts`** — seed with ~20 real advisory phrases from DVSA data, each with category + severity 1–10. Used by engine to weight advisory scores.

**`src/utils/vrm.ts`** — UK VRM regex validator:

```ts
// Validates: AB12 CDE (current), A123 BCD (prefix), ABC 123D (suffix)
function isValidVRM(str: string): boolean { ... }
function normalise(str: string): string { ... } // strips spaces, uppercase
```

**`src/types/mot.ts`** — shared type definitions:

```ts
interface MotHistory { ... }
interface ScoringResult { score: number; verdict: string; flags: Flag[] }
interface Flag { label: string; severity: number; category: string }
```

**`src/content/content.ts`** — inject a floating input bar on supported listing pages:
- Small "Check MOT" bar injected at top of page (Shadow DOM)
- Text input + submit button
- On submit: validate VRM → send message to background → receive verdict → inject badge next to listing title

**`src/background/background.ts`** — message handler:
- Listen for `CHECK_VRM` message from content script
- For now: return mock DVSA data → run scoring engine → return result
- (Real DVSA call added in Phase 1)

**`src/utils/cache.ts`** — `chrome.storage.local` wrapper:

```ts
async function getCached(vrm: string): Promise<ScanResult | null> { ... }
async function setCache(vrm: string, result: ScanResult): Promise<void> { ... }
```

**Test:** Load unpacked extension → open any AutoTrader listing → type `LD19KXA` → see green/amber/red badge appear.

---

## Phase 1 — Real DVSA Data ✅

**Goal:** Replace mock data with live DVSA MOT History API calls.

### What was built

**`scripts/proxy.mjs`** — local Node.js proxy (run with `npm run proxy`):

- Handles OAuth2 client credentials flow server-side (Azure AD token endpoint rejects `chrome-extension://` origin — see decisions.md)
- Fetches DVSA MOT data and returns it to the extension
- Token is cached in-memory for 1 hour

**`api/mot.ts`** — Vercel Edge Function (future deployment):

- Same logic as proxy.mjs, packaged for Vercel production deployment
- Credentials stored in Vercel environment variables (not in extension bundle)

**`src/background/background.ts`** — calls proxy instead of DVSA directly:

```ts
GET http://localhost:3000/api/mot?vrm={vrm}   // dev
GET https://carcheck-api.vercel.app/api/mot?vrm={vrm}  // prod
```

**`src/manifest.json`** — `host_permissions` includes `<all_urls>` (required for `captureVisibleTab`) plus proxy URLs.

### Local dev requirement

**The proxy must be running whenever you test the extension locally:**

```bash
npm run proxy   # starts http://localhost:3000
```

The extension reads `PROXY_BASE_URL` from `.env` at build time (injected by esbuild). Default is `http://localhost:3000` for dev. Change to your Vercel URL before building for production.

### Deployment (when ready)

1. `npx vercel deploy --prod` from repo root
2. Add all `DVSA_*` vars in Vercel dashboard → Settings → Environment Variables
3. Update `.env` → `PROXY_BASE_URL=https://your-project.vercel.app`
4. `npm run build` → reload extension

**Test:** `npm run proxy` → reload extension → type real VRM → live DVSA score. Compare against check.mot.gov.uk.

---

## Phase 2 — OCR Overlay

**Goal:** Replace manual VRM text input with drag-to-select plate capture (free tier: Tesseract.js).

### What to build

**`src/ocr/capture.ts`** — OCR overlay, matching `in_page_ocr_overlay_velocity` design:

- Inject full-page overlay on user action (keyboard shortcut or toolbar button click)
- Overlay: `rgba(0,0,0,0.4)` + `cursor: crosshair`
- Mousedown → drag → mouseup: draw selection rectangle with corner handles + scan line animation
- On release: `canvas.drawImage` crop of selection → pass to Tesseract
- Tesseract.js: lazy-loaded (`import()`) — not bundled upfront
- Extract text → run VRM regex → if valid, auto-submit; if not, show editable text input pre-filled with OCR result

**`src/content/content.ts`** — add keyboard shortcut listener (`Alt+C`) to trigger OCR overlay.

**`src/manifest.json`** — add `commands` for keyboard shortcut.

**Tesseract loading strategy:**

```js
// Only load when user activates OCR — not on page load
async function loadTesseract() {
  const { createWorker } = await import(chrome.runtime.getURL('lib/tesseract.min.js'));
  return createWorker('eng');
}
```

**Test:** Open listing with visible plate image → Alt+C → drag over plate → VRM auto-populated → verdict appears.

---

## Phase 3 — Full UI

**Goal:** Replace the temporary injected input bar with the designed UI: result panel, extension popup, onboarding.

### What to build

**`src/content/content.ts`** — replace floating bar with verdict badge (inline on listing title) that expands to full result panel on click.

**Result panel** (`full_result_panel_velocity` design):
- 360px fixed right-side drawer, Shadow DOM
- VRM yellow plate chip, PASS/FAIL chip, make/model
- MOT Timeline: horizontal dots (P/F) with year labels
- System Alerts: top flags from scoring
- Score Breakdown: 2-col bento grid (date, advisories, mileage, frequency, history bonus)
- Footer: Save to Shortlist + Get Full Report (locked for free tier)

**Verdict badge** (`verdict_badge_states_velocity` design):
- 28px pill, 3px left border, 15% tint background
- Green (pass) / Amber (advisory) / Red (critical)

**`src/popup/popup.html` + `popup.ts`** (`extension_popup_velocity` design):
- 360×500px fixed
- Scrollable shortlist cards (make/model, source, timestamp, verdict chip, mileage)
- Footer: Compare + Full HPI Check buttons
- Reads from `chrome.storage.local`

**Onboarding** (`onboarding_sequence_velocity` design):
- 3-step flow, shown once on first install
- Triggered from `chrome.runtime.onInstalled`
- Stored flag in `chrome.storage.local`: `{ onboardingComplete: true }`

**Design tokens** — extract shared Tailwind config from Stitch designs into a single `src/styles/tokens.css` (CSS custom properties) for reuse across Shadow DOM injections.

**Test:** Install extension → onboarding shows → open listing → badge appears next to title → click opens result panel → open popup → saved vehicle shows.

---

## Phase 4 — Free Tier Enforcement + Backend Scaffold

**Goal:** Enforce 3 checks/month limit. Lay groundwork for paid tier.

### What to build

**`src/utils/cache.ts`** — add usage metering:

```ts
async function getMonthlyUsage(): Promise<number> { ... }
async function incrementUsage(): Promise<void> { ... }
async function isWithinFreeLimit(): Promise<boolean> { ... } // limit: 3/month
```

**`src/content/content.ts`** — before calling background:
- Check `isWithinFreeLimit()`
- If over limit: show upgrade prompt instead of scanning

**Upgrade prompt** — reuses result panel slot; shows locked state with pricing (£0.99 / £4.99 / £9.99).

**`backend/api/`** — Vercel serverless functions (scaffolded, not yet wired):
- `check-vrm.ts` — authenticated DVSA proxy (moves API key off client)
- `create-checkout.ts` — Stripe checkout session
- `webhook.ts` — Stripe webhook handler

**`backend/lib/`** — shared utilities:
- `supabase.ts` — Supabase client
- `stripe.ts` — Stripe client

**Test:** Run 3 scans → 4th scan shows upgrade prompt. Stripe checkout opens (test mode).

---

## Phase 5 — Paid Tier

**Goal:** Unlock unlimited scans, Google Cloud Vision OCR, and Claude Haiku narrative reports for paying users.

### What to build

**Auth flow** — Supabase magic link via popup; store JWT in `chrome.storage.local`.

**`src/background/background.ts`** — for authenticated users:
- Route DVSA calls through backend proxy (instead of direct API call)
- Include auth token in request headers

**`src/ocr/capture.ts`** — paid tier: send cropped image to backend → Google Cloud Vision → return VRM. Fallback to Tesseract.js if backend unavailable.

**`backend/api/narrative.ts`** — Claude Haiku call:

```ts
// Input: scored MotHistory
// Output: 2-3 sentence plain-English verdict
// Model: claude-haiku-4-5-20251001
// Only called for paid users
```

**Full result panel** — paid version shows AI narrative above score breakdown.

**Test:** Purchase test subscription (Stripe test mode) → unlimited scans → paid OCR → narrative appears in result panel.

---

## File map by phase

| File | Phase |
|---|---|
| `src/utils/vrm.ts` | 0 |
| `src/utils/cache.ts` | 0, 4 |
| `src/scoring/engine.ts` | 0 |
| `src/scoring/dictionary.ts` | 0 |
| `src/content/content.ts` | 0, 2, 3 |
| `src/background/background.ts` | 0, 1, 5 |
| `src/ocr/capture.ts` | 2, 5 |
| `src/popup/popup.html` + `popup.ts/css` | 3 |
| `src/styles/tokens.css` | 3 |
| `src/types/mot.ts` | 0 |
| `build.js` (esbuild config) | 0 |
| `backend/api/check-vrm.ts` | 4 |
| `backend/api/create-checkout.ts` | 4 |
| `backend/api/webhook.ts` | 4 |
| `backend/api/narrative.ts` | 5 |
| `backend/lib/supabase.ts` | 4 |
| `backend/lib/stripe.ts` | 4 |

---

## Key decisions pre-coded

- **TypeScript + esbuild from Phase 0.** All source files are `.ts`. esbuild compiles to `dist/` — manifest points at `dist/` output. No `tsconfig` required for basic esbuild TS support; add one when strict type checking is needed.
- **Shadow DOM for all injected UI.** Prevents host page CSS leaking into CarCheck UI and vice versa.
- **Tailwind via CDN for design files.** For production extension: extract only used CSS classes into a static stylesheet — CDN is not usable in extensions.
- **DVSA API key in Phase 0–1:** stored in `chrome.storage.local` (developer-only). Moves to backend proxy in Phase 4 before any public release.
