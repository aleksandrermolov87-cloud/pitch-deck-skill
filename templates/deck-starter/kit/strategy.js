// Стратегия, решения, организация: SWOT, OKR, оргструктура, RACI, риски, приоритеты, выбор варианта,
// опоры стратегии, цепочка ценности, слои архитектуры. API как в components.js: (box, data, opt) → els.
const L = require('../lib.js');
const U = require('./util.js');
const { C, THEME, rect, oval, hline, vline, text, tw } = L;
const { num, unitOf, lh, onBar, knock } = U;

const caps = s => String(s).toUpperCase();
const twc = (s, pt) => tw(caps(s), pt, true) * 1.22;            // капитель шире строчных: запас к оценке ширины
// Число строк после переноса по словам: жадная раскладка слов по ширине бокса. lines() из util делит общую ширину
// на ширину бокса и не видит потерь на концах строк, поэтому длинные абзацы у него выходят на строку короче.
// Буквы Styrene в среднем ≈0,65 кегля и в жирном, и в обычном: обычный tw() занижает на 4%; пробел ≈0,3 кегля; запас 2% на слово.
function wrap(runs, pt, w) {
  let n = 1, x = 0;
  runs.forEach(r => {
    const size = r.s || pt, k = r.b ? 1 : 1.04, sp = size * 0.3 / 72;   // пробел уже средней буквы
    r.t.split('\n').forEach((seg, si) => {
      if (si) { n++; x = 0; }
      seg.split(' ').forEach((wd, wi) => {
        const gap = wi > 0 ? sp : 0;
        if (!wd) { x += gap; return; }
        const ww = tw(wd, size, r.b) * k * 1.02;
        if (x > 0 && x + gap + ww > w) { n++; x = ww; } else x += gap + ww;
      });
    });
  });
  return n;
}
const ln = (s, pt, w, bold) => wrap([{ t: s, b: !!bold }], pt, w);
const tint = (dark, light) => ({ fill: C.accent, alpha: THEME === 'dark' ? dark : light });
const runLines = (runs, pt, w) => wrap(runs.map(r => ({ ...r, b: !!r.b })), pt, w);   // смешанный текст: жирный заголовок + обычный хвост

// ═════════════ СТРАТЕГИЯ ═════════════

// SWOT на крестовине из двух тонких линий, без ячеек-коробок. Вопрос: «какие сильные и слабые стороны?»
// Над колонками и слева от строк — смысл осей (помогает / мешает, внутри / снаружи). «Возможности» лежат на тоне акцента.
// data: { s: [пункт], w: [пункт], o: [пункт], t: [пункт], heads?: [4 строки], axes?: { cols: [2], rows: [2] }, src? }
// Пункт: строка или { t, d?, value?, unit?, digits?, label?, src?, weight?: 1–3 }. value — число после заголовка пункта,
// weight — сила фактора тремя сегментами справа (легенда одной строкой над сеткой). 2–3 пункта на квадрант.
function swot(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [], src = data.src || opt.src;
  const LW = opt.labelW ?? 1.3, top = 0.4, pad = 0.3;
  const gx = x + LW, gw = w - LW, gy = y + top, gh = h - top, qw = gw / 2, qh = gh / 2;
  const heads = data.heads || ['Сильные стороны', 'Слабые стороны', 'Возможности', 'Угрозы'];
  const axes = data.axes || { cols: ['помогают цели', 'мешают цели'], rows: ['внутренние', 'внешние'] };
  const lists = [data.s, data.w, data.o, data.t].map(l => (l || []).map(it => (typeof it === 'string' ? { t: it } : it)));
  const hasW = lists.some(l => l.some(it => it.weight));
  const MW = 0.56;   // ширина шкалы силы фактора
  els.push(rect(gx, gy + qh + 0.06, qw - 0.06, qh - 0.06, tint(0.1, 0.07)));
  axes.cols.forEach((t, j) => els.push(text(gx + j * qw + pad, y, tw(t, 10.5) + 0.12, 0.28, t, { size: 10.5, color: C.muted, valign: 'middle' })));
  axes.rows.forEach((t, r) => els.push(text(x, gy + r * qh, LW - 0.25, qh, t, { size: 10.5, color: C.muted, valign: 'middle' })));
  if (hasW) {
    const mx = x + w - pad - MW;
    for (let k = 0; k < 3; k++) els.push(rect(mx + k * 0.2, y + 0.11, 0.16, 0.06, { fill: C.ink2 }));
    els.push(text(mx - 1.75, y, 1.6, 0.28, 'сила фактора', { size: 10.5, color: C.muted, align: 'right', valign: 'middle' }));
  }
  els.push(vline(gx + qw, gy, gy + gh, { color: C.axis, lw: 0.75 }), hline(gx, gx + gw, gy + qh, { color: C.axis, lw: 0.75 }));
  const iw = qw - 2 * pad - (hasW ? MW + 0.3 : 0), hyOf = q => gy + Math.floor(q / 2) * qh + (q < 2 ? 0.1 : 0.16);
  const runsOf = lists.map((items, q) => items.map(it => {
    const runs = [{ t: it.t, b: true, c: C.ink }];
    if (it.value != null) runs.push({ t: ` ${num(it.label || it.t, it.value, it.src || src, it.digits || 0)}${unitOf(it.unit)}`, b: true, c: q === 2 ? C.accentInk : C.ink });
    if (it.d) runs.push({ t: `${it.value != null ? ' ' : ': '}${it.d}`, c: C.ink2 });
    return runs;
  }));
  // кегль пунктов общий для всех квадрантов: 12 pt, если пункты помещаются с воздухом, иначе 11
  const usedOf = (q, pt) => runsOf[q].reduce((a, r) => a + lh(pt) * runLines(r, pt, iw) + 0.02, 0);
  const availOf = q => gy + (Math.floor(q / 2) + 1) * qh - 0.08 - (hyOf(q) + 0.4);
  const SZ = [12, 11].find(pt => lists.every((l, q) => usedOf(q, pt) + 0.1 * Math.max(0, l.length - 1) <= availOf(q))) || 11;
  lists.forEach((items, q) => {
    const qx = gx + (q % 2) * qw, cx = qx + pad, hy = hyOf(q);
    els.push(text(cx, hy, iw, 0.26, caps(heads[q]), { size: 10, bold: true, color: q === 2 ? C.accentInk : C.muted, valign: 'middle' }));
    const hs = runsOf[q].map(r => lh(SZ) * runLines(r, SZ, iw) + 0.02);
    const gap = Math.max(0.08, Math.min(0.26, (availOf(q) - hs.reduce((a, b) => a + b, 0)) / Math.max(1, items.length - 1)));
    let iy = hy + 0.4;
    items.forEach((it, k) => {
      els.push(text(cx, iy, iw, hs[k], runsOf[q][k], { size: SZ, color: C.ink2, ls: 1.1 }));
      if (hasW) for (let m = 0; m < 3; m++) {
        const on = m < (it.weight || 0);
        els.push(rect(qx + qw - pad - MW + m * 0.2, iy + lh(SZ) / 2 - 0.03, 0.16, 0.06, { fill: on ? (q === 2 ? C.accent : C.ink2) : C.line }));
      }
      iy += hs[k] + gap;
    });
  });
  return els;
}

