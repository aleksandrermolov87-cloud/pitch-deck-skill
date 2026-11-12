// Сборка: node build.js → ../<NAME>_<тема>.pptx + out[-light]/deck.html (двойник для рендера, замеров и impeccable)
// + out/facts.json — числа со слайдов с адресами источников для facts_check.py.
// THEME=dark|light, ONLY=<n> — однослайдовый файл для проверки, OUTFILE=<путь> — куда писать pptx.
const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');
const L = require('./lib.js');
const { S } = require('./slides.js');
const META = require('./deck.json');   // { "name": "…", "title": "…", "author": "…", "hidden": [n…] }

const { T, THEME, C, W, H, FACTS, PAGE } = L;
const FONT = T.font.regular, THIN = T.font.thin || T.font.regular;
const OUT = path.join(__dirname, 'out' + (THEME === 'light' ? '-light' : ''));
const IMG = f => path.join(__dirname, 'img', THEME === 'light' && f.startsWith('bg_') ? f.replace(/^bg_/, 'bgL_') : f);
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });

// Картинка вписывается в бокс по своим пропорциям: размеры читаются из заголовка PNG или JPEG (pptxgenjs сам растянул бы)
function imgSize(file) {
  const b = fs.readFileSync(file);
  if(file.endsWith('.svg')){const v=b.toString().match(/viewBox="([^"]+)"/);if(v){const a=v[1].trim().split(/\s+/).map(Number);return [a[2],a[3]];}throw Error('SVG needs a viewBox: '+file);}
  if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  for (let i = 2; i < b.length;) {
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc2) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  return [1, 1];
}
// Картинки слайдов — только из img/ проекта: путь вида ../../ или абсолютный не пропускаем
const IMGDIR = path.join(__dirname, 'img');
const safeImg = f => { const p = path.resolve(IMGDIR, f); if (!p.startsWith(IMGDIR + path.sep)) throw new Error(`картинка вне img/: ${f}`); return p; };
function fitBox(e) {
  if (!e.contain) return { x: e.x, y: e.y, w: e.w, h: e.h };
  const [iw, ih] = imgSize(safeImg(e.file));
  const k = Math.min(e.w / iw, e.h / ih), w = iw * k, h = ih * k;
  return { x: e.x + (e.w - w) / 2, y: e.y + (e.h - h) / 2, w, h };
}

PAGE.total = S.length;
const slides = S.map((f, i) => { PAGE.n = i + 1; const sl = f(); sl.els = sl.els.filter(e => e && e.t !== 'skip'); return sl; });
// подложка слайда из чата: deck.json → bg_override { "4": "bg_n4.jpg" } (scripts/bg_edit.py) заменяет bg, заданный в slides.js
for (const [n, f] of Object.entries(META.bg_override || {})) {
  if (!/^bg_[A-Za-z0-9_-]+\.jpg$/.test(f)) throw new Error(`deck.json bg_override: имя подложки вида bg_<имя>.jpg (${f})`);
  if (slides[+n - 1]) slides[+n - 1].bg = f;
}
// Многострочным боксам — интервал не меньше 1,1 (≈1,32 em): плотнее читать трудно, impeccable это ловит.
// Однострочные подписи (бокс ниже 1,8 строки) остаются на 1,0.
slides.forEach(sl => sl.els.forEach(e => {
  if (e.t === 'text' && e.h * 72 / (e.size * 1.2) >= 1.8 && (e.ls ?? 1) < 1.1) e.ls = 1.1;
}));
const ONLY = +process.env.ONLY || 0;
const pptSlides = ONLY ? [slides[ONLY - 1]] : slides;

