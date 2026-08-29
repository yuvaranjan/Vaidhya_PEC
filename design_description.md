# Cure Cloud — Design Description

> A comprehensive design-only specification extracted from the Patient Dashboard reference project. This document describes the **visual language, color theme, typography, spacing, component styling, and layout patterns** needed to faithfully recreate this design. Functional/interactive elements are intentionally omitted.

---

## 1. Overall Aesthetic

| Attribute | Description |
|---|---|
| **Mood** | Clean, clinical-yet-warm. Feels trustworthy and modern — like a premium healthcare SaaS product. |
| **Style** | Minimal, card-based layout with generous whitespace. No heavy gradients or skeuomorphism. Flat with subtle depth via soft box-shadows. |
| **Personality** | Calm, professional, approachable. Uses teal/deep-navy as the emotional anchor rather than sterile whites. |
| **Density** | Medium density — content breathes but doesn't feel sparse. Compact on mobile, spacious on desktop. |

---

## 2. Color Palette

### Light Mode (Default)

| Token | Hex | Usage |
|---|---|---|
| `background` | `#FBFCFD` | Page background — very faint blue-grey, not pure white |
| `foreground` | `#173449` | Primary text — deep navy-charcoal |
| `card` | `#FFFFFF` | Card surfaces — pure white |
| `card-foreground` | `#173449` | Text on cards |
| `primary` | `#173F59` | Deep navy — primary buttons, brand elements, sidebar active text |
| `primary-foreground` | `#FFFFFF` | Text on primary-colored surfaces |
| `secondary` | `#EEF6F6` | Light teal-grey tint — secondary backgrounds, hover states, tags |
| `secondary-foreground` | `#173F59` | Text on secondary surfaces |
| `muted` | `#F4F7F8` | Very light grey — subtle background sections |
| `muted-foreground` | `#6D7F8C` | De-emphasized text — labels, timestamps, descriptions |
| `accent` | `#2B9C95` | **Teal** — the hero accent color. Used for active indicators, badges, toggle-on states, chart bars, icons, and interactive highlights |
| `accent-foreground` | `#FFFFFF` | Text on accent-colored surfaces |
| `destructive` | `#DC4D57` | Soft red — danger buttons, error states |
| `border` | `#DCE7EA` | Light grey-blue — card borders, dividers, input borders |
| `ring` | `#2B9C95` | Focus ring color (teal, matching accent) |
| `input-background` | `#F7FAFB` | Input field background — barely tinted |

#### Semantic accent colors used in records/badges:
| Purpose | Background | Text |
|---|---|---|
| Medical/Visit | `#E5F5F3` | `#14736A` (darker teal) |
| Lab results | `#EEF3FB` | `#315A94` (steel blue) |
| Care plan | `#F4F0FB` | `#7050A8` (muted purple) |

#### Chart colors (5-color palette):
`#2B9C95` → `#173F59` → `#77BEB6` → `#5F8FA7` → `#A9D3CE`

### Dark Mode

| Token | Hex | Usage |
|---|---|---|
| `background` | `#102533` | Deep ocean navy |
| `foreground` | `#EDF6F7` | Near-white with cool tint |
| `card` | `#17303F` | Slightly lifted dark card |
| `primary` | `#75CBC5` | Bright teal — inverted from light mode's deep navy |
| `secondary` | `#214251` | Muted dark teal |
| `muted` | `#1B3543` | Subtle dark layer |
| `muted-foreground` | `#A5BAC4` | Desaturated light blue-grey |
| `accent` | `#75CBC5` | Bright teal (same as primary in dark mode) |
| `border` | `#2B4B59` | Subtle dark dividers |
| `destructive` | `#E96C74` | Softer coral-red |

### Video Call Screen (special dark palette):
| Element | Hex |
|---|---|
| Full-screen background | `#112734` |
| Video placeholder | `#254251` |
| Self-view background | `#182F3D` |
| Button surfaces | `rgba(255,255,255, 0.1)` with `rgba(255,255,255, 0.2)` border |

---

## 3. Typography

| Property | Value |
|---|---|
| **Font family** | `"Inter"`, sans-serif (loaded from Google Fonts) |
| **Font weights** | `400` (normal body), `500` (medium — headings, labels, buttons), `600` (semibold — used inline), `700` (bold — names, key values) |
| **Base size** | `16px` (`--font-size: 16px`) |
| **h1** | `text-2xl` to `text-3xl` (responsive), `font-bold`, `tracking-[-0.025em]` (tight) |
| **h2** | `text-xl`, `font-bold` |
| **h3** | `text-lg`, `font-medium` |
| **Body text** | `text-sm` (14px), `font-normal` to `font-semibold` |
| **Small/meta text** | `text-xs` (12px), `text-[11px]`, or `text-[10px]` for timestamps/badges |
| **Eyebrow labels** | `text-[11px]`, `font-bold`, `uppercase`, `tracking-[0.14em]` to `tracking-[0.16em]`, colored with `accent` or `primary` |
| **Large metric values** | `text-3xl`, `font-bold` (`<strong>`), `tracking-[-0.04em]` — very tight for impact |
| **Logo/brand text** | `text-lg`, `font-bold`, `tracking-[-0.02em]` |

