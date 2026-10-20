const QuizBanks = (() => {
  const select=(questions,bank)=>bank==='all'?questions:questions.filter(q=>(q.bank||'jokbo')===bank);
  const number=q=>q.number||q.id;
  const label=bank=>({jokbo:'족보학습',lecture:'강의자료 예상문제',all:'전체 문제'}[bank]||'전체 문제');
  const records=(state,questions)=>Object.fromEntries(questions.filter(q=>state.records[q.id]).map(q=>[q.id,state.records[q.id]]));
  const code=q=>`${(q.bank||'jokbo')==='jokbo'?'족보':'예상'} ${String(number(q)).padStart(2,'0')}`;
  return {select,number,label,records,code};
})();
if(typeof module!=='undefined') module.exports=QuizBanks;
else {
  for(const q of QUESTIONS){q.bank='jokbo';q.number=q.id;}
  const evidence={2:[[3,18]],5:[[4,18]],6:[[3,13]],7:[[3,26]],8:[[5,11],[5,29]],9:[[4,16]],10:[[4,11],[4,29]],11:[[3,7]],12:[[3,30],[4,22]],13:[[3,30]],14:[[4,41],[4,43]],15:[[4,38],[4,42],[4,43]],19:[[4,36]],20:[[5,11]],26:[[5,20]],27:[[3,31]],30:[[4,19]]};
  for(const q of QUESTIONS)if(evidence[q.id])q.lectureRefs=evidence[q.id];
}
const QUESTION_BANK = typeof module==='undefined'?[...QUESTIONS,...LECTURE_QUESTIONS]:[];
