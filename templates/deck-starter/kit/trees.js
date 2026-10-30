// Деревья: решения, декомпозиция цели, уровни управления, карта мысли (под-скилл «Схемы», reference/19-schemes.md).
// Один движок ортогонального дерева: раскладка по числу листьев, связи скобкой — от родителя к средней линии,
// по ней на всю ширину детей и стеблями к каждому ребёнку. Подпись ответа лежит на стебле на подложке цвета фона.
// API как в components.js: (box, data, opt) → els.
const L = require('../lib.js');
const U = require('./util.js');
const { C, rect, oval, hline, vline, text, tw } = L;
const { card, tone, toneInk, head, edgeLabel, knock, lh, wrap } = U;

const caps = s => String(s).toUpperCase();
const nl = (s, pt, w, b) => wrap([{ t: String(s), b: !!b }], pt, w);
const ncap = (s, pt, w) => nl(caps(s), pt, w / 1.18, true);          // капитель шире строчных: запас к оценке ширины
// Самое длинное слово имени входит в ширину без разрыва
const fitsWord = (n, w, S) => String(n.name).split(/\s+/).every(wd => tw(wd, S.name, true) * 1.06 <= w);

// ───────── узел: meta капителью, имя, пояснение, владелец, пункты ─────────
// style: accent — заливка акцентом, hub — карточка с рамкой акцента, card — карточка, muted — карточка с приглушённым именем,
// plain — без контейнера (типографика). S — кегли текущей ступени ужатия.
function measure(n, w, S) {
  let h = 0;
  if (n.meta) h += lh(S.meta) * ncap(n.meta, S.meta, w) + 0.04;
  h += lh(S.name) * nl(n.name, S.name, w, true);
  if (n.note) h += 0.04 + lh(S.item) * nl(n.note, S.item, w);
  if (n.owner) h += 0.05 + lh(S.meta) * ncap(n.owner, S.meta, w);
  (n.items || []).forEach((t, i) => { h += (i ? 0.04 : 0.1) + lh(S.item) * nl(t, S.item, w - 0.18); });
  return h;
}
function drawNode(n, x, y, w, h, style, S, o = {}) {
  const els = [], P = style === 'plain' ? 0 : S.pad, iw = w - 2 * P, align = o.align || 'left';
  if (style === 'accent') els.push(rect(x, y, w, h, { r: 0.14, fill: C.accent }));
  else if (style !== 'plain') els.push(card(x, y, w, h, { hub: style === 'hub' }));
  const onA = style === 'accent';
  const nameC = onA ? C.onAccent : style === 'hub' ? C.accentInk : style === 'muted' ? C.muted : C.ink;
  const soft = onA ? C.onAccent : C.muted, body = onA ? C.onAccent : C.ink2;
  let yy = y + (h - measure(n, iw, S)) / 2;   // содержимое по центру узла
  if (style === 'plain' && !o.center) yy = y;
  if (n.meta) {
    const k = ncap(n.meta, S.meta, iw);
    els.push(text(x + P, yy, iw, lh(S.meta) * k + 0.02, caps(n.meta), { size: S.meta, bold: true, color: onA ? C.onAccent : C.accentInk, align }));
    yy += lh(S.meta) * k + 0.04;
  }
  const k = nl(n.name, S.name, iw, true);
  els.push(text(x + P, yy, iw, lh(S.name) * k + 0.02, n.name, { size: S.name, bold: true, color: nameC, align, ls: 1.05 }));
  yy += lh(S.name) * k;
  if (n.note) {
    const m = nl(n.note, S.item, iw);
    els.push(text(x + P, yy + 0.04, iw, lh(S.item) * m + 0.02, n.note, { size: S.item, color: soft, align, ls: 1.1 }));
    yy += 0.04 + lh(S.item) * m;
  }
  if (n.owner) {
    const m = ncap(n.owner, S.meta, iw);
    els.push(text(x + P, yy + 0.05, iw, lh(S.meta) * m + 0.02, caps(n.owner), { size: S.meta, bold: true, color: onA ? C.onAccent : C.muted, align }));
    yy += 0.05 + lh(S.meta) * m;
  }
  (n.items || []).forEach((t, i) => {
    yy += i ? 0.04 : 0.1;
    const m = nl(t, S.item, iw - 0.18), dx = align === 'right' ? x + P + iw - 0.05 : x + P + 0.05;
    els.push(oval(dx, yy + lh(S.item) / 2, 0.06, { fill: onA ? C.onAccent : C.accent }));
    els.push(text(align === 'right' ? x + P : x + P + 0.18, yy, iw - 0.18, lh(S.item) * m + 0.02, t, { size: S.item, color: body, align, ls: 1.1 }));
    yy += lh(S.item) * m;
  });
  return els;
}

