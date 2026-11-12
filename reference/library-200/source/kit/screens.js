// Группа «Мокапы экранов»: настоящий экран продукта (PNG из Figma или скриншот) в рамке устройства и смысловой текст рядом.
// Экран передаётся путём в img/: data.screen = 'screens/app-home.png'. Картинка вписывается по своим пропорциям,
// рамка устройства подстраивается под них. Нет файла — заглушка тоном C.rule с подписью «[экран: что должно быть]»
// и console.warn; аудит ловит её предупреждением «мокап экрана не вставлен».
// Устройства не заходят в зону фирменных полос справа (как processSteps). Каталог и правила: components/README.md.
const fs = require('fs'), path = require('path');
const L = require('../lib.js');
const U = require('./util.js');
const { T, C, THEME, rect, oval, hline, text, tw, nb } = L;
const { num, minus, unitOf, lines, lh, seg, spread } = U;

const STRIPE_X = T.bg && T.bg.stripes ? T.canvas.w * T.bg.stripes[0][0] - 0.1 : Infinity;
const imgPath = f => path.join(__dirname, '..', 'img', f);
const hasFile = f => !!f && fs.existsSync(imgPath(f));
const rnd = (v, d = 0) => Math.round(v * 10 ** d) / 10 ** d;
const diffUnit = u => (u === '%' ? unitOf('п. п.') : unitOf(u));          // разница процентов — в процентных пунктах

// Размер картинки из заголовка PNG или JPEG
function imgDims(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  for (let i = 2; i < b.length;) {
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc2) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  return [0, 0];
}
// Высота экрана к ширине: по файлу, иначе пропорция устройства по умолчанию
const ratioOf = (file, def) => {
  if (!hasFile(file)) return def;
  const [iw, ih] = imgDims(imgPath(file));
  return iw && ih ? ih / iw : def;
};

// Число со знаком и приставкой: «+34», «−9», «в 2,1»
function val(p, src, label) {
  let s = num(label || p.label || p.head, p.value, p.src || src, p.digits || 0);
  s = p.value < 0 ? minus(s) : p.sign && p.value > 0 ? '+' + s : s;
  return (p.prefix ? p.prefix + nb : '') + s;
}
// Кегль числа, чтобы число с единицей влезло в ширину колонки
const fitPt = (s, unit, w, pt) => {
  const k = Math.min(1, w / (tw(s, pt, true) + tw(unitOf(unit), pt / 2, true) + 0.05));
  return Math.max(20, Math.floor(pt * k));
};

// ── устройства ──
// Корпус телефона: на тёмной теме карточный тон с контуром, на светлой — тёмный корпус
const body = () => (THEME === 'dark' ? { fill: C.card, line: C.line, lw: 1 } : { fill: C.ink });

// Экран устройства: картинка или заглушка «[экран: …]» (тон C.rule, подпись внутри непрозрачной фигуры).
// visW — видимая слева ширина экрана, если его правую часть закрывает другое устройство: подпись встаёт в неё.
function screenArea(x, y, w, h, file, what, who, r = 0, visW = w) {
  if (hasFile(file)) return [L.image(x, y, w, h, file, { contain: true })];
  console.warn(`${who}: нет файла img/${file || '(не задан)'}, нарисована заглушка экрана`);
  const s = `[экран: ${what || 'экран продукта'}]`, pt = w < 2.2 ? 9.5 : 11, iw = Math.min(w, visW) - 0.3, th = lh(pt) * lines(s, pt, iw) + 0.04;
  return [
    rect(x, y, w, h, { r, fill: C.rule }),
    text(x + 0.15, y + (h - th) / 2, iw, th, s, { size: pt, color: C.ink2, align: 'center', valign: 'middle', ls: 1.1 }),
  ];
}

