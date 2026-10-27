// Группа progress: сроки, статус и ход работ. Каждый компонент — (box, data, opt) → els, как в components.js.
// Числа идут через U.num() с источником item.src || data.src || opt.src; итоги, доли и отставания — derived.
// Цвета только из C, рамок и карточек нет: порядок держат сетка, тонкие линии и воздух.
const L = require('../lib.js');
const U = require('./util.js');
const { C, THEME, rect, oval, hline, vline, text, tw } = L;
const { num, minus, unitOf, lines, lh, onBar, diamond, seg, knock, sparkline } = U;

const srcOf = (it, data, opt) => (it && it.src) || data.src || opt.src;
// 1 день, 2 дня, 5 дней; дробные — родительный единственного (3,5 дня)
const plural = (n, one, few, many) => {
  const a = Math.abs(n);
  if (!Number.isInteger(a)) return few;
  const m10 = a % 10, m100 = a % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};
// Ромб-контур: в HTML-двойнике у ромба нет обводки, поэтому кольцо — два ромба, внешний цвета линии, внутренний цвета фона
const diamondRing = (cx, cy, d, color, k = 0.62) => [diamond(cx, cy, d, { fill: color }), diamond(cx, cy, d * k, { fill: C.bg })];

// ═════════════ ХОД ПРОЕКТА ═════════════

// Вертикальная лента вех. Вопрос: «как шёл проект?»
// Даты слева, ось посередине, справа результат жирно и пояснение, в правой колонке измеримый итог вехи.
// Пройденные вехи — заливка акцента, текущая — кольцо, будущие — тонкий контур; пройденный участок оси акцентом.
// data: { current: индекс текущей вехи, items: [{ date, title, note?, value?, digits?, unit? (к числу: '%', 'млн ₽'), caption? (строка под числом), valueLabel?, src? }] }
// opt: { dateW, valueW, src }
function milestonesVertical(box, data, opt = {}) {
  const { x, y, w, h } = box, n = data.items.length, cur = data.current ?? n - 1;
  const DW = opt.dateW || 1.45, VW = opt.valueW || 2.4, ax = x + DW + 0.35, tx = ax + 0.45, TW = x + w - VW - 0.3 - tx;
  const rh = h / n, top = i => y + i * rh, cy = i => top(i) + 0.27, els = [];
  els.push(vline(ax, cy(0), cy(n - 1), { color: C.axis, lw: 1.25 }));
  if (cur > 0) els.push(vline(ax, cy(0), cy(Math.min(cur, n - 1)), { color: C.accent, lw: 2.5 }));
  data.items.forEach((it, i) => {
    const done = i < cur, now = i === cur, yy = top(i);
    if (i) els.push(hline(tx, x + w, yy, { color: C.rule, lw: 0.5 }));
    els.push(text(x, cy(i) - 0.15, DW, 0.3, it.date, { size: 13, bold: now, color: now ? C.accentInk : done ? C.ink2 : C.muted, align: 'right', valign: 'middle' }));
    if (now) els.push(text(x, cy(i) + 0.15, DW, 0.22, 'сейчас', { size: 10, color: C.accentInk, align: 'right', valign: 'middle' }));
    els.push(done ? oval(ax, cy(i), 0.2, { fill: C.accent })
      : now ? oval(ax, cy(i), 0.32, { fill: C.bg, line: C.accent, lw: 2.25 })
        : oval(ax, cy(i), 0.16, { fill: C.bg, line: C.axis, lw: 1.25 }));
    els.push(text(tx, cy(i) - 0.16, TW, 0.32, it.title, { size: 15, bold: true, color: i > cur ? C.ink2 : C.ink, valign: 'middle' }));
    if (it.note) {
      const nl = lines(it.note, 11, TW);
      els.push(text(tx, cy(i) + 0.18, TW, lh(11) * nl + 0.02, it.note, { size: 11, color: C.muted, ls: 1.1 }));
    }
    if (it.value != null) {
      const v = num(it.valueLabel || `${it.title}: итог`, it.value, srcOf(it, data, opt), it.digits || 0);
      els.push(text(x + w - VW, cy(i) - 0.2, VW, 0.4, v + unitOf(it.unit), { size: 20, bold: true, color: i > cur ? C.muted : C.ink, align: 'right', valign: 'middle' }));
      if (it.caption) els.push(text(x + w - VW, cy(i) + 0.2, VW, 0.22, it.caption, { size: 11, color: C.muted, align: 'right', valign: 'middle' }));
    }
  });
  return els;
}

