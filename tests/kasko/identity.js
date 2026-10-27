// Слайды приёмки идентичности фактов и долей (tests/kasko/identity.sh). Числа условные.
//   1 kpiHero: вложенные периоды series.periods, opt.show { match: '2024' } находит 51,4 и подписывает его;
//   2 lineChart: два ряда с равным значением 30 в одном периоде — два факта; ref 'series[1].values[3]' подписывает второй;
//   3 lineChart: точка 51,4 не подписана, в заголовке то же число другого факта — точку оно не подтверждает;
//   4 stackedShare: рейтинг 15,64% / 15,03% …, остаток неизвестен — одна подпись с двумя знаками, без «Прочие»;
//   5 stackedShare: остаток до 100% рассчитан (derived rest) и записан в calc;
//   6 stackedShare: сумма 100,02 при точности ±0,02 — остатка нет, расчёт записан;
//   7 stackedShare: значения в млн ₽, доля с одним знаком, display 'share';
//   8 barsTrend: прежние формы opt.show (число, строка, объект) работают, подписанное число не дублируется.
const L = require('./lib.js');
const K = require('./components.js');
const { M, T, W, chrome, fact, fmt } = L;
const SRC = { type: 'user', date: '2026-10-27', quote: 'условные числа приёмочного теста' };
const body = () => ({ x: M, y: T.canvas.bodyTop + 0.3, w: W - 2 * M, h: T.canvas.bodyBottom - T.canvas.bodyTop - 0.45 });
const page = (title, els, archetype) => ({ archetype, els: [...chrome({ title, sub: 'Тест идентичности фактов', source: 'Условные числа', panel: false }), ...els] });

const S = [
  function hero() {
    return page('Коэффициент по годам', K.kpiHero({ x: M, y: T.canvas.bodyTop + 0.3, w: 5.6, h: 4.4 }, { value: 54.3, digits: 1, unit: '%', label: 'коэффициент I пол. 2025',
      caption: 'столбики — тот же показатель по годам', src: SRC, series: { periods: ['2022', '2023', '2024', 'I пол. 2025'], values: [46.8, 46.6, 51.4, 54.3] } },
    { show: [{ match: '2024', label: 'Коэффициент за 2024 год' }] }), 'kpi-hero');
  },
  function twins() {
    return page('Два ряда с равным значением', K.lineChart(body(), { periods: ['2021', '2022', '2023', '2024', '2025'], unit: '%', digits: 0,
      series: [{ name: 'Ряд А', values: [20, 24, 27, 30, 33], main: true }, { name: 'Ряд Б', values: [10, 18, 25, 30, 31] }], src: SRC },
    { show: ['series[1].values[3]'], rightW: 3.2 }), 'line-chart');
  },
  function stray() {
    const t = fmt(fact(L.PAGE.n, 'другой показатель', 51.4, SRC, { digits: 1 }), 1);
    return page(`Другой показатель: ${t}`, K.lineChart(body(), { periods: ['2022', '2023', '2024', '2025'], unit: '%', digits: 1,
      series: [{ name: 'Коэффициент', values: [48.2, 46.6, 51.4, 54.3], main: true }], src: SRC }, { rightW: 3.2 }), 'line-chart');
  },
  function rating() {
    return page('Доли рынка, топ-5', K.stackedShare(body(), { label: 'доля рынка', unit: '%', digits: 2, shareDigits: 2, rest: { type: 'unknown', name: 'Остальные: нет данных' },
      parts: [{ name: 'Страховщик 1', value: 15.64 }, { name: 'Страховщик 2', value: 15.03 }, { name: 'Страховщик 3', value: 12.1 }, { name: 'Страховщик 4', value: 9.87 }, { name: 'Страховщик 5', value: 7.36 }] },
    { src: SRC }), 'stacked-share');
  },
  function computed() {
    return page('Остаток рассчитан', K.stackedShare(body(), { label: 'структура', unit: '%', rest: { type: 'computed', name: 'Прочие' },
      parts: [{ name: 'Ремонт', value: 46 }, { name: 'СТО', value: 31 }, { name: 'Деньгами', value: 17 }] }, { src: SRC }), 'stacked-share');
  },
  function exact() {
    return page('Остатка нет', K.stackedShare(body(), { label: 'точная структура', unit: '%', digits: 2, rest: { type: 'computed' },
      parts: [{ name: 'Первый', value: 40.01 }, { name: 'Второй', value: 30.01 }, { name: 'Третий', value: 20 }, { name: 'Четвёртый', value: 10 }] }, { src: SRC }), 'stacked-share');
  },
  function money() {
    return page('Доход по каналам', K.stackedShare(body(), { label: 'доход', unit: 'млн ₽', digits: 1, shareDigits: 1, display: 'share',
      parts: [{ name: 'Приложение', value: 61.3 }, { name: 'Интернет-банк', value: 21.4 }, { name: 'Партнёры', value: 2.6 }] }, { src: SRC }), 'stacked-share');
  },
  function bars() {
    return page('Сборы по годам', K.barsTrend(body(), { label: 'сборы', periods: ['2022', '2023', '2024'], values: [214.0, 251.0, 299.6], digits: 1 },
      { src: SRC, show: [299.6, '2023', { value: 214.0, label: 'Сборы 2022', unit: 'млрд ₽' }] }), 'bars-trend');
  },
];
module.exports = { S };
