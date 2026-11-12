// Радиальные схемы (под-скилл «Схемы», reference/19-schemes.md): хаб с лучами, цикл, маховик, кольца экосистемы,
// треугольник участников, пересечение множеств. API как в components.js: (box, data, opt) → els.
const L = require('../lib.js');
const U = require('./util.js');
const { C, oval, text, tw } = L;
const { card, tone, head, clipRect, clipOval, arc, edgeLabel, pill, stack, seg, knock, lh } = U;

const rad = a => a * Math.PI / 180;
const ell = (cx, cy, rx, ry, o) => ({ t: 'oval', x: cx - rx, y: cy - ry, w: 2 * rx, h: 2 * ry, ...o });
// Узел с описанием по центру: пункты превращаются в строку-пояснение (у центрированного текста нет висячих точек)
const centered = nd => ({ name: nd.name, note: nd.d || nd.note || (nd.items || []).join(' · ') || undefined });
const sideNode = nd => ({ name: nd.name, note: nd.d || nd.note, items: nd.items });

// Подпись узла у точки (px, py) на эллипсе: сбоку — выравнивание к своей стороне, у верха и низа — над или под точкой.
// st — кегли { name, item }, bw — ширина блока. Блок не выходит за box.
// lift — у верхних боковых узлов блок стоит над точкой (последняя строка у точки), у нижних — под ней:
// середина луча между узлом и центром остаётся свободной под подпись связи.
function around(box, px, py, a, nd, bw, st, gap = 0.24, lift = false) {
  const c = Math.cos(rad(a)), s = Math.sin(rad(a));
  if (Math.abs(c) >= 0.35) {
    const right = c > 0, node = sideNode(nd), hgt = stack(0, 0, bw, node, { ...st, measure: true }).h;
    let x0 = right ? px + gap : px - gap - bw, w0 = bw;
    if (right && x0 + w0 > box.x + box.w) w0 = box.x + box.w - x0;
    if (!right && x0 < box.x) { w0 -= box.x - x0; x0 = box.x; }
    // с lift точка стоит у внутреннего края блока: под ней (нижние) или над ней (верхние) — входящая стрелка не задевает буквы
    const yUp = lift && s < -0.3 ? py + 0.08 - hgt : lift && s > 0.3 ? py - 0.06 : py - lh(st.name) / 2 - 0.02;
    const y0 = Math.max(box.y, Math.min(yUp, box.y + box.h - hgt));
    return stack(x0, y0, w0, node, { ...st, align: right ? 'left' : 'right' }).els;
  }
  const node = centered(nd), hgt = stack(0, 0, bw, node, { ...st, measure: true }).h;
  return stack(px - bw / 2, s < 0 ? py - gap - hgt : py + gap, bw, node, { ...st, align: 'center' }).els;
}
// Высота подписи над или под точкой: столько оставляем от края до эллипса
const vNeed = (nodes, angles, bw, st, gap = 0.24) => Math.max(0, ...nodes.map((nd, i) => (Math.abs(Math.cos(rad(angles[i]))) < 0.35
  ? stack(0, 0, bw, centered(nd), { ...st, measure: true }).h + gap + 0.06 : 0)));
