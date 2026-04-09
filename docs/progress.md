# CarCheck — Implementation Progress

**Last updated:** 2026-04-09 · Phase 3 implemented

> This file is the canonical implementation tracker. Update it with every commit. Agents should read this before scanning code — it describes what exists, what's wired, and what isn't.

---

## Phase status

| Phase | Name | Status |
|---|---|---|
| 0 | Walking Skeleton | ✅ Complete |
| 1 | Real DVSA Data | ✅ Complete |
| 2 | OCR Overlay | ✅ Complete |
| 3 | Full UI | ✅ Complete |
| 4 | Free Tier Enforcement + Backend Scaffold | ❌ Not started |
| 5 | Paid Tier | ❌ Not started |

---

## What is built

### Phase 0 — Walking Skeleton

| File | Status | Notes |
|---|---|---|
| `src/utils/vrm.ts` | ✅ | UK VRM regex (current, prefix, suffix formats). `isValidVRM()` + `normalise()`. |
| `src/utils/cache.ts` | ✅ | `chrome.storage.local` wrapper. 24hr TTL. Free tier metering: `isWithinFreeLimit()` / `incrementUsage()` (limit: 3/month). |
| `src/scoring/engine.ts` | ✅ | 5 deterministic rules. Score 0–100. Verdict: great/ok/caution/avoid. See spec.md for rule weights. |
| `src/scoring/dictionary.ts` | ✅ | 29 advisory phrases across 8 categories with severity 1–10. |
| `src/types/mot.ts` | ✅ | Shared types: `MotHistory`, `MotTest`, `Flag`, `ScoringResult`, `ScanResult`. |
| `src/background/background.ts` | ✅ | Service worker. Handles `CHECK_VRM` + `CAPTURE_TAB` messages. Calls DVSA proxy. |
| `src/content/content.ts` | ✅ | Floating bar (Shadow DOM). After check: flag chips + result panel opens. Onboarding modal on first visit. |
| `src/styles/tokens.css` | ✅ | CSS custom properties reference file (Velocity Kinetic design tokens). Not imported — values hardcoded in style strings. |
| `src/manifest.json` | ✅ | MV3. `host_permissions`: `<all_urls>`, DVSA, Azure AD, Vercel, localhost:3000. |
| `build.js` | ✅ | esbuild config. Reads `.env`, injects defines. Copies Tesseract WASM variants. |

### Phase 1 — Real DVSA Data

| File | Status | Notes |
|---|---|---|
| `scripts/proxy.mjs` | ✅ | Local Node.js HTTP proxy on port 3000. OAuth2 client credentials server-side. `npm run proxy` to start. |
| `api/mot.ts` | ✅ | Vercel Edge Function. Same proxy logic. For production deployment. |
| `.env` | ✅ (local only) | Contains `PROXY_BASE_URL`, `DVSA_CLIENT_ID/SECRET/TOKEN_URL/SCOPE_URL/API_KEY`. Not committed. |

**Critical:** The proxy must be running locally (`npm run proxy`) for the extension to work. Azure AD blocks OAuth2 token fetch from `chrome-extension://` origin (AADSTS9002326).

### Phase 2 — OCR Overlay

| File | Status | Notes |
|---|---|---|
| `src/ocr/capture.ts` | ✅ | Full-page drag-select overlay. Tesseract.js lazy-loaded. Shows VRM confirm input if OCR result needs editing. |
| `src/content/content.ts` | ✅ | "Scan plate" button (yellow when active). Alt+C keyboard shortcut. |
| `src/manifest.json` | ✅ | `commands.activate-ocr` registered. `web_accessible_resources` includes all 3 Tesseract WASM variants. |

---

## What is NOT built

### Phase 3 — Full UI ✅

| File | Status | Notes |
| --- | --- | --- |
| Result panel | ✅ | 360px right-side Shadow DOM drawer. Opens after every check. Header: VRM plate chip, PASS/FAIL, make/model, score, verdict. MOT timeline (dots), system alerts, score breakdown bento grid, footer CTAs. |
| Popup | ✅ | `src/popup/` fully rewritten. 360×500px. Scrollable shortlist cards (VRM, verdict badge, vehicle name, mileage, source, time ago). Usage counter in header. Empty state. Bottom accent bar. |
| Onboarding | ✅ | 3-step modal with blurred backdrop, progress pips, Skip/Next. Shows once on first listing page visit. Stored in `chrome.storage.local.onboardingComplete`. |
| `src/styles/tokens.css` | ✅ | Design token reference file (not imported — inline in style strings). |

**Not built (deferred):** Inline verdict badge injected next to listing title requires per-site CSS selectors that break with site updates. Deferred indefinitely — result panel serves this purpose.

### Phase 4 — Free Tier Enforcement + Backend Scaffold

Usage metering exists in `cache.ts` but is not yet enforced in the UI (no upgrade prompt).

| To build | Notes |
|---|---|
| Upgrade prompt in content.ts | Show when `isWithinFreeLimit()` returns false. |
| `backend/api/check-vrm.ts` | Vercel function — authenticated DVSA proxy. |
| `backend/api/create-checkout.ts` | Stripe checkout session. |
| `backend/api/webhook.ts` | Stripe webhook handler. |
| `backend/lib/supabase.ts` | Supabase client. |
| `backend/lib/stripe.ts` | Stripe client. |

### Phase 5 — Paid Tier

Nothing built.

| To build | Notes |
|---|---|
| Auth flow | Supabase magic link via popup. JWT in `chrome.storage.local`. |
| Paid OCR route | Send image to backend → Google Cloud Vision → VRM. Fallback to Tesseract. |
| `backend/api/narrative.ts` | Claude Haiku call. 2–3 sentence plain-English verdict. Paid users only. |
| Paid result panel | Shows AI narrative above score breakdown. |

---

## Known issues / open items

| Issue | Severity | Notes |
|---|---|---|
| Score thresholds miscalibrated | Medium | Max achievable score is 75 (60 pass + 15 streak). "Great" threshold (≥85) is unreachable. Most cars with any advisories land in Caution. Thresholds need recalibration before Phase 3 UI ships. |
| Free tier limit not enforced in UI | Low | `isWithinFreeLimit()` is wired in background.ts but content.ts has no upgrade prompt yet. Planned for Phase 4. |
| No result detail shown | Low | Bar shows `MAKE MODEL · score/100` + verdict pill only. Full result panel is Phase 3. |

---

## Local dev setup

```bash
npm install
npm run proxy     # terminal 1 — DVSA OAuth2 proxy on localhost:3000
npm run build     # terminal 2 — or: npm run watch
# Load dist/ as unpacked extension in Chrome
```

`.env` required (not committed) — see [implementation-plan.md](implementation-plan.md) Phase 1 for required vars.
