// Группа «Продукт и клиент»: путь клиента, ценность по сегментам, было / стало, экран с выносками, персона,
// проблема и решение, частота использования, NPS, цитата клиента, кейс. Каталог и правила: components/README.md.
// Каждый компонент — (box, data, opt) → els; числа через U.num(), производные — derived; цвет только из C.
const fs = require('fs'), path = require('path');
const L = require('../lib.js');
const U = require('./util.js');
const { C, rect, oval, hline, vline, text, tw } = L;
const { num, minus, unitOf, lines, lh, onBar, seg, knock, spread } = U;

const rnd = (v, d = 0) => Math.round(v * 10 ** d) / 10 ** d;
const signed = (v, s) => (v > 0 ? '+' : '') + minus(s);                  // «+12» или «−12»
const diffUnit = u => (u === '%' ? unitOf('п. п.') : unitOf(u));          // разница процентов — в процентных пунктах

// Размер картинки из заголовка PNG или JPEG: выноски ставятся на реальный кадр экрана
function imgDims(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  for (let i = 2; i < b.length;) {
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc2) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  return [9, 19.5];
}

// ═════════════ ПУТЬ И ЦЕННОСТЬ ═════════════

// Карта пути клиента: этапы колонками, под ними кривая настроения, точки боли акцентом с короткой подписью.
// Вопрос: «где клиенту плохо на пути?»
// data: { stages: [{ name, note?, mood: −2…2, pain?: { t, value?, unit?, digits?, label?, src? } }], moods?: [верх, середина, низ], src? }
// Шкала настроения подписана словами, без чисел. Подпись боли под точкой: число боли крупно, пояснение под ним.
function journeyMap(box, data, opt = {}) {
  const { x, y, w, h } = box, LW = opt.labelW || 1.6, st = data.stages, n = st.length, els = [];
  const gx = x + LW, cw = (w - LW) / n, cx = i => gx + cw * (i + 0.5), tw0 = cw - 0.2;
  const moods = data.moods || ['Доволен', 'Нейтрально', 'Раздражён'];
  const nameH = s => lh(13) * lines(s.name, 13, tw0, true);
  const headH = Math.max(...st.map(s => nameH(s) + (s.note ? 0.04 + lh(10) * lines(s.note, 10, tw0) : 0))) + 0.16;
  const top = y + headH + 0.42, bot = y + h - (opt.painH || 0.95), py = m => top + (2 - m) / 4 * (bot - top);
  st.forEach((s, i) => {
    els.push(text(cx(i) - tw0 / 2, y, tw0, nameH(s) + 0.02, s.name, { size: 13, bold: true, align: 'center', ls: 1.1 }));
    if (s.note) els.push(text(cx(i) - tw0 / 2, y + nameH(s) + 0.04, tw0, lh(10) * lines(s.note, 10, tw0) + 0.02, s.note, { size: 10, color: C.muted, align: 'center', ls: 1.1 }));
    if (i) els.push(vline(gx + i * cw, y, y + h, { color: C.rule, lw: 0.5 }));
  });
  els.push(hline(x, x + w, y + headH, { color: C.axis, lw: 0.75 }));
  const grid = [[2, moods[0]], [0, moods[1]], [-2, moods[2]]];
  grid.forEach(([m, t]) => {
    els.push(hline(gx, x + w, py(m), { color: m ? C.rule : C.axis, lw: 0.5, dash: !m }));
    els.push(text(x, py(m) - 0.13, LW - 0.2, 0.26, t, { size: 10, color: C.muted, valign: 'middle' }));
  });
  for (let i = 1; i < n; i++) els.push(seg(cx(i - 1), py(st[i - 1].mood), cx(i), py(st[i].mood), { color: C.ink2, lw: 2 }));
  st.forEach((s, i) => els.push(s.pain
    ? oval(cx(i), py(s.mood), 0.26, { fill: C.accent })
    : oval(cx(i), py(s.mood), 0.16, { fill: C.bg, line: C.ink2, lw: 1.5 })));
  st.forEach((s, i) => {
    if (!s.pain) return;
    const p = s.pain, ly = py(s.mood) + 0.22, vh = p.value != null ? lh(15) : 0, tl = lines(p.t, 10.5, tw0), H = vh + lh(10.5) * tl + 0.04;
    // подложка, только если подпись пересекает линию шкалы
    if (grid.some(([m]) => py(m) > ly - 0.02 && py(m) < ly + H + 0.02)) els.push(knock(cx(i) - tw0 / 2, ly, tw0, H));
    if (vh) els.push(text(cx(i) - tw0 / 2, ly, tw0, vh, num(p.label || `${s.name}: ${p.t}`, p.value, p.src || data.src || opt.src, p.digits || 0) + unitOf(p.unit), { size: 15, bold: true, color: C.accentInk, align: 'center', valign: 'middle' }));
    els.push(text(cx(i) - tw0 / 2, ly + vh, tw0, lh(10.5) * tl + 0.02, p.t, { size: 10.5, color: C.ink2, align: 'center', ls: 1.1 }));
  });
  return els;
}

