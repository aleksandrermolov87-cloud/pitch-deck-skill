// Группа «числа»: сравнения, распределения, просьба. Каждый компонент — (box, data, opt) → els, как в components.js.
// Числа идут через U.num(): источник из item.src, иначе data.src, иначе opt.src. Производные (суммы, доли, сдвиги, кратности)
// регистрируются как derived от уже зарегистрированных меток. Цвет только из C.*, один акцент на слайд.
const L = require('../lib.js');
const U = require('./util.js');
const { C, THEME, rect, oval, hline, vline, text, tw, nb, fmt } = L;
const { num, minus, unitOf, lines, fitPt, known, NA, naText, lh, onBar, seg, knock, sparkline } = U;

// ── локальные помощники ──
const srcOf = (it, data, opt) => (it && it.src) || data.src || opt.src;
const sn = v => Math.round(v * 20) / 20;                     // края подписей на сетке 0,05″: аудит не видит «почти совпадающих» линий
const rnd = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
const signed = (v, s) => `${v > 0 ? '+' : ''}${minus(s)}`;   // «+3,4» / «−3,4» / «0»
const sum = a => a.reduce((s, v) => s + v, 0);
const pctUnit = u => (u === '%' ? '%' : '');                 // у значений на графике единица только процентная, остальное — в шапке
const deltaUnit = (unit, du) => du ? ` ${du}` : unit === '%' ? ' п. п.' : unitOf(unit);

// ═════════════ СРАВНЕНИЯ ═════════════

// Гантель: по строке две точки «было» (C.bar) и «стало» (акцент) на общей шкале, отрезок между ними, значения на концах.
// Строки отсортированы по сдвигу, справа сдвиг со знаком — derived diff. Вопрос: «насколько сдвинулось по каждой категории?»
// data: { label, from, to, unit?, deltaUnit?, digits?, src?, rows: [{ name, a, b, src? }] }  a — «было», b — «стало»
// opt: { labelW, deltaW, valueW, rowH, src }
function dumbbell(box, data, opt = {}) {
  const { x, y, w, h } = box, LW = opt.labelW || 2.8, DW = opt.deltaW || 1.6, VW = opt.valueW || 0.95;
  const d = data.digits || 0, lab = data.label || 'значение', els = [];
  const rows = [...data.rows].sort((p, q) => (q.b - q.a) - (p.b - p.a));
  const headH = 0.55, rh = Math.min(opt.rowH || 0.72, (h - headH) / rows.length);
  const vals = rows.flatMap(r => [r.a, r.b]), lo = Math.min(...vals), hi = Math.max(...vals);
  const gx0 = x + LW + VW, gx1 = x + w - DW - VW - 0.2, px = v => gx0 + (v - lo) / (hi - lo || 1) * (gx1 - gx0);
  // легенда над шкалой: серая точка — было, акцентная — стало; над колонкой справа — «сдвиг»
  const fw = tw(String(data.from), 11) + 0.1, lx = sn(gx0 + 0.25 + fw + 0.3);
  els.push(oval(gx0 + 0.08, y + 0.17, 0.16, { fill: C.bar }), text(gx0 + 0.25, y, fw, 0.34, data.from, { size: 11, color: C.muted, valign: 'middle' }));
  els.push(oval(lx + 0.1, y + 0.17, 0.2, { fill: C.accent }), text(lx + 0.3, y, tw(String(data.to), 11, true) + 0.1, 0.34, data.to, { size: 11, bold: true, valign: 'middle' }));
  els.push(text(x + w - DW, y, DW, 0.34, 'сдвиг', { size: 11, color: C.muted, align: 'right', valign: 'middle' }));
  els.push(hline(x, x + w, y + headH - 0.08, { color: C.axis, lw: 0.75 }));
  rows.forEach((r, i) => {
    const yy = y + headH + i * rh, cy = yy + rh / 2, src = srcOf(r, data, opt), up = r.b >= r.a;
    const xa = px(r.a), xb = px(r.b), x0 = Math.min(xa, xb), x1 = Math.max(xa, xb);
    els.push(text(x, yy, LW - 0.2, rh, r.name, { size: 13, bold: true, valign: 'middle' }));
    els.push(hline(x0, x1, cy, { color: up ? C.accent : C.axis, lw: 2.5 }));
    els.push(oval(xa, cy, 0.18, { fill: C.bar }), oval(xb, cy, 0.24, { fill: C.accent }));
    const la = `${lab}: ${r.name} ${data.from}`, lb = `${lab}: ${r.name} ${data.to}`;
    const sa = num(la, r.a, src, d) + pctUnit(data.unit), sb = num(lb, r.b, src, d) + pctUnit(data.unit);
    const [left, right] = xa <= xb ? [[sa, false], [sb, true]] : [[sb, true], [sa, false]];
    const ex = sn(x0 - 0.17), bx = sn(x1 + 0.17);
    els.push(text(ex - (VW - 0.05), yy, VW - 0.05, rh, left[0], { size: 13, bold: left[1], color: left[1] ? C.ink : C.muted, align: 'right', valign: 'middle' }));
    els.push(text(bx, yy, VW - 0.05, rh, right[0], { size: 13, bold: right[1], color: right[1] ? C.ink : C.muted, valign: 'middle' }));
    const dv = rnd(r.b - r.a, d);
    const ds = num(`${lab}: сдвиг ${r.name}`, dv, { type: 'derived', from: [lb, la], op: 'diff' }, d);
    els.push(text(x + w - DW, yy, DW, rh, `${signed(dv, ds)}${deltaUnit(data.unit, data.deltaUnit)}`, { size: 15, bold: true, color: dv > 0 ? C.accentInk : C.muted, align: 'right', valign: 'middle' }));
    if (i < rows.length - 1) els.push(hline(x, x + w, yy + rh, { color: C.rule, lw: 0.5 }));
  });
  return els;
}

