// Схемы по дорожкам (под-скилл «Схемы», reference/19-schemes.md): кросс-функциональный процесс, схема сервиса,
// диаграмма последовательности, передачи во времени, лестница эскалации.
// Дорожки разделены тонкими линиями без заливки и зебры, названия дорожек — в левой колонке.
// API как в components.js: (box, data, opt) → els.
const L = require('../lib.js');
const U = require('./util.js');
const { C, rect, hline, vline, text, tw } = L;
const { card, tone, head, edgeLabel, pill, stack, lines, lh } = U;

// ───────── общий движок дорожек (не экспортируется) ─────────
// Линия с разрывами вокруг текстов: линия не перечёркивает подписи
function cutH(x1, x2, y, holes, o) {
  const cuts = holes.filter(r => y > r.y - 0.02 && y < r.y + r.h + 0.02 && r.x < x2 && r.x + r.w > x1).map(r => [r.x - 0.05, r.x + r.w + 0.05]).sort((a, b) => a[0] - b[0]);
  const out = [];
  let cur = x1;
  cuts.forEach(([a, b]) => { if (a > cur + 0.02) out.push(hline(cur, a, y, o)); cur = Math.max(cur, b); });
  if (x2 > cur + 0.02) out.push(hline(cur, x2, y, o));
  return out;
}
function cutV(x, y1, y2, holes, o) {
  const cuts = holes.filter(r => x > r.x - 0.02 && x < r.x + r.w + 0.02 && r.y < y2 && r.y + r.h > y1).map(r => [r.y - 0.04, r.y + r.h + 0.04]).sort((a, b) => a[0] - b[0]);
  const out = [];
  let cur = y1;
  cuts.forEach(([a, b]) => { if (a > cur + 0.02) out.push(vline(x, cur, a, o)); cur = Math.max(cur, b); });
  if (y2 > cur + 0.02) out.push(vline(x, cur, y2, o));
  return out;
}
const textBoxes = els => els.filter(e => e.t === 'text').map(e => ({ x: e.x, y: e.y, w: e.w, h: e.h }));

// Каркас: колонка названий шириной LW, шапка headH, дорожки равной высоты. Разделители рисует sep() в конце.
function frame(box, lanes, { LW = 1.6, headH = 0 } = {}) {
  const { x, y, w, h } = box, top = y + headH, lh_ = (h - headH) / lanes.length;
  const names = lanes.map((nm, i) => { const th = lh(11) * lines(nm, 11, LW - 0.2, true) + 0.04; return text(x, top + (i + 0.5) * lh_ - th / 2, LW - 0.2, th, nm, { size: 11, bold: true, color: C.ink2, valign: 'middle', ls: 1.05 }); });
  const sep = holes => {
    const o = { color: C.rule, lw: 0.75 }, out = [];
    for (let i = 0; i <= lanes.length; i++) out.push(...cutH(x, x + w, top + i * lh_, holes, i === 0 && headH ? { color: C.axis, lw: 0.75 } : o));
    return out;
  };
  return { names, sep, top, laneH: lh_, cy: i => top + (i + 0.5) * lh_, gx: x + LW, gw: w - LW };
}