// Статус направлений типографической таблицей. Вопрос: «что с каждым направлением?»
// Статус — точка-маркер: готово — акцент, в работе — серая полоса, риск — контур. Итог «N из M в срок» — derived count.
// data: { label?, rows: [{ name, status: 'done'|'work'|'risk', owner, due, note?, onTime?, src? }] }
// onTime по умолчанию: всё, кроме риска. Каждой строке регистрируется факт «в срок» (1/0), счёт идёт по меткам.
// opt: { rowH, src }
function statusBoard(box, data, opt = {}) {
  const { x, y, w, h } = box, rows = data.rows, n = rows.length, lab = data.label || 'направления', els = [];
  const ST = { done: 'готово', work: 'в работе', risk: 'риск' };
  const mark = (cx, cyy, st, d = 0.17) => st === 'done' ? oval(cx, cyy, d, { fill: C.accent })
    : st === 'work' ? oval(cx, cyy, d, { fill: C.bar }) : oval(cx, cyy, d, { fill: C.bg, line: C.ink, lw: 1.5 });
  const gap = 0.3, fr = [0.24, 0.12, 0.17, 0.1, 0.37], free = w - gap * (fr.length - 1);
  let cx = x;
  const cols = fr.map(f => { const o = { x: cx, w: f * free }; cx += f * free + gap; return o; });
  ['Направление', 'Статус', 'Владелец', 'Срок', 'Комментарий'].forEach((t, j) => els.push(text(cols[j].x, y, cols[j].w, 0.3, t, { size: 10, color: C.muted, valign: 'bottom' })));
  const headH = 0.38, totalH = 0.95, rh = Math.min(opt.rowH || 0.62, (h - headH - totalH) / n);
  els.push(hline(x, x + w, y + headH, { color: C.axis, lw: 0.75 }));
  const flags = rows.map(r => r.onTime ?? r.status !== 'risk');
  const lbl = r => `${lab}: ${r.name} в срок`;
  rows.forEach((r, i) => {
    const yy = y + headH + i * rh, mid = yy + rh / 2;
    num(lbl(r), flags[i] ? 1 : 0, srcOf(r, data, opt));
    if (i) els.push(hline(x, x + w, yy, { color: C.rule, lw: 0.5 }));
    els.push(text(cols[0].x, yy, cols[0].w, rh, r.name, { size: 14, bold: true, valign: 'middle' }));
    els.push(mark(cols[1].x + 0.09, mid, r.status));
    els.push(text(cols[1].x + 0.28, yy, cols[1].w - 0.28, rh, ST[r.status], { size: 12, bold: r.status === 'risk', color: r.status === 'risk' ? C.ink : C.ink2, valign: 'middle' }));
    els.push(text(cols[2].x, yy, cols[2].w, rh, r.owner, { size: 12, color: C.ink2, valign: 'middle' }));
    els.push(text(cols[3].x, yy, cols[3].w, rh, r.due, { size: 12, bold: !flags[i], color: flags[i] ? C.ink2 : C.ink, valign: 'middle' }));
    if (r.note) els.push(text(cols[4].x, yy, cols[4].w, rh, r.note, { size: 12, color: C.muted, valign: 'middle', ls: 1.0 }));
  });
  const ty = y + headH + n * rh + 0.12;
  els.push(hline(x, x + w, ty, { color: C.ink2, lw: 1.5 }));
  const ok = num(`${lab}: в срок`, flags.filter(Boolean).length, { type: 'derived', from: rows.filter((_, i) => flags[i]).map(lbl), op: 'count' });
  const all = num(`${lab}: всего`, n, { type: 'derived', from: rows.map(lbl), op: 'count' });
  els.push(text(x, ty + 0.14, cols[1].x - x - 0.2, 0.62, [{ t: ok, s: 32, b: true, c: C.accentInk }, { t: ` из ${all} в срок`, s: 15, c: C.ink2 }], { size: 15, valign: 'middle' }));
  // счёт по статусам у правого края: он же легенда маркеров
  const parts = ['done', 'work', 'risk'].map(st => {
    const k = rows.filter(r => r.status === st);
    if (!k.length) return null;
    const v = num(`${lab}: ${ST[st]}`, k.length, { type: 'derived', from: k.map(lbl), op: 'count' });
    const t = `${ST[st]} ${v}`;
    return { st, t, w: 0.28 + tw(t, 12) + 0.1 };
  }).filter(Boolean);
  let rx = cols[1].x;
  parts.forEach(p => {
    els.push(mark(rx + 0.09, ty + 0.5, p.st, 0.15));
    els.push(text(rx + 0.28, ty + 0.38, p.w - 0.28, 0.24, p.t, { size: 12, color: C.ink2, valign: 'middle' }));
    rx += p.w + 0.4;
  });
  return els;
}

