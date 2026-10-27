// Слайды деки. Каждая функция возвращает { bg, els, hidden? }. Числа — только через fact()/mln() из lib.js.
// Пример ниже работает на data/example.json: замени его своими данными и удали лишние слайды.
const L = require('./lib.js');
const { C, W, M, T, rect, oval, hline, vline, text, image, obj3d, place3d, fact, fmt, chrome, tw } = L;
const D = require('./data/example.json');
const SRC = { type: 'text', file: 'data/brief.md' };

// ═════ 1. Обложка: вывод деки одной фразой + контекстный 3D-объект (hero) ═════
function cover() {
  return {
    bg: 'bg_cover.jpg', archetype: 'cover',
    els: [
      text(M, 2.1, 7.6, 2.1, [{ t: D.cover.accent, c: C.accent }, { t: ` ${D.cover.rest}` }], { size: 40, bold: true, ls: 1.05, valign: 'bottom', id: 'cover-title' }),
      text(M, 4.4, 7.2, 0.8, D.cover.sub, { size: 18, color: C.ink2, ls: 1.15, id: 's1-sub' }),
      text(M, 6.6, 6, 0.4, D.cover.meta, { size: 12, color: C.muted, valign: 'middle' }),
      text(W - M - 0.45, T.canvas.top, 0.45, 0.46, T.mark.text, { size: T.mark.size, bold: true, align: 'center', valign: 'middle' }),
      obj3d(8.3, 1.75, D.cover.object, 'hero'),
    ],
  };
}

// ═════ 2. Ряд KPI: одно главное число крупно, остальные мельче (не три одинаковые карточки) ═════
function kpis() {
  const [main, ...rest] = D.kpis;
  const els = chrome({ title: D.kpi_title.map(r => ({ t: r.t, c: r.accent ? C.accent : undefined })), pill: 'Итоги', sub: D.kpi_sub, source: 'Источник: бриф, раздел «Итоги».' });
  const bodyH = T.canvas.bodyBottom - T.canvas.bodyTop, y0 = T.canvas.bodyTop + 0.45;
  const unit = u => !u ? '' : u === '%' ? '%' : `${L.nb}${u}`;   // «54%» слитно, «84,6 млн ₽» через неразрывный пробел
  // главный KPI — левая широкая колонка по центру тела; число и единица разными кеглями в одном боксе
  const ym = T.canvas.bodyTop + 0.45;
  els.push(text(M + 0.45, ym, 5.6, 1.3, [{ t: fmt(fact(2, main.label, main.value, { ...SRC, quote: main.quote }), main.digits || 0) }, { t: unit(main.unit), s: 30 }], { size: 72, bold: true, color: C.accent, valign: 'bottom' }));
  els.push(text(M + 0.45, ym + 1.35, 5.6, 0.6, main.caption, { size: 15, color: C.ink2, ls: 1.15 }));
  // инфографика под числом-героем: из каких кварталов складывается год (без подписей значений — они на слайде 3)
  const q = D.series, qMax = Math.max(...q.values), qBase = ym + 3.55, qH = 1.25, qW = 0.62, qGap = 0.34;
  q.values.forEach((v, i) => {
    const h = v / qMax * qH, x = M + 0.45 + i * (qW + qGap), last = i === q.values.length - 1;
    els.push(rect(x, qBase - h, qW, h, { r: 0.04, fill: last ? C.accent : C.bar }));
    els.push(text(x - 0.2, qBase + 0.08, qW + 0.4, 0.24, q.periods[i], { size: 10, color: C.muted, align: 'center', valign: 'middle' }));
  });
  els.push(hline(M + 0.45, M + 0.45 + q.values.length * (qW + qGap) - qGap, qBase, { color: C.axis, lw: 0.75 }));
  // остальные — столбец справа, разделённый линиями, без карточек
  const x = 6.9, w = W - M - 0.45 - x, rowH = (bodyH - 0.9) / rest.length;   // строки делят всю высоту тела
  rest.forEach((k, i) => {
    const y = y0 + i * rowH;
    if (i) els.push(hline(x, x + w, y, { color: C.rule, lw: 0.75 }));
    els.push(text(x, y + rowH / 2 - 0.3, 2.4, 0.6, fmt(fact(2, k.label, k.value, { ...SRC, quote: k.quote }), k.digits || 0) + unit(k.unit), { size: 30, bold: true, valign: 'middle' }));
    els.push(text(x + 2.5, y + rowH / 2 - 0.3, w - 2.5, 0.6, k.caption, { size: 15, color: C.ink2, valign: 'middle', ls: 1.12 }));
  });
  return { bg: 'bg_s2.jpg', archetype: 'kpi-hero', els };
}

