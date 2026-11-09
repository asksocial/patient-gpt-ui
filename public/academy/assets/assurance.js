(() => {
  'use strict';
  const lessons=window.assuranceLessons, key='askSocial.assurancePractice.v0.1';
  const empty=()=>({view:'overview',reviewed:{},scenarios:{},answers:{},submitted:false});
  let state=empty();
  try { const saved=JSON.parse(localStorage.getItem(key)||'null'); if(saved&&typeof saved==='object') state={...empty(),...saved}; } catch (_) {}
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const questions=lessons.flatMap(l=>l.questions.map(q=>({lesson:l.id,q})));
  const persist=()=>{try{localStorage.setItem(key,JSON.stringify(state));}catch(_){}};
  const go=view=>{state.view=view;persist();render();document.querySelector('#content').scrollIntoView({block:'start'});};
  function options(name,items,selected){return `<fieldset class="options"><legend>Select the best action</legend>${items.map((x,i)=>`<label><input type="radio" name="${name}" value="${i}" ${selected===i?'checked':''}>${esc(x)}</label>`).join('')}</fieldset>`;}
  function render(){
    const reviewed=lessons.filter(l=>state.reviewed[l.id]).length;
    const matched=lessons.filter(l=>state.scenarios[l.id]?.checked&&state.scenarios[l.id].choice===l.answer).length;
    document.querySelector('#progress').textContent=`Practice: ${reviewed}/7 lessons reviewed · ${matched}/7 scenarios matched`;
    document.querySelector('#navigation').innerHTML=[['overview','Overview'],...lessons.map(l=>[String(l.id),`${l.id} · ${l.title}`]),['quiz','Knowledge check']].map(([id,label])=>`<button data-go="${id}" ${String(state.view)===id?'aria-current="page"':''}>${esc(label)}</button>`).join('');
    const content=document.querySelector('#content');
    if(state.view==='overview'){
      content.innerHTML=`<h2>Seven lessons and their evidence</h2><p>The extension adds a suggested 14 taught hours to the 60-hour core pathway. Actual release depends on competence and approved operating evidence, rather than time or website completion alone.</p><div class="overview">${lessons.map(l=>`<article><div class="eyebrow">MODULE ${l.id} · 2 HOURS</div><h3>${esc(l.title)}</h3><p>${esc(l.objective)}</p><p class="meta">${esc(l.doc)}</p><button class="secondary" data-go="${l.id}">Open module ${l.id}</button></article>`).join('')}</div><h2>What closes an audit finding</h2><p>Scope needs an approved portfolio schedule; coverage needs a funded qualified rota and tested escalation; reviewer authorization needs named evidence; audit rights need an executed agreement; inspection support needs demonstrated retrieval; regulatory scope needs documented reviews; and an integration needs intended-use acceptance. Learning content prepares staff to follow these controls.</p>`;
    } else if(state.view==='quiz'){
      const all=questions.every((_,i)=>Number.isInteger(state.answers[i]));
      const correct=questions.filter((x,i)=>state.answers[i]===x.q[2]).length;
      content.innerHTML=`<h2>Assurance knowledge check</h2><p>Fourteen practice questions, two per lesson. The proposed threshold is at least 90% (13 of 14). Formal qualification also requires assessor-accepted worksheets and the core pathway.</p><form id="quiz-form">${questions.map((x,i)=>`<div class="quiz-item"><p class="meta">Module ${x.lesson} · Question ${i+1}</p><h3>${esc(x.q[0])}</h3>${options('q'+i,x.q[1],state.answers[i])}${state.submitted?`<p class="feedback ${state.answers[i]===x.q[2]?'':'error'}">${state.answers[i]===x.q[2]?'Correct.':'Review this answer.'} ${esc(x.q[3])}</p>`:''}</div>`).join('')}<button class="primary" type="submit">Score practice check</button><button class="secondary" type="button" id="retry">Retry knowledge check</button><p id="quiz-result" role="status">${state.submitted&&all?`${correct} of 14 correct (${Math.round(correct/14*100)}%). ${correct>=13?'Meets the practice threshold.':'Below the practice threshold.'} This is not authorization.`:''}</p></form>`;
      document.querySelector('#quiz-form').addEventListener('change',e=>{if(e.target.name.startsWith('q')){state.answers[Number(e.target.name.slice(1))]=Number(e.target.value);state.submitted=false;document.querySelectorAll('.feedback').forEach(el=>el.remove());document.querySelector('#quiz-result').textContent='';persist();}});
      document.querySelector('#quiz-form').addEventListener('submit',e=>{e.preventDefault();if(!questions.every((_,i)=>Number.isInteger(state.answers[i]))){document.querySelector('#quiz-result').textContent='Answer all 14 questions before scoring.';return;}state.submitted=true;persist();render();document.querySelector('#quiz-result').scrollIntoView({block:'center'});});
      document.querySelector('#retry').onclick=()=>{state.answers={};state.submitted=false;persist();render();};
    } else {
      const lesson=lessons.find(l=>String(l.id)===String(state.view));
      if(!lesson){state.view='overview';render();return;}
      const selected=state.scenarios[lesson.id]||{}, matched=selected.choice===lesson.answer;
      content.innerHTML=`<p class="meta">Module ${lesson.id} · Suggested 2 taught hours · ${esc(lesson.doc)}</p><h2>${esc(lesson.title)}</h2><p><strong>Objective:</strong> ${esc(lesson.objective)}</p><p class="meta">Decision owners: ${esc(lesson.owner)}</p>${lesson.teaching.map(t=>`<p>${esc(t)}</p>`).join('')}<h3>Worked operating scenario</h3><p>${esc(lesson.scenario)}</p><form id="scenario-form">${options('scenario',lesson.options,selected.choice)}<button class="primary" type="submit">Check scenario reasoning</button><p id="scenario-result" role="status" class="${selected.checked?'feedback '+(matched?'':'error'):''}">${selected.checked?`${matched?'Matches the teaching key.':'Review your reasoning.'} ${esc(lesson.feedback)}`:''}</p></form><h3>Assessed worksheet</h3><ol class="worksheet">${lesson.worksheet.map(t=>`<li>${esc(t)}</li>`).join('')}</ol><p><strong>Expected output:</strong> ${esc(lesson.output)}</p><p class="critical"><strong>Critical error:</strong> ${esc(lesson.critical)}</p><p>Retain the learner’s output, document versions, observed actions, actual timings where relevant, assessor comments, remediation and decision in the controlled training record. A matched multiple-choice answer alone is not worksheet acceptance.</p><button class="secondary" id="review">${state.reviewed[lesson.id]?'Lesson reviewed — undo practice flag':'Mark lesson reviewed for practice'}</button><button class="secondary" id="print">Print lesson and worksheet</button><button class="primary" data-go="${lesson.id===19?'quiz':lesson.id+1}">${lesson.id===19?'Open knowledge check':'Next lesson'}</button>`;
      document.querySelector('#scenario-form').onchange=e=>{state.scenarios[lesson.id]={choice:Number(e.target.value),checked:false};const result=document.querySelector('#scenario-result');result.textContent='';result.className='';document.querySelector('#progress').textContent=`Practice: ${lessons.filter(l=>state.reviewed[l.id]).length}/7 lessons reviewed · ${lessons.filter(l=>state.scenarios[l.id]?.checked&&state.scenarios[l.id].choice===l.answer).length}/7 scenarios matched`;persist();};
      document.querySelector('#scenario-form').onsubmit=e=>{e.preventDefault();if(!Number.isInteger(state.scenarios[lesson.id]?.choice)){document.querySelector('#scenario-result').textContent='Select an action before checking.';return;}state.scenarios[lesson.id].checked=true;persist();render();document.querySelector('#scenario-result').scrollIntoView({block:'center'});};
      document.querySelector('#review').onclick=()=>{state.reviewed[lesson.id]=!state.reviewed[lesson.id];persist();render();};
      document.querySelector('#print').onclick=()=>window.print();
    }
    document.querySelectorAll('[data-go]').forEach(button=>button.onclick=()=>go(button.dataset.go));
  }
  document.querySelector('#reset').onclick=()=>{if(window.confirm('Reset only this browser’s assurance practice progress?')){state=empty();persist();render();}};
  render();
})();
