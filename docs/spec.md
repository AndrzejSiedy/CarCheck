# CarCheck — Product Specification

## Problem
UK car buyers browsing listings on AutoTrader, eBay, Gumtree, and Facebook Marketplace have no quick way to assess vehicle health. The "10-tab problem" — multiple listings open, each requiring a manual MOT history lookup — wastes time and leads to poor decisions.

## Solution
A Chrome extension that detects listing pages, lets users select a registration plate via OCR (drag-to-select), fetches MOT history from the DVSA API, and delivers a traffic-light verdict (green/amber/red) inline on the page.

## Scoring engine (deterministic)
Five core rules:
1. Latest test result status (pass/fail)
2. Advisory count thresholds (age-weighted)
3. Mileage anomaly and rollback detection
4. MOT frequency gaps
5. Clean history bonuses (consecutive pass streaks)

Score bands: 85-100 = 🟢 Great | 65-84 = 🟡 OK | 40-64 = 🟠 Caution | 0-39 = 🔴 Avoid

## Tiers
- Free: 3 checks/month, deterministic verdict + top 3 flags, client-side OCR (Tesseract.js)
- Paid: unlimited checks, AI narrative report (Claude Haiku), server-side OCR (Google Cloud Vision), shortlist comparison, PDF export

## Supported sites
- AutoTrader (autotrader.co.uk/car-details)
- eBay Motors (ebay.co.uk/itm, cars category)
- Gumtree (gumtree.com/cars)
- Facebook Marketplace (facebook.com/marketplace, vehicles)

## Pricing (TBC)
- Per-check: £0.99
- Weekly pass: £4.99
- Monthly: £9.99

## Out of scope for MVP
- Web dashboard
- PDF reports
- AI narrative layer (template verdicts are sufficient initially)
- Firefox extension
- Admin interface for dictionary (JSON file, AI proposes edits)