// Дерево OKR: цель слева, ключевые результаты справа на скобке. Вопрос: «как цель раскладывается на результаты?»
// У каждого результата — полоса выполнения, черта «темп на сегодня» и «факт из цели». Выполнение — derived ratio, %.
// Слева внизу — сколько результатов идут в темпе срока (derived count). Результат в темпе — акцентом.
// data: { objective: { label?, t, d? }, pace?: 0…1 (прошедшая доля срока), heroCaption?, krs: [{ name, value, target, unit?, digits?, src? }] } — 3–4 результата
function okrTree(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [], src = data.src || opt.src, o = data.objective, pace = data.pace;
  const LW = opt.labelW || 4.0, n = data.krs.length, rh = h / n, bx = x + LW, rx = bx + 0.45, rw = x + w - rx, FW = 2.7, PW = 0.75, bw = rw - PW;
  const ow = LW - 0.55;
  els.push(text(x, y, ow, 0.26, caps(o.label || 'Цель'), { size: 9, bold: true, color: C.muted, valign: 'middle' }));
  const onl = ln(o.t, 22, ow, true), oh = lh(22) * onl + 0.02;
  els.push(text(x, y + 0.34, ow, oh, o.t, { size: 22, bold: true, ls: 1.1 }));
  if (o.d) { const dl = ln(o.d, 12, ow); els.push(text(x, y + 0.34 + oh + 0.1, ow, lh(12) * dl + 0.02, o.d, { size: 12, color: C.ink2, ls: 1.1 })); }
  const oc = y + 0.34 + lh(22) / 2;
  const rows = data.krs.map((k, i) => {
    const s = k.src || src, d = k.digits || 0, cy = y + rh * (i + 0.5);
    const fl = `${k.name}: факт`, tl = `${k.name}: цель`, pl = `${k.name}: выполнение`;
    const f = num(fl, k.value, s, d), t = num(tl, k.target, s, d);
    const pr = Math.round(k.value / k.target * 100);
    const p = num(pl, pr, { type: 'derived', from: [fl, tl], op: 'ratio', scale: 0.01 });
    const ok = pace == null || pr >= pace * 100;
    const nw = rw - FW - 0.2, nl = ln(k.name, 13, nw, true);
    els.push(text(rx, cy - 0.08 - lh(13) * nl, nw, lh(13) * nl + 0.02, k.name, { size: 13, bold: true, valign: 'bottom', ls: 1.1 }));
    els.push(text(x + w - FW, cy - 0.44, FW, 0.38, [{ t: f, b: true, c: C.ink, s: 15 }, { t: ` из ${t}${unitOf(k.unit)}` }], { size: 12, color: C.muted, align: 'right', valign: 'bottom' }));
    els.push(rect(rx, cy + 0.08, bw, 0.12, { fill: C.line }));
    els.push(rect(rx, cy + 0.08, Math.max(0.05, bw * Math.min(1, pr / 100)), 0.12, { fill: ok ? C.accent : C.bar }));
    if (pace != null) els.push(vline(rx + bw * pace, cy + 0.01, cy + 0.27, { color: C.ink, lw: 1.5 }));
    els.push(text(x + w - PW + 0.1, cy, PW - 0.1, 0.28, `${p}%`, { size: 12, bold: true, color: ok ? C.ink : C.muted, align: 'right', valign: 'middle' }));
    els.push(hline(bx, rx - 0.12, cy, { color: C.axis, lw: 1 }));
    return { pl, ok, cy };
  });
  // скобка: стебель от цели и общая вертикаль через все результаты
  els.push(vline(bx, Math.min(rows[0].cy, oc), Math.max(rows[n - 1].cy, oc), { color: C.axis, lw: 1 }));
  els.push(hline(x + ow + 0.15, bx, oc, { color: C.axis, lw: 1 }));
  const okL = rows.filter(r => r.ok).map(r => r.pl);
  const all = num('ключевых результатов всего', n, { type: 'derived', from: rows.map(r => r.pl), op: 'count' });
  let by = y + h;
  if (pace != null) {
    const pv = num('доля срока на сегодня', Math.round(pace * 100), data.paceSrc || src);
    els.push(vline(x + 0.04, by - 0.26, by - 0.02, { color: C.ink, lw: 1.5 }));
    els.push(text(x + 0.2, by - 0.28, ow - 0.2, 0.28, `темп на сегодня: ${pv}% срока`, { size: 12, color: C.muted, valign: 'middle' }));
    by -= 0.5;
    const cap = data.heroCaption || 'ключевых результатов идут в темпе срока или быстрее';
    const cl = ln(cap, 12, ow);
    els.push(text(x, by - lh(12) * cl - 0.02, ow, lh(12) * cl + 0.02, cap, { size: 12, color: C.ink2, ls: 1.1 }));
    by -= lh(12) * cl + 0.06;
    const a = num('ключевых результатов в темпе', okL.length, { type: 'derived', from: okL.length ? okL : rows.map(r => r.pl), op: 'count' });
    els.push(text(x, by - 0.78, ow, 0.78, [{ t: a }, { t: ` из ${all}`, s: 22, c: C.ink2 }], { size: 44, bold: true, color: C.accentInk, valign: 'bottom' }));
  }
  return els;
}

// ═════════════ ОРГАНИЗАЦИЯ ═════════════

