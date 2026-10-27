# Варианты компонентов по смыслу и форме данных (reference/18-variants.md): 2–3 пригодных кандидата на слайд,
# показ на том же содержании в обеих темах и запись выбора.
#   variants.py suggest <src> [--content файл.json] [--slides 4,6,9]   кандидаты: что есть в данных, чего нет, лимиты, кто исключён и почему
#   variants.py demo    <src> [--run <id>] [--slides …] [--all]          галерея вариантов: out/variants/<id>/sheet-s<N>.png, тёмная и светлая
#   variants.py pick    <src> --slide N --variant B [--run <id>] [--why …]  выбор → data/variants.json и готовый вызов out/variants/<id>/pick-s<N>.js
#   variants.py check                                                     components/fields.json сходится с библиотекой и галереями
# --lib skill: пробный вызов и показ на библиотеке навыка, а не деки — что даст обновление на том же содержании.
# Содержание слайдов снимается со slides.js (вызовы K.* без сборки PPTX) или берётся из --content (этап 0, slides.js ещё нет).
# Каждый suggest — новый прогон out/variants/<id>/ с замороженным содержанием; demo по готовому прогону пишет новый прогон
# и прошлые не трогает. Выдуманных полей нет: чего нет в данных, то «не заполнено» или причина исключения.
# Запуск: $SKILL/.venv/bin/python -I variants.py …   Код 1 — ошибка входа, сборки или check.
import argparse
import datetime as dt
import glob
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIELDS = {k: v for k, v in json.load(open(os.path.join(SKILL, 'components', 'fields.json'), encoding='utf-8')).items() if k != '_'}

# теги смысла по форме данных: первый — главный вопрос, если его не задал --content
SHAPE_MEANING = {'matrix': 'compare-options', 'steps': 'process', 'ranked': 'ranking', 'series': 'trend', 'pair': 'change',
                 'kpis': 'kpis', 'parts': 'share', 'terms': 'definitions', 'qa': 'faq', 'points': 'takeaways', 'hub': 'roles',
                 'layers': 'structure'}


class Skip(Exception):
    """Компонент не подходит к данным: причина идёт в «исключены»."""


def nfmt(v, d=None):
    if d is None:
        d = 0 if float(v).is_integer() else min(2, len(str(v).split('.')[-1]))
    return f'{v:,.{d}f}'.replace(',', ' ').replace('.', ',')


def has(o, k):
    return isinstance(o, dict) and o.get(k) is not None


def keep(o, *keys, **ren):
    # копия присутствующих полей; ren: новое_имя='старое'
    r = {k: o[k] for k in keys if has(o, k)}
    r.update({n: o[s] for n, s in ren.items() if has(o, s)})
    return r


def srcopt(c, **extra):
    o = {'src': c['src']} if c.get('src') else {}
    o.update({k: v for k, v in extra.items() if v is not None})
    return o


# ───────── компонент → форма данных (снятие содержания со slides.js) ─────────
def f_table(d, o):
    cols = d.get('cols') or []
    name = next((c for c in cols if c.get('key') == 'name'), None)
    rest = [c for c in cols if c is not name]
    rows = d.get('rows') or []
    if name and len(rest) == 1 and rest[0].get('type') in ('num', 'bar') and all(isinstance(r.get(rest[0]['key']), (int, float)) for r in rows):
        k = rest[0]
        return 'ranked', {'items': [{'name': r['name'], 'value': r[k['key']], **keep(r, 'src', 'prev', 'us'), **({'accent': True} if r.get('lead') else {})} for r in rows],
                          **keep(k, 'unit', 'digits', label='label'), **({'nameHead': name['label']} if name.get('label') else {})}
    if name and rest and all(c.get('type', 'text') == 'text' for c in rest):
        return 'matrix', {'options': [{'name': c.get('label', c['key'])} for c in rest],
                          'rows': [{'name': r['name'], 'values': [r.get(c['key']) for c in rest]} for r in rows],
                          **({'rowHead': name['label']} if name.get('label') else {})}
    raise Skip('таблица со смешанными столбцами: форма данных не распознана')


FROM = {
    'comparison': lambda d, o: ('matrix', {'options': d['options'], 'rows': d['rows']}),
    'pricingTiers': lambda d, o: ('matrix', {'options': d['tiers'], 'rows': d['features'], **keep(d, 'unit')}),
    'featureDots': lambda d, o: ('matrix', {'options': d['segments'], 'rows': d['features']}),
    'decisionOptions': lambda d, o: ('matrix', {'options': d['options'], 'rows': [], **keep(d, 'ask')}),
    'heatmap': lambda d, o: ('matrix', {'options': [{'name': c} for c in d['cols']], 'rows': [{'name': r, 'values': v} for r, v in zip(d['rows'], d['values'])], **keep(d, 'label', 'digits')}),
    'tableEditorial': f_table,
    'processSteps': lambda d, o: ('steps', {'steps': [{'name': s['head'], **keep(s, 'object', 'src', note='body')} for s in d['steps']]}),
    'journeyMap': lambda d, o: ('steps', {'steps': [keep(s, 'name', 'note', 'mood', 'pain', 'src') for s in d['stages']]}),
    'milestonesVertical': lambda d, o: ('steps', {'steps': [{'name': s['title'], **keep(s, 'note', 'date', 'value', 'unit', 'caption', 'digits', 'src')} for s in d['items']], **keep(d, 'current')}),
    'phaseGate': lambda d, o: ('steps', {'steps': [{**keep(p, 'name', 'note', date='period'), **({'criteria': d['gates'][i].get('criteria', []), 'gate': d['gates'][i]['name']} if i < len(d.get('gates', [])) else {})} for i, p in enumerate(d['phases'])], **keep(d, 'current')}),
    'phoneFlow': lambda d, o: ('steps', {'steps': [{'name': s['head'], **keep(s, 'screen', note='body')} for s in d['steps']]}),
    'nextStepsText': lambda d, o: ('steps', {'steps': [{'name': s['action'], **keep(s, 'note', 'due', 'owner', 'role')} for s in d['steps']]}),
    'storyArc': lambda d, o: ('steps', {'steps': [{'name': s['lead'], 'note': s['t']} for s in d['steps']]}),
    'rankingList': lambda d, o: ('ranked', {'items': d['rows'], **keep(d, 'unit', 'label', 'digits', 'nameHead')}),
    'usageRanking': lambda d, o: ('ranked', {'items': [{**i, **({'accent': True} if i['name'] in (d.get('highlight') or []) else {})} for i in d['items']], 'unit': '%', **keep(d, 'label', 'digits', nameHead='head')}),
    'treemap': lambda d, o: ('parts', {'parts': d['items'], 'whole': True, **keep(d, 'unit', 'label', 'digits')}),
    'stackedShare': lambda d, o: ('parts', {'parts': d['parts'], 'whole': True, **keep(d, 'unit', 'label', 'digits')}),
    'barsTrend': lambda d, o: ('series', {'periods': d['periods'], 'series': [{'name': d.get('label', ''), 'values': d['values']}], **keep(d, 'label', 'unit', 'digits')}),
    'lineChart': lambda d, o: ('series', keep(d, 'periods', 'series', 'unit', 'label', 'digits')),
    'pairedColumns': lambda d, o: ('series', {'periods': d['periods'], 'series': [d['prev'], d['cur']], **keep(d, 'unit', 'label', 'digits')}),
    'kpiHero': lambda d, o: ('series', {'periods': d['series']['periods'], 'series': [{'name': d.get('label', ''), 'values': d['series']['values']}], **keep(d, 'unit', 'label', 'digits')})
    if d.get('series') else ('kpis', {'items': [keep(d, 'value', 'unit', 'label', 'caption', 'digits', 'src')]}),
    'kpiList': lambda d, o: ('kpis', {'items': d['items']}),
    'nativeChart': lambda d, o: ('ranked', {'items': [{'name': n, 'value': v} for n, v in zip(d['cats'], d['values'])], **keep(d, 'unit', 'label', 'digits')})
    if d.get('cats') and d.get('values') else ('series', {'periods': d['periods'], 'series': d.get('series') or [{'name': d.get('label', ''), 'values': d['values']}], **keep(d, 'unit', 'label', 'digits')}),
    'kpiGrid': lambda d, o: ('kpis', {'items': d['items']}),
    'beforeAfter': lambda d, o: ('pair', {'from': d['before'].get('head', ''), 'to': d['after'].get('head', ''), 'notes': {'a': d['before'].get('note', ''), 'b': d['after'].get('note', '')}, 'metrics': d['metrics']}),
    'bigCompare': lambda d, o: ('pair', {'from': d['before']['when'], 'to': d['after']['when'], **keep(d, 'mode', 'note'),
                                         'metrics': [{'name': d.get('label', ''), 'a': d['before']['value'], 'b': d['after']['value'], **keep(d, 'better', 'digits', 'src'),
                                                      **keep(d['before'], 'unit'), **({'caption_a': d['before']['caption']} if d['before'].get('caption') else {}),
                                                      **({'caption_b': d['after']['caption']} if d['after'].get('caption') else {})}]}),
    'dumbbell': lambda d, o: ('pair', {'from': d['from'], 'to': d['to'], 'label': d.get('label', ''), 'metrics': [{**r, **keep(d, 'unit')} for r in d['rows']]}),
    'slope': lambda d, o: ('pair', {'from': d['left'], 'to': d['right'], 'label': d.get('label', ''), 'metrics': [{**r, **keep(d, 'unit')} for r in d['items']]}),
    'glossary': lambda d, o: ('terms', {'items': d['items']}),
    'faqPairs': lambda d, o: ('qa', {'items': d['items']}),
    'keyTakeaways': lambda d, o: ('points', {'items': d['items'], **keep(d, 'lead', 'accent')}),
    'principles': lambda d, o: ('points', {'items': [{'head': i['name'], **keep(i, 'd', 'accent')} for i in d['items']]}),
    'executiveSummary': lambda d, o: ('points', {'items': d['items']}),
    'hubDiagram': lambda d, o: ('hub', {'center': d['center'], 'nodes': d['nodes']}),
    'hubSpoke': lambda d, o: ('hub', {'center': d['center'], 'nodes': [{**keep(n, 'name', 'items'), **({'edge': n['tag']} if n.get('tag') else {}),
                                                                         **({'link': 'dashed'} if n.get('kind') == 'dashed' else {})} for n in d['nodes']]}),
    'systemsLayers': lambda d, o: ('layers', {'groups': [{**keep(l, 'name', 'note'), 'items': l['systems']} for l in d['layers']], **keep(d, 'links')}),
    'nowNextLater': lambda d, o: ('layers', {'groups': [{'name': c['head'], 'items': [{'name': i['t'], **keep(i, note='d')} for i in c['items']]} for c in d['cols']]}),
}


