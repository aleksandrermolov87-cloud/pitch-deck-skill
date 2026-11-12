// Схемы обмена (под-скилл «Схемы», reference/19-schemes.md): шина интеграций, сопоставление «было → стало»,
// обмен ценностью двух сторон, двусторонняя платформа, матричная структура, диаграмма причин.
// API как в components.js: (box, data, opt) → els.
const L = require('../lib.js');
const U = require('./util.js');
const { C, rect, oval, hline, vline, text, tw } = L;
const { card, tone, toneInk, head, edgeLabel, pill, stack, seg, lines, lh } = U;

const dotOf = (x, y, kind, d = 0.11) => oval(x, y, d, { fill: kind === 'dashed' || kind === 'muted' ? C.axis : C.accent });
const caps = s => String(s).toUpperCase();

// Интеграционная шина. Вопрос: «какие системы и как подключены к общей шине?»
// data: { bus: { name, note? }, top: [{ name, note?, link?, kind? }], bottom: [ … ] }
// Шина — толстая линия акцента с пилюлей-именем слева, системы карточками сверху и снизу, коннекторы с точками,
// link — протокол или частота обмена подписью справа от коннектора; kind: 'dashed' — пакетный или резервный обмен.
function busIntegration(box, data) {
  const { x, y, w, h } = box, els = [], over = [];
  const by = y + h / 2, GV = 0.62, bp = pill(0, 0, data.bus.name, { pt: 12, h: 0.42 });
  const left = x + bp.w + 0.4, aw = x + w - left;
  els.push(hline(x + bp.w / 2, x + w, by, { color: C.accent, lw: 4 }));
  over.push(...pill(x + bp.w / 2, by, data.bus.name, { pt: 12, h: 0.42 }).els);
  if (data.bus.note) {
    const nl = lines(data.bus.note, 10, bp.w + 0.2);
    over.push(text(x, by + 0.32, bp.w + 0.2, lh(10) * nl + 0.04, data.bus.note, { size: 10, color: C.muted, ls: 1.1 }));
  }
  [['top', data.top || []], ['bottom', data.bottom || []]].forEach(([side, list]) => {
    if (!list.length) return;
    const n = list.length, gap = 0.3, cw = Math.min(3.0, (aw - gap * (n - 1)) / n);
    const x0 = left + (aw - (cw * n + gap * (n - 1))) / 2, P = 0.18;
    const need = Math.max(...list.map(s => stack(0, 0, cw - 2 * P, s, { name: 13, item: 10, measure: true }).h)) + 2 * P;
    const ch = Math.min(h / 2 - GV, Math.max(need, (h / 2) * 0.55)), gv = h / 2 - ch;   // остаток высоты — коннекторам
    list.forEach((s, i) => {
      const cx0 = x0 + i * (cw + gap), mid = cx0 + cw / 2;
      const cy0 = side === 'top' ? by - gv - ch : by + gv, edge = side === 'top' ? cy0 + ch : cy0;
      els.push(vline(mid, Math.min(edge, by), Math.max(edge, by), tone(s.kind)));
      els.push(card(cx0, cy0, cw, ch));
      over.push(...stack(cx0 + P, cy0 + P, cw - 2 * P, s, { name: 13, item: 10 }).els);
      over.push(dotOf(mid, edge, s.kind), dotOf(mid, by, s.kind, 0.15));
      if (s.link) {
        const lb = edgeLabel({ text: s.link, kind: s.kind }, cw / 2 - 0.2), ym = (edge + by) / 2;
        over.push(text(mid + 0.14, ym - lb.h / 2, cw / 2 - 0.2, lb.h, lb.runs, { size: lb.pt, valign: 'middle', ls: 1.05 }));
      }
    });
  });
  return [...els, ...over];
}

