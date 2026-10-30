// Оргструктуры и связи подразделений (под-скилл «Схемы», reference/19-schemes.md, раздел «Оргструктуры»).
// Десять оргсхем: дерево департамента, оргструктура с колонками, норма управляемости, двойное подчинение,
// вложенная карта по численности, топология команд, трайбы и чаптеры, было → стало, региональная сеть,
// пирамида уровней. Три смежные схемы связей: сеть отношений, матрица взаимодействий, дуги передач.
// API как в components.js: (box, data, opt) → els. Числа (штат, вакансии, точки) — факты: источник item.src,
// data.src или opt.src; суммы и доли — derived от уже зарегистрированных меток.
const L = require('../lib.js');
const U = require('./util.js');
const { engine: TREE } = require('./trees.js');
const { C, THEME, rect, oval, hline, vline, text, tw, nb } = L;
const { card, tone, head, edgeLabel, knock, lh, wrap, num, seg, clipOval } = U;

const caps = s => String(s).toUpperCase();
const nl = (s, pt, w, b) => wrap([{ t: String(s), b: !!b }], pt, w);
const srcOf = (item, data, opt) => item.src || data.src || opt.src;
const people = (v, unit = 'чел.') => `${v}${nb}${unit}`;
// Плашка-тег: капитель на подложке цвета фона с рамкой (НОВОЕ, УПРАЗДНЯЕТСЯ); accent — заливка акцентом
function tag(x, y, s, o = {}) {
  const pt = o.pt || 8.5, w = tw(caps(s), pt, true) * 1.18 + 0.24, h = 0.26;
  const els = [rect(x, y, w, h, { r: h / 2, fill: o.accent ? C.accent : C.bg, ...(o.accent ? {} : { line: C.axis, lw: 0.75 }) }),
    text(x, y, w, h, caps(s), { size: pt, bold: true, color: o.accent ? C.onAccent : C.muted, align: 'center', valign: 'middle' })];
  return { w, h, els };
}
// Строка легенды: образец линии и подпись капителью
function legendLine(x, y, items) {
  const els = [];
  let xx = x;
  items.forEach(it => {
    const t = it.tone || tone(it.kind);
    els.push(hline(xx, xx + 0.42, y, t));
    if (it.arrow) els.push(head(xx + 0.42, y, 0, t.color, 0.12));
    const s = caps(it.label), w = tw(s, 8.5, true) * 1.32 + 0.12;
    els.push(text(xx + 0.52, y - 0.13, w, 0.26, s, { size: 8.5, bold: true, color: C.muted, valign: 'middle' }));
    xx += 0.52 + w + 0.35;
  });
  return els;
}

// Легенда столбцом: строки друг под другом от (x, y)
function legendCol(x, y, items) {
  return items.flatMap((it, i) => legendLine(x, y + i * 0.3, [it]));
}

// ───────── 1. Дерево департамента ─────────
// Вопрос: «кто кому подчиняется в департаменте и сколько людей в каждом звене?»
// data: { levels?: [строки уровней], root: { name, lead?, size?, open? },
//         children: [{ name, lead?, size?, open?, vacant?: true, children? }] }  до 3 уровней, до 8 листьев
// lead — руководитель капителью под именем; size — штат, open — вакансии (факты). vacant — звено без руководителя
// или в наборе: приглушено, связь пунктиром. Корень на заливке акцента.
function deptTree(box, data, opt = {}) {
  const conv = (n, d) => {
    const s = srcOf(n, data, opt), bits = [];
    if (n.size != null) bits.push(people(num(`${n.name}: штат`, n.size, s), opt.unit));
    if (n.open) bits.push(`${num(`${n.name}: вакансии`, n.open, s)}${nb}ваканс.`);
    return { name: n.name, owner: n.lead, note: bits.join(' · ') || undefined, vacant: n.vacant, link: n.vacant ? 'dashed' : undefined,
      children: (n.children || []).map(c => conv(c, d + 1)) };
  };
  const root = conv(data.root, 0);
  root.children = (data.children || []).map(c => conv(c, 1));
  return TREE.treeTD(box, root, {
    left: data.levels ? (opt.levelW || 1.6) : 0, levels: data.levels, maxW: opt.maxW || 3.0, gx: 0.2,
    base: { name: 12.5, item: 10, meta: 8.5 },
    styleOf: n => (n.depth === 0 ? 'accent' : n.vacant ? 'muted' : n.depth === 1 ? 'hub' : 'card'),
  });
}

// ───────── 2. Оргструктура с колонками ─────────
// Вопрос: «как устроен департамент и сколько людей и вакансий в каждом звене?»
// data: { cols: [{ key, name, unit?, bar?: true }] 1–3, root: { name, lead?, [key]: число }, children: [{ … , children? }] }
// Дерево отступами слева (уголки-связи от родителя), руководитель отдельной колонкой, числа справа. Колонка с bar —
// полоса пропорционально значению. До 3 уровней, до 13 строк. null в колонке — «—».
function orgOutline(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [], cols = data.cols || [];
  const rows = [];
  (function walk(n, d, parent) {
    const r = { n, d, parent };
    rows.push(r);
    (n.children || []).forEach(c => walk(c, d + 1, r));
  })({ ...data.root, children: data.children }, 0, null);
  if (rows.length > 14) console.warn(`orgOutline: ${rows.length} строк — больше 14 не помещается, разбейте на два слайда`);
  const hasLead = rows.some(r => r.n.lead), HEAD = 0.42;
  const BAR = cols.some(c => c.bar) ? (opt.barW || 1.9) : 0, NUMW = opt.numW || 1.15, LEADW = hasLead ? (opt.leadW || 2.5) : 0;
  const numX = x + w - cols.length * NUMW - BAR, leadX = numX - LEADW - 0.2, treeW = leadX - x - 0.2;
  const rh = Math.min(opt.rowH || 0.42, (h - HEAD) / rows.length), IND = 0.42;
  const pt = d => (d < 2 ? 12.5 : 11);
  // шапка колонок
  const hy = y + HEAD - 0.12;
  els.push(hline(x, x + w, hy, { color: C.axis, lw: 0.75 }));
  const hcap = (s, xx, ww, al) => els.push(text(xx, y, ww, HEAD - 0.16, caps(s), { size: 8.5, bold: true, color: C.muted, valign: 'bottom', align: al }));
  hcap(opt.treeHead || 'Подразделение', x, treeW, 'left');
  if (hasLead) hcap(opt.leadHead || 'Руководитель', leadX, LEADW, 'left');
  let cx = numX;
  cols.forEach(c => {
    const cw = NUMW + (c.bar ? BAR : 0);
    hcap(c.name + (c.unit ? `, ${c.unit}` : ''), cx, cw, c.bar ? 'left' : 'right');
    cx += cw;
  });
  const maxOf = {};
  cols.forEach(c => { maxOf[c.key] = Math.max(1, ...rows.map(r => (U.known(r.n[c.key]) ? r.n[c.key] : 0)).filter((v, i) => rows[i].d > 0)); });
  rows.forEach((r, i) => {
    const ry = y + HEAD + i * rh, cy = ry + rh / 2, tx = x + r.d * IND + (r.d ? 0.3 : 0), p = pt(r.d);
    if (r.d === 0) els.push(rect(x - 0.08, ry + 0.03, w + 0.16, rh - 0.06, { r: 0.08, fill: C.band, alpha: C.bandA * 2 }));
    else if (r.d === 1 && i > 1) els.push(hline(x, x + w, ry, { color: C.rule, lw: 0.75 }));
    // уголок от родителя: вертикаль из-под родителя до центра строки и короткая горизонталь
    if (r.parent) {
      const px = x + r.parent.d * IND + (r.parent.d ? 0.3 : 0) + 0.1, pi = rows.indexOf(r.parent);
      const top = y + HEAD + pi * rh + rh / 2 + lh(pt(r.parent.d)) / 2;
      els.push(vline(px, top, cy, { color: C.axis, lw: 1 }), hline(px, tx - 0.08, cy, { color: C.axis, lw: 1 }));
    }
    const ww = treeW - (tx - x), k = nl(r.n.name, p, ww, r.d < 2);
    if (k > 1) console.warn(`orgOutline: «${r.n.name}» не помещается в строку — сократите или уберите колонку`);
    els.push(text(tx, cy - lh(p) / 2, ww, lh(p) + 0.02, r.n.name, { size: p, bold: r.d < 2, color: r.d < 2 ? C.ink : C.ink2, valign: 'middle' }));
    if (r.n.lead) els.push(text(leadX, cy - lh(11) / 2, LEADW, lh(11) + 0.02, r.n.lead, { size: 11, color: C.muted, valign: 'middle' }));
    let xx = numX;
    cols.forEach(c => {
      const v = r.n[c.key], cw = NUMW + (c.bar ? BAR : 0);
      if (!U.known(v)) {
        els.push(text(xx, cy - 0.14, cw, 0.28, U.naText(v, '—'), { size: 11, color: C.muted, align: c.bar ? 'left' : 'right', valign: 'middle' }));
      } else {
        const s = num(`${r.n.name}: ${c.name}`, v, srcOf(r.n, data, opt));
        if (c.bar) {
          const bw = r.d === 0 ? 0 : Math.max(0.06, v / maxOf[c.key] * (BAR - 0.15));
          if (bw) els.push(rect(xx, cy - 0.06, bw, 0.12, { fill: r.d === 1 ? C.bar : C.axis }));
          els.push(text(xx + bw + 0.1, cy - 0.14, NUMW, 0.28, s, { size: r.d < 2 ? 12.5 : 11, bold: r.d < 2, color: C.ink, valign: 'middle' }));
        } else {
          els.push(text(xx, cy - 0.14, cw, 0.28, s, { size: r.d < 2 ? 12.5 : 11, bold: r.d < 2, color: c.accent && v ? C.accentInk : C.ink, align: 'right', valign: 'middle' }));
        }
      }
      xx += cw;
    });
  });
  return els;
}

