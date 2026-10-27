// Галерея группы «числа»: сравнения, распределения, просьба. По слайду на компонент, данные вымышленные.
// Собирает scripts/gallery.sh numbers. Это же образец вызова: box, data, opt.
const L = require('./lib.js');
const K = require('./components.js');
const { C, W, M, T, chrome } = L;
const SRC = { type: 'user', date: '2026-10-27', quote: 'демо-данные галереи компонентов' };
const B = (dy = 0.3, pad = 0.15) => ({ x: M, y: T.canvas.bodyTop + dy, w: W - 2 * M, h: T.canvas.bodyBottom - T.canvas.bodyTop - dy - pad });
const slide = (id, title, sub, els, archetype) => () => ({ bg: 'bg_s2.jpg', archetype, els: [...chrome({ title: [{ t: id, c: C.accent }, { t: ` ${title}` }], sub, source: `Компонент ${id} · данные вымышленные`, panel: false }), ...els()] });

const S = [
  slide('dumbbell', 'Онлайн растёт везде, кроме ОСАГО', 'Две точки на общей шкале: было серым, стало акцентом, строки по величине сдвига', () => K.dumbbell(B(0.3), {
    label: 'доля онлайн-продаж', from: '2025', to: '2026', unit: '%',
    rows: [
      { name: 'КАСКО', a: 18, b: 31 },
      { name: 'ОСАГО', a: 42, b: 39 },
      { name: 'Ипотечное', a: 9, b: 24 },
      { name: 'Путешествия', a: 55, b: 71 },
      { name: 'Жильё', a: 21, b: 29 },
      { name: 'Здоровье', a: 12, b: 15 },
    ],
  }, { src: SRC }), 'dumbbell'),

  slide('dotPlot', 'Наш вклад выгоднее рынка на любом сроке', 'Точки банков на общей шкале, наша крупнее, пунктиром среднее по рынку', () => K.dotPlot(B(0.3), {
    label: 'ставка по вкладу', unit: '%', digits: 1, us: 'Наш банк', avgHead: 'Рынок', others: 'Другие банки из топ-20', avg: 'Среднее по рынку', axis: 'Ставка, % годовых',
    rows: [
      { name: '3 месяца', us: 17.5, avg: 15.8, others: [14.2, 15.1, 15.6, 16.0, 16.4, 17.1, 18.2] },
      { name: '6 месяцев', us: 18.0, avg: 16.4, others: [15.0, 15.7, 16.2, 16.5, 17.0, 17.4, 17.9] },
      { name: '1 год', us: 17.2, avg: 15.9, others: [14.6, 15.2, 15.5, 16.1, 16.6, 16.9, 17.6] },
      { name: '2 года', us: 15.4, avg: 14.1, others: [12.8, 13.5, 13.9, 14.3, 14.8, 15.1, 15.9] },
      { name: '3 года', us: 13.9, avg: 12.9, others: [11.6, 12.2, 12.7, 13.1, 13.4, 14.0, 14.4] },
    ],
  }, { src: SRC }), 'dot-plot'),

  slide('histogram', 'Половина полисов жилья дешевле 4,2 тыс. ₽', 'Смежные столбики по корзинам цены, медиана акцентной вертикалью', () => K.histogram(B(0.3), {
    label: 'премия по полису жилья', countLabel: 'полисов', unit: 'тыс. ₽', digits: 1, median: 4.2, axis: 'Премия за год, тыс. ₽',
    bins: [
      { from: 0, to: 1, count: 310 }, { from: 1, to: 2, count: 1240 }, { from: 2, to: 3, count: 2380 }, { from: 3, to: 4, count: 2910 },
      { from: 4, to: 5, count: 2460 }, { from: 5, to: 6, count: 1720 }, { from: 6, to: 7, count: 980 }, { from: 7, to: 8, count: 540 },
      { from: 8, to: 9, count: 290 }, { from: 9, to: 10, count: 140 },
    ],
  }, { src: SRC }), 'histogram'),

  slide('scatterLabeled', 'Чем быстрее выплата, тем выше NPS', 'Точка на отделение: подписаны только выбросы и мы, пунктиром тренд', () => K.scatterLabeled(B(0.3), {
    x: { label: 'Срок выплаты', short: 'срок', unit: 'дней', digits: 1 }, y: { label: 'NPS отделения', short: 'NPS', digits: 0 }, trend: true,
    points: [
      { x: 3.1, y: 58 }, { x: 3.8, y: 54 }, { x: 4.2, y: 55 }, { x: 4.6, y: 49 }, { x: 5.0, y: 51 }, { x: 5.3, y: 46 },
      { x: 5.9, y: 44 }, { x: 6.2, y: 47 }, { x: 6.6, y: 41 }, { x: 7.1, y: 39 }, { x: 7.4, y: 42 }, { x: 7.9, y: 36 },
      { x: 8.3, y: 34 }, { x: 8.8, y: 37 }, { x: 9.4, y: 31 }, { x: 10.2, y: 29 }, { x: 4.9, y: 45 }, { x: 6.9, y: 44 },
      { name: 'Казань', x: 2.4, y: 66, note: true },
      { name: 'Сочи', x: 3.6, y: 27, note: true },
      { name: 'Тверь', x: 12.6, y: 21, note: true },
      { name: 'Мы, Москва', x: 4.4, y: 52, us: true },
    ],
  }, { src: SRC }), 'scatter-labeled'),

  slide('marimekko', 'В самом большом сегменте мы первые', 'Ширина столбца по размеру сегмента, высота по доле игрока, наша доля снизу', () => K.marimekko(B(0.3), {
    label: 'премии', unit: 'млрд ₽', digits: 1, players: ['Мы', 'Компания А', 'Компания Б', 'Прочие'], us: 0,
    segments: [
      { name: 'Ипотечное', values: [21.4, 14.2, 9.8, 23.6] },
      { name: 'КАСКО', values: [6.1, 12.4, 10.3, 17.2] },
      { name: 'Жизнь', values: [4.8, 9.6, 6.2, 11.4] },
      { name: 'Жильё', values: [5.4, 4.2, 3.5, 7.4] },
    ],
  }, { src: SRC }), 'marimekko'),

  slide('treemap', 'Треть премий даёт ипотечное', 'Площадь по сумме премий, мелкие продукты сведены в «Прочие»', () => K.treemap(B(0.3), {
    label: 'премии портфеля', unit: 'млрд ₽', digits: 1, accent: 'Ипотечное',
    items: [
      { name: 'Ипотечное', value: 61.2 }, { name: 'КАСКО', value: 38.4 }, { name: 'Жизнь', value: 27.9 }, { name: 'Жильё', value: 18.6 },
      { name: 'Здоровье', value: 14.1 }, { name: 'Путешествия', value: 9.8 }, { name: 'Несчастный случай', value: 3.2 },
      { name: 'Карты', value: 3.1 }, { name: 'Киберриски', value: 2.4 }, { name: 'Питомцы', value: 1.1 },
    ],
  }, { src: SRC, head: 'Портфель за год', shareOf: 'портфеля' }), 'treemap'),

  slide('kpiGrid', 'Продажи растут, убыточность снижается', 'Шесть метрик сеткой без карточек: сдвиг к прошлому кварталу и тренд за два года', () => K.kpiGrid(B(0.3), {
    vs: 'к III кв.',
    items: [
      { label: 'Премии, млн ₽', value: 412.6, prev: 371.0, digits: 1, series: [248, 262, 281, 297, 318, 344, 371, 412.6] },
      { label: 'Новые клиенты, тыс.', value: 18.4, prev: 15.9, digits: 1, series: [9.1, 10.4, 11.2, 12.0, 13.6, 14.8, 15.9, 18.4] },
      { label: 'Доля онлайн-продаж', value: 38, prev: 33, unit: '%', series: [19, 22, 24, 26, 29, 31, 33, 38] },
      { label: 'Убыточность', value: 54.2, prev: 57.8, unit: '%', digits: 1, better: 'down', series: [63.0, 61.4, 60.2, 59.5, 58.1, 58.6, 57.8, 54.2] },
      { label: 'NPS', value: 46, prev: 41, series: [28, 31, 33, 35, 36, 39, 41, 46] },
      { label: 'Срок выплаты, дней', value: 6.1, prev: 7.4, digits: 1, better: 'down', series: [12.4, 11.8, 10.6, 9.9, 9.1, 8.2, 7.4, 6.1] },
    ],
  }, { src: SRC }), 'kpi-grid'),

  slide('askFunds', 'Просим 240 млн ₽ на страхование в приложении', 'Сумма крупно, полоса долей по статьям, ниже вехи, которых достигнем', () => K.askFunds(B(0.3), {
    label: 'Просим на 2027 год', amount: 240, unit: 'млн ₽',
    caption: 'Запуск продаж страховых продуктов в мобильном приложении банка для 4 млн активных клиентов',
    uses: [{ name: 'Разработка и интеграции', value: 96 }, { name: 'Маркетинг в приложении', value: 72 }, { name: 'Команда продукта', value: 48 }, { name: 'Резерв', value: 24 }],
    milestones: [
      { when: 'II кв. 2027', value: 50, unit: 'тыс.', name: 'полисов в приложении' },
      { when: 'IV кв. 2027', value: 1.2, digits: 1, unit: 'млрд ₽', name: 'премий за год' },
      { when: 'I кв. 2028', name: 'Проект окупается' },
    ],
  }, { src: SRC }), 'ask-funds'),

  slide('bigCompare', 'Выплату по КАСКО получают в 7 раз быстрее', 'Два больших числа, между ними кратность, полосы в общем масштабе', () => K.bigCompare(B(0.3), {
    label: 'срок выплаты по КАСКО', mode: 'ratio', better: 'down', note: 'быстрее',
    before: { when: '2025', value: 14, unit: 'дней', caption: 'Средний срок от заявления до выплаты: осмотр в офисе и ручная проверка' },
    after: { when: '2026', value: 2, unit: 'дня', caption: 'Оценка ущерба по фото в приложении, деньги приходят на карту банка' },
  }, { src: SRC }), 'big-compare'),

  slide('rankingList', 'За год мы поднялись на третье место', 'Топ-8 по премиям: место, полоса значения, изменение места стрелкой', () => K.rankingList(B(0.3), {
    label: 'премии', unit: 'млрд ₽', digits: 1, nameHead: 'Страховая компания', valueHead: 'Премии, млрд ₽', changeHead: 'За год',
    rows: [
      { name: 'Компания А', value: 148.2, prev: 1 },
      { name: 'Компания Б', value: 121.7, prev: 2 },
      { name: 'Мы', value: 96.4, prev: 5, us: true },
      { name: 'Компания В', value: 88.1, prev: 3 },
      { name: 'Компания Г', value: 74.5, prev: 4 },
      { name: 'Компания Д', value: 51.3, prev: 7 },
      { name: 'Компания Е', value: 47.9, prev: 6 },
      { name: 'Компания Ж', value: 33.6, prev: 8 },
    ],
  }, { src: SRC }), 'ranking-list'),
];

module.exports = { S };
