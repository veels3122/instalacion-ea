/* WAVE · Mudanza de puestos – app del celular */
(() => {
  const SH = window.SHARED;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const LS = {
    get(k, d) { try { const v = localStorage.getItem('wave_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('wave_' + k, JSON.stringify(v)); } catch (e) {} },
  };

  /* Fechas del proyecto */
  const MOVE_DAYS = ['2026-11-14', '2026-11-15', '2026-11-16'];
  const todayBog = () => new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).slice(0, 10);
  const autoMode = () => (todayBog() >= MOVE_DAYS[0] ? 'inst' : 'rec');

  /* ---------- Iconos ---------- */
  const IC = {
    tower: '<svg viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="20" rx="1"/><path d="M9 6h6M9 9h6"/><circle cx="12" cy="17" r="1.3"/></svg>',
    monitor: '<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="13" rx="1"/><path d="M8 21h8M12 16v5"/></svg>',
    keyboard: '<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="1"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/></svg>',
    mouse: '<svg viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 7v4"/></svg>',
    mousepad: '<svg viewBox="0 0 24 24"><path d="M3 6h18v12H3z"/><path d="M14 9h3v5h-3z"/></svg>',
    headset: '<svg viewBox="0 0 24 24"><path d="M4 15v-3a8 8 0 0116 0v3"/><rect x="2" y="14" width="5" height="7" rx="1"/><rect x="17" y="14" width="5" height="7" rx="1"/></svg>',
    cam: '<svg viewBox="0 0 24 24"><circle cx="12" cy="10" r="7"/><circle cx="12" cy="10" r="3"/><path d="M8 21h8M12 17v4"/></svg>',
    netgear: '<svg viewBox="0 0 24 24"><rect x="2" y="13" width="20" height="7" rx="1"/><path d="M6 13V6M18 13V6M6 16.5h.01M10 16.5h.01"/></svg>',
    pad: '<svg viewBox="0 0 24 24"><path d="M6 8h12a4 4 0 014 4v3a3 3 0 01-5.2 2L15 15H9l-1.8 2A3 3 0 012 15v-3a4 4 0 014-4z"/><path d="M7 11v3M5.5 12.5h3M16 12h.01M18 13.5h.01"/></svg>',
    camera: '<svg viewBox="0 0 24 24"><path d="M4 7h3l2-3h6l2 3h3v13H4z"/><circle cx="12" cy="13" r="4"/></svg>',
    image: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="1"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
    xls: '<svg viewBox="0 0 24 24"><path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 11l5 6M14 11l-5 6"/></svg>',
    zip: '<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="M12 4v2M12 8v2M12 12v2"/><rect x="10.5" y="14" width="3" height="3"/></svg>',
    save: '<svg viewBox="0 0 24 24"><path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/></svg>',
    user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></svg>',
    refresh: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/></svg>',
    warn: '<svg viewBox="0 0 24 24"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/></svg>',
  };

  /* ---------- Estado ---------- */
  const S = {
    base: [], byId: {}, desks: {}, photos: [], rev: null, store: '',
    user: LS.get('user', ''),
    mode: (() => { const o = LS.get('modeOverride', null); return o && o.day === todayBog() ? o.mode : autoMode(); })(),
    tab: 'pending', q: '', fr: 'all', sort: LS.get('sort', 'order'),
    open: null, cur: null, curVersion: 0,
    queue: LS.get('queue', {}), // id -> {data, baseVersion}
    saving: false, online: true, uploads: [],
    viewer: null,
  };

  const deskData = (id) => (S.desks[id] && S.desks[id].data) || { rec: SH.emptyRec(), inst: {} };
  const normData = (d) => {
    d = d || {};
    d.rec = Object.assign(SH.emptyRec(), d.rec || {});
    d.rec.tags = Object.assign({ pc: '', m1: '', m2: '' }, d.rec.tags || {});
    d.rec.mon = d.rec.mon && d.rec.mon.length === 2 ? d.rec.mon : [{}, {}];
    d.rec.comps = d.rec.comps || {};
    d.rec.consoles = d.rec.consoles || [];
    d.inst = d.inst || {};
    d.inst.checks = d.inst.checks || {};
    return d;
  };
  const photosOf = (id, phase) => S.photos.filter((p) => p.desk === id && (!phase || p.phase === phase));
  function recStatus(id) {
    const d = deskData(id);
    if (d.rec && d.rec.status === 'done') return 'done';
    if (SH.recHasContent(d.rec) || photosOf(id, 'rec').length) return 'draft';
    return 'pending';
  }
  function instStatus(id) {
    const d = deskData(id);
    if (d.inst && d.inst.done) return 'done';
    if ((d.inst && Object.values(d.inst.checks || {}).some(Boolean)) || photosOf(id, 'inst').length) return 'draft';
    return 'pending';
  }
  const statusOf = (id) => (S.mode === 'rec' ? recStatus(id) : instStatus(id));

  /* ---------- Red ---------- */
  async function api(method, url, body) {
    const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    let j = null;
    try { j = await r.json(); } catch (e) {}
    if (!r.ok) { const e = new Error((j && j.error) || 'HTTP ' + r.status); e.status = r.status; e.body = j; throw e; }
    return j;
  }
  function setOnline(v) {
    if (S.online === v) return;
    S.online = v;
    $('#userChip').classList.toggle('off', !v);
    if (!v) toast('Sin conexión — los cambios se guardan cuando vuelva', 'warn');
    else toast('Conexión restablecida');
  }

  let writeSeq = 0; // sube con cada escritura local → descarta respuestas viejas
  async function loadState(force) {
    const seq = writeSeq;
    try {
      const j = await api('GET', '/api/state' + (!force && S.rev ? '?rev=' + S.rev : ''));
      setOnline(true);
      if (j.same) return false;
      if (seq !== writeSeq || S.saving || Object.keys(S.queue).length || S.uploads.length) return false; // llegó tarde: se vuelve a pedir en el próximo ciclo
      S.rev = j.rev; S.base = j.base; S.desks = j.desks; S.photos = j.photos; S.store = j.store;
      S.byId = Object.fromEntries(S.base.map((d) => [d.id, d]));
      LS.set('cache', { base: j.base, desks: j.desks, photos: j.photos, at: Date.now() });
      // si alguien más cambió el puesto abierto y yo no tengo cambios pendientes → refrescar
      if (S.open && !S.queue[S.open]) {
        const sv = S.desks[S.open] ? S.desks[S.open].version : 0;
        if (sv > S.curVersion) {
          S.cur = normData(clone(deskData(S.open))); S.curVersion = sv;
          renderDetail(true);
          const by = S.desks[S.open] && S.desks[S.open].updatedBy;
          if (by && by !== S.user) toast(`${by} actualizó este puesto`);
        } else renderDetail(true);
      }
      renderAll();
      return true;
    } catch (e) {
      setOnline(false);
      return false;
    }
  }

  /* Guardado con cola (soporta perder señal) */
  let saveTimer = null;
  function queueSave(immediate) {
    if (!S.open) return;
    S.queue[S.open] = { data: clone(S.cur), baseVersion: S.curVersion };
    LS.set('queue', S.queue);
    setSaveInd('saving');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, immediate ? 0 : 650);
  }
  async function flush() {
    if (S.saving) return;
    const ids = Object.keys(S.queue);
    if (!ids.length) return;
    S.saving = true;
    for (const id of ids) {
      const q = S.queue[id];
      try {
        const r = await api('PUT', '/api/desks/' + id, { data: q.data, baseVersion: q.baseVersion, user: S.user });
        writeSeq++;
        S.desks[id] = { data: q.data, version: r.version, updatedAt: r.updatedAt, updatedBy: S.user };
        if (S.queue[id] === q) delete S.queue[id];
        else S.queue[id].baseVersion = r.version; // se editó mientras guardaba
        if (S.open === id) S.curVersion = r.version;
        setOnline(true);
      } catch (e) {
        if (e.status === 409) {
          const cur = e.body && e.body.current;
          delete S.queue[id];
          if (cur) S.desks[id] = cur;
          if (S.open === id) {
            S.cur = normData(clone(deskData(id))); S.curVersion = cur ? cur.version : 0;
            renderDetail(true);
          }
          toast(`${(cur && cur.updatedBy) || 'Otra persona'} guardó este puesto al mismo tiempo. Se cargó su versión: revisa y vuelve a marcar.`, 'warn', 6000);
        } else if (e.status === 404 || e.status === 400) {
          delete S.queue[id];
        } else {
          setOnline(false);
          S.saving = false;
          LS.set('queue', S.queue);
          setSaveInd('err');
          setTimeout(flush, 4000);
          return;
        }
      }
    }
    LS.set('queue', S.queue);
    S.saving = false;
    if (Object.keys(S.queue).length) return flush();
    setSaveInd('ok');
    renderAll();
  }
  function setSaveInd(st) {
    const el = $('#saveInd');
    el.className = 'save-ind ' + st;
    el.textContent = st === 'saving' ? 'Guardando' : st === 'err' ? 'Sin señal · pendiente' : st === 'ok' ? 'Guardado' : '';
  }

  /* ---------- Toast / modal / banner ---------- */
  function toast(msg, kind = '', ms = 3000) {
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
  }
  function modal(html, onAct) {
    const m = $('#modal');
    m.innerHTML = `<div class="m-card">${html}</div>`;
    m.classList.add('open');
    m.setAttribute('aria-hidden', 'false');
    m.onclick = (ev) => {
      if (ev.target === m) return closeModal();
      const b = ev.target.closest('[data-m]');
      if (b && onAct) onAct(b.dataset.m, b, m);
    };
    const inp = m.querySelector('input');
    if (inp) setTimeout(() => inp.focus(), 250);
  }
  function closeModal() { const m = $('#modal'); m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); m.innerHTML = ''; }
  function confirmBox(title, text, list, okLabel) {
    return new Promise((res) => {
      modal(`<h2>${esc(title)}</h2>${text ? `<p>${text}</p>` : ''}${list && list.length ? `<ul>${list.join('')}</ul>` : ''}
        <div class="m-btns"><button data-m="no">Volver</button>${okLabel ? `<button class="pri" data-m="yes">${esc(okLabel)}</button>` : ''}</div>`,
      (a) => { closeModal(); res(a === 'yes'); });
    });
  }
  function banner(small, big, ok) {
    const b = $('#banner');
    b.innerHTML = `<div class="bg"></div><div class="band ${ok ? 'ok' : ''}"><small>${esc(small)}</small><b>${esc(big)}</b></div>`;
    b.classList.add('show');
    if (navigator.vibrate) navigator.vibrate([30, 40, 60]);
    setTimeout(() => b.classList.remove('show'), 1950);
  }

  /* ---------- Usuario ---------- */
  function askUser(first) {
    modal(`<h2>${first ? '¿Quién eres?' : 'Cambiar nombre'}</h2>
      <p>Tu nombre queda registrado en cada puesto que guardes, para saber quién hizo qué.</p>
      <input class="inp" id="uName" maxlength="30" placeholder="Ej: Mateo" value="${esc(S.user)}" autocomplete="name">
      <div class="m-btns">${first ? '' : '<button data-m="no">Cancelar</button>'}<button class="pri" data-m="ok">Entrar</button></div>`,
    (a, b, m) => {
      if (a === 'no') return closeModal();
      const v = m.querySelector('#uName').value.trim();
      if (!v) { m.querySelector('#uName').classList.add('bad'); return; }
      S.user = v; LS.set('user', v); closeModal(); renderHeader();
    });
    const m = $('#modal');
    m.querySelector('#uName').addEventListener('keydown', (e) => { if (e.key === 'Enter') m.querySelector('[data-m="ok"]').click(); });
    if (first) m.onclick = (ev) => { const b = ev.target.closest('[data-m]'); if (b) { const v = m.querySelector('#uName').value.trim(); if (v) { S.user = v; LS.set('user', v); closeModal(); renderHeader(); } else m.querySelector('#uName').classList.add('bad'); } };
  }

  function openMenu() {
    const local = S.store && S.store.indexOf('local') >= 0;
    modal(`<h2>Menú</h2>
      ${local ? `<div class="alert red" style="margin:0 0 12px">${IC.warn}<div><b>Modo prueba:</b> el servidor no tiene base de datos conectada. Lo que se guarde se puede borrar. Configura DATABASE_URL en Render.</div></div>` : ''}
      <div class="menu-list">
        <button data-m="xlsx">${IC.xls}<span>Exportar Excel<small>Mismo archivo, con Comment / PC / Monitores / Consolas llenos</small></span></button>
        <button data-m="zip">${IC.zip}<span>Descargar todas las fotos<small>ZIP organizado por puesto</small></span></button>
        <button data-m="json">${IC.save}<span>Respaldo completo<small>Archivo .json con todos los datos</small></span></button>
        <button data-m="refresh">${IC.refresh}<span>Recargar datos<small>Traer lo último que guardaron los demás</small></span></button>
        <button data-m="user">${IC.user}<span>Cambiar mi nombre<small>Ahora: ${esc(S.user)}</small></span></button>
      </div>
      <div class="m-btns"><button data-m="no">Cerrar</button></div>`,
    (a) => {
      closeModal();
      if (a === 'xlsx') download('/api/export.xlsx', 'Generando Excel…');
      if (a === 'zip') download('/api/export/photos.zip', 'Preparando fotos… puede tardar');
      if (a === 'json') download('/api/backup.json', 'Descargando respaldo…');
      if (a === 'refresh') loadState(true).then(() => toast('Datos actualizados'));
      if (a === 'user') askUser(false);
    });
  }
  function download(url, msg) {
    toast(msg);
    const a = document.createElement('a');
    a.href = url + '?t=' + Date.now();
    a.download = '';
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- Header / lista ---------- */
  function renderHeader() {
    $('#userName').textContent = S.user || '—';
    const t = todayBog();
    const dayIdx = MOVE_DAYS.indexOf(t);
    const days = Math.round((new Date(MOVE_DAYS[0] + 'T00:00:00') - new Date(t + 'T00:00:00')) / 86400000);
    const d = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota', weekday: 'short', day: 'numeric', month: 'short' });
    let sub = d + ' · ';
    if (dayIdx >= 0) sub += `Mudanza día ${dayIdx + 1} de 3`;
    else if (days > 0) sub += `Faltan ${days} día${days > 1 ? 's' : ''} para la mudanza`;
    else sub += 'Mudanza finalizada';
    $('#phaseSub').textContent = sub;
    const am = autoMode();
    document.querySelectorAll('#phaseSwitch button').forEach((b) => {
      b.classList.toggle('on', b.dataset.v === S.mode);
      const old = b.querySelector('.today'); if (old) old.remove();
      if (b.dataset.v === am) b.insertAdjacentHTML('beforeend', '<span class="today">HOY</span>');
    });
    const total = S.base.length || 0;
    let done = 0, draft = 0;
    S.base.forEach((x) => { const s = statusOf(x.id); if (s === 'done') done++; else if (s === 'draft') draft++; });
    const pct = total ? (done / total) * 100 : 0;
    const pctD = total ? ((done + draft) / total) * 100 : 0;
    $('#stats').innerHTML = `<div class="big">${done}<small>/${total}</small></div>
      <div class="bar"><em style="width:${pctD}%"></em><i style="width:${pct}%"></i></div>
      <div class="lbl">${S.mode === 'rec' ? 'Registrados' : 'Instalados'}<br>${draft ? `<b>${draft} en progreso</b>` : Math.round(pct) + '%'}</div>`;
  }

  function matches(d, q) {
    if (!q) return true;
    const data = deskData(d.id);
    const hay = norm([d.provisional, d.newDesk, d.oldDesk, d.name, d.email, d.franchise,
      ...(data.rec.consoles || []).map(SH.consoleLabel), data.rec.tags && data.rec.tags.pc, data.rec.tags && data.rec.tags.m1, data.rec.tags && data.rec.tags.m2].join(' '));
    return norm(q).split(/\s+/).every((t) => hay.includes(t));
  }
  function renderList() {
    const q = S.q.trim();
    $('.search').classList.toggle('has', !!q);
    const inMode = S.mode;
    const keyNum = (d) => Number(inMode === 'rec' ? d.provisional : d.newDesk) || 0;
    const all = S.base.filter((d) => (S.fr === 'all' || d.franchise === S.fr) && matches(d, q));
    const pend = all.filter((d) => statusOf(d.id) !== 'done');
    const done = all.filter((d) => statusOf(d.id) === 'done');
    const doneAt = (d) => { const x = deskData(d.id); return (inMode === 'rec' ? x.rec.doneAt : x.inst.at) || 0; };
    // orden de realizados: #1 = primero que se terminó
    const orderMap = {};
    S.base.filter((d) => statusOf(d.id) === 'done').sort((a, b) => doneAt(a) - doneAt(b)).forEach((d, i) => (orderMap[d.id] = i + 1));
    pend.sort((a, b) => { const sa = statusOf(a.id) === 'draft' ? 0 : 1, sb = statusOf(b.id) === 'draft' ? 0 : 1; return sa - sb || keyNum(a) - keyNum(b); });
    if (S.sort === 'order') done.sort((a, b) => doneAt(b) - doneAt(a)); else done.sort((a, b) => keyNum(a) - keyNum(b));

    $('#tabs').innerHTML = `<button class="${S.tab === 'pending' ? 'on' : ''}" data-act="tab" data-v="pending">${inMode === 'rec' ? 'Por registrar' : 'Por instalar'}<span class="n">${pend.length}</span></button>
      <button class="${S.tab === 'done' ? 'on' : ''}" data-act="tab" data-v="done">${inMode === 'rec' ? 'Registrados' : 'Instalados'}<span class="n">${done.length}</span></button>`;
    const frs = ['all', ...new Set(S.base.map((d) => d.franchise))];
    $('#filters').innerHTML = frs.map((f) => `<button class="chip ${S.fr === f ? 'on' : ''}" data-act="fr" data-v="${esc(f)}">${f === 'all' ? 'Todos' : esc(f)}</button>`).join('') +
      (S.tab === 'done' ? `<span class="sep"></span><button class="chip ${S.sort === 'order' ? 'on' : ''}" data-act="sort" data-v="order">Recientes</button><button class="chip ${S.sort === 'num' ? 'on' : ''}" data-act="sort" data-v="num">Por número</button>` : '');

    const list = S.tab === 'pending' ? pend : done;
    if (!S.base.length) { $('#cards').innerHTML = '<div class="loading">Cargando puestos</div>'; return; }
    if (!list.length) {
      $('#cards').innerHTML = `<div class="empty"><b>${q ? 'Sin resultados' : S.tab === 'pending' ? '¡Todo listo!' : 'Nada aún'}</b>${q ? 'Prueba con otro número o nombre' : S.tab === 'pending' ? 'No queda ningún puesto pendiente' : 'Los puestos terminados aparecen aquí en orden'}</div>`;
      return;
    }
    $('#cards').innerHTML = list.map((d, i) => cardHtml(d, i, orderMap[d.id])).join('');
  }
  function cardHtml(d, i, order) {
    const st = statusOf(d.id);
    const data = deskData(d.id);
    const isRec = S.mode === 'rec';
    const num = isRec ? d.provisional : d.newDesk;
    const other = isRec ? `<span class="arrow">Nuevo <b>${esc(d.newDesk)}</b></span>` : `<span class="arrow">Desde <b>${esc(d.provisional)}</b></span>`;
    const badges = [];
    if (st === 'draft') {
      const by = S.desks[d.id] && S.desks[d.id].updatedBy;
      badges.push(`<span class="badge amber">En progreso${by ? ' · ' + esc(by) : ''}</span>`);
    }
    if (st === 'done') {
      const x = isRec ? data.rec : data.inst;
      badges.push(`<span class="badge ok">${SH.fmtDate(isRec ? x.doneAt : x.at)} · ${esc(isRec ? x.doneBy : x.by)}</span>`);
    }
    if (!isRec && recStatus(d.id) !== 'done') badges.push('<span class="badge red">Sin registro</span>');
    const pc = photosOf(d.id, 'rec').length;
    if (pc) badges.push(`<span class="badge">${pc} foto${pc > 1 ? 's' : ''}</span>`);
    if (data.rec.consoles && data.rec.consoles.length) badges.push(`<span class="badge">${data.rec.consoles.length} consola${data.rec.consoles.length > 1 ? 's' : ''}</span>`);
    return `<button class="card st-${st}" data-act="open" data-id="${esc(d.id)}" style="animation-delay:${Math.min(i, 14) * 28}ms">
      <span class="c-side"></span>
      <span class="c-num">${esc(num)}<small>${isRec ? 'Provisional' : 'Puesto nuevo'}</small></span>
      <span class="c-info"><span class="c-name">${esc(d.name)}</span>
        <span class="c-meta"><span>${esc(d.franchise)}</span>${other}</span>
        <span class="c-meta">${badges.join('')}</span></span>
      ${order && S.tab === 'done' ? `<span class="c-order">#${order}</span>` : ''}
    </button>`;
  }
  function renderAll() { renderHeader(); renderList(); }

  /* ---------- Detalle ---------- */
  function openDesk(id) {
    S.open = id;
    S.cur = normData(clone(S.queue[id] ? S.queue[id].data : deskData(id)));
    S.curVersion = S.queue[id] ? S.queue[id].baseVersion : (S.desks[id] ? S.desks[id].version : 0);
    renderDetail();
    const el = $('#detail');
    el.classList.add('open', 'anim'); el.setAttribute('aria-hidden', 'false');
    clearTimeout(openDesk.t); openDesk.t = setTimeout(() => el.classList.remove('anim'), 900);
    $('#dBody').scrollTop = 0;
    setSaveInd(S.queue[id] ? 'err' : '');
    if (location.hash !== '#' + id) history.pushState({ desk: id }, '', '#' + id);
  }
  function closeDesk(fromPop) {
    if (S.open && S.queue[S.open]) { clearTimeout(saveTimer); flush(); }
    S.open = null; S.cur = null;
    const el = $('#detail');
    el.classList.remove('open'); el.setAttribute('aria-hidden', 'true');
    if (!fromPop && location.hash) history.back();
    renderAll();
  }

  function renderDetail(keepScroll) {
    if (!S.open) return;
    const body = $('#dBody');
    const st = body.scrollTop;
    const d = S.byId[S.open];
    if (!d) return;
    $('#dTitle').textContent = `${d.franchise} · ${S.mode === 'rec' ? 'Registro' : 'Mudanza'}`;
    body.innerHTML = S.mode === 'rec' ? recView(d) : instView(d);
    $('#dFoot').innerHTML = `<div>${S.mode === 'rec' ? recFoot(d) : instFoot(d)}</div>`;
    if (keepScroll) body.scrollTop = st;
  }

  function heroHtml(d) {
    const isRec = S.mode === 'rec';
    return `<div class="hero">
      <div class="h-lbl">${isRec ? 'Puesto provisional' : 'Puesto nuevo · instalar aquí'}</div>
      <div class="h-num">${esc(isRec ? d.provisional : d.newDesk)}</div>
      <div class="h-to"><small>${isRec ? 'Se va para' : 'Viene de provisional'}</small><b>${esc(isRec ? d.newDesk : d.provisional)}</b></div>
      <div class="h-name">${esc(d.name)}</div>
      <div class="h-meta"><span>${esc(d.franchise)}</span><span>${esc(d.email)}</span><span>Edif. anterior: ${esc(d.oldDesk || '—')}</span></div>
    </div>`;
  }
  function excelRef(d) {
    const o = d.orig || {};
    const rows = [['Comment', o.comment], ['PC', o.pc], ['Monitor 1', o.m1], ['Monitor 2', o.m2], ['Consola 1', o.c1], ['Consola 2', o.c2], ['Consola 3', o.c3], ['Consola 4', o.c4]].filter((r) => r[1]);
    if (!rows.length) return '';
    return `<details class="excel-ref"><summary>Lo que dice el Excel hoy (sin verificar)</summary>
      <dl>${rows.map((r) => `<dt>${r[0]}</dt><dd>${esc(r[1])}</dd>`).join('')}</dl></details>`;
  }
  const secH = (idx, title, aside, cls) => `<div class="sec-h"><span class="idx">${idx}</span><h3>${title}</h3><span class="line"></span>${aside ? `<span class="aside ${cls || ''}">${aside}</span>` : ''}</div>`;

  /* ----- Vista REGISTRO ----- */
  function recView(d) {
    const r = S.cur.rec;
    const tiles = SH.PERIPH.map((p) => `<button class="tile ${r.comps[p.id] ? 'on' : ''}" data-act="comp" data-v="${p.id}">${IC[p.id]}<span>${p.short}</span></button>`).join('');
    const nCons = r.consoles.length;
    const recPhotos = photosOf(d.id, 'rec');
    const nPh = recPhotos.length + S.uploads.filter((u) => u.desk === d.id && u.phase === 'rec').length;

    let html = heroHtml(d) + excelRef(d);
    html += `<div class="sec">${secH('01', 'Componentes', 'Toca lo que SÍ tiene')}
      <div class="comp-grid">${tiles}</div>
      ${r.comps.tower ? `<label class="field"><span>Tag de la torre (opcional)</span><input class="inp" data-in="tag" data-k="pc" value="${esc(r.tags.pc)}" placeholder="Ej: 80031234" autocapitalize="characters" autocomplete="off"></label>` : ''}
    </div>`;

    html += `<div class="sec">${secH('02', 'Monitores', r.monitors ? `${r.monitors} monitor${r.monitors > 1 ? 'es' : ''}` : 'Ninguno')}
      <div class="seg">${[0, 1, 2].map((n) => `<button class="opt big ${r.monitors === n ? 'on' : ''}" data-act="mons" data-v="${n}">${n}</button>`).join('')}</div>
      ${[0, 1].filter((i) => i < r.monitors).map((i) => monitorBox(i)).join('')}
    </div>`;

    html += `<div class="sec">${secH('03', 'Consolas', nCons ? `${nCons} de 4` : 'Ninguna')}
      ${r.consoles.map((c, i) => consoleBox(c, i)).join('')}
      <button class="add-btn" data-act="addcons" ${nCons >= 4 ? 'disabled' : ''}>${IC.plus} Agregar consola</button>
    </div>`;

    html += `<div class="sec">${secH('04', 'Fotos', nPh ? `${nPh} foto${nPh > 1 ? 's' : ''}` : 'Mínimo 1 · obligatorio', nPh ? 'okk' : 'req')}
      <p class="hint">Toma fotos de cómo está conectado todo: de frente, la parte de atrás de la torre y de los monitores.</p>
      ${photoGrid(d.id, 'rec')}
      <div class="ph-actions"><button class="ph-btn primary" data-act="cam" data-phase="rec">${IC.camera} Tomar foto</button><button class="ph-btn" data-act="gal" data-phase="rec">${IC.image} Galería</button></div>
    </div>`;

    html += `<div class="sec">${secH('05', 'Comentarios', 'Algo fuera de lo normal')}
      <textarea class="inp" data-in="note" placeholder="Ej: tiene un hub USB extra, cable HDMI largo, adaptador DP a HDMI…">${esc(r.note)}</textarea>
    </div>`;
    html += `<div class="sec">${secH('06', 'Así queda en el Excel')}<div class="note-box" id="xlPrev">${esc(SH.buildComment(S.cur, recPhotos.length))}</div></div>`;
    return html;
  }

  function monitorBox(i) {
    const r = S.cur.rec;
    const m = r.mon[i] || {};
    const other = r.mon[1 - i] || {};
    const otherActive = r.monitors === 2;
    const consOnMe = r.consoles.filter((c) => String(c.mon) === String(i + 1) && c.input);
    const inputs = SH.MON_INPUTS.map((inp) => {
      const cons = consOnMe.find((c) => c.input === inp.id);
      return `<button class="opt ${m.input === inp.id ? 'on' : ''} ${cons ? 'used' : ''}" data-act="minput" data-i="${i}" data-v="${inp.id}">${inp.label}</button>`;
    }).join('');
    const tag = r.tags['m' + (i + 1)];
    return `<div class="box">
      <div class="box-h"><span class="tag m${i + 1}">M${i + 1}</span><span class="ttl">Monitor ${i + 1}</span></div>
      <div class="sub-l">Posición en el escritorio</div>
      <div class="seg sm">${SH.MON_POS.map((p) => `<button class="opt ${m.pos === p.id ? 'on' : ''}" data-act="mpos" data-i="${i}" data-v="${p.id}">${p.label}</button>`).join('')}</div>
      <label class="field"><span>Tag del monitor (opcional)</span><input class="inp" data-in="tag" data-k="m${i + 1}" value="${esc(tag)}" placeholder="Ej: 80029876" autocapitalize="characters" autocomplete="off"></label>
      <div class="sub-l">① Puerto en el MONITOR ${m.input ? `<b>→ ${SH.inputLabel(m.input)}</b>` : '<span class="warn">sin elegir</span>'}</div>
      <div class="seg sm">${inputs}</div>
      <div class="sub-l">② Sigue el cable · puerto en la TORRE ${m.tower ? `<b>→ ${SH.towerLabel(m.tower)}</b>` : '<span class="warn">sin elegir</span>'}</div>
      ${towerHtml({ sel: m.tower, mine: i, other: otherActive ? other.tower : null, otherIdx: 1 - i })}
    </div>`;
  }

  function towerHtml(o) {
    const port = (p) => {
      let cls = `port k-${p.kind}`, who = '';
      if (o.readonly) {
        const hit = o.used[p.id];
        if (hit) { cls += ` ro mc${hit}`; who = `<span class="who">M${hit}</span>`; } else cls += ' ro';
        return `<div class="${cls}">${p.short}${who}</div>`;
      }
      if (o.sel === p.id) { cls += ` sel mc${o.mine + 1}`; who = `<span class="who">M${o.mine + 1}</span>`; }
      else if (o.other === p.id) { cls += ' used'; who = `<span class="who">M${o.otherIdx + 1}</span>`; }
      return `<button class="${cls}" data-act="mtower" data-i="${o.mine}" data-v="${p.id}">${p.short}${who}</button>`;
    };
    const mb = SH.TOWER_PORTS.filter((p) => p.zone === 'mb').map(port).join('');
    const gpu = SH.TOWER_PORTS.filter((p) => p.zone === 'gpu').map(port).join('');
    return `<div class="tower">
      <div class="tw-cap"><span>Parte trasera de la torre</span><span>▲ arriba</span></div>
      <div class="tw-zone mb"><div class="zl"><b>Arriba</b> · placa base</div><div class="tw-ports">${mb}</div></div>
      <div class="tw-vents"></div>
      <div class="tw-zone gpu"><div class="zl"><b>Abajo</b> · tarjeta de video (de izq. a der.)</div><div class="tw-ports">${gpu}</div></div>
    </div>`;
  }

  function consoleBox(c, i) {
    const r = S.cur.rec;
    const tagOk = (c.tag || '').trim().length >= 4;
    const label = c.type ? SH.consoleLabel(c) : '';
    const monChoices = [];
    for (let k = 1; k <= r.monitors; k++) monChoices.push(`<button class="opt ${String(c.mon) === String(k) ? 'on' : ''}" data-act="cmon" data-i="${i}" data-v="${k}">Monitor ${k}</button>`);
    monChoices.push(`<button class="opt ${c.mon === 'none' ? 'on' : ''}" data-act="cmon" data-i="${i}" data-v="none">Otro / ninguno</button>`);
    let inputs = '';
    if (c.mon && c.mon !== 'none') {
      const mi = Number(c.mon) - 1;
      const pcIn = (r.mon[mi] || {}).input;
      const takenBy = (id) => r.consoles.some((o, j) => j !== i && String(o.mon) === String(c.mon) && o.input === id);
      inputs = `<div class="sub-l">Puerto en el monitor ${c.mon}</div><div class="seg sm">${SH.MON_INPUTS.map((inp) =>
        `<button class="opt ${c.input === inp.id ? 'on' : ''} ${pcIn === inp.id || takenBy(inp.id) ? 'used' : ''}" data-act="cinput" data-i="${i}" data-v="${inp.id}">${inp.label}</button>`).join('')}</div>`;
    }
    return `<div class="box">
      <div class="box-h"><span class="tag c">C${i + 1}</span><span class="ttl">Consola ${i + 1}</span><button class="rm" data-act="rmcons" data-i="${i}" aria-label="Quitar">${IC.x}</button></div>
      <div class="cons-preview ${label && tagOk ? '' : 'empty'}" data-prev="${i}">${label && tagOk ? esc(label) : esc(label || 'TIPO') + '-' + (c.tag ? esc(c.tag) : '????????')}</div>
      <div class="sub-l">Tipo ${c.type ? '' : '<span class="warn">obligatorio</span>'}</div>
      <div class="seg sm">${SH.CONSOLE_TYPES.map((t) => `<button class="opt ${c.type === t ? 'on' : ''}" data-act="ctype" data-i="${i}" data-v="${t}">${t === 'OTRO' ? 'Otro' : t}</button>`).join('')}</div>
      ${c.type === 'OTRO' ? `<label class="field"><span>¿Qué es? <span class="req">*</span></span><input class="inp" data-in="cother" data-i="${i}" value="${esc(c.other || '')}" placeholder="Ej: STEAMDECK" autocapitalize="characters"></label>` : ''}
      <label class="field"><span>Tag / Asset ID <span class="req">* obligatorio</span></span><input class="inp ${tagOk ? '' : 'bad'}" data-in="ctag" data-i="${i}" value="${esc(c.tag || '')}" placeholder="Ej: 80031223" inputmode="text" autocapitalize="characters" autocomplete="off"></label>
      <div class="sub-l">Versión (opcional)</div>
      <div class="seg sm">${SH.VARIANTS.map((v) => `<button class="opt ${c.variant === v ? 'on' : ''}" data-act="cvar" data-i="${i}" data-v="${v}">${v}</button>`).join('')}</div>
      <div class="sub-l">¿A qué está conectada?</div>
      <div class="seg sm">${monChoices.join('')}</div>
      ${inputs}
    </div>`;
  }

  function photoGrid(id, phase, big) {
    const ps = photosOf(id, phase);
    const ups = S.uploads.filter((u) => u.desk === id && u.phase === phase);
    if (!ps.length && !ups.length) {
      return phase === 'rec' && S.mode === 'rec' ? `<div class="photos"><div class="ph-empty">${IC.camera} Aún no hay fotos. Sin foto no se puede marcar como registrado.</div></div>` : `<div class="photos"><div class="ph-empty" style="border-color:var(--line2);color:var(--muted);background:none">${IC.image} Sin fotos</div></div>`;
    }
    return `<div class="photos ${big ? 'ph-big' : ''}">${ps.map((p) => `<button class="ph" data-act="view" data-pid="${p.id}" style="background-image:url('/api/photos/${p.id}?t=1')"><span class="by">${esc(p.by)} · ${SH.fmtDate(p.at)}</span></button>`).join('')}
      ${ups.map((u) => `<button class="ph ${u.failed ? 'fail' : 'up'}" data-act="retry" data-uid="${u.uid}" style="background-image:url('${u.thumb}')"></button>`).join('')}</div>`;
  }

  function recFoot(d) {
    const done = S.cur.rec.status === 'done';
    if (done) return `<button class="btn-main done" data-act="recdone">✓ Registrado</button><button class="btn-ghost" data-act="reopen">Reabrir</button>`;
    return `<button class="btn-main" data-act="recdone">Marcar registrado</button>`;
  }

  /* ----- Vista MUDANZA ----- */
  function checkItems() {
    const r = S.cur.rec;
    const items = [];
    if (r.comps.tower) items.push({ k: 'tower', t: 'Torre (PC)', s: r.tags.pc ? 'Tag ' + r.tags.pc : '' });
    for (let i = 0; i < r.monitors; i++) {
      const m = r.mon[i] || {};
      items.push({ k: 'm' + i, t: `Monitor ${i + 1}${m.pos ? ' · ' + SH.posLabel(m.pos) : ''}`, s: r.tags['m' + (i + 1)] ? 'Tag ' + r.tags['m' + (i + 1)] : '', tag: 'M' + (i + 1) });
    }
    r.consoles.forEach((c, i) => items.push({ k: 'c' + i, t: SH.consoleLabel(c), s: [c.variant, c.mon && c.mon !== 'none' ? `→ Monitor ${c.mon}${c.input ? ' ' + SH.inputLabel(c.input) : ''}` : ''].filter(Boolean).join(' · '), tag: 'C' + (i + 1) }));
    SH.PERIPH.filter((p) => p.id !== 'tower' && r.comps[p.id]).forEach((p) => items.push({ k: 'p_' + p.id, t: p.label }));
    for (let i = 0; i < r.monitors; i++) {
      const m = r.mon[i] || {};
      if (m.input || m.tower) items.push({ k: 'x' + i, t: `Cable M${i + 1}: ${SH.inputLabel(m.input) || '?'} → ${SH.towerLabel(m.tower) || '?'}`, s: 'Monitor → torre' });
    }
    return items;
  }
  function instView(d) {
    const r = S.cur.rec;
    const inst = S.cur.inst;
    const registered = r.status === 'done';
    let html = heroHtml(d);
    if (!registered) html += `<div class="alert red">${IC.warn}<div>Este puesto <b>no fue marcado como registrado</b>${SH.recHasContent(r) ? ' (quedó en progreso). Revisa los datos con cuidado.' : '. No hay datos guardados; usa el Excel original como referencia.'}</div></div>` + excelRef(d);

    const items = checkItems();
    const nOk = items.filter((it) => inst.checks[it.k]).length;
    html += `<div class="sec">${secH('01', 'Verificar', items.length ? `${nOk}/${items.length} confirmados` : '', nOk === items.length && items.length ? 'okk' : '')}
      <p class="hint">Toca cada cosa a medida que la confirmas en el puesto nuevo.</p>
      <div class="checks">${items.length ? items.map((it) => `<button class="chk ${inst.checks[it.k] ? 'on' : ''}" data-act="chk" data-k="${it.k}"><span class="bx">${IC.check}</span><span class="t"><b>${esc(it.t)}</b>${it.s ? `<small>${esc(it.s)}</small>` : ''}</span>${it.tag ? `<span class="k">${it.tag}</span>` : ''}</button>`).join('') : '<div class="note-box">No hay componentes registrados.</div>'}</div>
    </div>`;

    if (r.monitors || r.consoles.length) {
      const used = {};
      for (let i = 0; i < r.monitors; i++) if (r.mon[i] && r.mon[i].tower) used[r.mon[i].tower] = i + 1;
      let conns = '';
      for (let i = 0; i < r.monitors; i++) {
        const m = r.mon[i] || {};
        conns += `<div class="conn"><span class="tag m${i + 1}">M${i + 1}</span><span class="path"><b>${SH.inputLabel(m.input) || '¿?'}</b> <span>del monitor${m.pos ? ' (' + SH.posLabel(m.pos).toLowerCase() + ')' : ''} →</span> <b>${SH.towerLabel(m.tower) || '¿?'}</b> <span>de la torre</span></span></div>`;
      }
      r.consoles.forEach((c, i) => {
        conns += `<div class="conn"><span class="tag c">C${i + 1}</span><span class="path"><b>${esc(SH.consoleLabel(c))}</b> <span>→</span> ${c.mon && c.mon !== 'none' ? `<b>Monitor ${c.mon}</b> <span>puerto</span> <b>${SH.inputLabel(c.input) || '¿?'}</b>` : '<span>sin monitor asignado</span>'}</span></div>`;
      });
      html += `<div class="sec">${secH('02', 'Conexiones')}
        ${conns}
        <div style="margin-top:12px">${towerHtml({ readonly: true, used })}</div>
      </div>`;
    }

    html += `<div class="sec">${secH('03', 'Fotos de referencia', photosOf(d.id, 'rec').length + ' fotos')}
      <p class="hint">Así estaba conectado. Toca una foto para verla en grande.</p>${photoGrid(d.id, 'rec', true)}</div>`;
    if ((r.note || '').trim()) html += `<div class="sec">${secH('04', 'Comentario del registro')}<div class="note-box">${esc(r.note)}</div></div>`;

    html += `<div class="sec">${secH('05', 'Instalación', 'Opcional')}
      <p class="hint">Si quieres, deja una foto de cómo quedó en el puesto nuevo, o una nota.</p>
      ${photoGrid(d.id, 'inst')}
      <div class="ph-actions"><button class="ph-btn" data-act="cam" data-phase="inst">${IC.camera} Foto</button><button class="ph-btn" data-act="gal" data-phase="inst">${IC.image} Galería</button></div>
      <label class="field"><span>Nota de instalación</span><textarea class="inp" data-in="inote" placeholder="Ej: faltó cable HDMI, se usó uno nuevo">${esc(inst.note || '')}</textarea></label>
    </div>`;
    return html;
  }
  function instFoot() {
    const inst = S.cur.inst;
    if (inst.done) return `<button class="btn-main done" data-act="instdone">✓ Instalado</button><button class="btn-ghost" data-act="uninst">Deshacer</button>`;
    return `<button class="btn-main" data-act="instdone">Marcar instalado</button>`;
  }

  /* ---------- Acciones ---------- */
  async function completeRec() {
    const r = S.cur.rec;
    const id = S.open;
    if (r.status === 'done') return;
    const errs = [], warns = [];
    const nPh = photosOf(id, 'rec').length;
    const pendingUp = S.uploads.some((u) => u.desk === id && !u.failed);
    if (!nPh) errs.push(pendingUp ? 'Espera a que termine de subir la foto' : 'Falta mínimo 1 foto del puesto');
    r.consoles.forEach((c, i) => {
      if (!c.type) errs.push(`Consola ${i + 1}: falta elegir el tipo`);
      if (c.type === 'OTRO' && !(c.other || '').trim()) errs.push(`Consola ${i + 1}: escribe qué equipo es`);
      if ((c.tag || '').trim().length < 4) errs.push(`Consola ${i + 1}: falta el tag (Asset ID)`);
    });
    for (let i = 0; i < r.monitors; i++) {
      const m = r.mon[i] || {};
      if (!m.input) warns.push(`Monitor ${i + 1}: falta el puerto del monitor`);
      if (!m.tower) warns.push(`Monitor ${i + 1}: falta el puerto de la torre`);
    }
    if (r.monitors && !r.comps.tower) warns.push('Tiene monitores pero no marcaste la torre');
    if (!SH.recHasContent(r)) warns.push('No marcaste ningún componente (¿el puesto está vacío?)');
    r.consoles.forEach((c, i) => { if (!c.mon) warns.push(`Consola ${i + 1}: no dice a qué monitor va`); });
    if (errs.length) {
      const btn = $('#dFoot .btn-main'); btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake');
      await confirmBox('Falta algo', 'Para marcar el puesto como registrado completa esto:', errs.map((e) => `<li class="err">${esc(e)}</li>`), null);
      return;
    }
    if (warns.length) {
      const ok = await confirmBox('¿Seguro?', 'Esto quedó incompleto. Puedes registrarlo así o volver a completarlo:', warns.map((e) => `<li>${esc(e)}</li>`), 'Registrar así');
      if (!ok) return;
    }
    r.status = 'done'; r.doneAt = Date.now(); r.doneBy = S.user;
    queueSave(true);
    renderDetail(true);
    banner('Puesto ' + S.byId[id].provisional, 'REGISTRADO');
    setTimeout(() => { if (S.open === id) closeDesk(); }, 1500);
  }
  async function completeInst() {
    const inst = S.cur.inst;
    const id = S.open;
    if (inst.done) return;
    const items = checkItems();
    const miss = items.filter((it) => !inst.checks[it.k]);
    if (miss.length) {
      const ok = await confirmBox('Sin verificar', `Hay ${miss.length} ítem${miss.length > 1 ? 's' : ''} sin confirmar:`, miss.slice(0, 8).map((it) => `<li>${esc(it.t)}</li>`), 'Marcar instalado igual');
      if (!ok) return;
    }
    inst.done = true; inst.at = Date.now(); inst.by = S.user;
    queueSave(true);
    renderDetail(true);
    banner('Puesto ' + S.byId[id].newDesk, 'INSTALADO', true);
    setTimeout(() => { if (S.open === id) closeDesk(); }, 1500);
  }

  function onAct(act, el) {
    const r = S.cur && S.cur.rec;
    const i = el.dataset.i != null ? Number(el.dataset.i) : null;
    const v = el.dataset.v;
    const editRec = () => { if (r.status !== 'done') return; };
    switch (act) {
      case 'open': return openDesk(el.dataset.id);
      case 'close': return closeDesk();
      case 'tab': S.tab = v; return renderList();
      case 'fr': S.fr = v; return renderList();
      case 'sort': S.sort = v; LS.set('sort', v); return renderList();
      case 'mode':
        S.mode = v; LS.set('modeOverride', { mode: v, day: todayBog() });
        S.tab = 'pending';
        return renderAll();
      case 'clearq': S.q = ''; $('#q').value = ''; return renderList();
      case 'menu': return openMenu();
      case 'user': return askUser(false);
      case 'comp': r.comps[v] = !r.comps[v]; el.classList.toggle('on'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
        if (navigator.vibrate) navigator.vibrate(12);
        if (v === 'tower') { queueSave(); return renderDetail(true); }
        updatePreview(); return queueSave();
      case 'mons': r.monitors = Number(v);
        r.consoles.forEach((c) => { if (c.mon && c.mon !== 'none' && Number(c.mon) > r.monitors) { c.mon = ''; c.input = ''; } });
        break;
      case 'mpos': r.mon[i].pos = r.mon[i].pos === v ? '' : v; break;
      case 'minput': r.mon[i].input = r.mon[i].input === v ? '' : v; break;
      case 'mtower':
        if (r.mon[i].tower === v) r.mon[i].tower = '';
        else {
          const o = r.mon[1 - i];
          if (o && o.tower === v) { o.tower = ''; toast(`Ese puerto lo tenía el Monitor ${2 - i}; se lo quité`, 'warn'); }
          r.mon[i].tower = v;
        }
        break;
      case 'addcons': if (r.consoles.length < 4) { r.consoles.push({ type: '', tag: '', variant: '', mon: '', input: '' }); queueSave(); renderDetail(true);
        const boxes = document.querySelectorAll('#dBody .sec:nth-of-type(3) .box'); const last = boxes[boxes.length - 1]; if (last) last.scrollIntoView({ behavior: 'smooth', block: 'center' }); } return;
      case 'rmcons': {
        const c = r.consoles[i];
        const doIt = () => { r.consoles.splice(i, 1); queueSave(); renderDetail(true); };
        if (c && (c.type || c.tag)) confirmBox('Quitar consola', `¿Quitar ${esc(SH.consoleLabel(c) || 'esta consola')}?`, null, 'Quitar').then((ok) => ok && doIt());
        else doIt();
        return;
      }
      case 'ctype': r.consoles[i].type = r.consoles[i].type === v ? '' : v; break;
      case 'cvar': r.consoles[i].variant = r.consoles[i].variant === v ? '' : v; break;
      case 'cmon': r.consoles[i].mon = r.consoles[i].mon === v ? '' : v; r.consoles[i].input = ''; break;
      case 'cinput': r.consoles[i].input = r.consoles[i].input === v ? '' : v; break;
      case 'cam': return pickPhoto('cam', el.dataset.phase);
      case 'gal': return pickPhoto('gal', el.dataset.phase);
      case 'view': return openViewer(el.dataset.pid);
      case 'retry': { const u = S.uploads.find((x) => x.uid === el.dataset.uid); if (u && u.failed) { u.failed = false; renderDetail(true); doUpload(u); } return; }
      case 'recdone': return completeRec();
      case 'reopen':
        confirmBox('Reabrir registro', 'El puesto vuelve a "Por registrar" para corregirlo. Los datos y fotos se mantienen.', null, 'Reabrir').then((ok) => {
          if (!ok) return; r.status = 'draft'; delete r.doneAt; delete r.doneBy; queueSave(true); renderDetail(true);
        });
        return;
      case 'chk': S.cur.inst.checks[el.dataset.k] = !S.cur.inst.checks[el.dataset.k]; if (navigator.vibrate) navigator.vibrate(12); break;
      case 'instdone': return completeInst();
      case 'uninst':
        confirmBox('Deshacer instalado', 'El puesto vuelve a "Por instalar".', null, 'Deshacer').then((ok) => {
          if (!ok) return; S.cur.inst.done = false; delete S.cur.inst.at; delete S.cur.inst.by; queueSave(true); renderDetail(true);
        });
        return;
      default: return;
    }
    editRec();
    queueSave();
    renderDetail(true);
  }

  function updatePreview() {
    const el = $('#xlPrev');
    if (el && S.open) el.textContent = SH.buildComment(S.cur, photosOf(S.open, 'rec').length);
  }
  function onInput(el) {
    if (!S.cur) return;
    const r = S.cur.rec;
    const k = el.dataset.in;
    const i = el.dataset.i != null ? Number(el.dataset.i) : null;
    const up = (s) => s.toUpperCase().replace(/\s+/g, '');
    if (k === 'tag') { const v = up(el.value); if (v !== el.value) el.value = v; r.tags[el.dataset.k] = v; }
    else if (k === 'ctag') {
      const v = up(el.value); if (v !== el.value) el.value = v;
      r.consoles[i].tag = v;
      el.classList.toggle('bad', v.length < 4);
      const c = r.consoles[i];
      const prev = document.querySelector(`[data-prev="${i}"]`);
      if (prev) { const ok = c.type && v.length >= 4; prev.classList.toggle('empty', !ok); prev.textContent = ok ? SH.consoleLabel(c) : (c.type ? SH.consoleLabel({ ...c, tag: '' }) : 'TIPO') + '-' + (v || '????????'); }
    } else if (k === 'cother') { r.consoles[i].other = el.value.toUpperCase(); }
    else if (k === 'note') r.note = el.value;
    else if (k === 'inote') S.cur.inst.note = el.value;
    updatePreview();
    queueSave();
  }

  /* ---------- Fotos ---------- */
  let pickPhase = 'rec';
  function pickPhoto(kind, phase) {
    pickPhase = phase || 'rec';
    const inp = kind === 'cam' ? $('#fileCam') : $('#fileGal');
    inp.value = '';
    inp.click();
  }
  function loadImg(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => res({ img, url });
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('No se pudo leer la imagen')); };
      img.src = url;
    });
  }
  function resize(img, max, q) {
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', q);
  }
  async function handleFiles(files) {
    const id = S.open;
    if (!id) return;
    for (const f of files) {
      try {
        const { img, url } = await loadImg(f);
        const full = resize(img, 1600, 0.74);
        const thumb = resize(img, 360, 0.7);
        URL.revokeObjectURL(url);
        const u = { uid: Math.random().toString(36).slice(2), desk: id, phase: pickPhase, img: full, thumb, tries: 0 };
        S.uploads.push(u);
        renderDetail(true);
        doUpload(u);
      } catch (e) { toast(e.message, 'err'); }
    }
  }
  async function doUpload(u) {
    try {
      const p = await api('POST', `/api/desks/${u.desk}/photos`, { img: u.img, thumb: u.thumb, phase: u.phase, user: S.user });
      writeSeq++;
      S.uploads = S.uploads.filter((x) => x !== u);
      S.photos.push({ id: p.id, desk: p.desk, phase: p.phase, by: p.by, at: p.at });
      setOnline(true);
      if (S.open === u.desk) { renderDetail(true); }
      renderAll();
      toast('Foto guardada');
    } catch (e) {
      u.tries++;
      if (u.tries < 4) setTimeout(() => doUpload(u), 2500 * u.tries);
      else { u.failed = true; if (S.open === u.desk) renderDetail(true); toast('No se pudo subir la foto. Toca la foto para reintentar.', 'err', 5000); }
    }
  }

  /* Visor de fotos */
  function openViewer(pid) {
    const p = S.photos.find((x) => x.id === pid);
    if (!p) return;
    const list = photosOf(p.desk, p.phase);
    S.viewer = { list, idx: list.findIndex((x) => x.id === pid) };
    renderViewer();
    $('#viewer').classList.add('open');
  }
  function renderViewer() {
    const v = S.viewer; if (!v) return;
    const p = v.list[v.idx];
    if (!p) return closeViewer();
    const canDel = S.open && ((p.phase === 'rec' && S.mode === 'rec') || (p.phase === 'inst' && S.mode === 'inst'));
    $('#viewer').innerHTML = `<div class="v-top"><div class="cnt">${v.idx + 1} / ${v.list.length}<small>${esc(p.by)} · ${SH.fmtDate(p.at)}</small></div>
      <a class="icon-btn" href="/api/photos/${p.id}" target="_blank" rel="noopener" aria-label="Abrir original">${IC.image}</a>
      <button class="icon-btn" data-v="close" aria-label="Cerrar">${IC.x}</button></div>
      <div class="v-img"><img src="/api/photos/${p.id}" alt="Foto ${v.idx + 1}"></div>
      <div class="v-nav">${canDel ? '<button class="del" data-v="del">Borrar</button>' : ''}<button data-v="prev" ${v.idx ? '' : 'disabled'}>‹ Anterior</button><button data-v="next" ${v.idx < v.list.length - 1 ? '' : 'disabled'}>Siguiente ›</button></div>`;
  }
  function closeViewer() { S.viewer = null; $('#viewer').classList.remove('open'); $('#viewer').innerHTML = ''; }
  async function viewerAct(a) {
    const v = S.viewer; if (!v) return;
    if (a === 'close') return closeViewer();
    if (a === 'prev' && v.idx > 0) { v.idx--; return renderViewer(); }
    if (a === 'next' && v.idx < v.list.length - 1) { v.idx++; return renderViewer(); }
    if (a === 'del') {
      const p = v.list[v.idx];
      const ok = await confirmBox('Borrar foto', 'La foto se borra para todos.', null, 'Borrar');
      if (!ok) return;
      try {
        await api('DELETE', '/api/photos/' + p.id);
        writeSeq++;
        S.photos = S.photos.filter((x) => x.id !== p.id);
        v.list.splice(v.idx, 1);
        if (v.idx >= v.list.length) v.idx = v.list.length - 1;
        if (!v.list.length) closeViewer(); else renderViewer();
        renderDetail(true); renderAll();
        toast('Foto borrada');
      } catch (e) { toast('No se pudo borrar (sin conexión)', 'err'); }
    }
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    if (el.closest('#modal')) return;
    ev.preventDefault();
    onAct(el.dataset.act, el);
  });
  document.addEventListener('input', (ev) => {
    if (ev.target.id === 'q') { S.q = ev.target.value; renderList(); return; }
    if (ev.target.dataset && ev.target.dataset.in) onInput(ev.target);
  });
  $('#viewer').addEventListener('click', (ev) => { const b = ev.target.closest('[data-v]'); if (b && !b.disabled) viewerAct(b.dataset.v); });
  let tx = null;
  $('#viewer').addEventListener('touchstart', (e) => { tx = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  $('#viewer').addEventListener('touchend', (e) => { if (tx == null) return; const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 60) viewerAct(dx < 0 ? 'next' : 'prev'); tx = null; });
  ['#fileCam', '#fileGal'].forEach((s) => $(s).addEventListener('change', (e) => { const f = [...e.target.files]; if (f.length) handleFiles(f); }));
  window.addEventListener('popstate', () => {
    if (S.viewer) { closeViewer(); history.pushState({ desk: S.open }, '', '#' + S.open); return; }
    if (S.open) closeDesk(true);
  });
  document.addEventListener('keydown', (e) => {
    if (S.viewer) { if (e.key === 'Escape') closeViewer(); if (e.key === 'ArrowLeft') viewerAct('prev'); if (e.key === 'ArrowRight') viewerAct('next'); }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { loadState(); flush(); } });
  window.addEventListener('online', () => { flush(); loadState(); });
  window.addEventListener('beforeunload', (e) => { if (Object.keys(S.queue).length || S.uploads.length) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- Inicio ---------- */
  (async function init() {
    const cache = LS.get('cache', null);
    if (cache) { S.base = cache.base; S.desks = cache.desks; S.photos = cache.photos; S.byId = Object.fromEntries(S.base.map((d) => [d.id, d])); }
    renderAll();
    if (!S.user) askUser(true);
    await loadState(true);
    if (Object.keys(S.queue).length) flush();
    const h = decodeURIComponent(location.hash.slice(1));
    if (h && S.byId[h]) { history.replaceState(null, '', location.pathname); openDesk(h); }
    setInterval(() => { if (!document.hidden && !S.saving) loadState(); }, 6000);
    setInterval(renderHeader, 60000);
  })();
})();