// Геометрия телефона высотой h: рамка b, скругление корпуса R (квадратные углы экрана остаются внутри скругления)
function phoneSize(h, file) {
  const r = ratioOf(file, 19.5 / 9), b = Math.max(0.08, h * 0.022), sh = h - 2 * b, sw = sh / r;
  return { W: sw + 2 * b, H: h, b, sw, sh, R: Math.min(0.34, b * 3.2) };
}
function phone(x, y, h, file, what, who) {
  const g = phoneSize(h, file), els = [];
  els.push(rect(x, y, g.W, h, { r: g.R, ...body() }));
  els.push(...screenArea(x + g.b, y + g.b, g.sw, g.sh, file, what, who, g.R - g.b));
  const iw = g.sw * 0.27, ih = Math.max(0.08, g.sh * 0.028);           // островок камеры
  els.push(rect(x + g.W / 2 - iw / 2, y + g.b + g.sh * 0.014, iw, ih, { r: ih / 2, fill: body().fill }));
  return { els, ...g, x, y, sx: x + g.b, sy: y + g.b };
}

// Окно браузера шириной w: полоса с тремя точками и адресом, под ней экран. maxH ограничивает высоту (ширина ужимается).
function browserSize(w, file, maxH) {
  const r = ratioOf(file, 10 / 16), bar = 0.34, p = 0.06;
  let sw = w - 2 * p, sh = sw * r;
  if (maxH && bar + sh + p > maxH) { sh = maxH - bar - p; sw = sh / r; }
  return { W: sw + 2 * p, H: bar + sh + p, sw, sh, bar, p };
}
function browser(x, y, w, file, what, url, who, maxH, visW) {
  const g = browserSize(w, file, maxH), els = [];
  els.push(rect(x, y, g.W, g.H, { r: 0.12, fill: C.card, line: C.line, lw: 1 }));
  [0, 1, 2].forEach(i => els.push(oval(x + 0.2 + i * 0.15, y + g.bar / 2, 0.085, { fill: C.axis })));
  if (url) {
    const uw = Math.min(g.W * 0.44, tw(url, 9) + 0.6), uh = 0.2, ux = x + (g.W - uw) / 2, uy = y + (g.bar - uh) / 2;
    els.push(rect(ux, uy, uw, uh, { r: uh / 2, fill: C.bg }));
    els.push(text(ux, uy, uw, uh, url, { size: 9, color: C.muted, align: 'center', valign: 'middle' }));
  }
  els.push(...screenArea(x + g.p, y + g.bar, g.sw, g.sh, file, what, who, 0, visW));
  return { els, ...g, x, y, sx: x + g.p, sy: y + g.bar };
}

// Строки тезисов: крупное число-эффект, рядом заголовок и пояснение. Выключка к устройству (align 'left' или 'right').
// Кегль чисел общий для всех строк: подбирается по самому широкому числу, колонка числа — по нему же.
function thesisRows(x, y, w, h, pts, src, { numW, align = 'left', numPt = 36, headPt = 16, bodyPt = 12 }) {
  const els = [], right = align === 'right', n = pts.length, rh = h / n;
  const S = pts.map(p => (p.value != null ? val(p, src) : null));
  const wid = (s, p, pt) => (s ? tw(s, pt, true) + tw(unitOf(p.unit), pt / 2, true) : 0);
  const NW = numW || Math.max(1.6, ...pts.map((p, i) => wid(S[i], p, numPt) + 0.3));
  const pt = Math.min(...pts.map((p, i) => (S[i] ? fitPt(S[i], p.unit, NW - 0.3, numPt) : numPt))), cw = w - NW;
  pts.forEach((p, i) => {
    const yy = y + i * rh;
    if (i) els.push(hline(x, x + w, yy, { color: C.rule, lw: 0.75 }));
    if (S[i]) els.push(text(right ? x + w - NW : x, yy + rh / 2 - 0.38, NW, 0.76, [{ t: S[i] }, { t: unitOf(p.unit), s: Math.round(pt / 2) }], { size: pt, bold: true, color: C.accentInk, align, valign: 'middle' }));
    const hl = lines(p.head, headPt, cw, true), bl = p.body ? lines(p.body, bodyPt, cw) : 0;
    const bh = lh(headPt) * hl + (bl ? 0.06 + lh(bodyPt) * bl : 0), by = yy + (rh - bh) / 2, tx = right ? x : x + NW;
    els.push(text(tx, by, cw, lh(headPt) * hl + 0.02, p.head, { size: headPt, bold: true, align, ls: 1.1 }));
    if (bl) els.push(text(tx, by + lh(headPt) * hl + 0.06, cw, lh(bodyPt) * bl + 0.02, p.body, { size: bodyPt, color: C.ink2, align, ls: 1.1 }));
  });
  return els;
}

