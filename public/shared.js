/* Constantes y lógica compartida entre el navegador y el servidor */
(function (root) {
  const TOWER_PORTS = [
    { id: 'MB_HDMI', label: 'HDMI arriba', short: 'HDMI', zone: 'mb', kind: 'hdmi' },
    { id: 'MB_DP', label: 'DP arriba', short: 'DP', zone: 'mb', kind: 'dp' },
    { id: 'GPU_DP1', label: 'DP abajo 1', short: 'DP 1', zone: 'gpu', kind: 'dp' },
    { id: 'GPU_DP2', label: 'DP abajo 2', short: 'DP 2', zone: 'gpu', kind: 'dp' },
    { id: 'GPU_DP3', label: 'DP abajo 3', short: 'DP 3', zone: 'gpu', kind: 'dp' },
    { id: 'GPU_HDMI', label: 'HDMI abajo', short: 'HDMI', zone: 'gpu', kind: 'hdmi' },
  ];
  const MON_INPUTS = [
    { id: 'DP1', label: 'DP 1', kind: 'dp' },
    { id: 'DP2', label: 'DP 2', kind: 'dp' },
    { id: 'HDMI1', label: 'HDMI 1', kind: 'hdmi' },
    { id: 'HDMI2', label: 'HDMI 2', kind: 'hdmi' },
    { id: 'USBC', label: 'USB-C', kind: 'usbc' },
  ];
  const MON_POS = [
    { id: 'L', label: 'Izquierda' },
    { id: 'C', label: 'Centro' },
    { id: 'R', label: 'Derecha' },
  ];
  const CONSOLE_TYPES = ['PS5', 'PS4', 'XBSX', 'XBSS', 'XB1', 'XB1S', 'NS2', 'NS1', 'MacMini', 'Laptop', 'OTRO'];
  const VARIANTS = ['DEV', 'TEST', 'Retail'];
  const PERIPH = [
    { id: 'tower', label: 'Torre (PC)', short: 'Torre' },
    { id: 'keyboard', label: 'Teclado', short: 'Teclado' },
    { id: 'mouse', label: 'Mouse', short: 'Mouse' },
    { id: 'mousepad', label: 'Mousepad', short: 'Mousepad' },
    { id: 'headset', label: 'Diadema', short: 'Diadema' },
    { id: 'cam', label: 'Cámara', short: 'Cámara' },
    { id: 'netgear', label: 'Netgear', short: 'Netgear' },
  ];

  const byId = (arr, id) => arr.find((x) => x.id === id);
  const towerLabel = (id) => (byId(TOWER_PORTS, id) || {}).label || '';
  const inputLabel = (id) => (byId(MON_INPUTS, id) || {}).label || '';
  const posLabel = (id) => (byId(MON_POS, id) || {}).label || '';

  function emptyRec() {
    return {
      status: 'pending',
      comps: {},
      monitors: 0,
      tags: { pc: '', m1: '', m2: '' },
      mon: [{}, {}],
      consoles: [],
      note: '',
    };
  }

  function consoleLabel(c) {
    if (!c) return '';
    const t = c.type === 'OTRO' ? (c.other || 'OTRO').trim().toUpperCase() : c.type || '?';
    const tag = (c.tag || '').trim();
    return tag ? `${t}-${tag}` : t;
  }

  function recHasContent(rec) {
    if (!rec) return false;
    if (rec.status === 'done') return true;
    if (rec.monitors > 0 || (rec.consoles && rec.consoles.length) || (rec.note || '').trim()) return true;
    return Object.values(rec.comps || {}).some(Boolean);
  }

  function fmtDate(ts) {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleString('es-CO', {
        timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
      });
    } catch (e) { return new Date(ts).toISOString(); }
  }

  /* Texto que se escribe en la columna "Comment" del Excel */
  function buildComment(data, photoCount) {
    const rec = (data && data.rec) || emptyRec();
    const inst = (data && data.inst) || {};
    const parts = [];
    parts.push(rec.status === 'done' ? `REGISTRADO ${fmtDate(rec.doneAt)} (${rec.doneBy || '-'})` : 'REGISTRO EN PROGRESO');
    const items = [];
    if (rec.comps && rec.comps.tower) items.push('Torre');
    if (rec.monitors) items.push(`${rec.monitors} monitor${rec.monitors > 1 ? 'es' : ''}`);
    if (rec.consoles && rec.consoles.length) items.push(`${rec.consoles.length} consola${rec.consoles.length > 1 ? 's' : ''}`);
    PERIPH.filter((p) => p.id !== 'tower' && rec.comps && rec.comps[p.id]).forEach((p) => items.push(p.short));
    if (items.length) parts.push(items.join(', '));
    for (let i = 0; i < (rec.monitors || 0); i++) {
      const m = (rec.mon && rec.mon[i]) || {};
      let s = `M${i + 1}`;
      if (m.pos) s += ` ${posLabel(m.pos)}`;
      s += `: ${inputLabel(m.input) || '¿entrada?'} -> Torre ${towerLabel(m.tower) || '¿puerto?'}`;
      parts.push(s);
    }
    (rec.consoles || []).forEach((c) => {
      let s = consoleLabel(c);
      if (c.variant) s += ` ${c.variant}`;
      if (c.mon) s += ` -> M${c.mon}${c.input ? ' ' + inputLabel(c.input) : ''}`;
      parts.push(s);
    });
    if (photoCount) parts.push(`Fotos: ${photoCount}`);
    if ((rec.note || '').trim()) parts.push(`Nota: ${rec.note.trim()}`);
    if (inst.done) parts.push(`INSTALADO ${fmtDate(inst.at)} (${inst.by || '-'})${(inst.note || '').trim() ? ' - ' + inst.note.trim() : ''}`);
    return parts.join(' | ');
  }

  /* Valores de las 8 columnas G..N */
  function exportValues(data, photoCount) {
    const rec = (data && data.rec) || emptyRec();
    const n = rec.monitors || 0;
    const cons = rec.consoles || [];
    return {
      G: buildComment(data, photoCount),
      H: rec.comps && rec.comps.tower ? (rec.tags.pc || 'Torre (sin tag)') : '',
      I: n >= 1 ? (rec.tags.m1 || 'Monitor (sin tag)') : '',
      J: n >= 2 ? (rec.tags.m2 || 'Monitor (sin tag)') : '',
      K: consoleLabel(cons[0]),
      L: consoleLabel(cons[1]),
      M: consoleLabel(cons[2]),
      N: consoleLabel(cons[3]),
    };
  }

  const api = { TOWER_PORTS, MON_INPUTS, MON_POS, CONSOLE_TYPES, VARIANTS, PERIPH, towerLabel, inputLabel, posLabel,
    emptyRec, consoleLabel, recHasContent, buildComment, exportValues, fmtDate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SHARED = api;
})(typeof window !== 'undefined' ? window : globalThis);
