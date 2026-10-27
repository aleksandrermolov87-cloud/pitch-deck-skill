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

module.exports = { wrap, num, minus, unitOf, lines, fitPt, known, NA, naText, lh, onBar, diamond, seg, knock, sparkline, spread };
