const {test}=require('node:test');
const assert=require('node:assert/strict');
const {QUESTIONS}=require('../questions.js');
const core=require('../core.js');
test('30 unique complete questions and valid answers',()=>{
  assert.equal(QUESTIONS.length,30);
  assert.deepEqual(QUESTIONS.map(q=>q.id),Array.from({length:30},(_,i)=>i+1));
  for(const q of QUESTIONS){assert.ok(q.prompt&&q.explanation&&q.category&&q.page);if(q.type==='text')assert.ok(q.accepted.length);else{assert.equal(new Set(q.options).size,q.options.length);assert.ok(q.answer.length);for(const i of q.answer)assert.ok(i>=0&&i<q.options.length);}}
});
test('all question answers grade correctly; alternatives fail',()=>{
  for(const q of QUESTIONS){if(q.type==='text'){for(const answer of q.accepted)assert.equal(core.grade(q,answer),true);assert.equal(core.grade(q,'비타민C'),false);}else{assert.equal(core.grade(q,[...q.answer].reverse()),true);assert.equal(core.grade(q,[]),false);for(let i=0;i<q.options.length;i++){const set=q.answer.includes(i)?q.answer.filter(x=>x!==i):[...q.answer,i];assert.equal(core.grade(q,set),false);}}}
});
test('multiple choice requires exactly the correct set',()=>{const q=QUESTIONS[26];assert.equal(core.grade(q,[0,1,2]),true);assert.equal(core.grade(q,[0,1]),false);assert.equal(core.grade(q,[0,1,2,3]),false);assert.equal(core.grade(q,[0,0,1,2]),false);});
test('Korean and English short answer normalization',()=>{const q=QUESTIONS[18];for(const value of [' 비타민 B9 ','Ｂ９','Folic Acid','엽산 (비타민 B9)'])assert.equal(core.grade(q,value),true);for(const value of ['','비타민B','엽산을모름'])assert.equal(core.grade(q,value),false);});
test('wrong answer is removed from current wrongs when corrected but history remains',()=>{const q=QUESTIONS[1],wrong=core.record(q,[0]),right=core.record(q,[1],wrong);assert.equal(wrong.correct,false);assert.equal(right.correct,true);assert.equal(right.attempts,2);assert.equal(right.wrongAttempts,1);assert.deepEqual(core.stats({2:right}),{done:1,correct:1,wrong:0,rate:100});});
test('persistent state round trip and recomputed result',()=>{const q=QUESTIONS[0],r=core.record(q,[0]);const s={version:1,records:{1:r},bookmarks:[1,4]};assert.deepEqual(core.restore(JSON.stringify(s),QUESTIONS),s);r.correct=false;assert.equal(core.restore(JSON.stringify(s),QUESTIONS).records[1].correct,true);});
test('malformed or incompatible data safely resets; invalid fields excluded',()=>{for(const value of ['{','null','[]','{"version":2}','{"version":1,"records":null}'])assert.deepEqual(core.restore(value,QUESTIONS),{version:1,records:{},bookmarks:[]});const result=core.restore(JSON.stringify({version:1,records:{1:{attempts:1,wrongAttempts:0,value:[9]},2:{attempts:1,wrongAttempts:1,value:[0]}},bookmarks:[1,1,31,'4']}),QUESTIONS);assert.deepEqual(Object.keys(result.records),['2']);assert.deepEqual(result.bookmarks,[1]);});
