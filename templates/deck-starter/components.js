// Библиотека компонентов слайда. Каталог, вопросы зрителя и превью: $SKILL/components/README.md.
// Каждый компонент — функция (box, data, opt) → массив элементов для els. box = { x, y, w, h } в дюймах холста.
// Компонент не рисует шапку: её даёт chrome() из lib.js, компонент заполняет тело.
// Каждое показанное число проходит через fact(): источник берётся из item.src, иначе из opt.src. Нет источника — ошибка сборки.
// Цвет и шрифт только из theme.json (C.*), рамок и зебры нет: порядок держат сетка, линии и воздух (reference/10-beyond-blocks.md).
const L = require('./lib.js');
const { T, C, THEME, rect, oval, hline, vline, text, tw, fact, fmt, nb } = L;

// ── общее: помощники в kit/util.js, расширения библиотеки в kit/*.js (подключаются в конце файла) ──
const U = require('./kit/util.js');
const { num, minus, unitOf, lines, lh, onBar, diamond, sparkline } = U;

// ═════════════ ВРЕМЯ ═════════════

// Открытая ось с вехами и маркером «сейчас». Вопрос: «что и когда выходит?»
// data: { ticks: ['Янв', …], now: { at, label?, note? }, items: [{ at, name, value?, unit?, valueLabel?, note, src }] }
// at — позиция на шкале в делениях (0 — начало первого деления, 0.5 — его середина). Близкие вехи собираются в кластер.
// Источник структуры: Release Cycle Timeline (21st 29956), Timeline slide-cn (28298).
function timelineAxis(box, data, opt = {}) {
  const { x, y, w } = box, n = data.ticks.length, LW = opt.labelW || 2.5;
  const x0 = x + 0.1, x1 = x + w - 0.1, step = (x1 - x0) / n, cx = a => x0 + a * step;
  const ay = y + 0.72, els = [];
  data.ticks.forEach((t, i) => els.push(text(x0 + i * step, ay - 0.42, step, 0.22, t, { size: 9.5, color: C.muted, align: 'center', valign: 'middle' })));
  const nowX = data.now ? cx(data.now.at) : null;
  els.push(hline(x0, x1, ay, { color: C.axis, lw: 1.25, arrow: true }));
  if (nowX) {
    els.push(hline(x0, nowX, ay, { color: C.accent, lw: 3 }));
    els.push(vline(nowX, ay - 0.18, ay + 0.18, { color: C.accent, lw: 2 }));
    els.push(text(nowX - 0.04, y - 0.06, 4, 0.24, [{ t: data.now.label || 'Сейчас', b: true, c: C.accentInk }, { t: data.now.note ? `: ${data.now.note}` : '' }], { size: 10, color: C.muted, valign: 'middle' }));
  }
  const clusters = [];
  [...data.items].sort((a, b) => a.at - b.at).forEach(it => {
    const last = clusters[clusters.length - 1];
    if (last && cx(it.at) - cx(last[0].at) < LW + 0.2) last.push(it); else clusters.push([it]);
  });
  clusters.forEach(cl => {
    const xa = cx(cl[0].at), xb = cx(cl[cl.length - 1].at), ly = ay + 0.62;
    if (cl.length > 1 && xb > xa) els.push(hline(xa, xb, ay + 0.28, { color: C.accent, lw: 1.5 }));
    els.push(vline(xa, ay + 0.12, ly - 0.06, { color: C.rule, lw: 0.75 }));
    let yy = ly;
    const lw = Math.min(LW, x + w - xa - 0.12);
    cl.forEach(it => {
      const nl = lines(it.name, 12, lw, true);
      els.push(text(xa + 0.12, yy, lw, lh(12) * nl + 0.02, it.name, { size: 12, bold: true, ls: 1.1 }));
      yy += lh(12) * nl + 0.06;
      const runs = [];
      if (it.value != null) runs.push({ t: `${num(it.valueLabel || `${it.name}: значение`, it.value, it.src || opt.src, it.digits || 0)}${unitOf(it.unit)}`, c: C.accentInk, b: true });
      if (it.note) runs.push({ t: (runs.length ? '\n' : '') + it.note });
      if (runs.length) {
        const nn = (it.value != null ? 1 : 0) + (it.note ? lines(it.note, 10.5, lw) : 0);
        els.push(text(xa + 0.12, yy, lw, lh(10.5) * nn + 0.02, runs, { size: 10.5, color: C.ink2, ls: 1.1 }));
        yy += lh(10.5) * nn + 0.18;
      }
    });
  });
  data.items.forEach(it => {
    const done = nowX && cx(it.at) <= nowX;
    els.push(oval(cx(it.at), ay, 0.22, { fill: done ? C.accent : C.bg, line: C.accent, lw: 1.5 }));
    if (!done) els.push(oval(cx(it.at), ay, 0.1, { fill: C.accent }));
  });
  return els;
}

// Гант по дорожкам с маркером «сегодня». Вопрос: «кто что делает параллельно?»
// data: { periods: ['I кв.', …], today?, groups: [{ name, lanes: [{ name, bars: [{ from, to, label?, tone: 'accent'|'bar'|'dim' }], milestones?: [{ at, label }] }] }] }
// from/to/at — в делениях шкалы (0…periods.length). Источник структуры: Gantt Chart (21st 38523), Gantt (632).
function ganttLanes(box, data, opt = {}) {
  const { x, y, w, h } = box, LW = opt.labelW || 2.3, n = data.periods.length;
  const gx = x + LW, gw = w - LW, step = gw / n, px = a => gx + a * step;
  const lanesN = data.groups.reduce((a, g) => a + g.lanes.length, 0);
  const headH = 0.4, groupH = 0.3, laneH = Math.min(0.62, (h - headH - groupH * data.groups.length) / lanesN);
  const els = [];
  data.periods.forEach((p, i) => {
    els.push(text(px(i), y, step, 0.28, p, { size: 10, color: C.muted, align: 'center', valign: 'middle' }));
    if (i) els.push(vline(px(i), y + headH - 0.06, y + headH + groupH * data.groups.length + laneH * lanesN, { color: C.rule, lw: 0.75 }));
  });
  els.push(hline(x, x + w, y + headH - 0.06, { color: C.axis, lw: 0.75 }));
  let yy = y + headH;
  const lanesBottom = y + headH + groupH * data.groups.length + laneH * lanesN;
  if (data.today != null) {   // линия «сегодня» под полосами: подписи полос лежат поверх неё
    const tx = px(data.today);
    els.push(vline(tx, y - 0.02, lanesBottom + 0.05, { color: C.accent, lw: 1.5 }));
    els.push(text(tx - 0.6, y - 0.3, 1.2, 0.22, 'Сегодня', { size: 9, bold: true, color: C.accentInk, align: 'center', valign: 'middle' }));
  }
  data.groups.forEach(g => {
    els.push(text(x, yy + 0.02, LW - 0.2, groupH - 0.04, g.name.toUpperCase(), { size: 9, bold: true, color: C.muted, valign: 'middle' }));
    yy += groupH;
    g.lanes.forEach(ln => {
      els.push(text(x, yy, LW - 0.2, laneH, ln.name, { size: 12, valign: 'middle' }));
      const bh = Math.min(0.3, laneH * 0.52), by = yy + (laneH - bh) / 2;
      ln.bars.forEach(b => {
        const fill = b.tone === 'accent' ? C.accent : b.tone === 'dim' ? C.accentDim : C.bar;
        const bx = px(b.from), bw = px(b.to) - bx;
        els.push(rect(bx, by, bw, bh, { r: 0.04, fill }));
        if (b.label) {
          const fits = tw(b.label, 12, true) + 0.2 < bw;
          const col = b.tone === 'accent' ? C.onAccent : b.tone === 'dim' ? C.ink : onBar();
          els.push(fits
            ? text(bx + 0.1, by, bw - 0.2, bh, b.label, { size: 12, bold: true, color: col, valign: 'middle' })
            : text(bx + bw + 0.08, by - 0.02, Math.max(0.6, x + w - bx - bw - 0.1), bh + 0.04, b.label, { size: 10, color: C.ink2, valign: 'middle' }));
        }
      });
      (ln.milestones || []).forEach(m => {
        els.push(diamond(px(m.at), by + bh / 2, 0.2, { fill: C.ink }));
        if (m.label) {
          const mw = tw(m.label, 9.5) + 0.1, right = px(m.at) + 0.16 + mw <= x + w;
          els.push(text(right ? px(m.at) + 0.16 : px(m.at) - 0.16 - mw, yy - 0.04, mw, 0.22, m.label, { size: 9.5, color: C.ink2, align: right ? 'left' : 'right', valign: 'middle' }));
        }
      });
      yy += laneH;
    });
  });
  return els;
}

