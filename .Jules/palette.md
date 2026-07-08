## 2025-05-14 - [Tutorial Accessibility & Keyboard Navigation]
**Learning:** In a terminal-themed UI, users expect high keyboard interactivity. Custom modal-like components (like our spotlight tutorial) must strictly follow WAI-ARIA dialog patterns (role="dialog", aria-modal="true") and support standard keyboard shortcuts (Escape, Arrows) to feel "natural" rather than just a visual overlay.
**Action:** Always ensure modal overlays have a keyboard listener for navigation/closing and that progress indicators are interactive buttons with appropriate ARIA labels, not just decorative spans.

## 2025-05-14 - [Solana Bootstrap UX]
**Learning:** In non-custodial Solana applications, users often forget that every automated transaction requires a small SOL float for fees. SURFACING this requirement at the moment of activation (when they see their new wallet) prevents "silent" pipeline failures and support tickets.
**Action:** Identify critical on-chain requirements (like minimum floats) and include them as "Important" notices in the final step of setup wizards.

## 2025-05-14 - [Tutorial Accessibility & Keyboard Navigation]
**Learning:** In a terminal-themed UI, users expect high keyboard interactivity. Custom modal-like components (like our spotlight tutorial) must strictly follow WAI-ARIA dialog patterns (role="dialog", aria-modal="true") and support standard keyboard shortcuts (Escape, Arrows) to feel "natural" rather than just a visual overlay.
**Action:** Always ensure modal overlays have a keyboard listener for navigation/closing and that progress indicators are interactive buttons with appropriate ARIA labels, not just decorative spans.