// Сопоставление «было → стало». Вопрос: «что во что переходит?»
// data: { left: { head, items: [{ id, name, note? }] }, right: { head, items: [ … ] }, links: [{ from, to, kind?: 'main'|'dashed' }] }
// Две колонки типографикой, точки у внутренних краёв, связи многие-ко-многим наклонными отрезками.
// main — главная связь акцентом, остальные тонкой осью; на точку без главных связей — тон оси.
function bridgeMapping(box, data) {
  const { x, y, w, h } = box, els = [], over = [], CW = Math.min(3.7, w * 0.3);
  const HH = 0.5, top = y + HH, avail = h - HH;
  const place = (side, col) => {
    const n = col.items.length, step = avail / n, right = side === 'left';
    const cx = right ? x : x + w - CW;
    over.push(text(cx, y, CW, 0.3, caps(col.head), { size: 10, bold: true, color: C.muted, align: right ? 'right' : 'left', valign: 'middle' }));
    els.push(hline(cx, cx + CW, y + 0.36, { color: C.rule, lw: 0.75 }));
    return col.items.map((it, i) => {
      const st = stack(0, 0, CW - 0.35, { name: it.name, note: it.note }, { name: 13, item: 10, measure: true });
      const iy = top + i * step + (step - st.h) / 2;
      over.push(...stack(right ? cx : cx + 0.35, iy, CW - 0.35, { name: it.name, note: it.note }, { name: 13, item: 10, align: right ? 'right' : 'left' }).els);
      return { id: it.id, dx: right ? cx + CW + 0.12 : cx - 0.12, dy: iy + lh(13) / 2 + 0.01 };
    });
  };
  const A = place('left', data.left), B = place('right', data.right);
  const find = (arr, id, side) => { const p = arr.find(q => q.id === id); if (!p) throw new Error(`bridgeMapping: в колонке ${side} нет пункта «${id}»`); return p; };
  const links = (data.links || []).map(l => ({ ...l, a: find(A, l.from, 'left'), b: find(B, l.to, 'right') }));
  const hot = new Set();
  links.forEach(l => { if (l.kind === 'main') { hot.add(l.a); hot.add(l.b); } });
  [...links].sort((p, q) => (p.kind === 'main') - (q.kind === 'main')).forEach(l => {
    const st = l.kind === 'main' ? tone('solid') : l.kind === 'dashed' ? tone('dashed') : { color: C.axis, lw: 1 };
    els.push(seg(l.a.dx + 0.06, l.a.dy, l.b.dx - 0.06, l.b.dy, st));
  });
  [...A, ...B].forEach(p => over.push(oval(p.dx, p.dy, 0.13, { fill: hot.has(p) ? C.accent : C.axis })));
  return [...els, ...over];
}

// Обмен ценностью двух сторон. Вопрос: «что каждая сторона даёт и получает?»
// data: { a: { name, items? }, b: { name, items? }, flows: [{ dir: 'ab'|'ba', tag?, text?, kind? }] }
// Карточки сторон по краям, между ними встречные стрелки: тег и пояснение над каждой, острие у получателя.
function valueExchange(box, data) {
  const { x, y, w, h } = box, els = [], over = [], CWd = Math.min(3.3, w * 0.27), P = 0.24;
  const n = data.flows.length, laneH = Math.min(0.82, h / n), span = laneH * n;
  const need = Math.max(...[data.a, data.b].map(s => stack(0, 0, CWd - 2 * P, s, { name: 16, item: 11, measure: true }).h)) + 2 * P;
  const ch = Math.min(h, Math.max(need, span)), cy = y + (h - ch) / 2, ly0 = y + (h - span) / 2;
  const ax = x, bx = x + w - CWd, x1 = ax + CWd, x2 = bx;
  [[ax, data.a], [bx, data.b]].forEach(([cx, s]) => {   // содержимое по центру карточки: она тянется на всю пачку стрелок
    const sh = stack(0, 0, CWd - 2 * P, s, { name: 16, item: 11, measure: true }).h;
    els.push(card(cx, cy, CWd, ch));
    over.push(...stack(cx + P, cy + (ch - sh) / 2, CWd - 2 * P, s, { name: 16, item: 11 }).els);
  });
  data.flows.forEach((f, i) => {
    const ly = ly0 + laneH * (i + 0.72), st = tone(f.kind), ab = f.dir !== 'ba';
    els.push(hline(x1, x2, ly, st));
    over.push(dotOf(ab ? x1 : x2, ly, f.kind), head(ab ? x2 : x1, ly, ab ? 0 : 180, st.color, 0.16));
    if (f.tag || f.text) {
      const lw = x2 - x1 - 0.6, lb = edgeLabel(f, lw, true);
      over.push(text(x1 + 0.3, ly - 0.08 - lb.h, lw, lb.h, lb.runs, { size: lb.pt, align: 'center', valign: 'bottom', ls: 1.05 }));
    }
  });
  return [...els, ...over];
}

