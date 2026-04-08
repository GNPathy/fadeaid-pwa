// ── State ──
const S = {
  session: null,        // active session record
  profile: null,        // full profile object for active session
  profileId: null,
  counts: {VERBAL:0,VISUAL:0,GESTURAL:0,CORRECT:0,INCORRECT:0},
  questionNum: 1,       // current question (starts at 1)
  qPromptCounts: {VERBAL:0,VISUAL:0,GESTURAL:0}, // prompts for current question
  timerStart: null,
  timerInterval: null,
  wakeLock: null,
  lastTap: {}
};
let audioCtx = null;

// ── Init ──
async function initApp() {
  document.documentElement.style.setProperty('--fscale', cfg('fscale', 1));
  await getDB();
  setupBandListeners();
  renderSettings();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
document.addEventListener('DOMContentLoaded', initApp);

// ── Settings helpers ──
function cfg(key, def='') { try { return JSON.parse(localStorage.getItem('fa_'+key)??'null')??def; } catch { return def; } }
function cfgSet(key,val) { localStorage.setItem('fa_'+key, JSON.stringify(val)); }

// ── Tabs ──
function switchTab(name) {
  document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  document.getElementById('nav-'+name).classList.add('active');
  document.getElementById('hdr-sub').textContent = {sessions:'Sessions',history:'History',analytics:'Analytics',settings:'Settings'}[name];
  document.getElementById('hdr-actions').innerHTML = name==='analytics'
    ? `<button onclick="exportCSV()" style="background:none;border:1px solid var(--border);color:var(--dim);padding:6px 12px;border-radius:8px;font-size:12px;cursor:pointer">📊 CSV</button>`
    : '';
  if (name==='history') renderHistory();
  if (name==='analytics') { populateAnalyticsFilters(); renderAnalytics(); }
  if (name==='settings') renderSettings();
}

// ── Modal helpers ──
function openModal(id) { 
  const el = document.getElementById(id);
  if(el) { el.classList.remove('hidden'); el.style.display = 'flex'; }
}
function closeModal(id) { 
  const el = document.getElementById(id);
  if(el) { el.classList.add('hidden'); el.style.display = 'none'; }
}

// ── Toast ──
let toastTimer;
function showToast(msg) {
  const t=document.getElementById('toast'); t.textContent=msg; t.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.add('hidden'),2200);
}

// ── Band touch setup ── FIX T1-001: Response band now has top(+)/bottom(-) zones
function setupBandListeners() {
  // Response halves: top 70% = increment, bottom 30% = decrement
  ['rh-wrong','rh-correct'].forEach(id => {
    const el = document.getElementById(id);
    const type = id==='rh-correct'?'CORRECT':'INCORRECT';
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const yPct = (e.clientY - r.top) / r.height;
      tap(type, yPct < 0.7);
    });
  });
  // Prompt bands: left 45% = minus, right 55% = plus
  ['VERBAL','VISUAL','GESTURAL'].forEach(type => {
    const band = document.getElementById('band-'+type.toLowerCase());
    band.addEventListener('pointerdown', e => {
      e.preventDefault();
      const r=band.getBoundingClientRect();
      tap(type, (e.clientX-r.left) > r.width*0.45);
    });
  });
}

// ── Core tap handler ──
async function tap(type, isPlus) {
  if (!S.session) return;
  const now = Date.now();
  const key = type+(isPlus?'+':'-');
  if (S.lastTap[key] && now-S.lastTap[key]<300) return;
  S.lastTap[key] = now;

  if (isPlus) {
    if (type==='CORRECT'||type==='INCORRECT') {
      // Record outcome for current question, then advance to next
      S.counts[type]++;
      await db_addEvent({sessionId:S.session.id, eventType:type, timestamp:now, questionNumber:S.questionNum});
      setCount(type, S.counts[type]);
      triggerFeedback(type);
      S.questionNum++;
      S.qPromptCounts = {VERBAL:0,VISUAL:0,GESTURAL:0};
      updateQNum();
    } else {
      // Prompt — belongs to current question
      S.counts[type]++;
      S.qPromptCounts[type]=(S.qPromptCounts[type]||0)+1;
      await db_addEvent({sessionId:S.session.id, eventType:type, timestamp:now, questionNumber:S.questionNum});
      setCount(type, S.counts[type]);
      triggerFeedback(type);
      checkPerQuestionGoal(type);
    }
  } else {
    if (S.counts[type]<=0) return;
    const events = await db_getEventsForSession(S.session.id);
    const last = [...events].reverse().find(e=>e.eventType===type);
    if (last) {
      await db_deleteEvent(last.id);
      S.counts[type] = Math.max(0, S.counts[type]-1);
      if (type==='CORRECT'||type==='INCORRECT') {
        S.questionNum = Math.max(1, S.questionNum-1);
        // Restore qPromptCounts from remaining events for current question
        const remaining = await db_getEventsForSession(S.session.id);
        S.qPromptCounts = {VERBAL:0,VISUAL:0,GESTURAL:0};
        remaining.filter(e=>e.questionNumber===S.questionNum && (e.eventType==='VERBAL'||e.eventType==='VISUAL'||e.eventType==='GESTURAL'))
          .forEach(e=>S.qPromptCounts[e.eventType]=(S.qPromptCounts[e.eventType]||0)+1);
      } else {
        S.qPromptCounts[type] = Math.max(0,(S.qPromptCounts[type]||1)-1);
      }
      setCount(type, S.counts[type]);
      updateQNum();
    }
  }
}

function setCount(type, val) {
  const ids = {VERBAL:'cnt-verbal',VISUAL:'cnt-visual',GESTURAL:'cnt-gestural',CORRECT:'cnt-correct',INCORRECT:'cnt-incorrect'};
  document.getElementById(ids[type]).textContent = val;
}

function updateQNum() {
  const el = document.getElementById('live-question-banner');
  if (!el) return;
  el.textContent = `Question ${S.questionNum}`;
}

// Check per-question prompt goal and show real-time warning
function checkPerQuestionGoal(type) {
  if (!S.profile || S.profile.iepGoalMode !== 'question') return;
  const goals = {VERBAL:S.profile.verbalTarget, VISUAL:S.profile.visualTarget, GESTURAL:S.profile.gesturalTarget};
  const goal = goals[type];
  if (!goal) return;
  const current = S.qPromptCounts[type]||0;
  if (current >= goal) {
    showToast(`⚠️ ${type[0]+type.slice(1).toLowerCase()} prompts at goal limit for Q${S.questionNum}`);
    // Flash the count red briefly
    const ids = {VERBAL:'cnt-verbal',VISUAL:'cnt-visual',GESTURAL:'cnt-gestural'};
    const el = document.getElementById(ids[type]);
    if (el) { el.style.color='var(--wrong)'; setTimeout(()=>el.style.color='',1200); }
  }
}