# ───────── форма данных → компонент ─────────
def yesno(v):
    return 'да' if v is True else 'нет' if v is False else v


def t_matrix_table(c):
    opts, rows = c['options'], c['rows']
    num = [all(isinstance(r['values'][j], (int, float)) and not isinstance(r['values'][j], bool) for r in rows) for j in range(len(opts))]
    cols = [{'key': 'name', 'label': c.get('rowHead', ''), 'w': 3.2}] + [
        {'key': f'o{j}', 'label': o['name'], 'type': 'num' if num[j] else 'text', 'w': 8.5 / len(opts), **keep(c, 'digits')} for j, o in enumerate(opts)]
    rec = next((j for j, o in enumerate(opts) if o.get('recommended')), None)
    return {'cols': cols, 'rows': [{'name': r['name'], **{f'o{j}': yesno(v) for j, v in enumerate(r['values'])}} for r in rows],
            **({'highlight': f'o{rec}'} if rec is not None else {})}, srcopt(c)


def t_featuredots(c):
    if not all(isinstance(v, int) and not isinstance(v, bool) and 0 <= v <= 3 for r in c['rows'] for v in r['values']):
        raise Skip('значения — текст или да/нет, а компонент рисует уровни 0–3: перевод в уровни был бы выдумкой')
    return {'segments': [keep(o, 'name', 'note') for o in c['options']], 'features': [keep(r, 'name', 'note', 'values') for r in c['rows']]}, srcopt(c)


def t_heatmap(c):
    if not all(isinstance(v, (int, float)) and not isinstance(v, bool) for r in c['rows'] for v in r['values']):
        raise Skip('в ячейках текст: тепловой карте нужны числа')
    return {'rows': [r['name'] for r in c['rows']], 'cols': [o['name'] for o in c['options']], 'values': [r['values'] for r in c['rows']], **keep(c, 'label', 'digits')}, srcopt(c)


def t_decision(c):
    miss = [k for k in ('cost', 'time', 'pros', 'cons') if not all(has(o, k) for o in c['options'])]
    if miss or not c.get('ask'):
        raise Skip('нет ' + ', '.join(f'options[].{k}' for k in miss) + ('' if c.get('ask') else ', ask') + ' — стоимость, срок, плюсы и минусы вариантов и просьба')
    return {'options': c['options'], 'ask': c['ask']}, srcopt(c)


def need_all(c, key, what):
    if not all(has(s, key) for s in c['steps']):
        raise Skip(f'нет steps[].{key} ({what})')


def t_milestones(c):
    need_all(c, 'date', 'даты этапов')
    return {**keep(c, 'current'), 'items': [{'title': s['name'], **keep(s, 'date', 'note', 'value', 'unit', 'caption', 'digits', 'src')} for s in c['steps']]}, srcopt(c)


def t_phasegate(c):
    st = c['steps']
    if not all(s.get('criteria') for s in st[:-1]):
        raise Skip('нет steps[].criteria — критериев перехода между этапами; воротам нечего показать')
    return {**keep(c, 'current'), 'phases': [keep(s, 'name', 'note', period='date') for s in st],
            'gates': [{'name': s.get('gate') or f'Переход к этапу «{st[i + 1]["name"]}»', 'criteria': s['criteria']} for i, s in enumerate(st[:-1])]}, srcopt(c)


def t_phoneflow(c):
    need_all(c, 'screen', 'экраны продукта в img/screens/')
    return {'steps': [{'screen': s['screen'], 'head': s['name'], **keep(s, body='note')} for s in c['steps']]}, srcopt(c)


def t_nextsteps(c):
    need_all(c, 'due', 'сроки')
    need_all(c, 'owner', 'ответственные')
    return {'steps': [{'action': s['name'], **keep(s, 'note', 'due', 'owner', 'role')} for s in c['steps']]}, srcopt(c)


def t_storyarc(c):
    if not all(s.get('note') for s in c['steps']):
        raise Skip('нет steps[].note — текста под каждым шагом')
    return {'steps': [{'lead': s['name'], 't': s['note']} for s in c['steps']]}, srcopt(c)


def t_rank_table(c):
    cols = [{'key': 'name', 'label': c.get('nameHead', ''), 'w': 4.0},
            {'key': 'value', 'label': c.get('label', 'значение'), 'type': 'bar', 'w': 6.0, **keep(c, 'unit', 'digits')}]
    if all(has(i, 'prev') for i in c['items']):
        cols.append({'key': 'prev', 'label': 'Место раньше', 'type': 'num', 'w': 1.6})
    return {'cols': cols, 'rows': [{'name': i['name'], 'value': i['value'], **keep(i, 'prev', 'src'), **({'lead': True} if i.get('accent') or i.get('us') else {})} for i in c['items']]}, srcopt(c)


def t_usage(c):
    vals = [i['value'] for i in c['items']]
    if c.get('unit') not in ('%', None) or not all(0 <= v <= 100 for v in vals):
        raise Skip(f'значения не доли в процентах (единица «{c.get("unit", "")}»): шкала 0–100 исказит')
    lab = c.get('label', 'доля')
    return {'label': lab if '%' in lab else f'{lab}, %', **keep(c, 'digits', head='nameHead'), 'items': [keep(i, 'name', 'value', 'src') for i in c['items']],
            'highlight': [i['name'] for i in c['items'] if i.get('accent') or i.get('us')]}, srcopt(c)


def whole(c, key):
    if not c.get('whole'):
        s = sum(i['value'] for i in c[key])
        raise Skip(f'части не составляют целое (сумма {nfmt(s, c.get("digits"))}{" " + c["unit"] if c.get("unit") else ""}), остаток неизвестен — «Прочие» не выдумываем')


def t_treemap(c, key='items'):
    whole(c, key)
    return {**keep(c, 'label', 'unit', 'digits'), 'items': [keep(i, 'name', 'value', 'src') for i in c[key]]}, srcopt(c)


def t_stacked(c, key='items'):
    whole(c, key)
    return {**keep(c, 'label', 'unit', 'digits'), 'parts': [keep(i, 'name', 'value', 'src') for i in c[key]]}, srcopt(c)


def t_rank_kpis(c):
    return {'items': [{'value': i['value'], 'label': i['name'], 'caption': f'{c.get("label", "")} {i["name"]}'.strip(), **keep(i, 'src'), **keep(c, 'unit', 'digits')} for i in c['items']]}, srcopt(c)


def t_dotplot(c):
    if not all(has(i, 'avg') and has(i, 'others') for i in c['items']):
        raise Skip('нет items[].avg и items[].others — среднего по рынку и значений других игроков')
    return {**keep(c, 'label', 'unit', 'digits'), 'rows': [keep(i, 'name', 'avg', 'others', us='value') for i in c['items']]}, srcopt(c)


def one_series(c):
    if len(c['series']) != 1:
        raise Skip(f'рядов {len(c["series"])}: компонент рисует один ряд')
    return c['series'][0]


