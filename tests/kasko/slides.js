// Тестовая дека навыка (tests/kasko, reference/15-brief-coverage.md): 12 слайдов на компонентах библиотеки по брифу
// «КАСКО в России». Числа условные. data/variant.json → variant:
//   lossy — повторяет потери, найденные при сравнении 1.5.0 и 1.6.1: на обложке нет периода, рост выплат 31,6% только
//           в заметках, 51,4% за 2024 год только рисует точку линии, четвёртого вывода нет на слайде;
//   fixed — те же слайды и данные, всё обязательное читается на слайдах.
// 3D-объект обложки — демо-заглушка заготовки: тест не обращается к MagicPatterns. В настоящей деке объект контекстный.
const L = require('./lib.js');
const K = require('./components.js');
const { C, W, M, T, text, obj3d, fact, fmt, chrome, nb } = L;
const V = require('./data/variant.json').variant;
const fixed = V === 'fixed';
const q = quote => ({ type: 'text', file: 'data/brief.md', quote });
const body = (dy = 0.3, pad = 0.15) => ({ x: M, y: T.canvas.bodyTop + dy, w: W - 2 * M, h: T.canvas.bodyBottom - T.canvas.bodyTop - dy - pad });
const Q = {
  prem: 'Сборы премий КАСКО, млрд ₽: 2019 — 182,0; 2020 — 176,0; 2021 — 196,0; 2022 — 214,0; 2023 — 251,0; 2024 — 299,6.',
  pay: 'Выплаты по КАСКО, млрд ₽: 2023 — 117,0; 2024 — 154,0.',
  growth: 'Рост выплат в 2024 году — 31,6%, рост сборов — 19,4%.',
  ratio: 'Коэффициент выплат, %: 2019 — 48,2; 2020 — 45,6; 2021 — 47,0; 2022 — 46,8; 2023 — 46,6; 2024 — 51,4; I полугодие 2025 — 54,3.',
  h1: 'I полугодие 2025: сборы 162,0 млрд ₽, выплаты 88,0 млрд ₽.',
  st23: 'Структура выплат 2023, %: ремонт у дилера 49, ремонт на СТО партнёра 26, деньгами 16, угоны 9.',
  st24: 'Структура выплат 2024, %: ремонт у дилера 46, ремонт на СТО партнёра 31, деньгами 17, угоны 6.',
  check: 'Средний чек ремонта, тыс. ₽: 2023 — 118, 2024 — 152.',
  cost: 'Средняя стоимость ремонта в 2024 году, тыс. ₽: у дилера — 186, на СТО партнёра — 128.',
};
const SRC_LINE = 'Источник: тестовый бриф навыка, числа условные.';

function cover() {
  return {
    bg: 'bg_cover.jpg', archetype: 'cover',
    els: [
      text(M, 2.1, 7.4, 2.1, [{ t: 'КАСКО в России:', c: C.accent }, { t: ' выплаты растут быстрее сборов' }], { size: 36, bold: true, ls: 1.05, valign: 'bottom', id: 'cover-title' }),
      text(M, 4.4, 7.4, 0.8, fixed ? 'Устройство продукта и рынок: 2019–2024 и I полугодие 2025' : 'Устройство продукта и рынок', { size: 18, color: C.ink2, ls: 1.15, id: 's1-sub' }),
      text(M, 6.6, 6, 0.4, 'Продуктовый комитет · тестовая дека, числа условные', { size: 12, color: C.muted, valign: 'middle' }),
      text(W - M - 0.45, T.canvas.top, 0.45, 0.46, T.mark.text, { size: T.mark.size, bold: true, align: 'center', valign: 'middle' }),
      obj3d(8.3, 1.75, 'cover_platform.png', 'hero'),
    ],
  };
}

function summary() {
  const items = [
    { value: 31.6, digits: 1, unit: '%', sign: true, label: 'рост выплат 2024', head: 'Выплаты растут быстрее сборов', d: 'сборы за тот же год выросли на 19,4%', src: q(Q.growth) },
    { value: 152, unit: 'тыс. ₽', label: 'средний чек ремонта 2024', head: 'Средний чек ремонта растёт из-за запчастей', d: 'в 2023 году было 118 тыс. ₽', src: q(Q.check) },
    { value: 6, unit: '%', label: 'доля угонов в выплатах 2024', head: 'Доля угонов в выплатах снижается', d: 'в 2023 году угоны давали 9% выплат', src: q(Q.st24) },
    { value: 128, unit: 'тыс. ₽', label: 'ремонт на СТО партнёра 2024', head: 'Ремонт на СТО партнёров дешевле дилерского', d: 'у дилера тот же ремонт стоит 186 тыс. ₽', src: q(Q.cost) },
  ];
  fact(L.PAGE.n, 'рост сборов 2024', 19.4, q(Q.growth), { digits: 1 });
  fact(L.PAGE.n, 'средний чек ремонта 2023', 118, q(Q.check));
  fact(L.PAGE.n, 'доля угонов в выплатах 2023', 9, q(Q.st23));
  fact(L.PAGE.n, 'ремонт у дилера 2024', 186, q(Q.cost));
  const els = chrome({ title: 'Четыре вывода о рынке КАСКО', sub: 'Что показывают данные 2019–2024', source: SRC_LINE, panel: false });
  // lossy: четвёртый вывод выпал, а у первого нет числа роста — 31,6% остаётся только в заметках слайда 5
  els.push(...K.executiveSummary(body(0.3), { items: fixed ? items : [{ ...items[0], value: undefined, d: 'выплаты растут быстрее сборов уже второй год' }, items[1], items[2]] }));
  return { bg: 'bg_s2.jpg', archetype: 'text-executive-summary', els };
}