// Сейчас / Следом / Потом без дат. Вопрос: «что сейчас, что следом, что потом?»
// Плотность падает слева направо, уверенность показывает линия над колонками: сплошная акцентная → сплошная → пунктир.
// data: { cols: [{ head, items: [{ t, d? }] } ×3] }. Источник структуры: Roadmap Board (21st 28420), без карточек.
function nowNextLater(box, data) {
  const { x, y, w } = box, gap = 0.5, cw = (w - gap * 2) / 3, els = [];
  const style = [{ lw: 3, color: C.accent, size: 18, dsize: 13 }, { lw: 1.5, color: C.axis, size: 15, dsize: 13 }, { lw: 1.5, color: C.axis, dash: true, size: 15, dsize: 0 }];
  data.cols.forEach((col, i) => {
    const cx = x + i * (cw + gap), s = style[i];
    els.push(hline(cx, cx + cw + (i < 2 ? gap : 0), y + 0.04, { color: s.color, lw: s.lw, dash: s.dash, arrow: i === 2 }));
    els.push(oval(cx + 0.09, y + 0.04, i === 0 ? 0.18 : 0.14, { fill: i === 0 ? C.accent : C.bg, line: i === 0 ? C.accent : C.axis, lw: 1.25 }));
    els.push(text(cx, y + 0.34, cw, 0.5, col.head, { size: 24, bold: true, color: i === 0 ? C.accentInk : C.ink, valign: 'middle' }));
    let yy = y + 1.15;
    col.items.forEach(it => {
      const nl = lines(it.t, s.size, cw, true);
      els.push(text(cx, yy, cw, lh(s.size) * nl + 0.02, it.t, { size: s.size, bold: i < 2, color: i === 2 ? C.ink2 : C.ink, ls: 1.1 }));
      yy += lh(s.size) * nl + 0.04;
      if (it.d && s.dsize) {
        const dl = lines(it.d, s.dsize, cw);
        els.push(text(cx, yy, cw, lh(s.dsize) * dl + 0.02, it.d, { size: s.dsize, color: C.muted, ls: 1.1 }));
        yy += lh(s.dsize) * dl;
      }
      yy += 0.42;
    });
  });
  return els;
}

// Горизонт по кварталам: строки-направления, отметки кварталов, пунктир «без срока». Вопрос: «куда идём за 2–3 года?»
// data: { years: [{ name, quarters: 4 }], rows: [{ name, marks: [индексы кварталов от 0], open?: true, accent?: true }] }
function quarterHorizon(box, data, opt = {}) {
  const { x, y, w, h } = box, LW = opt.labelW || 2.6;
  const nq = data.years.reduce((a, yr) => a + yr.quarters, 0), gx = x + LW, step = (w - LW) / nq, qx = q => gx + (q + 0.5) * step;
  const rowH = Math.min(0.7, (h - 0.7) / data.rows.length), els = [];
  let q0 = 0;
  data.years.forEach((yr, i) => {
    els.push(text(gx + q0 * step, y, yr.quarters * step, 0.3, yr.name, { size: 13, bold: true, color: i === 0 ? C.accentInk : C.ink, valign: 'middle' }));
    for (let k = 0; k < yr.quarters; k++) els.push(text(gx + (q0 + k) * step, y + 0.3, step, 0.22, ['I', 'II', 'III', 'IV'][k % 4], { size: 9, color: C.muted, align: 'center', valign: 'middle' }));
    if (i) els.push(vline(gx + q0 * step, y, y + 0.6 + rowH * data.rows.length, { color: C.rule, lw: 0.75 }));
    q0 += yr.quarters;
  });
  els.push(hline(x, x + w, y + 0.58, { color: C.axis, lw: 0.75 }));
  data.rows.forEach((r, i) => {
    const yy = y + 0.66 + i * rowH, cy = yy + rowH / 2, col = r.accent ? C.accent : C.ink2;
    els.push(text(x, yy, LW - 0.2, rowH, r.name, { size: 12.5, bold: !!r.accent, valign: 'middle' }));
    const ms = [...r.marks].sort((a, b) => a - b);
    if (ms.length > 1) els.push(hline(qx(ms[0]), qx(ms[ms.length - 1]), cy, { color: col, lw: 1.5 }));
    if (r.open) els.push(hline(qx(ms[ms.length - 1]), x + w - 0.05, cy, { color: C.axis, lw: 1.25, dash: true }));
    ms.forEach(m => els.push(rect(qx(m) - 0.09, cy - 0.09, 0.18, 0.18, { fill: col })));
    if (i < data.rows.length - 1) els.push(hline(x, x + w, yy + rowH, { color: C.rule, lw: 0.5 }));
  });
  if (data.rows.some(r => r.open)) {
    const ly = y + 0.66 + data.rows.length * rowH + 0.17;
    els.push(hline(x + w - 1.75, x + w - 1.3, ly, { color: C.axis, lw: 1.25, dash: true }));
    els.push(text(x + w - 1.2, ly - 0.11, 1.2, 0.22, 'без срока', { size: 9.5, color: C.muted, valign: 'middle' }));
  }
  return els;
}

