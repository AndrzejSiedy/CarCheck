# Open Questions

Unresolved design items flagged during build. Review in Claude.ai sessions.

---

## Open

- [ ] Final scoring weights — calibrate against real MOT data once DVSA API access is confirmed
- [ ] OCR accuracy threshold — what confidence level triggers fallback to manual VRM entry?
- [ ] Facebook Marketplace — content script injection may be blocked by site CSP; needs live testing before committing Phase 0 to that match pattern

## Resolved

- [x] **DVSA API auth method** — confirmed `x-api-key` header (not OAuth2). See `dvsa-researcher` agent for full schema.
- [x] **Shortlist storage** — `chrome.storage.local` chosen over `sync`. Reason: `sync` cap (100KB total / 8KB per item) is too small for scan history. See `decisions.md`.
