// Общие помощники библиотеки компонентов: регистрация чисел, единицы, оценка строк, вехи, линии под углом.
const L = require('../lib.js');
const { T, C, THEME, oval, tw, fact, fmt, nb } = L;

// Число на слайде: регистрирует факт с источником и возвращает строку. Без источника сборка падает.
function num(label, v, src, digits = 0) {
  if (!src) throw new Error(`components: у числа «${label}» нет источника (item.src или opt.src)`);
  return fmt(fact(L.PAGE.n, label, v, src, { digits }), digits);
}
const minus = s => s.replace(/^-/, '−');                      // типографский минус у отрицательных
const unitOf = u => !u ? '' : u === '%' ? '%' : `${nb}${u}`;
// Число строк при переносе по словам (калибровка по рендеру Styrene: обычное начертание на 4% шире оценки tw).
// runs — строка или [{t, b, s}]; \n начинает новую строку.
// over — колбэк ширины самой длинной строки (дюймы): слово шире w не переносится, а выходит за край.
function wrap(runs, pt, w, over) {
  let n = 1, x = 0, mx = 0;
  (typeof runs === 'string' ? [{ t: runs }] : runs).forEach(r => {
    const size = r.s || pt, k = r.b ? 1 : 1.04, sp = size * 0.3 / 72;
    String(r.t).split('\n').forEach((part, si) => {
      if (si) { n++; x = 0; }
      part.split(' ').forEach((wd, wi) => {
        const gap = wi > 0 ? sp : 0;
        if (!wd) { x += gap; return; }
        const ww = tw(wd, size, r.b) * k * 1.02;
        if (x > 0 && x + gap + ww > w) { n++; x = ww; } else x += gap + ww;
        mx = Math.max(mx, x);
      });
    });
  });
  if (over) over(mx);
  return n;
}
const lines = (s, pt, w, bold) => wrap([{ t: s, b: !!bold }], pt, w);
// Подбор кегля: наибольший pt от hi до lo с шагом step, при котором runs(pt) встаёт в ширину w одной строкой; не встаёт — null.
// runs(pt) → строка или [{t, b, s}] для wrap(); неразрывный пробел (nb) строку не делит.
function fitPt(runs, w, hi, lo, step = 2) {
  for (let pt = hi; pt >= lo; pt -= step) { let mx = 0; if (wrap(runs(pt), pt, w, v => { mx = v; }) === 1 && mx <= w) return pt; }
  return null;
}
// Неполные данные: показатель известен, только если это конечное число. null, undefined, 'unknown' и строка-причина
// («вне топ-10») — нет данных: такое значение не рисуется, не считается и не попадает в реестр фактов.
const known = v => typeof v === 'number' && Number.isFinite(v);
const NA = 'нет данных';
const naText = (v, dflt = NA) => (typeof v === 'string' && v.trim() && v !== 'unknown' ? v : dflt);
const lh = pt => pt * 1.32 / 72;                              // высота строки при интервале 1,1
const onBar = () => (THEME === 'dark' ? C.bg : C.ink);        // текст на светлой полосе (C.bar)
const diamond = (cx, cy, d, o = {}) => ({ t: 'diamond', x: cx - d / 2, y: cy - d / 2, w: d, h: d, ...o });
// Отрезок между двумя точками под любым углом: pptx-линия задаётся боксом, подъём вправо — через flipV
const seg = (x1, y1, x2, y2, o = {}) => {
  if (x2 < x1) [x1, y1, x2, y2] = [x2, y2, x1, y1];
  return { t: 'line', x: x1, y: Math.min(y1, y2), w: x2 - x1, h: Math.abs(y2 - y1), flipV: y2 < y1, ...o };
};
// Подложка цвета фона под подписью, через которую проходит линия: линия уходит под текст
const knock = (x, y, w, h) => L.rect(x, y, w, h, { r: Math.min(h / 2, 0.14), fill: C.bg });

