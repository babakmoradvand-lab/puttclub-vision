import {
  getAllProjects,
  getProject,
  putProject,
  removeProject,
  clearProjects,
  makeProject,
  localStorageEstimate,
  requestPersistentStorage,
  formatBytes,
} from "./db.js";
import { getLanguage, t, toggleLanguage } from "./i18n.js";
import { suggestBallPath } from "./tracker.js";

const root = document.getElementById("root");
const dialogRoot = document.getElementById("dialog-root");
const videoInput = document.getElementById("video-file");
const cameraInput = document.getElementById("camera-file");
const attachInput = document.getElementById("attach-file");
const restoreInput = document.getElementById("restore-file");
const demoImage = new URL("../assets/fairway-demo.jpg", import.meta.url).href;

const state = {
  view: "projects",
  projects: [],
  activeProject: null,
  objectUrl: null,
  video: null,
  currentTime: 0,
  playing: false,
  editMode: false,
  addMode: false,
  seedMode: false,
  dragging: null,
  selectedPointId: null,
  undoStack: [],
  saveTimer: null,
  toastTimer: null,
  tracking: false,
  rendering: false,
  renderCancel: null,
  installPrompt: null,
  storageEstimate: { usage: null, quota: null },
  pointerMoved: false,
};

const icons = {
  grid: '<svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="4" width="7" height="7" rx="1.6" stroke="currentColor" stroke-width="1.6"/><rect x="13.5" y="4" width="7" height="7" rx="1.6" stroke="currentColor" stroke-width="1.6"/><rect x="3.5" y="14" width="7" height="7" rx="1.6" stroke="currentColor" stroke-width="1.6"/><rect x="13.5" y="14" width="7" height="7" rx="1.6" stroke="currentColor" stroke-width="1.6"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="14" rx="2.6" stroke="currentColor" stroke-width="1.6"/><path d="m10 9 5 3-5 3V9Z" fill="currentColor"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 19V5m0 14h17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="m7 15 3.2-4 3 2 5.8-7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/><path d="m19.4 15 .1.1a1.7 1.7 0 1 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 1 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 1 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2.9a1.7 1.7 0 1 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 1 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 1 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 15V4m0 0L8 8m4-4 4 4M5 14v5h14v-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.7c0-.8.9-1.3 1.6-.9l9.3 6.2a1.2 1.2 0 0 1 0 2l-9.3 6.2c-.7.5-1.6-.1-1.6-.9V5.7Z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5.5A1.5 1.5 0 0 1 8.5 4h1A1.5 1.5 0 0 1 11 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-1A1.5 1.5 0 0 1 7 18.5v-13ZM13 5.5A1.5 1.5 0 0 1 14.5 4h1A1.5 1.5 0 0 1 17 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-1a1.5 1.5 0 0 1-1.5-1.5v-13Z"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none"><path d="m15 18-6-6 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3 4 6v5c0 5 3.4 8.1 8 10 4.6-1.9 8-5 8-10V6l-8-3Z" stroke="currentColor" stroke-width="1.5"/><path d="m9 12 2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  wand: '<svg viewBox="0 0 24 24" fill="none"><path d="m15 4 1.1 3.9L20 9l-3.9 1.1L15 14l-1.1-3.9L10 9l3.9-1.1L15 4ZM6 13l.7 2.3L9 16l-2.3.7L6 19l-.7-2.3L3 16l2.3-.7L6 13ZM18.5 15l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6.6-1.9Z" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none"><path d="m14 5 5 5M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 18v2h14v-2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="14" rx="2.4" stroke="currentColor" stroke-width="1.5"/><path d="m8 6 1.5-2h5L16 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="13" r="3.4" stroke="currentColor" stroke-width="1.5"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/><path d="M12 11v5m0-8h.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none"><rect x="6.5" y="2.5" width="11" height="19" rx="2.2" stroke="currentColor" stroke-width="1.5"/><path d="M10 5h4m-2 13h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none"><path d="m5 12 4 4L19 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const h = name => icons[name] || "";
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
const tFmt = seconds => `${Math.floor((seconds || 0) / 60)}:${String(Math.floor((seconds || 0) % 60)).padStart(2,"0")}`;
const fmtDate = value => new Intl.DateTimeFormat(getLanguage() === "fa" ? "fa-IR" : undefined, { month:"short", day:"numeric" }).format(new Date(value || Date.now()));
const getViewName = view => ({ projects:t("projects"), studio:t("studio"), insights:t("insights"), settings:t("settings") }[view] || t("projects"));

function showToast(message) {
  const toast = document.getElementById("toast");
  document.getElementById("toast-message").textContent = message;
  toast.classList.add("visible");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("visible"), 3100);
}

function setDocumentLanguage() {
  const lang = getLanguage();
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
}

function appShell(content) {
  const nav = [
    ["projects", "grid"], ["studio", "video"], ["insights", "chart"], ["settings", "settings"],
  ];
  return `<div class="shell">
    <aside class="sidebar">
      <div class="brand" data-action="navigate" data-view="projects"><div class="logo-mark"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.7"/><path d="M12 4v8.5l5.8 3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg></div><div class="brand-copy"><div class="brand-name">PuttClub <span>Vision</span></div><div class="brand-tag">${t("tagline")}</div></div></div>
      <div class="sidebar-label">${t("projects")}</div>
      <nav class="nav">${nav.map(([view, icon]) => `<button class="nav-btn ${state.view===view?"active":""}" data-action="navigate" data-view="${view}">${h(icon)}<span>${getViewName(view)}</span></button>`).join("")}</nav>
      <div class="nav-spacer"></div>
      <div class="local-card"><div class="local-card-top"><i class="local-status"></i>${t("localOnly")}</div><p>${t("localNote")}</p></div>
      <div class="sidebar-foot">${h("shield")}<span>${t("noCloud")}</span></div>
    </aside>
    <main class="main">
      <header class="topbar"><div class="crumb"><span>PuttClub</span><i></i><strong>${getViewName(state.view)}</strong></div><div class="top-actions"><span class="local-badge"><i class="local-status"></i>${t("localOnly")}</span><button class="icon-btn" data-action="toggle-language" title="${t("language")}" aria-label="${t("language")}">${getLanguage()==="fa"?"EN":"فا"}</button>${state.installPrompt?`<button class="button secondary small" data-action="install">${h("download")}<span>${t("install")}</span></button>`:""}</div></header>
      <div class="main-inner" id="page-content">${content}</div>
    </main>
    <nav class="mobile-nav">${nav.map(([view, icon]) => `<button class="${state.view===view?"active":""}" data-action="navigate" data-view="${view}">${h(icon)}<span>${getViewName(view)}</span></button>`).join("")}</nav>
  </div>`;
}

function renderProjects() {
  const projects = state.projects;
  const tracked = projects.filter(project => project.trackingState === "suggested").length;
  const localUsage = state.storageEstimate.usage === null ? "—" : formatBytes(state.storageEstimate.usage);
  const cards = projects.map(project => `<article class="project-card">
    <div class="project-thumb"><img src="${demoImage}" alt="" loading="lazy"><span class="project-type">${project.trackingState === "suggested" ? t("trackingStatus") : t("studioTitle")}</span></div>
    <div class="project-body"><div class="project-title-row"><div class="project-title">${escapeHtml(project.name)}</div><button class="icon-btn" style="width:24px;height:24px" data-action="project-menu" data-id="${escapeHtml(project.id)}" aria-label="${t("more")}">${h("more")}</button></div><div class="project-meta">${escapeHtml(project.mediaName || t("demo"))} · ${fmtDate(project.updatedAt)}</div><div class="project-footer"><span>${project.points?.length || 0} ${t("addPoint")}</span><strong>${project.distance ? `${escapeHtml(project.distance)} ${escapeHtml(project.distanceUnit || "yd")}` : t("noDistance")}</strong></div><button class="button secondary small full" style="margin-top:9px" data-action="open-project" data-id="${escapeHtml(project.id)}">${t("open")} ${h("arrow")}</button></div>
  </article>`).join("");
  return `<section class="hero"><img class="hero-image" src="${demoImage}" alt="" fetchpriority="high"><div class="hero-copy"><div class="hero-pill"><i></i>${t("localOnly")} · ${t("offlineLabel")}</div><h1>${t("hello")}</h1><p>${t("welcome")}</p><div class="hero-actions"><button class="button primary" data-action="new-project">${h("upload")}<span>${t("importVideo")}</span></button><button class="button secondary" data-action="try-sample">${h("video")}<span>${t("trySample")}</span></button></div></div><div class="hero-note">${h("shield")} ${t("noCloud")}</div></section>
    <div class="stat-row"><div class="stat-card"><div class="stat-label">${t("projectCount")}<i class="stat-icon">${h("grid")}</i></div><div class="stat-value">${projects.length}<small>${t("allClips")}</small></div></div><div class="stat-card"><div class="stat-label">${t("tracked")}<i class="stat-icon">${h("chart")}</i></div><div class="stat-value">${tracked}<small>${t("trackingStatus")}</small></div></div><div class="stat-card"><div class="stat-label">${t("storage")}<i class="stat-icon">${h("phone")}</i></div><div class="stat-value" style="font-size:14px">${localUsage}<small>${t("noCloud")}</small></div></div></div>
    ${projects.length ? `<section><div class="section-head"><div><h2>${t("recent")}</h2><div class="section-description">${t("allClips")}</div></div><button class="text-btn" data-action="open-settings">${t("storage")} ${h("arrow")}</button></div><div class="project-grid">${cards}</div></section>` : `<section class="empty-state"><div class="empty-symbol">${h("video")}</div><h2>${t("emptyTitle")}</h2><p>${t("emptyText")}</p><div class="hero-actions" style="justify-content:center"><button class="button primary" data-action="new-project">${h("upload")}<span>${t("chooseClip")}</span></button><button class="button secondary" data-action="record-video">${h("camera")}<span>${t("cameraClip")}</span></button><button class="button ghost" data-action="try-sample">${t("trySample")}</button></div></section>`}
    <div class="privacy-strip">${h("shield")}<span>${t("localNote")}</span></div>`;
}

