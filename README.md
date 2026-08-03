# Luminate

A premium vanilla JS/HTML/CSS todo app with LocalStorage persistence, filters, edit modal, and a glassmorphism UI.

## Run locally

Serve the repo root over HTTP (ES modules require a server, not `file://`):

```bash
python3 -m http.server 8080
```

Open http://localhost:8080

## Features

- Add, edit, toggle, and delete tasks
- Filter: All / Active / Completed
- Persist tasks in LocalStorage (`luminate_tasks`)
- Validate stored data on load (corrupt or malicious records are ignored)
- Demo tasks seed only on first visit (when the storage key is missing)

## Tests

```bash
node --test tests/storage-validation.test.mjs
```

## Deploy

GitHub Actions deploys `index.html`, `main.js`, `storage.js`, and `style.css` to GitHub Pages on pushes to `main`.