// ═════════════ КОМПОНЕНТЫ ═════════════

// Экран в рамке телефона слева или справа, рядом 2–3 тезиса с числом-эффектом, разделённые тонкими линиями.
// Вопрос: «как это выглядит у клиента?»
// data: { screen: 'screens/app.png', what: 'что на экране (для заглушки)', side?: 'left'|'right' (где телефон),
//         points: [{ value?, unit?, digits?, sign?: true, prefix?: 'в', label, head, body?, src? }] ×2–3, src? }
// opt: { numW, textW, gap }. Тезисы стоят у телефона: подписи выключены к нему.
function phoneHero(box, data, opt = {}) {
  const { x, y, w, h } = box, src = data.src || opt.src, pts = data.points, els = [];
  const AW = Math.min(w, STRIPE_X - x), g = phoneSize(h, data.screen), GAP = opt.gap || 0.36;
  const TW = Math.min(opt.textW || 6.4, AW - g.W - GAP), gw = g.W + GAP + TW, gx = x + Math.max(0, (AW - gw) / 2);
  const left = (data.side || 'left') === 'left', px = left ? gx : gx + TW + GAP, tx = left ? gx + g.W + GAP : gx;
  els.push(...phone(px, y, h, data.screen, data.what, 'phoneHero').els);
  els.push(...thesisRows(tx, y, TW, h, pts, src, { numW: opt.numW, align: left ? 'left' : 'right' }));
  return els;
}

// 3–4 экрана телефона в ряд, стрелки между ними, под каждым шаг по сути и строка пояснения.
// Вопрос: «как клиент проходит сценарий?»
// data: { steps: [{ screen, what?, head, body? }] ×3–4 } (или data.screens: ['…'] по порядку шагов)
// opt: { headPt, bodyPt }. Высота телефонов — что осталось от тела после подписей.
function phoneFlow(box, data, opt = {}) {
  const { x, y, w, h } = box, st = data.steps, n = st.length, HP = opt.headPt || 15, BP = opt.bodyPt || 12, els = [];
  const AW = Math.min(w, STRIPE_X - x), cw = AW / n, tw0 = cw - 0.2, file = (s, i) => s.screen || (data.screens || [])[i];
  const hl = Math.max(...st.map(s => lines(s.head, HP, tw0, true))), bl = Math.max(...st.map(s => (s.body ? lines(s.body, BP, tw0) : 0)));
  const textH = lh(HP) * hl + (bl ? 0.06 + lh(BP) * bl : 0), ph = h - textH - 0.22;
  const P = st.map((s, i) => {
    const g = phoneSize(ph, file(s, i)), cx = x + cw * (i + 0.5);
    return phone(cx - g.W / 2, y, ph, file(s, i), s.what || s.head, 'phoneFlow');
  });
  P.forEach((p, i) => {
    els.push(...p.els);
    if (i < n - 1) els.push(hline(p.x + p.W + 0.16, P[i + 1].x - 0.16, y + ph / 2, { color: C.axis, lw: 1.25, arrow: true }));
  });
  st.forEach((s, i) => {
    const cx = x + cw * (i + 0.5), ty = y + ph + 0.22, sh = lines(s.head, HP, tw0, true);
    els.push(text(cx - tw0 / 2, ty, tw0, lh(HP) * sh + 0.02, s.head, { size: HP, bold: true, align: 'center', ls: 1.1 }));
    if (s.body) els.push(text(cx - tw0 / 2, ty + lh(HP) * hl + 0.06, tw0, lh(BP) * lines(s.body, BP, tw0) + 0.02, s.body, { size: BP, color: C.ink2, align: 'center', ls: 1.1 }));
  });
  return els;
}