const SCALES = [1, 0.92, 0.84, 0.76];
const sizes = (k, base = {}) => ({ k, pad: 0.16 * k + 0.04, name: Math.max(9, Math.round((base.name || 13) * k * 2) / 2),
  item: Math.max(8, Math.round((base.item || 10.5) * k * 2) / 2), meta: Math.max(8, Math.round((base.meta || 8.5) * k * 2) / 2) });

// Копия дерева (данные пользователя не меняются) с глубиной и листьями по порядку
const clone = n => ({ ...n, children: (n.children || []).map(clone) });
function index(root) {
  const all = [], leaves = [];
  (function walk(n, d) {
    n.depth = d; all.push(n);
    const ch = n.children || [];
    if (!ch.length) { n.li = leaves.length; leaves.push(n); }
    ch.forEach(c => walk(c, d + 1));
    n.l0 = ch.length ? ch[0].l0 : n.li; n.l1 = ch.length ? ch[ch.length - 1].l1 : n.li;
  })(root, 0);
  return { all, leaves, depth: Math.max(...all.map(n => n.depth)) + 1 };
}

// Подпись на стебле: по центру (cx, cy) на подложке цвета фона, линия уходит под неё
function stemLabel(e, cx, cy, maxW) {
  if (!e.tag && !e.text) return [];
  const est = Math.max(e.tag ? tw(caps(e.tag), 9.5, true) * 1.18 : 0, e.text ? tw(e.text, 9.5) * 1.1 : 0) + 0.14;
  const w = Math.min(maxW, est), lb = edgeLabel(e, w - 0.06);
  return [knock(cx - w / 2, cy - lb.h / 2 - 0.03, w, lb.h + 0.06),
    text(cx - w / 2, cy - lb.h / 2, w, lb.h, lb.runs, { size: lb.pt, align: 'center', valign: 'middle', ls: 1.05 })];
}

