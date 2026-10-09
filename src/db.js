const DB_NAME = "puttclub-vision-local";
const DB_VERSION = 2;
const PROJECTS = "projects";
const MEDIA = "media";

let databasePromise;

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) {
      reject(new Error("This browser does not support on-device project storage."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = event => {
      const db = request.result;
      const transaction = request.transaction;
      if (!db.objectStoreNames.contains(PROJECTS)) {
        const store = db.createObjectStore(PROJECTS, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(MEDIA)) db.createObjectStore(MEDIA, { keyPath: "id" });

      // Migrate the first local schema, which stored video blobs inline with
      // each project. Separating media means path edits only update small JSON
      // metadata and never rewrite a large clip.
      if (event.oldVersion > 0 && event.oldVersion < 2) {
        const projects = transaction.objectStore(PROJECTS);
        const media = transaction.objectStore(MEDIA);
        const cursorRequest = projects.openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          const project = cursor.value;
          if (project.mediaBlob) {
            media.put({ id: project.id, blob: project.mediaBlob });
            delete project.mediaBlob;
            cursor.update(project);
          }
          cursor.continue();
        };
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => {
      databasePromise = null;
      reject(request.error || new Error("Could not open local storage."));
    };
    request.onblocked = () => reject(new Error("Close another PuttClub Vision tab to update local storage."));
  });
  return databasePromise;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Local storage request failed."));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Local storage transaction failed."));
    transaction.onabort = () => reject(transaction.error || new Error("Local storage transaction was cancelled."));
  });
}

export async function getAllProjects() {
  const db = await openDatabase();
  const transaction = db.transaction(PROJECTS, "readonly");
  const items = await requestResult(transaction.objectStore(PROJECTS).getAll());
  return items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function getProject(id) {
  const db = await openDatabase();
  const transaction = db.transaction([PROJECTS, MEDIA], "readonly");
  const metadataRequest = requestResult(transaction.objectStore(PROJECTS).get(id));
  const mediaRequest = requestResult(transaction.objectStore(MEDIA).get(id));
  const [project, media] = await Promise.all([metadataRequest, mediaRequest]);
  if (project && media?.blob) project.mediaBlob = media.blob;
  return project;
}

export async function putProject(project, { storeMedia = false } = {}) {
  const db = await openDatabase();
  const transaction = db.transaction(storeMedia ? [PROJECTS, MEDIA] : PROJECTS, "readwrite");
  const { mediaBlob, ...metadata } = project;
  transaction.objectStore(PROJECTS).put({ ...metadata, updatedAt: Date.now() });
  if (storeMedia && mediaBlob) transaction.objectStore(MEDIA).put({ id: project.id, blob: mediaBlob });
  await transactionDone(transaction);
  return project;
}

export async function removeProject(id) {
  const db = await openDatabase();
  const transaction = db.transaction([PROJECTS, MEDIA], "readwrite");
  transaction.objectStore(PROJECTS).delete(id);
  transaction.objectStore(MEDIA).delete(id);
  await transactionDone(transaction);
}

export async function clearProjects() {
  const db = await openDatabase();
  const transaction = db.transaction([PROJECTS, MEDIA], "readwrite");
  transaction.objectStore(PROJECTS).clear();
  transaction.objectStore(MEDIA).clear();
  await transactionDone(transaction);
}

export async function localStorageEstimate() {
  try {
    if (!navigator.storage?.estimate) return { usage: null, quota: null };
    const estimate = await navigator.storage.estimate();
    return {
      usage: Number.isFinite(estimate.usage) ? estimate.usage : null,
      quota: Number.isFinite(estimate.quota) ? estimate.quota : null,
    };
  } catch {
    return { usage: null, quota: null };
  }
}

export async function requestPersistentStorage() {
  try {
    if (!navigator.storage?.persist) return false;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function makeProject(file, name = "") {
  const id = crypto.randomUUID ? crypto.randomUUID() : `p_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const cleanName = String(name || file.name || "Golf clip").replace(/\.[a-z0-9]{2,5}$/i, "");
  return {
    id,
    name: cleanName.slice(0, 80),
    mediaName: file.name || "local-video",
    mediaType: file.type || "video/mp4",
    mediaSize: file.size || 0,
    mediaBlob: file,
    duration: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    mode: "golf",
    style: { color: "#c6f36d", width: 4, opacity: 0.96, showDistance: false },
    distance: null,
    distanceUnit: "yd",
    points: [],
    seed: null,
    trackingState: "not-started",
    trackingConfidence: null,
    cameraMotionNote: "",
  };
}
