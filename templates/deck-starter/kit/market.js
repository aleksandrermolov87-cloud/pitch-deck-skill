// Группа market: рынок, деньги, модель бизнеса. Каждый компонент — (box, data, opt) → els, как в components.js.
// Числа только через U.num() с источником: item.src → data.src → opt.src. Производные — derived (sum, ratio, diff, count).
// Цвет — токены C.*, один акцент на слайд; порядок держат сетка, тонкие линии и воздух.
const L = require('../lib.js');
const U = require('./util.js');
const { C, THEME, rect, oval, hline, vline, text, tw } = L;
const { num, minus, unitOf, lines, lh, onBar, seg, spread } = U;

const srcOf = (it, data, opt) => (it && it.src) || data.src || opt.src;
const signed = (v, s) => (v > 0 ? `+${s}` : minus(s));
const round = (v, d = 0) => Math.round(v * 10 ** d) / 10 ** d;
// тон акцента под подложку: в светлой теме чуть легче, чтобы чёрный текст читался
const tint = a => (THEME === 'dark' ? a : +(a * 0.8).toFixed(2));
// Знаки × и = рисуются линиями, а не символами: у Styrene A LC с tabular-nums (HTML-двойник) глифы × и = меняются местами.
const cross = (cx, cy, s, o) => [seg(cx - s, cy - s, cx + s, cy + s, o), seg(cx - s, cy + s, cx + s, cy - s, o)];
const equals = (cx, cy, s, o) => [hline(cx - s, cx + s, cy - s * 0.45, o), hline(cx - s, cx + s, cy + s * 0.45, o)];
// Цепочка множителей строкой: части — отдельные подписи, между ними нарисованный «×»; перенос, если не помещается в w.
function chain(x, y, w, parts, size, color) {
  const els = [], lh0 = lh(size), opW = 0.3;
  let cx = x, line = 0, slack = 0;
  parts.forEach((p, i) => {
    const est = tw(p, size), pw = est * 0.97 + 0.06;
    if (i && cx + opW + pw > x + w) { cx = x; line++; slack = 0; }
    const yy = y + line * lh0;
    // бокс шире текста (оценка ширины с запасом): знак сдвигается влево на ожидаемый хвост предыдущей подписи
    if (i) { if (cx > x) els.push(...cross(cx - slack / 2 + opW / 2 - 0.02, yy + lh0 / 2, size / 300, { color, lw: 1 })); else els.push(...cross(cx + 0.06, yy + lh0 / 2, size / 300, { color, lw: 1 })); cx += cx > x ? opW : 0.2; }
    els.push(text(cx, yy, pw, lh0, p, { size, color, valign: 'middle' }));
    cx += pw; slack = Math.min(0.2, est * 0.03 + 0.02);
  });
  return { els, lines: line + 1 };
}

// ═════════════ РЫНОК ═════════════

// TAM / SAM / SOM вложенными кругами на общей нижней точке: площадь круга ∝ объёму рынка.
// Справа подписи на выносках: уровень, объём крупно, расчёт «снизу вверх» строкой под числом.
// Вопрос: «насколько большой рынок?»
// data: { unit: 'млрд ₽', levels: [{ key: 'TAM', name, value, digits?, src?, calc: [{ value, digits?, unit?, note }] }] ×3, от большего к меньшему }
// Объём уровня — факт с источником (произведение как derived не считается), множители расчёта — свои факты.
function marketTam(box, data, opt = {}) {
  const { x, y, w, h } = box, lv = data.levels, els = [];
  const D = Math.min(h - 0.1, opt.maxD || 4.3), base = y + h - 0.05, cx = x + D / 2 + 0.05;
  const ds = lv.map(l => D * Math.sqrt(l.value / lv[0].value)), tops = ds.map(d => base - d);
  const alphas = [tint(0.14), tint(0.34), 1];
  lv.forEach((l, i) => els.push(oval(cx, base - ds[i] / 2, ds[i], { fill: C.accent, alpha: alphas[Math.min(i, 2)], line: i === 0 ? C.accent : undefined, lw: 0.75 })));
  // точка выноски — середина «своего» кольца на вертикали центра; у последнего — центр круга
  const yb = lv.map((l, i) => (i < lv.length - 1 ? (tops[i] + tops[i + 1]) / 2 : base - ds[i] / 2));
  const LX = x + D + 1.4, LW = x + w - LX;
  const calcs = lv.map(l => (l.calc || []).map(c => `${num(`${l.key}: ${c.note}`, c.value, srcOf(c, data, opt) || srcOf(l, data, opt), c.digits || 0)}${unitOf(c.unit)} ${c.note}`));
  const cl = calcs.map(p => (p.length ? chain(0, 0, LW, p, 12, C.ink2).lines : 0));
  const NH = 0.28, VH = 0.62, n = lv.length, rowH = NH + VH + Math.max(...cl) * lh(12) + 0.22;
  // центры чисел: не ближе высоты строки подписи; не помещаются — раскладываются равномерно в высоту box
  const lo = y + NH + VH / 2, hi = y + h - VH / 2 - cl[n - 1] * lh(12) - 0.06;
  let ys = spread(yb, rowH);
  if (ys[n - 1] > hi) ys = ys.map(v => v - (ys[n - 1] - hi));
  if (ys[0] < lo) ys = ys.map(v => v + (lo - ys[0]));
  if (ys[n - 1] > hi) ys = ys.map((_, i) => lo + i * (hi - lo) / (n - 1));
  const ex = x + D + 0.35;
  lv.forEach((l, i) => {
    const yl = ys[i], last = i === lv.length - 1;
    els.push(hline(cx, ex, yb[i], { color: C.ink2, lw: 0.75 }));
    els.push(seg(ex, yb[i], ex + 0.55, yl, { color: C.ink2, lw: 0.75 }));
    els.push(hline(ex + 0.55, LX - 0.15, yl, { color: C.ink2, lw: 0.75 }));
    els.push(oval(cx, yb[i], 0.09, { fill: last ? C.onAccent : C.ink }));
    els.push(text(LX, yl - VH / 2 - NH, LW, NH, [{ t: l.key, b: true, c: last ? C.accentInk : C.ink }, { t: ` ${l.name}` }], { size: 13, color: C.muted, valign: 'bottom' }));
    els.push(text(LX, yl - VH / 2, LW, VH, [{ t: num(`${l.key}: объём`, l.value, srcOf(l, data, opt), l.digits || 0) }, { t: unitOf(data.unit), s: 15 }], { size: 36, bold: true, color: last ? C.accentInk : C.ink, valign: 'middle' }));
    if (calcs[i].length) els.push(...chain(LX, yl + VH / 2 + 0.04, LW, calcs[i], 12, C.ink2).els);
  });
  return els;
}