// ── Feedback ──
function triggerFeedback(type) {
  const haptic = cfg('haptic', true);
  const audio  = cfg('audio',  true);
  if (haptic && navigator.vibrate) {
    navigator.vibrate(type==='CORRECT'?[80,50,80]:type==='INCORRECT'?[200]:[50]);
  }
  const bandId = type==='CORRECT'||type==='INCORRECT'
    ? (type==='CORRECT'?'rh-correct':'rh-wrong')
    : 'band-'+type.toLowerCase();
  flashBand(bandId, true);
  if (audio) playTone(type);
}

function flashBand(id, positive) {
  const el=document.getElementById(id); if(!el) return;
  el.classList.remove('flashing');
  void el.offsetWidth;
  el.classList.add('flashing');
  setTimeout(()=>el.classList.remove('flashing'), 300);
}

function playTone(type) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    const t=audioCtx.currentTime;
    if (type==='CORRECT')   { o.frequency.setValueAtTime(523,t); o.frequency.exponentialRampToValueAtTime(784,t+.15); g.gain.setValueAtTime(.25,t); g.gain.exponentialRampToValueAtTime(.001,t+.3); o.start(); o.stop(t+.3); }
    else if (type==='INCORRECT') { o.frequency.setValueAtTime(280,t); o.frequency.exponentialRampToValueAtTime(180,t+.25); g.gain.setValueAtTime(.2,t); g.gain.exponentialRampToValueAtTime(.001,t+.3); o.start(); o.stop(t+.3); }
    else { o.frequency.setValueAtTime(800,t); g.gain.setValueAtTime(.12,t); g.gain.exponentialRampToValueAtTime(.001,t+.08); o.start(); o.stop(t+.1); }
  } catch(e){}
}

