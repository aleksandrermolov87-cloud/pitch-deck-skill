"""Check native text visibility against the matching PDF rendered from a PPTX.

Requires python-pptx and Poppler pdftotext. Raster content needs visual review.
"""
import argparse
from collections import Counter
from pathlib import Path
import re
import subprocess
import xml.etree.ElementTree as ET
from pptx import Presentation

def tokens(text):
    return Counter(re.findall(r'[а-яёa-z0-9]+',text.casefold()))

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pptx',type=Path)
    parser.add_argument('pdf',type=Path)
    args=parser.parse_args()
    pres=Presentation(args.pptx)
    xml=subprocess.check_output(['pdftotext','-bbox',str(args.pdf),'-'])
    pages=ET.fromstring(xml).findall('.//{*}page')
    if len(pages)!=len(pres.slides):
        raise SystemExit('Page counts differ')
    failures=[]
    fields=0
    for n,(slide,page) in enumerate(zip(pres.slides,pages),1):
        words=[]
        for word in page.findall('.//{*}word'):
            x0,y0,x1,y1=[float(word.get(k)) for k in ('xMin','yMin','xMax','yMax')]
            if x0 < -1 or y0 < -1 or x1>float(page.get('width'))+1 or y1>float(page.get('height'))+1:
                failures.append(f'{n}: word outside canvas: {word.text}')
            words.append(((x0+x1)/2,(y0+y1)/2,word.text or ''))
        for shape in slide.shapes:
            if not shape.has_text_frame or not shape.text.strip():
                continue
            fields+=1
            x,y,w,h=[getattr(shape,k).pt for k in ('left','top','width','height')]
            visible=' '.join(t for cx,cy,t in words if x-1.5<=cx<=x+w+1.5 and y-1.5<=cy<=y+h+1.5)
            missing=tokens(shape.text)-tokens(visible)
            if missing:
                failures.append(f'{n}/{shape.name}: inspect text outside its box or changed by export: {dict(missing)}')
    if failures:
        raise SystemExit('\n'.join(failures))
    print(f'{len(pages)} pages; {fields} native text fields found in their exported boxes.')

if __name__=='__main__':
    main()
