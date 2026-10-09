/*
 * Local, experimental ball-following assist.
 *
 * No images are uploaded or sent anywhere. This deliberately small, dependency-
 * free heuristic looks for bright, low-saturation, locally contrasting pixels
 * near a user-marked seed point across a set of sampled frames. It is NOT a
 * production-grade golf-ball detector and does NOT compensate for camera motion.
 * A human must review and edit the suggested points.
 */

function waitForSeek(video, targetSeconds, timeoutMs = 3500) {
  return new Promise((resolve, reject) => {
    if (Math.abs(video.currentTime - targetSeconds) < 0.015 && video.readyState >= 2) {
      resolve();
      return;
    }
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    const onSeeked = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error("The browser could not decode this video frame.")); };
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    timer = setTimeout(() => { cleanup(); reject(new Error("Seeking this video took too long.")); }, timeoutMs);
    video.currentTime = targetSeconds;
  });
}

function toGray(imageData) {
  const rgba = imageData.data;
  const gray = new Uint8Array(imageData.width * imageData.height);
  for (let source = 0, target = 0; target < gray.length; source += 4, target += 1) {
    gray[target] = (rgba[source] * 77 + rgba[source + 1] * 150 + rgba[source + 2] * 29) >> 8;
  }
  return gray;
}

function detectBrightCandidate(imageData, previousGray, center, radius) {
  const { data, width, height } = imageData;
  const minX = center ? Math.max(3, Math.floor(center.x - radius)) : 3;
  const maxX = center ? Math.min(width - 4, Math.ceil(center.x + radius)) : width - 4;
  const minY = center ? Math.max(3, Math.floor(center.y - radius)) : 3;
  const maxY = center ? Math.min(height - 4, Math.ceil(center.y + radius)) : height - 4;
  const stride = width;
  const currentGray = toGray(imageData);
  let best = null;
  const windowRadius = Math.max(1, radius || Math.max(width, height));

  for (let y = minY; y <= maxY; y += 2) {
    for (let x = minX; x <= maxX; x += 2) {
      const index = y * width + x;
      const offset = index * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      const lum = currentGray[index];
      if (lum < 145 || maximum - minimum > 105) continue;

      const local = (
        currentGray[index - 2] + currentGray[index + 2] +
        currentGray[index - stride * 2] + currentGray[index + stride * 2]
      ) / 4;
      const contrast = lum - local;
      const movement = previousGray ? Math.abs(lum - previousGray[index]) : 0;
      if (contrast < 8 && movement < 12) continue;

      const distance = center ? Math.hypot(x - center.x, y - center.y) : 0;
      if (center && distance > radius) continue;
      const score = lum * 0.12 + Math.max(0, contrast) * 0.92 + movement * 0.32 - (distance / windowRadius) * 17;
      if (!best || score > best.score) {
        best = { x, y, score, gray: currentGray };
      }
    }
  }

  if (!best || best.score < 27) return { point: null, gray: currentGray };
  const confidence = Math.max(0.12, Math.min(0.96, (best.score - 20) / 70));
  return {
    point: { x: best.x, y: best.y, confidence },
    gray: currentGray,
  };
}

/**
 * Suggest a trajectory from the user-marked seed forward and backward in time.
 * Returned x/y coordinates are normalized to 0..1 so they remain valid at any
 * preview size. The project is left at its original playback position.
 */