// ── Timer ──
function startTimer() {
  S.timerStart = Date.now();
  S.timerInterval = setInterval(()=>{
    const s = Math.floor((Date.now()-S.timerStart)/1000);
    document.getElementById('sess-timer').textContent =
      `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  }, 1000);
}
function stopTimer() { clearInterval(S.timerInterval); S.timerInterval=null; }

// ── WakeLock ──
async function requestWakeLock() {
  try { if ('wakeLock' in navigator) S.wakeLock = await navigator.wakeLock.request('screen'); } catch(e){}
}
function releaseWakeLock() { try { S.wakeLock?.release(); S.wakeLock=null; } catch(e){} }

// ── Start Class ──
async function openStartClass() {
  const profiles = await db_getProfiles();
  const sel = document.getElementById('sc-profile');
  sel.innerHTML = '<option value="">Select a profile...</option>';
  profiles.forEach(p => {
    const o=document.createElement('option'); o.value=p.id;
    o.textContent=`${p.name} × ${p.subject}`; sel.appendChild(o);
  });
  document.getElementById('sc-subtopic').value='';
  document.getElementById('sc-chips').innerHTML='';
  document.getElementById('sc-goals').value='';
  document.getElementById('sc-iep').value='';
  openModal('modal-start');
}

// A2: Reliable subject match for subtopic chips
async function updateSubChips() {
  const sel=document.getElementById('sc-profile');
  const chips=document.getElementById('sc-chips');
  chips.innerHTML='';
  if (!sel.value) return;
  const pId = parseInt(sel.value);
  if (!pId) return;
  const p = await db_getProfile(pId);
  if (!p || !p.subject) return;
  const subject=p.subject;
  const mappings=cfg('subtopics',{});
  // Case-insensitive lookup across all mapping keys
  const key=Object.keys(mappings).find(k=>k.trim().toLowerCase()===subject.trim().toLowerCase());
  const topics=key?mappings[key]:[];
  if (!topics.length) {
    const hint=document.createElement('span');
    hint.style.cssText='font-size:12px;color:var(--dim);padding:4px 0;display:block';
    hint.textContent=`No sub-topics configured for "${subject}" — check Configure Lists`;
    chips.appendChild(hint);
    return;
  }
  topics.forEach(t=>{
    const c=document.createElement('span'); c.className='chip'; c.textContent=t;
    c.onclick=()=>{
      document.getElementById('sc-subtopic').value=t;
      chips.querySelectorAll('.chip').forEach(x=>x.classList.remove('sel'));
      c.classList.add('sel');
    };
    chips.appendChild(c);
  });
}

async function confirmStartClass() {
  const profId = document.getElementById('sc-profile').value;
  if (!profId) { showToast('Please select a profile'); return; }
  const profile = await db_getProfile(parseInt(profId));
  const subtopic = document.getElementById('sc-subtopic').value.trim() || '—';
  const goals = document.getElementById('sc-goals').value.trim();
  const iepNotes = document.getElementById('sc-iep').value.trim();
  const settings = cfg('sources',{});

  const sessionId = await db_createSession({
    startTime: Date.now(), endTime: null,
    studentName: profile.name, subject: profile.subject,
    subTopic: subtopic, teacherName: settings.aide||'',
    classroom: settings.classroom||'',
    iepGoalNotes: profile.iepGoal||'', sessionGoals: goals,
    notes: iepNotes, profileId: profile.id
  });

  S.session = await db_getSession(sessionId);
  S.profile = profile;          // store full profile for IEP mode checks
  S.profileId = profile.id;
  S.counts = {VERBAL:0,VISUAL:0,GESTURAL:0,CORRECT:0,INCORRECT:0};
  S.questionNum = 1;            // questions start at 1
  S.qPromptCounts = {VERBAL:0,VISUAL:0,GESTURAL:0};
  Object.keys(S.counts).forEach(k=>setCount(k,0));

  document.getElementById('sess-name').textContent = `${profile.name} × ${profile.subject}`;
  document.getElementById('sess-topic').textContent = subtopic;
  document.getElementById('sess-timer').textContent = '00:00';
  const qel = document.getElementById('live-question-banner');
  if (qel) qel.textContent = 'Question 1';

  document.getElementById('idle-view').style.display='none';
  document.getElementById('tracking-view').style.display='flex';
  document.getElementById('bottom-nav').style.display='none';

  closeModal('modal-start');
  startTimer();
  await requestWakeLock();
}

// ── End Class ──
function openEndClass() {
  const c=S.counts;
  document.getElementById('end-summary').innerHTML=`
    <div class="sum-grid">
      <div class="sum-cell"><div class="sum-val" style="color:var(--verbal)">${c.VERBAL}</div><div class="sum-lbl">Verbal</div></div>
      <div class="sum-cell"><div class="sum-val" style="color:var(--visual)">${c.VISUAL}</div><div class="sum-lbl">Visual</div></div>
      <div class="sum-cell"><div class="sum-val" style="color:var(--gestural)">${c.GESTURAL}</div><div class="sum-lbl">Gestural</div></div>
      <div class="sum-cell"><div class="sum-val">${c.VERBAL+c.VISUAL+c.GESTURAL}</div><div class="sum-lbl">Total Prompts</div></div>
      <div class="sum-cell"><div class="sum-val" style="color:var(--correct)">${c.CORRECT}</div><div class="sum-lbl">Correct</div></div>
      <div class="sum-cell"><div class="sum-val" style="color:var(--wrong)">${c.INCORRECT}</div><div class="sum-lbl">Incorrect</div></div>
      <div class="sum-cell"><div class="sum-val">${S.questionNum}</div><div class="sum-lbl">Questions</div></div>
    </div>`;
  document.getElementById('ec-notes').value='';
  openModal('modal-end');
}

async function confirmEndClass() {
  if (!S.session) return;
  const notes = document.getElementById('ec-notes').value.trim();
  const existing = S.session.notes||'';
  await db_updateSession({
    ...S.session,
    endTime: Date.now(),
    notes: notes ? (existing ? existing+'\n\n'+notes : notes) : existing
  });
  stopTimer(); releaseWakeLock();
  S.session=null; S.profile=null; S.profileId=null; S.questionNum=1; S.qPromptCounts={VERBAL:0,VISUAL:0,GESTURAL:0};
  document.getElementById('tracking-view').style.display='none';
  document.getElementById('idle-view').style.display='flex';
  document.getElementById('bottom-nav').style.display='flex';
  closeModal('modal-end');
  showToast('✅ Session saved!');
}

// ── History ──
async function renderHistory() {
  const list=document.getElementById('history-list');
  const sessions=await db_getAllSessions();
  if (!sessions.length) {
    list.innerHTML='<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">No sessions yet</div><div>Start your first class to see history here</div></div>';
    return;
  }
  list.innerHTML='';
  for (const s of sessions) {
    const events=await db_getEventsForSession(s.id);
    const c={VERBAL:0,VISUAL:0,GESTURAL:0,CORRECT:0,INCORRECT:0};
    events.forEach(e=>c[e.eventType]=(c[e.eventType]||0)+1);
    const dur = s.endTime ? Math.round((s.endTime-s.startTime)/60000) : '—';
    const date = new Date(s.startTime).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    const card=document.createElement('div'); card.className='card';
    const byQ = {};
    events.forEach(e => {
        const q = e.questionNumber || 1;
        if (!byQ[q]) byQ[q] = {V:0, Vis:0, G:0, C:0, W:0};
        if (e.eventType==='VERBAL') byQ[q].V++;
        else if (e.eventType==='VISUAL') byQ[q].Vis++;
        else if (e.eventType==='GESTURAL') byQ[q].G++;
        else if (e.eventType==='CORRECT') byQ[q].C++;
        else if (e.eventType==='INCORRECT') byQ[q].W++;
    });
    let qHtml = `<div style="margin-top:10px; font-size:12px; font-weight:bold; color:var(--text)">Question Breakdown:</div>`;
    Object.keys(byQ).sort((a,b)=>a-b).forEach(q => {
        const d = byQ[q];
        qHtml += `<div style="margin-top:4px; padding-left:8px; border-left:2px solid var(--border); font-size:12px">
            Q${q}: V:${d.V} · Vis:${d.Vis} · G:${d.G} &rarr; ${d.C>0?'\u2705':'\u274C'}
        </div>`;
    });
    let lastT=s.startTime; let distSum=0; let distCount=0;
    const sortedEv = [...events].sort((a,b)=>a.timestamp-b.timestamp);
    sortedEv.forEach(e=>{
        distSum+=(e.timestamp-lastT)/1000;
        distCount++;
        lastT=e.timestamp;
    });
    const avgDist = distCount>0 ? (distSum/distCount).toFixed(1)+'s' : '—';

    card.innerHTML=`
      <div class="card-hdr" onclick="this.nextElementSibling.classList.toggle('open')">
        <div>
          <div class="card-title">${s.studentName} × ${s.subject}</div>
          <div class="card-sub">${date} · ${s.subTopic||''} · ${dur} min</div>
          <div style="margin-top:8px">
            <span class="pill pill-v">V:${c.VERBAL}</span>
            <span class="pill pill-vis">Vis:${c.VISUAL}</span>
            <span class="pill pill-g">G:${c.GESTURAL}</span>
            <span class="pill pill-c">✅${c.CORRECT}</span>
            <span class="pill pill-w">❌${c.INCORRECT}</span>
          </div>
        </div>
        <span style="color:var(--dim);font-size:20px">›</span>
      </div>
      <div class="card-body">
        <div><strong>Teacher:</strong> ${s.teacherName||'—'} &nbsp; <strong>Room:</strong> ${s.classroom||'—'}</div>
        <div><strong>Avg Distance Between Prompts:</strong> ${avgDist}</div>
        ${s.iepGoalNotes?`<div><strong>IEP Goal:</strong> ${s.iepGoalNotes}</div>`:''}
        ${s.sessionGoals?`<div><strong>Session Goals:</strong> ${s.sessionGoals}</div>`:''}
        ${s.notes?`<div><strong>Notes:</strong> ${s.notes}</div>`:''}
        ${qHtml}
        <button onclick="exportSessionPDF(${s.id})" style="background:var(--s2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 16px;font-size:13px;cursor:pointer;width:fit-content;margin-top:12px">📄 Export PDF</button>
      </div>`;
    list.appendChild(card);
  }
}

// ── Analytics ──
async function populateAnalyticsFilters() {
  const sessions=await db_getAllSessions();
  const students=[...new Set(sessions.map(s=>s.studentName))].sort();
  const subjects=[...new Set(sessions.map(s=>s.subject))].sort();
  const fstu=document.getElementById('flt-student');
  const fsub=document.getElementById('flt-subject');
  const sv=fstu.value, subv=fsub.value;
  fstu.innerHTML='<option value="">All Students</option>'+students.map(s=>`<option value="${s}">${s}</option>`).join('');
  fsub.innerHTML='<option value="">All Subjects</option>'+subjects.map(s=>`<option value="${s}">${s}</option>`).join('');
  fstu.value=sv; fsub.value=subv;
}

async function renderAnalytics() {
  const body=document.getElementById('analytics-body');
  const sf=document.getElementById('flt-student').value;
  const subf=document.getElementById('flt-subject').value;
  let sessions=await db_getAllSessions();
  if (sf) sessions=sessions.filter(s=>s.studentName===sf);
  if (subf) sessions=sessions.filter(s=>s.subject===subf);
  const allEvents=await db_getAllEvents();
  const sids=new Set(sessions.map(s=>s.id));
  const events=allEvents.filter(e=>sids.has(e.sessionId));

  if (!sessions.length) {
    body.innerHTML='<div class="empty"><div class="empty-icon">📊</div><div class="empty-text">No data yet</div><div>Complete some sessions to see analytics</div></div>';
    return;
  }

  let html='';

  // IEP Goal comparison (shown when filtering by student)
  if (sf) {
    const profile = (await db_getProfiles()).find(p=>p.name===sf && (!subf||p.subject===subf));
    if (profile) {
      const n=sessions.length;
      const totalC=events.filter(e=>e.eventType==='CORRECT').length;
      const totalW=events.filter(e=>e.eventType==='INCORRECT').length;
      const totalQ=totalC+totalW || 1;
      const div = profile.iepGoalMode === 'question' ? totalQ : n;
      const divLabel = profile.iepGoalMode === 'question' ? 'avg/question' : 'avg/session';
      
      const avgV=(events.filter(e=>e.eventType==='VERBAL').length/div).toFixed(1);
      const avgVis=(events.filter(e=>e.eventType==='VISUAL').length/div).toFixed(1);
      const avgG=(events.filter(e=>e.eventType==='GESTURAL').length/div).toFixed(1);
      
      let distSum = 0; let distCount = 0;
      sessions.forEach(sess => {
          let lastT = sess.startTime;
          events.filter(e=>e.sessionId===sess.id).sort((a,b)=>a.timestamp-b.timestamp).forEach(e => {
              distSum += (e.timestamp - lastT)/1000;
              distCount++;
              lastT = e.timestamp;
          });
      });
      const avgD = distCount>0 ? (distSum/distCount).toFixed(1)+' sec' : '—';
      
      const avgPct=totalQ>0?Math.round(totalC/totalQ*100):0;
      const row=(label,avg,goal)=>{
        const over=goal&&parseFloat(avg)>parseFloat(goal);
        return `<tr><td>${label}</td><td class="num">${avg}</td><td class="num">${goal||'—'}</td><td class="num ${over?'over':'ok'}">${goal?(over?'⚠️ Over':'✅ Under'):'—'}</td></tr>`;
      };
      const rowPct=(label,pct,goal)=>{
        const met=goal&&pct>=goal;
        return `<tr><td>${label}</td><td class="num">${pct}%</td><td class="num">${goal?goal+'%':'—'}</td><td class="num ${met?'ok':'over'}">${goal?(met?'✅ Met':'⚠️ Below'):'—'}</td></tr>`;
      };
      const rowInfo=(label,val)=>{
        return `<tr><td>${label}</td><td class="num" style="color:var(--text);font-weight:bold">${val}</td><td class="num">—</td><td class="num">—</td></tr>`;
      };
      html+=`<div class="sec-title">📋 IEP Goal Comparison — ${sf}</div>
      <div style="padding:0 12px 12px"><table class="atbl">
        <thead><tr><th>Metric</th><th class="num">Actual</th><th class="num">IEP Goal</th><th class="num">Status</th></tr></thead>
        <tbody>
          ${row('Verbal ('+divLabel+')',avgV,profile.verbalTarget)}
          ${row('Visual ('+divLabel+')',avgVis,profile.visualTarget)}
          ${row('Gestural ('+divLabel+')',avgG,profile.gesturalTarget)}
          ${rowPct('% Correct',avgPct,profile.correctPctGoal)}
          ${rowInfo('Avg Distance Between Prompts',avgD)}
        </tbody>
      </table></div>`;
    }
  }

  // Week-over-week trend (last 4 weeks)
  html += `<div class="sec-title">📅 Week-over-Week Trend</div>
  <div style="padding:0 12px 12px;overflow-x:auto">` + buildWoWTable(sessions, events) + `</div>`;

  // Cumulative totals
  html += `<div class="sec-title">📈 Cumulative Performance</div>
  <div style="padding:0 12px 16px">` + buildCumulativeTable(sessions, events) + `</div>`;

  body.innerHTML=html;
}

function getWeekStart(ts) {
  const d=new Date(ts); d.setHours(0,0,0,0);
  const day=d.getDay(); d.setDate(d.getDate()-(day===0?6:day-1)); // Monday
  return d.getTime();
}

function buildWoWTable(sessions, events) {
  const weeks={};
  sessions.forEach(s=>{
    const ws=getWeekStart(s.startTime);
    if (!weeks[ws]) weeks[ws]={V:0,Vis:0,G:0,C:0,W:0,sessions:0};
    weeks[ws].sessions++;
    const sev=events.filter(e=>e.sessionId===s.id);
    sev.forEach(e=>{
      if(e.eventType==='VERBAL') weeks[ws].V++;
      else if(e.eventType==='VISUAL') weeks[ws].Vis++;
      else if(e.eventType==='GESTURAL') weeks[ws].G++;
      else if(e.eventType==='CORRECT') weeks[ws].C++;
      else if(e.eventType==='INCORRECT') weeks[ws].W++;
    });
  });
  const sorted=Object.keys(weeks).map(Number).sort((a,b)=>b-a).slice(0,4).reverse();
  if (!sorted.length) return '<div style="color:var(--dim);padding:8px">No data</div>';
  const fmt=ts=>{ const d=new Date(ts); return `${d.getMonth()+1}/${d.getDate()}`; };
  const trend=(cur,prev)=>{
    if(!prev||prev===0) return '';
    const pct=Math.round((cur-prev)/prev*100);
    return pct>0?`<span class="up"> ↑${pct}%</span>`:`<span class="dn"> ↓${Math.abs(pct)}%</span>`;
  };
  let rows='';
  sorted.forEach((ws,i)=>{
    const w=weeks[ws]; const prev=i>0?weeks[sorted[i-1]]:null;
    const end=new Date(ws); end.setDate(end.getDate()+6);
    rows+=`<tr>
      <td style="white-space:nowrap">${fmt(ws)}–${fmt(end.getTime())}</td>
      <td class="num">${w.V}${prev?trend(w.V,prev.V):''}</td>
      <td class="num">${w.Vis}${prev?trend(w.Vis,prev.Vis):''}</td>
      <td class="num">${w.G}${prev?trend(w.G,prev.G):''}</td>
      <td class="num pill-c">${w.C}</td>
      <td class="num pill-w">${w.W}</td>
      <td class="num" style="color:var(--dim)">${w.sessions}</td>
    </tr>`;
  });
  return `<table class="atbl"><thead><tr><th>Week</th><th class="num">Verbal</th><th class="num">Visual</th><th class="num">Gestural</th><th class="num">✅</th><th class="num">❌</th><th class="num">Sessions</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function buildCumulativeTable(sessions, events) {
  const byStudent={};
  sessions.forEach(s=>{
    const k=`${s.studentName}||${s.subject}`;
    if(!byStudent[k]) byStudent[k]={name:s.studentName,subject:s.subject,V:0,Vis:0,G:0,C:0,W:0,n:0,distSum:0,distCount:0};
    byStudent[k].n++;
    let lastT = s.startTime;
    events.filter(e=>e.sessionId===s.id).sort((a,b)=>a.timestamp-b.timestamp).forEach(e=>{
      if(e.eventType==='VERBAL') byStudent[k].V++;
      else if(e.eventType==='VISUAL') byStudent[k].Vis++;
      else if(e.eventType==='GESTURAL') byStudent[k].G++;
      else if(e.eventType==='CORRECT') byStudent[k].C++;
      else if(e.eventType==='INCORRECT') byStudent[k].W++;
      byStudent[k].distSum += (e.timestamp - lastT)/1000;
      byStudent[k].distCount++;
      lastT = e.timestamp;
    });
  });
  const rows=Object.values(byStudent).map(r=>{
    const avgDist = r.distCount>0 ? (r.distSum/r.distCount).toFixed(1)+'s' : '—';
    return `<tr>
    <td>${r.name}</td><td>${r.subject}</td>
    <td class="num">${r.V}</td><td class="num">${r.Vis}</td><td class="num">${r.G}</td>
    <td class="num" style="color:var(--correct)">${r.C}</td>
    <td class="num" style="color:var(--wrong)">${r.W}</td>
    <td class="num">${avgDist}</td>
    <td class="num" style="color:var(--dim)">${r.n}</td>
  </tr>`}).join('');
  return `<table class="atbl"><thead><tr><th>Student</th><th>Subject</th><th class="num">Verbal</th><th class="num">Visual</th><th class="num">Gestural</th><th class="num">✅</th><th class="num">❌</th><th class="num">Avg Dist</th><th class="num">Sessions</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ── CSV Export ──
async function exportCSV() {
  const sessions=await db_getAllSessions();
  const allEvents=await db_getAllEvents();
  const profiles=await db_getProfiles();
  const header='Date,Student,Subject,SubTopic,Teacher,Classroom,Duration(min),Verbal,Visual,Gestural,Correct,Incorrect,Questions,CorrectPct,AvgBetweenPromptsSec,VerbalGoal,VisualGoal,GesturalGoal,CorrectPctGoal,GoalMet,IEPGoal,SessionGoals,Notes\n';
  const rows=sessions.map(s=>{
    const ev=allEvents.filter(e=>e.sessionId===s.id).sort((a,b)=>a.timestamp-b.timestamp);
    const c={VERBAL:0,VISUAL:0,GESTURAL:0,CORRECT:0,INCORRECT:0};
    let lastT=s.startTime; let distSum=0; let distCount=0;
    ev.forEach(e=>{
        c[e.eventType]=(c[e.eventType]||0)+1;
        distSum+=(e.timestamp-lastT)/1000;
        distCount++;
        lastT=e.timestamp;
    });
    const avgDist = distCount>0 ? +(distSum/distCount).toFixed(1) : '';
    const p=profiles.find(x=>x.id===s.profileId)||{};
    const dur=s.endTime?Math.round((s.endTime-s.startTime)/60000):'';
    const esc=v=>`"${String(v||'').replace(/"/g,'""')}"`;
    const qs=c.CORRECT+c.INCORRECT;
    const total=c.CORRECT+c.INCORRECT;
    const actualPct=total>0?Math.round(c.CORRECT/total*100):0;
    let goalMet='—';
    if(p.verbalTarget||p.visualTarget||p.gesturalTarget||p.correctPctGoal){
      const mode = p.iepGoalMode || 'session';
      let vMax = 0, visMax = 0, gMax = 0;
      if (mode === 'question') {
          const byQ = {};
          ev.forEach(e => {
              const q = e.questionNumber||1;
              if(!byQ[q]) byQ[q]={V:0,Vis:0,G:0};
              if(e.eventType==='VERBAL') byQ[q].V++;
              if(e.eventType==='VISUAL') byQ[q].Vis++;
              if(e.eventType==='GESTURAL') byQ[q].G++;
          });
          Object.values(byQ).forEach(d => {
              vMax = Math.max(vMax, d.V);
              visMax = Math.max(visMax, d.Vis);
              gMax = Math.max(gMax, d.G);
          });
      } else {
          vMax = c.VERBAL; visMax = c.VISUAL; gMax = c.GESTURAL;
      }
      const vOk=!p.verbalTarget||vMax<=p.verbalTarget;
      const visOk=!p.visualTarget||visMax<=p.visualTarget;
      const gOk=!p.gesturalTarget||gMax<=p.gesturalTarget;
      const pctOk=!p.correctPctGoal||actualPct>=p.correctPctGoal;
      goalMet=(vOk&&visOk&&gOk&&pctOk)?'Yes':'No';
    }
    return [
      new Date(s.startTime).toLocaleDateString(),
      esc(s.studentName),esc(s.subject),esc(s.subTopic),
      esc(s.teacherName),esc(s.classroom),dur,
      c.VERBAL,c.VISUAL,c.GESTURAL,c.CORRECT,c.INCORRECT,qs,
      actualPct+'%',avgDist,
      p.verbalTarget||'',p.visualTarget||'',p.gesturalTarget||'',p.correctPctGoal||'',
      goalMet,esc(p.iepGoal),esc(s.sessionGoals),esc(s.notes)
    ].join(',');
  }).join('\n');
  const blob=new Blob([header+rows],{type:'text/csv'});
  const filename = `fadeaid-analytics-${new Date().toISOString().slice(0,10)}.csv`;
  const file = new File([blob], filename, {type: 'text/csv'});
  if (navigator.share && navigator.canShare && navigator.canShare({files: [file]})) {
      try {
          await navigator.share({files: [file], title: 'FadeAid CSV Analytics'});
          return;
      } catch (err) {
          if (err.name === 'AbortError') return; // User cancelled share sheet
          console.log('Share blocked/failed, falling back to download:', err);
      }
  }
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=filename; document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ── PDF Export (single session) ──
async function exportSessionPDF(sessionId) {
  const s=await db_getSession(sessionId);
  const events=await db_getEventsForSession(sessionId);
  const profile=s.profileId?await db_getProfile(s.profileId):null;
  const c={VERBAL:0,VISUAL:0,GESTURAL:0,CORRECT:0,INCORRECT:0};
  events.forEach(e=>c[e.eventType]=(c[e.eventType]||0)+1);
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'pt',format:'a4'});
  const W=doc.internal.pageSize.getWidth();
  // Header bar
  doc.setFillColor(26,37,53); doc.rect(0,0,W,68,'F');
  doc.setTextColor(79,195,247); doc.setFontSize(22); doc.setFont('helvetica','bold');
  doc.text('FadeAid',40,34);
  doc.setTextColor(144,164,174); doc.setFontSize(11); doc.setFont('helvetica','normal');
  doc.text('IEP Prompt Tracker',40,52);
  doc.setTextColor(255,255,255); doc.setFontSize(11);
  doc.text(new Date(s.startTime).toLocaleString(),W-40,34,{align:'right'});
  // Session info
  let y=88;
  doc.setTextColor(30,30,30); doc.setFontSize(17); doc.setFont('helvetica','bold');
  doc.text(`${s.studentName} × ${s.subject}`,40,y); y+=20;
  doc.setFontSize(11); doc.setFont('helvetica','normal'); doc.setTextColor(80,80,80);
  const dur=s.endTime?Math.round((s.endTime-s.startTime)/60000)+'min':'—';
  doc.text(`Sub-topic: ${s.subTopic||'—'}   Duration: ${dur}   Teacher: ${s.teacherName||'—'}   Room: ${s.classroom||'—'}`,40,y); y+=30;
  // Prompt table
  doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(30,30,30);
  doc.text('Prompt Summary',40,y); y+=14;
  const cols=[40,160,280,370,460]; const hdrs=['Type','Count','Avg/Session','IEP Goal','Status'];
  doc.setFillColor(26,37,53); doc.rect(36,y,W-72,22,'F');
  doc.setTextColor(144,164,174); doc.setFontSize(10);
  hdrs.forEach((h,i)=>doc.text(h,cols[i]+2,y+14)); y+=22;
  const n=1; // single session
  const rows2=[
    ['Verbal',c.VERBAL,c.VERBAL,profile?.verbalTarget],
    ['Visual',c.VISUAL,c.VISUAL,profile?.visualTarget],
    ['Gestural',c.GESTURAL,c.GESTURAL,profile?.gesturalTarget],
  ];
  rows2.forEach(([name,cnt,,goal],i)=>{
    doc.setFillColor(i%2===0?245:255,i%2===0?247:255,i%2===0?250:255);
    doc.rect(36,y,W-72,22,'F');
    doc.setTextColor(30,30,30); doc.setFont('helvetica','normal'); doc.setFontSize(11);
    doc.text(name,cols[0]+2,y+15);
    doc.text(String(cnt),cols[1]+2,y+15);
    doc.text(String(cnt),cols[2]+2,y+15);
    doc.text(goal?String(goal):'—',cols[3]+2,y+15);
    const over = goal && cnt > goal;
    doc.setTextColor(over?230:0,over?120:160,over?0:100);
    doc.text(goal?(over?'⚠ Over':'✓ Under'):'—',cols[4]+2,y+15);
    doc.setTextColor(30,30,30); y+=22;
  });
  
  // Question Breakdown table
  y+=10; doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(30,30,30);
  doc.text('Question Breakdown',40,y); y+=14;
  doc.setFillColor(26,37,53); doc.rect(36,y,W-72,22,'F');
  doc.setTextColor(144,164,174); doc.setFontSize(10);
  ['Question','V','Vis','G','Result'].forEach((h,i)=>doc.text(h,42+(i*90),y+14)); y+=22;
  
  const byQ = {};
  events.forEach(e => {
      const q = e.questionNumber || 1;
      if (!byQ[q]) byQ[q] = {V:0, Vis:0, G:0, C:0, W:0};
      if (e.eventType==='VERBAL') byQ[q].V++;
      else if (e.eventType==='VISUAL') byQ[q].Vis++;
      else if (e.eventType==='GESTURAL') byQ[q].G++;
      else if (e.eventType==='CORRECT') byQ[q].C++;
      else if (e.eventType==='INCORRECT') byQ[q].W++;
  });
  
  Object.keys(byQ).sort((a,b)=>a-b).forEach((q, i) => {
      const d = byQ[q];
      doc.setFillColor(i%2===0?245:255,i%2===0?247:255,i%2===0?250:255);
      doc.rect(36,y,W-72,22,'F');
      doc.setTextColor(30,30,30); doc.setFont('helvetica','normal'); doc.setFontSize(11);
      
      const vover = profile?.iepGoalMode === 'question' && profile?.verbalTarget && d.V > profile.verbalTarget;
      const visover = profile?.iepGoalMode === 'question' && profile?.visualTarget && d.Vis > profile.visualTarget;
      const gover = profile?.iepGoalMode === 'question' && profile?.gesturalTarget && d.G > profile.gesturalTarget;

      doc.text(`Q${q}`, 42, y+15);
      doc.setTextColor(vover?230:30,vover?120:30,vover?0:30);
      doc.text(String(d.V), 132, y+15);
      doc.setTextColor(visover?230:30,visover?120:30,visover?0:30);
      doc.text(String(d.Vis), 222, y+15);
      doc.setTextColor(gover?230:30,gover?120:30,gover?0:30);
      doc.text(String(d.G), 312, y+15);
      doc.setTextColor(30,30,30);
      doc.text(d.C>0?'Correct':'Incorrect', 402, y+15);
      y+=22;
      
      if(y > 780) { doc.addPage(); y = 40; }
  });

  // Response summary
  y+=10; doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(30,30,30);
  doc.text(`Questions: ${c.CORRECT+c.INCORRECT}   Correct: ${c.CORRECT}   Incorrect: ${c.INCORRECT}   Total Prompts: ${c.VERBAL+c.VISUAL+c.GESTURAL}`,40,y); y+=20;
  // Notes
  if (s.iepGoalNotes) { doc.setFont('helvetica','bold'); doc.text('IEP Goal:',40,y); doc.setFont('helvetica','normal'); const ln=doc.splitTextToSize(s.iepGoalNotes,W-100); doc.text(ln,130,y); y+=ln.length*14+6; }
  if (s.sessionGoals) { doc.setFont('helvetica','bold'); doc.text('Session Goals:',40,y); doc.setFont('helvetica','normal'); const ln=doc.splitTextToSize(s.sessionGoals,W-110); doc.text(ln,145,y); y+=ln.length*14+6; }
  if (s.notes) { doc.setFont('helvetica','bold'); doc.text('Notes:',40,y); doc.setFont('helvetica','normal'); const ln=doc.splitTextToSize(s.notes,W-90); doc.text(ln,100,y); y+=ln.length*14+6; }
  
  // Event Log table
  if(y > doc.internal.pageSize.getHeight() - 100) { doc.addPage(); y = 40; } else { y+=30; }
  doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(30,30,30);
  doc.text('Chronological Event Log',40,y); y+=14;
  doc.setFillColor(26,37,53); doc.rect(36,y,W-72,22,'F');
  doc.setTextColor(144,164,174); doc.setFontSize(10);
  ['Question','Time (hh:mm:ss)','Event Type','Distance (sec)'].forEach((h,i)=>doc.text(h,42+(i*120),y+14)); y+=22;
  
  let lastT = s.startTime;
  const sorted = events.slice().sort((a,b)=>a.timestamp-b.timestamp);
  sorted.forEach((e, i) => {
      doc.setFillColor(i%2===0?245:255,i%2===0?247:255,i%2===0?250:255);
      doc.rect(36,y,W-72,22,'F');
      doc.setTextColor(30,30,30); doc.setFont('helvetica','normal'); doc.setFontSize(11);
      
      const qText = `Q${e.questionNumber||1}`;
      const d = new Date(e.timestamp);
      const hhmmss = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
      const dist = ((e.timestamp - lastT)/1000).toFixed(1) + 's';
      lastT = e.timestamp;
      
      doc.text(qText, 42, y+15);
      doc.text(hhmmss, 162, y+15);
      doc.text(e.eventType, 282, y+15);
      doc.text(dist, 402, y+15);
      
      y+=22;
      if(y > 780) { doc.addPage(); y = 40; }
  });

  const filename = `fadeaid-${s.studentName.replace(/\s/g,'-')}-${new Date(s.startTime).toISOString().slice(0,10)}.pdf`;
  const blob = doc.output('blob');
  if (navigator.share && navigator.canShare) {
      const file = new File([blob], filename, {type:'application/pdf'});
      if (navigator.canShare({files:[file]})) {
          try {
              await navigator.share({files:[file], title:'Session Report'});
              return;
          } catch (err) {
              if (err.name === 'AbortError') return; // User cancelled share sheet
              console.log('Share blocked/failed, falling back to doc.save:', err);
          }
      }
  }
  doc.save(filename);
}

