## 2024-07-07 - Improved form accessibility in rule builder
**Learning:** Found multiple form inputs (range sliders, text inputs for mint addresses) in `pages/index.tsx` relying solely on placeholder text or adjacent span tags without explicit `aria-label` or `<label>` `htmlFor` association, making them inaccessible to screen readers.
**Action:** Always verify that input fields have either a correctly associated `<label>` using `htmlFor`/`id` or an explicit `aria-label` attribute to describe their purpose. Do not rely exclusively on placeholders.

## 2025-05-14 - [Tutorial Accessibility & Keyboard Navigation]
**Learning:** In a terminal-themed UI, users expect high keyboard interactivity. Custom modal-like components (like our spotlight tutorial) must strictly follow WAI-ARIA dialog patterns (role="dialog", aria-modal="true") and support standard keyboard shortcuts (Escape, Arrows) to feel "natural" rather than just a visual overlay.
**Action:** Always ensure modal overlays have a keyboard listener for navigation/closing and that progress indicators are interactive buttons with appropriate ARIA labels, not just decorative spans.

## 2026-07-17 - [Custom Tabs WAI-ARIA Compliance & Dynamic Copy Announcement]
**Learning:** Custom interactive elements like filtering tabs require explicit `role="tablist"`, `role="tab"`, and `role="tabpanel"` structures paired with standard left/right arrow keyboard event listeners to be navigable by screen-reader and keyboard-only users. Additionally, dynamic updates like clipboard copy feedback must utilize `aria-live="polite"` containers so screen readers can announce state changes immediately.
**Action:** When building interactive tab headers or transient status feedback elements, always integrate full keyboard listeners with `e.preventDefault()`, programmatic focus, and live announcement zones.

## 2026-07-25 - [Dynamic Multi-field Form Accessibility & Custom Selectors]
**Learning:** Dynamic form fields generated in repeating rows/items must have distinct, index-aware descriptions via `aria-label` to provide screen readers context. Additionally, custom select segments (such as button lists for holder reach mode) must be structured using WAI-ARIA roles of `radiogroup` and `radio` with dynamic `aria-checked` attributes to let assistive technologies properly announce active options.
**Action:** Always inject rule-specific indices in the `aria-label` of dynamically listed elements and wrap styled button choices into semantic, fully compliant ARIA radiogroups.
