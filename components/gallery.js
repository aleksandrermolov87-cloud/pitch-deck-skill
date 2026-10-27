// Галерея библиотеки компонентов: по слайду на компонент, данные вымышленные.
// Собирает scripts/gallery.sh: копирует этот файл в проект как slides.js, строит обе темы и контакт-лист.
// Заодно это образец вызова каждого компонента: box, data, opt.
const L = require('./lib.js');
const K = require('./components.js');
const { C, W, M, T, chrome } = L;
const SRC = { type: 'user', date: '2026-10-27', quote: 'демо-данные галереи компонентов' };
const B = (dy = 0.3, pad = 0.15) => ({ x: M, y: T.canvas.bodyTop + dy, w: W - 2 * M, h: T.canvas.bodyBottom - T.canvas.bodyTop - dy - pad });
const slide = (id, title, sub, els, archetype) => () => ({ bg: 'bg_s2.jpg', archetype, els: [...chrome({ title: [{ t: id, c: C.accent }, { t: ` ${title}` }], sub, source: `Компонент ${id} · данные вымышленные`, panel: false }), ...els()] });

const MON = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

const S = [
  slide('timelineAxis', 'Что и когда выходит', 'Открытая ось с вехами, пройденный участок акцентом, близкие вехи в кластере', () => K.timelineAxis(B(0.45), {
    ticks: MON, now: { at: 4.5, note: 'май, пилот в двух регионах' },
    items: [
      { at: 1.5, name: 'Калькулятор в приложении', value: 1200, unit: 'расчётов в день', note: 'для всех клиентов' },
      { at: 3.5, name: 'Оплата в один шаг', value: 34, unit: '% конверсии', note: 'было 21%' },
      { at: 6.5, name: 'Продление без звонка', value: 8400, unit: 'полисов за полгода', note: 'автопродление по согласию' },
      { at: 9.5, name: 'Партнёрский API', value: 3, unit: 'партнёра', note: 'маркетплейсы' },
      { at: 10.5, name: 'Кабинет агента', note: 'замена Excel-реестров' },
    ],
  }, { src: SRC }), 'timeline-axis'),

  slide('ganttLanes', 'Кто что делает параллельно', 'Дорожки по направлениям, фазы тоном, вехи ромбами, маркер «сегодня»', () => K.ganttLanes(B(0.25), {
    periods: ['I кв.', 'II кв.', 'III кв.', 'IV кв.'], today: 1.4,
    groups: [
      { name: 'Каналы', lanes: [
        { name: 'Мобильное приложение', bars: [{ from: 0, to: 1.2, label: 'Разработка', tone: 'bar' }, { from: 1.2, to: 2.4, label: 'Пилот', tone: 'accent' }, { from: 2.4, to: 4, label: 'Тираж', tone: 'dim' }] },
        { name: 'Интернет-банк', bars: [{ from: 0.6, to: 2, label: 'Разработка', tone: 'bar' }, { from: 2, to: 3.1, label: 'Пилот', tone: 'accent' }], milestones: [{ at: 3.1, label: 'Запуск' }] },
      ] },
      { name: 'Продукты', lanes: [
        { name: 'Страхование жилья', bars: [{ from: 0, to: 0.8, label: 'Тарифы', tone: 'bar' }, { from: 0.8, to: 2.2, label: 'Пилот', tone: 'accent' }] },
        { name: 'Страхование путешествий', bars: [{ from: 1.5, to: 3, label: 'Разработка', tone: 'bar' }, { from: 3, to: 4, label: 'Пилот', tone: 'accent' }] },
      ] },
    ],
  }), 'gantt-lanes'),

  slide('nowNextLater', 'Сейчас, следом, потом', 'Без дат: плотность и уверенность падают слева направо', () => K.nowNextLater(B(0.35), {
    cols: [
      { head: 'Сейчас', items: [{ t: 'Оплата в один шаг', d: 'Конверсия корзины с 21 до 34% к июню' }, { t: 'Калькулятор в приложении', d: 'Расчёт за 30 секунд без звонка' }] },
      { head: 'Следом', items: [{ t: 'Продление без звонка', d: 'Автопродление по согласию' }, { t: 'Партнёрский API', d: 'Первые маркетплейсы' }] },
      { head: 'Потом', items: [{ t: 'Кабинет агента' }, { t: 'Семейный полис' }, { t: 'Страховка по подписке' }] },
    ],
  }), 'now-next-later'),

  slide('quarterHorizon', 'Куда идём за два года', 'Строки-направления, отметки кварталов, пунктир без срока', () => K.quarterHorizon(B(0.3), {
    years: [{ name: '2027', quarters: 4 }, { name: '2028', quarters: 4 }],
    rows: [
      { name: 'Цифровые продажи', marks: [0, 1, 3], accent: true },
      { name: 'Партнёрские каналы', marks: [2, 4, 5] },
      { name: 'Урегулирование онлайн', marks: [1, 3], open: true },
      { name: 'Новые продукты', marks: [4, 6, 7] },
      { name: 'Аналитика и скоринг', marks: [0, 2], open: true },
    ],
  }), 'roadmap-quarters'),

  slide('tableEditorial', 'Каналы по доходу и динамике', 'Без рамок: числа справа, доля полосой, тренд спарклайном, колонка «наше» тоном', () => K.tableEditorial(B(0.3), {
    highlight: 'kd',
    cols: [{ key: 'name', label: 'Канал', w: 2.6 }, { key: 'kd', label: 'Доход', unit: 'млн ₽', type: 'num', digits: 1, w: 1.4 }, { key: 'share', label: 'Доля дохода', unit: '%', type: 'bar', w: 3 }, { key: 'units', label: 'Полисов', type: 'num', w: 1.4 }, { key: 'trend', label: 'По месяцам', type: 'trend', w: 1.8 }],
    rows: [
      { name: 'Мобильное приложение', note: 'основной канал', kd: 61.3, share: 72, units: 10820, trend: [3, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 11], lead: true },
      { name: 'Интернет-банк', note: 'клиенты на десктопе', kd: 21.4, share: 25, units: 3210, trend: [2, 2, 3, 3, 3, 4, 3, 4, 4, 4, 5, 5] },
      { name: 'Партнёры', note: 'пилот с II квартала', kd: 2.6, share: 3, units: 640, trend: [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3] },
    ],
    total: { name: 'Итого', kd: 85.3, units: 14670 },
  }, { src: SRC }), 'table-editorial'),

  slide('heatmap', 'Где продаётся каждый продукт', 'Насыщенность по величине, итоги вне сетки', () => K.heatmap(B(0.25), {
    label: 'полисов, тыс.', digits: 1, src: SRC,
    rows: ['Жильё', 'Путешествия', 'Здоровье', 'Авто'], cols: ['Приложение', 'Интернет-банк', 'Офис', 'Партнёры'],
    values: [[12.4, 4.1, 2.2, 0.6], [8.8, 3.0, 0.4, 1.9], [5.1, 2.6, 3.3, 0], [2.0, 1.1, 4.7, 2.4]],
  }), 'heatmap-matrix'),

  slide('comparison', 'Какой вариант запуска выбрать', 'Рекомендуемая колонка тоном, без рамок', () => K.comparison(B(0.4), {
    options: [{ name: 'Своя разработка', note: '9 месяцев' }, { name: 'Партнёрская платформа', note: '4 месяца', recommended: true }, { name: 'Готовая коробка', note: '6 месяцев' }],
    rows: [
      { name: 'Свой бренд в интерфейсе', values: [true, true, false] },
      { name: 'Запуск до конца года', values: [false, true, true] },
      { name: 'Данные клиентов остаются у нас', values: [true, true, false] },
      { name: 'Доработки без подрядчика', values: [true, false, false] },
      { name: 'Стоимость владения', values: ['высокая', 'средняя', 'низкая'] },
    ],
  }), 'comparison'),

  slide('kpiHero + kpiList', 'Одно главное число и три вторичных', 'Число-герой с составом по кварталам, справа строки через линии', () => [
    ...K.kpiHero({ x: M + 0.2, y: T.canvas.bodyTop + 0.3, w: 5.6, h: 4.4 }, { value: 84.6, digits: 1, unit: 'млн ₽', label: 'доход за год', caption: 'Доход без НДС по всем каналам', series: { periods: ['I кв.', 'II кв.', 'III кв.', 'IV кв.'], values: [5.2, 14.9, 25.8, 38.7] } }, { src: SRC }),
    ...K.kpiList({ x: 6.9, y: T.canvas.bodyTop + 0.4, w: W - M - 7.1, h: 4.2 }, { items: [
      { value: 76, unit: '%', label: 'доля второго полугодия', caption: 'дохода приходится на второе полугодие' },
      { value: 12, label: 'число пилотов', caption: 'пилотов в двух регионах' },
      { value: 6, label: 'продуктов в линейке', caption: 'продуктов в линейке' },
    ] }, { src: SRC }),
  ], 'kpi-hero'),

  slide('barsTrend', 'Доход растёт каждый квартал', 'Последний столбик акцентом, скобка роста от первого к последнему', () => K.barsTrend(B(0.3), { label: 'доход', periods: ['I кв.', 'II кв.', 'III кв.', 'IV кв.'], values: [5.2, 14.9, 25.8, 38.7], digits: 1 }, { src: SRC }), 'bars-trend'),

  slide('stackedShare', 'Из чего складывается доход', 'Полоса долей вместо круговой диаграммы, мелкие доли в легенде', () => K.stackedShare(B(0.5), {
    label: 'доход', digits: 1, unit: 'млн ₽',
    parts: [{ name: 'Мобильное приложение', value: 61.3 }, { name: 'Интернет-банк', value: 21.4 }, { name: 'Партнёры', value: 2.6 }, { name: 'Офисы', value: 1.2 }],
  }, { src: SRC }), 'stacked-share'),

  slide('stackedShare (rest)', 'Доли рынка пяти лидеров', 'Доли с двумя знаками одной подписью, остаток рынка неизвестен — пустая часть полосы без числа', () => K.stackedShare(B(0.5), {
    label: 'доля рынка', unit: '%', digits: 2, shareDigits: 2, rest: { type: 'unknown', name: 'Остальные: нет данных' },
    parts: [{ name: 'Компания А', value: 15.64 }, { name: 'Компания Б', value: 15.03 }, { name: 'Компания В', value: 12.1 }, { name: 'Компания Г', value: 9.87 }, { name: 'Компания Д', value: 7.36 }],
  }, { src: SRC }), 'stacked-share'),

  slide('bulletChart', 'План и факт по продуктам', 'Полоса плана, полоса факта, отметка цели, отклонение со знаком', () => K.bulletChart(B(0.35), {
    digits: 1, unit: 'млн ₽',
    rows: [
      { name: 'Жильё', plan: 18.0, fact: 21.4, target: 24 },
      { name: 'Путешествия', plan: 12.0, fact: 9.6, target: 14 },
      { name: 'Здоровье', plan: 9.0, fact: 9.4, target: 10 },
      { name: 'Авто', plan: 6.0, fact: 4.1, target: 8 },
    ],
  }, { src: SRC }), 'plan-fact'),

  slide('waterfall', 'Как вырастет доход за год', 'База, плюсы и минусы, итог как сумма шагов', () => K.waterfall(B(0.3), {
    label: 'прирост дохода', digits: 1, unit: 'млн ₽', start: { name: 'Доход 2026', value: 52.0 },
    steps: [{ name: 'Новые клиенты', value: 18.5 }, { name: 'Продление', value: 9.2 }, { name: 'Партнёры', value: 4.4 }, { name: 'Отток', value: -6.1 }, { name: 'Снижение тарифа', value: -3.4 }],
    end: { name: 'Доход 2027' },
  }, { src: SRC }), 'waterfall'),

  slide('funnel', 'Где теряем клиентов', 'Ширина по величине, конверсия между этапами справа', () => K.funnel(B(0.5), {
    label: 'клиентов',
    stages: [{ name: 'Увидели предложение', value: 48000 }, { name: 'Открыли расчёт', value: 14400 }, { name: 'Заполнили данные', value: 6100 }, { name: 'Оплатили', value: 2080 }],
  }, { src: SRC }), 'funnel'),

  slide('slope', 'Что изменилось за год', 'Две точки времени: растущие линии акцентом', () => K.slope(B(0.3), {
    left: '2026', right: '2027', label: 'конверсия, %',
    items: [{ name: 'Приложение', a: 21, b: 34 }, { name: 'Интернет-банк', a: 18, b: 24 }, { name: 'Офис', a: 29, b: 26 }, { name: 'Партнёры', a: 6, b: 12 }],
  }, { src: SRC }), 'slope'),

  slide('pictoGrid', 'Каждый третий клиент покупает сам', 'Одна доля сеткой 10 × 10', () => K.pictoGrid(B(0.3), { value: 34, label: 'доля самостоятельных покупок', caption: 'клиентов из 100 оформляют полис без менеджера: в приложении или интернет-банке' }, { src: SRC }), 'picto-grid'),

  slide('processSteps', 'Оформление за три шага', 'С 3D-объектами шага через place3d, без объектов узлы на линии', () => K.processSteps(B(0.2), {
    steps: [
      { head: 'Выбор продукта', body: 'Клиент видит страховку рядом с банковскими продуктами', object: 'step_catalog.png' },
      { head: 'Расчёт цены', body: 'Цена за 30 секунд по данным, которые банк уже знает', object: 'step_quote.png' },
      { head: 'Оплата картой', body: 'Полис приходит в приложение и на почту', object: 'step_payment.png' },
    ],
  }), 'process-steps'),

  slide('hubDiagram', 'Кто за что отвечает', 'Один центральный узел, остальные типографикой, подписи на связях', () => K.hubDiagram(B(0.35), {
    center: { name: 'Продуктовая команда', note: 'единое окно для каналов' },
    nodes: [
      { name: 'Каналы продаж', items: ['Витрина и сценарии', 'Обучение менеджеров'], edge: 'требования' },
      { name: 'Страховая компания', items: ['Тарифы и андеррайтинг', 'Урегулирование'], edge: 'продукт' },
      { name: 'Риски и комплаенс', items: ['Согласование текстов', 'Проверка партнёров'], link: 'dashed', edge: 'согласование' },
      { name: 'ИТ-платформа', items: ['Интеграции', 'Мониторинг'], edge: 'релизы' },
    ],
  }), 'hub-diagram'),

  slide('matrix2x2', 'Где мы среди игроков', 'Оси важны покупателю, выгодный угол тоном', () => K.matrix2x2(B(0.55, 0.3), {
    x: { label: 'Скорость оформления', lo: 'дни', hi: 'минуты' }, y: { label: 'Цена', lo: 'дороже', hi: 'дешевле' },
    quadrants: ['', 'быстро и выгодно', '', ''],
    points: [{ name: 'Мы', x: 0.82, y: 0.7, us: true }, { name: 'Игрок А', x: 0.62, y: 0.3 }, { name: 'Игрок Б', x: 0.25, y: 0.62 }, { name: 'Игрок В', x: 0.18, y: 0.2 }],
  }), 'competition-2x2'),
];

module.exports = { S };
