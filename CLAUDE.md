# CarCheck — Instant MOT Insights

Chrome extension for UK car buyers. Reads plates via OCR, fetches DVSA MOT history, delivers traffic-light verdicts inline on listing pages.

## Project context

- Implement Walking Skeleton development process
- Extension-first architecture (not dashboard-first)
- Deterministic scoring engine — AI is only used for paid-tier narrative polish
- Supported sites: AutoTrader, eBay Motors, Gumtree, Facebook Marketplace
- Free tier: deterministic verdicts, client-side OCR (Tesseract.js)
- Paid tier: AI narrative reports (Claude Haiku), server-side OCR (Google Cloud Vision)
- Stack: Chrome Manifest V3, Vercel + Supabase (backend, later), Stripe (payments, later)

## Working rules

- Always git pull before starting work
- Read /docs before writing any code
- When you discover a design gap or make an implementation decision that changes the design, update the relevant file in /docs and commit it with a clear message before continuing
- Never modify /docs/spec.md without logging the reason in /docs/decisions.md
- /src is for code. /docs is for specs and decisions. Keep them separate.

## Key files

- /docs/spec.md — master product specification
- /docs/architecture.md — technical architecture and data flows
- /docs/decisions.md — log of design changes discovered during coding
- /docs/open-questions.md — unresolved items flagged during build
- /docs/mot-dictionary.md — MOT phrase → risk signal mapping (the product moat)
- /docs/ui-design-brief.md — UI/UX design brief for designer handoff
