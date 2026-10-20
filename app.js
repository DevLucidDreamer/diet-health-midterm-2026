(() => {
  'use strict';
  const QUESTIONS=QUESTION_BANK;
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const KEY='food-wellness-quiz-v1';
  let canStore=true, state;
  try { state=QuizCore.restore(localStorage.getItem(KEY),QUESTIONS); localStorage.setItem(KEY,JSON.stringify(state)); }
  catch {canStore=false;state=QuizCore.restore(null,QUESTIONS);}
  const VIEWS=['fresh','practice','lecture','wrong','answers'];
  let view=VIEWS.includes(location.hash.slice(1))?location.hash.slice(1):'fresh';
  let order=QUESTIONS.map(q=>q.id), current=1, retry=false, selected=[], toastTimer;
  function save() {try{localStorage.setItem(KEY,JSON.stringify(state));}catch{canStore=false;}$('#storage-warning').hidden=canStore;}
  function isStudy(){return ['fresh','practice','lecture'].includes(view);}
  function activeBank(){return ({fresh:'fresh',practice:'jokbo',lecture:'lecture'})[view]||$('#scope').value;}
  function pool(){return QuizBanks.select(QUESTIONS,activeBank());}
  function statsForPool(){return QuizCore.stats(QuizBanks.records(state,pool()));}
  function filtered() {
    const category=$('#category').value,status=$('#status').value,search=QuizCore.normalize($('#search').value);
    return order.map(id=>QUESTIONS.find(q=>q.id===id)).filter(q=>{
      if(activeBank()!=='all' && q.bank!==activeBank())return false;
      if(activeBank()==='lecture' && $('#lecture').value!=='all' && q.lecture!==Number($('#lecture').value))return false;
      const r=state.records[q.id];
      if(category!=='all' && q.category!==category) return false;
      if(search && !QuizCore.normalize(`${QuizBanks.number(q)} ${q.prompt} ${q.category} ${QuizBanks.code(q)}`).includes(search)) return false;
      if(view==='wrong') return $('#ever-wrong').checked ? r?.wrongAttempts>0 : r && !r.pending && !r.correct;
      if(view==='answers') return true;
      if(status==='unanswered') return !r || r.pending;
      if(status==='wrong') return r && !r.pending && !r.correct;
      if(status==='correct') return r && !r.pending && r.correct;
      if(status==='bookmark') return state.bookmarks.includes(q.id);
      return true;
    });
  }
  function updateStats() {
    const s=statsForPool(),total=pool().length;
    $('#stat-bank').textContent=activeBank()==='lecture'?'예상문제':QuizBanks.label(activeBank());
    $('#stat-total').innerHTML=`${total}<small>문항</small>`;
    $('#stat-done').innerHTML=`${s.done}<small>/ ${total}</small>`;
    $('#stat-rate').innerHTML=s.rate===null?'—':`${s.rate}<small>%</small>`;
    $('#stat-wrong').innerHTML=`${s.wrong}<small>문항</small>`;
    $('#wrong-count').textContent=s.wrong;
    $('#progress-bar').style.width=`${s.done/total*100}%`;
    $('#progress-text').textContent=s.done===total?`${total}문항을 모두 학습했어요!`:s.done?`${total-s.done}문항 더 풀면 한 바퀴 완성`:'오늘의 한 문제부터 시작해요';
    $('#storage-warning').hidden=canStore;
    $('#restart').hidden=!isStudy() || s.done!==total;
  }
  function typeLabel(q){return {ox:'O / X',single:'객관식',multi:'복수선택',text:'단답형'}[q.type];}
  function answerLabel(q){return q.type==='text'?q.answerText:q.answer.map(i=>q.options[i]).join(' / ');}
  function metadata(q){return `<span class="q-number">${esc(QuizBanks.code(q))}</span>${q.bank==='lecture'?`<span class="badge lecture-badge">${q.lecture}강 · 예상문제</span>`:''}<span class="badge">${esc(q.category)}</span><span class="badge">${typeLabel(q)}</span>${q.tag?`<span class="badge modified">${esc(q.tag)}</span>`:''}`;}
  function sourceHTML(q){
    if(q.bank==='fresh')return `<span>${q.examExample?'제공된 시험 후기의 예시 · 표현 정리':'제공된 대화의 강조 주제로 새로 작성'}</span>${q.lectureRefs.map(r=>`<span>${r[0]}강 · PDF ${r[1]}쪽</span>`).join('')}${q.refs.map(key=>{const s=FRESH_SOURCES[key];return `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ↗</a>`;}).join('')}`;
    if(q.bank==='lecture')return `<span>${esc(q.sourceLabel)} · 제공된 강의자료에서 출제</span>`;
    const lectureRefs=(q.lectureRefs||[]).map(r=>`<span>${r[0]}강 · PDF ${r[1]}쪽</span>`).join('');
    return `<span>족보 PDF ${q.page}쪽 · ${q.id}번</span>${lectureRefs}${(q.refs||[]).map(key=>{const s=sources[key];return s.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ↗</a>`:`<span>1·2강 자료 · PDF ${q.lecturePage}쪽</span>`;}).join('')}${!q.refs?.length&&!q.lectureRefs?.length?'<span>기초 영양학 보충 해설</span>':''}`;
  }
  function explanation(q, record, answerOnly=false) {
    const success=answerOnly || record.correct;
    return `<section class="feedback ${success?'':'incorrect'}" aria-label="정답과 해설">
      <h3 ${answerOnly?'':'id="feedback-title" tabindex="-1" role="status"'}>${answerOnly?'정답과 해설':success?'✓ 정답이에요. 잘 이해했어요!':'다시 기억해 볼까요?'}</h3>
      <p class="answer-line">정답 · ${esc(answerLabel(q))}</p>
      ${!answerOnly && q.type==='text'?`<p class="q-help">내 답: ${esc(record.value)}</p>`:''}
      <p class="explanation">${esc(q.explanation)}</p>
      <div class="source-links">${sourceHTML(q)}</div>
      ${q.original?`<details class="origin"><summary>족보 원문과 복원 내용 확인</summary><p>${esc(q.original)}</p><p>학습 문항은 위에 표시된 문장·보기 기준으로 채점됩니다. 미복원 원문의 공식 정답을 뜻하지 않습니다.</p></details>`:''}
      ${answerOnly?'':`<div class="feedback-actions"><button data-action="retry">다시 풀기 ↻</button><span class="q-help" style="margin:0">${record.attempts}회 풀이 · 누적 오답 ${record.wrongAttempts}회</span></div>`}
    </section>`;
  }
  function questionHTML(q, ids) {
    const record=state.records[q.id],answered=record && !record.pending && !retry,index=ids.indexOf(q.id),isBookmarked=state.bookmarks.includes(q.id);
    let answers='';
    if(q.type==='text') {
      answers=answered?'':`<form id="short-form" class="short-form"><label class="sr-only" for="short-answer">정답 입력</label><input id="short-answer" type="text" maxlength="100" placeholder="정답을 입력하세요" autocomplete="off" required><button class="primary-btn" type="submit">정답 확인</button></form>`;
    } else {
      answers=`<div class="options ${q.type==='ox'?'ox':''}" ${q.type==='multi'?'role="group" aria-label="정답을 모두 선택하세요"':''}>${q.options.map((option,i)=>{
        const chosen=answered?record.value.includes(i):selected.includes(i);
        const right=answered && q.answer.includes(i),wrong=answered && chosen && !right;
        return `<button class="option ${chosen?'selected':''} ${right?'is-correct':''} ${wrong?'is-wrong':''}" data-choice="${i}" ${answered?'disabled':''} ${q.type==='multi'?`aria-pressed="${chosen}"`:''}><span class="option-index">${q.type==='ox'?(i===0?'O':'×'):q.type==='multi'?(chosen?'✓':String(i+1)):String(i+1)}</span><span>${esc(q.type==='ox'?(i===0?'맞다':'틀리다'):option)}</span>${answered && q.type!=='ox' && (right||wrong)?`<span class="option-check" aria-label="${right?'정답':'오답'}">${right?'✓':'×'}</span>`:''}</button>`;
      }).join('')}</div>${q.type==='multi' && !answered?`<button id="grade-multi" class="primary-btn grade-multi" ${selected.length?'':'disabled'}>선택한 답 채점하기</button>`:''}`;
    }
    return `<article class="question-card" aria-labelledby="question-title"><div class="question-meta"><div class="question-badges">${metadata(q)}</div><button class="bookmark-btn ${isBookmarked?'on':''}" data-action="bookmark" aria-label="${isBookmarked?'북마크 해제':'북마크 추가'}" aria-pressed="${isBookmarked}">${isBookmarked?'★':'☆'}</button></div><h2 id="question-title">${esc(q.prompt)}</h2><p class="q-help">${answered?'이 문제의 최근 풀이 결과입니다.':q.type==='text'?'입력 후 정답 확인을 누르면 바로 채점됩니다.':q.type==='multi'?'맞는 보기를 모두 선택한 후 채점하세요.':q.type==='ox'?'O 또는 X를 선택하면 바로 채점됩니다.':'보기를 선택하면 바로 채점됩니다.'}</p>${answers}${answered?explanation(q,record):''}</article>
      <div class="question-bottom"><span>${q.bank==='fresh'?(q.examExample?'✳ 제공된 후기 예시 · 표현 정리':'✳ 강조 주제로 새로 만든 O/X 연습문제'):q.bank==='lecture'?`✳ ${q.lecture}강 기반 예상문제 · 실제 출제를 보장하지 않습니다.`:q.tag?'✳ 원문의 누락·표현을 보완한 학습 문항입니다.':'✳ 족보에 수록된 문항입니다.'}</span><div class="nav-actions"><button data-action="previous" ${index<=0?'disabled':''}>← 이전</button><button data-action="next" class="next">${index<0?'남은 문제 보기':index===ids.length-1?'학습 결과 보기':'다음 문제 →'}</button></div></div>`;
  }
  function render(hold=false) {
    updateStats();
    document.querySelectorAll('[data-view]').forEach(button=>{const active=button.dataset.view===view;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
    $('#wrong-tools').hidden=view!=='wrong';$('#status-wrap').hidden=!isStudy();$('#shuffle').hidden=view==='answers';
    $('#scope-wrap').hidden=isStudy();$('#lecture-wrap').hidden=activeBank()!=='lecture';
    $('#fresh-info').hidden=view!=='fresh';
    $('#bank-title').textContent=view==='fresh'?'신 족보 · 기능으로 기억하는 O/X 30문항.':view==='practice'?'족보에 있는 문제만, 한 번 더.':view==='lecture'?'강의의 핵심 개념을 예상문제로.':view==='wrong'?'틀린 문제를 문제집별로 골라 복습해요.':'문제집별 정답과 근거를 확인해요.';
    $('#bank-description').textContent=view==='fresh'?'2026.10.20 제공된 시험정보 반영 · 후기 예시 9문항 + 강조 주제 보강 21문항. 비타민의 기능, 아연·구리, 베타카로틴, EPA·DHA를 중심으로 연습해요.':view==='practice'?'족보 30문항만 포함됩니다. 원문의 누락·불명확한 표현을 복원한 문항은 표시되어 있어요.':view==='lecture'?'1~5강에서 새로 만든 100문항입니다. 강의별로 골라 풀고, 해설에서 PDF 쪽수를 확인하세요.':`${QuizBanks.label(activeBank())} 기준으로 표시합니다. 문제집 선택에서 신 족보·족보·예상문제·전체를 바꿀 수 있어요.`;
    const list=filtered(),ids=list.map(q=>q.id);
    if(!hold && !ids.includes(current)){current=ids[0]||null;retry=false;selected=[];}
    $('#map-count').textContent=`${list.length}문항`;
    $('#list-label').innerHTML=`${view==='wrong'?($('#ever-wrong').checked?'틀렸던 모든 문제':'복습할 오답'):view==='answers'?'정답·해설 모아보기':QuizBanks.label(activeBank())} <strong>${list.length}</strong>`;
    const index=ids.indexOf(current);
    $('#position-label').textContent=view==='answers'?'해설을 펼쳐 확인하세요':index>=0?`${String(index+1).padStart(2,'0')} / ${String(list.length).padStart(2,'0')}`:hold?'복습 완료':'';
    $('#question-map').innerHTML=list.map(q=>{const r=state.records[q.id],answered=r&&!r.pending;return `<button class="map-btn ${answered?(r.correct?'correct':'wrong'):''} ${q.id===current?'current':''} ${state.bookmarks.includes(q.id)?'bookmarked':''}" data-jump="${q.id}" aria-label="${esc(QuizBanks.code(q))}번 ${answered?(r.correct?'정답':'오답'):'미학습'}" ${q.id===current?'aria-current="true"':''}>${activeBank()==='all'?({jokbo:'족',lecture:'예',fresh:'신'})[q.bank]:''}${String(QuizBanks.number(q)).padStart(2,'0')}</button>`;}).join('');
    if(view==='answers') {
      $('#content').innerHTML=list.length?list.map(q=>`<details class="answer-item" id="answer-${q.id}"><summary><span class="q-number">${esc(QuizBanks.code(q))}</span><span class="answer-summary">${esc(q.prompt)}<br><span class="badge">${esc(q.category)}</span>${q.bank==='lecture'?`<span class="badge lecture-badge">${q.lecture}강</span>`:''}${q.tag?`<span class="badge modified">${esc(q.tag)}</span>`:''}</span><span class="answer-expand" aria-hidden="true">+</span></summary>${explanation(q,null,true)}<button class="primary-btn" data-practice="${q.id}">이 문제 다시 풀기 →</button></details>`).join(''):emptyHTML();
      return;
    }
    const q=QUESTIONS.find(q=>q.id===current);
    $('#content').innerHTML=q && (list.length || hold)?questionHTML(q,ids):emptyHTML();
  }
  function emptyHTML(){const isWrong=view==='wrong',hasFilter=$('#category').value!=='all'||$('#search').value||isStudy()&&$('#status').value!=='all'||activeBank()==='lecture'&&$('#lecture').value!=='all';return `<div class="empty"><span aria-hidden="true">${isWrong?'✓':'◒'}</span><h2>${hasFilter?'조건에 맞는 문제가 없어요':isWrong?'복습할 오답이 없어요':'아직 선택된 문제가 없어요'}</h2><p>${hasFilter?'다른 강의·주제를 선택하거나 검색어를 지워 보세요.':isWrong?'문제를 틀리면 여기에 자동으로 모아 드려요.<br>다시 맞힌 문제는 “한 번이라도 틀린 문제”에서 확인할 수 있어요.':'필터를 바꾸고 학습을 이어가세요.'}</p><button class="primary-btn" data-action="all">${QuizBanks.label(activeBank()==='all'?'jokbo':activeBank())} 학습하기 →</button></div>`;}
  function submit(value) {
    const q=QUESTIONS.find(q=>q.id===current);
    if(!q || (state.records[q.id] && !state.records[q.id].pending && !retry)) return;
    if(q.type==='text' && !QuizCore.normalize(value)) return;
    if(q.type!=='text' && !value.length) return;
    state.records[q.id]=QuizCore.record(q,value,state.records[q.id]);retry=false;selected=[];save();render(true);
    requestAnimationFrame(()=>$('#feedback-title')?.focus({preventScroll:true}));
  }
  function showToast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,3000);}
  function setView(next){const previousBank=activeBank();if(!['fresh','practice','lecture'].includes(next)&&isStudy())$('#scope').value=previousBank;view=next;resetFilters();retry=false;selected=[];history.replaceState(null,'',`#${next}`);render();}
  function navigate(delta){const ids=filtered().map(q=>q.id),idx=ids.indexOf(current);if(delta>0 && idx===ids.length-1 && idx>=0){showResults();return;}current=ids[Math.max(0,Math.min(ids.length-1,idx+delta))]||null;retry=false;selected=[];render();}
  function resetFilters(){$('#category').value='all';$('#status').value='all';$('#search').value='';$('#lecture').value='all';}
  function openDialog(title,body){$('#dialog-title').textContent=title;$('#dialog-body').innerHTML=body;$('#info-dialog').showModal();}
  function restartBank(bank){
    state=QuizCore.restart(state,QuizBanks.select(QUESTIONS,bank));
    order=QUESTIONS.map(q=>q.id);current=QuizBanks.select(QUESTIONS,bank)[0]?.id||null;
    save();if($('#info-dialog').open)$('#info-dialog').close();
    setView(QuizBanks.view(bank));
    showToast('첫 문제부터 다시 시작해요. 북마크와 누적 오답 이력은 유지됩니다.');
    $('#short-answer')?.focus();
  }
  function showResults(){
    const bank=activeBank(),s=statsForPool(),total=pool().length,complete=s.done===total;
    openDialog(`${QuizBanks.label(bank)} 학습 결과`,`<p><strong>${s.done} / ${total}문항</strong>을 학습했어요.</p><p>최근 풀이 기준 정답 ${s.correct}개 · 오답 ${s.wrong}개${s.rate===null?'':` · 정답률 ${s.rate}%`}</p><p>${complete?'한 바퀴 완성! 전체 문제를 처음부터 다시 풀거나 오답을 복습해 보세요.':'아직 풀지 않은 문제도 차근차근 이어가 보세요.'}</p>${complete?'<p>전체 다시 풀기를 누르면 선택한 문제집의 진도를 새로 시작합니다. 북마크·풀이 횟수·누적 오답 이력은 유지됩니다.</p>':''}<div class="dialog-actions">${complete?'<button class="primary-btn" id="results-restart">전체 다시 풀기 ↻</button>':'<button class="primary-btn" id="results-continue">계속 학습하기</button>'}<button class="small-btn" id="results-wrong">오답 복습하기</button></div>`);
    if(complete)$('#results-restart').onclick=()=>restartBank(bank);
    else $('#results-continue').onclick=()=>{$('#info-dialog').close();setView(QuizBanks.view(bank));$('#status').value='unanswered';render();};
    $('#results-wrong').onclick=()=>{$('#info-dialog').close();setView('wrong');$('#scope').value=bank;render();};
  }
  $('#restart').onclick=()=>restartBank(activeBank());
  document.querySelector('.tabs').addEventListener('click',event=>{const button=event.target.closest('[data-view]');if(button)setView(button.dataset.view);});
  for(const selector of ['#category','#status','#ever-wrong','#lecture','#scope']) $(selector).addEventListener('change',()=>{if(selector==='#scope')resetFilters();retry=false;selected=[];render();});
  $('#search').addEventListener('input',()=>{retry=false;selected=[];render();});
  $('#question-map').addEventListener('click',event=>{const button=event.target.closest('[data-jump]');if(!button)return;const id=Number(button.dataset.jump);if(view==='answers'){const detail=$(`#answer-${id}`);detail.open=true;detail.scrollIntoView({block:'nearest'});return;}current=id;retry=false;selected=[];render();});
  $('#content').addEventListener('submit',event=>{if(event.target.id==='short-form'){event.preventDefault();submit($('#short-answer').value.trim());}});
  $('#content').addEventListener('click',event=>{
    const choice=event.target.closest('[data-choice]');
    if(choice && !choice.disabled){const q=QUESTIONS.find(q=>q.id===current),i=Number(choice.dataset.choice);if(q.type==='multi'){selected=selected.includes(i)?selected.filter(n=>n!==i):[...selected,i];render(true);$(`[data-choice="${i}"]`)?.focus({preventScroll:true});}else submit([i]);return;}
    if(event.target.closest('#grade-multi')){submit([...selected]);return;}
    const practice=event.target.closest('[data-practice]');if(practice){resetFilters();current=Number(practice.dataset.practice);view=QuizBanks.view(QUESTIONS.find(q=>q.id===current).bank);retry=true;selected=[];history.replaceState(null,'',`#${view}`);render();return;}
    const action=event.target.closest('[data-action]')?.dataset.action;
    if(action==='bookmark'){const found=state.bookmarks.includes(current);state.bookmarks=found?state.bookmarks.filter(id=>id!==current):[...state.bookmarks,current];save();render(true);showToast(found?'북마크를 해제했어요':'북마크에 저장했어요');}
    if(action==='retry'){retry=true;selected=[];render(true);$('#short-answer')?.focus();}
    if(action==='previous')navigate(-1);
    if(action==='next')navigate(1);
    if(action==='all')setView(QuizBanks.view(activeBank()));
  });
  $('#shuffle').onclick=()=>{for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}current=filtered()[0]?.id||null;retry=false;selected=[];render();showToast('문제 순서를 섞었어요. 학습 기록은 유지됩니다.');};
  $('#guide-open').onclick=()=>openDialog('한입 복습 사용법',`<ol><li><strong>신 족보</strong>는 새 시험정보를 반영한 O/X 30문항입니다. 01~09는 후기 예시, 10~30은 비타민 기능·아연과 구리·베타카로틴·EPA와 DHA의 강조 주제 보강문제입니다.</li><li><strong>족보학습</strong>에는 족보에서 가져온 30문항만 있어요. 빠진 보기 등을 복원한 문항은 표시되어 있습니다.</li><li><strong>강의자료 예상문제</strong>는 제공된 1~5강을 바탕으로 새로 만든 100문항이에요. 강의 선택에서 원하는 강의만 풀 수 있어요. 실제 출제를 보장하지는 않습니다.</li><li>답을 고르면 바로 채점됩니다. 복수선택은 모든 답 선택 후 채점, 단답형은 입력 후 정답 확인을 눌러 주세요.</li><li><strong>오답노트</strong>에서 문제집을 골라 오답만 보세요. 다시 맞히면 현재 오답에서 빠지고 “한 번이라도 틀린 문제”에 이력이 남습니다.</li><li><strong>정답·해설</strong>에서 답과 강의 근거를 확인하거나 “이 문제 다시 풀기”를 누르세요.</li><li>문제집을 모두 풀면 학습 결과 또는 상단 진도의 <strong>전체 다시 풀기</strong>로 첫 문제부터 다시 시작하세요. 선택한 문제집의 진도만 새로 시작하며 북마크·풀이 횟수·누적 오답 이력은 유지됩니다.</li></ol><p>상단 진도와 정답률은 <strong>선택한 문제집의 최근 풀이 결과</strong> 기준입니다. 강의·주제 필터는 문제 목록을 좁히며, 진도는 해당 문제집 전체 기준으로 표시됩니다.</p><p>기존 족보 풀이 기록은 유지됩니다. 기록은 현재 브라우저에만 저장되며 다른 기기·브라우저로 동기화되지 않습니다. 초기화는 세 문제집의 기록을 모두 지웁니다.</p><p>☆로 북마크하고 기록을 보관용 JSON으로 내려받을 수 있습니다. 모바일에서는 하단의 내려받기 버튼을 사용하세요.</p>`);
  $('#sources-open').onclick=()=>openDialog('자료와 정답 작성 기준',`<h3>신 족보 · 2026.10.20 제공 정보</h3><p>첨부된 수강생 대화와 시험정보 후기의 O/X 30문항 형식을 반영했습니다. 후기 예시 9문항은 맞춤법·표현을 정리했고, 강조된 비타민 B12·K·B9·C·A의 기능, 아연·구리, 베타카로틴, EPA·DHA로 21문항을 추가했습니다. 2026년 1학기 후기와 수강생의 기억에 따른 제보이므로 현재 시험의 확정 문제나 공식 정답을 뜻하지 않습니다.</p><p>정답은 제공된 강의자료의 기능 설명으로 확인했습니다. 수용성 비타민이 모두 무해하다는 일반화는 B6 고용량 장기 섭취의 신경 손상 위험과 구분했습니다. 대화에서 EPA·DHA의 무엇이 증가하는지는 불명확하므로 해당 보강문제는 생선 섭취를 통한 섭취량의 증가로 범위를 명시했습니다. 개인 이름·계정·채팅 이미지는 공개 사이트에 올리지 않았습니다.</p><h3>학습 범위</h3><ul><li>중간 족보: 1~7쪽에 수록된 30문항</li><li>1·2강: 전통식사·섭취현황·체격·기대수명·건강수명, PDF 31쪽</li><li>3강: 영양소의 종류 및 건강한 식사, PDF 36쪽</li><li>4강: 지방·미량영양소·물, PDF 48쪽</li><li>5강: 영양소의 소화·흡수 및 과정, PDF 35쪽</li></ul><p>1~5강은 PDF 파일 4개입니다. 1·2강은 합본이므로 2강의 근거도 그 합본의 PDF 페이지 번호를 사용합니다.</p><h3>기존 문제집의 구분</h3><p>족보학습 30문항에는 새 예상문제를 섞지 않았습니다. 강의자료 예상문제 100문항은 강의의 핵심 개념·계산·기능·비교를 바탕으로 새로 작성했습니다. 강의별 10·10·25·35·20문항이며 실제 시험 출제 여부나 교수자의 공식 답안을 뜻하지 않습니다.</p><h3>족보의 복원·보정</h3><p>12·13·16·26번 누락 보기를 보완하고, 27번은 복수선택, 28번은 객관식으로 복원했습니다. 17번은 강의 도표의 비교 범위로 한정하고 18번은 근거가 불분명한 “두 배”를 제외했으며, 29번은 “지방산”을 “중성지방”으로 보정했습니다. 원문과 차이는 각 해설에서 확인할 수 있습니다.</p><p>원본 PDF는 공개 사이트에 업로드하지 않았습니다. 해설의 쪽수는 PDF 뷰어 기준입니다. 강의의 일반화된 표현은 시험 학습 기준을 명시하거나 조건을 구체화했습니다.</p><h3>보충 출처</h3><ul>${[...Object.values(sources),...Object.values(FRESH_SOURCES)].filter(s=>s.url).map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ↗</a></li>`).join('')}</ul><p>업데이트: 2026년 10월 20일</p>`);
  $('#reset').onclick=()=>{openDialog('학습 기록을 초기화할까요?',`<p>이 브라우저에 저장된 정답·오답, 풀이 횟수와 북마크를 모두 지웁니다. 초기화 전에 필요하면 학습 기록을 내려받아 보관하세요.</p><div class="dialog-actions"><button class="small-btn" id="reset-cancel">취소</button><button class="primary-btn" id="reset-confirm">기록 초기화</button></div>`);$('#reset-cancel').onclick=()=>$('#info-dialog').close();$('#reset-confirm').onclick=()=>{state=QuizCore.restore(null,QUESTIONS);order=QUESTIONS.map(q=>q.id);current=301;retry=false;selected=[];save();resetFilters();$('#ever-wrong').checked=false;$('#info-dialog').close();setView('fresh');showToast('학습 기록을 초기화했어요');};};
  $('#export').onclick=()=>{const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),...state},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='food-wellness-study-record.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);showToast('학습 기록을 내려받았어요');};
  $('#export-mobile').onclick=()=>$('#export').click();
  $('#dialog-close').onclick=()=>$('#info-dialog').close();
  $('#info-dialog').addEventListener('click',event=>{if(event.target===$('#info-dialog')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.target.close();}});
  addEventListener('storage',event=>{if(event.key===KEY){state=QuizCore.restore(event.newValue,QUESTIONS);retry=false;selected=[];render();showToast('다른 탭에서 변경한 기록을 반영했어요');}});
  addEventListener('hashchange',()=>{const next=location.hash.slice(1);if(VIEWS.includes(next))setView(next);});
  render();
})();