// ═════ 3. Столбики по периодам: последний — акцентом, подписи значений над столбцами ═════
function bars() {
  const s = D.series, n = s.values.length - 1;
  // числа заголовка регистрируются как факты так же, как подписи столбцов
  const first = fmt(fact(3, `${s.label} ${s.periods[0]}`, s.values[0], { ...SRC, quote: s.quote }), s.digits || 0);
  const last = fmt(fact(3, `${s.label} ${s.periods[n]}`, s.values[n], { ...SRC, quote: s.quote }), s.digits || 0);
  const els = chrome({ title: [{ t: s.title_pre }, { t: `${first}`, c: C.accent }, { t: ' до ' }, { t: `${last}${L.nb}млн${L.nb}₽`, c: C.accent }], pill: s.pill, sub: s.sub, source: s.source });
  const x0 = M + 0.6, x1 = W - M - 0.6, base = 6.3, maxH = 3.4, top = Math.max(...s.values);
  const step = (x1 - x0) / s.values.length, bw = Math.min(0.62, step * 0.56);
  s.values.forEach((v, i) => {
    const h = v / top * maxH, cx = x0 + step * (i + 0.5), last = i === s.values.length - 1;
    els.push(rect(cx - bw / 2, base - h, bw, h, { r: 0.04, fill: last ? C.accent : C.bar }));
    els.push(text(cx - 0.6, base - h - 0.32, 1.2, 0.28, fmt(fact(3, `${s.label} ${s.periods[i]}`, v, { ...SRC, quote: s.quote }), s.digits || 0), { size: 12, bold: last, align: 'center', valign: 'bottom' }));
    els.push(text(cx - 0.6, base + 0.1, 1.2, 0.26, s.periods[i], { size: 10, color: C.muted, align: 'center', valign: 'middle' }));
  });
  els.push(hline(x0, x1, base, { color: C.axis, lw: 1 }));
  return { bg: 'bg_s3.jpg', archetype: 'bars-trend', els };
}