---

## 4. Spacing & Layout

| Property | Value |
|---|---|
| **Border radius (base)** | `0.65rem` (~10.4px) |
| **radius-sm** | `calc(0.65rem - 4px)` ≈ 6.4px |
| **radius-md** | `calc(0.65rem - 2px)` ≈ 8.4px |
| **radius-lg** | `0.65rem` ≈ 10.4px |
| **radius-xl** | `calc(0.65rem + 4px)` ≈ 14.4px |
| **Card corner radius** | `rounded-xl` (12px) — universally applied |
| **Button corner radius** | `rounded-lg` (8px) |
| **Avatar radius** | `rounded-full` (circle) |
| **Badge/pill radius** | `rounded-full` |
| **Content max-width** | `max-w-4xl` to `max-w-6xl` depending on screen |
| **Page padding** | `p-5` (20px) on mobile, `p-8` (32px) on desktop (`sm:p-8`) |
| **Card padding** | `p-5` (20px) internally, `p-4` (16px) for tighter cards |
| **Section gap** | `gap-5` (20px) between major sections |
| **Inner item gap** | `gap-2` to `gap-4` between items within cards |
| **Header bottom margin** | `mb-7` (28px) |

---

## 5. Shadows & Depth

| Element | Shadow |
|---|---|
| **Cards** | `shadow-[0_5px_18px_rgba(15,45,64,0.045)]` — extremely subtle, cool-toned. Barely visible but adds lift. |
| **Buttons (primary)** | `shadow-sm` — very light drop shadow |
| **Active tabs** | `shadow-sm` on white pill inside segmented control |
| **Everything else** | No shadows — flat surfaces |

> [!TIP]
> The shadow color `rgba(15,45,64,0.045)` is tinted with the navy brand color, not pure black. This is key to the cohesive, polished feel.

---

## 6. Component Styling Patterns

### Cards
- White background (`bg-card`), `rounded-xl`, thin `border border-border`, soft branded shadow
- Feature/hero card variant: `bg-secondary/65` with `border-secondary` and a large faded icon (`opacity-[0.06]`) positioned absolutely in the top-right corner as a decorative watermark

### Buttons
| Variant | Style |
|---|---|
| **Primary** | `bg-primary text-white`, hover at `90%` opacity, `shadow-sm`, `rounded-lg` |
| **Secondary** | `bg-secondary text-secondary-foreground`, hover at `80%` opacity |
| **Ghost** | Transparent, `text-muted-foreground`, hover `bg-secondary` |
| **Outline** | `border border-border bg-background`, hover `bg-secondary` |
| **Danger** | `bg-red-500 text-white`, hover `bg-red-600` |
| **All buttons** | `font-semibold`, `gap-2` between icon and text, focus ring `ring-2 ring-ring` |

### Sizes
| Size | Dimensions |
|---|---|
| **sm** | `h-9 px-3 text-xs` |
| **md** | `h-10 px-4 text-sm` |
| **icon** | `h-10 w-10` (square) |

### Inputs
- `h-10`, `rounded-lg`, `border border-border`, `bg-background`, `px-3`, `text-sm`
- Focus: `ring-2 ring-ring` (teal focus ring), `outline-none`
- Search inputs: icon (search magnifier) positioned absolutely inside `left-3`, input gets `pl-9`

### Avatars
- Circular (`rounded-full`), `bg-secondary`, `object-cover`
- Fallback: initials in `text-xs font-bold text-primary` on `bg-secondary` circle
- Sizes: `h-9 w-9` (small), `h-10 w-10` (medium), `h-14 w-14` (profile)

### Badges / Notification dots
- Small teal dot: `h-2 w-2 rounded-full bg-accent`
- Live indicator: dot with a `animate-ping` sibling for pulsing halo effect
- Counter badge: `h-5 min-w-5 rounded-full bg-accent text-[10px] font-bold text-accent-foreground`

### Segmented Controls / Tab Filters
- Container: `rounded-lg bg-secondary p-1`
- Active tab: `rounded-md bg-card text-primary shadow-sm` (white pill with shadow)
- Inactive tab: `text-muted-foreground`, no background