// Узлы шагов в ячейках (кол, дорожка): карточка, пилюля (start/end) или ромб решения
function stepNodes(steps, fr, ncol, o = {}) {
  const colW = fr.gw / ncol, gap = o.gap ?? 0.5, nodes = new Map(), els = [];
  // кегль подписи шага: самое длинное слово входит в ширину, иначе кегль ниже (слова не рвутся)
  const fit = (t, w, hi, bold) => { const wd = Math.max(...String(t).split(/\s+/).map(v => tw(v, 1, bold) * (bold ? 1.06 : 1.1))); return [hi, hi - 0.5, hi - 1, hi - 1.5, 8].find(p => wd * p <= w) || 8; };
  // один кегль на все шаги (не больше двух кеглей в теле): наименьший из подобранных
  const geo = s => ({ w: s.kind === 'decision' ? Math.min(colW - 0.25, 1.5) * 0.64 : Math.min(colW - gap, o.maxW || 2.4) - 0.24 });
  const PT = Math.min(...steps.map(s => fit(s.name, geo(s).w, 10, s.kind === 'decision' || s.kind === 'start' || s.kind === 'end')));
  steps.forEach(s => {
    const cx = fr.gx + (s.col + 0.5) * colW, cy = fr.cy(s.lane);
    let w = Math.min(colW - gap, o.maxW || 2.4), h = Math.min(fr.laneH - 0.3, 0.72);
    if (s.kind === 'decision') {
      w = Math.min(colW - 0.25, 1.5); h = Math.min(fr.laneH - 0.16, 0.92);
      els.push({ t: 'diamond', x: cx - w / 2, y: cy - h / 2, w, h, fill: C.accent });
      els.push(text(cx - w * 0.32, cy - h * 0.3, w * 0.64, h * 0.6, s.name, { size: PT, bold: true, color: C.onAccent, align: 'center', valign: 'middle', ls: 1.0 }));
    } else if (s.kind === 'start' || s.kind === 'end') {
      h = Math.min(h, 0.5 + (lines(s.name, 10, w - 0.3, true) > 1 ? 0.2 : 0));
      els.push(rect(cx - w / 2, cy - h / 2, w, h, { r: h / 2, fill: s.kind === 'start' ? C.accent : C.bg, line: C.accent, lw: 1.5 }));
      els.push(text(cx - w / 2 + 0.12, cy - h / 2, w - 0.24, h, s.name, { size: PT, bold: true, color: s.kind === 'start' ? C.onAccent : C.ink, align: 'center', valign: 'middle', ls: 1.0 }));
    } else {
      els.push(card(cx - w / 2, cy - h / 2, w, h, { hub: s.hub, r: 0.1 }));
      els.push(text(cx - w / 2 + 0.1, cy - h / 2 + 0.04, w - 0.2, h - 0.08, s.name, { size: PT, color: C.ink, align: 'center', valign: 'middle', ls: 1.05 }));
    }
    nodes.set(s.id, { id: s.id, x: cx - w / 2, y: cy - h / 2, w, h, cx, cy, lane: s.lane, col: s.col });
  });
  return { nodes, els };
}

