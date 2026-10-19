(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const KEY='food-wellness-quiz-v1';
  let canStore=true, state;
  try { state=QuizCore.restore(localStorage.getItem(KEY),QUESTIONS); localStorage.setItem(KEY,JSON.stringify(state)); }
  catch {canStore=false;state=QuizCore.restore(null,QUESTIONS);}
  let view=['practice','wrong','answers'].includes(location.hash.slice(1))?location.hash.slice(1):'practice';
  let order=QUESTIONS.map(q=>q.id), current=1, retry=false, selected=[], toastTimer;
  function save() {try{localStorage.setItem(KEY,JSON.stringify(state));}catch{canStore=false;}$('#storage-warning').hidden=canStore;}
  function filtered() {
    const category=$('#category').value,status=$('#status').value,search=QuizCore.normalize($('#search').value);
    return order.map(id=>QUESTIONS.find(q=>q.id===id)).filter(q=>{
      const r=state.records[q.id];
      if(category!=='all' && q.category!==category) return false;
      if(search && !QuizCore.normalize(`${q.id} ${q.prompt} ${q.category}`).includes(search)) return false;
      if(view==='wrong') return $('#ever-wrong').checked ? r?.wrongAttempts>0 : r && !r.correct;
      if(view==='answers') return true;
      if(status==='unanswered') return !r;
      if(status==='wrong') return r && !r.correct;
      if(status==='correct') return r?.correct;
      if(status==='bookmark') return state.bookmarks.includes(q.id);
      return true;
    });
  }
  function updateStats() {
    const s=QuizCore.stats(state.records);
    $('#stat-done').innerHTML=`${s.done}<small>/ 30</small>`;
    $('#stat-rate').innerHTML=s.rate===null?'—':`${s.rate}<small>%</small>`;
    $('#stat-wrong').innerHTML=`${s.wrong}<small>문항</small>`;
    $('#wrong-count').textContent=s.wrong;
    $('#progress-bar').style.width=`${s.done/30*100}%`;
    $('#progress-text').textContent=s.done===30?'30문항을 모두 학습했어요!':s.done?`${30-s.done}문항 더 풀면 한 바퀴 완성`:'오늘의 한 문제부터 시작해요';
    $('#storage-warning').hidden=canStore;
  }
  function typeLabel(q){return {ox:'O / X',single:'객관식',multi:'복수선택',text:'단답형'}[q.type];}
  function answerLabel(q){return q.type==='text'?q.answerText:q.answer.map(i=>q.options[i]).join(' / ');}
  function metadata(q){return `<span class="q-number">Q${String(q.id).padStart(2,'0')}</span><span class="badge">${esc(q.category)}</span><span class="badge">${typeLabel(q)}</span>${q.tag?`<span class="badge modified">${esc(q.tag)}</span>`:''}`;}
  function explanation(q, record, answerOnly=false) {
    const success=answerOnly || record.correct;
    return `<section class="feedback ${success?'':'incorrect'}" aria-label="정답과 해설">
      <h3 ${answerOnly?'':'id="feedback-title" tabindex="-1" role="status"'}>${answerOnly?'정답과 해설':success?'✓ 정답이에요. 잘 이해했어요!':'다시 기억해 볼까요?'}</h3>
      <p class="answer-line">정답 · ${esc(answerLabel(q))}</p>
      ${!answerOnly && q.type==='text'?`<p class="q-help">내 답: ${esc(record.value)}</p>`:''}
      <p class="explanation">${esc(q.explanation)}</p>
      <div class="source-links"><span>족보 ${q.page}쪽 · ${q.id}번</span>${(q.refs||[]).map(key=>{const s=sources[key];return s.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ↗</a>`:`<span>강의자료 ${q.lecturePage}쪽</span>`;}).join('')}${!q.refs?.length?'<span>기초 영양학 개념 해설 · 해당 범위 강의자료 미제공</span>':''}</div>
      ${q.original?`<details class="origin"><summary>족보 원문과 복원 내용 확인</summary><p>${esc(q.original)}</p><p>학습 문항은 위에 표시된 문장·보기 기준으로 채점됩니다. 미복원 원문의 공식 정답을 뜻하지 않습니다.</p></details>`:''}
      ${answerOnly?'':`<div class="feedback-actions"><button data-action="retry">다시 풀기 ↻</button><span class="q-help" style="margin:0">${record.attempts}회 풀이 · 누적 오답 ${record.wrongAttempts}회</span></div>`}
    </section>`;
  }
  function questionHTML(q, ids) {
    const record=state.records[q.id],answered=record && !retry,index=ids.indexOf(q.id),isBookmarked=state.bookmarks.includes(q.id);
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
      <div class="question-bottom"><span>${q.tag?'✳ 원문의 누락·표현을 보완한 학습 문항입니다.':'✳ 정답과 함께 이유까지 기억해 보세요.'}</span><div class="nav-actions"><button data-action="previous" ${index<=0?'disabled':''}>← 이전</button><button data-action="next" class="next">${index<0?'남은 문제 보기':index===ids.length-1?'학습 결과 보기':'다음 문제 →'}</button></div></div>`;
  }
  function render(hold=false) {
    updateStats();
    document.querySelectorAll('[data-view]').forEach(button=>{const active=button.dataset.view===view;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
    $('#wrong-tools').hidden=view!=='wrong';$('#status-wrap').hidden=view!=='practice';$('#shuffle').hidden=view==='answers';
    const list=filtered(),ids=list.map(q=>q.id);
    if(!hold && !ids.includes(current)){current=ids[0]||null;retry=false;selected=[];}
    $('#map-count').textContent=`${list.length}문항`;
    $('#list-label').innerHTML=`${view==='wrong'?($('#ever-wrong').checked?'틀렸던 모든 문제':'복습할 오답'):view==='answers'?'정답·해설 모아보기':'전체 문제'} <strong>${list.length}</strong>`;
    const index=ids.indexOf(current);
    $('#position-label').textContent=view==='answers'?'해설을 펼쳐 확인하세요':index>=0?`${String(index+1).padStart(2,'0')} / ${String(list.length).padStart(2,'0')}`:hold?'복습 완료':'';
    $('#question-map').innerHTML=list.map(q=>{const r=state.records[q.id];return `<button class="map-btn ${r?(r.correct?'correct':'wrong'):''} ${q.id===current?'current':''} ${state.bookmarks.includes(q.id)?'bookmarked':''}" data-jump="${q.id}" aria-label="${q.id}번 ${r?(r.correct?'정답':'오답'):'미학습'}" ${q.id===current?'aria-current="true"':''}>${String(q.id).padStart(2,'0')}</button>`;}).join('');
    if(view==='answers') {
      $('#content').innerHTML=list.length?list.map(q=>`<details class="answer-item" id="answer-${q.id}"><summary><span class="q-number">Q${String(q.id).padStart(2,'0')}</span><span class="answer-summary">${esc(q.prompt)}<br><span class="badge">${esc(q.category)}</span>${q.tag?`<span class="badge modified">${esc(q.tag)}</span>`:''}</span><span class="answer-expand" aria-hidden="true">+</span></summary>${explanation(q,null,true)}<button class="primary-btn" data-practice="${q.id}">이 문제 다시 풀기 →</button></details>`).join(''):emptyHTML();
      return;
    }
    const q=QUESTIONS.find(q=>q.id===current);
    $('#content').innerHTML=q && (list.length || hold)?questionHTML(q,ids):emptyHTML();
  }
  function emptyHTML(){const isWrong=view==='wrong',hasFilter=$('#category').value!=='all'||$('#search').value||view==='practice'&&$('#status').value!=='all';return `<div class="empty"><span aria-hidden="true">${isWrong?'✓':'◒'}</span><h2>${hasFilter?'조건에 맞는 문제가 없어요':isWrong?'복습할 오답이 없어요':'아직 선택된 문제가 없어요'}</h2><p>${hasFilter?'다른 주제를 선택하거나 검색어를 지워 보세요.':isWrong?'문제를 틀리면 여기에 자동으로 모아 드려요.<br>다시 맞힌 문제는 “한 번이라도 틀린 문제”에서 확인할 수 있어요.':'필터를 바꾸고 학습을 이어가세요.'}</p><button class="primary-btn" data-action="all">전체 문제 풀기 →</button></div>`;}
  function submit(value) {
    const q=QUESTIONS.find(q=>q.id===current);
    if(!q || (state.records[q.id] && !retry)) return;
    if(q.type==='text' && !QuizCore.normalize(value)) return;
    if(q.type!=='text' && !value.length) return;
    state.records[q.id]=QuizCore.record(q,value,state.records[q.id]);retry=false;selected=[];save();render(true);
    requestAnimationFrame(()=>$('#feedback-title')?.focus({preventScroll:true}));
  }
  function showToast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,3000);}
  function setView(next){view=next;retry=false;selected=[];history.replaceState(null,'',`#${next}`);render();}
  function navigate(delta){const ids=filtered().map(q=>q.id),idx=ids.indexOf(current);if(delta>0 && idx===ids.length-1 && idx>=0){showResults();return;}current=ids[Math.max(0,Math.min(ids.length-1,idx+delta))]||null;retry=false;selected=[];render();}
  function resetFilters(){$('#category').value='all';$('#status').value='all';$('#search').value='';}
  function openDialog(title,body){$('#dialog-title').textContent=title;$('#dialog-body').innerHTML=body;$('#info-dialog').showModal();}
  function showResults(){const s=QuizCore.stats(state.records);openDialog('지금까지의 학습 결과',`<p><strong>${s.done} / 30문항</strong>을 학습했어요.</p><p>최근 풀이 기준 정답 ${s.correct}개 · 오답 ${s.wrong}개${s.rate===null?'':` · 정답률 ${s.rate}%`}</p><p>${s.done===30?'한 바퀴 완성! 오답을 다시 풀며 기억을 단단하게 만들어 보세요.':'아직 풀지 않은 문제도 차근차근 이어가 보세요.'}</p><div class="dialog-actions"><button class="small-btn" id="results-continue">계속 학습하기</button><button class="primary-btn" id="results-wrong">오답 복습하기</button></div>`);$('#results-continue').onclick=()=>{$('#info-dialog').close();resetFilters();$('#status').value='unanswered';setView('practice');};$('#results-wrong').onclick=()=>{$('#info-dialog').close();resetFilters();setView('wrong');};}
  document.querySelector('.tabs').addEventListener('click',event=>{const button=event.target.closest('[data-view]');if(button)setView(button.dataset.view);});
  for(const selector of ['#category','#status','#ever-wrong']) $(selector).addEventListener('change',()=>{retry=false;selected=[];render();});
  $('#search').addEventListener('input',()=>{retry=false;selected=[];render();});
  $('#question-map').addEventListener('click',event=>{const button=event.target.closest('[data-jump]');if(!button)return;const id=Number(button.dataset.jump);if(view==='answers'){const detail=$(`#answer-${id}`);detail.open=true;detail.scrollIntoView({block:'nearest'});return;}current=id;retry=false;selected=[];render();});
  $('#content').addEventListener('submit',event=>{if(event.target.id==='short-form'){event.preventDefault();submit($('#short-answer').value.trim());}});
  $('#content').addEventListener('click',event=>{
    const choice=event.target.closest('[data-choice]');
    if(choice && !choice.disabled){const q=QUESTIONS.find(q=>q.id===current),i=Number(choice.dataset.choice);if(q.type==='multi'){selected=selected.includes(i)?selected.filter(n=>n!==i):[...selected,i];render(true);$(`[data-choice="${i}"]`)?.focus({preventScroll:true});}else submit([i]);return;}
    if(event.target.closest('#grade-multi')){submit([...selected]);return;}
    const practice=event.target.closest('[data-practice]');if(practice){resetFilters();view='practice';current=Number(practice.dataset.practice);retry=true;selected=[];history.replaceState(null,'','#practice');render();return;}
    const action=event.target.closest('[data-action]')?.dataset.action;
    if(action==='bookmark'){const found=state.bookmarks.includes(current);state.bookmarks=found?state.bookmarks.filter(id=>id!==current):[...state.bookmarks,current];save();render(true);showToast(found?'북마크를 해제했어요':'북마크에 저장했어요');}
    if(action==='retry'){retry=true;selected=[];render(true);$('#short-answer')?.focus();}
    if(action==='previous')navigate(-1);
    if(action==='next')navigate(1);
    if(action==='all'){resetFilters();setView('practice');}
  });
  $('#shuffle').onclick=()=>{for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}current=filtered()[0]?.id||null;retry=false;selected=[];render();showToast('문제 순서를 섞었어요. 학습 기록은 유지됩니다.');};
  $('#guide-open').onclick=()=>openDialog('한입 복습 사용법',`<ol><li><strong>문제 풀기</strong>에서 답을 고르면 즉시 정답과 해설이 나타나요. 복수선택은 채점 버튼, 단답형은 입력 후 정답 확인을 눌러 주세요.</li><li><strong>오답노트</strong>에는 최근 풀이가 틀린 문제가 모여요. 다시 맞히면 현재 오답에서 빠지고, “한 번이라도 틀린 문제”에서는 이력을 볼 수 있어요.</li><li><strong>정답·해설</strong>에서는 모든 답안을 펼쳐 볼 수 있어요. “이 문제 다시 풀기”로 복습할 수도 있어요.</li><li>☆로 문제를 북마크하고 주제·풀이 상태·검색으로 골라 보세요.</li></ol><p>정답률은 <strong>학습한 문제의 최근 풀이 결과</strong> 기준이에요. 다시 풀기는 재채점 전까지 이전 기록을 유지합니다.</p><p>기록은 현재 브라우저에만 저장됩니다. 다른 기기·브라우저와 동기화되지 않으며, 브라우저 데이터를 지우면 사라집니다. 내려받기는 보관용 JSON 파일입니다.</p><p>원문이 불완전한 문제는 복원 표시가 있어요. 공식 정답이 아닌 학습용 답안이며, 실제 시험은 수업에서 사용한 정의와 강의 기준을 확인해 주세요.</p>`);
  $('#sources-open').onclick=()=>openDialog('자료와 정답 작성 기준',`<h3>제공된 자료</h3><ul><li>식건중간족보 PDF · 내용이 있는 1~7쪽, 30문항</li><li>2026년 식생활과 건강 1·2강 강의자료 · 31쪽</li></ul><p>원본 PDF는 이 공개 웹사이트에 업로드하지 않았습니다. 문항 번호와 족보 쪽수를 각 해설에 표시했습니다.</p><h3>복원·보정한 문항</h3><p>12·13·16·26번의 누락 보기를 보완했습니다. 27번은 복수선택, 28번은 객관식으로 재구성했습니다. 17번은 강의 도표로 비교 범위를 한정하고, 18번은 근거가 불명확한 “두 배” 표현을 제외했으며, 29번은 “지방산”을 “중성지방”으로 보정했습니다. 원문은 풀이 후 해설 또는 정답·해설에서 확인할 수 있습니다.</p><p>강의에서 확인되지 않는 내용은 기초 영양학 개념과 아래 공공기관 자료를 참고해 해설했습니다. 공식 답안은 제공되지 않았습니다.</p><h3>보충 출처</h3><ul>${Object.values(sources).filter(s=>s.url).map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ↗</a></li>`).join('')}</ul><p>제작·확인: 2026년 10월 19일</p>`);
  $('#reset').onclick=()=>{openDialog('학습 기록을 초기화할까요?',`<p>이 브라우저에 저장된 정답·오답, 풀이 횟수와 북마크를 모두 지웁니다. 초기화 전에 필요하면 학습 기록을 내려받아 보관하세요.</p><div class="dialog-actions"><button class="small-btn" id="reset-cancel">취소</button><button class="primary-btn" id="reset-confirm">기록 초기화</button></div>`);$('#reset-cancel').onclick=()=>$('#info-dialog').close();$('#reset-confirm').onclick=()=>{state=QuizCore.restore(null,QUESTIONS);order=QUESTIONS.map(q=>q.id);current=1;retry=false;selected=[];save();resetFilters();$('#ever-wrong').checked=false;$('#info-dialog').close();setView('practice');showToast('학습 기록을 초기화했어요');};};
  $('#export').onclick=()=>{const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),...state},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='food-wellness-study-record.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);showToast('학습 기록을 내려받았어요');};
  $('#dialog-close').onclick=()=>$('#info-dialog').close();
  $('#info-dialog').addEventListener('click',event=>{if(event.target===$('#info-dialog')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.target.close();}});
  addEventListener('storage',event=>{if(event.key===KEY){state=QuizCore.restore(event.newValue,QUESTIONS);retry=false;selected=[];render();showToast('다른 탭에서 변경한 기록을 반영했어요');}});
  addEventListener('hashchange',()=>{const next=location.hash.slice(1);if(['practice','wrong','answers'].includes(next))setView(next);});
  render();
})();