// Сгорание задач: план прямой пунктирной, факт ломаной. Вопрос: «успеваем ли к сроку?»
// Отставание в днях: тот же остаток по плановому темпу был бы раньше на N дней. Цепочка derived:
// темп = объём / дни; закрыто = объём − остаток; день плана = закрыто / темп; отставание = сегодня − день плана.
// data: { label?, unit?, scope, days, perTick, ticks: [подписи делений через perTick дней], fact: [остаток на каждом делении до сегодня], deadline, src }
// opt: { rightW, src }
function burndown(box, data, opt = {}) {
  const { x, y, w, h } = box, lab = data.label || 'задачи', unit = data.unit || 'задач', src = srcOf(null, data, opt), els = [];
  const RW = opt.rightW || 3.0, gx = x + 0.6, gw = w - RW - 0.75 - 0.6;
  const top = y + 0.45, base = y + h - 0.5;
  const px = d => gx + d / data.days * gw, py = v => base - v / data.scope * (base - top);
  const tNow = (data.fact.length - 1) * data.perTick, fNow = data.fact[data.fact.length - 1];
  // числа и производные: регистрируются в порядке цепочки
  const L1 = `${lab}: объём`, L2 = `${lab}: дней до срока`, L3 = `${lab}: план в день`, L4 = `${lab}: остаток сегодня`, L5 = `${lab}: день сегодня`;
  const L6 = `${lab}: закрыто`, L7 = `${lab}: день плана при текущем остатке`, L8 = `${lab}: отставание, дней`;
  const sS = num(L1, data.scope, src), sD = num(L2, data.days, src); void sD;
  const rate = Math.round(data.scope / data.days * 10) / 10, sRate = num(L3, rate, { type: 'derived', from: [L1, L2], op: 'ratio' }, 1);
  const sF = num(L4, fNow, src); num(L5, tNow, src);
  const done = data.scope - fNow, sDone = num(L6, done, { type: 'derived', from: [L1, L4], op: 'diff' });
  const dPlan = Math.round(done / rate); num(L7, dPlan, { type: 'derived', from: [L6, L3], op: 'ratio' });
  const lag = tNow - dPlan, sLag = num(L8, lag, { type: 'derived', from: [L5, L7], op: 'diff' });
  // шкала
  els.push(hline(gx, gx + gw, base, { color: C.axis, lw: 1 }));
  data.ticks.forEach((t, i) => {
    const d = i * data.perTick, now = d === tNow;
    if (d > data.days) return;
    els.push(vline(px(d), base, base + 0.07, { color: C.axis, lw: 0.75 }));
    els.push(text(px(d) - 0.5, base + 0.12, 1, 0.24, t, { size: 10, bold: now, color: now ? C.accentInk : C.muted, align: 'center', valign: 'middle' }));
  });
  els.push(vline(px(data.days), top - 0.05, base, { color: C.axis, lw: 1, dash: true }));
  els.push(text(px(data.days) - 2.4, top - 0.42, 2.4, 0.28, data.deadline, { size: 12, bold: true, align: 'right', valign: 'middle' }));
  els.push(text(x, py(data.scope) - 0.15, 0.5, 0.3, sS, { size: 12, bold: true, color: C.ink2, align: 'right', valign: 'middle' }));
  // план и факт
  els.push(seg(px(0), py(data.scope), px(data.days), py(0), { color: C.ink2, lw: 1.25, dash: true }));
  for (let i = 1; i < data.fact.length; i++) els.push(seg(px((i - 1) * data.perTick), py(data.fact[i - 1]), px(i * data.perTick), py(data.fact[i]), { color: C.accent, lw: 2.25 }));
  data.fact.forEach((v, i) => i && i < data.fact.length - 1 && els.push(oval(px(i * data.perTick), py(v), 0.09, { fill: C.accent })));
  // отставание: скобка на уровне остатка от точки плана до сегодня
  const by = py(fNow), bx1 = px(Math.min(dPlan, tNow)), bx2 = px(Math.max(dPlan, tNow));
  if (Math.abs(lag) > 0) {
    els.push(hline(bx1, bx2, by, { color: C.accent, lw: 1.25 }));
    els.push(vline(bx1, by - 0.08, by + 0.08, { color: C.accent, lw: 1.25 }));
    els.push(oval(px(dPlan), by, 0.1, { fill: C.ink2 }));
    const lt = `${lag > 0 ? sLag : minus(sLag).replace('−', '')} ${plural(lag, 'день', 'дня', 'дней')}`, lw = tw(lt, 12, true) + 0.24;
    const lx = Math.max(bx1, (bx1 + bx2) / 2 - lw / 2);
    els.push(knock(lx, by + 0.1, lw, 0.26), text(lx, by + 0.1, lw, 0.26, lt, { size: 12, bold: true, color: C.accentInk, align: 'center', valign: 'middle' }));
  }
  els.push(oval(px(tNow), by, 0.16, { fill: C.accent }));
  els.push(text(px(tNow) + 0.14, by - 0.38, 1.6, 0.28, [{ t: sF, b: true }, { t: ` ${plural(fNow, 'задача', 'задачи', 'задач')}` }], { size: 12, color: C.ink, valign: 'middle' }));
  // легенда у верхнего края графика
  els.push(seg(gx + 2.2, top - 0.28, gx + 2.6, top - 0.28, { color: C.ink2, lw: 1.25, dash: true }));
  els.push(text(gx + 2.7, top - 0.42, 0.8, 0.28, 'план', { size: 10, color: C.muted, valign: 'middle' }));
  els.push(hline(gx + 3.5, gx + 3.9, top - 0.28, { color: C.accent, lw: 2.25 }));
  els.push(text(gx + 4.0, top - 0.42, 0.8, 0.28, 'факт', { size: 10, color: C.muted, valign: 'middle' }));
  // правая колонка: отставание крупно и два опорных числа
  const rx = x + w - RW, rows = [
    { big: [{ t: lag >= 0 ? sLag : minus(sLag).replace('−', '') }, { t: ` ${plural(lag, 'день', 'дня', 'дней')}`, s: 26 }], cap: lag >= 0 ? 'отставание от плана при текущем остатке задач' : 'опережение плана при текущем остатке задач', hero: true },
    { big: [{ t: sDone }, { t: ` из ${sS}` }], cap: `${unit} закрыто с начала проекта` },
    { big: [{ t: sRate }], cap: `${plural(rate, 'задача', 'задачи', 'задач')} в день нужно закрывать по плану` },
  ];
  const rH = (h - 0.05) / rows.length;
  rows.forEach((r, i) => {
    const yy = y + i * rH;
    if (i) els.push(hline(rx, x + w, yy, { color: C.rule, lw: 0.75 }));
    els.push(text(rx, yy + 0.08, RW, r.hero ? 0.86 : 0.5, r.big, { size: r.hero ? 48 : 26, bold: true, color: r.hero ? C.accentInk : C.ink, valign: 'bottom' }));
    const cl = lines(r.cap, 12, RW);
    els.push(text(rx, yy + (r.hero ? 0.98 : 0.64), RW, lh(12) * cl + 0.04, r.cap, { size: 12, color: C.ink2, ls: 1.1 }));
  });
  return els;
}

