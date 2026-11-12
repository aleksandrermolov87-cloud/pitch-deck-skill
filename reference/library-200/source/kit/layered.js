// Слоистые схемы слева направо (под-скилл «Схемы», reference/19-schemes.md): статусная модель, зависимости
// инициатив по волнам, потоки данных, цепочка влияния. API как в components.js: (box, data, opt) → els.
// Общий движок flow() не экспортируется: каждый экспорт kit-файла становится компонентом библиотеки.
const L = require('../lib.js');
const U = require('./util.js');
const { C, rect, hline, vline, text, tw } = L;
const { card, tone, head, edgeLabel, stack, lh, wrap } = U;

const BEND = 0.3, NAME = 12.5, ITEM = 10, PAD = 0.16;

// ── движок: колонки по самому длинному пути, узлы по слотам колонки, ортогональные связи со стрелками ──
// nodes: [{ id, col?, name, note?, items?, owner?, style: 'pill'|'card', kind?: 'start'|'end'|'bad'|'hub' }]
// edges: [{ from, to, tag?, text?, kind?: 'solid'|'dashed'|'muted', main? }]
// opt: { heads?: [строки], gap?, arrows? = true }
function flow(box, nodesIn, edgesIn, opt = {}) {
  const nodes = nodesIn.map(n => ({ ...n })), edges = edgesIn.map(e => ({ ...e }));
  const byId = new Map(nodes.map(n => [n.id, n]));
  edges.forEach(e => ['from', 'to'].forEach(k => { if (!byId.has(e[k])) throw new Error(`схема: связь ссылается на неизвестный узел «${e[k]}»`); }));

  // обратные связи — те, что ведут к предку при обходе в глубину от узлов без входящих
  const out = new Map(nodes.map(n => [n.id, []]));
  edges.forEach(e => out.get(e.from).push(e));
  const state = new Map(), visit = id => {
    state.set(id, 1);
    out.get(id).forEach(e => { const s = state.get(e.to); if (s === 1) e.back = true; else if (!s) visit(e.to); });
    state.set(id, 2);
  };
  const hasIn = new Set(edges.map(e => e.to));
  nodes.filter(n => !hasIn.has(n.id)).forEach(n => { if (!state.get(n.id)) visit(n.id); });
  nodes.forEach(n => { if (!state.get(n.id)) visit(n.id); });
  // колонка: явная или самый длинный путь по прямым связям
  nodes.forEach(n => { n.c = Number.isInteger(n.col) ? n.col : 0; });
  for (let it = 0; it < nodes.length; it++) edges.forEach(e => {
    const a = byId.get(e.from), b = byId.get(e.to);
    if (!e.back && !Number.isInteger(b.col) && b.c < a.c + 1) b.c = a.c + 1;
  });
  edges.forEach(e => { if (byId.get(e.to).c <= byId.get(e.from).c) e.back = true; });

  const nc = Math.max(...nodes.map(n => n.c)) + 1, gap = opt.gap ?? 1.5;
  const { x, y, w, h } = box, cw = (w - gap * (nc - 1)) / nc, colX = c => x + c * (cw + gap);
  const headH = opt.heads ? 0.42 : 0, backs = edges.filter(e => byId.get(e.to).c < byId.get(e.from).c), backH = backs.length ? 0.3 + 0.34 * backs.length : 0;

  // размеры узлов
  nodes.forEach(n => {
    if (n.style === 'pill') {
      n.pt = 11;
      n.w = Math.min(cw, Math.max(1.2, tw(n.name, n.pt, true) * 1.12 + 0.5));
      n.h = Math.max(0.44, wrap([{ t: n.name, b: true }], n.pt, n.w - 0.3) * lh(n.pt) + 0.18);
      n.noteH = n.note ? 0.06 + wrap([{ t: n.note }], 9.5, cw) * lh(9.5) : 0;
      n.block = n.h + n.noteH;
    } else {
      const iw = cw - 2 * PAD;
      n.ownerH = n.owner ? lh(9) + 0.04 : 0;
      n.h = 2 * PAD + n.ownerH + stack(0, 0, iw, n, { name: NAME, item: ITEM, measure: true }).h;
      n.w = cw; n.block = n.h;
    }
  });

  // по колонкам: порядок по барицентру предшественников, узлы в центрах равных слотов
  const top = y + headH, avail = h - headH - backH;
  for (let c = 0; c < nc; c++) {
    const col = nodes.filter(n => n.c === c), k = col.length;
    if (c > 0) {
      const key = new Map(col.map((n, i) => {
        const pr = edges.filter(e => !e.back && e.to === n.id).map(e => byId.get(e.from)).filter(p => p.cy != null);
        return [n, pr.length ? pr.reduce((s, p) => s + p.cy, 0) / pr.length : top + (i + 0.5) * avail / k];
      }));
      col.sort((p, q) => key.get(p) - key.get(q));
    }
    const sum = col.reduce((s, n) => s + n.block, 0);
    if (sum + 0.2 * (k - 1) > avail + 0.01) console.warn(`схема: колонка ${c + 1} выше бокса на ${(sum + 0.2 * (k - 1) - avail).toFixed(2)}″`);
    const slot = avail / k, fits = col.every(n => n.block <= slot - 0.12);
    let yy = top + Math.max(0, (avail - sum - 0.2 * (k - 1)) / 2);
    col.forEach((n, i) => {
      n.x = colX(c) + (cw - n.w) / 2;
      n.y = fits ? top + slot * i + (n.style === 'pill' ? slot / 2 - n.h / 2 : (slot - n.block) / 2) : yy;   // у пилюли по центру слота сама пилюля, подпись под ней
      yy += n.block + 0.2;
      n.cy = n.y + n.h / 2;
    });
  }

  const bottom = Math.max(...nodes.map(n => n.y + n.block));
  const hits = (x1, x2, yy, skip = []) => nodes.some(n => !skip.includes(n) && yy > n.y - 0.06 && yy < n.y + n.block + 0.06 && Math.max(x1, x2) > n.x - 0.02 && Math.min(x1, x2) < n.x + n.w + 0.02);
  const vhits = (xx, y1, y2, skip = []) => nodes.some(n => !skip.includes(n) && xx > n.x - 0.02 && xx < n.x + n.w + 0.02 && Math.max(y1, y2) > n.y - 0.02 && Math.min(y1, y2) < n.y + n.block + 0.02);
  const style = e => (e.main ? { color: C.accent, lw: 2.25 } : tone(e.kind));
  const ink = e => (e.main || !e.kind || e.kind === 'solid' ? C.accent : C.axis);
  const skey = e => (e.main ? 'main' : e.kind || 'solid');
  const arrows = opt.arrows !== false;
  edges.forEach(e => {
    const a = byId.get(e.from), b = byId.get(e.to);
    e.a = a; e.b = b;
    e.type = b.c > a.c ? 'fwd' : b.c === a.c && !nodes.some(n => n !== a && n !== b && n.c === a.c && (n.cy - a.cy) * (n.cy - b.cy) < 0) ? 'same' : 'back';
  });

  // порты прямых связей: правая сторона источника, левая — цели; связи одного стиля к одной стороне делят порт (ствол),
  // порт стремится к высоте другого конца, порты стороны разводятся не ближе 0,24″ (у пилюли — 0,1″)
  const fwd = edges.filter(e => e.type === 'fwd'), groups = new Map();
  fwd.forEach(e => {
    [['r', e.a, e.b], ['l', e.b, e.a]].forEach(([sd, n, o]) => {
      const k = `${n.id}:${sd}`;
      if (!groups.has(k)) groups.set(k, new Map());
      const g = groups.get(k);
      if (!g.has(skey(e))) g.set(skey(e), { edges: [], others: [] });
      g.get(skey(e)).edges.push(e); g.get(skey(e)).others.push(o);
    });
  });
  const solo = e => groups.get(`${e.a.id}:r`).get(skey(e)).edges.length === 1 && groups.get(`${e.b.id}:l`).get(skey(e)).edges.length === 1;
  const range = n => (n.style === 'pill' ? [n.cy - 0.1, n.cy + 0.1, 0.1] : [n.y + 0.16, n.y + n.h - 0.16, 0.24]);
  for (const [k, g] of groups) {
    const sd = k.endsWith(':r') ? 'r' : 'l', n = byId.get(k.slice(0, -2)), [lo, hi, gp] = range(n), list = [...g.values()];
    list.forEach(G => {
      if (n.style === 'pill' && list.length === 1) { G.y = n.cy; return; }
      const e = G.edges[0];
      if (G.edges.length === 1 && solo(e)) {   // одиночная связь: общая высота в пересечении диапазонов обоих концов
        const [l2, h2] = range(sd === 'r' ? e.b : e.a), mid = (e.a.cy + e.b.cy) / 2;
        G.y = Math.min(Math.max(mid, Math.max(lo, l2)), Math.min(hi, h2));
        if (Math.max(lo, l2) > Math.min(hi, h2)) G.y = Math.min(Math.max(G.others[0].cy, lo), hi);
      } else G.y = Math.min(Math.max(G.others.reduce((s, o) => s + o.cy, 0) / G.others.length, lo), hi);
    });
    list.sort((p, q) => p.y - q.y);
    for (let i = 1; i < list.length; i++) list[i].y = Math.max(list[i].y, list[i - 1].y + gp);
    const over = list.length ? list[list.length - 1].y - hi : 0;
    if (over > 0) list.forEach(G => { G.y -= over; });
    if (list.length && list[0].y < lo) list.forEach((G, i) => { G.y = list.length > 1 ? lo + (hi - lo) * i / (list.length - 1) : (lo + hi) / 2; });
    list.forEach(G => G.edges.forEach(e => { e[sd === 'r' ? 'y1' : 'y2'] = G.y; e[sd === 'r' ? 'gS' : 'gT'] = G; }));
  }

  // мелкая ступенька (< 0,15″) — артефакт портов: подтягиваем порт цели (или источника) к высоте другого конца
  const sideOf = (n, sd) => [...(groups.get(`${n.id}:${sd}`) || new Map()).values()];
  const canMove = (n, sd, G, v) => { const [lo, hi, gp] = range(n); return v >= lo - 1e-6 && v <= hi + 1e-6 && sideOf(n, sd).every(o => o === G || Math.abs(o.y - v) >= gp - 1e-6); };
  fwd.forEach(e => {
    const d = Math.abs(e.gS.y - e.gT.y);
    if (d < 0.005 || d >= 0.15) return;
    if (canMove(e.b, 'l', e.gT, e.gS.y)) e.gT.y = e.gS.y; else if (canMove(e.a, 'r', e.gS, e.gT.y)) e.gS.y = e.gT.y;
  });
  fwd.forEach(e => { e.y1 = e.gS.y; e.y2 = e.gT.y; });

  // вертикали в зазоре: у каждой группы своя x, у цели — справа налево, у источника — слева направо
  const slots = new Map();
  const slotX = (c, G, nearTarget) => {
    const k = `${c}:${nearTarget ? 't' : 's'}`;
    if (!slots.has(k)) slots.set(k, new Map());
    const m = slots.get(k);
    if (!m.has(G)) m.set(G, nearTarget ? colX(c) - BEND - 0.16 * m.size : colX(c) + cw + BEND + 0.16 * m.size);
    return m.get(G);
  };
  // свободная высота для горизонтали через промежуточные колонки: ближайшая к желаемой
  const corridor = (c1, c2, want) => {
    const cand = [want];
    for (let c = c1; c <= c2; c++) nodes.filter(n => n.c === c).forEach(n => cand.push(n.y - 0.2, n.y + n.block + 0.2));
    return cand.filter(v => v > top && v < bottom + 0.3).sort((p, q) => Math.abs(p - want) - Math.abs(q - want))
      .find(v => !hits(colX(c1), colX(c2) + cw, v)) ?? bottom + 0.2;
  };

  const segs = [], marks = [], labels = [], lineV = [], lineH = [];
  const H_ = (x1, x2, yy, st) => { if (Math.abs(x2 - x1) < 0.005) return; segs.push(hline(Math.min(x1, x2), Math.max(x1, x2), yy, st)); lineH.push([Math.min(x1, x2), Math.max(x1, x2), yy]); };
  const V_ = (xx, y1, y2, st) => { if (Math.abs(y2 - y1) < 0.005) return; segs.push(vline(xx, Math.min(y1, y2), Math.max(y1, y2), st)); lineV.push([xx, Math.min(y1, y2), Math.max(y1, y2)]); };
  const put = (e, x1, x2, yy, below = false) => { if (e.tag || e.text) labels.push({ e, x1, x2, yy, below }); };
  const dot = (px, py, e) => marks.push(L.oval(px, py, 0.1, { fill: ink(e) }));
  const end = (px, py, deg, e) => marks.push(arrows ? head(px, py, deg, ink(e)) : L.oval(px, py, 0.1, { fill: ink(e) }));
  const AR = arrows ? 0.08 : 0;

  fwd.forEach(e => {
    const { a, b } = e, st = style(e), x1 = a.x + a.w, x2 = b.x, y1 = e.y1, y2 = e.y2, xe = x2 - AR;
    const fanOut = e.gS.edges.length > 1, fanIn = e.gT.edges.length > 1;
    if (Math.abs(y1 - y2) < 0.01 && !hits(x1, x2, y1, [a, b])) {
      H_(x1, xe, y1, st); put(e, x1, x2, y1);
    } else {
      const span1 = b.c === a.c + 1;
      let nearS = span1 ? fanOut && !fanIn : null;
      if (!span1) {
        if (!fanOut && !hits(x1, colX(b.c) - BEND, y1, [a, b])) nearS = false;
        else if (!hits(colX(a.c) + cw + BEND, x2, y2, [a, b])) nearS = true;
      }
      if (nearS !== null) {
        const xm = nearS ? slotX(a.c, e.gS, false) : slotX(b.c, e.gT, true);
        H_(x1, xm, y1, st); V_(xm, y1, y2, st); H_(xm, xe, y2, st);
        if (nearS) put(e, xm, x2, y2); else put(e, x1, xm, y1);
      } else {                                                         // через промежуточные колонки по коридору
        const xs = slotX(a.c, e.gS, false), xt = slotX(b.c, e.gT, true), yc = corridor(a.c + 1, b.c - 1, (y1 + y2) / 2);
        H_(x1, xs, y1, st); V_(xs, y1, yc, st); H_(xs, xt, yc, st); V_(xt, yc, y2, st); H_(xt, xe, y2, st);
        put(e, xs, xt, yc);
      }
    }
    dot(x1, y1, e); end(x2, y2, 0, e);
  });
  // связь внутри колонки: вертикаль от нижней кромки к верхней (или наоборот)
  edges.filter(e => e.type === 'same').forEach(e => {
    const { a, b } = e, st = style(e), down = b.cy > a.cy, xx = a.x + a.w / 2;
    const ya = down ? a.y + a.block : a.y, yb = down ? b.y : b.y + b.block;
    V_(xx, ya, down ? yb - AR : yb + AR, st); dot(xx, ya, e); end(xx, yb, down ? 90 : 270, e);
    if (e.tag || e.text) { const lw = Math.min(2.2, cw / 2 - 0.15), lb = edgeLabel(e, lw); labels.push({ fixed: true, x: xx + 0.14, y: (ya + yb) / 2 - lb.h / 2, w: lw, h: lb.h, lb, al: 'left' }); }
  });
  // обратные связи: из нижней кромки вниз под схему, по дорожке к цели и вверх в её нижнюю кромку;
  // если под узлом другой узел — через зазор колонки сбоку
  edges.filter(e => e.type === 'back').forEach((e, i) => {
    const { a, b } = e, st = style(e), ly = bottom + 0.24 + 0.34 * i;
    const sa = !vhits(a.x + a.w / 2, a.y + a.block, ly, [a]), sb = !vhits(b.x + b.w / 2, b.y + b.block, ly, [b]);
    const xa = sa ? a.x + a.w / 2 + 0.12 * i : a.x + a.w + 0.18 + 0.12 * i, xb = sb ? b.x + b.w / 2 - 0.12 * i : Math.max(x + 0.02, b.x - 0.18 - 0.12 * i);
    if (sa) { V_(xa, a.y + a.block + 0.1, ly, st); dot(xa, a.y + a.block + 0.1, e); }
    else { H_(a.x + a.w, xa, a.cy, st); V_(xa, a.cy, ly, st); dot(a.x + a.w, a.cy, e); }
    H_(xb, xa, ly, st);
    if (sb) { V_(xb, ly, b.y + b.block + 0.1 + AR, st); end(xb, b.y + b.block + 0.1, 270, e); }
    else { V_(xb, ly, b.cy, st); H_(xb, b.x - AR, b.cy, st); end(b.x, b.cy, 0, e); }
    put(e, Math.min(xa, xb), Math.max(xa, xb), ly, true);
  });

  // подписи: самый широкий свободный от чужих вертикалей отрезок над линией (под линией — у обратных связей)
  const placed = labels.map(l => {
    if (l.fixed) return l;
    let lw = Math.max(0.6, l.x2 - l.x1 - 0.16), lb = edgeLabel(l.e, lw, l.below), lx = (l.x1 + l.x2) / 2 - lw / 2;
    for (let it = 0; it < 2; it++) {
      const yt = l.below ? l.yy + 0.05 : l.yy - 0.05 - lb.h, yb = yt + lb.h;
      const cuts = lineV.filter(([xx, v1, v2]) => xx > l.x1 + 0.02 && xx < l.x2 - 0.02 && v2 > yt && v1 < yb).map(v => v[0]).sort((p, q) => p - q);
      const pts = [l.x1, ...cuts, l.x2];
      let best = [l.x1, l.x2], bw = -1;
      for (let i = 1; i < pts.length; i++) if (pts[i] - pts[i - 1] > bw) { bw = pts[i] - pts[i - 1]; best = [pts[i - 1], pts[i]]; }
      lw = Math.max(0.6, best[1] - best[0] - 0.16); lx = (best[0] + best[1]) / 2 - lw / 2; lb = edgeLabel(l.e, lw, l.below);
    }
    // над линией тесно (чужая горизонталь ближе 0,08″) — подпись уходит под линию, если там свободно
    const crowd = below => {
      const yt = below ? l.yy + 0.05 : l.yy - 0.05 - lb.h, yb = yt + lb.h;
      return lineH.some(([h1, h2, yy]) => Math.abs(yy - l.yy) > 0.01 && yy > yt - 0.08 && yy < yb + 0.08 && h2 > lx && h1 < lx + lw)
        || nodes.some(n => n.x < lx + lw && n.x + n.w > lx && n.y < yb && n.y + n.block > yt);
    };
    if (!l.below && crowd(false) && !crowd(true)) l.below = true;
    return { x: lx, y: l.below ? l.yy + 0.05 : l.yy - 0.05 - lb.h, w: lw, h: lb.h, lb, al: 'center', below: l.below };
  });

  const els = [...segs];
  if (opt.heads) opt.heads.slice(0, nc).forEach((t, c) => els.push(text(colX(c), y, cw, 0.28, String(t).toUpperCase(), { size: 9.5, bold: true, color: C.muted, valign: 'middle' })));
  nodes.forEach(n => {
    if (n.style === 'pill') {
      const start = n.kind === 'start', end_ = n.kind === 'end', bad = n.kind === 'bad';
      els.push(start ? rect(n.x, n.y, n.w, n.h, { r: n.h / 2, fill: C.accent })
        : { ...card(n.x, n.y, n.w, n.h, { r: n.h / 2, hub: end_ }), ...(bad ? { line: C.axis, lw: 1, dash: true } : end_ ? { lw: 1.5 } : {}) });
      els.push(text(n.x + 0.15, n.y, n.w - 0.3, n.h, n.name, { size: n.pt, bold: true, color: start ? C.onAccent : bad ? C.muted : end_ ? C.accentInk : C.ink, align: 'center', valign: 'middle', ls: 1.05 }));
      if (n.note) els.push(text(colX(n.c), n.y + n.h + 0.06, cw, n.noteH - 0.04, n.note, { size: 9.5, color: C.muted, align: 'center', ls: 1.05 }));
      return;
    }
    els.push(card(n.x, n.y, n.w, n.h, { hub: n.kind === 'hub' }));
    let yy = n.y + PAD;
    if (n.owner) { els.push(text(n.x + PAD, yy, n.w - 2 * PAD, lh(9), String(n.owner).toUpperCase(), { size: 9, bold: true, color: C.accentInk })); yy += n.ownerH; }
    els.push(...stack(n.x + PAD, yy, n.w - 2 * PAD, n, { name: NAME, item: ITEM, color: n.kind === 'hub' ? C.accentInk : C.ink }).els);
  });
  els.push(...marks);
  placed.forEach(l => els.push(text(l.x, l.y, l.w, l.h, l.lb.runs, { size: l.lb.pt, align: l.al, valign: l.below ? 'top' : 'bottom', ls: 1.05 })));
  return els;
}

