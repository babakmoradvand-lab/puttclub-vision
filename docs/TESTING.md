# Manual smoke test checklist

Run the static app over HTTP(S), preferably in a fresh browser profile.

- [ ] Default Farsi UI loads; toggle to English and back; language survives refresh.
- [ ] Import a small MP4/MOV/WebM clip; project appears and reloads after a refresh.
- [ ] Scrub, play/pause, and confirm the video remains on-device (network panel shows no project/video POST or third-party analytics requests).
- [ ] Turn on **Set ball start**, tap the ball, then try **Track ball**. Confirm the progress completes, the app returns to the clip position, and points remain editable. Try a clip with no obvious ball and confirm manual editing remains available.
- [ ] Add a manual point, drag it, undo, select/remove a point, change line color/width, and edit the optional distance label.
- [ ] Export project JSON and the source clip separately; inspect that JSON includes points/settings but not video bytes.
- [ ] In a browser that supports MediaRecorder/Canvas capture, render a disposable clip and verify the path overlay, progress, download, and absence of project/video network uploads; output intentionally has no audio.
- [ ] Restore a disposable project JSON backup; verify the path/settings return without a clip, then attach the matching local video.
- [ ] Rename and delete one project; confirm deletion. Test clear-all only with disposable local data.
- [ ] Install on an HTTPS origin, load once online, then restart offline and verify the app shell opens. Confirm IndexedDB remains available.
- [ ] Inspect browser storage and confirm project/video data is in IndexedDB for this origin.

## Automated checks

The app intentionally has no npm build dependencies. The static deploy workflow uploads the repository root to GitHub Pages. A syntax, HTML, HTTP smoke test is documented in the project handoff; actual phone playback, camera capture, iOS installation and offline behavior still require browser/device testing.
