// Галерея группы lanes: схемы по дорожкам (под-скилл «Схемы», reference/19-schemes.md). Данные вымышленные.
// Собирает scripts/gallery.sh lanes: копирует файл в проект и подключает в slides.js.
const L = require('./lib.js');
const K = require('./components.js');
const { C, W, M, T, chrome } = L;
const B = (dy = 0.3, pad = 0.15) => ({ x: M, y: T.canvas.bodyTop + dy, w: W - 2 * M, h: T.canvas.bodyBottom - T.canvas.bodyTop - dy - pad });
const slide = (id, title, sub, els, archetype) => () => ({ bg: 'bg_s2.jpg', archetype, els: [...chrome({ title: [{ t: id, c: C.accent }, { t: ` ${title}` }], sub, source: `Компонент ${id} · данные вымышленные`, panel: false }), ...els()] });

const S = [
  slide('swimlaneFlow', 'Как оформляется полис', 'Дорожки участников, решение ромбом, переходы со стрелками', () => K.swimlaneFlow(B(0.1, 0.05), {
    lanes: ['Клиент', 'Менеджер', 'Андеррайтер', 'Страховщик'],
    steps: [
      { id: 'a', lane: 0, col: 0, name: 'Заявка в приложении', kind: 'start' },
      { id: 'b', lane: 1, col: 1, name: 'Проверка анкеты' },
      { id: 'c', lane: 1, col: 2, name: 'Стандартный риск?', kind: 'decision' },
      { id: 'd', lane: 2, col: 3, name: 'Индивидуальная оценка' },
      { id: 'e', lane: 3, col: 4, name: 'Выпуск полиса' },
      { id: 'f', lane: 0, col: 5, name: 'Полис в приложении', kind: 'end' },
    ],
    links: [
      { from: 'a', to: 'b' }, { from: 'b', to: 'c' },
      { from: 'c', to: 'e', label: 'да' }, { from: 'c', to: 'd', label: 'нет' },
      { from: 'd', to: 'e' }, { from: 'e', to: 'f', label: 'уведомление' },
    ],
  }), 'scheme-swimlane-flow'),

  slide('serviceBlueprint', 'Что видит клиент и что за сценой', 'Линии взаимодействия и видимости делят фронт и бэк-офис', () => K.serviceBlueprint(B(0.05, 0.05), {
    stages: ['Узнаёт', 'Оформляет', 'Платит', 'Получает полис'],
    lanes: ['Клиент', 'Приложение', 'Бэк-офис', 'Системы'],
    lines: [{ after: 0, name: 'Взаимодействие' }, { after: 1, name: 'Видимость', accent: true }],
    steps: [
      { lane: 0, stage: 0, name: 'Видит предложение в ленте' }, { lane: 0, stage: 1, name: 'Заполняет две формы' },
      { lane: 0, stage: 2, name: 'Подтверждает оплату' }, { lane: 0, stage: 3, name: 'Открывает полис' },
      { lane: 1, stage: 0, name: 'Персональная витрина' }, { lane: 1, stage: 1, name: 'Расчёт цены на лету' },
      { lane: 1, stage: 2, name: 'Оплата в один шаг' }, { lane: 1, stage: 3, name: 'Полис в разделе «Страхование»' },
      { lane: 2, stage: 1, name: 'Проверка рисков' }, { lane: 2, stage: 3, name: 'Сверка с партнёром' },
      { lane: 3, stage: 0, name: 'Модель отклика' }, { lane: 3, stage: 2, name: 'Платёжный контур' }, { lane: 3, stage: 3, name: 'Шлюз страховщика' },
    ],
    links: [
      { from: [0, 0], to: [1, 0] }, { from: [3, 0], to: [1, 0] }, { from: [0, 1], to: [1, 1] }, { from: [1, 1], to: [2, 1] },
      { from: [0, 2], to: [1, 2] }, { from: [1, 2], to: [3, 2] }, { from: [3, 3], to: [2, 3] }, { from: [2, 3], to: [1, 3] },
    ],
  }), 'scheme-service-blueprint'),

  slide('sequenceDiagram', 'Как проходит расчёт цены', 'Участники сверху, сообщения по порядку, ответы пунктиром', () => K.sequenceDiagram(B(0.1, 0.05), {
    actors: ['Клиент', 'Приложение', 'Шлюз партнёра', 'Страховщик'],
    messages: [
      { from: 'Клиент', to: 'Приложение', text: 'Запрос цены полиса' },
      { from: 'Приложение', to: 'Шлюз партнёра', text: 'Данные для расчёта' },
      { from: 'Шлюз партнёра', to: 'Страховщик', text: 'Запрос котировки' },
      { from: 'Страховщик', to: 'Шлюз партнёра', text: 'Цена и условия', kind: 'reply' },
      { from: 'Шлюз партнёра', to: 'Приложение', text: 'Готовое предложение', kind: 'reply' },
      { from: 'Приложение', to: 'Клиент', text: 'Цена в приложении', kind: 'reply' },
      { from: 'Клиент', to: 'Приложение', text: 'Оплата премии' },
      { from: 'Приложение', to: 'Страховщик', text: 'Выпуск полиса после оплаты' },
    ],
  }), 'scheme-sequence-diagram'),

  slide('handoffTimeline', 'Кто когда передаёт работу', 'Полосы работ по дорожкам, передачи стрелками на шкале', () => K.handoffTimeline(B(0.1, 0.05), {
    ticks: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн'],
    lanes: ['Продукт', 'Юристы', 'Страховщик', 'ИТ'],
    bars: [
      { lane: 0, from: 0, to: 1.5, name: 'Концепция', accent: true }, { lane: 1, from: 1.5, to: 3, name: 'Договор и правила' },
      { lane: 2, from: 3, to: 4.5, name: 'Тарифы и выпуск' }, { lane: 3, from: 2.5, to: 5, name: 'Интеграция и витрина' },
      { lane: 0, from: 5, to: 6, name: 'Пилот', accent: true },
    ],
    handoffs: [
      { at: 1.5, from: 0, to: 1, text: 'концепция' }, { at: 3, from: 1, to: 2, text: 'подписанный договор' },
      { at: 4.5, from: 2, to: 3, text: 'тарифы' }, { at: 5, from: 3, to: 0, text: 'готовая витрина' },
    ],
  }), 'scheme-handoff-timeline'),

  slide('escalationLadder', 'Куда идёт обращение клиента', 'Уровни ступенями, условие перехода на каждой связи', () => K.escalationLadder(B(0.1, 0.05), {
    levels: [
      { name: 'Чат поддержки', who: 'операторы банка', sla: 'реакция сразу', items: ['Статус полиса', 'Документы'] },
      { name: 'Эксперт по страхованию', who: 'команда страхования', sla: 'в течение дня', items: ['Спорные условия'] },
      { name: 'Страховщик', who: 'отдел урегулирования', sla: 'до трёх дней', items: ['Убыток и выплата'] },
      { name: 'Комитет по качеству', who: 'банк и партнёр', sla: 'раз в неделю', items: ['Жалобы и решения'] },
    ],
    conditions: ['вопрос не по статусу', 'нужна выплата', 'клиент оспаривает'],
  }), 'scheme-escalation-ladder'),
];

module.exports = { S };