function product() {
  const els = chrome({ title: 'Как устроен полис КАСКО', sub: 'Три решения клиента: от чего защищаться, сколько платить самому, как получать возмещение', source: SRC_LINE, panel: false });
  els.push(...K.processSteps(body(0.2), { steps: [
    { head: 'Риски', body: 'Ущерб автомобилю и угон: можно взять оба или только ущерб' },
    { head: 'Франшиза', body: 'Часть убытка клиент оплачивает сам, за это полис дешевле' },
    { head: 'Возмещение', body: 'Ремонт у дилера, ремонт на СТО партнёра или деньгами' },
  ] }));
  return { bg: 'bg_s4.jpg', archetype: 'process-steps', els };
}

function premiums() {
  const periods = ['2019', '2020', '2021', '2022', '2023', '2024'], values = [182.0, 176.0, 196.0, 214.0, 251.0, 299.6];
  const a = fmt(fact(L.PAGE.n, 'сборы 2019', 182.0, q(Q.prem), { digits: 1 }), 1), b = fmt(fact(L.PAGE.n, 'сборы 2024', 299.6, q(Q.prem), { digits: 1 }), 1);
  const els = chrome({ title: [{ t: 'Сборы выросли с ' }, { t: a, c: C.accent }, { t: ' до ' }, { t: `${b}${nb}млрд${nb}₽`, c: C.accent }], sub: 'Сборы премий КАСКО по годам, млрд ₽', source: SRC_LINE, panel: false });
  els.push(...K.barsTrend(body(0.3), { label: 'сборы', periods, values, digits: 1 }, { src: q(Q.prem) }));
  return { bg: 'bg_s3.jpg', archetype: 'bars-trend', els };
}

function payouts() {
  const g = fmt(fact(L.PAGE.n, 'рост выплат 2024', 31.6, q(Q.growth), { digits: 1 }), 1);
  const title = fixed ? [{ t: 'Выплаты выросли на ' }, { t: `${g}%`, c: C.accent }, { t: ' за год' }] : [{ t: 'Выплаты выросли до ' }, { t: `154${nb}млрд${nb}₽`, c: C.accent }];
  const els = chrome({ title, sub: 'Выплаты по КАСКО, млрд ₽', source: SRC_LINE, panel: false });
  els.push(...K.bigCompare(body(0.35), { label: 'выплаты', mode: 'diff', better: 'down',
    before: { when: '2023', value: 117.0, caption: 'выплаты за год, млрд ₽' }, after: { when: '2024', value: 154.0, caption: 'выплаты за год, млрд ₽' } }, { src: q(Q.pay) }));
  return { bg: 'bg_s2.jpg', archetype: 'big-compare', els, notes: `Рост выплат ${g}% год к году, сборы выросли на 19,4%.` };
}

function ratio() {
  const els = chrome({ title: 'Коэффициент выплат снова растёт', sub: 'Выплаты к сборам, %', source: SRC_LINE, panel: false });
  els.push(...K.lineChart(body(0.3), { periods: ['2019', '2020', '2021', '2022', '2023', '2024', 'I пол. 2025'], unit: '%', digits: 1,
    series: [{ name: 'Коэффициент выплат', values: [48.2, 45.6, 47.0, 46.8, 46.6, 51.4, 54.3], main: true }], src: q(Q.ratio) },
  fixed ? { show: [{ match: '2024', label: 'Коэффициент выплат за 2024 год' }], unit: '%', rightW: 3.6 } : { rightW: 3.6 }));
  return { bg: 'bg_s3.jpg', archetype: 'line-chart', els };
}

