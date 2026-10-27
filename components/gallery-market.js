// Галерея группы market (kit/market.js): рынок, деньги, модель бизнеса. По слайду на компонент, данные вымышленные.
// Собирает scripts/gallery.sh market: копирует файл в проект и строит обе темы. Заодно образец вызова: box, data, opt.
const L = require('./lib.js');
const K = require('./components.js');
const { C, W, M, T, chrome } = L;
const SRC = { type: 'user', date: '2026-10-27', quote: 'демо-данные галереи компонентов' };
const B = (dy = 0.3, pad = 0.15) => ({ x: M, y: T.canvas.bodyTop + dy, w: W - 2 * M, h: T.canvas.bodyBottom - T.canvas.bodyTop - dy - pad });
const slide = (id, title, sub, els, archetype) => () => ({ bg: 'bg_s2.jpg', archetype, els: [...chrome({ title: [{ t: id, c: C.accent }, { t: ` ${title}` }], sub, source: `Компонент ${id} · данные вымышленные`, panel: false }), ...els()] });

const MON = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

const S = [
  slide('marketTam', 'Наш рынок 2,5 млрд ₽ в год', 'Вложенные круги на общей базе: площадь по объёму, расчёт снизу вверх под каждым числом', () => K.marketTam(B(0.25, 0.1), {
    unit: 'млрд ₽',
    levels: [
      { key: 'TAM', name: 'страхование жилья в России', value: 178, calc: [{ value: 54, unit: 'млн', note: 'домохозяйств' }, { value: 3300, unit: '₽', note: 'средняя премия в год' }] },
      { key: 'SAM', name: 'клиенты банка с картой и квартирой', value: 20.5, digits: 1, calc: [{ value: 6.2, digits: 1, unit: 'млн', note: 'клиентов' }, { value: 3300, unit: '₽', note: 'премия' }] },
      { key: 'SOM', name: 'достижимо за три года', value: 2.5, digits: 1, calc: [{ value: 6.2, digits: 1, unit: 'млн', note: 'клиентов' }, { value: 12, unit: '%', note: 'купят полис в приложении' }, { value: 3300, unit: '₽', note: 'премия' }] },
    ],
  }, { src: SRC }), 'market-tam'),

  slide('unitEconomics', 'Клиент окупается за девять месяцев', 'CAC и LTV на одной шкале, LTV нарезана на месяцы жизни клиента, окупаемость меткой', () => K.unitEconomics(B(0.3), {
    unit: '₽',
    cac: { value: 1850, note: 'реклама и бонус за первую покупку' },
    ltv: { value: 6300, note: 'маржа за весь срок жизни' },
    margin: { value: 210, note: 'маржа с клиента в месяц' },
    months: { value: 30, note: 'средний срок жизни клиента' },
    extra: [{ label: 'отток в месяц', value: 3.3, digits: 1, unit: '%', note: 'клиентов отключают автоплатёж' }],
  }, { src: SRC }), 'unit-economics'),

  slide('revenueFormula', 'Выручка 2027 года из трёх множителей', 'Уравнение крупными числами, под каждым множителем подпись и источник', () => K.revenueFormula(B(0.3), {
    factors: [
      { name: 'клиентов с ипотекой в банке', value: 2.4, digits: 1, unit: 'млн', from: 'Источник: реестр клиентов банка, сентябрь 2026' },
      { name: 'купят полис жилья в приложении', value: 18, unit: '%', from: 'Источник: пилот в двух регионах' },
      { name: 'средняя премия в год', value: 4100, unit: '₽', from: 'Источник: тарифная сетка, вариант «Оптимальный»' },
    ],
    result: { name: 'выручка за год', value: 1.8, digits: 1, unit: 'млрд ₽', from: 'Источник: финансовая модель, лист «Выручка»' },
  }, { src: SRC }), 'revenue-formula'),

  slide('cohortGrid', 'Через полгода остаются семь из десяти', 'Треугольная матрица удержания, насыщенность по проценту, средняя кривая снизу', () => K.cohortGrid(B(0.3, 0.1), {
    src: SRC,
    cohorts: [{ name: 'Январь', size: 1240 }, { name: 'Февраль', size: 1410 }, { name: 'Март', size: 1380 }, { name: 'Апрель', size: 1620 }, { name: 'Май', size: 1790 }, { name: 'Июнь', size: 1950 }],
    values: [[100, 86, 79, 74, 71, 69], [100, 88, 81, 77, 74], [100, 87, 80, 76], [100, 90, 84], [100, 91], [100]],
  }), 'cohort-retention'),

  slide('pricingTiers', 'Три тарифа страхования квартиры', 'Колонки без карточек: цена крупно, рекомендуемый тариф тоном, состав списком', () => K.pricingTiers(B(0.3), {
    unit: '₽ в месяц',
    tiers: [
      { name: 'Базовый', price: 290, note: 'стены, пол и потолок' },
      { name: 'Оптимальный', price: 590, note: 'квартира, вещи и соседи', recommended: true },
      { name: 'Максимум', price: 990, note: 'всё из «Оптимального» и ремонт' },
    ],
    features: [
      { name: 'Пожар и залив', values: [true, true, true] },
      { name: 'Лимит', prefix: 'до ', unit: 'млн ₽', values: [1, 3, 6] },
      { name: 'Кража вещей', values: [false, true, true] },
      { name: 'Ответственность перед соседями', values: [false, true, true] },
      { name: 'Отделка и техника', values: [false, false, true] },
      { name: 'Выезд мастера', values: [false, false, true] },
    ],
  }, { src: SRC }), 'pricing-tiers'),

  // неполные данные: цен нет — акцент на покрытии и условиях; цена известна не у всех тарифов
  slide('pricingTiers', 'Три программы КАСКО по покрытию', 'Цены не раскрыты: вместо цены условия программы и состав покрытия', () => K.pricingTiers(B(0.3), {
    noPrice: 'цена зависит от авто и стажа',
    tiers: [
      { name: 'Мини', note: 'только тотальная гибель и угон, ремонт за свой счёт' },
      { name: 'Стандарт', note: 'ремонт на СТО партнёра, эвакуатор и аварийный комиссар', recommended: true },
      { name: 'Премиум', note: 'ремонт у дилера, подменный автомобиль на время ремонта' },
    ],
    features: [
      { name: 'Угон и тотальная гибель', values: [true, true, true] },
      { name: 'Ремонт после ДТП', values: [false, 'СТО партнёра', 'у дилера'] },
      { name: 'Эвакуатор', values: [false, true, true] },
      { name: 'Подменный автомобиль', values: [false, false, true] },
      { name: 'Стекла без справок', values: [false, true, 'unknown'] },
    ],
  }, { src: SRC }), 'pricing-tiers'),

  slide('pricingTiers', 'Цена известна у двух тарифов из трёх', 'Тариф без цены показывает причину, остальные — цену крупно', () => K.pricingTiers(B(0.3), {
    unit: '₽ в месяц',
    tiers: [
      { name: 'Базовый', price: 290, note: 'стены, пол и потолок' },
      { name: 'Оптимальный', price: 590, note: 'квартира, вещи и соседи', recommended: true },
      { name: 'Для бизнеса', price: 'по запросу', note: 'офис, склад и оборудование' },
    ],
    features: [
      { name: 'Пожар и залив', values: [true, true, true] },
      { name: 'Лимит', prefix: 'до ', unit: 'млн ₽', values: [1, 3, 'unknown'] },
      { name: 'Кража вещей', values: [false, true, true] },
      { name: 'Ответственность перед соседями', values: [false, true, true] },
    ],
  }, { src: SRC }), 'pricing-tiers'),

  slide('driversDiverging', 'Приложение перекрывает отток', 'Расходящиеся полосы от нуля, по убыванию, итог как сумма вкладов', () => K.driversDiverging(B(0.3), {
    label: 'вклад в рост выручки', unit: 'п. п.', digits: 1, total: 'Рост выручки за год',
    items: [
      { name: 'Новые клиенты в приложении', value: 6.8 },
      { name: 'Продление без звонка', value: 3.9 },
      { name: 'Партнёрские продажи', value: 2.4 },
      { name: 'Рост средней премии', value: 1.2 },
      { name: 'Снижение тарифа на жильё', value: -0.9 },
      { name: 'Отток после первого года', value: -2.7 },
      { name: 'Закрытие офисов', value: -3.5 },
    ],
  }, { src: SRC }), 'drivers-diverging'),

  slide('scenarioRange', 'К 2030 году выручка от 2,7 до 6,6 млрд ₽', 'Полоса от пессимистичного до оптимистичного, точка и линия базового сценария', () => K.scenarioRange(B(0.3), {
    label: 'выручка', unit: 'млрд ₽', digits: 1,
    periods: ['2026', '2027', '2028', '2029', '2030'],
    rows: [{ base: 1.2 }, { lo: 1.6, base: 1.9, hi: 2.2 }, { lo: 2.0, base: 2.7, hi: 3.4 }, { lo: 2.4, base: 3.6, hi: 4.9 }, { lo: 2.7, base: 4.5, hi: 6.6 }],
  }, { src: SRC }), 'scenario-range'),

  slide('breakEven', 'Выходим в плюс на семнадцатом месяце', 'Накопленный результат вокруг нуля: минус нейтральной линией, плюс акцентом', () => K.breakEven(B(0.3, 0.1), {
    label: 'накопленный результат', unit: 'млн ₽', digits: 1, every: 3,
    values: [-2.4, -4.6, -6.5, -8.1, -9.4, -10.4, -11.0, -11.3, -11.2, -10.7, -9.8, -8.5, -6.9, -5.0, -2.8, -0.4, 2.2, 5.0, 8.0, 11.1, 14.3, 17.6, 21.0, 24.5],
  }, { src: SRC }), 'break-even'),

  slide('lineChart', 'Конверсия в приложении обогнала офис', 'Подписи рядов на концах линий вместо легенды, главный ряд акцентом', () => K.lineChart(B(0.3), {
    label: 'конверсия расчёта в покупку, %', unit: '%',
    periods: MON,
    series: [
      { name: 'Приложение', main: true, values: [21, 22, 22, 24, 25, 26, 28, 29, 30, 31, 33, 34] },
      { name: 'Офис', values: [29, 29, 28, 28, 28, 27, 27, 27, 26, 27, 26, 26] },
      { name: 'Интернет-банк', values: [18, 18, 19, 19, 20, 20, 21, 21, 22, 23, 23, 24] },
      { name: 'Партнёры', values: [6, 6, 7, 7, 8, 8, 9, 10, 10, 11, 11, 12] },
    ],
  }, { src: SRC }), 'line-chart'),

  slide('stackedColumns', 'Жильё растёт быстрее всех', 'Столбцы из сегментов по продуктам, итог над столбцом, легенда строкой', () => K.stackedColumns(B(0.3), {
    label: 'премии', unit: 'млн ₽', digits: 0,
    periods: ['I кв. 2026', 'II кв. 2026', 'III кв. 2026', 'IV кв. 2026', 'I кв. 2027', 'II кв. 2027'],
    parts: [
      { name: 'Жильё', values: [42, 51, 63, 78, 92, 108] },
      { name: 'Путешествия', values: [28, 36, 44, 31, 33, 41] },
      { name: 'Здоровье', values: [19, 21, 22, 24, 25, 27] },
      { name: 'Авто', values: [12, 12, 13, 13, 14, 14] },
    ],
  }, { src: SRC }), 'stacked-columns'),
];

module.exports = { S };
