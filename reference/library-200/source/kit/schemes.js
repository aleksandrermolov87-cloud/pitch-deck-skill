// Схемы связей: участники и подписанные связи между ними (под-скилл «Схемы», reference/19-schemes.md).
// Распределение ролей, взаимодействие подразделений и партнёров, экосистема, контуры обмена данными и деньгами.
// API как в components.js: (box, data, opt) → els.
const L = require('../lib.js');
const U = require('./util.js');
const { C, THEME, rect, oval, hline, vline, text, tw, place3d } = L;
const { lines, lh } = U;

const ICON = 0.62, PAD = 0.22, DOT = 0.11, LBL = 9.5;
const idOf = n => n.id ?? n.name;

// Цена связи в сетке: соседи по ряду или колонке — 1, диагональ — 2, скобка через ряд — 2,5, дальние — дороже.
// Диагональ, у которой оба колена упираются в занятые ячейки, идёт через межрядный зазор и спорит с подписями — 6.
function edgeCost(a, b, rows, occ) {
  const dc = Math.abs(a[0] - b[0]), dr = Math.abs(a[1] - b[1]);
  if (dr === 0) return dc === 1 ? 1 : (a[1] === 0 || a[1] === rows - 1 ? 2.5 : 6);
  if (dc === 0) return dr === 1 ? 1 : 6;
  if (dc === 1 && dr === 1) {
    const [u, d] = a[1] < b[1] ? [a, b] : [b, a];
    return occ && occ.has(`${u[0]},${d[1]}`) && occ.has(`${d[0]},${u[1]}`) ? 6 : 2;
  }
  return 4 + dc + dr;
}

// Раскладка по умолчанию: хаб сверху в центре (при 7–9 узлах — в центре сетки 3 × 3), остальные узлы перебором
// по ячейкам с наименьшей суммарной ценой связей; заметки (note) — в свободные ячейки в конце.
function autoLayout(nodes, edges) {
  const deg = new Map(nodes.map(n => [idOf(n), 0]));
  edges.forEach(e => { deg.set(e.from, (deg.get(e.from) || 0) + 1); deg.set(e.to, (deg.get(e.to) || 0) + 1); });
  const live = nodes.filter(n => n.kind !== 'note');
  const hub = live.find(n => n.kind === 'hub') || [...live].sort((a, b) => deg.get(idOf(b)) - deg.get(idOf(a)))[0];
  const big = nodes.length > 6, rows = big ? 3 : 2;
  const slots = big ? [[1, 1], [0, 1], [2, 1], [1, 0], [1, 2], [0, 0], [2, 0], [0, 2], [2, 2]] : [[1, 0], [0, 0], [2, 0], [1, 1], [0, 1], [2, 1]];
  const rest = live.filter(n => n !== hub), free = slots.slice(1);
  const pos = new Map([[idOf(hub), slots[0]]]);
  let best = null, bestCost = Infinity;
  const used = new Array(free.length).fill(false), pick = [];
  (function go(i) {
    if (i === rest.length) {
      rest.forEach((n, k) => pos.set(idOf(n), free[pick[k]]));
      let c = pick.reduce((s, p) => s + p * 0.01, 0);   // при равной цене — раньше по списку ячеек
      const occ = new Set([...pos.values()].map(p => p.join(',')));
      edges.forEach(e => { if (pos.has(e.from) && pos.has(e.to)) c += edgeCost(pos.get(e.from), pos.get(e.to), rows, occ); });
      if (c < bestCost - 1e-9) { bestCost = c; best = [...pick]; }
      return;
    }
    for (let s = 0; s < free.length; s++) if (!used[s]) { used[s] = true; pick.push(s); go(i + 1); pick.pop(); used[s] = false; }
  })(0);
  if (!hub.at) hub.at = slots[0];
  rest.forEach((n, k) => { if (!n.at) n.at = free[best[k]]; });
  const left = free.filter((_, s) => !best.includes(s));
  nodes.filter(n => n.kind === 'note').forEach(n => { if (!n.at) n.at = left.pop() || slots[slots.length - 1]; });
  return { cols: 3, rows };
}

const label = (e, w, inline) => U.edgeLabel(e, w, inline, LBL);

