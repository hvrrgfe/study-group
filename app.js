// ============================================================
//  学习群答题积分系统 — app.js (Supabase 版)
// ============================================================

// ===== 配置 =====
const SUBJECTS = [
  { key:'数学', icon:'📐', color:'#4f7cff' },
  { key:'语文', icon:'✍️', color:'#ff6b9d' },
  { key:'英语', icon:'🔤', color:'#4ecdc4' },
  { key:'物理', icon:'🔬', color:'#ffb930' },
  { key:'化学', icon:'⚗️', color:'#b388ff' },
  { key:'生物', icon:'🧬', color:'#69db7c' },
];
const SUBJECT_MAP = Object.fromEntries(SUBJECTS.map(s=>[s.key,s]));
const Q_TYPES = ['选择','填空','解答','作文'];
const LEVELS = [
  { level:0, name:'未上榜', threshold:0,    color:'#666' },
  { level:1, name:'Lv1',   threshold:100,  color:'#aaa' },
  { level:2, name:'Lv2',   threshold:200,  color:'#4ecdc4' },
  { level:3, name:'Lv3',   threshold:500,  color:'#4f7cff' },
  { level:4, name:'Lv4',   threshold:700,  color:'#ff6b9d' },
  { level:5, name:'Lv5',   threshold:1000, color:'#ffb930' },
  { level:6, name:'Lv6',   threshold:2000, color:'#ff6b9d' },
];
const ADMIN_PIN_KEY = 'study_group_admin_pin';
const DEFAULT_PIN = 'study2026';
const SESSION_KEY = 'study_group_session';

// ===== Supabase 客户端 =====
let sb = null;
let dbReady = false;

function initSupabase(retry){
  if(typeof window.supabase !== 'undefined' && SUPABASE_URL && SUPABASE_URL !== 'YOUR_PROJECT_URL'){
    try {
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      dbReady = true;
    } catch(e){ console.error('Supabase init failed:', e); }
  } else if(retry){
    setTimeout(() => initSupabase(retry-1), 500);
  } else if(retry > 0){
    setTimeout(() => initSupabase(retry-1), 500);
  }
}

// ===== 状态 =====
let members = [];
let questions = [];
let submissions = [];
let isAdmin = false;
let currentUser = null; // {username, role, memberId, memberName}
let currentView = 'home';
let quizState = { subject:null, answers:{}, submitted:false, memberId:null };
let bankFilter = { subject:'all' };
let gradingFilter = { status:'pending' };
let loadingMsg = null;