// ───────── 3. Норма управляемости ─────────
// Вопрос: «у кого из руководителей слишком много или мало прямых подчинённых?»
// data: { norm: [от, до], unit?: 'подчинённых', managers: [{ name, unit?, span }] 3–10 }
// Полосы по руководителям, коридор нормы тоном на всю высоту, вне нормы — акцент. Внизу итог «в норме N из M».
function spanOfControl(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [], ms = data.managers, n = ms.length, [lo, hi] = data.norm;
  const src = data.src || opt.src, LW = opt.labelW || 3.4, VW = 0.9, TOP = 0.42, FOOT = 0.5;
  const nlo = num('норма управляемости: от', lo, src), nhi = num('норма управляемости: до', hi, src);
  const mx = Math.max(hi, ...ms.map(m => m.span)) * 1.08, bx = x + LW, bw = w - LW - VW;
  const px = v => bx + v / mx * bw, rh = Math.min(0.56, (h - TOP - FOOT) / n);
  const top = y + TOP, bot = top + rh * n;
  els.push(rect(px(lo), top - 0.08, px(hi) - px(lo), bot - top + 0.16, { fill: C.accent, alpha: THEME === 'dark' ? 0.1 : 0.08 }));
  [lo, hi].forEach(v => els.push(vline(px(v), top - 0.08, bot + 0.08, { color: C.accent, lw: 0.75, dash: true })));
  const unit = data.unit || 'подчинённых';
  els.push(text(px(lo), y, px(hi) - px(lo), TOP - 0.12, `НОРМА ${nlo}–${nhi}`, { size: 8.5, bold: true, color: C.accentInk, align: 'center', valign: 'bottom' }));
  const inNorm = [];
  ms.forEach((m, i) => {
    const ry = top + i * rh, cy = ry + rh / 2, label = `${m.name}: прямых подчинённых`;
    const v = num(label, m.span, srcOf(m, data, opt)), ok = m.span >= lo && m.span <= hi;
    if (ok) inNorm.push(label);
    const nameH = lh(12) + (m.unit ? lh(10) : 0);
    els.push(text(x, cy - nameH / 2, LW - 0.25, lh(12) + 0.02, m.name, { size: 12, bold: true, valign: 'middle' }));
    if (m.unit) els.push(text(x, cy - nameH / 2 + lh(12), LW - 0.25, lh(10) + 0.02, m.unit, { size: 10, color: C.muted }));
    const bh = Math.min(0.24, rh * 0.45);
    els.push(rect(bx, cy - bh / 2, Math.max(0.04, px(m.span) - bx), bh, { fill: ok ? C.bar : C.accent }));
    els.push(text(px(m.span) + 0.1, cy - 0.16, VW, 0.32, v, { size: 12, bold: true, color: ok ? C.ink : C.accentInk, valign: 'middle' }));
    if (i) els.push(hline(x, bx + bw, ry, { color: C.rule, lw: 0.5 }));
  });
  els.push(hline(bx, bx + bw, bot + 0.08, { color: C.axis, lw: 0.75 }));
  const cnt = inNorm.length ? num('руководителей в норме управляемости', inNorm.length, { type: 'derived', from: inNorm, op: 'count' }) : '0';
  const all_ = num('руководителей всего', n, { type: 'derived', from: ms.map(m => `${m.name}: прямых подчинённых`), op: 'count' });
  els.push(text(x, bot + 0.18, w, FOOT - 0.12, [{ t: `В норме ${cnt} из ${all_}`, b: true, c: C.ink }, { t: ` · ось — ${unit} у руководителя, коридор — целевая норма`, c: C.muted }], { size: 12, valign: 'middle' }));
  return els;
}