// Схема связей. Вопрос: «кто с кем и о чём взаимодействует?»
// data: {
//   nodes: [{ id?, name, items?: [строки], kind?: 'hub'|'node'|'note', icon?: 'файл.png' из img/3d, at?: [кол, ряд] }],
//   edges: [{ from, to, tag?, text?, kind?: 'solid'|'dashed', route?: 'straight'|'over'|'under'|'elbow', pill? }],
//   cols?, rows?, footnote?,
//   zones?: [{ name, nodes: [id], kind?: 'accent'|'muted' }]   контур вокруг группы узлов: периметр, «внутри банка», «наша система»
// }
// hub — центр связей (рамка акцента, имя акцентом), node — участник, note — вывод или правило схемы (картинка и жирный текст, без связей).
// Без at узлы раскладываются сами (autoLayout). Связи трассируются сами: соседи в ряду — прямая, через ряд — скобка
// над рядом (over) или под ним (under), соседи по колонке — вертикаль с плашкой pill, остальные — колено в обход узлов.
// У каждой кромки свои порты: две связи не садятся в одну точку. dashed — оперативная или вторичная связь.
// Направление пишется словами в подписи («передаёт», «обратная связь»), стрелок нет.
// opt.gap — ширина зазора между колонками под подписи (по умолчанию 1,4″). Плотная схема ужимает кегли сама, до 74%.
function schemeMap(box, data, opt = {}) {
  const nodes = data.nodes.map(n => ({ ...n })), edges = (data.edges || []).map(e => ({ ...e }));
  const byId = new Map(nodes.map(n => [idOf(n), n]));
  edges.forEach(e => ['from', 'to'].forEach(k => { if (!byId.has(e[k])) throw new Error(`schemeMap: связь ссылается на неизвестный узел «${e[k]}»`); }));
  const grid = nodes.every(n => n.at) ? {} : autoLayout(nodes, edges);
  const cols = data.cols || grid.cols || Math.max(...nodes.map(n => n.at[0])) + 1;
  const rows = data.rows || grid.rows || Math.max(...nodes.map(n => n.at[1])) + 1;

  // маршрут каждой связи
  edges.forEach(e => {
    const a = byId.get(e.from), b = byId.get(e.to), [ca, ra] = a.at, [cb, rb] = b.at;
    if (!e.route) e.route = ra === rb ? (Math.abs(ca - cb) === 1 ? 'straight' : ra === rows - 1 && ra > 0 ? 'under' : 'over')
      : ca === cb ? 'straight' : 'elbow';
    if ((e.route === 'over' && ra !== 0) || (e.route === 'under' && ra !== rows - 1) || ((e.route === 'over' || e.route === 'under') && ra !== rb)) {
      console.warn(`schemeMap: связь ${e.from} → ${e.to}: скобка ${e.route} — только между узлами крайнего ряда, рисую коленом`);
      e.route = 'elbow';
    }
  });

  const { x, y, w, h } = box, GAP = opt.gap ?? 1.4;
  const nw = (w - GAP * (cols - 1)) / cols, colX = c => x + c * (nw + GAP);
  const nOver = edges.filter(e => e.route === 'over').length, nUnder = edges.filter(e => e.route === 'under').length;
  const overH = nOver ? 0.56 + 0.3 * (nOver - 1) : 0, underH = nUnder ? 0.56 + 0.3 * (nUnder - 1) : 0;
  const footH = data.footnote ? 0.3 : 0;
  const zoneTop = (data.zones || []).some(z => z.nodes.some(id => byId.get(id) && byId.get(id).at[1] === 0)) ? 0.32 : 0;
  const vert = edges.some(e => e.route === 'straight' && byId.get(e.from).at[0] === byId.get(e.to).at[0]);

  // высота содержимого узла по ширине колонки; не влезает — кегли и отступы ужимаются ступенями
  let RG = vert ? 0.72 : 0.5, rowH, base, S;
  const topH = overH ? overH + zoneTop : zoneTop, avail = h - topH - underH - footH;
  for (const k of [1, 0.91, 0.82, 0.74]) {
    S = { k, pad: PAD * k, icon: ICON * k, name: Math.round(15 * k * 2) / 2, item: Math.max(8, Math.round(11 * k * 2) / 2), note: Math.round(14 * k * 2) / 2 };
    S.iw = nw - 2 * S.pad - 0.2;
    nodes.forEach(n => {
      if (n.kind === 'note') { n.need = Math.max(1.1 * k, lh(S.note) * lines(n.name, S.note, nw - 2 * S.pad - (n.icon ? 1.45 * k : 0), true) + 2 * S.pad); return; }
      const nameW = nw - 2 * S.pad - (n.icon ? S.icon + 0.14 : 0);
      n.headH = Math.max(n.icon ? S.icon : 0, lh(S.name) * lines(n.name, S.name, nameW, true));
      n.itemH = (n.items || []).map(t => lh(S.item) * lines(t, S.item, S.iw) + 0.05 * k);
      n.need = S.pad + n.headH + (n.itemH.length ? 0.16 * k + n.itemH.reduce((s, v) => s + v, 0) : 0) + S.pad;
    });
    rowH = [...Array(rows)].map((_, r) => Math.max(0.9 * k, ...nodes.filter(n => n.at[1] === r).map(n => n.need)));
    base = rowH.reduce((s, v) => s + v, 0) + RG * (rows - 1);
    if (base <= avail + 0.01) break;
  }
  if (base > avail + 0.01) console.warn(`schemeMap: содержимое выше бокса на ${(base - avail).toFixed(2)}″ даже в мелком кегле — сократите пункты, уберите подзаголовок или узел`);
  let extra = Math.max(0, avail - base);
  const grow = Math.min(0.45, extra / (2 * rows));
  rowH.forEach((_, r) => { rowH[r] += grow; });
  extra -= grow * rows;
  if (rows > 1) { const add = Math.min(extra, (1.4 - RG) * (rows - 1)); RG += add / (rows - 1); extra -= add; }
  const rowY = [y + topH + extra / 2];
  for (let r = 1; r < rows; r++) rowY[r] = rowY[r - 1] + rowH[r - 1] + RG;
  nodes.forEach(n => { n.x = colX(n.at[0]); n.y = rowY[n.at[1]]; n.w = nw; n.h = rowH[n.at[1]]; n.cx = n.x + nw / 2; });

  // порты на верхней и нижней кромках: центр, затем ±28% и ±40% ширины в сторону другого конца связи
  const ports = new Map();
  const port = (n, side, toward, fixed) => {
    const k = `${idOf(n)}:${side}`, used = ports.get(k) || [];
    let px = fixed;
    if (px == null) {
      const s = toward > n.cx + 0.01 ? 1 : toward < n.cx - 0.01 ? -1 : 0;
      const cand = [0, 0.28 * s || 0.28, 0.4 * s || -0.28, -0.28 * (s || 1), 0.4 * (s || 1) * -1].map(d => n.cx + d * n.w);
      px = cand.find(c => used.every(u => Math.abs(u - c) > 0.22)) ?? n.cx;
    }
    ports.set(k, [...used, px]);
    return px;
  };
  const hits = (x1, x2, yy, skip) => nodes.some(n => !skip.includes(n) && yy > n.y - 0.02 && yy < n.y + n.h + 0.02 && Math.max(x1, x2) > n.x && Math.min(x1, x2) < n.x + n.w);
  const vhits = (xx, y1, y2, skip) => nodes.some(n => !skip.includes(n) && xx > n.x - 0.02 && xx < n.x + n.w + 0.02 && Math.max(y1, y2) > n.y && Math.min(y1, y2) < n.y + n.h);

  const segs = [], marks = [], over = [];
  const tone = e => (e.kind === 'dashed' ? { color: C.axis, lw: 1.25, dash: true } : { color: C.accent, lw: 1.75 });
  const dot = (px, py, e) => marks.push(oval(px, py, DOT, { fill: e.kind === 'dashed' ? C.axis : C.accent }));
  const H_ = (x1, x2, yy, e) => segs.push(hline(Math.min(x1, x2), Math.max(x1, x2), yy, tone(e)));
  const V_ = (xx, y1, y2, e) => segs.push(vline(xx, Math.min(y1, y2), Math.max(y1, y2), tone(e)));
  const above = (e, cx, bottom, lw, inline) => {   // подпись над точкой (cx, bottom)
    if (!e.tag && !e.text) return;
    const lb = label(e, lw, inline);
    over.push(text(cx - lw / 2, bottom - lb.h, lw, lb.h, lb.runs, { size: lb.pt, align: 'center', valign: 'bottom', ls: 1.05 }));
  };
  const isVert = e => e.route === 'straight' && byId.get(e.from).at[0] === byId.get(e.to).at[0];
  const rank = e => (isVert(e) ? 0 : e.route === 'straight' ? 1 : e.route === 'elbow' ? 3 : 2);
  let lane = { over: 0, under: 0 };

  [...edges].sort((p, q) => rank(p) - rank(q)).forEach(e => {
    let a = byId.get(e.from), b = byId.get(e.to);
    if (e.route === 'straight' && !isVert(e)) {                      // соседи в ряду
      if (a.x > b.x) [a, b] = [b, a];
      const yy = Math.max(a.y, b.y) + Math.min(a.h, b.h) / 2, x1 = a.x + a.w, x2 = b.x;
      H_(x1, x2, yy, e); dot(x1, yy, e); dot(x2, yy, e);
      above(e, (x1 + x2) / 2, yy - 0.1, x2 - x1 - 0.16);
    } else if (e.route === 'straight') {                              // соседи по колонке
      if (a.y > b.y) [a, b] = [b, a];
      const xx = port(a, 'bottom', a.cx, a.cx); port(b, 'top', b.cx, xx);
      const y1 = a.y + a.h, y2 = b.y, ym = (y1 + y2) / 2;
      V_(xx, y1, y2, e); dot(xx, y1, e); dot(xx, y2, e);
      let lx = xx + 0.18;
      if (e.pill) {
        const pw = tw(e.pill, 11, true) * 1.08 + 0.5, ph = 0.36;
        over.push(rect(xx - pw / 2, ym - ph / 2, pw, ph, { r: ph / 2, fill: C.accent }),
          text(xx - pw / 2, ym - ph / 2, pw, ph, e.pill, { size: 11, bold: true, color: C.onAccent, align: 'center', valign: 'middle' }));
        lx = xx + pw / 2 + 0.18;
      }
      if (e.tag || e.text) {
        const lw = Math.min(3.9, x + w - lx), lb = label(e, lw);
        over.push(text(lx, ym - lb.h / 2, lw, lb.h, lb.runs, { size: lb.pt, valign: 'middle', ls: 1.05 }));
      }
    } else if (e.route === 'over' || e.route === 'under') {           // скобка над или под рядом
      if (a.x > b.x) [a, b] = [b, a];
      const up = e.route === 'over', side = up ? 'top' : 'bottom', i = lane[e.route]++;
      const xa = port(a, side, b.cx), xb = port(b, side, a.cx);
      const ya = up ? a.y : a.y + a.h, yb = up ? b.y : b.y + b.h;
      const yl = up ? Math.min(ya, yb) - 0.26 - 0.3 * i - zoneTop : Math.max(ya, yb) + 0.26 + 0.3 * i;   // скобка — над рамкой контура
      V_(xa, yl, ya, e); V_(xb, yl, yb, e); H_(xa, xb, yl, e); dot(xa, ya, e); dot(xb, yb, e);
      const lw = Math.min(8, xb - xa - 0.4);
      if (up) above(e, (xa + xb) / 2, yl - 0.05, lw, true);
      else if (e.tag || e.text) { const lb = label(e, lw, true); over.push(text((xa + xb) / 2 - lw / 2, yl + 0.05, lw, lb.h, lb.runs, { size: lb.pt, align: 'center', ls: 1.05 })); }
    } else {                                                          // колено в обход узлов
      if (a.y > b.y) [a, b] = [b, a];
      const yt = b.y + b.h / 2, xe = b.x > a.cx ? b.x : b.x + b.w;
      const xs = port(a, 'bottom', b.cx);
      const sideA = b.x > a.x ? a.x + a.w : a.x, ya = a.y + a.h / 2;
      if (!vhits(xs, a.y + a.h, yt, [a, b]) && !hits(xs, xe, yt, [a, b])) {          // вниз из нижней кромки, затем вбок к стороне
        V_(xs, a.y + a.h, yt, e); H_(xs, xe, yt, e); dot(xs, a.y + a.h, e); dot(xe, yt, e);
        above(e, (xs + xe) / 2, yt - 0.1, Math.abs(xe - xs) - 0.3);
        return;
      }
      ports.get(`${idOf(a)}:bottom`).pop();
      const xb = port(b, 'top', a.cx);
      if (!hits(sideA, xb, ya, [a, b]) && !vhits(xb, ya, b.y, [a, b])) {             // вбок от стороны, затем вниз к верхней кромке
        H_(sideA, xb, ya, e); V_(xb, ya, b.y, e); dot(sideA, ya, e); dot(xb, b.y, e);
        above(e, (sideA + xb) / 2, ya - 0.1, Math.abs(xb - sideA) - 0.3);
        return;
      }
      const xs2 = port(a, 'bottom', b.cx), yg = a.y + a.h + RG / 2;                    // через межрядный зазор
      V_(xs2, a.y + a.h, yg, e); H_(xs2, xb, yg, e); V_(xb, yg, b.y, e); dot(xs2, a.y + a.h, e); dot(xb, b.y, e);
      if (hits(xs2, xb, yg, [a, b])) console.warn(`schemeMap: связь ${e.from} → ${e.to} проходит через узел — задайте at вручную`);
      above(e, (xs2 + xb) / 2, yg - 0.08, Math.abs(xb - xs2) - 0.3);
    }
  });

  const els = [], { pad: P, icon: I } = S;
  (data.zones || []).forEach(z => {   // контур группы: пунктирная рамка с отступом и подпись капителью на подложке
    const ns = z.nodes.map(id => byId.get(id)).filter(Boolean);
    if (!ns.length) return;
    const m = 0.16, zx = Math.min(...ns.map(n => n.x)) - m, zy = Math.min(...ns.map(n => n.y)) - m - 0.12;
    const zw = Math.max(...ns.map(n => n.x + n.w)) + m - zx, zh = Math.max(...ns.map(n => n.y + n.h)) + m - zy;
    const ink = z.kind === 'muted' ? C.muted : C.accentInk, cap = String(z.name).toUpperCase(), cw = tw(cap, 8.5, true) * 1.2 + 0.24;
    els.push(rect(zx, zy, zw, zh, { r: 0.22, line: z.kind === 'muted' ? C.axis : C.accent, lw: 1, dash: true }));
    els.push(U.knock(zx + 0.2, zy - 0.12, cw, 0.24), text(zx + 0.2, zy - 0.12, cw, 0.24, cap, { size: 8.5, bold: true, color: ink, align: 'center', valign: 'middle' }));
  });
  els.push(...segs);
  nodes.forEach(n => {
    const hub = n.kind === 'hub';
    els.push(rect(n.x, n.y, n.w, n.h, { r: 0.16, fill: THEME === 'dark' ? C.card : C.panel, alpha: THEME === 'dark' ? C.cardA : 1, line: hub ? C.accent : C.cardLine, lw: hub ? 2 : 0.75 }));
    if (n.kind === 'note') {
      const d = Math.min(n.h - 2 * P, 1.3 * S.k), tx = n.x + P + (n.icon ? d + 0.15 : 0);
      if (n.icon) els.push(...place3d({ x: n.x + P, y: n.y + (n.h - d) / 2, w: d, h: d }, n.icon, { optical: d * 0.85, align: 'center', glow: false }));
      els.push(text(tx, n.y + P, n.x + n.w - P - tx, n.h - 2 * P, n.name, { size: S.note, bold: true, valign: 'middle', ls: 1.1 }));
      return;
    }
    const top = n.y + P, tx = n.x + P + (n.icon ? I + 0.14 : 0);
    if (n.icon) els.push(...place3d({ x: n.x + P, y: top + (n.headH - I) / 2, w: I, h: I }, n.icon, { optical: I * 0.82, align: 'center', glow: false }));
    els.push(text(tx, top, n.x + n.w - P - tx, n.headH, n.name, { size: S.name, bold: true, color: hub ? C.accentInk : C.ink, valign: 'middle', ls: 1.05 }));
    let yy = top + n.headH + 0.16 * S.k;
    (n.items || []).forEach((t, i) => {
      els.push(oval(n.x + P + 0.05, yy + lh(S.item) / 2, 0.065, { fill: C.accent }));
      els.push(text(n.x + P + 0.2, yy, S.iw, n.itemH[i] - 0.05 * S.k, t, { size: S.item, color: C.ink2, ls: 1.1 }));
      yy += n.itemH[i];
    });
  });
  els.push(...marks, ...over);
  if (data.footnote) els.push(text(x, y + h - 0.26, w, 0.26, data.footnote, { size: 9, color: C.muted, valign: 'bottom' }));
  return els;
}