// Выполнение целей полосами. Вопрос: «насколько выполнены цели?»
// По строке на цель: дорожка, заполнение до факта, общая отметка 100%, справа «74% из плана» (derived ratio) и «факт из плана».
// Цели, выполненные на 100% и больше, — акцентом, остальные серой полосой.
// data: { unit?, digits?, rows: [{ name, note?, fact, plan, unit?, digits?, src? }] }
// opt: { labelW, valueW, src }
function progressBars(box, data, opt = {}) {
  const { x, y, w, h } = box, LW = opt.labelW || 3.1, VW = opt.valueW || 2.3, els = [];
  const gx = x + LW, gw = w - LW - VW - 0.35, n = data.rows.length;
  const ratios = data.rows.map(r => r.fact / r.plan), kmax = Math.max(1.2, ...ratios.map(v => Math.min(v, 1.5)) ), p100 = gx + gw / kmax;
  const head = 0.42, rh = Math.min(0.95, (h - head) / n);
  els.push(text(p100 - 0.6, y, 1.2, 0.26, '100% плана', { size: 10, color: C.muted, align: 'center', valign: 'middle' }));
  data.rows.forEach((r, i) => {
    const yy = y + head + i * rh, cy = yy + rh / 2 - 0.04, src = srcOf(r, data, opt), d = r.digits ?? data.digits ?? 0, u = r.unit ?? data.unit;
    if (i) els.push(hline(x, gx - 0.25, yy - 0.04, { color: C.rule, lw: 0.5 }));
    els.push(text(x, cy - 0.3, LW - 0.25, 0.32, r.name, { size: 14, bold: true, valign: 'middle' }));
    if (r.note) els.push(text(x, cy + 0.04, LW - 0.25, 0.26, r.note, { size: 11, color: C.muted, valign: 'middle' }));
    const hit = ratios[i] >= 1;
    els.push(rect(gx, cy - 0.1, gw, 0.2, { fill: C.rule }));
    els.push(rect(gx, cy - 0.1, Math.max(0.04, Math.min(ratios[i], kmax) / kmax * gw), 0.2, { fill: hit ? C.accent : C.bar }));
    const f = num(`${r.name}: факт`, r.fact, src, d), p = num(`${r.name}: план`, r.plan, src, d);
    const pct = num(`${r.name}: выполнение`, Math.round(ratios[i] * 100), { type: 'derived', from: [`${r.name}: факт`, `${r.name}: план`], op: 'ratio', scale: 0.01 });
    els.push(text(x + w - VW, cy - 0.32, VW, 0.36, [{ t: `${pct}%`, s: 20, b: true, c: hit ? C.accentInk : C.ink }, { t: ' из плана', c: C.muted }], { size: 11, align: 'right', valign: 'middle' }));
    els.push(text(x + w - VW, cy + 0.06, VW, 0.24, `${f} из ${p}${unitOf(u)}`, { size: 11, color: C.muted, align: 'right', valign: 'middle' }));
  });
  // отметка 100% поверх полос: видно, насколько заполнение её перешло
  els.push(vline(p100, y + 0.3, y + head + n * rh - 0.12, { color: C.ink, lw: 1, dash: true }));
  return els;
}

// Календарь нагрузки. Вопрос: «когда пиковая нагрузка?»
// Строки — дни недели (или месяцы), колонки — недели; тон ячейки по величине в пять ступеней, пиковая ячейка в рамке,
// справа пик крупно и сумма пиковой колонки (derived sum), под сеткой шкала тона с минимумом и максимумом.
// data: { label, unit?, rows: ['Пн', …], rowNames?: ['Понедельник', …], cols: ['2–8 дек', …], groups?: [{ name, from }] (подписи месяцев над колонками), values: [[…]], src }
// opt: { rightW, src }
function calendarHeat(box, data, opt = {}) {
  const { x, y, w, h } = box, lab = data.label || 'значение', src = srcOf(null, data, opt), els = [];
  const RW = opt.rightW || 2.9, LW = 0.5, gx = x + LW, gw = w - LW - RW - 0.5;
  const nr = data.rows.length, nc = data.cols.length, cw = gw / nc, gap = 0.05;
  const gy = y + 0.42, ch = Math.min(0.56, (h - 0.42 - 0.62) / nr);
  const all = data.values.flat(), mx = Math.max(...all), mn = Math.min(...all.filter(v => v > 0));
  const steps = [0.14, 0.32, 0.52, 0.74, 1];
  const tone = v => steps[Math.min(4, Math.floor((v - mn) / (mx - mn + 1e-9) * 5))];
  const cell = (r, c) => `${lab}: ${data.rows[r]}, ${data.cols[c]}`;
  let pr = 0, pc = 0;
  data.values.forEach((row, r) => row.forEach((v, c) => { if (v > data.values[pr][pc]) { pr = r; pc = c; } }));
  (data.groups || []).forEach(g => els.push(text(gx + g.from * cw, y, Math.max(1.2, cw * 4), 0.28, g.name, { size: 12, bold: true, color: C.ink2, valign: 'middle' })));
  data.rows.forEach((rn, r) => els.push(text(x, gy + r * ch, LW - 0.1, ch - gap, rn, { size: 10, color: C.muted, valign: 'middle' })));
  data.values.forEach((row, r) => row.forEach((v, c) => {
    els.push(rect(gx + c * cw, gy + r * ch, cw - gap, ch - gap, v > 0 ? { fill: C.accent, alpha: tone(v) } : { fill: C.rule }));
  }));
  els.push(rect(gx + pc * cw - 0.04, gy + pr * ch - 0.04, cw - gap + 0.08, ch - gap + 0.08, { line: C.ink, lw: 1.75 }));
  // шкала тона: минимум — пять ступеней — максимум
  const ly = gy + nr * ch + 0.22, sMin = data.values.flat().indexOf(mn), sMax = num(cell(pr, pc), mx, src);
  const minR = Math.floor(sMin / nc), minC = sMin % nc, tMin = num(cell(minR, minC), mn, src);
  const lt = `${data.unit ? data.unit + ' в день' : 'в день'}:`;
  els.push(text(gx, ly, tw(lt, 10) + 0.12, 0.28, lt, { size: 10, color: C.muted, valign: 'middle' }));
  let lx = gx + tw(lt, 10) + 0.2;
  els.push(text(lx, ly, tw(tMin, 10) + 0.06, 0.28, tMin, { size: 10, color: C.muted, valign: 'middle' }));
  lx += tw(tMin, 10) + 0.14;
  steps.forEach((a, i) => els.push(rect(lx + i * 0.3, ly + 0.05, 0.26, 0.18, { fill: C.accent, alpha: a })));
  lx += steps.length * 0.3 + 0.08;
  els.push(text(lx, ly, tw(sMax, 10) + 0.1, 0.28, sMax, { size: 10, color: C.muted, valign: 'middle' }));
  // правая колонка
  const rx = x + w - RW;
  els.push(text(rx, y, RW, 0.28, 'Пиковый день', { size: 12, bold: true, color: C.ink2, valign: 'middle' }));
  els.push(text(rx, y + 0.34, RW, 0.84, [{ t: sMax }, { t: data.unit ? ` ${data.unit}` : '', s: 15, b: false, c: C.ink2 }], { size: 48, bold: true, color: C.accentInk, valign: 'bottom' }));
  const pcap = `${data.rowNames ? data.rowNames[pr] : data.rows[pr]}, неделя ${data.cols[pc]}`;
  els.push(text(rx, y + 1.24, RW, lh(12) * lines(pcap, 12, RW) + 0.04, pcap, { size: 12, color: C.ink2, ls: 1.1 }));
  const wy = y + 2.12;
  els.push(hline(rx, x + w, wy, { color: C.rule, lw: 0.75 }));
  data.values.forEach((row, r) => num(cell(r, pc), row[pc], src));
  const wk = num(`${lab}: неделя ${data.cols[pc]} итого`, data.values.reduce((a, row) => a + row[pc], 0), { type: 'derived', from: data.values.map((_, r) => cell(r, pc)), op: 'sum' });
  els.push(text(rx, wy + 0.14, RW, 0.6, wk, { size: 26, bold: true, valign: 'bottom' }));
  const wcap = `${data.unit || lab} за неделю ${data.cols[pc]}${data.peakNote ? `: ${data.peakNote}` : ''}`;
  els.push(text(rx, wy + 0.82, RW, lh(12) * lines(wcap, 12, RW) + 0.04, wcap, { size: 12, color: C.ink2, ls: 1.1 }));
  return els;
}