### Toggle / Switch
- Track: `h-6 w-11 rounded-full`
- On: `bg-accent`
- Off: `bg-muted-foreground/30`
- Knob: `h-4 w-4 rounded-full bg-white shadow`, translates `6` right when on

### Dividers
- `border-t border-border` between list items
- First item: `first:border-0 first:pt-0` (no top border on first)

### Chat Bubbles
- **Incoming**: `rounded-xl rounded-tl-sm border border-border bg-card` (square top-left corner)
- **Outgoing**: `rounded-xl rounded-tr-sm bg-primary text-primary-foreground` (square top-right corner)
- Both: `px-3.5 py-2.5 text-sm leading-relaxed`, max-width `76%`–`90%`

### Icon Treatment
- Icons: Lucide icon set, typical size `17px`–`20px`
- Active nav icons: `strokeWidth: 2.2`; inactive: `strokeWidth: 1.8`
- Icon containers: `rounded-lg bg-secondary text-primary` or `rounded-lg bg-primary text-primary-foreground`
- Accent icons: colored directly `text-accent` (teal)

---

## 7. Sidebar Design

| Property | Value |
|---|---|
| Width | `w-64` (256px) — hidden on mobile (`hidden md:flex`) |
| Background | `bg-sidebar` (white in light, dark in dark mode) |
| Border | `border-r border-border` |
| Logo area | `px-6 pt-6 pb-7` — icon in `h-8 w-8 rounded-lg bg-primary`, brand name `text-lg font-bold tracking-[-0.02em]` |
| Nav items | `px-3 py-2.5 rounded-lg text-sm font-semibold` |
| Nav active | `bg-sidebar-primary text-sidebar-primary-foreground` (`#E8F4F3` bg, `#173F59` text in light) |
| Nav inactive | `text-sidebar-foreground` (`#607482`), hover `bg-sidebar-accent` |
| Bottom user card | `rounded-xl bg-secondary/60 p-3` inside `m-3` |

### Mobile Bottom Navigation
- Fixed at bottom, `bg-card/95 backdrop-blur`, `border-t border-border`
- Active: `bg-secondary text-primary`
- Inactive: `text-muted-foreground`

---

## 8. Page Header Pattern

Every screen uses a consistent header:
- **Eyebrow**: `text-[11px] font-bold uppercase tracking-[0.16em] text-accent` — contextual label above the title
- **Title**: `text-2xl sm:text-3xl font-bold tracking-[-0.025em] text-foreground`
- **Action area**: Right-aligned button(s) on desktop, stacked on mobile
- **Bottom margin**: `mb-7`

---

## 9. Responsive Behavior

| Breakpoint | Behavior |
|---|---|
| **Mobile** (default) | Single column, sidebar hidden, bottom tab navigation visible, padding `p-5`, extra `pb-24` for bottom nav clearance |
| **sm (640px+)** | Padding increases to `p-8`, header becomes row layout, title scales to `text-3xl` |
| **md (768px+)** | Sidebar appears, bottom nav hides, two-column grids activate |
| **lg (1024px+)** | Dashboard uses `grid-cols-[minmax(0,1fr)_280px]` for main + sidebar panel layout |

---

## 10. Micro-Animations & Transitions

| Element | Animation |
|---|---|
| Live indicator dot | `animate-ping` on an absolutely-positioned sibling (Tailwind built-in) |
| Listening state | `animate-pulse` on a red dot |
| All interactive elements | `transition-colors` for smooth hover/state changes |
| Toggle knob | `transition-transform` for slide |
| No page transitions | Screens swap instantly (no route-level animations in this design) |

---

## 11. Key Design Principles

1. **Teal is the hero** — `#2B9C95` is used sparingly but consistently as the accent that draws the eye: active states, badges, icons, chart bars, focus rings, and toggle-on states.
2. **Deep navy is authority** — `#173F59` for primary buttons and text grounds the interface with professionalism.
3. **Borders over shadows** — Cards rely on thin `#DCE7EA` borders rather than heavy shadows. The one shadow used is barely perceptible and navy-tinted.
4. **Uppercase eyebrows** — Every page section has a tiny, tracked-out uppercase label in teal above the main heading, providing context.
5. **Consistent rounding** — Everything is generously rounded (`rounded-xl` for cards, `rounded-lg` for buttons/inputs, `rounded-full` for avatars and pills).
6. **Muted hierarchy** — Three tiers of text: `foreground` (dark navy) for headings/names, `text-sm font-semibold` for secondary content, `muted-foreground` (grey-blue) for metadata/labels.
7. **Whitespace-driven** — Generous padding (`p-5` to `p-8`) and gaps (`gap-4` to `gap-5`) create breathing room without feeling empty.
