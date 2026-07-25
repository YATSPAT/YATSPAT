## 2025-05-14 - [Tutorial Accessibility & Keyboard Navigation]
**Learning:** In a terminal-themed UI, users expect high keyboard interactivity. Custom modal-like components (like our spotlight tutorial) must strictly follow WAI-ARIA dialog patterns (role="dialog", aria-modal="true") and support standard keyboard shortcuts (Escape, Arrows) to feel "natural" rather than just a visual overlay.
**Action:** Always ensure modal overlays have a keyboard listener for navigation/closing and that progress indicators are interactive buttons with appropriate ARIA labels, not just decorative spans.

## 2025-05-15 - [Accessible Tabs & Unified Feedback]
**Learning:** In a high-utility dashboard, tabbed navigation must follow WAI-ARIA patterns (roles, keyboard arrow nav) to ensure screen reader users can filter views efficiently. Additionally, interactive feedback for copy actions should be unified; use `aria-live="polite"` on the container to ensure "Copied" status is announced, especially when the visual change is brief.
**Action:** Use a reusable WAI-ARIA tab pattern for all list filtering and ensure all clipboard interactions have a standard 1.2s "Copied" state with a live region.