// ═════════════ ТАБЛИЦЫ ═════════════

// Редакционная таблица: без рамок и зебры, линия под шапкой и над итогом, числа по правому краю.
// data: { cols: [{ key, label, w (доля ширины), type: 'text'|'num'|'bar'|'trend', digits?, unit? }], rows: [{ name, note?, src?, lead?, …значения }], total?: { name, src?, …значения }, highlight?: key }
// Тип bar — полоса без дорожки + значение; trend — спарклайн из массива (чисел не показывает).
// Первая колонка — key 'name'. Источник структуры: Bench Matrix (21st 29454), Paired Bars (29470), InlineAnalyticsTable (7475).
function tableEditorial(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [];
  const sumW = data.cols.reduce((a, c) => a + c.w, 0), gap = 0.25;
  let cx = x;
  const cols = data.cols.map(c => { const cw = c.w / sumW * (w - gap * (data.cols.length - 1)); const o = { ...c, x: cx, cw }; cx += cw + gap; return o; });
  const headH = 0.36, totalH = data.total ? 0.6 : 0, rh = Math.min(opt.rowH || 0.95, (h - headH - 0.15 - totalH) / data.rows.length);
  const hl = cols.find(c => c.key === data.highlight);
  if (hl) els.push(rect(hl.x - gap / 2, y - 0.08, hl.cw + gap, headH + 0.2 + rh * data.rows.length + totalH, { fill: C.accent, alpha: THEME === 'dark' ? 0.1 : 0.07 }));
  cols.forEach(c => els.push(text(c.x, y, c.cw, headH - 0.06, c.label + (c.unit ? `, ${c.unit}` : ''), { size: 10, color: C.muted, align: c.type === 'num' ? 'right' : 'left', valign: 'bottom' })));
  els.push(hline(x, x + w, y + headH, { color: C.axis, lw: 0.75 }));
  const maxOf = k => Math.max(...data.rows.map(r => Math.abs(r[k] || 0)));
  const big = rh >= 0.8, nameCol = cols.find(c => c.key === 'name');
  const vs = !big ? 14 : [20, 18, 16, 14].find(pt => data.rows.every(r => tw(r.name, pt, true) <= nameCol.cw - 0.1)) || 13;
  data.rows.forEach((r, i) => {
    const yy = y + headH + 0.12 + i * rh, src = r.src || opt.src, lead = !!r.lead;
    cols.forEach(c => {
      if (c.key === 'name') {
        els.push(text(c.x, yy, c.cw, big ? 0.4 : rh - 0.1, r.name, { size: vs, bold: true, valign: 'middle' }));
        if (r.note && big) els.push(text(c.x, yy + 0.42, c.cw, 0.26, r.note, { size: 10, color: C.muted, valign: 'middle' }));
      } else if (c.type === 'num') {
        els.push(text(c.x, yy, c.cw, big ? 0.4 : rh - 0.1, num(`${c.label} ${r.name}`, r[c.key], src, c.digits || 0), { size: vs, bold: lead || c.key === data.highlight, color: lead && c.key === data.highlight ? C.accentInk : C.ink, align: 'right', valign: 'middle' }));
      } else if (c.type === 'bar') {
        const bw = Math.max(0.04, Math.abs(r[c.key]) / maxOf(c.key) * (c.cw - 0.9));
        els.push(rect(c.x, yy + (big ? 0.11 : (rh - 0.1) / 2 - 0.09), bw, 0.18, { fill: lead ? C.accent : C.bar }));
        els.push(text(c.x + bw + 0.1, yy, 0.8, big ? 0.4 : rh - 0.1, num(`${c.label} ${r.name}`, r[c.key], src, c.digits || 0) + (c.unit === '%' ? '%' : ''), { size: 12, color: C.ink2, valign: 'middle' }));
      } else if (c.type === 'trend') {
        els.push(...sparkline(c.x + 0.05, yy + (big ? 0.06 : 0.04), c.cw - 0.15, big ? 0.3 : rh - 0.2, r[c.key], { color: lead ? C.accent : C.muted }));
      } else {
        els.push(text(c.x, yy, c.cw, big ? 0.4 : rh - 0.1, String(r[c.key] ?? '—'), { size: big ? 14 : 12, color: C.ink2, valign: 'middle' }));
      }
    });
  });
  if (data.total) {
    const ty = y + headH + 0.12 + data.rows.length * rh + 0.04, src = data.total.src || opt.src;
    els.push(hline(x, x + w, ty, { color: C.ink2, lw: 1.5 }));
    cols.forEach(c => {
      if (c.key === 'name') els.push(text(c.x, ty + 0.12, c.cw, 0.4, data.total.name || 'Итого', { size: 16, bold: true, valign: 'middle' }));
      else if (c.type === 'num' && data.total[c.key] != null) els.push(text(c.x, ty + 0.12, c.cw, 0.4, num(`${c.label} итого`, data.total[c.key], src, c.digits || 0), { size: 16, bold: true, align: 'right', valign: 'middle' }));
    });
  }
  return els;
}

// Тепловая матрица продукт × канал: насыщенность акцента по величине, итоги вне сетки.
// data: { rows: [имя], cols: [имя], values: [[…]], digits?, label?, src, totals?: true }
function heatmap(box, data, opt = {}) {
  const { x, y, w, h } = box, LW = opt.labelW || 2.2, tot = data.totals !== false, els = [];
  const nc = data.cols.length, nr = data.rows.length, gap = 0.06;
  const gw = w - LW - (tot ? 1.3 : 0), cw = (gw - gap * (nc - 1)) / nc, ch = Math.min(0.75, (h - 0.45 - (tot ? 0.6 : 0)) / nr - gap);
  const max = Math.max(...data.values.flat()), d = data.digits || 0, src = data.src || opt.src, lab = data.label || 'значение';
  data.cols.forEach((c, j) => els.push(text(x + LW + j * (cw + gap), y, cw, 0.36, c, { size: 10.5, color: C.muted, align: 'center', valign: 'bottom' })));
  if (tot) els.push(text(x + LW + gw + 0.2, y, 1.1, 0.36, 'Итого', { size: 10.5, bold: true, color: C.muted, align: 'right', valign: 'bottom' }));
  data.rows.forEach((r, i) => {
    const yy = y + 0.45 + i * (ch + gap);
    els.push(text(x, yy, LW - 0.2, ch, r, { size: 12.5, bold: true, valign: 'middle' }));
    data.values[i].forEach((v, j) => {
      const a = v ? 0.12 + 0.88 * v / max : 0, xx = x + LW + j * (cw + gap);
      els.push(rect(xx, yy, cw, ch, { fill: v ? C.accent : C.rule, alpha: v ? Math.min(1, +a.toFixed(2)) : 0.6 }));
      els.push(text(xx, yy, cw, ch, v ? num(`${lab}: ${r} × ${data.cols[j]}`, v, src, d) : '—', { size: 12, bold: a >= 0.9, color: a >= 0.9 ? C.onAccent : v ? C.ink : C.muted, align: 'center', valign: 'middle' }));
    });
    if (tot) els.push(text(x + LW + gw + 0.2, yy, 1.1, ch, num(`${lab}: ${r} итого`, data.values[i].reduce((a, b) => a + b, 0), { type: 'derived', from: data.cols.map(c => `${lab}: ${r} × ${c}`).filter((_, j) => data.values[i][j]), op: 'sum' }, d), { size: 13, bold: true, align: 'right', valign: 'middle' }));
  });
  if (tot) {
    const ty = y + 0.45 + nr * (ch + gap) + 0.06;
    els.push(hline(x + LW, x + w, ty, { color: C.axis, lw: 0.75 }));
    data.cols.forEach((c, j) => {
      const s = data.values.reduce((a, row) => a + row[j], 0);
      els.push(text(x + LW + j * (cw + gap), ty + 0.08, cw, 0.36, num(`${lab}: ${c} итого`, s, { type: 'derived', from: data.rows.map(r => `${lab}: ${r} × ${c}`).filter((_, i) => data.values[i][j]), op: 'sum' }, d), { size: 13, bold: true, align: 'center', valign: 'middle' }));
    });
  }
  return els;
}

