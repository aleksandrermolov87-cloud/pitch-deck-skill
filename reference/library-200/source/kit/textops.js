// Группа textops: текстовые раскладки для рабочих слайдов (шаги, просьба, допущения, риски, команда, видение,
// уроки пилота, правила, сюжет «ситуация → осложнение → решение», методика). Только текст: ни графика, ни экрана.
// В деке такой слайд получает archetype с префиксом «text-…» (аудит тогда меряет объём текста вместо бана простых слайдов).
// Порядок держат сетка колонок, кегль и вес, тонкие линии C.rule / C.axis и воздух; акцент один на слайд.
// Числа в любых строках подставляются через {ключ}: { …, nums: { ключ: { value, digits?, unit?, label?, sign?, src? } } }
// (у пункта или у data) — так они проходят через U.num() с источником item.src || data.src || opt.src.
// Даты и длительности («15 декабря», «2 недели») — обычный текст.
const L = require('../lib.js');
const U = require('./util.js');
const { C, rect, hline, vline, text, tw, nb } = L;
const { num, minus, unitOf, lh, wrap } = U;

const srcOf = (it, data, opt) => (it && it.src) || data.src || opt.src;
// Короткие предлоги и союзы («в», «с», «и», «на») не висят в конце строки: неразрывный пробел после них
const glue = s => String(s).replace(/(^|[\s(«])([а-яёА-ЯЁ]{1,2}) /g, `$1$2${nb}`).replace(/(^|[\s(«])([а-яёА-ЯЁ]{1,2}) /g, `$1$2${nb}`);
// «Конверсия выросла до {conv}» + nums.conv → «Конверсия выросла до 34%», число зарегистрировано как факт
function say(s, it, data, opt) {
  if (s == null) return '';
  s = glue(s);
  const pool = { ...(data.nums || {}), ...((it && it.nums) || {}) };
  return String(s).replace(/\{(\w+)\}/g, (m, k) => {
    const n = pool[k];
    if (!n) throw new Error(`textops: в строке «${s}» нет числа {${k}} в nums`);
    const v = num(n.label || k, n.value, n.src || srcOf(it, data, opt), n.digits || 0);
    return (n.sign && n.value > 0 ? '+' : '') + minus(v) + unitOf(n.unit);
  });
}
const nl = (runs, pt, w, bold) => wrap(typeof runs === 'string' ? [{ t: runs, b: !!bold }] : runs.map(r => ({ ...r, b: r.b ?? !!bold })), pt, w);
// Абзац с высотой по числу строк: { el, h }. runs — строка или [{t, c, b, s}]
function para(x, y, w, runs, pt, o = {}) {
  const n = nl(runs, pt, w, o.bold), h = lh(pt) * n + 0.04;
  return { el: text(x, y, w, h, runs, { size: pt, ls: 1.1, ...o }), h, n };
}
// Колонки по долям ширины с промежутком gap: [{ x, w }]
function cols(x, w, fr, gap) {
  const free = w - gap * (fr.length - 1), sum = fr.reduce((a, b) => a + b, 0);
  let cx = x;
  return fr.map(f => { const o = { x: cx, w: f / sum * free }; cx += o.w + gap; return o; });
}
// Наибольший кегль из списка, при котором строка помещается в ширину одной строкой
const fitPt = (s, sizes, w, bold) => sizes.find(pt => nl(s, pt, w * 0.92, bold) === 1) || sizes[sizes.length - 1];
// Подписи колонок над линией: мелкий серый кегль, выключка как у колонки
function heads(cs, labels, y, aligns = []) {
  return labels.map((t, j) => t && text(cs[j].x, y, cs[j].w, 0.3, t, { size: 10, color: C.muted, align: aligns[j] || 'left', valign: 'bottom' })).filter(Boolean);
}

// ═════════════ ДЕЙСТВИЯ И РЕШЕНИЯ ═════════════

// Следующие шаги строками. Вопрос: «что делаем дальше?»
// Действие жирно (под ним пояснение мелко), срок, ответственный и его роль; между строками тонкие линии.
// Ближайший срок (первая строка или step.now) — акцентом.
// data: { steps: [{ action, note?, due, owner, role?, now?, nums?, src? }] ×3–4, heads?: [3 строки], nums?, src? }
// opt: { rowPad (наибольший отступ строки, 0,3″), src }
function nextStepsText(box, data, opt = {}) {
  const { x, y, w, h } = box, steps = data.steps, n = steps.length, els = [];
  const cs = cols(x, w, [0.56, 0.17, 0.27], 0.4), headH = 0.4;
  els.push(...heads(cs, data.heads || ['Что делаем', 'Срок', 'Кто отвечает'], y));
  els.push(hline(x, x + w, y + headH, { color: C.axis, lw: 0.75 }));
  const cur = steps.findIndex(s => s.now);
  // высота строки по содержимому, свободное место поровну сверху и снизу каждой строки
  const rows = steps.map(s => {
    const a = say(s.action, s, data, opt), nt = s.note ? say(s.note, s, data, opt) : '';
    const ha = lh(18) * nl(a, 18, cs[0].w, true) + 0.04, hn = nt ? lh(12) * nl(nt, 12, cs[0].w) + 0.04 : 0;
    const hr = lh(18) + 0.06 + (s.role ? lh(12) * nl(s.role, 12, cs[2].w) + 0.04 : 0);
    return { a, nt, ha, hn, need: Math.max(ha + (nt ? hn + 0.02 : 0), hr) };
  });
  const pad = Math.max(0.14, Math.min(opt.rowPad || 0.3, (h - headH - rows.reduce((a, r) => a + r.need, 0)) / (2 * n)));
  let yy = y + headH;
  steps.forEach((s, i) => {
    const r = rows[i], ty = yy + pad, now = cur >= 0 ? i === cur : i === 0;
    if (i) els.push(hline(x, x + w, yy, { color: C.rule, lw: 0.5 }));
    els.push(text(cs[0].x, ty, cs[0].w, r.ha, r.a, { size: 18, bold: true, ls: 1.1 }));
    if (r.nt) els.push(text(cs[0].x, ty + r.ha + 0.02, cs[0].w, r.hn, r.nt, { size: 12, color: C.ink2, ls: 1.1 }));
    els.push(text(cs[1].x, ty, cs[1].w, lh(18) + 0.02, s.due, { size: 15, bold: now, color: now ? C.accentInk : C.ink, valign: 'middle' }));
    els.push(text(cs[2].x, ty, cs[2].w, lh(18) + 0.02, s.owner, { size: 15, valign: 'middle' }));
    if (s.role) els.push(para(cs[2].x, ty + lh(18) + 0.06, cs[2].w, s.role, 12, { color: C.muted }).el);
    yy += r.need + 2 * pad;
  });
  return els;
}

// Просьба к комитету. Вопрос: «что вы просите утвердить?»
// «Прошу» акцентом и решение крупно, под линией 2–3 условия колонками (подпись, значение, пояснение),
// внизу мелко строка «Если не утвердим: …».
// data: { lead?: 'Прошу', decision, terms: [{ label, value?, digits?, unit?, t?, note?, src? }] ×2–3, ifNot, ifNotLead?, nums?, src? }
// value — число условия (крупно, через U.num), t — текстовое значение, если числа нет.
// opt: { textW, src }
function askStatement(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [], tw0 = Math.min(w, opt.textW || 10.6);
  const runs = [{ t: `${data.lead || 'Прошу'} `, c: C.accentInk }, { t: say(data.decision, null, data, opt) }];
  const pt = [36, 32, 28].find(p => lh(p) * nl(runs, p, tw0, true) <= h * 0.42) || 26;
  const st = para(x, y, tw0, runs, pt, { bold: true });
  els.push(st.el);
  // низ: строка «Если не утвердим», над ней линия; условия — между заявлением и низом
  const ifL = [{ t: `${data.ifNotLead || 'Если не утвердим'}: `, b: true, c: C.ink2 }, { t: say(data.ifNot, null, data, opt), c: C.muted }];
  const fy = y + h - lh(12) * nl(ifL, 12, w) - 0.04;
  if (data.ifNot) {
    els.push(hline(x, x + w, fy - 0.22, { color: C.rule, lw: 0.75 }));
    els.push(para(x, fy, w, ifL, 12).el);
  }
  const ty = y + st.h + Math.max(0.35, (fy - 0.22 - (y + st.h) - 1.55) / 2), tc = cols(x, w, data.terms.map(() => 1), 0.5);
  els.push(hline(x, x + w, ty, { color: C.axis, lw: 0.75 }));
  data.terms.forEach((t, j) => {
    const c = tc[j], src = srcOf(t, data, opt);
    els.push(text(c.x, ty + 0.16, c.w, 0.26, t.label, { size: 11, color: C.muted, valign: 'middle' }));
    const v = t.value != null
      ? [{ t: num(t.vlabel || t.label, t.value, src, t.digits || 0) }, { t: unitOf(t.unit), s: 15 }]
      : [{ t: say(t.t, t, data, opt) }];
    const vs = t.value != null ? 28 : fitPt(t.t, [22, 18, 15], c.w, true);
    els.push(text(c.x, ty + 0.46, c.w, 0.52, v, { size: vs, bold: true, valign: 'bottom' }));
    if (t.note) els.push(para(c.x, ty + 1.06, c.w, say(t.note, t, data, opt), 12, { color: C.ink2 }).el);
  });
  return els;
}

// Допущения расчёта строками. Вопрос: «на каких допущениях держится расчёт?»
// Допущение слева, значение крупно по правому краю колонки, источник мелко у правого края слайда.
// Самое чувствительное допущение (key) — значение акцентом и пометка под названием.
// data: { items: [{ name, value, digits?, unit?, label?, source, key?, keyNote?, src? }] ×4–6, heads?: [3 строки], src? }
// opt: { rowH, src }
function assumptionsList(box, data, opt = {}) {
  const { x, y, w, h } = box, items = data.items, n = items.length, els = [];
  const cs = cols(x, w, [0.5, 0.17, 0.33], 0.4), headH = 0.4;
  els.push(...heads(cs, data.heads || ['Допущение', 'Значение', 'Источник'], y, ['left', 'right', 'right']));
  els.push(hline(x, x + w, y + headH, { color: C.axis, lw: 0.75 }));
  const rh = Math.min(opt.rowH || 0.8, (h - headH) / n);
  items.forEach((it, i) => {
    const yy = y + headH + i * rh, key = !!it.key;
    if (i) els.push(hline(x, x + w, yy, { color: C.rule, lw: 0.5 }));
    const sub = key ? (it.keyNote || 'сильнее всего влияет на итог') : null;
    const nh = lh(15) + (sub ? lh(10) + 0.02 : 0), ny = yy + (rh - nh) / 2;
    els.push(text(cs[0].x, ny, cs[0].w, lh(15) + 0.02, it.name, { size: 15, bold: key, valign: 'middle' }));
    if (sub) els.push(text(cs[0].x, ny + lh(15) + 0.02, cs[0].w, lh(10) + 0.02, sub, { size: 10, color: C.accentInk, valign: 'middle' }));
    const v = num(it.label || it.name, it.value, srcOf(it, data, opt), it.digits || 0);
    els.push(text(cs[1].x, yy, cs[1].w, rh, [{ t: (it.sign && it.value > 0 ? '+' : '') + minus(v) }, { t: unitOf(it.unit), s: 12 }], { size: 20, bold: true, color: key ? C.accentInk : C.ink, align: 'right', valign: 'middle' }));
    els.push(text(cs[2].x, yy, cs[2].w, rh, it.source, { size: 10, color: C.muted, align: 'right', valign: 'middle' }));
  });
  return els;
}

// Риски строками. Вопрос: «что может пойти не так?»
// Риск жирно (под ним последствие мелко), уровень словом, мера и владелец. Высокий уровень — акцентное слово
// и акцентная черта слева от риска; средний и низкий — серым.
// data: { items: [{ risk, note?, level: 'high'|'mid'|'low', measure, owner, nums?, src? }] ×3–4, heads?: [4 строки], levels?: { high, mid, low } }
// opt: { rowH, src }
function risksText(box, data, opt = {}) {
  const { x, y, w, h } = box, items = data.items, n = items.length, els = [];
  const LV = { high: 'высокий', mid: 'средний', low: 'низкий', ...(data.levels || {}) };
  const ind = 0.22, cs = cols(x + ind, w - ind, [0.33, 0.12, 0.37, 0.18], 0.35), headH = 0.4;
  els.push(...heads(cs, data.heads || ['Риск', 'Уровень', 'Что делаем', 'Владелец'], y));
  els.push(hline(x, x + w, y + headH, { color: C.axis, lw: 0.75 }));
  const rh = Math.min(opt.rowH || 1.15, (h - headH) / n);
  items.forEach((it, i) => {
    const yy = y + headH + i * rh, ty = yy + 0.2, hi = it.level === 'high';
    if (i) els.push(hline(x, x + w, yy, { color: C.rule, lw: 0.5 }));
    const r = para(cs[0].x, ty, cs[0].w, say(it.risk, it, data, opt), 16, { bold: true });
    els.push(r.el);
    let bh = r.h;
    if (it.note) { const p = para(cs[0].x, ty + r.h + 0.02, cs[0].w, say(it.note, it, data, opt), 11, { color: C.muted }); els.push(p.el); bh += p.h + 0.02; }
    if (hi) els.push(rect(x, ty + 0.04, 0.05, bh - 0.08, { fill: C.accent }));
    els.push(text(cs[1].x, ty, cs[1].w, lh(16) + 0.02, LV[it.level] || it.level, { size: 13, bold: hi, color: hi ? C.accentInk : C.ink2, valign: 'middle' }));
    els.push(para(cs[2].x, ty + (lh(16) - lh(13)) / 2, cs[2].w, say(it.measure, it, data, opt), 13).el);
    els.push(para(cs[3].x, ty + (lh(16) - lh(13)) / 2, cs[3].w, it.owner, 13, { color: C.ink2 }).el);
  });
  return els;
}

// ═════════════ ЛЮДИ И НАПРАВЛЕНИЕ ═════════════

// Команда проекта сеткой. Вопрос: «кто в команде проекта?»
// Над каждым человеком отрезок линии (у руководителя — акцентный и роль акцентом), имя жирно, роль,
// зона ответственности одной строкой и контакт мелко. Группы (банк, страховая компания, подрядчик) — висячей подписью слева.
// data: { groups: [{ name, people: [{ name, role, area, contact?, lead? }] }] } или { people: [...] } (4–8 человек)
// opt: { perRow (по умолчанию 4), labelW }
function teamContacts(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [];
  const groups = data.groups || [{ name: '', people: data.people }], hasG = !!data.groups;
  const per = opt.perRow || 4, LW = hasG ? (opt.labelW || 2.1) : 0, gx = x + LW, gap = 0.35;
  const rows = groups.flatMap(g => { const r = []; for (let k = 0; k < g.people.length; k += per) r.push({ g: k ? '' : g.name, people: g.people.slice(k, k + per) }); return r; });
  const cw = (w - LW - gap * (per - 1)) / per, hasC = rows.some(r => r.people.some(p => p.contact));
  // ярусы ячейки: имя, роль, зона, контакт
  // один кегль имени и один кегль зоны на весь слайд: наибольший, при котором все строки помещаются
  const all = rows.flatMap(r => r.people), fitAll = (key, sizes, bold) => sizes.find(pt => all.every(p => fitPt(p[key], [pt], cw, bold) === pt && nl(p[key], pt, cw * 0.92, bold) === 1)) || sizes[sizes.length - 1];
  const NP = fitAll('name', [20, 18, 16], true), AP = fitAll('area', [14, 13, 12]);
  const t0 = 0.2, t1 = t0 + lh(20) + 0.06, t2 = t1 + lh(14) + 0.06, t3 = t2 + lh(14) + 0.06, cellH = (hasC ? t3 + lh(11) : t2 + lh(14)) + 0.1;
  const rowH = Math.max(cellH + 0.4, h / rows.length);
  rows.forEach((r, i) => {
    const yy = y + i * rowH;
    // капитель шире строчных: оценку ширины умножаем на 1,2
    if (r.g) els.push(text(x, yy + t0 + (lh(20) - lh(11)) / 2, LW - 0.3, lh(11) * nl(r.g.toUpperCase(), 11 * 1.2, LW - 0.3, true) + 0.04, r.g.toUpperCase(), { size: 11, bold: true, color: C.muted, ls: 1.1 }));
    r.people.forEach((p, j) => {
      const cx = gx + j * (cw + gap);
      els.push(hline(cx, cx + cw, yy, p.lead ? { color: C.accent, lw: 2.5 } : { color: C.axis, lw: 0.75 }));
      els.push(text(cx, yy + t0, cw, lh(20) + 0.02, p.name, { size: NP, bold: true, valign: 'middle' }));
      els.push(text(cx, yy + t1, cw, lh(14) + 0.02, p.role, { size: 14, bold: !!p.lead, color: p.lead ? C.accentInk : C.ink2, valign: 'middle' }));
      els.push(text(cx, yy + t2, cw, lh(14) + 0.02, p.area, { size: AP, color: C.muted, valign: 'middle' }));
      if (p.contact) els.push(text(cx, yy + t3, cw, lh(11) + 0.02, p.contact, { size: 11, color: C.muted, valign: 'middle' }));
    });
  });
  return els;
}

// Видение одним абзацем и три опоры. Вопрос: «куда мы идём?»
// Над абзацем мелкая подпись (горизонт), абзац до 25 слов крупно, одно слово или фраза акцентом;
// внизу три опоры колонками, между ними тонкие вертикальные разделители, над ними общая линия.
// data: { kicker?, text, accent?: подстрока text, pillars: [{ name, note }] ×3, nums?, src? }
// opt: { textW, src }
function visionStatement(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [], tw0 = Math.min(w, opt.textW || 10.8);
  const s = say(data.text, null, data, opt), ac = data.accent ? glue(data.accent) : '', a = ac ? s.indexOf(ac) : -1;
  const runs = a >= 0 ? [{ t: s.slice(0, a) }, { t: ac, c: C.accentInk }, { t: s.slice(a + ac.length) }].filter(r => r.t) : [{ t: s }];
  const pc = cols(x, w, data.pillars.map(() => 1), 0.7);
  const pH = Math.max(...data.pillars.map((p, j) => lh(18) + 0.1 + lh(12) * nl(say(p.note, p, data, opt), 12, pc[j].w))) + 0.3;
  const py = y + h - pH, ky = data.kicker ? 0.42 : 0;
  const pt = [36, 32, 30, 28, 26].find(p => lh(p) * nl(runs, p, tw0, true) <= py - y - ky - 0.5) || 24;
  if (data.kicker) els.push(text(x, y, tw0, 0.28, data.kicker, { size: 12, color: C.muted, valign: 'middle' }));
  els.push(para(x, y + ky, tw0, runs, pt, { bold: true }).el);
  els.push(hline(x, x + w, py, { color: C.axis, lw: 0.75 }));
  data.pillars.forEach((p, j) => {
    const c = pc[j];
    if (j) els.push(vline(c.x - 0.35, py + 0.25, y + h, { color: C.rule, lw: 0.75 }));
    els.push(text(c.x, py + 0.25, c.w, lh(18) + 0.02, p.name, { size: 18, bold: true, valign: 'middle' }));
    els.push(para(c.x, py + 0.25 + lh(18) + 0.1, c.w, say(p.note, p, data, opt), 12, { color: C.ink2 }).el);
  });
  return els;
}

// ═════════════ ВЫВОДЫ И ПРАВИЛА ═════════════

// Чему научил пилот: три колонки «Сработало / Не сработало / Меняем». Вопрос: «чему научил пилот?»
// Заголовок колонки над линией: у «Меняем» линия акцентная и толще, это вывод слайда. Пункты разделены тонкими линиями,
// у «Не сработало» текст приглушён. 2–3 пункта: { t, d? }.
// data: { worked: [пункт], failed: [пункт], change: [пункт], heads?: [3 строки], notes?: [3 подписи под заголовками], nums?, src? }
// opt: { itemPt (17), notePt (13), src }
function lessonsLearned(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [];
  const lists = [data.worked, data.failed, data.change].map(l => (l || []).map(it => (typeof it === 'string' ? { t: it } : it)));
  const hs = data.heads || ['Сработало', 'Не сработало', 'Меняем'], notes = data.notes || ['повторяем при запуске', 'убираем из процесса', 'делаем иначе с января'];
  const cs = cols(x, w, [1, 1, 1], 0.55), ly = y + 0.82;
  hs.forEach((t, j) => {
    const c = cs[j], acc = j === 2;
    els.push(text(c.x, y, c.w, 0.44, t, { size: 22, bold: true, color: acc ? C.accentInk : C.ink, valign: 'middle' }));
    els.push(text(c.x, y + 0.44, c.w, 0.26, notes[j], { size: 11, color: C.muted, valign: 'middle' }));
    els.push(hline(c.x, c.x + c.w, ly, acc ? { color: C.accent, lw: 3 } : { color: C.axis, lw: 1.25 }));
  });
  // ряды пунктов общие для трёх колонок: n-й пункт каждой колонки начинается на одной высоте
  const TP = opt.itemPt || 17, DP = opt.notePt || 13;
  const blocks = lists.map((l, j) => l.map(it => {
    const t = say(it.t, it, data, opt), d = it.d ? say(it.d, it, data, opt) : '';
    return { t, d, ht: lh(TP) * nl(t, TP, cs[j].w, true) + 0.04, hd: d ? lh(DP) * nl(d, DP, cs[j].w) + 0.04 : 0 };
  }));
  const nr = Math.max(...lists.map(l => l.length)), rowNeed = k => Math.max(...blocks.map(b => (b[k] ? b[k].ht + (b[k].hd ? b[k].hd + 0.04 : 0) : 0)));
  const need = Array.from({ length: nr }, (_, k) => rowNeed(k)), free = y + h - ly - 0.3 - need.reduce((a, b) => a + b, 0);
  const g = Math.max(0.3, Math.min(1.2, free / nr));
  let yy = ly + 0.3;
  need.forEach((nh, k) => {
    blocks.forEach((b, j) => {
      const it = b[k], c = cs[j];
      if (!it) return;
      if (k) els.push(hline(c.x, c.x + c.w, yy - g / 2, { color: C.rule, lw: 0.5 }));
      els.push(text(c.x, yy, c.w, it.ht, it.t, { size: TP, bold: true, color: j === 1 ? C.ink2 : C.ink, ls: 1.1 }));
      if (it.d) els.push(text(c.x, yy + it.ht + 0.04, c.w, it.hd, it.d, { size: DP, color: C.muted, ls: 1.1 }));
    });
    yy += nh + g;
  });
  return els;
}

// Делаем / не делаем: две колонки, пункты парами на общих линиях. Вопрос: «что делаем и чего не делаем?»
// Под заголовком «Делаем» акцентная линия, у «Не делаем» тонкая серая и приглушённый тон текста.
// data: { dos: [{ t, d? }], donts: [{ t, d? }] (3–5), heads?: [2 строки], nums?, src? }
// opt: { gap, src }
function dosDonts(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [], G = opt.gap || 0.9;
  const lists = [data.dos, data.donts].map(l => l.map(it => (typeof it === 'string' ? { t: it } : it)));
  const hs = data.heads || ['Делаем', 'Не делаем'], cs = cols(x, w, [1, 1], G), ly = y + 0.62;
  hs.forEach((t, j) => {
    els.push(text(cs[j].x, y, cs[j].w, 0.5, t, { size: 24, bold: true, color: j ? C.muted : C.ink, valign: 'middle' }));
    els.push(hline(cs[j].x, cs[j].x + cs[j].w, ly, j ? { color: C.axis, lw: 1 } : { color: C.accent, lw: 3 }));
  });
  const nr = Math.max(...lists.map(l => l.length)), rh = (y + h - ly) / nr;
  els.push(vline(x + cs[0].w + G / 2, ly + 0.2, y + h, { color: C.rule, lw: 0.75 }));
  for (let k = 0; k < nr; k++) {
    const yy = ly + k * rh;
    lists.forEach((l, j) => {
      const it = l[k], c = cs[j];
      if (!it) return;
      if (k) els.push(hline(c.x, c.x + c.w, yy, { color: C.rule, lw: 0.5 }));
      const t = para(c.x, yy + 0.2, c.w, say(it.t, it, data, opt), 16, { bold: !j, color: j ? C.muted : C.ink });
      els.push(t.el);
      if (it.d) els.push(para(c.x, yy + 0.2 + t.h + 0.02, c.w, say(it.d, it, data, opt), 12, { color: j ? C.muted : C.ink2 }).el);
    });
  }
  return els;
}

// ═════════════ СЮЖЕТ И МЕТОДИКА ═════════════

// Ситуация → Осложнение → Решение. Вопрос: «почему это важно сейчас?»
// Три колонки, заголовки соединены линиями-стрелками, у «Решения» заголовок акцентом. Под заголовком тезис жирно
// и 2–3 строки пояснения. Внизу на всю ширину строка «Почему сейчас» над тонкой линией.
// data: { steps: [{ head?, lead, t }] ×3, now?: строка, nowLead?: 'Почему сейчас', nums?, src? }
// opt: { leadPt (20), textPt (15), src }
function storyArc(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [], HD = ['Ситуация', 'Осложнение', 'Решение'];
  const cs = cols(x, w, [1, 1, 1], 0.7);
  data.steps.forEach((s, j) => {
    const c = cs[j], hd = s.head || HD[j], acc = j === 2;
    els.push(text(c.x, y, tw(hd, 22, true) + 0.15, 0.44, hd, { size: 22, bold: true, color: acc ? C.accentInk : C.ink, valign: 'middle' }));
    if (j < 2) els.push(hline(c.x + tw(hd, 22, true) + 0.3, cs[j + 1].x - 0.2, y + 0.22, { color: C.axis, lw: 1.25, arrow: true }));
    const ld = para(c.x, y + 0.8, c.w, say(s.lead, s, data, opt), opt.leadPt || 20, { bold: true });
    els.push(ld.el);
    els.push(para(c.x, y + 0.8 + ld.h + 0.16, c.w, say(s.t, s, data, opt), opt.textPt || 15, { color: C.ink2 }).el);
  });
  if (data.now) {
    const runs = [{ t: `${data.nowLead || 'Почему сейчас'}: `, b: true, c: C.ink }, { t: say(data.now, null, data, opt), c: C.ink2 }];
    const p = para(x, 0, w, runs, 15), ny = y + h - p.h;
    els.push(hline(x, x + w, ny - 0.28, { color: C.axis, lw: 0.75 }));
    els.push(para(x, ny, w, runs, 15).el);
  }
  return els;
}

// Методика и источники. Вопрос: «как считали и откуда данные?»
// Слева 3–5 пунктов методики (тезис жирно, пояснение), справа за тонкой вертикалью — источники мелко с датами
// по правому краю. Ключевой пункт (key) — тезис акцентом.
// data: { method: [{ t, d?, key?, nums? }] ×3–5, sources: [{ name, date }], heads?: [2 строки], nums?, src? }
// opt: { leftW (доля ширины, 0.58), src }
function methodNotes(box, data, opt = {}) {
  const { x, y, w, h } = box, els = [], G = 0.7;
  const lw = (w - G) * (opt.leftW || 0.58), rx = x + lw + G, rw = x + w - rx, hs = data.heads || ['Как считали', 'Откуда данные'];
  const top = y + 0.42;
  [[x, lw], [rx, rw]].forEach(([cx, cw], j) => {
    els.push(text(cx, y, cw, 0.3, hs[j].toUpperCase(), { size: 10, bold: true, color: C.muted, valign: 'bottom' }));
    els.push(hline(cx, cx + cw, top, { color: C.axis, lw: 0.75 }));
  });
  els.push(vline(x + lw + G / 2, top + 0.2, y + h, { color: C.rule, lw: 0.75 }));
  // методика: свободная высота поровну между пунктами, линии посередине промежутков
  const ms = data.method.map(it => {
    const t = say(it.t, it, data, opt), d = it.d ? say(it.d, it, data, opt) : '';
    const ht = lh(15) * nl(t, 15, lw, true) + 0.04, hd = d ? lh(12) * nl(d, 12, lw) + 0.04 : 0;
    return { it, t, d, ht, hd, H: ht + (d ? hd + 0.04 : 0) };
  });
  const g = Math.max(0.3, (y + h - top - 0.2 - ms.reduce((a, m) => a + m.H, 0)) / ms.length);
  let yy = top + 0.2;
  ms.forEach((m, i) => {
    if (i) els.push(hline(x, x + lw, yy - g / 2, { color: C.rule, lw: 0.5 }));
    els.push(text(x, yy, lw, m.ht, m.t, { size: 15, bold: true, color: m.it.key ? C.accentInk : C.ink, ls: 1.1 }));
    if (m.d) els.push(text(x, yy + m.ht + 0.04, lw, m.hd, m.d, { size: 12, color: C.ink2, ls: 1.1 }));
    yy += m.H + g;
  });
  // источники: название слева, дата по правому краю, строки через тонкие линии
  const DW = Math.max(...data.sources.map(s => tw(s.date, 10))) + 0.15, nw = rw - DW - 0.2;
  const ss = data.sources.map(s => ({ s, hn: lh(11) * nl(s.name, 11, nw) + 0.04 }));
  const sg = Math.max(0.2, Math.min(0.5, (y + h - top - 0.2 - ss.reduce((a, q) => a + q.hn, 0)) / ss.length));
  let sy = top + 0.2;
  ss.forEach(({ s, hn }, i) => {
    if (i) els.push(hline(rx, rx + rw, sy - sg / 2, { color: C.rule, lw: 0.5 }));
    els.push(text(rx, sy, nw, hn, s.name, { size: 11, color: C.ink2, ls: 1.1 }));
    els.push(text(rx + rw - DW, sy, DW, lh(11) + 0.02, s.date, { size: 10, color: C.muted, align: 'right', valign: 'middle' }));
    sy += hn + sg;
  });
  return els;
}

module.exports = { nextStepsText, askStatement, assumptionsList, risksText, teamContacts, visionStatement, lessonsLearned, dosDonts, storyArc, methodNotes };
