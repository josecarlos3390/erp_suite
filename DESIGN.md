设计的本质，是消除一切不必要的差异后，那个不得不存在的差异。
# ERP Design System — Luna

> **Version:** 1.0.0  
> **Scope:** Complete visual language and component specification for a modern, responsive ERP platform.  
> **Philosophy:** Quiet authority. Every pixel serves a decision. Nothing decorates without purpose.

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Layout & Grid](#4-layout--grid)
5. [Spacing & Sizing](#5-spacing--sizing)
6. [Component Library](#6-component-library)
7. [Page Layouts & Templates](#7-page-layouts--templates)
8. [Interactions & Motion](#8-interactions--motion)
9. [Responsive Design](#9-responsive-design)
10. [Accessibility](#10-accessibility)
11. [Dark Mode Strategy](#11-dark-mode-strategy)
12. [ERP-Specific Patterns](#12-erp-specific-patterns)
13. [Implementation Notes](#13-implementation-notes)

---

## 1. Design Philosophy

### 1.1 Core Principles

| Principle | Description |
|-----------|-------------|
| **Clarity First** | Every element communicates hierarchy. Ambiguity is a bug. |
| **Restrained Elegance** | Premium feel through precision, not ornamentation. Subtle shadows, refined borders, purposeful whitespace. |
| **Efficiency by Default** | The UI accelerates expert workflows. Keyboard-first, density-adjustable, muscle-memory friendly. |
| **Contextual Focus** | Only show what matters in the moment. Progressive disclosure keeps cognitive load minimal. |
| **Seamless Modes** | Light and dark are not afterthoughts. Both are first-class citizens with equal refinement. |

### 1.2 Visual Identity

- **Mood:** Controlled, confident, editorial. Think *Notion* meets *Linear* meets *Bloomberg Terminal*.
- **Signature:** A restrained use of a single vibrant accent against neutral surfaces. High contrast when it matters, low contrast when it doesn't.
- **Density:** Three density modes—`comfortable` (default), `compact` (for power users), `spacious` (for presentations).
- **Border Radius Philosophy:** Small and sharp for controls (`6px`), slightly larger for surfaces (`12px`), fully rounded only for pills and avatars (`9999px`).

### 1.3 Design Tokens Philosophy

All values are tokenized. No hardcoded values in components. Tokens cascade: primitives → semantic → component-specific. This guarantees consistency across every screen and state.

---

## 2. Color System

### 2.1 Primitive Palette

Primitives are the raw color values. They never appear directly in UI; they are mapped through semantic tokens.

**Neutral Scale (Slate)**

| Token | Light Hex | Dark Hex | Usage |
|-------|-----------|----------|-------|
| `neutral-0` | `#FFFFFF` | `#0A0A0F` | Deepest background |
| `neutral-50` | `#F8F9FB` | `#12121A` | Elevated surfaces |
| `neutral-100` | `#F1F3F6` | `#1A1A25` | Cards, panels |
| `neutral-200` | `#E4E7EC` | `#242433` | Borders, dividers |
| `neutral-300` | `#D0D5DD` | `#35354A` | Disabled borders |
| `neutral-400` | `#98A2B3` | `#6E7089` | Placeholder text |
| `neutral-500` | `#667085` | `#8A8CA8` | Secondary text |
| `neutral-600` | `#475467` | `#A5A7BF` | Primary text (dark mode) |
| `neutral-700` | `#344054` | `#C2C4D8` | Headings (dark mode) |
| `neutral-800` | `#1D2939` | `#E2E4F0` | Headings, strong text |
| `neutral-900` | `#101828` | `#FFFFFF` | Primary text (light mode) |

**Accent Scale (Indigo — Primary)**

| Token | Hex | Dark Hex | Usage |
|-------|-----|----------|-------|
| `accent-50` | `#EEF2FF` | `#1E1B4B` | Lightest tint |
| `accent-100` | `#E0E7FF` | `#312E81` | Subtle backgrounds |
| `accent-200` | `#C7D2FE` | `#4338CA` | Hover states |
| `accent-300` | `#A5B4FC` | `#4F46E5` | Borders |
| `accent-400` | `#818CF8` | `#6366F1` | Secondary accent |
| `accent-500` | `#6366F1` | `#818CF8` | Primary accent |
| `accent-600` | `#4F46E5` | `#A5B4FC` | Buttons, links |
| `accent-700` | `#4338CA` | `#C7D2FE` | Hover buttons |
| `accent-800` | `#3730A3` | `#E0E7FF` | Active states |
| `accent-900` | `#312E81` | `#EEF2FF` | Strong emphasis |

**Semantic Colors**

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `success-500` | `#22C55E` | `#4ADE80` | Success states |
| `warning-500` | `#F59E0B` | `#FBBF24` | Warnings |
| `error-500` | `#EF4444` | `#F87171` | Errors, destructive |
| `info-500` | `#3B82F6` | `#60A5FA` | Information |

**Extended Semantic**
- `success-50` → `success-900` following the same tint/shade logic as accent.
- `warning-50` → `warning-900`
- `error-50` → `error-900`
- `info-50` → `info-900`

### 2.2 Semantic Tokens

Semantic tokens map primitives to meaning. They are mode-aware (automatically swap for dark mode).

**Backgrounds**

| Token | Light | Dark |
|-------|-------|------|
| `bg-base` | `neutral-0` | `neutral-0` |
| `bg-elevated` | `neutral-50` | `neutral-50` |
| `bg-surface` | `neutral-100` | `neutral-100` |
| `bg-overlay` | `neutral-0` @ 96% opacity | `neutral-50` @ 96% opacity |
| `bg-inset` | `neutral-50` | `neutral-0` |
| `bg-hover` | `neutral-100` | `neutral-50` |
| `bg-active` | `neutral-200` | `neutral-100` |
| `bg-selected` | `accent-50` | `accent-900` @ 20% opacity |

**Text**

| Token | Light | Dark |
|-------|-------|------|
| `text-primary` | `neutral-900` | `neutral-900` |
| `text-secondary` | `neutral-500` | `neutral-500` |
| `text-tertiary` | `neutral-400` | `neutral-400` |
| `text-inverse` | `neutral-0` | `neutral-0` |
| `text-accent` | `accent-600` | `accent-500` |
| `text-success` | `success-600` | `success-500` |
| `text-warning` | `warning-600` | `warning-500` |
| `text-error` | `error-600` | `error-500` |
| `text-disabled` | `neutral-400` | `neutral-400` |

**Borders**

| Token | Light | Dark |
|-------|-------|------|
| `border-default` | `neutral-200` | `neutral-200` |
| `border-subtle` | `neutral-100` | `neutral-100` |
| `border-strong` | `neutral-300` | `neutral-100` |
| `border-accent` | `accent-300` | `accent-700` |
| `border-error` | `error-300` | `error-700` |
| `border-focus` | `accent-500` | `accent-400` |

### 2.3 Surface Treatments

- **Shadows (Light Mode):**
  - `shadow-sm`: `0 1px 4px rgba(0, 0, 0, 0.07)`
  - `shadow-md`: `0 4px 14px rgba(0, 0, 0, 0.08)`
  - `shadow-lg`: `0 12px 32px rgba(0, 0, 0, 0.12)`
  - `shadow-xl`: `0 24px 48px rgba(0, 0, 0, 0.16)`
  - `shadow-inner`: `inset 0 2px 4px rgba(0, 0, 0, 0.04)`

- **Shadows (Dark Mode):**
  - `shadow-sm`: `0 1px 4px rgba(0, 0, 0, 0.30)`
  - `shadow-md`: `0 4px 14px rgba(0, 0, 0, 0.40)`
  - `shadow-lg`: `0 12px 32px rgba(0, 0, 0, 0.50)`
  - `shadow-xl`: `0 24px 48px rgba(0, 0, 0, 0.60)`

- **Backdrops:** `backdrop-blur-md` + `bg-overlay` for modals and dropdowns.

---

## 3. Typography

### 3.1 Font Stack

- **Primary:** `Inter` (weights: 400, 500, 600, 700)
- **Monospace:** `JetBrains Mono` or `SF Mono` for data, code, IDs
- **Fallbacks:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

### 3.2 Type Scale

| Token | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|--------|-------------|----------------|-------|
| `text-2xs` | 10px | 500 | 14px | 0.02em | Badges, micro labels |
| `text-xs` | 12px | 400 | 16px | 0.01em | Secondary text, captions |
| `text-sm` | 13px | 400 | 18px | 0 | Body, inputs, table cells |
| `text-base` | 14px | 400 | 20px | 0 | Default body, descriptions |
| `text-md` | 16px | 400 | 24px | -0.01em | Lead paragraphs |
| `text-lg` | 18px | 500 | 28px | -0.02em | Section titles |
| `text-xl` | 20px | 600 | 30px | -0.02em | Card headers, modals |
| `text-2xl` | 24px | 600 | 32px | -0.02em | Page titles |
| `text-3xl` | 30px | 700 | 38px | -0.03em | Major headings |
| `text-4xl` | 36px | 700 | 44px | -0.03em | Hero metrics |
| `text-5xl` | 48px | 700 | 56px | -0.04em | Dashboard KPIs |

### 3.3 Typography Patterns

- **Headings:** Always `text-primary`. No uppercase transforms. Rely on weight and size for hierarchy.
- **Body:** `text-base`, `text-primary`, max-width 65ch for readability.
- **Labels:** `text-xs`, `text-secondary`, weight 500. Used above inputs, in table headers.
- **Data/Monospace:** `text-sm`, monospace. Right-aligned for numbers. Tabular figures enabled (`font-variant-numeric: tabular-nums`).
- **Truncation:** Single line: `truncate` (ellipsis). Multi-line: `line-clamp-2` (max 2 lines).

### 3.4 Text Colors by Context

| Context | Token |
|---------|-------|
| Page title | `text-primary` |
| Section header | `text-primary` |
| Body text | `text-primary` |
| Description / helper | `text-secondary` |
| Placeholder | `text-tertiary` |
| Disabled | `text-disabled` |
| Link | `text-accent` |
| Error message | `text-error` |
| Success confirmation | `text-success` |

---

## 4. Layout & Grid

### 4.1 Application Shell

```
┌─────────────────────────────────────────────────────────────┐
│ [Sidebar] │ [Top Bar]                                      │
│           │────────────────────────────────────────────────│
│  256px    │                                                │
│  fixed    │ [Main Content Area]                            │
│  collapsible → 72px                                       │
│           │                                                │
│           │  [Page Header]                                 │
│           │  [Content: Cards, Tables, Forms]               │
│           │                                                │
│           │  [Footer / Pagination]                         │
│           │                                                │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Grid System

- **Container:** Fluid, max-width `1440px`, centered.
- **Columns:** 12-column grid.
- **Gutter:** `24px` (default), `16px` (compact), `32px` (spacious).
- **Margin:** `24px` on each side at desktop, `16px` on tablet, `12px` on mobile.

### 4.3 Z-Index Scale

| Layer | Z-Index | Element |
|-------|---------|---------|
| Background | 0 | Base page |
| Content | 10 | Cards, sections |
| Sticky | 20 | Sticky headers, columns |
| Floating | 30 | FABs, floating actions |
| Dropdown | 200 | Menus, selects, tooltips |
| Overlay | 50 | Backdrop, drawers |
| Modal | 60 | Dialogs, popovers |
| Toast | 70 | Notifications |
| Loading | 80 | Full-screen loaders |

### 4.4 Sidebar Anatomy

- **Width:** `256px` expanded, `72px` collapsed.
- **Behavior:** Persistent on desktop (>1024px), overlay drawer on tablet/ mobile.
- **Sections:**
  - Logo/Brand (top, fixed)
  - Primary Navigation (scrollable)
  - Secondary Actions (bottom, fixed): Settings, Help, User
- **Item Height:** `40px` (comfortable), `32px` (compact).
- **Active State:** `bg-selected` + `text-accent` + left border indicator (`3px`, `accent-500`).
- **Hover:** `bg-hover` with `transition-colors duration-150`.
- **Submenus:** Indent `16px`, collapsible with chevron rotation animation.
- **Badges:** Right-aligned, `text-2xs`, inside nav items.

---

## 5. Spacing & Sizing

### 5.1 Spacing Scale

| Token | Value |
|-------|-------|
| `space-0` | 0px |
| `space-px` | 1px |
| `space-0.5` | 2px |
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-5` | 20px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-10` | 40px |
| `space-12` | 48px |
| `space-16` | 64px |
| `space-20` | 80px |
| `space-24` | 96px |

### 5.2 Sizing Patterns

- **Input Height:** `36px` (default), `32px` (compact), `40px` (large).
- **Button Height:** `36px` (default), `28px` (small), `44px` (large).
- **Card Padding:** `24px` (default), `16px` (compact).
- **Table Cell Padding:** `12px 16px` (default), `8px 12px` (compact).
- **Modal Padding:** `24px` body, `16px` header/footer.
- **Sidebar Padding:** `12px` horizontal.
- **Top Bar Height:** `64px`.

### 5.3 Border Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `radius-none` | 0px | Hard corners (rare) |
| `radius-sm` | 6px | Small tags, inputs |
| `radius-md` | 8px | Buttons, inputs, small cards |
| `radius-lg` | 12px | Dropdowns, menus |
| `radius-xl` | 14px | Cards, modals, panels |
| `radius-2xl` | 16px | Large surfaces, drawers |
| `radius-full` | 9999px | Pills, avatars, badges |

---

## 6. Component Library

### 6.1 Buttons

#### Variants

| Variant | Background | Text | Border | Hover | Active |
|---------|------------|------|--------|-------|--------|
| **Primary** | `accent-600` | `neutral-0` | none | `accent-700` | `accent-800` |
| **Secondary** | `neutral-100` | `neutral-700` | `neutral-200` | `neutral-200` / `neutral-800` | `neutral-300` |
| **Warning** | `warning-50` | `warning-800` | `warning-300` | `warning-100` / `warning-400` | `warning-200` |
| **Tertiary / Ghost** | transparent | `text-secondary` | none | `bg-hover` | `bg-active` |
| **Destructive** | `error-500` | `neutral-0` | none | `error-600` | `error-700` |
| **Link** | transparent | `text-accent` | none | underline + `accent-700` | `accent-800` |

#### Sizes

| Size | Height | Padding | Font | Radius |
|------|--------|---------|------|--------|
| Small | 28px | 8px 12px | `text-xs` | `radius-md` |
| Default | 36px | 12px 16px | `text-sm` | `radius-md` |
| Large | 44px | 16px 24px | `text-base` | `radius-md` |

#### States

- **Default:** As defined in variant table.
- **Hover:** Background shift + `cursor-pointer`. `transition-all duration-150 ease-out`.
- **Active/Pressed:** Scale `0.98`, background darkens.
- **Focus:** `ring-2 ring-accent-400 ring-offset-2 ring-offset-bg-base` (light), `ring-offset-bg-base` (dark).
- **Disabled:** `opacity-50`, `cursor-not-allowed`, no hover effects.
- **Loading:** Spinner icon replaces text (preserve width), `opacity-80`.

#### Icon Buttons

- Square aspect ratio.
- Icon size: `16px` (small/default), `20px` (large).
- Always use `aria-label` for accessibility.

#### Button Groups

- Horizontal: connected, `radius-md` outer, `radius-none` inner, `1px` divider.
- Toggle buttons: `bg-selected` for active item.

### 6.2 Inputs & Forms

#### Text Input

- **Height:** `36px`.
- **Padding:** `8px 12px`.
- **Border:** `1px solid border-default`.
- **Radius:** `radius-md`.
- **Background:** `bg-base`.
- **Font:** `text-sm`, `text-primary`.
- **Placeholder:** `text-tertiary`.
- **Focus:** `border-focus`, `ring-2 ring-accent-100`.
- **Error:** `border-error`, `ring-2 ring-error-100`.
- **Disabled:** `bg-surface`, `text-disabled`, `border-subtle`.
- **Read-only:** `bg-surface`, `text-primary`, `border-subtle`.

#### Input Add-ons

- **Prefix/Suffix:** `text-secondary` icon or text inside input, separated by subtle vertical divider.
- **Leading icon:** `16px`, `16px` left padding.
- **Clear button:** `X` icon appears on hover/focus when value present.

#### Textarea

- Min-height: `80px`.
- Auto-resize optional.
- Same border/focus states as input.

#### Select / Dropdown

- **Trigger:** Same styling as input with chevron-down icon (`16px`) right.
- **Dropdown Panel:** `bg-overlay`, `shadow-lg`, `radius-lg`, `border-default`.
- **Item:** `text-sm`, `text-primary`, height `36px`, padding `8px 12px`.
- **Item Hover:** `bg-hover`.
- **Item Selected:** `bg-selected` + checkmark icon left.
- **Item Disabled:** `text-disabled`.
- **Grouped:** Section headers with `text-xs`, `text-secondary`, uppercase, `letter-spacing: 0.05em`.

#### Checkbox

- **Size:** `16px`.
- **Border:** `1.5px solid border-strong`.
- **Radius:** `radius-sm` (4px).
- **Checked:** `bg-accent-600`, `border-accent-600`, white checkmark.
- **Indeterminate:** Horizontal dash inside.
- **Focus:** `ring-2 ring-accent-400`.
- **Label:** `text-sm`, `text-primary`, `8px` gap.

#### Radio

- **Size:** `16px`.
- **Border:** `1.5px solid border-strong`.
- **Radius:** Full circle.
- **Selected:** Inner dot `8px`, `bg-accent-600`.
- **Focus:** `ring-2 ring-accent-400`.

#### Toggle / Switch

- **Track:** `w-9 h-5`, `radius-full`.
- **Default (off):** `bg-neutral-200` (light), `bg-neutral-600` (dark).
- **On:** `bg-accent-600`.
- **Thumb:** `w-4 h-4`, white, `shadow-sm`, slides with `transition-transform duration-150`.
- **Label:** Optional, to the right, `text-sm`.

#### Form Layout

- **Vertical:** Label above input, `4px` gap. Best for most ERP forms.
- **Horizontal:** Label left, input right. Label width `160px`, right-aligned. Best for settings/dense forms.
- **Inline:** Label + input on single line. Best for filters.
- **Groups:** Related fields wrapped in card or fieldset with `border-subtle` and `radius-xl`.
- **Help Text:** `text-xs`, `text-secondary`, below input, `4px` top margin.
- **Error Text:** `text-xs`, `text-error`, below input, `4px` top margin, with error icon prefix.

### 6.3 Cards

#### Surface Card (Default)

- **Background:** `bg-surface`.
- **Border:** `1px solid border-default`.
- **Radius:** `radius-xl` (12px).
- **Shadow:** `shadow-sm` (or none if nested in elevated surface).
- **Padding:** `24px`.
- **Hover (clickable):** `shadow-md`, `translateY(-1px)`, `transition-all duration-200`.

#### Stats / Metric Card

- **Layout:** Icon (top or left) + Value + Label + Trend.
- **Icon:** `40px` container, `radius-lg`, `bg-selected` background, `text-accent` icon.
- **Value:** `text-2xl` or `text-3xl`, `text-primary`, weight 700.
- **Label:** `text-sm`, `text-secondary`.
- **Trend:** `text-xs`, with arrow icon, `text-success` or `text-error`.

#### List Card

- **Header:** Title + action button(s), `border-subtle` bottom divider.
- **Rows:** `border-subtle` bottom borders, last child no border.
- **Row Padding:** `12px 0`.
- **Empty:** Centered illustration + `text-secondary` message.

#### Media Card (Rare in ERP, used for assets)

- Image top, `radius-xl` top corners.
- Content below with title + meta.

### 6.4 Tables & Data Grids

#### Table Container

- **Background:** `bg-base` or `bg-surface`.
- **Border:** `1px solid border-default`.
- **Radius:** `radius-xl`.
- **Overflow:** `overflow-hidden` (radius clips table).

#### Table Header

- **Background:** `bg-surface` (slightly different from rows for depth).
- **Text:** `text-xs`, `text-secondary`, weight 600, uppercase, `letter-spacing: 0.04em`.
- **Padding:** `12px 16px`.
- **Border:** `1px solid border-default` bottom.
- **Sortable:** Column header hover → `text-primary` + sort icon appears. Active sort: `text-accent` + directional arrow.
- **Resizable:** `2px` drag handle on right edge, `cursor-col-resize`.
- **Sticky:** `position: sticky; top: 0; z-index: 20;`

#### Table Rows

- **Background:** `bg-base`.
- **Padding:** `12px 16px`.
- **Border:** `1px solid border-subtle` bottom.
- **Hover:** `bg-hover`.
- **Selected:** `bg-selected`.
- **Disabled/Inactive:** `opacity-60`.
- **Height:** `48px` (default), `40px` (compact), `56px` (spacious).

#### Table Cells

- **Text:** `text-sm`, `text-primary`.
- **Numbers:** Right-aligned, monospace, tabular nums.
- **Status:** Badge component inline.
- **Actions:** Icon button group appears on row hover (or always visible).
- **Truncation:** `max-width` defined per column, `truncate`.

#### Empty State

- **Height:** `200px` minimum.
- **Content:** Icon (`48px`, `text-tertiary`) + Title (`text-md`) + Description (`text-sm`, `text-secondary`) + Optional CTA button.
- **Alignment:** Centered.

#### Loading State

- **Skeleton:** `bg-surface` animated pulse. Rows of `12px` rounded rectangles.
- **Spinner:** Centered in container for initial load.

#### Pagination (Table Footer)

- **Layout:** Left: "Showing X-Y of Z results" (`text-sm`, `text-secondary`). Right: Controls.
- **Controls:** Rows-per-page select + Page number buttons + Prev/Next.
- **Page Button:** `32px` square, `radius-md`. Active: `bg-accent-600`, `text-inverse`. Hover: `bg-hover`.
- **Compact:** Simple prev/next + page indicator for mobile.

#### Advanced Table Features

- **Column Visibility:** Dropdown with checkboxes for each column.
- **Column Reordering:** Drag-and-drop headers.
- **Row Expansion:** Chevron click expands sub-table or details panel below row.
- **Row Selection:** Checkbox in first column. Batch actions bar appears on selection (see [Bulk Actions](#bulk-actions)).
- **Inline Edit:** Cell becomes input on click/double-click. Save on blur or Enter.
- **Frozen Columns:** `position: sticky`, `box-shadow: 2px 0 4px rgba(0,0,0,0.05)` for right shadow.

### 6.5 Sidebar Navigation

#### Structure

```
Sidebar
├── Brand Header (logo + collapse toggle)
├── Search (optional, cmd+k)
├── Section Label (e.g., "MODULES")
│   └── Nav Item
│       ├── Icon (20px)
│       ├── Label
│       ├── Badge (optional)
│       └── Submenu Chevron
├── Divider
├── Section Label (e.g., "ADMIN")
│   └── Nav Item
└── User Footer (avatar + name + role)
```

#### Nav Item States

| State | Styling |
|-------|---------|
| Default | `text-secondary`, icon `text-tertiary` |
| Hover | `bg-hover`, `text-primary` |
| Active | `bg-selected`, `text-accent`, left border `3px accent-500` |
| Expanded | Chevron rotated 90deg |
| Submenu Item Active | Same as active but no left border, subtle indent |

#### Collapse Behavior

- **Trigger:** Chevron button or click on collapse toggle.
- **Animation:** `transition-all duration-200 ease-in-out`. Width `256px → 72px`.
- **Collapsed State:** Only icons visible. Tooltip on hover shows label.
- **Mobile:** Slide-in drawer from left, `shadow-xl`, `w-72`, overlay backdrop `bg-neutral-900/50`.

### 6.6 Top Bar / Header

#### Structure

- **Height:** `64px`.
- **Background:** `bg-base` or `bg-surface`.
- **Border:** `1px solid border-default` bottom.
- **Shadow:** `shadow-sm` when scrolled (detected via JS).
- **Layout:** Flex, space-between.

#### Left Section

- **Breadcrumb:** `text-sm`, `text-secondary`. Separator: `>` or `/`. Current page: `text-primary`.
- **Page Title:** `text-xl` or `text-2xl`, `text-primary`, weight 600. Often in page content instead.

#### Center Section

- **Global Search:** `w-96` max-width. Input with `⌘K` shortcut badge. `bg-surface` background.

#### Right Section

- **Action Buttons:** Primary CTA + secondary actions.
- **Icon Buttons:** Notifications (with badge), Help, Settings.
- **User Menu:** Avatar (`32px`) + dropdown.

### 6.7 Modals & Popups

#### Modal / Dialog

- **Backdrop:** `bg-neutral-900/50` (light), `bg-black/60` (dark), `backdrop-blur-sm`.
- **Panel:** `bg-surface`, `shadow-xl`, `radius-2xl` (16px).
- **Max Width:** `448px` (small), `560px` (medium), `720px` (large), `1024px` (full).
- **Padding:** `24px`.
- **Header:** Title (`text-xl`, weight 600) + Close button (top-right).
- **Body:** Scrollable if content exceeds `70vh`.
- **Footer:** Right-aligned buttons. Primary action rightmost.
- **Animation:** Backdrop fade `150ms`. Panel scale `0.95 → 1` + fade `200ms`, `ease-out`.
- **Focus Trap:** First focusable element or close button. Return focus on close.

#### Confirmation Dialog

- **Icon:** Warning or info icon, `48px`, centered top.
- **Title:** Centered.
- **Description:** `text-secondary`, centered.
- **Actions:** Stacked or side-by-side. Destructive action gets `variant: destructive`.

#### Drawer / Slide-over

- **Position:** Right (default), left, top, bottom.
- **Width:** `480px` (default), `720px` (wide), `w-full` (mobile).
- **Background:** Same as modal panel.
- **Animation:** Slide from edge `300ms ease-out`, backdrop fade `200ms`.
- **Use Case:** Detail views, forms, filters on mobile.

#### Popover / Dropdown Menu

- **Trigger:** Click or right-click.
- **Panel:** `bg-overlay`, `shadow-lg`, `radius-lg`, `border-default`.
- **Padding:** `4px` (internal, around items).
- **Item:** `text-sm`, `text-primary`, height `36px`, padding `8px 12px`, `radius-md`.
- **Item Hover:** `bg-hover`.
- **Item Danger:** `text-error` on hover.
- **Separator:** `1px solid border-subtle`, margin `4px` vertical.
- **Submenu:** Nested panel opens to right (or left if space constrained).

#### Tooltip

- **Trigger:** Hover or focus, delay `300ms`.
- **Panel:** `bg-neutral-800` (light), `bg-neutral-100` (dark), `text-inverse` (light), `text-primary` (dark), `text-xs`, padding `6px 10px`, `radius-md`.
- **Arrow:** `6px` triangle, matches panel background.
- **Max Width:** `256px`.
- **Placement:** Auto (top/bottom/left/right based on viewport).

### 6.8 Tabs

#### Default Tabs

- **Container:** Border-bottom `1px solid border-default`.
- **Tab:** `text-sm`, `text-secondary`, weight 500, padding `12px 16px`, `border-bottom: 2px solid transparent`.
- **Tab Hover:** `text-primary`.
- **Tab Active:** `text-primary`, `border-bottom-color: accent-600`.
- **Tab Disabled:** `text-disabled`.
- **Animation:** Underline slide optional.

#### Pill Tabs

- **Container:** `bg-surface`, `radius-full`, padding `4px`.
- **Tab:** `radius-full`, `text-sm`, weight 500, padding `8px 16px`.
- **Tab Active:** `bg-base`, `shadow-sm`, `text-primary`.
- **Use:** Segmented control, view switching.

#### Vertical Tabs

- **Container:** Left column, `w-48` or `w-56`.
- **Tab:** `text-sm`, padding `10px 12px`, `radius-md`.
- **Active:** `bg-selected`, `text-accent`.
- **Content:** Right side, full remaining width.

### 6.9 Badges & Tags

#### Badge

- **Height:** `20px` (default), `16px` (small).
- **Padding:** `2px 8px` (default), `2px 6px` (small).
- **Radius:** `radius-full`.
- **Font:** `text-2xs` (small), `text-xs` (default), weight 600.

#### Variants

| Variant | Background | Text |
|---------|------------|------|
| Default | `bg-surface` | `text-secondary` |
| Primary | `accent-50` | `accent-700` |
| Success | `success-50` | `success-700` |
| Warning | `warning-50` | `warning-700` |
| Error | `error-50` | `error-700` |
| Info | `info-50` | `info-700` |

#### Status Dot

- `8px` circle, inline before text.
- Colors match semantic tokens.
- Pulse animation for "in progress" or "live".

#### Tag / Chip (Removable)

- Same as badge but with `X` icon button at right.
- Hover on X: `bg-hover` circle behind icon.
- Use: Multi-select filters, assignees.

### 6.10 Alerts & Notifications

#### Inline Alert

- **Padding:** `12px 16px`.
- **Radius:** `radius-lg`.
- **Border:** `1px solid` left accent, or full border.
- **Icon:** `20px`, left, color matches semantic.
- **Title:** `text-sm`, weight 600, `text-primary`.
- **Description:** `text-sm`, `text-secondary`.
- **Close:** Optional, top-right.

#### Variants

| Variant | Border | Background |
|---------|--------|------------|
| Info | `info-300` | `info-50` |
| Success | `success-300` | `success-50` |
| Warning | `warning-300` | `warning-50` |
| Error | `error-300` | `error-50` |

#### Toast / Notification

- **Position:** Bottom-right (default), stackable.
- **Panel:** `bg-surface`, `shadow-lg`, `radius-xl`, `border-default`.
- **Width:** `360px` max.
- **Layout:** Icon + Content + Close.
- **Auto-dismiss:** `5000ms` default. Pause on hover.
- **Progress Bar:** Thin line at bottom, counts down.
- **Animation:** Slide in from right `300ms`, fade out `200ms`.

### 6.11 Loading & Skeleton

#### Spinner

- **Sizes:** `16px` (inline), `24px` (buttons), `32px` (sections), `48px` (pages).
- **Color:** `accent-600` (default), `neutral-400` (subtle).
- **Stroke:** `2px`, round caps, rotating animation `1s linear infinite`.

#### Skeleton

- **Shape:** Rounded rectangle, `radius-md`.
- **Color:** `bg-surface`.
- **Animation:** Shimmer pulse, `opacity` or `translateX` gradient sweep.
- **Patterns:**
  - Text line: `100%` width, `12px` or `16px` height.
  - Avatar: Circle, `40px`.
  - Card: Rectangle with multiple internal lines.

### 6.12 Empty States

- **Container:** Centered, min-height `240px`.
- **Illustration:** Abstract geometric shape or icon, `64px`, `text-tertiary`.
- **Title:** `text-lg`, `text-primary`, weight 600.
- **Description:** `text-sm`, `text-secondary`, max-width `320px`, centered.
- **CTA:** Primary or secondary button below.
- **Variations:** No data, no results (search), no permission, error loading.

### 6.13 Pagination

- **Compact (Mobile):** `< Previous` / `Next >` with page counter (`Page 3 of 12`).
- **Default:** Numbered buttons, `radius-md`, `32px` height.
  - Active: `bg-accent-600`, white text.
  - Hover: `bg-hover`.
  - Ellipsis: `...` non-clickable.
- **With Size Selector:** Dropdown for rows per page (`10, 25, 50, 100`).

### 6.14 Breadcrumbs

- **Separator:** `>` (`text-tertiary`, `16px`).
- **Item:** `text-sm`, `text-secondary`. Hover: `text-primary`.
- **Current:** `text-sm`, `text-primary`, weight 500, no link.
- **Root:** Home icon optional.
- **Collapsed:** If too long, show `...` dropdown with hidden items.

### 6.15 Avatars

- **Sizes:** `24px` (xs), `32px` (sm), `40px` (md), `48px` (lg), `64px` (xl).
- **Shapes:** Circle (default), Square `radius-lg` (rare).
- **Image:** Object-fit cover.
- **Fallback:** Initials (`text-inverse`, weight 600) on `bg-accent-600` or deterministic color from name.
- **Group:** Overlapping stack, `border: 2px solid bg-base`, `-space-x-2`.
- **Status Indicator:** `10px` dot, `2px` border `bg-base`, positioned bottom-right.
  - `success-500`: Online
  - `warning-500`: Away
  - `neutral-400`: Offline

### 6.16 Accordion

- **Header:** `text-sm`, `text-primary`, weight 500, padding `12px 0`.
- **Icon:** Chevron right, rotates `90deg` on expand.
- **Content:** `text-sm`, `text-secondary`, padding `0 0 16px 0`.
- **Border:** `1px solid border-default` bottom, or full container with `radius-xl`.
- **Animation:** Height `0 → auto` with `transition-all duration-200 ease-out`.

### 6.17 Date & Time Pickers

#### Date Input

- **Trigger:** Input with calendar icon right.
- **Panel:** `bg-overlay`, `shadow-lg`, `radius-xl`.
- **Header:** Month/Year navigation with chevrons.
- **Calendar Grid:** `7 columns`. Day labels `text-xs`, `text-secondary` top.
- **Day Cell:** `36px` square, `radius-md`, `text-sm`.
  - Default: `text-primary`.
  - Hover: `bg-hover`.
  - Selected: `bg-accent-600`, `text-inverse`.
  - Today: `border-accent-500` ring.
  - Disabled/Other month: `text-disabled`.
- **Range:** Start and end selected, connecting span `bg-accent-50`.

#### Time Input

- **Layout:** Hours `:` Minutes AM/PM (or 24h).
- **Selector:** Dropdown or scrollable column.

### 6.18 Search & Filters

#### Global Search

- **Trigger:** `⌘K` shortcut or input click.
- **Modal:** Centered, `w-[640px]`, `bg-surface`, `shadow-xl`, `radius-2xl`.
- **Input:** Large, `text-lg`, no border, at top of modal.
- **Results:** Grouped by category (Pages, Records, Actions). `text-sm`.
- **Item Hover:** `bg-hover`.
- **Shortcut:** Keyboard navigation (arrows + Enter).

#### Filter Bar

- **Layout:** Horizontal row of filter components, `12px` gap, wrapping allowed.
- **Filter Chip:** Selected filter shown as removable tag.
- **Add Filter:** Button opens popover with field + operator + value.
- **Clear All:** Text button when filters active.

#### Advanced Filter Builder

- **Layout:** Vertical stack of condition rows.
- **Row:** Field select + Operator select + Value input + Remove.
- **Logic:** AND/OR toggle between groups.
- **Container:** `bg-surface`, `radius-xl`, `border-default`.

### 6.19 Progress & Steps

#### Progress Bar

- **Height:** `8px` (default), `4px` (thin), `12px` (bold).
- **Track:** `bg-surface`, `radius-full`.
- **Fill:** `bg-accent-600`, `radius-full`, `transition-width duration-500 ease-out`.
- **Label:** Percentage or fraction, `text-xs`, right of bar or inside.

#### Stepper

- **Orientation:** Horizontal (default), vertical (for mobile or long flows).
- **Step:** Circle (`24px` or `32px`) + Label below.
  - Pending: `border-default`, `text-secondary`.
  - Active: `border-accent-600`, `text-accent`.
  - Complete: `bg-accent-600`, checkmark icon, white.
- **Connector:** Line between steps, `bg-surface` or `bg-accent-600`.
- **Label:** `text-xs`, `text-secondary` (pending), `text-primary` (active).

### 6.20 File Upload / Dropzone

- **Zone:** Dashed border `2px border-dashed border-strong`, `radius-xl`, padding `32px`.
- **Hover/Drag Over:** `border-accent-500`, `bg-selected`.
- **Content:** Upload icon + "Drop files here or click to browse" + `text-xs` file type hint.
- **File List:** Below zone, small cards with file name, size, progress bar, remove button.

### 6.21 Floating Action Button (FAB)

- **Shape:** Circle, `56px` diameter.
- **Background:** `bg-accent-600`.
- **Icon:** White, `24px`, centered.
- **Shadow:** `shadow-lg`.
- **Hover:** `scale(1.05)`, `shadow-xl`.
- **Use:** Primary creation action on mobile. Hidden on desktop where primary button is in top bar.
- **Extended FAB:** Optional pill shape with icon + label for extra clarity.

### 6.22 Command Palette / Spotlight

- **Trigger:** `⌘K` or `Ctrl+K`.
- **Overlay:** Full screen `bg-neutral-900/40`, `backdrop-blur-sm`.
- **Panel:** Centered, `w-[640px]`, `bg-surface`, `shadow-xl`, `radius-2xl`.
- **Input:** Large search at top, `text-lg`, no border.
- **Sections:** Grouped results with section headers (`text-xs`, `text-secondary`, uppercase).
- **Item:** `text-sm`, `text-primary`, padding `10px 12px`, `radius-md`.
- **Item Active:** `bg-hover` or `bg-selected`.
- **Shortcut Hints:** Right-aligned `text-xs`, `text-tertiary`, showing keyboard shortcut for action.
- **Empty:** "No results found" with suggestions.

### 6.23 Rich Text / Markdown Editor

- **Container:** `bg-base`, `border-default`, `radius-xl`.
- **Toolbar:** `bg-surface`, `border-default` bottom, sticky top of editor.
- **Buttons:** Icon buttons for formatting (bold, italic, link, list, code).
- **Editor Area:** `padding 12px`, `text-sm`, `text-primary`.
- **Placeholder:** `text-tertiary`.
- **Focus:** `border-focus` on container.
- **Preview/Edit Toggle:** Tab switch if needed.

### 6.24 Number Input / Stepper

- **Layout:** Input with `-` and `+` buttons on sides.
- **Buttons:** `32px` square, `bg-surface`, `border-default`.
- **Input:** Center-aligned, no side borders (connected to buttons).
- **Min/Max:** Buttons disabled at boundaries.

### 6.25 Slider / Range

- **Track:** `h-2`, `bg-surface`, `radius-full`.
- **Fill:** `bg-accent-600`, `radius-full`.
- **Thumb:** `w-4 h-4`, `bg-base`, `border-2 border-accent-600`, `shadow-sm`, `radius-full`.
- **Hover:** Thumb scales to `w-5 h-5`.
- **Tooltip:** Current value shown above thumb on drag.
- **Range:** Dual thumbs for min/max selection.

### 6.26 Color Picker

- **Trigger:** Small swatch `24px`, `radius-md`, `border-default`, with current color.
- **Panel:** `bg-overlay`, `shadow-lg`, `radius-xl`.
- **Layout:** Saturation/brightness square + hue slider + hex input + preset palette.
- **Preset Palette:** Grid of `16px` swatches, common ERP colors.

### 6.27 Currency / Money Input

- **Prefix:** Currency symbol (`$`, `€`, etc.) fixed at left, `text-secondary`.
- **Input:** Right-aligned numbers, `text-sm`, monospace.
- **Formatting:** Auto-format with thousand separators on blur.
- **Validation:** Red if negative where not allowed.

### 6.28 Phone / Tel Input

- **Prefix:** Country flag + code selector dropdown.
- **Input:** `text-sm`, formatted with mask.
- **Validation:** Green check when valid format for selected country.

### 6.29 Multi-Select / Combobox

- **Trigger:** Input-like box showing selected tags, with cursor for typing.
- **Dropdown:** Same as Select panel.
- **Item:** Checkbox left + label. Selected items checked.
- **Create Option:** "Create 'X'" item at bottom if allowCreate.
- **Tag Overflow:** Collapse to "+N more" when exceeding width.

### 6.30 Tree / Hierarchical List

- **Indent:** `24px` per level.
- **Node:** Icon (folder/file chevron) + Label + optional badge.
- **Expand:** Chevron rotates on click.
- **Select:** `bg-selected` on active node.
- **Drag:** Ghost preview while dragging, drop indicator line.
- **Use:** Org chart, file manager, category tree, chart of accounts.

### 6.31 Kanban Board

- **Board:** Horizontal scroll container.
- **Column:** `w-80`, `bg-surface`, `radius-xl`, vertical stack.
- **Column Header:** Title + count badge + actions menu.
- **Card:** `bg-base`, `radius-lg`, `shadow-sm`, padding `16px`.
  - Title, meta, tags, assignee avatars, due date.
- **Drag:** Card ghost preview, column drop zone highlight.
- **Quick Add:** Bottom of column, "+ Add" button expands to mini-form.

### 6.32 Calendar / Scheduler

- **Views:** Month, Week, Day, Agenda (toggle via pill tabs).
- **Month Grid:** 7 columns. Day cell min-height `100px`.
  - Header: Day name `text-xs`, `text-secondary`.
  - Day number: `text-sm`, `text-primary`. Today: `bg-accent-600` circle, white text.
  - Events: Colored pills, `text-2xs`, truncated.
- **Week/Day:** Time grid vertical. Events absolute positioned.
- **Event:** Pill, `radius-md`, `4px` padding. Color coded by category.
- **Create:** Click empty cell → quick create popover.

### 6.33 Chat / Messaging Panel

- **Container:** Drawer or embedded panel, `w-96`.
- **Message List:** Scrollable, reverse order (newest bottom).
- **Message Bubble:**
  - Own: `bg-accent-600`, white text, right-aligned.
  - Other: `bg-surface`, `text-primary`, left-aligned.
  - Radius: `radius-lg`, tail pointing to sender.
- **Meta:** `text-2xs`, `text-tertiary`, below bubble.
- **Input:** Fixed bottom, text input + send button.
- **Typing Indicator:** Three animated dots.

### 6.34 Notification Center / Inbox

- **Trigger:** Bell icon with unread dot.
- **Panel:** `w-96`, `bg-overlay`, `shadow-lg`, `radius-xl`, right-side dropdown.
- **Header:** "Notifications" + Mark all read + Settings link.
- **Item:** Icon + Title + Description + Timestamp. Unread: left accent border `3px`.
- **Empty:** Icon + "All caught up".
- **Actions:** Hover shows dismiss (X). Click navigates to related record.

### 6.35 Entity Lookup / Record Selector

- **Trigger:** Input with search icon + selected record display. "+ Select Customer" placeholder.
- **Panel:** Modal or dropdown, `w-[560px]`, `bg-surface`, `shadow-xl`, `radius-2xl`.
- **Layout:** Search bar top + filter chips + data table of records.
- **Columns:** Key identifying fields (Name, Code, Status). Minimal.
- **Selection:** Click row selects, closes panel, populates trigger input.
- **Create New:** "+ Create new [Entity]" button at bottom for when record doesn't exist.
- **Recent:** Section at top showing recently selected records.

### 6.36 Context Menu

- **Trigger:** Right-click on table row, card, canvas area.
- **Panel:** `bg-overlay`, `shadow-lg`, `radius-lg`, `border-default`.
- **Items:** Same as Dropdown Menu but triggered by right-click.
- **Shortcuts:** Right-aligned `text-xs`, `text-tertiary`.
- **Submenu:** Nested panels for nested actions (e.g., "Export as > CSV / Excel / PDF").
- **Disabled items:** `text-disabled`, no hover effect.

### 6.37 Table Footer Aggregation

- **Position:** Fixed or scrollable footer row below table body.
- **Row:** `bg-surface`, `border-default` top.
- **Cells:** `text-sm`, weight 600, `text-primary`.
- **Content:**
  - Count: "42 items" in first column.
  - Sum: Total of numeric columns. Monospace, `text-accent`.
  - Average: "Avg: $4,230".
  - Custom: Any calculated field.
- **Alignment:** Matches column alignment (numbers right).
- **Sticky:** `position: sticky; bottom: 0;` if table scrolls vertically.

### 6.38 Comment Thread / Notes

- **Container:** `bg-surface`, `radius-xl`, padding `16px`.
- **Thread:** Vertical list, `16px` gap between comments.
- **Comment:**
  - Avatar (`32px`) + Name (`text-sm`, weight 500) + Time (`text-2xs`, `text-tertiary`).
  - Body: `text-sm`, `text-primary`.
  - Attachments: File chips below.
  - Actions: Reply, Edit, Delete (owner only).
- **Input:** Textarea + Attach button + Post button at bottom.
- **Mentions:** `@` triggers user dropdown, highlighted in `accent-50` background.

### 6.39 Async Job / Task Monitor

- **Trigger:** System tray icon or progress toast.
- **Panel:** Drawer or dropdown, `w-80`.
- **Item:** Job name + progress bar + status + cancel button.
- **Status:**
  - Queued: `text-tertiary`.
  - Running: Animated spinner + `text-accent`.
  - Complete: Checkmark + `text-success`.
  - Failed: X + `text-error` + retry button.
- **History:** "Show completed jobs" toggle. Jobs auto-dismiss after `30s` on success.

### 6.40 Document Viewer / Inline Preview

- **Container:** Modal or embedded panel, `bg-base`.
- **Toolbar:** Zoom in/out, fit to width, download, print, page counter.
- **Viewport:** Centered document, `shadow-lg`, white background regardless of theme (paper is paper).
- **Thumbnails:** Left sidebar for multi-page docs.
- **Types:** PDF (primary), Image, Text, CSV preview.
- **Loading:** Skeleton page while rendering.

### 6.41 Split Pane / Resizable Layout

- **Orientation:** Horizontal (left/right) or vertical (top/bottom).
- **Divider:** `4px` hit area, `1px` visible line `border-default`. Hover: `border-accent`, `cursor-col-resize` or `cursor-row-resize`.
- **Handle:** Small grip dots at center of divider.
- **Min Width:** Each pane `200px` minimum.
- **Collapse:** Double-click divider or collapse button to snap pane to `0`.
- **Persistence:** Pane widths saved to `localStorage`.

### 6.42 Sticky Summary Bar

- **Position:** Fixed at bottom of viewport or below form header.
- **Background:** `bg-surface`, `shadow-lg`, `border-default` top.
- **Height:** `64px`.
- **Content:** Key computed values from form.
  - Example (Order): "Subtotal: $4,200 | Tax: $378 | **Total: $4,578**".
- **Actions:** Save, Cancel, Submit buttons right-aligned.
- **Update:** Re-calculates on any dependent field change. Numbers animate with `count-up` effect.

### 6.43 Duplicate Detection Dialog

- **Trigger:** On save, if system detects potential duplicates.
- **Panel:** Modal, `w-[640px]`.
- **Header:** "Possible duplicates found" with `warning-500` icon.
- **Body:** List of existing records with match score (`text-xs`, `text-accent`).
- **Row:** Key fields side-by-side (New vs Existing).
- **Actions:** "Use existing", "Create anyway", "Cancel and review".

### 6.44 Master-Detail Layout

- **Structure:** Split pane. Left `w-1/3`: Master list. Right `w-2/3`: Detail view.
- **Master:** Searchable list, selectable rows. Selection updates detail.
- **Detail:** Full record view with tabs.
- **Empty:** "Select an item to view details".
- **Mobile:** Master becomes full-screen list. Selection navigates to detail page with back button.
- **Use:** Email client style, contact manager, product catalog.

### 6.45 Reorderable List

- **Item:** `bg-base`, `border-default`, `radius-lg`, padding `12px 16px`.
- **Handle:** Drag icon (`grip-vertical`) left side, `text-tertiary`.
- **Drag:** Ghost item `shadow-xl`, `opacity-90`. Drop indicator: `2px` line `border-accent` between items.
- **Animation:** `auto-animate` or FLIP for smooth reordering.
- **Use:** Priority lists, menu ordering, workflow steps, categories.

### 6.46 Data Grid Cell Types

Specialized inline cell renderers for high-density ERP grids:

- **Checkbox Cell:** Centered checkbox, toggles on row click.
- **Date Cell:** `text-sm`, formatted date. Inline date picker on edit.
- **Currency Cell:** Right-aligned, monospace, currency symbol prefix.
- **Percentage Cell:** Right-aligned, `%` suffix. Optional small progress bar background.
- **Status Cell:** Badge centered or left.
- **User Cell:** Avatar (`24px`) + name truncated.
- **Action Cell:** Icon button group (edit, delete, more).
- **Link Cell:** `text-accent`, underline on hover, navigates on click.

### 6.47 Wizard / Guided Flow

- **Header:** Stepper showing progress.
- **Body:** Current step content, full width.
- **Footer:** Back + Next/Finish. Next disabled until step valid.
- **Summary:** Final step shows all data for review before submit.
- **Navigation:** Clicking completed steps jumps back to them.
- **Use:** Onboarding, complex setup, multi-step forms (quote creation, employee onboarding).

---

## 7. Page Layouts & Templates

### 7.1 Dashboard

#### Structure

```
[Page Header]
  Title: "Dashboard" + Date range selector + Export button

[Stats Row]
  4 Metric Cards (responsive: 1 col mobile, 2 tablet, 4 desktop)

[Charts Row]
  2/3 width: Main Chart Card (revenue, orders, etc.)
  1/3 width: Secondary Chart or List Card

[Data Row]
  Full width: Recent Activity Table or List

[Bottom Row]
  1/2: Tasks / To-do Card
  1/2: Notifications / Alerts Card
```

#### Characteristics

- Density: `comfortable`.
- Cards: `bg-surface`, `shadow-sm`, `radius-xl`.
- Interactivity: All cards clickable to drill down.
- Real-time: Optional live indicators on metrics.

### 7.2 List View (CRUD Index)

#### Structure

```
[Page Header]
  Title + Breadcrumb + [Create Button] + [Import Button]

[Filter Bar]
  Search input + Filter dropdowns + View toggle (list/grid)

[Batch Action Bar]
  Appears on row selection: "X selected" + Actions + Clear

[Data Table]
  Full-featured table (sort, filter, pagination, row actions)

[Floating Action Button]
  Mobile only: + button bottom-right for Create.
```

#### Characteristics

- Primary workspace of ERP. Optimized for scanning and bulk operations.
- Default sort: Most recently updated.
- Row actions: Hidden behind `...` menu or appear on hover.
- Column customization persisted per user.

### 7.3 Detail View (Record Page)

#### Structure

```
[Page Header]
  Breadcrumb + Record Title + Status Badge + Action Buttons

[Summary Card]
  Key fields in 2-3 column layout. Editable inline.

[Tabs]
  Overview | Related Records | History | Activity | Settings

[Tab Content]
  Overview: Full form or data display.
  Related: Nested tables or cards.
  History: Timeline component.
  Activity: Comments + audit log.
```

#### Characteristics

- Deep linking supported. Every record has a URL.
- Status transitions shown as button group with current state highlighted.
- Related data loaded lazily per tab.

### 7.4 Form View (Create / Edit)

#### Structure

```
[Page Header]
  "Create [Entity]" or "Edit [Entity]" + Cancel + Save

[Form Sections]
  Section: Card with title + description + fields
  Section: Another logical grouping

[Sticky Summary Bar]
  On financial/long forms: Totals computed in sticky bottom bar.

[Sticky Footer]
  On long forms: Cancel + Save remains visible at bottom.
```

#### Characteristics

- Validation: Real-time on blur for simple rules, on submit for complex.
- Dirty state tracking: Warn on navigate away if unsaved.
- Autosave: Optional draft save every `30s`.
- Conditional fields: Show/hide based on other field values.
- Multi-step: Stepper for complex creation flows.

### 7.5 Settings / Configuration

#### Structure

```
[Page Header]
  "Settings"

[Layout: Horizontal]
  Left: Vertical tab navigation (Account, Workspace, Security, Integrations, Billing)
  Right: Settings form content
```

#### Characteristics

- Immediate save vs. explicit save button depending on criticality.
- Danger zone: Separate card at bottom with `border-error` or red tint.
- Toggles preferred for boolean settings.

### 7.6 Auth Pages (Login / Register / Reset)

#### Structure

```
[Split Layout or Centered Card]
  Left (optional): Brand illustration or product screenshot
  Right: Auth form card

[Form]
  Logo (top)
  Title (text-2xl)
  Description (text-secondary)
  Inputs (email, password, etc.)
  Actions (submit button, link to other auth flows)
```

#### Characteristics

- Minimal chrome. No sidebar, no top bar.
- Full-page centered on mobile.
- Password strength indicator on registration.
- Error handling: Inline errors + shake animation on form.

### 7.7 Report & Analytics Page

#### Structure

```
[Page Header]
  Report Title + Date Range + Export (PDF/Excel) + Print

[Filter Panel]
  Collapsible sidebar or top bar with report parameters

[Chart Area]
  Full-width chart, `h-96` minimum
  Chart type switcher: Line | Bar | Pie | Area

[Summary Stats]
  3-4 metric cards above chart

[Data Table]
  Drill-down data behind "View Data" tab or accordion

[Saved Reports]
  Dropdown to load previously saved configurations
```

#### Characteristics

- Charts must use semantic color tokens for consistency.
- Loading state: Skeleton chart bars.
- Empty: "Select parameters to generate report".
- Interactivity: Click chart segment to filter table below.

### 7.8 User Management & Admin

#### Structure

```
[Page Header]
  "Users" + Invite button

[Stats Row]
  Total users | Active | Pending | Suspended

[User Table]
  Name | Email | Role | Status | Last Active | Actions

[Role Matrix]
  Separate tab: Grid of roles × permissions with checkmarks
```

#### Characteristics

- Bulk invite via email list paste.
- Role assignment via dropdown.
- Impersonate action for admins (with audit log).

### 7.9 Master-Detail Page

#### Structure

```
[Page Header]
  Title + Search

[Split Pane]
  Left (1/3): Master List (searchable, selectable)
  Right (2/3): Detail View (tabs, actions, related data)
```

#### Characteristics

- Selection in master immediately loads detail (no page reload).
- URL updates with selected record ID for shareability.
- List shows selected state (`bg-selected`).
- Detail has full CRUD if permissions allow.

---

## 8. Interactions & Motion

### 8.1 Motion Principles

- **Purposeful:** Every animation guides attention or confirms an action.
- **Fast:** `150ms–300ms`. ERP users are repeat users; speed beats spectacle.
- **Subtle:** Movement is small (opacity, translate `4px–8px`, scale `0.98`).
- **Respect Reduced Motion:** If `prefers-reduced-motion: reduce`, disable all non-essential animations.

### 8.2 Standard Transitions

| Element | Property | Duration | Easing |
|---------|----------|----------|--------|
| Background color | `background-color` | 150ms | `ease-out` |
| Border color | `border-color` | 150ms | `ease-out` |
| Text color | `color` | 150ms | `ease-out` |
| Opacity | `opacity` | 150ms | `ease-out` |
| Transform | `transform` | 200ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Height | `height/max-height` | 250ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Width (sidebar) | `width` | 200ms | `ease-in-out` |

### 8.3 Entrance Animations

- **Modal/Dialog:** Backdrop `opacity 0→1` (150ms). Panel `scale 0.95→1` + `opacity 0→1` (200ms, `ease-out`).
- **Drawer:** Slide from edge `translateX(100%)→0` (300ms, `cubic-bezier(0.16, 1, 0.3, 1)`).
- **Toast:** Slide from right `translateX(100%)→0` + fade (300ms).
- **Dropdown:** `scale 0.95→1` origin-top, `opacity 0→1` (150ms).
- **Page Content:** Optional `opacity 0→1` + `translateY(8px)→0` on route change (200ms).

### 8.4 Exit Animations

- Reverse of entrance, slightly faster (`150ms`).
- Elements removed from DOM only after animation completes.

### 8.5 Micro-interactions

- **Button Press:** `scale(0.98)` on active, 100ms.
- **Checkbox Check:** SVG path draw animation (150ms).
- **Toggle Switch:** Thumb `translateX` with spring feel.
- **Row Hover:** Background color fade 100ms.
- **Sort Column:** Arrow rotation + brief highlight flash on header.
- **Loading Spinner:** Continuous rotation `1s linear infinite`.
- **Skeleton:** Shimmer `translateX(-100%)→translateX(100%)` over `1.5s`, infinite.

### 8.6 Feedback Patterns

| Action | Feedback |
|--------|----------|
| Save success | Toast: "Saved successfully" + green check. Button briefly shows checkmark. |
| Save error | Toast: "Failed to save" + red icon. Inline errors on fields. |
| Delete | Confirmation modal. On confirm: Row fades out (300ms) then removed. |
| Bulk action | Toast: "X records updated". Progress bar for large batches. |
| Search | Debounce `300ms`. Loading spinner in input. Results count shown. |
| Filter change | Table updates with fade. URL params update. |
| Navigation | Sidebar item activates instantly. Content loads with skeleton. |

---

## 9. Responsive Design

### 9.1 Breakpoints

| Token | Width | Target |
|-------|-------|--------|
| `sm` | 640px | Large phones |
| `md` | 768px | Tablets portrait |
| `lg` | 1024px | Tablets landscape / small laptops |
| `xl` | 1280px | Desktops |
| `2xl` | 1536px | Large monitors |

### 9.2 Layout Adaptations

#### Desktop (≥1024px)

- Sidebar: Persistent, expanded or collapsed.
- Content: Full grid, multi-column layouts.
- Tables: Full feature set, all columns visible.
- Modals: Centered, multiple sizes.

#### Tablet (768px–1023px)

- Sidebar: Collapsed icon-only or hidden (toggle to overlay).
- Content: 2-column grids collapse to 1 or 2.
- Tables: Horizontal scroll or column reduction. Sticky first column.
- Filters: Collapse into "Filters" button opening drawer.

#### Mobile (<768px)

- Sidebar: Hidden. Hamburger opens overlay drawer.
- Top Bar: Simplified. Search icon opens full-screen search.
- Content: Single column.
- Tables: Convert to card list or horizontal scroll.
- Modals: Full-screen sheets from bottom.
- FAB: Floating action button for primary create action.
- Bottom Navigation: Optional (rare in ERP, but useful for field workflows).

### 9.3 Touch Targets

- Minimum `44px × 44px` for all interactive elements on touch devices.
- Increase inline action button sizes on mobile.
- Row actions become swipeable or move to detail view.

### 9.4 Typography Scaling

- Base font remains `14px` across all breakpoints.
- Headings may reduce one step on mobile (`text-2xl` → `text-xl` for page titles).
- Line lengths: Max `65ch` always, but container width adapts.

### 9.5 Density Modes (Cross-Breakpoint)

Users can select density independently of device:

| Mode | Spacing | Font Size | Table Row Height |
|------|---------|-----------|------------------|
| Spacious | `32px` gaps | `16px` base | `56px` |
| Comfortable | `24px` gaps | `14px` base | `48px` |
| Compact | `16px` gaps | `13px` base | `40px` |

---

## 10. Accessibility

### 10.1 Color Contrast

- All text meets WCAG 2.1 AA:
  - Normal text: Minimum `4.5:1` against background.
  - Large text (18px+ bold): Minimum `3:1`.
- Never rely on color alone for status. Pair with icon or text.
- `text-success` + `text-error` are not used as the only indicators.

### 10.2 Keyboard Navigation

- **Tab order:** Logical, top-to-bottom, left-to-right.
- **Focus indicators:** Visible `ring-2 ring-accent-400` on all interactive elements.
- **Shortcuts:** Documented `?` help modal. Common shortcuts:
  - `⌘K` or `Ctrl+K`: Global search
  - `⌘/` or `Ctrl+/`: Keyboard shortcuts help
  - `Esc`: Close modal/dropdown/drawer
  - `Enter`: Activate primary action
  - `Space`: Toggle checkbox/expand accordion
  - Arrow keys: Navigate lists, tables, dropdowns, steppers
  - `Shift + Click`: Range select in tables

### 10.3 Screen Readers

- **Landmarks:** `<main>`, `<nav>`, `<aside>`, `<header>` used semantically.
- **ARIA:**
  - `aria-label` on icon-only buttons.
  - `aria-expanded` on collapsible sections.
  - `aria-selected` on tabs and list items.
  - `aria-describedby` linking inputs to error messages.
  - `aria-live="polite"` for toast notifications.
  - `role="alert"` for inline errors.
- **Alt text:** All meaningful images. Decorative images: `alt=""`.

### 10.4 Motion & Vestibular

- Respect `prefers-reduced-motion: reduce`.
- Disable parallax, auto-playing carousels, and non-essential transitions.
- Keep essential state-change animations (opacity) subtle.

### 10.5 Forms Accessibility

- Every input has an associated `<label>` (visually hidden allowed but must exist in DOM).
- Error messages linked via `aria-describedby`.
- Required fields marked with `aria-required="true"` and visual indicator (`*` with explanation).
- `autocomplete` attributes on common fields (name, email, address).

---

## 11. Dark Mode Strategy

### 11.1 Implementation Approach

- **Class-based:** `dark` class on `<html>` or `<body>`. Tailwind approach: `darkMode: 'class'`.
- **No automatic OS detection by default** in ERP (users often want control), but available as option.
- **Persistence:** Save preference to `localStorage` + user profile backend.
- **System override:** Optional toggle in user menu + Settings page.
- **Transition:** When toggling, apply `transition-colors duration-300` to `<body>` for smooth theme switch.

### 11.2 Color Inversion Rules

| Light Token | Dark Token | Rule |
|-------------|------------|------|
| `bg-base` | `neutral-0` (dark) | Deepest color becomes surface |
| `bg-surface` | `neutral-50` (dark) | Elevated surfaces flip |
| `text-primary` | `neutral-900` (dark) | Text stays high contrast but may shift slightly |
| `border-default` | `neutral-50` (dark) | Borders become subtler |
| `shadow-*` | Dark shadows | Increase opacity for visibility |

### 11.3 Image Handling

- Icons: Use currentColor SVGs (automatically adapt).
- Illustrations: Provide dark variants or use `opacity-80` filter on light illustrations.
- Charts: Library must support theme-aware palettes (using semantic tokens).

### 11.4 Specific Dark Adjustments

- **Code/Monospace blocks:** `bg-neutral-0`, `text-neutral-900`, subtle border.
- **Selected rows:** Use semi-transparent accent tint (`accent-900` @ 20%) instead of light tint.
- **Backdrop overlays:** Slightly darker in dark mode for contrast.

---

## 12. ERP-Specific Patterns

### 12.1 Data Density

ERP users often need to see maximum data. Provide density controls:

- **Table density toggle:** Comfortable / Compact / Spacious.
- **Column resize:** Drag headers to adjust width.
- **Column freeze:** Pin first N columns while scrolling horizontally.
- **Row height:** Adjustable per user preference.
- **Font scaling:** Accessibility option for `text-sm` vs `text-base` in tables.

### 12.2 Bulk Actions

- **Selection model:** Checkbox per row + header checkbox for "select all visible" / "select all matching".
- **Action bar:** Appears at top of table (or bottom) when rows selected.
  - Background: `bg-neutral-800` (light), `bg-neutral-100` (dark), `radius-lg`.
  - Content: "X selected" + primary actions + "Select all X records" link + Clear.
- **Actions:** Export, Delete, Update status, Assign, Merge, Archive.
- **Confirmations:** Bulk destructive actions require confirmation modal with count.

### 12.3 Inline Editing

- **Trigger:** Click or double-click editable cell.
- **Cell becomes:** Input, select, or date picker depending on field type.
- **Save:** On blur or `Enter`. `Escape` cancels.
- **Validation:** Inline error tooltip if invalid.
- **Indication:** Editable cells have subtle dotted bottom border `border-dashed border-tertiary` on hover.
- **Batch save:** Optional "Save all changes" button if multiple edits pending.

### 12.4 Advanced Filtering

- **Quick filters:** Top bar chips (status, date range, assignee).
- **Filter builder:** Popover or drawer with field/operator/value.
- **Operators by type:**
  - Text: `is`, `is not`, `contains`, `starts with`, `ends with`, `is empty`.
  - Number: `=`, `≠`, `>`, `<`, `between`.
  - Date: `is`, `before`, `after`, `between`, `relative` (today, this week, etc.).
  - Select: `is any of`, `is none of`.
- **Saved filters:** Named filter sets that user can save and re-apply.
- **URL sync:** Active filters reflected in URL query params for shareability.

### 12.5 Export / Import

- **Export button:** Dropdown with format options (CSV, Excel, PDF).
- **Export scope:** Current view (filtered + sorted) or all records.
- **Progress:** Toast with progress bar for large datasets.
- **Import:** Dropzone → Column mapping → Validation preview → Confirm.
- **Templates:** Download blank template for import.

### 12.6 Audit Trail / History

- **Timeline component:** Vertical line with event nodes.
- **Event types:** Created, Updated (field-level diff), Deleted, Status change, Comment.
- **Actor:** Avatar + name + timestamp.
- **Diff view:** Before/after for field changes. Highlighted additions (green) and removals (red).

### 12.7 Multi-Tenancy / Workspace Switcher

- **Workspace selector:** Top bar dropdown or sidebar section.
- **Display:** Workspace name + avatar/icon.
- **Actions:** Switch workspace, Create workspace (if permitted), Workspace settings.
- **Isolation:** Clear visual indicator when in different workspace context.

### 12.8 Permission States

- **Read-only view:** Disable all edit controls. Show "Read-only" badge.
- **Partial access:** Hide unauthorized actions entirely (preferred) or disable with tooltip "You don't have permission".
- **Field-level:** Mask sensitive fields (show `••••••` with reveal button for authorized users).

### 12.9 Workflow & Status

- **Status badge:** Color-coded. Transitions controlled by workflow.
- **Action buttons:** Contextual based on current status. E.g., "Approve", "Reject", "Submit for Review".
- **Workflow diagram:** Visual stepper showing current position in process.
- **Assignments:** User avatars showing who is responsible at each stage.

### 12.10 Address & Contact Form Pattern

Standardized multi-field block used across ERP modules (customers, vendors, employees, shipping):

- **Layout:** 2-column grid on desktop, stacked on mobile.
- **Fields:**
  - Street Address (textarea, 2 lines)
  - City / Town (input)
  - State / Province / Region (select or input)
  - Postal / ZIP Code (input)
  - Country (searchable select with flag icons)
- **Validation:** Country change updates required fields and validation rules.
- **Geocoding:** Optional map pin preview if geolocation enabled.
- **Copy:** "Same as billing" / "Same as shipping" toggle to duplicate block.

### 12.11 Price Break / Tiered Pricing Table

Used in products, quotes, contracts:

- **Table:** Quantity From | Quantity To | Unit Price | Discount % | Actions.
- **Add Tier:** Button adds row at bottom.
- **Validation:** Ranges must not overlap. Gaps allowed if "no price" behavior defined.
- **Visual:** Overlapping ranges highlighted in `error-50`.

### 12.12 Line Items / Order Entry Grid

The most data-dense ERP pattern:

- **Table:** # | Product | Description | Qty | UOM | Unit Price | Discount | Tax | Total | Actions.
- **Product Search:** Combobox with SKU, name, thumbnail.
- **Auto-calculate:** Total updates on qty/price/discount change.
- **Add Line:** Bottom row or "+ Add Line" button.
- **Drag:** Rows reorderable via drag handle.
- **Totals Panel:** Right or bottom, sticky. Subtotal, tax breakdown, total.

### 12.13 Approval Queue / Inbox

- **Layout:** Split pane. Left: request list with status/summary. Right: detail view.
- **List:** Requester | Type | Amount | Status | Date.
- **Detail:** Full record preview + Approve / Reject / Request Changes buttons.
- **Bulk:** Select multiple in list → bulk approve/reject.
- **Delegation:** "Delegate to" dropdown if approver unavailable.

---

## 13. Implementation Notes

### 13.1 Technology Recommendations

This design system is implemented with **Angular 19 standalone + SCSS** in this project. The canonical spec below is framework-agnostic, but the actual codebase uses:

- **Framework:** Angular 19 (standalone components, no NgModules, bootstrap via `bootstrapApplication`).
- **Styling:** SCSS with CSS custom properties (design tokens). No Tailwind CSS.
- **Component Primitives:** Custom Angular components in `src/app/shared/luna/` — not Radix UI.
- **Animation:** CSS transitions and keyframes. No Framer Motion.
- **Icons:** FontAwesome (`fas` classes). No Lucide.
- **Charts:** To be determined (must use semantic tokens for theming).

> **Component Inventory Note:** `DESIGN.md` specifies ~50 components. Only the following are **currently implemented** in `src/app/shared/luna/`: `luna-button`, `luna-card`, `luna-badge`, `luna-data-table`, `luna-modal`, `luna-empty-state`, `luna-action-icon`. All other components in §6 are **aspirational** — do not build them unless explicitly requested. Reuse existing shared components or native HTML patterns instead.

### 13.2 Token Architecture

```
primitives/
  colors/
    neutral, accent, success, warning, error, info
  typography/
    font-family, font-size, font-weight, line-height, letter-spacing
  spacing/
    space-scale
  radii/
    radius-scale
  shadows/
    shadow-scale

semantic/
  backgrounds/
    bg-base, bg-elevated, bg-surface, bg-overlay, bg-hover, bg-active, bg-selected
  text/
    text-primary, text-secondary, text-tertiary, text-inverse, text-accent, text-disabled, text-error, text-success
  borders/
    border-default, border-subtle, border-strong, border-accent, border-error, border-focus

components/
  button/
    primary, secondary, tertiary, destructive, link (sizes: sm, md, lg)
  input/
    text, textarea, select (states: default, focus, error, disabled)
  card/
    default, stat, list, media
  table/
    container, header, row, cell, pagination
  modal/
    overlay, panel, header, body, footer
```

### 13.3 File Structure Suggestion

```
src/
├── design-system/
│   ├── tokens/
│   │   ├── colors.ts
│   │   ├── typography.ts
│   │   ├── spacing.ts
│   │   └── shadows.ts
│   ├── components/
│   │   ├── Button/
│   │   ├── Input/
│   │   ├── Card/
│   │   ├── Table/
│   │   ├── Modal/
│   │   ├── Sidebar/
│   │   ├── TopBar/
│   │   ├── Badge/
│   │   ├── Toast/
│   │   ├── Tabs/
│   │   ├── Dropdown/
│   │   ├── Tooltip/
│   │   ├── Skeleton/
│   │   ├── EmptyState/
│   │   ├── Stepper/
│   │   ├── DatePicker/
│   │   ├── Search/
│   │   ├── Filter/
│   │   ├── Avatar/
│   │   ├── Breadcrumb/
│   │   ├── Pagination/
│   │   ├── Progress/
│   │   ├── Accordion/
│   │   ├── FAB/
│   │   ├── CommandPalette/
│   │   ├── RichTextEditor/
│   │   ├── NumberStepper/
│   │   ├── Slider/
│   │   ├── ColorPicker/
│   │   ├── CurrencyInput/
│   │   ├── PhoneInput/
│   │   ├── MultiSelect/
│   │   ├── Tree/
│   │   ├── Kanban/
│   │   ├── Calendar/
│   │   ├── ChatPanel/
│   │   ├── NotificationCenter/
│   │   ├── EntityLookup/
│   │   ├── ContextMenu/
│   │   ├── TableFooterAgg/
│   │   ├── CommentThread/
│   │   ├── TaskMonitor/
│   │   ├── DocumentViewer/
│   │   ├── SplitPane/
│   │   ├── StickySummaryBar/
│   │   ├── DuplicateDialog/
│   │   ├── MasterDetail/
│   │   ├── ReorderableList/
│   │   ├── DataGridCell/
│   │   └── Wizard/
│   ├── layouts/
│   │   ├── AppShell/
│   │   ├── DashboardLayout/
│   │   ├── ListLayout/
│   │   ├── DetailLayout/
│   │   ├── FormLayout/
│   │   ├── AuthLayout/
│   │   ├── ReportLayout/
│   │   ├── AdminLayout/
│   │   └── MasterDetailLayout/
│   └── hooks/
│       ├── useTheme.ts
│       ├── useMediaQuery.ts
│       ├── useKeyboardShortcut.ts
│       └── useFocusTrap.ts
```

### 13.4 Do's and Don'ts

| Do | Don't |
|----|-------|
| Use tokens for every visual value | Hardcode colors or sizes |
| Keep animations under 300ms | Use long, decorative animations |
| Provide immediate visual feedback for actions | Leave users guessing if something worked |
| Hide disabled actions user can't access | Show grayed-out buttons with no explanation |
| Use consistent icon sizes (16px, 20px, 24px) | Mix arbitrary icon sizes |
| Support full keyboard workflows | Require mouse for basic operations |
| Test dark mode with real data | Assume light mode is sufficient |
| Show loading states for >200ms operations | Show empty white space while loading |
| Debounce search inputs (300ms) | Search on every keystroke without delay |
| Use sentence case everywhere | Use Title Case For Labels |
| Keep modals focused on single decision | Put entire forms in small modals |
| Responsive first, then add density controls | Assume desktop-only usage |

---

## Appendix A: Quick Reference Cheatsheet

### Colors
- **Primary text:** `text-primary` (`#101828` light / `#FFFFFF` dark)
- **Secondary text:** `text-secondary` (`#667085` light / `#8A8CA8` dark)
- **Accent:** `accent-600` (`#4F46E5` light / `#A5B4FC` dark)
- **Surface:** `bg-surface` (`#F1F3F6` light / `#1A1A25` dark)
- **Border:** `border-default` (`#E4E7EC` light / `#242433` dark)

### Typography
- **Body:** `text-base` (14px), weight 400, `text-primary`
- **Heading:** `text-2xl` (24px), weight 600, `text-primary`
- **Label:** `text-xs` (12px), weight 500, `text-secondary`
- **Data:** `text-sm` (13px), monospace, tabular nums

### Spacing
- **Card padding:** `24px`
- **Section gap:** `24px`
- **Inline gap:** `16px`
- **Tight gap:** `8px`

### Border Radius
- **Buttons/Inputs:** `6px` (`radius-sm` legacy) / `8px` (`radius-md`)
- **Cards/Modals:** `14px` (`radius-xl`)
- **Pills/Badges:** `20px` (`radius-pill`) / `9999px` (`radius-full`)

### Shadows
- **Card:** `shadow-sm` (`0 1px 4px rgba(0,0,0,0.07)`)
- **Dropdown:** `shadow-lg`
- **Modal:** `shadow-xl`

---

> **End of Document**
> 
> This design system is a living specification. Every new component must derive from these tokens and patterns. Consistency is not negotiable.