// ── Settings ──
function renderSettings() {
  const src=cfg('sources',{}); const h=cfg('haptic',true); const a=cfg('audio',true);
  document.getElementById('settings-body').innerHTML=`
    <div class="set-section">
      <div class="set-title">General</div>
      <button class="btn-set" onclick="openModal('modal-about')"><span>ℹ️ About & User Manual</span><span>›</span></button>
      <button class="btn-set" onclick="openSourcesModal()"><span>📋 Configure Lists</span><span>›</span></button>
      <button class="btn-set" onclick="openProfilesSection()"><span>👤 Student Profiles</span><span>›</span></button>
    </div>
    <div class="set-section">
      <div class="set-title">Feedback</div>
      <div class="set-row">
        <div><div style="font-size:15px;font-weight:500">Haptic Feedback</div><div style="font-size:12px;color:var(--dim)">Vibration on prompt (Android)</div></div>
        <button class="toggle ${h?'on':''}" id="tog-haptic" onclick="toggleSetting('haptic','tog-haptic')"></button>
      </div>
      <div class="set-row">
        <div><div style="font-size:15px;font-weight:500">Audio Feedback</div><div style="font-size:12px;color:var(--dim)">Sound pop on every tap</div></div>
        <button class="toggle ${a?'on':''}" id="tog-audio" onclick="toggleSetting('audio','tog-audio')"></button>
      </div>
    </div>
    <div class="set-section">
      <div class="set-title">Accessibility</div>
      <div class="set-row" style="flex-direction:column;align-items:stretch">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><div style="font-size:15px;font-weight:500">Text Size</div><div style="font-size:12px;color:var(--dim)">Scale interface typography</div></div>
          <div style="font-size:15px;font-weight:700" id="fs-lbl">${Math.round(cfg('fscale',1)*100)}%</div>
        </div>
        <input type="range" min="1" max="1.45" step="0.15" value="${cfg('fscale',1)}" 
          style="margin-top:16px;accent-color:var(--primary)" 
          oninput="document.getElementById('fs-lbl').textContent=Math.round(this.value*100)+'%'; document.documentElement.style.setProperty('--fscale', this.value)"
          onchange="cfgSet('fscale', Number(this.value));">
      </div>
    </div>
    <div class="set-section">
      <div class="set-title">Data</div>
      <button class="btn-set btn-d" onclick="clearAllData()"><span>🗑 Clear All Data</span><span>›</span></button>
    </div>
    <div style="padding:20px 16px;color:var(--dim);font-size:12px;text-align:center">
      Aide: ${src.aide||'—'} · Room: ${src.classroom||'—'}<br>
      Support: gaunt.apps@gmail.com
    </div>`;
}