// ═════ R. Роадмап на открытой оси (без карточек): узлы на месяцах, подписи по SMART, маркер «сейчас» ═════
// Источник структуры: Release Cycle Timeline (21st, 29956) и Timeline slide-cn (28298), см. patterns/roadmap-and-tables.md
function releases() {
  const R = D.releases, sum = R.items.reduce((a, it) => a + it.units, 0);
  const total = fmt(fact(L.PAGE.n, 'полисов по релизам за год', sum, { type: 'derived', from: R.items.map(it => `${it.name}: полисов`), op: 'sum' }));
  const cnt = fact(L.PAGE.n, 'число релизов', R.items.length, { type: 'derived', from: R.items.map(it => `${it.name}: полисов`), op: 'count' });
  const els = chrome({ title: [{ t: `${cnt} ${R.title_pre}` }, { t: `${total}${L.nb}полисов`, c: C.accent }], pill: R.pill, sub: R.sub, source: R.source, panel: false });
  const x0 = M + 1.6, x1 = W - M - 0.3, ay = 2.75, mw = (x1 - x0) / 12, cx = m => x0 + (m - 0.5) * mw;
  const MON = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  // «сейчас» слева от оси: где мы относительно плана
  els.push(text(M, ay - 0.32, 1.45, 0.24, 'Сейчас', { size: 10, bold: true, color: C.accentInk, valign: 'middle' }));
  els.push(text(M, ay - 0.06, 1.45, 0.42, R.now, { size: 10, color: C.muted, ls: 1.1 }));
  els.push(hline(x0 - 0.15, x1, ay, { color: C.axis, lw: 1.25, arrow: true }));
  MON.forEach((m, i) => els.push(text(x0 + i * mw, ay - 0.42, mw, 0.22, m, { size: 9.5, color: C.muted, align: 'center', valign: 'middle' })));
  // Близкие вехи — в кластер: одна скобка на оси, одна выноска, подписи столбиком. Выноски не пересекают подписи.
  const LW = 2.6, clusters = [];
  R.items.forEach(it => {
    const last = clusters[clusters.length - 1];
    if (last && cx(it.month) - cx(last[0].month) < LW + 0.2) last.push(it); else clusters.push([it]);
  });
  clusters.forEach(cl => {
    const xa = cx(cl[0].month), xb = cx(cl[cl.length - 1].month), ly = ay + 0.62;
    if (cl.length > 1 && xb > xa) els.push(hline(xa, xb, ay + 0.28, { color: C.accent, lw: 1.5 }));
    els.push(vline(xa, ay + 0.12, ly - 0.06, { color: C.rule, lw: 0.75 }));
    let y = ly;
    cl.forEach(it => {
      const u = fmt(fact(L.PAGE.n, `${it.name}: полисов`, it.units, { type: 'text', file: 'data/brief.md', quote: it.quote }));
      const nameL = Math.ceil(tw(it.name, 12, true) / LW);
      els.push(text(xa + 0.12, y, LW, 0.22 * nameL + 0.02, it.name, { size: 12, bold: true, ls: 1.1 }));
      y += 0.22 * nameL + 0.06;
      els.push(text(xa + 0.12, y, LW, 0.42, [{ t: `${u}${L.nb}полисов за год`, c: C.accentInk, b: true }, { t: `\n${it.phase}` }], { size: 10.5, color: C.ink2, ls: 1.1 }));
      y += 0.62;
    });
  });
  // узлы поверх линий
  [...new Set(R.items.map(it => it.month))].forEach(m => {
    els.push(oval(cx(m), ay, 0.22, { fill: C.bg, line: C.accent, lw: 1.5 }));
    els.push(oval(cx(m), ay, 0.1, { fill: C.accent }));
  });
  return { bg: 'bg_s3.jpg', archetype: 'timeline-axis', els };
}