// Оргструктура в 2–3 уровня: корень выделен плашкой акцента, остальные узлы — типографикой (имя жирно, роль мелко),
// связи короткие ортогональные: шина под корнем, отводы к направлениям, у каждого направления вертикаль к его людям.
// Вопрос: «кто за что отвечает в команде?». Размер команды — полоса и число, всего — derived sum справа от корня.
// data: { root: { name, role }, units: [{ name, role, size?, src?, team?: [{ name, role, open? }] }], src? } — 3–5 направлений, до 4 человек в каждом
function orgChart(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [], src = data.src || opt.src, units = data.units, n = units.length, cw = w / n;
  const r = data.root, RH = 0.84, RW = Math.max(3.2, tw(r.name, 15, true) + 0.7, tw(r.role, 12, true) + 0.6), rcx = x + w / 2;
  const line = { color: C.axis, lw: 1 };
  els.push(rect(rcx - RW / 2, y, RW, RH, { r: 0.12, fill: C.accent }));
  els.push(text(rcx - RW / 2 + 0.2, y + 0.12, RW - 0.4, 0.32, r.name, { size: 15, bold: true, color: C.onAccent, align: 'center', valign: 'middle' }));
  els.push(text(rcx - RW / 2 + 0.2, y + 0.45, RW - 0.4, 0.28, r.role, { size: 12, bold: true, color: C.onAccent, align: 'center', valign: 'middle' }));   // белый на акценте: жирный от 12 pt, иначе не хватает контраста
  const sized = units.filter(u => u.size != null), mx = Math.max(1, ...sized.map(u => u.size));
  if (sized.length) {
    const tot = num('людей в команде всего', sized.reduce((a, u) => a + u.size, 0), { type: 'derived', from: sized.map(u => `${u.name}: людей`), op: 'sum' });
    const tx = rcx + RW / 2 + 0.3;
    // регистрация слагаемых до суммы: метки направлений ниже
    els.push(text(tx, y, Math.min(3.4, x + w - tx), RH, [{ t: `${tot} чел.`, b: true, c: C.ink, s: 15 }, { t: '\nвсего в направлении' }], { size: 12, color: C.muted, valign: 'middle', ls: 1.1 }));
  }
  const yb = y + RH + 0.32, sx = i => x + i * cw + 0.04;
  els.push(vline(rcx, y + RH, yb, line), hline(sx(0), sx(n - 1), yb, line));
  const ny = yb + 0.3, iw2 = cw - 0.26 - 0.2;
  // имя и роль направлений выравниваются по самой высокой подписи: полосы команды стоят на одной линии
  const nlMax = Math.max(...units.map(u => ln(u.name, 14, iw2, true))), rlMax = Math.max(...units.map(u => ln(u.role, 11, iw2)));
  const l2 = units.map((u, i) => {
    const tx = sx(i) + 0.22, iw = iw2, nl = ln(u.name, 14, iw, true), c1 = ny + lh(14) / 2;
    els.push(vline(sx(i), yb, c1, line), hline(sx(i), sx(i) + 0.14, c1, line));
    els.push(text(tx, ny, iw, lh(14) * nl + 0.02, u.name, { size: 14, bold: true, ls: 1.1 }));
    let yy = ny + lh(14) * nlMax + 0.04;
    const rl = ln(u.role, 11, iw);
    els.push(text(tx, yy, iw, lh(11) * rl + 0.02, u.role, { size: 11, color: C.muted, ls: 1.1 }));
    yy += lh(11) * rlMax + 0.1;
    if (u.size != null) {
      const v = num(`${u.name}: людей`, u.size, u.src || src), bwid = Math.max(0.08, u.size / mx * (iw - 0.9));
      els.push(rect(tx, yy + 0.08, bwid, 0.1, { fill: C.bar }));
      els.push(text(tx + bwid + 0.1, yy, 0.8, 0.26, `${v} чел.`, { size: 11, color: C.ink2, valign: 'middle' }));
      yy += 0.32;
    }
    return { tx, iw, bottom: yy };
  });
  const t0 = Math.max(...l2.map(b => b.bottom)) + 0.2;
  units.forEach((u, i) => {
    if (!u.team || !u.team.length) return;
    const s3 = l2[i].tx + 0.08, tx = s3 + 0.22, iw = x + (i + 1) * cw - tx - 0.15;
    let iy = t0, lastC = t0;
    u.team.forEach(m => {
      const c3 = iy + lh(12) / 2;
      els.push(hline(s3, s3 + 0.14, c3, { ...line, dash: !!m.open }));
      els.push(text(tx, iy, iw, lh(12) + 0.02, m.open ? 'Вакансия' : m.name, { size: 12, bold: true, color: m.open ? C.muted : C.ink }));
      const rl = ln(m.role, 11, iw);
      els.push(text(tx, iy + lh(12) + 0.02, iw, lh(11) * rl + 0.02, m.role, { size: 11, color: C.muted, ls: 1.1 }));
      lastC = c3;
      iy += lh(12) + lh(11) * rl + 0.2;
    });
    els.push(vline(s3, l2[i].bottom - 0.02, lastC, line));
  });
  return els;
}

// Матрица RACI: задачи × роли, буквы в кружках. Вопрос: «кто что делает в проекте?»
// A — залитый акцент (один на задачу), R — серая заливка C.bar, C и I — контур. Легенда одной строкой внизу.
// data: { roles: [имя], tasks: [{ name, group?, cells: ['R'|'A'|'C'|'I'|'' по числу ролей] }], legend?: { R, A, C, I } }
function raciMatrix(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [], LW = opt.labelW || 3.6, nr = data.roles.length, cw = (w - LW) / nr;
  const headH = 0.56, legH = 0.48, GH = 0.36;
  const rows = [];
  let lastG;
  data.tasks.forEach(t => { if (t.group && t.group !== lastG) rows.push({ isGroup: true, group: t.group }); lastG = t.group; rows.push(t); });
  const nG = rows.filter(r => r.isGroup).length, nT = data.tasks.length;
  const rh = Math.min(opt.rowH || 0.58, (h - headH - 0.06 - legH - nG * GH) / nT), d = Math.min(0.34, rh - 0.12);
  const style = l => l === 'A' ? { fill: C.accent, c: C.onAccent } : l === 'R' ? { fill: C.bar, c: onBar() } : { fill: C.bg, line: C.axis, lw: 1, c: C.ink2 };
  const mark = (cx, cy, dd, l, pt) => { const s = style(l); return [oval(cx, cy, dd, { fill: s.fill, line: s.line, lw: s.lw }), text(cx - dd / 2, cy - dd / 2, dd, dd, l, { size: pt, bold: true, color: s.c, align: 'center', valign: 'middle' })]; };
  data.roles.forEach((r, j) => els.push(text(x + LW + j * cw + 0.08, y, cw - 0.16, headH - 0.08, r, { size: 11, bold: true, color: C.ink2, align: 'center', valign: 'bottom' })));
  els.push(hline(x, x + w, y + headH, { color: C.axis, lw: 0.75 }));
  let yy = y + headH + 0.06;
  rows.forEach((r, k) => {
    if (r.isGroup) {
      if (k) els.push(hline(x, x + w, yy, { color: C.rule, lw: 0.5 }));
      els.push(text(x, yy, LW - 0.2, GH, caps(r.group), { size: 9, bold: true, color: C.muted, valign: 'middle' }));
      yy += GH;
      return;
    }
    if (k && !rows[k - 1].isGroup) els.push(hline(x, x + w, yy, { color: C.rule, lw: 0.5 }));
    els.push(text(x, yy, LW - 0.2, rh, r.name, { size: 12.5, valign: 'middle' }));
    r.cells.forEach((l, j) => { if (l) els.push(...mark(x + LW + (j + 0.5) * cw, yy + rh / 2, d, l, 12)); });
    yy += rh;
  });
  const lg = { R: 'делает работу', A: 'отвечает за итог и утверждает', C: 'советует до решения', I: 'узнаёт об итоге', ...(data.legend || {}) };
  const ly = y + h - 0.3;
  let lx = x;
  ['R', 'A', 'C', 'I'].forEach(l => {
    els.push(...mark(lx + 0.15, ly + 0.15, 0.3, l, 12));
    const t = lg[l], tw0 = tw(t, 11) + 0.1;
    els.push(text(lx + 0.4, ly, tw0, 0.3, t, { size: 11, color: C.ink2, valign: 'middle' }));
    lx += 0.4 + tw0 + 0.45;
  });
  return els;
}