// ═════════════ ДЕНЬГИ ═════════════

// Юнит-экономика: CAC и LTV полосами на общей шкале, LTV нарезана на месяцы жизни клиента (маржа за месяц),
// метка окупаемости там, где маржа покрыла CAC. Справа LTV/CAC крупно и прибыль с клиента.
// Вопрос: «окупается ли клиент?»
// data: { unit: '₽', cac: { value, note }, ltv: { value, note }, margin: { value, note }, months: { value, note }, extra?: [{ label, value, digits?, unit?, note }], src }
// LTV — факт с источником; LTV/CAC, окупаемость (CAC / маржа), месяцы прибыли и прибыль с клиента — derived.
function unitEconomics(box, data, opt = {}) {
  const { x, y, w, h } = box, u = data.unit || '₽', els = [];
  const LW = opt.labelW || 1.9, RW = 3.2, VW = 1.5, gx = x + LW, gw = w - LW - RW - 0.6 - VW;
  const s = k => srcOf(data[k], data, opt);
  const cacT = num('CAC', data.cac.value, s('cac')), ltvT = num('LTV', data.ltv.value, s('ltv'));
  const mT = num('маржа с клиента в месяц', data.margin.value, s('margin')), mnT = num('срок жизни клиента, мес', data.months.value, s('months'));
  const pay = round(data.cac.value / data.margin.value);
  const payT = num('окупаемость, мес', pay, { type: 'derived', from: ['CAC', 'маржа с клиента в месяц'], op: 'ratio' });
  const profM = num('месяцы прибыли', data.months.value - pay, { type: 'derived', from: ['срок жизни клиента, мес', 'окупаемость, мес'], op: 'diff' });
  const mx = Math.max(data.ltv.value, data.cac.value), px = v => gx + v / mx * gw;
  const y0 = y + 0.3, y1 = y + 1.45, bh = 0.42;
  // CAC
  els.push(text(x, y0 - 0.12, LW - 0.2, 0.3, 'CAC', { size: 15, bold: true, valign: 'middle' }));
  els.push(text(x, y0 + 0.2, LW - 0.2, 0.4, data.cac.note, { size: 11, color: C.muted, ls: 1.1 }));
  els.push(rect(gx, y0, px(data.cac.value) - gx, bh, { fill: C.bar }));
  els.push(text(px(data.cac.value) + 0.14, y0, VW + 1, bh, `${cacT}${unitOf(u)}`, { size: 15, bold: true, valign: 'middle' }));
  // LTV по месяцам: до окупаемости тоном полосы, дальше акцентом
  els.push(text(x, y1 - 0.12, LW - 0.2, 0.3, 'LTV', { size: 15, bold: true, valign: 'middle' }));
  els.push(text(x, y1 + 0.2, LW - 0.2, 0.4, data.ltv.note, { size: 11, color: C.muted, ls: 1.1 }));
  const nM = data.months.value, cw = (px(data.ltv.value) - gx) / nM, g = Math.min(0.03, cw * 0.2);
  for (let i = 0; i < nM; i++) els.push(rect(gx + i * cw, y1, cw - g, bh, { fill: i < pay ? C.bar : C.accent }));
  els.push(text(px(data.ltv.value) + 0.14, y1, VW, bh, `${ltvT}${unitOf(u)}`, { size: 15, bold: true, valign: 'middle' }));
  const xp = px(data.cac.value);
  els.push(vline(xp, y0 - 0.08, y1 + bh + 0.12, { color: C.accent, lw: 1.25 }));
  els.push(text(gx, y1 + bh + 0.16, Math.max(0.8, xp - gx - 0.12), 0.56, [{ t: `${payT}${unitOf('мес')}`, b: true, c: C.ink, s: 15 }, { t: '\nокупаем CAC' }], { size: 11, color: C.muted, ls: 1.1 }));
  els.push(text(xp + 0.14, y1 + bh + 0.16, 3, 0.56, [{ t: `${profM}${unitOf('мес')}`, b: true, c: C.accentInk, s: 15 }, { t: '\nприносит прибыль' }], { size: 11, color: C.muted, ls: 1.1 }));
  // исходные величины строкой под общей линией
  const ry = y + 3.05, inputs = [{ v: `${mT}${unitOf(u)}`, note: data.margin.note }, { v: `${mnT}${unitOf('мес')}`, note: data.months.note },
    ...(data.extra || []).map(e => ({ v: `${num(e.label, e.value, srcOf(e, data, opt), e.digits || 0)}${unitOf(e.unit)}`, note: e.note }))];
  const iw = (gx + gw + VW - x) / inputs.length;
  els.push(hline(x, gx + gw + VW, ry, { color: C.rule, lw: 0.75 }));
  inputs.forEach((it, i) => {
    els.push(text(x + i * iw, ry + 0.18, iw - 0.3, 0.5, it.v, { size: 26, bold: true, valign: 'middle' }));
    els.push(text(x + i * iw, ry + 0.72, iw - 0.3, lines(it.note, 11, iw - 0.3) * lh(11) + 0.02, it.note, { size: 11, color: C.muted, ls: 1.1 }));
  });
  // герой: LTV/CAC и прибыль с клиента
  const hx = x + w - RW;
  els.push(vline(hx - 0.3, y, y + h - 0.2, { color: C.rule, lw: 0.75 }));
  const r = round(data.ltv.value / data.cac.value, 1);
  const rT = num('LTV / CAC', r, { type: 'derived', from: ['LTV', 'CAC'], op: 'ratio' }, 1);
  els.push(text(hx, y + 0.05, RW, 0.3, 'LTV / CAC', { size: 13, bold: true, color: C.muted, valign: 'middle' }));
  els.push(text(hx, y + 0.35, RW, 1.25, [{ t: rT }, { t: ' раза', s: 26 }], { size: 72, bold: true, color: C.accentInk, valign: 'middle' }));
  const rc = data.ratioNote || 'во столько раз маржа с клиента больше затрат на его привлечение';
  els.push(text(hx, y + 1.65, RW, lines(rc, 13, RW) * lh(13) + 0.02, rc, { size: 13, color: C.ink2, ls: 1.1 }));
  const pr = num('прибыль с клиента', data.ltv.value - data.cac.value, { type: 'derived', from: ['LTV', 'CAC'], op: 'diff' });
  els.push(hline(hx, x + w, ry, { color: C.rule, lw: 0.75 }));
  els.push(text(hx, ry + 0.18, RW, 0.5, `${pr}${unitOf(u)}`, { size: 26, bold: true, valign: 'middle' }));
  els.push(text(hx, ry + 0.72, RW, lh(11) * 2 + 0.02, 'прибыль с клиента за срок жизни: LTV минус CAC', { size: 11, color: C.muted, ls: 1.1 }));
  return els;
}

