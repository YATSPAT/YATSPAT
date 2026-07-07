## 2024-07-07 - Improved form accessibility in rule builder
**Learning:** Found multiple form inputs (range sliders, text inputs for mint addresses) in `pages/index.tsx` relying solely on placeholder text or adjacent span tags without explicit `aria-label` or `<label>` `htmlFor` association, making them inaccessible to screen readers.
**Action:** Always verify that input fields have either a correctly associated `<label>` using `htmlFor`/`id` or an explicit `aria-label` attribute to describe their purpose. Do not rely exclusively on placeholders.