// ═════════════ ВАРИАНТЫ НА ДВИЖКЕ СХЕМЫ И СОСЕДНИЕ ═════════════

// Хаб в центре сетки 3 × 3: до 8 участников вокруг, связи по лучам от рамки хаба к рамке узла, подписи в зазорах.
// Вопрос: «кто вокруг центра и что каждый с ним делает?»
// data: { center: { name, note?, items? }, nodes: [{ name, items?, tag?, text?, kind?: 'solid'|'dashed' }] } 3–8.
// Порядок ячеек: слева, справа, сверху, снизу, затем углы.
function hubSpoke(box, data, opt = {}) {
  const { x, y, w, h } = box, gx = opt.gap ?? 1.35, gy = 0.62, cw = (w - 2 * gx) / 3, ch = (h - 2 * gy) / 3;
  const cell = (c, r) => ({ x: x + c * (cw + gx), y: y + r * (ch + gy), w: cw, h: ch });
  const order = [[0, 1], [2, 1], [1, 0], [1, 2], [0, 0], [2, 0], [0, 2], [2, 2]];
  const hub = cell(1, 1), els = [], marks = [], labels = [];
  const nodes = data.nodes.slice(0, 8).map((n, i) => ({ ...n, at: order[i], r: cell(...order[i]) }));
  if (data.nodes.length > 8) console.warn('hubSpoke: больше 8 участников — лишние не показаны, возьмите schemeMap или orbitRings');
  // кегли под самый плотный узел
  const pad = 0.18, fit = k => Math.max(...nodes.map(n => U.stack(0, 0, cw - 2 * pad, n, { name: 13 * k, item: 10 * k, measure: true }).h)) + 2 * pad <= ch;
  const k = [1, 0.92, 0.84].find(fit) || 0.84;
  nodes.forEach(n => {
    const hc = [hub.x + hub.w / 2, hub.y + hub.h / 2], nc = [n.r.x + n.r.w / 2, n.r.y + n.r.h / 2];
    const [x1, y1] = U.clipRect(hub, ...nc), [x2, y2] = U.clipRect(n.r, ...hc);
    els.push(U.seg(x1, y1, x2, y2, U.tone(n.kind)));
    const dc = n.kind === 'dashed' ? C.axis : C.accent;
    marks.push(oval(x1, y1, DOT, { fill: dc }), oval(x2, y2, DOT, { fill: dc }));
    if (!n.tag && !n.text) return;
    const [c, r] = n.at;
    if (r === 1) {                                   // слева и справа: над линией в зазоре
      const lw = gx - 0.14, lb = label(n, lw);
      labels.push(text((x1 + x2) / 2 - lw / 2, y1 - 0.08 - lb.h, lw, lb.h, lb.runs, { size: lb.pt, align: 'center', valign: 'bottom', ls: 1.05 }));
    } else if (c === 1) {                            // сверху и снизу: справа от линии
      const lw = cw / 2 - 0.3, lb = label(n, lw), ym = (y1 + y2) / 2;
      labels.push(text(x1 + 0.14, ym - lb.h / 2, lw, lb.h, lb.runs, { size: lb.pt, valign: 'middle', ls: 1.05 }));
    } else {                                         // углы: на перекрестье зазоров, на подложке
      const lw = gx - 0.14, lb = label(n, lw), cx = c === 0 ? hub.x - gx / 2 : hub.x + hub.w + gx / 2, cy = r === 0 ? hub.y - gy / 2 : hub.y + hub.h + gy / 2;
      labels.push(U.knock(cx - lw / 2, cy - lb.h / 2, lw, lb.h), text(cx - lw / 2, cy - lb.h / 2, lw, lb.h, lb.runs, { size: lb.pt, align: 'center', valign: 'middle', ls: 1.05 }));
    }
  });
  nodes.forEach(n => { els.push(U.card(n.r.x, n.r.y, cw, ch)); els.push(...U.stack(n.r.x + pad, n.r.y + pad, cw - 2 * pad, n, { name: 13 * k, item: 10 * k }).els); });
  els.push(U.card(hub.x, hub.y, hub.w, hub.h, { hub: true }));
  const hs = U.stack(0, 0, cw - 2 * pad, data.center, { name: 15 * k, item: 10 * k, measure: true });
  els.push(...U.stack(hub.x + pad, hub.y + Math.max(pad, (ch - hs.h) / 2), cw - 2 * pad, data.center, { name: 15 * k, item: 10 * k, color: C.accentInk }).els);
  return [...els, ...marks, ...labels];
}

