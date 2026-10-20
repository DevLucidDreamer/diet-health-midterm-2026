/* Shared scoring and storage validation, independent of the UI. */
const QuizCore = (() => {
  const normalize = value => String(value).normalize('NFKC').toLowerCase().replace(/[\s·.,()\-_:]/g,'');
  function grade(q, value) {
    if(q.type==='text') return q.accepted.some(answer => normalize(answer)===normalize(value));
    if(!Array.isArray(value) || new Set(value).size!==value.length) return false;
    return value.length===q.answer.length && q.answer.every(i=>value.includes(i));
  }
  function record(q, value, previous, now = new Date().toISOString()) {
    const correct=grade(q,value);
    return {correct, value, attempts:(previous?.attempts||0)+1, wrongAttempts:(previous?.wrongAttempts||0)+(correct?0:1), updatedAt:now};
  }
  function restore(raw, questions) {
    const empty = () => ({version:1,records:{},bookmarks:[]});
    if(!raw) return empty();
    try {
      const parsed=JSON.parse(raw);
      if(parsed.version!==1 || !parsed.records || typeof parsed.records!=='object') return empty();
      const result=empty();
      for(const q of questions) {
        const r=parsed.records[q.id];
        if(!r || !Number.isSafeInteger(r.attempts) || r.attempts<1 || !Number.isSafeInteger(r.wrongAttempts) || r.wrongAttempts<0 || r.wrongAttempts>r.attempts) continue;
        if(q.type==='text' ? typeof r.value!=='string' || r.value.length>500 : !Array.isArray(r.value) || !r.value.length || new Set(r.value).size!==r.value.length || !r.value.every(i=>Number.isInteger(i) && i>=0 && i<q.options.length)) continue;
        const correct=grade(q,r.value);
        if(!correct && r.wrongAttempts===0) continue;
        result.records[q.id]={correct,value:r.value,attempts:r.attempts,wrongAttempts:r.wrongAttempts,updatedAt:typeof r.updatedAt==='string'?r.updatedAt:''};
        if(r.pending===true) result.records[q.id].pending=true;
      }
      result.bookmarks=Array.isArray(parsed.bookmarks)?[...new Set(parsed.bookmarks.filter(id=>questions.some(q=>q.id===id)))]:[];
      return result;
    } catch { return empty(); }
  }
  function stats(records) {
    const values=Object.values(records).filter(r=>!r.pending);
    const correct=values.filter(r=>r.correct).length;
    return {done:values.length,correct,wrong:values.length-correct,rate:values.length?Math.round(correct/values.length*100):null};
  }
  function restart(state, questions) {
    const records={...state.records};
    for(const q of questions) if(records[q.id]) records[q.id]={...records[q.id],pending:true};
    return {...state,records};
  }
  return {normalize,grade,record,restore,stats,restart};
})();
if(typeof module!=='undefined') module.exports=QuizCore;