// Матрица возможности × сегменты: в ячейке точка, размер по важности (1–3), «критично» акцентом, 0 — тире.
// Вопрос: «что важно какому сегменту?»
// data: { segments: [имя | { name, note? }], features: [{ name, note?, values: [0…3], scores?: [балл] }], levels?: [3 подписи], scoreLabel?, digits?, src? }
// scores — необязательный балл рядом с точкой (через num); без них матрица читается только размером точек.
function featureDots(box, data, opt = {}) {
  const { x, y, w, h } = box, LW = opt.labelW || 3.4, els = [];
  const segs = data.segments.map(s => (typeof s === 'string' ? { name: s } : s)), nc = segs.length, nr = data.features.length;
  const cw = (w - LW) / nc, headH = segs.some(s => s.note) ? 0.72 : 0.5;
  const rh = Math.min(opt.rowH || 0.8, (h - headH - 0.05) / nr), D = [0, 0.16, 0.27, 0.4];
  const levels = data.levels || ['мало', 'важно', 'критично'], tone = v => (v === 3 ? C.accent : C.bar);
  segs.forEach((s, j) => {
    const sx = x + LW + j * cw;
    els.push(text(sx + 0.05, y, cw - 0.1, 0.3, s.name, { size: 12, bold: true, align: 'center', valign: 'bottom' }));
    if (s.note) els.push(text(sx + 0.05, y + 0.32, cw - 0.1, 0.24, s.note, { size: 10, color: C.muted, align: 'center', valign: 'middle' }));
  });
  // легенда размеров в левой ячейке шапки
  let lx = x;
  const ly = y + headH - 0.26;
  [1, 2, 3].forEach(k => {
    els.push(oval(lx + D[k] / 2, ly, D[k], { fill: tone(k) }));
    const lw = tw(levels[k - 1], 10) + 0.1;
    els.push(text(lx + D[k] + 0.08, ly - 0.12, lw, 0.24, levels[k - 1], { size: 10, color: C.muted, valign: 'middle' }));
    lx += D[k] + 0.08 + lw + 0.22;
  });
  els.push(hline(x, x + w, y + headH, { color: C.axis, lw: 0.75 }));
  data.features.forEach((f, i) => {
    const yy = y + headH + 0.05 + i * rh, cy = yy + rh / 2, src = f.src || data.src || opt.src, note = f.note && rh >= 0.6;
    els.push(text(x, note ? cy - 0.27 : yy, LW - 0.25, note ? 0.3 : rh, f.name, { size: 13, bold: true, valign: note ? 'bottom' : 'middle' }));
    if (note) els.push(text(x, cy + 0.03, LW - 0.25, 0.24, f.note, { size: 10, color: C.muted, valign: 'middle' }));
    f.values.forEach((v, j) => {
      const ccx = x + LW + (j + 0.5) * cw;
      if (!v) { els.push(text(ccx - 0.3, cy - 0.15, 0.6, 0.3, '—', { size: 12, color: C.muted, align: 'center', valign: 'middle' })); return; }
      els.push(oval(ccx, cy, D[v], { fill: tone(v) }));
      if (f.scores && f.scores[j] != null) els.push(text(ccx + 0.3, cy - 0.14, 0.7, 0.28, num(`${data.scoreLabel || 'балл'}: ${f.name} × ${segs[j].name}`, f.scores[j], src, data.digits || 0), { size: 10.5, color: C.muted, valign: 'middle' }));
    });
    if (i < nr - 1) els.push(hline(x, x + w, yy + rh, { color: C.rule, lw: 0.5 }));
  });
  return els;
}