function smoothPath(points, viewHeight = 562) {
  if (!points || points.length < 2) return "";
  const scaled = points.slice().sort((a,b)=>(a.t||0)-(b.t||0)).map(point => ({ x: point.x * 1000, y: point.y * viewHeight }));
  let d = `M ${scaled[0].x} ${scaled[0].y}`;
  for (let i=1;i<scaled.length-1;i++) {
    const p=scaled[i], next=scaled[i+1];
    d += ` Q ${p.x} ${p.y} ${(p.x+next.x)/2} ${(p.y+next.y)/2}`;
  }
  const last=scaled[scaled.length-1];
  if (scaled.length===2) d += ` L ${last.x} ${last.y}`;
  else d += ` T ${last.x} ${last.y}`;
  return d;
}

function pointId() { return crypto.randomUUID ? crypto.randomUUID() : `pt_${Date.now()}_${Math.random().toString(36).slice(2)}`; }
function svgHeight(project) {
  const ratio = (project?.videoWidth && project?.videoHeight) ? project.videoHeight / project.videoWidth : 562/1000;
  return Math.max(340,Math.min(1050,Math.round(1000*ratio)));
}
function currentHint() {
  if (state.seedMode) return t("seedHelp");
  if (state.addMode) return t("addHelp");
  if (state.editMode) return t("dragHelp");
  if (state.activeProject?.demo) return t("samplePath");
  return "";
}

function renderStudio() {
  const project = state.activeProject;
  if (!project) return `<div class="page-head"><div><h1>${t("studioTitle")}</h1></div><button class="button primary" data-action="new-project">${h("plus")}${t("newTrace")}</button></div>`;
  const demo = Boolean(project.demo);
  const hasVideo = Boolean(project.mediaBlob && state.objectUrl);
  const missingClip = !demo && !hasVideo;
  const videoTag = demo
    ? `<img class="stage-media stage-img" src="${demoImage}" alt="${t("sampleDisclaimer")}">`
    : hasVideo
      ? `<video class="stage-media" id="player" src="${state.objectUrl}" playsinline preload="metadata" controlslist="nodownload noplaybackrate"></video>`
      : `<div class="stage-placeholder">${h("video")}<span>${t("missingClip")}</span></div>`;
  const viewHeight = svgHeight(project);
  const path = smoothPath(project.points || [], viewHeight);
  const color = project.style?.color || "#c6f36d";
  document.documentElement.style.setProperty("--trail", color);
  const seed = project.seed;
  const handles = (project.points || []).map((point,index) => state.editMode
    ? `<circle cx="${(point.x*1000).toFixed(1)}" cy="${(point.y*viewHeight).toFixed(1)}" r="${index===0||index===project.points.length-1?9:7}" class="path-handle" data-point-id="${escapeHtml(point.id)}" data-point-index="${index}" tabindex="0" role="slider" aria-label="Path point ${index+1}"/>`
    : index===0 || index===project.points.length-1
      ? `<circle cx="${(point.x*1000).toFixed(1)}" cy="${(point.y*viewHeight).toFixed(1)}" r="7" class="path-point"/>` : "").join("");
  const hint = missingClip ? t("missingClip") : currentHint();
  const autoStatus = project.trackingState === "suggested" ? t("trackingStatus") : state.tracking ? t("tracking") : demo ? t("sampleDisclaimer") : missingClip ? t("attachClip") : t("draft");
  const confidence = Number.isFinite(project.trackingConfidence) ? `${Math.round(project.trackingConfidence*100)}%` : "—";
  const ratio = (project.videoWidth && project.videoHeight) ? project.videoWidth/project.videoHeight : 16/9;
  return `<div class="studio-head"><div class="studio-title-wrap"><button class="back-btn" data-action="navigate" data-view="projects" aria-label="${t("back")}">${h("back")}</button><div style="min-width:0"><div class="studio-name">${escapeHtml(project.name || t("studioTitle"))}</div><div class="studio-state"><i class="saved-light"></i>${demo ? t("demo") : missingClip ? t("attachClip") : t("draft")} · ${escapeHtml(project.mediaName || "")}</div></div></div><div class="studio-actions">${missingClip?`<button class="button secondary small" data-action="attach-video">${h("video")}<span>${t("attachClip")}</span></button>`:""}<button class="button ghost small" data-action="undo" ${state.undoStack.length?"":"disabled"}>${t("undo")}</button><button class="button secondary small" data-action="rename">${t("renameAction")}</button><button class="button primary small" data-action="export">${h("download")}<span>${t("export")}</span></button></div></div>
  <div class="studio-layout">
    <div class="video-column">
      <section class="video-shell"><div class="video-stage" id="video-stage" style="--frame-aspect:${ratio}">
        ${videoTag}
        <div class="stage-top"><span class="stage-chip"><i></i>${escapeHtml(autoStatus)}</span><span class="stage-sample">${demo ? t("sampleDisclaimer") : escapeHtml(project.mediaName || "LOCAL CLIP")}</span></div>
        <svg class="path-svg" id="path-svg" viewBox="0 0 1000 ${viewHeight}" preserveAspectRatio="none" aria-label="Editable shot trajectory">
          <path class="path-glow" d="${path}" style="display:${path?"block":"none"};stroke:${color};stroke-width:${(project.style?.width||4)*3}px"/>
          <path class="path-line" d="${path}" style="display:${path?"block":"none"};stroke:${color};stroke-width:${project.style?.width||4}px;opacity:${project.style?.opacity??.96}"/>
          <path class="path-dots" d="${path}" style="display:${path?"block":"none"};stroke:${color}"/>
          ${handles}
          ${seed ? `<circle cx="${seed.x*1000}" cy="${seed.y*viewHeight}" r="13" fill="none" stroke="#fff" stroke-width="1.3" stroke-dasharray="3 3"/><circle cx="${seed.x*1000}" cy="${seed.y*viewHeight}" r="4.5" fill="#fff"/>` : ""}
        </svg>
        ${project.style?.showDistance && project.distance ? `<div class="path-label"><strong>${escapeHtml(project.distance)}</strong> ${escapeHtml(project.distanceUnit||"yd")}</div>` : ""}
        ${hint?`<div class="stage-hint">${escapeHtml(hint)}</div>`:""}
        <div class="stage-watermark">PuttClub Vision</div>
      </div><div class="video-controls"><div class="control-side"><button class="control-btn" data-action="step-back" aria-label="Back one tenth" ${demo||missingClip?"disabled":""}>‹</button><button class="control-btn" data-action="play" aria-label="${state.playing?t("pause"):t("play")}" ${demo||missingClip?"disabled":""}>${h(state.playing?"pause":"play")}</button><button class="control-btn" data-action="step-forward" aria-label="Forward one tenth" ${demo||missingClip?"disabled":""}>›</button><span class="time-readout" id="time-readout">${tFmt(state.currentTime)} / ${tFmt(project.duration||0)}</span></div><div class="control-side"><button class="control-btn ${state.editMode?"active":""}" data-action="toggle-edit" title="${t("refine")}">${h("edit")}</button><button class="control-btn" data-action="remove-point" title="${t("removePoint")}" ${state.selectedPointId?"":"disabled"}>${h("trash")}</button></div></div></section>
      <section class="timeline-card"><div class="timeline-head"><strong>${t("timeline")}</strong><span>${project.points?.length||0} ${t("addPoint")}</span></div><input class="timeline" id="scrubber" type="range" min="0" max="${Math.max(project.duration||0,1)}" step="0.03" value="${Math.min(state.currentTime,project.duration||0)}" ${demo||missingClip?"disabled":""} style="--progress:${project.duration?state.currentTime/project.duration*100:0}%" aria-label="${t("timeline")}"><div class="timeline-foot"><span>0:00</span><span>${tFmt(project.duration||0)}</span></div></section>
    </div>
    <aside class="inspector">
      <section class="inspector-card"><div class="inspector-head"><strong>${t("trackingStatus")}</strong><span class="${project.trackingState==="suggested"?"experimental-tag":"demo-tag"}">${project.trackingState==="suggested"?t("estimated"):demo?t("demo"):"LOCAL"}</span></div><div class="confidence-box"><div class="confidence-icon">${confidence}</div><div class="confidence-copy"><b>${project.trackingState==="suggested"?t("trackingStatus"):t("autoTrack")}</b><span>${project.points?.length||0} · ${t("addPoint")}</span></div></div>
        <div class="metrics"><div class="metric"><div class="metric-label">${t("distance")}</div><div class="metric-value">${project.distance||"—"}<small> ${escapeHtml(project.distanceUnit||"yd")}</small></div><div class="metric-note">${t("estimated")}</div></div><div class="metric"><div class="metric-label">${t("timeline")}</div><div class="metric-value">${Number(project.duration||0).toFixed(1)}<small> ${t("seconds")}</small></div><div class="metric-note">${t("fpsNote")}</div></div></div>
        <div class="progress ${state.tracking?"visible":""}" id="track-progress"><div class="progress-label"><span id="track-label">${t("tracking")}</span><span id="track-percent">0%</span></div><div class="progress-track"><div class="progress-fill" id="track-fill"></div></div></div>
        <div class="divider"></div><button class="button primary full" data-action="track-ball" ${state.tracking||demo||missingClip?"disabled":""}>${h("wand")}<span>${state.tracking?t("tracking"):t("autoTrack")}</span></button><div class="privacy-strip" style="margin-top:8px">${h("info")}<span>${t("trackingHelp")}</span></div>
        <div class="setting-row"><div class="setting-copy"><b>${t("setSeed")}</b><span>${t("seedHelp")}</span></div><button class="switch ${state.seedMode?"on":""}" data-action="seed-mode" aria-label="${t("setSeed")}" ${missingClip?"disabled":""}></button></div>
        <div class="setting-row"><div class="setting-copy"><b>${t("addPoint")}</b><span>${t("addHelp")}</span></div><button class="switch ${state.addMode?"on":""}" data-action="add-mode" aria-label="${t("addPoint")}" ${missingClip?"disabled":""}></button></div>
      </section>
      <section class="inspector-card"><div class="inspector-head"><strong>${t("traceStyle")}</strong></div><div class="mode-switch"><button class="mode-option ${project.mode==="golf"?"active":""}" data-action="set-mode" data-mode="golf">${t("golfMode")}</button><button class="mode-option ${project.mode==="curve"?"active":""}" data-action="set-mode" data-mode="curve">${t("curveMode")}</button></div>
        <div class="setting-row"><div class="setting-copy"><b>${t("showDistance")}</b><span>${project.distance||t("noDistance")}</span></div><button class="switch ${project.style?.showDistance?"on":""}" data-action="distance-toggle" aria-label="${t("showDistance")}"></button></div>
        <div class="divider"></div><div class="setting-copy"><b>${t("color")}</b><span></span></div><div class="colors">${["#c6f36d","#ff9e80","#8bdcff","#f4f0de"].map(color=>`<button class="color-swatch ${project.style?.color===color?"active":""}" style="background:${color}" data-action="set-color" data-color="${color}" aria-label="${color}"></button>`).join("")}</div>
        <div class="range-row"><span>${t("width")}</span><input type="range" min="2" max="9" step=".5" value="${project.style?.width||4}" data-action="width"><span>${project.style?.width||4}</span></div>
        <div class="divider"></div><div class="dialog-field"><label for="distance-field">${t("distance")}</label><input id="distance-field" type="number" min="0" max="9999" step=".1" value="${project.distance||""}" placeholder="—" data-field="distance"></div>
      </section>
      <div class="disclaimer">${h("info")}<span>${t("trackingHelp")}</span></div>
    </aside>
  </div>`;
}

