// Render y eventos. Lee el estado de store.js (fuente de verdad local) y el estado
// de sync.js (sólo para pintar el indicador y las acciones de la pantalla de Ajustes).
import { TEAMS } from './data.js';
import * as store from './store.js';
import * as sync from './sync.js';

const $ = id => document.getElementById(id);
const teamOf = c => TEAMS.find(t => t.c === c);
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

let tab = 'album', filter = '', teamFilter = 'all', openTeam = null, teamMode = 'mark', subMode = false;
let undoSnap = null, undoTimer = null;

// ---------- arranque ----------
export function mount() {
  render();
  bindTabs();
  bindGear();
  bindModal();
  $('toastAct').onclick = undo;
  sync.subscribeStatus(paintSyncDot);
  paintSyncDot(sync.getStatus());
  store.subscribe(refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  setInterval(() => { if (!document.hidden && !openTeam) render(); }, 600000);
  document.addEventListener('keydown', onGlobalKeydown);
}

function refresh() {
  if (openTeam) renderSheet(true); else render();
}

// ---------- utilidades de acción con deshacer ----------
function act(fn, msg) {
  undoSnap = store.snapshot();
  store.batch(fn);
  if (msg) toast(msg, true);
  if (navigator.vibrate) navigator.vibrate(8);
}
function undo() {
  if (!undoSnap) return;
  store.restore(undoSnap);
  undoSnap = null;
  hideToast();
  toast('Cambio deshecho');
}
function toast(m, withUndo) {
  clearTimeout(undoTimer);
  $('toastMsg').textContent = m;
  $('toastAct').hidden = !withUndo;
  $('toast').classList.add('on');
  undoTimer = setTimeout(hideToast, withUndo ? 4500 : 1800);
}
function hideToast() { $('toast').classList.remove('on'); }

// ---------- indicador de sincronización ----------
const STATUS_LABEL = { local: 'Modo local', offline: 'Sin conexión', syncing: 'Sincronizando…', synced: 'Sincronizado' };
function paintSyncDot(status) {
  const dot = $('syncDot');
  if (!dot) return;
  dot.dataset.status = status;
  dot.setAttribute('aria-label', STATUS_LABEL[status] || status);
  dot.title = STATUS_LABEL[status] || status;
}

// ---------- cabecera ----------
function paintTop() {
  const x = store.totals();
  $('tHave').textContent = x.h;
  $('tTotal').textContent = 'de ' + x.tot + ' pegadas';
  $('tBar').style.width = x.pct + '%';
  $('tBar').parentElement.setAttribute('aria-valuenow', String(x.pct));
  $('tNeed').textContent = x.need;
  $('tDup').textContent = x.d;
  $('tPct').textContent = x.pct + '%';
}

// ---------- render principal ----------
function render() {
  paintTop();
  $('main').innerHTML = tab === 'album' ? viewAlbum() : tab === 'dups' ? viewDups() : viewNeeds();
  bindMain();
}

function ring(pct) {
  const r = 14, C = 2 * Math.PI * r, off = C * (1 - pct / 100);
  return `<svg class="ring" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="${r}" fill="none" stroke="#E3E7ED" stroke-width="4"/><circle cx="17" cy="17" r="${r}" fill="none" stroke="#12854A" stroke-width="4" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}" transform="rotate(-90 17 17)"/><text x="17" y="21" text-anchor="middle">${pct}</text></svg>`;
}
function teamRow(t) {
  const h = store.haveCount(t.c), need = t.t - h, d = store.dupTotal(t.c), nw = store.newCount(t.c);
  return `<button class="team" data-open="${t.c}" aria-label="${t.n}, faltan ${need}">
    ${nw ? '<i class="dot" aria-hidden="true"></i>' : ''}
    <span class="flag" aria-hidden="true">${t.f}</span>
    <span class="tname"><strong>${t.n}</strong><span class="tmeta">
      ${need ? `<span class="need">Faltan ${need}</span>` : `<span class="done">Completo ✓</span>`}
      ${d ? `<span class="dup">${d} repe${d > 1 ? 's' : ''}</span>` : ''}
      ${nw ? `<span class="nu">${nw} nueva${nw > 1 ? 's' : ''}</span>` : ''}
    </span></span>${ring(Math.round(h / t.t * 100))}</button>`;
}
function freshBox() {
  const items = store.freshItems();
  if (!items.length) return '';
  const total = items.reduce((a, x) => a + x.l.length, 0);
  return `<div class="fresh"><h4>✨ Pegadas en las últimas 24 h · ${total}</h4><div class="fl">
    ${items.map(x => `<span class="fi">${x.t.f} ${x.t.c} <b>${x.l.join(' ')}</b></span>`).join('')}</div></div>`;
}
function viewAlbum() {
  const q = norm(filter.trim());
  let list = TEAMS.filter(t => !q || norm(t.n).includes(q) || norm(t.c).includes(q));
  if (teamFilter === 'inc') list = list.filter(t => store.haveCount(t.c) < t.t);
  if (teamFilter === 'dup') list = list.filter(t => store.dupTotal(t.c) > 0);
  if (teamFilter === 'new') list = list.filter(t => store.newCount(t.c) > 0);
  let out = `<div class="search"><input id="q" placeholder="Buscar selección…" value="${filter.replace(/"/g, '&quot;')}" autocomplete="off" enterkeyhint="search" aria-label="Buscar selección"></div>
  <div class="chips" role="group" aria-label="Filtros">
    <button class="chip ${teamFilter === 'all' ? 'on' : ''}" data-f="all" aria-pressed="${teamFilter === 'all'}">Todas</button>
    <button class="chip ${teamFilter === 'inc' ? 'on' : ''}" data-f="inc" aria-pressed="${teamFilter === 'inc'}">Incompletas</button>
    <button class="chip ${teamFilter === 'dup' ? 'on' : ''}" data-f="dup" aria-pressed="${teamFilter === 'dup'}">Con repes</button>
    <button class="chip ${teamFilter === 'new' ? 'on' : ''}" data-f="new" aria-pressed="${teamFilter === 'new'}">Nuevas</button>
  </div>`;
  if (teamFilter === 'all' && !q) out += freshBox();
  if (!list.length) return out + `<div class="blank"><b>Nada por aquí</b>Prueba con otro nombre o quita el filtro.</div>`;
  let g = null;
  list.forEach(t => {
    if (t.g !== g) { out += (g !== null ? '</div>' : '') + `<div class="grp"><b>${t.g === '★' ? '★ ESPECIALES' : 'GRUPO ' + t.g}</b><hr></div><div class="teams">`; g = t.g; }
    out += teamRow(t);
  });
  return out + '</div>';
}
function viewDups() {
  const rows = TEAMS.map(t => ({ t, l: store.dupList(t.c) })).filter(x => x.l.length);
  let out = `<h1 class="view">Mis repes</h1><p class="viewsub">Lo que puedes ofrecer. Toca una selección para ajustar cantidades.</p>`;
  if (!rows.length) return out + `<div class="blank"><b>Todavía no tienes repes</b>Cuando una figurita te salga por segunda vez, aparecerá aquí.</div>`;
  rows.forEach(x => {
    out += `<button class="lrow" data-open="${x.t.c}"><span class="flag" aria-hidden="true">${x.t.f}</span><strong>${x.t.c}</strong><span class="list">${x.l.map(o => o.n + (o.d > 1 ? '×' + o.d : '')).join(' · ')}</span></button>`;
  });
  return out + `<button class="copy" data-copy="dups">Copiar toda la lista</button><div style="height:20px"></div>`;
}
function viewNeeds() {
  const rows = TEAMS.map(t => ({ t, l: store.needList(t.c) })).filter(x => x.l.length);
  let out = `<h1 class="view">Me faltan</h1><p class="viewsub">Lo que buscas. Toca una selección para marcarlas al vuelo.</p>`;
  if (!rows.length) return out + `<div class="blank"><b>¡Álbum completo!</b>No te falta ninguna figurita.</div>`;
  rows.forEach(x => {
    out += `<button class="lrow" data-open="${x.t.c}"><span class="flag" aria-hidden="true">${x.t.f}</span><strong>${x.t.c}</strong><span class="list">${x.l.join(' · ')}</span></button>`;
  });
  return out + `<button class="copy" data-copy="needs">Copiar toda la lista</button>
    <button class="copy ghost" data-cmp="1">Comparar con la lista de otro</button><div style="height:20px"></div>`;
}

// ---------- ficha de selección ----------
function renderSheet(keepScroll) {
  const el = $('sheet'), sc = keepScroll ? el.scrollTop : 0;
  const t = teamOf(openTeam), h = store.haveCount(t.c), need = store.needList(t.c), dl = store.dupList(t.c);
  let body;
  if (teamMode === 'mark') {
    let cells = '';
    for (let i = 1; i <= t.t; i++) {
      const k = store.getCount(t.c, i), cls = k === 0 ? '' : k === 1 ? 'have' : 'dup';
      cells += `<button class="cell ${cls}" data-n="${i}" aria-label="Figurita ${i}${k > 0 ? ', pegada' : ''}${k > 1 ? ', con ' + (k - 1) + ' repe' : ''}" aria-pressed="${k > 0}">${i}${k > 1 ? `<em>+${k - 1}</em>` : ''}${store.isNew(t.c, i) ? '<b class="nw">NUEVA</b>' : ''}</button>`;
    }
    body = `<div class="modebar">
        <p class="hint">${subMode ? 'Restando: cada toque quita una.' : 'Toca para sumar. Mantén pulsado para vaciar.'}</p>
        <button class="minus ${subMode ? 'on' : ''}" id="sub" aria-pressed="${subMode}">− Restar</button>
      </div>
      <div class="grid ${subMode ? 'sub' : ''}" role="group" aria-label="Figuritas de ${t.n}">${cells}</div>
      <div class="rowact"><button data-all="1">Marcar todas</button><button data-all="0">Vaciar selección</button></div>`;
  } else {
    body = `<div class="tblock">
        <h3><i style="background:var(--red)"></i>Me faltan<span class="count">${need.length}</span></h3>
        ${need.length ? `<div class="nums">${need.map(n => `<button class="n need" data-get="${n}">${n}</button>`).join('')}</div>
          <p class="sub">Toca un número cuando te la den y pasa a pegada.</p>`
          : `<p class="empty">Ya tienes toda esta selección.</p>`}
      </div>
      <div class="tblock">
        <h3><i style="background:var(--gold)"></i>Repes para cambiar<span class="count">${dl.reduce((a, x) => a + x.d, 0)}</span></h3>
        ${dl.length ? `<div class="nums">${dl.map(o => `<span class="stepper"><button data-dec="${o.n}" aria-label="Quitar una del ${o.n}">−</button><span class="sv"><b>${o.n}</b><i>×${o.d}</i></span><button data-inc="${o.n}" aria-label="Sumar una del ${o.n}">+</button></span>`).join('')}</div>
          <p class="sub">Ajusta con − y + según las que entregues o recibas.</p>`
          : `<p class="empty">No tienes repetidas de esta selección.</p>`}
      </div>
      <button class="copy" data-copy="team">Copiar para WhatsApp</button><div style="height:26px"></div>`;
  }
  el.innerHTML = `
    <div class="sheet-top"><div class="wrap">
      <button class="back" id="back">‹ Todas las selecciones</button>
      <div class="sheet-title"><span class="flag" aria-hidden="true">${t.f}</span><div><h2>${t.n}</h2>
        <p>${t.g === '★' ? 'Especiales' : 'Grupo ' + t.g} · ${h}/${t.t} pegadas · ${store.dupTotal(t.c)} repes</p></div></div>
      <div class="seg" role="tablist" aria-label="Modo">
        <button data-mode="mark" role="tab" aria-selected="${teamMode === 'mark'}" class="${teamMode === 'mark' ? 'on' : ''}">Marcar</button>
        <button data-mode="trade" role="tab" aria-selected="${teamMode === 'trade'}" class="${teamMode === 'trade' ? 'on' : ''}">Intercambio</button>
      </div>
    </div></div><div class="wrap">${body}</div>`;
  el.classList.add('on');
  el.scrollTop = sc;
  bindSheet();
  paintTop();
}
function closeSheet() {
  openTeam = null;
  $('sheet').classList.remove('on');
  render();
}

// ---------- texto para compartir ----------
function textFor(kind) {
  if (kind === 'team') {
    const t = teamOf(openTeam), n = store.needList(t.c), d = store.dupList(t.c);
    return `${t.f} ${t.n}\nME FALTAN: ${n.length ? n.join(', ') : '—'}\nREPES: ${d.length ? d.map(o => o.n + (o.d > 1 ? 'x' + o.d : '')).join(', ') : '—'}`;
  }
  const need = kind === 'needs';
  const rows = TEAMS.map(t => {
    const l = need ? store.needList(t.c) : store.dupList(t.c).map(o => o.n + (o.d > 1 ? 'x' + o.d : ''));
    return l.length ? `${t.c}: ${l.join(', ')}` : null;
  }).filter(Boolean);
  return (need ? 'ME FALTAN (Panini 2026)' : 'MIS REPES (Panini 2026)') + '\n' + rows.join('\n');
}
async function copyText(txt) {
  try { await navigator.clipboard.writeText(txt); toast('Copiado'); }
  catch (e) { showModal(`<h3>Tu lista</h3><p>Mantén pulsado el texto para copiarlo.</p><textarea readonly>${txt}</textarea><button class="mbtn" data-close="1">Cerrar</button>`); }
}
function parseList(txt) {
  const out = {};
  txt.split(/\n+/).forEach(line => {
    const m = line.match(/^\s*([^:\-\d]{2,30}?)\s*[:\-]\s*(.+)$/);
    if (!m) return;
    const key = norm(m[1].trim());
    const t = TEAMS.find(x => norm(x.c) === key || norm(x.n) === key) || TEAMS.find(x => norm(x.n).startsWith(key) && key.length >= 3);
    if (!t) return;
    const nums = (m[2].match(/\d+/g) || []).map(Number).filter(n => n >= 1 && n <= t.t);
    if (nums.length) out[t.c] = [...new Set(nums)];
  });
  return out;
}
function compare(txt) {
  const theirs = parseList(txt), codes = Object.keys(theirs);
  if (!codes.length) return showModal(`<h3>No se entendió la lista</h3><p>Necesita una línea por selección, así: <b>COL: 3, 7, 12</b></p><button class="mbtn" data-close="1">Cerrar</button>`);
  let hits = [], n = 0;
  codes.forEach(c => { const m = theirs[c].filter(x => store.getCount(c, x) === 0); if (m.length) { hits.push({ t: teamOf(c), l: m }); n += m.length; } });
  window.__cmp = hits.map(x => `${x.t.c}: ${x.l.join(', ')}`).join('\n');
  showModal(`<h3>${n ? `Te sirven ${n} de sus figuritas` : 'No te sirve ninguna'}</h3>
    <p>${n ? 'Estas las tiene y a ti te faltan:' : 'Ya tienes todas las que ofrece.'}</p>
    ${hits.map(x => `<div class="hit"><span class="flag" aria-hidden="true">${x.t.f}</span><strong>${x.t.c}</strong><span class="list">${x.l.join(' · ')}</span></div>`).join('')}
    ${n ? `<button class="mbtn dark" data-act="cmpcopy">Copiar estos números</button>` : ''}
    <button class="mbtn" data-close="1">Cerrar</button>`);
}

function showModal(html) { $('modalIn').innerHTML = html; $('modal').classList.add('on'); bindModalContent(); }
function hideModal() { $('modal').classList.remove('on'); }

// ---------- enlazado de eventos ----------
function bindMain() {
  const q = $('q');
  if (q) q.oninput = e => { filter = e.target.value; const p = e.target.selectionStart; render(); const nn = $('q'); if (nn) { nn.focus(); nn.setSelectionRange(p, p); } };
  document.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { teamFilter = b.dataset.f; render(); });
  document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { openTeam = b.dataset.open; teamMode = tab === 'album' ? 'mark' : 'trade'; subMode = false; renderSheet(); });
  document.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => copyText(textFor(b.dataset.copy)));
  document.querySelectorAll('[data-cmp]').forEach(b => b.onclick = () => showModal(
    `<h3>Comparar con otra lista</h3><p>Pega las repes de la otra persona y te digo cuáles te sirven.</p>
     <textarea id="cmpIn" placeholder="COL: 3, 7, 12&#10;ARG: 5, 9" aria-label="Lista de la otra persona"></textarea>
     <button class="mbtn dark" data-act="cmpgo">Comparar</button><button class="mbtn" data-close="1">Cancelar</button>`));
}

