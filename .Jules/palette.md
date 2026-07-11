## 2025-05-14 - [Tutorial Accessibility & Keyboard Navigation]
**Learning:** In a terminal-themed UI, users expect high keyboard interactivity. Custom modal-like components (like our spotlight tutorial) must strictly follow WAI-ARIA dialog patterns (role="dialog", aria-modal="true") and support standard keyboard shortcuts (Escape, Arrows) to feel "natural" rather than just a visual overlay.
**Action:** Always ensure modal overlays have a keyboard listener for navigation/closing and that progress indicators are interactive buttons with appropriate ARIA labels, not just decorative spans.

## 2025-05-15 - [ARIA Feedback for Terminal Interactions]
**Learning:** In a UI dominated by monospaced text and minimal animations, screen reader users rely heavily on `aria-live` and explicit state labels. Actions like "Copy Contract" that change button text must be wrapped in `aria-live="polite"` regions and use dynamic `aria-label` updates to ensure the confirmation is perceived without visual focus.
**Action:** Implement `aria-live` regions for all ephemeral state changes (success/error/copied) and ensure icon-only social links in the header have unique, descriptive `aria-label` values.