function renderActivityBars() {
  const today=new Date();today.setHours(0,0,0,0);
  const days=Array.from({length:7},(_,index)=>{
    const date=new Date(today);date.setDate(today.getDate()-(6-index));
    const count=state.projects.filter(project=>{
      const savedAt=new Date(project.createdAt||project.updatedAt||Date.now());
      return savedAt.getFullYear()===date.getFullYear()&&savedAt.getMonth()===date.getMonth()&&savedAt.getDate()===date.getDate();
    }).length;
    return {date,count};
  });
  const maximum=Math.max(1,...days.map(day=>day.count));
  return days.map(({date,count})=>{
    const height=count?Math.max(12,(count/maximum)*86):3;
    const label=new Intl.DateTimeFormat(getLanguage()==="fa"?"fa-IR":undefined,{weekday:"short"}).format(date);
    return `<div class="bar-wrap" title="${count} ${t("projects")}"><div class="bar" style="height:${height}%"></div><small>${escapeHtml(label)}</small></div>`;
  }).join("");
}

function renderInsights() {
  const count = state.projects.length;
  const totalPoints = state.projects.reduce((sum,project)=>sum+(project.points?.length||0),0);
  return `<div class="page-head"><div><div class="kicker">${t("appName")}</div><h1>${t("insights")}</h1><p class="lead">${t("insightsHelp")}</p></div></div><div class="stat-row"><div class="stat-card"><div class="stat-label">${t("projectCount")}<i class="stat-icon">${h("grid")}</i></div><div class="stat-value">${count}</div></div><div class="stat-card"><div class="stat-label">${t("addPoint")}<i class="stat-icon">${h("chart")}</i></div><div class="stat-value">${totalPoints}</div></div><div class="stat-card"><div class="stat-label">${t("storage")}<i class="stat-icon">${h("phone")}</i></div><div class="stat-value">${state.storageEstimate.usage===null?"—":formatBytes(state.storageEstimate.usage)}</div></div></div><div class="content-grid"><section class="panel"><div class="section-head"><div><h2>${t("recent")}</h2><div class="section-description">${t("allClips")}</div></div></div><div class="activity-bars">${renderActivityBars()}</div><p class="section-description" style="margin-top:10px">${t("insightsHelp")}</p></section><section class="panel"><div class="section-head"><div><h2>${t("allClips")}</h2><div class="section-description">${count} ${t("projects")}</div></div></div>${count?state.projects.slice(0,5).map(project=>`<div class="highlight-row"><div class="highlight-thumb"><img src="${demoImage}" alt=""></div><div class="highlight-info"><b>${escapeHtml(project.name)}</b><span>${fmtDate(project.updatedAt)} · ${project.points?.length||0}</span></div></div>`).join(""):`<p class="lead">${t("noProjects")}</p>`}</section></div>`;
}

async function renderSettings() {
  state.storageEstimate = await localStorageEstimate();
  const usage = state.storageEstimate.usage===null?"—":formatBytes(state.storageEstimate.usage);
  const quota = state.storageEstimate.quota===null?"—":formatBytes(state.storageEstimate.quota);
  const usedPercent = state.storageEstimate.usage && state.storageEstimate.quota ? Math.min(100,state.storageEstimate.usage/state.storageEstimate.quota*100) : 0;
  return `<div class="page-head"><div><div class="kicker">${t("appName")}</div><h1>${t("settings")}</h1><p class="lead">${t("privacy")}</p></div></div><div class="content-grid"><section class="panel"><div class="section-head"><div><h2>${t("privacy")}</h2><div class="section-description">${t("localOnly")}</div></div>${h("shield")}</div><div class="privacy-strip">${h("shield")}<span>${t("localNote")}</span></div><a href="./privacy.html" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;color:var(--lime);font-size:9px">${t("privacyPage")}</a><div class="setting-list"><div class="setting-item"><div><b>${t("storage")}</b><small>${usage} ${getLanguage()==="fa"?"استفاده‌شده":"used"} / ${quota}</small></div><button class="button secondary small" data-action="protect-storage">${t("askStorage")}</button></div><div class="setting-item"><div><b>${t("storageHelp")}</b><small>${t("noNetwork")}</small></div></div><div class="setting-item"><div><b>${t("install")}</b><small>${t("installHelp")} ${t("installIos")}</small></div><button class="button secondary small" data-action="install">${t("install")}</button></div><div class="setting-item"><div><b>${t("language")}</b><small>${getLanguage()==="fa"?"فارسی":"English"}</small></div><button class="button secondary small" data-action="toggle-language">${getLanguage()==="fa"?"English":"فارسی"}</button></div></div><div class="divider"></div><div class="section-description">${t("offlineFirst")}</div><div style="height:4px;border-radius:4px;background:rgba(255,255,255,.1);margin-top:8px;overflow:hidden"><div style="height:100%;width:${usedPercent}%;background:var(--lime)"></div></div></section><section class="panel"><div class="section-head"><div><h2>${t("export")}</h2><div class="section-description">${t("exportInfo")}</div></div></div><p class="lead" style="font-size:9px">${t("storageHelp")}</p><button class="button secondary full" data-action="export-all">${h("download")}<span>${t("exportJson")}</span></button><button class="button secondary full" style="margin-top:8px" data-action="restore-data">${h("upload")}<span>${t("restoreData")}</span></button><div class="dialog-note">${h("info")}<span>${t("restoreInfo")}</span></div><div class="divider"></div><div class="section-head"><div><h2>${t("delete")}</h2><div class="section-description">${t("clearAllConfirm")}</div></div></div><button class="button danger full" data-action="clear-all">${h("trash")}<span>${t("clearAll")}</span></button></section></div>`;
}