function toggleSetting(key, btnId) {
  const cur=cfg(key,true); cfgSet(key,!cur);
  document.getElementById(btnId).classList.toggle('on',!cur);
}

function openSourcesModal() {
  const src=cfg('sources',{});
  document.getElementById('sl-aide').value=src.aide||'';
  document.getElementById('sl-room').value=src.classroom||'';
  document.getElementById('sl-students').value=(src.students||[]).join(', ');
  document.getElementById('sl-subjects').value=(src.subjects||[]).join(', ');
  const mappings=cfg('subtopics',{});
  document.getElementById('sl-subtopics').value=Object.entries(mappings).map(([k,v])=>`${k}=${v.join(',')}`).join('\n');
  openModal('modal-sources');
}

function saveSourceList() {
  const students=document.getElementById('sl-students').value.split(',').map(s=>s.trim()).filter(Boolean);
  const subjects=document.getElementById('sl-subjects').value.split(',').map(s=>s.trim()).filter(Boolean);
  const subtopicsRaw=document.getElementById('sl-subtopics').value.trim();
  const mappings={};
  subtopicsRaw.split('\n').forEach(line=>{
    const [k,...v]=line.split('='); if(k&&v.length) mappings[k.trim()]=v.join('=').split(',').map(t=>t.trim()).filter(Boolean);
  });
  cfgSet('sources',{aide:document.getElementById('sl-aide').value.trim(),classroom:document.getElementById('sl-room').value.trim(),students,subjects});
  cfgSet('subtopics',mappings);
  closeModal('modal-sources'); showToast('✅ Lists saved!'); renderSettings();
}