function bindSheet() {
  $('back').onclick = closeSheet;
  document.querySelectorAll('#sheet [data-mode]').forEach(b => b.onclick = () => { teamMode = b.dataset.mode; subMode = false; renderSheet(); });
  document.querySelectorAll('#sheet [data-copy]').forEach(b => b.onclick = () => copyText(textFor(b.dataset.copy)));
  const sb = $('sub'); if (sb) sb.onclick = () => { subMode = !subMode; renderSheet(true); };

  document.querySelectorAll('#sheet [data-all]').forEach(b => b.onclick = () => {
    const t = teamOf(openTeam), all = b.dataset.all === '1';
    act(() => {
      if (all) { for (let i = 1; i <= t.t; i++) if (store.getCount(t.c, i) === 0) store.setCount(t.c, i, 1); }
      else { for (let i = 1; i <= t.t; i++) store.setCount(t.c, i, 0); }
    }, all ? 'Selección completa' : 'Selección vaciada');
  });

  let timer = null, long = false;
  const grid = document.querySelector('#sheet .grid');
  if (grid) grid.addEventListener('keydown', e => onGridKeydown(e, grid));
  document.querySelectorAll('#sheet .cell').forEach(el => {
    const n = +el.dataset.n;
    el.addEventListener('pointerdown', () => {
      long = false;
      timer = setTimeout(() => { long = true; act(() => store.setCount(openTeam, n, 0), `Figurita ${n} vaciada`); }, 480);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => el.addEventListener(ev, () => clearTimeout(timer)));
    el.onclick = () => {
      if (long) { long = false; return; }
      const cur = store.getCount(openTeam, n);
      act(() => store.setCount(openTeam, n, subMode ? cur - 1 : cur + 1));
    };
  });

  document.querySelectorAll('#sheet [data-get]').forEach(el => el.onclick = () => {
    const n = +el.dataset.get; act(() => store.setCount(openTeam, n, 1), `Figurita ${n} pegada`);
  });
  document.querySelectorAll('#sheet [data-inc]').forEach(el => el.onclick = () => {
    const n = +el.dataset.inc; act(() => store.setCount(openTeam, n, store.getCount(openTeam, n) + 1));
  });
  document.querySelectorAll('#sheet [data-dec]').forEach(el => el.onclick = () => {
    const n = +el.dataset.dec; act(() => store.setCount(openTeam, n, store.getCount(openTeam, n) - 1), 'Repe entregada');
  });
}
function onGridKeydown(e, grid) {
  const cells = [...grid.querySelectorAll('.cell')];
  const i = cells.indexOf(document.activeElement);
  if (i === -1) return;
  const cols = 5;
  const moves = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols };
  const d = moves[e.key];
  if (d === undefined) return;
  const next = cells[i + d];
  if (next) { e.preventDefault(); next.focus(); }
}