// ───────── PPTX ─────────
const pres = new pptxgen();
pres.defineLayout({ name: 'DECK', width: W, height: H });
pres.layout = 'DECK';
pres.title = META.title;
pres.author = META.author || '';
const fill = e => e.fill ? { color: e.fill, transparency: e.alpha != null ? Math.round((1 - e.alpha) * 100) : 0 } : { type: 'none' };
const line = e => e.line ? { color: e.line, width: e.lw || 1, dashType: e.dash ? 'dash' : 'solid' } : { type: 'none' };
const CHARTS = [];   // нативные диаграммы (kit/charts.js) в порядке addChart: их встроенные таблицы заменяются при записи
pptSlides.forEach((sl, i) => {
  const s = pres.addSlide();
  if (sl.hidden || (META.hidden || []).includes(i + 1)) s.hidden = true;
  if (sl.bg && fs.existsSync(IMG(sl.bg))) s.background = { path: IMG(sl.bg) };
  else s.background = { color: C.bg };
  sl.els.forEach(e => {
    if (e.twin) return;   // фигуры HTML-двойника нативной диаграммы: в PPTX её рисует сам chart
    if (e.t === 'chart') { s.addChart(e.type, e.data, { x: e.x, y: e.y, w: e.w, h: e.h, ...e.opts }); CHARTS.push(e); }
    else if (e.t === 'rect') s.addShape(e.r ? pres.shapes.ROUNDED_RECTANGLE : pres.shapes.RECTANGLE, { x: e.x, y: e.y, w: e.w, h: e.h, rectRadius: e.r || 0, fill: fill(e), line: line(e) });
    else if (e.t === 'tri') s.addShape(pres.shapes.ISOSCELES_TRIANGLE, { x: e.x, y: e.y, w: e.w, h: e.h, rotate: e.rot || 0, fill: fill(e), line: { type: 'none' } });
    else if (e.t === 'diamond') s.addShape(pres.shapes.DIAMOND, { x: e.x, y: e.y, w: e.w, h: e.h, fill: fill(e), line: line(e) });
    else if (e.t === 'oval') s.addShape(pres.shapes.OVAL, { x: e.x, y: e.y, w: e.w, h: e.h, fill: fill(e), line: line(e) });
    else if (e.t === 'line') s.addShape(pres.shapes.LINE, { x: e.x, y: e.y, w: e.w, h: e.h, flipV: !!e.flipV, flipH: !!e.flipH, line: { color: e.color || C.line, width: e.lw || 1, dashType: e.dash ? 'dash' : 'solid', endArrowType: e.arrow ? 'triangle' : undefined } });
    else if (e.t === 'image') {
      s.addImage({ path: safeImg(e.file), ...fitBox(e), ...(e.shadow?{shadow:e.shadow}:{}), ...(e.brandMark?{objectName:'Alfa-Bank official vector mark'}:{}) });
      // PptxGenJS in Node cannot rasterize SVG fallback itself. Supply the
      // pre-rendered transparent fallback while keeping svgBlip as the primary.
      if(e.brandMark)for(const rel of s._relsMedia.slice(-2))if(rel.isSvgPng){rel.path=safeImg(e.file.replace(/\.svg$/,'.png'));rel.data='';rel.isSvgPng=false;}
    }
    else if (e.t === 'text') {
      const runs = e.runs.flatMap(r => {
        const parts=String(r.t).split('\n');
        return parts.flatMap((part,j)=>!part&&j===parts.length-1?[]:[{text:part,options:{color:r.c||e.color||C.ink,bold:r.b??!!e.bold,fontSize:r.s||e.size,fontFace:(r.thin??e.thin)?THIN:FONT,breakLine:j<parts.length-1}}]);
      });
      s.addText(runs, { x: e.x, y: e.y, w: e.w, h: e.h, fontFace: e.thin ? THIN : FONT, fontSize: e.size, align: e.align || 'left', valign: e.valign || 'top', margin: 0, lineSpacingMultiple: e.ls ?? 1.0, fit: 'none', wrap: true });
    }
  });
  if (sl.notes) s.addNotes(sl.notes);
});

