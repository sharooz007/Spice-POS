# Spice POS Design System

## Design Thesis

Spice POS is a shop-floor operating system. The Reports page established the right product mood: dark, quiet, data-forward, and precise. Every screen should feel like the same tool: numbers are clear, panels are stable, controls are familiar, and visual emphasis is reserved for action, state, or money movement.

The interface should not feel like a marketing dashboard, a spreadsheet clone, or a decorative SaaS template. It should feel like a dependable counter terminal that owners and staff can use repeatedly under mixed shop lighting.

## Physical Scene

The app is used on a desktop at a retail counter or back-office desk, often during active billing, stock checks, and customer conversations. Ambient light may be uneven, attention is split, and speed matters. A restrained dark UI reduces glare, keeps totals legible, and makes active controls easier to find.

## Core Principles

1. Accuracy before decoration.
2. Preserve scan speed: totals, balances, stock, due amounts, and exceptions must stand out first.
3. One component vocabulary across all screens: same cards, buttons, tabs, modals, tables, inline forms, popovers, and messages.
4. Use color only for status, action, selected state, and data meaning.
5. Keep motion short and state-based. No page choreography.
6. Prefer inline/progressive forms for workflow continuity. Use modals only for interruption, detail inspection, or focused tasks.
7. Do not hide important panels when values are zero. Empty is still information.

## Visual Register

### Palette

Use a dark restrained product palette derived from Reports:

- `--bg-base`: near-black app background.
- `--bg-surface`: primary cards and panels.
- `--bg-elevated`: modals, popovers, focused overlays.
- `--bg-grouped`: table heads, sidebars, grouped sections.
- `--bg-fill`: inputs and inactive controls.
- `--ink-1`: primary text.
- `--ink-2`: secondary labels.
- `--ink-3`: captions and metadata.
- `--ink-4`: disabled text.
- `--accent`: selected tab, primary action, active data point.
- `--green`: collected, success, positive stock/balance.
- `--red`: void, due, destructive action, validation errors.
- `--amber`: warning, wholesale emphasis, pending state.
- `--purple`: card/payment secondary method.

No glassmorphism as a default. Blur is allowed only on modal/popover backdrops. Cards use a solid surface, one border, and a tight shadow. Avoid broad glowing shadows.

### Typography

Use the system sans stack everywhere. Use mono only for invoice numbers, dates when table-like, rupee values, quantities, and codes.

Type scale:

- Page title: 22px, 700.
- Section title: 15px, 600.
- Body/table: 13px.
- Caption: 12px.
- Badge/meta: 11px.
- KPI value: 24-26px mono, 700.

Uppercase is allowed only for short labels, table headers, badges, and section labels. Avoid long uppercase sentences.

### Shape

- Cards and panels: 14-16px radius.
- Inputs/buttons: 8-10px radius.
- Badges/pills: full radius.
- Modals: 16-20px radius.

No cards inside cards unless the inner element is a repeated list item or focused form block.

### Shadows and Borders

Use borders as the primary separator. Shadows are subtle depth hints only:

- Surface cards: border plus very small shadow.
- Elevated popovers/modals: stronger shadow, still controlled.
- Do not pair a 1px border with a wide decorative shadow.

## Layout System

### App Shell

The fixed bottom nav is part of the work surface. Every screen must reserve enough bottom space so content is never hidden behind it.

Bottom nav:

- Dark elevated surface.
- User pill on the left.
- Six tabs in the middle.
- Sign out on the right.
- Popovers open upward with fixed positioning, dark elevated surface, visible border, and selected row state.

### Page Structure

Standard screens use:

- Page wrapper: max width around 1000-1280px depending on density.
- Header: title + one-line context/action row.
- Primary workspace: cards/panels/tables with consistent gaps.
- Bottom breathing room: at least 112px when bottom nav is visible.

Billing screens can use full-height multi-panel layouts because speed matters more than centered page width.

### Tables

Tables should feel dense but readable:

- Dark grouped header.
- Sticky-looking but not actually sticky unless needed.
- Hover row background.
- Tabular numbers.
- Status badges instead of relying on color alone.
- Clickable rows must have cursor and keyboard-friendly affordance when possible.

### Charts

Charts support the same dark palette. Grid lines should be faint. Tooltips use elevated dark surfaces. Payment breakdown uses horizontal method bars because it reads better than a donut for collections.

## Components

### Cards

Cards are stable containers. They do not lift on hover unless they are explicitly clickable. Static report and form panels never move.

### Buttons

Primary buttons use accent. Secondary buttons use fill surface. Destructive buttons use red tinted surfaces. Button labels use verb + object where possible.

Every button must communicate disabled/loading state visually.

### Forms

Labels sit above inputs. Inputs share the same fill, border, focus ring, and radius. Inline forms use grouped surfaces and clear action rows.

### Modals

Modals use the same dark elevated surface as popovers:

- Fixed overlay with dark backdrop.
- Centered panel with border, radius, constrained height, and scroll.
- Header row with title and close action.
- Footer/action row where applicable.
- Destructive confirmation modals use red text/badges, not oversized red panels.

### Inline Messages

Success, warning, error, and info messages use tinted surfaces plus border. They should include specific text, not generic failure copy.

### Toasts

Toasts appear above the bottom nav, bottom-right, with dark elevated surface and semantic accent. They should not obscure primary controls.

## Screen Rules

### Login

Centered sign-in panel. Dark surface, compact brand mark, username/PIN fields, clear error state, loading submit state.

### Dashboard

Operational overview. KPI row, payment breakdown, quick actions, recent invoices, recent expenses. No decorative hero layout.

### Retail Billing

Three-panel counter layout. Product grid, bill table, payment panel. Strong active payment state, visible balance, stock warnings inline.

### Wholesale Billing

Three-panel order workflow. Bulk stock visibility, order builder, confirmed orders, party/payment panel. Credit/partial states must be explicit.

### Inventory Screens

Sidebars and detail panels use the same dark surfaces. Low-stock and adjustment states get badges. History tables stay dense.

### Packing

Pack and History tabs. Validation errors appear near the bulk-use summary. Commit action stays near the live total.

### Product Master and Price Menu

Editing must feel controlled: inline forms, compact tables, visible selected product, destructive confirmations.

### Label Printing

Preview and print controls should be calm and clear. Print status uses inline message treatment.

### Invoice History

Search filters first, results second, detail panel third. Voided invoices must remain visually distinct.

### Customers and Parties

Sidebar selection plus detail panel. Retail purchase history and wholesale payment history use the same table language.

### Purchase Entry and Expenses

Forms and history share one page. Grouped daily/monthly views use stable cards and table density.

### Reports

Reports remains the reference page: date presets, KPI grid, payment breakdown, revenue/expense chart, segmented report tabs, filter bar, and dense tables.

## Anti-Patterns

- Hiding important panels because values are zero.
- Light modals on dark screens.
- Decorative glass cards.
- Hover-lifting static information.
- Duplicate analytics cards when a KPI already carries the data.
- Wide soft shadows on bordered cards.
- Inconsistent success/error colors across screens.
- Content hidden under the bottom nav.
- Placeholder action buttons that do nothing.

## Implementation Direction

The app should implement this through shared CSS tokens and component classes first. Individual screens should only add layout-specific styling. Existing Tailwind utility classes should map back to the tokens so old screens inherit the system without one-off rewrites.