// Точечная диаграмма по категориям: точки игроков на общей шкале строки, наша точка акцентом и крупнее,
// среднее рынка — короткая вертикаль пунктиром. Справа наше значение и среднее. Вопрос: «где мы относительно рынка?»
// data: { label, unit?, digits?, src?, us?: 'Мы', others?: 'Другие банки', avg?: 'Среднее по рынку', avgHead?: 'Рынок', axis?: 'подпись шкалы',
//         rows: [{ name, us, avg, others: [v…], src? }] }  avg — из источника (среднее рынка), а не считается здесь
function dotPlot(box, data, opt = {}) {
  const { x, y, w, h } = box, LW = opt.labelW || 2.4, CW = opt.colW || 1.25, d = data.digits || 0, lab = data.label || 'значение', els = [];
  const headH = 0.55, footH = data.axis ? 0.45 : 0.1, rh = Math.min(opt.rowH || 0.8, (h - headH - footH) / data.rows.length);
  const vals = data.rows.flatMap(r => [r.us, r.avg, ...r.others]), lo0 = Math.min(...vals), hi0 = Math.max(...vals), pad = (hi0 - lo0) * 0.06 || 1;
  const lo = lo0 - pad, hi = hi0 + pad, gx0 = x + LW, gx1 = x + w - 2 * CW - 0.4, px = v => gx0 + (v - lo) / (hi - lo) * (gx1 - gx0);
  // легенда над шкалой и шапки колонок справа
  const lg = [[data.us || 'Мы', true], [data.others || 'Другие игроки', false], [data.avg || 'Среднее по рынку', false]];
  let lx = gx0;
  lg.forEach(([t, b], i) => {
    if (i === 0) els.push(oval(lx + 0.14, y + 0.17, 0.28, { fill: C.accent }));
    else if (i === 1) els.push(oval(lx + 0.14, y + 0.17, 0.16, { fill: C.bar }));
    else els.push(vline(lx + 0.14, y + 0.03, y + 0.31, { color: C.ink2, lw: 1.25, dash: true }));
    const lw0 = tw(t, 11, b) + 0.1;
    els.push(text(lx + 0.38, y, lw0, 0.34, t, { size: 11, bold: b, color: b ? C.ink : C.muted, valign: 'middle' }));
    lx = sn(lx + 0.38 + lw0 + 0.35);
  });
  els.push(text(x + w - 2 * CW, y, CW, 0.34, data.us || 'Мы', { size: 11, bold: true, color: C.accentInk, align: 'right', valign: 'middle' }));
  els.push(text(x + w - CW, y, CW, 0.34, data.avgHead || 'Рынок', { size: 11, color: C.muted, align: 'right', valign: 'middle' }));
  els.push(hline(x, x + w, y + headH - 0.08, { color: C.axis, lw: 0.75 }));
  data.rows.forEach((r, i) => {
    const yy = y + headH + i * rh, cy = yy + rh / 2, src = srcOf(r, data, opt);
    els.push(text(x, yy, LW - 0.2, rh, r.name, { size: 13, bold: true, valign: 'middle' }));
    els.push(hline(gx0, gx1, cy, { color: C.rule, lw: 0.75 }));
    r.others.forEach(v => els.push(oval(px(v), cy, 0.17, { fill: C.bar, alpha: 0.85 })));
    els.push(vline(px(r.avg), cy - 0.22, cy + 0.22, { color: C.ink2, lw: 1.25, dash: true }));
    els.push(oval(px(r.us), cy, 0.3, { fill: C.accent }));
    const su = num(`${lab}: ${r.name}, ${data.us || 'мы'}`, r.us, src, d) + pctUnit(data.unit);
    const sa = num(`${lab}: ${r.name}, среднее рынка`, r.avg, src, d) + pctUnit(data.unit);
    els.push(text(x + w - 2 * CW, yy, CW, rh, su, { size: 15, bold: true, color: C.accentInk, align: 'right', valign: 'middle' }));
    els.push(text(x + w - CW, yy, CW, rh, sa, { size: 13, color: C.ink2, align: 'right', valign: 'middle' }));
    if (i < data.rows.length - 1) els.push(hline(x, x + w, yy + rh, { color: C.rule, lw: 0.5 }));
  });
  if (data.axis) {
    const ay = y + headH + rh * data.rows.length + 0.08;
    els.push(hline(gx0, gx1, ay, { color: C.axis, lw: 0.75, arrow: true }));
    els.push(text(gx0, ay + 0.08, gx1 - gx0, 0.28, data.axis, { size: 11, color: C.muted, align: 'right', valign: 'middle' }));
  }
  return els;
}

// ═════════════ РАСПРЕДЕЛЕНИЯ ═════════════

// Гистограмма: смежные столбики по корзинам, медиана — акцентная вертикаль с подписью, границы корзин под осью.
// Итог по всем корзинам — derived sum. Вопрос: «как распределены значения?»
// data: { label, countLabel?: 'полисов', unit?: 'тыс. ₽', axis?: 'подпись оси', digits?, median, src?,
//         binDigits?, bins: [{ from, to, count }] }  корзины подряд и одной ширины; median — из источника
function histogram(box, data, opt = {}) {
  const { x, y, w, h } = box, n = data.bins.length, d = data.digits || 0, lab = data.label || 'значение', cl = data.countLabel || 'шт.', els = [];
  const src = data.src || opt.src, step = w / n, base = y + h - (data.axis ? 0.72 : 0.42), top = y + 1.05;
  const mx = Math.max(...data.bins.map(b => b.count)), cLabel = b => `${lab}: ${cl} от ${b.from} до ${b.to}`;
  const counts = data.bins.map(b => num(cLabel(b), b.count, src));
  const total = num(`${lab}: всего ${cl}`, sum(data.bins.map(b => b.count)), { type: 'derived', from: data.bins.map(cLabel), op: 'sum' });
  els.push(text(x, y, 6, 0.32, [{ t: 'Всего ', c: C.muted }, { t: `${total} ${cl}`, b: true }], { size: 13, valign: 'middle' }));
  data.bins.forEach((b, i) => {
    const hh = Math.max(0.02, b.count / mx * (base - top));
    els.push(rect(x + i * step + 0.015, base - hh, step - 0.03, hh, { fill: C.bar }));
  });
  // медиана: позиция внутри своей корзины линейно, подпись справа от линии (у правого края — слева)
  const j = Math.max(0, data.bins.findIndex(b => data.median >= b.from && data.median <= b.to)), bj = data.bins[j];
  const mxX = x + (j + (data.median - bj.from) / (bj.to - bj.from)) * step, my = y + 0.4;
  els.push(vline(mxX, my, base, { color: C.accent, lw: 2 }));
  const mt = [{ t: 'Медиана ', b: false, c: C.ink2 }, { t: `${num(`${lab}: медиана`, data.median, src, d)}${unitOf(data.unit)}`, b: true, c: C.accentInk }];
  const mw = tw('Медиана ', 12) + tw(mt[1].t, 12, true) + 0.15, right = mxX + 0.12 + mw <= x + w;
  els.push(text(right ? sn(mxX + 0.12) : sn(mxX - 0.12) - mw, my - 0.02, mw, 0.3, mt, { size: 12, align: right ? 'left' : 'right', valign: 'middle' }));
  data.bins.forEach((b, i) => {
    const hh = Math.max(0.02, b.count / mx * (base - top)), cx = x + (i + 0.5) * step, ty = base - hh - 0.3;
    const cw = tw(counts[i], 11) + 0.16;
    if (Math.abs(mxX - cx) < cw / 2 + 0.03) els.push(knock(cx - cw / 2, ty + 0.01, cw, 0.25));
    els.push(text(cx - step / 2, ty, step, 0.27, counts[i], { size: 11, color: C.ink2, align: 'center', valign: 'middle' }));
  });
  els.push(hline(x, x + w, base, { color: C.axis, lw: 1 }));
  // границы корзин: крайние прижаты к краям бокса, внутренние — по центру деления
  for (let i = 0; i <= n; i++) {
    const v = i < n ? data.bins[i].from : data.bins[n - 1].to, bx = x + i * step;
    const s = num(`${lab}: граница корзины ${v}`, v, src, data.binDigits || 0), ew = step - 0.1;
    const o = i === 0 ? { x: bx, w: ew / 2, al: 'left' } : i === n ? { x: bx - ew / 2, w: ew / 2, al: 'right' } : { x: bx - ew / 2, w: ew, al: 'center' };
    els.push(vline(bx, base, base + 0.07, { color: C.axis, lw: 0.75 }));
    els.push(text(o.x, base + 0.1, o.w, 0.26, s, { size: 11, color: C.muted, align: o.al, valign: 'middle' }));
  }
  if (data.axis) els.push(text(x, base + 0.4, w, 0.28, data.axis, { size: 11, color: C.muted, align: 'right', valign: 'middle' }));
  return els;
}