// Двусторонняя платформа. Вопрос: «кого соединяет платформа и что получает каждая сторона?»
// data: { left: { name, items: [строки] }, platform: { name, items? }, right: { name, items: [ … ] },
//         flows: { left: [{ dir: 'in'|'out', text, tag? }], right: [ … ] } }
// in — от стороны к платформе, out — от платформы к стороне. Платформа — рамка акцента в центре.
function platformTwoSided(box, data) {
  const { x, y, w, h } = box, els = [], over = [], SW = Math.min(2.9, w * 0.235), PW = Math.min(3.2, w * 0.26), P = 0.22;
  const GW = (w - 2 * SW - PW) / 2;
  const cols = [[x, data.left, false], [x + SW + GW, data.platform, true], [x + w - SW, data.right, false]];
  const need = Math.max(...cols.map(([, s, hub]) => stack(0, 0, (hub ? PW : SW) - 2 * P, s, { name: hub ? 16 : 14, item: 10.5, measure: true }).h)) + 2 * P;
  const nf = Math.max((data.flows.left || []).length, (data.flows.right || []).length, 1);
  const ch = Math.min(h, Math.max(need, nf * 0.95 + 0.3, h * 0.66)), cy = y + (h - ch) / 2;
  cols.forEach(([cx, s, hub]) => {
    const cw = hub ? PW : SW, o = { name: hub ? 16 : 14, item: 10.5 };
    const sh = stack(0, 0, cw - 2 * P, s, { ...o, measure: true }).h;
    els.push(card(cx, cy, cw, ch, { hub }));
    over.push(...stack(cx + P, cy + (ch - sh) / 2, cw - 2 * P, s, { name: hub ? 16 : 14, item: 10.5, color: hub ? C.accentInk : C.ink }).els);
  });
  [['left', x + SW, x + SW + GW], ['right', x + SW + GW + PW, x + w - SW]].forEach(([side, gx1, gx2]) => {
    const fl = data.flows[side] || [], lane = (ch - 0.3) / Math.max(fl.length, 1);
    fl.forEach((f, i) => {
      const ly = cy + 0.15 + lane * (i + 0.72), st = tone(f.kind);
      const toPlat = f.dir !== 'out', toRight = side === 'left' ? toPlat : !toPlat;
      els.push(hline(gx1, gx2, ly, st));
      over.push(dotOf(toRight ? gx1 : gx2, ly, f.kind), head(toRight ? gx2 : gx1, ly, toRight ? 0 : 180, st.color, 0.16));
      const lw = gx2 - gx1 - 0.3, lb = edgeLabel(f, lw);
      over.push(text(gx1 + 0.15, ly - 0.08 - lb.h, lw, lb.h, lb.runs, { size: lb.pt, align: 'center', valign: 'bottom', ls: 1.05 }));
    });
  });
  return [...els, ...over];
}

// Матричная структура. Вопрос: «кто ведёт и кто участвует на пересечении направлений и функций?»
// data: { rows: [{ name, note? }], cols: [{ name, note? }], cells: [{ r, c, mark: 'lead'|'part', note? }] }
// Направления — строки, функции — колонки, линии строк и колонок — нити подчинения. lead — заливка акцента,
// part — контур; пометка ячейки справа снизу от маркера, чтобы нити её не перечёркивали. Легенда внизу.
function matrixOrg(box, data) {
  const { x, y, w, h } = box, els = [], over = [], RW = Math.min(2.7, w * 0.22), HH = 0.72, LG = 0.34;
  const gx = x + RW + 0.2, gw = w - RW - 0.2, cw = gw / data.cols.length, gy = y + HH, rh = (h - HH - LG) / data.rows.length;
  const cxOf = c => gx + cw * (c + 0.5), cyOf = r => gy + rh * (r + 0.35);
  data.cols.forEach((c, i) => {
    over.push(text(gx + cw * i + 0.05, y, cw - 0.1, 0.3, c.name, { size: 12, bold: true, align: 'center', valign: 'middle' }));
    if (c.note) over.push(text(gx + cw * i + 0.05, y + 0.3, cw - 0.1, 0.26, c.note, { size: 9.5, color: C.muted, align: 'center', valign: 'middle' }));
    els.push(vline(cxOf(i), gy - 0.08, y + h - LG - 0.12, { color: C.line, lw: 0.75 }));
  });
  data.rows.forEach((r, i) => {
    over.push(...stack(x, cyOf(i) - lh(13) / 2, RW, { name: r.name, note: r.note }, { name: 13, item: 10 }).els);
    els.push(hline(gx - 0.1, gx + gw, cyOf(i), { color: C.line, lw: 0.75 }));
  });
  data.cells.forEach(c => {
    const cx = cxOf(c.c), cy = cyOf(c.r), lead = c.mark === 'lead';
    over.push(lead ? oval(cx, cy, 0.28, { fill: C.accent }) : oval(cx, cy, 0.22, { fill: C.bg, line: C.accent, lw: 1.5 }));
    if (c.note) over.push(text(cx + 0.16, cy + 0.1, cw / 2 - 0.2, Math.min(rh - 0.45, 0.42), c.note, { size: 9.5, color: lead ? C.ink2 : C.muted, ls: 1.05 }));
  });
  const ly = y + h - 0.16;
  over.push(oval(gx + 0.1, ly, 0.2, { fill: C.accent }), text(gx + 0.28, ly - 0.14, 1.8, 0.28, 'ведёт направление', { size: 10, color: C.ink2, valign: 'middle' }));
  over.push(oval(gx + 2.3, ly, 0.17, { fill: C.bg, line: C.accent, lw: 1.5 }), text(gx + 2.48, ly - 0.14, 1.8, 0.28, 'участвует', { size: 10, color: C.ink2, valign: 'middle' }));
  return [...els, ...over];
}

