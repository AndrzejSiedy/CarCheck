# Open Questions

Unresolved design items flagged during build. Review in Claude.ai sessions.

---

## Open

- [ ] Final scoring weights — calibrate against real MOT data once DVSA API access is confirmed
- [ ] OCR accuracy threshold — what confidence level triggers fallback to manual VRM entry?
- [ ] Facebook Marketplace — content script injection may be blocked by site CSP; needs live testing before committing Phase 0 to that match pattern

- [x] **Taxi / ex-taxi detection** — 6-monthly MOT pattern. UK taxis require MOT every 6 months by law. If ≥50% of consecutive test gaps are 5–7 months (and ≥4 tests exist), flag as probable taxi history. Penalty −15, severity `warning`. Implemented in `engine.ts` as `ruleTaxiPattern`. See decisions.md.

## Resolved

- [x] **DVSA API auth method** — confirmed `x-api-key` header (not OAuth2). See `dvsa-researcher` agent for full schema.
- [x] **Shortlist storage** — `chrome.storage.local` chosen over `sync`. Reason: `sync` cap (100KB total / 8KB per item) is too small for scan history. See `decisions.md`.