// ═════ T. Редакционная таблица: без рамок и зебры, линии только под шапкой и над итогом, доля полосой без дорожки ═════
// Источник структуры: Bench Matrix (21st, 29454) и Paired Bars (29470), см. patterns/roadmap-and-tables.md
function channelsTable() {
  const T2 = D.channels, top = T2.rows[0];
  const share = fact(L.PAGE.n, `доля КД ${top.name}`, top.share, { type: 'text', file: 'data/brief.md', quote: top.q });
  const els = chrome({ title: [{ t: top.name, c: C.accent }, { t: ` даёт ${share}% КД 2027 года` }], pill: T2.pill, sub: T2.sub, source: T2.source, panel: false });
  const COL = { name: [M, 3.2], kd: [M + 3.6, 1.6], bar: [M + 5.6, 3.6], units: [W - M - 2.5, 2.5] };
  const hy = 2.25, rh = 0.95;
  const head = (k, t, align) => els.push(text(COL[k][0], hy, COL[k][1], 0.3, t, { size: 10, color: C.muted, align, valign: 'bottom' }));
  head('name', 'Канал', 'left'); head('kd', 'КД, млн ₽', 'right'); head('bar', 'Доля КД', 'left'); head('units', 'Полисов за год', 'right');
  els.push(hline(M, W - M, hy + 0.4, { color: C.axis, lw: 0.75 }));
  const maxShare = Math.max(...T2.rows.map(r => r.share));
  T2.rows.forEach((r, i) => {
    const y = hy + 0.55 + i * rh, lead = i === 0;
    els.push(text(COL.name[0], y, COL.name[1], 0.4, r.name, { size: 20, bold: true, valign: 'middle' }));
    els.push(text(COL.name[0], y + 0.42, COL.name[1], 0.26, r.note, { size: 10, color: C.muted, valign: 'middle' }));
    const src = { type: 'text', file: 'data/brief.md', quote: r.q };
    els.push(text(COL.kd[0], y, COL.kd[1], 0.4, fmt(fact(L.PAGE.n, `КД ${r.name}`, r.kd, src, { digits: 1 }), 1), { size: 20, bold: lead, color: lead ? C.accent : C.ink, align: 'right', valign: 'middle' }));
    const bw = Math.max(0.04, r.share / maxShare * (COL.bar[1] - 0.8));
    els.push(rect(COL.bar[0], y + 0.12, bw, 0.18, { fill: lead ? C.accent : C.bar }));
    els.push(text(COL.bar[0] + bw + 0.12, y, 0.7, 0.4, `${r.share === top.share ? share : fact(L.PAGE.n, `доля КД ${r.name}`, r.share, src)}%`, { size: 12, color: C.ink2, valign: 'middle' }));
    els.push(text(COL.units[0], y, COL.units[1], 0.4, fmt(fact(L.PAGE.n, `полисов ${r.name}`, r.units, src)), { size: 20, color: C.ink2, align: 'right', valign: 'middle' }));
  });
  const ty = hy + 0.55 + T2.rows.length * rh + 0.05, tq = { type: 'text', file: 'data/brief.md', quote: T2.total.q };
  els.push(hline(M, W - M, ty, { color: C.ink2, lw: 1.5 }));
  els.push(text(COL.name[0], ty + 0.15, COL.name[1], 0.4, 'Итого', { size: 16, bold: true, valign: 'middle' }));
  els.push(text(COL.kd[0], ty + 0.15, COL.kd[1], 0.4, fmt(fact(L.PAGE.n, 'КД итого', T2.total.kd, tq, { digits: 1 }), 1), { size: 16, bold: true, align: 'right', valign: 'middle' }));
  els.push(text(COL.units[0], ty + 0.15, COL.units[1], 0.4, fmt(fact(L.PAGE.n, 'полисов итого', T2.total.units, tq)), { size: 16, bold: true, align: 'right', valign: 'middle' }));
  return { bg: 'bg_s2.jpg', archetype: 'table-editorial', els };
}

// ═════ 4. Процесс: шаги слева направо, у каждого свой контекстный 3D-объект (row), стрелки задают последовательность ═════
function split() {
  const p = D.split;
  const els = chrome({ title: p.title, pill: p.pill, sub: p.sub, source: p.source });
  const n = p.points.length, x0 = M + 0.45, colW = (W - 2 * M - 0.9) / n, d = T.prompt3d.sizes.row;
  const oy = T.canvas.bodyTop + (T.canvas.bodyBottom - T.canvas.bodyTop - (d + 1.65)) / 2;   // блок шагов по центру тела
  p.points.forEach((pt, i) => {
    const x = x0 + i * colW, cx = x + colW / 2;
    // объект стоит на базе прямо над подписью шага, видимая площадь у всех шагов одинаковая
    els.push(...place3d({ x: x + 0.3, y: oy, w: colW - 0.6, h: d }, pt.object, { optical: 1.45, align: 'bottom' }));
    if (i < n - 1) els.push(hline(cx + d / 2 + 0.2, cx + colW - d / 2 - 0.2, oy + d / 2, { color: C.accent, lw: 1.5, arrow: true }));
    els.push(text(x + 0.15, oy + d + 0.3, colW - 0.3, 0.4, pt.head, { size: 18, bold: true, align: 'center', valign: 'middle' }));
    els.push(text(x + 0.15, oy + d + 0.75, colW - 0.3, 0.9, pt.body, { size: T.type.h3, color: C.ink2, align: 'center', ls: 1.15 }));
  });
  return { bg: 'bg_s4.jpg', archetype: 'process-steps', els };
}

module.exports = { S: [cover, kpis, bars, releases, channelsTable, split] };