// ═════════════ ЭТАПЫ И СРОКИ ═════════════

// Фазы и ворота. Вопрос: «какие этапы и критерии перехода?»
// Фазы полосами слева направо (пройденные — серые, текущая — акцент, будущие — контур), между ними ромбы-ворота,
// от каждых ворот вниз линия к критериям перехода. Числа в критериях — через num.
// data: { current, phases: [{ name (до 14 знаков), period?, note? }], gates: [{ name, date?, criteria: [{ t, value?, unit?, after?, digits?, src? }] }] }
// Критерий с числом читается как «t value unit after»: { t: 'Конверсия в оплату не ниже', value: 30, unit: '%' }.
// gates.length = phases.length − 1. opt: { src }
function phaseGate(box, data, opt = {}) {
  const { x, y, w, h } = box, n = data.phases.length, cur = data.current ?? 0, els = [];
  const G = 0.56, pw = (w - G * (n - 1)) / n, px = i => x + i * (pw + G), gxc = i => px(i) + pw + G / 2;
  const by = y + 0.36, bh = 0.62, gd = 0.4;
  data.phases.forEach((p, i) => {
    const done = i < cur, now = i === cur;
    if (p.period) els.push(text(px(i), y, pw, 0.26, p.period, { size: 11, bold: now, color: now ? C.accentInk : C.muted, valign: 'middle' }));
    els.push(rect(px(i), by, pw, bh, done ? { r: 0.04, fill: C.bar } : now ? { r: 0.04, fill: C.accent } : { r: 0.04, line: C.axis, lw: 1 }));
    els.push(text(px(i) + 0.18, by, pw - 0.3, bh, p.name, { size: 15, bold: true, color: done ? onBar() : now ? C.onAccent : C.ink2, valign: 'middle' }));
  });
  let noteB = by + bh;
  data.phases.forEach((p, i) => {
    if (!p.note) return;
    const nl = lines(p.note, 12, pw - 0.3), nh = lh(12) * nl + 0.04;
    els.push(text(px(i), by + bh + 0.16, pw - 0.3, nh, p.note, { size: 12, color: i > cur ? C.muted : C.ink2, ls: 1.1 }));
    noteB = Math.max(noteB, by + bh + 0.16 + nh);
  });
  // ворота: блок критериев прижат к низу тела, линия от ромба идёт вдоль его левого края
  const GW = pw + G / 2 - 0.25;
  const blocks = data.gates.map((g, i) => {
    const cr = (g.criteria || []).map(c => c.value != null
      ? `${c.t} ${num(`${g.name}: ${c.t}`, c.value, srcOf(c, data, opt), c.digits || 0)}${unitOf(c.unit)}${c.after ? ` ${c.after}` : ''}` : c.t);
    const ch = cr.reduce((a, t) => a + lines(t, 12, GW) * lh(12), 0) + 0.04;
    return { g, i, cr, hh: 0.34 + (g.date ? 0.26 : 0) + 0.08 + ch };
  });
  const gy = Math.max(noteB + 0.45, y + h - Math.max(...blocks.map(b => b.hh)) - 0.05);   // блоки ворот на одной линии
  blocks.forEach(({ g, i, cr, hh }) => {
    const cx = gxc(i), passed = i < cur, next = i === cur, cyy = by + bh / 2;
    els.push(vline(cx, cyy + gd / 2, gy + hh - 0.04, { color: next ? C.accent : C.axis, lw: next ? 1.25 : 0.75 }));
    if (passed) els.push(diamond(cx, cyy, gd, { fill: C.bar }));
    else els.push(...diamondRing(cx, cyy, gd, next ? C.accent : C.axis, next ? 0.56 : 0.7));
    let yy = gy;
    els.push(text(cx + 0.16, yy, GW, 0.32, g.name, { size: 14, bold: true, color: next ? C.accentInk : C.ink, valign: 'middle' }));
    yy += 0.34;
    if (g.date) { els.push(text(cx + 0.16, yy, GW, 0.24, g.date, { size: 11, color: C.muted, valign: 'middle' })); yy += 0.26; }
    yy += 0.08;
    if (cr.length) els.push(text(cx + 0.16, yy, GW, hh - (yy - gy), cr.join('\n'), { size: 12, color: passed ? C.muted : C.ink2, ls: 1.1 }));
  });
  return els;
}

