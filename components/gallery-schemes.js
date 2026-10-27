// Галерея группы schemes: схемы связей (под-скилл «Схемы», reference/19-schemes.md). Данные вымышленные.
// Собирает scripts/gallery.sh schemes: копирует файл в проект и подключает в slides.js.
const L = require('./lib.js');
const K = require('./components.js');
const { C, W, M, T, chrome } = L;
const B = (dy = 0.3, pad = 0.15) => ({ x: M, y: T.canvas.bodyTop + dy, w: W - 2 * M, h: T.canvas.bodyBottom - T.canvas.bodyTop - dy - pad });
const slide = (id, title, sub, els, archetype) => () => ({ bg: 'bg_s2.jpg', archetype, els: [...chrome({ title: [{ t: id, c: C.accent }, { t: ` ${title}` }], sub, source: `Компонент ${id} · данные вымышленные`, panel: false }), ...els()] });

const S = [
  slide('schemeMap', 'Распределение ролей', 'Команда страхования — центр взаимодействия: связана с каждым участником напрямую', () => K.schemeMap(B(0.05, 0.02), {
    nodes: [
      { id: 'credit', name: 'Кредитный блок', at: [0, 0], icon: 'step_quote.png', items: ['Продукт кредитного страхования и выбор партнёра', 'CJM и P&L кредитного страхования', 'Пилоты и перевод в целевые процессы'] },
      { id: 'hub', kind: 'hub', name: 'Команда страхования', at: [1, 0], icon: 'cover_platform.png', items: ['Синхронизация стрима, SLA', 'Стратегия страхования', 'Некредитный продукт и CJM', 'Платформа*, пилоты, договоры'] },
      { id: 'dist', name: 'Дистрибуция', at: [2, 0], icon: 'step_catalog.png', items: ['Проникновение страхования в продажи', 'Обучение сети', 'Обратная связь по CJM и продукту'] },
      { id: 'ins', name: 'Страховая компания', at: [1, 1], icon: 'step_payment.png', items: ['Создаёт и реализует продукты', 'Ведёт свой бэклог доработок'] },
      { id: 'kpi', kind: 'note', name: 'Все участники отвечают за ключевые показатели стрима', at: [2, 1], icon: 'cover_platform.png' },
    ],
    edges: [
      { from: 'credit', to: 'dist', tag: 'Кредитное', text: 'продукт и обратная связь по CJM' },
      { from: 'credit', to: 'hub', tag: 'Кредитное', text: 'стратегия, платформа*' },
      { from: 'hub', to: 'dist', tag: 'Некредитное', text: 'продукт, обратная связь' },
      { from: 'hub', to: 'ins', pill: 'Единое окно', tag: 'Кредитное и некредитное', text: 'SLA, бэклог, договоры, сверка' },
      { from: 'credit', to: 'ins', kind: 'dashed', tag: 'Кредитное · оперативно', text: 'текущая коммуникация' },
    ],
    footnote: '* Концепция единой платформы в части кредитного страхования требует обсуждения',
  }), 'scheme-map'),

  slide('schemeMap', 'Кто участвует в продаже полиса', 'Раскладка сама: хаб сверху, связанные с ним рядом, без картинок', () => K.schemeMap(B(0.05, 0.05), {
    nodes: [
      { id: 'app', kind: 'hub', name: 'Приложение банка', items: ['Витрина и расчёт цены', 'Оплата в один шаг'] },
      { id: 'ins', name: 'Страховщик', items: ['Тарифы и андеррайтинг', 'Выпуск полиса'] },
      { id: 'pay', name: 'Платёжный контур', items: ['Списание и возвраты'] },
      { id: 'risk', name: 'Риски и комплаенс', items: ['Тексты и согласия', 'Проверка партнёров'] },
      { id: 'care', name: 'Поддержка', items: ['Вопросы по полису', 'Передача убытка'] },
    ],
    edges: [
      { from: 'app', to: 'ins', tag: 'API', text: 'котировка, выпуск' },
      { from: 'app', to: 'pay', tag: 'Деньги', text: 'оплата премии' },
      { from: 'app', to: 'risk', kind: 'dashed', tag: 'Согласование', text: 'тексты витрины, раз в релиз' },
      { from: 'ins', to: 'care', kind: 'dashed', tag: 'Убытки', text: 'статус выплаты' },
      { from: 'pay', to: 'care', tag: 'Возвраты', text: 'расторжение в периоде охлаждения' },
    ],
  }), 'scheme-map'),
  slide('hubSpoke', 'Кто работает вокруг продукта', 'Хаб в центре сетки, восемь участников, подписи связей в зазорах', () => K.hubSpoke(B(0.05, 0.05), {
    center: { name: 'Продукт страхования жилья', note: 'одна витрина и единый договор' },
    nodes: [
      { name: 'Каналы продаж', items: ['Витрина в приложении', 'Сценарии в офисе'], tag: 'Спрос', text: 'заявки и отказы' },
      { name: 'Страховщик', items: ['Тарифы и андеррайтинг'], tag: 'Продукт', text: 'условия и цена' },
      { name: 'Маркетинг', items: ['Кампании по базе'], tag: 'Трафик', text: 'сегменты' },
      { name: 'Урегулирование', items: ['Приём убытков'], tag: 'Сервис', text: 'статусы выплат', kind: 'dashed' },
      { name: 'Риски', items: ['Лимиты и проверки'], tag: 'Контроль', kind: 'dashed' },
      { name: 'Аналитика', items: ['Воронка и маржа'], tag: 'Данные' },
      { name: 'Юристы', items: ['Договоры и тексты'], tag: 'Тексты', kind: 'dashed' },
      { name: 'ИТ-платформа', items: ['Интеграции и релизы'], tag: 'Релизы' },
    ],
  }), 'scheme-hub-spoke'),

  slide('contextDiagram', 'С кем обменивается платформа', 'Система в контуре, пользователи сплошной связью, внешние системы пунктиром', () => K.contextDiagram(B(0.05, 0.05), {
    system: { name: 'Страховая платформа', items: ['Расчёт, выпуск, пролонгация', 'Единый реестр полисов'] },
    boundary: 'Контур банка',
    users: [
      { name: 'Клиент', items: ['Покупает полис в приложении'], tag: 'Покупка', text: 'расчёт и оплата' },
      { name: 'Менеджер офиса', items: ['Оформляет полис с кредитом'], tag: 'Продажа', text: 'заявка и печать' },
    ],
    external: [
      { name: 'Страховщик', items: ['Тарифы и выпуск'], tag: 'API', text: 'котировка, полис' },
      { name: 'Платёжный шлюз', items: ['Списание премии'], tag: 'Деньги', text: 'оплата и возврат' },
    ],
  }), 'scheme-context'),

  slide('contourMap', 'Что делаем сами, что отдаём партнёрам', 'Внутри контура — свои команды, снаружи — партнёры, связи пересекают границу', () => K.contourMap(B(0.05, 0.05), {
    inside: 'Внутри банка', outside: 'Партнёры',
    nodes: [
      { id: 'prod', name: 'Продуктовая команда', items: ['Витрина и сценарии продаж'], zone: 'in', hub: true },
      { id: 'dist', name: 'Сеть продаж', items: ['Офисы и колл-центр'], zone: 'in' },
      { id: 'data', name: 'Аналитика', items: ['Модели отклика'], zone: 'in' },
      { id: 'care', name: 'Поддержка', items: ['Первая линия по полису'], zone: 'in' },
      { id: 'ins', name: 'Страховщик', items: ['Андеррайтинг и выплаты'], zone: 'out' },
      { id: 'asst', name: 'Ассистанс', items: ['Выезд и помощь на месте'], zone: 'out' },
    ],
    edges: [
      { from: 'prod', to: 'dist', tag: 'Сценарии', text: 'скрипты и обучение' },
      { from: 'prod', to: 'ins', tag: 'Продукт', text: 'условия, SLA' },
      { from: 'prod', to: 'data', kind: 'dashed', tag: 'Данные', text: 'отклик и маржа' },
      { from: 'care', to: 'asst', kind: 'dashed', tag: 'Сервис', text: 'передача обращения' },
      { from: 'dist', to: 'care', tag: 'Клиент', text: 'вопросы после продажи' },
    ],
  }), 'scheme-contour'),

  slide('archFlows', 'Как запрос на полис проходит через систему', 'Слои строками, потоки со стрелками между соседними слоями', () => K.archFlows(B(0.1, 0.05), {
    layers: [
      { name: 'Каналы', blocks: [{ id: 'app', name: 'Приложение' }, { id: 'web', name: 'Сайт' }, { id: 'ofc', name: 'Офис' }] },
      { name: 'Сервисы', blocks: [{ id: 'calc', name: 'Расчёт цены', note: 'тарифы партнёра' }, { id: 'issue', name: 'Выпуск полиса', hub: true, note: 'единый процесс' }] },
      { name: 'Данные', blocks: [{ id: 'reg', name: 'Реестр полисов' }, { id: 'crm', name: 'CRM' }] },
      { name: 'Внешние', blocks: [{ id: 'ins', name: 'Страховщик' }, { id: 'pay', name: 'Платёжный шлюз' }] },
    ],
    flows: [
      { from: 'app', to: 'calc', tag: 'Запрос' }, { from: 'web', to: 'calc' }, { from: 'ofc', to: 'issue', tag: 'Заявка' },
      { from: 'calc', to: 'reg', kind: 'dashed' }, { from: 'issue', to: 'reg', tag: 'Запись' }, { from: 'issue', to: 'crm', kind: 'dashed' },
      { from: 'reg', to: 'ins', tag: 'Выгрузка', text: 'раз в сутки' }, { from: 'crm', to: 'pay', tag: 'Оплата' },
    ],
  }), 'scheme-arch-flows'),
];

module.exports = { S };
