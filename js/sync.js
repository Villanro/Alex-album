// Réplica con Supabase. Este módulo OBSERVA store.js y lo llama
// (getAllRows, applyRemoteRows, subscribe); store.js nunca importa nada de aquí.
// Si no hay red o Supabase está caído, la app sigue funcionando igual de bien
// en local: aquí sólo se deja de replicar.
//
// Sin login: cada dispositivo tiene un "código de sincronización" propio,
// generado al azar la primera vez y guardado en localStorage. Se manda en la
// cabecera x-sync-code de cada petición; la política RLS de la tabla sólo dev
// vuelve/acepta filas cuyo sync_code coincide con esa cabecera. Para compartir
// el álbum entre dispositivos, se copia el código de uno y se pega en el otro.
import * as store from './store.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

const SUPABASE_JS_CDN = 'https://esm.sh/@supabase/supabase-js@2.45.4?bundle'; // versión fijada
const SUPABASE_JS_VENDOR = '../vendor/supabase-js.esm.js';
const TABLE = 'stickers';
const UPLOAD_BATCH_SIZE = 200;
const SYNC_DEBOUNCE_MS = 1500;
const SYNC_CODE_KEY = 'panini2026:sync_code';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I, para que sea fácil de teclear

let supabase = null;
let syncCode = null;
let status = 'local'; // 'local' (no configurado) | 'offline' | 'syncing' | 'synced'
const statusListeners = new Set();
let syncTimer = null;
let syncInFlight = null;

function setStatus(next) {
  if (status === next) return;
  status = next;
  statusListeners.forEach(fn => { try { fn(status); } catch (e) { console.error(e); } });
}

export function getStatus() { return status; }
export function subscribeStatus(fn) { statusListeners.add(fn); return () => statusListeners.delete(fn); }
export function isConfigured() {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('TU-PROYECTO'));
}

function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let s = '';
  for (let i = 0; i < 12; i++) s += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return s.match(/.{1,4}/g).join('-');
}
function normalizeCode(raw) {
  return (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').match(/.{1,4}/g)?.join('-') || '';
}

export function getSyncCode() { return syncCode; }

function buildClient(createClient) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { 'x-sync-code': syncCode } },
    auth: { persistSession: false }
  });
}

export function setSyncCode(rawCode) {
  const code = normalizeCode(rawCode);
  if (!code) throw new Error('Código no válido');
  syncCode = code;
  localStorage.setItem(SYNC_CODE_KEY, syncCode);
  reloadClientAndSync();
}

async function reloadClientAndSync() {
  if (!isConfigured()) return;
  try {
    const { createClient } = await loadSupabaseClientLib();
    buildClient(createClient);
    fullSync();
  } catch (e) {
    console.warn('No se pudo recargar el cliente de Supabase', e);
    setStatus('offline');
  }
}

async function loadSupabaseClientLib() {
  try {
    return await import(SUPABASE_JS_CDN);
  } catch (e) {
    return await import(SUPABASE_JS_VENDOR);
  }
}

function toIso(ms) { return ms ? new Date(ms).toISOString() : null; }

function localRowToApi(r) {
  return {
    sync_code: syncCode,
    team: r.team,
    num: r.num,
    count: r.count,
    first_at: toIso(r.first_at),
    updated_at: toIso(r.updated_at)
  };
}
function apiRowToLocal(r) {
  return {
    team: r.team,
    num: r.num,
    count: r.count,
    first_at: r.first_at ? new Date(r.first_at).getTime() : null,
    updated_at: new Date(r.updated_at).getTime()
  };
}

async function uploadBatches(rows) {
  for (let i = 0; i < rows.length; i += UPLOAD_BATCH_SIZE) {
    const chunk = rows.slice(i, i + UPLOAD_BATCH_SIZE).map(localRowToApi);
    const { error } = await supabase.from(TABLE).upsert(chunk, { onConflict: 'sync_code,team,num' });
    if (error) throw error;
  }
}

// Pura, sin efectos: decide qué filas subir y qué filas aplicar en local.
// Exportada aparte para poder probarla sin un proyecto de Supabase real.
export function diffRows(localRows, remoteRows) {
  const localMap = new Map(localRows.map(r => [r.team + ':' + r.num, r]));
  const remoteMap = new Map(remoteRows.map(r => [r.team + ':' + r.num, r]));
  const toUpload = [];
  const toApplyLocally = [];

  for (const [key, l] of localMap) {
    const r = remoteMap.get(key);
    if (!r) { toUpload.push(l); continue; }
    if (l.updated_at > r.updated_at) toUpload.push(l);
    else if (r.updated_at > l.updated_at) toApplyLocally.push(r);
    else if (l.count > r.count) toUpload.push(l);
    else if (r.count > l.count) toApplyLocally.push(r);
  }
  for (const [key, r] of remoteMap) {
    if (!localMap.has(key)) toApplyLocally.push(r);
  }
  return { toUpload, toApplyLocally };
}

export async function fullSync() {
  if (!supabase || !navigator.onLine) return;
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    setStatus('syncing');
    try {
      const { data: remoteRows, error } = await supabase
        .from(TABLE)
        .select('team,num,count,first_at,updated_at');
      if (error) throw error;

      const local = store.getAllRows();
      const remote = (remoteRows || []).map(apiRowToLocal);
      const { toUpload, toApplyLocally } = diffRows(local, remote);

      if (toApplyLocally.length) store.applyRemoteRows(toApplyLocally);
      if (toUpload.length) await uploadBatches(toUpload);

      setStatus('synced');
    } catch (e) {
      console.warn('Sincronización fallida, se reintentará más tarde', e);
      setStatus('offline');
    } finally {
      syncInFlight = null;
    }
  })();
  return syncInFlight;
}

function scheduleSync() {
  if (!supabase) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(fullSync, SYNC_DEBOUNCE_MS);
}

export async function init() {
  if (!isConfigured()) {
    setStatus('local');
    return;
  }
  syncCode = localStorage.getItem(SYNC_CODE_KEY) || generateCode();
  localStorage.setItem(SYNC_CODE_KEY, syncCode);

  try {
    const { createClient } = await loadSupabaseClientLib();
    buildClient(createClient);
  } catch (e) {
    console.warn('No se pudo cargar el cliente de Supabase; la app sigue en modo local.', e);
    setStatus('local');
    return;
  }

  setStatus('offline');
  store.subscribe(scheduleSync);
  window.addEventListener('online', () => fullSync());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) fullSync(); });

  fullSync();
}