async function render() {
  setDocumentLanguage();
  if (state.view === "settings") {
    const content = await renderSettings();
    root.innerHTML = appShell(content);
    return;
  }
  const content = state.view === "studio" ? renderStudio() : state.view === "insights" ? renderInsights() : renderProjects();
  root.innerHTML = appShell(content);
  if (state.view === "studio" && state.activeProject && !state.activeProject.demo) bindVideoPlayer();
  updateTimelineDisplay();
}

async function refreshProjects() {
  state.projects = await getAllProjects();
  state.storageEstimate = await localStorageEstimate();
}

function revokeMediaUrl() {
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  state.objectUrl = null;
  state.video = null;
}

async function openProject(id) {
  const project = await getProject(id);
  if (!project) { showToast(t("noProjects")); return; }
  dialogRoot.innerHTML = "";
  revokeMediaUrl();
  state.activeProject = project;
  state.objectUrl = project.mediaBlob ? URL.createObjectURL(project.mediaBlob) : null;
  state.currentTime = 0;
  state.playing = false;
  state.editMode = false;
  state.addMode = false;
  state.seedMode = false;
  state.selectedPointId = null;
  state.undoStack = [];
  state.view = "studio";
  await render();
}

function openSample() {
  revokeMediaUrl();
  state.activeProject = {
    id: "sample-session",
    name: t("sampleProject"),
    mediaName: t("sampleDisclaimer"),
    mediaBlob: null,
    duration: 9.2,
    videoWidth: 1600,
    videoHeight: 900,
    demo: true,
    mode: "golf",
    distance: null,
    distanceUnit: "yd",
    style: { color:"#c6f36d", width:4, opacity:.96, showDistance:true },
    seed: null,
    trackingState: "sample",
    trackingConfidence: null,
    points: [
      { id:pointId(), t:0.2, x:.27, y:.78, confidence:1, source:"sample" },
      { id:pointId(), t:1.1, x:.41, y:.52, confidence:1, source:"sample" },
      { id:pointId(), t:2.4, x:.57, y:.32, confidence:1, source:"sample" },
      { id:pointId(), t:3.9, x:.72, y:.34, confidence:1, source:"sample" },
      { id:pointId(), t:5.8, x:.85, y:.52, confidence:1, source:"sample" },
    ],
  };
  state.currentTime = 3.4;
  state.view = "studio";
  state.editMode = true;
  state.addMode = false;
  state.seedMode = false;
  state.undoStack = [];
  render();
}

function sizeVideoStage(player) {
  const stage=document.getElementById("video-stage");
  if(!stage||!player?.videoWidth||!player?.videoHeight)return;
  const ratio=player.videoWidth/player.videoHeight;
  const maxHeight=Math.max(220,Math.min(window.innerHeight*.72,700));
  const availableWidth=stage.parentElement?.clientWidth||window.innerWidth;
  const width=Math.max(180,Math.min(availableWidth,maxHeight*ratio));
  stage.style.aspectRatio=`${player.videoWidth} / ${player.videoHeight}`;
  stage.style.width=`${width}px`;
  stage.style.marginInline="auto";
}

function bindVideoPlayer() {
  const player = document.getElementById("player");
  if (!player) return;
  state.video = player;
  player.addEventListener("loadedmetadata", async () => {
    if (Number.isFinite(player.duration) && player.duration > 0) {
      state.activeProject.duration = player.duration;
      state.activeProject.videoWidth = player.videoWidth;
      state.activeProject.videoHeight = player.videoHeight;
      sizeVideoStage(player);
      if (state.currentTime > 0 && state.currentTime < player.duration) player.currentTime = state.currentTime;
      else state.currentTime = 0;
      await persistActiveProject();
      updateTimelineDisplay();
    }
  }, { once:true });
  player.addEventListener("timeupdate", () => {
    state.currentTime = player.currentTime;
    updateTimelineDisplay();
  });
  player.addEventListener("play", () => { state.playing=true; updatePlayButton(); });
  player.addEventListener("pause", () => { state.playing=false; updatePlayButton(); });
  player.addEventListener("ended", () => { state.playing=false; updatePlayButton(); });
  player.addEventListener("error", () => showToast(t("trackingFailed")), { once:true });
}

function updatePlayButton() {
  const button = document.querySelector('[data-action="play"]');
  if (button) button.innerHTML = h(state.playing ? "pause" : "play");
}

function updateTimelineDisplay() {
  const project = state.activeProject;
  const scrubber = document.getElementById("scrubber");
  const readout = document.getElementById("time-readout");
  if (readout && project) readout.textContent = `${tFmt(state.currentTime)} / ${tFmt(project.duration||0)}`;
  if (scrubber && project) {
    const duration = Math.max(project.duration||0,1);
    scrubber.max = String(duration);
    scrubber.value = String(Math.min(state.currentTime,duration));
    scrubber.style.setProperty("--progress", `${(state.currentTime/duration)*100}%`);
  }
}

function saveUndoSnapshot() {
  if (!state.activeProject || state.activeProject.demo) return;
  state.undoStack.push(JSON.stringify(state.activeProject.points || []));
  if (state.undoStack.length > 15) state.undoStack.shift();
}

function scheduleSave() {
  if (!state.activeProject || state.activeProject.demo) return;
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => persistActiveProject(), 250);
}

async function persistActiveProject() {
  if (!state.activeProject || state.activeProject.demo) return;
  try {
    await putProject(state.activeProject);
    state.projects = await getAllProjects();
    const label = document.querySelector(".studio-state");
    if (label) label.innerHTML = `<i class="saved-light"></i>${escapeHtml(t("saved"))} · ${escapeHtml(state.activeProject.mediaName||"")}`;
  } catch (error) {
    showToast(error?.name === "QuotaExceededError" ? t("fileTooLarge") : t("saveFailed"));
  }
}

function setPointPath() {
  const project = state.activeProject;
  const svg = document.getElementById("path-svg");
  if (!project || !svg) return;
  const height = svgHeight(project);
  const path = smoothPath(project.points||[],height);
  svg.querySelectorAll(".path-glow,.path-line,.path-dots").forEach(element => element.setAttribute("d",path));
  const existing = new Map([...svg.querySelectorAll(".path-handle")].map(element=>[element.dataset.pointId,element]));
  if(state.editMode){
    project.points.forEach((point,index)=>{
      let element=existing.get(point.id);
      if(!element){
        element=document.createElementNS("http://www.w3.org/2000/svg","circle");
        element.setAttribute("class","path-handle");
        element.setAttribute("r",index===0||index===project.points.length-1?9:7);
        element.setAttribute("tabindex","0");
        element.setAttribute("role","slider");
        svg.appendChild(element);
      }
      element.dataset.pointId=point.id;
      element.setAttribute("cx",point.x*1000);
      element.setAttribute("cy",point.y*height);
      element.setAttribute("data-point-index",index);
      element.setAttribute("aria-label",`Path point ${index+1}`);
      existing.delete(point.id);
    });
    existing.forEach(element=>element.remove());
  }
  scheduleSave();
}

function startDrag(event) {
  const marker = event.target.closest("[data-point-id]");
  if (!marker || !state.editMode) return;
  event.preventDefault();
  state.dragging = marker.dataset.pointId;
  state.selectedPointId = marker.dataset.pointId;
  const removeButton=document.querySelector('[data-action="remove-point"]');
  if(removeButton)removeButton.disabled=false;
  saveUndoSnapshot();
  try { marker.setPointerCapture(event.pointerId); } catch { /* Browser may not expose pointer capture on SVG. */ }
}

function moveDrag(event) {
  if (!state.dragging || !state.activeProject) return;
  const svg = document.getElementById("path-svg");
  if (!svg) return;
  const rect=svg.getBoundingClientRect();
  const height=svgHeight(state.activeProject);
  const x=Math.max(.015,Math.min(.985,(event.clientX-rect.left)/rect.width));
  const y=Math.max(.015,Math.min(.985,(event.clientY-rect.top)/rect.height));
  const point=state.activeProject.points.find(item=>item.id===state.dragging);
  if (!point) return;
  point.x=x;point.y=y;
  setPointPath();
}

async function addProjectFromFile(file) {
  if (!file) return;
  const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|3gp|avi)$/i.test(file.name);
  if (!isVideo) { showToast(t("invalidVideo")); return; }
  try {
    const estimate = await localStorageEstimate();
    if (estimate.quota && estimate.usage != null && file.size > estimate.quota - estimate.usage) {
      showToast(t("fileTooLarge"));
      return;
    }
    const project = makeProject(file);
    await putProject(project,{storeMedia:true});
    await refreshProjects();
    showToast(t("saved"));
    await openProject(project.id);
  } catch (error) {
    showToast(error?.name === "QuotaExceededError" ? t("fileTooLarge") : t("saveFailed"));
  }
}