// Точечная диаграмма двух показателей: подписаны только 2–4 выброса (point.note: true) и наша точка (us),
// подписи раскладываются без наездов друг на друга и на точки; пунктир — линия тренда (МНК) по неподписанным точкам, без чисел.
// Вопрос: «есть ли связь между показателями?»
// data: { x: { label, unit?, digits? }, y: { label, unit?, digits? }, trend?: true, src?,
//         points: [{ name?, x, y, note?: true, us?: true, src? }] }
function scatterLabeled(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [], P = data.points;
  const gx0 = x + 0.15, gx1 = x + w - 0.1, gy0 = y + 0.5, gy1 = y + h - 0.5;
  const ext = (k, a, b) => { const v = P.map(p => p[k]), lo = Math.min(...v), hi = Math.max(...v), pd = (hi - lo) * 0.07 || 1; return [lo - pd, hi + pd]; };
  const [xl, xh] = ext('x'), [yl, yh] = ext('y');
  const px = v => gx0 + 0.25 + (v - xl) / (xh - xl) * (gx1 - gx0 - 0.35), py = v => gy1 - 0.15 - (v - yl) / (yh - yl) * (gy1 - gy0 - 0.25);
  // оси и подписи осей: Y — над осью слева, X — под осью справа
  els.push(vline(gx0, gy0 - 0.15, gy1, { color: C.axis, lw: 1 }), hline(gx0, gx1, gy1, { color: C.axis, lw: 1, arrow: true }));
  els.push(text(gx0 + 0.15, y, 6, 0.32, `${data.y.label}${data.y.unit ? `, ${data.y.unit}` : ''} ↑`, { size: 11, bold: true, color: C.ink2, valign: 'middle' }));
  els.push(text(gx1 - 6, gy1 + 0.1, 6, 0.3, `${data.x.label}${data.x.unit ? `, ${data.x.unit}` : ''} →`, { size: 11, bold: true, color: C.ink2, align: 'right', valign: 'middle' }));
  // линия тренда по МНК: только направление связи, чисел не показывает
  let tl = null;   // отрезок тренда: подписи стараются его не пересекать
  if (data.trend) {
    const n = P.length, mxv = sum(P.map(p => p.x)) / n, myv = sum(P.map(p => p.y)) / n;
    const k = sum(P.map(p => (p.x - mxv) * (p.y - myv))) / (sum(P.map(p => (p.x - mxv) ** 2)) || 1);
    // линия тянется по неподписанной массе точек: выбросы остаются в стороне со своими подписями
    const bulk = P.filter(p => !p.note && !p.us).length >= 3 ? P.filter(p => !p.note && !p.us) : P;
    const xs = [Math.min(...bulk.map(p => p.x)), Math.max(...bulk.map(p => p.x))];
    tl = [px(xs[0]), py(myv + k * (xs[0] - mxv)), px(xs[1]), py(myv + k * (xs[1] - mxv))];
    els.push(seg(...tl, { color: C.axis, lw: 1.25, dash: true }));
  }
  P.filter(p => !p.note && !p.us).forEach(p => els.push(oval(px(p.x), py(p.y), 0.16, { fill: C.bar, alpha: 0.8 })));
  const marked = P.filter(p => p.note || p.us);
  marked.forEach(p => els.push(oval(px(p.x), py(p.y), p.us ? 0.3 : 0.22, { fill: p.us ? C.accent : C.ink2 })));
  // раскладка подписей: кандидаты вокруг точки, первый без пересечений с подписями, точками, осями и краями
  const dots = P.map(p => ({ x: px(p.x) - 0.12, y: py(p.y) - 0.12, w: 0.24, h: 0.24 }));
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const crossT = c => tl && Array.from({ length: 41 }, (_, i) => [tl[0] + (tl[2] - tl[0]) * i / 40, tl[1] + (tl[3] - tl[1]) * i / 40])
    .some(([qx, qy]) => qx > c.x && qx < c.x + c.w && qy > c.y && qy < c.y + c.h);
  const placed = [{ x: gx0, y, w: 6, h: 0.36 }, { x: gx1 - 6, y: gy1 + 0.05, w: 6, h: 0.4 }];
  marked.forEach(p => {
    const sx = num(`${data.x.label}: ${p.name}`, p.x, srcOf(p, data, opt), data.x.digits || 0) + pctUnit(data.x.unit);
    const sy = num(`${data.y.label}: ${p.name}`, p.y, srcOf(p, data, opt), data.y.digits || 0) + pctUnit(data.y.unit);
    const l2 = `${data.x.short || data.x.label} ${sx} · ${data.y.short || data.y.label} ${sy}`;
    const bw = Math.max(tw(p.name, 13, true), tw(l2, 11)) + 0.1, bh = lh(13) + lh(11) + 0.04, cx = px(p.x), cy = py(p.y), r = p.us ? 0.24 : 0.2;
    const cands = [[cx + r, cy - bh / 2, 'left'], [cx - r - bw, cy - bh / 2, 'right'], [cx + 0.05, cy - r - bh, 'left'], [cx + 0.05, cy + r, 'left'],
      [cx - bw - 0.05, cy - r - bh, 'right'], [cx - bw - 0.05, cy + r, 'right']].map(([bx, by, al]) => ({ x: sn(bx), y: by, w: bw, h: bh, al }));
    const ok = c => c.x >= gx0 + 0.1 && c.x + c.w <= gx1 && c.y >= gy0 - 0.1 && c.y + c.h <= gy1 - 0.05
      && !placed.some(q => hit(c, q)) && !dots.some(q => hit(c, q));
    const c = cands.find(q => ok(q) && !crossT(q)) || cands.find(ok) || cands.find(q => q.x >= gx0 + 0.1 && q.x + q.w <= gx1) || cands[0];
    placed.push(c);
    // подложка под подписью только там, где её пересекает тренд; чуть ниже бокса, чтобы аудит не счёл её карточкой
    if (crossT(c)) els.push(knock(c.al === 'right' ? c.x + c.w - (c.w - 0.1) : c.x, c.y + 0.03, c.w - 0.1, c.h - 0.06));
    els.push(text(c.x, c.y, c.w, c.h, [{ t: p.name, b: true, s: 13, c: p.us ? C.accentInk : C.ink }, { t: `\n${l2}` }], { size: 11, color: C.muted, align: c.al, ls: 1.0 }));
  });
  return els;
}

