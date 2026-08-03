# AGENTS.md

## Cursor Cloud specific instructions

### Product overview

**Luminate** is a client-only todo list app (HTML, CSS, vanilla JavaScript). There is no backend, build step, package manager, or test/lint tooling in this repository.

### Running the app (development)

Serve the repo root over HTTP (do not open `index.html` via `file://` — `localStorage` and script loading are unreliable that way):

```bash
cd /workspace
python3 -m http.server 8000
```

Then open **http://localhost:8000**.

Alternative static servers (`npx serve`, `php -S localhost:8000`) work equally well if available.

### Lint / test / build

This repo has no configured lint, test, or build commands. Verification is manual or browser-based:

1. Confirm `index.html`, `main.js`, and `style.css` return HTTP 200 from the dev server.
2. Exercise core flows in the browser: add/edit/delete/complete tasks, filters (All/Active/Completed), stats, and `localStorage` persistence after refresh.

### Optional external dependency

Google Fonts (Outfit) loads from `fonts.googleapis.com`. The app falls back to system fonts if the network is unavailable.

### Deployment

GitHub Actions workflow `.github/workflows/static.yml` deploys to GitHub Pages on push to `main`. Not required for local development.