async function openProfilesSection() {
  const profiles=await db_getProfiles();
  const src=cfg('sources',{});
  const students=src.students||[]; const subjects=src.subjects||[];
  // Show profiles list in a temporary sheet-like overlay
  let html=`<div class="sheet-title">👤 Student Profiles</div>`;
  profiles.forEach(p=>{
    html+=`<div style="background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
      <div><div style="font-weight:600">${p.name} × ${p.subject}</div>
      <div style="font-size:12px;color:var(--dim)">V≤${p.verbalTarget||'?'} Vis≤${p.visualTarget||'?'} G≤${p.gesturalTarget||'?'} Correct≥${p.correctPctGoal||'?'}%</div></div>
      <div style="display:flex;gap:6px">
        <button onclick="editProfile(${p.id})" style="background:none;border:1px solid var(--border);color:var(--primary);border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px">✏️</button>
        <button onclick="deleteProfile(${p.id})" style="background:none;border:1px solid rgba(244,67,54,.4);color:var(--wrong);border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px">🗑</button>
      </div>
    </div>`;
  });
  html+=`<button class="btn-p" onclick="newProfile()">+ New Profile</button>
    <button class="btn-s" onclick="closeModal('modal-prof-list')">Close</button>`;
  if (!document.getElementById('modal-prof-list')) {
    const div=document.createElement('div'); div.id='modal-prof-list'; div.className='overlay';
    div.innerHTML=`<div class="sheet" id="prof-list-sheet"></div>`; document.body.appendChild(div);
  }
  document.getElementById('prof-list-sheet').innerHTML=html;
  openModal('modal-prof-list');
}