// ═════════════ РИСКИ И ПРИОРИТЕТЫ ═════════════

// Карта рисков 3 × 3: вероятность × влияние, тон ячейки по тяжести, риски — кружки-метки с номером.
// Справа список тех же рисков по убыванию тяжести с мерой. Вопрос: «какие риски главные?»
// Тяжёлые (вероятность × влияние ≥ 6) — акцентом. Номер метки — ссылка на строку списка, не величина.
// data: { risks: [{ name, p: 1–3, i: 1–3, measure, owner?, value?, unit?, digits?, src? }], levels?: [3 строки], valuePrefix?, src? } — до 6 рисков
function riskMatrix(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [], src = data.src || opt.src;
  const GW = opt.gridW || 5.0, AL = 1.05, lv = data.levels || ['низкая', 'средняя', 'высокая'];
  const gx = x + AL, gy = y + 0.36, cs = (GW - AL) / 3, chh = (h - 0.36 - 0.66) / 3, gap = 0.05;
  const sev = r => r.p * r.i, high = r => sev(r) >= 6;
  const risks = data.risks.map(r => ({ ...r })).sort((a, b) => sev(b) - sev(a) || b.i - a.i);
  risks.forEach((r, k) => { r.id = k + 1; });
  const marker = (cx, cy, r, dd = 0.36) => high(r)
    ? [oval(cx, cy, dd + 0.07, { fill: C.bg }), oval(cx, cy, dd, { fill: C.accent }), text(cx - dd / 2, cy - dd / 2, dd, dd, String(r.id), { size: 12, bold: true, color: C.onAccent, align: 'center', valign: 'middle' })]
    : [oval(cx, cy, dd, { fill: C.bar }), text(cx - dd / 2, cy - dd / 2, dd, dd, String(r.id), { size: 12, bold: true, color: onBar(), align: 'center', valign: 'middle' })];
  els.push(text(x, y, GW, 0.26, caps(data.yLabel || 'Вероятность'), { size: 9, bold: true, color: C.muted, valign: 'middle' }));
  for (let row = 0; row < 3; row++) {
    const p = 3 - row;
    els.push(text(x, gy + row * chh, AL - 0.15, chh, lv[p - 1], { size: 10.5, color: C.muted, align: 'right', valign: 'middle' }));
    for (let c = 0; c < 3; c++) {
      const s = p * (c + 1);
      const fill = s >= 6 ? tint(0.42, 0.3) : s >= 3 ? tint(0.18, 0.13) : { fill: C.line, alpha: THEME === 'dark' ? 0.35 : 0.5 };
      els.push(rect(gx + c * cs + gap / 2, gy + row * chh + gap / 2, cs - gap, chh - gap, fill));
    }
  }
  for (let c = 0; c < 3; c++) els.push(text(gx + c * cs, gy + 3 * chh + 0.06, cs, 0.26, lv[c], { size: 10.5, color: C.muted, align: 'center', valign: 'middle' }));
  els.push(text(gx, gy + 3 * chh + 0.36, 3 * cs, 0.26, caps(data.xLabel || 'Влияние'), { size: 9, bold: true, color: C.muted, align: 'center', valign: 'middle' }));
  // метки в ячейках: до трёх в ряд, больше — в два ряда
  const cells = {};
  risks.forEach(r => { (cells[`${r.p}-${r.i}`] = cells[`${r.p}-${r.i}`] || []).push(r); });
  Object.values(cells).forEach(list => {
    const r0 = list[0], ccx = gx + (r0.i - 0.5) * cs, ccy = gy + (3 - r0.p + 0.5) * chh, per = 3, step = 0.44;
    const nrow = Math.ceil(list.length / per);
    list.forEach((r, k) => {
      const row = Math.floor(k / per), inRow = Math.min(per, list.length - row * per), col = k % per;
      els.push(...marker(ccx + (col - (inRow - 1) / 2) * step, ccy + (row - (nrow - 1) / 2) * step, r));
    });
  });
  // список рисков с мерой
  const lx = x + GW + 0.6, NW = opt.nameW || 2.7, mx0 = lx + 0.55 + NW + 0.3, MW = x + w - mx0;
  els.push(text(lx + 0.55, y, NW, 0.26, 'РИСК', { size: 9, bold: true, color: C.muted, valign: 'middle' }));
  els.push(text(mx0, y, MW, 0.26, 'МЕРА', { size: 9, bold: true, color: C.muted, valign: 'middle' }));
  els.push(hline(lx, x + w, y + 0.36, { color: C.axis, lw: 0.75 }));
  const blocks = risks.map(r => {
    const nl = ln(r.name, 13, NW, true), sub = [];
    if (r.value != null) sub.push(`${data.valuePrefix ?? 'потери до '}${num(`${r.name}: потери`, r.value, r.src || src, r.digits || 0)}${unitOf(r.unit || data.unit)}`);
    if (r.owner) sub.push(r.owner);
    const subT = sub.join(', '), sl = subT ? ln(subT, 10.5, NW) : 0, ml = ln(r.measure, 12, MW);
    return { r, nl, subT, sl, ml, hh: Math.max(lh(13) * nl + (sl ? 0.04 + lh(10.5) * sl : 0), lh(12) * ml) };
  });
  const avail = h - 0.36 - 0.1, used = blocks.reduce((a, b) => a + b.hh, 0);
  const pad = Math.max(0.14, Math.min(0.5, (avail - used) / blocks.length));
  let yy = y + 0.36 + pad / 2;
  blocks.forEach((b, k) => {
    if (k) els.push(hline(lx, x + w, yy - pad / 2, { color: C.rule, lw: 0.5 }));
    els.push(...marker(lx + 0.18, yy + lh(13) / 2, b.r, 0.32));
    els.push(text(lx + 0.55, yy, NW, lh(13) * b.nl + 0.02, b.r.name, { size: 13, bold: true, ls: 1.1 }));
    if (b.sl) els.push(text(lx + 0.55, yy + lh(13) * b.nl + 0.04, NW, lh(10.5) * b.sl + 0.02, b.subT, { size: 10.5, color: C.muted, ls: 1.1 }));
    els.push(text(mx0, yy, MW, lh(12) * b.ml + 0.02, b.r.measure, { size: 12, color: C.ink2, ls: 1.1 }));
    yy += b.hh + pad;
  });
  return els;
}