// Контекстная схема системы (уровень C4 «контекст»): наша система в центре внутри контура, пользователи и внешние системы
// вокруг, связи с подписями «что передаётся». Вопрос: «с кем и чем обменивается система?»
// data: { system: { name, items? }, boundary?: 'Контур банка', users: [{ name, items?, tag?, text? }], external: [{ name, items?, tag?, text?, kind? }] }
// Пользователи — сплошные связи, внешние системы — пунктир по умолчанию. Всего до 5 участников.
function contextDiagram(box, data, opt = {}) {
  const nodes = [{ id: 'sys', kind: 'hub', name: data.system.name, items: data.system.items }], edges = [];
  (data.users || []).forEach((u, i) => { nodes.push({ id: `u${i}`, name: u.name, items: u.items }); edges.push({ from: `u${i}`, to: 'sys', tag: u.tag, text: u.text, kind: u.kind }); });
  (data.external || []).forEach((u, i) => { nodes.push({ id: `x${i}`, name: u.name, items: u.items }); edges.push({ from: 'sys', to: `x${i}`, tag: u.tag, text: u.text, kind: u.kind || 'dashed' }); });
  return schemeMap(box, { nodes, edges, zones: [{ name: data.boundary || 'Наша система', nodes: ['sys'] }], footnote: data.footnote }, opt);
}