// Было / Стало: две колонки одной структуры (число и полоса), между ними название метрики и разница.
// Вопрос: «что изменилось после запуска?»
// data: { before: { head, note? }, after: { head, note? }, metrics: [{ name, a, b, unit?, digits?, better?: 'up'|'down', src? }] ×3–4 }
// Разница b − a — derived diff со знаком, у процентов в «п. п.». Акцентом — разница в лучшую сторону и полоса «Стало».
function beforeAfter(box, data, opt = {}) {
  const { x, y, w, h } = box, MW = opt.midW || 3.3, cw = (w - MW) / 2, ms = data.metrics, n = ms.length, els = [];
  const xa = x, xm = x + cw, xb = x + cw + MW, headH = 0.82, rh = (h - headH) / n;
  const vs = rh >= 1.1 ? 34 : 28, vh = vs * 1.25 / 72, bw = cw - 0.5;
  [[xa, data.before, false], [xb, data.after, true]].forEach(([hx, hd, now]) => {
    els.push(text(hx, y, cw, 0.42, hd.head, { size: 20, bold: true, color: now ? C.ink : C.ink2, valign: 'middle' }));
    if (hd.note) els.push(text(hx, y + 0.44, cw, 0.26, hd.note, { size: 11, color: C.muted, valign: 'middle' }));
  });
  els.push(text(xm, y + 0.44, MW, 0.26, data.diffHead || 'разница', { size: 11, color: C.muted, align: 'center', valign: 'middle' }));
  els.push(hline(x, x + w, y + headH - 0.06, { color: C.axis, lw: 0.75 }));
  ms.forEach((m, i) => {
    const yy = y + headH + i * rh, src = m.src || data.src || opt.src, d = m.digits || 0, u = unitOf(m.unit);
    const la = `${m.name}: ${data.before.head}`, lb = `${m.name}: ${data.after.head}`;
    const sa = num(la, m.a, src, d), sb = num(lb, m.b, src, d), dv = rnd(m.b - m.a, d);
    const ds = num(`${m.name}: разница`, dv, { type: 'derived', from: [lb, la], op: 'diff' }, d);
    const good = (m.better || 'up') === 'up' ? dv >= 0 : dv <= 0, mx = Math.max(Math.abs(m.a), Math.abs(m.b)) || 1;
    const top = yy + (rh - vh - 0.2) / 2, by = top + vh + 0.08;
    els.push(text(xa, top, cw - 0.3, vh, [{ t: sa }, { t: u, s: Math.round(vs * 0.5) }], { size: vs, color: C.ink2, valign: 'bottom' }));
    els.push(rect(xa, by, Math.max(0.04, Math.abs(m.a) / mx * bw), 0.1, { fill: C.bar }));
    els.push(text(xb, top, cw - 0.3, vh, [{ t: sb }, { t: u, s: Math.round(vs * 0.5) }], { size: vs, bold: true, valign: 'bottom' }));
    els.push(rect(xb, by, Math.max(0.04, Math.abs(m.b) / mx * bw), 0.1, { fill: C.accent }));
    els.push(text(xm + 0.2, top - 0.08, MW - 0.4, 0.26, m.name, { size: 11, color: C.muted, align: 'center', valign: 'middle' }));
    els.push(text(xm + 0.2, top + 0.19, MW - 0.4, by - top - 0.18, signed(dv, ds) + diffUnit(m.unit), { size: 20, bold: true, color: good ? C.accentInk : C.muted, align: 'center', valign: 'middle' }));
    els.push(hline(xm + 0.25, xb - 0.35, by + 0.05, { color: C.axis, lw: 1.25, arrow: true }));
    if (i < n - 1) els.push(hline(x, x + w, yy + rh, { color: C.rule, lw: 0.5 }));
  });
  return els;
}

// ═════════════ ЭКРАН И ЛЮДИ ═════════════

// Схематичный телефон из прямоугольников: шапка, карточка цены, риски с переключателями, кнопка оплаты акцентом.
// Текста внутри нет: это каркас экрана, смысл дают выноски.
function phoneMock(X, Y, PW, PH) {
  const p = 0.17, ix = X + p, iw = PW - 2 * p, at = f => Y + f * PH, els = [];
  els.push(rect(X, Y, PW, PH, { r: 0.3, fill: C.card, alpha: Math.max(0.9, C.cardA), line: C.line, lw: 1.25 }));
  els.push(rect(X + PW / 2 - 0.32, at(0.025), 0.64, 0.07, { r: 0.035, fill: C.line }));
  els.push(rect(ix, at(0.085), iw * 0.55, 0.13, { r: 0.03, fill: C.ink2 }));
  els.push(rect(ix, at(0.085) + 0.21, iw * 0.35, 0.07, { r: 0.03, fill: C.axis }));
  const ky = at(0.2), kh = PH * 0.25;
  els.push(rect(ix, ky, iw, kh, { r: 0.12, fill: C.line }));
  els.push(rect(ix + 0.16, ky + 0.18, iw * 0.3, 0.07, { r: 0.03, fill: C.axis }));
  els.push(rect(ix + 0.16, ky + 0.36, iw * 0.55, 0.2, { r: 0.04, fill: C.ink2 }));
  els.push(rect(ix + 0.16, ky + kh - 0.27, iw * 0.42, 0.07, { r: 0.03, fill: C.axis }));
  for (let k = 0; k < 3; k++) {
    const ry = at(0.5) + k * PH * 0.095, on = k < 2;
    els.push(rect(ix, ry + 0.08, iw * (0.52 - k * 0.07), 0.08, { r: 0.03, fill: C.axis }));
    els.push(rect(ix + iw - 0.36, ry + 0.035, 0.36, 0.18, { r: 0.09, fill: on ? C.ink2 : C.line }));
    els.push(oval(on ? ix + iw - 0.12 : ix + iw - 0.24, ry + 0.125, 0.13, { fill: C.card }));
    els.push(hline(ix, ix + iw, ry + PH * 0.095 - 0.06, { color: C.line, lw: 0.5 }));
  }
  els.push(rect(ix, at(0.86), iw, 0.36, { r: 0.18, fill: C.accent }));
  els.push(rect(X + PW / 2 - 0.4, Y + PH - 0.13, 0.8, 0.045, { r: 0.02, fill: C.axis }));
  return els;
}