// ───────── HTML-двойник: те же координаты в долях холста 1920 × 1080 ─────────
const pct = (v, of) => +(v / of * 100).toFixed(3) + '%';
const cq = pt => +(pt * 2 / 19.2).toFixed(3) + 'cqw';      // 1 pt = 2 px на холсте 1920
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const rgba = (hex, a = 1) => a === 1 ? `#${hex}` : `rgba(${parseInt(hex.slice(0, 2), 16)},${parseInt(hex.slice(2, 4), 16)},${parseInt(hex.slice(4), 16)},${a})`;
const b64 = f => { const p = IMG(f); return fs.existsSync(p) ? `data:image/${p.endsWith('.svg') ? 'svg+xml' : p.endsWith('.png') ? 'png' : 'jpeg'};base64,` + fs.readFileSync(p).toString('base64') : ''; };

// Текст, лежащий на залитой фигуре (плашка, карточка), кладётся внутрь неё: так фон текста в DOM
// совпадает с видимым, и проверка контраста меряет белый на красном, а не белый на фоне слайда.
const inside = (t, r) => t.x >= r.x - 0.01 && t.y >= r.y - 0.01 && t.x + t.w <= r.x + r.w + 0.01 && t.y + t.h <= r.y + r.h + 0.01;

function textHtml(e, rel) {
  const box = rel
    ? `left:${pct(e.x - rel.x, rel.w)};top:${pct(e.y - rel.y, rel.h)};width:${pct(e.w, rel.w)};height:${pct(e.h, rel.h)}`
    : `left:${pct(e.x, W)};top:${pct(e.y, H)};width:${pct(e.w, W)};height:${pct(e.h, H)}`;
  const jc = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[e.valign || 'top'];
  const inner = e.runs.map(r => {
    const st = [`color:#${r.c || e.color || C.ink}`];
    if (r.b ?? e.bold) st.push('font-weight:700');
    if (r.thin ?? e.thin) st.push(`font-family:'${THIN}'`);
    if (r.s) st.push(`font-size:${cq(r.s)}`);
    return `<span style="${st.join(';')}">${esc(r.t)}</span>`;
  }).join('');
  const lh = +(1.2 * (e.ls ?? 1)).toFixed(3);
  return `<div class="t"${e.id ? ` data-id="${esc(e.id)}"` : ''} style="${box};justify-content:${jc};text-align:${e.align || 'left'};font-size:${cq(e.size)};line-height:${lh}"><p>${inner}</p></div>`;
}

