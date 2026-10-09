# PuttClub Vision

**A local-first golf-video path editor.** Import a clip, mark the ball, try an experimental local tracking suggestion, correct the path, and style the trace. It is an independent clean-room implementation based on public product-level feature descriptions—not SmoothSwing or Ace Trace source code, and not a claim about how either product works internally.

## Privacy / storage model

- Static files are hosted on GitHub Pages; there is no app backend, account or cloud-sync service.
- Imported videos, project records, seed points, trajectory coordinates and styles are kept in the browser's IndexedDB on the device/origin where the app is opened.
- Tracking frame analysis runs locally in the browser. The app does not transmit video, frames, points or project records to a server.
- Browser storage is not permanent. Clearing site data or browser storage can delete local projects. The app asks for persistent storage when supported, but the browser controls the decision.
- A project JSON export contains its editable path/settings; it does **not** bundle the original video. Export the original clip separately.
- Read [the privacy page](./privacy.html).

## Included workflow

- Import a video from device storage or invoke the browser's camera/file capture flow on supported devices.
- Local playback and timeline scrubbing.
- User-marked ball seed and an experimental bright-object tracking suggestion (manual correction remains essential).
- Add, drag, remove and undo path points; choose golf/free-curve mode, line color/width and optional distance label.
- Download project JSON and the original video separately; restore project JSON locally and reattach its original clip when available.
- On supported browsers, render a video-only trace locally at real-time speed (no audio is included).
- Farsi (default) and English interface; responsive layout; offline-cached PWA shell.

### Honest limitations

The tracker is a small, dependency-free brightness/contrast heuristic, not a validated ball detector; camera motion, blur, small/distant balls, shadows and bright backgrounds can cause errors. It does not estimate real-world distance from pixels. Where the browser supports Canvas capture and MediaRecorder, the app can render a trace over the clip locally in real time, but that output is experimental, video-only (no audio), and may be unsupported on some phones. Project JSON and the original clip remain separately exportable. The included sample is illustrative, not a measurement.

## Run locally

Use a local static server (ES modules, IndexedDB, and service workers need an HTTP origin):

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`. For install/offline tests, use `localhost` or HTTPS. The first online visit caches the static app shell. IndexedDB contents are scoped to the site origin.

## Publish on GitHub Pages

1. Create a repository and copy/push the contents of this folder to its `main` branch.
2. In repository **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
3. The included `.github/workflows/pages.yml` deploys the static site after a push to `main` (or via **Actions → Deploy PuttClub Vision to GitHub Pages → Run workflow**).
4. Open the Pages URL. A project-site URL such as `https://OWNER.github.io/REPOSITORY/` is supported because the app uses relative paths.
5. On a phone, open once while online, then use the browser's **Install app / Add to Home Screen** option. HTTPS/localhost is required for service workers and PWA installation. On iOS Safari, use **Share → Add to Home Screen**.

No runtime package install or build step is needed. The workflow publishes static files only; project data is not part of the repository and should never be committed.

## Project layout

```text
index.html                 PWA entry point
styles.css                 Responsive inline/offline CSS
manifest.webmanifest       Install metadata
service-worker.js          Static app-shell cache only
src/app.js                 UI and local project workflow
src/db.js                  IndexedDB CRUD and storage helpers
src/i18n.js                Farsi/English strings
src/tracker.js             Experimental local-only path suggestion
assets/                    App icon and illustrative sample frame
privacy.html               Current privacy and limitations notice
.github/workflows/pages.yml GitHub Pages deployment
```

## Clean-room note

PuttClub Vision uses only its own UI and implementation. Public App Store descriptions informed broad feature goals (manual/automatic trace workflows, styling, and exports); they do not disclose proprietary algorithms. No target app binary or test-video corpus was provided, and the tracker is not represented as a reproduction of another product's internals.
