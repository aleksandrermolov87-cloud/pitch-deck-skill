// Галерея группы orgs: оргструктуры подразделений и схемы связей (reference/19-schemes.md, раздел 7). Данные вымышленные.
// Собирает scripts/gallery.sh orgs: копирует файл в проект и подключает в slides.js.
const L = require('./lib.js');
const K = require('./components.js');
const { C, W, M, T, chrome } = L;
const B = (dy = 0.3, pad = 0.15) => ({ x: M, y: T.canvas.bodyTop + dy, w: W - 2 * M, h: T.canvas.bodyBottom - T.canvas.bodyTop - dy - pad });
const SRC = { type: 'user', date: '2026-10-30', quote: 'демо-данные галереи компонентов' };
const slide = (id, title, sub, els, archetype) => () => ({ bg: 'bg_s2.jpg', archetype, els: [...chrome({ title: [{ t: id, c: C.accent }, { t: ` ${title}` }], sub, source: `Компонент ${id} · данные вымышленные`, panel: false }), ...els()] });

const S = [
  slide('deptTree', 'Как устроен департамент страхования', 'Директор, управления и отделы: руководитель, штат и вакансии в каждом звене', () => K.deptTree(B(0.1, 0.05), {
    levels: ['Департамент', 'Управления', 'Отделы'],
    root: { name: 'Департамент страхования', lead: 'директор', size: 86, open: 6 },
    children: [
      { name: 'Управление продуктов', lead: 'начальник', size: 24, open: 2, children: [
        { name: 'Розничные полисы', size: 11 },
        { name: 'Полисы для бизнеса', size: 9, open: 2 },
      ] },
      { name: 'Управление продаж', lead: 'начальник', size: 38, open: 3, children: [
        { name: 'Цифровые каналы', size: 14 },
        { name: 'Партнёрские продажи', size: 12, open: 1 },
        { name: 'Сеть отделений', size: 10 },
      ] },
      { name: 'Урегулирование', lead: 'начальник', size: 24, open: 1, children: [
        { name: 'Выплаты', size: 15 },
        { name: 'Претензии', vacant: true, size: 4, open: 1 },
      ] },
    ],
  }, { src: SRC }), 'scheme-dept-tree'),

  slide('orgOutline', 'Штат и вакансии по звеньям департамента', 'Дерево отступами, руководитель колонкой, штат полосой, вакансии числом', () => K.orgOutline(B(0.05, 0.05), {
    cols: [{ key: 'size', name: 'Штат', unit: 'чел.', bar: true }, { key: 'open', name: 'Вакансии', accent: true }],
    root: { name: 'Департамент страхования', lead: 'Ирина Волкова', size: 86, open: 6 },
    children: [
      { name: 'Управление продуктов', lead: 'Олег Смирнов', size: 24, open: 2, children: [
        { name: 'Розничные полисы', lead: 'Мария Лебедева', size: 11, open: 0 },
        { name: 'Полисы для бизнеса', lead: 'Денис Орлов', size: 9, open: 2 },
      ] },
      { name: 'Управление продаж', lead: 'Анна Козлова', size: 38, open: 3, children: [
        { name: 'Цифровые каналы', lead: 'Павел Никитин', size: 14, open: 1 },
        { name: 'Партнёрские продажи', lead: 'Елена Соколова', size: 12, open: 1 },
        { name: 'Сеть отделений', lead: 'Игорь Попов', size: 10, open: 1 },
      ] },
      { name: 'Урегулирование', lead: 'Светлана Морозова', size: 24, open: 1, children: [
        { name: 'Выплаты', lead: 'Артём Новиков', size: 15, open: 0 },
        { name: 'Претензии', lead: 'набор', size: 4, open: 1 },
      ] },
    ],
  }, { src: SRC }), 'scheme-org-outline'),

  slide('spanOfControl', 'Трое руководителей перегружены', 'Прямые подчинённые у каждого руководителя, коридор нормы 5–8', () => K.spanOfControl(B(0.1, 0.05), {
    norm: [5, 8],
    managers: [
      { name: 'Анна Козлова', unit: 'управление продаж', span: 12 },
      { name: 'Павел Никитин', unit: 'цифровые каналы', span: 11 },
      { name: 'Олег Смирнов', unit: 'управление продуктов', span: 7 },
      { name: 'Елена Соколова', unit: 'партнёрские продажи', span: 6 },
      { name: 'Артём Новиков', unit: 'выплаты', span: 10 },
      { name: 'Мария Лебедева', unit: 'розничные полисы', span: 5 },
      { name: 'Денис Орлов', unit: 'полисы для бизнеса', span: 3 },
    ],
  }, { src: SRC }), 'span-of-control'),

  slide('dualReporting', 'Кому подразделения подчиняются', 'Сверху административное подчинение, снизу функциональное по направлениям', () => K.dualReporting(B(0.05, 0.05), {
    root: { name: 'Директор по страхованию', note: 'бюджет, цели, найм' },
    units: [
      { name: 'Продукты', lead: 'начальник управления', func: ['risk', 'fin'] },
      { name: 'Продажи', lead: 'начальник управления', func: ['fin'] },
      { name: 'Урегулирование', lead: 'начальник управления', func: ['risk', 'it'] },
      { name: 'Аналитика', lead: 'руководитель группы', func: ['it'] },
    ],
    functions: [
      { id: 'risk', name: 'Риски и комплаенс', note: 'тексты, согласия, лимиты' },
      { id: 'fin', name: 'Финансы', note: 'тарифы и план продаж' },
      { id: 'it', name: 'ИТ', note: 'данные и платформа' },
    ],
  }), 'scheme-dual-reporting'),

  slide('orgNest', 'Где работают 340 человек блока', 'Площадь пропорциональна штату: департаменты рамками, управления плитками', () => K.orgNest(B(0.1, 0.05), {
    units: [
      { name: 'Продажи', size: 142, lead: 'директор', children: [
        { name: 'Отделения', size: 64 }, { name: 'Цифровые каналы', size: 38 }, { name: 'Партнёры', size: 26 }, { name: 'Поддержка продаж', size: 14 },
      ] },
      { name: 'Урегулирование убытков', size: 86, children: [
        { name: 'Выплаты', size: 52 }, { name: 'Осмотры', size: 22 }, { name: 'Претензии', size: 12 },
      ] },
      { name: 'Продукты', size: 58, children: [
        { name: 'Розница', size: 30 }, { name: 'Бизнес', size: 18 }, { name: 'Тарифы', size: 10 },
      ] },
      { name: 'Технологии', size: 54, children: [
        { name: 'Разработка', size: 34 }, { name: 'Данные', size: 20 },
      ] },
    ],
  }, { src: SRC, highlight: 'Цифровые каналы' }), 'scheme-org-nest'),

  slide('teamTopology', 'Как команды работают вокруг потоков', 'Потоковые команды в центре, платформа справа, помогающие слева', () => K.teamTopology(B(0.05, 0.05), {
    streams: [
      { id: 's1', name: 'Страхование жилья', note: 'витрина, расчёт, продление' },
      { id: 's2', name: 'Страхование путешествий', note: 'покупка в приложении' },
      { id: 's3', name: 'Полисы при кредите', note: 'предложение в момент выдачи' },
    ],
    platform: { id: 'p', name: 'Страховая платформа', note: 'общие сервисы', items: ['Расчёт цены', 'Выпуск полиса', 'Платежи'] },
    enabling: [{ id: 'e1', name: 'Команда качества данных', note: 'учит потоки работать с данными' }],
    subsystems: [{ id: 'c1', name: 'Скоринг рисков', note: 'модели цены' }],
    links: [
      { from: 'e1', to: 's1', mode: 'facilitate' }, { from: 'e1', to: 's3', mode: 'facilitate' },
      { from: 'c1', to: 's3', mode: 'collab' },
      { from: 'p', to: 's1', mode: 'service' }, { from: 'p', to: 's2', mode: 'service' }, { from: 'p', to: 's3', mode: 'service' },
    ],
  }), 'scheme-team-topology'),

  slide('tribeChapters', 'Как устроена agile-модель страхования', 'Трайбы и сквады колонками, чаптеры поперёк, гильдия по желанию', () => K.tribeChapters(B(0.05, 0.05), {
    tribes: [
      { name: 'Трайб «Розница»', squads: [
        { name: 'Жильё', note: 'полисы квартиры', chapters: [0, 1, 2] },
        { name: 'Путешествия', chapters: [0, 1, 3] },
        { name: 'Здоровье', chapters: [0, 2, 3] },
      ] },
      { name: 'Трайб «Бизнес»', squads: [
        { name: 'Имущество', chapters: [0, 1, 2] },
        { name: 'ДМС', note: 'для сотрудников', chapters: [0, 1, 2, 3] },
      ] },
      { name: 'Трайб «Сервис»', squads: [
        { name: 'Выплаты', chapters: [0, 2, 3] },
        { name: 'Продление', chapters: [0, 1] },
      ] },
    ],
    chapters: [
      { name: 'Разработка', lead: 'О. Смирнов' },
      { name: 'Аналитика', lead: 'М. Лебедева' },
      { name: 'Дизайн', lead: 'Д. Орлов' },
      { name: 'Тестирование', lead: 'А. Козлова' },
    ],
    guild: { name: 'Гильдия данных', squads: ['Жильё', 'ДМС', 'Выплаты'] },
  }), 'scheme-tribe-chapters'),

  slide('orgTransition', 'Что меняется в структуре с января', 'Слева сейчас, справа после реорганизации; скобки — объединения и разделения', () => K.orgTransition(B(0.05, 0.05), {
    before: { head: 'Сейчас', units: [
      { id: 'a1', name: 'Отдел розничных продуктов', size: 11 },
      { id: 'a2', name: 'Отдел продуктов для бизнеса', size: 9 },
      { id: 'a3', name: 'Отдел онлайн-продаж', size: 14 },
      { id: 'a4', name: 'Отдел продаж в отделениях', size: 10 },
      { id: 'a5', name: 'Группа отчётности', size: 4 },
      { id: 'a6', name: 'Отдел выплат', size: 15 },
    ] },
    after: { head: 'С января', units: [
      { id: 'b1', name: 'Продуктовый офис', size: 20 },
      { id: 'b2', name: 'Омниканальные продажи', size: 24 },
      { id: 'b3', name: 'Урегулирование', size: 15 },
      { id: 'b4', name: 'Центр данных', size: 6, isNew: true },
    ] },
    moves: [
      { from: 'a1', to: 'b1' }, { from: 'a2', to: 'b1' },
      { from: 'a3', to: 'b2' }, { from: 'a4', to: 'b2' },
      { from: 'a6', to: 'b3', tag: 'без изменений' },
    ],
  }, { src: SRC }), 'scheme-org-transition'),

  slide('regionNetwork', 'Как устроена сеть продаж полисов', 'Головной офис, региональные дирекции и число точек продаж у каждой', () => K.regionNetwork(B(0.1, 0.05), {
    center: { name: 'Головной офис', note: 'продукты и тарифы' },
    regions: [
      { name: 'Центр', note: 'Москва и область', points: 64 },
      { name: 'Северо-Запад', points: 28 },
      { name: 'Урал', points: 22 },
      { name: 'Сибирь', points: 18 },
      { name: 'Юг', points: 31 },
      { name: 'Поволжье', points: 25 },
    ],
  }, { src: SRC }), 'scheme-region-network'),

  slide('gradePyramid', 'Сколько людей на каждом уровне', 'Ширина полосы — численность, справа доля от всех сотрудников блока', () => K.gradePyramid(B(0.1, 0.05), {
    levels: [
      { name: 'Директора', note: 'N-1', size: 6 },
      { name: 'Руководители управлений', note: 'N-2', size: 18 },
      { name: 'Руководители отделов', note: 'N-3', size: 46 },
      { name: 'Ведущие специалисты', size: 112 },
      { name: 'Специалисты', size: 158 },
    ],
  }, { src: SRC }), 'grade-pyramid'),

  slide('relationshipWeb', 'С кем команда работает теснее всего', 'Толщина связи — плотность взаимодействия, главные подписаны', () => K.relationshipWeb(B(0.05, 0.05), {
    nodes: [
      { id: 'ins', name: 'Команда страхования', hub: true },
      { id: 'cr', name: 'Кредитный блок', note: 'предложение при выдаче' },
      { id: 'dig', name: 'Цифровые каналы' },
      { id: 'risk', name: 'Риски', note: 'тексты и согласия' },
      { id: 'pt', name: 'Страховая компания' },
      { id: 'cc', name: 'Контакт-центр' },
      { id: 'fin', name: 'Финансы' },
    ],
    links: [
      { from: 'ins', to: 'cr', weight: 3, tag: 'продажи' },
      { from: 'ins', to: 'pt', weight: 3, tag: 'продукт' },
      { from: 'ins', to: 'dig', weight: 2 },
      { from: 'ins', to: 'risk', weight: 2 },
      { from: 'ins', to: 'cc', weight: 1 },
      { from: 'ins', to: 'fin', weight: 1 },
      { from: 'cr', to: 'risk', weight: 1, kind: 'dashed' },
      { from: 'cc', to: 'pt', weight: 1, kind: 'dashed' },
    ],
  }), 'scheme-relationship-web'),

  slide('interactionMatrix', 'Кто от кого зависит в работе', 'Строка обращается к столбцу, размер точки — плотность', () => K.interactionMatrix(B(0.05, 0.05), {
    units: [
      { name: 'Продукты', short: 'Прод' }, { name: 'Продажи', short: 'Продаж' }, { name: 'Урегулирование', short: 'Урег' },
      { name: 'Риски', short: 'Риски' }, { name: 'ИТ', short: 'ИТ' }, { name: 'Финансы', short: 'Фин' },
    ],
    cells: [
      { from: 'Прод', to: 'Риски', level: 3 }, { from: 'Прод', to: 'ИТ', level: 3 }, { from: 'Прод', to: 'Фин', level: 2 }, { from: 'Прод', to: 'Продаж', level: 2 },
      { from: 'Продаж', to: 'Прод', level: 3 }, { from: 'Продаж', to: 'ИТ', level: 2 }, { from: 'Продаж', to: 'Фин', level: 1 },
      { from: 'Урег', to: 'ИТ', level: 2 }, { from: 'Урег', to: 'Риски', level: 1 }, { from: 'Урег', to: 'Прод', level: 1 },
      { from: 'Риски', to: 'Прод', level: 2 },
      { from: 'ИТ', to: 'Прод', level: 1 },
      { from: 'Фин', to: 'Продаж', level: 2 }, { from: 'Фин', to: 'Прод', level: 1 },
    ],
  }), 'scheme-interaction-matrix'),

  slide('arcHandoffs', 'Где работа переходит между отделами', 'Сверху передачи дальше, снизу возвраты; толщина — объём заявок', () => K.arcHandoffs(B(0.05, 0.05), {
    units: [
      { id: 'sale', name: 'Продажи', note: 'заявка клиента' },
      { id: 'uw', name: 'Андеррайтинг', note: 'оценка риска' },
      { id: 'risk', name: 'Риски', note: 'согласие' },
      { id: 'ops', name: 'Операции', note: 'выпуск полиса' },
      { id: 'cc', name: 'Контакт-центр', note: 'сопровождение' },
    ],
    handoffs: [
      { from: 'sale', to: 'uw', weight: 3, tag: 'каждая заявка' },
      { from: 'uw', to: 'ops', weight: 3 },
      { from: 'uw', to: 'risk', weight: 1 },
      { from: 'risk', to: 'ops', weight: 1 },
      { from: 'ops', to: 'cc', weight: 2 },
      { from: 'sale', to: 'ops', weight: 2, tag: 'без анкеты' },
      { from: 'uw', to: 'sale', weight: 1, tag: 'нет документов' },
      { from: 'risk', to: 'uw', weight: 1 },
    ],
  }), 'scheme-arc-handoffs'),
];

module.exports = { S };