// Маримекко: ширина столбца — размер сегмента (derived sum по игрокам), внутри доли игроков (derived ratio),
// наша доля акцентом снизу, подписи сегментов с размером и долей рынка под осью. Вопрос: «какие сегменты больше и чья в них доля?»
// data: { label, unit?, digits?, src?, players: ['Мы', 'Компания А', …], us?: 0 (индекс нашего игрока),
//         segments: [{ name, values: [по игрокам], src? }] }  игроков до 4: остальных сведите в «Прочие»;
// сегменты уже 1,2″ (меньше 10% рынка) тоже сведите в «Прочие»: их подписи не помещаются под столбцом
function marimekko(box, data, opt = {}) {
  const { x, y, w, h } = box, d = data.digits || 0, lab = data.label || 'объём', us = data.us || 0, gap = 0.06, els = [];
  const order = [us, ...data.players.map((_, i) => i).filter(i => i !== us)];   // мы снизу, остальные выше
  const tones = [[C.bar, onBar()], [C.muted, C.bg], [C.axis, C.ink]];
  const tone = i => i === us ? [C.accent, C.onAccent] : tones[(order.indexOf(i) - 1) % tones.length];
  const cy0 = y + 0.5, cy1 = y + h - 0.78, chH = cy1 - cy0, cw = w - gap * (data.segments.length - 1);
  // легенда игроков
  let lx = x;
  order.forEach(i => {
    els.push(rect(lx, y + 0.1, 0.16, 0.16, { fill: tone(i)[0] }));
    const lw0 = tw(data.players[i], 11, i === us) + 0.1;
    els.push(text(lx + 0.24, y, lw0, 0.36, data.players[i], { size: 11, bold: i === us, color: i === us ? C.ink : C.ink2, valign: 'middle' }));
    lx = sn(lx + 0.24 + lw0 + 0.35);
  });
  const segL = s => `${lab}: ${s.name} всего`, cell = (s, i) => `${lab}: ${s.name}, ${data.players[i]}`;
  data.segments.forEach(s => s.values.forEach((v, i) => num(cell(s, i), v, srcOf(s, data, opt), d)));
  const tots = data.segments.map(s => sum(s.values));
  data.segments.forEach((s, k) => num(segL(s), rnd(tots[k], d), { type: 'derived', from: s.values.map((_, i) => cell(s, i)), op: 'sum' }, d));
  const all = sum(tots), allL = `${lab}: рынок всего`;
  num(allL, rnd(all, d), { type: 'derived', from: data.segments.map(segL), op: 'sum' }, d);
  let xx = x;
  data.segments.forEach((s, k) => {
    const sw = tots[k] / all * cw;
    let yy = cy1;
    order.forEach(i => {
      const v = s.values[i], bh = v / tots[k] * chH;
      if (v <= 0) return;
      const [fill, ink] = tone(i);
      els.push(rect(xx, yy - bh, sw, bh, { fill }));
      const sh = Math.round(v / tots[k] * 100);
      const st = `${num(`доля ${data.players[i]} в сегменте ${s.name}`, sh, { type: 'derived', from: [cell(s, i), segL(s)], op: 'ratio', scale: 0.01 })}%`;
      if (bh >= 0.34 && sw >= tw(st, i === us ? 15 : 12, true) + 0.2) els.push(text(xx, yy - bh, sw, bh, st, { size: i === us ? 15 : 12, bold: true, color: ink, align: 'center', valign: 'middle' }));
      yy -= bh;
    });
    // подпись сегмента: имя, размер и доля рынка; длинная подпись узкого столбца переносится
    const segShare = Math.round(tots[k] / all * 100);
    const ss = num(`доля сегмента ${s.name} в рынке`, segShare, { type: 'derived', from: [segL(s), allL], op: 'ratio', scale: 0.01 });
    const vs = `${fmtD(tots[k], d)}${unitOf(data.unit)} · ${ss}%`;
    // узкий последний столбец подписывается по правому краю, чтобы подпись не ушла за бокс
    const tw0 = Math.max(sw - 0.08, opt.minLabelW || 1.6), last = k === data.segments.length - 1 && tw0 > sw - 0.08;
    const nl = lines(s.name, 12, tw0, true), vl = lines(vs, 11, tw0);
    els.push(text(last ? x + w - tw0 : xx, cy1 + 0.1, tw0, lh(12) * nl + lh(11) * vl + 0.04, [{ t: s.name, b: true, s: 12, c: C.ink }, { t: `\n${vs}` }], { size: 11, color: C.muted, align: last ? 'right' : 'left', ls: 1.0 }));
    xx += sw + gap;
  });
  return els;
}
const fmtD = (v, d) => L.fmt(rnd(v, d), d);