// Формула выручки: 3–4 множителя крупными числами через × и =, под каждым линия, подпись и источник; итог акцентом.
// Вопрос: «из чего складывается выручка?»
// data: { factors: [{ name, value, digits?, unit?, from, src? }], result: { name, value, digits?, unit?, from, src? } }
// Итог — факт с источником (модель), а не derived: операции «произведение» в реестре нет.
function revenueFormula(box, data, opt = {}) {
  const { x, y, w, h } = box, f = data.factors, n = f.length, els = [];
  const opW = 0.7, cw = (w - n * opW) / (n + 1);
  const all = [...f, data.result];
  const strs = all.map((it, i) => num(i === n ? `${it.name} (итог)` : it.name, it.value, srcOf(it, data, opt), it.digits || 0));
  const size = [54, 48, 40, 34, 30].find(pt => all.every((it, i) => tw(strs[i], pt, true) + tw(unitOf(it.unit), 26) + 0.1 <= cw)) || 30;
  const nameL = Math.max(...all.map(it => lines(it.name, 15, cw, true))), fromL = Math.max(...all.map(it => lines(it.from || '', 11, cw)));
  const NH = size * 1.25 / 72, blockH = NH + 0.25 + nameL * lh(15) + 0.12 + fromL * lh(11);
  const ny = y + Math.max(0, (h - blockH) / 2 + (opt.shift ?? 0.15));
  all.forEach((it, i) => {
    const cx = x + i * (cw + opW), res = i === n;
    els.push(text(cx, ny, cw, NH, [{ t: strs[i] }, { t: unitOf(it.unit), s: 26 }], { size, bold: true, color: res ? C.accentInk : C.ink, valign: 'bottom' }));
    els.push(hline(cx, cx + cw, ny + NH + 0.12, { color: res ? C.accent : C.axis, lw: res ? 3 : 0.75 }));
    els.push(text(cx, ny + NH + 0.25, cw, nameL * lh(15) + 0.02, it.name, { size: 15, bold: true, color: res ? C.accentInk : C.ink, ls: 1.1 }));
    if (it.from) els.push(text(cx, ny + NH + 0.25 + nameL * lh(15) + 0.12, cw, fromL * lh(11) + 0.02, it.from, { size: 11, color: C.muted, ls: 1.1 }));
    if (i < n) {   // знак в круге на высоте цифр: × между множителями, = перед итогом
      const ox = cx + cw + opW / 2, oy = ny + NH - size * 0.42 / 72, d = Math.min(0.56, opW - 0.1), eq = i === n - 1;
      els.push(oval(ox, oy, d, { line: eq ? C.accent : C.axis, lw: 1 }));
      els.push(...(eq ? equals(ox, oy, d * 0.22, { color: C.accent, lw: 1.75 }) : cross(ox, oy, d * 0.17, { color: C.ink2, lw: 1.75 })));
    }
  });
  return els;
}