// Статусная модель. Вопрос: «через какие статусы проходит полис и что их меняет?»
// data: { states: [{ id, name, note?, kind?: 'start'|'end'|'bad' }], transitions: [{ from, to, label? }] }
// Статусы пилюлями: start — акцент, end — контур акцента, bad — пунктир и приглушённый текст. Переходы со стрелками,
// подпись — событие перехода. Возвраты к прежнему статусу идут под схемой. opt.gap — зазор между колонками.
function stateMachine(box, data, opt = {}) {
  return flow(box, data.states.map(s => ({ ...s, style: 'pill' })),
    data.transitions.map(t => ({ from: t.from, to: t.to, text: t.label, kind: t.kind })), { gap: opt.gap ?? 1.3 });
}

// Зависимости инициатив по волнам. Вопрос: «что нужно сделать раньше, чтобы запустить следующее?»
// data: { waves: [строки], items: [{ id, wave, name, owner?, note? }], deps: [{ from, to, kind? }] }
// wave — номер колонки с нуля или название волны из waves. Стрелка from → to: «from нужно до to»; dashed — желательная связь.
function dependencyGraph(box, data, opt = {}) {
  const col = it => (typeof it.wave === 'number' ? it.wave : data.waves.indexOf(it.wave));
  data.items.forEach(it => { if (col(it) < 0) throw new Error(`dependencyGraph: у «${it.name}» нет волны «${it.wave}»`); });
  return flow(box, data.items.map(it => ({ id: it.id, col: col(it), name: it.name, owner: it.owner, note: it.note, style: 'card' })),
    data.deps.map(d => ({ from: d.from, to: d.to, kind: d.kind || 'muted', text: d.text })), { heads: data.waves, gap: opt.gap ?? 1.15 });
}