// Обратный отсчёт до запуска. Вопрос: «сколько осталось до запуска?»
// Число дней крупно (derived diff), рядом доля пройденного срока (ratio) и число контрольных точек впереди (count);
// ниже полоса по неделям: прошедшее серым, впереди тоном линии, «сегодня» акцентом, запуск ромбом, ключевые точки над полосой.
// data: { weeks: ['20 окт', …] (начало каждой недели), today: день от начала первой недели, launch: { day, label, date },
//         todayDate?, points: [{ day, label, date }], src }. Полоса кончается запуском: weeks.length × 7 = launch.day.
//         Точки ставьте не ближе ширины подписи друг к другу.
// opt: { src }
function deadlineStrip(box, data, opt = {}) {
  const { x, y, w, h } = box, src = srcOf(null, data, opt), els = [], span = data.weeks.length * 7;
  const LR = 2.0, sw0 = w - LR, px = d => x + d / span * sw0, wkW = sw0 / data.weeks.length;
  const Lt = 'запуск: сегодня, день', Ll = 'запуск: день запуска', Ld = 'запуск: дней осталось';
  num(Lt, data.today, src); num(Ll, data.launch.day, src);
  const left = data.launch.day - data.today, sLeft = num(Ld, left, { type: 'derived', from: [Ll, Lt], op: 'diff' });
  const pass = Math.round(data.today / data.launch.day * 100), sPass = num('запуск: доля прошедшего срока', pass, { type: 'derived', from: [Lt, Ll], op: 'ratio', scale: 0.01 });
  const ahead = data.points.filter(p => p.day > data.today);
  data.points.forEach(p => num(`запуск: ${p.label}, день`, p.day, p.src || src));
  const sAhead = num('запуск: точек впереди', ahead.length, { type: 'derived', from: ahead.map(p => `запуск: ${p.label}, день`), op: 'count' });
  // герой и два опорных числа
  els.push(text(x, y - 0.1, 5.2, 1.5, [{ t: sLeft }, { t: ` ${plural(left, 'день', 'дня', 'дней')}`, s: 26, c: C.ink }], { size: 88, bold: true, color: C.accentInk, valign: 'bottom' }));
  els.push(text(x, y + 1.42, 5.2, 0.3, `${data.launch.label}: ${data.launch.date}`, { size: 15, color: C.ink2, valign: 'middle' }));
  const stats = [
    { v: `${sPass}%`, cap: 'срока подготовки уже прошло' },
    { v: sAhead, cap: `${plural(ahead.length, 'контрольная точка', 'контрольные точки', 'контрольных точек')} до запуска` },
  ];
  const sx = x + 6.1, sw = (x + w - sx) / stats.length;
  stats.forEach((s, i) => {
    const xx = sx + i * sw;
    els.push(vline(xx, y + 0.35, y + 1.7, { color: C.rule, lw: 0.75 }));
    els.push(text(xx + 0.3, y + 0.35, sw - 0.4, 0.75, s.v, { size: 40, bold: true, valign: 'bottom' }));
    els.push(text(xx + 0.3, y + 1.18, sw - 0.4, lh(12) * 2 + 0.04, s.cap, { size: 12, color: C.ink2, ls: 1.1 }));
  });
  // полоса по неделям
  const sy = y + h - 0.78, sh = 0.4, tX = px(data.today);
  // прошедшие недели и оставшиеся должны различаться в обеих темах: в светлой серая полоса почти сливается с линией
  const PAST = THEME === 'dark' ? C.bar : C.axis, REST = THEME === 'dark' ? C.rule : C.line;
  data.weeks.forEach((wk, i) => {
    const a = i * 7, b = a + 7, x0 = px(a) + 0.02, x1 = px(b) - 0.02;
    if (b <= data.today) els.push(rect(x0, sy, x1 - x0, sh, { fill: PAST }));
    else if (a >= data.today) els.push(rect(x0, sy, x1 - x0, sh, { fill: REST }));
    else els.push(rect(x0, sy, tX - x0, sh, { fill: PAST }), rect(tX, sy, x1 - tX, sh, { fill: REST }));
    els.push(text(px(a) + 0.1, sy + sh + 0.1, wkW - 0.1, 0.24, wk, { size: 10, color: C.muted, valign: 'middle' }));
  });
  // точки над полосой: подпись у тика слева направо, у правого края — справа налево
  const py0 = sy - 0.86;
  const label = (d, t1, t2, o = {}) => {
    const xx = px(d), lw = Math.max(tw(t1, 12, true), tw(t2 || '', 10)) + 0.12, right = xx + 0.1 + lw > x + w;
    const lx = right ? xx - 0.1 - lw : xx + 0.1;
    els.push(vline(xx, py0 + 0.06, sy - (o.over ? 0.12 : 0), { color: o.color || C.axis, lw: o.lw || 0.75 }));
    els.push(text(lx, py0, lw, 0.28, t1, { size: 12, bold: true, color: o.tcolor || C.ink, align: right ? 'right' : 'left', valign: 'middle' }));
    if (t2) els.push(text(lx, py0 + 0.3, lw, 0.24, t2, { size: 10, color: C.muted, align: right ? 'right' : 'left', valign: 'middle' }));
  };
  data.points.forEach(p => label(p.day, p.label, p.date, { tcolor: p.day <= data.today ? C.muted : C.ink }));
  label(data.today, 'Сегодня', data.todayDate, { color: C.accent, lw: 2.25, tcolor: C.accentInk });
  els.push(vline(tX, sy, sy + sh, { color: C.accent, lw: 2.25 }));
  // запуск — ромб в конце полосы, подпись справа от него
  els.push(diamond(px(span), sy + sh / 2, 0.46, { fill: C.accent }));
  els.push(text(px(span) + 0.38, sy - 0.12, x + w - px(span) - 0.38, 0.3, data.launch.label, { size: 12, bold: true, valign: 'middle' }));
  els.push(text(px(span) + 0.38, sy + 0.2, x + w - px(span) - 0.38, 0.24, data.launch.date, { size: 10, color: C.muted, valign: 'middle' }));
  return els;
}

// ═════════════ НЕДЕЛЯ И ПОТОК ═════════════