// ───────── дерево сверху вниз ─────────
// o: { styleOf(n, isLeaf), left: отступ слева под строки уровней, maxW, gx, arrows, base: кегли, levels: [строки] }
function treeTD(box, root0, o = {}) {
  const root = clone(root0), { all, leaves, depth } = index(root);
  const lx = box.x + (o.left || 0), lw = box.w - (o.left || 0), N = leaves.length, slot = lw / N, GX = o.gx ?? 0.24;
  all.slice().reverse().forEach(n => { n.cx = n.children && n.children.length ? (n.children[0].cx + n.children[n.children.length - 1].cx) / 2 : lx + (n.li + 0.5) * slot; });
  // ширина узла: до середины между соседями по ряду (узел с одним ребёнком не зажат в одну колонку листа)
  [...Array(depth)].forEach((_, d) => {
    const row = all.filter(n => n.depth === d).sort((p, q) => p.cx - q.cx);
    row.forEach((n, i) => {
      const lo = i ? (row[i - 1].cx + n.cx) / 2 : lx, hi = i < row.length - 1 ? (n.cx + row[i + 1].cx) / 2 : lx + lw;
      n.w = Math.min(o.maxW || 3.2, 2 * Math.min(n.cx - lo, hi - n.cx) - GX);
    });
  });
  const GMIN = o.labels ? 0.62 : 0.48;
  let S, rowH, G;
  for (const k of SCALES) {
    S = sizes(k, o.base);
    rowH = [...Array(depth)].map(() => 0);
    all.forEach(n => { const st = o.styleOf(n, !(n.children || []).length); n.style = st; n.h = measure(n, n.w - 2 * (st === 'plain' ? 0 : S.pad), S) + 2 * (st === 'plain' ? 0 : S.pad); rowH[n.depth] = Math.max(rowH[n.depth], n.h); });
    G = depth > 1 ? (box.h - rowH.reduce((s, v) => s + v, 0)) / (depth - 1) : 0;
    if (G >= GMIN && all.every(n => fitsWord(n, n.w - 2 * (n.style === 'plain' ? 0 : S.pad), S))) break;
  }
  if (G < GMIN - 0.01) console.warn(`дерево: не помещается по высоте на ${(GMIN - G).toFixed(2)}″ — сократите узлы или уровни`);
  const g = Math.min(G, 1.15), off = depth > 1 ? (G - g) * (depth - 1) / 2 : (box.h - rowH[0]) / 2;
  const rowY = [box.y + off];
  for (let d = 1; d < depth; d++) rowY[d] = rowY[d - 1] + rowH[d - 1] + g;
  all.forEach(n => { n.x = n.cx - n.w / 2; n.y = rowY[n.depth]; n.h = rowH[n.depth]; });

  const lines_ = [], marks = [], labels = [];
  if (o.levels) o.levels.slice(0, depth).forEach((t, d) => {
    labels.push(text(box.x, rowY[d], (o.left || 0) - 0.2, rowH[d], caps(t), { size: 9, bold: true, color: C.muted, valign: 'middle', ls: 1.1 }));
    if (d) lines_.push(hline(box.x, box.x + box.w, rowY[d] - g / 2, { color: C.rule, lw: 0.75 }));
  });
  all.forEach(p => {
    const ch = p.children || [];
    if (!ch.length) return;
    const py = p.y + p.h, ym = py + g * 0.36;
    lines_.push(vline(p.cx, py, ym, tone(p.link)));
    if (ch.length > 1) lines_.push(hline(ch[0].cx, ch[ch.length - 1].cx, ym, tone(p.link)));
    ch.forEach(c => {
      const t = tone(c.link), end = o.arrows ? c.y - 0.12 : c.y;
      lines_.push(vline(c.cx, ym, end, t));
      if (o.arrows) marks.push(head(c.cx, c.y - 0.01, 90, t.color, 0.13));
      if (c.edge) labels.push(...stemLabel({ tag: c.edge, text: c.edgeNote, kind: c.link }, c.cx, (ym + c.y) / 2 + 0.02, Math.min(slot * (c.l1 - c.l0 + 1) - 0.1, 2.4)));
    });
  });
  const els = [...lines_];
  all.forEach(n => els.push(...drawNode(n, n.x, n.y, n.w, n.h, n.style, S)));
  return [...els, ...marks, ...labels];
}

