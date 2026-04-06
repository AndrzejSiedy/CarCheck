# CarCheck — Technical Architecture

Build follows the **Walking Skeleton** principle. See `/docs/implementation-plan.md` for the phase-by-phase build order.

---

## Layers

### Client (Chrome Extension — Manifest V3)

- **Content scripts** — detect listing pages, inject OCR overlay and verdict display via Shadow DOM
- **Popup** — 360×500px shortlist + scan history (`extension_popup_velocity` design)
- **Service worker** — message routing, DVSA API calls, caching, auth token management
- **Shadow DOM** — all injected UI isolated from host page styles

### Backend (Vercel + Supabase — Phase 4+)

- API gateway: rate limiting, auth, request routing
- DVSA API proxy: moves API key off client, adds caching
- Payment service: Stripe webhooks, entitlement checking
- Usage metering: free tier enforcement

### Data

- **Local**: `chrome.storage.local` — scan cache (24hr TTL), shortlist, settings, usage counter
- **Remote** (Phase 4+): Supabase PostgreSQL — user accounts, scan history, usage tracking
- Key prefix convention: `vrm_{NORMALISED_VRM}` for cache, `settings_*` for config

### External services

| Service | Tier | Purpose |
| --- | --- | --- |
| DVSA MOT History API | Free + Paid | MOT data source |
| Tesseract.js | Free | Client-side OCR (lazy-loaded) |
| Google Cloud Vision | Paid | Server-side OCR (higher accuracy) |
| Claude Haiku | Paid | Narrative report generation |
| Stripe | Paid | Payments |
| Supabase | Paid | Auth + user state |

---

## File structure

```text
src/
  manifest.json
  background/
    background.js        — service worker
  content/
    content.js           — listing detection, overlay injection, verdict display
    content.css          — Shadow DOM base styles
  ocr/
    capture.js           — drag-to-select overlay + Tesseract.js integration
  scoring/
    engine.js            — deterministic scoring (five rules)
    dictionary.js        — advisory phrase → severity map
  popup/
    popup.html/js/css    — 360×500px extension popup
  utils/
    vrm.js               — UK VRM validation + normalisation
    cache.js             — chrome.storage.local wrapper (cache + usage metering)
  styles/
    tokens.css           — design tokens as CSS custom properties (Phase 3)
  lib/
    tesseract.min.js     — bundled Tesseract, loaded lazily (Phase 2)
backend/
  api/
    check-vrm.js         — authenticated DVSA proxy (Phase 4)
    create-checkout.js   — Stripe checkout session (Phase 4)
    webhook.js           — Stripe webhook handler (Phase 4)
    narrative.js         — Claude Haiku narrative generation (Phase 5)
  lib/
    supabase.js          — Supabase client (Phase 4)
    stripe.js            — Stripe client (Phase 4)
```

---

## Design system

**Velocity Kinetic** ("The Digital Caliper"). Source files in `design/stitch_carcheck/`.

- Font: Inter (all weights). Icons: Material Symbols Outlined.
- CSS: Tailwind with custom token config. In extension: extract to static `src/styles/tokens.css` — CDN unusable in extensions.
- Shadow DOM used for all injected UI to prevent host page style bleed.

See `/docs/ui-design-brief.md` for full token spec, component rules, and screen specifications.

---

## Scan pipeline (data flow)

1. User triggers OCR overlay (Phase 0: manual input bar; Phase 2+: `Alt+C` keyboard shortcut)
2. VRM captured → regex validates UK format → normalised (uppercase, no spaces)
3. Check `chrome.storage.local` cache — return cached result if < 24hr old
4. Check free tier usage — if over limit, show upgrade prompt
5. Fetch DVSA MOT data (Phase 0: mock; Phase 1–3: direct API; Phase 4+: backend proxy)
6. Parse response → match advisories against MOT dictionary → severity scores
7. Run deterministic scoring engine → `{ score, verdict, flags }`
8. Inject verdict badge inline on listing page (Shadow DOM)
9. On click: expand full result panel (360px right drawer)
10. Store result in cache + increment usage counter

---

## Phase-by-phase API key strategy

| Phase | DVSA key location | Notes |
| --- | --- | --- |
| 0 | Mock data only | No key needed |
| 1–3 | `chrome.storage.local` | Dev only — never ship to users |
| 4+ | Vercel backend proxy | Key never leaves server |