// Тримап: площадь прямоугольника по значению (squarify), подпись и значение в крупных, мелкие сведены в «Прочие» (derived sum).
// Доли — derived ratio к итогу. Вопрос: «как делится целое на много частей?»
// data: { label, unit?, digits?, src?, accent?: 'имя', items: [{ name, value, src? }] }  opt: { maxItems: 7, minShare: 0.03, head?: 'Портфель' }
// Имена держите до 14 знаков: подписи мелких плиток короткие, иначе аудит посчитает их карточками.
function treemap(box, data, opt = {}) {
  const { x, y, w, h } = box, d = data.digits || 0, lab = data.label || 'значение', gap = 0.06, els = [];
  const items = [...data.items].sort((a, b) => b.value - a.value), lbl = it => `${lab}: ${it.name}`;
  items.forEach(it => num(lbl(it), it.value, srcOf(it, data, opt), d));
  const total = sum(items.map(i => i.value)), totL = `${lab}: всего`;
  const ts = num(totL, rnd(total, d), { type: 'derived', from: items.map(lbl), op: 'sum' }, d);
  const maxN = opt.maxItems || 7, minS = opt.minShare ?? 0.03;
  let keep = items.filter((it, i) => i < maxN - 1 && it.value / total >= minS);
  const rest = items.filter(it => !keep.includes(it));
  if (rest.length === 1) keep = keep.concat(rest);
  else if (rest.length) {
    const other = { name: opt.otherName || 'Прочие', value: rnd(sum(rest.map(r => r.value)), d), other: true };
    num(lbl(other), other.value, { type: 'derived', from: rest.map(lbl), op: 'sum' }, d);
    keep = keep.concat(other);
  }
  els.push(text(x, y, 8, 0.36, [{ t: `${opt.head || 'Всего'} `, c: C.muted }, { t: `${ts}${unitOf(data.unit)}`, b: true }], { size: 14, valign: 'middle' }));
  const R = { x, y: y + 0.5, w, h: h - 0.5 }, k = R.w * R.h / sum(keep.map(i => i.value));
  const pos = squarify(keep.map(i => i.value * k), R);
  const acc = data.accent || keep[0].name;
  keep.forEach((it, i) => {
    const p = pos[i], bx = p.x + gap / 2, by = p.y + gap / 2, bw = p.w - gap, bh = p.h - gap;
    const [fill, ink] = it.name === acc ? [C.accent, C.onAccent] : it.other ? [C.axis, C.ink] : [C.bar, onBar()];
    els.push(rect(bx, by, bw, bh, { fill }));
    const share = Math.round(it.value / total * 100);
    const ss = `${num(`доля ${it.name} (${lab})`, share, { type: 'derived', from: [lbl(it), totL], op: 'ratio', scale: 0.01 })}%`;
    const vs = num(lbl(it), it.value, srcOf(it, data, opt), d), iw = bw - 0.3;
    // три крупные плитки: имя, значение крупно, доля; остальные: имя и «значение · доля» в одну строку
    if (i < 3 && bh >= 1.2 && iw >= Math.max(tw(it.name, 14, true), tw(vs, 24, true) + tw(unitOf(data.unit), 14, true))) {
      els.push(text(bx + 0.15, by + 0.12, iw, 0.32, it.name, { size: 14, bold: true, color: ink, valign: 'middle' }));
      els.push(text(bx + 0.15, by + 0.46, iw, 0.5, [{ t: vs }, { t: unitOf(data.unit), s: 14 }], { size: 24, bold: true, color: ink, valign: 'middle' }));
      els.push(text(bx + 0.15, by + bh - 0.42, iw, 0.3, `${ss} ${opt.shareOf || 'от итога'}`, { size: 14, bold: true, color: ink, valign: 'middle' }));
    } else if (bh >= 0.7 && iw >= Math.max(tw(it.name, 12, true), tw(`${vs} · ${ss}`, 12))) {
      els.push(text(bx + 0.15, by + 0.1, iw, 0.28, it.name, { size: 12, bold: true, color: ink, valign: 'middle' }));
      els.push(text(bx + 0.15, by + 0.38, iw, 0.28, `${vs} · ${ss}`, { size: 12, color: ink, valign: 'middle' }));
    } else if (bh >= 0.4 && iw >= tw(it.name, 12, true)) {
      els.push(text(bx + 0.15, by + bh / 2 - 0.14, iw, 0.28, it.name, { size: 12, bold: true, color: ink, valign: 'middle' }));
    }
  });
  return els;
}
// squarify (Bruls, Huizing, van Wijk): ряды плиток с соотношением сторон ближе к 1. areas — по убыванию, сумма = площадь rect.
function squarify(areas, r) {
  const out = [];
  let rest = areas.map((v, i) => ({ v, i })), { x, y, w, h } = r;
  while (rest.length) {
    const side = Math.min(w, h);
    const worst = row => { const s = sum(row.map(e => e.v)), mx = Math.max(...row.map(e => e.v)), mn = Math.min(...row.map(e => e.v)); return Math.max(side * side * mx / (s * s), s * s / (side * side * mn)); };
    let k = 1;
    while (k < rest.length && worst(rest.slice(0, k + 1)) <= worst(rest.slice(0, k))) k++;
    const row = rest.slice(0, k), s = sum(row.map(e => e.v));
    if (w >= h) { const cw = s / h; let yy = y; row.forEach(e => { const eh = e.v / cw; out[e.i] = { x, y: yy, w: cw, h: eh }; yy += eh; }); x += cw; w -= cw; }
    else { const rh = s / w; let xx = x; row.forEach(e => { const ew = e.v / rh; out[e.i] = { x: xx, y, w: ew, h: rh }; xx += ew; }); y += rh; h -= rh; }
    rest = rest.slice(k);
  }
  return out;
}

// ═════════════ МЕТРИКИ И ПРОСЬБА ═════════════