function bindTabs() {
  document.querySelectorAll('nav.tabs button').forEach(b => b.onclick = () => {
    tab = b.dataset.tab;
    document.querySelectorAll('nav.tabs button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); });
    window.scrollTo(0, 0);
    render();
  });
}

// ---------- ajustes ----------
function settingsHtml() {
  const session = sync.getSession();
  const status = sync.getStatus();
  const authBlock = session
    ? `<div class="settings-row"><span>Cuenta</span><b>${session.user.email}</b></div>
       <button class="mbtn" data-act="signout">Cerrar sesión</button>`
    : sync.isConfigured()
      ? `<p>Inicia sesión con enlace mágico para sincronizar entre tus dispositivos.</p>
         <input type="email" id="authEmail" placeholder="tu@correo.com" autocomplete="email" inputmode="email">
         <button class="mbtn dark" data-act="signin">Enviar enlace</button>`
      : `<p>La sincronización no está configurada todavía (falta config.js). La app funciona en modo local.</p>`;
  return `
  <h3>Ajustes</h3>
  <div class="settings-row"><span>Sincronización</span><span class="settings-status"><span class="sync-dot" data-status="${status}" aria-hidden="true"></span>${STATUS_LABEL[status] || status}</span></div>
  ${authBlock}
  <button class="mbtn" data-act="exp">Copiar copia de seguridad</button>
  <button class="mbtn" data-act="expfile">Descargar copia (.json)</button>
  <button class="mbtn" data-act="imp">Pegar copia de seguridad</button>
  <button class="mbtn" data-act="impfile">Restaurar desde archivo…</button>
  <input type="file" id="impFileInput" accept="application/json" hidden>
  <button class="mbtn danger" data-act="reset">Empezar de cero</button>
  <button class="mbtn" data-close="1">Cerrar</button>`;
}
function bindGear() {
  $('gear').onclick = () => showModal(settingsHtml());
}
function bindModalContent() {
  const fileInput = $('impFileInput');
  if (fileInput) fileInput.onchange = () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { store.importBackup(reader.result); hideModal(); toast('Copia restaurada'); }
      catch (e) { toast('Ese archivo no es válido'); }
    };
    reader.readAsText(file);
  };
}
function bindModal() {
  $('modal').onclick = async e => {
    if (e.target.id === 'modal' || e.target.dataset.close) return hideModal();
    const a = e.target.dataset.act;
    if (a === 'exp') { copyText(store.exportBackup()); hideModal(); }
    if (a === 'expfile') {
      const blob = new Blob([store.exportBackup()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = 'mi-album-panini.json';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    if (a === 'impfile') $('impFileInput').click();
    if (a === 'cmpgo') { const v = $('cmpIn').value; hideModal(); compare(v); }
    if (a === 'cmpcopy') { copyText(window.__cmp || ''); hideModal(); }
    if (a === 'imp') showModal(`<h3>Pegar copia</h3><p>Pega aquí el texto de tu copia de seguridad.</p>
      <textarea id="imp" placeholder='{"v":3,"rows":{...}}' aria-label="Copia de seguridad"></textarea>
      <button class="mbtn dark" data-act="impok">Restaurar</button><button class="mbtn" data-close="1">Cancelar</button>`);
    if (a === 'impok') {
      try { store.importBackup($('imp').value); hideModal(); toast('Copia restaurada'); }
      catch (err) { toast('Ese texto no es válido'); }
    }
    if (a === 'reset') showModal(`<h3>¿Empezar de cero?</h3><p>Se borrarán todas tus figuritas marcadas. No se puede deshacer.</p>
      <button class="mbtn danger" data-act="resetok">Sí, borrar todo</button><button class="mbtn" data-close="1">Cancelar</button>`);
    if (a === 'resetok') { store.resetAll(); hideModal(); closeSheet(); toast('Álbum vacío'); }
    if (a === 'signin') {
      const email = ($('authEmail').value || '').trim();
      if (!email) return;
      e.target.disabled = true; e.target.textContent = 'Enviando…';
      try { await sync.signInWithEmail(email); showModal(`<h3>Revisa tu correo</h3><p>Te hemos enviado un enlace mágico a ${email}. Ábrelo en este dispositivo para vincularlo.</p><button class="mbtn" data-close="1">Cerrar</button>`); }
      catch (err) { toast('No se pudo enviar el enlace'); hideModal(); }
    }
    if (a === 'signout') { await sync.signOut(); hideModal(); toast('Sesión cerrada'); }
  };
}

// ---------- atajos de teclado ----------
function onGlobalKeydown(e) {
  const tagName = (document.activeElement && document.activeElement.tagName) || '';
  const typing = tagName === 'INPUT' || tagName === 'TEXTAREA';
  if (e.key === '/' && !typing && tab === 'album' && !openTeam && !$('modal').classList.contains('on')) {
    e.preventDefault();
    const q = $('q'); if (q) q.focus();
  }
  if (e.key === 'Escape') {
    if ($('modal').classList.contains('on')) hideModal();
    else if (openTeam) closeSheet();
  }
}