function structure() {
  const els = chrome({ title: 'Почти половина выплат — ремонт у дилера', sub: 'Структура выплат 2024 года, %', source: SRC_LINE, panel: false });
  els.push(...K.stackedShare(body(0.4), { label: 'выплаты 2024', unit: '%', parts: [
    { name: 'Ремонт у дилера', value: 46 }, { name: 'СТО партнёра', value: 31 }, { name: 'Деньгами', value: 17 }, { name: 'Угоны', value: 6 }] }, { src: q(Q.st24) }));
  return { bg: 'bg_s2.jpg', archetype: 'stacked-share', els };
}

function shift() {
  const els = chrome({ title: 'Доля угонов в выплатах снижается', sub: 'Структура выплат, % от суммы выплат года', source: SRC_LINE, panel: false });
  els.push(...K.slope(body(0.3), { left: '2023', right: '2024', label: 'доля выплат', unit: '%', items: [
    { name: 'Ремонт у дилера', a: 49, b: 46 }, { name: 'СТО партнёра', a: 26, b: 31 }, { name: 'Деньгами', a: 16, b: 17 }, { name: 'Угоны', a: 9, b: 6 }] },
  { src: q(Q.st23 + ' ' + Q.st24) }));
  return { bg: 'bg_s3.jpg', archetype: 'slope', els };
}

function check() {
  const els = chrome({ title: 'Средний чек ремонта растёт из-за запчастей', sub: 'Средний чек ремонта по КАСКО, тыс. ₽', source: SRC_LINE, panel: false });
  els.push(...K.bigCompare(body(0.35), { label: 'средний чек ремонта', mode: 'diff', better: 'down',
    before: { when: '2023', value: 118, caption: 'средний чек, тыс. ₽' }, after: { when: '2024', value: 152, caption: 'средний чек, тыс. ₽' } }, { src: q(Q.check) }));
  return { bg: 'bg_s4.jpg', archetype: 'big-compare', els };
}

function sto() {
  const els = chrome({ title: fixed ? 'Ремонт на СТО партнёров дешевле дилерского' : 'Сколько стоит ремонт у дилера и на СТО', sub: 'Средняя стоимость ремонта в 2024 году, тыс. ₽', source: SRC_LINE, panel: false });
  els.push(...K.bigCompare(body(0.35), { label: 'стоимость ремонта 2024', mode: 'diff', better: 'down',
    before: { when: 'У дилера', value: 186, caption: 'средний ремонт, тыс. ₽' }, after: { when: 'На СТО партнёра', value: 128, caption: 'средний ремонт, тыс. ₽' } }, { src: q(Q.cost) }));
  return { bg: 'bg_s2.jpg', archetype: 'big-compare', els };
}

function half() {
  const els = chrome({ title: 'Выплаты забирают больше половины сборов', sub: 'Сборы и выплаты за I полугодие 2025', source: SRC_LINE, panel: false });
  els.push(...K.kpiHero({ x: M + 0.2, y: T.canvas.bodyTop + 0.3, w: 5.6, h: 4.4 }, { value: 54.3, digits: 1, unit: '%', label: 'коэффициент выплат I пол. 2025',
    caption: 'выплаты к сборам; столбики — тот же показатель с 2022 года', src: q(Q.ratio),
    series: { periods: ['2022', '2023', '2024', 'I пол. 2025'], values: [46.8, 46.6, 51.4, 54.3] } }));
  els.push(...K.kpiList({ x: 6.9, y: T.canvas.bodyTop + 0.4, w: W - M - 7.1, h: 4.2 }, { items: [
    { value: 162.0, digits: 1, unit: 'млрд ₽', label: 'сборы I пол. 2025', caption: 'сборы за I\u00a0полугодие 2025', src: q(Q.h1) },
    { value: 88.0, digits: 1, unit: 'млрд ₽', label: 'выплаты I пол. 2025', caption: 'выплаты за I\u00a0полугодие 2025', src: q(Q.h1) }] }, { numW: 3.4 }));
  return { bg: 'bg_s3.jpg', archetype: 'kpi-hero', els };
}

function next() {
  const els = chrome({ title: 'Что предлагаем комитету', sub: 'Три шага на основе выводов', source: SRC_LINE, panel: false });
  els.push(...K.nextStepsText(body(0.3), { steps: [
    { action: 'Пересмотреть тарифы с учётом роста среднего чека', due: 'I кв. 2026', owner: 'Актуарии', now: true },
    { action: 'Расширить сеть СТО партнёров в регионах', due: 'II кв. 2026', owner: 'Урегулирование' },
    { action: 'Предложить полис с франшизой как базовый', due: 'II кв. 2026', owner: 'Продукт' },
  ] }));
  return { bg: 'bg_s4.jpg', archetype: 'text-next-steps', els };
}

module.exports = { S: [cover, summary, product, premiums, payouts, ratio, structure, shift, check, sto, half, next] };