// Сравнение вариантов с рекомендуемой колонкой. Вопрос: «что выбрать?»
// data: { options: [{ name, note?, recommended? }], rows: [{ name, values: [true | false | 'текст'] }] }
// Источник структуры: Comparison Table (21st 26827), Feature Comparison (21218).
function comparison(box, data, opt = {}) {
  const { x, y, w, h } = box, LW = opt.labelW || 3.4, n = data.options.length, cw = (w - LW) / n, els = [];
  const rh = Math.min(0.6, (h - 0.95) / data.rows.length);
  data.options.forEach((o, j) => {
    const xx = x + LW + j * cw;
    if (o.recommended) {
      els.push(rect(xx + 0.05, y - 0.1, cw - 0.1, 0.95 + rh * data.rows.length + 0.05, { fill: C.accent, alpha: THEME === 'dark' ? 0.12 : 0.08 }));
      els.push(rect(xx + cw / 2 - 0.8, y - 0.38, 1.6, 0.34, { r: 0.17, fill: C.accent }));
      els.push(text(xx + cw / 2 - 0.8, y - 0.38, 1.6, 0.34, 'Рекомендуем', { size: 12, bold: true, color: C.onAccent, align: 'center', valign: 'middle' }));
    }
    els.push(text(xx + 0.1, y, cw - 0.2, 0.6, o.name, { size: 15, bold: true, color: o.recommended ? C.accentInk : C.ink, align: 'center', valign: 'bottom', ls: 1.0 }));
    if (o.note) els.push(text(xx + 0.1, y + 0.6, cw - 0.2, 0.24, o.note, { size: 10, color: C.muted, align: 'center', valign: 'middle' }));
  });
  els.push(hline(x, x + w, y + 0.9, { color: C.axis, lw: 0.75 }));
  data.rows.forEach((r, i) => {
    const yy = y + 0.95 + i * rh;
    els.push(text(x, yy, LW - 0.2, rh, r.name, { size: 12.5, valign: 'middle' }));
    r.values.forEach((v, j) => {
      const xx = x + LW + j * cw;
      // «да» — залитая точка с галочкой (кодирование, а не символ в строке), «нет» — тире
      if (v === true) els.push(oval(xx + cw / 2, yy + rh / 2, 0.3, { fill: data.options[j].recommended ? C.accent : C.bar }), text(xx + cw / 2 - 0.15, yy + rh / 2 - 0.15, 0.3, 0.3, '✓', { size: 12, bold: true, color: data.options[j].recommended ? C.onAccent : onBar(), align: 'center', valign: 'middle' }));
      else if (v === false || v == null) els.push(text(xx, yy, cw, rh, '—', { size: 12.5, color: C.muted, align: 'center', valign: 'middle' }));
      else els.push(text(xx + 0.1, yy, cw - 0.2, rh, String(v), { size: 12.5, color: C.ink2, align: 'center', valign: 'middle' }));
    });
    if (i < data.rows.length - 1) els.push(hline(x, x + w, yy + rh, { color: C.rule, lw: 0.5 }));
  });
  return els;
}

// ═════════════ ЧИСЛА ═════════════

// Число-герой с инфографикой состава или тренда под ним. data: { value, digits?, unit?, label, caption, src?, series?: { periods, values } }
function kpiHero(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [];
  els.push(text(x, y, w, 1.3, [{ t: num(data.label, data.value, data.src || opt.src, data.digits || 0) }, { t: unitOf(data.unit), s: 30 }], { size: 72, bold: true, color: C.accentInk, valign: 'bottom' }));
  const cl = lines(data.caption, 15, w);
  els.push(text(x, y + 1.38, w, lh(15) * cl + 0.04, data.caption, { size: 15, color: C.ink2, ls: 1.1 }));
  if (data.series) {
    const s = data.series, mx = Math.max(...s.values), base = y + h - 0.32, bh = Math.min(1.3, h - 1.6 - lh(15) * cl - 0.5);
    const bw = Math.min(0.62, w / s.values.length * 0.62), g = Math.min(0.34, w / s.values.length * 0.38);
    s.values.forEach((v, i) => {
      const hh = v / mx * bh, xx = x + i * (bw + g), last = i === s.values.length - 1;
      els.push(rect(xx, base - hh, bw, hh, { r: 0.04, fill: last ? C.accent : C.bar }));
      els.push(text(xx - 0.2, base + 0.08, bw + 0.4, 0.24, s.periods[i], { size: 10, color: C.muted, align: 'center', valign: 'middle' }));
    });
    els.push(hline(x, x + s.values.length * (bw + g) - g, base, { color: C.axis, lw: 0.75 }));
  }
  return els;
}

// Столбец вторичных чисел, разделённых линиями (не карточки). data: { items: [{ value, digits?, unit?, label, caption, src? }] }
function kpiList(box, data, opt = {}) {
  const { x, y, w, h } = box, rh = h / data.items.length, nw = opt.numW || 2.4, els = [];
  data.items.forEach((k, i) => {
    const yy = y + i * rh;
    if (i) els.push(hline(x, x + w, yy, { color: C.rule, lw: 0.75 }));
    els.push(text(x, yy + rh / 2 - 0.3, nw, 0.6, num(k.label, k.value, k.src || opt.src, k.digits || 0) + unitOf(k.unit), { size: 30, bold: true, valign: 'middle' }));
    els.push(text(x + nw + 0.1, yy + rh / 2 - 0.3, w - nw - 0.1, 0.6, k.caption, { size: 14, color: C.ink2, valign: 'middle', ls: 1.1 }));
  });
  return els;
}

