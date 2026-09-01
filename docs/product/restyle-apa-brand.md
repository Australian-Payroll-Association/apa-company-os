# Restyle proposal: putting the APA brand on the Company OS

**Status:** approved and implemented, 1 September 2026. Everything below is live; this document is kept as the record of what changed and why.

**Date:** 1 September 2026

## The problem

The Company OS still wears the visual identity of the Edge8 scaffold it was built from. On the live app today:

- The sign-in card and browser tab both say "8 Edges".
- The admin sidebar header says "8 Edges" (`components/AdminSidebar.tsx`), and the page title template is "%s · 8 Edges" (`app/admin/(dashboard)/layout.tsx`).
- `public/logo.png` and `public/logo-white.png` are the Edge8 wordmark. The ROI PDF generator and the marketing nav and footer all pull from these.
- The palette is Edge8's: bright blue `#287BE8`, mint `#6FF2C1`, near-black `#101014`.
- The typeface is Manrope, chosen for Edge8.

Meanwhile the public APA site at austpayroll.com.au has a settled, recognisable identity. This proposal maps that identity onto the OS.

## What the live site actually uses

Sampled from austpayroll.com.au and the APA emblem file on 1 September 2026:

| Element | Value | Where it appears |
|---|---|---|
| Brand navy | `#465778` (bands), `#496089` (emblem) | Section bands, headings, the dark arm of the emblem |
| Steel blue | `#A0AEC2` | The light arm of the emblem |
| Gold | `#E6B73D` (buttons), `#EDBC3D` (emblem) | Every call-to-action button, the highlighted word in the hero |
| Body ink | `#333333` | All running text |
| Light canvas | `#F5F6F9` | Alternating section backgrounds |
| Heading face | Montserrat, 600/700 | All headings |
| Body face | Source Sans Pro | All running text |
| Button shape | Pill, gold fill, dark text, chevron | Site-wide |

## Proposed restyles

The OS was built well for this: nearly everything reads from canonical tokens in `app/globals.css`, and the admin re-roots onto those in `app/admin/admin.css`. Most of this proposal is a token swap in two files, not a redesign. Layout, spacing, the dense 13px data layer, radii and elevation rules all stay exactly as they are.

### 1. Colour tokens (globals.css)

| Token | Now (Edge8) | Proposed (APA) |
|---|---|---|
| `--color-primary-blue` | `#287BE8` | `#465778` brand navy |
| `--color-primary-blue-hover` | `#1D6AD4` | `#394A66` darkened navy |
| `--color-accent-mint` | `#6FF2C1` | `#E6B73D` gold |
| `--color-primary-dark` | `#101014` | `#2A3550` navy ink |
| `--color-text-body` | `#797c82` | `#4A5160` cool grey, warmer than the site's flat `#333` but consistent with the data layer |
| `--tint-deep` | `#D4DAE4` | `#C9D2E0` steel-tinted |

The blue-glow, focus-ring and info-status derivatives follow automatically or get re-derived from navy.

### 2. Typography

Replace Manrope with Montserrat for display and Source Sans Pro for body, self-hosted woff2 exactly as Manrope is today. Both families ship Vietnamese subsets on Google Fonts, which the OS requires for people and client names. Note Source Sans Pro is distributed as "Source Sans 3" now; it is the same design. Montserrat runs wider than Manrope, so expect minor reflow in the admin sidebar and table headers; the 13px data scale absorbs this.

A cheaper alternative if reflow is a concern: keep Manrope for the dense admin data layer and use Montserrat only for `--font-display`. The public site pages then read as APA while tables stay metric-identical.

### 3. Admin chrome

- Sidebar background from near-black to deep navy `#2A3550`, matching how the live site uses navy for its dark bands. Section headers stay white, muted text shifts to steel `#A0AEC2`.
- Active nav item and per-section accents get gold `#E6B73D` treatment where mint is used today.
- `--admin-accent-soft` from `#eaf2ff` to a navy tint `#EDF0F5`.
- Chart ramp becomes navy `#465778`, gold `#E6B73D`, steel `#A0AEC2`, navy ink `#2A3550`, grey. Same five-step structure as today.
- One conflict to resolve: the current warning status pair is gold-toned (`#fbf0cf` / `#8a6a0f`). With gold promoted to the accent, warnings should shift to a clearly amber-orange pair so a warning badge never reads as a highlight.

### 4. Naming and marks

- "8 Edges" becomes "APA Company OS" in the sidebar header, the sign-in card, and the title template. The metadata in `app/layout.tsx` already says Australian Payroll Association, so only the admin strings are stale.
- `public/logo.png` and `public/logo-white.png` replaced with the APA lockup from the live site. Consumers to re-check after the swap: marketing nav, footer, and the ROI PDF route (`app/api/roi/pdf/route.ts`).

### 5. Buttons

The pill radius already in the OS (`--radius-btn: 40px`) happens to match the live site's pill buttons, so shape stays. Fill changes: gold with navy-ink text for primary calls-to-action on public-facing pages (ROI embed, surveys, plans), navy for primary actions inside the admin where gold would shout on every table row.

## What was already done

The favicon set now uses the APA emblem: `app/icon.png`, `app/apple-icon.png` (white background for iOS), and `public/favicon.png`. Uncommitted, sitting in the working tree.

## Rollout if approved

1. Token swap in `app/globals.css` and the accent block of `app/admin/admin.css`.
2. Font files added to `public/fonts`, `@font-face` blocks swapped.
3. String renames and logo asset swap.
4. Visual pass over /admin, the sign-in page, and the beryl-roi embed, since that one is styled inline and embedded on external pages.

Roughly a day of work, one PR, no schema or behaviour changes.