// Экран продукта с выносками: линии от точек экрана к подписям по сторонам. Вопрос: «как это выглядит в продукте?»
// data: { file?: 'screens/app.png' (файл в img/), callouts: [{ at: [fx, fy] доли экрана 0…1, head, body?, value?, unit?, digits?, label?, side?: 'left'|'right', src? }] }
// Есть файл — картинка экрана (вписана по своим пропорциям), иначе схематичный телефон. 3–4 выноски.
function screenCallouts(box, data, opt = {}) {
  const { x, y, w, h } = box, LBW = opt.labelW || 3.3, els = [];
  const fp = data.file ? path.join(__dirname, '..', 'img', data.file) : null;
  if (fp && !fs.existsSync(fp)) console.warn(`screenCallouts: нет файла img/${data.file}, нарисован схематичный экран`);
  let sx, sy, sw, sh;
  if (fp && fs.existsSync(fp)) {
    const [iw, ih] = imgDims(fp), mw = opt.screenW || Math.min(6, w - 2 * (LBW + 0.9)), k = Math.min(mw / iw, h / ih);
    sw = iw * k; sh = ih * k; sx = x + (w - sw) / 2; sy = y + (h - sh) / 2;
    els.push(L.image(sx, sy, sw, sh, data.file));
  } else {
    sh = h; sw = Math.min(h * 0.49, 2.4); sx = x + (w - sw) / 2; sy = y;
    els.push(...phoneMock(sx, sy, sw, sh));
  }
  const pts = data.callouts.map(c => {
    const vh = c.value != null ? lh(20) : 0, hl = lines(c.head, 14, LBW, true), bl = c.body ? lines(c.body, 11, LBW) : 0;
    return { c, px: sx + c.at[0] * sw, py: sy + c.at[1] * sh, side: c.side || (c.at[0] < 0.5 ? 'left' : 'right'), vh, hl, bl, H: vh + lh(14) * hl + (bl ? 0.04 + lh(11) * bl : 0) };
  });
  const lead = [], marks = [], labels = [];
  ['left', 'right'].forEach(side => {
    const g = pts.filter(p => p.side === side).sort((a, b) => a.py - b.py);
    if (!g.length) return;
    // якорь подписи — середина строки заголовка; якоря раздвигаются, чтобы подписи не наезжали
    const off = p => p.vh + lh(14) / 2;
    let ys = spread(g.map(p => p.py), Math.max(...g.map(p => p.H)) + 0.3);
    const over = Math.max(0, ...g.map((p, k) => ys[k] - off(p) + p.H - (y + h)));
    ys = ys.map(v => v - over);
    const under = Math.max(0, ...g.map((p, k) => y - (ys[k] - off(p))));
    ys = ys.map(v => v + under);
    const lx = side === 'left' ? Math.max(x, sx - 0.9 - LBW) : sx + sw + 0.9, lw = side === 'left' ? sx - 0.9 - lx : Math.min(LBW, x + w - lx);
    const ex = side === 'left' ? sx - 0.15 : sx + sw + 0.15, endX = side === 'left' ? sx - 0.8 : sx + sw + 0.8;
    g.forEach((p, k) => {
      const ay = ys[k], ty = ay - off(p), al = side === 'left' ? 'right' : 'left', c = p.c;
      lead.push(side === 'left' ? hline(ex, p.px, p.py, { color: C.axis, lw: 1 }) : hline(p.px, ex, p.py, { color: C.axis, lw: 1 }));
      lead.push(Math.abs(ay - p.py) < 0.01
        ? (side === 'left' ? hline(endX, ex, ay, { color: C.axis, lw: 1 }) : hline(ex, endX, ay, { color: C.axis, lw: 1 }))
        : seg(ex, p.py, endX, ay, { color: C.axis, lw: 1 }));
      marks.push(oval(p.px, p.py, 0.22, { fill: C.bg, line: C.ink, lw: 1.5 }), oval(p.px, p.py, 0.08, { fill: C.ink }));
      if (p.vh) labels.push(text(lx, ty, lw, p.vh, num(c.label || c.head, c.value, c.src || data.src || opt.src, c.digits || 0) + unitOf(c.unit), { size: 20, bold: true, color: C.accentInk, align: al, valign: 'middle' }));
      labels.push(text(lx, ty + p.vh, lw, lh(14) * p.hl + 0.02, c.head, { size: 14, bold: true, align: al, ls: 1.1 }));
      if (p.bl) labels.push(text(lx, ty + p.vh + lh(14) * p.hl + 0.04, lw, lh(11) * p.bl + 0.02, c.body, { size: 11, color: C.ink2, align: al, ls: 1.1 }));
    });
  });
  return [...els, ...lead, ...marks, ...labels];
}