// Ортогональные переходы со стрелками. Варианты маршрута по порядку: прямая; сначала по вертикали; сначала по горизонтали.
// Кромка узла занята — берётся следующий вариант; путь через чужой узел отбрасывается.
function routeLinks(nodes, links) {
  const used = new Set(), segs = [], marks = [], labels = [];
  const all = [...nodes.values()];
  const block = (pts, a, b) => {
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1], [x2, y2] = pts[i];
      if (all.some(n => n !== a && n !== b && Math.max(x1, x2) > n.x - 0.03 && Math.min(x1, x2) < n.x + n.w + 0.03 && Math.max(y1, y2) > n.y - 0.03 && Math.min(y1, y2) < n.y + n.h + 0.03)) return true;
    }
    return false;
  };
  links.forEach(lk => {
    const a = nodes.get(lk.from), b = nodes.get(lk.to);
    if (!a || !b) throw new Error(`lanes: переход ${lk.from} → ${lk.to}: нет такого шага`);
    const down = b.cy > a.cy, opts = [];
    const ae = down ? a.y + a.h : a.y, be = down ? b.y : b.y + b.h;
    if (a.lane === b.lane && b.col > a.col) opts.push({ pts: [[a.x + a.w, a.cy], [b.x, b.cy]], deg: 0, sides: [`${a.id}:r`, `${b.id}:l`], lab: 'h' });
    else if (a.col === b.col) opts.push({ pts: [[a.cx, ae], [b.cx, be]], deg: down ? 90 : 270, sides: [`${a.id}:${down ? 'b' : 't'}`, `${b.id}:${down ? 't' : 'b'}`], lab: 'v' });
    else if (b.col > a.col) {
      opts.push({ pts: [[a.cx, ae], [a.cx, b.cy], [b.x, b.cy]], deg: 0, sides: [`${a.id}:${down ? 'b' : 't'}`, `${b.id}:l`], lab: 'v' });
      opts.push({ pts: [[a.x + a.w, a.cy], [b.cx, a.cy], [b.cx, be]], deg: down ? 90 : 270, sides: [`${a.id}:r`, `${b.id}:${down ? 't' : 'b'}`], lab: 'h' });
    } else {
      const yl = Math.max(a.y + a.h, b.y + b.h) + 0.14;
      opts.push({ pts: [[a.cx, a.y + a.h], [a.cx, yl], [b.cx, yl], [b.cx, b.y + b.h]], deg: 270, sides: [`${a.id}:b`, `${b.id}:b`], lab: 'v' });
    }
    const pick = opts.find(o => o.sides.every(s => !used.has(s)) && !block(o.pts, a, b)) || opts.find(o => !block(o.pts, a, b)) || opts[0];
    pick.sides.forEach(s => used.add(s));
    const st = tone(lk.kind);
    for (let i = 1; i < pick.pts.length; i++) {
      const [x1, y1] = pick.pts[i - 1], [x2, y2] = pick.pts[i];
      segs.push(y1 === y2 ? hline(Math.min(x1, x2), Math.max(x1, x2), y1, st) : vline(x1, Math.min(y1, y2), Math.max(y1, y2), st));
    }
    const [tx, ty] = pick.pts[pick.pts.length - 1];
    marks.push(head(tx, ty, pick.deg, st.color));
    if (lk.label) {
      // по горизонтали подпись не длиннее первого отрезка: дальше её перечеркнула бы следующая часть маршрута
      const room = pick.lab === 'h' && pick.pts.length > 2 ? Math.abs(pick.pts[1][0] - pick.pts[0][0]) - 0.14 : 1.9;
      const capW = tw(lk.label.toUpperCase(), 9.5, true) * 1.25 + 0.15;
      const short = lk.label.length <= 12 && capW <= room, lw = Math.min(room, short ? Math.min(1.9, Math.max(0.6, capW)) : 1.4);
      const lb = edgeLabel(short ? { tag: lk.label, kind: lk.kind } : { text: lk.label, kind: lk.kind }, lw);
      const [x0, y0] = pick.pts[0];
      if (pick.lab === 'h') labels.push(text(x0 + 0.06, y0 - 0.05 - lb.h, lw, lb.h, lb.runs, { size: lb.pt, valign: 'bottom', ls: 1.05 }));
      else {
        const goDown = pick.pts[1][1] > y0;
        labels.push(text(x0 + 0.07, goDown ? y0 + 0.04 : y0 - 0.04 - lb.h, lw, lb.h, lb.runs, { size: lb.pt, valign: goDown ? 'top' : 'bottom', ls: 1.05 }));
      }
    }
  });
  return { segs, marks, labels };
}

// ═════════════ КОМПОНЕНТЫ ═════════════

// Кросс-функциональный процесс. Вопрос: «кто что делает на каждом шаге и где решение?»
// data: { lanes: [строки], steps: [{ id, lane, col, name, kind?: 'start'|'end'|'decision' }], links: [{ from, to, label?, kind?: 'solid'|'dashed' }] }
// lane — номер дорожки сверху (с 0), col — номер колонки слева. До 5 дорожек и 7 колонок. Подпись перехода «да» / «нет» — капителью.
function swimlaneFlow(box, data, opt = {}) {
  const fr = frame(box, data.lanes, { LW: opt.labelW || 1.6 });
  const ncol = data.cols || Math.max(...data.steps.map(s => s.col)) + 1;
  const { nodes, els: nodeEls } = stepNodes(data.steps, fr, ncol);
  const { segs, marks, labels } = routeLinks(nodes, data.links || []);
  const holes = [...textBoxes(labels)];
  return [...fr.sep(holes), ...fr.names, ...segs, ...nodeEls, ...marks, ...labels];
}

