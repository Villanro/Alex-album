// Estado del álbum + persistencia en localStorage. No importa nada de sync.js:
// sync.js observa este módulo (subscribe/getAllRows/applyRemoteRows), nunca al revés.
import { TEAMS, TOTAL_STICKERS } from './data.js';

const STORAGE_KEY = 'panini2026:album:v3';
const LEGACY_KEY = 'panini2026:album'; // usada por los formatos v1 y v2 del prototipo
export const MAX_COUNT = 9;
export const DAY_MS = 86400000;

const teamByCode = new Map(TEAMS.map(t => [t.c, t]));
const rowKey = (team, num) => team + ':' + num;

// rows: { "COL:3": { count, first_at, updated_at } }, sólo figuritas alguna vez tocadas.
let rows = {};
let batching = false;
let dirty = false;
const listeners = new Set();

function notify() {
  listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
}

function persist() {
  if (batching) { dirty = true; return; }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 3, rows }));
  } catch (e) {
    // Almacenamiento lleno o no disponible (modo privado): la app sigue funcionando en memoria.
    console.warn('No se pudo guardar en localStorage', e);
  }
}

function migrateLegacy(raw) {
  let data;
  try { data = JSON.parse(raw); } catch (e) { return {}; }
  if (!data || typeof data !== 'object') return {};
  const out = {};
  const now = Date.now();
  if (data.v === 2) {
    // { v:2, s:{TEAM:{num:count}}, t:{TEAM:{num:first_at_ms}} }
    const s = data.s || {}, t = data.t || {};
    Object.keys(s).forEach(team => {
      Object.keys(s[team] || {}).forEach(num => {
        const count = s[team][num];
        if (!count) return;
        out[rowKey(team, num)] = {
          count,
          first_at: (t[team] && t[team][num]) || null,
          updated_at: now
        };
      });
    });
  } else {
    // v1: { TEAM: { num: count } } directamente
    Object.keys(data).forEach(team => {
      if (typeof data[team] !== 'object' || data[team] === null) return;
      Object.keys(data[team]).forEach(num => {
        const count = data[team][num];
        if (!count) return;
        out[rowKey(team, num)] = { count, first_at: null, updated_at: now };
      });
    });
  }
  return out;
}

export function init() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) {
      const parsed = JSON.parse(current);
      rows = (parsed && parsed.rows) || {};
      return;
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      rows = migrateLegacy(legacy);
      persist();
      return;
    }
  } catch (e) {
    console.warn('No se pudo leer localStorage', e);
  }
  rows = {};
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function batch(fn) {
  const wasBatching = batching;
  batching = true;
  try { fn(); } finally {
    batching = wasBatching;
    if (!batching && dirty) { dirty = false; persist(); notify(); }
  }
}

export function getCount(team, num) {
  const r = rows[rowKey(team, num)];
  return r ? r.count : 0;
}

export function getRow(team, num) {
  return rows[rowKey(team, num)] || null;
}

export function isNew(team, num) {
  const r = rows[rowKey(team, num)];
  return !!(r && r.first_at && (Date.now() - r.first_at) < DAY_MS);
}

export function setCount(team, num, value) {
  value = Math.max(0, Math.min(MAX_COUNT, value));
  const key = rowKey(team, num);
  const before = rows[key] ? rows[key].count : 0;
  if (value === before) return false;
  const now = Date.now();
  const prevFirstAt = rows[key] ? rows[key].first_at : null;
  rows[key] = {
    count: value,
    first_at: value === 0 ? null : (before === 0 ? now : prevFirstAt),
    updated_at: now
  };
  if (batching) { dirty = true; } else { persist(); notify(); }
  return true;
}

// --- Snapshots para deshacer (un nivel) ---
// Sólo re-marca updated_at en las filas que realmente cambian al restaurar,
// para no perturbar la resolución de conflictos de las filas no tocadas.
export function snapshot() {
  return JSON.parse(JSON.stringify(rows));
}