// Главное за неделю. Вопрос: «что главное за неделю?»
// 3–4 строки: что произошло и смысл одной строкой, значение недели, изменение к прошлой неделе (derived diff) и спарклайн.
// Хорошее изменение — акцентом, плохое — основным цветом; goodDown: true — метрика, у которой хорошо, когда падает.
// data: { items: [{ name, note, value, prev, unit?, digits?, series: [..], goodDown?, src? }] }
// opt: { src }
function weeklyHighlights(box, data, opt = {}) {
  const { x, y, w, h } = box, n = data.items.length, els = [];
  const TW = 5.1, vx = x + TW + 0.35, VW = 2.25, dx = vx + VW + 0.3, DW = 1.55, SW = Math.min(2.6, x + w - dx - DW - 0.4), spx = x + w - SW;
  const head = 0.34, rh = (h - head) / n;
  [['Что изменилось', x, TW, 'left'], ['За неделю', vx, VW, 'right'], ['К прошлой', dx, DW, 'left'], ['Восемь недель', spx, SW, 'left']]
    .forEach(([t, xx, ww, al]) => els.push(text(xx, y, ww, 0.26, t, { size: 10, color: C.muted, align: al, valign: 'middle' })));
  els.push(hline(x, x + w, y + head, { color: C.axis, lw: 0.75 }));
  data.items.forEach((it, i) => {
    const yy = y + head + i * rh, cy = yy + rh / 2, src = srcOf(it, data, opt), d = it.digits || 0;
    if (i) els.push(hline(x, x + w, yy, { color: C.rule, lw: 0.5 }));
    els.push(text(x, cy - 0.34, TW, 0.32, it.name, { size: 15, bold: true, valign: 'middle' }));
    const nl = lines(it.note, 12, TW);
    els.push(text(x, cy + 0.02, TW, lh(12) * nl + 0.02, it.note, { size: 12, color: C.ink2, ls: 1.1 }));
    const v = num(`${it.name}: неделя`, it.value, src, d); num(`${it.name}: прошлая неделя`, it.prev, src, d);
    const dv = Math.round((it.value - it.prev) * 10 ** d) / 10 ** d;
    const ds = num(`${it.name}: изменение`, dv, { type: 'derived', from: [`${it.name}: неделя`, `${it.name}: прошлая неделя`], op: 'diff' }, d);
    const good = it.goodDown ? dv < 0 : dv > 0;
    els.push(text(vx, cy - 0.3, VW, 0.6, [{ t: v }, { t: unitOf(it.unit), s: 15, b: false, c: C.ink2 }], { size: 30, bold: true, align: 'right', valign: 'middle' }));
    els.push(text(dx, cy - 0.3, DW, 0.6, `${dv > 0 ? '+' : ''}${minus(ds)}${it.unit === '%' ? ' п. п.' : ''}`, { size: 15, bold: true, color: good ? C.accentInk : C.ink, valign: 'middle' }));
    els.push(...sparkline(spx, cy - 0.24, SW - 0.1, 0.48, it.series, { color: good ? C.ink2 : C.muted }));
  });
  return els;
}

// Поток канбана. Вопрос: «где копится работа?»
// Колонки потока слева направо, высота столбика — число задач, лимит WIP пунктиром, перегруженная колонка акцентом
// с превышением (derived diff); под названием — среднее время в колонке.
// data: { label?, cols: [{ name, count, wip?, days?, note? (вместо days), src? }], src }
// opt: { src }
function kanbanFlow(box, data, opt = {}) {
  const { x, y, w, h } = box, lab = data.label || 'задачи', n = data.cols.length, els = [];
  const step = w / n, bw = Math.min(1.05, step * 0.42), top = y + 0.62, base = y + h - 0.92;
  const mx = Math.max(...data.cols.flatMap(c => [c.count, c.wip || 0])), py = v => base - v / mx * (base - top);
  const sh = (step - bw) * 0.16, cxs = data.cols.map((_, i) => x + step * (i + 0.5) - sh);
  const nameW = data.cols.map(c => tw(c.name, 14, true));
  data.cols.forEach((c, i) => {
    const cx = cxs[i], src = srcOf(c, data, opt), over = c.wip != null && c.count > c.wip, bx = cx - bw / 2;
    const L1 = `${lab}: ${c.name}`, L2 = `${lab}: ${c.name}, лимит`;
    els.push(rect(bx, py(c.count), bw, base - py(c.count), { r: 0.04, fill: over ? C.accent : C.bar }));
    const v = num(L1, c.count, src);
    let vy = py(c.count) - 0.42;
    if (c.wip != null && c.wip > c.count && py(c.wip) > vy - 0.04) vy = py(c.wip) - 0.44;
    els.push(text(cx - 0.7, vy, 1.4, 0.38, v, { size: 22, bold: true, color: over ? C.accentInk : C.ink, align: 'center', valign: 'bottom' }));
    if (c.wip != null) {
      const lw = num(L2, c.wip, src), ly = py(c.wip);
      els.push(hline(bx - 0.16, bx + bw + 0.16, ly, { color: C.ink2, lw: 1.25, dash: true }));
      els.push(text(bx + bw + 0.24, ly - 0.13, 1.3, 0.26, `лимит ${lw}`, { size: 11, color: C.muted, valign: 'middle' }));
      if (over) {
        const ex = num(`${lab}: ${c.name}, сверх лимита`, c.count - c.wip, { type: 'derived', from: [L1, L2], op: 'diff' });
        els.push(text(bx + bw + 0.24, ly + 0.16, 1.3, 0.3, `+${ex} сверх`, { size: 14, bold: true, color: C.accentInk, valign: 'middle' }));
      }
    }
    const nw = step - 0.2 - 2 * sh;
    els.push(text(cx - nw / 2, base + 0.12, nw, 0.3, c.name, { size: 14, bold: true, align: 'center', valign: 'middle' }));
    if (c.days != null) {
      const dd = num(`${lab}: ${c.name}, дней в колонке`, c.days, src, Number.isInteger(c.days) ? 0 : 1);
      els.push(text(cx - nw / 2, base + 0.46, nw, 0.26, `${dd} ${plural(c.days, 'день', 'дня', 'дней')} в колонке`, { size: 11, color: C.muted, align: 'center', valign: 'middle' }));
    } else if (c.note) els.push(text(cx - nw / 2, base + 0.46, nw, 0.26, c.note, { size: 11, color: C.muted, align: 'center', valign: 'middle' }));
    if (i < n - 1) {
      const a = cx + nameW[i] / 2 + 0.2, b = cxs[i + 1] - nameW[i + 1] / 2 - 0.2;
      if (b - a > 0.35) els.push(hline(a, b, base + 0.27, { color: C.axis, lw: 1, arrow: true }));
    }
  });
  els.push(hline(x, x + w, base, { color: C.axis, lw: 1 }));
  return els;
}

