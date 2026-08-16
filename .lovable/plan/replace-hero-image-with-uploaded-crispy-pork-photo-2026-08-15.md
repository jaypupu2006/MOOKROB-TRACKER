# Replace hero image with uploaded crispy pork photo

Replace the current `src/assets/mookrob-hero.jpg` file with the uploaded user image while keeping the site functional.

## What gets changed

- Upload the uploaded image (`user-uploads://Dtbezn3nNUxytg04acy1YjAVR9ipWTNBkSNgmLvfxJ6See.jpg`) to the Lovable Assets CDN.
- Create `src/assets/mookrob-hero.jpg.asset.json` pointing to the CDN URL.
- Update `src/routes/index.tsx` to import the asset pointer instead of the binary file.
- Delete the old `src/assets/mookrob-hero.jpg` binary from the repository.
- Verify the home page still renders correctly and the new image appears in the hero section.

## Technical notes

- Keep the existing `width={1280} height={800}` on the `<img>` and the existing Thai alt text.
- The new image is 1280x800-compatible; the CDN asset pointer will expose a stable `/__l5e/assets-v1/.../mookrob-hero.jpg` URL.
- No UI redesign, no database changes, no route changes.

## Verification

- Run `bun run build` to confirm the import resolves and the build passes.
- Capture a screenshot of the home page to confirm the new hero image renders.
