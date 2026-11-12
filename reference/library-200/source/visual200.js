// Visual finish shares the actual main-library surfaces. It never changes copy,
// text/image slot order, scale, arrow routing, or the candidate approval status.
const {C}=require('./lib.js');
const U=144;
const line=(x1,y1,x2,y2,color=C.accent,width=3)=>({t:'line',x:x1/U,y:y1/U,w:(x2-x1)/U,h:(y2-y1)/U,color,lw:width/2,visualRole:'accent-rule'});
const rules={
 153:[[88,230,210,230]],155:[[1000,610,1120,610]],157:[[770,265,890,265]],
 160:[[88,225,208,225]],161:[[88,225,208,225]],
 165:[[88,320,208,320]],166:[[88,265,190,265]],
 169:[[88,330,208,330]],173:[[88,285,208,285]],176:[[88,450,208,450]],178:[[88,305,208,305]],
 181:[[88,330,208,330]],182:[[1350,320,1470,320]],184:[[88,335,208,335]],186:[[1320,320,1440,320]],
 191:[[88,345,208,345]],195:[[88,610,208,610]],197:[[1080,320,1200,320]],200:[[88,355,208,355]]
};
const emphasis={
 155:['Нефинансовые'],158:['задача клиента'],160:['задач'],161:['комитету'],162:['клиентских сервисов'],163:['завершить задачу?'],
 166:['проверки спроса'],167:['полезного результата'],169:['понимать результат'],170:['Проверка спроса'],176:['выбранного сегмента']
};
function accentRuns(e,phrases){
 let runs=e.runs;
 for(const phrase of phrases){
  runs=runs.flatMap(r=>{
   const at=r.t.indexOf(phrase);if(at<0)return [r];
   return [{...r,t:r.t.slice(0,at)},{...r,t:phrase,c:C.accent},{...r,t:r.t.slice(at+phrase.length)}].filter(r=>r.t);
  });
 }
 return runs;
}
function finish(spec,els){
 if(spec.art)return {bg:'main-surface-s2.jpg',els,decoration:{surface:'main library with authored full-bleed planes',art:true}};
 for(const e of els){
  if(e.t==='text'&&emphasis[spec.id])e.runs=accentRuns(e,emphasis[spec.id]);
  if(e.t==='line'&&e.arrow){e.color=C.accent;e.lw=Math.max(e.lw||1,1.35);}
  if(e.t==='line'&&e.color===C.accent)e.lw=Math.max(e.lw||1,1.15);
  if(e.t==='image'&&/^(macbook|iphone)-/.test(e.file))e.shadow={type:'outer',color:'735551',blur:5,angle:90,distance:3,opacity:0.12};
 }
 const extra=(rules[spec.id]||[]).map(a=>line(...a));
 // Underlays precede the content; no new substitute field is introduced.
 return {bg:`main-surface-${spec.category==='cover'?'cover':spec.category==='mockup'?'s4':spec.category==='hybrid'?'s3':'s2'}.jpg`,els:[...extra,...els],decoration:{surface:'exact main library asset',accentRules:extra.length,emphasis:emphasis[spec.id]||[],deviceShadow:spec.category==='mockup'}};
}
module.exports={finish};