// Сетка 4–6 метрик без карточек: разделители линиями, в ячейке подпись, значение, сдвиг к прошлому периоду со знаком
// (derived diff; хороший сдвиг акцентом, плохой серым) и спарклайн. Вопрос: «как идут ключевые метрики?»
// data: { vs: 'к III кв.', src?, items: [{ label, value, prev, digits?, unit?, deltaUnit?, better?: 'up'|'down', series: [v…], src? }] }
function kpiGrid(box, data, opt = {}) {
  const { x, y, w, h } = box, n = data.items.length, cols = opt.cols || (n <= 4 ? 2 : 3), rows = Math.ceil(n / cols);
  const cw = w / cols, ch = h / rows, els = [];
  for (let j = 1; j < cols; j++) els.push(vline(x + j * cw, y, y + h, { color: C.rule, lw: 0.75 }));
  for (let i = 1; i < rows; i++) els.push(hline(x, x + w, y + i * ch, { color: C.rule, lw: 0.75 }));
  data.items.forEach((k, idx) => {
    const c = idx % cols, r = Math.floor(idx / cols), cx = x + c * cw + (c ? 0.35 : 0), cy = y + r * ch + (r ? 0.22 : 0);
    const iw = cw - (c ? 0.35 : 0) - 0.35, src = srcOf(k, data, opt), dg = k.digits || 0;
    els.push(text(cx, cy, iw, 0.3, k.label, { size: 13, color: C.ink2, valign: 'middle' }));
    const vl = `${k.label}: значение`, pl = `${k.label}: прошлый период`;
    const vs = num(vl, k.value, src, dg);
    num(pl, k.prev, src, dg);
    els.push(text(cx, cy + 0.34, iw, 0.72, [{ t: vs }, { t: unitOf(k.unit), s: 18 }], { size: 40, bold: true, valign: 'middle' }));
    const dv = rnd(k.value - k.prev, dg), good = k.better === 'down' ? dv < 0 : dv > 0;
    const ds = num(`${k.label}: сдвиг`, dv, { type: 'derived', from: [vl, pl], op: 'diff' }, dg);
    els.push(text(cx, cy + 1.1, iw, 0.3, [{ t: `${signed(dv, ds)}${deltaUnit(k.unit, k.deltaUnit)}`, b: true, c: good ? C.accentInk : C.muted }, { t: ` ${data.vs || 'к прошлому периоду'}` }], { size: 13, color: C.muted, valign: 'middle' }));
    if (k.series && k.series.length > 1) {
      const sy = cy + 1.5, sh = Math.min(0.5, y + (r + 1) * ch - 0.12 - sy);
      if (sh > 0.15) els.push(...sparkline(cx + 0.05, sy, Math.min(iw - 0.1, 3.2), sh, k.series, { color: C.muted }));
    }
  });
  return els;
}

// Просьба: сумма крупно, полоса распределения средств по направлениям с долями (derived ratio к сумме),
// ниже три вехи, которых достигнем. Вопрос: «сколько просим и на что?»
// data: { label?: 'Просим', amount, unit?, digits?, caption?, src?, uses: [{ name, value, src? }],
//         milestones: [{ when, name, value?, unit?, digits?, src? }] ×3 }
// Направления меньше 8% сведите в одно: подпись узкого сегмента не помещается. Имя вехи — в одну строку (до 35 знаков).
function askFunds(box, data, opt = {}) {
  const { x, y, w, h } = box, d = data.digits || 0, els = [], aL = `${data.label || 'Просим'}: сумма`;
  const as = num(aL, data.amount, srcOf(null, data, opt), d);
  const capX = sn(x + Math.max(4.6, tw(as, 66, true) + tw(unitOf(data.unit), 24, true) + 0.6)), capW = x + w - capX;
  els.push(text(x, y, capX - x - 0.2, 0.3, data.label || 'Просим', { size: 13, color: C.muted, valign: 'middle' }));
  els.push(text(x, y + 0.25, capX - x - 0.2, 1.15, [{ t: as }, { t: unitOf(data.unit), s: 24 }], { size: 66, bold: true, color: C.accentInk, valign: 'middle' }));
  if (data.caption) {
    const cl = lines(data.caption, 15, capW);
    els.push(text(capX, y + 0.85 - lh(15) * cl / 2, capW, lh(15) * cl + 0.04, data.caption, { size: 15, color: C.ink2 }));
  }
  // полоса долей: первая статья акцентом, остальные серыми тонами
  const tones = [C.accent, C.bar, C.axis, C.muted, C.line], by = y + 1.98, bh = 0.32;
  let xx = x;
  data.uses.forEach((u, i) => {
    const pw = u.value / data.amount * w, uL = `${data.label || 'Просим'}: ${u.name}`;
    const vs = num(uL, u.value, srcOf(u, data, opt), d), sh = Math.round(u.value / data.amount * 100);
    const ss = num(`доля ${u.name} в сумме`, sh, { type: 'derived', from: [uL, aL], op: 'ratio', scale: 0.01 });
    els.push(rect(xx, by, Math.max(0.03, pw - 0.04), bh, { fill: tones[i % tones.length] }));
    els.push(text(xx, by - 0.46, pw - 0.1, 0.42, `${ss}%`, { size: 24, bold: true, color: i ? C.ink : C.accentInk, valign: 'bottom' }));
    const tw0 = pw - 0.15, nl = lines(u.name, 13, tw0, true);
    els.push(text(xx, by + bh + 0.1, tw0, lh(13) * (nl + 1) + 0.04, [{ t: u.name, b: true, c: C.ink }, { t: `\n${vs}${unitOf(data.unit)}` }], { size: 13, color: C.muted, ls: 1.0 }));
    xx += pw;
  });
  // вехи: «когда» над открытой осью, узел в начале колонки, результат под осью
  const my = y + 3.55, n = data.milestones.length, mw = w / n;
  els.push(hline(x, x + w, my, { color: C.axis, lw: 1.25, arrow: true }));
  data.milestones.forEach((m, i) => {
    const mx = x + i * mw, tw0 = mw - 0.3;
    els.push(text(mx, my - 0.38, tw0, 0.28, m.when, { size: 13, bold: true, color: i === n - 1 ? C.accentInk : C.muted, valign: 'middle' }));
    els.push(oval(mx + 0.09, my, 0.18, { fill: i === n - 1 ? C.accent : C.bg, line: C.accent, lw: 1.5 }));
    let yy = my + 0.16;
    if (m.value != null) {
      els.push(text(mx, yy, tw0, 0.44, [{ t: num(`веха ${m.when}: ${m.name}`, m.value, srcOf(m, data, opt), m.digits || 0) }, { t: unitOf(m.unit), s: 15 }], { size: 24, bold: true, valign: 'middle' }));
      yy += 0.46;
    }
    const nl = lines(m.name, m.value != null ? 13 : 15, tw0, m.value == null);
    els.push(m.value != null
      ? text(mx, yy, tw0, lh(13) * nl + 0.04, m.name, { size: 13, color: C.ink2 })
      : text(mx, yy + 0.06, tw0, lh(15) * nl + 0.04, m.name, { size: 15, bold: true }));
  });
  return els;
}