// ───────── дерево слева направо ─────────
// o: { styleOf(n, isLeaf), cols: доли ширины по уровням, gx: зазор под скобку, base }
function treeLR(box, root0, o = {}) {
  const root = clone(root0), { all, leaves, depth } = index(root);
  const GX = o.gx ?? 0.7, fr = o.cols || [...Array(depth)].map(() => 1 / depth), sum = fr.reduce((s, v) => s + v, 0);
  const cw = fr.map(f => (box.w - GX * (depth - 1)) * f / sum), colX = [box.x];
  for (let d = 1; d < depth; d++) colX[d] = colX[d - 1] + cw[d - 1] + GX;
  const N = leaves.length, slot = box.h / N;
  let S;
  for (const k of SCALES) {
    S = sizes(k, o.base);
    let ok = true;
    all.forEach(n => {
      const st = o.styleOf(n, !(n.children || []).length), P = st === 'plain' ? 0 : S.pad;
      n.style = st; n.w = cw[n.depth]; n.h = measure(n, n.w - 2 * P, S) + 2 * P;
      if (n.h > (n.l1 - n.l0 + 1) * slot - 0.1 || !fitsWord(n, n.w - 2 * P, S)) ok = false;
    });
    if (ok) break;
  }
  all.forEach(n => { if (n.h > (n.l1 - n.l0 + 1) * slot - 0.1) console.warn(`дерево: узел «${n.name}» выше своей полосы — сократите текст`); });
  all.slice().reverse().forEach(n => { n.cy = n.children && n.children.length ? (n.children[0].cy + n.children[n.children.length - 1].cy) / 2 : box.y + (n.li + 0.5) * slot; });
  // узел без контейнера стоит именем на линии связи: точка скобки приходится на первую строку имени
  all.forEach(n => { n.x = colX[n.depth]; n.y = n.style === 'plain' ? n.cy - lh(S.name) / 2 - 0.01 : n.cy - n.h / 2; });
  const lines_ = [], marks = [];
  all.forEach(p => {
    const ch = p.children || [];
    if (!ch.length) return;
    const px = p.x + p.w, xm = px + GX * 0.42;
    lines_.push(hline(px, xm, p.cy, tone(p.link)));
    if (ch.length > 1) lines_.push(vline(xm, ch[0].cy, ch[ch.length - 1].cy, tone(p.link)));
    ch.forEach(c => {
      const gap = c.style === 'plain' ? 0.12 : 0;   // типографский узел: точка с воздухом перед текстом
      lines_.push(hline(xm, c.x - gap - (o.arrows ? 0.12 : 0.06), c.cy, tone(c.link)));
      if (o.arrows) marks.push(head(c.x - gap - 0.02, c.cy, 0, tone(c.link).color, 0.13));
      else marks.push(oval(c.x - gap - 0.06, c.cy, 0.09, { fill: tone(c.link).color }));
    });
  });
  const els = [...lines_];
  all.forEach(n => els.push(...drawNode(n, n.x, n.y, n.w, n.h, n.style, S, { center: true })));
  return [...els, ...marks];
}

// Дерево решений сверху вниз. Вопрос: «что делать в каждом случае?»
// data: { root: { name, note? }, children: [{ edge, edgeNote?, name, note?, tone?: 'good'|'bad', link?: 'dashed', children? }] }
// Корень — вопрос на заливке акцента; промежуточные вопросы — карточки; листья-исходы: good — рамка акцента,
// bad — приглушённое имя. На стебле — ответ («да», «нет», условие) капителью. До 3 уровней, до 6 листьев.
function decisionTree(box, data, opt = {}) {
  const root = { ...data.root, children: data.children };
  return treeTD(box, root, {
    labels: true, arrows: true, maxW: opt.maxW || 3.1,
    styleOf: (n, leaf) => (n.depth === 0 ? 'accent' : !leaf ? 'card' : n.tone === 'good' ? 'hub' : n.tone === 'bad' ? 'muted' : 'card'),
  });
}

// Дерево драйверов слева направо. Вопрос: «из чего складывается цель и кто тянет каждый рычаг?»
// data: { root: { name, note? }, children: [{ name, note?, owner?, children: [{ name, note?, owner? }] }] }
// Цель — карточка с рамкой акцента, драйверы — карточки, рычаги — типографикой с точкой на конце скобки.
// owner — владелец рычага капителью под именем. MECE: драйверы не пересекаются и вместе дают цель.
function driverTree(box, data, opt = {}) {
  const root = { ...data.root, children: data.children };
  return treeLR(box, root, {
    cols: opt.cols || [0.27, 0.33, 0.40], gx: opt.gap ?? 0.75, base: { name: 13, item: 10 },
    styleOf: (n, leaf) => (n.depth === 0 ? 'hub' : leaf ? 'plain' : 'card'),
  });
}