// ───────── 4. Двойное подчинение ─────────
// Вопрос: «кому подразделения подчиняются административно и кому функционально?»
// data: { root: { name, note? }, units: [{ name, lead?, func?: [id функции] }] 3–6, functions: [{ id, name, note? }] 2–4 }
// Сверху руководитель и административные связи сплошной линией акцента; снизу функциональные центры, к ним
// пунктиром, у каждой функции свой канал. Легенда справа от руководителя.
function dualReporting(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [], marks = [], us = data.units, fs = data.functions, n = us.length;
  const fid = new Map(fs.map((f, i) => [f.id, i]));
  us.forEach(u => (u.func || []).forEach(f => { if (!fid.has(f)) throw new Error(`dualReporting: у «${u.name}» неизвестная функция «${f}»`); }));
  const S = { name: 12, item: 10, meta: 8.5, pad: 0.14 };
  const RW = Math.min(3.6, Math.max(2.6, tw(data.root.name, 13.5, true) + 0.6)), RH = data.root.note ? 0.8 : 0.58, rcx = x + w / 2;
  els.push(rect(rcx - RW / 2, y, RW, RH, { r: 0.14, fill: C.accent }));
  els.push(text(rcx - RW / 2 + 0.15, y + 0.08, RW - 0.3, RH - 0.16, [{ t: data.root.name, b: true, s: 13.5 }, ...(data.root.note ? [{ t: '\n' + data.root.note, s: 10 }] : [])], { size: 13.5, color: C.onAccent, align: 'center', valign: 'middle', ls: 1.05 }));
  marks.push(...legendCol(x, y + RH / 2 - 0.15, [{ label: 'административно' }, { label: 'функционально', kind: 'dashed' }]));
  const slot = w / n, uw = Math.min(2.9, slot - 0.28), uy = y + RH + 0.55;
  const uh = Math.max(...us.map(u => TREE.measure({ name: u.name, owner: u.lead }, uw - 2 * S.pad, S))) + 2 * S.pad;
  const fslot = w / fs.length, fw = Math.min(3.0, fslot - 0.4);
  const fh = Math.max(...fs.map(f => TREE.measure({ name: f.name, note: f.note, meta: opt.funcMeta || 'функция' }, fw - 2 * S.pad, S))) + 2 * S.pad;
  const fy = y + h - fh, chTop = uy + uh + 0.3, chStep = Math.min(0.24, (fy - chTop - 0.25) / Math.max(1, fs.length - 1));
  if (fy - chTop < 0.25 + chStep * (fs.length - 1) - 0.01) console.warn('dualReporting: мало места под функциональные каналы — сократите тексты');
  const ucx = i => x + (i + 0.5) * slot, fcx = j => x + (j + 0.5) * fslot;
  const ym = y + RH + 0.26, solid = tone();
  els.push(vline(rcx, y + RH, ym, solid), hline(ucx(0), ucx(n - 1), ym, solid));
  us.forEach((u, i) => { els.push(vline(ucx(i), ym, uy - 0.12, solid)); marks.push(head(ucx(i), uy - 0.01, 90, solid.color, 0.13)); });
  const dash = tone('dashed');
  fs.forEach((f, j) => {
    const users = us.map((u, i) => ((u.func || []).includes(f.id) ? i : -1)).filter(i => i >= 0);
    if (!users.length) return;
    const cy = chTop + j * chStep, xs = [];
    users.forEach(i => {
      const k = (us[i].func || []).length, pos = us[i].func.indexOf(f.id), ox = (pos - (k - 1) / 2) * 0.2, ux = ucx(i) + ox;
      els.push(vline(ux, uy + uh, cy, dash));
      xs.push(ux);
    });
    xs.push(fcx(j));
    els.push(hline(Math.min(...xs), Math.max(...xs), cy, dash), vline(fcx(j), cy, fy - 0.12, dash));
    marks.push(head(fcx(j), fy - 0.01, 90, C.axis, 0.13));
  });
  const nodes = [];
  us.forEach((u, i) => nodes.push(...TREE.drawNode({ name: u.name, owner: u.lead }, ucx(i) - uw / 2, uy, uw, uh, 'card', S)));
  fs.forEach((f, j) => nodes.push(...TREE.drawNode({ name: f.name, note: f.note, meta: opt.funcMeta || 'функция' }, fcx(j) - fw / 2, fy, fw, fh, 'hub', S)));
  return [...els, ...nodes, ...marks];
}

// ───────── 5. Вложенная карта подразделений ─────────
// Вопрос: «из каких подразделений состоит блок и какого они размера?»
// data: { unit?: 'чел.', units: [{ name, size, lead?, children?: [{ name, size }] }] 2–6 } — площадь пропорциональна штату.
// Департаменты — рамки с именем и штатом в шапке, внутри управления плитками. opt.highlight — имя плитки на акценте.
function squarify(vals, x, y, w, h) {
  const tot = vals.reduce((s, v) => s + v.v, 0), out = [];
  let items = vals.slice().sort((a, b) => b.v - a.v).map(v => ({ ...v, a: v.v / tot * w * h }));
  let rx = x, ry = y, rw = w, rh = h;
  const worst = (row, side) => { const s = row.reduce((t, r) => t + r.a, 0); return Math.max(...row.map(r => Math.max(side * side * r.a / (s * s), s * s / (side * side * r.a)))); };
  while (items.length) {
    const side = Math.min(rw, rh), row = [items[0]];
    let i = 1;
    while (i < items.length && worst([...row, items[i]], side) <= worst(row, side)) row.push(items[i++]);
    items = items.slice(i);
    const s = row.reduce((t, r) => t + r.a, 0);
    if (rw >= rh) {
      const cw = s / rh;
      let yy = ry;
      row.forEach(r => { const hh = r.a / cw; out.push({ ...r, x: rx, y: yy, w: cw, h: hh }); yy += hh; });
      rx += cw; rw -= cw;
    } else {
      const ch = s / rw;
      let xx = rx;
      row.forEach(r => { const ww = r.a / ch; out.push({ ...r, x: xx, y: ry, w: ww, h: ch }); xx += ww; });
      ry += ch; rh -= ch;
    }
  }
  return out;
}
function orgNest(box, data, opt = {}) {
  const hidden = [], first = orgNestDraw(box, data, opt, hidden, false);
  if (!hidden.length) return first;
  L.FACTS.splice(L.FACTS.length - first.nFacts, first.nFacts);   // перерисовка с подписью: факты первого прохода снимаются
  const h2 = [], els = orgNestDraw({ ...box, h: box.h - 0.34 }, data, opt, h2, true);
  els.push(text(box.x, box.y + box.h - 0.26, box.w, 0.26, [{ t: 'Без подписи в плитке: ', c: C.muted }, { t: h2.join(', '), c: C.ink2 }], { size: 10, valign: 'middle' }));
  return els;
}
function orgNestDraw(box, data, opt, hidden, final) {
  const n0 = L.FACTS.length;
  const { x, y, w, h } = box, els = [], unit = data.unit || 'чел.', G = 0.1, HD = 0.5;
  const top = squarify(data.units.map((u, i) => ({ v: u.size, i })), x, y, w, h);
  const labels = [];
  top.forEach(t => {
    const u = data.units[t.i], bx = t.x + G / 2, by = t.y + G / 2, bw = t.w - G, bh = t.h - G;
    const lab = `${u.name}: штат`;
    labels.push(lab);
    const s = num(lab, u.size, srcOf(u, data, opt));
    els.push(rect(bx, by, bw, bh, { r: 0.1, line: THEME === 'dark' ? C.line : C.cardLine, lw: 1 }));
    const nameW = bw - 0.3 - tw(people(s, unit), 12, true) - 0.15;
    const k = nl(u.name, 12, nameW, true), hd = Math.max(HD, lh(12) * k + 0.24);
    els.push(text(bx + 0.15, by + 0.1, nameW, lh(12) * k + 0.02, u.name, { size: 12, bold: true, ls: 1.05 }));
    els.push(text(bx + bw - 0.15 - tw(people(s, unit), 12, true) - 0.1, by + 0.1, tw(people(s, unit), 12, true) + 0.1, lh(12) + 0.02, people(s, unit), { size: 12, bold: true, color: C.ink2, align: 'right' }));
    if (u.lead && bh > hd + 0.9) els.push(text(bx + 0.15, by + 0.1 + lh(12) * k, nameW, lh(9) + 0.02, caps(u.lead), { size: 8.5, bold: true, color: C.muted }));
    const hd2 = hd + (u.lead && bh > hd + 0.9 ? lh(9) : 0);
    const ch = u.children || [];
    if (!ch.length) return;
    const sum = ch.reduce((a, c) => a + c.size, 0);
    if (sum !== u.size) console.warn(`orgNest: у «${u.name}» сумма управлений ${sum} не равна штату ${u.size}`);
    const inner = squarify(ch.map((c, j) => ({ v: c.size, j })), bx + 0.1, by + hd2, bw - 0.2, bh - hd2 - 0.1);
    inner.forEach(r => {
      const c = ch[r.j], tx = r.x + 0.03, ty = r.y + 0.03, tw2 = r.w - 0.06, th = r.h - 0.06;
      const cs = num(`${u.name} · ${c.name}: штат`, c.size, srcOf(c, data, opt)), hot = opt.highlight === c.name;
      els.push(rect(tx, ty, tw2, th, { r: 0.06, fill: hot ? C.accent : THEME === 'dark' ? C.card : C.panel, alpha: hot ? 1 : THEME === 'dark' ? C.cardA : 1 }));
      const col = hot ? C.onAccent : C.ink, pt = 10;
      const wordOk = String(c.name).split(/\s+/).every(wd => tw(wd, pt, true) * 1.08 <= tw2 - 0.2);
      if (tw2 > 0.7 && th > 0.42 && wordOk) {
        const kk = nl(c.name, pt, tw2 - 0.2, true), fitN = th > lh(pt) * kk + lh(pt) + 0.18;
        if (!fitN) hidden.push(`${c.name} — ${cs}`);
        if (fitN) els.push(text(tx + 0.1, ty + 0.08, tw2 - 0.2, lh(pt) * kk + 0.02, c.name, { size: pt, bold: true, color: col, ls: 1.05 }));
        els.push(text(tx + 0.1, ty + th - lh(pt) - 0.08, tw2 - 0.2, lh(pt) + 0.02, cs, { size: pt, color: hot ? C.onAccent : C.ink2 }));
      } else if (tw2 > 0.35 && th > 0.24) {
        hidden.push(`${c.name} — ${cs}`);
        els.push(text(tx, ty, tw2, th, cs, { size: 10, bold: true, color: hot ? C.onAccent : C.ink2, align: 'center', valign: 'middle' }));
      }
    });
  });
  if (opt.total !== false && labels.length > 1) {
    num('штат всего', data.units.reduce((a, u) => a + u.size, 0), { type: 'derived', from: labels, op: 'sum' });
  }
  els.nFacts = L.FACTS.length - n0;
  return els;
}