async function attachVideoToActiveProject(file) {
  const project=state.activeProject;
  if(!file||!project||project.demo)return;
  const isVideo=file.type.startsWith("video/")||/\.(mp4|mov|m4v|webm|3gp|avi)$/i.test(file.name);
  if(!isVideo){showToast(t("invalidVideo"));return;}
  try{
    const estimate=await localStorageEstimate();
    const replacingSize=project.mediaBlob?(project.mediaSize||0):0;
    const available=estimate.quota&&estimate.usage!=null?estimate.quota-estimate.usage+replacingSize:null;
    if(available!=null&&file.size>available){showToast(t("fileTooLarge"));return;}
    if(state.objectUrl)URL.revokeObjectURL(state.objectUrl);
    project.mediaBlob=file;
    project.mediaName=file.name||"local-video";
    project.mediaType=file.type||"video/mp4";
    project.mediaSize=file.size||0;
    project.duration=0;
    project.videoWidth=null;
    project.videoHeight=null;
    state.objectUrl=URL.createObjectURL(file);
    state.currentTime=0;
    state.activeProject=project;
    await putProject(project,{storeMedia:true});
    await refreshProjects();
    await render();
    showToast(t("saved"));
  }catch(error){
    showToast(error?.name==="QuotaExceededError"?t("fileTooLarge"):t("saveFailed"));
  }
}

function normaliseRestoredProject(entry) {
  if(!entry||typeof entry!=="object")throw new Error("Invalid project record");
  const rawPoints=Array.isArray(entry.points)?entry.points.slice(0,500):[];
  const points=rawPoints.map(point=>{
    const x=Number(point?.x),y=Number(point?.y),time=Number(point?.t);
    if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(time))return null;
    return {id:pointId(),t:Math.max(0,time),x:Math.max(0,Math.min(1,x)),y:Math.max(0,Math.min(1,y)),confidence:Number.isFinite(Number(point.confidence))?Math.max(0,Math.min(1,Number(point.confidence))):1,source:"restored"};
  }).filter(Boolean).sort((a,b)=>a.t-b.t);
  const color=typeof entry.style?.color==="string"&&/^#[0-9a-f]{6}$/i.test(entry.style.color)?entry.style.color:"#c6f36d";
  const width=Number(entry.style?.width);
  const seedRaw=entry.seed;
  const seed=Number.isFinite(Number(seedRaw?.x))&&Number.isFinite(Number(seedRaw?.y))
    ?{x:Math.max(0,Math.min(1,Number(seedRaw.x))),y:Math.max(0,Math.min(1,Number(seedRaw.y))),t:Math.max(0,Number(seedRaw.t)||0)}:null;
  const distance=entry.distance==null?NaN:Number(entry.distance);
  const confidenceRaw=entry.tracking_confidence??entry.trackingConfidence;
  return {
    id:pointId(),name:String(entry.name||"Restored golf project").slice(0,80),
    mediaName:String(entry.media_name||entry.mediaName||"Original clip not attached"),
    mediaType:String(entry.media_type||entry.mediaType||"video/mp4"),
    mediaSize:Number.isFinite(Number(entry.media_size??entry.mediaSize))?Number(entry.media_size??entry.mediaSize):0,
    duration:Number.isFinite(Number(entry.duration))?Math.max(0,Number(entry.duration)):0,
    videoWidth:Number.isFinite(Number(entry.video_width??entry.videoWidth))?Number(entry.video_width??entry.videoWidth):null,
    videoHeight:Number.isFinite(Number(entry.video_height??entry.videoHeight))?Number(entry.video_height??entry.videoHeight):null,
    createdAt:Date.now(),updatedAt:Date.now(),mode:entry.mode==="curve"?"curve":"golf",
    style:{color,width:Number.isFinite(width)?Math.max(2,Math.min(9,width)):4,opacity:.96,showDistance:Boolean(entry.style?.showDistance)},
    distance:Number.isFinite(distance)&&distance>=0?distance:null,
    distanceUnit:String(entry.distance_unit||entry.distanceUnit||"yd"),points,seed,
    trackingState:entry.tracking_state||entry.trackingState||"restored",
    trackingConfidence:confidenceRaw!=null&&Number.isFinite(Number(confidenceRaw))?Number(confidenceRaw):null,
    cameraMotionNote:"",mediaBlob:null,
  };
}

async function importProjectData(file) {
  if(!file)return;
  if(file.size>5*1024*1024){showToast(t("restoreFailed"));return;}
  try{
    const backup=JSON.parse(await file.text());
    let entries=[];
    if(backup?.format==="puttclub-vision-project"&&backup.project)entries=[backup.project];
    else if(backup?.format==="puttclub-vision-index"&&Array.isArray(backup.projects))entries=backup.projects;
    if(!entries.length)throw new Error("Unsupported PuttClub Vision backup format");
    for(const entry of entries)await putProject(normaliseRestoredProject(entry));
    await refreshProjects();
    state.activeProject=null;
    revokeMediaUrl();
    state.view="projects";
    await render();
    showToast(t("restoreDone"));
  }catch(error){
    console.warn("Could not restore local PuttClub project data:",error);
    showToast(t("restoreFailed"));
  }
}

function openNewProjectDialog() {
  dialogRoot.innerHTML = `<div class="dialog-backdrop" data-action="dismiss-dialog"><section class="dialog" role="dialog" aria-modal="true"><button class="dialog-close" data-action="close-dialog" aria-label="${t("closeDialog")}">${h("close")}</button><div class="kicker">${t("newTrace")}</div><h2>${t("emptyTitle")}</h2><p>${t("emptyText")}</p><div class="dialog-actions" style="justify-content:flex-start"><button class="button primary" data-action="pick-video">${h("upload")}<span>${t("chooseClip")}</span></button><button class="button secondary" data-action="record-video">${h("camera")}<span>${t("cameraClip")}</span></button></div><div class="dialog-note">${h("shield")}<span>${t("localNote")}</span></div></section></div>`;
}

function canRenderVideo() {
  return typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function";
}

function openExportDialog() {
  const project=state.activeProject;
  if (!project) return;
  const renderAvailable=Boolean(project.mediaBlob&&state.objectUrl&&!project.demo&&(project.points?.length||0)>1&&canRenderVideo());
  const showRender=Boolean(project.mediaBlob&&!project.demo&&(project.points?.length||0)>1);
  dialogRoot.innerHTML = `<div class="dialog-backdrop" data-action="dismiss-dialog"><section class="dialog" role="dialog" aria-modal="true"><button class="dialog-close" data-action="close-dialog" aria-label="${t("closeDialog")}">${h("close")}</button><div class="kicker">${t("export")}</div><h2>${escapeHtml(project.name)}</h2><p>${t("exportInfo")}</p><div class="dialog-note">${h("info")}<span>${t("exportWarning")}</span></div><div class="dialog-actions" style="justify-content:flex-start"><button class="button primary" data-action="export-project-data">${h("download")}<span>${t("exportJson")}</span></button>${project.mediaBlob?`<button class="button secondary" data-action="export-original-video">${h("video")}<span>${t("exportVideo")}</span></button>`:""}${showRender?`<button class="button secondary" data-action="render-video" ${renderAvailable?"":"disabled"}>${h("video")}<span>${t("renderVideo")}</span></button>`:""}</div>${showRender&&!renderAvailable?`<p class="section-description">${t("renderUnsupported")}</p>`:""}<div class="progress" id="render-progress"><div class="progress-label"><span id="render-label">${t("renderProgress")}</span><span id="render-percent">0%</span></div><div class="progress-track"><div class="progress-fill" id="render-fill"></div></div></div><button class="button danger small" id="cancel-render" data-action="cancel-render" style="display:none;margin-top:9px">${t("cancel")}</button>${showRender?`<div class="privacy-strip" style="margin-top:12px">${h("shield")}<span>${t("renderNoAudio")}</span></div>`:""}<p class="section-description" style="margin-top:10px">${t("noNetwork")}</p></section></div>`;
}

function confirmDialog({title,message,confirmText=t("confirm"),danger=false,onConfirm}) {
  dialogRoot.innerHTML = `<div class="dialog-backdrop" data-action="dismiss-dialog"><section class="dialog" role="dialog" aria-modal="true"><button class="dialog-close" data-action="close-dialog" aria-label="${t("closeDialog")}">${h("close")}</button><div class="kicker">${t("privacy")}</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p><div class="dialog-actions"><button class="button secondary" data-action="close-dialog">${t("cancel")}</button><button class="button ${danger?"danger":"primary"}" data-action="confirm-dialog">${escapeHtml(confirmText)}</button></div></section></div>`;
  const button=document.querySelector('[data-action="confirm-dialog"]');
  button?.addEventListener("click",async()=>{
    dialogRoot.innerHTML="";
    await onConfirm?.();
  },{once:true});
}