def t_bars(c):
    s = one_series(c)
    return {**keep(c, 'label', 'digits'), 'periods': c['periods'], 'values': s['values']}, srcopt(c)


def t_line(c):
    if len(c['series']) < 2:
        raise Skip('один ряд: линейный график сравнивает 2–4 ряда, для одного — столбики')
    return keep(c, 'label', 'unit', 'digits', 'periods', 'series'), srcopt(c)


def t_hero_series(c):
    s = one_series(c)
    lab = c.get('label') or s.get('name', '')
    return {'value': s['values'][-1], **keep(c, 'unit', 'digits'), 'label': lab, 'caption': f'{lab}, {c["periods"][len(s["values"]) - 1]}',
            'series': {'periods': c['periods'], 'values': s['values']}}, srcopt(c)


def t_paired(c):
    if len(c['series']) != 2:
        raise Skip(f'рядов {len(c["series"])}: компонент сравнивает ровно два (прошлый и текущий)')
    return {**keep(c, 'label', 'unit', 'digits'), 'periods': c['periods'], 'prev': c['series'][0], 'cur': c['series'][1]}, srcopt(c)


def two_periods(c):
    if len(c['periods']) != 2:
        raise Skip(f'периодов {len(c["periods"])}: компонент сравнивает две точки')


def t_slope_series(c):
    two_periods(c)
    return {'left': c['periods'][0], 'right': c['periods'][1], **keep(c, 'label'), 'items': [{'name': s['name'], 'a': s['values'][0], 'b': s['values'][1]} for s in c['series']]}, srcopt(c)


def t_dumbbell_series(c):
    two_periods(c)
    return {**keep(c, 'label', 'unit'), 'from': c['periods'][0], 'to': c['periods'][1], 'rows': [{'name': s['name'], 'a': s['values'][0], 'b': s['values'][1]} for s in c['series']]}, srcopt(c)


def t_before_after(c):
    n = c.get('notes') or {}
    return {'before': {'head': c['from'], **({'note': n['a']} if n.get('a') else {})}, 'after': {'head': c['to'], **({'note': n['b']} if n.get('b') else {})},
            'metrics': [keep(m, 'name', 'a', 'b', 'unit', 'better', 'digits', 'src') for m in c['metrics']]}, srcopt(c)


def t_bigcompare(c):
    if len(c['metrics']) != 1:
        raise Skip(f'метрик {len(c["metrics"])}: крупное сравнение показывает одну — остальные пропали бы со слайда')
    m = c['metrics'][0]
    mode = c.get('mode') or ('diff' if m.get('unit') in ('%', 'п.п.') or m['a'] <= 0 or m['b'] <= 0 else 'ratio')
    side = lambda w, v, cap: {'when': w, 'value': v, **keep(m, 'unit'), **({'caption': cap} if cap else {})}
    return {'label': m['name'], 'mode': mode, **keep(m, 'better', 'digits'), **keep(c, 'note'),
            'before': side(c['from'], m['a'], m.get('caption_a')), 'after': side(c['to'], m['b'], m.get('caption_b'))}, srcopt(c, src=m.get('src') or c.get('src'))


def same_unit(c):
    us = sorted({m.get('unit', '') for m in c['metrics']})
    if len(us) > 1:
        raise Skip(f'у метрик разные единицы ({", ".join(u or "без единицы" for u in us)}) — общая шкала исказит')
    return us[0]


def t_dumbbell_pair(c):
    u = same_unit(c)
    return {'label': c.get('label', ''), 'from': c['from'], 'to': c['to'], **({'unit': u} if u else {}), 'rows': [keep(m, 'name', 'a', 'b', 'src') for m in c['metrics']]}, srcopt(c)


def t_slope_pair(c):
    same_unit(c)
    return {'left': c['from'], 'right': c['to'], 'label': c.get('label', ''), 'items': [keep(m, 'name', 'a', 'b', 'src') for m in c['metrics']]}, srcopt(c)


def t_kpigrid_pair(c):
    return {'vs': f'к {c["from"]}', 'items': [{'label': m['name'] + (f', {m["unit"]}' if m.get('unit') and m['unit'] != '%' else ''), 'value': m['b'], 'prev': m['a'],
                                              **keep(m, 'better', 'digits', 'src'), **({'unit': '%'} if m.get('unit') == '%' else {})} for m in c['metrics']]}, srcopt(c)


def t_pair_table(c):
    cols = [{'key': 'name', 'label': c.get('label', ''), 'w': 4.0}, {'key': 'a', 'label': str(c['from']), 'type': 'num', 'w': 2.2},
            {'key': 'b', 'label': str(c['to']), 'type': 'num', 'w': 2.2, 'digits': max((m.get('digits', 0) for m in c['metrics']), default=0)}]
    cols[1]['digits'] = cols[2]['digits']
    return {'cols': cols, 'rows': [{'name': m['name'] + (f', {m["unit"]}' if m.get('unit') else ''), 'a': m['a'], 'b': m['b'], **keep(m, 'src')} for m in c['metrics']], 'highlight': 'b'}, srcopt(c)


def t_kpilist(c):
    return {'items': [keep(i, 'value', 'unit', 'label', 'caption', 'digits', 'src') for i in c['items']]}, srcopt(c)


def t_kpihero(c):
    if len(c['items']) != 1:
        raise Skip(f'чисел {len(c["items"])}: главное одно, выбор главного — решение автора, а не подбора')
    return keep(c['items'][0], 'value', 'unit', 'label', 'caption', 'digits', 'src'), srcopt(c)


def t_exec_kpis(c):
    if not all(i.get('caption') for i in c['items']):
        raise Skip('нет items[].caption — пояснения к каждому числу')
    return {'items': [{**keep(i, 'value', 'unit', 'digits', 'label', 'src'), 'head': i['label'], 'd': i['caption']} for i in c['items']]}, srcopt(c)


def t_kpigrid(c):
    if not all(has(i, 'prev') for i in c['items']):
        raise Skip('нет items[].prev — прошлого значения для сравнения')
    return {'items': [keep(i, 'label', 'value', 'prev', 'unit', 'digits', 'better', 'series', 'src') for i in c['items']]}, srcopt(c)


def t_picto(c):
    if len(c['parts']) != 1 or c.get('unit') != '%':
        raise Skip('нужна одна доля в процентах')
    p = c['parts'][0]
    return {'value': p['value'], 'label': p['name'], **keep(c, caption='label')}, srcopt(c)


def t_native_series(c):
    if not c['series'] or len(c['series']) > 4:
        raise Skip(f'рядов {len(c["series"])}: диаграмма читается при 1–4 рядах')
    one = len(c['series']) == 1
    return {'type': 'col' if one or len(c['periods']) <= 4 else 'line', **keep(c, 'label', 'unit', 'digits'), 'periods': c['periods'],
            **({'values': c['series'][0]['values']} if one else {'series': [keep(s, 'name', 'values', 'src') for s in c['series']]})}, srcopt(c)


def t_native_ranked(c):
    return {'type': 'bar', **keep(c, 'label', 'unit', 'digits'), 'cats': [i['name'] for i in c['items']], 'values': [i['value'] for i in c['items']]}, srcopt(c)


def t_hub(c):
    if not c.get('center'):
        raise Skip('нет центра схемы (center): кто в середине связей — решение автора')
    return {'center': c['center'], 'nodes': c['nodes']}, srcopt(c)


def t_hub_layers(c):
    raise Skip('нет центра схемы (center): у групп нет общего узла')


def t_nnl(c):
    if len(c['groups']) != 3:
        raise Skip(f'групп {len(c["groups"])}: раскладка ровно на три колонки')
    return {'cols': [{'head': g['name'], 'items': [{'t': i['name'], **keep(i, d='note')} for i in g['items']]} for g in c['groups']]}, srcopt(c)


def t_layers(c):
    return {'cols': max(len(g['items']) for g in c['groups']), 'layers': [{**keep(g, 'name', 'note'), 'systems': [keep(i, 'name', 'note', 'isNew') for i in g['items']]} for g in c['groups']],
            'links': c.get('links', [])}, srcopt(c)


def text_items(c, head='head', d='d'):
    return [{'name': i[head], 'd': i[d], **keep(i, 'accent')} for i in c['items']]


