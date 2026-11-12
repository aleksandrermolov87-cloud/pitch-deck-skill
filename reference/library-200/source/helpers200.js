const L=require('./lib.js');
const {C}=L;
const U=144;
const text=(x,y,w,h,s,px=32,b=false,color=C.ink,extra={})=>L.text(x/U,y/U,w/U,h/U,s,{size:px/2,bold:b,color,ls:1.1,...extra});
const rect=(x,y,w,h,fill=C.card,extra={})=>L.rect(x/U,y/U,w/U,h/U,{fill,...extra});
const line=(x1,y1,x2,y2,color=C.rule,width=1,arrow=false)=>({t:'line',x:Math.min(x1,x2)/U,y:Math.min(y1,y2)/U,w:Math.abs(x2-x1)/U,h:Math.abs(y2-y1)/U,flipV:y2<y1,flipH:x2<x1,color,lw:width/2,arrow});
const img=(x,y,w,h,file)=>L.image(x/U,y/U,w/U,h/U,file,{contain:true});
const title=(s)=>text(88,68,1610,190,s,62,true);
const logo=s=>({...img(1789,65,43,43*50/33,`alfa-mark-${[170,174].includes(s.id)?'white':'black'}.svg`),brandMark:true});
const foot=(s='Демонстрационный материал',color=C.muted,width=1650)=>text(88,1011,width,30,s,20,false,color);
const block=(x,y,w,head,body,{size=34,bodySize=28,color=C.ink,accent=false}={})=>[
 text(x,y,w,100,head,size,true,accent?C.accent:color),
 text(x,y+110,w,170,body,bodySize,false,color)
];
const mark=(x,y,w,s,color=C.accent)=>[
 line(x,y,x+w,y,color,2), text(x,y+22,w,72,s,30,true,color)
];
function device(kind,x,y,w,screen){const r=kind==='macbook'?400/650:2;return img(x,y,w,w*r,`${kind}-${screen}.png`);}
function slide(id,name,category,question,pattern,ancestors,draw,contract={}){
 return {id,name,category,question,pattern,ancestors,status:'candidate',contract,draw};
}
function result(s){
 const els=s.draw();
 if(!s.noLogo)els.push(logo(s));
 if(!s.noFoot)els.push(foot(s.screenNote,s.footerColor,s.footerWidth));
 const visual=require('./visual200.js').finish(s,els);
 return {archetype:`library-${s.category}`,custom:`Новая композиция ${s.id}; явный запрос расширения библиотеки`,notes:`Композиция ${s.id}. ${s.name}. Вопрос: ${s.question}. Паттерн: ${s.pattern}. Источники: ${s.ancestors.join(', ')}. Статус: ${s.status}. Фон — исходная светлая поверхность основной библиотеки.`,...visual};
}
module.exports={L,C,U,text,rect,line,img,title,logo,foot,block,mark,device,slide,result};