// Персона сегмента: один контейнер (имя, роль, контекст, ключевая цифра) и типографические колонки «Задачи / Боли / Что ценит».
// Вопрос: «для кого продукт?»
// data: { name, role, context, stat: { value, unit?, digits?, label, caption, bar?: true }, cols: [{ head, items: [строки] } ×3], accentCol?: 1, src? }
// stat.bar при unit '%' рисует полосу доли под цифрой. Акцентная линия над колонкой accentCol (по умолчанию «Боли»).
function personaCard(box, data, opt = {}) {
  const { x, y, w, h } = box, CW = opt.cardW || 4.2, P = 0.32, iw = CW - 2 * P, src = data.src || opt.src, els = [];
  els.push(rect(x, y, CW, h, { r: 0.16, fill: C.card, alpha: Math.max(0.9, C.cardA), line: C.cardLine, lw: 1 }));
  let yy = y + P;
  const nl = lines(data.name, 24, iw, true);
  els.push(text(x + P, yy, iw, lh(24) * nl + 0.02, data.name, { size: 24, bold: true, ls: 1.1 }));
  yy += lh(24) * nl + 0.06;
  if (data.role) {
    const rl = lines(data.role, 13, iw);
    els.push(text(x + P, yy, iw, lh(13) * rl + 0.02, data.role, { size: 13, color: C.muted, ls: 1.1 }));
    yy += lh(13) * rl + 0.16;
  }
  const st = data.stat, bar = st.bar && st.unit === '%', cl = lines(st.caption, 13, iw);
  const by = y + h - P - 0.1, capY = (bar ? by - 0.18 : y + h - P) - lh(13) * cl - 0.02, numY = capY - 0.84;
  if (data.context) {
    const xl = Math.min(lines(data.context, 13, iw * 0.9), Math.floor((numY - 0.2 - yy) / lh(13)));
    els.push(text(x + P, yy, iw, lh(13) * xl + 0.02, data.context, { size: 13, color: C.ink2, ls: 1.1 }));
  }
  els.push(text(x + P, numY, iw, 0.8, [{ t: num(st.label, st.value, st.src || src, st.digits || 0) }, { t: unitOf(st.unit), s: 24 }], { size: 48, bold: true, color: C.accentInk, valign: 'bottom' }));
  els.push(text(x + P, capY, iw, lh(13) * cl + 0.02, st.caption, { size: 13, color: C.ink2, ls: 1.1 }));
  els.push(hline(x + P, x + CW - P, numY - 0.1, { color: C.line, lw: 0.75 }));
  if (bar) els.push(rect(x + P, by, iw, 0.1, { fill: C.line }), rect(x + P, by, iw * Math.min(100, st.value) / 100, 0.1, { fill: C.accent }));
  const X0 = x + CW + 0.6, gap = 0.45, cw = (x + w - X0 - 2 * gap) / 3;
  data.cols.forEach((c, i) => {
    const cx = X0 + i * (cw + gap), acc = i === (data.accentCol ?? 1);
    els.push(text(cx, y, cw, 0.4, c.head, { size: 17, bold: true, color: acc ? C.accentInk : C.ink, valign: 'middle' }));
    els.push(hline(cx, cx + cw, y + 0.52, { color: acc ? C.accent : C.axis, lw: acc ? 2 : 0.75 }));
    // пункты делят высоту колонки поровну, между ними волосяные линии: низ колонок встаёт на низ карточки
    const rowH = Math.min(1.25, (y + h - (y + 0.76)) / c.items.length);
    c.items.forEach((t, k) => {
      const iy = y + 0.76 + k * rowH, nl2 = lines(t, 13, cw);
      if (k) els.push(hline(cx, cx + cw, iy - 0.16, { color: C.rule, lw: 0.5 }));
      els.push(text(cx, iy, cw, lh(13) * nl2 + 0.02, t, { size: 13, ls: 1.1 }));
    });
  });
  return els;
}

// Проблема → решение: слева проблема с числом-доказательством, справа решение и эффект числом, между ними стрелка.
// Вопрос: «какую проблему решаем?»
// data: { problem: { tag?, value, unit?, digits?, label, caption, head, body?, share?: true, src? }, solution: { …то же }, link?: подпись стрелки, diff?: false }
// share при unit '%' рисует ряд из 20 точек (точка = 5%). Разница решения и проблемы — derived diff над стрелкой, если единицы совпадают.
function problemSolution(box, data, opt = {}) {
  const { x, y, w, h } = box, MW = opt.midW || 2.5, cw = (w - MW) / 2, cwi = cw - 0.2, els = [];
  const pr = data.problem, so = data.solution, numY = y + 0.38, numH = 1.12;
  const capL = Math.max(lines(pr.caption, 13, cwi), lines(so.caption, 13, cwi)), capY = numY + numH + 0.06, us = u => (u === '%' ? 64 : 30);
  const dotY = capY + lh(13) * capL + 0.32, hasDots = [pr, so].some(s => s.share && s.unit === '%');
  const headY = dotY + (hasDots ? 0.42 : 0);
  [[pr, x, false], [so, x + cw + MW, true]].forEach(([s, sx, sol]) => {
    const src = s.src || data.src || opt.src;
    els.push(text(sx, y, cwi, 0.28, (s.tag || (sol ? 'Решение' : 'Проблема')).toUpperCase(), { size: 10.5, bold: true, color: sol ? C.accentInk : C.muted, valign: 'middle' }));
    els.push(text(sx, numY, cwi, numH, [{ t: num(s.label, s.value, src, s.digits || 0) }, { t: unitOf(s.unit), s: us(s.unit) }], { size: 64, bold: true, color: sol ? C.accentInk : C.ink, valign: 'bottom' }));
    els.push(text(sx, capY, cwi, lh(13) * lines(s.caption, 13, cwi) + 0.02, s.caption, { size: 13, color: C.ink2, ls: 1.1 }));
    if (s.share && s.unit === '%') {
      const k = Math.round(s.value / 5);
      for (let i = 0; i < 20; i++) els.push(oval(sx + 0.075 + i * 0.22, dotY, 0.15, { fill: i < k ? (sol ? C.accent : C.bar) : C.line }));
    }
    const hl = lines(s.head, 20, cwi, true);
    els.push(text(sx, headY, cwi, lh(20) * hl + 0.02, s.head, { size: 20, bold: true, ls: 1.1 }));
    if (s.body) els.push(text(sx, headY + lh(20) * hl + 0.08, cwi, lh(13) * lines(s.body, 13, cwi) + 0.02, s.body, { size: 13, color: C.ink2, ls: 1.1 }));
  });
  const mx = x + cw, ay = numY + numH * 0.62;
  els.push(hline(mx + 0.15, mx + MW - 0.3, ay, { color: C.axis, lw: 1.5, arrow: true }));
  if (data.diff !== false && pr.unit === so.unit) {
    const d = Math.max(pr.digits || 0, so.digits || 0), dv = rnd(so.value - pr.value, d);
    const ds = num(`${so.label} к ${pr.label}`, dv, { type: 'derived', from: [so.label, pr.label], op: 'diff' }, d);
    els.push(text(mx + 0.1, ay - 0.5, MW - 0.2, 0.42, signed(dv, ds) + diffUnit(pr.unit), { size: 20, bold: true, color: C.accentInk, align: 'center', valign: 'bottom' }));
  }
  if (data.link) els.push(text(mx + 0.1, ay + 0.1, MW - 0.2, 0.26, data.link, { size: 10.5, color: C.muted, align: 'center', valign: 'middle' }));
  return els;
}

