const {result}=require('./helpers200.js');
const fs=require('fs'),path=require('path');
const S=[...require('./covers200.js').S,...require('./text200.js').S,...require('./hybrid200.js').S,...require('./mockups200.js').S].sort((a,b)=>a.id-b.id);
if(S.length!==48||new Set(S.map(s=>s.id)).size!==48||S[0].id!==153||S.at(-1).id!==200)throw Error('Нужны ровно 48 уникальных ID 153–200');
const decisionsPath=path.resolve(__dirname,'../approval.json');
if(fs.existsSync(decisionsPath)){
 const decisions=JSON.parse(fs.readFileSync(decisionsPath,'utf8'));
 for(const s of S){
  if(decisions.approved?.includes(s.id))s.status='approved';
  if(decisions.rejected?.includes(s.id))s.status='rejected';
 }
}
function compose(id,content={},options={}){
 const spec=S.find(s=>s.id===id);if(!spec)throw Error(`Неизвестная композиция ${id}`);
 if(spec.status!=='approved'&&!options.review)throw Error(`Композиция ${id} ещё не утверждена; доступна только для review`);
 const slide=result(spec);
 const used=new Set();
 let ti=0,ii=0;
 for(const e of slide.els){
  if(e.t==='text'){
   e.id=`c${id}.text${++ti}`;
   if(Object.hasOwn(content,e.id)){e.runs=[{t:String(content[e.id])}];used.add(e.id);}
  }else if(e.t==='image'&&!e.brandMark){
   e.id=`c${id}.image${++ii}`;
   if(Object.hasOwn(content,e.id)){e.file=String(content[e.id]);used.add(e.id);}
  }else if(e.brandMark)e.id=`c${id}.brand`;
 }
 const unknown=Object.keys(content).filter(k=>!used.has(k));if(unknown.length)throw Error(`Неизвестные поля: ${unknown.join(', ')}`);
 return slide;
}
module.exports={S,compose};