// Когорты удержания: треугольная матрица когорта × месяц, насыщенность акцента по проценту.
// Под матрицей средняя кривая по месяцам: среднее — derived ratio суммы колонки к числу когорт.
// Вопрос: «как держатся клиенты по когортам?»
// data: { cohorts: [{ name, size }], values: [[100, 86, …], …] (строка i короче на i), digits?, src, sizeLabel? }
function cohortGrid(box, data, opt = {}) {
  const { x, y, w, h } = box, LW = opt.labelW || 2.4, d = data.digits || 0, els = [];
  const nr = data.cohorts.length, nc = Math.max(...data.values.map(r => r.length)), gap = 0.05;
  const headH = 0.34, avH = opt.avgH || 1.25, cw = (w - LW) / nc;
  const ch = Math.min(0.5, (h - headH - avH - 0.25) / nr - gap);
  const vals = data.values.flat(), lo = Math.min(...vals), hi = Math.max(...vals);
  const lab = (i, j) => `удержание ${data.cohorts[i].name} М${j + 1}`;
  els.push(text(x, y, LW - 1.35, headH - 0.06, 'Когорта', { size: 10, color: C.muted, valign: 'bottom' }));
  els.push(text(x + LW - 1.25, y, 1.0, headH - 0.06, data.sizeLabel || 'клиентов', { size: 10, color: C.muted, align: 'right', valign: 'bottom' }));
  for (let j = 0; j < nc; j++) els.push(text(x + LW + j * cw, y, cw - gap, headH - 0.06, `М${j + 1}`, { size: 10, color: C.muted, align: 'center', valign: 'bottom' }));
  data.cohorts.forEach((co, i) => {
    const yy = y + headH + i * (ch + gap);
    els.push(text(x, yy, LW - 1.35, ch, co.name, { size: 12, bold: true, valign: 'middle' }));
    els.push(text(x + LW - 1.25, yy, 1.0, ch, num(`размер когорты ${co.name}`, co.size, srcOf(co, data, opt)), { size: 10, color: C.muted, align: 'right', valign: 'middle' }));
    data.values[i].forEach((v, j) => {
      const a = Math.min(1, +(0.16 + 0.84 * (v - lo) / (hi - lo || 1)).toFixed(2)), xx = x + LW + j * cw;
      els.push(rect(xx, yy, cw - gap, ch, { fill: C.accent, alpha: a }));
      els.push(text(xx, yy, cw - gap, ch, `${num(lab(i, j), v, srcOf(co, data, opt), d)}%`, { size: 12, bold: a >= 0.9, color: a >= 0.9 ? C.onAccent : C.ink, align: 'center', valign: 'middle' }));
    });
  });
  // средняя кривая: сумма и число когорт регистрируются без показа, среднее — их отношение
  const sy = y + headH + nr * (ch + gap) + 0.12, top = sy + 0.42, bot = sy + avH - 0.08;
  els.push(hline(x, x + w, sy, { color: C.axis, lw: 0.75 }));
  const avg = [];
  for (let j = 0; j < nc; j++) {
    const rows = data.values.map((r, i) => i).filter(i => data.values[i][j] != null), from = rows.map(i => lab(i, j));
    num(`сумма удержания М${j + 1}`, rows.reduce((a, i) => a + data.values[i][j], 0), { type: 'derived', from, op: 'sum' }, d);
    num(`когорт с М${j + 1}`, rows.length, { type: 'derived', from, op: 'count' });
    const v = round(rows.reduce((a, i) => a + data.values[i][j], 0) / rows.length, d);
    avg.push({ v, t: num(`среднее удержание М${j + 1}`, v, { type: 'derived', from: [`сумма удержания М${j + 1}`, `когорт с М${j + 1}`], op: 'ratio' }, d) });
  }
  const alo = Math.min(...avg.map(a => a.v)), ahi = Math.max(...avg.map(a => a.v));
  const px = j => x + LW + j * cw + (cw - gap) / 2, py = v => bot - (v - alo) / (ahi - alo || 1) * (bot - top);
  els.push(text(x, sy + 0.25, LW - 0.25, 0.3, 'Среднее', { size: 12, bold: true, color: C.accentInk, valign: 'middle' }));
  els.push(text(x, sy + 0.55, LW - 0.25, 0.5, 'по всем когортам с данными за месяц', { size: 10, color: C.muted, ls: 1.1 }));
  for (let j = 1; j < nc; j++) els.push(seg(px(j - 1), py(avg[j - 1].v), px(j), py(avg[j].v), { color: C.accent, lw: 2 }));
  avg.forEach((a, j) => {
    els.push(oval(px(j), py(a.v), 0.13, { fill: C.accent }));
    els.push(text(px(j) - 0.5, py(a.v) - 0.38, 1.0, 0.26, `${a.t}%`, { size: 11, bold: true, align: 'center', valign: 'middle' }));
  });
  return els;
}