// ───────── 6. Топология команд ─────────
// Вопрос: «как команды выстроены вокруг потоков ценности и как они взаимодействуют?»
// data: { streams: [{ id, name, note? }] 2–4, platform: { id, name, note?, items? }, enabling?: [{ id, name, note? }] 0–2,
//         subsystems?: [{ id, name, note? }] 0–2, links: [{ from, to, mode: 'collab'|'service'|'facilitate' }] }
// Слева помогающие команды (facilitate, пунктир), в центре потоковые команды полосами со стрелкой потока,
// справа сложные подсистемы (collab, акцент) и платформа (service, стрелка к потоку). Легенда режимов внизу.
function teamTopology(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [], marks = [], nodes = [], st = data.streams, n = st.length;
  const en = data.enabling || [], sub = data.subsystems || [], S = { name: 12, item: 10, meta: 8.5, pad: 0.14 };
  const all = new Map([...st, ...en, ...sub, data.platform].map(t => [t.id, t]));
  data.links.forEach(l => [l.from, l.to].forEach(id => { if (!all.has(id)) throw new Error(`teamTopology: неизвестная команда «${id}»`); }));
  const LEG = 0.42, EW = en.length ? (opt.enablingW || 2.1) : 0, PW = opt.platformW || 2.5, SW = sub.length ? (opt.subW || 2.1) : 0, GAP = 0.55;
  const sx = x + (EW ? EW + GAP : 0), sw = w - (EW ? EW + GAP : 0) - PW - GAP - (SW ? SW + GAP : 0);
  const subX = sx + sw + GAP, platX = x + w - PW, top = y + 0.5, bodyH = h - LEG - 0.5;
  const rowH = bodyH / n, sh = Math.min(1.0, rowH - 0.24);
  els.push(text(sx, y, sw, 0.28, caps(opt.flow || 'поток ценности → клиенту'), { size: 8.5, bold: true, color: C.muted, valign: 'middle' }));
  const mid = id => st.findIndex(s => s.id === id), at = new Map();   // раскладка отдельно от данных: данные пользователя не меняются
  const rowsOf = id => data.links.filter(l => l.from === id || l.to === id).map(l => mid(l.from === id ? l.to : l.from)).filter(i => i >= 0);
  // потоковые команды: полоса с наконечником потока
  st.forEach((s, i) => {
    const cy = top + (i + 0.5) * rowH, yy = cy - sh / 2;
    nodes.push(...TREE.drawNode({ name: s.name, note: s.note, meta: opt.streamMeta || 'потоковая команда' }, sx, yy, sw - 0.32, sh, 'card', S));
    marks.push(head(sx + sw - 0.04, cy, 0, C.accent, 0.26));
    at.set(s.id, { cy, yy });
  });
  // платформа справа на всю высоту
  const pl = data.platform;
  nodes.push(...TREE.drawNode({ name: pl.name, note: pl.note, items: pl.items, meta: opt.platformMeta || 'платформа' }, platX, top, PW, bodyH, 'hub', S));
  // помогающие и подсистемы по строкам своих потоков
  const place = (list, X, W2, meta) => list.forEach(t => {
    const rs = rowsOf(t.id), r0 = rs.length ? Math.min(...rs) : 0, r1 = rs.length ? Math.max(...rs) : n - 1;
    const yy = top + r0 * rowH + (rowH - sh) / 2, hh = (r1 - r0) * rowH + sh;
    const need = TREE.measure({ name: t.name, note: t.note, meta }, W2 - 2 * S.pad, S) + 2 * S.pad;
    const h2 = Math.max(Math.min(hh, need + 0.2), need);
    at.set(t.id, { x: X, y: yy + (hh - h2) / 2, w: W2, h: h2 });
    nodes.push(...TREE.drawNode({ name: t.name, note: t.note, meta }, X, at.get(t.id).y, W2, h2, 'card', S));
  });
  place(en, x, EW, opt.enablingMeta || 'помогающая');
  place(sub, subX, SW, opt.subMeta || 'сложная подсистема');
  data.links.forEach(l => {
    const a = all.get(l.from), b = all.get(l.to), s = st.includes(a) ? a : b, o = s === a ? b : a;
    if (!st.includes(s)) return;
    const sp = at.get(s.id), ob = at.get(o.id);
    if (l.mode === 'facilitate') {
      els.push(hline(ob.x + ob.w, sx - 0.1, sp.cy, tone('dashed')));
      marks.push(oval(sx - 0.1, sp.cy, 0.1, { fill: C.axis }));
    } else if (l.mode === 'collab') {
      els.push(hline(sx + sw + 0.02, ob.x, sp.cy, { color: C.accent, lw: 3 }));
    } else {
      // как сервис: от платформы к потоку по верхнему краю строки, мимо карточек подсистем
      const yy = sp.yy - Math.min(0.14, (rowH - sh) / 2), x0 = sx + sw - 0.75;
      els.push(hline(x0, platX, yy, { color: C.axis, lw: 1.25 }), vline(x0, yy, sp.yy - 0.1, { color: C.axis, lw: 1.25 }));
      marks.push(head(x0, sp.yy - 0.01, 90, C.axis, 0.12));
    }
  });
  marks.push(...legendLine(x, y + h - LEG / 2 + 0.04, [
    { label: 'совместно', tone: { color: C.accent, lw: 3 } },
    { label: 'как сервис', tone: { color: C.axis, lw: 1.25 }, arrow: true },
    { label: 'помогает освоить', kind: 'dashed' }]));
  return [...els, ...nodes, ...marks];
}