// Диаграмма причин (рыбья кость). Вопрос: «из-за чего возникает проблема?»
// data: { effect: { name, note? }, bones: [{ name, causes: [строки] }] } — 4–6 костей, до 3 причин на кость.
// Хребет со стрелкой к карточке проблемы справа, кости-категории наклонно сверху и снизу по очереди,
// причины строками справа от кости: соседние кости параллельны, поэтому текст их не задевает.
function causeEffect(box, data) {
  const { x, y, w, h } = box, els = [], over = [], EW = Math.min(2.8, w * 0.23), P = 0.24;
  const sy = y + h / 2, ex = x + w - EW;
  const en = stack(0, 0, EW - 2 * P, data.effect, { name: 16, item: 11, measure: true }).h + 2 * P;
  const eh = Math.max(1.3, en);
  els.push(card(ex, sy - eh / 2, EW, eh, { hub: true }));
  over.push(...stack(ex + P, sy - eh / 2 + P, EW - 2 * P, data.effect, { name: 16, item: 11, color: C.accentInk }).els);
  els.push(hline(x, ex - 0.04, sy, { color: C.accent, lw: 2.5 }));
  over.push(head(ex - 0.02, sy, 0, C.accent, 0.2));
  const k = data.bones.length, nTop = Math.ceil(k / 2), SL = 0.55;      // наклон: dx = SL × высота кости
  const LBL = 0.34, len = h / 2 - LBL - 0.05, dx = len * SL;
  const x0 = x + dx + 0.1, step = (ex - x0 + dx / 3) / (nTop + 1);   // у крайней правой кости остаётся шаг под причины
  data.bones.forEach((b, i) => {
    const up = i % 2 === 0, j = Math.floor(i / 2);
    const bx = x0 + step * (j + (up ? 0.5 : 1.0)), tx = bx - dx, ty = up ? sy - len : sy + len;
    els.push(seg(bx, sy, tx, ty, { color: C.axis, lw: 1.5 }));
    over.push(oval(bx, sy, 0.12, { fill: C.accent }));
    const lw = Math.min(step - 0.2, 2.6);
    over.push(text(tx - 0.15, up ? ty - LBL : ty + 0.04, lw, LBL - 0.04, caps(b.name), { size: 10.5, bold: true, color: C.accentInk, valign: up ? 'bottom' : 'top' }));
    const cs = b.causes.slice(0, 3);
    cs.forEach((c, q) => {
      const t = (q + 1) / (cs.length + 1), qx = bx - (bx - tx) * t, qy = sy - (sy - ty) * t;
      const cw = Math.min(step - 0.45, ex - 0.25 - (qx + 0.2));   // до соседней кости и не дальше карточки проблемы
      const nl = lines(c, 10, cw), th = lh(10) * nl + 0.04;
      els.push(hline(qx, qx + 0.14, qy, { color: C.axis, lw: 1 }));
      over.push(text(qx + 0.2, qy - th / 2, cw, th, c, { size: 10, color: C.ink2, valign: 'middle', ls: 1.05 }));
    });
  });
  return [...els, ...over];
}

module.exports = { busIntegration, bridgeMapping, valueExchange, platformTwoSided, matrixOrg, causeEffect };
