# Design System Specification: The Technical Editor

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"Precision Logic."** 

This system is designed to bridge the gap between a high-end developer IDE and a luxury architectural journal. It moves away from the "template" aesthetic of standard SaaS platforms by embracing high-contrast technical typography and a "No-Line" philosophy. Instead of using borders to define space, we use intentional tonal shifts and rigorous typographic alignment to create structure. The result is an interface that feels like a precision instrument—sharp, decisive, and sophisticated.

The design breaks the traditional grid through **intentional asymmetry**. Primary content is often anchored by large, brutalist headlines in Space Grotesk, while secondary metadata is tucked into "nested" tonal containers using Inter, creating a rhythmic hierarchy that guides the eye through complex data.

---

## 2. Colors & Atmospheric Depth
This system utilizes a high-contrast light palette that prioritizes "optical breathability."

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning or containment. Boundaries must be defined solely through background color shifts.
*   **Base Layer:** `surface` (#f8f9fa) is the canvas.
*   **Structural Division:** Use `surface_container_low` (#f3f4f5) to carve out large functional areas.
*   **Active Focus:** Use `surface_container_highest` (#e1e3e4) to indicate the most prominent interactive zone.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. To create depth, "nest" containers:
1.  **Level 0 (Background):** `surface` (#f8f9fa)
2.  **Level 1 (Section):** `surface_container_low` (#f3f4f5)
3.  **Level 2 (In-Page Component):** `surface_container_lowest` (#ffffff)
This stacking creates a natural, soft "lift" that feels more premium than a flat gray layout.

### The "Glass & Gradient" Rule
To elevate the "developer tool" aesthetic into something signature:
*   **Glassmorphism:** For floating menus or command palettes, use `surface_container_low` at 80% opacity with a `24px backdrop-blur`. This allows the underlying technical data to bleed through, softening the interface.
*   **Signature Textures:** For primary CTAs, do not use flat hex codes. Apply a subtle linear gradient from `primary` (#3525cd) to `primary_container` (#4f46e5) at a 135-degree angle. This provides a tactile "soul" to the primary action.

---

## 3. Typography
The system employs a dual-font strategy to balance technical utility with editorial character.

*   **The Structural Voice (Space Grotesk):** Used for all `display` and `headline` tokens. Its geometric, slightly quirky terminals provide the "developer" personality.
    *   *Usage:* Large headers that define the page architecture. Always set with tight letter spacing (-0.02em).
*   **The Functional Voice (Inter):** Used for `title`, `body`, and `label` tokens. Inter is the workhorse of the system, chosen for its exceptional legibility in dense data environments.
    *   *Usage:* Code snippets, property panels, and long-form documentation.

**Editorial Tip:** Use `display-lg` (3.5rem) in close proximity to `label-sm` (0.6875rem) in all caps. This extreme contrast in scale is a hallmark of high-end editorial design.

---

## 4. Elevation & Depth
In this system, elevation is conveyed through **Tonal Layering** rather than traditional structural shadows.

*   **The Layering Principle:** Place a `surface_container_lowest` (#ffffff) card on top of a `surface_container` (#edeeef) section. The delta in luminance creates the "pop" without the clutter of a shadow.
*   **Ambient Shadows:** When a true "floating" state is required (e.g., a context menu), use a "Ghost Shadow":
    *   `Box-shadow: 0px 12px 32px rgba(25, 28, 29, 0.06);`
    *   The shadow color is a 6% opacity version of `on_surface`, creating a natural ambient occlusion rather than a "drop shadow."
*   **The "Ghost Border" Fallback:** If a border is required for extreme accessibility needs, use `outline_variant` (#c7c4d8) at **20% opacity**. It should be felt, not seen.

---

## 5. Components

### Buttons
*   **Primary:** Gradient from `primary` to `primary_container`. White text (`on_primary`). Border-radius: `sm` (0.125rem) for a sharp, technical look.
*   **Secondary:** `surface_container_high` background with `on_surface` text.
*   **Tertiary:** No background. `primary` text. Use for low-emphasis actions like "Cancel" or "Reset."

### Input Fields
*   **Base:** `surface_container_lowest` background. 
*   **Indicator:** A 2px bottom-accent of `primary` on focus. Do not wrap the entire input in a high-contrast border.
*   **Typography:** Use `body-md` (Inter) for input text and `label-sm` for the floating label.

### Cards & Data Lists
*   **Rule:** Forbid the use of divider lines between list items. 
*   **Alternative:** Use 12px of vertical white space and a 2% shift in background color on hover (`surface_container_high`). 
*   **Technical Detail:** Use `surface_container_low` for the card body and `surface_container_lowest` for the card header to create an "inverted" depth feel.

### The "Inspector" Panel (Custom Component)
A side-aligned panel using `surface_dim` (#d9dadb) as its background. This creates a clear "utility zone" distinct from the white workspace. Use `label-md` in all caps for headers within this panel to maintain the technical editor vibe.

---

## 6. Do's and Don'ts

### Do:
*   **Do** use white space as a structural element. If an element feels "lost," increase its surrounding padding rather than adding a border.
*   **Do** use `primary` (#3525cd) sparingly. It is a high-energy accent; overusing it will break the "clean" aesthetic.
*   **Do** align text-heavy components to a strict baseline grid to maintain the "Technical" feel.

### Don't:
*   **Don't** use pure black (#000000) for text. Always use `on_surface` (#191c1d) to maintain tonal harmony with the light grays.
*   **Don't** use standard `lg` or `xl` roundedness for primary functional elements. Stick to `sm` (0.125rem) or `md` (0.375rem) to keep the aesthetic "sharp."
*   **Don't** use "centered" layouts for technical dashboards. Prefer left-aligned, asymmetrical compositions that feel "constructed."