// ───────── 7. Трайбы, сквады и чаптеры ─────────
// Вопрос: «как продуктовые команды и профессиональные сообщества пересекаются в agile-модели?»
// data: { tribes: [{ name, squads: [{ name, note?, chapters?: [номера чаптеров] }] }] 2–3, всего сквадов до 9,
//         chapters: [{ name, lead? }] 2–5, guild?: { name, squads?: [имена] } }
// Трайбы шапкой над своими сквадами, сквады колонками, чаптеры строками поперёк; точка — в скваде есть специалист
// чаптера (без chapters — во всех). Гильдия — пунктирной строкой с кольцами.
function tribeChapters(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [], marks = [], LW = opt.labelW || 2.5;
  const cols = [];
  data.tribes.forEach((t, ti) => t.squads.forEach(s => cols.push({ ...s, ti })));
  const nC = cols.length, cw = (w - LW) / nC, TH = 0.5;
  const sqH = Math.max(...cols.map(s => lh(11.5) * nl(s.name, 11.5, cw - 0.16, true) + (s.note ? lh(9.5) * nl(s.note, 9.5, cw - 0.16) : 0))) + 0.12;
  const rows = data.chapters.length + (data.guild ? 1 : 0), gy = y + TH + sqH + 0.18, rh = Math.min(0.62, (h - (gy - y)) / rows);
  const cx = i => x + LW + (i + 0.5) * cw;
  // трайбы: тоновая полоса через одну и шапка с чертой на ширину своих сквадов
  data.tribes.forEach((t, ti) => {
    const idx = cols.map((c, i) => (c.ti === ti ? i : -1)).filter(i => i >= 0), x0 = x + LW + idx[0] * cw, x1 = x + LW + (idx[idx.length - 1] + 1) * cw;
    if (ti % 2 === 0) els.push(rect(x0 + 0.04, y, x1 - x0 - 0.08, h, { r: 0.1, fill: C.band, alpha: C.bandA * 1.6 }));
    els.push(text(x0 + 0.12, y + 0.04, x1 - x0 - 0.24, 0.3, caps(t.name), { size: 9, bold: true, color: C.accentInk, valign: 'middle' }));
    els.push(hline(x0 + 0.12, x1 - 0.12, y + TH - 0.1, { color: C.accent, lw: 1.5 }));
  });
  cols.forEach((s, i) => {
    const tx = x + LW + i * cw + 0.08, iw = cw - 0.16, k = nl(s.name, 11.5, iw, true);
    els.push(text(tx, y + TH, iw, lh(11.5) * k + 0.02, s.name, { size: 11.5, bold: true, align: 'center', ls: 1.05 }));
    if (s.note) els.push(text(tx, y + TH + lh(11.5) * k, iw, lh(9.5) * nl(s.note, 9.5, iw) + 0.02, s.note, { size: 9.5, color: C.muted, align: 'center', ls: 1.05 }));
    els.push(vline(cx(i), gy, gy + rh * (rows - 0.5), { color: C.rule, lw: 0.75 }));
  });
  const rowLabel = (yy, name, sub, accent) => {
    const k = nl(name, 12, LW - 0.3, true), hh = lh(12) * k + (sub ? lh(9) : 0);
    els.push(text(x, yy - hh / 2, LW - 0.3, lh(12) * k + 0.02, name, { size: 12, bold: true, color: accent ? C.accentInk : C.ink, ls: 1.05 }));
    if (sub) els.push(text(x, yy - hh / 2 + lh(12) * k, LW - 0.3, lh(9) + 0.02, caps(sub), { size: 8.5, bold: true, color: C.muted }));
  };
  data.chapters.forEach((ch, r) => {
    const cy = gy + (r + 0.5) * rh;
    rowLabel(cy, ch.name, ch.lead ? `лид: ${ch.lead}` : opt.chapterMeta || 'чаптер');
    els.push(hline(x + LW, x + w, cy, { color: C.axis, lw: 0.75 }));
    cols.forEach((s, i) => { if (!s.chapters || s.chapters.includes(r)) marks.push(oval(cx(i), cy, 0.2, { fill: C.accent })); });
  });
  if (data.guild) {
    const cy = gy + (data.chapters.length + 0.5) * rh, g = data.guild;
    rowLabel(cy, g.name, opt.guildMeta || 'гильдия, по желанию');
    els.push(hline(x + LW, x + w, cy, tone('dashed')));
    cols.forEach((s, i) => { if (!g.squads || g.squads.includes(s.name)) marks.push(oval(cx(i), cy, 0.2, { fill: C.bg, line: C.accent, lw: 1.5 })); });
  }
  return [...els, ...marks];
}

// ───────── 8. Было → стало ─────────
// Вопрос: «как меняется оргструктура: что объединяем, делим, переводим и упраздняем?»
// data: { before: { head, units: [{ id, name, size? }] }, after: { head, units: [{ id, name, size?, isNew? }] },
//         moves: [{ from, to, tag? }] }  до 8 строк в колонке
// Слева прежние подразделения, справа новые, в середине связи ортогональными скобками: несколько в одно — объединение,
// одно в несколько — разделение (акцент), один к одному — перевод (ось). Без связей слева — «упраздняется», справа — «новое».
function orgTransition(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [], marks = [], A = data.before.units, B = data.after.units;
  const ia = new Map(A.map((u, i) => [u.id, i])), ib = new Map(B.map((u, i) => [u.id, i]));
  data.moves.forEach(m => { if (!ia.has(m.from) || !ib.has(m.to)) throw new Error(`orgTransition: связь ${m.from} → ${m.to} на неизвестное подразделение`); });
  const CW = opt.colW || 3.6, HD = 0.5, ax = x, bx = x + w - CW, gx0 = ax + CW + 0.25, gx1 = bx - 0.25;
  const n = Math.max(A.length, B.length), rh = Math.min(0.62, (h - HD) / n);
  const col = (units, X, head, side) => {
    els.push(text(X, y, CW, HD - 0.14, caps(head), { size: 9, bold: true, color: C.muted, valign: 'bottom', align: side === 'a' ? 'right' : 'left' }));
    els.push(hline(X, X + CW, y + HD - 0.06, { color: C.axis, lw: 0.75 }));
    const off = (n - units.length) * rh / 2;
    return units.map((u, i) => ({ u, cy: y + HD + off + (i + 0.5) * rh }));
  };
  const ra = col(A, ax, data.before.head, 'a'), rb = col(B, bx, data.after.head, 'b');
  const outA = new Set(data.moves.map(m => m.from)), inB = new Set(data.moves.map(m => m.to));
  const sizeTxt = (u, side) => (u.size != null ? people(num(`${side}: ${u.name}, штат`, u.size, srcOf(u, data, opt)), opt.unit) : '');
  ra.forEach(({ u, cy }) => {
    const gone = !outA.has(u.id), sz = sizeTxt(u, data.before.head), szW = sz ? tw(sz, 10.5) * 1.06 + 0.15 : 0;
    els.push(text(ax, cy - 0.18, CW - szW, 0.36, u.name, { size: 12, bold: true, color: gone ? C.muted : C.ink, align: 'right', valign: 'middle' }));
    if (sz) els.push(text(ax + CW - szW, cy - 0.18, szW, 0.36, sz, { size: 10.5, color: C.muted, align: 'right', valign: 'middle' }));
    if (gone) { const t = tag(ax + CW + 0.12, cy - 0.13, 'упраздняется'); els.push(...t.els); }
    else marks.push(oval(ax + CW + 0.12, cy, 0.12, { fill: C.axis }));
  });
  rb.forEach(({ u, cy }) => {
    const fresh = u.isNew || !inB.has(u.id), sz = sizeTxt(u, data.after.head), szW = sz ? tw(sz, 10.5) * 1.06 + 0.15 : 0;
    if (sz) els.push(text(bx, cy - 0.18, szW, 0.36, sz, { size: 10.5, color: C.muted, valign: 'middle' }));
    els.push(text(bx + szW, cy - 0.18, CW - szW - (fresh ? 1.0 : 0), 0.36, u.name, { size: 12, bold: true, valign: 'middle' }));
    if (fresh) { const t = tag(bx + CW - 0.85, cy - 0.13, 'новое', { accent: true }); els.push(...t.els); }
    if (inB.has(u.id)) marks.push(oval(bx - 0.12, cy, 0.12, { fill: C.accent }));
  });
  // группы связей: несколько источников в одну цель — общая скобка у цели; иначе скобка у источника
  const byTo = new Map(), byFrom = new Map();
  data.moves.forEach(m => { byTo.set(m.to, [...(byTo.get(m.to) || []), m]); byFrom.set(m.from, [...(byFrom.get(m.from) || []), m]); });
  const groups = [];
  byTo.forEach((ms, to) => { if (ms.length > 1) groups.push({ kind: 'merge', ms }); });
  byFrom.forEach((ms, from) => { if (ms.length > 1) groups.push({ kind: 'split', ms }); });
  data.moves.forEach(m => { if (byTo.get(m.to).length === 1 && byFrom.get(m.from).length === 1) groups.push({ kind: 'move', ms: [m] }); });
  const lanes = groups.length, laneX = k => gx0 + 0.25 + (gx1 - gx0 - 0.5) * (lanes > 1 ? k / (lanes - 1) : 0.5);
  const cyA = id => ra[ia.get(id)].cy, cyB = id => rb[ib.get(id)].cy;
  groups.sort((p, q) => Math.min(...p.ms.map(m => cyA(m.from))) - Math.min(...q.ms.map(m => cyA(m.from))));
  groups.forEach((g, k) => {
    const t = g.kind === 'move' ? tone('muted') : tone(), lx = laneX(k);
    g.ms.forEach(m => {
      const ya = cyA(m.from), yb = cyB(m.to);
      els.push(hline(ax + CW + 0.18, lx, ya, t), vline(lx, Math.min(ya, yb), Math.max(ya, yb), t), hline(lx, bx - 0.26, yb, t));
    });
    marks.push(head(bx - 0.18, cyB(g.ms[0].to), 0, t.color, 0.12));
    if (g.kind === 'split') g.ms.slice(1).forEach(m => marks.push(head(bx - 0.18, cyB(m.to), 0, t.color, 0.12)));
    const label = g.ms[0].tag || { merge: 'объединение', split: 'разделение', move: '' }[g.kind];
    if (label) {
      const ys = g.ms.flatMap(m => [cyA(m.from), cyB(m.to)]), my = (Math.min(...ys) + Math.max(...ys)) / 2;
      const lb = edgeLabel({ tag: label, kind: g.kind === 'move' ? 'muted' : undefined }, 1.6);
      const lw = Math.min(1.7, tw(caps(label), lb.pt, true) * 1.25 + 0.16), lc = Math.max(gx0 + lw / 2, Math.min(gx1 - lw / 2, lx));
      marks.push(knock(lc - lw / 2, my - lb.h / 2 - 0.03, lw, lb.h + 0.06), text(lc - lw / 2, my - lb.h / 2, lw, lb.h, lb.runs, { size: lb.pt, align: 'center', valign: 'middle' }));
    }
  });
  return [...els, ...marks];
}

