/* Servidor WAVE – registro y mudanza de puestos */
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const JSZip = require('jszip');
const SHARED = require('./public/shared.js');

const BASE = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'desks.json'), 'utf8')).desks;
const BASE_IDS = new Set(BASE.map((d) => d.id));
const TEMPLATE = path.join(__dirname, 'data', 'wave.xlsx');
const PORT = process.env.PORT || 3000;

/* ---------------- Almacenamiento ---------------- */
function pgStore() {
  const { Pool } = require('pg');
  const url = process.env.DATABASE_URL;
  let host = '';
  try { host = new URL(url).hostname; } catch (e) {}
  const useSsl = process.env.PGSSL === 'require' || (host.includes('.') && !/^(localhost|127\.0\.0\.1)$/.test(host));
  const pool = new Pool({ connectionString: url, ssl: useSsl ? { rejectUnauthorized: false } : false, max: 5 });
  return {
    kind: 'postgres',
    async init() {
      await pool.query(`CREATE TABLE IF NOT EXISTS desks (id TEXT PRIMARY KEY, data JSONB NOT NULL, version INT NOT NULL, updated_at BIGINT, updated_by TEXT)`);
      await pool.query(`CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, desk_id TEXT NOT NULL, phase TEXT NOT NULL, by_user TEXT, at BIGINT, img BYTEA NOT NULL, thumb BYTEA)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS photos_desk ON photos(desk_id)`);
    },
    async getAll() {
      const d = await pool.query('SELECT id, data, version, updated_at, updated_by FROM desks');
      const p = await pool.query('SELECT id, desk_id, phase, by_user, at FROM photos ORDER BY at');
      const desks = {};
      d.rows.forEach((r) => (desks[r.id] = { data: r.data, version: r.version, updatedAt: Number(r.updated_at), updatedBy: r.updated_by }));
      return { desks, photos: p.rows.map((r) => ({ id: r.id, desk: r.desk_id, phase: r.phase, by: r.by_user, at: Number(r.at) })) };
    },
    async save(id, data, baseVersion, user) {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        const cur = await c.query('SELECT data, version, updated_at, updated_by FROM desks WHERE id=$1 FOR UPDATE', [id]);
        const curV = cur.rows[0] ? cur.rows[0].version : 0;
        if (baseVersion !== curV) {
          await c.query('ROLLBACK');
          const r = cur.rows[0];
          return { conflict: true, current: r ? { data: r.data, version: r.version, updatedAt: Number(r.updated_at), updatedBy: r.updated_by } : null };
        }
        const now = Date.now();
        await c.query(`INSERT INTO desks (id, data, version, updated_at, updated_by) VALUES ($1,$2,$3,$4,$5)
          ON CONFLICT (id) DO UPDATE SET data=$2, version=$3, updated_at=$4, updated_by=$5`, [id, data, curV + 1, now, user]);
        await c.query('COMMIT');
        return { ok: true, version: curV + 1, updatedAt: now };
      } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
    },
    async addPhoto(p) {
      await pool.query('INSERT INTO photos (id, desk_id, phase, by_user, at, img, thumb) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [p.id, p.desk, p.phase, p.by, p.at, p.img, p.thumb]);
    },
    async getPhoto(id, thumb) {
      const r = await pool.query(`SELECT ${thumb ? 'COALESCE(thumb, img)' : 'img'} AS b FROM photos WHERE id=$1`, [id]);
      return r.rows[0] ? r.rows[0].b : null;
    },
    async delPhoto(id) { await pool.query('DELETE FROM photos WHERE id=$1', [id]); },
    async eachPhoto(fn) {
      const ids = await pool.query('SELECT id, desk_id, phase, at FROM photos ORDER BY desk_id, at');
      for (const r of ids.rows) {
        const b = await pool.query('SELECT img FROM photos WHERE id=$1', [r.id]);
        if (b.rows[0]) await fn({ id: r.id, desk: r.desk_id, phase: r.phase, at: Number(r.at) }, b.rows[0].img);
      }
    },
  };
}

