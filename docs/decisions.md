# Design Decisions Log

Format: date | decision | rationale

---

## 2026-04-06

**TypeScript + esbuild from Phase 0.**
All source files are `.ts`. esbuild compiles to `dist/` — manifest points at compiled output. esbuild handles TS natively with no `tsconfig` required for basic use. Replaces the original "plain ES modules, no build tool" approach. Decision: TS type safety from the start outweighs the minimal setup cost of adding esbuild early.

**Shadow DOM for all injected UI.**
Prevents host page CSS leaking into CarCheck components and vice versa. Required on Facebook Marketplace and eBay which have aggressive global styles.

**DVSA proxy moved from Phase 4 to Phase 1.**
Azure AD's token endpoint returns `AADSTS9002326` for any request with `Origin: chrome-extension://` — cross-origin token redemption is only permitted for SPA-type app registrations, and client credentials flow doesn't support SPA type. The extension cannot fetch OAuth2 tokens directly. A server-side proxy (`scripts/proxy.mjs` for dev, `api/mot.ts` for Vercel) is required from day one. Credentials are never bundled into the extension.

**`chrome.storage.local` over `chrome.storage.sync` for all data.**
`sync` is limited to 100KB total and 8KB per item — insufficient for scan history. `local` limit is 10MB. Shortlist, cache, settings, and usage counter all use `local`.

**Tailwind via CDN in Stitch design files only.**
CDN is unusable inside Chrome extensions (CSP blocks external scripts). In production: extract only used CSS classes from design files into a static `src/styles/tokens.css` stylesheet.