// Тарифы колонками без карточек: цена крупно, рекомендуемый тариф тоном-подложкой, возможности списком с ✓ и —.
// Вопрос: «сколько стоит и что входит?»
// data: { unit: '₽ в месяц', badge?, tiers: [{ name, price, digits?, note, recommended?, src? }],
//         features: [{ name, values: [true | false | 'текст' | число], unit?, prefix? }] }
// Числовое значение возможности (лимит) регистрируется как факт «имя: тариф».
function pricingTiers(box, data, opt = {}) {
  const { x, y, w, h } = box, n = data.tiers.length, gap = 0.5, cw = (w - gap * (n - 1)) / n, pad = 0.22, iw = cw - 2 * pad, els = [];
  const MW = 0.38, fy = y + 1.95, fs = 13;
  // подписи возможностей по тарифам; строки общие для всех колонок, высота — по самой длинной подписи в строке
  const labels = data.features.map(f => data.tiers.map((t, j) => {
    const v = f.values[j];
    return typeof v === 'number' ? `${f.name}: ${f.prefix || ''}${num(`${f.name}: ${t.name}`, v, srcOf(f, data, opt) || srcOf(t, data, opt), f.digits || 0)}${unitOf(f.unit)}`
      : typeof v === 'string' ? `${f.name}: ${v}` : f.name;
  }));
  const nl = labels.map(r => Math.max(...r.map(l => lines(l, fs, iw - MW))));
  const rg = Math.max(0.08, Math.min(0.2, (y + h - fy - nl.reduce((a, k) => a + k * lh(fs), 0)) / nl.length));
  const ry = nl.map((_, i) => fy + nl.slice(0, i).reduce((a, k) => a + k * lh(fs) + rg, 0));
  data.tiers.forEach((t, j) => {
    const cx = x + j * (cw + gap), tx = cx + pad, rec = !!t.recommended;
    if (rec) {
      els.push(rect(cx, y - 0.05, cw, h + 0.05, { fill: C.accent, alpha: tint(0.1) }));
      const b = data.badge || 'Выбирают чаще', bw = tw(b, 13, true) + 0.3;   // белый на акценте — от 12 pt жирным (контраст крупного текста)
      els.push(rect(cx + cw - pad - bw, y - 0.21, bw, 0.32, { r: 0.16, fill: C.accent }));
      els.push(text(cx + cw - pad - bw, y - 0.21, bw, 0.32, b, { size: 13, bold: true, color: C.onAccent, align: 'center', valign: 'middle' }));
    }
    els.push(text(tx, y + 0.14, iw, 0.34, t.name, { size: 15, bold: true, color: rec ? C.accentInk : C.ink, valign: 'middle' }));
    els.push(text(tx, y + 0.52, iw, 0.7, [{ t: num(`цена ${t.name}`, t.price, srcOf(t, data, opt), t.digits || 0) }, { t: unitOf(data.unit || '₽'), s: 15, b: false, c: C.muted }], { size: 40, bold: true, color: rec ? C.accentInk : C.ink, valign: 'bottom' }));
    if (t.note) els.push(text(tx, y + 1.28, iw, lh(11) * 2 + 0.02, t.note, { size: 11, color: C.muted, ls: 1.1 }));
    els.push(hline(tx, tx + iw, fy - 0.12, { color: rec ? C.accent : C.axis, lw: rec ? 1.5 : 0.75 }));
    data.features.forEach((f, i) => {
      const v = f.values[j], on = v !== false && v != null, yy = ry[i], d = 0.24, my = yy + lh(fs) / 2;
      // «входит» — точка с галочкой (кодирование, а не символ в строке), «не входит» — тире
      if (on) els.push(oval(tx + d / 2, my, d, { fill: rec ? C.accent : C.bar }), text(tx, my - d / 2, d, d, '✓', { size: 11, bold: true, color: rec ? C.onAccent : onBar(), align: 'center', valign: 'middle' }));
      else els.push(text(tx, yy, d, lh(fs), '—', { size: fs, color: C.muted, align: 'center', valign: 'middle' }));
      els.push(text(tx + MW, yy, iw - MW, nl[i] * lh(fs) + 0.02, labels[i][j], { size: fs, color: on ? C.ink : C.muted, ls: 1.1 }));
    });
  });
  return els;
}

// ═════════════ МОДЕЛЬ И ПРОГНОЗ ═════════════

// Драйверы роста: расходящиеся полосы от нулевой оси, плюсы акцентом вправо, минусы C.bar влево, по убыванию.
// Имя стоит у оси с противоположной стороны полосы, значение — на конце полосы. Внизу чистый эффект — derived sum.
// Вопрос: «что двигает рост, что тянет вниз?»
// data: { label, unit?, digits?, items: [{ name, value (±), src? }], total?: 'Чистый эффект', up?: 'двигает рост', down?: 'тянет вниз' }
function driversDiverging(box, data, opt = {}) {
  const { x, y, w, h } = box, d = data.digits || 0, lab = data.label || 'вклад', els = [];
  const items = [...data.items].sort((a, b) => b.value - a.value), n = items.length;
  const unit = data.unit ? ` ${data.unit}` : '';
  const NW = Math.max(...items.map(it => tw(it.name, 13)), tw(data.total || 'Чистый эффект', 13, true)) + 0.25, VW = 1.35;
  const mp = Math.max(0.001, ...items.map(it => it.value)), mn = Math.max(0.001, ...items.map(it => -it.value));
  const net = items.reduce((a, it) => a + it.value, 0), np = Math.max(mp, net), nn = Math.max(mn, -net);
  const k = Math.min((w - NW - VW) / np, (w - NW - VW) / nn, (w - 2 * VW) / (np + nn));
  const Lw = Math.max(NW, nn * k + VW), Rw = Math.max(NW, np * k + VW), x0 = x + Lw + (w - Lw - Rw) / 2;
  const hy = y, ry = y + 0.45, rh = Math.min(0.56, (h - 0.45 - 0.85) / n), bh = Math.min(0.32, rh * 0.62);
  els.push(text(x, hy, x0 - 0.15 - x, 0.3, data.down || 'тянет вниз', { size: 11, color: C.muted, align: 'right', valign: 'middle' }));
  els.push(text(x0 + 0.15, hy, x + w - x0 - 0.15, 0.3, data.up || 'двигает рост', { size: 11, bold: true, color: C.accentInk, valign: 'middle' }));
  const bar = (yy, v, name, label, src, fill, bold, from) => {
    const cy = yy + rh / 2, bw = Math.max(0.03, Math.abs(v) * k), pos = v >= 0;
    els.push(rect(pos ? x0 : x0 - bw, cy - bh / 2, bw, bh, fill ? { fill } : { line: C.ink, lw: 1.5 }));
    const vt = signed(v, num(label, round(v, d), src, d)) + unit;
    els.push(pos
      ? text(x0 + bw + 0.1, yy, VW - 0.1, rh, vt, { size: 13, bold: true, color: fill === C.accent ? C.accentInk : C.ink, valign: 'middle' })
      : text(x0 - bw - VW, yy, VW - 0.1, rh, vt, { size: 13, bold: true, color: C.ink, align: 'right', valign: 'middle' }));
    els.push(pos
      ? text(x0 - NW, yy, NW - 0.15, rh, name, { size: 13, bold, color: C.ink, align: 'right', valign: 'middle' })
      : text(x0 + 0.15, yy, NW - 0.15, rh, name, { size: 13, bold, color: C.ink, valign: 'middle' }));
  };
  items.forEach((it, i) => bar(ry + i * rh, it.value, it.name, `${lab}: ${it.name}`, srcOf(it, data, opt), it.value >= 0 ? C.accent : C.bar, false));
  const ty = ry + n * rh + 0.2;
  els.push(hline(x, x + w, ty - 0.1, { color: C.axis, lw: 0.75 }));
  bar(ty, net, data.total || 'Чистый эффект', `${lab}: итог`, { type: 'derived', from: items.map(it => `${lab}: ${it.name}`), op: 'sum' }, null, true);
  els.push(vline(x0, ry - 0.08, ty + rh + 0.05, { color: C.axis, lw: 1 }));
  return els;
}

