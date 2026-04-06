# CarCheck — Technical Architecture

## Layers

### Client (Chrome Extension — Manifest V3)
- Content scripts: detect listing pages, inject OCR overlay and verdict display
- Popup: scan history, shortlist, settings, upgrade prompt
- Service worker: message routing, API calls, caching, auth token management
- Shadow DOM for all injected UI (isolation from host page styles)

### Backend (Vercel + Supabase — added later, not in initial scaffold)
- API gateway: rate limiting, auth, request routing
- DVSA API client: OAuth2 token management, response caching
- Payment service: Stripe webhooks, entitlement checking
- Usage metering: free tier enforcement

### Data
- Local: chrome.storage for scan history, shortlist, settings
- Remote (later): Supabase PostgreSQL for user accounts, scan history, usage tracking
- Cache: scanned VRMs cached 24hr to avoid duplicate API calls

### External services
- DVSA MOT API (free, government)
- Tesseract.js (client-side OCR, free tier)
- Google Cloud Vision (server-side OCR, paid tier)
- Claude Haiku API (narrative reports, paid tier)
- Stripe (payments)

## Data flow: scan pipeline
1. User activates OCR overlay on listing page
2. User drags box over registration plate
3. Client-side OCR extracts text → regex validates UK VRM format
4. Check local cache (same VRM in last 24hr?)
5. Check entitlement (free tier: 3/month remaining?)
6. Call DVSA MOT API → parse response
7. Match advisories against MOT dictionary → severity scores
8. Run deterministic scoring algorithm
9. Generate verdict from template
10. Display badge + expandable panel on listing page
11. Cache result locally