function fileStore() {
  const dir = path.join(__dirname, 'local-data');
  const pdir = path.join(dir, 'photos');
  const sfile = path.join(dir, 'state.json');
  let state = { desks: {}, photos: [] };
  const persist = () => { fs.writeFileSync(sfile + '.tmp', JSON.stringify(state)); fs.renameSync(sfile + '.tmp', sfile); };
  return {
    kind: 'archivo local (solo para pruebas)',
    async init() {
      fs.mkdirSync(pdir, { recursive: true });
      if (fs.existsSync(sfile)) state = JSON.parse(fs.readFileSync(sfile, 'utf8'));
    },
    async getAll() { return JSON.parse(JSON.stringify(state)); },
    async save(id, data, baseVersion, user) {
      const cur = state.desks[id];
      const curV = cur ? cur.version : 0;
      if (baseVersion !== curV) return { conflict: true, current: cur || null };
      const now = Date.now();
      state.desks[id] = { data, version: curV + 1, updatedAt: now, updatedBy: user };
      persist();
      return { ok: true, version: curV + 1, updatedAt: now };
    },
    async addPhoto(p) {
      fs.writeFileSync(path.join(pdir, p.id + '.jpg'), p.img);
      if (p.thumb) fs.writeFileSync(path.join(pdir, p.id + '_t.jpg'), p.thumb);
      state.photos.push({ id: p.id, desk: p.desk, phase: p.phase, by: p.by, at: p.at });
      persist();
    },
    async getPhoto(id, thumb) {
      const f = path.join(pdir, id + (thumb ? '_t' : '') + '.jpg');
      if (fs.existsSync(f)) return fs.readFileSync(f);
      const f2 = path.join(pdir, id + '.jpg');
      return fs.existsSync(f2) ? fs.readFileSync(f2) : null;
    },
    async delPhoto(id) {
      state.photos = state.photos.filter((p) => p.id !== id);
      [id + '.jpg', id + '_t.jpg'].forEach((f) => { try { fs.unlinkSync(path.join(pdir, f)); } catch (e) {} });
      persist();
    },
    async eachPhoto(fn) {
      for (const p of [...state.photos].sort((a, b) => (a.desk + a.at).localeCompare(b.desk + b.at))) {
        const b = await this.getPhoto(p.id, false);
        if (b) await fn(p, b);
      }
    },
  };
}

const store = process.env.DATABASE_URL ? pgStore() : fileStore();
let rev = Date.now(); // cambia con cada modificación → los celulares saben cuándo refrescar
const bump = () => { rev = Math.max(Date.now(), rev + 1); };

/* ---------------- App ---------------- */
const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0 }));

const ah = (fn) => (req, res) => fn(req, res).catch((e) => { console.error(e); res.status(500).json({ error: String(e.message || e) }); });
const cleanUser = (u) => String(u || 'Anónimo').slice(0, 40);

app.get('/api/health', (req, res) => res.json({ ok: true, store: store.kind }));

app.get('/api/state', ah(async (req, res) => {
  if (req.query.rev && String(rev) === String(req.query.rev)) return res.json({ same: true, rev });
  const s = await store.getAll();
  res.json({ rev, base: BASE, desks: s.desks, photos: s.photos, store: store.kind, serverTime: Date.now() });
}));

app.put('/api/desks/:id', ah(async (req, res) => {
  const id = req.params.id;
  if (!BASE_IDS.has(id)) return res.status(404).json({ error: 'Puesto no existe' });
  const { data, baseVersion, user } = req.body || {};
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Sin datos' });
  const r = await store.save(id, data, Number(baseVersion) || 0, cleanUser(user));
  if (r.conflict) return res.status(409).json(r);
  bump();
  res.json({ ...r, rev });
}));

const b64 = (s) => (s ? Buffer.from(String(s).replace(/^data:image\/\w+;base64,/, ''), 'base64') : null);
app.post('/api/desks/:id/photos', ah(async (req, res) => {
  const id = req.params.id;
  if (!BASE_IDS.has(id)) return res.status(404).json({ error: 'Puesto no existe' });
  const { img, thumb, phase, user } = req.body || {};
  const buf = b64(img);
  if (!buf || buf.length < 100) return res.status(400).json({ error: 'Imagen vacía' });
  const p = { id: crypto.randomBytes(8).toString('hex'), desk: id, phase: phase === 'inst' ? 'inst' : 'rec', by: cleanUser(user), at: Date.now(), img: buf, thumb: b64(thumb) };
  await store.addPhoto(p);
  bump();
  res.json({ id: p.id, desk: p.desk, phase: p.phase, by: p.by, at: p.at, rev });
}));

