// Нативные диаграммы PowerPoint (по выбору): столбцы, линия, полосы. В PPTX — chart pptxgenjs с встроенной таблицей
// (ppt/embeddings/*.xlsx): «Изменить данные» в PowerPoint перестраивает столбцы и подписи. Связи с моделью нет:
// значения вставлены при сборке, происхождение записано в таблице под данными.
// HTML-двойник рисует ту же геометрию фигурами (элементы с twin: 'chart'): render.sh меряет подписи, PNG похожи на PPTX.
// В PPTX build.js кладёт только элемент { t: 'chart' }, двойниковые фигуры пропускает. opt.native === false — режим фигур.
// Режим фигур остаётся по умолчанию у barsTrend, slope и остальных графиков: nativeChart нужен там, где данные будут править в PowerPoint.
const L = require('../lib.js');
const { T, C, rect, oval, hline, text, tw, nb } = L;
const U = require('./util.js');
const { num, unitOf, seg } = U;

const FONT = T.font.regular;
const tones = () => [C.accent, C.bar, C.axis, C.muted];
const KINDS = { col: 'bar', bar: 'bar', line: 'line' };
const ok = v => typeof v === 'number' && Number.isFinite(v);   // пропуск (null, «нет данных») не рисуется и не регистрируется

// Формат числа Excel: разряды, знаки после запятой, единица литералом. Разделители показывает локаль PowerPoint.
function fmtCode(digits, unit) {
  const u = String(unit || '').replace(/[&<>"\\]/g, '');
  return `#,##0${digits ? '.' + '0'.repeat(digits) : ''}${u ? `"${u === '%' ? '%' : nb + u}"` : ''}`;
}
// Происхождение для таблицы: data.source строкой или описание src
function origin(src) {
  if (!src) return 'источник не указан';
  if (src.type === 'xlsx') return `модель${src.file ? ` ${src.file}` : ''}, лист «${src.sheet || '?'}», ячейки ${(src.cells || []).join(', ')}`;
  if (src.type === 'text') return `${src.file || 'текст'}${src.quote ? `: «${String(src.quote).slice(0, 120)}»` : ''}`;
  if (src.type === 'user') return `сообщение пользователя${src.date ? ` ${src.date}` : ''}${src.quote ? `: «${String(src.quote).slice(0, 120)}»` : ''}`;
  if (src.type === 'derived') return `расчёт из фактов: ${(src.from || []).join(', ')}`;
  return String(src.type || 'источник не указан');
}

// Столбцы, линия или полосы с нативной диаграммой в PPTX. Вопрос: «как меняется во времени?», «кто больше?»
// data: { type: 'col' | 'line' | 'bar', label, unit?, digits?, periods: [...] (или cats),
//         values: [...] | series: [{ name, values, src? }], src?, source?, highlight?: 'last' | 'max' | индекс | имя | false,
//         min?, max? (шкала), labels?: false (без подписей значений), unitOnLabels?: false (единица только в таблице) }
// opt: { src, native?: false (только фигуры), labelW? (полосы: ширина имён), gap? (зазор, % ширины столбца) }
// Каждое значение — факт «label период» (один ряд) или «label: ряд период»; подписи значений читаются на слайде.
function nativeChart(box, data, opt = {}) {
  const kind = data.type || 'col';
  if (!KINDS[kind]) throw new Error(`nativeChart: type ${kind} — только col, line или bar`);
  const cats = (data.periods || data.cats || []).map(String), d = data.digits || 0, lab = data.label || 'значение';
  const series = data.series || [{ name: lab, values: data.values }];
  if (!cats.length || series.some(s => !Array.isArray(s.values) || s.values.length !== cats.length))
    throw new Error(`nativeChart «${lab}»: у каждого ряда столько значений, сколько периодов (${cats.length})`);
  const multi = series.length > 1, n = cats.length, k = series.length, src0 = data.src || opt.src;
  const labels = data.labels !== false, uLab = data.unitOnLabels === false ? '' : unitOf(data.unit);
  // факты: каждое показанное значение со своим источником
  const shown = series.map(s => s.values.map((v, i) => !ok(v) ? null
    : num(multi ? `${lab}: ${s.name} ${cats[i]}` : `${lab} ${cats[i]}`, v, s.src || src0, d)));
  // цвета: несколько рядов — по ряду; один ряд — акцент у выделенной точки, остальные серые
  const vals0 = series[0].values, hl = multi || kind === 'line' ? -1
    : (h => h === false ? -1 : typeof h === 'number' ? h : typeof h === 'string' && h !== 'last' && h !== 'max' ? cats.indexOf(h)
      : h === 'max' || (h == null && kind === 'bar') ? vals0.indexOf(Math.max(...vals0.filter(ok))) : n - 1)(data.highlight);
  const sCol = multi ? series.map((_, j) => tones()[j % 4]) : [kind === 'line' ? C.accent : C.bar];
  const pCol = i => multi ? null : i === hl ? C.accent : C.bar;

  // шкала: столбцы и полосы от нуля, линия — с запасом от минимума
  const all = series.flatMap(s => s.values).filter(ok);
  if (!all.length) throw new Error(`nativeChart «${lab}»: нет ни одного значения`);
  const mn = Math.min(...all), mx = Math.max(...all);
  const lo = data.min ?? (kind === 'line' ? (mn >= 0 ? Math.max(0, mn - (mx - mn) * 0.35) : mn - (mx - mn) * 0.1) : Math.min(0, mn));
  const hi0 = data.max ?? (kind === 'line' ? mx + (mx - lo) * 0.04 : Math.max(0, mx));
  const hi = hi0 > lo ? hi0 : lo + 1;
  // область построения (inner): поля под легенду, подписи значений и категорий
  const legH = multi ? 0.42 : 0, { x, y, w, h } = box;
  const LW = kind === 'bar' ? (opt.labelW || Math.min(3, Math.max(1.2, ...cats.map(c => tw(c, 12) + 0.25)))) : 0;
  const VW = kind === 'bar' ? Math.max(0.9, ...shown.flat().filter(Boolean).map(s => tw(s + uLab, 12) + 0.2)) : 0;
  const P = kind === 'bar'
    ? { x: x + LW, y: y + legH + 0.05, w: w - LW - VW, h: h - legH - 0.1 }
    : { x: x + 0.1, y: y + legH + (labels ? 0.4 : 0.1), w: w - 0.2, h: h - legH - (labels ? 0.4 : 0.1) - 0.42 };
  const gap = opt.gap ?? (multi ? 60 : kind === 'col' ? 150 : 80);

  // ── двойник фигурами: те же формулы, что у PowerPoint (gapWidth в % ширины столбца, overlap 0) ──
  const els = [], tw0 = opt.native === false ? {} : { twin: 'chart' };
  const add = e => els.push({ ...e, ...tw0 });
  if (multi) {   // легенда сверху по центру, как legendPos 't'
    const items = series.map(s => tw(s.name, 11) + 0.32), tot = items.reduce((a, b) => a + b, 0) + 0.2 * (k - 1);
    let lx = x + (w - tot) / 2;
    series.forEach((s, j) => {
      add(rect(lx, y + 0.13, 0.14, 0.14, { fill: sCol[j] }));
      add(text(lx + 0.2, y + 0.04, items[j] - 0.12, 0.32, s.name, { size: 11, color: C.ink2, valign: 'middle' }));
      lx += items[j] + 0.2;
    });
  }
  if (kind === 'bar') {
    const ch = P.h / n, bh = ch / (k + gap / 100), px = v => P.x + (v - lo) / (hi - lo) * P.w;
    cats.forEach((c, i) => {
      add(text(x, P.y + i * ch, LW - 0.12, ch, c, { size: 12, color: C.ink2, align: 'right', valign: 'middle' }));
      series.forEach((s, j) => {
        const v = s.values[i]; if (!ok(v)) return;
        const by = P.y + i * ch + (ch - k * bh) / 2 + j * bh, a = px(Math.min(0, v)), b = px(Math.max(0, v));
        add(rect(a, by, Math.max(0.01, b - a), bh, { fill: multi ? sCol[j] : pCol(i) }));
        if (labels) add(v >= 0
          ? text(b + 0.06, by, VW - 0.06 + (P.x + P.w - b), bh, shown[j][i] + uLab, { size: 12, valign: 'middle' })
          : text(a - 1.46, by, 1.4, bh, shown[j][i] + uLab, { size: 12, align: 'right', valign: 'middle' }));
      });
    });
    add({ t: 'line', x: px(Math.max(lo, 0)), y: P.y, w: 0, h: P.h, color: C.axis, lw: 0.75 });
  } else {
    const cw = P.w / n, py = v => P.y + P.h - (v - lo) / (hi - lo) * P.h, base = py(Math.max(lo, Math.min(0, hi)));
    if (kind === 'col') {
      const bw = cw / (k + gap / 100);
      cats.forEach((c, i) => series.forEach((s, j) => {
        const v = s.values[i]; if (!ok(v)) return;
        const bx = P.x + i * cw + (cw - k * bw) / 2 + j * bw, t = py(Math.max(0, v)), b = py(Math.min(0, v));
        add(rect(bx, t, bw, Math.max(0.01, b - t), { fill: multi ? sCol[j] : pCol(i) }));
        const lw = Math.max(bw + 0.1, Math.min(cw, 1.6));
        if (labels) add(text(bx + bw / 2 - lw / 2, v >= 0 ? t - 0.32 : b + 0.03, lw, 0.28, shown[j][i] + uLab, { size: 12, align: 'center', valign: v >= 0 ? 'bottom' : 'top' }));
      }));
    } else {
      series.forEach((s, j) => {
        const pts = s.values.map((v, i) => !ok(v) ? null : [P.x + (i + 0.5) * cw, py(v)]);
        for (let i = 1; i < n; i++) if (pts[i - 1] && pts[i]) add(seg(...pts[i - 1], ...pts[i], { color: sCol[j], lw: 2.25 }));
        pts.forEach((p, i) => {
          if (!p) return;
          add(oval(p[0], p[1], 0.1, { fill: sCol[j] }));
          if (labels) add(text(p[0] - Math.min(cw, 1.6) / 2, p[1] - 0.38, Math.min(cw, 1.6), 0.28, shown[j][i] + uLab, { size: 12, align: 'center', valign: 'bottom' }));
        });
      });
    }
    cats.forEach((c, i) => add(text(P.x + i * cw, P.y + P.h + 0.08, cw, 0.28, c, { size: 10, color: C.muted, align: 'center', valign: 'middle' })));
    add(hline(P.x, P.x + P.w, base, { color: C.axis, lw: 0.75 }));
  }
  if (opt.native === false) return els;

  // ── нативная диаграмма: опции pptxgenjs и содержимое встроенной таблицы ──
  const fr = { x: (P.x - x) / w, y: (P.y - y) / h, w: P.w / w, h: P.h / h };
  const code = fmtCode(d, data.unit), lcode = fmtCode(d, data.unitOnLabels === false ? '' : data.unit);
  const opts = {
    layout: fr, barDir: kind === 'bar' ? 'bar' : 'col', barGrouping: 'clustered', barGapWidthPct: gap,
    catAxisOrientation: kind === 'bar' ? 'maxMin' : 'minMax',
    chartColors: multi || kind === 'line' ? sCol : cats.map((_, i) => pCol(i)),
    valAxisHidden: true, valAxisMinVal: lo, valAxisMaxVal: hi, valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
    catAxisLabelColor: kind === 'bar' ? C.ink2 : C.muted, catAxisLabelFontFace: FONT, catAxisLabelFontSize: kind === 'bar' ? 12 : 10,
    catAxisLineShow: kind !== 'bar', catAxisLineColor: C.axis, catAxisLineSize: 0.75, catAxisMajorTickMark: 'none', catAxisLabelPos: 'low',
    showValue: labels, dataLabelPosition: kind === 'line' ? 't' : 'outEnd', dataLabelColor: C.ink, dataLabelFontFace: FONT, dataLabelFontSize: 12,
    dataLabelFormatCode: lcode, valLabelFormatCode: code,
    showLegend: multi, legendPos: 't', legendFontFace: FONT, legendFontSize: 11, legendColor: C.ink2,
    valAxisLabelFontFace: FONT, chartArea: { roundedCorners: false }, displayBlanksAs: 'gap',   // пропуск — разрыв линии, как в двойнике
    showTitle: false, shadow: null, lineSize: 2.25,   // у столбцов толщина не рисуется; 0 сбросил бы цвета точек (dPt)
    lineDataSymbol: 'circle', lineDataSymbolSize: 7, lineDataSymbolLineColor: sCol[0],
    altText: `${lab}${data.unit ? `, ${data.unit}` : ''}: ${cats.join(', ')}`,
  };
  if (kind === 'bar') opts.valAxisLineShow = false;
  const chart = {
    t: 'chart', x, y, w, h, type: KINDS[kind], kind, opts,
    data: series.map(s => ({ name: s.name, labels: cats, values: s.values.map(v => ok(v) ? v : null) })),
    // встроенная таблица: категории, ряды, значения в формате с единицей, под ними показатель, единицы и происхождение
    sheet: {
      cats, series: series.map(s => ({ name: s.name, values: s.values.map(v => ok(v) ? v : null) })), code,
      note: [['Показатель', lab], ['Единицы', data.unit || 'без единиц'],
        ['Источник', data.source || [...new Set(series.map(s => origin(s.src || src0)))].join('; ')],
        ['Связь', 'значения вставлены при сборке деки, связи с моделью нет: правьте здесь или в источнике и пересоберите']],
    },
  };
  return [chart, ...els];
}

// ── встроенная книга: Sheet1 в раскладке pptxgenjs (A — категории, B… — ряды), ссылки диаграммы не меняются ──
const xe = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const col = i => { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
async function workbook(sh) {
  const JSZip = require('jszip'), z = new JSZip(), strs = [], si = s => { const k = strs.indexOf(s); return k >= 0 ? k : strs.push(s) - 1; };
  const rows = [], cell = (r, c, v, style) => {
    if (v == null || v === '') return '';
    return typeof v === 'number' ? `<c r="${col(c)}${r}"${style ? ` s="${style}"` : ''}><v>${v}</v></c>` : `<c r="${col(c)}${r}" t="s"${style ? ` s="${style}"` : ''}><v>${si(String(v))}</v></c>`;
  };
  rows.push(`<row r="1">${cell(1, 0, '')}${sh.series.map((s, j) => cell(1, j + 1, s.name, 2)).join('')}</row>`);
  sh.cats.forEach((c, i) => rows.push(`<row r="${i + 2}">${cell(i + 2, 0, c)}${sh.series.map((s, j) => cell(i + 2, j + 1, s.values[i], 1)).join('')}</row>`));
  sh.note.forEach(([a, b], q) => { const r = sh.cats.length + 3 + q; rows.push(`<row r="${r}">${cell(r, 0, a, 2)}${cell(r, 1, b)}</row>`); });
  const last = `${col(sh.series.length)}${sh.cats.length + 2 + sh.note.length}`;
  const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  z.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>');
  z.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  z.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook ${NS} xmlns:r="${R}"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  z.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${R}/styles" Target="styles.xml"/><Relationship Id="rId3" Type="${R}/sharedStrings" Target="sharedStrings.xml"/></Relationships>`);
  z.file('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet ${NS}><numFmts count="1"><numFmt numFmtId="164" formatCode="${xe(sh.code)}"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
  z.file('xl/sharedStrings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst ${NS} count="${strs.length}" uniqueCount="${strs.length}">${strs.map(s => `<si><t xml:space="preserve">${xe(s)}</t></si>`).join('')}</sst>`);
  z.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet ${NS}><dimension ref="A1:${last}"/><cols><col min="1" max="1" width="24" customWidth="1"/><col min="2" max="${Math.max(2, sh.series.length + 1)}" width="16" customWidth="1"/></cols><sheetData>${rows.join('')}</sheetData></worksheet>`);
  return z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// Запись PPTX с диаграммами: pptxgenjs кладёт книгу без формата и происхождения (и теряет нули), её заменяем своей.
// charts — элементы { t: 'chart' } в порядке addChart: у pptxgenjs chartN.xml ↔ Microsoft_Excel_WorksheetN.xlsx.
async function writePptx(pres, file, charts) {
  const JSZip = require('jszip'), fs = require('fs');
  const z = await JSZip.loadAsync(await pres.write({ outputType: 'nodebuffer' }));
  const emb = Object.keys(z.files).filter(f => /^ppt\/embeddings\/Microsoft_Excel_Worksheet\d+\.xlsx$/.test(f))
    .sort((a, b) => +a.match(/(\d+)\.xlsx$/)[1] - +b.match(/(\d+)\.xlsx$/)[1]);
  if (emb.length !== charts.length) throw new Error(`nativeChart: ${charts.length} диаграмм, ${emb.length} встроенных таблиц`);
  for (let i = 0; i < emb.length; i++) z.file(emb[i], await workbook(charts[i].sheet));
  fs.writeFileSync(file, await z.generateAsync({ type: 'nodebuffer', compression: 'STORE' }));
  return file;
}

module.exports = { nativeChart };
// служебное для build.js: неперечисляемое, чтобы components.js не принял его за компонент
Object.defineProperty(module.exports, 'writePptx', { value: writePptx, enumerable: false });
