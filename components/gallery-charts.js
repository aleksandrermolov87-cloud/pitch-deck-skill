// Галерея группы «нативные диаграммы»: nativeChart в трёх видах. В PPTX — диаграммы PowerPoint со встроенной таблицей
// («Изменить данные»), в HTML-двойнике — те же столбцы фигурами. Данные вымышленные. Собирает scripts/gallery.sh charts.
const L = require('./lib.js');
const K = require('./components.js');
const { C, W, M, T, chrome } = L;
const SRC = { type: 'user', date: '2026-10-27', quote: 'демо-данные галереи компонентов' };
const B = (dy = 0.3, pad = 0.15) => ({ x: M, y: T.canvas.bodyTop + dy, w: W - 2 * M, h: T.canvas.bodyBottom - T.canvas.bodyTop - dy - pad });
const slide = (id, title, sub, els, archetype) => () => ({ bg: 'bg_s2.jpg', archetype, els: [...chrome({ title: [{ t: id, c: C.accent }, { t: ` ${title}` }], sub, source: `Компонент ${id}, нативная диаграмма PowerPoint · данные вымышленные`, panel: false }), ...els()] });

const S = [
  slide('nativeChart', 'Премии растут пятый год подряд', 'Столбцы: последний год акцентом, данные правятся в PowerPoint через «Изменить данные»', () => K.nativeChart(B(0.3), {
    type: 'col', label: 'премии', unit: 'млрд ₽', digits: 1,
    periods: ['2021', '2022', '2023', '2024', '2025', '2026П'], values: [12.4, 14.1, 15.0, 17.8, 19.6, 22.3],
    source: 'демо-данные галереи компонентов',
  }, { src: SRC }), 'bars-trend'),

  slide('nativeChart', 'Онлайн растёт шестой квартал подряд', 'Линия по двум каналам: точки подписаны, легенда сверху', () => K.nativeChart(B(0.3), {
    type: 'line', label: 'доля продаж', unit: '%', digits: 0,
    periods: ['I кв. 2025', 'II кв. 2025', 'III кв. 2025', 'IV кв. 2025', 'I кв. 2026', 'II кв. 2026', 'III кв. 2026'],
    series: [
      { name: 'Онлайн', values: [18, 20, 23, 25, 27, 30, 33] },
      { name: 'Агенты', values: [52, 51, 49, 48, 47, 46, 45] },
    ],
  }, { src: SRC }), 'line-trend'),

  slide('nativeChart', 'Казань впереди по скорости выплат', 'Полосы по городам в порядке данных, лидер акцентом', () => K.nativeChart(B(0.3), {
    type: 'bar', label: 'выплаты за 5 дней', unit: '%', digits: 1,
    cats: ['Казань', 'Москва', 'Екатеринбург', 'Новосибирск', 'Самара', 'Тверь'], values: [71.2, 64.5, 58.3, 52.9, 47.1, 33.6],
  }, { src: SRC }), 'ranking-bars'),

  slide('nativeChart', 'План перевыполнен в трёх кварталах', 'Сгруппированные столбцы: план серым, факт акцентом', () => K.nativeChart(B(0.3), {
    type: 'col', label: 'новые полисы', unit: 'тыс.', digits: 0,
    periods: ['I кв.', 'II кв.', 'III кв.', 'IV кв.'],
    series: [
      { name: 'Факт', values: [118, 131, 127, 152] },
      { name: 'План', values: [110, 125, 135, 140] },
    ],
  }, { src: SRC }), 'plan-fact'),
];

module.exports = { S };