// Столбики по периодам: последний акцентом, значения над столбиками, скобка роста «×N» от первого к последнему.
// data: { label, periods, values, digits?, src?, growth?: true }
function barsTrend(box, data, opt = {}) {
  const { x, y, w, h } = box, n = data.values.length, d = data.digits || 0, src = data.src || opt.src, els = [];
  const growth = data.growth !== false && n > 1, top = growth ? 0.75 : 0.35;
  const base = y + h - 0.32, maxH = h - top - 0.4, mx = Math.max(...data.values), step = w / n, bw = Math.min(0.7, step * 0.56);
  const labels = data.periods.map(p => `${data.label} ${p}`);
  data.values.forEach((v, i) => {
    const hh = v / mx * maxH, cx = x + step * (i + 0.5), last = i === n - 1;
    els.push(rect(cx - bw / 2, base - hh, bw, hh, { r: 0.04, fill: last ? C.accent : C.bar }));
    els.push(text(cx - 0.6, base - hh - 0.32, 1.2, 0.28, num(labels[i], v, src, d), { size: 12, bold: last, align: 'center', valign: 'bottom' }));
    els.push(text(cx - 0.6, base + 0.08, 1.2, 0.24, data.periods[i], { size: 10, color: C.muted, align: 'center', valign: 'middle' }));
  });
  els.push(hline(x, x + w, base, { color: C.axis, lw: 1 }));
  if (growth) {
    const r = data.values[n - 1] / data.values[0], x1 = x + step * 0.5, x2 = x + step * (n - 0.5), by = y + 0.42;
    els.push(hline(x1, x2, by, { color: C.accent, lw: 1.25 }));
    els.push(vline(x1, by, by + 0.14, { color: C.accent, lw: 1.25 }), vline(x2, by, by + 0.14, { color: C.accent, lw: 1.25 }));
    const g = num(`рост ${data.label}: ${data.periods[n - 1]} к ${data.periods[0]}`, Math.round(r * 10) / 10, { type: 'derived', from: [labels[n - 1], labels[0]], op: 'ratio' }, 1);
    els.push(rect((x1 + x2) / 2 - 0.55, by - 0.17, 1.1, 0.34, { r: 0.17, fill: C.bg }));
    els.push(text((x1 + x2) / 2 - 0.55, by - 0.17, 1.1, 0.34, `×${g}`, { size: 13, bold: true, color: C.accentInk, align: 'center', valign: 'middle' }));
  }
  return els;
}

// Полоса долей вместо круговой диаграммы. data: { label, parts: [{ name, value, src? }], digits?, unit? }
// Доли считаются как derived ratio к итогу; сегменты уже 0,7″ подписываются в легенде под полосой.
function stackedShare(box, data, opt = {}) {
  const { x, y, w } = box, d = data.digits || 0, lab = data.label || 'значение', els = [];
  const total = data.parts.reduce((a, p) => a + p.value, 0), tones = [C.accent, C.bar, C.axis, C.muted, C.line];
  const totLabel = `${lab} итого`;
  num(totLabel, total, { type: 'derived', from: data.parts.map(p => `${lab}: ${p.name}`), op: 'sum' }, d);
  let xx = x;
  const by = y + 0.75, bh = Math.min(1.2, box.h * 0.3), legend = [];
  data.parts.forEach((p, i) => {
    const pw = p.value / total * w, fill = tones[i % tones.length];
    const v = num(`${lab}: ${p.name}`, p.value, p.src || opt.src, d) + unitOf(data.unit);
    const share = num(`доля ${p.name}`, Math.round(p.value / total * 100), { type: 'derived', from: [`${lab}: ${p.name}`, totLabel], op: 'ratio', scale: 0.01 });
    els.push(rect(xx, by, Math.max(0.03, pw - 0.03), bh, { fill }));
    if (pw >= 0.7) {
      els.push(text(xx, y, pw - 0.1, 0.62, `${share}%`, { size: i === 0 ? 36 : 24, bold: true, color: i === 0 ? C.accentInk : C.ink, valign: 'bottom' }));
      els.push(text(xx, by + bh + 0.12, pw - 0.1, 0.62, [{ t: p.name, b: true, c: C.ink }, { t: `\n${v}` }], { size: 13, color: C.muted, ls: 1.1 }));
    } else legend.push({ fill, t: `${p.name}: ${share}%, ${v}` });
    xx += pw;
  });
  legend.forEach((l, i) => {
    const ly = by + bh + 0.9 + i * 0.32;
    els.push(rect(x + w - 3.4, ly + 0.08, 0.14, 0.14, { fill: l.fill }));
    els.push(text(x + w - 3.18, ly, 3.18, 0.3, l.t, { size: 12, color: C.ink2, valign: 'middle' }));
  });
  return els;
}

// Bullet-chart план / факт / цель по строкам. data: { rows: [{ name, plan, fact, target?, src? }], digits?, unit? }
// Отклонение факта от плана — derived diff.
function bulletChart(box, data, opt = {}) {
  const { x, y, w, h } = box, LW = opt.labelW || 2.6, VW = 2.3, d = data.digits || 0, els = [];
  const gw = w - LW - VW - 0.2, rh = Math.min(0.85, (h - 0.4) / data.rows.length);
  const mx = Math.max(...data.rows.flatMap(r => [r.plan, r.fact, r.target || 0])) * 1.05;
  els.push(rect(x + LW, y, 0.3, 0.12, { fill: C.bar }), text(x + LW + 0.38, y - 0.06, 0.8, 0.24, 'план', { size: 10, color: C.muted, valign: 'middle' }));
  els.push(rect(x + LW + 1.2, y + 0.02, 0.3, 0.08, { fill: C.accent }), text(x + LW + 1.58, y - 0.06, 0.8, 0.24, 'факт', { size: 10, color: C.muted, valign: 'middle' }));
  if (data.rows.some(r => r.target != null)) els.push(vline(x + LW + 2.45, y - 0.04, y + 0.16, { color: C.ink, lw: 2 }), text(x + LW + 2.55, y - 0.06, 0.8, 0.24, 'цель', { size: 10, color: C.muted, valign: 'middle' }));
  data.rows.forEach((r, i) => {
    const yy = y + 0.4 + i * rh, cy = yy + rh / 2, src = r.src || opt.src, px = v => x + LW + v / mx * gw;
    els.push(text(x, yy, LW - 0.2, rh, r.name, { size: 13, bold: true, valign: 'middle' }));
    els.push(rect(x + LW, cy - 0.17, gw, 0.34, { fill: C.rule, alpha: 0.6 }));
    els.push(rect(x + LW, cy - 0.12, px(r.plan) - x - LW, 0.24, { fill: C.bar }));
    els.push(rect(x + LW, cy - 0.06, px(r.fact) - x - LW, 0.12, { fill: C.accent }));
    if (r.target != null) els.push(vline(px(r.target), cy - 0.2, cy + 0.2, { color: C.ink, lw: 2 }));
    const f = num(`${r.name}: факт`, r.fact, src, d), p = num(`${r.name}: план`, r.plan, src, d);
    const dv = Math.round((r.fact - r.plan) * 10 ** d) / 10 ** d;
    const ds = num(`${r.name}: отклонение`, dv, { type: 'derived', from: [`${r.name}: факт`, `${r.name}: план`], op: 'diff' }, d);
    els.push(text(x + w - VW, yy, VW, rh, [{ t: f, b: true, c: C.ink, s: 16 }, { t: ` из ${p}${unitOf(data.unit)} · ` }, { t: `${dv >= 0 ? '+' : ''}${minus(ds)}`, b: true, c: dv >= 0 ? C.accentInk : C.muted }], { size: 11, color: C.muted, align: 'right', valign: 'middle' }));
  });
  return els;
}

