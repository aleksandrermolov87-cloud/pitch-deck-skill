// Примитивы, шапка слайда и реестр фактов. Координаты — дюймы холста theme.canvas (13,333 × 7,5).
// Каждое число на слайде проходит через fact(): facts_check.py сверяет его с источником.
const T = require('./theme.json');
const THEME = process.env.THEME || 'dark';
const C = T.palette[THEME];
const { w: W, h: H, margin: M } = T.canvas;

// ── примитивы ──
const rect = (x, y, w, h, o = {}) => ({ t: 'rect', x, y, w, h, ...o });
const oval = (cx, cy, d, o = {}) => ({ t: 'oval', x: cx - d / 2, y: cy - d / 2, w: d, h: d, ...o });
const hline = (x1, x2, y, o = {}) => ({ t: 'line', x: x1, y, w: x2 - x1, h: 0, ...o });
const vline = (x, y1, y2, o = {}) => ({ t: 'line', x, y: y1, w: 0, h: y2 - y1, ...o });
const image = (x, y, w, h, file, o = {}) => ({ t: 'image', x, y, w, h, file, ...o });
// 3D-объект MagicPatterns по роли: card | hero | row | sticker (размер из theme.prompt3d.sizes), файл — вырезанный PNG в img/3d/
const obj3d = (x, y, file, placement = 'card') => {
  const d = T.prompt3d.sizes[placement];
  if (!require('fs').existsSync(require('path').join(__dirname, 'img', '3d', file))) { console.warn(`нет 3D-объекта ${file}: слайд собран без него`); return { t: 'skip' }; }
  return image(x, y, d, d, `3d/${file}`, { contain: true, obj3d: placement });
};
// Размещение у якоря (reference/09-3d-objects.md, раздел 6): zone — свободная зона внутри или рядом с якорем,
// optical — сторона квадрата равной видимой площади (″): у всей серии одинаковая, поэтому объекты выглядят одного размера.
// align: 'bottom' (стоят на одной базе), 'center', 'top'. На тёмной теме под объектом свечение акцента.
function place3d(zone, file, { optical = 1.3, align = 'bottom', glow = true } = {}) {
  const fs = require('fs'), path = require('path');
  const mp = path.join(__dirname, 'img', '3d', file.replace(/\.png$/, '.json'));
  if (!fs.existsSync(mp)) { console.warn(`нет 3D-объекта ${file}: слайд собран без него`); return []; }
  const meta = JSON.parse(fs.readFileSync(mp, 'utf8'));
  const r = meta.w / meta.h;
  let h = optical / Math.sqrt(r * meta.fill), w = h * r;
  const k = Math.min(1, zone.w / w, zone.h / h); w *= k; h *= k;
  const x = zone.x + (zone.w - w) / 2;
  const y = align === 'top' ? zone.y : align === 'center' ? zone.y + (zone.h - h) / 2 : zone.y + zone.h - h;
  const els = [];
  if (glow && THEME === 'dark') els.push(oval(x + w / 2, y + h - 0.04, Math.min(w * 0.85, 2.4), { fill: C.accent, alpha: 0.16, h: 0.16, y: y + h - 0.12, x: x + w / 2 - Math.min(w * 0.85, 2.4) / 2 }));
  els.push(image(x, y, w, h, `3d/${file}`, { obj3d: 'placed' }));
  return els;
}
// runs: строка или [{t, c, b, s, thin}]
const text = (x, y, w, h, runs, o = {}) => ({ t: 'text', x, y, w, h, runs: typeof runs === 'string' ? [{ t: runs }] : runs, ...o });
// ширина строки в дюймах — для оценки переноса до рендера
const tw = (s, pt, bold = false) => s.length * pt * (bold ? T.font.widthKBold : T.font.widthK) / 72;
const snap = v => Math.round(v / T.canvas.step) * T.canvas.step;

// ── факты ──
// src: { type: 'xlsx', sheet, cells: ['B15'], agg: 'value'|'sum'|'ratio'|'share_of', den?: 'D20', scale?: 1e6 }
//      { type: 'text', file: 'brief.md', quote: '…' }   — число должно встречаться в цитате, цитата — в файле
//      { type: 'user', date: '2026-10-26', quote: '…' } — из сообщения пользователя
//      { type: 'derived', from: ['label A', 'label B'], op: 'sum'|'ratio'|'diff' } — посчитано из других фактов
const FACTS = [];
function fact(slide, label, value, src, o = {}) {
  FACTS.push({ slide, label, value, digits: o.digits ?? 0, ...src, scale: src.scale ?? 1 });
  return value;
}
const nb = ' ';
const fmt = (v, d = 0) => v.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/\s/g, nb);
// число из ячейки xlsx в млн с одним знаком: mln(2, 'доход за год', 84612345, {sheet:'Итоги', cells:['D20']})
const mln = (slide, label, raw, src) => fmt(fact(slide, label, Math.round(raw / 1e5) / 10, { type: 'xlsx', agg: src.cells.length > 1 ? 'sum' : 'value', ...src, scale: 1e6 }, { digits: 1 }), 1);

// ── шапка: заголовок с акцентом, знак, плашка, подзаголовок, панель тела, подвал ──
let PAGE = { n: 0, total: 0, footer: true };
function chrome({ title, pill, sub, source, panel = true }) {
  const plain = Array.isArray(title) ? title.map(r => r.t).join('') : title;
  const tsize = Math.max(T.type.titleMin, Math.min(T.type.title, Math.floor(11.2 * 72 / (plain.length * T.font.widthKBold))));
  const els = [
    text(M, T.canvas.top, 11.2, 0.78, title, { size: tsize, bold: true, valign: 'middle', id: `s${PAGE.n}-title` }),
    text(W - M - 0.45, T.canvas.top, 0.45, 0.46, T.mark.text, { size: T.mark.size, bold: true, align: 'center', valign: 'middle' }),
    rect(W - M - 0.36, T.canvas.top + 0.48, 0.27, 0.045, { fill: C.ink }),
  ];
  let x = M;
  if (pill) {
    const pw = tw(pill, 12, true) + 0.5;
    els.push(rect(M, 1.26, pw, 0.36, { r: 0.18, fill: C.accent }));
    els.push(text(M, 1.26, pw, 0.36, pill, { size: 12, bold: true, color: C.onAccent, align: 'center', valign: 'middle' }));
    x += pw + 0.22;
  }
  if (sub) els.push(text(x, 1.26, W - M - x, 0.36, sub, { size: T.type.sub, color: C.ink2, valign: 'middle', id: `s${PAGE.n}-sub` }));
  if (panel) els.push(rect(M, T.canvas.bodyTop, W - 2 * M, T.canvas.bodyBottom - T.canvas.bodyTop, { r: 0.22, fill: C.panel, alpha: C.panelA, line: C.line, lw: 1 }));
  if (PAGE.footer && !process.env.NOFOOTER) {
    if (source) els.push(text(M, 6.94, 11.2, 0.4, source, { size: T.type.caption, color: C.muted, valign: 'middle', ls: 1.12, id: `s${PAGE.n}-src` }));
    els.push(text(W - M - 0.73, 6.98, 0.73, 0.3, `${PAGE.n} / ${PAGE.total}`, { size: T.type.caption, color: C.muted, align: 'right', valign: 'middle' }));
  }
  return els;
}

module.exports = { T, THEME, C, W, H, M, rect, oval, hline, vline, image, obj3d, place3d, text, tw, snap, FACTS, fact, fmt, mln, nb, chrome, PAGE };
