# Open Questions

Unresolved design items flagged during build. Review in Claude.ai sessions.

---

- [ ] Final scoring weights — need real MOT data to calibrate
- [ ] OCR accuracy threshold — what confidence level before falling back to manual entry?
- [ ] Facebook Marketplace — content script injection may be blocked by CSP, needs testing
- [ ] DVSA API OAuth2 flow — need to apply for API key and test token refresh
- [ ] Shortlist data — chrome.storage.sync (limited to 100KB) or chrome.storage.local?