// Год к году парами столбиков. Вопрос: «как этот год против прошлого?»
// По месяцам пары: прошлый год серым, текущий акцентом; значения подписаны только у последнего месяца текущего года;
// справа итоги обоих лет за одинаковые месяцы (derived sum) и отношение текущего к прошлому (derived ratio, %).
// data: { label, unit?, digits?, periods: ['Янв', …], prev: { name, values }, cur: { name, values (можно короче) }, src }
// opt: { rightW, src }
function pairedColumns(box, data, opt = {}) {
  const { x, y, w, h } = box, lab = data.label || 'значение', d = data.digits || 0, src = srcOf(null, data, opt), els = [];
  const RW = opt.rightW || 2.8, cw = w - RW - 0.6, n = data.periods.length, step = cw / n;
  const bw = Math.min(0.3, step * 0.3), g = 0.04, top = y + 0.65, base = y + h - 0.42, LAST = data.cur.values.length - 1;
  const mx = Math.max(...data.prev.values, ...data.cur.values), py = v => base - v / mx * (base - top);
  const lp = i => `${lab}: ${data.prev.name} ${data.periods[i]}`, lc = i => `${lab}: ${data.cur.name} ${data.periods[i]}`;
  data.periods.forEach((p, i) => {
    const cx = x + step * (i + 0.5), pv = data.prev.values[i], cv = data.cur.values[i];
    if (pv != null) els.push(rect(cx - bw - g / 2, py(pv), bw, base - py(pv), { fill: C.bar }));
    if (cv != null) els.push(rect(cx + g / 2, py(cv), bw, base - py(cv), { fill: C.accent }));
    els.push(text(cx - step / 2, base + 0.1, step, 0.24, p, { size: 10, bold: i === LAST, color: i === LAST ? C.ink : C.muted, align: 'center', valign: 'middle' }));
  });
  els.push(hline(x, x + cw, base, { color: C.axis, lw: 1 }));
  // все месяцы — факты для итогов, на графике подписан только последний
  const sp = data.cur.values.map((_, i) => num(lp(i), data.prev.values[i], src, d));
  const sc = data.cur.values.map((v, i) => num(lc(i), v, src, d));
  {
    const cx = x + step * (LAST + 0.5), pv = data.prev.values[LAST], cv = data.cur.values[LAST];
    // обе подписи над парой: нижняя — прошлый год, верхняя — текущий, цвет подписи совпадает со столбиком
    const yt = py(Math.max(pv, cv)) - 0.3;
    els.push(text(cx - 0.6, yt, 1.2, 0.26, sp[LAST], { size: 11, bold: true, color: C.ink2, align: 'center', valign: 'bottom' }));
    els.push(text(cx - 0.6, yt - 0.26, 1.2, 0.26, sc[LAST], { size: 11, bold: true, color: C.accentInk, align: 'center', valign: 'bottom' }));
  }
  // итоги справа
  const range = LAST < n - 1 ? `${data.periods[0].toLowerCase()}–${data.periods[LAST].toLowerCase()}` : 'за год';
  const tp = data.cur.values.reduce((a, _, i) => a + data.prev.values[i], 0), tc = data.cur.values.reduce((a, v) => a + v, 0);
  const r2 = v => Math.round(v * 10 ** d) / 10 ** d;
  const LP = `${lab}: ${data.prev.name} итого`, LC = `${lab}: ${data.cur.name} итого`;
  const stp = num(LP, r2(tp), { type: 'derived', from: data.cur.values.map((_, i) => lp(i)), op: 'sum' }, d);
  const stc = num(LC, r2(tc), { type: 'derived', from: data.cur.values.map((_, i) => lc(i)), op: 'sum' }, d);
  const rr = num(`${lab}: ${data.cur.name} к ${data.prev.name}`, Math.round(r2(tc) / r2(tp) * 100), { type: 'derived', from: [LC, LP], op: 'ratio', scale: 0.01 });
  const rx = x + w - RW;
  els.push(text(rx, y, RW, 0.26, `Итого, ${range}${data.unit ? `, ${data.unit}` : ''}`, { size: 11, color: C.muted, valign: 'middle' }));
  [[data.prev.name, stp, C.bar, C.ink], [data.cur.name, stc, C.accent, C.accentInk]].forEach(([nm, v, f, col], i) => {
    const yy = y + 0.5 + i * 1.25;
    els.push(rect(rx, yy + 0.08, 0.16, 0.16, { fill: f }));
    els.push(text(rx + 0.26, yy, RW - 0.26, 0.32, nm, { size: 13, bold: true, color: C.ink2, valign: 'middle' }));
    els.push(text(rx, yy + 0.32, RW, 0.72, v, { size: 40, bold: true, color: col, valign: 'middle' }));
  });
  const ry = y + 3.0;
  els.push(hline(rx, x + w, ry, { color: C.rule, lw: 0.75 }));
  els.push(text(rx, ry + 0.14, RW, 0.48, `${rr}%`, { size: 26, bold: true, valign: 'middle' }));
  const cap = `${data.cur.name} к ${data.prev.name} за те же месяцы`;
  els.push(text(rx, ry + 0.64, RW, lh(11) * lines(cap, 11, RW) + 0.04, cap, { size: 11, color: C.ink2, ls: 1.1 }));
  return els;
}

module.exports = { milestonesVertical, statusBoard, burndown, progressBars, calendarHeat, phaseGate, deadlineStrip, weeklyHighlights, kanbanFlow, pairedColumns };
