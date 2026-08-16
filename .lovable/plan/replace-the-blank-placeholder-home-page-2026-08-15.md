# Replace the blank placeholder home page

The preview isn't broken — the server responds normally with no errors. What you're seeing is the untouched starter placeholder image that ships with a new project, so the page looks empty.

Since no product direction was given, this plan replaces the placeholder with a real, polished starter home page you can then point in any direction.

## What gets built

A single-page home route at `/` with:

- A hero section: headline, supporting line, primary and secondary call-to-action buttons
- A three-item feature row explaining what the product does
- A closing call-to-action band
- A simple footer

Design direction: warm off-white canvas with deep ink text and a single saturated accent, generous spacing, large display headline paired with a clean body face. No default Inter/purple-gradient look.

## Technical notes

- Rewrite `src/routes/index.tsx`, removing the `data-lovable-blank-page-placeholder` markup
- Add real `head()` metadata on the index route: unique title, description, `og:title`, `og:description`
- Add the chosen font pair via a `<link>` in `src/routes/__root.tsx` head, and replace the placeholder root title/description
- Introduce the accent, canvas, and ink colors as semantic oklch tokens in `src/styles.css` — no hardcoded color utilities in components
- No backend, no new dependencies

## Next step

Tell me what the app is actually for (product, audience, tone) and I'll reshape this page around it.
