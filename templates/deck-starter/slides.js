// Слайды деки. Каждая функция возвращает { bg, els, archetype, custom? }.
// Правило библиотеки (SKILL.md, этап 2): тело слайда собирает компонент из components.js (каталог — $SKILL/components/README.md).
// Своя раскладка допустима, только если в библиотеке нет подходящего компонента: тогда слайд возвращает
// custom: 'почему не подошёл ни один компонент', и scripts/library_check.py это проверяет.
// Пример ниже работает на data/example.json (числа вымышленные): замени данные и удали лишние слайды.
const L = require('./lib.js');
const K = require('./components.js');
const { C, W, M, T, text, obj3d, fact, fmt, chrome, nb } = L;
const D = require('./data/example.json');
const SRC = { type: 'text', file: 'data/brief.md' };
const q = quote => ({ ...SRC, quote });
const body = (dy = 0.3, pad = 0.15) => ({ x: M, y: T.canvas.bodyTop + dy, w: W - 2 * M, h: T.canvas.bodyBottom - T.canvas.bodyTop - dy - pad });

// ═════ 1. Обложка: вывод деки одной фразой + контекстный 3D-объект (hero). Обложку компонент не собирает ═════
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

// ═════ 2. Число-герой и вторичные числа: kpiHero + kpiList ═════
function kpis() {
  const [main, ...rest] = D.kpis, s = D.series;
  const els = chrome({ title: D.kpi_title.map(r => ({ t: r.t, c: r.accent ? C.accent : undefined })), sub: D.kpi_sub, source: 'Источник: бриф, разделы «Итоги» и «Динамика».', panel: false });
  els.push(...K.kpiHero({ x: M + 0.2, y: T.canvas.bodyTop + 0.3, w: 5.6, h: 4.4 },
    { value: main.value, digits: main.digits, unit: main.unit, label: main.label, caption: main.caption, src: q(main.quote),
      series: { periods: s.periods, values: s.values } }));
  els.push(...K.kpiList({ x: 6.9, y: T.canvas.bodyTop + 0.4, w: W - M - 7.1, h: 4.2 },
    { items: rest.map(k => ({ value: k.value, digits: k.digits, unit: k.unit, label: k.label, caption: k.caption, src: q(k.quote) })) }));
  return { bg: 'bg_s2.jpg', archetype: 'kpi-hero', els };
}

// ═════ 3. Динамика по периодам: barsTrend ═════
function bars() {
  const s = D.series, n = s.values.length - 1;
  // числа заголовка — те же факты, что подписи столбиков компонента (метки «<label> <период>»)
  const first = fmt(fact(L.PAGE.n, `${s.label} ${s.periods[0]}`, s.values[0], q(s.quote), { digits: s.digits }), s.digits);
  const last = fmt(fact(L.PAGE.n, `${s.label} ${s.periods[n]}`, s.values[n], q(s.quote), { digits: s.digits }), s.digits);
  const els = chrome({ title: [{ t: s.title_pre }, { t: first, c: C.accent }, { t: ' до ' }, { t: `${last}${nb}млн${nb}₽`, c: C.accent }], pill: s.pill, sub: s.sub, source: s.source, panel: false });
  els.push(...K.barsTrend(body(0.3), { label: s.label, periods: s.periods, values: s.values, digits: s.digits }, { src: q(s.quote) }));
  return { bg: 'bg_s3.jpg', archetype: 'bars-trend', els };
}

// ═════ 4. Роадмап на открытой оси: timelineAxis (кластеры вех, маркер «сейчас», подписи по SMART) ═════
function releases() {
  const R = D.releases, labels = R.items.map(it => `${it.name}: полисов`);
  const total = fmt(fact(L.PAGE.n, 'полисов по релизам за год', R.items.reduce((a, it) => a + it.units, 0), { type: 'derived', from: labels, op: 'sum' }));
  const cnt = fact(L.PAGE.n, 'число релизов', R.items.length, { type: 'derived', from: labels, op: 'count' });
  const els = chrome({ title: [{ t: `${cnt} ${R.title_pre}` }, { t: `${total}${nb}полисов`, c: C.accent }], pill: R.pill, sub: R.sub, source: R.source, panel: false });
  els.push(...K.timelineAxis(body(0.45), {
    ticks: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
    now: { at: 0, label: 'Сейчас', note: R.now },
    items: R.items.map(it => ({ at: it.month - 0.5, name: it.name, value: it.units, unit: 'полисов за год', valueLabel: `${it.name}: полисов`, note: it.phase, src: q(it.quote) })),
  }));
  return { bg: 'bg_s3.jpg', archetype: 'timeline-axis', els };
}

// ═════ 5. Редакционная таблица: tableEditorial (без рамок, доля полосой, колонка «наше» тоном) ═════
function channelsTable() {
  const T2 = D.channels, top = T2.rows[0];
  const share = fact(L.PAGE.n, `доля КД ${top.name}`, top.share, q(top.q));
  const els = chrome({ title: [{ t: top.name, c: C.accent }, { t: ` даёт ${share}% КД 2027 года` }], pill: T2.pill, sub: T2.sub, source: T2.source, panel: false });
  els.push(...K.tableEditorial(body(0.35), {
    cols: [
      { key: 'name', label: 'Канал', w: 3.2, type: 'text' },
      { key: 'kd', label: 'КД', unit: 'млн ₽', w: 1.6, type: 'num', digits: 1 },
      { key: 'share', label: 'Доля КД', unit: '%', w: 3.6, type: 'bar' },
      { key: 'units', label: 'Полисов за год', w: 2.5, type: 'num' },
    ],
    rows: T2.rows.map((r, i) => ({ name: r.name, note: r.note, kd: r.kd, share: r.share, units: r.units, lead: i === 0, src: q(r.q) })),
    total: { kd: T2.total.kd, units: T2.total.units, src: q(T2.total.q) },
    highlight: 'kd',
  }));
  return { bg: 'bg_s2.jpg', archetype: 'table-editorial', els };
}

// ═════ 6. Процесс: processSteps с контекстными 3D-объектами шагов (place3d внутри компонента) ═════
function split() {
  const p = D.split;
  const els = chrome({ title: p.title, pill: p.pill, sub: p.sub, source: p.source, panel: false });
  els.push(...K.processSteps(body(0.2), { steps: p.points.map(pt => ({ head: pt.head, body: pt.body, object: pt.object })) }));
  return { bg: 'bg_s4.jpg', archetype: 'process-steps', els };
}

module.exports = { S: [cover, kpis, bars, releases, channelsTable, split] };