export async function suggestBallPath(video, seed, onProgress = () => {}) {
  if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
    throw new Error("Wait for the clip to load before tracking.");
  }
  if (!seed || !Number.isFinite(seed.x) || !Number.isFinite(seed.y) || !Number.isFinite(seed.t)) {
    throw new Error("Tap the ball once to set a starting point.");
  }
  const originalTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
  const scale = Math.min(1, 640 / video.videoWidth);
  const width = Math.max(64, Math.round(video.videoWidth * scale));
  const height = Math.max(64, Math.round(video.videoHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("This browser could not create a local video-analysis canvas.");

  const sampleStep = Math.max(0.12, Math.min(0.20, 0.16));
  const maxFramesPerDirection = 24;
  const bounds = [
    Math.max(0, seed.t - sampleStep * maxFramesPerDirection),
    Math.min(video.duration, seed.t + sampleStep * maxFramesPerDirection),
  ];
  const sampleTimes = [];
  for (let time = bounds[0]; time < seed.t - sampleStep * 0.35; time += sampleStep) sampleTimes.push(time);
  sampleTimes.push(seed.t);
  for (let time = seed.t + sampleStep; time <= bounds[1] + 0.001; time += sampleStep) sampleTimes.push(Math.min(time, video.duration));
  const uniqueTimes = [...new Set(sampleTimes.map(time => Math.round(time * 1000) / 1000))].sort((a,b) => a-b);
  const seedIndex = uniqueTimes.reduce((nearest, time, index) => Math.abs(time - seed.t) < Math.abs(uniqueTimes[nearest] - seed.t) ? index : nearest, 0);
  const seedTime = uniqueTimes[seedIndex];
  const seedPoint = { t: seedTime, x: seed.x, y: seed.y, confidence: 1, source: "manual-seed" };
  const results = [seedPoint];
  let completed = 0;

  const readFrame = async time => {
    await waitForSeek(video, time);
    context.drawImage(video, 0, 0, width, height);
    return context.getImageData(0, 0, width, height);
  };

  try {
    let seedFrame = await readFrame(seedTime);
    const seedGray = toGray(seedFrame);
    const directions = [1, -1];
    for (const direction of directions) {
      let previousGray = seedGray;
      let anchor = { x: seed.x * width, y: seed.y * height };
      let anchorTime = seedTime;
      let previousPoint = { ...seedPoint, x: seed.x, y: seed.y };
      let previousPrevious = null;
      const indices = [];
      for (let index = seedIndex + direction; index >= 0 && index < uniqueTimes.length; index += direction) indices.push(index);

      for (const frameIndex of indices) {
        const time = uniqueTimes[frameIndex];
        const frame = await readFrame(time);
        const deltaTime = time - anchorTime;
        let predicted = { ...anchor };
        if (previousPrevious && Math.abs(previousPoint.t - previousPrevious.t) > 0.01) {
          const dt = previousPoint.t - previousPrevious.t;
          const ratio = deltaTime / dt;
          predicted = {
            x: anchor.x + (previousPoint.x - previousPrevious.x) * width * ratio,
            y: anchor.y + (previousPoint.y - previousPrevious.y) * height * ratio,
          };
        }
        const radius = Math.max(width * 0.18, 72);
        const detection = detectBrightCandidate(frame, previousGray, predicted, radius);
        if (detection.point) {
          const normalized = {
            t: time,
            x: detection.point.x / width,
            y: detection.point.y / height,
            confidence: detection.point.confidence,
            source: "local-vision-suggestion",
          };
          results.push(normalized);
          previousPrevious = previousPoint;
          previousPoint = normalized;
          anchor = { x: detection.point.x, y: detection.point.y };
        } else {
          // Keep scanning from the predicted location, but do not claim that a
          // point was observed where the detector returned no candidate.
          anchor = predicted;
        }
        anchorTime = time;
        previousGray = detection.gray;
        completed += 1;
        onProgress(completed / Math.max(1, uniqueTimes.length - 1));
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  } finally {
    try { await waitForSeek(video, originalTime); } catch { /* Preserve the analysis result if restoring playback fails. */ }
  }

  const ordered = results.sort((a,b) => a.t - b.t);
  const unique = ordered.filter((point, index) => index === 0 || Math.abs(point.t - ordered[index - 1].t) > 0.025);
  return {
    points: unique,
    confidence: unique.length > 1 ? unique.slice(1).reduce((sum, point) => sum + point.confidence, 0) / (unique.length - 1) : null,
    sampledFrames: completed + 1,
    limitation: "Experimental bright-object heuristic; no camera-motion compensation. Review every suggested point.",
  };
}