// ───────── 9. Региональная сеть ─────────
// Вопрос: «как устроена сеть: центр, региональные дирекции и сколько у каждой точек?»
// data: { center: { name, note? }, unit?: 'точек', regions: [{ name, note?, points?, lead? }] 3–8 }
// Центр — круг на заливке акцента, регионы по эллипсу; круг региона по площади пропорционален числу точек,
// число внутри. Подпись снаружи по направлению луча. Итог сети — derived сумма под центром.
function regionNetwork(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [], nodes = [], rs = data.regions, n = rs.length, unit = data.unit || 'точек';
  const cx = x + w / 2, cy = y + h / 2, CD = opt.centerD || 1.7, LW = opt.labelW || 2.3;
  const rx = w / 2 - LW - 0.55, ry = h / 2 - 0.92;
  const known = rs.filter(r => U.known(r.points)), mx = Math.max(1, ...known.map(r => r.points));
  const labels = [];
  rs.forEach((r, i) => {
    const a = -90 + 360 * i / n + (opt.rotate || 0), ar = a * Math.PI / 180, px = cx + rx * Math.cos(ar), py = cy + ry * Math.sin(ar);
    const d = U.known(r.points) ? 0.42 + 0.58 * Math.sqrt(r.points / mx) : 0.42, s = srcOf(r, data, opt);
    const lab = `${r.name}: ${unit}`, val = U.known(r.points) ? num(lab, r.points, s) : null;
    if (val) labels.push(lab);
    const [sx, sy] = clipOval(cx, cy, CD / 2, CD / 2, px, py), [ex, ey] = clipOval(px, py, d / 2, d / 2, cx, cy);
    els.push(seg(sx, sy, ex, ey, r.kind === 'dashed' ? tone('dashed') : { color: C.accent, lw: 1.5 }));
    nodes.push(oval(px, py, d, { fill: THEME === 'dark' ? C.card : C.panel, line: C.accent, lw: 1.5 }));
    if (val) nodes.push(text(px - d / 2, py - d / 2, d, d, val, { size: d > 0.7 ? 13 : 10.5, bold: true, align: 'center', valign: 'middle' }));
    // подпись снаружи: справа, слева, сверху или снизу по направлению луча
    const c = Math.cos(ar), sn = Math.sin(ar), lines_ = [{ t: r.name, b: true, s: 12 }];
    if (r.note) lines_.push({ t: '\n' + r.note, s: 10, c: C.muted });
    if (r.lead) lines_.push({ t: '\n' + caps(r.lead), s: 8.5, b: true, c: C.muted });
    const lh_ = lh(12) * nl(r.name, 12, LW, true) + (r.note ? lh(10) * nl(r.note, 10, LW) : 0) + (r.lead ? lh(8.5) : 0) + 0.04;
    let lx, ly, al;
    if (c > 0.35) { lx = px + d / 2 + 0.14; ly = py - lh_ / 2; al = 'left'; }
    else if (c < -0.35) { lx = px - d / 2 - 0.14 - LW; ly = py - lh_ / 2; al = 'right'; }
    else { lx = px - LW / 2; ly = sn < 0 ? py - d / 2 - 0.08 - lh_ : py + d / 2 + 0.08; al = 'center'; }
    nodes.push(text(al === 'center' ? lx : L.snap(lx), ly, LW, lh_, lines_, { size: 12, align: al, ls: 1.05 }));
  });
  nodes.push(oval(cx, cy, CD, { fill: C.accent }));
  const tot = labels.length === n && n > 1 ? num(`сеть всего: ${unit}`, known.reduce((a, r) => a + r.points, 0), { type: 'derived', from: labels, op: 'sum' }) : null;
  const inner = [{ t: data.center.name, b: true, s: 13 }];
  if (data.center.note) inner.push({ t: '\n' + data.center.note, s: 9.5 });
  if (tot) inner.push({ t: `\n${tot}${nb}${unit}`, s: 11, b: true });
  nodes.push(text(cx - CD / 2 + 0.12, cy - CD / 2 + 0.1, CD - 0.24, CD - 0.2, inner, { size: 13, color: C.onAccent, align: 'center', valign: 'middle', ls: 1.05 }));
  return [...els, ...nodes];
}

