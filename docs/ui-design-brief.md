# CarCheck — UI Design Brief

Design system: **Velocity Kinetic** ("The Digital Caliper")
Source files: `design/stitch_carcheck/stitch_carcheck/`
Font: Inter (all weights). Icons: Material Symbols Outlined.
CSS approach: Tailwind with custom token config (same config in all five screens).

---

## Design philosophy

"The Digital Caliper" — feels machined, not drawn. High-end vehicle configurator meets professional diagnostic suite. Intentional asymmetry, heavy left-aligned typography, tonal depth over decorative borders.

---

## Color tokens

All screens share the same Tailwind theme extension:

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#00327d` | Interactive elements only (buttons, links, active state) |
| `primary-container` | `#0047ab` | Hover state on primary buttons |
| `surface` | `#f7f9fb` | Page background |
| `surface-container-low` | `#f2f4f6` | Section backgrounds, sub-headers |
| `surface-container` | `#eceef0` | Card backgrounds |
| `surface-container-high` | `#e6e8ea` | Hover state on cards |
| `surface-container-highest` | `#e0e3e5` | Interactive zones, input backgrounds |
| `surface-container-lowest` | `#ffffff` | Data entry insets, top-layer cards |
| `on-surface` | `#191c1e` | Primary text |
| `on-surface-variant` | `#434653` | Secondary text |
| `secondary` | `#515f74` | Metadata, labels |
| `outline-variant` | `#c3c6d5` | Ghost borders (at 15–20% opacity only) |
| `error` | `#ba1a1a` | Critical / Avoid verdict |
| `error-container` | `#ffdad6` | Critical badge background |
| `tertiary` | `#651f00` | Warning / Caution verdict |
| `tertiary-fixed` | `#ffdbcf` | Warning badge background |
| Green (custom) | `#16a34a` (green-600) | Pass / Great verdict |
| Green bg (custom) | `#f0fdf4` (green-50) | Pass badge background |

---

## Border radius scale

| Token | Value | Use |
|---|---|---|
| DEFAULT | `0.125rem` | Tight elements |
| `lg` | `0.25rem` | Cards, panels |
| `xl` | `0.5rem` | Modals, overlays |
| `full` | `0.75rem` | Pills (verdict badges) |

Max radius is `xl` (0.75rem) — no "bubbly" shapes.

---

## The "No-Line" rule

**No 1px solid borders for sectioning.** Use tonal background shifts instead:
- Sidebar vs content: `surface-container-low` vs `surface`
- Active workspace: `surface-container-highest` on `surface` backdrop
- If a separator is truly needed for accessibility: `outline-variant` at 15% opacity ("ghost border")

---

## Typography

Inter, all weights. Three modes:

- **Display / hero metrics**: tight tracking (`-0.02em`), heavy weight — feels stamped
- **Section headers**: `font-bold uppercase tracking-widest text-[10px]` — industrial labeling
- **Body / data**: `body-md` for clinical legibility in reports

---

## Components

### Verdict badge (pill)
```
height: 28px
display: inline-flex, align-items: center
padding: 0 8px
font: Inter 500 / 12px
border-left: 3px solid [verdict colour]
border-radius: full (pill)
background: 15% tint of verdict colour
```

States:
- Pass/Great: `bg-green-50 text-green-800 border-green-600` + `check` icon
- Advisory/Caution: `bg-[#fffcf0] text-tertiary border-[#d4a017]` + `warning` icon
- Critical/Avoid: `bg-error-container text-error border-error` + `close` icon

### Buttons
- Primary: `bg-primary text-on-primary` — square corners (radius DEFAULT)
- Hover: shift to `bg-primary-container` — no shadow, mechanical "light-up"
- Secondary: `bg-surface-container-highest text-primary`
- Shape: no gradients, no pill buttons

### Input fields
- No 4-sided borders — `bg-surface-container-highest` with 2px `primary` bottom-bar on focus

### Cards / list items
- No divider lines — use vertical whitespace (16px or 24px)
- Hover state: `bg-surface-container-high` background shift
- Alignment: strict column structure for label / value / status

---

## Screen specifications

### Extension Popup (`extension_popup_velocity`)
- Fixed 360×500px container
- Top nav: CarCheck wordmark + history + settings icons + avatar
- Sub-header strip: `surface-container-low`, 10px uppercase label
- Scrollable card list: saved vehicles, each with make/model, source badge, timestamp, verdict chip, mileage
- Footer: Compare button + Full HPI Check CTA
- Bottom accent line: 4px `primary` stripe

### OCR Overlay (`in_page_ocr_overlay_velocity`)
- Full-page overlay: `bg-on-background/40` darkening + `cursor-crosshair`
- Drag selection box: dashed `border-primary`, corner square handles in `primary`
- Vignette: `ring-[4000px] ring-on-background/70` (CSS box-shadow trick to darken outside selection)
- Scan line animation: horizontal 2px line, `primary` colour, pulsing
- Tooltip above box: `bg-primary` pill with "Drag over the number plate" instruction
- Status indicator inside box: spinner + "Processing - Reading plate..."
- Technical metadata below box: coords + precision (decorative)
- Scanner control bar (lower left): engine version, scanner settings chips

### Full Result Panel (`full_result_panel_velocity`)
- 360px fixed right drawer, full height
- Header: VRM in yellow plate (`bg-[#FFD500] text-black`), PASS/FAIL chip, make/model
- MOT Timeline: horizontal dots (P=green, F=error) with year labels, connected by line
- System Alerts section: `surface-container-low` block, amber warning icon, bullet flags
- Score Breakdown: 2-column bento grid chips (latest test date, advisory count, mileage, frequency, history bonus)
- Footer CTA: Save to Shortlist (primary) + Get Full Report (outline)
- Bottom tab bar: Diagnostics / MOT History / Tax Status / Account

### Verdict Badge States (`verdict_badge_states_velocity`)
- Component showcase page (reference only — not a live screen)
- Shows all three badge states in context

### Onboarding (`onboarding_sequence_velocity`)
- Floating modal, max-width 340px, `surface-container-lowest` background
- 3 steps — progress bar: `h-1 w-8 bg-primary` (active) vs `bg-surface-variant` (inactive)
- Step 1: "CarCheck is ready" — synced confirmation
- Step 2/3: TBD (feature walkthroughs)
- Skip tour + Next buttons; diamond anchor pointer at bottom
- App shell blurred behind: `blur-[4px]`
- Nav shell suppressed during onboarding (linear/transactional state)