// Спарклайн: отрезки 1,25 pt, последняя точка акцентом. Чисел не показывает и фактов не регистрирует.
function sparkline(x, y, w, h, values, { color = C.muted, dot = true } = {}) {
  const lo = Math.min(...values), hi = Math.max(...values), k = hi > lo ? h / (hi - lo) : 0;
  const px = i => x + i * w / (values.length - 1), py = v => y + h - (v - lo) * k;
  const els = [];
  for (let i = 1; i < values.length; i++) els.push(seg(px(i - 1), py(values[i - 1]), px(i), py(values[i]), { color, lw: 1.25 }));
  if (dot) els.push(oval(px(values.length - 1), py(values[values.length - 1]), 0.1, { fill: C.accent }));
  return els;
}

// Раздвигает центры подписей по вертикали не ближе gap друг к другу, порядок сохраняется
function spread(ys, gap = 0.32) {
  const o = ys.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  for (let k = 1; k < o.length; k++) o[k].v = Math.max(o[k].v, o[k - 1].v + gap);
  return o.sort((a, b) => a.i - b.i).map(e => e.v);
}

// ───────── схемы (kit/schemes.js и семейства схем, reference/19-schemes.md) ─────────
// Узел-карточка схемы: на тёмной теме — тон карточки, на светлой — белая; hub — рамка акцента 2 pt.
const card = (x, y, w, h, o = {}) => L.rect(x, y, w, h, { r: o.r ?? 0.14, fill: THEME === 'dark' ? C.card : C.panel, alpha: THEME === 'dark' ? C.cardA : 1,
  line: o.hub ? C.accent : C.cardLine, lw: o.hub ? 2 : 0.75 });
