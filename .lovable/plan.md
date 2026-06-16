
# Neumorphic Redesign — Full App

Apply a luxurious soft-UI (neumorphism) skin across every screen, inspired by the reference: warm off-white base, pillowed white cards with paired light/shadow, generous padding, rounded geometry, restrained pastel accents. The warm-black sidebar stays as a deliberate contrast element.

## 1. Design tokens (`src/styles.css`)

New foundation — driven by tokens so every existing component inherits:

- **Surface**: keep `--background #faf8f5`. Add `--surface-raised #ffffff`, `--surface-sunken #f3ede4`, `--surface-tint #ece5d8` (for inset highlights).
- **Neumorphic shadow pairs** (the core of the look):
  - `--shadow-soft`: `8px 8px 20px rgba(184,168,148,0.35), -8px -8px 20px rgba(255,255,255,0.9)` — default raised card.
  - `--shadow-soft-sm`: tighter version for buttons/chips.
  - `--shadow-soft-lg`: deeper version for hero panels/modals.
  - `--shadow-inset`: `inset 4px 4px 8px rgba(184,168,148,0.30), inset -4px -4px 8px rgba(255,255,255,0.85)` — for inputs, search bars, sunken wells.
  - `--shadow-pressed`: subtler inset for active/pressed buttons.
- **Radii bumped up**: `--radius-md 14px`, `--radius-lg 22px`, `--radius-xl 28px`, `--radius-pill 999px`. Reference uses very rounded corners.
- **Accents (hybrid as requested)**:
  - Primary stays terracotta `#c17f5a`.
  - Status pastel palette (chips, dots, category tags only): sage `#a8c4a2`, blush `#f0c4c4`, peach `#f4c89a`, cream `#f0e6cd`, soft-orange `#e8a87c`, mist-blue `#bcd0d8`.
  - Expose as `--chip-sage`, `--chip-blush`, `--chip-peach`, `--chip-cream`, `--chip-orange`, `--chip-mist`.
- **Typography**: keep Cormorant Garamond display + DM Sans body (already on-brand). Slightly lighter weights to match the airy reference.

## 2. Reusable neumorphic primitives

Three small utility classes in `styles.css` so every component can opt in without rewriting markup:

- `.neu-card` — white surface, `--radius-xl`, `--shadow-soft`, generous internal padding default.
- `.neu-inset` — sunken well for inputs, search bars, progress tracks, KPI value containers.
- `.neu-pill` — pill button/chip with soft shadow that flips to `--shadow-pressed` on `:active`.

Add a `@utility` for `neu-hover` that lifts the shadow slightly on hover (no translate — neumorphism reads better with shadow change than motion).

## 3. shadcn component overrides (`src/components/ui/*`)

Edit in place, keep APIs identical:

- **button.tsx** — `default` variant: pill, `--shadow-soft-sm`, terracotta gradient text on white for secondary; `primary` keeps terracotta fill but with the soft shadow pair. `ghost` becomes a flat pill. Add `pressed` active state via `--shadow-pressed`.
- **card.tsx** — apply `.neu-card`, remove hard border, increase default padding (`p-8`).
- **input.tsx / textarea.tsx / select.tsx** — apply `.neu-inset`, taller (`h-12`), remove visible border, focus ring becomes terracotta glow instead of outline.
- **badge.tsx** — soft pastel backgrounds keyed off variant, no border, slight inner highlight.
- **tabs.tsx** — tab list becomes a sunken `.neu-inset` pill rail; active tab is a raised white pill with `--shadow-soft-sm`.
- **dialog.tsx / sheet.tsx** — `--radius-xl`, `--shadow-soft-lg`, no border, off-white backdrop with light blur.
- **progress.tsx** — track uses `.neu-inset`, fill is terracotta with subtle highlight.
- **switch.tsx, checkbox.tsx** — soft pillowed thumb/box with inset track.
- **table.tsx** — remove row borders, rely on whitespace; header row gets a sunken band; row hover is a soft cream wash.
- **dropdown-menu.tsx / popover.tsx / tooltip.tsx** — white surface, `--shadow-soft-lg`, larger radius.
- **alert.tsx, toast/sonner** — soft pastel surfaces by severity using the new chip palette.
- **separator.tsx** — replace hairlines with a thin embossed line (1px highlight + 1px shadow).

## 4. App shell (`AppShell.tsx`)

- Sidebar stays warm-black `#1a1612` (per your choice). Nav items get a soft inset highlight on active state (subtle inner shadow + terracotta left accent dot) instead of a filled pill.
- Top bar: white, no border, with `--shadow-soft-sm` and a sunken search field.
- Main content area: increase outer padding (`px-10 py-8` desktop), max-width breathing room.

## 5. Page-by-page application

All pages inherit automatically via tokens/primitives. Specific tweaks:

- **Dashboard** — KPI tiles become big neumorphic cards in a looser grid; "Studio Intelligence" insights as soft pastel-bordered cards (sage/blush/peach by severity); phase timeline gets pillowed milestone discs with inset connector track.
- **Projects list** — project cards become tall pillowed cards with generous padding; status as pastel chip.
- **Project detail** — tab rail becomes neumorphic pill bar; phase timeline (Concept→Handover) gets raised circular milestone markers with inset track between them.
- **Tasks** — table loses borders; selection checkboxes become neumorphic; floating bulk-action bar already exists — restyle as a single raised pill at the bottom with `--shadow-soft-lg`.
- **Vendors** — vendor cards pillowed, document chips pastel-tinted by category (BOQ/Quotation/PO/PI/Invoice/Challan each gets one of the pastel chip colors).
- **Settings, Auth, Wizards** — inherit card/input/button changes; bump padding.

## 6. Spacing pass (per "embrace it")

- Global container padding `px-10 py-10` desktop, `px-6 py-8` mobile.
- Card internal padding default `p-8` (was ~p-4/p-6).
- Form field vertical rhythm `space-y-6`.
- Section gaps `gap-8` minimum.

## 7. Out of scope

- No backend, RLS, schema, or data-layer changes.
- No new features — purely visual.
- No changes to PDF/print views, Gantt theme (already custom), or AI prompts.
- Charts (Recharts) get a recolor pass only — same components.

## Technical notes

- All changes are CSS tokens + `src/components/ui/*` variants + `AppShell.tsx`. Page files are touched only where they hard-code shadows/borders that fight the new look (rare — most use the design system).
- Neumorphism contrast is delicate; foreground text stays `#3d3530` to keep WCAG AA on the warm off-white.
- Reduced-motion users: shadow transitions only, no translate, already respected.
- Risk: very busy data tables can look mushy in pure neumorphism — mitigated by keeping table header as a sunken band and rows on flat white inside the card (not each row pillowed).

After implementation, I'll spot-check dashboard, a project detail page, tasks, and vendors visually before handing back.
