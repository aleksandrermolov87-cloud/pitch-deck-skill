const {S,compose}=require('./collection200.js');
const ids=process.env.CANDIDATE_IDS?.split(',').map(Number);
const selected=ids?S.filter(s=>ids.includes(s.id)):S;
module.exports={S:selected.map(s=>()=>compose(s.id))};
