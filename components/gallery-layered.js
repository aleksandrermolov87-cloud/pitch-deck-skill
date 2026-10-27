// Галерея группы layered: слоистые схемы слева направо (kit/layered.js, reference/19-schemes.md). Данные вымышленные.
// Собирает scripts/gallery.sh layered: копирует файл в проект и подключает в slides.js.
const L = require('./lib.js');
const K = require('./components.js');
const { C, W, M, T, chrome } = L;
const B = (dy = 0.3, pad = 0.15) => ({ x: M, y: T.canvas.bodyTop + dy, w: W - 2 * M, h: T.canvas.bodyBottom - T.canvas.bodyTop - dy - pad });
const slide = (id, title, sub, els, archetype) => () => ({ bg: 'bg_s2.jpg', archetype, els: [...chrome({ title: [{ t: id, c: C.accent }, { t: ` ${title}` }], sub, source: `Компонент ${id} · данные вымышленные`, panel: false }), ...els()] });

const S = [
  slide('stateMachine', 'Жизненный путь полиса', 'Статусы пилюлями, события на переходах, возврат на доработку под схемой', () => K.stateMachine(B(0.1, 0.05), {
    states: [
      { id: 'draft', name: 'Черновик', kind: 'start', note: 'клиент заполняет анкету' },
      { id: 'check', name: 'Проверка', note: 'андеррайтинг' },
      { id: 'active', name: 'Действует' },
      { id: 'claim', name: 'Убыток заявлен' },
      { id: 'paid', name: 'Выплачен', kind: 'end' },
      { id: 'refused', name: 'Отказ', kind: 'bad' },
      { id: 'cancel', name: 'Расторгнут', kind: 'bad' },
      { id: 'expired', name: 'Истёк', kind: 'end' },
    ],
    transitions: [
      { from: 'draft', to: 'check', label: 'оплата премии' },
      { from: 'check', to: 'active', label: 'риск принят' },
      { from: 'check', to: 'draft', label: 'нужны документы' },
      { from: 'active', to: 'claim', label: 'заявление' },
      { from: 'active', to: 'cancel', label: 'отказ клиента' },
      { from: 'active', to: 'expired', label: 'конец срока' },
      { from: 'claim', to: 'paid', label: 'решение да' },
      { from: 'claim', to: 'refused', label: 'решение нет' },
    ],
  }), 'scheme-state-machine'),

  slide('dependencyGraph', 'Что нужно запустить раньше', 'Волны колонками, стрелка — «нужно до», пунктир — желательная связь', () => K.dependencyGraph(B(0.05, 0.05), {
    waves: ['Первая волна', 'Вторая волна', 'Третья волна'],
    items: [
      { id: 'api', wave: 0, owner: 'ИТ', name: 'API страховщика', note: 'котировка и выпуск' },
      { id: 'kyc', wave: 0, owner: 'Риски', name: 'Тексты и согласия' },
      { id: 'pay', wave: 0, owner: 'Платежи', name: 'Оплата картой' },
      { id: 'shop', wave: 1, owner: 'Продукт', name: 'Витрина в приложении', note: 'два продукта' },
      { id: 'crm', wave: 1, owner: 'CRM', name: 'Триггеры предложений' },
      { id: 'claim', wave: 2, owner: 'Сервис', name: 'Заявление об убытке онлайн' },
      { id: 'cross', wave: 2, owner: 'Продукт', name: 'Полис к кредиту' },
    ],
    deps: [
      { from: 'api', to: 'shop', kind: 'solid' },
      { from: 'kyc', to: 'shop', kind: 'solid' },
      { from: 'pay', to: 'shop', kind: 'solid' },
      { from: 'shop', to: 'cross', kind: 'solid' },
      { from: 'crm', to: 'cross', kind: 'dashed' },
      { from: 'api', to: 'claim', kind: 'dashed' },
    ],
  }), 'scheme-dependency-graph'),

  slide('dataFlow', 'Откуда берутся данные о клиенте', 'Источники слева, витрина данных в центре, потребители справа; на потоках — частота и что передаётся', () => K.dataFlow(B(0.05, 0.05), {
    sources: [
      { id: 'core', name: 'Банковская система', note: 'счета и карты' },
      { id: 'ins', name: 'Страховщик', note: 'полисы и убытки' },
      { id: 'app', name: 'Приложение', note: 'события и отклики' },
    ],
    core: { id: 'dwh', name: 'Витрина клиента', items: ['Единый профиль', 'Согласия и ограничения', 'Признаки для моделей'] },
    consumers: [
      { id: 'crm', name: 'CRM и рассылки', note: 'персональные предложения' },
      { id: 'risk', name: 'Риск-модели', note: 'цена и андеррайтинг' },
      { id: 'bi', name: 'Отчётность', note: 'продажи и убыточность' },
    ],
    flows: [
      { from: 'core', to: 'dwh', tag: 'Ежедневно', text: 'операции, остатки' },
      { from: 'ins', to: 'dwh', tag: 'Онлайн', text: 'статусы полисов' },
      { from: 'app', to: 'dwh', tag: 'Поток', text: 'клики и отклики', kind: 'dashed' },
      { from: 'dwh', to: 'crm', tag: 'Онлайн', text: 'сегменты' },
      { from: 'dwh', to: 'risk', tag: 'Ежедневно', text: 'признаки' },
      { from: 'dwh', to: 'bi', tag: 'Раз в неделю', text: 'агрегаты', kind: 'dashed' },
    ],
  }), 'scheme-data-flow'),

  slide('impactChain', 'Как витрина в приложении даёт доход', 'Инициатива → метрика → эффект; главная цепочка акцентом, побочные влияния тонко', () => K.impactChain(B(0.05, 0.05), {
    cols: ['Инициатива', 'Метрика продукта', 'Метрика бизнеса', 'Эффект'],
    nodes: [
      { id: 'shop', col: 0, name: 'Витрина в приложении', note: 'расчёт цены в два касания' },
      { id: 'cross', col: 0, name: 'Полис к кредиту' },
      { id: 'conv', col: 1, name: 'Конверсия в покупку' },
      { id: 'reach', col: 1, name: 'Охват предложением' },
      { id: 'pen', col: 2, name: 'Проникновение страхования' },
      { id: 'ret', col: 2, name: 'Удержание клиентов' },
      { id: 'fee', col: 3, name: 'Комиссионный доход' },
    ],
    links: [
      { from: 'shop', to: 'conv', main: true },
      { from: 'conv', to: 'pen', main: true },
      { from: 'pen', to: 'fee', main: true },
      { from: 'shop', to: 'reach' },
      { from: 'cross', to: 'reach' },
      { from: 'reach', to: 'pen' },
      { from: 'pen', to: 'ret' },
      { from: 'ret', to: 'fee' },
    ],
  }), 'scheme-impact-chain'),
];

module.exports = { S };