// ===== 工具 =====
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
function uid(){ return crypto.randomUUID ? crypto.randomUUID() : 'id_'+Date.now()+'_'+Math.random().toString(36).slice(2,6); }
function todayStr(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function nowTimeStr(){ const d=new Date(); return d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0'); }
function escapeHtml(s){ if(s==null) return ''; const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
function getLevel(pts){ let lv=0; for(const l of LEVELS){ if(pts>=l.threshold) lv=l.level; } return lv; }
function getNextLevel(pts){ const lv=getLevel(pts); return lv>=6?null:LEVELS[lv+1]; }
function fmtDate(s){ if(!s) return ''; const p=s.split('-'); return p[1]+'月'+p[2]+'日'; }

// ===== 加载提示 =====
function showLoading(msg){
  loadingMsg = msg || '加载中…';
  const views = $$('.view.active .container');
  if(views.length){
    const v = views[0];
    // 不覆盖已有 loading
    if(v.querySelector('.loading-indicator')) return;
    const el = document.createElement('div');
    el.className = 'loading-indicator';
    el.style.cssText = 'text-align:center;padding:40px;color:var(--text-dim)';
    el.textContent = loadingMsg;
    v.prepend(el);
  }
}
function clearLoading(){
  $$('.loading-indicator').forEach(e => e.remove());
}

// ===== 数据加载 =====
function normalizeMember(m){
  return {
    id: m.id,
    name: m.name || m.username || '',
    username: m.username || m.name || '',
    points: m.points || 0,
    role: m.role || 'member',
    createdAt: m.created_at,
  };
}
async function loadMembers(){
  if(!dbReady) return;
  const { data, error } = await sb.from('members').select('*').order('points',{ascending:false});
  if(error){ console.error('loadMembers:', error); return; }
  members = (data || []).map(m => normalizeMember(m));
}
async function loadQuestions(){
  if(!dbReady) return;
  const { data, error } = await sb.from('questions').select('*').order('date',{ascending:false}).order('created_at',{ascending:false});
  if(error){ console.error('loadQuestions:', error); return; }
  questions = (data || []).map(q => normalizeQuestion(q));
}
async function loadSubmissions(){
  if(!dbReady) return;
  const { data, error } = await sb.from('submissions').select('*');
  if(error){ console.error('loadSubmissions:', error); return; }
  submissions = (data || []).map(s => normalizeSubmission(s));
}
async function loadAll(){
  await Promise.all([loadMembers(), loadQuestions(), loadSubmissions()]);
}

// Supabase 返回的字段是 snake_case，需要转换
function normalizeQuestion(q){
  return {
    id: q.id,
    subject: q.subject,
    type: q.type,
    content: q.content,
    options: q.options || null,
    correctAnswer: q.correct_answer || null,
    referenceAnswer: q.reference_answer || null,
    points: q.points || 5,
    date: q.date || '',
    publishTime: q.publish_time || '20:00',
    closeTime: q.close_time || '21:00',
    createdAt: q.created_at,
  };
}
// 转换为 Supabase 格式
function questionToRow(q){
  return {
    id: q.id,
    subject: q.subject,
    type: q.type,
    content: q.content,
    options: q.options || null,
    correct_answer: q.correctAnswer || null,
    reference_answer: q.referenceAnswer || null,
    points: q.points,
    date: q.date,
    publish_time: q.publishTime,
    close_time: q.closeTime,
  };
}
function submissionToRow(s){
  return {
    id: s.id,
    question_id: s.questionId,
    member_id: s.memberId,
    answer: s.answer,
    score: s.score || 0,
    correct: s.correct,
    graded: s.graded,
    graded_at: s.gradedAt ? new Date(s.gradedAt).toISOString() : null,
    submitted_at: s.submittedAt ? new Date(s.submittedAt).toISOString() : new Date().toISOString(),
  };
}
function normalizeSubmission(s){
  return {
    id: s.id,
    questionId: s.question_id,
    memberId: s.member_id,
    answer: s.answer,
    score: s.score || 0,
    correct: s.correct,
    graded: s.graded || false,
    gradedAt: s.graded_at,
    submittedAt: s.submitted_at,
  };
}

// ===== 题目状态判断 =====
function isQuestionVisible(q){ return q.date === todayStr(); }
function isQuestionOpen(q){
  const now = nowTimeStr();
  const pub = q.publishTime || '20:00';
  const close = q.closeTime || '21:00';
  if(now < pub) return false;
  if(now > close) return false;
  return true;
}

// ===== 自动批改 =====
function autoGrade(question, answer){
  if(answer == null || answer === '') return { score:0, correct:false, graded:true };
  const ans = String(answer).trim();
  if(question.type === '选择'){
    const correct = ans.toUpperCase() === String(question.correctAnswer||'').toUpperCase();
    return { score: correct ? question.points : 0, correct, graded:true };
  }
  if(question.type === '填空'){
    const correct = ans.toLowerCase() === String(question.correctAnswer||'').toLowerCase();
    return { score: correct ? question.points : 0, correct, graded:true };
  }
  return { score:0, correct:null, graded:false };
}

// ===== 计算成员积分 =====
function calcMemberPoints(memberId){
  let pts = 0;
  for(const sub of submissions){
    if(sub.memberId === memberId && sub.graded && sub.score) pts += sub.score;
  }
  return pts;
}
async function recalcAndSaveMember(memberId){
  const pts = calcMemberPoints(memberId);
  const m = members.find(x=>x.id===memberId);
  if(m) m.points = pts;
  if(dbReady){
    await sb.from('members').update({ points: pts }).eq('id', memberId);
  }
}

// ===== 视图切换 =====
function showView(view){
  currentView = view;
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-'+view));
  $$('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.view === view));
  $('#navLinks').classList.remove('open');
  switch(view){
    case 'home': renderHome(); break;
    case 'quiz': renderQuiz(); break;
    case 'leaderboard': renderLeaderboard(); break;
    case 'levels': renderLevels(); break;
    case 'bank': renderBank(); break;
    case 'grading': renderGrading(); break;
    case 'members': renderMembersList(); break;
  }
  window.scrollTo({ top:0, behavior:'smooth' });
}

// ===== 首页 =====
function renderHome(){
  const banner = $('#homeBanner');
  if(!dbReady){
    banner.innerHTML = `
      <div class="banner-title">⚙️ 未配置数据库</div>
      <div class="banner-text">请在 config.js 中填入 Supabase 项目 URL 和 anon key<br>详见 <a href="schema.sql" style="color:var(--primary)">schema.sql</a> 建表说明</div>`;
    return;
  }
  const todayQs = questions.filter(q => isQuestionVisible(q));
  const openQs = todayQs.filter(q => isQuestionOpen(q));
  const subjectsToday = [...new Set(todayQs.map(q=>q.subject))];
  if(todayQs.length === 0){
    banner.innerHTML = `<div class="banner-title">📭 今日暂无答题活动</div>
      <div class="banner-text">活动时间：每周六晚 / 节假日每晚 20:00</div>`;
  } else if(openQs.length === 0){
    const next = todayQs[0];
    banner.innerHTML = `<div class="banner-title">⏳ 答题即将开始</div>
      <div class="banner-text">${fmtDate(next.date)} ${next.publishTime||'20:00'} 开始 · 今日科目：${subjectsToday.map(s=>SUBJECT_MAP[s].icon+' '+s).join('、')}</div>`;
  } else {
    banner.innerHTML = `<div class="banner-title">🔥 答题进行中！</div>
      <div class="banner-text">今日科目：${subjectsToday.map(s=>SUBJECT_MAP[s].icon+' '+s).join('、')} · ${todayQs.length}道题</div>
      <button class="banner-go" onclick="showView('quiz')">去答题 →</button>`;
  }
}

// ===== 答题页 =====
async function renderQuiz(){
  if(!dbReady){ $('#quizContainer').innerHTML = '<div class="lb-empty">未配置数据库</div>'; return; }
  const container = $('#quizContainer');
  const desc = $('#quizDateDesc');

  if(questions.length === 0 || !questions.some(q => isQuestionVisible(q))){
    desc.textContent = '';
    container.innerHTML = `<div class="lb-empty"><p style="font-size:48px;margin-bottom:16px">📭</p><p>今日暂无答题活动</p><p style="font-size:13px;margin-top:8px">活动时间：每周六晚 / 节假日每晚 20:00-21:00</p></div>`;
    return;
  }
  const todayQs = questions.filter(q => isQuestionVisible(q));
  const subjectsToday = [...new Set(todayQs.map(q=>q.subject))];
  const anyOpen = todayQs.some(q => isQuestionOpen(q));

  // === 临时强制开放答题 (群主专属) ===
  const tempForceEl = $('#tempForceOpen');
  if(isAdmin && !anyOpen && todayQs.length > 0){
    tempForceEl.style.display = '';
    const btn = tempForceEl.querySelector('#btnForceOpen');
    if(btn) btn.onclick = async function(){
      const now = nowTimeStr();
      await sb.from('questions').update({ publish_time: '00:00', close_time: '23:59' }).eq('date', todayStr());
      await loadQuestions();
      renderQuiz();
    };
  } else {
    tempForceEl.style.display = 'none';
  }

  if(!anyOpen){
    const first = todayQs[0];
    desc.textContent = `答题将于 ${first.publishTime||'20:00'} 开始`;
    container.innerHTML = `<div class="lb-empty"><p style="font-size:48px;margin-bottom:16px">⏳</p><p>答题尚未开始</p><p style="font-size:13px;margin-top:8px">将在 ${first.publishTime||'20:00'} 开放${isAdmin?'，或点击下方按钮强制开放':''}</p></div>`;
    return;
  }
  desc.textContent = '今日可选科目 · 诚信作答';

  if(members.length === 0){
    container.innerHTML = `<div class="lb-empty"><p>暂无成员，请联系群主添加</p></div>`;
    return;
  }
  if(!quizState.memberId || !members.find(m=>m.id===quizState.memberId)){
    quizState.memberId = members[0].id;
  }

  // 重新加载 submissions 以确保最新
  await loadSubmissions();

  // 如果不是管理员，显示已登录的成员（不显示下拉）
  let html = '';
  if(!isAdmin && currentUser && currentUser.memberId){
    quizState.memberId = currentUser.memberId;
    html = `<div class="form-group" style="margin-bottom:20px">
      <label class="form-label">👤 ${escapeHtml(currentUser.memberName || currentUser.username)}</label>
    </div>`;
  } else {
    html = `<div class="form-group" style="margin-bottom:20px">
      <label class="form-label">👤 选择答题成员</label>
      <select class="form-select" id="quizMemberSel" onchange="quizState.memberId=this.value; quizState.answers={}; quizState.subject=null; renderQuiz()">
        ${members.map(m => `<option value="${m.id}" ${m.id===quizState.memberId?'selected':''}>${escapeHtml(m.name)}（${m.points}分）</option>`).join('')}
      </select>
    </div>`;
  }

  const mySubs = submissions.filter(s => s.memberId === quizState.memberId && todayQs.some(q=>q.id===s.questionId));

  if(!quizState.subject){
    html += `<div class="subject-selector">`;
    for(const sub of SUBJECTS){
      const subQs = todayQs.filter(q => q.subject === sub.key);
      if(subQs.length === 0) continue;
      const open = subQs.every(q => isQuestionOpen(q));
      const done = subQs.every(q => mySubs.some(s => s.questionId === q.id));
      html += `<button class="subject-btn ${open?'available':'disabled'}" ${open?`onclick="quizState.subject='${sub.key}'; quizState.answers={}; renderQuiz()"`:''}>
        <span class="subject-btn-icon">${sub.icon}</span>
        <span class="subject-btn-name">${sub.key}</span>
        <span class="subject-btn-count ${subQs.length?'has':''}">${done?'✅ 已答':subQs.length+'题'}</span>
      </button>`;
    }
    html += `</div>`;
    if(mySubs.length > 0){
      const autoGraded = mySubs.filter(s => s.graded);
      let autoPts = 0;
      for(const s of autoGraded) autoPts += s.score||0;
      const pending = mySubs.filter(s => !s.graded);
      html += `<div style="margin-top:20px"><h3 style="font-size:16px;margin-bottom:12px">📊 今日答题情况</h3>
        <div class="quiz-status-bar"><span>已批改得分：<strong style="color:var(--green)">${autoPts}</strong></span>`;
      if(pending.length) html += `<span>待批改：${pending.length}题</span>`;
      html += `</div></div>`;
    }
    container.innerHTML = html;
    return;
  }

  // 答题页
  const subQs = todayQs.filter(q => q.subject === quizState.subject && isQuestionOpen(q));
  html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
    <h3 style="font-size:18px">${SUBJECT_MAP[quizState.subject].icon} ${quizState.subject}</h3>
    <button class="btn-secondary" onclick="quizState.subject=null; quizState.answers={}; renderQuiz()">← 返回选科</button>
  </div>`;

  const subSubmitted = subQs.length > 0 && subQs.every(q => mySubs.some(s => s.questionId === q.id));

  for(let i=0; i<subQs.length; i++){
    const q = subQs[i];
    const mySub = mySubs.find(s => s.questionId === q.id);
    html += `<div class="quiz-card">
      <div class="quiz-card-header">
        <div class="quiz-card-title">第${i+1}题 <span class="quiz-type-tag ${q.type}">${q.type}</span></div>
        <div class="quiz-points">${q.points}分</div>
      </div>
      <div class="quiz-content">${escapeHtml(q.content)}</div>`;
    if(q.options && q.options.length){
      const selected = quizState.answers[q.id] || (mySub ? mySub.answer : '');
      for(let j=0; j<q.options.length; j++){
        const letter = String.fromCharCode(65+j);
        let cls = 'quiz-option';
        if(!subSubmitted && letter === selected) cls += ' selected';
        let clickable = !subSubmitted;
        if(subSubmitted && mySub){
          if(letter === (mySub.answer||'').toUpperCase() && mySub.correct) cls += ' correct';
          else if(letter === (mySub.answer||'').toUpperCase() && !mySub.correct) cls += ' wrong';
          else if(letter === (q.correctAnswer||'').toUpperCase()) cls += ' correct';
          clickable = false;
        }
        html += `<div class="${cls}" ${clickable?`onclick="selectOption('${q.id}','${letter}')"`:''}>
          <div class="quiz-option-letter">${letter}</div><span>${escapeHtml(q.options[j])}</span></div>`;
      }
    } else if(q.type === '填空'){
      const val = quizState.answers[q.id] ?? (mySub ? mySub.answer : '');
      html += `<input class="quiz-answer-input" type="text" placeholder="填写答案…" value="${escapeHtml(val)}" ${subSubmitted?'disabled':''} oninput="quizState.answers['${q.id}']=this.value">`;
    } else {
      const val = quizState.answers[q.id] ?? (mySub ? mySub.answer : '');
      if(subSubmitted && mySub){
        html += `<div class="quiz-answer-input" style="min-height:auto">${escapeHtml(mySub.answer)}</div>`;
      } else {
        html += `<textarea class="quiz-answer-input" placeholder="${q.type==='作文'?'在此写作文…':'在此写解答过程…'}" oninput="quizState.answers['${q.id}']=this.value">${escapeHtml(val)}</textarea>`;
      }
    }
    if(subSubmitted && mySub){
      if(mySub.graded){
        if(q.type === '选择' || q.type === '填空'){
          html += `<div class="quiz-feedback ${mySub.correct?'correct':'wrong'}">${mySub.correct?'✅ 答对了！+': '❌ 答错了，正确答案：'+escapeHtml(q.correctAnswer||'')+'　'}${mySub.score}分</div>`;
        } else {
          html += `<div class="quiz-feedback ${mySub.score>0?'correct':'pending'}">✅ 已批改 · 得分：${mySub.score}分</div>`;
        }
      } else {
        html += `<div class="quiz-feedback pending">⏳ 等待群主批改中…</div>`;
      }
    }
    html += `</div>`;
  }
  if(!subSubmitted){
    html += `<div class="quiz-submit-bar"><button class="btn-primary" onclick="submitQuiz()">提交答案 📤</button></div>`;
  } else {
    html += `<div class="quiz-submit-bar"><button class="btn-secondary" onclick="quizState.subject=null; renderQuiz()">返回科目选择</button></div>`;
  }
  container.innerHTML = html;
}

function selectOption(qid, letter){ quizState.answers[qid] = letter; renderQuiz(); }

async function submitQuiz(){
  const memberId = quizState.memberId;
  if(!memberId){ alert('请先选择成员'); return; }
  const subQs = questions.filter(q => q.subject === quizState.subject && q.date === todayStr() && isQuestionOpen(q));
  let answered = 0;
  for(const q of subQs){
    const ans = quizState.answers[q.id];
    if(ans != null && String(ans).trim() !== '') answered++;
  }
  if(answered === 0){ alert('请至少答一题再提交'); return; }
  if(!confirm(`确认提交 ${quizState.subject} 答案？提交后不可修改。`)) return;

  let autoPts = 0;
  const newSubs = [];
  for(const q of subQs){
    const ans = quizState.answers[q.id];
    if(ans == null || String(ans).trim() === '') continue;
    const result = autoGrade(q, ans);
    const sub = {
      id: uid(),
      questionId: q.id,
      memberId,
      answer: String(ans).trim(),
      score: result.score,
      correct: result.correct,
      graded: result.graded,
      gradedAt: result.graded ? Date.now() : null,
      submittedAt: Date.now(),
    };
    newSubs.push(sub);
    if(result.graded) autoPts += result.score;
  }

  // 写入 Supabase
  if(dbReady){
    // 先删旧提交（同一成员同一题）
    for(const s of newSubs){
      await sb.from('submissions').delete().eq('question_id', s.questionId).eq('member_id', s.memberId);
      await sb.from('submissions').insert(submissionToRow(s));
    }
  }
  // 更新本地
  for(const s of newSubs){
    const idx = submissions.findIndex(x => x.questionId === s.questionId && x.memberId === s.memberId);
    if(idx >= 0) submissions[idx] = s;
    else submissions.push(s);
  }
  await recalcAndSaveMember(memberId);

  quizState.subject = null;
  quizState.answers = {};
  await renderQuiz();
  alert(`提交成功！自动批改得分：${autoPts}分\n解答题和作文等待群主批改。`);
}

// ===== 题库管理 =====
function renderBank(){
  const container = $('#bankContainer');
  if(!dbReady){ container.innerHTML = '<div class="lb-empty">未配置数据库</div>'; return; }
  let html = `<div style="margin-bottom:20px;text-align:center">
    <button class="btn-primary" onclick="openQuestionEditor()">+ 添加题目</button>
    <button class="btn-secondary" onclick="openBulkEditor()">📋 批量添加</button>
  </div>`;
  html += `<div class="bank-tabs"><button class="bank-tab ${bankFilter.subject==='all'?'active':''}" onclick="bankFilter.subject='all';renderBank()">全部</button>`;
  for(const s of SUBJECTS){
    html += `<button class="bank-tab ${bankFilter.subject===s.key?'active':''}" onclick="bankFilter.subject='${s.key}';renderBank()">${s.icon} ${s.key}</button>`;
  }
  html += `</div>`;
  const filtered = questions.filter(q => bankFilter.subject==='all' || q.subject===bankFilter.subject)
    .sort((a,b) => (b.date||'').localeCompare(a.date||''));
  if(filtered.length === 0){
    html += `<div class="lb-empty"><p>暂无题目，点击"添加题目"开始上传</p></div>`;
  } else {
    html += `<div class="question-list">`;
    for(const q of filtered){
      html += `<div class="question-item">
        <div class="question-item-header">
          <div class="question-item-meta">
            <span class="quiz-type-tag ${q.type}">${q.type}</span>
            <span style="font-size:13px">${SUBJECT_MAP[q.subject].icon} ${q.subject}</span>
            <span style="font-size:13px;color:var(--text-dim)">${q.date} ${q.publishTime||''}-${q.closeTime||''}</span>
            <span class="quiz-points">${q.points}分</span>
          </div>
          <div class="question-item-actions">
            <button class="lb-act-btn edit" onclick="openQuestionEditor('${q.id}')">✏️</button>
            <button class="lb-act-btn del" onclick="deleteQuestion('${q.id}')">🗑️</button>
          </div>
        </div>
        <div class="question-item-content">${escapeHtml(q.content)}</div>`;
      if(q.options && q.options.length){
        for(let i=0;i<q.options.length;i++){
          const letter = String.fromCharCode(65+i);
          const isCorrect = letter === String(q.correctAnswer||'').toUpperCase();
          html += `<div style="font-size:13px;${isCorrect?'color:var(--green)':''}">${letter}. ${escapeHtml(q.options[i])} ${isCorrect?'✓':''}</div>`;
        }
      } else if(q.correctAnswer){
        html += `<div class="question-item-answer">参考答案：${escapeHtml(q.correctAnswer)}</div>`;
      }
      if(q.referenceAnswer){
        html += `<div class="question-item-answer">参考解答：${escapeHtml(q.referenceAnswer)}</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  }
  container.innerHTML = html;
}

function openQuestionEditor(qid){
  const q = qid ? questions.find(x=>x.id===qid) : null;
  const isEdit = !!q;
  $('#modalTitle').textContent = isEdit ? '编辑题目' : '添加题目';
  $('#modalBody').innerHTML = `
    <div class="form-group"><label class="form-label">科目</label>
      <select class="form-select" id="q_subject">${SUBJECTS.map(s=>`<option value="${s.key}" ${q&&q.subject===s.key?'selected':''}>${s.icon} ${s.key}</option>`).join('')}</select></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">题型</label>
        <select class="form-select" id="q_type" onchange="toggleQuestionFields()">${Q_TYPES.map(t=>`<option value="${t}" ${q&&q.type===t?'selected':''}>${t}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">分值</label>
        <input class="form-input" type="number" id="q_points" value="${q?q.points:5}" min="1"></div>
    </div>
    <div class="form-group"><label class="form-label">题目内容</label>
      <textarea class="form-textarea" id="q_content" placeholder="输入题目内容…">${q?escapeHtml(q.content):''}</textarea></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">发布日期</label>
        <input class="form-input" type="date" id="q_date" value="${q?q.date:todayStr()}"></div>
      <div class="form-group"><label class="form-label">开放时间</label>
        <input class="form-input" type="time" id="q_publish" value="${q?(q.publishTime||'20:00'):'20:00'}"></div>
      <div class="form-group"><label class="form-label">截止时间</label>
        <input class="form-input" type="time" id="q_close" value="${q?(q.closeTime||'21:00'):'21:00'}"></div>
    </div>
    <div id="q_optionsArea" style="display:none">
      <label class="form-label">选项（A-D，留空不显示）</label>
      <div class="option-editor" id="q_options"></div>
      <label class="form-label" style="margin-top:8px">正确答案（填字母）</label>
      <input class="form-input" type="text" id="q_correct" maxlength="1" placeholder="如 A" value="${q?escapeHtml(q.correctAnswer||''):''}">
    </div>
    <div id="q_fillArea" style="display:none">
      <label class="form-label">正确答案（用于自动批改）</label>
      <input class="form-input" type="text" id="q_fillCorrect" value="${q?escapeHtml(q.correctAnswer||''):''}">
    </div>
    <div id="q_refArea" style="display:none">
      <label class="form-label">参考答案/评分标准（群主批改时参考）</label>
      <textarea class="form-textarea" id="q_ref" placeholder="输入参考答案或评分标准…">${q?escapeHtml(q.referenceAnswer||''):''}</textarea>
    </div>`;
  $('#modalFooter').innerHTML = `<button class="btn-secondary" onclick="closeModal()">取消</button>
    <button class="btn-primary" onclick="saveQuestion(${isEdit?`'${qid}'`:'null'})">保存</button>`;
  $('#modalOverlay').classList.add('show');
  const optsContainer = $('#q_options');
  for(let i=0;i<4;i++){
    const letter = String.fromCharCode(65+i);
    const val = (isEdit && q.options) ? (q.options[i]||'') : '';
    optsContainer.innerHTML += `<div class="option-row"><span class="option-letter">${letter}</span>
      <input class="form-input" type="text" id="q_opt_${letter}" value="${escapeHtml(val)}" placeholder="选项 ${letter}（留空不显示）"></div>`;
  }
  toggleQuestionFields();
}

function toggleQuestionFields(){
  const type = $('#q_type').value;
  $('#q_optionsArea').style.display = type === '选择' ? 'block' : 'none';
  $('#q_fillArea').style.display = type === '填空' ? 'block' : 'none';
  $('#q_refArea').style.display = (type === '解答' || type === '作文') ? 'block' : 'none';
}

async function saveQuestion(qid){
  const subject = $('#q_subject').value;
  const type = $('#q_type').value;
  const points = parseInt($('#q_points').value) || 5;
  const content = $('#q_content').value.trim();
  const date = $('#q_date').value;
  const publishTime = $('#q_publish').value || '20:00';
  const closeTime = $('#q_close').value || '21:00';
  if(!content){ alert('请输入题目内容'); return; }
  if(!date){ alert('请选择日期'); return; }
  let options = null, correctAnswer = null, referenceAnswer = null;
  if(type === '选择'){
    options = [];
    for(let i=0;i<4;i++){
      const letter = String.fromCharCode(65+i);
      options.push($('#q_opt_'+letter)?.value.trim() || '');
    }
    options = options.filter(o => o !== '');
    if(options.length < 2){ alert('选择题至少需要2个选项'); return; }
    correctAnswer = $('#q_correct').value.trim().toUpperCase();
    if(!correctAnswer){ alert('请设置正确答案'); return; }
  } else if(type === '填空'){
    correctAnswer = $('#q_fillCorrect').value.trim();
    if(!correctAnswer){ alert('请输入正确答案用于自动批改'); return; }
  } else {
    referenceAnswer = $('#q_ref').value.trim();
  }
  const q = { id: qid || uid(), subject, type, content, points, date, publishTime, closeTime, options, correctAnswer, referenceAnswer, createdAt: Date.now() };
  if(dbReady){
    if(qid) await sb.from('questions').update(questionToRow(q)).eq('id', qid);
    else await sb.from('questions').insert(questionToRow(q));
  }
  if(qid){ const idx = questions.findIndex(x=>x.id===qid); if(idx>=0) questions[idx]=q; }
  else questions.unshift(q);
  closeModal();
  renderBank();
}

async function deleteQuestion(qid){
  const q = questions.find(x=>x.id===qid);
  if(!q) return;
  if(!confirm(`确定删除这道${q.subject}题？相关答题记录也会删除。`)) return;
  if(dbReady){
    await sb.from('questions').delete().eq('id', qid);
  }
  questions = questions.filter(x=>x.id!==qid);
  submissions = submissions.filter(s => s.questionId !== qid);
  renderBank();
}

function openBulkEditor(){
  $('#modalTitle').textContent = '批量添加题目';
  $('#modalBody').innerHTML = `
    <p style="font-size:13px;color:var(--text-dim);margin-bottom:12px">每行一道题，格式如下：</p>
    <div style="font-size:12px;background:var(--card);padding:12px;border-radius:8px;margin-bottom:12px;line-height:1.8">
      <strong>选择/填空：</strong>科目|题型|分值|题目内容|正确答案<br>
      <em>数学|选择|5|1+1等于几？|A</em><br>
      <strong>选择题需选项：</strong>科目|选择|分值|题目|答案字母|选项A/选项B/选项C/选项D<br>
      <strong>解答/作文：</strong>科目|题型|分值|题目内容|参考答案
    </div>
    <div class="form-row" style="margin-bottom:10px">
      <div><label class="form-label">发布日期</label><input class="form-input" type="date" id="bulk_date" value="${todayStr()}"></div>
      <div><label class="form-label">开放时间</label><input class="form-input" type="time" id="bulk_pub" value="20:00"></div>
      <div><label class="form-label">截止时间</label><input class="form-input" type="time" id="bulk_close" value="21:00"></div>
    </div>
    <textarea class="form-textarea" id="bulk_text" style="min-height:200px" placeholder="数学|选择|5|1+1等于几？|A|等于1/等于2/等于3/等于4&#10;英语|填空|5|apple的复数形式是___|apples"></textarea>`;
  $('#modalFooter').innerHTML = `<button class="btn-secondary" onclick="closeModal()">取消</button>
    <button class="btn-primary" onclick="processBulk()">导入</button>`;
  $('#modalOverlay').classList.add('show');
}

async function processBulk(){
  const text = $('#bulk_text').value.trim();
  if(!text){ alert('请输入题目'); return; }
  const date = $('#bulk_date').value || todayStr();
  const publishTime = $('#bulk_pub').value || '20:00';
  const closeTime = $('#bulk_close').value || '21:00';
  const lines = text.split('\n').filter(l => l.trim());
  let count = 0, errors = [];
  const newQs = [];
  for(let i=0; i<lines.length; i++){
    const parts = lines[i].split('|').map(s => s.trim());
    if(parts.length < 5){ errors.push(`第${i+1}行格式错误`); continue; }
    const [subject, type, ptsStr, content, answer] = parts;
    if(!SUBJECT_MAP[subject]){ errors.push(`第${i+1}行科目"${subject}"不合法`); continue; }
    if(!Q_TYPES.includes(type)){ errors.push(`第${i+1}行题型"${type}"不合法`); continue; }
    const points = parseInt(ptsStr) || 5;
    let options = null, correctAnswer = null, referenceAnswer = null;
    if(type === '选择'){
      correctAnswer = answer.toUpperCase();
      if(parts[5]){ options = parts[5].split('/').map(s=>s.trim()); }
      else { errors.push(`第${i+1}行选择题需要选项`); continue; }
    } else if(type === '填空'){ correctAnswer = answer; }
    else { referenceAnswer = answer; }
    newQs.push({ id:uid(), subject, type, content, points, date, publishTime, closeTime, options, correctAnswer, referenceAnswer, createdAt:Date.now() });
    count++;
  }
  if(dbReady && newQs.length){
    const rows = newQs.map(questionToRow);
    await sb.from('questions').insert(rows);
  }
  questions.unshift(...newQs);
  closeModal();
  renderBank();
  if(errors.length) alert(`成功导入 ${count} 题，${errors.length} 行错误：\n${errors.join('\n')}`);
  else alert(`成功导入 ${count} 题！`);
}

// ===== 批改中心 =====
function renderGrading(){
  const container = $('#gradingContainer');
  if(!dbReady){ container.innerHTML = '<div class="lb-empty">未配置数据库</div>'; return; }
  const pending = submissions.filter(s => !s.graded);
  const graded = submissions.filter(s => s.graded);
  let html = `<div class="grading-tabs">
    <button class="bank-tab ${gradingFilter.status==='pending'?'active':''}" onclick="gradingFilter.status='pending';renderGrading()">待批改 (${pending.length})</button>
    <button class="bank-tab ${gradingFilter.status==='graded'?'active':''}" onclick="gradingFilter.status='graded';renderGrading()">已批改 (${graded.length})</button>
  </div>`;
  let list = gradingFilter.status === 'pending' ? pending : graded;
  list = [...list].sort((a,b) => (b.submittedAt||0) - (a.submittedAt||0));
  if(list.length === 0){
    html += `<div class="lb-empty"><p>${gradingFilter.status==='pending'?'暂无待批改的提交':'暂无已批改的记录'}</p></div>`;
    container.innerHTML = html;
    return;
  }
  for(const sub of list){
    const q = questions.find(x => x.id === sub.questionId);
    const m = members.find(x => x.id === sub.memberId);
    if(!q || !m) continue;
    html += `<div class="grading-item">
      <div class="grading-item-header">
        <div class="question-item-meta">
          <span class="quiz-type-tag ${q.type}">${q.type}</span>
          <span style="font-size:13px">${SUBJECT_MAP[q.subject].icon} ${q.subject}</span>
          <span style="font-size:13px;color:var(--primary)">${escapeHtml(m.name)}</span>
          <span class="badge ${sub.graded?'graded':'badge-pending'}">${sub.graded?'已批改':'待批改'}</span>
        </div>
        <span style="font-size:12px;color:var(--text-dim)">${q.date}</span>
      </div>
      <div class="grading-question">📝 ${escapeHtml(q.content)}</div>`;
    if(q.options){
      for(let i=0;i<q.options.length;i++){
        const letter = String.fromCharCode(65+i);
        const isAns = letter === String(sub.answer||'').toUpperCase();
        const isCorrect = letter === String(q.correctAnswer||'').toUpperCase();
        html += `<div style="font-size:13px;${isCorrect?'color:var(--green)':''}">${letter}. ${escapeHtml(q.options[i])} ${isAns?'← 学生选':''} ${isCorrect?'✓正确':''}</div>`;
      }
    } else {
      html += `<div class="grading-answer">${escapeHtml(sub.answer)}</div>`;
    }
    if(q.referenceAnswer){ html += `<div class="grading-ref">📖 参考答案：${escapeHtml(q.referenceAnswer)}</div>`; }
    html += `<div class="grading-controls">
      <label style="font-size:13px;color:var(--text-dim)">得分：</label>
      <input class="form-input grading-score-input" type="number" id="grade_${sub.id}" value="${sub.score||0}" min="0" max="${q.points}">
      <span style="font-size:13px;color:var(--text-dim)">/ ${q.points}</span>`;
    if(!sub.graded) html += `<button class="btn-success" onclick="gradeSubmission('${sub.id}')">批改完成 ✓</button>`;
    else html += `<button class="btn-secondary" onclick="gradeSubmission('${sub.id}')">更新分数</button>`;
    html += `</div></div>`;
  }
  container.innerHTML = html;
}

async function gradeSubmission(subId){
  const sub = submissions.find(s => s.id === subId);
  if(!sub) return;
  const q = questions.find(x => x.id === sub.questionId);
  if(!q) return;
  const score = parseInt($(`#grade_${subId}`).value) || 0;
  sub.score = Math.min(score, q.points);
  sub.graded = true;
  sub.gradedAt = Date.now();
  if(dbReady){
    await sb.from('submissions').update({
      score: sub.score, graded: true, graded_at: new Date(sub.gradedAt).toISOString(), correct: sub.correct
    }).eq('id', subId);
  }
  await recalcAndSaveMember(sub.memberId);
  await loadMembers(); // 刷新成员积分
  renderGrading();
}

// ===== 排行榜 =====
function renderLeaderboard(){
  const list = $('#leaderboardList');
  if(members.length === 0){ list.innerHTML = '<div class="lb-empty">暂无成员数据</div>'; return; }
  const sorted = [...members].sort((a,b) => b.points - a.points);
  list.innerHTML = sorted.map((m, i) => {
    const lv = getLevel(m.points);
    const lvData = LEVELS[lv];
    const next = getNextLevel(m.points);
    let lvText = lvData.name;
    if(next) lvText += ` · 距 ${next.name} 还差 ${next.threshold - m.points}`;
    else lvText += ' · 已满级 👑';
    const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}`;
    return `<div class="lb-item">
      <div class="lb-rank ${i<3?'rank-'+(i+1):''}">${medal}</div>
      <div class="lb-info">
        <div class="lb-name">${escapeHtml(m.name)}</div>
        <div class="lb-level"><span class="lv-badge" style="background:${lvData.color}22;color:${lvData.color}">${lvData.name}</span> ${lvText}</div>
      </div>
      <div class="lb-points">${m.points}</div>
      <div class="lb-actions"></div>
    </div>`;
  }).join('');
}

// ===== 等级卡片 =====
function renderLevels(){
  $('#levelsGrid').innerHTML = LEVELS.slice(1).map(l => `
    <div class="level-card" data-level="${l.level}">
      <div class="level-badge">${'⭐'.repeat(Math.min(l.level,5))}${l.level>5?'⭐':''} ${l.name}</div>
      <div class="level-name">${l.name}</div>
      <div class="level-threshold">积分达到 <strong style="color:var(--text)">${l.threshold}</strong> 分解锁</div>
      <div class="level-progress"><div class="level-progress-bar" style="width:100%"></div></div>
    </div>`).join('');
}

// ===== 成员管理 =====
function renderMembersList(){
  const list = $('#membersList');
  if(members.length === 0){ list.innerHTML = '<div class="lb-empty">暂无成员，添加成员后即可开始管理</div>'; return; }
  list.innerHTML = members.map((m, i) => {
    const lv = getLevel(m.points);
    const lvData = LEVELS[lv];
    return `<div class="lb-item">
      <div class="lb-rank">${i+1}</div>
      <div class="lb-info">
        <div class="lb-name">${escapeHtml(m.name)}</div>
        <div class="lb-level"><span class="lv-badge" style="background:${lvData.color}22;color:${lvData.color}">${lvData.name}</span> ${m.points}分</div>
      </div>
      <div class="lb-points">${m.points}</div>
      <div class="lb-actions">
        <button class="lb-act-btn edit" onclick="openEditMember('${m.id}')">✏️</button>
        <button class="lb-act-btn del" onclick="deleteMember('${m.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

async function addMember(){
  const input = $('#memberName');
  const name = input.value.trim();
  if(!name){ alert('请输入成员昵称'); return; }
  if(name.length > 20){ alert('昵称最长20字'); return; }
  const m = { id: uid(), name, points:0, created_at: new Date().toISOString() };
  if(dbReady){
    const { data, error } = await sb.from('members').insert({ id:m.id, name, points:0 }).select();
    if(error){ alert('添加失败: '+error.message); return; }
  }
  members.push(m);
  input.value = '';
  renderMembersList();
}

async function deleteMember(id){
  const m = members.find(x=>x.id===id);
  if(!m) return;
  if(!confirm(`确定删除「${m.name}」？相关答题记录也会删除。`)) return;
  if(dbReady){ await sb.from('members').delete().eq('id', id); }
  members = members.filter(x=>x.id!==id);
  submissions = submissions.filter(s=>s.memberId!==id);
  renderMembersList();
}

function openEditMember(id){
  const m = members.find(x=>x.id===id);
  if(!m) return;
  $('#modalTitle').textContent = `编辑「${m.name}」`;
  $('#modalBody').innerHTML = `
    <p style="color:var(--text-dim);font-size:14px;margin-bottom:10px">当前积分：<strong style="color:var(--primary);font-size:20px">${m.points}</strong></p>
    <input type="number" id="editDelta" placeholder="输入增减积分（如 +5 或 -10）" value="">
    <div style="font-size:12px;color:var(--text-dim);margin:6px 0 8px">快捷加分：</div>
    <div class="quick-adds">
      <button onclick="quickAdd(5)">+5</button><button onclick="quickAdd(10)">+10</button>
      <button onclick="quickAdd(20)">+20</button><button onclick="quickAdd(35)">+35</button>
      <button onclick="quickAdd(50)">+50</button><button onclick="quickAdd(-5)">-5</button>
    </div>`;
  $('#modalFooter').innerHTML = `<button class="btn-secondary" onclick="closeModal()">取消</button>
    <button class="btn-primary" onclick="confirmEditMember('${id}')">确认</button>`;
  $('#modalOverlay').classList.add('show');
  setTimeout(() => $('#editDelta')?.focus(), 100);
}
function quickAdd(val){ const input = $('#editDelta'); input.value = (parseInt(input.value)||0)+val; }
async function confirmEditMember(id){
  const delta = parseInt($('#editDelta').value);
  if(!delta || isNaN(delta)){ closeModal(); return; }
  const m = members.find(x=>x.id===id);
  if(!m) return;
  m.points = Math.max(0, m.points + delta);
  if(dbReady){ await sb.from('members').update({ points: m.points }).eq('id', id); }
  closeModal();
  renderMembersList();
}

// ===== 弹窗 =====
function closeModal(){ $('#modalOverlay').classList.remove('show'); }

// ===== 登录系统 =====
async function doLogin() {
  const username = $('#loginUser').value.trim();
  const password = $('#loginPass').value.trim();
  const errEl = $('#loginError');
  if(!username || !password){ errEl.textContent = '请输入账号和密码'; return; }
  errEl.textContent = '登录中…';
  $('#loginBtn').disabled = true;
  
  if(!dbReady){ errEl.textContent = '数据库未连接'; $('#loginBtn').disabled = false; return; }
  
  // 只查 accounts 表，不关联 members（避免 null member_id 报错）
  const { data, error } = await sb.from('accounts')
    .select('id,username,password,role,member_id')
    .eq('username', username)
    .eq('password', password);
  
  if(error){
    errEl.textContent = '查询失败: ' + (error.message || '未知错误');
    $('#loginBtn').disabled = false;
    return;
  }
  
  if(!data || data.length === 0){
    errEl.textContent = '账号或密码错误';
    $('#loginBtn').disabled = false;
    return;
  }
  
  const acct = data[0];
  // 如果有 member_id，再单独查成员名
  let memberName = null;
  if(acct.member_id){
    const { data: mData } = await sb.from('members').select('name').eq('id', acct.member_id).single();
    if(mData) memberName = mData.name;
  }
  handleLoginSuccess(acct, memberName);
}

function handleLoginSuccess(acct, memberName){
  currentUser = {
    id: acct.id,
    username: acct.username,
    role: acct.role,
    memberId: acct.member_id,
    memberName: memberName
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
  isAdmin = acct.role === 'admin';
  showApp();
}

function showApp(){
  $('#loginOverlay').classList.add('hide');
  $('#userInfo').style.display = 'flex';
  $('#adminToggle').style.display = 'none'; // 不再需要PIN模式
  const nameDisplay = currentUser.memberName || (currentUser.role === 'admin' ? '群主' : currentUser.username);
  $('#userNameDisplay').textContent = '👤 ' + nameDisplay;
  
  if(isAdmin){
    $$('.admin-only').forEach(el => el.style.display = '');
  } else {
    $$('.admin-only').forEach(el => el.style.display = 'none');
  }
  
  // 显示改密按钮 (仅群主)
  const changePassBtn = $('#changePassBtn');
  if(isAdmin){
    changePassBtn.style.display = '';
    changePassBtn.onclick = function(){
      showChangePasswordModal();
    };
  } else {
    changePassBtn.style.display = 'none';
  }

  showView('home');
}

function showLogin(){
  $('#loginOverlay').classList.remove('hide');
  $('#userInfo').style.display = 'none';
  $('#loginUser').value = '';
  $('#loginPass').value = '';
  $('#loginError').textContent = '';
  $('#loginBtn').disabled = false;
}

function doLogout(){
  localStorage.removeItem(SESSION_KEY);
  currentUser = null;
  isAdmin = false;
  showLogin();
}

function restoreSession(){
  const saved = localStorage.getItem(SESSION_KEY);
  if(saved){
    try {
      currentUser = JSON.parse(saved);
      isAdmin = currentUser.role === 'admin';
      return true;
    } catch { return false; }
  }
  return false;
}

// ===== 改密功能 =====
function showChangePasswordModal(){
  // 确保 $ 函数可用
  if (typeof $ === 'undefined') { window.$ = function(s) { return document.querySelector(s); } }
  
  // 创建模态框
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" style="width:300px;">
      <h3>🔐 修改登录密码</h3>
      <div class="modal-body">
        <p>请输入旧密码</p>
        <input type="password" id="oldPass" class="form-input" placeholder="旧密码">
        <p>请输入新密码</p>
        <input type="password" id="newPass" class="form-input" placeholder="新密码">
        <p>确认新密码</p>
        <input type="password" id="confirmPass" class="form-input" placeholder="确认新密码">
      </div>
      <div class="modal-footer">
        <button id="confirmPassBtn" class="btn-primary">确认修改</button>
        <button id="cancelPassBtn" class="btn-secondary">取消</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // 确认修改按钮
  $('#confirmPassBtn').onclick = async function(){
    const oldP = $('#oldPass').value.trim();
    const newP = $('#newPass').value.trim();
    const confirmP = $('#confirmPass').value.trim();
    
    if(!oldP || !newP || !confirmP){
      alert('请填写所有字段');
      return;
    }
    if(newP !== confirmP){
      alert('两次输入的新密码不一致');
      return;
    }
    if(newP.length < 4){
      alert('新密码至少4位');
      return;
    }
    
    // 验证旧密码
    const { data: userData } = await sb.from('members').select('password').eq('id', currentUser.id).single();
    if(!userData || userData.password !== oldP){
      alert('旧密码错误');
      document.body.removeChild(modal);
      return;
    }
    
    // 更新密码
    await sb.from('members').update({password: newP}).eq('id', currentUser.id);
    alert('密码修改成功！请使用新密码登录');
    document.body.removeChild(modal);
    // 刷新会话，保持登录状态
    const saved = localStorage.getItem(SESSION_KEY);
    if(saved){
      currentUser = JSON.parse(saved);
    }
  };
  
  // 取消按钮
  $('#cancelPassBtn').onclick = function(){
    document.body.removeChild(modal);
  };
  
  // 点击模态框外部关闭
  modal.onclick = function(e){
    if(e.target === modal){
      document.body.removeChild(modal);
    }
  };
}

// ===== 导出/导入 =====
function exportAll(){
  const data = { members, questions, submissions, exportDate: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `学习群数据_${todayStr()}.json`; a.click();
  URL.revokeObjectURL(url);
}

// ===== 计算器 =====
function updateCalc(){
  const math = parseInt($('#calcMath').value) || 0;
  const rank = parseInt(document.querySelector('input[name="rank"]:checked')?.value || '0');
  const total = math * 5 + {0:0,1:35,2:20,3:10}[rank];
  $('#calcScore').textContent = total;
  $('#calcLevel').textContent = LEVELS[getLevel(total)].name;
}

// ===== 导航 =====
function initNav(){
  $$('.nav-link').forEach(link => {
    link.addEventListener('click', e => { e.preventDefault(); const view = link.dataset.view; if(view) showView(view); });
  });
  $('#mobileMenuBtn').addEventListener('click', () => $('#navLinks').classList.toggle('open'));
  // 登录/登出按钮
$('#loginBtn').addEventListener('click', doLogin);
$('#loginPass').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
$('#loginUser').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('loginPass').focus(); });
$('#logoutBtn').addEventListener('click', doLogout);

// 管理员模式按钮（现在只是备用，通过登录控制）
$('#adminToggle').addEventListener('click', () => {
  if(!isAdmin){ alert('只有群主可以进入后台'); return; }
  showView('bank');
});

// 成员管理
$('#addMemberBtn').addEventListener('click', addMember);
$('#memberName').addEventListener('keydown', e => { if(e.key==='Enter') addMember(); });
}

// ===== 初始化 =====
async function init(){
  initSupabase(20); // 重试20次，每次500ms
  
  // 检查已有会话
  if(restoreSession()){
    // 已登录，直接进入
    $('#userInfo').style.display = 'flex';
    $('#loginOverlay').classList.add('hide');
    const nameDisplay = currentUser.memberName || (currentUser.role === 'admin' ? '群主' : currentUser.username);
    $('#userNameDisplay').textContent = '👤 ' + nameDisplay;
    if(isAdmin){
      $$('.admin-only').forEach(el => el.style.display = '');
    } else {
      $$('.admin-only').forEach(el => el.style.display = 'none');
    }
  }
  
  renderLevels();
  renderHome();

  if(dbReady){
    showLoading('正在连接数据库…');
    await loadAll();
    clearLoading();
    renderHome();
  }

  // 成员管理
  $('#addMemberBtn').addEventListener('click', addMember);
  $('#memberName').addEventListener('keydown', e => { if(e.key==='Enter') addMember(); });
  $('#clearAllBtn').addEventListener('click', async () => {
    if(!confirm('确定清空所有本地数据？（Supabase 数据需在 Supabase 后台删除）')) return;
    members=[]; questions=[]; submissions=[];
    renderMembersList(); renderLeaderboard(); renderHome();
  });

  // 导出
  $('#exportBtn').addEventListener('click', exportAll);
  $('#importBtn').addEventListener('click', () => alert('导入功能暂未在 Supabase 模式下启用。如需导入题目，请使用"题库管理"中的"批量添加"。'));

  // 登录/登出
  $('#loginBtn').addEventListener('click', doLogin);
  $('#loginUser').addEventListener('keydown', e => { if(e.key === 'Enter') $('#loginPass').focus(); });
  $('#loginPass').addEventListener('keydown', e => { if(e.key === 'Enter') doLogin(); });
  $('#logoutBtn').addEventListener('click', doLogout);
  
  // 弹窗
  $('#modalOverlay').addEventListener('click', e => { if(e.target.id === 'modalOverlay') closeModal(); });

  // 计算器
  $$('.calc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      let val = parseInt($('#calcMath').value) || 0;
      if(btn.dataset.action === 'inc') val = Math.min(10, val+1);
      else val = Math.max(0, val-1);
      $('#calcMath').value = val;
      updateCalc();
    });
  });
  $$('input[name="rank"]').forEach(r => r.addEventListener('change', updateCalc));
  updateCalc();

  // 定时刷新
  setInterval(async () => {
    if(!dbReady) return;
    await loadAll();
    if(currentView === 'home') renderHome();
    if(currentView === 'quiz' && !quizState.subject) renderQuiz();
    if(currentView === 'leaderboard') renderLeaderboard();
    if(currentView === 'grading') renderGrading();
  }, 30000); // 30秒刷新

  initNav();
}

// 全局暴露
window.showView = showView;
window.selectOption = selectOption;
window.submitQuiz = submitQuiz;
window.renderQuiz = renderQuiz;
window.openQuestionEditor = openQuestionEditor;
window.toggleQuestionFields = toggleQuestionFields;
window.saveQuestion = saveQuestion;
window.deleteQuestion = deleteQuestion;
window.openBulkEditor = openBulkEditor;
window.processBulk = processBulk;
window.gradeSubmission = gradeSubmission;
window.renderBank = renderBank;
window.renderGrading = renderGrading;
window.renderMembersList = renderMembersList;
window.openEditMember = openEditMember;
window.deleteMember = deleteMember;
window.quickAdd = quickAdd;
window.confirmEditMember = confirmEditMember;
window.closeModal = closeModal;
window.doLogin = doLogin;
window.doLogout = doLogout;
window.showView = showView;

document.addEventListener('DOMContentLoaded', init);