// Было / стало: два больших числа, между ними кратность («в 7 раз») или разница со знаком акцентом (derived ratio | diff),
// под числами полосы в общем масштабе и подписи. Вопрос: «насколько стало лучше?»
// data: { label, before: { when, value, unit?, caption, src? }, after: { when, value, unit?, caption, src? },
//         digits?, mode?: 'ratio'|'diff', better?: 'up'|'down', note?: 'быстрее', diffUnit?, src? }
// opt: { midW, maxPt: 120, minPt: 56, unitLine: 'auto'|true|false, fit: 'error'|'warn' }
// Кегль числа подбирается до раскладки: число с единицей одной строкой, а если так выходит заметно мельче — единица
// отдельной строкой под числом («%» всегда при числе). Единица не пропадает и не сокращается. Обе колонки одним кеглем.
// Ниже minPt сборка падает с советом (opt.fit: 'warn' — только предупреждение). Итог подбора — els.fit.
// Отрицательное значение — с типографским минусом, полоса по модулю. Кратность — только для положительных значений.
// Знак «×» не используем: в Styrene A LC он рисуется как «=».
function bigCompare(box, data, opt = {}) {
  const { x, y, w, h } = box, d = data.digits || 0, lab = data.label || 'значение', mid = opt.midW || 2.8, els = [];
  const colW = (w - mid) / 2, cols = [[data.before, x, false], [data.after, x + colW + mid, true]];
  const lb = `${lab}: ${data.before.when}`, la = `${lab}: ${data.after.when}`;
  const mx = Math.max(Math.abs(data.before.value), Math.abs(data.after.value)) || 1;
  const ratio = (data.mode || 'ratio') === 'ratio';
  if (ratio && !(data.before.value > 0 && data.after.value > 0)) throw new Error(`bigCompare «${lab}»: кратность считается только для положительных значений — возьмите mode: 'diff'`);
  const hi = opt.maxPt || 120, lo = opt.minPt || 56, upt = pt => Math.max(15, Math.round(pt * 0.3));
  const vss = cols.map(([s, , now]) => { const v = num(now ? la : lb, s.value, srcOf(s, data, opt), d); return s.value < 0 ? minus(v) : v; });
  // подбор: одной строкой; единица отдельной строкой (кроме «%»); высота — до низа подписей не ниже бокса
  const own = s => !!s.unit && s.unit !== '%' && opt.unitLine !== false;
  const ub = s => unitOf(s.unit).replace(/ /g, nb);          // для оценки: единица не делится
  const ny = y + 0.38, ph = pt => pt * 1.2 / 72 + 0.06;      // строка числа при интервале 1,0
  const uh = (s, pt) => lh(upt(pt)) * lines(s.unit, upt(pt), colW, true) + 0.04;
  const capH = Math.max(...cols.map(([s]) => lh(15) * lines(s.caption, 15, colW) + 0.04));
  const geo = (pt, split) => {
    const block = split ? ph(pt) + Math.max(0, ...cols.map(([s]) => (own(s) ? uh(s, pt) : 0))) : 0, nh = Math.max(2.05, block);
    return { nh, block, barY: y + 2.62 + (nh - 2.05) };   // по умолчанию полосы на прежнем месте
  };
  const one = Math.min(...cols.map(([s], i) => fitPt(pt => [{ t: vss[i], b: true }, { t: ub(s), b: true, s: upt(pt) }], colW, hi, 20) || 0));
  let two = 0;
  if (cols.some(([s]) => own(s))) {
    two = Math.min(...cols.map(([s], i) => fitPt(pt => [{ t: vss[i], b: true }, { t: own(s) ? '' : ub(s), b: true, s: upt(pt) }], colW, hi, 20) || 0));
    while (two >= 20 && geo(two, true).barY + 0.55 + capH > y + h + 0.01) two -= 2;
    if (two < 20) two = 0;
  }
  const split = two > 0 && (opt.unitLine === true || (one < hi && two >= one * 1.15));
  const pt = split ? two : one, G = geo(pt, split), barY = G.barY;
  // диагностика читаемости: по умолчанию сборка падает, opt.fit: 'warn' — предупреждение и кегль ниже порога
  const tell = (what, got, min, tip) => {
    const msg = `bigCompare «${lab}»: ${what} помещается только кеглем ${got || `меньше ${min}`} pt при пороге ${min} pt — ${tip}`;
    if (opt.fit !== 'warn') throw new Error(msg);
    console.warn(msg);
  };
  if (!pt) throw new Error(`bigCompare «${lab}»: число не помещается в колонку ${fmt(colW, 2)}″ даже кеглем 20 pt — возьмите kpiHero, dumbbell или barsTrend`);
  if (pt < lo) tell(`число с единицей в колонку ${fmt(colW, 2)}″`, pt, lo, 'уменьшите digits, перенесите единицу в подпись (caption) или в заголовок, уменьшите opt.midW либо возьмите kpiHero, dumbbell или barsTrend');
  cols.forEach(([s, cx, now], i) => {
    const color = now ? C.ink : C.muted;
    els.push(text(cx, y, colW, 0.34, s.when, { size: 15, bold: true, color, valign: 'middle' }));
    if (!split) els.push(text(cx, ny, colW, G.nh, [{ t: vss[i] }, { t: unitOf(s.unit), s: upt(pt) }], { size: pt, bold: true, color, valign: 'middle' }));
    else {
      const by = ny + (G.nh - G.block) / 2;
      els.push(text(cx, by, colW, ph(pt), own(s) ? vss[i] : [{ t: vss[i] }, { t: unitOf(s.unit), s: upt(pt) }], { size: pt, bold: true, color, valign: 'middle' }));
      if (own(s)) els.push(text(cx, by + ph(pt), colW, uh(s, pt), s.unit, { size: upt(pt), bold: true, color, ls: 1.1 }));
    }
    els.push(rect(cx, barY, Math.max(0.06, Math.abs(s.value) / mx * colW), 0.3, { fill: now ? C.accent : C.bar }));
    const cl = lines(s.caption, 15, colW);
    els.push(text(cx, barY + 0.55, colW, lh(15) * cl + 0.04, s.caption, { size: 15, color: C.ink2 }));
  });
  els.push(hline(x, x + w, barY + 0.3, { color: C.rule, lw: 0.75 }));
  // кратность (во сколько раз лучше) или разница со знаком
  let big;
  if (ratio) {
    const down = data.better === 'down', r0 = down ? data.before.value / data.after.value : data.after.value / data.before.value;
    const r = rnd(r0, 1), rd = Number.isInteger(r) ? 0 : 1, rv = rnd(r0, rd);
    const word = rd || [2, 3, 4].includes(rv % 10) && ![12, 13, 14].includes(rv % 100) ? 'раза' : 'раз';
    big = [{ t: 'в ', s: 24 }, { t: num(`${lab}: кратность`, rv, { type: 'derived', from: down ? [lb, la] : [la, lb], op: 'ratio' }, rd) }, { t: ` ${word}`, s: 24 }];
  } else {
    const dv = rnd(data.after.value - data.before.value, d);
    big = [{ t: signed(dv, num(`${lab}: разница`, dv, { type: 'derived', from: [la, lb], op: 'diff' }, d)) }, { t: data.diffUnit ? ` ${data.diffUnit}` : '', s: 24 }];
  }
  // кратность или разница — тоже под ширину середины: 48 pt, мельче до 28 pt, подписи при числе вдвое мельче
  const midAt = p => big.map(r => (r.s ? { ...r, s: Math.round(p / 2) } : r));
  let mp = fitPt(p => midAt(p).map(r => ({ ...r, b: true })), mid - 0.5, 48, 28) || 0;   // по 0,25″ воздуха до чисел
  if (!mp) { tell(`«${big.map(r => r.t).join('')}» в середину ${fmt(mid, 2)}″`, 0, 28, 'увеличьте opt.midW, сократите diffUnit или digits'); mp = 28; }
  const ax0 = x + colW + 0.3, ax1 = x + colW + mid - 0.3, ay = ny + G.nh / 2;
  els.push(hline(ax0, ax1, ay, { color: C.accent, lw: 2, arrow: true }));
  els.push(text(x + colW, ay - 0.88, mid, 0.8, mp === 48 ? big : midAt(mp), { size: mp, bold: true, color: C.accentInk, align: 'center', valign: 'bottom' }));
  if (data.note) els.push(text(x + colW, ay + 0.1, mid, 0.32, data.note, { size: 15, color: C.ink2, align: 'center', valign: 'top' }));
  els.fit = { pt, unitPt: upt(pt), unitLine: split, midPt: mp };
  return els;
}

