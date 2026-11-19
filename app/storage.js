// storage.js — earned-progress persistence and offline export/import.
// Progress lives in localStorage keyed by trophy name; export writes a JSON file,
// import reads one back. Nothing here touches the network.

const STORAGE_KEY = 'gta6-vice-legend-progress-v1';

// Read the earned set from localStorage, tolerating missing or corrupt data.
export function loadEarned() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter((n) => typeof n === 'string') : []);
  } catch {
    return new Set();
  }
}

// Persist the earned set as a plain JSON array of trophy names.
export function saveEarned(earned) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...earned]));
  } catch {
    // Storage may be unavailable (private mode); the app still works in-memory.
  }
}

// Build a portable progress document and download it as a JSON file.
export function exportProgress(earned, gameName) {
  const doc = {
    format: 'gta6-trophy-progress',
    version: 1,
    game: gameName,
    exportedAt: new Date().toISOString(),
    earnedCount: earned.size,
    earned: [...earned].sort(),
  };
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'gta6-trophy-progress.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Read an exported file back into an earned set, keeping only known trophy names.
// Accepts our {earned:[...]} document or a bare array of names.
export async function importProgress(file, knownNames) {
  const text = await file.text();
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : Array.isArray(data.earned) ? data.earned : null;
  if (!list) throw new Error('Not a progress file: expected an "earned" array.');
  const known = new Set(knownNames);
  const restored = new Set();
  for (const name of list) {
    if (typeof name === 'string' && known.has(name)) restored.add(name);
  }
  return restored;
}