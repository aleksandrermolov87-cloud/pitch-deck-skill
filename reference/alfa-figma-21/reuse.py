"""Extract original slides or build a presentation from their editable layers.

Run with the skill's Python. inspect emits every text field and picture ID.
build requires a decision for each source text and image on the selected page.
Dimensions for additional content and boxes are PowerPoint points.
"""
import argparse
import json
import subprocess
from copy import deepcopy
from pathlib import Path
from tempfile import NamedTemporaryFile

from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE, XL_LABEL_POSITION, XL_TICK_MARK, XL_TICK_LABEL_POSITION
from pptx.enum.shapes import MSO_SHAPE_TYPE, MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR, MSO_AUTO_SIZE
from pptx.oxml.xmlchemy import OxmlElement
from pptx.util import Pt

ORIGINAL = Path(__file__).with_name('originals.pptx')
RGB = RGBColor.from_string
ALIGN = {'left': PP_ALIGN.LEFT, 'center': PP_ALIGN.CENTER, 'right': PP_ALIGN.RIGHT}

def box(shape):
    return [round(getattr(shape, k).pt, 2) for k in ('left', 'top', 'width', 'height')]

def visible_text(shape):
    return shape.has_text_frame and bool(shape.text.strip())

def inspect(slide):
    return [{'id': s.shape_id, 'kind': str(s.shape_type).split()[0], 'box': box(s),
             **({'text': s.text} if visible_text(s) else {})} for s in slide.shapes]

def select(pres, numbers):
    ids = pres.slides._sldIdLst
    original = list(ids)
    if not numbers or any(n<1 or n>len(original) for n in numbers):
        raise ValueError('Select valid pages from originals.pptx')
    selected = []
    for number in numbers:
        entry = original[number-1]
        if entry in selected:
            source = pres.slides[number-1]
            clone = pres.slides.add_slide(source.slide_layout)
            root = deepcopy(source._element)
            relationships = {}
            for rel in source.part.rels.values():
                if rel.reltype.endswith(('/notesSlide','/slideLayout')):
                    continue
                target = rel.target_ref if rel.is_external else rel.target_part
                relationships[rel.rId] = clone.part.relate_to(target,rel.reltype,rel.is_external)
            for element in root.iter():
                for key, value in element.attrib.items():
                    if key.startswith('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}') and value in relationships:
                        element.set(key,relationships[value])
            clone._element[:] = list(root)
            if source.has_notes_slide:
                clone.notes_slide.notes_text_frame.text = source.notes_slide.notes_text_frame.text
            entry = ids[-1]
        selected.append(entry)
    for entry in list(ids):
        ids.remove(entry)
        if entry not in selected:
            pres.part.drop_rel(entry.rId)
    for entry in selected:
        ids.append(entry)

def remove(shape):
    shape._element.getparent().remove(shape._element)

def add_text(slide, item):
    x, y, w, h = map(Pt, item['box'])
    shape = slide.shapes.add_textbox(x,y,w,h)
    shape.name = item.get('name','Текст')
    frame = shape.text_frame
    frame.word_wrap = True
    frame.auto_size = MSO_AUTO_SIZE.NONE
    frame.vertical_anchor = MSO_ANCHOR.TOP
    frame.margin_top = frame.margin_bottom = frame.margin_left = frame.margin_right = 0
    parts = item.get('paragraphs') or [item['text']]
    for index, part in enumerate(parts):
        par = frame.paragraphs[0] if index == 0 else frame.add_paragraph()
        par.alignment = ALIGN[item.get('align','left')]
        par.space_after = Pt(item.get('gap',0))
        par.space_before = Pt(0)
        if isinstance(part,str):
            part = [{'text':part}]
        for segment in part:
            style = {**item,**segment}
            run = par.add_run()
            run.text = segment['text']
            run.font.name = style.get('font','Roboto')
            run.font.size = Pt(style.get('size',12))
            run.font.bold = style.get('bold',False)
            run.font.color.rgb = RGB(style.get('color','151515'))
        if 'leading' in item:
            par.line_spacing = Pt(item['leading'])
    return shape