// A1: completely remove modal to prevent persistence behind the new screen
function editProfile(id) {
  const el = document.getElementById('modal-prof-list');
  if (el) el.remove();
  setTimeout(()=>openProfileModal(id), 300);
}

function newProfile() {
  const el = document.getElementById('modal-prof-list');
  if (el) el.remove();
  setTimeout(()=>openProfileModal(null), 300);
}

// FIX T1-004: delete profile with confirmation
async function deleteProfile(id) {
  if (!confirm('Delete this profile? Sessions using it will remain but lose their goal references.')) return;
  await db_deleteProfile(id);
  showToast('Profile deleted');
  openProfilesSection();
}

// FIX T1-002: handle empty source lists gracefully
async function openProfileModal(id) {
  const src=cfg('sources',{});
  const students=src.students||[]; const subjects=src.subjects||[];
  const pstu=document.getElementById('pf-student'); const psub=document.getElementById('pf-subject');
  if (students.length) {
    pstu.innerHTML=students.map(s=>`<option value="${s}">${s}</option>`).join('');
  } else {
    pstu.innerHTML='<option value="">-- Add students in Configure Lists first --</option>';
  }
  if (subjects.length) {
    psub.innerHTML=subjects.map(s=>`<option value="${s}">${s}</option>`).join('');
  } else {
    psub.innerHTML='<option value="">-- Add subjects in Configure Lists first --</option>';
  }
  document.getElementById('pf-id').value=id||'';
  if (id) {
    const p=await db_getProfile(id);
    if (p) {
      // ensure saved name/subject exist as options even if lists changed
      if (!students.includes(p.name)) { const o=document.createElement('option'); o.value=p.name; o.textContent=p.name; pstu.prepend(o); }
      if (!subjects.includes(p.subject)) { const o=document.createElement('option'); o.value=p.subject; o.textContent=p.subject; psub.prepend(o); }
      pstu.value=p.name; psub.value=p.subject;
      document.getElementById('pf-verbal').value=p.verbalTarget||5;
      document.getElementById('pf-visual').value=p.visualTarget||5;
      document.getElementById('pf-gestural').value=p.gesturalTarget||5;
      document.getElementById('pf-correctpct').value=p.correctPctGoal||80;
      document.getElementById('pf-iep').value=p.iepGoal||'';
      // set IEP mode radio
      const mode = p.iepGoalMode||'session';
      document.getElementById('pf-mode-session').checked = mode==='session';
      document.getElementById('pf-mode-question').checked = mode==='question';
    }
  } else {
    document.getElementById('pf-verbal').value=5;
    document.getElementById('pf-visual').value=5;
    document.getElementById('pf-gestural').value=5;
    document.getElementById('pf-correctpct').value=80;
    document.getElementById('pf-iep').value='';
    document.getElementById('pf-mode-session').checked=true;
    document.getElementById('pf-mode-question').checked=false;
  }
  openModal('modal-profile');
}

