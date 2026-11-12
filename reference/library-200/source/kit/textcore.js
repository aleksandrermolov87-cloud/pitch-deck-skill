// Текстовые раскладки: тезис, повестка, раздел, резюме, выводы, принципы, глоссарий, вопросы, цитаты, за и против.
// На слайде только текст, порядок держат кегль, сетка колонок, тонкие линии и одно акцентное пятно.
// В галерее и в деке архетип таких слайдов начинается с «text-»: аудит проверяет объём (до 90 слов в теле), а не бан простых слайдов.
// API как в components.js: (box, data, opt) → els. По умолчанию текст не заходит на фирменные полосы справа (opt.full — на всю ширину box).
// Число внутри фразы пишется как «{n}» и берётся из value / unit / digits / label / src пункта: так оно регистрируется фактом.
const L = require('../lib.js');
const U = require('./util.js');
const { T, C, hline, vline, tw, nb } = L;
const { num, minus, unitOf, lh, wrap } = U;

// ── помощники модуля ──
const SX = T.bg && T.bg.stripes ? T.canvas.w * T.bg.stripes[0][0] - 0.1 : Infinity;   // левый край фирменных полос
const rightOf = (box, opt) => Math.min(box.x + box.w, opt.right ?? (opt.full ? Infinity : SX));
const asRuns = r => (typeof r === 'string' ? [{ t: r }] : r);
// Короткие слова (предлоги, союзы, частицы до 2 букв) приклеиваются к следующему неразрывным пробелом
const glue = s => String(s).replace(/(?<=^|[\s«(])([а-яёa-z]{1,2}) /gi, `$1${nb}`);
const gl = runs => asRuns(runs).map(r => ({ ...r, t: glue(r.t) }));
const text = (x, y, w, h, runs, o) => L.text(x, y, w, h, gl(runs), o);                // весь текст модуля — с приклеенными предлогами
const nl = (runs, pt, w) => wrap(gl(runs), pt, w * 0.96 - 0.04);                  // строк после переноса, с запасом 4% на неразрывные связки
const hOf = (runs, pt, w) => lh(pt) * nl(runs, pt, w) + 0.04;                           // высота бокса под текст
const pick = (sizes, ok) => sizes.find(ok) || sizes[sizes.length - 1];                   // крупнейший кегль, который помещается
// Висячее слово: последнее слово уходит на свою строку одно (у крупного текста это заметно)
function widow(runs, pt, w) {
  const rs = asRuns(runs).map(r => ({ ...r })), last = rs[rs.length - 1], cut = last.t.replace(/\s*\S+\s*$/, '');
  if (!cut.trim() && rs.length === 1) return false;
  const n = nl(rs, pt, w);
  last.t = cut;
  return n > 1 && nl(rs.filter(r => r.t), pt, w) < n;
}

// Акцентное слово: подстрока accent красится C.accentInk, остальное — как в o
function accentRuns(s, accent, o = {}) {
  s = glue(s); accent = accent && glue(accent);
  const i = accent ? s.indexOf(accent) : -1;
  if (i < 0) return [{ t: s, ...o }];
  return [{ t: s.slice(0, i), ...o }, { t: accent, ...o, c: C.accentInk }, { t: s.slice(i + accent.length), ...o }].filter(r => r.t);
}
// Число в фразе: «{n}» → num(label, value, src) с единицей, знак «+» у роста (sign), «−» у отрицательных; число жирным
function numStr(it, label, src) {
  const v = num(it.label || label, it.value, it.src || src, it.digits || 0);
  return (it.sign && it.value > 0 ? '+' : '') + minus(v) + unitOf(it.unit);
}
function numRuns(s, it, label, src, o = {}) {
  s = glue(s);
  if (!s.includes('{n}')) return [{ t: s, ...o }];
  const [a, b] = s.split('{n}');
  return [{ t: a, ...o }, { t: numStr(it, label, src), ...o, b: true }, { t: b, ...o }].filter(r => r.t);
}

// ═════════════ ТЕЗИС И НАВИГАЦИЯ ═════════════

// Один тезис крупно, акцентное слово, внизу одна строка доказательства. Вопрос: «какой главный вывод?»
// Тезис до 12 слов: кегль 54…40 pt подбирается под 3 строки. Доказательство — число 30 pt, фраза и источник мелко.
// data: { kicker?, thesis, accent?: 'подстрока тезиса', proof?: { value, unit?, digits?, sign?, label, text, source?, src? }, src? }
function statementHero(box, data, opt = {}) {
  const { x, y, h } = box, R = rightOf(box, opt), w = R - x, els = [], src = data.src || opt.src, p = data.proof;
  const thesis = accentRuns(data.thesis, data.accent, { b: true });
  const py = p ? y + h - (p.source ? 0.92 : 0.7) : y + h;            // линия над доказательством
  const top = y + (data.kicker ? 0.6 : 0.1), avail = py - 0.4 - top;
  const size = opt.size || pick([54, 50, 46, 42, 40], pt => nl(thesis, pt, w) <= 3 && hOf(thesis, pt, w) <= avail && !widow(thesis, pt, w));
  const th = hOf(thesis, size, w);
  els.push(hline(x, x + 0.6, y + 0.14, { color: C.accent, lw: 3 }));
  if (data.kicker) els.push(text(x + 0.85, y, w - 0.85, 0.28, data.kicker, { size: 10.5, color: C.muted, valign: 'middle' }));
  els.push(text(x, top + Math.max(0, avail - th) * 0.4, w, th, thesis, { size, bold: true, ls: 1.1 }));
  if (p) {
    els.push(hline(x, R, py, { color: C.rule, lw: 0.75 }));
    const ns = numStr(p, p.label, src), nw = tw(ns, 30, true) + 0.2;
    els.push(text(x, py + 0.12, nw, 0.56, ns, { size: 30, bold: true, valign: 'middle' }));
    els.push(text(x + nw + 0.15, py + 0.16, w - nw - 0.15, lh(15) + 0.02, p.text, { size: 15, color: C.ink2, valign: 'middle' }));
    if (p.source) els.push(text(x + nw + 0.15, py + 0.2 + lh(15), w - nw - 0.15, lh(10.5) + 0.02, p.source, { size: 10.5, color: C.muted, valign: 'middle' }));
  }
  return els;
}

// Повестка с временем: время и длительность слева, тема жирно, «что решаем» одной строкой. Вопрос: «о чём встреча и сколько займёт?»
// Текущий пункт — акцентная черта слева и время акцентом, пройденные пункты приглушены.
// data: { total?: 'строка, например «90 минут»', items: [{ time, dur?, name, goal, current?: true }] } — 4–6 пунктов. Время — обычный текст.
function agendaTimed(box, data, opt = {}) {
  const { x, y, h } = box, R = rightOf(box, opt), w = R - x, els = [], n = data.items.length;
  const TW = opt.timeW || 1.55, NW = opt.nameW || (w - TW) * 0.42, nx = x + TW, gx = nx + NW + 0.35, gw = R - gx;
  const headH = 0.4, rh = Math.min(opt.rowH || 0.86, (h - headH - 0.08) / n), cur = data.items.findIndex(it => it.current);
  const head = (t, xx, ww, al = 'left') => text(xx, y, ww, headH - 0.08, t, { size: 11, color: C.muted, align: al, valign: 'bottom' });
  els.push(head('Время', x + 0.25, TW - 0.3), head('Тема', nx, NW), head('Что решаем', gx, gw * 0.6));
  if (data.total) els.push(head(data.total, R - gw * 0.38, gw * 0.38, 'right'));
  els.push(hline(x, R, y + headH, { color: C.axis, lw: 0.75 }));
  data.items.forEach((it, i) => {
    const yy = y + headH + i * rh, past = cur >= 0 && i < cur, now = i === cur;
    if (i) els.push(hline(x, R, yy, { color: C.rule, lw: 0.5 }));
    if (now) els.push(vline(x + 0.02, yy + 0.14, yy + rh - 0.14, { color: C.accent, lw: 3.5 }));
    const runs = [{ t: it.time, b: true, c: now ? C.accentInk : past ? C.muted : C.ink }];
    if (it.dur) runs.push({ t: `\n${it.dur}`, s: 11, c: C.muted });
    els.push(text(x + 0.25, yy, TW - 0.3, rh, runs, { size: 17, valign: 'middle' }));
    els.push(text(nx, yy, NW, rh, it.name, { size: 17, bold: true, color: past ? C.muted : C.ink, valign: 'middle' }));
    els.push(text(gx, yy, gw, rh, it.goal, { size: 15, color: past ? C.muted : C.ink2, valign: 'middle' }));
  });
  return els;
}

// Разделитель раздела: карта разделов сверху, крупное название, строка «что внутри», справа 3–4 вопроса раздела.
// Вопрос: «что в этом разделе?» Текущий раздел на карте — акцентная линия и подпись акцентом.
// data: { sections?: ['Рынок', …], current?: индекс в sections, title, inside, qHead?, questions: [строка ×3–4] }
function sectionDivider(box, data, opt = {}) {
  const { x, y, h } = box, R = rightOf(box, opt), w = R - x, els = [];
  if (data.sections) {
    const g = 0.2, sw = (w - g * (data.sections.length - 1)) / data.sections.length;
    data.sections.forEach((s, i) => {
      const sx = x + i * (sw + g), on = i === data.current;
      els.push(hline(sx, sx + sw, y + 0.04, { color: on ? C.accent : C.axis, lw: on ? 3 : 0.75 }));
      els.push(text(sx, y + 0.16, sw, 0.26, s, { size: 11, bold: on, color: on ? C.accentInk : C.muted, valign: 'middle' }));
    });
  }
  const LWc = opt.titleW || w * 0.54, qx = x + LWc + 0.6, qw = R - qx, bottom = y + h - 0.04;
  // справа: вопросы раздела над линиями, снизу вверх от общей базы
  const qTop = y + (data.sections ? 0.85 : 0), gap = 0.32;
  // вопросы на равном шаге: линии идут ровным ритмом, даже если вопрос в одну строку
  const qMax = pt => Math.max(...data.questions.map(q => hOf(q, pt, qw)));
  const qSum = pt => 0.36 + (qMax(pt) + gap) * data.questions.length;
  const qs_ = pick([15, 14, 13], pt => qSum(pt) <= bottom - qTop), qs = data.questions.map(() => qMax(qs_));
  const qH = qSum(qs_);
  let qy = bottom - qH;
  els.push(text(qx, qy, qw, 0.26, data.qHead || 'Ответим на вопросы', { size: 11, color: C.muted, valign: 'middle' }));
  qy += 0.36;
  data.questions.forEach((q, i) => {
    els.push(hline(qx, R, qy + 0.1, { color: C.rule, lw: 0.75 }));
    els.push(text(qx, qy + 0.22, qw, qs[i], q, { size: qs_, color: C.ink, ls: 1.1 }));
    qy += qs[i] + gap;
  });
  els.push(vline(qx - 0.3, bottom - qH, bottom, { color: C.rule, lw: 0.75 }));
  // слева: название и «что внутри» на той же базе
  const avail = bottom - (y + (data.sections ? 0.7 : 0));
  const title = glue(data.title), inside = glue(data.inside), ih = hOf(inside, 18, LWc);
  const size = pick([60, 54, 48, 44, 40], pt => nl(title, pt, LWc) <= 2 && hOf(title, pt, LWc) + 0.2 + ih <= avail);
  const th = hOf(title, size, LWc);
  els.push(text(x, bottom - ih - 0.2 - th, LWc, th, title, { size, bold: true, ls: 1.1 }));
  els.push(text(x, bottom - ih, LWc, ih, inside, { size: 18, color: C.ink2, ls: 1.1 }));
  return els;
}

// ═════════════ ВЫВОДЫ ═════════════

// Резюме деки: 3–5 выводов строками через линии. Число акцентом слева, вывод жирно, пояснение справа.
// Вопрос: «что главное в деке?» data: { items: [{ value?, unit?, digits?, sign?, label?, head, d, src? }], src? }
function executiveSummary(box, data, opt = {}) {
  const { x, y, h } = box, R = rightOf(box, opt), w = R - x, els = [], src = data.src || opt.src, n = data.items.length;
  const nums = data.items.map(it => it.value == null ? null : {
    v: (it.sign && it.value > 0 ? '+' : '') + minus(num(it.label || it.head, it.value, it.src || src, it.digits || 0)), u: unitOf(it.unit) });
  const NW = opt.numW || Math.max(1.4, ...nums.filter(Boolean).map(m => tw(m.v, 30, true) + tw(m.u, 18, true) + 0.3));
  const hx = x + NW + 0.3, HW = opt.headW || (R - hx) * 0.46, dx = hx + HW + 0.35, dw = R - dx;
  const rh = Math.min(opt.rowH || 1.3, h / n);
  data.items.forEach((it, i) => {
    const yy = y + i * rh, m = nums[i];
    els.push(hline(x, R, yy, { color: i ? C.rule : C.axis, lw: 0.75 }));
    if (m) els.push(text(x, yy, NW, rh, [{ t: m.v }, ...(m.u ? [{ t: m.u, s: 18 }] : [])], { size: 30, bold: true, color: C.accentInk, valign: 'middle' }));
    els.push(text(hx, yy, HW, rh, it.head, { size: 18, bold: true, valign: 'middle', ls: 1.1 }));
    els.push(text(dx, yy, dw, rh, numRuns(it.d, it, `${it.head}: пояснение`, src), { size: 15, color: C.ink2, valign: 'middle', ls: 1.1 }));
  });
  return els;
}

// Три вывода колонками: первые 2–3 слова крупно, под ними 2 строки пояснения. Над колонками — фраза-связка.
// Вопрос: «что унести с встречи?» Каждую колонку открывает тонкая линия с короткой акцентной чертой.
// data: { lead?, accent?: 'подстрока lead', items: [{ head, d, value?, unit?, digits?, label?, src? } ×3] }
function keyTakeaways(box, data, opt = {}) {
  const { x, y, h } = box, R = rightOf(box, opt), w = R - x, els = [], src = data.src || opt.src, n = data.items.length;
  const gap = opt.gap || 0.5, cw = (w - gap * (n - 1)) / n;
  const ds = data.items.map(it => numRuns(it.d, it, `${it.head}: пояснение`, src));
  const hs = pick([30, 28, 26, 24], pt => data.items.every(it => nl([{ t: it.head, b: true }], pt, cw) <= 2));
  const headH = Math.max(...data.items.map(it => hOf([{ t: it.head, b: true }], hs, cw)));
  const dH = Math.max(...ds.map(r => hOf(r, 15, cw)));
  const colH = 0.3 + headH + 0.14 + dH, cy = y + h - colH;
  if (data.lead) {
    const lw = Math.min(w, opt.leadW || w * 0.8), runs = accentRuns(data.lead, data.accent);
    const lt = hOf(runs, 22, lw);
    els.push(text(x, y + Math.max(0, (cy - y - lt) * 0.35), lw, lt, runs, { size: 22, ls: 1.1 }));
  }
  data.items.forEach((it, i) => {
    const cx = x + i * (cw + gap);
    els.push(hline(cx, cx + cw, cy, { color: C.axis, lw: 0.75 }), hline(cx, cx + 0.6, cy, { color: C.accent, lw: 3 }));
    els.push(text(cx, cy + 0.3, cw, headH, it.head, { size: hs, bold: true, ls: 1.1 }));
    els.push(text(cx, cy + 0.3 + headH + 0.14, cw, dH, ds[i], { size: 15, color: C.ink2, ls: 1.1 }));
  });
  return els;
}

// Принципы сеткой 2×2, 3×2 или 2×3: название жирно, одна строка смысла, тонкая линия над каждым.
// Вопрос: «по каким правилам работаем?» Принцип с accent: true — акцентная линия и название акцентом (один на слайд).
// data: { items: [{ name, d, accent? }] } — 4–6 принципов. opt.cols — число колонок (по умолчанию 3 при 5–6, иначе 2).
function principles(box, data, opt = {}) {
  const { x, y, h } = box, R = rightOf(box, opt), w = R - x, els = [], n = data.items.length;
  const cols = opt.cols || (n > 4 ? 3 : 2), rows = Math.ceil(n / cols), gap = opt.gap || 0.5, cw = (w - gap * (cols - 1)) / cols;
  const ns = pick([20, 19, 18, 17], pt => data.items.every(it => nl([{ t: it.name, b: true }], pt, cw) <= 1));
  const nHs = data.items.map(it => hOf([{ t: it.name, b: true }], ns, cw)), nH = Math.max(...nHs);
  const dH = Math.max(...data.items.map(it => hOf(it.d, 15, cw)));
  const cellH = 0.24 + nH + 0.1 + dH;
  const step = rows > 1 ? Math.min((h - cellH) / (rows - 1), cellH + (opt.rowGap || 0.85)) : 0;
  const gy = y + (h - (step * (rows - 1) + cellH)) / 2;
  data.items.forEach((it, i) => {
    const cx = x + (i % cols) * (cw + gap), cy = gy + Math.floor(i / cols) * step;
    els.push(hline(cx, cx + cw, cy, it.accent ? { color: C.accent, lw: 2.5 } : { color: C.axis, lw: 0.75 }));
    els.push(text(cx, cy + 0.24, cw, nHs[i], it.name, { size: ns, bold: true, color: it.accent ? C.accentInk : C.ink, ls: 1.1 }));
    els.push(text(cx, cy + 0.24 + nHs[i] + 0.1, cw, hOf(it.d, 15, cw), it.d, { size: 15, color: C.ink2, ls: 1.1 }));
  });
  return els;
}

// ═════════════ СЛОВА, ВОПРОСЫ, ГОЛОСА ═════════════

// Глоссарий: висячие термины в левой колонке, определения справа, строки через тонкие линии.
// Вопрос: «что значат термины?» Термин с accent: true — акцентом (главный термин деки).
// data: { heads?: ['Термин', 'Что значит'], items: [{ term, d, accent? }] } — 5–8 пар. opt.termW — ширина колонки терминов.
function glossary(box, data, opt = {}) {
  const { x, y, h } = box, R = rightOf(box, opt), w = R - x, els = [], n = data.items.length;
  const TW = opt.termW || 2.7, dx = x + TW, dw = R - dx, headH = 0.4, heads = data.heads || ['Термин', 'Что значит'];
  const rh = Math.min(opt.rowH || 0.78, (h - headH - 0.06) / n);
  const ds = pick([15, 14, 13], pt => data.items.every(it => hOf(it.d, pt, dw) <= rh - 0.08));
  const ts = pick([16, 15, 14], pt => data.items.every(it => hOf([{ t: it.term, b: true }], pt, TW - 0.3) <= rh - 0.06));
  els.push(text(x, y, TW - 0.3, headH - 0.08, heads[0], { size: 11, color: C.muted, valign: 'bottom' }));
  els.push(text(dx, y, dw, headH - 0.08, heads[1], { size: 11, color: C.muted, valign: 'bottom' }));
  els.push(hline(x, R, y + headH, { color: C.axis, lw: 0.75 }));
  data.items.forEach((it, i) => {
    const yy = y + headH + i * rh;
    if (i) els.push(hline(x, R, yy, { color: C.rule, lw: 0.5 }));
    els.push(text(x, yy, TW - 0.3, rh, it.term, { size: ts, bold: true, color: it.accent ? C.accentInk : C.ink, valign: 'middle', ls: 1.1 }));
    els.push(text(dx, yy, dw, rh, it.d, { size: ds, color: C.ink2, valign: 'middle', ls: 1.1 }));
  });
  return els;
}

// Вопросы и ответы: вопрос жирно с акцентной чертой слева, ответ в две строки справа, пары через линии.
// Вопрос зрителя: «какие вопросы зададут?» data: { items: [{ q, a, value?, unit?, digits?, label?, src? }] } — 3–4 пары, «{n}» в ответе.
function faqPairs(box, data, opt = {}) {
  const { x, y, h } = box, R = rightOf(box, opt), w = R - x, els = [], src = data.src || opt.src, n = data.items.length;
  const QW = opt.qW || w * 0.42, ax = x + QW + 0.4, aw = R - ax, rh = Math.min(opt.rowH || 1.4, h / n);
  data.items.forEach((it, i) => {
    const yy = y + i * rh, ar = numRuns(it.a, it, `${it.q}: ответ`, src);
    const qh = hOf([{ t: it.q, b: true }], 17, QW - 0.3), ah = hOf(ar, 15, aw), top = yy + (rh - Math.max(qh, ah)) / 2;
    if (i) els.push(hline(x, R, yy, { color: C.rule, lw: 0.75 }));
    els.push(vline(x + 0.02, top + 0.04, top + qh - 0.06, { color: C.accent, lw: 3 }));
    els.push(text(x + 0.3, top, QW - 0.3, qh, it.q, { size: 17, bold: true, ls: 1.1 }));
    els.push(text(ax, top + 0.02, aw, ah, ar, { size: 15, color: C.ink2, ls: 1.1 }));
  });
  return els;
}

// Стена цитат: главная цитата крупно слева, 1–2 короткие справа за тонкой вертикалью, подписи авторов мелко.
// Вопрос: «что говорят клиенты и эксперты?» Кавычки-ёлочки ставятся сами, в главной цитате можно выделить фразу (accent).
// data: { items: [{ q, who, role?, main? }], accent?: 'подстрока главной цитаты' } — 2–3 цитаты, без кавычек в q.
function quoteWall(box, data, opt = {}) {
  const { x, y, h } = box, R = rightOf(box, opt), w = R - x, els = [];
  const main = data.items.find(it => it.main) || data.items[0], rest = data.items.filter(it => it !== main);
  const MW = opt.mainW || w * 0.56, rx = x + MW + 0.6, rw = R - rx;
  const sig = it => [{ t: it.who, b: true, c: C.ink }, ...(it.role ? [{ t: `, ${it.role}`, c: C.muted }] : [])];
  const sigH = (it, ww) => hOf(sig(it), 13, ww);
  const by = (it, xx, yy, ww) => text(xx, yy, ww, sigH(it, ww), sig(it), { size: 13, ls: 1.1 });
  // главная
  const mq = accentRuns(`«${main.q}»`, data.accent), msh = sigH(main, MW);
  const ms = pick([32, 30, 28, 26, 24], pt => hOf(mq, pt, MW) + 0.3 + msh <= h - 0.4 && nl(mq, pt, MW) <= 5);
  const mh = hOf(mq, ms, MW), mtop = y + 0.3 + (h - 0.3 - (mh + 0.3 + msh)) * 0.4;
  els.push(hline(x, x + 0.6, mtop - 0.24, { color: C.accent, lw: 3 }));
  els.push(text(x, mtop, MW, mh, mq, { size: ms, bold: true, valign: 'bottom', ls: 1.1 }));
  els.push(by(main, x, mtop + mh + 0.3, MW));
  // остальные: равные доли высоты, линия между ними
  els.push(vline(rx - 0.3, y, y + h, { color: C.rule, lw: 0.75 }));
  const slot = h / Math.max(1, rest.length);
  rest.forEach((it, i) => {
    const q = `«${it.q}»`, qh = hOf(q, 18, rw), sh = sigH(it, rw), sy = y + i * slot, top = sy + (slot - (qh + 0.18 + sh)) / 2;
    if (i) els.push(hline(rx, R, sy, { color: C.rule, lw: 0.75 }));
    els.push(text(rx, top, rw, qh, q, { size: 18, color: C.ink, valign: 'bottom', ls: 1.1 }));
    els.push(by(it, rx, top + qh + 0.18, rw));
  });
  return els;
}

// За и против: две колонки по 3–4 аргумента под общей линией, внизу строка вывода с акцентной линией над ней.
// Вопрос: «какие аргументы за и против?» data: { heads?: ['За', 'Против'], pros: [{ t, d? }], cons: [{ t, d? }],
//   verdict: { t, value?, unit?, digits?, label?, src? } } — «{n}» в t и d подставляет число пункта.
// Кегли аргументов (18/15, 17/14, 16/13) подбираются так, чтобы самая длинная колонка поместилась над выводом.
function prosCons(box, data, opt = {}) {
  const { x, y, h } = box, R = rightOf(box, opt), w = R - x, els = [], src = data.src || opt.src;
  const heads = data.heads || ['За', 'Против'], gap = 0.8, cw = (w - gap) / 2, cols = [data.pros, data.cons];
  const v = data.verdict, vr = [{ t: 'Вывод: ', b: true, c: C.accentInk }, ...numRuns(v.t, v, 'вывод', src, { c: C.ink })];
  const vh = hOf(vr, 18, w), vy = y + h - vh, ly = vy - 0.22;
  els.push(hline(x, R, ly, { color: C.accent, lw: 2 }));
  els.push(text(x, vy, w, vh, vr, { size: 18, ls: 1.1 }));
  const iy = y + 0.72, bottom = ly - 0.3, n = Math.max(...cols.map(c => c.length)), ig = 0.36;
  const runsOf = cols.map((items, j) => items.map(it => ({
    t: numRuns(it.t, it, `${heads[j]}: ${it.t}`, src, { b: true }),
    d: it.d ? numRuns(it.d, it, `${heads[j]}: ${it.t}`, src) : null,
  })));
  const itemH = (r, [ts, ds]) => hOf(r.t, ts, cw) + (r.d ? 0.02 + hOf(r.d, ds, cw) : 0);
  const sz = pick([[18, 15], [17, 14], [16, 13]], s => runsOf.every(rs => rs.reduce((a, r) => a + itemH(r, s), 0) + ig * (rs.length - 1) <= bottom - iy));
  // общий шаг строк для обеих колонок: аргументы стоят на одних уровнях
  const rowH = Math.max(...runsOf.flatMap(rs => rs.map(r => itemH(r, sz))));
  const step = Math.min(rowH + 0.6, n > 1 ? (bottom - iy - rowH) / (n - 1) : 0);
  els.push(vline(x + cw + gap / 2, y, bottom, { color: C.rule, lw: 0.75 }));
  runsOf.forEach((rs, j) => {
    const cx = x + j * (cw + gap);
    els.push(text(cx, y, cw, 0.44, heads[j], { size: 24, bold: true, valign: 'middle' }));
    els.push(hline(cx, cx + cw, y + 0.56, { color: C.axis, lw: 0.75 }));
    rs.forEach((r, i) => {
      const sy = iy + i * step, th = hOf(r.t, sz[0], cw);
      if (i) els.push(hline(cx, cx + cw, sy - Math.min(0.18, (step - rowH) / 2), { color: C.rule, lw: 0.5 }));
      els.push(text(cx, sy, cw, th, r.t, { size: sz[0], ls: 1.1 }));
      if (r.d) els.push(text(cx, sy + th + 0.02, cw, hOf(r.d, sz[1], cw), r.d, { size: sz[1], color: C.ink2, ls: 1.1 }));
    });
  });
  return els;
}

module.exports = { statementHero, agendaTimed, sectionDivider, executiveSummary, keyTakeaways, principles, glossary, faqPairs, quoteWall, prosCons };