// Водопад: база, шаги «+» и «−», итог. data: { label, start: { name, value, src? }, steps: [{ name, value, src? }], end: { name }, digits?, unit? }
function waterfall(box, data, opt = {}) {
  const { x, y, w, h } = box, d = data.digits || 0, lab = data.label || 'значение', els = [];
  const all = [data.start, ...data.steps], n = all.length + 1, step = w / n, bw = Math.min(0.85, step * 0.6);
  let run = 0; const levels = [];
  all.forEach((s, i) => { const from = i ? run : 0; run += s.value; levels.push([from, run]); });
  const lo = Math.min(0, ...levels.flat()), hi = Math.max(...levels.flat()), base = y + h - 0.6, sc = (h - 1.1) / (hi - lo), py = v => base - (v - lo) * sc;
  const endLabel = `${lab}: ${data.end.name}`;
  all.forEach((s, i) => {
    const [a, b] = levels[i], cx = x + step * (i + 0.5), up = b >= a, first = i === 0;
    els.push(rect(cx - bw / 2, py(Math.max(a, b)), bw, Math.max(0.02, Math.abs(b - a) * sc), { fill: first ? C.ink2 : up ? C.accent : C.muted }));
    const v = num(`${lab}: ${s.name}`, s.value, s.src || opt.src, d);
    els.push(text(cx - 0.7, py(Math.max(a, b)) - 0.32, 1.4, 0.28, first ? v : `${up ? '+' : ''}${minus(v)}`, { size: 12, bold: true, color: first ? C.ink : up ? C.accentInk : C.muted, align: 'center', valign: 'bottom' }));
    els.push(text(cx - step / 2 + 0.05, base + 0.1, step - 0.1, 0.44, s.name, { size: 10, color: C.muted, align: 'center', ls: 1.1 }));
    els.push(hline(cx + bw / 2, cx + step - bw / 2, py(b), { color: C.axis, lw: 0.75, dash: true }));
  });
  const cx = x + step * (n - 0.5);
  els.push(rect(cx - bw / 2, py(run), bw, (run - lo) * sc, { fill: C.ink }));
  els.push(text(cx - 0.7, py(run) - 0.36, 1.4, 0.32, num(endLabel, run, { type: 'derived', from: all.map(s => `${lab}: ${s.name}`), op: 'sum' }, d) + unitOf(data.unit), { size: 14, bold: true, align: 'center', valign: 'bottom' }));
  els.push(text(cx - step / 2 + 0.05, base + 0.1, step - 0.1, 0.44, data.end.name, { size: 10, bold: true, color: C.ink2, align: 'center', ls: 1.1 }));
  els.push(hline(x, x + w, base, { color: C.axis, lw: 1 }));
  return els;
}

// Воронка: ширина по величине, конверсия между этапами — derived ratio в процентах.
// data: { label, stages: [{ name, value, src? }], digits? }
function funnel(box, data, opt = {}) {
  const { x, y, w, h } = box, d = data.digits || 0, lab = data.label || 'этап', LW = opt.labelW || 2.6, CW = 1.6, els = [];
  const n = data.stages.length, rh = (h - 0.1) / n, bh = Math.min(0.62, rh * 0.62), gw = w - LW - CW, mx = data.stages[0].value;
  data.stages.forEach((s, i) => {
    const yy = y + i * rh, bwid = Math.max(0.1, s.value / mx * gw), bx = x + LW + (gw - bwid) / 2, last = i === n - 1;
    els.push(text(x, yy, LW - 0.2, bh, s.name, { size: 13, bold: true, valign: 'middle' }));
    els.push(rect(bx, yy, bwid, bh, { fill: last ? C.accent : C.bar }));
    const vt = num(`${lab}: ${s.name}`, s.value, s.src || opt.src, d), inside = tw(vt, 14, true) + 0.3 <= bwid;
    els.push(inside
      ? text(bx, yy, bwid, bh, vt, { size: 14, bold: true, color: last ? C.onAccent : onBar(), align: 'center', valign: 'middle' })
      : text(bx + bwid + 0.12, yy, 1.4, bh, vt, { size: 14, bold: true, color: last ? C.accentInk : C.ink, valign: 'middle' }));
    if (i) {
      const c = num(`конверсия ${data.stages[i - 1].name} → ${s.name}`, Math.round(s.value / data.stages[i - 1].value * 100), { type: 'derived', from: [`${lab}: ${s.name}`, `${lab}: ${data.stages[i - 1].name}`], op: 'ratio', scale: 0.01 });
      els.push(text(x + w - CW + 0.2, yy - rh + bh, CW - 0.2, rh - bh, `${c}%`, { size: 13, bold: true, color: C.accentInk, valign: 'middle' }));
      els.push(vline(x + w - CW + 0.08, yy - rh + bh + 0.06, yy - 0.06, { color: C.accent, lw: 1.25 }));
    }
  });
  els.push(text(x + w - CW + 0.2, y - 0.34, CW - 0.2, 0.26, 'конверсия', { size: 10, color: C.muted, valign: 'middle' }));
  return els;
}