// ═════════════ ИСПОЛЬЗОВАНИЕ И ЛОЯЛЬНОСТЬ ═════════════

// Dot plot частоты использования: функции по убыванию, точка на шкале 0–100% и тонкая линия от нуля, значение справа,
// среднее — вертикальный пунктир с подписью. Вопрос: «чем пользуются чаще всего?»
// data: { label, items: [{ name, value 0…100, src? }], highlight?: [имена], digits?, head?: подпись над функциями, src? }
// Среднее — derived ratio суммы к числу функций. Акцентом — highlight (по умолчанию первая функция).
function usageRanking(box, data, opt = {}) {
  const { x, y, w, h } = box, LW = opt.labelW || 3.3, VW = opt.valueW || 1.0, d = data.digits || 0, lab = data.label || 'доля', els = [];
  const items = [...data.items].sort((a, b) => b.value - a.value), n = items.length;
  const gx = x + LW, gw = w - LW - VW - 0.25, px = v => gx + v / 100 * gw;
  const top = y + 0.55, rh = Math.min(opt.rowH || 0.6, (h - 0.6) / n), bot = top + n * rh;
  const hl = new Set(data.highlight || [items[0].name]), labs = items.map(it => `${lab}: ${it.name}`);
  if (data.head) els.push(text(x, y + 0.08, LW - 0.25, 0.3, data.head, { size: 10, color: C.muted, valign: 'middle' }));
  els.push(vline(gx, top - 0.08, bot, { color: C.axis, lw: 0.75 }));
  els.push(vline(px(100), top - 0.08, bot, { color: C.rule, lw: 0.75 }));
  els.push(text(px(100) - 0.9, y + 0.08, 1.8, 0.3, data.full || 'все клиенты', { size: 10, color: C.muted, align: 'center', valign: 'middle' }));
  const sumL = `${lab}: сумма`, cntL = `${lab}: число функций`, sum = items.reduce((a, it) => a + it.value, 0);
  num(sumL, rnd(sum, d), { type: 'derived', from: labs, op: 'sum' }, d);
  num(cntL, n, { type: 'derived', from: labs, op: 'count' });
  const av = rnd(sum / n, d), avs = num(`${lab}: среднее`, av, { type: 'derived', from: [sumL, cntL], op: 'ratio' }, d);
  els.push(vline(px(av), top - 0.08, bot, { color: C.ink2, lw: 1, dash: true }));
  els.push(text(Math.max(gx, px(av) - 0.9), y + 0.08, 1.8, 0.3, `среднее ${avs}%`, { size: 10.5, bold: true, color: C.ink2, align: 'center', valign: 'middle' }));
  items.forEach((it, i) => {
    const cy = top + i * rh + rh / 2, on = hl.has(it.name), src = it.src || data.src || opt.src;
    els.push(text(x, cy - rh / 2, LW - 0.25, rh, it.name, { size: 12.5, bold: on, color: on ? C.ink : C.ink2, valign: 'middle' }));
    if (px(it.value) - gx > 0.15) els.push(hline(gx, px(it.value) - 0.1, cy, { color: C.axis, lw: 1 }));
    els.push(oval(px(it.value), cy, 0.2, { fill: on ? C.accent : C.bar }));
    els.push(text(x + w - VW, cy - 0.16, VW, 0.32, `${num(labs[i], it.value, src, d)}%`, { size: 13, bold: on, color: on ? C.accentInk : C.ink, align: 'right', valign: 'middle' }));
  });
  return els;
}