app.get('/api/photos/:pid', ah(async (req, res) => {
  const b = await store.getPhoto(req.params.pid, req.query.t === '1');
  if (!b) return res.status(404).end();
  res.set('Content-Type', 'image/jpeg');
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(b);
}));

app.delete('/api/photos/:pid', ah(async (req, res) => {
  await store.delPhoto(req.params.pid);
  bump();
  res.json({ ok: true, rev });
}));

/* ---------------- Exportar Excel ---------------- */
const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const colNum = (c) => c.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);

function setRowCells(xml, row, values) {
  const re = new RegExp(`<row r="${row}"([^>]*?)(?:/>|>([\\s\\S]*?)</row>)`);
  const m = xml.match(re);
  if (!m) return xml;
  let attrs = m[1];
  const inner = m[2] || '';
  const cells = [];
  const cre = /<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>[\s\S]*?<\/c>)/g;
  let cm;
  while ((cm = cre.exec(inner))) cells.push({ col: cm[1], xml: cm[0], attrs: cm[3] });
  const defStyle = (cells.find((c) => c.col === 'G') || {}).attrs;
  const styleOf = (a) => { const s = /\ss="(\d+)"/.exec(a || ''); return s ? ` s="${s[1]}"` : ''; };
  for (const [col, val] of Object.entries(values)) {
    const ex = cells.find((c) => c.col === col);
    const st = styleOf(ex ? ex.attrs : defStyle);
    const ref = `${col}${row}`;
    const nx = val ? `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(val)}</t></is></c>` : `<c r="${ref}"${st}/>`;
    if (ex) ex.xml = nx; else cells.push({ col, xml: nx });
  }
  cells.sort((a, b) => colNum(a.col) - colNum(b.col));
  const maxCol = colNum(cells[cells.length - 1].col);
  attrs = attrs.replace(/\sspans="(\d+):(\d+)"/, (all, a, b) => ` spans="${a}:${Math.max(Number(b), maxCol)}"`);
  return xml.replace(m[0], `<row r="${row}"${attrs}>${cells.map((c) => c.xml).join('')}</row>`);
}

async function buildXlsx() {
  const s = await store.getAll();
  const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE));
  const f = 'xl/worksheets/sheet1.xml';
  let xml = await zip.file(f).async('string');
  for (const d of BASE) {
    const st = s.desks[d.id];
    if (!st || !st.data || !SHARED.recHasContent(st.data.rec)) continue; // sin registro → se deja como estaba
    const pc = s.photos.filter((p) => p.desk === d.id).length;
    xml = setRowCells(xml, d.row, SHARED.exportValues(st.data, pc));
  }
  zip.file(f, xml);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

const stamp = () => new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).slice(0, 16).replace(/[-: ]/g, '');

app.get('/api/export.xlsx', ah(async (req, res) => {
  const buf = await buildXlsx();
  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.set('Content-Disposition', `attachment; filename="Wave_Interna_14112026_${stamp()}.xlsx"`);
  res.send(buf);
}));

app.get('/api/export/photos.zip', ah(async (req, res) => {
  const zip = new JSZip();
  const byId = Object.fromEntries(BASE.map((d) => [d.id, d]));
  const count = {};
  await store.eachPhoto(async (p, buf) => {
    const d = byId[p.desk] || { provisional: p.desk, newDesk: '' };
    const k = p.desk + p.phase;
    count[k] = (count[k] || 0) + 1;
    const folder = `${d.provisional}_a_${d.newDesk}`;
    zip.file(`${folder}/${p.phase === 'inst' ? 'instalado' : 'registro'}_${count[k]}.jpg`, buf);
  });
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
  res.set('Content-Type', 'application/zip');
  res.set('Content-Disposition', `attachment; filename="Fotos_puestos_${stamp()}.zip"`);
  res.send(buf);
}));

app.get('/api/backup.json', ah(async (req, res) => {
  const s = await store.getAll();
  res.set('Content-Disposition', `attachment; filename="respaldo_${stamp()}.json"`);
  res.json({ exportedAt: Date.now(), base: BASE, ...s });
}));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

store.init().then(() => {
  app.listen(PORT, () => console.log(`WAVE listo en puerto ${PORT} · almacenamiento: ${store.kind}`));
}).catch((e) => { console.error('No se pudo iniciar la base de datos:', e); process.exit(1); });