// Slope-chart для двух точек времени. data: { left, right, label, items: [{ name, a, b, src? }], digits?, unit? }
function slope(box, data, opt = {}) {
  const { x, y, w, h } = box, d = data.digits || 0, lab = data.label || 'значение', LW = 2.6, els = [];
  const xa = x + LW, xb = x + w - LW, vals = data.items.flatMap(it => [it.a, it.b]), lo = Math.min(...vals), hi = Math.max(...vals);
  const top = y + 0.55, sc = (h - 0.85) / (hi - lo || 1), py = v => top + (hi - v) * sc;
  els.push(text(xa - 1, y, 2, 0.3, data.left, { size: 13, bold: true, color: C.muted, align: 'center', valign: 'middle' }));
  els.push(text(xb - 1, y, 2, 0.3, data.right, { size: 13, bold: true, align: 'center', valign: 'middle' }));
  els.push(vline(xa, top - 0.12, y + h, { color: C.axis, lw: 0.75 }), vline(xb, top - 0.12, y + h, { color: C.axis, lw: 0.75 }));
  // подписи близких значений раздвигаются по вертикали, точки остаются на своих местах
  const spread = ys => {
    const o = ys.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    for (let k = 1; k < o.length; k++) o[k].v = Math.max(o[k].v, o[k - 1].v + 0.32);
    return o.sort((a, b) => a.i - b.i).map(e => e.v);
  };
  const la = spread(data.items.map(it => py(it.a))), lb = spread(data.items.map(it => py(it.b)));
  data.items.forEach((it, i) => {
    const up = it.b > it.a, col = up ? C.accent : C.muted, src = it.src || opt.src;
    els.push({ t: 'line', x: xa, y: Math.min(py(it.a), py(it.b)), w: xb - xa, h: Math.abs(py(it.b) - py(it.a)), flipV: py(it.b) < py(it.a), color: col, lw: up ? 2 : 1.25 });
    els.push(oval(xa, py(it.a), 0.12, { fill: col }), oval(xb, py(it.b), 0.12, { fill: col }));
    els.push(text(x, la[i] - 0.16, LW - 0.18, 0.32, [{ t: `${it.name} `, c: C.ink2 }, { t: num(`${lab}: ${it.name} ${data.left}`, it.a, src, d), b: true }], { size: 11.5, align: 'right', valign: 'middle' }));
    els.push(text(xb + 0.18, lb[i] - 0.16, LW - 0.18, 0.32, [{ t: num(`${lab}: ${it.name} ${data.right}`, it.b, src, d), b: true, c: up ? C.accentInk : C.ink }, { t: ` ${it.name}`, c: C.ink2 }], { size: 11.5, valign: 'middle' }));
  });
  return els;
}

// Пиктограммная сетка 10×10 для одной доли. data: { value (из 100), label, caption, src? }
function pictoGrid(box, data, opt = {}) {
  const { x, y, h } = box, s = Math.min(0.42, (h - 0.1) / 10), dd = s * 0.68, els = [];
  for (let i = 0; i < 100; i++) {
    const r = Math.floor(i / 10), c = i % 10;
    els.push(oval(x + c * s + s / 2, y + r * s + s / 2, dd, { fill: i < data.value ? C.accent : C.rule }));
  }
  const tx = x + 10 * s + 0.4;
  const ty = y + 10 * s / 2 - 1.1;
  els.push(text(tx, ty - 0.15, box.w - 10 * s - 0.4, 1.45, [{ t: num(data.label, data.value, data.src || opt.src) }, { t: ' из 100', s: 28, c: C.ink2 }], { size: 80, bold: true, color: C.accentInk, valign: 'bottom' }));
  els.push(text(tx, ty + 1.4, Math.min(5.5, box.w - 10 * s - 0.4), 0.9, data.caption, { size: 16, color: C.ink2, ls: 1.1 }));
  return els;
}

// ═════════════ СВЯЗИ И ПРОЦЕССЫ ═════════════

// Шаги процесса слева направо. С 3D-объектами (step.object, place3d) или с узлами на линии, если объектов нет.
// data: { steps: [{ head, body, object? }] }. Шаг называется по сути, без «Шаг 1» и 01/02/03.
function processSteps(box, data, opt = {}) {
  const has = data.steps.some(s => s.object), stripeX = T.bg && T.bg.stripes ? T.canvas.w * T.bg.stripes[0][0] - 0.1 : Infinity;
  // 3D-объекты не заходят в зону фирменных полос: тело компонента сужается до неё
  const { x, y, h } = box, w = has ? Math.min(box.w, stripeX - box.x) : box.w, n = data.steps.length, cw = w / n, has3d = data.steps.some(s => s.object), d = has3d ? Math.min(T.prompt3d.sizes.row, h - 1.7) : 0.3, els = [];
  const oy = y + (h - (d + 1.65)) / 2;
  data.steps.forEach((s, i) => {
    const cx = x + i * cw + cw / 2;
    if (has3d) {
      if (s.object) els.push(...L.place3d({ x: cx - cw / 2 + 0.3, y: oy, w: cw - 0.6, h: d }, s.object, { optical: opt.optical || 1.45, align: 'bottom' }));
      if (i < n - 1) els.push(hline(cx + d / 2 + 0.2, cx + cw - d / 2 - 0.2, oy + d / 2, { color: C.accent, lw: 1.5, arrow: true }));
    } else {
      if (i < n - 1) els.push(hline(cx + 0.2, cx + cw - 0.2, oy + d / 2, { color: i < (opt.done || 0) ? C.accent : C.axis, lw: 1.5, arrow: true }));
      els.push(oval(cx, oy + d / 2, d, { fill: i < (opt.done || 0) ? C.accent : C.bg, line: C.accent, lw: 1.5 }));
    }
    els.push(text(cx - cw / 2 + 0.15, oy + d + 0.3, cw - 0.3, 0.4, s.head, { size: 18, bold: true, align: 'center', valign: 'middle' }));
    els.push(text(cx - cw / 2 + 0.15, oy + d + 0.75, cw - 0.3, 0.9, s.body, { size: T.type.h3, color: C.ink2, align: 'center', ls: 1.15 }));
  });
  return els;
}