// Схема сервиса (service blueprint). Вопрос: «что видит клиент и что происходит за сценой?»
// data: { stages: [строки], lanes: [строки], lines?: [{ after, name, accent? }], steps: [{ lane, stage, name }], links: [{ from: [lane, stage], to: [lane, stage], label? }] }
// lines — пунктир после дорожки after (линия взаимодействия, линия видимости); accent — акцентом. Подпись линии — под ней в колонке названий.
function serviceBlueprint(box, data, opt = {}) {
  const headH = 0.42, LW = opt.labelW || 1.75;
  const fr = frame(box, data.lanes, { LW, headH });
  const n = data.stages.length, colW = fr.gw / n, els = [];
  data.stages.forEach((s, i) => els.push(text(fr.gx + i * colW, box.y, colW, headH - 0.08, s.toUpperCase(), { size: 9.5, bold: true, color: C.muted, align: 'center', valign: 'middle' })));
  const steps = data.steps.map(s => ({ id: `${s.lane}:${s.stage}`, lane: s.lane, col: s.stage, name: s.name }));
  const { nodes, els: nodeEls } = stepNodes(steps, fr, n, { gap: 0.4, maxW: 2.3 });
  const links = (data.links || []).map(l => ({ from: `${l.from[0]}:${l.from[1]}`, to: `${l.to[0]}:${l.to[1]}`, label: l.label, kind: l.kind }));
  const { segs, marks, labels } = routeLinks(nodes, links);
  const special = new Map((data.lines || []).map(l => [l.after, l]));
  const lineEls = [], lineNames = [];
  special.forEach(l => {
    const yy = fr.top + (l.after + 1) * fr.laneH;
    lineNames.push(text(box.x, yy + 0.05, LW - 0.2, 0.2, l.name.toUpperCase(), { size: 8, bold: true, color: l.accent ? C.accentInk : C.muted, valign: 'top' }));
  });
  const holes = [...textBoxes(labels), ...textBoxes(lineNames)];
  special.forEach(l => {
    const yy = fr.top + (l.after + 1) * fr.laneH;
    lineEls.push(...cutH(box.x, box.x + box.w, yy, holes, { color: l.accent ? C.accent : C.axis, lw: 1, dash: true }));
  });
  // обычные разделители — кроме тех, где лежит особая линия
  const plain = fr.sep(holes).filter(e => ![...special.values()].some(l => Math.abs(e.y - (fr.top + (l.after + 1) * fr.laneH)) < 0.001));
  return [...plain, ...lineEls, ...fr.names, ...els, ...lineNames, ...segs, ...nodeEls, ...marks, ...labels];
}

