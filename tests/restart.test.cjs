const {test}=require('node:test');
const assert=require('node:assert/strict');
const {QUESTIONS}=require('../questions.js');
const {LECTURE_QUESTIONS}=require('../lecture-questions.js');
const core=require('../core.js');
const banks=require('../question-banks.js');
const all=[...QUESTIONS,...LECTURE_QUESTIONS];
const value=q=>q.type==='text'?q.accepted[0]:q.answer;
const completed=()=>({version:1,records:Object.fromEntries(all.map(q=>[q.id,core.record(q,value(q))])),bookmarks:[1,101]});

for(const bank of ['jokbo','lecture'])test(`restarting ${bank} resets only its progress and survives reload`,()=>{
  const original=completed(),questions=banks.select(all,bank),other=banks.select(all,bank==='jokbo'?'lecture':'jokbo');
  const restarted=core.restart(original,questions);
  assert.equal(core.stats(banks.records(restarted,questions)).done,0);
  assert.equal(core.stats(banks.records(restarted,other)).done,other.length);
  assert.deepEqual(restarted.bookmarks,original.bookmarks);
  assert.equal(core.stats(original.records).done,130);
  assert.deepEqual(core.restore(JSON.stringify(restarted),all),restarted);
  for(const q of questions)restarted.records[q.id]=core.record(q,value(q),restarted.records[q.id]);
  assert.equal(core.stats(banks.records(restarted,questions)).done,questions.length);
  assert.equal(restarted.records[questions[0].id].attempts,2);
  assert.equal(core.stats(banks.records(core.restart(restarted,questions),questions)).done,0);
});

test('re-answering after restart retains cumulative mistakes and tracks the new result',()=>{
  const q=QUESTIONS[0],wrong=core.record(q,[1]);
  assert.equal(wrong.correct,false);
  const state=core.restart({version:1,records:{1:wrong},bookmarks:[1]},QUESTIONS);
  assert.equal(state.records[1].wrongAttempts,1);
  assert.deepEqual(core.stats(state.records),{done:0,correct:0,wrong:0,rate:null});
  state.records[1]=core.record(q,value(q),state.records[1]);
  assert.equal(state.records[1].attempts,2);
  assert.equal(state.records[1].wrongAttempts,1);
  assert.equal(state.records[1].pending,undefined);
  assert.deepEqual(core.stats(state.records),{done:1,correct:1,wrong:0,rate:100});
  assert.deepEqual(core.restore(JSON.stringify(state),all),state);
});