// Прогноз сценариями: по годам тонкая полоса «пессимистичный — оптимистичный» и точка базового сценария,
// базовая траектория линией акцента, края веера — тонкими линиями. Подписи значений справа от полосы.
// Вопрос: «какой прогноз и насколько он уверен?»
// data: { label, unit?, digits?, periods: ['2026', …], rows: [{ base, lo?, hi?, src? }], names?: { lo, base, hi } }
// Год без lo/hi — факт: только точка.
function scenarioRange(box, data, opt = {}) {
  const { x, y, w, h } = box, d = data.digits || 0, n = data.periods.length, els = [];
  const nm = { lo: 'пессимистичный', base: 'базовый', hi: 'оптимистичный', ...(data.names || {}) };
  const RW = opt.rightW || 3.2, gx = x, gw = w - RW, step = gw / n, cx = i => gx + step * (i + 0.5);
  const baseY = y + h - 0.42, top = y + 0.45, mx = Math.max(...data.rows.map(r => r.hi ?? r.base)), py = v => baseY - v / mx * (baseY - top);
  const lab = (k, i) => `${data.label || 'прогноз'} ${data.periods[i]}: ${k === 'base' ? nm.base : nm[k]}`;
  if (data.label) els.push(text(x, y, 4, 0.28, data.label + (data.unit ? `, ${data.unit}` : ''), { size: 11, color: C.muted, valign: 'middle' }));
  els.push(hline(x, x + w, baseY, { color: C.axis, lw: 0.75 }));
  data.periods.forEach((p, i) => els.push(text(cx(i) - step / 2, baseY + 0.1, step, 0.26, p, { size: 11, color: C.muted, align: 'center', valign: 'middle' })));
  data.rows.forEach((r, i) => { if (r.hi != null) els.push(rect(cx(i) - 0.07, py(r.hi), 0.14, py(r.lo) - py(r.hi), { fill: C.accentDim })); });
  // подписи справа от полосы: сначала раскладка, затем линии с разрывом под подписями (без подложек)
  const labs = data.rows.map((r, i) => {
    const src = srcOf(r, data, opt), last = i === n - 1, ks = r.hi != null ? ['hi', 'base', 'lo'] : ['base'];
    const ys = spread(ks.map(k => py(r[k])), 0.3);
    return ks.map((k, m) => {
      const v = num(lab(k, i), r[k], src, d), base = k === 'base';
      const runs = [{ t: v, b: base, c: base ? (last ? C.accentInk : C.ink) : C.muted }];
      if (last) runs.push({ t: ` ${nm[k]}`, c: C.muted });
      const sz = base ? 13 : 11, t = runs.map(q => q.t).join('');
      return { runs, sz, x: cx(i) + 0.17, y: ys[m] - 0.14, w: tw(t, sz, base) * 1.08 + 0.12, h: 0.28 };
    });
  });
  const clip = (q, rects) => {   // части отрезка вне подписей: линия уходит под подпись от самой точки и выходит за ней
    const [x1, y1, x2, y2] = q, N = 120, out = [], at = t => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
    const free = t => { const [px, qy] = at(t); return !rects.some(r => px >= r.x - 0.2 && px <= r.x + r.w + 0.05 && qy >= r.y - 0.02 && qy <= r.y + r.h + 0.02); };
    let s0 = null;
    for (let k = 0; k <= N; k++) {
      const t = k / N, f = free(t);
      if (f && s0 == null) s0 = t;
      if ((!f || k === N) && s0 != null) { const e = f ? t : (k - 1) / N; if (e - s0 > 0.02) out.push([...at(s0), ...at(e)]); s0 = null; }
    }
    return out;
  };
  for (let i = 1; i < n; i++) {
    const a = data.rows[i - 1], b = data.rows[i];
    ['hi', 'lo', 'base'].forEach(k => clip([cx(i - 1), py(a[k] ?? a.base), cx(i), py(b[k] ?? b.base)], labs[i - 1])
      .forEach(q => els.push(seg(...q, k === 'base' ? { color: C.accent, lw: 2 } : { color: C.axis, lw: 0.75, dash: true }))));
  }
  data.rows.forEach((r, i) => els.push(oval(cx(i), py(r.base), 0.2, { fill: C.accent })));
  labs.flat().forEach(l => els.push(text(l.x, l.y, l.w, l.h, l.runs, { size: l.sz, valign: 'middle' })));
  return els;
}