// ───────── 10. Пирамида уровней ─────────
// Вопрос: «сколько людей на каждом уровне управления и не слишком ли тяжёл верх?»
// data: { unit?: 'чел.', levels: [{ name, size, note? }] 3–6 сверху вниз }
// Полосы по центру, ширина пропорциональна численности; слева уровень, справа число и доля от всех (derived).
// Верхний уровень на акценте (opt.highlight — номер уровня). Ось по центру связывает уровни в пирамиду.
function gradePyramid(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [], lv = data.levels, n = lv.length, unit = data.unit || 'чел.';
  const LW = opt.labelW || 3.2, RW = opt.valueW || 2.0, bx = x + LW, bw = w - LW - RW, mid = bx + bw / 2;
  const FOOT = 0.42, rh = (h - FOOT) / n, bh = Math.min(0.5, rh * 0.62), mx = Math.max(...lv.map(l => l.size));
  const labs = lv.map(l => `${l.name}: численность`), hi = opt.highlight ?? 0;
  const vals = lv.map((l, i) => num(labs[i], l.size, srcOf(l, data, opt)));
  const tot = lv.reduce((a, l) => a + l.size, 0), totS = num(`всего: ${unit}`, tot, { type: 'derived', from: labs, op: 'sum' });
  els.push(vline(mid, y, y + rh * n, { color: C.axis, lw: 0.75, dash: true }));
  lv.forEach((l, i) => {
    const cy = y + (i + 0.5) * rh, bwid = Math.max(0.12, l.size / mx * (bw - 0.4)), hot = i === hi;
    els.push(rect(mid - bwid / 2, cy - bh / 2, bwid, bh, { r: 0.04, fill: hot ? C.accent : C.bar }));
    els.push(hline(x + LW - 0.25, mid - bwid / 2 - 0.1, cy, { color: C.rule, lw: 0.75 }));
    const k = nl(l.name, 12.5, LW - 0.4, true), hh = lh(12.5) * k + (l.note ? lh(10) : 0);
    els.push(text(x, cy - hh / 2, LW - 0.4, lh(12.5) * k + 0.02, l.name, { size: 12.5, bold: true, align: 'right', ls: 1.05 }));
    if (l.note) els.push(text(x, cy - hh / 2 + lh(12.5) * k, LW - 0.4, lh(10) + 0.02, l.note, { size: 10, color: C.muted, align: 'right' }));
    const share = num(`${l.name}: доля от всех`, Math.round(l.size / tot * 1000) / 10, { type: 'derived', from: [labs[i], `всего: ${unit}`], op: 'ratio', scale: 0.01 }, 1);
    els.push(text(x + w - RW + 0.15, cy - 0.2, RW - 0.15, 0.4, [{ t: `${vals[i]}${nb}${unit}`, b: true, s: 14, c: hot ? C.accentInk : C.ink }, { t: ` · ${share}%`, s: 10, c: C.muted }], { size: 14, valign: 'middle' }));
  });
  els.push(hline(x + w - RW + 0.15, x + w, y + rh * n + 0.06, { color: C.axis, lw: 0.75 }));
  els.push(text(x + w - RW + 0.15, y + rh * n + 0.1, RW - 0.15, FOOT - 0.1, [{ t: 'Всего ', c: C.muted }, { t: `${totS}${nb}${unit}`, b: true }], { size: 12.5, valign: 'middle' }));
  return els;
}

// ───────── 11. Сеть отношений ─────────
// Вопрос: «кто с кем работает теснее всего?»
// data: { nodes: [{ id, name, note?, hub? }] 4–9, links: [{ from, to, weight?: 1|2|3, kind?: 'dashed', tag? }] }
// Участники по эллипсу (хаб — в центре), толщина связи — плотность взаимодействия, самые плотные — акцентом.
// Подпись связи (tag) — только у главных, на подложке посередине. Внизу легенда толщины.
function relationshipWeb(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [], marks = [], nodes = [], LEG = 0.36;
  const hub = data.nodes.find(n => n.hub), ring = data.nodes.filter(n => n !== hub), m = ring.length, LW = opt.labelW || 2.2;
  const cx = x + w / 2, cy = y + (h - LEG) / 2, rx = w / 2 - LW - 0.3, ry = (h - LEG) / 2 - 0.5;
  const pos = new Map();
  if (hub) pos.set(hub.id, { x: cx, y: cy, d: opt.hubD || 1.55, hub: true, a: 0 });
  ring.forEach((n, i) => { const a = -90 + 360 * i / m + (opt.rotate || 0), r = a * Math.PI / 180; pos.set(n.id, { x: cx + rx * Math.cos(r), y: cy + ry * Math.sin(r), d: 0.3, a: r }); });
  const lwOf = wt => (wt >= 3 ? 3.5 : wt === 2 ? 2 : 1);
  data.links.forEach(l => {
    const a = pos.get(l.from), b = pos.get(l.to);
    if (!a || !b) throw new Error(`relationshipWeb: связь ${l.from} — ${l.to} на неизвестного участника`);
    const [x1, y1] = clipOval(a.x, a.y, a.d / 2 + 0.05, a.d / 2 + 0.05, b.x, b.y), [x2, y2] = clipOval(b.x, b.y, b.d / 2 + 0.05, b.d / 2 + 0.05, a.x, a.y);
    const wt = l.weight || 1, t = l.kind === 'dashed' ? tone('dashed') : { color: wt >= 3 ? C.accent : C.axis, lw: lwOf(wt) };
    els.push(seg(x1, y1, x2, y2, t));
    if (l.tag) {
      const lb = edgeLabel({ tag: l.tag, kind: wt >= 3 ? undefined : 'muted' }, 1.6), lw2 = Math.min(1.7, tw(caps(l.tag), lb.pt, true) * 1.25 + 0.16);
      const mx_ = (x1 + x2) / 2, my = (y1 + y2) / 2;
      marks.push(knock(mx_ - lw2 / 2, my - lb.h / 2 - 0.03, lw2, lb.h + 0.06), text(mx_ - lw2 / 2, my - lb.h / 2, lw2, lb.h, lb.runs, { size: lb.pt, align: 'center', valign: 'middle' }));
    }
  });
  data.nodes.forEach(n => {
    const p = pos.get(n.id);
    if (p.hub) {
      nodes.push(oval(p.x, p.y, p.d, { fill: C.accent }));
      const lines_ = [{ t: n.name, b: true }];
      if (n.note) lines_.push({ t: '\n' + n.note, s: 9.5 });
      nodes.push(text(p.x - p.d / 2 + 0.12, p.y - p.d / 2 + 0.1, p.d - 0.24, p.d - 0.2, lines_, { size: 12.5, color: C.onAccent, align: 'center', valign: 'middle', ls: 1.05 }));
      return;
    }
    nodes.push(oval(p.x, p.y, p.d, { fill: THEME === 'dark' ? C.card : C.panel, line: C.accent, lw: 2 }));
    const c = Math.cos(p.a), s = Math.sin(p.a), lines_ = [{ t: n.name, b: true }];
    if (n.note) lines_.push({ t: '\n' + n.note, s: 9.5, c: C.muted });
    const hh = lh(12) * nl(n.name, 12, LW, true) + (n.note ? lh(9.5) * nl(n.note, 9.5, LW) : 0) + 0.04;
    let lx, ly, al;
    if (c > 0.3) { lx = p.x + 0.26; ly = p.y - hh / 2; al = 'left'; }
    else if (c < -0.3) { lx = p.x - 0.26 - LW; ly = p.y - hh / 2; al = 'right'; }
    else { lx = p.x - LW / 2; ly = s < 0 ? p.y - 0.24 - hh : p.y + 0.24; al = 'center'; }
    nodes.push(text(lx, ly, LW, hh, lines_, { size: 12, align: al, ls: 1.05 }));
  });
  marks.push(...legendLine(x, y + h - LEG / 2, [
    { label: opt.strongLabel || 'постоянно', tone: { color: C.accent, lw: 3.5 } },
    { label: opt.midLabel || 'регулярно', tone: { color: C.axis, lw: 2 } },
    { label: opt.weakLabel || 'эпизодически', tone: { color: C.axis, lw: 1 } }]));
  return [...els, ...nodes, ...marks];
}