// Полуось ry, при которой верхние боковые блоки помещаются над точкой, нижние — под ней (around с lift)
function liftRy(ry, nodes, ang, bw, st, h) {
  nodes.forEach((nd, i) => {
    const c = Math.cos(rad(ang[i])), sn = Math.abs(Math.sin(rad(ang[i])));
    if (Math.abs(c) >= 0.35 && sn > 0.3) ry = Math.min(ry, (h / 2 - stack(0, 0, bw, sideNode(nd), { ...st, measure: true }).h - 0.08) / sn);
  });
  return ry;
}
// Подпись связи на подложке цвета фона с центром в (mx, my): линия уходит под неё
function midLabel(e, mx, my, w) {
  if (!e.tag && !e.text) return [];
  const lb = edgeLabel(e, w), lw = Math.min(w, Math.max(tw(String(e.tag || '').toUpperCase(), lb.pt, true) * 1.18, tw(e.text || '', lb.pt) * 1.08) + 0.2);
  return [knock(mx - lw / 2, my - lb.h / 2 - 0.03, lw, lb.h + 0.06), text(mx - lw / 2, my - lb.h / 2, lw, lb.h, lb.runs, { size: lb.pt, align: 'center', valign: 'middle', ls: 1.05 })];
}
// Касательная к эллипсу по ходу часовой стрелки (экранные оси) — направление наконечника, градусы
const tangent = (rx, ry, a) => Math.atan2(ry * Math.cos(rad(a)), -rx * Math.sin(rad(a))) * 180 / Math.PI;
// Текст в круге: имя и пояснение во вписанном квадрате. Кегль имени снижается, пока самое длинное слово
// не встанет в ширину и весь текст — в высоту квадрата (не ниже 9).
function inCircle(cx, cy, d, nd, o = {}) {
  const side = d * 0.74, color = o.color || C.onAccent, wide = (s, b) => Math.max(...String(s).split(/\s+/).map(t => tw(t, 1, b) * (b ? 1.25 : 1.15)));
  let np = Math.max(9, Math.min(o.name || 15, Math.floor(side / wide(nd.name, true) * 2) / 2)), ip = Math.min(o.item || 10.5, np - 2);
  const size = () => {
    const nh = lh(np) * U.lines(nd.name, np, side * 0.9, true), noteH = nd.note ? lh(ip) * U.lines(nd.note, ip, side * 0.9) + 0.06 : 0;
    return [nh, noteH];
  };
  let [nh, noteH] = size();
  while (nh + noteH > side * 1.1 && np > 9) { np -= 0.5; ip = Math.max(8, Math.min(ip, np - 2)); [nh, noteH] = size(); }
  const top = cy - (nh + noteH) / 2;
  const els = [text(cx - side / 2, top, side, nh + 0.04, nd.name, { size: np, bold: true, color, align: 'center', ls: 1.05 })];
  if (nd.note) els.push(text(cx - side / 2, top + nh + 0.06, side, noteH + 0.02, nd.note, { size: ip, color: o.noteColor || color, align: 'center', ls: 1.1 }));
  return els;
}

// Хаб с лучами. Вопрос: «кто вокруг центра и что идёт по каждой связи?»
// data: { center: { name, note? }, nodes: [{ name, items?, d?, tag?, text?, kind?: 'solid'|'dashed' }] } — 4–8 участников.
// Центр — круг акцента, участники по эллипсу типографикой (выравнивание к своей стороне), луч от круга к точке у участника,
// тег и текст связи на середине луча. opt.nodeW — ширина подписи участника (по умолчанию 2,75″).
function radialHub(box, data, opt = {}) {
  const { x, y, w, h } = box, nodes = data.nodes.slice(0, 8), n = nodes.length, cx = x + w / 2, cy = y + h / 2;
  const bw = opt.nodeW || 2.75, st = { name: 13, item: 10 };
  const ang = nodes.map((_, i) => -90 + 180 / n + i * 360 / n);
  const rx = w / 2 - bw - 0.35;
  const ry = liftRy(Math.min(h / 2 - 0.45, h / 2 - vNeed(nodes, ang, bw, st)), nodes, ang, bw, st, h);   // боковые блоки уходят от центра
  const D = Math.min(2.1, 2 * rx * 0.5, h * 0.42), els = [], labels = [], dots = [], blocks = [];
  nodes.forEach((nd, i) => {
    const a = ang[i], px = cx + rx * Math.cos(rad(a)), py = cy + ry * Math.sin(rad(a));
    const [sx, sy] = clipOval(cx, cy, D / 2 + 0.06, D / 2 + 0.06, px, py);
    els.push(seg(sx, sy, px, py, tone(nd.kind)));
    dots.push(oval(px, py, 0.13, { fill: nd.kind === 'dashed' ? C.axis : C.accent }));
    labels.push(...midLabel(nd, sx + (px - sx) * 0.52, sy + (py - sy) * 0.52, 1.75));
    blocks.push(...around(box, px, py, a, nd, bw, st, 0.24, true));
  });
  els.push(...labels, oval(cx, cy, D, { fill: C.accent }), ...inCircle(cx, cy, D, data.center), ...dots, ...blocks);
  return els;
}

