# CarCheck — Product Specification

## Problem

UK car buyers browsing listings on AutoTrader, eBay, Gumtree, and Facebook Marketplace have no quick way to assess vehicle health. The "10-tab problem" — multiple listings open, each requiring a manual MOT history lookup — wastes time and leads to poor decisions.

## Solution

A Chrome extension that detects listing pages, lets users select a registration plate via OCR (drag-to-select), fetches MOT history from the DVSA API, and delivers a traffic-light verdict inline on the page.

---

## Screens (from Stitch designs)

Five designed screens define the full UX surface:

| Screen | File | Purpose |
|---|---|---|
| Extension Popup | `extension_popup_velocity` | 360×500px shortlist + scan history |
| OCR Overlay | `in_page_ocr_overlay_velocity` | Full-page drag-to-select plate capture |
| Full Result Panel | `full_result_panel_velocity` | 360px right-side drawer with MOT detail |
| Verdict Badge States | `verdict_badge_states_velocity` | Inline badge injected on listing page |
| Onboarding Sequence | `onboarding_sequence_velocity` | 3-step first-run flow |

---

## Scoring engine (deterministic)

Five core rules applied in order:

1. **Latest test result** — pass adds base score, fail removes heavily
2. **Advisory count** — age-weighted thresholds (more advisories on newer car = worse)
3. **Mileage anomaly** — rollback detection via year-on-year delta
4. **MOT frequency gaps** — missed annual tests = risk signal
5. **Clean history bonus** — consecutive pass streak adds reliability bonus

Score bands:

| Score | Verdict | Badge colour |
|---|---|---|
| 85–100 | Great | Green |
| 65–84 | OK | Amber |
| 40–64 | Caution | Orange |
| 0–39 | Avoid | Red |

Flags surface as verdict badges (pill, 3px left border) with Material Symbol icons.

---

## Tiers

### Free
- 3 checks/month
- Deterministic verdict + top 3 flags
- Client-side OCR (Tesseract.js, lazy-loaded)
- Verdict badge + limited result panel

### Paid
- Unlimited checks
- AI narrative report (Claude Haiku)
- Server-side OCR (Google Cloud Vision — higher accuracy)
- Shortlist comparison (up to 10 vehicles)
- Full result panel with all MOT history detail

---

## Supported listing sites

- AutoTrader (`autotrader.co.uk/car-details/*`)
- eBay Motors (`ebay.co.uk/itm/*` — cars category)
- Gumtree (`gumtree.com/cars/*`)
- Facebook Marketplace (`facebook.com/marketplace/*` — vehicles)

---

## Pricing (TBC)

- Per-check: £0.99
- Weekly pass: £4.99
- Monthly: £9.99

---

## Data model

### Scan result (stored in chrome.storage.local)
```
{
  vrm: string,           // "LD19KXA"
  make: string,          // "Porsche"
  model: string,         // "911 Carrera S"
  scannedAt: timestamp,
  source: string,        // "autotrader" | "ebay" | "gumtree" | "facebook"
  score: number,         // 0-100
  verdict: string,       // "great" | "ok" | "caution" | "avoid"
  flags: Flag[],         // top flags from scoring
  motHistory: MotTest[], // raw DVSA response
  cached: boolean
}
```

### Flag
```
{
  type: string,          // "mileage_anomaly" | "advisory" | "test_gap" | ...
  severity: "info" | "warning" | "critical",
  label: string,         // display text
  detail: string         // expanded explanation
}
```

---

## Out of scope for MVP

- Web dashboard
- PDF exports
- Firefox extension
- Admin interface for MOT dictionary (JSON file, AI proposes edits)
- AI narrative (Phase 4 — template verdicts sufficient initially)