// ───────── 12. Матрица взаимодействий ─────────
// Вопрос: «какие подразделения от каких зависят в работе и насколько плотно?»
// data: { units: [{ name, short }] 4–8, cells: [{ from, to, level: 1|2|3 }], levels?: [три подписи], rowsHead?, colsHead? }
// Строка — кто обращается, столбец — к кому. Размер точки — плотность, уровень 3 акцентом. Диагональ тоном.
// Справа легенда и итог строки: к скольким подразделениям обращается.
function interactionMatrix(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [], marks = [], us = data.units, n = us.length;
  const idx = new Map(us.map((u, i) => [u.short || u.name, i]));
  const at = k => { const i = idx.has(k) ? idx.get(k) : us.findIndex(u => u.name === k); if (i < 0) throw new Error(`interactionMatrix: неизвестное подразделение «${k}»`); return i; };
  const LW = opt.labelW || 3.0, LEGW = opt.legendW || 2.3, HD = 0.62, cs = Math.min((w - LW - LEGW) / n, (h - HD) / n);
  const gx = x + LW, gy = y + HD, D = [0, 0.14, 0.24, 0.36];
  els.push(text(gx, y, cs * n, 0.22, caps(data.colsHead || 'к кому обращаются →'), { size: 8.5, bold: true, color: C.muted, valign: 'middle' }));
  us.forEach((u, i) => {
    els.push(text(gx + i * cs, y + 0.22, cs, HD - 0.26, u.short || u.name, { size: 10.5, bold: true, align: 'center', valign: 'bottom' }));
    const k = nl(u.name, 12, LW - 0.25, true);
    els.push(text(x, gy + i * cs + cs / 2 - lh(12) * k / 2, LW - 0.25, lh(12) * k + 0.02, u.name, { size: 12, bold: true, align: 'right', ls: 1.05 }));
    els.push(rect(gx + i * cs + 0.03, gy + i * cs + 0.03, cs - 0.06, cs - 0.06, { r: 0.04, fill: C.band, alpha: C.bandA * 3 }));
  });
  for (let i = 0; i <= n; i++) {
    els.push(hline(gx, gx + cs * n, gy + i * cs, { color: C.rule, lw: 0.75 }), vline(gx + i * cs, gy, gy + cs * n, { color: C.rule, lw: 0.75 }));
  }
  const deg = us.map(() => 0);
  data.cells.forEach(c => {
    const r = at(c.from), k = at(c.to), lvl = Math.max(1, Math.min(3, c.level || 1));
    if (r === k) return;
    deg[r]++;
    marks.push(oval(gx + k * cs + cs / 2, gy + r * cs + cs / 2, D[lvl], { fill: lvl === 3 ? C.accent : lvl === 2 ? C.bar : C.axis }));
  });
  const lx = gx + cs * n + 0.4, names = data.levels || ['эпизодически', 'регулярно', 'постоянно'];
  els.push(text(lx, gy, LEGW - 0.4, 0.26, 'ПЛОТНОСТЬ', { size: 8.5, bold: true, color: C.muted }));
  [3, 2, 1].forEach((lvl, j) => {
    const yy = gy + 0.42 + j * 0.36;
    marks.push(oval(lx + 0.2, yy, D[lvl], { fill: lvl === 3 ? C.accent : lvl === 2 ? C.bar : C.axis }));
    els.push(text(lx + 0.45, yy - 0.14, LEGW - 0.85, 0.28, names[lvl - 1], { size: 10.5, color: C.ink2, valign: 'middle' }));
  });
  const busiest = deg.indexOf(Math.max(...deg)), strong = data.cells.filter(c => at(c.from) === busiest && c.level >= 3).map(c => us[at(c.to)].name);
  if (opt.summary !== false) els.push(text(lx, gy + 1.65, LEGW - 0.4, 1.4, [{ t: 'Больше всех обращается\n', c: C.muted, s: 10.5 }, { t: us[busiest].name, b: true, s: 12 },
    ...(strong.length ? [{ t: `\nпостоянно — к: ${strong.join(', ')}`, s: 10.5, c: C.ink2 }] : [])], { size: 10.5, ls: 1.1 }));
  return [...els, ...marks];
}

// ───────── 13. Дуги передач ─────────
// Вопрос: «где работа переходит между подразделениями и где возвращается назад?»
// data: { units: [{ id, name, note? }] 4–7 по порядку процесса, handoffs: [{ from, to, weight?: 1|2|3, tag? }] }
// Подразделения точками на оси, передачи вперёд — дуги сверху, возвраты назад — пунктирные дуги снизу.
// Толщина дуги — объём, самые тяжёлые акцентом. Подпись (tag) — на вершине дуги.
function arcHandoffs(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [], marks = [], us = data.units, n = us.length;
  const ix = new Map(us.map((u, i) => [u.id, i]));
  const NAMEH = 0.75, ay = y + (h - NAMEH) * (opt.axisAt ?? 0.66), slot = w / n, px = i => x + (i + 0.5) * slot;
  const up = data.handoffs.filter(hf => ix.get(hf.to) > ix.get(hf.from)), back = data.handoffs.filter(hf => ix.get(hf.to) < ix.get(hf.from));
  data.handoffs.forEach(hf => { if (!ix.has(hf.from) || !ix.has(hf.to)) throw new Error(`arcHandoffs: передача ${hf.from} → ${hf.to} на неизвестное подразделение`); });
  const span = hf => Math.abs(ix.get(hf.to) - ix.get(hf.from));
  const maxUp = Math.max(1, ...up.map(span)), maxBack = Math.max(1, ...back.map(span));
  const topRoom = ay - y - 0.62, botRoom = y + h - NAMEH - ay - 0.1;
  const draw = (hf, above) => {
    const a = ix.get(hf.from), b = ix.get(hf.to), x1 = px(a), x2 = px(b), rx = Math.abs(x2 - x1) / 2, cxm = (x1 + x2) / 2;
    const ry = above ? topRoom * (0.35 + 0.65 * span(hf) / maxUp) : Math.min(botRoom, 0.9) * (0.45 + 0.55 * span(hf) / maxBack);
    const wt = hf.weight || 1, t = above ? { color: wt >= 3 ? C.accent : C.axis, lw: wt >= 3 ? 3 : wt === 2 ? 2 : 1.25 } : tone('dashed');
    // сверху: из точки «откуда» через вершину к «куда» (слева направо); снизу: справа налево
    els.push(...U.arc(cxm, ay, rx, ry, above ? 180 : 0, above ? 360 : 180, t));
    marks.push(head(x2, ay - (above ? 0.17 : -0.17), above ? 90 : 270, t.color, 0.14));
    if (hf.tag) {
      const lb = edgeLabel({ tag: hf.tag, kind: above && wt >= 3 ? undefined : 'muted' }, 1.6), lw2 = Math.min(1.7, tw(caps(hf.tag), lb.pt, true) * 1.25 + 0.16);
      const ty = above ? ay - ry : ay + ry;
      marks.push(knock(cxm - lw2 / 2, ty - lb.h / 2 - 0.03, lw2, lb.h + 0.06), text(cxm - lw2 / 2, ty - lb.h / 2, lw2, lb.h, lb.runs, { size: lb.pt, align: 'center', valign: 'middle' }));
    }
  };
  up.sort((p, q) => span(q) - span(p)).forEach(hf => draw(hf, true));
  back.forEach(hf => draw(hf, false));
  els.push(hline(x + 0.2, x + w - 0.2, ay, { color: C.axis, lw: 0.75 }));
  us.forEach((u, i) => {
    marks.push(oval(px(i), ay, 0.24, { fill: i === 0 || i === n - 1 ? C.accent : THEME === 'dark' ? C.card : C.panel, line: C.accent, lw: 1.5 }));
    const nameY = y + h - NAMEH, lines_ = [{ t: u.name, b: true }];
    if (u.note) lines_.push({ t: '\n' + u.note, s: 9.5, c: C.muted });
    marks.push(text(px(i) - slot / 2 + 0.06, nameY, slot - 0.12, NAMEH, lines_, { size: 11.5, align: 'center', ls: 1.05 }));
  });
  marks.push(...legendLine(x, y + 0.12, [{ label: opt.forwardLabel || 'передача дальше', tone: { color: C.accent, lw: 3 }, arrow: true }, { label: opt.backLabel || 'возврат на доработку', kind: 'dashed', arrow: true }]));
  return [...els, ...marks];
}

module.exports = { deptTree, orgOutline, spanOfControl, dualReporting, orgNest, teamTopology, tribeChapters, orgTransition, regionNetwork, gradePyramid, relationshipWeb, interactionMatrix, arcHandoffs };