// NPS одной полосой: критики, нейтралы, промоутеры; NPS крупно как разница промоутеров и критиков.
// Вопрос: «насколько клиенты нас рекомендуют?»
// data: { detractors, passives, promoters (доли, %), prev?: { value, name }, n?: { value, caption }, names?: [3], notes?: [3], label?, src? }
// NPS — derived diff; изменение к прошлому замеру — derived diff к prev.value.
function npsBar(box, data, opt = {}) {
  const { x, y, w, h } = box, src = data.src || opt.src, lab = data.label || 'NPS', els = [];
  const names = data.names || ['Критики', 'Нейтралы', 'Промоутеры'], notes = data.notes || ['не порекомендуют', 'нейтральны', 'порекомендуют'];
  const parts = [data.detractors, data.passives, data.promoters], pl = names.map(nm => `${lab}: ${nm.toLowerCase()}, %`);
  const ps = parts.map((v, i) => num(pl[i], v, src));
  const nps = data.promoters - data.detractors, ns = num(lab, nps, { type: 'derived', from: [pl[2], pl[0]], op: 'diff' });
  els.push(text(x, y, 3.8, 1.5, signed(nps, ns), { size: 88, bold: true, color: C.accentInk, valign: 'bottom' }));
  els.push(text(x, y + 1.56, 3.8, lh(13) * 2 + 0.02, data.caption || `${lab}: доля промоутеров минус доля критиков`, { size: 13, color: C.ink2, ls: 1.1 }));
  // вторичные числа справа от героя, на его базовой линии
  const stats = [];
  if (data.prev) {
    const pL = `${lab} ${data.prev.name}`, pv = num(pL, data.prev.value, data.prev.src || src), dv = nps - data.prev.value;
    stats.push([signed(data.prev.value, pv), `${lab} ${data.prev.name}`, false]);
    stats.push([signed(dv, num(`${lab}: изменение к ${data.prev.name}`, dv, { type: 'derived', from: [lab, pL], op: 'diff' })), data.prev.change || 'изменение', dv > 0]);
  }
  if (data.n) stats.push([num(data.n.label || 'ответов в опросе', data.n.value, data.n.src || src), data.n.caption || 'ответов клиентов', false]);
  const sx0 = x + 4.6, sw = (x + w - sx0) / Math.max(1, stats.length);
  stats.forEach(([v, cap, good], i) => {
    els.push(text(sx0 + i * sw, y + 0.86, sw - 0.3, 0.6, v, { size: 30, bold: true, color: good ? C.accentInk : C.ink, valign: 'bottom' }));
    els.push(text(sx0 + i * sw, y + 1.56, sw - 0.3, 0.28, cap, { size: 11.5, color: C.muted, valign: 'middle' }));
  });
  const by = y + 2.4, bh = 0.74, total = parts.reduce((a, b) => a + b, 0);
  const fills = [C.muted, C.bar, C.accent], inks = [C.bg, onBar(), C.onAccent];
  let xx = x;
  parts.forEach((v, i) => {
    const pw = v / total * w, bw = i < 2 ? pw - 0.04 : pw;
    els.push(rect(xx, by, Math.max(0.04, bw), bh, { fill: fills[i] }));
    if (bw >= 1) els.push(text(xx + 0.16, by, bw - 0.3, bh, `${ps[i]}%`, { size: 30, bold: true, color: inks[i], valign: 'middle' }));
    else els.push(text(xx, by - 0.36, Math.max(1, pw), 0.3, `${ps[i]}%`, { size: 13, bold: true, valign: 'bottom' }));
    const lw = Math.max(pw - 0.15, 1.6);
    els.push(text(xx, by + bh + 0.14, lw, 0.3, names[i], { size: 13, bold: true, color: i === 2 ? C.accentInk : C.ink, valign: 'middle' }));
    els.push(text(xx, by + bh + 0.46, lw, 0.26, notes[i], { size: 11.5, color: C.muted, valign: 'middle' }));
    xx += pw;
  });
  return els;
}

