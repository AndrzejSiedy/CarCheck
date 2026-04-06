# Design System Documentation: Automotive Precision

## 1. Overview & Creative North Star

### The Creative North Star: "The Digital Caliper"
This design system is built on the philosophy of **The Digital Caliper**: an instrument of extreme accuracy, high-tensile strength, and professional authority. We are moving away from the "generic SaaS" look to create an environment that feels like a high-end vehicle configurator or a professional aerospace diagnostic suite.

The system breaks the "template" aesthetic by favoring **intentional asymmetry** and **tonal depth**. Instead of centering everything, we use heavy left-aligned typography and wide-measure data displays. We replace traditional decorative elements with functional precision—every line, gap, and color shift must serve a diagnostic purpose. The goal is a UI that feels "machined" rather than "drawn."

---

## 2. Colors & Surface Architecture

The palette is anchored by **Deep Performance Blue** (`primary`), supported by a sophisticated range of **Slate Greys** and **Clinical Whites**. 

### The "No-Line" Rule
To achieve a premium, integrated feel, **1px solid borders are prohibited for sectioning.** Traditional boxes make a tool feel "boxed in." Instead, define boundaries through:
*   **Background Shifts:** Transition from `surface` to `surface-container-low` to define a sidebar.
*   **Tonal Transitions:** Use `surface-container-high` for interactive zones against a `surface` backdrop.

### Surface Hierarchy & Nesting
Treat the UI as a series of machined layers. Depth is achieved by "stacking" container tiers:
*   **Base Layer:** `surface` (#f7f9fb)
*   **Structural Sections:** `surface-container-low` (#f2f4f6)
*   **Active Workspaces:** `surface-container-highest` (#e0e3e5)
*   **High-Precision Insets:** `surface-container-lowest` (#ffffff) for data entry points to provide maximum contrast.

### The "Diagnostic" Traffic Light
While the primary UI is monochromatic blue and slate, we utilize a strict functional system for verdicts:
*   **Pass:** `on_secondary_container` (for subtle success) or custom Green.
*   **Warning:** `tertiary` (#651f00) / `tertiary_fixed` (#ffdbcf).
*   **Critical:** `error` (#ba1a1a).

---

## 3. Typography

The typography uses **Inter** with a "Sharp & Technical" execution. We lean heavily on tracking (letter-spacing) and weight to convey authority.

*   **Display (Large Scale):** Use `display-lg` for hero metrics or vehicle titles. These should be set with tight tracking (-0.02em) to feel like stamped metal.
*   **Headlines & Titles:** Use `headline-sm` and `title-lg` for section headers. Always pair these with generous top-padding to create "editorial" breathing room.
*   **Labels:** `label-md` and `label-sm` are the workhorses of this system. They should often be uppercase with +0.05em tracking when used as metadata headers to mimic industrial labeling.
*   **Body:** `body-md` provides the clinical legibility required for long-form diagnostic reports.

---

## 4. Elevation & Depth

In a "flat design" high-precision system, traditional drop shadows are too "soft." We use **Tonal Layering** and **Ambient Occlusion.**

### The Layering Principle
Depth is achieved by stacking. A `surface-container-lowest` card placed on a `surface-container-low` background creates a "natural lift" that feels physically present without needing a shadow.

### Ambient Shadows
If a floating element (like a context menu) is required, use an **Extra-Diffused Shadow**:
*   **Blur:** 24px - 40px
*   **Opacity:** 4% - 6%
*   **Color:** Use a tinted version of `on-surface` (#191c1e) to ensure the shadow feels like a natural lighting byproduct of the environment.

### The "Ghost Border" Fallback
If a visual separator is required for accessibility (e.g., in high-density data grids), use the `outline_variant` (#c3c6d5) at **15% opacity**. This creates a "hairline" suggestion of a border without breaking the flat, machined aesthetic.

---

## 5. Components

### Buttons (High-Performance Actuators)
*   **Primary:** Background: `primary` (#00327d), Text: `on_primary`. Shape: `md` (0.375rem). No gradients.
*   **Secondary:** Background: `secondary_container`, Text: `on_secondary_container`.
*   **State Change:** On hover, do not use a shadow. Instead, shift the background color to `primary_container` (#0047ab) to simulate a mechanical "light-up" effect.

### Input Fields (Diagnostic Insets)
*   **Style:** No 4-sided borders. Use a `surface-container-highest` background with a 2px `primary` bottom-bar only when focused.
*   **Typography:** All input text uses `body-md` for maximum legibility.

### Cards & Lists (Data Clusters)
*   **The No-Divider Rule:** Explicitly forbid 1px divider lines between list items. Use **vertical white space** (16px or 24px from the spacing scale) or a subtle hover-state background shift to distinguish items.
*   **Layout:** Use "High-Precision Grids." Align data points to a strict column structure. For example, in a diagnostic list, the "Label," "Value," and "Status" should occupy fixed-width columns across the entire application.

### Precision Gauges (Custom Component)
*   For diagnostic tools, use "Linear Progress Bars" rather than circular ones. Circular elements feel too consumer-focused; linear bars feel like professional instrumentation. Use `primary` for the fill and `surface-variant` for the track.

---

## 6. Do’s and Don’ts

### Do
*   **DO** use whitespace as a structural element. Space is what makes a tool feel "expensive."
*   **DO** use `label-sm` in all-caps for technical metadata.
*   **DO** align all elements to a strict 8px grid to maintain "machined" precision.
*   **DO** use the `primary` blue for interactive elements ONLY (links, buttons, toggles).

### Don’t
*   **DON'T** use 100% opaque borders to separate sections.
*   **DON'T** use rounded corners larger than `xl` (0.75rem). The system should feel "sharp," not "bubbly."
*   **DON'T** use gradients or "pill" shaped buttons. Stay true to the flat, authoritative diagnostic aesthetic.
*   **DON'T** use center-alignment for data. Professionals read from left to right; keep the "Digital Caliper" aligned to the left margin.