# Azhar: Η Φυλακή του Βεζίρη

A cinematic platformer for phones in the spirit of the 1989 Prince of Persia: careful steps, running jumps,
ledge climbing, traps and sword fights, against a 30-minute hourglass. Greek UI, touch controls, installable
on iPhone from Safari (Share → Add to Home Screen) and playable offline.

## Layout

- `azhar/` — the game source (`index.html` body + `js/`, `icons/`)
- `build.js` — builds the GitHub Pages site into `docs/` (full page, manifest, offline service worker)
- `docs/` — the published site (generated; do not edit by hand)
- `serve.js` — local dev server for `azhar/` on http://localhost:8766

## Work on it

```bash
node serve.js
```

## Publish

```bash
node build.js
```

Commit and push; GitHub Pages serves the `docs/` folder of the `main` branch.