function toHtml(sl, i) {
  // для каждого текста — ближайшая предыдущая непрозрачная фигура, которая его целиком накрывает
  const host = new Map(), kids = new Map();
  sl.els.forEach((e, k) => {
    if (e.t !== 'text') return;
    for (let j = k - 1; j >= 0; j--) {
      const r = sl.els[j];
      if (r.t === 'text') continue;
      if ((r.t === 'rect' || r.t === 'oval') && r.fill && (r.alpha ?? 1) >= 0.9 && inside(e, r)) { host.set(k, j); kids.set(j, [...(kids.get(j) || []), k]); break; }
    }
  });
  const parts = sl.els.map((e, k) => {
    if (host.has(k)) return '';
    const box = `left:${pct(e.x, W)};top:${pct(e.y, H)};width:${pct(e.w, W)};height:${pct(e.h, H)}`;
    if (e.t === 'diamond') return `<div class="e" style="${box};clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);background:${rgba(e.fill, e.alpha ?? 1)}"></div>`;
    if (e.t === 'tri') return `<div class="e" style="${box};clip-path:polygon(50% 0,100% 100%,0 100%);transform:rotate(${e.rot || 0}deg);background:${rgba(e.fill, e.alpha ?? 1)}"></div>`;   // наконечник стрелки схемы
    if (e.t === 'rect' || e.t === 'oval') {
      const r = e.t === 'oval' ? '50%' : `${+((e.r ?? 0) * 100 / W).toFixed(3)}cqw`;
      const inner = (kids.get(k) || []).map(t => textHtml(sl.els[t], e)).join('');
      return `<div class="e" style="${box};border-radius:${r};background:${e.fill ? rgba(e.fill, e.alpha ?? 1) : 'transparent'};${e.line ? (e.dash ? `border:${cq(e.lw || 1)} dashed #${e.line};box-sizing:border-box` : `box-shadow:inset 0 0 0 ${cq(e.lw || 1)} #${e.line}`) : ''}">${inner}</div>`;
    }
    if (e.t === 'line') {
      const ww=Math.max(e.w*144,1), hh=Math.max(e.h*144,1), col=e.color||C.line;
      const id=`arrow-${i}-${k}`;
      const x1=e.flipH?ww:0, x2=e.flipH?0:ww;
      const y1=e.flipV?hh:0, y2=e.flipV?0:hh;
      const style=box+(e.w===0?';width:1px':'')+(e.h===0?';height:1px':'');
      return `<svg class="e" style="${style};overflow:visible" viewBox="0 0 ${ww} ${hh}" preserveAspectRatio="none"><defs><marker id="${id}" markerWidth="12" markerHeight="10" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L11 5 L0 10 Z" fill="#${col}"/></marker></defs><line x1="${e.w===0?0:x1}" y1="${e.h===0?0:y1}" x2="${e.w===0?0:x2}" y2="${e.h===0?0:y2}" stroke="#${col}" stroke-width="${(e.lw||1)*2}" vector-effect="non-scaling-stroke" ${e.arrow?`marker-end="url(#${id})"`:''} ${e.dash?'stroke-dasharray="6 4"':''}/></svg>`;
    }
    if (e.t === 'chart') return '';
    if (e.t === 'image') { const f = fitBox(e); const shadow=e.shadow?`;filter:drop-shadow(0 ${cq(e.shadow.distance)} ${cq(e.shadow.blur)} rgba(115,85,81,${e.shadow.opacity}))`:''; return `<img class="e" alt="" style="left:${pct(f.x, W)};top:${pct(f.y, H)};width:${pct(f.w, W)};height:${pct(f.h, H)};object-fit:cover${shadow}" src="${b64(e.file)}">`; }
    return textHtml(e);
  });
  const bg = sl.bg ? b64(sl.bg) : '';
  return `<section class="slide" id="s${i + 1}" aria-label="Слайд ${i + 1}"><div class="cv" style="background-color:#${C.bg};${bg ? `background-image:url(${bg})` : ''}">${parts.join('')}</div></section>`;
}