// Схема контура: что внутри периметра (банк, команда, наша платформа), что снаружи и какие связи пересекают границу.
// Вопрос: «что делаем сами, что отдаём наружу и где стык?»
// data: { inside: 'Внутри банка', outside?: 'Партнёры', nodes: [{ id, name, items?, zone: 'in'|'out', hub? }], edges: [{ from, to, tag?, text?, kind? }] }
// Внутренние узлы — в двух левых колонках (до 4), внешние — в правой (до 2).
function contourMap(box, data, opt = {}) {
  const ins = data.nodes.filter(n => n.zone !== 'out'), outs = data.nodes.filter(n => n.zone === 'out');
  const rows = Math.max(Math.ceil(ins.length / 2), outs.length, 1);
  const nodes = [...ins.map((n, i) => ({ ...n, kind: n.hub ? 'hub' : n.kind, at: [i % 2, Math.floor(i / 2)] })), ...outs.map((n, i) => ({ ...n, at: [2, i] }))];
  const zones = [{ name: data.inside || 'Внутри', nodes: ins.map(n => n.id) }];
  if (outs.length) zones.push({ name: data.outside || 'Снаружи', nodes: outs.map(n => n.id), kind: 'muted' });
  return schemeMap(box, { nodes, edges: data.edges, cols: 3, rows, zones, footnote: data.footnote }, { gap: 1.55, ...opt });
}