// Схема-хаб: центральный узел (единственный контейнер) и 2–4 узла по углам типографикой.
// data: { center: { name, note? }, nodes: [{ name, items: [строки], link?: 'solid'|'dashed', edge? }] }
function hubDiagram(box, data) {
  const { x, y, w, h } = box, els = [], cw = 3.4, ch = 1.1, ccx = x + w / 2, ccy = y + h / 2;
  const nw = 3.3, spots = [[x, y], [x + w - nw, y], [x, y + h - 1.35], [x + w - nw, y + h - 1.35]];
  data.nodes.slice(0, 4).forEach((nd, i) => {
    const [nx, ny] = spots[i], left = nx < ccx, tx = left ? nx + nw * 0.55 : nx + nw * 0.45, ty = ny < ccy ? ny + 0.6 : ny + 0.3;
    const ex = left ? ccx - cw / 2 : ccx + cw / 2, ey = ny < ccy ? ccy - ch / 4 : ccy + ch / 4;
    els.push({ t: 'line', x: Math.min(tx, ex), y: Math.min(ty, ey), w: Math.abs(ex - tx), h: Math.abs(ey - ty), flipV: (ex > tx) !== (ey > ty), color: nd.link === 'dashed' ? C.axis : C.accent, lw: 1.5, dash: nd.link === 'dashed' });
    if (nd.edge) {   // подпись связи на подложке цвета фона: линия уходит под неё, а не перечёркивает
      const ew = tw(nd.edge, 9.5) + 0.24, ex0 = tx + (ex - tx) * 0.62 - ew / 2, ey0 = ty + (ey - ty) * 0.62 - 0.13;
      els.push(rect(ex0, ey0, ew, 0.26, { r: 0.13, fill: C.bg }), text(ex0, ey0, ew, 0.26, nd.edge, { size: 9.5, color: C.muted, align: 'center', valign: 'middle' }));
    }
    els.push(hline(nx, nx + nw, ny + (ny < ccy ? 0 : 1.35), { color: C.rule, lw: 0.75 }));
    const ny0 = ny < ccy ? ny + 0.1 : ny - 0.05;
    els.push(text(nx, ny0, nw, 0.36, nd.name, { size: 15, bold: true, align: left ? 'left' : 'right', valign: 'middle' }));
    els.push(text(nx, ny0 + 0.4, nw, 0.8, nd.items.join('\n'), { size: 11, color: C.ink2, align: left ? 'left' : 'right', ls: 1.15 }));
  });
  els.push(rect(ccx - cw / 2, ccy - ch / 2, cw, ch, { r: 0.14, fill: C.accent }));
  els.push(text(ccx - cw / 2 + 0.15, ccy - ch / 2 + 0.12, cw - 0.3, 0.44, data.center.name, { size: 17, bold: true, color: C.onAccent, align: 'center', valign: 'middle' }));
  if (data.center.note) els.push(text(ccx - cw / 2 + 0.15, ccy + 0.04, cw - 0.3, 0.34, data.center.note, { size: 12, bold: true, color: C.onAccent, align: 'center', valign: 'middle' }));
  return els;
}

// Матрица 2×2 позиционирования: оси важны покупателю, позиции — по данным. data: { x: { label, lo, hi }, y: { label, lo, hi }, points: [{ name, x: 0…1, y: 0…1, us? }], quadrants?: [tl, tr, bl, br] }
function matrix2x2(box, data) {
  const { x, y, w, h } = box, gx = x + 0.4, gw = w - 0.4, gh = h - 0.45, px = v => gx + v * gw, py = v => y + (1 - v) * gh, els = [];
  if (data.quadrants) {
    const q = data.quadrants;
    els.push(rect(gx + gw / 2, y, gw / 2, gh / 2, { fill: C.accent, alpha: THEME === 'dark' ? 0.08 : 0.06 }));
    [[gx + 0.1, y + 0.1, 'left', q[0]], [gx + gw / 2 + 0.1, y + 0.1, 'left', q[1]], [gx + 0.1, y + gh - 0.36, 'left', q[2]], [gx + gw / 2 + 0.1, y + gh - 0.36, 'left', q[3]]]
      .forEach(([qx, qy, al, t], i) => t && els.push(text(qx, qy, gw / 2 - 0.24, 0.26, t.toUpperCase(), { size: 9, bold: true, color: i === 1 ? C.accentInk : C.muted, align: al, valign: 'middle' })));
  }
  els.push(hline(gx, gx + gw, y + gh / 2, { color: C.axis, lw: 1, arrow: true }));
  els.push(vline(gx + gw / 2, y, y + gh, { color: C.axis, lw: 1 }));
  els.push(text(gx, y + gh + 0.08, gw / 2 - 0.1, 0.3, data.x.lo, { size: 10, color: C.muted, valign: 'middle' }));
  els.push(text(gx + gw / 2 + 0.1, y + gh + 0.08, gw / 2 - 0.1, 0.3, [{ t: data.x.label + ': ', b: true, c: C.ink2 }, { t: data.x.hi }], { size: 10, color: C.muted, align: 'right', valign: 'middle' }));
  els.push(text(gx + gw / 2 + 0.1, y - 0.36, gw / 2 - 0.1, 0.28, [{ t: data.y.label + ': ', b: true, c: C.ink2 }, { t: `${data.y.hi} ↑` }], { size: 10, color: C.muted, valign: 'middle' }));
  data.points.forEach(p => {
    const d = p.us ? 0.34 : 0.2;
    els.push(oval(px(p.x), py(p.y), d, { fill: p.us ? C.accent : C.bar }));
    const left = p.x > 0.75;   // у правого края подпись слева от точки
    els.push(text(left ? px(p.x) - d / 2 - 2.28 : px(p.x) + d / 2 + 0.08, py(p.y) - 0.15, 2.2, 0.3, p.name, { size: p.us ? 13 : 11, bold: !!p.us, color: p.us ? C.accentInk : C.ink2, align: left ? 'right' : 'left', valign: 'middle' }));
  });
  return els;
}

module.exports = {
  timelineAxis, ganttLanes, nowNextLater, quarterHorizon,
  tableEditorial, heatmap, comparison,
  kpiHero, kpiList, barsTrend, stackedShare, bulletChart, waterfall, funnel, slope, pictoGrid,
  processSteps, hubDiagram, matrix2x2,
  sparkline, diamond, num,
};
// Расширения: каждый файл kit/<группа>.js экспортирует свои компоненты, имена не пересекаются
const fs = require('fs'), path = require('path');
for (const f of fs.readdirSync(path.join(__dirname, 'kit')).filter(f => f.endsWith('.js') && f !== 'util.js').sort()) {
  let m;
  // Сломанный модуль расширения не роняет остальные: сборка предупреждает, его компоненты недоступны
  try { m = require(`./kit/${f}`); } catch (e) { console.warn(`components: kit/${f} не загружен: ${e.message.split('\n')[0]}`); continue; }
  for (const k of Object.keys(m)) {
    if (k in module.exports) throw new Error(`components: имя ${k} из kit/${f} уже занято`);
    module.exports[k] = m[k];
  }
}
Object.assign(module.exports, { seg: U.seg, knock: U.knock, spread: U.spread, lines, lh, unitOf, minus, onBar });

// Метка библиотеки: элементы, которые вернул компонент, помечаются его именем (e.lib). build.js пишет имена
// в out/slides.json, scripts/library_check.py по ним проверяет приоритет библиотеки (SKILL.md, этап 2).
const HELPERS = new Set(['sparkline', 'diamond', 'num', 'seg', 'knock', 'spread', 'lines', 'lh', 'unitOf', 'minus', 'onBar', 'wrap']);
for (const k of Object.keys(module.exports)) {
  const f = module.exports[k];
  if (HELPERS.has(k) || typeof f !== 'function') continue;
  module.exports[k] = function (...args) {
    const els = f.apply(this, args);
    if (Array.isArray(els)) els.forEach(e => { if (e && typeof e === 'object' && !e.lib) e.lib = k; });
    return els;
  };
}
module.exports.COMPONENTS = Object.keys(module.exports).filter(k => !HELPERS.has(k) && typeof module.exports[k] === 'function');