// Диаграмма последовательности. Вопрос: «кто кому что передаёт и в каком порядке?»
// data: { actors: [строки], messages: [{ from, to, text, kind?: 'reply' }] } — from/to по имени участника или номеру; до 8 сообщений.
// Ответ (reply) — пунктиром. Сообщение самому себе — петля справа от линии жизни.
function sequenceDiagram(box, data) {
  const { x, y, w, h } = box, n = data.actors.length, colW = w / n, els = [], labels = [], segs = [], marks = [];
  const idx = v => (typeof v === 'number' ? v : data.actors.indexOf(v));
  const ax = i => x + (i + 0.5) * colW, ph = 0.42, top = y + ph;
  data.actors.forEach((a, i) => {
    const pw = Math.min(colW - 0.3, tw(a, 11, true) * 1.1 + 0.6);
    const p = pill(ax(i), y + ph / 2, a, { pt: 11, h: ph, w: pw, fill: i === 0 ? C.accent : C.bg, line: i === 0 ? undefined : C.cardLine, color: i === 0 ? C.onAccent : C.ink });
    els.push(...p.els);
  });
  const m = data.messages, step = Math.min(0.62, (h - ph - 0.25) / m.length), y0 = top + 0.18;
  m.forEach((msg, k) => {
    const a = idx(msg.from), b = idx(msg.to);
    if (a < 0 || b < 0) throw new Error(`sequenceDiagram: нет участника «${a < 0 ? msg.from : msg.to}»`);
    const yy = y0 + (k + 0.75) * step, st = tone(msg.kind === 'reply' ? 'dashed' : 'solid');
    if (a === b) {
      const xa = ax(a);
      segs.push(hline(xa, xa + 0.35, yy - 0.12, st), vline(xa + 0.35, yy - 0.12, yy + 0.06, st), hline(xa + 0.04, xa + 0.35, yy + 0.06, st));
      marks.push(head(xa + 0.02, yy + 0.06, 180, st.color, 0.12));
      labels.push(text(xa + 0.45, yy - 0.2, colW - 0.55, 0.3, msg.text, { size: 9.5, color: C.ink2, valign: 'middle' }));
      return;
    }
    const x1 = ax(a), x2 = ax(b), lw = Math.abs(x2 - x1) - 0.24;
    segs.push(hline(Math.min(x1, x2), Math.max(x1, x2), yy, st));
    marks.push(head(x2 + (x2 > x1 ? -0.02 : 0.02), yy, x2 > x1 ? 0 : 180, st.color, 0.13));
    const lb = edgeLabel({ text: msg.text }, lw, true);
    labels.push(text((x1 + x2) / 2 - lw / 2, yy - 0.05 - lb.h, lw, lb.h, lb.runs, { size: lb.pt, align: 'center', valign: 'bottom', color: msg.kind === 'reply' ? C.muted : C.ink2 }));
  });
  const holes = textBoxes(labels), life = [];
  data.actors.forEach((_, i) => life.push(...cutV(ax(i), top, y + h, holes, { color: C.axis, lw: 0.75, dash: true })));
  return [...life, ...segs, ...els, ...marks, ...labels];
}

// Передачи между участниками во времени. Вопрос: «кто когда работает и где передаёт работу дальше?»
// data: { ticks: [строки], lanes: [строки], bars: [{ lane, from, to, name }], handoffs: [{ at, from, to, text }] }
// from/to/at у полос и передач — в делениях шкалы (0…ticks.length); from/to у передачи — номера дорожек.
function handoffTimeline(box, data, opt = {}) {
  const headH = 0.4, fr = frame(box, data.lanes, { LW: opt.labelW || 1.6, headH });
  const n = data.ticks.length, step = fr.gw / n, px = v => fr.gx + v * step, bh = Math.min(0.4, fr.laneH * 0.42), els = [], labels = [];
  data.ticks.forEach((t, i) => els.push(text(px(i), box.y, step, headH - 0.08, t, { size: 10, color: C.muted, align: 'center', valign: 'middle' })));
  const bars = data.bars.map(b => {
    const bx = px(b.from), bw = px(b.to) - px(b.from), by = fr.cy(b.lane) - bh / 2;
    els.push(rect(bx, by, bw, bh, { r: 0.08, fill: b.accent ? C.accent : C.bar }));
    els.push(text(bx + 0.1, by, bw - 0.2, bh, b.name, { size: 10, bold: true, color: b.accent ? C.onAccent : U.onBar(), valign: 'middle' }));
    return { x: bx, y: by, w: bw, h: bh };
  });
  const segs = [], marks = [];
  (data.handoffs || []).forEach(hf => {
    const xx = px(hf.at), down = hf.to > hf.from;
    const y1 = fr.cy(hf.from) + (down ? bh / 2 : -bh / 2), y2 = fr.cy(hf.to) + (down ? -bh / 2 : bh / 2);
    segs.push(vline(xx, Math.min(y1, y2), Math.max(y1, y2), tone(hf.kind)));
    marks.push(L.oval(xx, y1, 0.1, { fill: C.accent }), head(xx, y2, down ? 90 : 270, C.accent));
    if (hf.text) {
      const lw = Math.min(1.7, box.x + box.w - xx - 0.12), lb = edgeLabel({ text: hf.text, tag: hf.tag }, lw);
      labels.push(text(xx + 0.1, (y1 + y2) / 2 - lb.h / 2, lw, lb.h, lb.runs, { size: lb.pt, valign: 'middle', ls: 1.05 }));
    }
  });
  const holes = [...textBoxes(labels), ...bars];
  const grid = [];
  for (let i = 1; i < n; i++) grid.push(...cutV(px(i), fr.top, box.y + box.h, holes, { color: C.rule, lw: 0.5 }));
  return [...grid, ...fr.sep(textBoxes(labels)), ...fr.names, ...els, ...segs, ...marks, ...labels];
}