// Архитектура с потоками: слои строками (каналы, сервисы, данные, внешние), блоки карточками, потоки между блоками
// соседних слоёв со стрелкой и подписью. Вопрос: «как запрос проходит через систему?»
// data: { layers: [{ name, blocks: [{ id, name, note? }] }], flows: [{ from, to, tag?, text?, kind? }] }
// Слой — 1–4 блока, слоёв 2–4. Поток идёт между соседними слоями: прямой вертикалью, если блоки друг под другом, иначе коленом.
function archFlows(box, data, opt = {}) {
  const { x, y, w, h } = box, LW = opt.labelW ?? 1.75, n = data.layers.length, gx = 0.45;
  const RG = Math.max(0.55, Math.min(0.9, (h - n * 0.8) / Math.max(1, n - 1))), rh = (h - RG * (n - 1)) / n;
  const area = { x: x + LW, w: w - LW }, maxN = Math.max(...data.layers.map(l => l.blocks.length));
  const bw = Math.min(3.2, (area.w - gx * (maxN - 1)) / maxN), byId = new Map(), els = [], marks = [], labels = [];
  data.layers.forEach((l, r) => {
    const ly = y + r * (rh + RG), rowW = l.blocks.length * bw + (l.blocks.length - 1) * gx, x0 = area.x + (area.w - rowW) / 2;
    els.push(L.vline(x, ly + 0.04, ly + rh - 0.04, { color: C.accent, lw: 2 }));
    const cap = String(l.name).toUpperCase(), cl = lines(cap, 9.5, LW - 0.4, true);
    labels.push(text(x + 0.16, ly + rh / 2 - lh(9.5) * cl / 2, LW - 0.36, lh(9.5) * cl + 0.04, cap, { size: 9.5, bold: true, color: C.ink2, valign: 'middle', ls: 1.05 }));
    l.blocks.forEach((b, i) => byId.set(b.id, { ...b, r, x: x0 + i * (bw + gx), y: ly, w: bw, h: rh, cx: x0 + i * (bw + gx) + bw / 2 }));
  });
  const ports = new Map(), port = (b, side, want) => {
    const k = `${b.id}:${side}`, used = ports.get(k) || [];
    const cand = [want, b.cx, b.cx - 0.28 * b.w, b.cx + 0.28 * b.w, b.cx - 0.4 * b.w, b.cx + 0.4 * b.w].map(v => Math.min(b.x + b.w - 0.15, Math.max(b.x + 0.15, v)));
    const px = cand.find(c => used.every(u => Math.abs(u - c) > 0.25)) ?? b.cx;
    ports.set(k, [...used, px]);
    return px;
  };
  (data.flows || []).forEach(f => {
    let a = byId.get(f.from), b = byId.get(f.to);
    if (!a || !b) throw new Error(`archFlows: поток ссылается на неизвестный блок «${!a ? f.from : f.to}»`);
    if (Math.abs(a.r - b.r) !== 1) console.warn(`archFlows: поток ${f.from} → ${f.to} перескакивает слой — рисую, но проверьте читаемость`);
    const down = b.r > a.r, st = U.tone(f.kind), col = st.color;
    const lo = Math.max(a.x, b.x) + 0.15, hi = Math.min(a.x + a.w, b.x + b.w) - 0.15;
    const ya = down ? a.y + a.h : a.y, yb = down ? b.y : b.y + b.h;
    let lx, ly2, lwid;
    if (hi - lo >= 0.3) {                             // блоки друг под другом: прямая вертикаль
      const px = port(a, down ? 'bottom' : 'top', (lo + hi) / 2); port(b, down ? 'top' : 'bottom', px);
      els.push(L.vline(px, Math.min(ya, yb), Math.max(ya, yb), st));
      marks.push(oval(px, ya, DOT, { fill: col }), U.head(px, yb, down ? 90 : 270, col));
      lx = px + 0.14; ly2 = (ya + yb) / 2; lwid = Math.min(2.6, x + w - lx);
      if (f.tag || f.text) { const lb = label(f, lwid); labels.push(text(lx, ly2 - lb.h / 2, lwid, lb.h, lb.runs, { size: lb.pt, valign: 'middle', ls: 1.05 })); }
    } else {                                         // колено через межслойный зазор
      const pa = port(a, down ? 'bottom' : 'top', b.cx), pb = port(b, down ? 'top' : 'bottom', a.cx), ym = (ya + yb) / 2;
      els.push(L.vline(pa, Math.min(ya, ym), Math.max(ya, ym), st), L.hline(Math.min(pa, pb), Math.max(pa, pb), ym, st), L.vline(pb, Math.min(ym, yb), Math.max(ym, yb), st));
      marks.push(oval(pa, ya, DOT, { fill: col }), U.head(pb, yb, down ? 90 : 270, col));
      if (f.tag || f.text) {
        const lwid2 = Math.max(1.2, Math.abs(pb - pa) - 0.4), lb = label(f, lwid2, true);
        labels.push(U.knock((pa + pb) / 2 - lwid2 / 2, ym - lb.h / 2, lwid2, lb.h), text((pa + pb) / 2 - lwid2 / 2, ym - lb.h / 2, lwid2, lb.h, lb.runs, { size: lb.pt, align: 'center', valign: 'middle', ls: 1.05 }));
      }
    }
  });
  byId.forEach(b => {
    els.push(U.card(b.x, b.y, b.w, b.h, { hub: !!b.hub }));
    const s = U.stack(0, 0, b.w - 0.36, { name: b.name, note: b.note }, { name: 13, item: 10, measure: true });
    els.push(...U.stack(b.x + 0.18, b.y + Math.max(0.12, (b.h - s.h) / 2), b.w - 0.36, { name: b.name, note: b.note }, { name: 13, item: 10, color: b.hub ? C.accentInk : C.ink }).els);
  });
  return [...els, ...marks, ...labels];
}

module.exports = { schemeMap, hubSpoke, contextDiagram, contourMap, archFlows };