// Уровни управления сверху вниз. Вопрос: «кто принимает решения и как часто?»
// data: { levels?: [строки по уровням], root: { name, meta?, items? }, children: [{ name, meta?, items?, children? }] }
// meta — частота и полномочия капителью акцента над именем («раз в квартал · бюджет»). Строки уровней — слева,
// уровни разделены волосяными линиями. Корень — карточка с рамкой акцента.
function governanceTree(box, data, opt = {}) {
  const root = { ...data.root, children: data.children };
  return treeTD(box, root, {
    left: data.levels ? (opt.levelW || 1.35) : 0, levels: data.levels, maxW: opt.maxW || 3.2, gx: 0.22,
    base: { name: 12.5, item: 10 },
    styleOf: n => (n.depth === 0 ? 'hub' : 'card'),
  });
}

// Карта мысли. Вопрос: «из каких направлений состоит тема?»
// data: { center: { name, note? }, branches: [{ name, items?: [строки], link?: 'dashed' }] } 4–8 ветвей
// Тема — на заливке акцента в центре, ветви поровну влево и вправо типографикой, связи — ортогональные скобки
// от темы к имени каждой ветви. Слева текст выровнен вправо, к центру.
function mindMap(box, data, opt = {}) {
  const { x, y, w, h } = box, br = data.branches, half = Math.ceil(br.length / 2);
  const sides = [br.slice(0, half), br.slice(half)];   // правая, левая
  const CW = opt.centerW || 2.6, GX = opt.gap ?? 0.8, bw = (w - CW) / 2 - GX;
  const cx = x + w / 2, cy = y + h / 2;
  let S, hs;
  for (const k of SCALES) {
    S = sizes(k, { name: 13, item: 10 });
    hs = sides.map(side => side.map(b => measure(b, bw, S)));
    if (hs.every(a => a.reduce((s, v) => s + v, 0) + 0.3 * (a.length - 1) <= h)) break;
  }
  const center = { ...data.center };
  const ch = measure(center, CW - 2 * S.pad, { ...S, name: S.name + 3 }) + 2 * S.pad;
  const els = [], marks = [], nodes = [];
  sides.forEach((side, si) => {
    if (!side.length) return;
    const right = si === 0, tot = hs[si].reduce((s, v) => s + v, 0), gap = side.length > 1 ? Math.min(0.9, (h - tot) / (side.length - 1)) : 0;
    let yy = cy - (tot + gap * (side.length - 1)) / 2;
    const ex = right ? cx + CW / 2 : cx - CW / 2, xm = right ? ex + GX * 0.45 : ex - GX * 0.45;
    const bx = right ? ex + GX : x, ys = [];
    side.forEach((b, i) => {
      const ly = yy + lh(S.name) / 2;
      ys.push(ly);
      nodes.push(...drawNode(b, bx, yy, bw, hs[si][i], 'plain', S, { align: right ? 'left' : 'right' }));
      const t = tone(b.link), tip = right ? bx - 0.08 : bx + bw + 0.08;
      els.push(hline(Math.min(xm, tip), Math.max(xm, tip), ly, t));
      marks.push(oval(tip, ly, 0.09, { fill: t.color }));
      yy += hs[si][i] + gap;
    });
    els.push(hline(Math.min(ex, xm), Math.max(ex, xm), cy, tone()));
    els.push(vline(xm, Math.min(cy, ...ys), Math.max(cy, ...ys), tone()));
  });
  nodes.unshift(...drawNode(center, cx - CW / 2, cy - ch / 2, CW, ch, 'accent', { ...S, name: S.name + 3 }, { align: 'center' }));
  return [...els, ...nodes, ...marks];
}

module.exports = { decisionTree, driverTree, governanceTree, mindMap };
// Движок дерева для других семейств (kit/orgs.js). Не перечисляется: components.js не берёт его в библиотеку.
Object.defineProperty(module.exports, 'engine', { value: { treeTD, treeLR, drawNode, measure, sizes, SCALES }, enumerable: false });