// Стиль связи: solid — акцент 1,75 pt, dashed — пунктир цвета оси (оперативная, вторичная), muted — тонкая ось
const tone = kind => (kind === 'dashed' ? { color: C.axis, lw: 1.25, dash: true } : kind === 'muted' ? { color: C.axis, lw: 1.25 } : { color: C.accent, lw: 1.75 });
const toneInk = kind => (kind === 'dashed' || kind === 'muted' ? C.muted : C.accentInk);
// Наконечник стрелки: острие в (x, y), deg — направление (0 вправо, 90 вниз, 180 влево, 270 вверх), s — длина
function head(x, y, deg, color = C.accent, s = 0.14) {
  const r = deg * Math.PI / 180, cx = x - Math.cos(r) * s / 2, cy = y - Math.sin(r) * s / 2;
  return { t: 'tri', x: cx - s * 0.45, y: cy - s / 2, w: s * 0.9, h: s, rot: (deg + 90) % 360, fill: color };
}
// Точка на границе прямоугольника r по лучу из его центра к (tx, ty); то же для эллипса
function clipRect(r, tx, ty) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, dx = tx - cx, dy = ty - cy;
  const k = Math.min(dx ? r.w / 2 / Math.abs(dx) : Infinity, dy ? r.h / 2 / Math.abs(dy) : Infinity);
  return [cx + dx * k, cy + dy * k];
}
function clipOval(cx, cy, rx, ry, tx, ty) {
  const a = Math.atan2((ty - cy) / ry, (tx - cx) / rx);
  return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
}
// Дуга эллипса ломаной (a0 → a1 в градусах, по часовой при a1 > a0): массив отрезков seg()
function arc(cx, cy, rx, ry, a0, a1, o = {}, n = 0) {
  n = n || Math.max(6, Math.ceil(Math.abs(a1 - a0) / 6));
  const pt = a => [cx + rx * Math.cos(a * Math.PI / 180), cy + ry * Math.sin(a * Math.PI / 180)], out = [];
  for (let i = 0; i < n; i++) { const [x1, y1] = pt(a0 + (a1 - a0) * i / n), [x2, y2] = pt(a0 + (a1 - a0) * (i + 1) / n); out.push(seg(x1, y1, x2, y2, o)); }
  return out;
}
// Подпись связи: ТЕГ капителью цвета связи и пояснение строкой ниже. inline — в одну строку через em-пробел.
// Кегль 9,5; самое длинное слово не входит в ширину — кегль снижается до 8, слово не рвётся.
function edgeLabel(e, w, inline = false, base = 9.5) {
  const ink = toneInk(e.kind), tag = e.tag ? String(e.tag).toUpperCase() : '';
  if (inline && L.tw(tag, base, true) * 1.3 + L.tw(e.text || '', base) * 1.08 + 0.2 < w) {
    const runs = [];
    if (tag) runs.push({ t: tag, b: true, c: ink });
    if (e.text) runs.push({ t: (tag ? ' ' : '') + e.text, c: C.ink2 });
    return { runs, h: lh(base) + 0.04, pt: base };
  }
  // капитель шире строчных: запас 1,3 к оценке ширины слова и 1,12 к кеглю при переносе (иначе «УВЕДОМЛЕНИЕ» вылезает)
  const widest = Math.max(0, ...tag.split(/\s+/).map(s => L.tw(s, 1, true) * 1.3), ...String(e.text || '').split(/\s+/).map(s => L.tw(s, 1) * 1.1));
  const pt = [base, 9, 8.5, 8].find(p => widest * p <= w) || 8;
  if (widest * pt > w) console.warn(`схема: подпись «${tag || e.text}» шире места (${w.toFixed(2)}″) — сократите слово`);
  const runs = [];
  let n = 0;
  if (tag) { runs.push({ t: tag, b: true, c: ink }); n += wrap([{ t: tag, b: true }], pt * 1.12, w); }
  if (e.text) { runs.push({ t: (runs.length ? '\n' : '') + e.text, c: C.ink2 }); n += wrap([{ t: e.text }], pt, w); }
  return { runs, h: lh(pt) * n + 0.04, pt };
}
// Плашка на связи или узел-пилюля: центр (cx, cy), ширина по тексту
function pill(cx, cy, s, o = {}) {
  const pt = o.pt || 11, h = o.h || 0.36, w = o.w || L.tw(s, pt, true) * 1.08 + 0.5;
  const fillC = o.fill || C.accent;
  return { w, h, els: [L.rect(cx - w / 2, cy - h / 2, w, h, { r: h / 2, fill: fillC, ...(o.line ? { line: o.line, lw: o.lw || 1 } : {}) }),
    L.text(cx - w / 2, cy - h / 2, w, h, s, { size: pt, bold: true, color: o.color || C.onAccent, align: 'center', valign: 'middle' })] };
}
// Узел типографикой: имя жирным и пункты с точкой акцента. measure: true — только высота. Возвращает { els, h }.
function stack(x, y, w, node, o = {}) {
  const np = o.name || 14, ip = o.item || 10.5, align = o.align || 'left', els = [];
  const nl = wrap([{ t: node.name, b: true }], np, w), nh = lh(np) * nl;
  if (!o.measure) els.push(L.text(x, y, w, nh + 0.02, node.name, { size: np, bold: true, color: o.color || C.ink, align, ls: 1.05 }));
  let yy = y + nh + (node.items && node.items.length ? 0.1 : 0);
  if (node.note) {
    const k = wrap([{ t: node.note }], ip, w);
    if (!o.measure) els.push(L.text(x, yy, w, lh(ip) * k + 0.02, node.note, { size: ip, color: C.muted, align, ls: 1.1 }));
    yy += lh(ip) * k + 0.06;
  }
  (node.items || []).forEach(t => {
    const iw = w - 0.18, k = wrap([{ t }], ip, iw), ix = align === 'right' ? x : x + 0.18;
    if (!o.measure) {
      els.push(L.oval(align === 'right' ? x + w - 0.05 : x + 0.05, yy + lh(ip) / 2, 0.06, { fill: C.accent }));
      els.push(L.text(ix, yy, iw, lh(ip) * k + 0.02, t, { size: ip, color: C.ink2, align, ls: 1.1 }));
    }
    yy += lh(ip) * k + 0.05;
  });
  return { els, h: yy - y };
}

module.exports = { card, tone, toneInk, head, clipRect, clipOval, arc, edgeLabel, pill, stack, wrap, num, minus, unitOf, lines, fitPt, known, NA, naText, lh, onBar, diamond, seg, knock, sparkline, spread };