async function saveProfile() {
  const id=document.getElementById('pf-id').value;
  const name=document.getElementById('pf-student').value;
  const subject=document.getElementById('pf-subject').value;
  if (!name || !subject) { showToast('Student and Subject are required — configure lists first'); return; }
  const profile={
    name:name,
    subject:subject,
    verbalTarget:parseInt(document.getElementById('pf-verbal').value)||5,
    visualTarget:parseInt(document.getElementById('pf-visual').value)||5,
    gesturalTarget:parseInt(document.getElementById('pf-gestural').value)||5,
    correctPctGoal:parseInt(document.getElementById('pf-correctpct').value)||80,
    iepGoalMode: document.getElementById('pf-mode-question').checked ? 'question' : 'session',
    iepGoal:document.getElementById('pf-iep').value.trim()
  };
  if (id) profile.id=parseInt(id);
  await db_saveProfile(profile);
  closeModal('modal-profile'); showToast('✅ Profile saved!');
  openProfilesSection();
}

async function clearAllData() {
  if (!confirm('Delete ALL sessions, events, and profiles? This cannot be undone.')) return;
  const db=await getDB();
  await db.clear('sessions'); await db.clear('trackingEvents'); await db.clear('studentProfiles');
  localStorage.clear(); showToast('All data cleared'); renderSettings();
}
