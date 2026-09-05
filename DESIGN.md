# Design System

## Direction

Product UI for fast store operations. The visual language is quiet, precise, and system-like: tinted neutrals, disciplined spacing, minimal decoration, subtle depth only where it clarifies layering, and clear touch targets for phones.

## Color

All color is defined in `src/index.css` with OKLCH CSS variables.

- Backgrounds: `--bg-app`, `--bg-wash`
- Surfaces: `--surface-1`, `--surface-2`, `--surface-3`, `--surface-raised`
- Text: `--text-1`, `--text-2`, `--text-3`, `--text-inverse`
- Borders: `--border-subtle`, `--border`, `--border-strong`
- Accent: `--accent`, `--accent-hover`, `--accent-soft`, `--accent-border`
- Semantic states: `--success`, `--warning`, `--danger` plus matching soft backgrounds and borders

Accent is reserved for primary actions, current navigation, focus, and active selection. Success, warning, and danger are used only for state, validation, totals, and feedback.

## Surfaces

- App canvas: calm neutral wash, no decorative panels.
- Top bar: translucent raised surface with one subtle bottom border.
- Primary navigation: fixed floating bottom bar with frosted material, safe-area clearance, and large touch targets.
- Workspace: one primary raised surface per task area.
- Lists: `ui-list-surface` with rows separated by subtle dividers.
- Dialogs: raised modal/sheet with controlled shadow and restrained radius.

Avoid nested cards. Use rows, sections, dividers, and inline groups before adding another framed surface.

## Typography

System font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`.

- Page title: 1.55rem desktop, 1.22rem mobile, weight 720
- Section title: 1.08rem, weight 700
- Body/help text: .8125rem to .86rem
- Labels: .75rem to .78rem, weight 700
- Data/IMEI: `--font-mono`, tabular where useful

Letter spacing stays at `0` except small uppercase labels, where it is limited and functional.

## Spacing

Token scale:

- `--space-1`: 4px
- `--space-2`: 8px
- `--space-3`: 12px
- `--space-4`: 16px
- `--space-5`: 20px
- `--space-6`: 24px
- `--space-7`: 32px
- `--space-8`: 40px

Use 44px minimum for interactive controls and 48px on mobile form controls.

## Radius And Elevation

- `--radius-xs`: 5px
- `--radius-sm`: 7px
- `--radius-md`: 9px
- `--radius-lg`: 12px
- `--shadow-1`: default raised surface
- `--shadow-2`: toast/login panel
- `--shadow-3`: modal

Shadows are never decorative; use them to distinguish persistent chrome, dialogs, sticky bars, and transient feedback.

## Components

- Buttons: `saas-primary`, `saas-secondary`, `saas-ghost-button`, `saas-icon-button`
- Navigation: `MainNavigation` with `floating-navigation`, translucent `floating-navigation__surface`, `floating-navigation__liquid` active indicator, and `floating-navigation__item`
- Fields: `ui-field`, `ui-field-label`, inherited input/select/textarea rules
- Status: `ui-status` with `data-tone="success|warning|danger"` and optional `ui-spinner`
- Segmented navigation: `saas-segmented` with `data-active`
- Lists: `ui-list-surface`, `ui-list-row`
- Boleta selection rows: `sale-option` with `data-selected`
- Dialogs: `AccessibleDialog` using `saas-modal-backdrop` and `saas-detail-modal`
- Empty states: `saas-empty`
- Toasts: `app-toast`, `app-toast is-error`

Every interactive component needs default, hover, active, focus-visible, disabled, loading where applicable, and responsive behavior.

## Motion

- Fast interaction: `--duration-fast` 140ms
- Dialog/toast entrance: `--duration-med` 210ms
- Easing: `--ease-out` (`cubic-bezier(.16, 1, .3, 1)`)
- Bottom navigation indicator: 360ms liquid-glass settle, transform-only, with reduced-motion fallback

Motion is limited to opacity, transform, color, border, shadow, and background. Respect `prefers-reduced-motion`.

## Responsive Rules

Mobile keeps the primary workflow reachable:

- Primary navigation is always a floating bottom bar.
- Form controls grow to 48px high.
- Two-column forms collapse to one column.
- Primary action rows become sticky bottom bars above the floating navigation.
- Dialogs become bottom sheets.

Desktop keeps the same floating navigation language instead of switching hierarchy. The top bar is reserved for identity and account actions.

## Known Refactor Targets

- Continue replacing Tailwind-heavy repeated field markup with `ui-field`.
- Move repeated boleta rows, history rows, and status messages into React primitives once behavior is stable.
- Keep service calls, Firebase auth, Netlify functions, PDF generation, and validation logic out of visual refactors.