// Потоки данных. Вопрос: «откуда приходят данные, где собираются и кому уходят?»
// data: { sources: [{ id, name, note? }], core: { id, name, items? }, consumers: [{ id, name, note? }],
//         flows: [{ from, to, tag?, text?, kind? }], heads?: [3 строки] }
// Ядро — карточка с рамкой акцента. tag — частота или способ («ежедневно», «онлайн»), text — что передаётся.
function dataFlow(box, data, opt = {}) {
  const nodes = [
    ...data.sources.map(s => ({ ...s, col: 0, style: 'card' })),
    { ...data.core, col: 1, style: 'card', kind: 'hub' },
    ...data.consumers.map(s => ({ ...s, col: 2, style: 'card' })),
  ];
  return flow(box, nodes, data.flows, { heads: data.heads || ['Источники', 'Ядро', 'Потребители'], gap: opt.gap ?? 2.05 });
}

// Цепочка влияния. Вопрос: «через какие метрики инициатива даёт эффект?»
// data: { cols: [3–4 строки], nodes: [{ id, col, name, note? }], links: [{ from, to, main?, text? }] }
// main: true — главная цепочка: связь акцентом, её узлы с рамкой акцента; остальные связи тонкие.
function impactChain(box, data, opt = {}) {
  const onMain = new Set(data.links.filter(l => l.main).flatMap(l => [l.from, l.to]));
  return flow(box, data.nodes.map(n => ({ ...n, style: 'card', kind: onMain.has(n.id) ? 'hub' : undefined })),
    data.links.map(l => ({ from: l.from, to: l.to, main: !!l.main, kind: l.main ? 'solid' : 'muted', text: l.text })),
    { heads: data.cols, gap: opt.gap ?? 1.25 });
}

module.exports = { stateMachine, dependencyGraph, dataFlow, impactChain };