function downloadBlob(blob, filename) {
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;link.download=filename;link.rel="noopener";
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}

function exportProjectData() {
  const project=state.activeProject;
  if (!project) return;
  const backup={
    format:"puttclub-vision-project",
    schema_version:1,
    exported_at:new Date().toISOString(),
    note:"Contains editable project settings and path points. The original video is a separate local file.",
    project:{
      id:project.id,name:project.name,media_name:project.mediaName,media_type:project.mediaType,media_size:project.mediaSize,
      duration:project.duration,video_width:project.videoWidth||null,video_height:project.videoHeight||null,
      mode:project.mode,distance:project.distance,distance_unit:project.distanceUnit,
      style:project.style,seed:project.seed,tracking_state:project.trackingState,
      tracking_confidence:project.trackingConfidence,points:project.points,created_at:project.createdAt,updated_at:project.updatedAt,
    },
  };
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});
  downloadBlob(blob,`${fileSlug(project.name)}.puttclub.json`);
  showToast(t("exportDone"));
}

function fileSlug(name) {
  return String(name||"puttclub-project").normalize("NFKD").replace(/[^a-zA-Z0-9\u0600-\u06FF_-]+/g,"-").replace(/^-|-$/g,"").slice(0,60)||"puttclub-project";
}

function drawProgressiveTrace(context, project, time, width, height) {
  const points=(project.points||[]).slice().sort((a,b)=>a.t-b.t);
  if(!points.length||time<points[0].t)return;
  const visible=points.filter(point=>point.t<=time).map(point=>({x:point.x,y:point.y}));
  const next=points.find(point=>point.t>time);
  if(visible.length&&next){
    const previous=points[visible.length-1];
    const span=next.t-previous.t;
    const mix=span>0?Math.max(0,Math.min(1,(time-previous.t)/span)):0;
    visible.push({x:previous.x+(next.x-previous.x)*mix,y:previous.y+(next.y-previous.y)*mix});
  }
  if(!visible.length)return;
  const color=project.style?.color||"#c6f36d";
  const lineWidth=Math.max(2,(Number(project.style?.width)||4)*width/1000);
  context.save();
  context.lineCap="round";
  context.lineJoin="round";
  context.strokeStyle=color;
  context.fillStyle=color;
  context.shadowColor=color;
  context.shadowBlur=lineWidth*3;
  context.globalAlpha=Number.isFinite(project.style?.opacity)?project.style.opacity:.96;
  context.lineWidth=lineWidth;
  context.beginPath();
  context.moveTo(visible[0].x*width,visible[0].y*height);
  if(visible.length===1){
    context.arc(visible[0].x*width,visible[0].y*height,lineWidth*1.8,0,Math.PI*2);
    context.fill();
  }else{
    for(let index=1;index<visible.length-1;index++){
      const point=visible[index],following=visible[index+1];
      context.quadraticCurveTo(point.x*width,point.y*height,(point.x+following.x)*width/2,(point.y+following.y)*height/2);
    }
    const last=visible[visible.length-1];
    context.lineTo(last.x*width,last.y*height);
    context.stroke();
    context.shadowBlur=0;
    context.globalAlpha=.68;
    context.strokeStyle="#f6ffdb";
    context.lineWidth=Math.max(1,lineWidth*.22);
    context.setLineDash([lineWidth*.25,lineWidth*2.8]);
    context.stroke();
    context.setLineDash([]);
    context.globalAlpha=1;
    const start=visible[0],end=visible[visible.length-1];
    for(const point of [start,end]){
      context.beginPath();
      context.arc(point.x*width,point.y*height,lineWidth*1.15,0,Math.PI*2);
      context.fillStyle=color;
      context.fill();
      context.strokeStyle="#f6ffdb";
      context.lineWidth=Math.max(1,lineWidth*.3);
      context.stroke();
    }
  }
  if(project.style?.showDistance&&Number(project.distance)>0){
    const label=`${project.distance} ${project.distanceUnit||"yd"}`;
    const fontSize=Math.max(14,Math.round(width*.018));
    context.font=`700 ${fontSize}px system-ui, sans-serif`;
    const padding=fontSize*.55;
    const textWidth=context.measureText(label).width;
    const x=Math.max(padding,Math.min(width-textWidth-padding,width*.72));
    const y=Math.max(fontSize+padding,Math.min(height-padding,height*.28));
    context.fillStyle="rgba(3,12,6,.78)";
    context.beginPath();
    if(typeof context.roundRect==="function")context.roundRect(x-padding,y-fontSize-padding,textWidth+padding*2,fontSize+padding*2,fontSize*.35);
    else context.rect(x-padding,y-fontSize-padding,textWidth+padding*2,fontSize+padding*2);
    context.fill();
    context.fillStyle="#f5f7ef";
    context.fillText(label,x,y);
  }
  context.restore();
}

async function exportRenderedVideo() {
  const project=state.activeProject;
  if(!project?.mediaBlob||!state.objectUrl||project.demo||!canRenderVideo()){
    showToast(t("renderUnsupported"));
    return;
  }
  document.getElementById("player")?.pause();
  state.playing=false;
  updatePlayButton();
  let video=null,stream=null,recorder=null,animation=0;
  let cancelled=false;
  const chunks=[];
  state.rendering=true;
  state.renderCancel=()=>{
    cancelled=true;
    video?.pause();
    try{if(recorder&&recorder.state!=="inactive")recorder.stop();}catch{}
  };
  const progress=document.getElementById("render-progress");
  const progressFill=document.getElementById("render-fill");
  const progressLabel=document.getElementById("render-label");
  const progressPercent=document.getElementById("render-percent");
  const cancelButton=document.getElementById("cancel-render");
  const renderButton=document.querySelector('[data-action="render-video"]');
  progress?.classList.add("visible");
  if(cancelButton)cancelButton.style.display="inline-flex";
  if(renderButton)renderButton.disabled=true;
  if(progressLabel)progressLabel.textContent=t("renderProgress");
  if(progressFill)progressFill.style.width="0%";
  if(progressPercent)progressPercent.textContent="0%";

  try{
    video=document.createElement("video");
    video.src=state.objectUrl;
    video.preload="auto";
    video.muted=true;
    video.playsInline=true;
    video.style.cssText="position:fixed;left:-10000px;top:0;width:2px;height:2px;opacity:0;pointer-events:none";
    document.body.appendChild(video);
    await new Promise((resolve,reject)=>{
      if(video.readyState>=1){resolve();return;}
      video.addEventListener("loadedmetadata",resolve,{once:true});
      video.addEventListener("error",()=>reject(new Error("Could not read the local video.")),{once:true});
      video.load();
    });
    if(cancelled)return;
    if(!Number.isFinite(video.duration)||video.duration<=0||!video.videoWidth||!video.videoHeight)throw new Error("The clip has no usable video frames.");
    const scale=Math.min(1,1280/video.videoWidth);
    const width=Math.max(2,Math.round(video.videoWidth*scale));
    const height=Math.max(2,Math.round(video.videoHeight*scale));
    const canvas=document.createElement("canvas");
    canvas.width=width;canvas.height=height;
    const context=canvas.getContext("2d");
    if(!context)throw new Error("Could not create the local export canvas.");
    stream=canvas.captureStream(30);
    const types=["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm","video/mp4;codecs=avc1.42E01E","video/mp4"];
    const mimeType=typeof MediaRecorder.isTypeSupported==="function"?types.find(type=>MediaRecorder.isTypeSupported(type)):"";
    recorder=mimeType?new MediaRecorder(stream,{mimeType}):new MediaRecorder(stream);
    const recordingDone=new Promise((resolve,reject)=>{
      recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data);};
      recorder.onerror=event=>reject(event.error||new Error("The browser recorder failed."));
      recorder.onstop=resolve;
      recorder.start(1000);
    });
    let lastPercent=-1;
    let renderError=null;
    const drawFrame=()=>{
      context.drawImage(video,0,0,width,height);
      drawProgressiveTrace(context,project,video.currentTime,width,height);
      const pct=Math.min(100,Math.floor((video.currentTime/video.duration)*100));
      if(pct!==lastPercent){
        lastPercent=pct;
        if(progressFill)progressFill.style.width=`${pct}%`;
        if(progressPercent)progressPercent.textContent=`${pct}%`;
      }
    };
    const tick=()=>{
      if(cancelled){try{if(recorder.state!=="inactive")recorder.stop();}catch{}return;}
      try{drawFrame();}catch(error){renderError=error;console.warn("Frame render failed:",error);try{if(recorder.state!=="inactive")recorder.stop();}catch{}return;}
      if(video.ended){
        if(progressFill)progressFill.style.width="100%";
        if(progressPercent)progressPercent.textContent="100%";
        try{if(recorder.state!=="inactive")recorder.stop();}catch{}
        return;
      }
      animation=requestAnimationFrame(tick);
    };
    video.addEventListener("ended",()=>{try{drawFrame();}catch(error){renderError=error;}try{if(recorder.state!=="inactive")recorder.stop();}catch{}},{once:true});
    let playbackError=null;
    try{await video.play();if(!cancelled)animation=requestAnimationFrame(tick);}
    catch(error){playbackError=error;try{if(recorder.state!=="inactive")recorder.stop();}catch{}}
    await recordingDone;
    if(playbackError)throw playbackError;
    if(renderError)throw renderError;
    if(cancelled){showToast(t("cancel"));return;}
    const blob=new Blob(chunks,{type:recorder.mimeType||mimeType||"video/webm"});
    if(!blob.size)throw new Error("The browser did not produce an output file.");
    const extension=blob.type.includes("mp4")?"mp4":"webm";
    downloadBlob(blob,`${fileSlug(project.name)}-trace.${extension}`);
    if(progressLabel)progressLabel.textContent=t("renderDone");
    showToast(t("renderDone"));
  }catch(error){
    console.warn("Local video render failed:",error);
    showToast(t("renderFailed"));
  }finally{
    cancelAnimationFrame(animation);
    try{video?.pause();}catch{}
    if(video){video.removeAttribute("src");video.load();video.remove();}
    stream?.getTracks().forEach(track=>track.stop());
    state.rendering=false;
    state.renderCancel=null;
    if(cancelButton)cancelButton.style.display="none";
    if(renderButton)renderButton.disabled=false;
  }
}