TO = {
    ('matrix', 'comparison'): lambda c: ({'options': [keep(o, 'name', 'note', 'recommended') for o in c['options']], 'rows': [keep(r, 'name', 'values') for r in c['rows']]}, srcopt(c)),
    ('matrix', 'tableEditorial'): t_matrix_table,
    ('matrix', 'pricingTiers'): lambda c: ({**keep(c, 'unit'), 'tiers': [keep(o, 'name', 'price', 'digits', 'note', 'recommended', 'src') for o in c['options']],
                                            'features': [keep(r, 'name', 'values', 'unit', 'prefix') for r in c['rows']]}, srcopt(c)),
    ('matrix', 'featureDots'): t_featuredots,
    ('matrix', 'heatmap'): t_heatmap,
    ('matrix', 'decisionOptions'): t_decision,
    ('steps', 'processSteps'): lambda c: ({'steps': [{'head': s['name'], 'body': s.get('note', ''), **keep(s, 'object')} for s in c['steps']]}, srcopt(c)),
    ('steps', 'journeyMap'): lambda c: ({'stages': [keep(s, 'name', 'note', 'mood', 'pain', 'src') for s in c['steps']]}, srcopt(c)),
    ('steps', 'milestonesVertical'): t_milestones,
    ('steps', 'phaseGate'): t_phasegate,
    ('steps', 'phoneFlow'): t_phoneflow,
    ('steps', 'nextStepsText'): t_nextsteps,
    ('steps', 'storyArc'): t_storyarc,
    ('steps', 'executiveSummary'): lambda c: ({'items': [{'head': s['name'], 'd': s.get('note', '')} for s in c['steps']]}, srcopt(c)),
    ('steps', 'principles'): lambda c: ({'items': [{'name': s['name'], 'd': s.get('note', '')} for s in c['steps']]}, srcopt(c)),
    ('ranked', 'rankingList'): lambda c: ({**keep(c, 'label', 'unit', 'digits', 'nameHead'), 'rows': [{**keep(i, 'name', 'value', 'prev', 'src'), **({'us': True} if i.get('us') else {})} for i in c['items']]}, srcopt(c)),
    ('ranked', 'tableEditorial'): t_rank_table,
    ('ranked', 'usageRanking'): t_usage,
    ('ranked', 'treemap'): t_treemap,
    ('ranked', 'stackedShare'): t_stacked,
    ('ranked', 'kpiList'): t_rank_kpis,
    ('ranked', 'dotPlot'): t_dotplot,
    ('series', 'barsTrend'): t_bars,
    ('series', 'lineChart'): t_line,
    ('series', 'kpiHero'): t_hero_series,
    ('series', 'pairedColumns'): t_paired,
    ('series', 'slope'): t_slope_series,
    ('series', 'dumbbell'): t_dumbbell_series,
    ('series', 'nativeChart'): t_native_series,
    ('ranked', 'nativeChart'): t_native_ranked,
    ('pair', 'beforeAfter'): t_before_after,
    ('pair', 'bigCompare'): t_bigcompare,
    ('pair', 'dumbbell'): t_dumbbell_pair,
    ('pair', 'slope'): t_slope_pair,
    ('pair', 'kpiGrid'): t_kpigrid_pair,
    ('pair', 'tableEditorial'): t_pair_table,
    ('kpis', 'kpiList'): t_kpilist,
    ('kpis', 'kpiHero'): t_kpihero,
    ('kpis', 'executiveSummary'): t_exec_kpis,
    ('kpis', 'kpiGrid'): t_kpigrid,
    ('parts', 'stackedShare'): lambda c: t_stacked(c, 'parts'),
    ('parts', 'treemap'): lambda c: t_treemap(c, 'parts'),
    ('parts', 'pictoGrid'): t_picto,
    ('terms', 'glossary'): lambda c: ({'items': [keep(i, 'term', 'd', 'accent') for i in c['items']]}, srcopt(c)),
    ('terms', 'principles'): lambda c: ({'items': text_items(c, 'term')}, srcopt(c)),
    ('qa', 'faqPairs'): lambda c: ({'items': c['items']}, srcopt(c)),
    ('points', 'keyTakeaways'): lambda c: ({**keep(c, 'lead', 'accent'), 'items': c['items']}, srcopt(c)),
    ('points', 'principles'): lambda c: ({'items': text_items(c)}, srcopt(c)),
    ('points', 'executiveSummary'): lambda c: ({'items': c['items']}, srcopt(c)),
    ('points', 'storyArc'): lambda c: ({'steps': [{'lead': i['head'], 't': i['d']} for i in c['items']]}, srcopt(c)),
    ('hub', 'hubDiagram'): t_hub,
    ('hub', 'hubSpoke'): lambda c: ({'center': c['center'], 'nodes': [{**keep(n, 'name', 'items'), **({'tag': n['edge']} if n.get('edge') else {}),
                                                                      **({'kind': 'dashed'} if n.get('link') == 'dashed' else {})} for n in c['nodes']]}, srcopt(c)) if c.get('center') else t_hub(c),
    ('hub', 'principles'): lambda c: ({'items': [{'name': n['name'], 'd': '; '.join(n.get('items', []))} for n in c['nodes']]}, srcopt(c)),
    ('layers', 'systemsLayers'): t_layers,
    ('layers', 'nowNextLater'): t_nnl,
    ('layers', 'hubDiagram'): t_hub_layers,
}


# ───────── сверка данных компонента с каталогом fields.json ─────────
def audit(comp, data):
    """→ has, miss_req, miss_opt [(путь, о поле, смысловое?, у скольких нет)], count [(путь, n, [a, b])], long [(путь, знаков, проверено)]."""
    agg, count, long_ = {}, [], []

    def walk(spec, obj, pre):
        for k, f in spec.items():
            p = pre + k
            v = obj.get(k) if isinstance(obj, dict) else None
            a = agg.setdefault(p, [0, 0, f])
            a[1] += 1
            if v is None:
                continue
            a[0] += 1
            if f.get('type') == 'list' and isinstance(v, list):
                if f.get('n') and not (f['n'][0] <= len(v) <= f['n'][1]) and (p, len(v), f['n']) not in count:
                    count.append((p, len(v), f['n']))
                if f.get('item') == 'obj':   # рекурсивные списки (дети дерева) описаны без of: их поля не проверяются
                    for it in v:
                        walk(f.get('of') or {}, it, p + '[].')
            elif f.get('type') == 'obj' and isinstance(v, dict):
                walk(f.get('of') or {}, v, p + '.')
            elif isinstance(v, str) and f.get('tested') and len(v) > f['tested'] * 1.25 + 4:
                long_.append((p, len(v), f['tested']))
    walk(FIELDS[comp]['fields'], data, '')
    has_, req, opt = [], [], []
    for p, (n, tot, f) in agg.items():
        if n:
            has_.append(p)
        if n < tot:
            if f.get('req'):
                req.append((p, tot - n, tot))
            elif f.get('about') or f.get('key'):
                opt.append((p, f.get('about', ''), bool(f.get('key')), tot - n, tot))
    # обязательное поле внутри необязательного объекта (pain.t) считается только там, где объект есть
    req = [r for r in req if not any(r[0].startswith(o[0] + '.') or r[0].startswith(o[0] + '[]') for o in opt) and agg_parent_ok(r[0], agg)]
    lng = {}
    for p, n, t in long_:
        if p not in lng or n > lng[p][0]:
            lng[p] = (n, t)
    return has_, req, opt, count, [(p, n, t) for p, (n, t) in lng.items()]


def agg_parent_ok(p, agg):
    # «a[].b.c» обязательно, только если «a[].b» есть у всех; иначе пропуск уже виден у родителя
    par = re.sub(r'(\[\])?\.[^.\[]+$', '', p)
    if par == p or par not in agg:
        return True
    n, tot, f = agg[par]
    return n == tot or f.get('req')


# ───────── node: снятие содержания и пробный вызов компонентов ─────────
CAPTURE_JS = r"""
const fs=require('fs'), path=require('path'); const out=process.argv[1];
console.warn=()=>{}; console.log=()=>{};
const L=require(path.resolve('lib.js')), K=require(path.resolve('components.js'));
const names=K.COMPONENTS||Object.keys(K).filter(k=>typeof K[k]==='function');
let depth=0, cur=null;
const ch=L.chrome; L.chrome=function(o){ if(cur&&!cur.head) cur.head={title:Array.isArray(o.title)?o.title.map(r=>r.t).join(''):(o.title||''), sub:o.sub||'', source:o.source||''}; return ch.apply(this,arguments); };
for(const k of names){ const f=K[k]; K[k]=function(...a){ if(depth===0&&cur) cur.calls.push({name:k, box:a[0]||null, data:a[1], opt:a[2]||{}}); depth++; try{return f.apply(this,a)} finally{depth--} }; }
const {S}=require(path.resolve('slides.js')); L.PAGE.total=S.length; const res=[];
S.forEach((fn,i)=>{ L.PAGE.n=i+1; cur={n:i+1, fn:fn.name, calls:[]}; try{ const sl=fn(); cur.bg=sl.bg||null; cur.archetype=sl.archetype||fn.name; cur.custom=sl.custom||null; }catch(e){ cur.error=String(e.message).split('\n')[0]; } res.push(cur); cur=null; });
fs.writeFileSync(out, JSON.stringify({components:names, slides:res}));
"""