const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src 'self' data:; script-src 'unsafe-inline'"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(META.title)}</title>
<style>
:root{--bg:#${C.bg};--ink:#${C.ink};color-scheme:${THEME}}
*{box-sizing:border-box;margin:0}
body{background:var(--bg);color:var(--ink);font-family:'${FONT}',system-ui,sans-serif;padding:16px;display:grid;gap:16px;justify-items:center}
::selection{background:#${C.accent};color:#${C.onAccent}}
.slide{width:min(100%,1920px);display:flex}
.cv{position:relative;width:100%;aspect-ratio:${W}/${H};container-type:inline-size;background-size:cover;overflow:hidden}
.e{position:absolute}
.ln .ar{position:absolute;right:-0.1cqw;top:-0.42cqw;border:0.4cqw solid transparent;border-left:0.7cqw solid;border-right:0}
.t{position:absolute;display:flex;flex-direction:column}
.t p{white-space:pre-wrap;overflow-wrap:break-word}
</style></head><body>
${slides.map(toHtml).join('\n')}
</body></html>`;
fs.writeFileSync(path.join(OUT, 'deck.html'), html);
// shown: число читается на своём слайде в подписи, связанной с фактом (подпись, заголовок, легенда). auto-факты без shown
// только рисуют график: facts_check.py и brief_coverage.py различают «влияет на график» и «можно прочитать».
const flat = s => s.replace(/[\s\u00a0\u202f]/g, '').replace('−', '-');
// тысячи в fmt() разделены неразрывным пробелом; обычный пробел и границы элементов разделяют разные числа
const tokens = sl => new Set((sl.els.filter(e => e.t === 'text').map(e => e.runs.map(r => r.t).join('')).join('\n')
  .match(/\d[\d\u00a0\u202f]*(?:[.,]\d+)?/g) || []).map(flat));
// Связанная подпись (components.js → linkShown): у числа компонента — тексты того же вызова, у fact() из slides.js —
// любой текст слайда; один токен подтверждает один факт, равное число из другой подписи не засчитывается.
// shown_as: label — число с периодом и единицей в одной подписи, value — только число, graph — только нарисовано, none.
// components.js проекта старше 1.8 без linkShown: прежняя проверка по любому токену слайда.
const { linkShown } = require('./components.js');
slides.forEach((sl, i) => {
  const own = FACTS.filter(f => f.slide === i + 1), t = linkShown ? null : tokens(sl);
  const st = linkShown ? linkShown(own, sl.els)
    : new Map(own.map(f => [f, [f.digits || 0, 0, 1, 2].some(d => t.has(flat(L.fmt(Math.abs(f.value), d)))) ? 'value' : f.lib ? 'graph' : 'none']));
  own.forEach(f => { f.shown_as = st.get(f); f.shown = f.shown_as === 'label' || f.shown_as === 'value'; });
});
FACTS.forEach(f => {
  if (!f.id) f.id = `s${f.slide}/${f.label}`;
  if (f.shown == null) { f.shown = false; f.shown_as = f.lib ? 'graph' : 'none'; }
});
fs.writeFileSync(path.join(__dirname, 'out', 'facts.json'), JSON.stringify(FACTS, null, 1));
// манифест для этапа 7: номер, функция, архетип и заголовок каждого слайда
const titleOf = sl => (sl.els.find(e => e.t === 'text' && /-title$/.test(e.id || '')) || { runs: [] }).runs.map(r => r.t).join('');
fs.writeFileSync(path.join(__dirname, 'out', 'slides.json'), JSON.stringify(slides.map((sl, i) => ({
  n: i + 1, fn: S[i].name, archetype: sl.archetype || S[i].name, title: titleOf(sl), hidden: !!sl.hidden, bg: sl.bg || null,
  // какие компоненты библиотеки собрали тело слайда и почему, если ни одного (этап 2, library_check.py)
  lib: [...new Set(sl.els.map(e => e.lib).filter(Boolean))], custom: sl.custom || null,
  // тексты слайда по частям (runs) для быстрой правки формулировок (scripts/copy_edit.py)
  texts: sl.els.filter(e => e.t === 'text').map(e => ({ id: e.id || null, lib: e.lib || null, runs: e.runs.map(r => r.t) })),
  // заметки докладчика: version_compare.py показывает их правку отдельно от сборщика
  notes: sl.notes || '',
})), null, 1));

const name = `${META.name}${process.env.BOTH_THEMES ? (THEME === 'light' ? '_светлая' : '_темная') : (THEME === 'light' ? '_светлая' : '')}`;
if (process.env.OUTFILE && !/\.pptx$/i.test(process.env.OUTFILE)) throw new Error('OUTFILE: только .pptx');
const file = process.env.OUTFILE || (ONLY ? path.join(OUT, `check_s${ONLY}.pptx`) : path.join(__dirname, '..', `${name}.pptx`));
// с нативными диаграммами книга данных пишется своя (формат, единицы, происхождение); без них — прежняя запись
(CHARTS.length ? require('./kit/charts.js').writePptx(pres, file, CHARTS) : pres.writeFile({ fileName: file })).then(f => console.log('ok', f, `${slides.length} слайдов, ${FACTS.length} фактов`));