// Пузырьковая матрица приоритетов: усилия × эффект, размер пузыря — ценность. Вопрос: «что делать первым?»
// Квадрант «быстрые победы» (мало усилий, большой эффект) — тоном и акцентными пузырями; справа список этих инициатив
// с итогом (derived sum). Подписи раскладываются вокруг пузырей без наездов на пузыри, оси и друг друга.
// data: { x: { label, lo, hi }, y: { label, lo, hi }, items: [{ name, x: 0…1, y: 0…1, value, src? }], unit?, digits?,
//         valueLabel?, quadrants?: [tl, tr, bl, br], firstLabel?, totalCaption?, sizeCaption?, src? }
function bubble2x2(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [], src = data.src || opt.src, dg = data.digits || 0, un = unitOf(data.unit);
  const RW = opt.listW || 3.3, gx = x, gy = y + 0.36, gw = w - RW - 0.6, gh = h - 0.36 - 0.42;
  const px = v => gx + v * gw, py = v => gy + (1 - v) * gh, plot = { x: gx, y: gy, w: gw, h: gh };
  const vl = data.valueLabel || 'эффект', mx = Math.max(...data.items.map(i => i.value)), DM = opt.maxD || 0.75;
  const dOf = v => Math.max(0.22, DM * Math.sqrt(v / mx));
  const quick = it => it.x < 0.5 && it.y >= 0.5;
  const q = data.quadrants || ['Быстрые победы', 'Крупные проекты', 'Мелкие улучшения', 'Отложить'];
  els.push(rect(gx, gy, gw / 2, gh / 2, tint(0.09, 0.06)));
  const qbox = [[gx + 0.12, gy + 0.1], [gx + gw / 2 + 0.12, gy + 0.1], [gx + 0.12, gy + gh - 0.36], [gx + gw / 2 + 0.12, gy + gh - 0.36]]
    .map(([qx, qy], i) => ({ x: qx, y: qy, w: twc(q[i] || '', 9) + 0.1, h: 0.26, k: 2 }));
  q.forEach((t, i) => t && els.push(text(qbox[i].x, qbox[i].y, qbox[i].w, qbox[i].h, caps(t), { size: 9, bold: true, color: i === 0 ? C.accentInk : C.muted, valign: 'middle' })));
  els.push(hline(gx, gx + gw, gy + gh / 2, { color: C.axis, lw: 1, arrow: true }), vline(gx + gw / 2, gy, gy + gh, { color: C.axis, lw: 1 }));
  els.push(text(gx, y, gw / 2, 0.28, [{ t: `${data.y.label}: `, b: true, c: C.ink2 }, { t: `${data.y.hi} ↑` }], { size: 11, color: C.muted, valign: 'middle' }));
  els.push(text(gx, gy + gh + 0.1, gw / 2 - 0.1, 0.28, data.x.lo, { size: 11, color: C.muted, valign: 'middle' }));
  els.push(text(gx + gw / 2 + 0.1, gy + gh + 0.1, gw / 2 - 0.1, 0.28, [{ t: `${data.x.label}: `, b: true, c: C.ink2 }, { t: data.x.hi }], { size: 11, color: C.muted, align: 'right', valign: 'middle' }));
  // пузыри: крупные снизу, мелкие сверху
  const items = data.items.map(it => ({ ...it, cx: px(it.x), cy: py(it.y), d: dOf(it.value), v: num(`${it.name}: ${vl}`, it.value, it.src || src, dg) }));
  const byValue = [...items].sort((a, b) => b.value - a.value);
  byValue.forEach(it => els.push(oval(it.cx, it.cy, it.d, { fill: quick(it) ? C.accent : C.bar, alpha: 0.88 })));
  // подписи: из 16 позиций вокруг пузыря берётся та, что меньше всего задевает пузыри, оси, подписи квадрантов и уже поставленные подписи
  const axes = [{ x: gx, y: gy + gh / 2 - 0.03, w: gw, h: 0.06, k: 3 }, { x: gx + gw / 2 - 0.03, y: gy, w: 0.06, h: gh, k: 3 }];
  const obst = [...qbox, ...axes];
  const area = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const hitCirc = (a, c) => { const nx = Math.max(a.x, Math.min(c.cx, a.x + a.w)), ny = Math.max(a.y, Math.min(c.cy, a.y + a.h)); return (nx - c.cx) ** 2 + (ny - c.cy) ** 2 < (c.d / 2 + 0.05) ** 2; };
  const LWm = opt.labelW || 1.9;   // длинное имя переносится на вторую строку: узкая подпись легче встаёт между пузырями
  byValue.forEach(it => {
    const nw = tw(it.name, 12, true) * 0.99, nl = nw > LWm ? ln(it.name, 12, LWm, true) : 1;
    const lw0 = (nl > 1 ? LWm : Math.max(nw, tw(`${it.v}${un}`, 11))) + 0.1, LH = lh(12) * nl + lh(11) + 0.02, r = it.d / 2, cand = [];
    [0.08, 0.32].forEach(o => cand.push(
      [it.cx + r + o, it.cy - LH / 2, 'left'], [it.cx - r - o - lw0, it.cy - LH / 2, 'right'],
      [it.cx - lw0 / 2, it.cy - r - o - LH, 'center'], [it.cx - lw0 / 2, it.cy + r + o, 'center'],
      [it.cx + r * 0.7 + o, it.cy - r * 0.7 - LH, 'left'], [it.cx + r * 0.7 + o, it.cy + r * 0.7, 'left'],
      [it.cx - r * 0.7 - o - lw0, it.cy - r * 0.7 - LH, 'right'], [it.cx - r * 0.7 - o - lw0, it.cy + r * 0.7, 'right']));
    const score = (c, i) => {
      let s = (c.w * c.h - area(c, plot)) * 30 + i * 0.002;
      const side = (vx, vy) => `${vx < gx + gw / 2}${vy < gy + gh / 2}`;   // подпись в чужом квадранте читается как чужая
      if (side(c.x + c.w / 2, c.y + c.h / 2) !== side(it.cx, it.cy)) s += 1.5;
      obst.forEach(o => { const a = area(c, o); if (a > 0.004) s += o.k + a * 10; });
      items.forEach(o => { if (hitCirc(c, o)) s += 2 + area(c, { x: o.cx - o.d / 2, y: o.cy - o.d / 2, w: o.d, h: o.d }) * 10; });
      return s;
    };
    const best = cand.map(([lx, ly, al], i) => { const c = { x: Math.max(gx, Math.min(gx + gw - lw0, lx)), y: ly, w: lw0, h: LH, al }; return { c, s: score(c, i) }; }).sort((a, b) => a.s - b.s)[0].c;
    obst.push({ ...best, k: 3 });
    if (axes.some(a => area(best, a) > 0.004)) els.push(knock(best.x - 0.04, best.y, best.w + 0.08, best.h));   // ось уходит под подпись
    els.push(text(best.x, best.y, best.w, best.h, [{ t: it.name, b: true, c: C.ink }, { t: `\n${it.v}${un}`, s: 11, c: C.ink2 }], { size: 12, align: best.al, ls: 1.1 }));
  });
  // справа: что делать первым, итог быстрых побед
  const lx = x + w - RW, qs = items.filter(quick).sort((a, b) => b.value - a.value);
  els.push(text(lx, y, RW, 0.28, caps(data.firstLabel || 'Делать первым'), { size: 9, bold: true, color: C.accentInk, valign: 'middle' }));
  els.push(hline(lx, x + w, y + 0.36, { color: C.axis, lw: 0.75 }));
  let yy = y + 0.36;
  qs.forEach((it, k) => {
    const nl = ln(it.name, 12, RW - 1.3, true), rhh = Math.max(0.46, lh(12) * nl + 0.2);
    if (k) els.push(hline(lx, x + w, yy, { color: C.rule, lw: 0.5 }));
    els.push(text(lx, yy, RW - 1.3, rhh, it.name, { size: 12, bold: true, valign: 'middle', ls: 1.1 }));
    els.push(text(x + w - 1.2, yy, 1.2, rhh, `${it.v}${un}`, { size: 12, color: C.ink2, align: 'right', valign: 'middle' }));
    yy += rhh;
  });
  if (qs.length) {
    const sum = Math.round(qs.reduce((a, it) => a + it.value, 0) * 10 ** dg) / 10 ** dg;
    const tot = num(`${vl}: быстрые победы итого`, sum, { type: 'derived', from: qs.map(it => `${it.name}: ${vl}`), op: 'sum' }, dg);
    els.push(hline(lx, x + w, yy, { color: C.ink2, lw: 1.25 }));
    els.push(text(lx, yy + 0.12, RW, 0.56, [{ t: tot }, { t: un, s: 12 }], { size: 24, bold: true, color: C.accentInk, valign: 'middle' }));
    const cap = data.totalCaption || 'эффект быстрых побед в год', cl = ln(cap, 11, RW);
    els.push(text(lx, yy + 0.7, RW, lh(11) * cl + 0.02, cap, { size: 11, color: C.muted, ls: 1.1 }));
  }
  // легенда размера внизу справа
  const sy = y + h - 0.5;
  els.push(oval(lx + 0.14, sy + 0.32, 0.26, { fill: C.bar, alpha: 0.88 }), oval(lx + 0.6, sy + 0.2, 0.5, { fill: C.bar, alpha: 0.88 }));
  els.push(text(lx + 0.98, sy + 0.08, RW - 0.98, 0.36, data.sizeCaption || 'размер круга: эффект в год', { size: 11, color: C.muted, valign: 'middle' }));
  return els;
}

