## 2024-07-07 - Improved form accessibility in rule builder
**Learning:** Found multiple form inputs (range sliders, text inputs for mint addresses) in `pages/index.tsx` relying solely on placeholder text or adjacent span tags without explicit `aria-label` or `<label>` `htmlFor` association, making them inaccessible to screen readers.
**Action:** Always verify that input fields have either a correctly associated `<label>` using `htmlFor`/`id` or an explicit `aria-label` attribute to describe their purpose. Do not rely exclusively on placeholders.

## 2025-05-14 - [Tutorial Accessibility & Keyboard Navigation]
**Learning:** In a terminal-themed UI, users expect high keyboard interactivity. Custom modal-like components (like our spotlight tutorial) must strictly follow WAI-ARIA dialog patterns (role="dialog", aria-modal="true") and support standard keyboard shortcuts (Escape, Arrows) to feel "natural" rather than just a visual overlay.
**Action:** Always ensure modal overlays have a keyboard listener for navigation/closing and that progress indicators are interactive buttons with appropriate ARIA labels, not just decorative spans.

<<<<<<< HEAD
## 2025-05-15 - [ARIA Feedback for Terminal Interactions]
**Learning:** In a UI dominated by monospaced text and minimal animations, screen reader users rely heavily on `aria-live` and explicit state labels. Actions like "Copy Contract" that change button text must be wrapped in `aria-live="polite"` regions and use dynamic `aria-label` updates to ensure the confirmation is perceived without visual focus.
**Action:** Implement `aria-live` regions for all ephemeral state changes (success/error/copied) and ensure icon-only social links in the header have unique, descriptive `aria-label` values.
=======
## 2026-07-17 - [Custom Tabs WAI-ARIA Compliance & Dynamic Copy Announcement]
**Learning:** Custom interactive elements like filtering tabs require explicit `role="tablist"`, `role="tab"`, and `role="tabpanel"` structures paired with standard left/right arrow keyboard event listeners to be navigable by screen-reader and keyboard-only users. Additionally, dynamic updates like clipboard copy feedback must utilize `aria-live="polite"` containers so screen readers can announce state changes immediately.
**Action:** When building interactive tab headers or transient status feedback elements, always integrate full keyboard listeners with `e.preventDefault()`, programmatic focus, and live announcement zones.
<<<<<<< HEAD

## 2026-07-19 - [Form Accessibility via HTML Label Association & Programmatic Aria Attributes]
**Learning:** For forms with both static and dynamic lists of inputs (like our custom rules), static fields must be tightly coupled to their visual labels using precise `id` and `htmlFor` properties to allow assistive technologies to identify and focus them seamlessly. Dynamic fields that lack visual label headers due to container spacing must use index-aware descriptive `aria-label`s to supply clear programmatic context.
**Action:** Always map inputs to corresponding labels or programmatically declare explicit `aria-label` descriptors containing the field context and item index.
=======
>>>>>>> origin/main
>>>>>>> origin/main