PROBE_JS = r"""
const fs=require('fs'), path=require('path'); const [inp,out]=process.argv.slice(1);
console.warn=()=>{}; console.log=()=>{};
const L=require(path.resolve('lib.js')), K=require(path.resolve('components.js'));
const box={x:L.M, y:L.T.canvas.bodyTop+0.3, w:L.W-2*L.M, h:L.T.canvas.bodyBottom-L.T.canvas.bodyTop-0.45};
const bad=els=>{ if(!Array.isArray(els)) return 'компонент вернул не список элементов';
  for(const e of els){ if(!e) continue; for(const k of ['x','y','w','h']) if(e[k]!=null&&!Number.isFinite(e[k])) return `координата ${k} не число (NaN): не хватает данных`;
    if(e.t==='text'){ const s=e.runs.map(r=>String(r.t)).join(''); if(/undefined|NaN|\[object|\{n\}/.test(s)) return `в тексте «${s.slice(0,50)}»`; } } return null; };
const res={};
for(const c of JSON.parse(fs.readFileSync(inp,'utf8'))){ const f0=L.FACTS.length; L.PAGE.n=1;
  try{ if(typeof K[c.name]!=='function') { res[c.key]='нет такого компонента в этой версии библиотеки'; continue; }
    const els=K[c.name](box,c.data,c.opt||{}); const b=bad(els);
    const nf=L.FACTS.slice(f0).find(f=>typeof f.value!=='number'||!Number.isFinite(f.value));
    res[c.key]=b||(nf?`в реестр фактов попало «${nf.value}» (${nf.label}) вместо числа`:null);
  }catch(e){ res[c.key]='ошибка: '+String(e.message).split('\n')[0].slice(0,160); }
  finally{ L.FACTS.length=f0; } }
fs.writeFileSync(out, JSON.stringify(res));
"""


def node(src, script, *args):
    r = subprocess.run(['node', '-e', script, *args], cwd=src, capture_output=True, text=True, timeout=300)
    if r.returncode:
        sys.exit(f'node в {src}: {(r.stderr or r.stdout).strip()[-600:]}')


def capture(src):
    with tempfile.TemporaryDirectory(dir=os.path.join(SKILL, '.build') if os.path.isdir(os.path.join(SKILL, '.build')) else None) as t:
        out = os.path.join(t, 'cap.json')
        node(src, CAPTURE_JS, out)
        return json.load(open(out, encoding='utf-8'))


def probe(src, cands):
    if not cands:
        return {}
    with tempfile.TemporaryDirectory(dir=os.path.join(SKILL, '.build') if os.path.isdir(os.path.join(SKILL, '.build')) else None) as t:
        i, o = os.path.join(t, 'in.json'), os.path.join(t, 'out.json')
        json.dump(cands, open(i, 'w', encoding='utf-8'), ensure_ascii=False)
        node(src, PROBE_JS, i, o)
        return json.load(open(o, encoding='utf-8'))


# ───────── подбор ─────────
def libdir(src, lib):
    # чья библиотека компонентов: деки (как она соберётся сейчас) или навыка (что даст обновление)
    return os.path.join(SKILL, 'templates', 'deck-starter') if lib == 'skill' else src


def area(b):
    return (b or {}).get('w', 0) * (b or {}).get('h', 0)


def content_from_capture(cap, want):
    out = []
    for s in cap['slides']:
        if want and s['n'] not in want:
            continue
        head = s.get('head') or {}
        base = {'n': s['n'], 'title': head.get('title', ''), 'sub': head.get('sub', ''), 'source': head.get('source', ''), 'bg': s.get('bg'),
                'archetype': s.get('archetype')}
        if s.get('error'):
            out.append({**base, 'skip': f'слайд не собирается: {s["error"]}'})
            continue
        if not s['calls']:
            out.append({**base, 'skip': 'нет компонента библиотеки' + (f' (custom: {s["custom"]})' if s.get('custom') else '')})
            continue
        main = max(s['calls'], key=lambda c: area(c['box']))
        rest = [c['name'] for c in s['calls'] if c is not main]
        base.update(current=main['name'], data=main['data'], opt=main['opt'], others=rest)
        if s.get('archetype') == 'cover' or main['name'] not in FROM:
            out.append({**base, 'skip': 'обложка' if s.get('archetype') == 'cover' else f'форма данных {main["name"]} не распознана: варианты не подбираются'})
            continue
        try:
            shape, c = FROM[main['name']](main['data'], main['opt'])
        except (Skip, KeyError, TypeError) as e:
            out.append({**base, 'skip': f'форма данных не распознана: {e}'})
            continue
        if main['opt'].get('src') and 'src' not in c:
            c['src'] = main['opt']['src']
        elif main['data'].get('src') and 'src' not in c:
            c['src'] = main['data']['src']
        mean = [SHAPE_MEANING[shape]] + [m for m in FIELDS.get(main['name'], {}).get('meaning', []) if m != SHAPE_MEANING[shape]]
        out.append({**base, 'shape': shape, 'meaning': mean, 'content': c})
    return out


def content_from_file(path, want):
    j = json.load(open(path, encoding='utf-8'))
    out = []
    for s in j.get('slides', j if isinstance(j, list) else []):
        if want and s['n'] not in want:
            continue
        if s.get('shape') not in SHAPE_MEANING:
            sys.exit(f'слайд {s.get("n")}: shape — одно из {", ".join(SHAPE_MEANING)}')
        mean = s.get('meaning') or [SHAPE_MEANING[s['shape']]]
        out.append({'n': s['n'], 'title': s.get('title', ''), 'sub': s.get('sub', ''), 'source': s.get('source', ''), 'bg': s.get('bg'),
                    'shape': s['shape'], 'meaning': mean, 'content': s['content'], 'current': s.get('current'), 'others': []})
    return out


def score(comp, mean, current, miss_opt, long_):
    cm = FIELDS[comp]['meaning']
    # главный вопрос слайда среди тегов (+3, и +1, если это главный вопрос самого компонента), доля общих тегов (+2),
    # текущий компонент (+0,5); без смыслового поля −1 за поле, текст длиннее проверенного −0,3
    s = 3 * (mean[0] in cm) + (mean[0] == cm[0]) + 2 * len(set(mean) & set(cm)) / len(mean) + (0.5 if comp == current else 0)
    s -= 1.0 * sum(1 for m in miss_opt if m[2]) + 0.3 * len(long_)
    return round(s, 2)


def suggest_slide(s, src):
    """→ кандидаты (все, кто прошёл переложение) и исключённые; пробный вызов делается пачкой снаружи."""
    shape, c, cur = s['shape'], s['content'], s.get('current')
    tried, excl = [], []
    comps = [k for (sh, k) in TO if sh == shape]
    if cur and cur not in comps and cur in FIELDS:
        comps.insert(0, cur)
    for comp in comps:
        if comp == cur and s.get('data') is not None:
            data, opt = s['data'], s['opt']
        else:
            try:
                data, opt = TO[(shape, comp)](c)
            except Skip as e:
                excl.append({'component': comp, 'why': str(e)})
                continue
            except (KeyError, TypeError, IndexError, ValueError) as e:
                excl.append({'component': comp, 'why': f'в данных нет нужного поля ({type(e).__name__}: {e})'})
                continue
        has_, req, opt_miss, count, long_ = audit(comp, data)
        if req:
            excl.append({'component': comp, 'why': 'нет обязательных полей: ' + ', '.join(f'{p}' + (f' (у {k} из {n})' if n > 1 else '') for p, k, n in req)})
            continue
        if count and comp != cur:
            excl.append({'component': comp, 'why': '; '.join(f'{p}: {n} шт., компонент рассчитан на {a}–{b}' if a != b else f'{p}: {n} шт., компонент рассчитан ровно на {a}' for p, n, (a, b) in count)})
            continue
        partial = any(m[2] for m in opt_miss)   # «частично» — только без смыслового поля (key); прочие пропуски — «не заполнено»
        tried.append({'component': comp, 'current': comp == cur, 'data': data, 'opt': opt, 'has': leaves(comp, has_),
                      'missing': [{'path': p, 'about': a, 'key': k, 'of': f'{m} из {n}'} for p, a, k, m, n in opt_miss],
                      'limits': limits(comp), 'warn': [f'{p}: {n} знаков, в галерее проверено {t}' for p, n, t in long_] +
                                                       [f'{p}: {n} шт. при рассчитанных {a}–{b}' for p, n, (a, b) in count],
                      'status': 'частично' if partial else 'годится', 'partial': FIELDS[comp].get('partial', '') if partial else '',
                      'score': score(comp, s["meaning"], cur, opt_miss, long_),
                      'text': not set(s['meaning']) & set(FIELDS[comp]['meaning'])})
    # смысл совпадает, а формы данных у компонента нет
    for comp, f in FIELDS.items():
        if comp in comps or s['meaning'][0] not in f['meaning'][:2]:
            continue
        excl.append({'component': comp, 'why': f'другая форма данных: компонент ждёт {strip_md(f.get("data") or "")}'})
    return tried, excl