// Общая основа цикла и маховика: этапы на эллипсе, дуги со стрелками от этапа к следующему, подписи снаружи.
function ring(box, data, o) {
  const { x, y, w, h } = box, steps = data.steps, n = steps.length, cx = x + w / 2, cy = y + h / 2;
  const bw = o.bw, st = { name: 13, item: 10 };
  const ang = steps.map((_, i) => -90 + (o.offset || 0) + i * 360 / n);
  const rx = w / 2 - bw - 0.5, ry = liftRy(Math.min(h / 2 - 0.35, h / 2 - vNeed(steps, ang, bw, st, o.mark / 2 + 0.16)), steps, ang, bw, st, h);
  const els = [], marks = [], over = [], blocks = [];
  const gapA = (o.mark / 2 + 0.1) / ((rx + ry) / 2) * 180 / Math.PI, headA = 0.16 / ((rx + ry) / 2) * 180 / Math.PI;
  steps.forEach((sp, i) => {
    const a = ang[i], px = cx + rx * Math.cos(rad(a)), py = cy + ry * Math.sin(rad(a));
    const a0 = a + gapA, a1 = a + 360 / n - gapA, color = C.accent;
    els.push(...arc(cx, cy, rx, ry, a0, a1 - headA, { color, lw: o.lw }));
    const tx = cx + rx * Math.cos(rad(a1)), ty = cy + ry * Math.sin(rad(a1));
    over.push(head(tx, ty, tangent(rx, ry, a1), color, o.head));
    const am = a + 180 / n, mx = cx + rx * Math.cos(rad(am)), my = cy + ry * Math.sin(rad(am));
    if (o.onArc && o.onArc(sp)) over.push(...pill(mx, my, String(o.onArc(sp)).toUpperCase(), { fill: C.bg, line: C.accent, lw: 1.25, color: C.accentInk, pt: 8.5, h: 0.3 }).els);
    if (o.inside && o.inside(sp)) over.push(...midLabel({ tag: o.inside(sp), kind: 'muted' }, mx + (cx - mx) * 0.2, my + (cy - my) * 0.2, 1.5));
    marks.push(...o.marker(px, py));
    blocks.push(...around(box, px, py, a, sp, bw, st, o.mark / 2 + 0.16, true));
  });
  return { els, marks, over, blocks, cx, cy, rx, ry };
}

// Замкнутый цикл. Вопрос: «как этапы повторяются по кругу и что передаёт каждый следующему?»
// data: { steps: [{ name, d?, via? }] 4–6, center?: { name, note? } }. Этапы — кружки акцента на эллипсе, по часовой от верха;
// дуги со стрелками к следующему этапу; via — что передаётся по переходу (подпись внутри у дуги); center — смысл цикла.
function cycleLoop(box, data, opt = {}) {
  const r = ring(box, data, { bw: opt.nodeW || 2.6, mark: 0.3, lw: 1.75, head: 0.16, inside: sp => sp.via,
    marker: (px, py) => [oval(px, py, 0.3, { fill: C.accent }), oval(px, py, 0.12, { fill: C.bg })] });
  const els = [...r.els, ...r.over, ...r.marks, ...r.blocks];
  if (data.center) {
    const cw = Math.min(r.rx * 1.05, 3.2), c = data.center, nh = lh(15) * U.lines(c.name, 15, cw * 0.92, true), noteH = c.note ? lh(10) * U.lines(c.note, 10, cw * 0.92) + 0.06 : 0;
    els.push(text(r.cx - cw / 2, r.cy - (nh + noteH) / 2, cw, nh + 0.04, c.name, { size: 15, bold: true, align: 'center', ls: 1.05 }));
    if (c.note) els.push(text(r.cx - cw / 2, r.cy - (nh + noteH) / 2 + nh + 0.06, cw, noteH + 0.02, c.note, { size: 10, color: C.muted, align: 'center', ls: 1.1 }));
  }
  return els;
}

// Маховик. Вопрос: «что раскручивает рост и почему каждый оборот даётся легче?»
// data: { center: { name, note? }, steps: [{ name, d?, boost? }] 3–5 }. Центр — круг акцента с эффектом, вокруг толстые дуги
// со стрелками; boost — ускоритель перехода (короткий тег на дуге).
function flywheel(box, data, opt = {}) {
  const n = data.steps.length;   // этапы не ставим строго сверху и снизу: подписи сбоку, центр крупнее
  const r = ring(box, data, { bw: opt.nodeW || 2.6, mark: 0.4, lw: 4.5, head: 0.26, onArc: sp => sp.boost, offset: n % 2 ? 0 : 180 / n,
    marker: (px, py) => [oval(px, py, 0.4, { fill: C.bg, line: C.accent, lw: 3 }), oval(px, py, 0.16, { fill: C.accent })] });
  const D = Math.min(2 * r.ry - 0.95, 2 * r.rx - 0.95, 2.3);
  return [...r.els, oval(r.cx, r.cy, D, { fill: C.accent }), ...inCircle(r.cx, r.cy, D, data.center, { name: 15 }), ...r.over, ...r.marks, ...r.blocks];
}