// Экран в окне браузера (полоса адреса, три точки окна), 3–4 выноски линиями от точек экрана к подписям по сторонам.
// Вопрос: «что видит менеджер или клиент в вебе?»
// data: { screen, what?, url?: 'polis.example/kabinet',
//         callouts: [{ at: [fx, fy] доли экрана 0…1, head, body?, value?, unit?, digits?, sign?, label?, side?: 'left'|'right', src? }], src? }
// opt: { labelW, leader, screenW }. Сторона выноски по умолчанию — ближняя к точке.
function desktopShowcase(box, data, opt = {}) {
  const { x, y, w, h } = box, LBW = opt.labelW || 2.5, LG = opt.leader || 0.6, src = data.src || opt.src;
  const bw0 = opt.screenW || Math.min(w - 2 * (LBW + LG), STRIPE_X - x - LBW - LG);
  const g = browserSize(bw0, data.screen, h), bx = x + LBW + LG + (bw0 - g.W) / 2, by = y + (h - g.H) / 2;
  const B = browser(bx, by, bw0, data.screen, data.what, data.url, 'desktopShowcase', h);
  const pts = data.callouts.map(c => {
    const vh = c.value != null ? lh(20) : 0, hl = lines(c.head, 14, LBW, true), bl = c.body ? lines(c.body, 11, LBW) : 0;
    return { c, px: B.sx + c.at[0] * B.sw, py: B.sy + c.at[1] * B.sh, side: c.side || (c.at[0] < 0.5 ? 'left' : 'right'), vh, hl, bl, H: vh + lh(14) * hl + (bl ? 0.04 + lh(11) * bl : 0) };
  });
  const lead = [], marks = [], labels = [];
  ['left', 'right'].forEach(side => {
    const gr = pts.filter(p => p.side === side).sort((a, b) => a.py - b.py);
    if (!gr.length) return;
    const off = p => p.vh + lh(14) / 2;                                  // якорь подписи — середина строки заголовка
    let ys = spread(gr.map(p => p.py), Math.max(...gr.map(p => p.H)) + 0.3);
    const over = Math.max(0, ...gr.map((p, k) => ys[k] - off(p) + p.H - (y + h)));
    ys = ys.map(v => v - over);
    const under = Math.max(0, ...gr.map((p, k) => y - (ys[k] - off(p))));
    ys = ys.map(v => v + under);
    const L0 = side === 'left';
    const lx = L0 ? Math.max(x, bx - LG - LBW) : bx + B.W + LG, lw = L0 ? bx - LG - lx : Math.min(LBW, x + w - lx);
    const ex = L0 ? bx - 0.14 : bx + B.W + 0.14, endX = L0 ? bx - LG + 0.1 : bx + B.W + LG - 0.1;
    gr.forEach((p, k) => {
      const ay = ys[k], ty = ay - off(p), al = L0 ? 'right' : 'left', c = p.c;
      lead.push(L0 ? hline(ex, p.px, p.py, { color: C.axis, lw: 1 }) : hline(p.px, ex, p.py, { color: C.axis, lw: 1 }));
      lead.push(Math.abs(ay - p.py) < 0.01
        ? (L0 ? hline(endX, ex, ay, { color: C.axis, lw: 1 }) : hline(ex, endX, ay, { color: C.axis, lw: 1 }))
        : seg(ex, p.py, endX, ay, { color: C.axis, lw: 1 }));
      marks.push(oval(p.px, p.py, 0.22, { fill: C.bg, line: C.ink, lw: 1.5 }), oval(p.px, p.py, 0.08, { fill: C.ink }));
      if (p.vh) labels.push(text(lx, ty, lw, p.vh, [{ t: val(c, src) }, { t: unitOf(c.unit), s: 14 }], { size: 20, bold: true, color: C.accentInk, align: al, valign: 'middle' }));
      labels.push(text(lx, ty + p.vh, lw, lh(14) * p.hl + 0.02, c.head, { size: 14, bold: true, align: al, ls: 1.1 }));
      if (p.bl) labels.push(text(lx, ty + p.vh + lh(14) * p.hl + 0.04, lw, lh(11) * p.bl + 0.02, c.body, { size: 11, color: C.ink2, align: al, ls: 1.1 }));
    });
  });
  return [...B.els, ...lead, ...marks, ...labels];
}