// ═════════════ РЕШЕНИЯ ═════════════

// Варианты решения колонками: стоимость и срок числами с полосами для сравнения, доводы за и против,
// рекомендуемый вариант на тоне акцента с плашкой «Рекомендуем», внизу строка-просьба. Вопрос: «какой вариант утвердить?»
// data: { options: [{ name, note?, cost, time, pros: [строки], cons: [строки], recommended?, src? }] — 2–3 варианта,
//         costLabel?, costUnit?, costDigits?, timeLabel?, timeUnit?, ask: 'Прошу утвердить …', src? }. Плюсы — «+», минусы — «−» в висячей колонке.
function decisionOptions(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [], src = data.src || opt.src, n = data.options.length, gap = 0.4, NS = 16;
  const cw = (w - gap * (n - 1)) / n, pad = 0.25, iw = cw - 2 * pad, askY = y + h - 0.42, sw = (iw - 0.3) / 2;
  const cMax = Math.max(...data.options.map(o => o.cost)), tMax = Math.max(...data.options.map(o => o.time));
  const cu = data.costUnit || 'млн ₽', tu = data.timeUnit || 'мес.', cd = data.costDigits || 0;
  // общие линии колонок: имя прижато к низу своей зоны, числа и доводы начинаются на одной высоте у всех вариантов
  const nameH = Math.max(...data.options.map(o => lh(NS) * ln(o.name, NS, iw, true)));
  const nY = y + 0.56, noteY = nY + nameH + 0.04, mY = noteY + lh(11) + 0.26;
  const itemH = t => lh(12) * ln(t, 12, iw - 0.26) + 0.06;
  const listH = key => Math.max(0, ...data.options.map(o => (o[key] || []).reduce((a, t) => a + itemH(t), 0)));
  const pY = mY + 1.0, cY = pY + listH('pros') + 0.14;
  data.options.forEach((o, j) => {
    const cx = x + j * (cw + gap), x0 = cx + pad, s = o.src || src, rec = !!o.recommended;
    if (rec) {
      els.push(rect(cx, y, cw, askY - 0.2 - y, tint(0.11, 0.07)));
      const pw = tw('Рекомендуем', 12, true) + 0.4;
      els.push(rect(x0, y + 0.12, pw, 0.3, { r: 0.15, fill: C.accent }));
      els.push(text(x0, y + 0.12, pw, 0.3, 'Рекомендуем', { size: 12, bold: true, color: C.onAccent, align: 'center', valign: 'middle' }));
    }
    const nl = ln(o.name, NS, iw, true);
    els.push(text(x0, nY + nameH - lh(NS) * nl, iw, lh(NS) * nl + 0.02, o.name, { size: NS, bold: true, color: rec ? C.accentInk : C.ink, ls: 1.1 }));
    if (o.note) els.push(text(x0, noteY, iw, lh(11) + 0.02, o.note, { size: 11, color: C.muted }));
    [[data.costLabel || 'Стоимость', cu, o.cost, cMax, cd, 'стоимость'], [data.timeLabel || 'Срок', tu, o.time, tMax, 0, 'срок']].forEach(([lab, u, v, m, dd, key], k) => {
      const mx0 = x0 + k * (sw + 0.3);
      els.push(text(mx0, mY, sw, 0.22, caps(lab), { size: 9, bold: true, color: C.muted, valign: 'middle' }));
      els.push(text(mx0, mY + 0.22, sw, 0.5, [{ t: num(`${o.name}: ${key}`, v, s, dd) }, { t: unitOf(u), s: 12 }], { size: 26, bold: true, color: rec ? C.accentInk : C.ink, valign: 'middle' }));
      els.push(rect(mx0, mY + 0.78, Math.max(0.06, v / m * sw), 0.08, { fill: rec ? C.accent : C.bar }));
    });
    // доводы: знак в висячей колонке, текст по общей линии
    [['+', o.pros, pY, C.ink], ['−', o.cons, cY, C.ink2]].forEach(([sign, list, yy0, col]) => {
      let yy = yy0;
      (list || []).forEach(t => {
        const ll = ln(t, 12, iw - 0.26);
        els.push(text(x0, yy, 0.2, lh(12) + 0.02, sign, { size: 12, bold: true, color: C.muted }));
        els.push(text(x0 + 0.26, yy, iw - 0.26, lh(12) * ll + 0.02, t, { size: 12, color: col, ls: 1.1 }));
        yy += itemH(t);
      });
    });
  });
  els.push(hline(x, x + w, askY - 0.1, { color: C.axis, lw: 0.75 }));
  const m = /^(Прошу утвердить)(.*)$/s.exec(data.ask || '');
  const runs = m ? [{ t: m[1], c: C.accentInk }, { t: m[2], c: C.ink }] : [{ t: data.ask || '' }];
  els.push(text(x, askY, w, 0.4, runs, { size: 15, bold: true, valign: 'middle' }));
  return els;
}