def leaves(comp, paths):
    # «есть в данных» — только конечные поля, без контейнеров (items, before)
    kinds = dict(walk_fields(FIELDS[comp]['fields']))
    paths = [p for p in paths if p.split('.')[-1] not in ('key', 'w', 'type')]   # раскладка таблицы, а не данные брифа
    return [p for p in paths if kinds.get(p, {}).get('type') not in ('list', 'obj') or kinds[p].get('item') != 'obj' and kinds[p].get('type') == 'list']


def strip_md(s):
    return s.replace('`', '')


def limits(comp):
    out = []
    for p, f in walk_fields(FIELDS[comp]['fields']):
        if f.get('n'):
            a, b = f['n']
            out.append(f'{p} {a}–{b}' if a != b else f'{p} ровно {a}')
    for p, f in walk_fields(FIELDS[comp]['fields']):
        if f.get('type') == 'text' and f.get('tested') and f.get('req') and p.split('.')[-1] not in ('key', 'type', 'label') and not p.startswith('cols['):
            out.append(f'{p} ≤{f["tested"]} зн.')
    return out[:6]


def walk_fields(spec, pre=''):
    for k, f in spec.items():
        yield pre + k, f
        if f.get('type') == 'obj':
            yield from walk_fields(f['of'], pre + k + '.')
        elif f.get('type') == 'list' and f.get('item') == 'obj':
            yield from walk_fields(f['of'], pre + k + '[].')


def gallery_png():
    # пример отображения из галереи библиотеки: компонент → PNG тёмной темы
    m = os.path.join(SKILL, 'components', '.gallery', 'src', 'out', 'slides.json')
    if not os.path.isfile(m):
        return {}
    out = {}
    for s in json.load(open(m, encoding='utf-8')):
        for k in s.get('lib') or []:
            p = os.path.join(SKILL, 'components', '.gallery', 'src', 'out', 'png', f's{s["n"]}.png')
            if os.path.isfile(p):
                out.setdefault(k, p)
    return out