function runTracking() {
  const project=state.activeProject;
  const player=document.getElementById("player");
  if (!project || !player) { showToast(t("noVideo")); return; }
  if (!project.seed) { state.currentTime=player.currentTime;state.seedMode=true;state.addMode=false;render();showToast(t("trackingNeedSeed"));return; }
  if (state.tracking) return;
  if (player.readyState<2) { showToast(t("selectVideo"));return; }
  state.tracking=true;
  state.seedMode=false;
  state.addMode=false;
  state.currentTime=player.currentTime;
  player.pause();
  state.playing=false;
  updatePlayButton();
  document.getElementById("track-progress")?.classList.add("visible");
  const trackButton=document.querySelector('[data-action="track-ball"]');
  if(trackButton){trackButton.disabled=true;trackButton.innerHTML=`${h("wand")}<span>${t("tracking")}</span>`;}
  suggestBallPath(player,project.seed,value=>{
    const pct=Math.round(value*100);
    const liveFill=document.getElementById("track-fill");
    const liveLabel=document.getElementById("track-label");
    const livePercent=document.getElementById("track-percent");
    if(liveFill)liveFill.style.width=`${pct}%`;
    if(liveLabel)liveLabel.textContent=t("tracking");
    if(livePercent)livePercent.textContent=`${pct}%`;
  }).then(async result=>{
    if(result.points.length<2){showToast(t("trackingFew"));return;}
    project.points=result.points.map(point=>({...point,id:point.id||pointId()}));
    project.trackingState="suggested";
    project.trackingConfidence=result.confidence;
    project.cameraMotionNote=result.limitation;
    state.activeProject=project;
    state.selectedPointId=null;
    state.undoStack=[];
    await persistActiveProject();
    showToast(t("trackingDone"));
  }).catch(error=>{
    console.warn("Local tracking assist failed:",error);
    showToast(t("trackingFailed"));
  }).finally(()=>{
    state.currentTime=player.currentTime;
    state.tracking=false;
    if(state.view==="studio")render();
  });
}

async function installApp() {
  if (state.installPrompt) {
    state.installPrompt.prompt();
    try { await state.installPrompt.userChoice; } catch { /* no-op */ }
    state.installPrompt=null;
    render();
    return;
  }
  showToast(getLanguage()==="fa"?t("installIos"):"Use your browser menu and choose Install app / Add to Home Screen.");
}

async function handleAction(event) {
  const control=event.target.closest("[data-action]");
  if(!control)return;
  const action=control.dataset.action;
  if(action==="dismiss-dialog"&&event.target!==control)return;
  if(action==="dismiss-dialog"){if(state.rendering)state.renderCancel?.();dialogRoot.innerHTML="";return;}
  if(action==="navigate"){ 
    if(control.dataset.view==="studio"&&!state.activeProject){state.view="projects";showToast(t("noProjects"));await render();return;}
    state.view=control.dataset.view;
    state.editMode=false;state.addMode=false;state.seedMode=false;
    await render();window.scrollTo({top:0,behavior:"smooth"});
  } else if(action==="open-settings") {state.view="settings";await render();}
  else if(action==="new-project") openNewProjectDialog();
  else if(action==="pick-video"){dialogRoot.innerHTML="";videoInput.value="";videoInput.click();}
  else if(action==="record-video"){dialogRoot.innerHTML="";cameraInput.value="";cameraInput.click();}
  else if(action==="attach-video"){attachInput.value="";attachInput.click();}
  else if(action==="restore-data"){restoreInput.value="";restoreInput.click();}
  else if(action==="try-sample")openSample();
  else if(action==="open-project")await openProject(control.dataset.id);
  else if(action==="project-menu")showProjectMenu(control.dataset.id);
  else if(action==="rename")openRenameDialog(control.dataset.id || state.activeProject?.id);
  else if(action==="export")openExportDialog();
  else if(action==="export-project-data") {dialogRoot.innerHTML="";exportProjectData();}
  else if(action==="export-original-video"){
    const project=state.activeProject;if(project?.mediaBlob)downloadBlob(project.mediaBlob,project.mediaName||"golf-clip.mp4");showToast(t("exportDone"));dialogRoot.innerHTML="";
  }
  else if(action==="render-video")await exportRenderedVideo();
  else if(action==="cancel-render")state.renderCancel?.();
  else if(action==="close-dialog"){if(state.rendering)state.renderCancel?.();dialogRoot.innerHTML="";}
  else if(action==="toggle-language"){toggleLanguage();await render();}
  else if(action==="install")await installApp();
  else if(action==="track-ball")runTracking();
  else if(action==="seed-mode"){state.seedMode=!state.seedMode;state.addMode=false;state.editMode=false;await render();}
  else if(action==="add-mode"){state.addMode=!state.addMode;state.seedMode=false;state.editMode=true;await render();}
  else if(action==="toggle-edit"){state.editMode=!state.editMode;state.addMode=false;state.seedMode=false;state.selectedPointId=null;await render();}
  else if(action==="set-mode"){state.activeProject.mode=control.dataset.mode;await persistActiveProject();await render();}
  else if(action==="set-color"){state.activeProject.style.color=control.dataset.color;await persistActiveProject();await render();}
  else if(action==="distance-toggle"){state.activeProject.style.showDistance=!state.activeProject.style.showDistance;await persistActiveProject();await render();}
  else if(action==="play")togglePlayback();
  else if(action==="step-back")seekBy(-.1);
  else if(action==="step-forward")seekBy(.1);
  else if(action==="undo")undoLast();
  else if(action==="remove-point")removeSelectedPoint();
  else if(action==="clear-all")confirmDialog({title:t("clearAll"),message:t("clearAllConfirm"),confirmText:t("delete"),danger:true,onConfirm:async()=>{await clearProjects();await refreshProjects();state.activeProject=null;revokeMediaUrl();state.view="projects";await render();showToast(t("deleted"));}});
  else if(action==="protect-storage"){
    const granted=await requestPersistentStorage();
    showToast(granted?t("storageProtected"):t("storageNotProtected"));
  }
  else if(action==="export-all"){
    const projects=await getAllProjects();
    const backup={format:"puttclub-vision-index",schema_version:1,exported_at:new Date().toISOString(),projects:projects.map(project=>({id:project.id,name:project.name,media_name:project.mediaName,media_type:project.mediaType,media_size:project.mediaSize,duration:project.duration,mode:project.mode,distance:project.distance,distance_unit:project.distanceUnit,style:project.style,seed:project.seed,tracking_state:project.trackingState,tracking_confidence:project.trackingConfidence,points:project.points,created_at:project.createdAt,updated_at:project.updatedAt}))};
    downloadBlob(new Blob([JSON.stringify(backup,null,2)],{type:"application/json"}),"puttclub-vision-backup.json");showToast(t("exportDone"));
  }
}

function showProjectMenu(id) {
  const project=state.projects.find(item=>item.id===id);
  if(!project)return;
  dialogRoot.innerHTML=`<div class="dialog-backdrop" data-action="dismiss-dialog"><section class="dialog" role="dialog" aria-modal="true"><button class="dialog-close" data-action="close-dialog">${h("close")}</button><div class="kicker">${t("more")}</div><h2>${escapeHtml(project.name)}</h2><p>${escapeHtml(project.mediaName||"")}</p><div class="dialog-actions" style="justify-content:flex-start"><button class="button secondary" data-action="open-project" data-id="${escapeHtml(project.id)}">${t("open")}</button><button class="button secondary" data-action="rename" data-id="${escapeHtml(project.id)}">${t("renameAction")}</button><button class="button danger" data-action="delete-project" data-id="${escapeHtml(project.id)}">${h("trash")}<span>${t("remove")}</span></button></div></section></div>`;
}