// Точка безубыточности: накопленный результат по месяцам линией из отрезков вокруг нулевой оси,
// минус — нейтральной линией, плюс — акцентом. Выход в плюс отмечен вертикальной меткой с месяцем.
// Вопрос: «когда выйдем в плюс?»
// data: { label, unit?, digits?, values: [накопленный результат по месяцам], every?: 3, src }
// Месяц безубыточности — derived count месяцев до первого неотрицательного значения.
function breakEven(box, data, opt = {}) {
  const { x, y, w, h } = box, d = data.digits || 0, v = data.values, n = v.length, lab = data.label || 'результат', els = [];
  const src = data.src || opt.src, every = data.every || 3, unit = data.unit ? unitOf(data.unit) : '';
  const labs = v.map((_, i) => `${lab} М${i + 1}`);
  v.forEach((val, i) => num(labs[i], val, src, d));
  const gx = x + 1.7, gw = w - 1.7 - 2.0, top = y + 0.95, bot = y + h - 1.05;
  const lo = Math.min(0, ...v), hi = Math.max(0, ...v), px = i => gx + i * gw / (n - 1), py = val => top + (hi - val) / (hi - lo) * (bot - top), y0 = py(0);
  els.push(text(x, y0 - 0.36, 1.5, 0.28, 'в плюсе ↑', { size: 11, color: C.muted, valign: 'middle' }));
  els.push(text(x, y0 + 0.08, 1.5, 0.28, 'в минусе ↓', { size: 11, color: C.muted, valign: 'middle' }));
  // месячные столбики-тени под линией: видно, сколько вложено и сколько вернулось
  const sw = Math.min(0.12, gw / (n - 1) * 0.35);
  v.forEach((val, i) => els.push(rect(px(i) - sw / 2, Math.min(py(val), y0), sw, Math.max(0.01, Math.abs(py(val) - y0)), { fill: val >= 0 ? C.accent : C.bar, alpha: val >= 0 ? tint(0.28) : 0.22 })));
  els.push(hline(gx - 0.15, gx + gw + 0.15, y0, { color: C.axis, lw: 1 }));
  let be = -1;
  for (let i = 1; i < n; i++) {
    const a = v[i - 1], b = v[i], col = q => (q >= 0 ? C.accent : C.ink2), lw = q => (q >= 0 ? 2.5 : 1.75);
    if ((a < 0) !== (b < 0)) {
      const t = a / (a - b), xm = px(i - 1) + t * (px(i) - px(i - 1));
      els.push(seg(px(i - 1), py(a), xm, y0, { color: col(a), lw: lw(a) }), seg(xm, y0, px(i), py(b), { color: col(b), lw: lw(b) }));
      if (be < 0 && a < 0) be = { i, xm };
    } else els.push(seg(px(i - 1), py(a), px(i), py(b), { color: col(b), lw: lw(b) }));
  }
  if (be !== -1) {
    const mT = num('месяц безубыточности', be.i + 1, { type: 'derived', from: labs.slice(0, be.i + 1), op: 'count' });
    const lx = Math.min(Math.max(be.xm - 1.4, x), x + w - 2.8);
    els.push(vline(be.xm, y + 0.72, y0 - 0.12, { color: C.accent, lw: 1.25 }));
    els.push(text(lx, y - 0.02, 2.8, 0.28, 'выход в плюс', { size: 11, color: C.muted, align: 'center', valign: 'middle' }));
    els.push(text(lx, y + 0.24, 2.8, 0.46, `М${mT}`, { size: 26, bold: true, color: C.accentInk, align: 'center', valign: 'middle' }));
    els.push(oval(be.xm, y0, 0.2, { fill: C.accent }));
  }
  // самая глубокая точка и итог
  const m = v.indexOf(lo);
  if (lo < 0) {
    els.push(oval(px(m), py(lo), 0.13, { fill: C.ink2 }));
    els.push(text(px(m) - 1.3, py(lo) + 0.14, 2.6, 0.54, [{ t: minus(num(labs[m], lo, src, d)) + unit, b: true, c: C.ink, s: 13 }, { t: `\nмаксимум вложений, М${m + 1}` }], { size: 11, color: C.muted, align: 'center', ls: 1.1 }));
  }
  els.push(oval(px(n - 1), py(v[n - 1]), 0.13, { fill: C.accent }));
  els.push(text(px(n - 1) + 0.18, py(v[n - 1]) - 0.27, 1.8, 0.54, [{ t: signed(v[n - 1], num(labs[n - 1], v[n - 1], src, d)) + unit, b: true, c: C.accentInk, s: 13 }, { t: `\nк М${n}` }], { size: 11, color: C.muted, ls: 1.1 }));
  for (let i = 0; i < n; i += every) els.push(text(px(i) - 0.4, y + h - 0.3, 0.8, 0.26, `М${i + 1}`, { size: 10, color: C.muted, align: 'center', valign: 'middle' }));
  return els;
}

// ═════════════ ГРАФИКИ ═════════════