def add_panel(slide, item):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if item.get('radius') else MSO_SHAPE.RECTANGLE,
                                   *map(Pt,item['box']))
    if item.get('radius'):
        shape.adjustments[0]=item['radius']
    shape.fill.solid()
    shape.fill.fore_color.rgb=RGB(item['fill'])
    shape.line.fill.background()
    for style in shape._element.xpath('./p:style'):
        shape._element.remove(style)
    shape._element.spPr.append(OxmlElement('a:effectLst'))

def add_chart(slide, item):
    chart_types={'line':XL_CHART_TYPE.LINE_MARKERS,'columns':XL_CHART_TYPE.COLUMN_CLUSTERED,'stacked':XL_CHART_TYPE.COLUMN_STACKED}
    if 'gallery' in item:
        payload=json.dumps({'box':item['box'],'data':item['gallery']},ensure_ascii=False)
        bridge=Path(__file__).with_name('gallery-chart.cjs')
        sheet=json.loads(subprocess.check_output(['node',str(bridge)],input=payload,text=True))
        styles=item['styles']
        if len(styles)!=len(sheet['series']):
            raise ValueError('One display style is required per gallery series')
        item={**item,'categories':sheet['cats'],
              'series':[{**row,**style} for row,style in zip(sheet['series'],styles)]}
    data=CategoryChartData()
    data.categories=item['categories']
    for series in item['series']:
        if len(series['values'])!=len(data.categories):
            raise ValueError('Series length must match the category count')
        data.add_series(series['name'],series['values'])
    graphic=slide.shapes.add_chart(chart_types[item['kind']],*map(Pt,item['box']),data)
    graphic.name=item['name']
    chart=graphic.chart
    chart.has_title=False
    chart.has_legend=False
    chart.font.name='Roboto'
    chart.font.size=Pt(item.get('size',10))
    chart.font.color.rgb=RGB('242424')
    backdrop=OxmlElement('c:spPr')
    anchor=graphic.chart._chartSpace.find('{http://schemas.openxmlformats.org/drawingml/2006/chart}chart')
    anchor.addnext(backdrop)
    backdrop.append(OxmlElement('a:noFill'))
    border=OxmlElement('a:ln')
    border.append(OxmlElement('a:noFill'))
    backdrop.append(border)
    for axis in [chart.value_axis,chart.category_axis]:
        axis.has_major_gridlines=False
        axis.major_tick_mark=XL_TICK_MARK.NONE
        axis.minor_tick_mark=XL_TICK_MARK.NONE
        axis.format.line.fill.background()
    chart.value_axis.minimum_scale=0
    chart.value_axis.maximum_scale=item['max']
    chart.value_axis.tick_label_position=XL_TICK_LABEL_POSITION.NONE
    chart.category_axis.tick_labels.font.size=Pt(item.get('tick',9))
    chart.category_axis.tick_labels.font.name='Roboto'
    chart.category_axis.format.line.color.rgb=RGB('D5D5D5')
    plot=chart.plots[0]
    if item['kind']!='line':
        plot.gap_width=item.get('gap',45)
        if item['kind']=='stacked':
            plot.overlap=100
    plot.has_data_labels=True
    labels=plot.data_labels
    labels.show_value=True
    labels.font.name='Roboto'
    labels.font.bold=True
    labels.font.size=Pt(item.get('label',11))
    labels.font.color.rgb=RGB('FFFFFF' if item['kind']=='stacked' else '171717')
    labels.position={'line':XL_LABEL_POSITION.ABOVE,'columns':XL_LABEL_POSITION.OUTSIDE_END,'stacked':XL_LABEL_POSITION.CENTER}[item['kind']]
    for series, spec in zip(chart.series,item['series']):
        color=RGB(spec['color'])
        if item['kind']=='line':
            series.format.line.color.rgb=color
            series.format.line.width=Pt(2)
            series.marker.size=4
            series.marker.format.fill.solid()
            series.marker.format.fill.fore_color.rgb=color
        else:
            series.format.fill.solid()
            series.format.fill.fore_color.rgb=color
            series.format.line.fill.background()
            for point, custom in zip(series.points,spec.get('colors',[])):
                point.format.fill.solid()
                point.format.fill.fore_color.rgb=RGB(custom)