def sha(o):
    return hashlib.sha256(json.dumps(o, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:12]


def run_id():
    return dt.datetime.now().strftime('%Y%m%d-%H%M%S') + f'-{os.getpid()}'


def skill_version():
    try:
        v = open(os.path.join(SKILL, 'VERSION')).read().strip()
    except OSError:
        v = '?'
    return v


def cmd_suggest(a):
    src = os.path.abspath(a.src)
    want = {int(x) for x in a.slides.split(',')} if a.slides else set()
    if a.content:
        slides = content_from_file(a.content, want)
    else:
        if not os.path.isfile(os.path.join(src, 'slides.js')):
            sys.exit(f'нет {src}/slides.js: укажите --content <файл> (reference/18-variants.md)')
        slides = content_from_capture(capture(src), want)
    # пробный вызов всех кандидатов одной пачкой в библиотеке этой деки
    batch, per = [], {}
    for s in slides:
        if s.get('skip'):
            continue
        tried, excl = suggest_slide(s, src)
        per[s['n']] = (tried, excl)
        for i, t in enumerate(tried):
            batch.append({'key': f'{s["n"]}:{i}', 'name': t['component'], 'data': t['data'], 'opt': t['opt']})
    res = probe(libdir(src, a.lib), batch)
    gal = gallery_png()
    rid = run_id()
    rdir = os.path.join(src, 'out', 'variants', rid)
    if os.path.exists(rdir):
        sys.exit(f'прогон уже есть, не перезаписываю: {rdir}')
    os.makedirs(rdir)
    rec = {'version': 1, 'skill': skill_version(), 'run': rid, 'created': dt.datetime.now().isoformat(timespec='seconds'),
           'source': os.path.relpath(a.content, src) if a.content else 'slides.js', 'lib': a.lib, 'slides': []}
    for s in slides:
        if s.get('skip'):
            rec['slides'].append({k: s.get(k) for k in ('n', 'title', 'current', 'skip')})
            continue
        tried, excl = per[s['n']]
        ok = []
        for i, t in enumerate(tried):
            err = res.get(f'{s["n"]}:{i}')
            if err:
                hint = ' — нужна версия компонента с частичными данными' if t['missing'] else ''
                excl.append({'component': t['component'], 'why': f'пробный вызов в библиотеке этой деки: {err}{hint}'})
            else:
                t['example'] = gal.get(t['component'])
                ok.append(t)
        ok.sort(key=lambda t: -t['score'])
        top = ok[:a.top]
        if cur := next((t for t in ok if t['current']), None):
            if cur not in top:
                top = top[:-1] + [cur]
        more = [t['component'] for t in ok if t not in top]
        for i, t in enumerate(top):
            t['id'] = 'ABCDEFGH'[i]
        rec['slides'].append({**{k: s.get(k) for k in ('n', 'title', 'sub', 'source', 'bg', 'current', 'others', 'shape', 'meaning')},
                              'content': s['content'], 'content_sha': sha(s['content']), 'candidates': top, 'more': more, 'excluded': excl})
    json.dump(rec, open(os.path.join(rdir, 'suggest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # прошлый выбор: тот ли это слайд по содержанию
    vp = os.path.join(src, 'data', 'variants.json')
    picks = json.load(open(vp, encoding='utf-8')).get('picks', {}) if os.path.isfile(vp) else {}
    for s in rec['slides']:
        p = picks.get(str(s['n']))
        if p and s.get('content_sha'):
            s['pick'] = {**p, 'same_content': p['content_sha'] == s['content_sha']}
    md = report(rec, src)
    open(os.path.join(rdir, 'suggest.md'), 'w', encoding='utf-8').write(md)
    if a.json:
        print(json.dumps(rec, ensure_ascii=False, indent=1))
    else:
        print(md)
    many = sum(1 for s in rec['slides'] if len(s.get('candidates', [])) >= 2)
    print(f'\nпрогон {rid}: {os.path.relpath(rdir, src)}/suggest.md; слайдов с 2+ вариантами: {many}. '
          f'Показ: variants.py demo {a.src} --run {rid}')


def report(rec, src):
    L = [f'# Варианты компонентов · прогон {rec["run"]}', '',
         f'Навык {rec["skill"]}, содержание из {rec["source"]}, библиотека {"навыка (что даст обновление)" if rec.get("lib") == "skill" else "деки"}. Кандидаты — по смыслу слайда и форме его данных; '
         'каждый прошёл пробный вызов в библиотеке этой деки. «Не заполнено» — поля, которых нет в данных: компонент рисует без них, '
         'значения не выдумываются. Лимиты: n — рассчитанное число элементов, «≤N зн.» — длина, проверенная в галерее.', '']
    for s in rec['slides']:
        L.append(f'## Слайд {s["n"]} · «{s.get("title") or "без заголовка"}»' + (f' · сейчас: {s["current"]}' if s.get('current') else ''))
        if s.get('skip'):
            L += [f'Пропущен: {s["skip"]}.', '']
            continue
        if s.get('others'):
            L.append(f'На слайде ещё {", ".join(s["others"])}: варианты подобраны для главного компонента (по площади), остальные не меняются.')
        L.append(f'Смысл: {", ".join(s["meaning"])} · форма данных: {s["shape"]} · содержание {s["content_sha"]}')
        if p := s.get('pick'):
            L.append(f'Выбран раньше: {p["component"]} (прогон {p["run"]})' + ('' if p['same_content'] else ' — **содержание слайда с тех пор изменилось**, выбор стоит повторить'))
        L += ['', '| | Компонент | Статус | Есть в данных | Не заполнено | Ограничения | Пример |', '|---|---|---|---|---|---|---|']
        for t in s['candidates']:
            miss = '; '.join(f'{m["path"]} ({m["of"]})' + (f' — {m["about"]}' if m['about'] else '') for m in t['missing']) or '—'
            lim = ', '.join(t['limits']) + (('; ⚠ ' + '; '.join(t['warn'])) if t['warn'] else '')
            ex = t['example'] if t.get('example') else 'нет галереи: zsh $SKILL/scripts/gallery.sh'
            name = t['component'] + (' (сейчас)' if t['current'] else '') + (' · запасной: другой смысл' if t['text'] else '')
            L.append(f'| {t["id"]} | {name} | {t["status"]} | {", ".join(t["has"][:8])} | {miss} | {lim or "—"} | {ex} |')
            if t['partial']:
                L.append(f'|  | | | | ↳ {t["partial"]} | | |')
        if len(s['candidates']) < 2:
            L.append('\nПригодный вариант один: другие компоненты требуют данных, которых нет (см. ниже).')
        if s['more']:
            L.append(f'\nЕщё годятся: {", ".join(s["more"])}.')
        if s['excluded']:
            L.append('\nИсключены:')
            L += [f'- {e["component"]} — {e["why"]}' for e in s['excluded']]
        L.append('')
    return '\n'.join(L)


# ───────── показ: галерея вариантов в обеих темах ─────────
SLIDES_JS = r"""// Сгенерировано variants.py demo: по слайду на вариант, данные в variants.data.json
const fs = require('fs');
const L = require('./lib.js');
const K = require('./components.js');
const { M, W, T, C, chrome, text } = L;
const V = require('./variants.data.json');
const body = { x: M, y: T.canvas.bodyTop + 0.3, w: W - 2 * M, h: T.canvas.bodyBottom - T.canvas.bodyTop - 0.45 };
const ERR = {};
const S = V.map((v, i) => { const f = function () {
  let els;
  try {
    els = K[v.component](body, v.data, v.opt || {});
    els.forEach((e, k) => { if (e && e.t === 'text' && !e.id) e.id = `s${i + 1}-c${k}`; });   // переполнение → номер варианта
  } catch (e) { ERR[i + 1] = String(e.message).split('\n')[0]; els = [text(M, 3.2, W - 2 * M, 0.8, 'ошибка компонента: ' + ERR[i + 1], { size: 14, color: C.muted })]; }
  return { bg: v.bg || 'bg_s2.jpg', archetype: v.archetype, notes: v.notes, els: [...chrome({ title: v.title, pill: v.pill, sub: v.sub, source: v.source, panel: false }), ...els] };
}; Object.defineProperty(f, 'name', { value: `v${i + 1}_${v.component}` }); return f; });
process.on('exit', () => fs.writeFileSync(`out/variant_errors${L.THEME === 'light' ? '-light' : ''}.json`, JSON.stringify(ERR)));
module.exports = { S };
"""


def font(size):
    from PIL import ImageFont
    for p in ('/System/Library/Fonts/Supplemental/Arial Unicode.ttf', '/System/Library/Fonts/Supplemental/Arial.ttf',
              '/Library/Fonts/Arial Unicode.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'C:/Windows/Fonts/arial.ttf'):
        if os.path.isfile(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def sheet(rows, out, title):
    # строка — вариант: тёмная | светлая; подпись над строкой
    from PIL import Image, ImageDraw
    tw, th, pad, cap = 640, 360, 16, 46
    W_ = 2 * tw + 3 * pad
    H_ = 56 + len(rows) * (th + cap + pad) + pad
    im = Image.new('RGB', (W_, H_), (28, 28, 28))
    d = ImageDraw.Draw(im)
    d.text((pad, 16), title, fill=(235, 235, 235), font=font(22))
    for i, (label, sub, dark, light) in enumerate(rows):
        y = 56 + i * (th + cap + pad)
        d.text((pad, y + 2), label, fill=(240, 240, 240), font=font(18))
        d.text((pad, y + 24), sub, fill=(170, 170, 170), font=font(14))
        for j, p in enumerate((dark, light)):
            x = pad + j * (tw + pad)
            if p and os.path.isfile(p):
                im.paste(Image.open(p).convert('RGB').resize((tw, th)), (x, y + cap))
            else:
                d.rectangle((x, y + cap, x + tw, y + cap + th), outline=(90, 90, 90))
                d.text((x + 20, y + cap + th // 2), 'нет PNG', fill=(150, 150, 150), font=font(16))
    im.save(out)


def latest_run(src):
    runs = sorted(glob.glob(os.path.join(src, 'out', 'variants', '*', 'suggest.json')), key=os.path.getmtime)
    if not runs:
        sys.exit(f'нет прогонов в {src}/out/variants: сначала variants.py suggest {src}')
    return os.path.basename(os.path.dirname(runs[-1]))


def cmd_demo(a):
    src = os.path.abspath(a.src)
    rid = a.run or latest_run(src)
    rdir = os.path.join(src, 'out', 'variants', rid)
    rec = json.load(open(os.path.join(rdir, 'suggest.json'), encoding='utf-8'))
    if os.path.exists(os.path.join(rdir, 'demo.json')):
        # тот же замороженный прогон показывается заново в новой папке: прошлый показ не трогаем
        nid = run_id()
        ndir = os.path.join(src, 'out', 'variants', nid)
        os.makedirs(ndir)
        rec = {**rec, 'run': nid, 'repeat_of': rid}
        json.dump(rec, open(os.path.join(ndir, 'suggest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        shutil.copy(os.path.join(rdir, 'suggest.md'), os.path.join(ndir, 'suggest.md'))
        rid, rdir = nid, ndir
    want = {int(x) for x in a.slides.split(',')} if a.slides else set()
    V, idx = [], []
    for s in rec['slides']:
        cands = s.get('candidates') or []
        if (want and s['n'] not in want) or (not want and len(cands) < 2 and not a.all) or not cands:
            continue
        for t in cands:
            V.append({'component': t['component'], 'data': t['data'], 'opt': t['opt'], 'title': s.get('title') or f'Слайд {s["n"]}',
                      'sub': s.get('sub', ''), 'source': s.get('source', ''), 'bg': s.get('bg'), 'archetype': f'variant-{t["component"]}',
                      'pill': f'{t["id"]} · {t["component"]}', 'notes': f'слайд {s["n"]}, вариант {t["id"]}: {t["component"]} ({t["status"]})'})
            idx.append((s['n'], t))
    if not V:
        sys.exit('показывать нечего: нет слайдов с двумя и более вариантами (--all — и с одним)')
    # проект-черновик рядом с прогоном: та же библиотека, тема и подложки, что у деки
    proj = os.path.join(rdir, 'src')
    if os.path.isdir(proj):   # прошлый показ этого прогона оборвался до demo.json: черновик пересобирается
        shutil.rmtree(proj)
    os.makedirs(os.path.join(proj, 'out'))
    lib = libdir(src, rec.get('lib'))
    for f in ('build.js', 'lib.js', 'components.js', 'render.sh'):
        shutil.copy(os.path.join(lib, f), proj)
    shutil.copy(os.path.join(src, 'theme.json'), proj)   # тема и подложки — всегда деки
    shutil.copytree(os.path.join(lib, 'kit'), os.path.join(proj, 'kit'))
    os.symlink(os.path.join(src, 'img'), os.path.join(proj, 'img'))
    nm = os.path.join(src, 'node_modules')
    os.symlink(nm if os.path.exists(nm) else os.path.join(SKILL, 'node_modules'), os.path.join(proj, 'node_modules'))
    deck = json.load(open(os.path.join(src, 'deck.json'), encoding='utf-8'))
    json.dump({'name': 'Варианты', 'title': f'{deck.get("title", "")}: варианты', 'author': deck.get('author', ''), 'hidden': []},
              open(os.path.join(proj, 'deck.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    json.dump(V, open(os.path.join(proj, 'variants.data.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    open(os.path.join(proj, 'slides.js'), 'w', encoding='utf-8').write(SLIDES_JS)
    env = {**os.environ}
    runs = [(['node', 'build.js'], {}), (['node', 'build.js'], {'THEME': 'light'}), (['./render.sh'], {}), (['./render.sh'], {'OUT': 'out-light'})]
    rend = {}
    for cmd, e in runs:
        r = subprocess.run(cmd, cwd=proj, env={**env, **e}, capture_output=True, text=True, timeout=900)
        if r.returncode:
            sys.exit(f'{" ".join(cmd)} {e}: {(r.stderr or r.stdout).strip()[-800:]}')
        if cmd[0] == './render.sh':
            m = re.search(r'\{.*"overflow".*\}', r.stdout)
            rend[e.get('OUT', 'out')] = json.loads(m.group(0)) if m else {}
    errs = {t: json.load(open(os.path.join(proj, 'out', f'variant_errors{s}.json'))) for t, s in (('dark', ''), ('light', '-light'))
            if os.path.isfile(os.path.join(proj, 'out', f'variant_errors{s}.json'))}
    over = {}
    for t, j in rend.items():
        for o in j.get('overflow', []):
            m = re.match(r's(\d+)-', o)
            if m:
                over.setdefault(int(m.group(1)), []).append(('тёмная' if t == 'out' else 'светлая') + ': ' + o)
    res, sheets = {}, []
    for n in sorted({n for n, _ in idx}):
        rows = []
        for k, (sn, t) in enumerate(idx, 1):
            if sn != n:
                continue
            er = errs.get('dark', {}).get(str(k)) or errs.get('light', {}).get(str(k))
            ov = over.get(k, [])
            state = f'ошибка: {er}' if er else (f'переполнение {len(ov)}' if ov else 'без переполнений')
            res.setdefault(str(n), {})[t['id']] = {'component': t['component'], 'slide': k, 'state': state, 'overflow': ov, 'error': er,
                                                  'png': {'dark': f'src/out/png/s{k}.png', 'light': f'src/out-light/png/s{k}.png'}}
            miss = ', '.join(m['path'] for m in t['missing'])
            rows.append((f'{t["id"]} · {t["component"]}{" (сейчас)" if t["current"] else ""} · {t["status"]}{" · запасной: другой смысл" if t["text"] else ""}',
                         f'{state}' + (f' · не заполнено: {miss}' if miss else ''),
                         os.path.join(proj, 'out', 'png', f's{k}.png'), os.path.join(proj, 'out-light', 'png', f's{k}.png')))
        title = next(s.get('title', '') for s in rec['slides'] if s['n'] == n)
        p = os.path.join(rdir, f'sheet-s{n}.png')
        sheet(rows, p, f'Слайд {n} · {title} · варианты: тёмная | светлая')
        sheets.append(p)
    demo = {'run': rid, 'skill': skill_version(), 'created': dt.datetime.now().isoformat(timespec='seconds'), 'slides': res,
            'pptx': {'dark': 'Варианты.pptx', 'light': 'Варианты_светлая.pptx'}, 'sheets': [os.path.basename(p) for p in sheets],
            'font': {t: j.get('font') for t, j in rend.items()}}
    json.dump(demo, open(os.path.join(rdir, 'demo.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for p in sheets:
        print(p)
    bad = sum(1 for s in res.values() for v in s.values() if v['error'] or v['overflow'])
    print(f'прогон {rid}: вариантов {len(V)}, с ошибкой или переполнением {bad}; PPTX: {rdir}/Варианты.pptx и Варианты_светлая.pptx. '
          f'Выбор: variants.py pick {a.src} --run {rid} --slide N --variant B')


def cmd_pick(a):
    src = os.path.abspath(a.src)
    rid = a.run or latest_run(src)
    rdir = os.path.join(src, 'out', 'variants', rid)
    rec = json.load(open(os.path.join(rdir, 'suggest.json'), encoding='utf-8'))
    s = next((x for x in rec['slides'] if x['n'] == a.slide), None)
    if not s or not s.get('candidates'):
        sys.exit(f'слайд {a.slide}: в прогоне {rid} нет кандидатов')
    t = next((x for x in s['candidates'] if a.variant in (x['id'], x['component'])), None)
    if not t:
        sys.exit(f'слайд {a.slide}: нет варианта «{a.variant}»; есть ' + ', '.join(f'{x["id"]}={x["component"]}' for x in s['candidates']))
    demo = os.path.join(rdir, 'demo.json')
    seen = json.load(open(demo, encoding='utf-8')).get('slides', {}).get(str(a.slide), {}).get(t['id']) if os.path.isfile(demo) else None
    snip = (f'// слайд {a.slide}: вариант {t["id"]} — {t["component"]} (variants.py, прогон {rid})\n'
            f'K.{t["component"]}(body, {json.dumps(t["data"], ensure_ascii=False)}, {json.dumps(t["opt"], ensure_ascii=False)})\n')
    sp = os.path.join(rdir, f'pick-s{a.slide}.js')
    open(sp, 'w', encoding='utf-8').write(snip)
    # в data/variants.json — только выбор и ссылки, без текстов слайда: copy_edit.py ищет формулировки в data/*.json
    vp = os.path.join(src, 'data', 'variants.json')
    os.makedirs(os.path.dirname(vp), exist_ok=True)
    V = json.load(open(vp, encoding='utf-8')) if os.path.isfile(vp) else {'version': 1, 'picks': {}}
    V['picks'][str(a.slide)] = {'component': t['component'], 'variant': t['id'], 'status': t['status'], 'run': rid,
                                'content_sha': s['content_sha'], 'data_sha': sha(t['data']), 'shown': seen['state'] if seen else 'не показан',
                                'snippet': os.path.relpath(sp, src), 'at': dt.datetime.now().isoformat(timespec='seconds'), 'why': a.why or ''}
    json.dump(V, open(vp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    open(vp, 'a', encoding='utf-8').write('\n')
    print(snip.rstrip())
    print(f'\nвыбор записан: {os.path.relpath(vp, src)} → слайд {a.slide} = {t["component"]} ({t["status"]}); вызов: {os.path.relpath(sp, src)}'
          + ('' if seen else '\n[WARN] вариант не показан в demo: посмотрите превью перед заменой'))


# ───────── сверка каталога ─────────
GAL_JS = r"""
const fs=require('fs'), path=require('path'); const out=process.argv[1];
console.warn=()=>{}; console.log=()=>{};
const L=require(path.resolve('lib.js')), K=require(path.resolve('components.js')); const rec=[]; let depth=0;
for(const k of K.COMPONENTS){ const f=K[k]; K[k]=function(...a){ if(depth===0) rec.push({name:k, data:a[1]}); depth++; try{return f.apply(this,a)} finally{depth--} }; }
for(const f of fs.readdirSync('.').filter(f=>/^gallery.*\.js$/.test(f))){ const {S}=require(path.resolve(f)); S.forEach((fn,i)=>{ L.PAGE.n=i+1; try{fn()}catch(e){} }); }
fs.writeFileSync(out, JSON.stringify({components:K.COMPONENTS, rec}));
"""


def cmd_check(a):
    os.makedirs(os.path.join(SKILL, '.build'), exist_ok=True)
    errs = []
    with tempfile.TemporaryDirectory(dir=os.path.join(SKILL, '.build'), prefix='variants-check.') as t:
        proj = os.path.join(t, 'src')
        shutil.copytree(os.path.join(SKILL, 'templates', 'deck-starter'), proj, ignore=shutil.ignore_patterns('out', 'out-light'))
        os.symlink(os.path.join(SKILL, 'node_modules'), os.path.join(proj, 'node_modules'))
        for f in glob.glob(os.path.join(SKILL, 'components', 'gallery*.js')):
            shutil.copy(f, proj)
        out = os.path.join(t, 'gal.json')
        node(proj, GAL_JS, out)
        g = json.load(open(out, encoding='utf-8'))
    lib = set(g['components'])
    errs += [f'{k}: есть в библиотеке, нет в components/fields.json' for k in sorted(lib - set(FIELDS))]
    errs += [f'{k}: есть в fields.json, нет в библиотеке' for k in sorted(set(FIELDS) - lib)]
    for k, f in FIELDS.items():
        for sh in f.get('accepts', []):
            if (sh, k) not in TO:
                errs.append(f'{k}: accepts {sh}, но в variants.py нет переложения')
    errs += [f'{k}: переложение из {sh} есть, а в fields.json accepts его нет' for (sh, k) in TO if k in FIELDS and sh not in FIELDS[k].get('accepts', [])]
    errs += [f'{k}: снятие содержания есть, компонента нет в fields.json' for k in FROM if k not in FIELDS]
    for r in g['rec']:
        if r['name'] in FIELDS:
            _, req, _, _, _ = audit(r['name'], r['data'])
            errs += [f'{r["name"]}: образец галереи без обязательного {p}' for p, _, _ in req]
            try:
                if r['name'] in FROM:
                    sh, c = FROM[r['name']](r['data'], {})
                    TO[(sh, r['name'])](c) if (sh, r['name']) in TO else None
            except Skip:
                pass
            except Exception as e:
                errs.append(f'{r["name"]}: образец галереи не проходит снятие и обратное переложение ({type(e).__name__}: {e})')
    for e in errs:
        print('[ERR]', e)
    print(f'fields.json: компонентов {len(FIELDS)}, в библиотеке {len(lib)}, переложений {len(TO)}, снятий {len(FROM)}; ошибок {len(errs)}')
    sys.exit(1 if errs else 0)


ap = argparse.ArgumentParser(description='Варианты компонентов по смыслу и форме данных (reference/18-variants.md)')
ap.add_argument('cmd', choices=['suggest', 'demo', 'pick', 'check'])
ap.add_argument('src', nargs='?')
ap.add_argument('--content', help='содержание слайдов без slides.js: {"slides": [{n, title, shape, meaning?, content}]}')
ap.add_argument('--slides', help='только эти слайды: 4,6,9')
ap.add_argument('--top', type=int, default=3, help='сколько вариантов на слайд (по умолчанию 3)')
ap.add_argument('--lib', choices=['deck', 'skill'], default='deck', help='suggest: чья библиотека — деки (по умолчанию) или навыка (что даст обновление)')
ap.add_argument('--run', help='id прогона в out/variants/ (по умолчанию последний)')
ap.add_argument('--all', action='store_true', help='demo: и слайды с одним вариантом')
ap.add_argument('--slide', type=int)
ap.add_argument('--variant')
ap.add_argument('--why')
ap.add_argument('--json', action='store_true')
a = ap.parse_args()
if a.cmd != 'check' and not a.src:
    sys.exit('укажите папку деки: variants.py ' + a.cmd + ' src-<тема>')
if a.cmd == 'pick' and (not a.slide or not a.variant):
    sys.exit('pick: --slide N --variant B (буква или имя компонента)')
{'suggest': cmd_suggest, 'demo': cmd_demo, 'pick': cmd_pick, 'check': cmd_check}[a.cmd](a)