// Линейный график 2–4 рядов: подписи рядов на концах линий вместо легенды, главный ряд акцентом,
// остальные C.muted / C.axis, лёгкая сетка по Y. Начальные значения слева, конечные с именем справа.
// Вопрос: «как меняются несколько рядов?»
// data: { label, unit?, digits?, periods: [...], series: [{ name, values, main?, src? }] }
function lineChart(box, data, opt = {}) {
  const { x, y, w, h } = box, d = data.digits || 0, ser = data.series, n = data.periods.length, els = [];
  const LWd = opt.leftW || 0.9, RW = opt.rightW || 2.8, gx = x + LWd, gw = w - LWd - RW;
  const top = y + 0.55, bot = y + h - 0.42, all = ser.flatMap(s => s.values), lo0 = Math.min(...all), hi0 = Math.max(...all), pad = (hi0 - lo0) * 0.08;
  const lo = Math.max(0, lo0 - pad), hi = hi0 + pad, px = i => gx + i * gw / (n - 1), py = v => bot - (v - lo) / (hi - lo) * (bot - top);
  const unit = data.unit === '%' ? '%' : '';
  if (data.label) els.push(text(x, y, 5, 0.28, data.label, { size: 11, color: C.muted, valign: 'middle' }));
  for (let k = 0; k < 4; k++) els.push(hline(gx, gx + gw, top + k * (bot - top) / 4, { color: C.rule, lw: 0.5 }));
  els.push(hline(gx, gx + gw, bot, { color: C.axis, lw: 0.75 }));
  const pw = Math.min(0.9, gw / (n - 1) - 0.06);
  data.periods.forEach((p, i) => els.push(text(px(i) - pw / 2, bot + 0.1, pw, 0.26, p, { size: 11, color: C.muted, align: 'center', valign: 'middle' })));
  const tones = [C.muted, C.axis, C.muted];
  const order = ser.map((s, i) => i).sort((a, b) => !!ser[a].main - !!ser[b].main);   // главный ряд рисуется последним, поверх
  let t = 0;
  const col = ser.map(s => (s.main ? C.accent : tones[t++ % tones.length]));
  order.forEach(i => {
    const s = ser[i];
    for (let k = 1; k < n; k++) els.push(seg(px(k - 1), py(s.values[k - 1]), px(k), py(s.values[k]), { color: col[i], lw: s.main ? 2.75 : 1.5 }));
    els.push(oval(px(0), py(s.values[0]), s.main ? 0.13 : 0.09, { fill: col[i] }), oval(px(n - 1), py(s.values[n - 1]), s.main ? 0.15 : 0.1, { fill: col[i] }));
  });
  const ya = spread(ser.map(s => py(s.values[0])), 0.3), yb = spread(ser.map(s => py(s.values[n - 1])), 0.32);
  ser.forEach((s, i) => {
    const src = srcOf(s, data, opt);
    const a = num(`${s.name} ${data.periods[0]}`, s.values[0], src, d), b = num(`${s.name} ${data.periods[n - 1]}`, s.values[n - 1], src, d);
    els.push(text(x, ya[i] - 0.14, LWd - 0.18, 0.28, a + unit, { size: 11, color: s.main ? C.accentInk : C.muted, bold: !!s.main, align: 'right', valign: 'middle' }));
    els.push(text(gx + gw + 0.2, yb[i] - 0.15, RW - 0.2, 0.3, [{ t: b + unit, b: true, c: s.main ? C.accentInk : C.ink }, { t: ` ${s.name}`, c: s.main ? C.ink : C.ink2, b: !!s.main }], { size: 13, valign: 'middle' }));
  });
  return els;
}

// Столбцы с составом: 2–4 сегмента на период, итог над столбцом (derived sum), легенда одной строкой над графиком.
// Нижний сегмент — главный, акцентом; значения внутри сегментов, если помещаются.
// Вопрос: «как меняется состав во времени?»
// data: { label, unit?, digits?, periods: [...], parts: [{ name, values, src? }] }
function stackedColumns(box, data, opt = {}) {
  const { x, y, w, h } = box, d = data.digits || 0, P = data.parts, n = data.periods.length, lab = data.label || 'значение', els = [];
  const tones = [[C.accent, C.onAccent], [C.bar, onBar()], [C.axis, C.ink], THEME === 'dark' ? [C.line, C.ink] : [C.muted, C.bg]];
  let lx = x;
  P.forEach((p, i) => {
    els.push(rect(lx, y + 0.08, 0.16, 0.16, { fill: tones[i][0] }));
    els.push(text(lx + 0.24, y, tw(p.name, 11) + 0.2, 0.32, p.name, { size: 11, color: C.ink2, valign: 'middle' }));
    lx += 0.24 + tw(p.name, 11) + 0.55;
  });
  if (data.label) els.push(text(x + w - 4, y, 4, 0.32, data.label + (data.unit ? `, ${data.unit}` : ''), { size: 11, color: C.muted, align: 'right', valign: 'middle' }));
  const top = y + 1.0, base = y + h - 0.36, totals = data.periods.map((_, j) => P.reduce((a, p) => a + p.values[j], 0));
  const mx = Math.max(...totals), sc = (base - top) / mx, step = w / n, bw = Math.min(1.0, step * 0.56);
  data.periods.forEach((per, j) => {
    const cx = x + step * (j + 0.5);
    let yy = base;
    P.forEach((p, i) => {
      const v = p.values[j], hh = v * sc, [fill, ink] = tones[i];
      els.push(rect(cx - bw / 2, yy - hh, bw, Math.max(0.01, hh - 0.025), { fill }));
      const vt = num(`${lab}: ${p.name} ${per}`, v, srcOf(p, data, opt), d);
      if (hh >= 0.3 && tw(vt, 12) + 0.1 < bw) els.push(text(cx - bw / 2, yy - hh, bw, hh - 0.025, vt, { size: i === 0 ? 12 : 11, bold: i === 0, color: ink, align: 'center', valign: 'middle' }));
      yy -= hh;
    });
    const tot = num(`${lab}: итого ${per}`, round(totals[j], d), { type: 'derived', from: P.map(p => `${lab}: ${p.name} ${per}`), op: 'sum' }, d);
    els.push(text(cx - step / 2, yy - 0.36, step, 0.3, tot, { size: 13, bold: true, align: 'center', valign: 'bottom' }));
    els.push(text(cx - step / 2, base + 0.08, step, 0.26, per, { size: 11, color: C.muted, align: 'center', valign: 'middle' }));
  });
  els.push(hline(x, x + w, base, { color: C.axis, lw: 0.75 }));
  return els;
}

module.exports = { marketTam, unitEconomics, revenueFormula, cohortGrid, pricingTiers, driversDiverging, scenarioRange, breakEven, lineChart, stackedColumns };
