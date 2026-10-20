const {test}=require('node:test');
const assert=require('node:assert/strict');
const {QUESTIONS}=require('../questions.js');
const {LECTURE_QUESTIONS}=require('../lecture-questions.js');
const {FRESH_QUESTIONS,FRESH_SOURCES}=require('../fresh-questions.js');
const core=require('../core.js');
const banks=require('../question-banks.js');
const all=[...QUESTIONS,...LECTURE_QUESTIONS,...FRESH_QUESTIONS];

test('new exam bank contains 30 OX questions, 9 reported examples and 21 new practice questions',()=>{
  assert.equal(FRESH_QUESTIONS.length,30);
  assert.deepEqual(FRESH_QUESTIONS.map(q=>q.id),Array.from({length:30},(_,i)=>301+i));
  assert.equal(FRESH_QUESTIONS.filter(q=>q.examExample).length,9);
  assert.equal(FRESH_QUESTIONS.filter(q=>q.answer[0]===0).length,15);
  for(const q of FRESH_QUESTIONS){
    assert.equal(q.type,'ox');assert.equal(q.bank,'fresh');assert.equal(q.options.length,2);
    assert.ok(q.prompt&&q.explanation&&q.tag&&q.lectureRefs.length);
    assert.equal(core.grade(q,q.answer),true);
    assert.equal(core.grade(q,[1-q.answer[0]]),false);
    assert.equal(q.tag,q.examExample?'후기 예시':'강조 주제 보강');
    for(const [lecture,page] of q.lectureRefs)assert.ok(page>0&&page<=({1:31,3:36,4:48,5:35})[lecture]);
    for(const ref of q.refs)assert.ok(FRESH_SOURCES[ref].url.startsWith('https://ods.od.nih.gov/'));
  }
  // The answer sequence is transcribed from the supplied exam-information screenshot.
  assert.deepEqual(FRESH_QUESTIONS.slice(0,9).map(q=>q.answer[0]),[0,0,1,1,1,1,1,0,0]);
});

test('all three banks have independent IDs, labels, navigation and study progress',()=>{
  assert.equal(all.length,160);assert.equal(new Set(all.map(q=>q.id)).size,160);
  assert.equal(new Set(FRESH_QUESTIONS.map(q=>q.prompt)).size,30);
  assert.equal(banks.select(all,'fresh').length,30);
  assert.equal(banks.select(all,'jokbo').length,30);
  assert.equal(banks.select(all,'lecture').length,100);
  assert.equal(banks.label('fresh'),'신 족보');assert.equal(banks.view('fresh'),'fresh');
  assert.equal(banks.code(FRESH_QUESTIONS[0]),'신 01');
  const state={version:1,records:{1:core.record(QUESTIONS[0],[1]),101:core.record(LECTURE_QUESTIONS[0],LECTURE_QUESTIONS[0].answer)},bookmarks:[1,101]};
  assert.deepEqual(core.restore(JSON.stringify(state),all),state);
  assert.equal(core.stats(banks.records(state,FRESH_QUESTIONS)).done,0);
  const q=FRESH_QUESTIONS[0];state.records[q.id]=core.record(q,[1]);
  assert.equal(core.stats(banks.records(state,FRESH_QUESTIONS)).wrong,1);
  assert.equal(core.stats(banks.records(state,banks.select(all,'jokbo'))).wrong,1);
  assert.equal(core.stats(banks.records(state,LECTURE_QUESTIONS)).done,1);
});

test('completed fresh bank can restart repeatedly while preserving other banks and history',()=>{
  const state={version:1,records:Object.fromEntries(all.map(q=>[q.id,core.record(q,q.type==='text'?q.accepted[0]:q.answer)])),bookmarks:[1,101,301]};
  state.records[301]=core.record(FRESH_QUESTIONS[0],[1],state.records[301]);
  const restarted=core.restore(JSON.stringify(core.restart(state,FRESH_QUESTIONS)),all);
  assert.equal(core.stats(banks.records(restarted,FRESH_QUESTIONS)).done,0);
  assert.equal(core.stats(banks.records(restarted,QUESTIONS)).done,30);
  assert.equal(core.stats(banks.records(restarted,LECTURE_QUESTIONS)).done,100);
  assert.deepEqual(restarted.bookmarks,[1,101,301]);
  for(const q of FRESH_QUESTIONS)restarted.records[q.id]=core.record(q,q.answer,restarted.records[q.id]);
  assert.equal(core.stats(banks.records(restarted,FRESH_QUESTIONS)).done,30);
  assert.equal(restarted.records[301].attempts,3);assert.equal(restarted.records[301].wrongAttempts,1);
  assert.equal(core.stats(banks.records(core.restart(restarted,FRESH_QUESTIONS),FRESH_QUESTIONS)).done,0);
});
