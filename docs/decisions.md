# Design Decisions Log

Format: date | decision | rationale

---

## 2026-04-06

**TypeScript + esbuild from Phase 0.**
All source files are `.ts`. esbuild compiles to `dist/` — manifest points at compiled output. esbuild handles TS natively with no `tsconfig` required for basic use. Replaces the original "plain ES modules, no build tool" approach. Decision: TS type safety from the start outweighs the minimal setup cost of adding esbuild early.

**Shadow DOM for all injected UI.**
Prevents host page CSS leaking into CarCheck components and vice versa. Required on Facebook Marketplace and eBay which have aggressive global styles.

**DVSA API key in `chrome.storage.local` for Phase 0–3.**
Developer-only convenience. Moves to a Vercel backend proxy in Phase 4 before any public release. API key must never ship to end users inside the extension bundle.

**`chrome.storage.local` over `chrome.storage.sync` for all data.**
`sync` is limited to 100KB total and 8KB per item — insufficient for scan history. `local` limit is 10MB. Shortlist, cache, settings, and usage counter all use `local`.

**Tailwind via CDN in Stitch design files only.**
CDN is unusable inside Chrome extensions (CSP blocks external scripts). In production: extract only used CSS classes from design files into a static `src/styles/tokens.css` stylesheet.
