// Галерея группы «Мокапы экранов»: по слайду на компонент из kit/screens.js, экраны и данные вымышленные.
// Демо-экраны — components/demo-screens/*.png (генератор make.py), gallery.sh копирует их в img/screens/.
// Собирает scripts/gallery.sh screens. Заодно образец вызова: box, data, opt.
const L = require('./lib.js');
const K = require('./components.js');
const { C, W, M, T, chrome } = L;
const SRC = { type: 'user', date: '2026-10-27', quote: 'демо-данные галереи компонентов' };
const B = (dy = 0.3, pad = 0.15) => ({ x: M, y: T.canvas.bodyTop + dy, w: W - 2 * M, h: T.canvas.bodyBottom - T.canvas.bodyTop - dy - pad });
const slide = (id, title, sub, els, archetype) => () => ({ bg: 'bg_s2.jpg', archetype, els: [...chrome({ title: [{ t: id, c: C.accent }, { t: ` ${title}` }], sub, source: `Компонент ${id} · экраны и данные вымышленные`, panel: false }), ...els()] });
const scr = f => `screens/${f}`;

const S = [
  slide('phoneHero', 'Полисы видны рядом со счетами', 'Один экран в рамке телефона, рядом три тезиса с эффектом числом', () => K.phoneHero(B(0.6), {
    screen: scr('app-home.png'), what: 'главный экран: счёт и активные полисы',
    points: [
      { value: 34, unit: '%', sign: true, label: 'рост просмотров полисов, %', head: 'Полисы на главном экране', body: 'Срок и статус каждого полиса видны без перехода в раздел страхования' },
      { prefix: 'в', value: 2.1, digits: 1, unit: 'раза', label: 'рост продлений из приложения, раз', head: 'Продление в одно касание', body: 'Напоминание за месяц до конца срока, оплата картой банка' },
      { value: 18, unit: '%', label: 'доля новых полисов с главного экрана, %', head: 'Полис на поездку вовремя', body: 'Предложение появляется после покупки билетов картой' },
    ],
  }, { src: SRC }), 'phone-hero'),

  slide('phoneFlow', 'КАСКО оформляется за четыре экрана', 'Экраны сценария в ряд, стрелки между ними, под каждым шаг по сути', () => K.phoneFlow(B(0.3), {
    steps: [
      { screen: scr('app-home.png'), head: 'Выбор продукта', body: 'КАСКО на главной, рядом со счетами' },
      { screen: scr('app-quote.png'), head: 'Расчёт цены', body: 'Цена по данным банка, без анкеты' },
      { screen: scr('app-pay.png'), head: 'Оплата картой', body: 'Сразу или в рассрочку без переплаты' },
      { screen: scr('app-policy.png'), head: 'Готовый полис', body: 'Документ в приложении и на почте' },
    ],
  }, { src: SRC }), 'phone-flow'),

  slide('desktopShowcase', 'Полисы клиента на одном экране', 'Экран в окне браузера, выноски тонкими линиями к подписям по сторонам', () => K.desktopShowcase(B(0.3), {
    screen: scr('web-cabinet.png'), what: 'веб-кабинет менеджера: полисы клиента', url: 'polis.example/kabinet',
    callouts: [
      { at: [0.03, 0.204], head: 'Все продукты в одном разделе', body: 'КАСКО, квартира и поездки без переключения систем' },
      { at: [0.2, 0.802], head: 'Взносы по месяцам', body: 'Видно, когда клиент платит и сколько' },
      { at: [0.67, 0.587], value: 27, unit: '%', sign: true, label: 'рост продлений через менеджера, %', head: 'Подсказка о продлении', body: 'Статус меняется за месяц до конца срока' },
      { at: [0.963, 0.068], value: 4, unit: 'мин', label: 'время оформления полиса менеджером, мин', head: 'Новый полис из карточки', body: 'Данные клиента подставляются сами' },
    ],
  }, { src: SRC }), 'desktop-showcase'),

  slide('screensBeforeAfter', 'Оплат вдвое больше без анкеты', 'Экраны «было» и «стало» по краям, между ними изменения с эффектом числом', () => K.screensBeforeAfter(B(0.3), {
    before: { screen: scr('app-form-old.png'), what: 'старая анкета КАСКО на девять полей', head: 'Было', note: 'анкета на шести экранах' },
    after: { screen: scr('app-quote.png'), what: 'расчёт КАСКО по данным банка', head: 'Стало', note: 'цена на первом экране' },
    changes: [
      { name: 'Время до цены', a: 6, b: 1, unit: 'мин', better: 'down' },
      { name: 'Полей вручную', a: 9, b: 2, better: 'down' },
      { name: 'Доходят до оплаты', a: 27, b: 58, unit: '%', better: 'up' },
    ],
  }, { src: SRC }), 'screens-before-after'),

  slide('multiDevice', 'Начал в вебе, оплатил в телефоне', 'Веб-экран крупно, телефон поверх угла, рядом тезисы про омниканальность', () => K.multiDevice(B(0.3), {
    web: { screen: scr('web-cabinet.png'), what: 'веб-кабинет с полисами клиента', url: 'polis.example/kabinet' },
    phone: { screen: scr('app-policy.png'), what: 'оформленный полис в приложении' },
    points: [
      { value: 3, unit: 'канала', label: 'каналов с общим профилем', head: 'Один профиль везде', body: 'Веб, приложение и офис видят один черновик полиса' },
      { value: 41, unit: '%', label: 'доля покупок со сменой канала, %', head: 'Смена канала без потерь', body: 'Черновик сохраняется при переходе с ноутбука на телефон' },
      { value: 12, unit: '%', sign: true, label: 'рост конверсии в оплату, %', head: 'Меньше брошенных заявок', body: 'Напоминание приходит туда, где клиент сейчас' },
    ],
  }, { src: SRC }), 'multi-device'),
];

module.exports = { S };