// Кольца экосистемы. Вопрос: «кто ближе к ядру, кто на периферии?»
// data: { core: { name, note? }, rings: [{ name, items: [строки] }] 2–3 — от ближнего к дальнему }.
// Ядро — круг акцента, кольца — контуры эллипсов, участники — точки на кольце с подписью на подложке, имя кольца у левого края.
function orbitRings(box, data, opt = {}) {
  const { x, y, w, h } = box, cx = x + w / 2, cy = y + h / 2, rings = data.rings.slice(0, 3), k = rings.length;
  const D = Math.min(1.55, h * 0.34), ox = w / 2 - (opt.labelW || 2.1), oy = h / 2 - 0.08;
  const rx0 = D / 2 + 0.35, ry0 = D / 2 + 0.2;
  const els = [], over = [];
  const radii = rings.map((_, i) => [rx0 + (ox - rx0) * (i + 1) / k, ry0 + (oy - ry0) * (i + 1) / k]);
  radii.forEach(([rx, ry], i) => els.push(ell(cx, cy, rx, ry, { line: i === k - 1 ? C.axis : C.line, lw: 1, ...(i === k - 1 ? { dash: true } : {}) })));
  rings.forEach((rg, i) => {
    const [rx, ry] = radii[i], m = rg.items.length;
    const nm = String(rg.name).toUpperCase(), nw = tw(nm, 8.5, true) * 1.2 + 0.16;
    over.push(knock(cx - rx - nw / 2, cy - 0.14, nw, 0.28), text(cx - rx - nw / 2, cy - 0.14, nw, 0.28, nm, { size: 8.5, bold: true, color: C.muted, align: 'center', valign: 'middle' }));
    rg.items.forEach((it, j) => {
      const a = -150 + (j + 0.5) * 300 / m + (i % 2 ? 360 / m / 4 : 0), px = cx + rx * Math.cos(rad(a)), py = cy + ry * Math.sin(rad(a));
      const right = Math.cos(rad(a)) >= 0, pt = i === 0 ? 11 : 10, lw = Math.min(2, tw(it, pt, i === 0) * 1.08 + 0.12);
      over.push(oval(px, py, 0.15, { fill: i === 0 ? C.accent : C.ink2 }));
      const lx = right ? px + 0.12 : px - 0.12 - lw, nl = U.lines(it, pt, lw - 0.1, i === 0), lhh = lh(pt) * nl + 0.04;
      over.push(knock(lx, py - lhh / 2, lw, lhh), text(lx + 0.05, py - lhh / 2, lw - 0.1, lhh, it, { size: pt, bold: i === 0, color: i === 0 ? C.ink : C.ink2, align: right ? 'left' : 'right', valign: 'middle', ls: 1.05 }));
    });
  });
  els.push(...over, oval(cx, cy, D, { fill: C.accent }), ...inCircle(cx, cy, D, data.core, { name: 14, item: 9.5 }));
  return els;
}

// Треугольник участников. Вопрос: «что получает каждая из трёх сторон друг от друга?»
// data: { nodes: [3 × { name, items? }], edges: [{ from, to, tag?, text?, kind? }] (from/to — индекс 0–2 или имя), center?: строка }.
// Первый узел — вершина сверху, второй и третий — внизу слева и справа. Подписи обмена на серединах рёбер.
function partnerTriangle(box, data, opt = {}) {
  const { x, y, w, h } = box, cx = x + w / 2, cw = opt.nodeW || 3.3, P = 0.22, st = { name: 15, item: 10.5 };
  const nodes = data.nodes.slice(0, 3), idx = v => (typeof v === 'number' ? v : nodes.findIndex(n => n.name === v));
  const need = nodes.map(nd => stack(0, 0, cw - 2 * P, nd, { ...st, measure: true }).h + 2 * P);
  const hb = Math.max(need[1], need[2]);
  const R = [{ x: cx - cw / 2, y, w: cw, h: need[0] }, { x, y: y + h - hb, w: cw, h: hb }, { x: x + w - cw, y: y + h - hb, w: cw, h: hb }];
  const els = [], dots = [], labels = [];
  (data.edges || []).forEach(e => {
    const a = R[idx(e.from)], b = R[idx(e.to)];
    if (!a || !b) throw new Error(`partnerTriangle: связь ${e.from} → ${e.to}: нет такого узла`);
    const [x1, y1] = clipRect(a, b.x + b.w / 2, b.y + b.h / 2), [x2, y2] = clipRect(b, a.x + a.w / 2, a.y + a.h / 2);
    els.push(seg(x1, y1, x2, y2, tone(e.kind)));
    const dc = e.kind === 'dashed' ? C.axis : C.accent;
    dots.push(oval(x1, y1, 0.12, { fill: dc }), oval(x2, y2, 0.12, { fill: dc }));
    labels.push(...midLabel(e, (x1 + x2) / 2, (y1 + y2) / 2, 2.5));
  });
  nodes.forEach((nd, i) => { els.push(card(R[i].x, R[i].y, R[i].w, R[i].h, { hub: i === 0 && opt.hubTop })); els.push(...stack(R[i].x + P, R[i].y + P, cw - 2 * P, nd, st).els); });
  els.push(...dots, ...labels);
  if (data.center) {
    // под подписями боковых рёбер и над подписью нижнего: середина между ними
    const diag = (R[0].y + R[0].h + R[1].y) / 2 + 0.3, bottom = R[1].y + R[1].h / 2 - 0.4, cw2 = 4.2, nl = U.lines(data.center, 14, cw2 * 0.9, true);
    els.push(text(cx - cw2 / 2, (diag + bottom) / 2 - lh(14) * nl / 2, cw2, lh(14) * nl + 0.06, data.center, { size: 14, bold: true, color: C.accentInk, align: 'center', ls: 1.05 }));
  }
  return els;
}

