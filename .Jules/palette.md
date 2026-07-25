## 2025-05-14 - [Tutorial Accessibility & Keyboard Navigation]
**Learning:** In a terminal-themed UI, users expect high keyboard interactivity. Custom modal-like components (like our spotlight tutorial) must strictly follow WAI-ARIA dialog patterns (role="dialog", aria-modal="true") and support standard keyboard shortcuts (Escape, Arrows) to feel "natural" rather than just a visual overlay.
**Action:** Always ensure modal overlays have a keyboard listener for navigation/closing and that progress indicators are interactive buttons with appropriate ARIA labels, not just decorative spans.

## 2026-07-17 - [Custom Tabs WAI-ARIA Compliance & Dynamic Copy Announcement]
**Learning:** Custom interactive elements like filtering tabs require explicit `role="tablist"`, `role="tab"`, and `role="tabpanel"` structures paired with standard left/right arrow keyboard event listeners to be navigable by screen-reader and keyboard-only users. Additionally, dynamic updates like clipboard copy feedback must utilize `aria-live="polite"` containers so screen readers can announce state changes immediately.
**Action:** When building interactive tab headers or transient status feedback elements, always integrate full keyboard listeners with `e.preventDefault()`, programmatic focus, and live announcement zones.