// Два экрана телефона «Было / Стало» по краям, между ними 2–3 изменения: эффект числом (derived diff) и значения до и после.
// Вопрос: «что изменилось в интерфейсе?»
// data: { before: { screen, what?, head: 'Было', note? }, after: { screen, what?, head: 'Стало', note? },
//         changes: [{ name, a, b, unit?, digits?, better?: 'up'|'down', labelA?, labelB?, src? }] ×2–3, src? }
// Изменение = b − a, регистрируется как derived diff от меток «<name>: было» и «<name>: стало».
// Число акцентом, если изменение в нужную сторону (better), иначе основным цветом.
function screensBeforeAfter(box, data, opt = {}) {
  const { x, y, w, h } = box, src = data.src || opt.src, A = data.before, Bf = data.after, els = [];
  const AW = Math.min(w, STRIPE_X - x), HH = opt.headH || 0.62, ph = h - HH, inset = opt.inset ?? 0.2, GAP = 0.4;
  const gA = phoneSize(ph, A.screen), gB = phoneSize(ph, Bf.screen);
  const ax = x + inset, bx = x + AW - inset - gB.W;
  const pA = phone(ax, y + HH, ph, A.screen, A.what, 'screensBeforeAfter'), pB = phone(bx, y + HH, ph, Bf.screen, Bf.what, 'screensBeforeAfter');
  els.push(...pA.els, ...pB.els);
  // шапки над телефонами и стрелка «было → стало» между ними
  const head = (s, px, pw, acc) => {
    const hw = pw + 2 * Math.min(0.3, inset), hx = px + pw / 2 - hw / 2;
    els.push(text(hx, y, hw, lh(15) + 0.02, s.head, { size: 15, bold: true, color: acc ? C.accentInk : C.ink, align: 'center' }));
    if (s.note) els.push(text(hx, y + lh(15) + 0.04, hw, lh(11.5) + 0.02, s.note, { size: 11.5, color: C.muted, align: 'center' }));
  };
  head(A, ax, gA.W, false); head(Bf, bx, gB.W, true);
  const mx0 = ax + gA.W + GAP, mx1 = bx - GAP, MW = mx1 - mx0;
  els.push(hline(mx0, mx1, y + lh(15) / 2 + 0.01, { color: C.axis, lw: 1, arrow: true }));
  // изменения строками между экранами
  const ch = data.changes, n = ch.length, rh = ph / n;
  const R = ch.map(c => {
    const d = c.digits || 0, s0 = c.src || src, la = c.labelA || `${c.name}: было`, lb = c.labelB || `${c.name}: стало`;
    const sa = num(la, c.a, s0, d), sb = num(lb, c.b, s0, d), diff = rnd(c.b - c.a, d);
    const sd = num(`${c.name}: изменение`, diff, { type: 'derived', from: [lb, la], op: 'diff' }, d);
    const good = !c.better || (c.better === 'up' ? diff > 0 : diff < 0);
    return { c, sa, sb, good, ds: (diff > 0 ? '+' : '') + minus(sd), du: diffUnit(c.unit) };
  });
  // колонка числа по самому широкому изменению, кегль общий
  const NP = opt.numPt || 34, NW = opt.numW || Math.min(MW * 0.45, Math.max(...R.map(r => tw(r.ds, NP, true) + tw(r.du, 15, true))) + 0.4);
  const pt = Math.min(...R.map(r => fitPt(r.ds, r.du.trim(), NW - 0.2, NP))), cw = MW - NW;
  R.forEach(({ c, sa, sb, good, ds, du }, i) => {
    const yy = y + HH + i * rh;
    if (i) els.push(hline(mx0, mx1, yy, { color: C.rule, lw: 0.75 }));
    els.push(text(mx0, yy + rh / 2 - 0.36, NW, 0.72, [{ t: ds }, { t: du, s: 15 }], { size: pt, bold: true, color: good ? C.accentInk : C.ink, valign: 'middle' }));
    const nl = lines(c.name, 15, cw, true), fr = `было ${sa}${unitOf(c.unit)}, стало ${sb}${unitOf(c.unit)}`, fl = lines(fr, 11.5, cw);
    const bh = lh(15) * nl + 0.06 + lh(11.5) * fl, by = yy + (rh - bh) / 2;
    els.push(text(mx0 + NW, by, cw, lh(15) * nl + 0.02, c.name, { size: 15, bold: true, ls: 1.1 }));
    els.push(text(mx0 + NW, by + lh(15) * nl + 0.06, cw, lh(11.5) * fl + 0.02, fr, { size: 11.5, color: C.ink2, ls: 1.1 }));
  });
  return els;
}