def apply(slide, spec, directory):
    fields={s.shape_id:s for s in slide.shapes if visible_text(s)}
    pictures={s.shape_id:s for s in slide.shapes if s.shape_type == MSO_SHAPE_TYPE.PICTURE}
    replacements={int(k):v for k,v in spec['fields'].items()}
    keep=set(spec.get('keep_pictures',[]))
    drop=set(spec.get('remove',[]))
    new_images={int(k):v for k,v in spec.get('replace_pictures',{}).items()}
    if set(fields) != set(replacements) | (set(fields)&drop) or set(replacements)&drop:
        raise ValueError(f"Page {spec['source']}: check text fields {set(fields).symmetric_difference(set(replacements)|(set(fields)&drop))}")
    if set(pictures) != keep | (set(pictures)&drop) | set(new_images) or keep & (drop | set(new_images)) or drop & set(new_images):
        raise ValueError(f"Page {spec['source']}: account for each source image exactly once")
    shapes={s.shape_id:s for s in slide.shapes}
    if drop - shapes.keys():
        raise ValueError(f'Unknown shape IDs: {drop-shapes.keys()}')
    for key in drop:
        remove(shapes[key])
    for key, path in new_images.items():
        old=pictures[key]
        img=slide.shapes.add_picture(str(directory/path),old.left,old.top,old.width,old.height)
        old._element.addprevious(img._element)
        remove(old)
    for key, item in replacements.items():
        old=fields[key]
        first=next((r for p in old.text_frame.paragraphs for r in p.runs if r.text.strip()),None)
        style={'box':box(old),'name':old.name}
        if first is not None:
            f=first.font
            style.update(font=f.name or 'Roboto',size=f.size.pt if f.size else 12,bold=bool(f.bold))
            if f.color.type and str(f.color.type).startswith('RGB'):
                style['color']=str(f.color.rgb)
        new=add_text(slide,{**style,**({'text':item} if isinstance(item,str) else item)})
        old._element.addprevious(new._element)
        remove(old)
    for item in spec.get('add',[]):
        {'text':add_text,'panel':add_panel,'chart':add_chart}[item['type']](slide,item)
    slide.notes_slide.notes_text_frame.text=spec.get('notes','')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    sub=parser.add_subparsers(dest='command',required=True)
    get=sub.add_parser('inspect'); get.add_argument('page',type=int)
    extract=sub.add_parser('extract'); extract.add_argument('pages'); extract.add_argument('output',type=Path)
    build=sub.add_parser('build'); build.add_argument('data',type=Path); build.add_argument('output',type=Path)
    args=parser.parse_args()
    pres=Presentation(ORIGINAL)
    if args.command=='inspect':
        if not 1<=args.page<=len(pres.slides): parser.error('Page out of range')
        print(json.dumps(inspect(pres.slides[args.page-1]),ensure_ascii=False,indent=2))
        return
    if args.output.resolve()==ORIGINAL.resolve():parser.error('Choose a separate output file')
    if args.command=='extract':
        select(pres,[int(n) for n in args.pages.split(',')])
    else:
        specs=json.loads(args.data.read_text())['slides']
        select(pres,[s['source'] for s in specs])
        for slide,spec in zip(pres.slides,specs):
            apply(slide,spec,args.data.parent)
    # Relationships to discarded images must also be removed from derived presentations.
    for slide in pres.slides:
        used=set(slide._element.xpath('.//@r:embed')+slide._element.xpath('.//@r:link'))
        for rel in list(slide.part.rels.values()):
            if rel.reltype.endswith('/image') and rel.rId not in used:
                slide.part.drop_rel(rel.rId)
    with NamedTemporaryFile(dir=args.output.parent,suffix='.pptx',delete=False) as tmp:
        staged=Path(tmp.name)
    try:
        pres.save(staged)
        staged.replace(args.output)
    finally:
        staged.unlink(missing_ok=True)

if __name__=='__main__':
    main()
