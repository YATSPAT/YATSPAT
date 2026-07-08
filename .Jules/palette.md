## 2025-05-14 - [Tutorial Accessibility & Keyboard Navigation]
**Learning:** In a terminal-themed UI, users expect high keyboard interactivity. Custom modal-like components (like our spotlight tutorial) must strictly follow WAI-ARIA dialog patterns (role="dialog", aria-modal="true") and support standard keyboard shortcuts (Escape, Arrows) to feel "natural" rather than just a visual overlay.
**Action:** Always ensure modal overlays have a keyboard listener for navigation/closing and that progress indicators are interactive buttons with appropriate ARIA labels, not just decorative spans.
