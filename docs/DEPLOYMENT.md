# Deployment notes

PuttClub Vision is a static site. The GitHub Pages workflow publishes the repository root and performs no npm install or build. Choose GitHub Actions as the Pages source. By default, the included workflow runs on pushes to `main` and on manual dispatch.

All application asset references and the service-worker scope are relative, so project pages at `https://OWNER.github.io/REPOSITORY/` are supported. Keep `index.html`, `manifest.webmanifest`, `service-worker.js`, `styles.css`, `src/` and `assets/` at the repository root. After changing cached files, bump `CACHE_NAME` in `service-worker.js` so installed copies replace the old shell.

The repository contains no user clips or project data. Never add them to git. Browser storage is keyed to the deployed site origin; data on `localhost`, a preview host and the GitHub Pages host are separate.