// Рейтинг: топ-N строк — место (derived count), название, полоса значения, значение, изменение места стрелкой
// (▲ рост акцентом, ▼ падение серым; derived diff к прошлому месту). Вопрос: «кто в лидерах?»
// data: { label, unit?, digits?, nameHead?, valueHead?, changeHead?, noData?: 'нет данных', src?,
//         rows: [{ name, value, prev (место раньше), us?, src? }] }  opt: { top, change?: true|false }
// prev неизвестно (null, undefined, 'unknown') — в колонке «нет данных» (data.noData), без стрелки и без расчёта сдвига;
// строка вместо числа — причина, она и показывается («вне топ-10»). Ни одного прошлого места — колонка скрыта (opt.change: true — показать).
function rankingList(box, data, opt = {}) {
  const { x, y, w, h } = box, d = data.digits || 0, lab = data.label || 'значение', els = [];
  const rows = [...data.rows].sort((a, b) => b.value - a.value).slice(0, opt.top || data.rows.length);
  const na = r => naText(r.prev, data.noData || NA);
  const showCh = opt.change ?? rows.some(r => known(r.prev) || naText(r.prev, '') !== '');
  const CW = !showCh ? 0 : sn(Math.min(2.2, Math.max(1.2, ...rows.filter(r => !known(r.prev)).map(r => tw(na(r), 12) + 0.15))));
  const PW = 0.6, NW = opt.nameW || sn(Math.min(3.6, Math.max(1.8, ...rows.map(r => tw(r.name, 15, !!r.us) + 0.5)))), VW = 1.5, bx = x + PW + NW, bwMax = w - PW - NW - VW - CW - 0.3;
  const headH = 0.42, rh = Math.min(opt.rowH || 0.6, (h - headH) / rows.length), mx = rows[0].value;
  const hd = (hx, hw, t, al) => els.push(text(hx, y, hw, headH - 0.1, t, { size: 11, color: C.muted, align: al, valign: 'bottom' }));
  hd(x, PW, 'Место', 'left'); hd(x + PW, NW, data.nameHead || 'Участник', 'left');
  hd(x + w - CW - VW, VW, data.valueHead || `${lab}${data.unit ? `, ${data.unit}` : ''}`, 'right');
  if (showCh) hd(x + w - CW, CW, data.changeHead || 'Место', 'right');
  els.push(hline(x, x + w, y + headH, { color: C.axis, lw: 0.75 }));
  const vL = r => `${lab}: ${r.name}`;
  rows.forEach((r, i) => {
    const yy = y + headH + 0.04 + i * rh, cy = yy + rh / 2, src = srcOf(r, data, opt);
    const vs = num(vL(r), r.value, src, d);
    const pl = `место ${r.name} (${lab})`, ppl = `место ${r.name} раньше (${lab})`;
    const place = num(pl, i + 1, { type: 'derived', from: rows.slice(0, i + 1).map(vL), op: 'count' });
    if (known(r.prev)) num(ppl, r.prev, src);
    els.push(text(x, yy, PW, rh, place, { size: 18, bold: true, color: r.us ? C.accentInk : C.muted, valign: 'middle' }));
    els.push(text(x + PW, yy, NW - 0.2, rh, r.name, { size: 15, bold: !!r.us, color: r.us ? C.ink : C.ink2, valign: 'middle' }));
    els.push(rect(bx, cy - 0.1, Math.max(0.04, r.value / mx * bwMax), 0.2, { fill: r.us ? C.accent : C.bar }));
    els.push(text(x + w - CW - VW, yy, VW, rh, vs, { size: 15, bold: true, align: 'right', valign: 'middle' }));
    if (showCh && known(r.prev)) {
      const dv = r.prev - (i + 1);
      const ds = num(`изменение места ${r.name} (${lab})`, dv, { type: 'derived', from: [ppl, pl], op: 'diff' });
      const ch = dv > 0 ? { t: `▲ ${ds}`, c: C.accentInk } : dv < 0 ? { t: `▼ ${ds.replace(/^-/, '')}`, c: C.muted } : { t: 'на месте', c: C.muted };
      els.push(text(x + w - CW, yy, CW, rh, ch.t, { size: 13, bold: dv > 0, color: ch.c, align: 'right', valign: 'middle' }));
    } else if (showCh) els.push(text(x + w - CW, yy, CW, rh, na(r), { size: 12, color: C.muted, align: 'right', valign: 'middle' }));
    if (i < rows.length - 1) els.push(hline(x, x + w, yy + rh, { color: C.rule, lw: 0.5 }));
  });
  return els;
}

module.exports = { dumbbell, dotPlot, histogram, scatterLabeled, marimekko, treemap, kpiGrid, askFunds, bigCompare, rankingList };