// Опоры стратегии: цель одной фразой сверху, под балкой 3–4 опоры колонками (название, 2–3 строки, метрика на общей линии),
// снизу основание тонкой полосой с подписью. Опора — тонкая вертикаль; главная опора (accent) — акцентом. Вопрос: «на чём держится стратегия?»
// data: { goal: { label?, t }, pillars: [{ name, body, value, unit?, digits?, label, src?, accent? }], base: { label, t }, src? }
function strategyPillars(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [], src = data.src || opt.src, g = data.goal, n = data.pillars.length, cw = w / n;
  els.push(text(x, y, w, 0.24, caps(g.label || 'Цель'), { size: 9, bold: true, color: C.muted, valign: 'middle' }));
  const gw = w * 0.86, gl = ln(g.t, 22, gw, true);
  els.push(text(x, y + 0.3, gw, lh(22) * gl + 0.02, g.t, { size: 22, bold: true, ls: 1.1 }));
  const ry = y + 0.3 + lh(22) * gl + 0.24, by = y + h - 0.5;
  els.push(hline(x, x + w, ry, { color: C.axis, lw: 1.5 }));
  els.push(rect(x, by, w, 0.1, { fill: C.bar }));
  if (data.base) els.push(text(x, by + 0.18, w, 0.32, [{ t: `${data.base.label}: `, b: true, c: C.ink }, { t: data.base.t, c: C.ink2 }], { size: 12, valign: 'middle' }));
  const iw = cw - 0.55;
  const capL = Math.max(...data.pillars.map(p => ln(p.label, 11, iw)));
  const capY = by - 0.2 - lh(11) * capL, numY = capY - 0.56;
  data.pillars.forEach((p, i) => {
    const cx = x + i * cw, x0 = cx + 0.3, acc = !!p.accent;
    els.push(rect(cx, ry + 0.16, 0.04, by - ry - 0.32, { fill: acc ? C.accent : C.axis }));   // опора не касается балки и основания: колонки не замыкаются в рамки
    const nl = ln(p.name, 15, iw, true);
    els.push(text(x0, ry + 0.24, iw, lh(15) * nl + 0.02, p.name, { size: 15, bold: true, color: acc ? C.accentInk : C.ink, ls: 1.1 }));
    const bl = ln(p.body, 12, iw);
    els.push(text(x0, ry + 0.24 + lh(15) * nl + 0.1, iw, lh(12) * bl + 0.02, p.body, { size: 12, color: C.ink2, ls: 1.1 }));
    els.push(text(x0, numY, iw, 0.54, [{ t: num(`${p.name}: ${p.label}`, p.value, p.src || src, p.digits || 0) }, { t: unitOf(p.unit), s: 15 }], { size: 28, bold: true, color: acc ? C.accentInk : C.ink, valign: 'bottom' }));
    els.push(text(x0, capY, iw, lh(11) * capL + 0.02, p.label, { size: 11, color: C.muted, ls: 1.1 }));
  });
  return els;
}

// Цепочка создания ценности: 4–6 звеньев слева направо на линии с узлами, подписи над линией,
// под каждым звеном вклад числом и доля от итога полосой (derived ratio), внизу итог цепочки (derived sum).
// Самое ценное звено — акцентом. Вопрос: «где создаётся ценность?»
// data: { label?, unit?, digits?, links: [{ name, note?, value, src? }], totalLabel?, caption?, src? }
function valueChain(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [], src = data.src || opt.src, d = data.digits || 0, lab = data.label || 'вклад';
  const n = data.links.length, cw = w / n, iw = cw - 0.3, un = unitOf(data.unit);
  const labels = data.links.map(l => `${lab}: ${l.name}`);
  const vals = data.links.map((l, i) => num(labels[i], l.value, l.src || src, d));
  const total = Math.round(data.links.reduce((a, l) => a + l.value, 0) * 10 ** d) / 10 ** d, totL = `${lab}: вся цепочка`;
  const totS = num(totL, total, { type: 'derived', from: labels, op: 'sum' }, d);
  const imax = data.links.reduce((b, l, i) => (l.value > data.links[b].value ? i : b), 0);
  // вертикаль: подписи сверху на общей линии, ниже ось с узлами, числа и доли, итог прижат к низу; свободное место — поровну между ярусами
  const blockH = Math.max(...data.links.map(l => lh(14) * ln(l.name, 14, iw, true) + (l.note ? 0.04 + lh(11) * ln(l.note, 11, iw) : 0)));
  const need = blockH + 0.3 + 1.75 + 0.7, g = Math.max(0, (h - need) / 3);
  const ly = y + blockH + 0.3 + g * 1.3, nY = ly + 0.26, bY = nY + 0.7 + g * 0.5, ty = y + h - 0.6;
  els.push(hline(x + 0.11, x + w, ly, { color: C.axis, lw: 1.25, arrow: true }));
  data.links.forEach((l, i) => {
    const tx = x + i * cw, top = i === imax, nl = ln(l.name, 14, iw, true);
    els.push(oval(tx + 0.11, ly, 0.22, { fill: top ? C.accent : C.bg, line: top ? C.accent : C.axis, lw: 1.5 }));
    els.push(text(tx, y, iw, lh(14) * nl + 0.02, l.name, { size: 14, bold: true, color: top ? C.accentInk : C.ink, ls: 1.1 }));
    if (l.note) { const dl = ln(l.note, 11, iw); els.push(text(tx, y + lh(14) * nl + 0.04, iw, lh(11) * dl + 0.02, l.note, { size: 11, color: C.muted, ls: 1.1 })); }
    els.push(text(tx, nY, iw, 0.56, [{ t: vals[i] }, { t: un, s: 12 }], { size: 28, bold: true, color: top ? C.accentInk : C.ink, valign: 'middle' }));
    const share = Math.round(l.value / total * 100);
    const pct = num(`доля ${l.name}`, share, { type: 'derived', from: [labels[i], totL], op: 'ratio', scale: 0.01 });
    const tw0 = cw - 0.45;
    els.push(rect(tx, bY, tw0, 0.14, { fill: C.line }));
    els.push(rect(tx, bY, Math.max(0.05, tw0 * share / 100), 0.14, { fill: top ? C.accent : C.bar }));
    els.push(text(tx, bY + 0.22, iw, 0.28, [{ t: `${pct}%`, b: true, c: C.ink }, { t: ' от итога' }], { size: 11, color: C.muted, valign: 'middle' }));
  });
  els.push(hline(x, x + w, ty, { color: C.rule, lw: 0.75 }));
  els.push(text(x, ty + 0.14, w * 0.5, 0.4, [{ t: `${data.totalLabel || 'Вся цепочка'}: `, c: C.ink2 }, { t: `${totS}${un}`, c: C.ink }], { size: 15, bold: true, valign: 'middle' }));
  if (data.caption) els.push(text(x + w * 0.5, ty + 0.14, w * 0.5, 0.4, data.caption, { size: 11, color: C.muted, align: 'right', valign: 'middle' }));
  return els;
}