function openRenameDialog(projectId=state.activeProject?.id) {
  const project=state.projects.find(item=>item.id===projectId)||state.activeProject;
  if(!project)return;
  dialogRoot.innerHTML=`<div class="dialog-backdrop" data-action="dismiss-dialog"><section class="dialog" role="dialog" aria-modal="true"><button class="dialog-close" data-action="close-dialog">${h("close")}</button><div class="kicker">${t("renameAction")}</div><h2>${t("editName")}</h2><div class="dialog-field"><label for="rename-field">${t("editName")}</label><input id="rename-field" value="${escapeHtml(project.name)}" maxlength="80"></div><div class="dialog-actions"><button class="button secondary" data-action="close-dialog">${t("cancel")}</button><button class="button primary" data-action="save-name" data-id="${escapeHtml(project.id)}">${t("save")}</button></div></section></div>`;
  setTimeout(()=>{const input=document.getElementById("rename-field");input?.focus();input?.select();},0);
}

async function deleteProject(id) {
  await removeProject(id);
  if(state.activeProject?.id===id){state.activeProject=null;revokeMediaUrl();state.view="projects";}
  await refreshProjects();
  await render();
  showToast(t("deleted"));
}

function togglePlayback() {
  const video=document.getElementById("player");
  if(video){if(video.paused)video.play().catch(()=>showToast(t("trackingFailed")));else video.pause();}
  else {state.playing=!state.playing;updatePlayButton();}
}
function seekBy(amount) {
  const duration=state.activeProject?.duration||0;
  state.currentTime=Math.max(0,Math.min(duration,state.currentTime+amount));
  if(state.video)state.video.currentTime=state.currentTime;
  updateTimelineDisplay();
}
function undoLast() {
  const previous=state.undoStack.pop();
  if(!previous){showToast(t("unsaved"));return;}
  state.activeProject.points=JSON.parse(previous);
  state.selectedPointId=null;
  render();
  scheduleSave();
}
function removeSelectedPoint() {
  if(!state.selectedPointId||!state.activeProject)return;
  saveUndoSnapshot();
  state.activeProject.points=state.activeProject.points.filter(point=>point.id!==state.selectedPointId);
  state.selectedPointId=null;
  render();scheduleSave();showToast(t("pointRemoved"));
}

function handlePointerDown(event) {
  const handle=event.target.closest("[data-point-id]");
  if(handle){startDrag(event);return;}
  const stage=event.target.closest("#video-stage");
  if(!stage||(!state.seedMode&&!state.addMode)||!state.activeProject)return;
  if(event.target.closest("button"))return;
  event.preventDefault();
  const rect=stage.getBoundingClientRect();
  const x=Math.max(.01,Math.min(.99,(event.clientX-rect.left)/rect.width));
  const y=Math.max(.01,Math.min(.99,(event.clientY-rect.top)/rect.height));
  if(state.seedMode){
    state.activeProject.seed={x,y,t:state.video?.currentTime??state.currentTime};
    state.seedMode=false;
    scheduleSave();
    render();
    showToast(t("seedSet"));
  }else if(state.addMode){
    saveUndoSnapshot();
    const point={id:pointId(),t:state.video?.currentTime??state.currentTime,x,y,confidence:1,source:"manual"};
    state.activeProject.points=[...(state.activeProject.points||[]),point].sort((a,b)=>a.t-b.t);
    state.selectedPointId=point.id;
    setPointPath();
    const removeButton=document.querySelector('[data-action="remove-point"]');
    if(removeButton)removeButton.disabled=false;
    showToast(t("pointAdded"));
  }
}

function handleInput(event) {
  const target=event.target;
  if(target.id==="scrubber"){
    const value=Number(target.value);
    state.currentTime=value;
    if(state.video)state.video.currentTime=value;
    target.style.setProperty("--progress",`${state.activeProject?.duration?value/state.activeProject.duration*100:0}%`);
    updateTimelineDisplay();
  }
  if(target.dataset.action==="width"&&state.activeProject){
    state.activeProject.style.width=Number(target.value);
    const line=document.querySelector(".path-line");
    const glow=document.querySelector(".path-glow");
    if(line)line.style.strokeWidth=`${state.activeProject.style.width}px`;
    if(glow)glow.style.strokeWidth=`${state.activeProject.style.width*3}px`;
    const label=target.closest(".range-row")?.querySelector("span:last-child");
    if(label)label.textContent=target.value;
    scheduleSave();
  }
  if(target.dataset.field==="distance"&&state.activeProject){
    const value=target.value.trim();
    state.activeProject.distance=value===""?null:Number(value);
    scheduleSave();
    const stage=document.getElementById("video-stage");
    let pathLabel=document.querySelector(".path-label");
    if(state.activeProject.style?.showDistance&&state.activeProject.distance){
      if(!pathLabel&&stage){pathLabel=document.createElement("div");pathLabel.className="path-label";stage.appendChild(pathLabel);}
      if(pathLabel)pathLabel.innerHTML=`<strong>${escapeHtml(state.activeProject.distance)}</strong> ${escapeHtml(state.activeProject.distanceUnit||"yd")}`;
    }else pathLabel?.remove();
  }
}

function handleKeyDown(event) {
  if(event.key==="Escape"){if(state.rendering)state.renderCancel?.();dialogRoot.innerHTML="";}
  if((event.key==="Delete"||event.key==="Backspace")&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))removeSelectedPoint();
  if(state.view==="studio"&&event.code==="Space"&&!['INPUT','BUTTON','SELECT'].includes(document.activeElement?.tagName)){event.preventDefault();togglePlayback();}
}

async function registerServiceWorker() {
  if(!("serviceWorker" in navigator))return;
  try { await navigator.serviceWorker.register("./service-worker.js",{scope:"./"}); }
  catch(error){console.info("Offline app shell could not be registered:",error);}
}

function registerInstallPrompt() {
  window.addEventListener("beforeinstallprompt",event=>{
    event.preventDefault();state.installPrompt=event;
    if(state.view!=="studio")render();
  });
  window.addEventListener("appinstalled",()=>{state.installPrompt=null;showToast(t("offlineReady"));render();});
}

async function start() {
  try {
    await refreshProjects();
  } catch (error) {
    console.error("Could not start local database:",error);
    root.innerHTML=`<main class="main"><section class="empty-state"><div class="empty-symbol">${h("info")}</div><h2>${t("saveFailed")}</h2><p>${escapeHtml(error.message||"")}</p><button class="button secondary" onclick="location.reload()">Reload</button></section></main>`;
    return;
  }
  registerServiceWorker();
  registerInstallPrompt();
  requestPersistentStorage();
  render();
}

document.addEventListener("click",event=>{
  const target=event.target.closest("[data-action]");
  if(target?.dataset.action==="delete-project"){
    const id=target.dataset.id;dialogRoot.innerHTML="";
    confirmDialog({title:t("delete"),message:t("deleteConfirm"),confirmText:t("delete"),danger:true,onConfirm:()=>deleteProject(id)});
    return;
  }
  if(target?.dataset.action==="save-name"){
    const id=target.dataset.id;const name=document.getElementById("rename-field")?.value?.trim();
    if(name){
      const active=state.activeProject?.id===id?state.activeProject:state.projects.find(project=>project.id===id);
      if(active){active.name=name.slice(0,80);if(active.demo){dialogRoot.innerHTML="";render();showToast(t("saved"));return;}putProject(active).then(async()=>{await refreshProjects();dialogRoot.innerHTML="";await render();showToast(t("saved"));});}
    }
    return;
  }
  handleAction(event).catch(error=>{console.error(error);showToast(error.message||t("saveFailed"));});
});

document.addEventListener("input",handleInput);
document.addEventListener("change",event=>{
  const file=event.target.files?.[0];
  if(event.target===videoInput||event.target===cameraInput){
    addProjectFromFile(file).catch(error=>{console.error(error);showToast(t("saveFailed"));});
    event.target.value="";
  }else if(event.target===attachInput){
    attachVideoToActiveProject(file).catch(error=>{console.error(error);showToast(t("saveFailed"));});
    event.target.value="";
  }else if(event.target===restoreInput){
    importProjectData(file).catch(error=>{console.error(error);showToast(t("restoreFailed"));});
    event.target.value="";
  }
});
document.addEventListener("pointerdown",handlePointerDown);
document.addEventListener("pointermove",event=>{if(state.dragging)moveDrag(event);});
document.addEventListener("pointerup",()=>{if(state.dragging){state.dragging=null;scheduleSave();}});
document.addEventListener("pointercancel",()=>{if(state.dragging){state.dragging=null;scheduleSave();}});
document.addEventListener("keydown",handleKeyDown);
window.addEventListener("resize",()=>sizeVideoStage(state.video),{passive:true});
window.addEventListener("beforeunload",()=>{if(state.rendering)state.renderCancel?.();revokeMediaUrl();});

start();