// Цитата-герой: крупная цитата до 3 строк в «», автор под ней, справа метрика-результат клиента с полосами было / стало.
// Вопрос: «что говорит клиент?»
// data: { quote, author, role?, metric?: { value, unit?, digits?, label, caption, was?, wasLabel?, names?: ['Было', 'Стало'], src? }, src? }
// Без metric.was справа остаётся только число; полосы — доказательство числа, их стоит давать.
function quoteHero(box, data, opt = {}) {
  const { x, y, w, h } = box, RW = data.metric ? (opt.metricW || 3.6) : 0, QW = w - RW - (RW ? 0.9 : 0), els = [];
  const q = `«${data.quote}»`, tx = x + 0.4, qw = QW - 0.4;
  const qs = [34, 30, 28, 26, 24].find(s => lines(q, s, qw * 0.94) <= 3) || 24, ql = lines(q, qs, qw * 0.94), qh = lh(qs) * ql + 0.06;
  const gh = qh + 0.4 + 0.3 + (data.role ? 0.3 : 0), gy = y + Math.max(0, (h - gh) / 2 - 0.15);
  els.push(rect(x, gy + 0.1, 0.06, qh - 0.16, { fill: C.accent }));
  els.push(text(tx, gy, qw, qh, q, { size: qs, ls: 1.1 }));
  els.push(text(tx, gy + qh + 0.36, qw, 0.32, data.author, { size: 15, bold: true, valign: 'middle' }));
  if (data.role) els.push(text(tx, gy + qh + 0.68, qw, 0.28, data.role, { size: 13, color: C.muted, valign: 'middle' }));
  if (data.metric) {
    const m = data.metric, mx = x + w - RW, src = m.src || data.src || opt.src, d = m.digits || 0, u = unitOf(m.unit);
    els.push(vline(mx - 0.45, y, y + h, { color: C.rule, lw: 0.75 }));
    const vs = num(m.label, m.value, src, d);
    els.push(text(mx, y + 0.1, RW, 1.15, [{ t: vs }, { t: u, s: qs }], { size: 66, bold: true, color: C.accentInk, valign: 'bottom' }));
    const cl = lines(m.caption, 13, RW);
    els.push(text(mx, y + 1.32, RW, lh(13) * cl + 0.02, m.caption, { size: 13, color: C.ink2, ls: 1.1 }));
    if (m.was != null) {
      const ws = num(m.wasLabel || `${m.label}: было`, m.was, src, d), top = Math.max(...[m.was, m.value].map(Math.abs)) || 1, nm = m.names || ['Было', 'Стало'];
      [[nm[0], ws, m.was, C.bar, C.ink2], [nm[1], vs, m.value, C.accent, C.ink]].forEach(([t, s, v, fill, col], k) => {
        const ry = y + h - 1.5 + k * 0.78;
        els.push(text(mx, ry, RW, 0.28, [{ t: `${t} `, c: C.muted }, { t: s + u, b: true, c: col }], { size: 13, valign: 'middle' }));
        els.push(rect(mx, ry + 0.36, Math.max(0.05, Math.abs(v) / top * RW), 0.16, { fill }));
      });
    }
  }
  return els;
}

// Кейс клиента: три колонки Задача → Решение → Результат на одной оси со стрелками, в «Результате» 1–2 крупных числа.
// Вопрос: «какой результат у клиента?»
// data: { task: { head, body?, metrics? }, solution: { head, body?, items?: [строки] }, result: { head?, metrics: [{ value, prefix?, unit?, digits?, label, caption, src? }] }, heads?: [3], src? }
// metrics можно дать и «Задаче» (число проблемы, цветом текста); акцентом только числа «Результата».
function caseStudy(box, data, opt = {}) {
  const { x, y, w, h } = box, G = opt.gap || 0.7, cw = (w - 2 * G) / 3, ly = y + 0.14, els = [];
  const heads = data.heads || ['Задача', 'Решение', 'Результат'];
  [data.task, data.solution, data.result].forEach((c, i) => {
    const cx = x + i * (cw + G), last = i === 2;
    if (!last) els.push(hline(cx + 0.32, cx + cw + G - 0.06, ly, { color: C.axis, lw: 1.5, arrow: true }));
    els.push(oval(cx + 0.14, ly, 0.28, { fill: last ? C.accent : C.bg, line: last ? C.accent : C.axis, lw: 1.5 }));
    els.push(text(cx, y + 0.46, cw, 0.28, heads[i].toUpperCase(), { size: 10.5, bold: true, color: last ? C.accentInk : C.muted, valign: 'middle' }));
    let yy = y + 0.9;
    if (c.head) {
      const k = lines(c.head, 19, cw, true);
      els.push(text(cx, yy, cw, lh(19) * k + 0.02, c.head, { size: 19, bold: true, ls: 1.1 }));
      yy += lh(19) * k + 0.14;
    }
    if (c.body) {
      const k = lines(c.body, 12.5, cw);
      els.push(text(cx, yy, cw, lh(12.5) * k + 0.02, c.body, { size: 12.5, color: C.ink2, ls: 1.1 }));
      yy += lh(12.5) * k + 0.3;
    }
    (c.items || []).forEach(t => {
      const k = lines(t, 12.5, cw);
      els.push(hline(cx, cx + cw, yy, { color: C.rule, lw: 0.75 }));
      els.push(text(cx, yy + 0.1, cw, lh(12.5) * k + 0.02, t, { size: 12.5, ls: 1.1 }));
      yy += lh(12.5) * k + 0.24;
    });
    (c.metrics || []).forEach((m, k) => {
      if (k) { els.push(hline(cx, cx + cw, yy, { color: C.rule, lw: 0.75 })); yy += 0.2; }
      const v = num(m.label, m.value, m.src || data.src || opt.src, m.digits || 0);
      els.push(text(cx, yy, cw, 0.95, [...(m.prefix ? [{ t: `${m.prefix} `, s: 24 }] : []), { t: v }, { t: unitOf(m.unit), s: 24 }], { size: 54, bold: true, color: last ? C.accentInk : C.ink, valign: 'bottom' }));
      const cl = lines(m.caption, 12.5, cw);
      els.push(text(cx, yy + 1.0, cw, lh(12.5) * cl + 0.02, m.caption, { size: 12.5, color: C.ink2, ls: 1.1 }));
      yy += 1.0 + lh(12.5) * cl + 0.3;
    });
  });
  return els;
}

module.exports = { journeyMap, featureDots, beforeAfter, screenCallouts, personaCard, problemSolution, usageRanking, npsBar, quoteHero, caseStudy };
