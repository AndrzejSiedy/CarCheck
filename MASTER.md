---
# ============================================================
# MACHINE-READABLE METADATA (keep this block parseable)
# ============================================================
project_name:        "CarCheck"
project_slug:        "carcheck"
tier:                "1"
stage:               "building"
health:              "yellow"
owner:               "Andrzej"
created:             2026-04-13
last_updated:        2026-04-13
last_session:        2026-04-09
repo_url:            ""
local_path:          "D:/Projects/Claude/CarCheck"
live_url:            ""
depends_on:          []
blocks:              []
tags:                [chrome-extension, saas, uk, automotive, ocr, ai-agent]
# ============================================================
---

# CarCheck

## 1. Thesis (one sentence)

A Chrome extension for UK car buyers that reads registration plates via OCR, fetches DVSA MOT history, and delivers a traffic-light verdict inline on listing pages — saving buyers from switching tabs or reading raw data.

## 2. Current State

**Stage:** building
**Health:** yellow
**One-line status:** Phases 0–3 complete (walking skeleton through full UI); free tier enforcement and paid tier not yet started; score thresholds need recalibration before shipping.

## 3. Business Case

| Field | Value |
|---|---|
| Target MRR | £ TBD |
| Current MRR | £ 0 |
| Setup cost (spent) | £ 0 (API keys only) |
| Monthly running cost | £ ~0 (Vercel free tier, local proxy for now) |
| Expected payback period | TBD |
| Key assumption | UK car buyers will pay for instant MOT verdicts that save research time |
| Kill criteria | No paying users within 3 months of free-tier launch, or DVSA API access revoked |

## 4. Current Focus

- [x] Phase 3 Full UI — complete as of 2026-04-09
- [ ] Phase 4: Free Tier Enforcement — upgrade prompt, usage metering wired to UI
- [ ] Recalibrate score thresholds (max achievable is 75; "Great" threshold of ≥85 is unreachable)

## 5. Next Actions (queued)

1. Recalibrate scoring thresholds in `src/scoring/engine.ts`
2. Wire upgrade prompt in `content.ts` when `isWithinFreeLimit()` returns false
3. Build backend scaffold: `backend/api/check-vrm.ts` (Vercel function), Supabase client, Stripe checkout

## 6. Blocked / Waiting On

- Stripe and Supabase accounts needed for Phase 4/5 backend
- DVSA proxy must run locally — Azure AD blocks OAuth from `chrome-extension://` origin (production fix needed)

## 7. Decisions Log

- **2026-04-09** — Phase 3 (Full UI) marked complete — deferred inline verdict badge per-site CSS selectors indefinitely; result panel serves same purpose — alternative: per-site DOM injection (rejected: too brittle)
- **design** — Extension-first architecture; no dashboard-first — rationale: validate chrome extension value before building a separate web product
- **design** — Deterministic scoring engine for free tier; AI narrative only for paid tier — rationale: keeps free tier fast and cost-free; AI reserved for paid value-add

## 8. Risks & Open Questions

- Score thresholds miscalibrated: most cars with any advisories land in Caution; "Great" is unreachable
- Free tier limit in `cache.ts` not yet enforced in UI
- DVSA OAuth2 requires server-side proxy — browser extension can't fetch tokens directly from Azure AD
- Open question: what is the right free tier limit? Currently 3 checks/month

## 9. Handoffs to Specialised Tools

| Date | Tool | Purpose | Result summary |
|---|---|---|---|
|  |  |  |  |

## 10. Session Log

- **2026-04-09** — Phase 3 (Full UI) completed: result panel (360px Shadow DOM drawer), popup rewritten (shortlist cards, usage counter), onboarding modal (3-step with progress pips). Known issue: score thresholds need recalibration. Phase 4 next.