// Веб-экран крупно в окне браузера и телефон поверх его правого нижнего угла, слева 2–3 тезиса про омниканальность.
// Вопрос: «как работает во всех каналах?»
// data: { web: { screen, what?, url? }, phone: { screen, what? },
//         points: [{ value?, unit?, digits?, sign?, prefix?, label, head, body?, src? }] ×2–3, src? }
// opt: { textW, phoneH, overlap: доля ширины телефона поверх окна (0,5) }
function multiDevice(box, data, opt = {}) {
  const { x, y, w, h } = box, src = data.src || opt.src, TW = opt.textW || 3.8, GAP = 0.5, els = [];
  const dx0 = x + TW + GAP, dx1 = Math.min(x + w, STRIPE_X);
  const phH = opt.phoneH || h * 0.74, gP = phoneSize(phH, data.phone.screen), ov = gP.W * (opt.overlap ?? 0.5);
  const g0 = browserSize(dx1 - dx0 - (gP.W - ov), data.web.screen, h - 0.4);
  const B = browser(dx0, y, dx1 - dx0 - (gP.W - ov), data.web.screen, data.web.what, data.web.url, 'multiDevice', h - 0.4, g0.sw - ov - 0.1);
  const P = phone(dx0 + B.W - ov, y + h - phH, phH, data.phone.screen, data.phone.what, 'multiDevice');
  els.push(...B.els, ...P.els);
  // тезисы столбцом: число, заголовок, пояснение; свободная высота делится поровну между строками, линии посередине зазоров
  const pts = data.points, n = pts.length;
  const R = pts.map(p => {
    const hl = lines(p.head, 15, TW, true), bl = p.body ? lines(p.body, 11.5, TW) : 0, nh = p.value != null ? lh(30) + 0.04 : 0;
    return { p, hl, bl, nh, H: nh + lh(15) * hl + (bl ? 0.05 + lh(11.5) * bl : 0) };
  });
  const gap = (h - R.reduce((a, r) => a + r.H, 0)) / n;
  let ty = y + gap / 2;
  R.forEach(({ p, hl, bl, nh, H }, i) => {
    if (i) els.push(hline(x, x + TW, ty - gap / 2, { color: C.rule, lw: 0.75 }));
    if (nh) els.push(text(x, ty, TW, lh(30), [{ t: val(p, src) }, { t: unitOf(p.unit), s: 16 }], { size: 30, bold: true, color: C.accentInk, valign: 'middle' }));
    els.push(text(x, ty + nh, TW, lh(15) * hl + 0.02, p.head, { size: 15, bold: true, ls: 1.1 }));
    if (bl) els.push(text(x, ty + nh + lh(15) * hl + 0.05, TW, lh(11.5) * bl + 0.02, p.body, { size: 11.5, color: C.ink2, ls: 1.1 }));
    ty += H + gap;
  });
  return els;
}

module.exports = { phoneHero, phoneFlow, desktopShowcase, screensBeforeAfter, multiDevice };