// Пересечение множеств. Вопрос: «где зоны ответственности совпадают и что общее?»
// data: { sets: [{ name, items? }] 2–3, overlap: { name, items? } }. Круги — тон акцента с контуром; подписи множеств снаружи
// у своих кругов; общая зона — в линзе (2 множества) или блоком слева с выноской из центра пересечения (3 множества).
function vennOverlap(box, data, opt = {}) {
  const { x, y, w, h } = box, cx = x + w / 2, sets = data.sets.slice(0, 3), st = { name: 14, item: 10.5 }, els = [], txt = [];
  const circ = (c, D) => ({ t: 'oval', x: c[0] - D / 2, y: c[1] - D / 2, w: D, h: D, fill: C.accent, alpha: 0.12, line: C.accent, lw: 1.25 });
  const block = (nd, px, py, bw, align, color) => {
    const hgt = stack(0, 0, bw, nd, { ...st, measure: true }).h, y0 = Math.max(y, Math.min(py - hgt / 2, y + h - hgt));
    return stack(px, y0, bw, nd, { ...st, align, color }).els;
  };
  if (sets.length === 2) {
    const D = Math.min(h - 0.1, 4.1), s = D * 0.62, cy = y + h / 2, A = [cx - s / 2, cy], B = [cx + s / 2, cy];
    const bw = Math.min(3.2, (w - D - s) / 2 - 0.35);
    els.push(circ(A, D), circ(B, D));
    txt.push(...block(sets[0], A[0] - D / 2 - 0.3 - bw, cy, bw, 'right'), ...block(sets[1], B[0] + D / 2 + 0.3, cy, bw, 'left'));
    const lw = (D - s) * 0.86, ov = centered(data.overlap), hgt = stack(0, 0, lw, ov, { name: 12, item: 9.5, measure: true }).h;
    txt.push(...stack(cx - lw / 2, cy - hgt / 2, lw, ov, { name: 12, item: 9.5, align: 'center', color: C.accentInk }).els);
    return [...els, ...txt];
  }
  const D = Math.min((h - 0.1) / 1.48, 3.2), s = D * 0.56, top = y + (h - (D + 0.866 * s)) / 2 + D / 2;
  const A = [cx - s / 2, top], B = [cx + s / 2, top], Cc = [cx, top + 0.866 * s], mid = [cx, top + 0.866 * s / 3];
  const bw = Math.min(3.2, (w - D - s) / 2 - 0.4);
  els.push(circ(A, D), circ(B, D), circ(Cc, D));
  txt.push(...block(sets[0], A[0] - D / 2 - 0.3 - bw, A[1], bw, 'right'), ...block(sets[1], B[0] + D / 2 + 0.3, B[1], bw, 'left'),
    ...block(sets[2], Cc[0] + D / 2 + 0.3, Cc[1] + 0.45, bw, 'left'));
  const ox = A[0] - D / 2 - 0.3, oy = Cc[1] + 0.45;
  els.push(seg(mid[0], mid[1], ox + 0.08, oy, { color: C.accent, lw: 1 }), oval(mid[0], mid[1], 0.16, { fill: C.accent }), oval(ox + 0.08, oy, 0.1, { fill: C.accent }));
  const oh = stack(0, 0, bw, data.overlap, { ...st, measure: true }).h;   // имя общей зоны — на уровне выноски
  txt.push(...block(data.overlap, ox - bw - 0.1, oy - lh(st.name) / 2 + oh / 2, bw, 'right', C.accentInk));
  return [...els, ...txt];
}

module.exports = { radialHub, cycleLoop, flywheel, orbitRings, partnerTriangle, vennOverlap };