// Слои архитектуры: 3–4 горизонтальных слоя (каналы → оркестрация → ядро → внешние) с подписью слоя слева,
// системы в слое текстом через тонкие разделители на общей сетке колонок, новые системы — акцентом (штрих над названием),
// связи сверху вниз вертикальными линиями; если колонки разные — ступенькой. Вопрос: «как устроена архитектура?»
// data: { cols?: число колонок, layers: [{ name, note?, systems: [{ name, note?, col?, isNew? }] }], links?: [{ from, to, dashed? }], newLabel? }
function systemsLayers(box, data, opt = {}) {
  const { x, y, w, h } = box, LW = opt.labelW || 2.4, nL = data.layers.length, SN = 12.5, SD = 10.5;
  const k = data.cols || Math.max(...data.layers.map(l => l.systems.length)), gx = x + LW, cw = (w - LW) / k;
  const hasNew = data.layers.some(l => l.systems.some(s => s.isNew));
  const legH = hasNew ? 0.4 : 0, rh = (h - legH) / nL, pos = {};
  const base = [], links = [], knocks = [], texts = [];
  data.layers.forEach((layer, li) => {
    const ly = y + li * rh;
    if (li) base.push(hline(x, x + w, ly, { color: C.rule, lw: 0.75 }));
    const lw0 = LW - 0.3, nl = ln(layer.name, 13, lw0, true), dl = layer.note ? ln(layer.note, SD, lw0) : 0;
    const bh = lh(13) * nl + (dl ? 0.04 + lh(SD) * dl : 0), t0 = ly + (rh - bh) / 2;
    texts.push(text(x, t0, lw0, lh(13) * nl + 0.02, layer.name, { size: 13, bold: true, ls: 1.1 }));
    if (dl) texts.push(text(x, t0 + lh(13) * nl + 0.04, lw0, lh(SD) * dl + 0.02, layer.note, { size: SD, color: C.muted, ls: 1.1 }));
    let auto = 0;
    const sys = layer.systems.map(s => { const col = s.col ?? auto; auto = col + 1; return { ...s, col }; }).sort((a, b) => a.col - b.col);
    sys.forEach((s, si) => {
      const c0 = gx + s.col * cw, cc = c0 + cw / 2, iw = cw - 0.3;
      const n2 = ln(s.name, SN, iw, true), d2 = s.note ? ln(s.note, SD, iw) : 0;
      const bh2 = lh(SN) * n2 + (d2 ? 0.03 + lh(SD) * d2 : 0), top = ly + (rh - bh2) / 2 + (s.isNew ? 0.06 : 0);
      if (s.isNew) texts.push(rect(cc - 0.2, top - 0.14, 0.4, 0.05, { fill: C.accent }));
      const nb = { x: c0 + 0.15, y: top, w: iw, h: lh(SN) * n2 + 0.02 };
      texts.push(text(nb.x, nb.y, nb.w, nb.h, s.name, { size: SN, bold: true, color: s.isNew ? C.accentInk : C.ink, align: 'center', ls: 1.1 }));
      if (d2) texts.push(text(c0 + 0.15, top + lh(SN) * n2 + 0.03, iw, lh(SD) * d2 + 0.02, s.note, { size: SD, color: C.muted, align: 'center', ls: 1.1 }));
      if (si) base.push(vline(c0, ly + 0.2, ly + rh - 0.2, { color: C.rule, lw: 0.75 }));
      pos[s.name] = { li, cx: cc, top: top - (s.isNew ? 0.16 : 0), bottom: top + bh2, ly, box: { x: c0 + 0.15, y: top - (s.isNew ? 0.16 : 0), w: iw, h: bh2 + (s.isNew ? 0.16 : 0) } };
    });
  });
  (data.links || []).forEach(l => {
    const a = pos[l.from], b = pos[l.to];
    if (!a || !b) throw new Error(`systemsLayers: нет системы «${!a ? l.from : l.to}»`);
    const [u, v] = a.li <= b.li ? [a, b] : [b, a];
    const st = { color: C.axis, lw: 1.25, dash: !!l.dashed };
    if (Math.abs(u.cx - v.cx) < 0.01) links.push(vline(u.cx, u.bottom + 0.08, v.top - 0.1, st));
    else {
      const ym = v.ly + 0.1;
      links.push(vline(u.cx, u.bottom + 0.08, ym, st), hline(Math.min(u.cx, v.cx), Math.max(u.cx, v.cx), ym, st), vline(v.cx, ym, v.top - 0.1, st));
    }
    links.push(oval(v.cx, v.top - 0.1, 0.08, { fill: C.axis }));
    // промежуточные слои: линия уходит под подпись системы на своём пути
    Object.values(pos).forEach(p => { if (p.li > u.li && p.li < v.li && Math.abs(p.cx - u.cx) < 0.01) knocks.push(knock(p.box.x, p.box.y - 0.03, p.box.w, p.box.h + 0.06)); });
  });
  const els = [...base, ...links, ...knocks, ...texts];
  if (hasNew) {
    const ly = y + h - 0.3;
    els.push(rect(x, ly + 0.125, 0.4, 0.05, { fill: C.accent }), text(x + 0.52, ly, 3, 0.3, data.newLabel || 'новая система или доработка', { size: SD, color: C.muted, valign: 'middle' }));
  }
  return els;
}

module.exports = { swot, okrTree, orgChart, raciMatrix, riskMatrix, bubble2x2, decisionOptions, strategyPillars, valueChain, systemsLayers };