// Лестница эскалации. Вопрос: «куда идёт вопрос, если на уровне не решили, и как быстро?»
// data: { levels: [{ name, who?, sla?, items?: [строки] }] 2–5, conditions: [строки] — условие перехода между уровнями i и i+1 }
// Уровни ступенями слева направо вниз, первый — с рамкой акцента; sla — срок реакции словами, капителью акцента.
function escalationLadder(box, data) {
  const { x, y, w, h } = box, n = data.levels.length, gapX = 1.2, cw = Math.min(3.2, (w - gapX * (n - 1)) / n), els = [], labels = [];
  const inner = cw - 0.44;
  const need = data.levels.map(l => 0.22 + stack(0, 0, inner, { name: l.name, note: l.who, items: l.items }, { name: 13, item: 10, measure: true }).h + (l.sla ? 0.3 : 0) + 0.2);
  const ch = Math.max(...need), stepX = cw + gapX, stepY = (h - ch) / (n - 1);
  if (stepY < ch / 2 + 0.05) console.warn('escalationLadder: ступени слишком плотные по высоте — сократите пункты');
  const cards = data.levels.map((l, i) => {
    const cx = x + i * stepX, cy = y + i * stepY;
    els.push(card(cx, cy, cw, ch, { hub: i === 0 }));
    let yy = cy + 0.22;
    if (l.sla) { els.push(text(cx + 0.22, yy, inner, 0.24, l.sla.toUpperCase(), { size: 9, bold: true, color: C.accentInk, valign: 'middle' })); yy += 0.3; }
    els.push(...stack(cx + 0.22, yy, inner, { name: l.name, note: l.who, items: l.items }, { name: 13, item: 10, color: i === 0 ? C.accentInk : C.ink }).els);
    return { x: cx, y: cy, w: cw, h: ch };
  });
  const segs = [], marks = [];
  for (let i = 0; i < n - 1; i++) {
    const a = cards[i], b = cards[i + 1], xs = a.x + a.w * 0.5, ys = a.y + a.h, yt = Math.max(b.y + 0.45, ys + 0.12);
    segs.push(vline(xs, ys, yt, tone()), hline(xs, b.x, yt, tone()));
    marks.push(L.oval(xs, ys, 0.11, { fill: C.accent }), head(b.x, yt, 0, C.accent));
    const cond = (data.conditions || [])[i];
    if (cond) {
      const lw = b.x - xs - 0.25, lb = edgeLabel({ tag: 'если', text: cond }, lw);
      labels.push(text(xs + 0.14, yt + 0.08, lw, lb.h, lb.runs, { size: lb.pt, valign: 'top', ls: 1.05 }));
    }
  }
  return [...segs, ...els, ...marks, ...labels];
}

module.exports = { swimlaneFlow, serviceBlueprint, sequenceDiagram, handoffTimeline, escalationLadder };
