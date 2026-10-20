const {test}=require('node:test');
const assert=require('node:assert/strict');
const {QUESTIONS}=require('../questions.js');
const {LECTURE_QUESTIONS}=require('../lecture-questions.js');
const banks=require('../question-banks.js');
const core=require('../core.js');
const all=[...QUESTIONS,...LECTURE_QUESTIONS];
test('jokbo bank stays at 30; lecture bank has 100 new questions without overlapping ids',()=>{
  assert.equal(banks.select(all,'jokbo').length,30);
  assert.equal(banks.select(all,'lecture').length,100);
  assert.equal(banks.select(all,'all').length,130);
  assert.equal(new Set(all.map(q=>q.id)).size,130);
  assert.equal(new Set(all.map(q=>q.prompt)).size,130);
  assert.deepEqual(LECTURE_QUESTIONS.map(banks.number),Array.from({length:100},(_,i)=>i+1));
});
test('100 lecture questions have valid answers, explanation, and traceable page numbers',()=>{
  const pageLimits={1:31,2:31,3:36,4:48,5:35};
  const counts={1:0,2:0,3:0,4:0,5:0};
  for(const q of LECTURE_QUESTIONS){
    counts[q.lecture]++;
    assert.ok(q.page>=1 && q.page<=pageLimits[q.lecture],q.prompt);
    assert.ok(q.sourceLabel.includes(`${q.lecture}강`));
    assert.ok(q.explanation.length>20);
    if(q.type==='text'){
      for(const accepted of q.accepted)assert.equal(core.grade(q,accepted),true);
      assert.equal(core.grade(q,'잘모름'),false);
    }else{
      assert.equal(new Set(q.options).size,q.options.length);
      assert.equal(core.grade(q,[...q.answer].reverse()),true);
      for(let i=0;i<q.options.length;i++){
        const value=q.answer.includes(i)?q.answer.filter(a=>a!==i):[...q.answer,i];
        assert.equal(core.grade(q,value),false,`${q.id}:${i}`);
      }
    }
  }
  assert.deepEqual(counts,{1:10,2:10,3:25,4:35,5:20});
});
test('existing v1 records and bookmarks survive adding a separate lecture bank',()=>{
  const original=core.record(QUESTIONS[0],[1]);
  const old={version:1,records:{1:original},bookmarks:[1,27]};
  const state=core.restore(JSON.stringify(old),all);
  assert.deepEqual(state,old);
  assert.deepEqual(core.stats(banks.records(state,banks.select(all,'lecture'))),{done:0,correct:0,wrong:0,rate:null});
  state.records[101]=core.record(LECTURE_QUESTIONS[0],LECTURE_QUESTIONS[0].answer);
  assert.equal(core.stats(banks.records(state,banks.select(all,'jokbo'))).wrong,1);
  assert.equal(core.stats(banks.records(state,banks.select(all,'lecture'))).correct,1);
  assert.deepEqual(core.restore(JSON.stringify(state),all),state);
});
test('correcting lecture mistake preserves jokbo mistake and both histories',()=>{
  const a=QUESTIONS[0],b=LECTURE_QUESTIONS[0];
  const state={records:{1:core.record(a,[1]),101:core.record(b,[0])}};
  assert.equal(state.records[101].correct,false);
  state.records[101]=core.record(b,b.answer,state.records[101]);
  assert.equal(state.records[101].wrongAttempts,1);
  assert.equal(core.stats(banks.records(state,banks.select(all,'lecture'))).wrong,0);
  assert.equal(core.stats(banks.records(state,banks.select(all,'jokbo'))).wrong,1);
});