export function restore(snap) {
  const now = Date.now();
  const keys = new Set([...Object.keys(rows), ...Object.keys(snap)]);
  keys.forEach(key => {
    const before = rows[key] || null;
    const target = snap[key] || null;
    const beforeCount = before ? before.count : 0;
    const targetCount = target ? target.count : 0;
    if (beforeCount === targetCount) return;
    if (!target) { delete rows[key]; return; }
    rows[key] = { count: target.count, first_at: target.first_at, updated_at: now };
  });
  persist();
  notify();
}

// --- Lectura masiva / sincronización (llamada sólo por sync.js) ---
export function getAllRows() {
  return Object.keys(rows).map(key => {
    const [team, num] = key.split(':');
    const r = rows[key];
    return { team, num: Number(num), count: r.count, first_at: r.first_at, updated_at: r.updated_at };
  });
}

export function applyRemoteRows(remoteRows) {
  let changed = false;
  remoteRows.forEach(r => {
    const key = rowKey(r.team, r.num);
    const local = rows[key];
    if (!local) {
      rows[key] = { count: r.count, first_at: r.first_at, updated_at: r.updated_at };
      changed = true;
      return;
    }
    if (r.updated_at > local.updated_at ||
        (r.updated_at === local.updated_at && r.count > local.count)) {
      rows[key] = { count: r.count, first_at: r.first_at, updated_at: r.updated_at };
      changed = true;
    }
  });
  if (changed) { persist(); notify(); }
  return changed;
}

export function exportBackup() {
  return JSON.stringify({ v: 3, rows, exported_at: Date.now() }, null, 2);
}

export function importBackup(text) {
  const data = typeof text === 'string' ? JSON.parse(text) : text;
  if (!data || typeof data !== 'object') throw new Error('Formato no válido');
  let imported;
  if (data.v === 3) {
    imported = data.rows || {};
  } else if (data.v === 2) {
    imported = migrateLegacy(JSON.stringify(data));
  } else {
    imported = migrateLegacy(JSON.stringify(data));
  }
  rows = imported;
  persist();
  notify();
}

export function resetAll() {
  rows = {};
  persist();
  notify();
}

// --- Datos derivados (leídos por ui.js) ---
export function needList(code) {
  const t = teamByCode.get(code);
  const out = [];
  for (let i = 1; i <= t.t; i++) if (getCount(code, i) === 0) out.push(i);
  return out;
}
export function dupList(code) {
  const t = teamByCode.get(code);
  const out = [];
  for (let i = 1; i <= t.t; i++) { const d = Math.max(0, getCount(code, i) - 1); if (d > 0) out.push({ n: i, d }); }
  return out;
}
export function dupTotal(code) {
  return dupList(code).reduce((a, x) => a + x.d, 0);
}
export function haveCount(code) {
  const t = teamByCode.get(code);
  let k = 0;
  for (let i = 1; i <= t.t; i++) if (getCount(code, i) > 0) k++;
  return k;
}
export function newCount(code) {
  const t = teamByCode.get(code);
  let k = 0;
  for (let i = 1; i <= t.t; i++) if (isNew(code, i)) k++;
  return k;
}
export function freshItems() {
  const items = [];
  TEAMS.forEach(t => {
    const l = [];
    for (let i = 1; i <= t.t; i++) if (isNew(t.c, i)) l.push(i);
    if (l.length) items.push({ t, l });
  });
  return items;
}
export function totals() {
  let h = 0, d = 0;
  TEAMS.forEach(t => {
    for (let i = 1; i <= t.t; i++) {
      const k = getCount(t.c, i);
      if (k > 0) h++;
      if (k > 1) d += k - 1;
    }
  });
  return { tot: TOTAL_STICKERS, h, d, need: TOTAL_STICKERS - h, pct: Math.round(h / TOTAL_STICKERS * 100) };
}
