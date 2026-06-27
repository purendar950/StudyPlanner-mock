/* StudyPlanner Mock — admin (Supabase). Tree builder: categories → exams → folders → tests. */

var ADMIN = { user:null, cats:[], catId:null, exams:[], examId:null, folders:[], fpath:[], allTests:[], parsed:null, editCat:null, editExam:null, busy:false };

function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escA(s){ return String(s==null?'':s).replace(/'/g,"\\'").replace(/"/g,'&quot;'); }
function toast(m){ var t=document.getElementById('toast'); if(!t)return; t.textContent=m; t.style.opacity='1'; clearTimeout(t._t); t._t=setTimeout(function(){t.style.opacity='0';},2800); }
function slug(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40); }

/* ── Screen navigation (Categories ▸ Exams ▸ Exam) ── */
function showScreen(name){
  ADMIN.screen = name;
  ['categories','exams','exam'].forEach(function(s){ var el=document.getElementById('screen-'+s); if(el) el.style.display = (s===name)?'block':'none'; });
  var back=document.getElementById('adm-back'); if(back) back.style.display = (name==='categories')?'none':'block';
  window.scrollTo({ top:0, behavior:'smooth' });
}
function setTitle(t){ var el=document.getElementById('adm-title'); if(el) el.textContent=t; }
function catName(){ var c=ADMIN.cats.find(function(x){return x.id===ADMIN.catId;}); return c?c.name:'Exams'; }
function admBack(){
  if(ADMIN.screen==='exam'){
    // step up one folder level first, if we're inside folders
    if(ADMIN.fpath && ADMIN.fpath.length){ ADMIN.fpath.pop(); renderFolders(); return; }
    showScreen('exams'); setTitle(catName()); return;
  }
  if(ADMIN.screen==='exams'){ ADMIN.catId=null; showScreen('categories'); setTitle('Exam Categories'); }
}

/* ── Auth gate ── */
async function adminBoot(){
  if(!(window.MockAPI && MockAPI.client())){
    document.getElementById('login-screen').innerHTML =
      '<div class="card login-card"><h3>⚠️ Supabase not configured</h3>' +
      '<p class="muted">Set your keys in <code>js/supabase-config.js</code>.</p></div>';
    return;
  }
  try { ADMIN.user = await MockAPI.currentUser(); } catch(e){ ADMIN.user=null; }
  adminShow();
}
async function adminShow(){
  var login=document.getElementById('login-screen'), panel=document.getElementById('panel');
  if(ADMIN.user){
    var ok = await adminVerify();
    if(!ok){
      login.style.display='flex'; panel.style.display='none';
      var err=document.getElementById('login-err');
      if(err) err.innerHTML='The account <strong>'+(ADMIN.user.email||'')+'</strong> is not an admin. '+
        '<a href="#" onclick="adminSignOut();return false;">Sign out</a>';
      return;
    }
    login.style.display='none'; panel.style.display='block';
    document.getElementById('who').textContent = ADMIN.user.email || '';
    showScreen('categories'); setTitle('Exam Categories');
    adminLoadCategories();
  } else { login.style.display='flex'; panel.style.display='none'; }
}
async function adminVerify(){
  try { var c=MockAPI.client(); var r=await c.from('admins').select('email').eq('email',ADMIN.user.email).maybeSingle();
    if(r.error) return false; return !!r.data; } catch(e){ return false; }
}
async function adminSignIn(){
  var em=(document.getElementById('login-email')||{}).value, pw=(document.getElementById('login-pass')||{}).value;
  var err=document.getElementById('login-err'); if(err) err.textContent='';
  if(!em||!pw){ if(err) err.textContent='Enter email and password.'; return; }
  try { ADMIN.user=await MockAPI.signIn(em.trim(),pw); toast('✅ Signed in'); adminShow(); }
  catch(e){ if(err) err.textContent='Login failed: '+(e.message||e); }
}
async function adminSignOut(){ try{ await MockAPI.signOut(); }catch(e){} ADMIN.user=null; adminShow(); }

/* ── ① Categories ── */
async function adminLoadCategories(){
  try { ADMIN.cats = await MockAPI.listCategories({ publishedOnly:false }); } catch(e){ toast('Load failed: '+(e.message||e)); ADMIN.cats=[]; }
  renderCategories();
}
function renderCategories(){
  var box=document.getElementById('cat-list');
  if(!ADMIN.cats.length){ box.innerHTML='<div class="empty">No categories yet. Add one below.</div>'; return; }
  box.innerHTML = ADMIN.cats.map(function(c){
    var sel = ADMIN.catId===c.id ? ' sel':'';
    return '<div class="item'+sel+'">'+
      '<div><div class="t">'+esc(c.name)+(c.is_coming_soon?' <span class="badge badge-amber">Coming soon</span>':'')+(c.is_published?'':' <span class="badge badge-amber">Hidden</span>')+'</div>'+
        '<div class="s">id: '+esc(c.id)+(c.subtitle?' · '+esc(c.subtitle):'')+'</div></div>'+
      '<div class="row">'+
        '<button class="btn btn-sm" onclick="selectCategory(\''+escA(c.id)+'\')">Open ▸</button>'+
        '<button class="btn btn-sm" onclick="editCategory(\''+escA(c.id)+'\')">✏️</button>'+
        '<button class="btn btn-red btn-sm" onclick="deleteCategory(\''+escA(c.id)+'\')">🗑</button>'+
      '</div></div>';
  }).join('');
}
function clearCatForm(){ ADMIN.editCat=null; ['cat-id','cat-name','cat-sub','cat-icon'].forEach(function(i){document.getElementById(i).value='';}); document.getElementById('cat-soon').checked=false; document.getElementById('cat-pub').checked=true; }
function editCategory(id){ var c=ADMIN.cats.find(function(x){return x.id===id;}); if(!c)return; ADMIN.editCat=id;
  document.getElementById('cat-id').value=c.id; document.getElementById('cat-name').value=c.name||''; document.getElementById('cat-sub').value=c.subtitle||'';
  document.getElementById('cat-icon').value=c.icon_url||''; document.getElementById('cat-soon').checked=!!c.is_coming_soon; document.getElementById('cat-pub').checked=c.is_published!==false;
  window.scrollTo({top:0,behavior:'smooth'}); }
async function saveCategory(){
  var id=(document.getElementById('cat-id').value||'').trim()||slug(document.getElementById('cat-name').value);
  var name=(document.getElementById('cat-name').value||'').trim();
  if(!id||!name){ toast('Slug and name required.'); return; }
  try {
    await MockAPI.upsertCategory({ id:id, name:name, subtitle:(document.getElementById('cat-sub').value||'').trim(),
      icon_url:(document.getElementById('cat-icon').value||'').trim(), is_coming_soon:document.getElementById('cat-soon').checked,
      is_published:document.getElementById('cat-pub').checked, order_index:ADMIN.cats.length });
    toast('✅ Category saved'); clearCatForm(); adminLoadCategories();
  } catch(e){ toast('Save failed: '+(e.message||e)); }
}
async function deleteCategory(id){ if(!confirm('Delete category "'+id+'" and all its exams/folders?'))return;
  try{ await MockAPI.deleteCategory(id); if(ADMIN.catId===id){ADMIN.catId=null;ADMIN.examId=null;} toast('🗑 Deleted'); adminLoadCategories(); resetExamArea(); }catch(e){ toast('Failed: '+(e.message||e)); } }

function selectCategory(id){ ADMIN.catId=id; ADMIN.examId=null; renderCategories(); clearExamForm(); setTitle(catName()); showScreen('exams'); loadExams(); }

/* ── ② Exams ── */
async function loadExams(){
  try { ADMIN.exams = await MockAPI.listExams(ADMIN.catId, { publishedOnly:false }); } catch(e){ ADMIN.exams=[]; toast('Load failed: '+(e.message||e)); }
  renderExams();
}
function resetExamArea(){ var el=document.getElementById('exam-list'); if(el) el.innerHTML='<div class="empty">—</div>'; resetFolderArea(); }
function renderExams(){
  var box=document.getElementById('exam-list');
  if(!ADMIN.catId){ box.innerHTML='<div class="empty">Select a category above.</div>'; return; }
  if(!ADMIN.exams.length){ box.innerHTML='<div class="empty">No exams in this category yet. Add one below.</div>'; return; }
  box.innerHTML = ADMIN.exams.map(function(e){
    var sel = ADMIN.examId===e.id ? ' sel':'';
    return '<div class="item'+sel+'"><div><div class="t">'+esc(e.name)+(e.is_published?'':' <span class="badge badge-amber">Hidden</span>')+'</div>'+
      '<div class="s">id: '+esc(e.id)+(e.subtitle?' · '+esc(e.subtitle):'')+'</div></div>'+
      '<div class="row"><button class="btn btn-sm" onclick="selectExam(\''+escA(e.id)+'\')">Open ▸</button>'+
      '<button class="btn btn-sm" onclick="editExam(\''+escA(e.id)+'\')">✏️</button>'+
      '<button class="btn btn-red btn-sm" onclick="deleteExam(\''+escA(e.id)+'\')">🗑</button></div></div>';
  }).join('');
}
function clearExamForm(){ ADMIN.editExam=null; ['exam-id','exam-name','exam-sub','exam-icon'].forEach(function(i){document.getElementById(i).value='';}); document.getElementById('exam-pub').checked=true; }
function editExam(id){ var e=ADMIN.exams.find(function(x){return x.id===id;}); if(!e)return; ADMIN.editExam=id;
  document.getElementById('exam-id').value=e.id; document.getElementById('exam-name').value=e.name||''; document.getElementById('exam-sub').value=e.subtitle||'';
  document.getElementById('exam-icon').value=e.icon_url||''; document.getElementById('exam-pub').checked=e.is_published!==false; }
async function saveExam(){
  if(!ADMIN.catId){ toast('Select a category first.'); return; }
  var id=(document.getElementById('exam-id').value||'').trim()||slug(document.getElementById('exam-name').value);
  var name=(document.getElementById('exam-name').value||'').trim();
  if(!id||!name){ toast('Slug and name required.'); return; }
  try {
    await MockAPI.upsertExam({ id:id, category_id:ADMIN.catId, name:name, subtitle:(document.getElementById('exam-sub').value||'').trim(),
      icon_url:(document.getElementById('exam-icon').value||'').trim(), is_published:document.getElementById('exam-pub').checked, order_index:ADMIN.exams.length });
    toast('✅ Exam saved'); clearExamForm(); loadExams();
  } catch(e){ toast('Save failed: '+(e.message||e)); }
}
async function deleteExam(id){ if(!confirm('Delete exam "'+id+'" and all its folders/tests?'))return;
  try{ await MockAPI.deleteExam(id); if(ADMIN.examId===id) ADMIN.examId=null; toast('🗑 Deleted'); loadExams(); resetFolderArea(); }catch(e){ toast('Failed: '+(e.message||e)); } }

function selectExam(id){ ADMIN.examId=id; renderExams(); var e=ADMIN.exams.find(function(x){return x.id===id;}); setTitle(e?e.name:'Exam'); showScreen('exam'); loadFolders(); }

/* ── ③ Folders (drill-in navigator) ── */
function resetFolderArea(){ ['folder-list','folder-crumb','mock-tests-list'].forEach(function(i){ var el=document.getElementById(i); if(el) el.innerHTML=''; }); }
function childrenOf(pid){ return ADMIN.folders.filter(function(f){ return (f.parent_id||null)===(pid||null); }); }
function curFolderId(){ return (ADMIN.fpath && ADMIN.fpath.length) ? ADMIN.fpath[ADMIN.fpath.length-1] : null; }
function folderById(id){ return ADMIN.folders.find(function(f){return f.id===id;}); }
function folderPath(f){ var parts=[f.name]; var p=f.parent_id; var g=0; while(p&&g<20){ var pf=folderById(p); if(!pf)break; parts.unshift(pf.name); p=pf.parent_id; g++; } return parts.join(' / '); }

async function loadFolders(){
  ADMIN.fpath = [];
  try { ADMIN.folders = await MockAPI.listFolders(ADMIN.examId); } catch(e){ ADMIN.folders=[]; toast('Load failed: '+(e.message||e)); }
  try { ADMIN.allTests = await MockAPI.listAllTests(ADMIN.examId); } catch(e){ ADMIN.allTests=[]; }
  renderFolders();
}
function renderFolders(){
  var ex=ADMIN.exams.find(function(x){return x.id===ADMIN.examId;});
  var crumb='<a href="#" onclick="folderCrumb(-1);return false;" style="color:var(--accent);">🏠 '+esc(ex?ex.name:'Exam')+'</a>';
  (ADMIN.fpath||[]).forEach(function(id,idx){ var f=folderById(id); crumb+=' / <a href="#" onclick="folderCrumb('+idx+');return false;" style="color:var(--accent);">'+esc(f?f.name:'?')+'</a>'; });
  var cEl=document.getElementById('folder-crumb'); if(cEl) cEl.innerHTML='📂 '+crumb;

  var kids=childrenOf(curFolderId());
  var box=document.getElementById('folder-list');
  if(box){
    if(!kids.length){ box.innerHTML='<div class="empty">No subfolders here. Add one below, or add tests into this level.</div>'; }
    else { box.innerHTML = kids.map(function(f){
      var n=childrenOf(f.id).length;
      return '<div class="item"><div><div class="t">📁 '+esc(f.name)+'</div><div class="s">'+n+' subfolder'+(n===1?'':'s')+'</div></div>'+
        '<div class="row"><button class="btn btn-sm" onclick="folderOpen(\''+f.id+'\')">Open ▸</button>'+
        '<button class="btn btn-sm" onclick="renameFolder(\''+f.id+'\')">✏️</button>'+
        '<button class="btn btn-red btn-sm" onclick="deleteFolder(\''+f.id+'\')">🗑</button></div></div>';
    }).join(''); }
  }
  var loc=document.getElementById('addtest-loc');
  if(loc){ var path=(ADMIN.fpath||[]).map(function(id){var f=folderById(id);return f?f.name:'';}).join(' / '); loc.textContent = path||'(exam root)'; }
  renderTestsHere();
}
function folderOpen(id){ (ADMIN.fpath=ADMIN.fpath||[]).push(id); renderFolders(); }
function folderCrumb(idx){ ADMIN.fpath = idx<0 ? [] : ADMIN.fpath.slice(0, idx+1); renderFolders(); }

async function addFolder(){
  if(!ADMIN.examId){ toast('Open an exam first.'); return; }
  var name=(document.getElementById('folder-name').value||'').trim();
  if(!name){ toast('Folder name required.'); return; }
  var copyChk = document.getElementById('folder-copy');
  var doCopy = copyChk ? copyChk.checked : false;
  try {
    // find a sibling that already has sub-folders, to mirror its structure
    var siblings = childrenOf(curFolderId());
    var template = doCopy ? siblings.filter(function(s){ return childrenOf(s.id).length>0; })[0] : null;
    var created = await MockAPI.createFolder({ exam_id:ADMIN.examId, parent_id:curFolderId(), name:name, order_index:siblings.length });
    var cloned = 0;
    if(template && created){ cloned = await cloneSubtree(template.id, created.id); }
    document.getElementById('folder-name').value='';
    ADMIN.folders = await MockAPI.listFolders(ADMIN.examId);
    toast(cloned ? ('✅ Added "'+name+'" + '+cloned+' sub-folders (copied from "'+template.name+'")') : ('✅ Folder "'+name+'" added'));
    renderFolders();
  } catch(e){ toast('Failed: '+(e.message||e)); }
}
/* Recursively copy a template folder's descendants under newParentId. Returns count created. */
async function cloneSubtree(templateId, newParentId){
  var kids = childrenOf(templateId);
  var count = 0;
  for(var i=0;i<kids.length;i++){
    var created = await MockAPI.createFolder({ exam_id:ADMIN.examId, parent_id:newParentId, name:kids[i].name, order_index:i });
    count++;
    count += await cloneSubtree(kids[i].id, created.id);
  }
  return count;
}
async function renameFolder(id){ var f=folderById(id); if(!f)return; var name=prompt('Rename folder:', f.name); if(!name)return;
  try{ await MockAPI.renameFolder(id,name.trim()); ADMIN.folders=await MockAPI.listFolders(ADMIN.examId); toast('✅ Renamed'); renderFolders(); }catch(e){ toast('Failed: '+(e.message||e)); } }
async function deleteFolder(id){ if(!confirm('Delete this folder and its subfolders?'))return;
  try{ await MockAPI.deleteFolder(id); ADMIN.fpath=(ADMIN.fpath||[]).filter(function(x){return x!==id;});
    ADMIN.folders=await MockAPI.listFolders(ADMIN.examId); ADMIN.allTests=await MockAPI.listAllTests(ADMIN.examId);
    toast('🗑 Deleted'); renderFolders(); }catch(e){ toast('Failed: '+(e.message||e)); } }

function renderTestsHere(){
  var box=document.getElementById('mock-tests-list'); if(!box) return;
  var here=(ADMIN.allTests||[]).filter(function(t){ return (t.folder_id||null)===curFolderId(); });
  if(!here.length){ box.innerHTML='<div class="empty">No tests in this folder. Add one above.</div>'; return; }
  box.innerHTML = here.map(function(t){
    var url='test-engine.html?id='+encodeURIComponent(t.id);
    return '<div class="item"><div style="flex:1;min-width:200px;">'+
      '<div class="t">'+esc(t.title||t.id)+' '+(t.is_free===false?'<span class="badge badge-paid">PAID</span>':'<span class="badge badge-free">FREE</span>')+(t.is_published?'':' <span class="badge badge-amber">Draft</span>')+'</div>'+
      '<div class="s">'+(t.total_questions||0)+' Qs · '+(t.total_sections||0)+' sections · ▶ <a href="'+url+'" target="_blank" style="color:var(--accent);">open</a></div></div>'+
      '<div class="row"><button class="btn btn-sm" onclick="adminTogglePublish(\''+escA(t.id)+'\','+(!t.is_published)+')">'+(t.is_published?'👁 Unpublish':'🚀 Publish')+'</button>'+
      '<button class="btn btn-red btn-sm" onclick="adminDeleteTest(\''+escA(t.id)+'\')">🗑</button></div></div>';
  }).join('');
}

/* ── ④ Upload test ── */
function adminTogglePaste(){ var ta=document.getElementById('mock-json-text'); if(ta) ta.style.display = ta.style.display==='none'?'block':'none'; }
function adminParseFile(input){ var f=input.files&&input.files[0]; if(!f)return; var r=new FileReader(); r.onload=function(){ adminTryParse(r.result); }; r.readAsText(f); }
function adminParseText(){ var ta=document.getElementById('mock-json-text'); if(ta) adminTryParse(ta.value); }
function adminTryParse(raw){
  var prev=document.getElementById('mock-preview'); ADMIN.parsed=null;
  if(!raw||!raw.trim()){ if(prev) prev.innerHTML=''; return; }
  var obj; try{ obj=JSON.parse(raw); }catch(e){ prev.innerHTML='<div class="empty" style="color:var(--red);">❌ Invalid JSON: '+esc(e.message)+'</div>'; return; }
  var res=adminNormalize(obj);
  if(!res.ok){ prev.innerHTML='<div class="empty" style="color:var(--red);">❌ '+res.errors.map(esc).join('<br>')+'</div>'; return; }
  ADMIN.parsed={ test:res.test, sections:res.sections };
  var totalQ=res.sections.reduce(function(s,sec){return s+sec.questions.length;},0);
  prev.innerHTML='<div style="border:1px solid var(--border);border-radius:10px;padding:12px;">'+
    '<div style="font-weight:700;">✅ '+esc(res.test.title)+' <span class="muted">(id: '+esc(res.test.id)+')</span></div>'+
    '<div class="muted" style="margin:6px 0;">'+totalQ+' questions · '+res.sections.length+' sections · +'+res.test.correct_score+' / -'+res.test.negative_score+'</div>'+
    (res.warnings.length?'<div class="muted" style="color:#F59E0B;margin-bottom:8px;">⚠ '+res.warnings.map(esc).join('<br>⚠ ')+'</div>':'')+
    '<button class="btn btn-green" onclick="adminUpload()">⬆️ Upload to this exam</button></div>';
}
function adminNormalize(obj){
  var errors=[],warnings=[];
  if(!obj||typeof obj!=='object') return {ok:false,errors:['Root must be a JSON object.'],warnings:[]};

  // ── Test config: accept obj.test OR obj.meta ──
  var test = obj.test ? Object.assign({}, obj.test) : {};
  var timer = null;
  if(obj.meta && !obj.test){
    var m=obj.meta;
    test.title = m.title;
    if(m.correct_score!=null)  test.correct_score = m.correct_score;
    if(m.negative_score!=null) test.negative_score = m.negative_score;
    if(m.timer_minutes!=null)  timer = Number(m.timer_minutes);
    if(m.id) test.id = m.id;
  }
  if(!test.title){ test.title=test.id||'Untitled Mock'; warnings.push('No title — using "'+test.title+'".'); }
  if(!test.id){ test.id=String(test.title).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||('mock-'+Date.now()); warnings.push('No id — generated "'+test.id+'".'); }
  test.correct_score=(test.correct_score!=null)?Number(test.correct_score):2;
  test.negative_score=(test.negative_score!=null)?Number(test.negative_score):0.5;
  test.is_published=test.is_published!==false;

  // ── Sections: accept array | object-keyed-by-name | flat questions ──
  var sections=[];
  if(Array.isArray(obj.sections)){
    sections=obj.sections.map(function(s,i){ return {name:s.name||('Section '+(i+1)),time_min:s.time_min||null,questions:Array.isArray(s.questions)?s.questions:[]}; });
  } else if(obj.sections && typeof obj.sections==='object'){
    sections=Object.keys(obj.sections).map(function(k){ return {name:k,time_min:null,questions:Array.isArray(obj.sections[k])?obj.sections[k]:[]}; });
  } else if(Array.isArray(obj.questions)){
    var by={}; obj.questions.forEach(function(q){ var t=q.topic||q.section||'Section 1'; (by[t]=by[t]||[]).push(q); });
    sections=Object.keys(by).map(function(n){ return {name:n,time_min:null,questions:by[n]}; });
  } else errors.push('Provide "sections" (array or object) OR "questions": [...].');

  // ── Per-section time: from test.section_time_min, else split total timer across sections ──
  if(test.section_time_min!=null){ test.section_time_min=Number(test.section_time_min); }
  else if(timer && sections.length){ test.section_time_min=Math.max(1,Math.round(timer/sections.length)); }
  else { test.section_time_min=15; }
  sections.forEach(function(s){ if(!s.time_min) s.time_min=test.section_time_min; });

  // ── Normalize every question to the engine shape ──
  sections.forEach(function(sec){ sec.questions=(sec.questions||[]).map(normalizeQuestion); });

  // ── Validate ──
  var total=0;
  sections.forEach(function(sec){ if(!sec.questions.length) warnings.push('Section "'+sec.name+'" has no questions.');
    sec.questions.forEach(function(q,qi){ total++; var oc=0; for(var n=1;n<=5;n++) if(q['option_'+n]!=null&&q['option_'+n]!=='') oc++;
      if(oc<2) errors.push('Q'+(qi+1)+' in "'+sec.name+'": needs at least 2 options.');
      if(q.answer==null||q.answer==='') errors.push('Q'+(qi+1)+' in "'+sec.name+'": missing "answer".');
      if(q.question==null||q.question==='') errors.push('Q'+(qi+1)+' in "'+sec.name+'": missing "question".'); }); });
  if(sections.length&&total===0) errors.push('No questions found.');
  if(errors.length) return {ok:false,errors:errors,warnings:warnings};
  return {ok:true,errors:[],warnings:warnings,test:test,sections:sections};
}

/* Convert one question of any supported shape to the engine shape:
   options[] → option_1..N ; solution → explanation ; answer letter → number. */
function normalizeQuestion(q){
  q = Object.assign({}, q);
  if(Array.isArray(q.options)){
    q.options.forEach(function(opt,i){ if(q['option_'+(i+1)]==null) q['option_'+(i+1)]=opt; });
    delete q.options;
  }
  if((q.explanation==null||q.explanation==='') && q.solution!=null) q.explanation=q.solution;
  if(q.answer!=null){
    var a=String(q.answer).trim();
    if(/^[A-Ea-e]$/.test(a)) q.answer=String('abcde'.indexOf(a.toLowerCase())+1); // A/B/C/D → 1/2/3/4
    else q.answer=a;
  }
  return q;
}
async function adminUpload(){
  if(!ADMIN.parsed){ toast('Nothing to upload.'); return; }
  if(!ADMIN.examId){ toast('Select an exam first.'); return; }
  if(ADMIN.busy) return; ADMIN.busy=true; toast('⏳ Uploading…');
  try{
    var p=ADMIN.parsed;
    p.test.exam_id=ADMIN.examId;
    p.test.folder_id=curFolderId();
    p.test.is_free=document.getElementById('test-free').value!=='paid';
    var r=await MockAPI.uploadTest(p);
    toast('✅ Uploaded '+r.questionCount+' questions.');
    ADMIN.parsed=null; var prev=document.getElementById('mock-preview'); if(prev) prev.innerHTML='<div class="muted">✅ Done.</div>';
    var ta=document.getElementById('mock-json-text'); if(ta) ta.value=''; var fi=document.getElementById('mock-file'); if(fi) fi.value='';
    adminRefreshTests();
  }catch(e){ toast('Upload failed: '+(e.message||e)); }
  finally{ ADMIN.busy=false; }
}

/* ── Bulk import: upload many JSON mocks into the CURRENT folder (no sub-folders created), with per-file report ── */
async function bulkImport(input){
  if(!ADMIN.examId){ toast('Open an exam first.'); return; }
  var files = Array.prototype.slice.call(input.files||[]).filter(function(f){ return /\.json$/i.test(f.name); });
  var report=document.getElementById('bulk-report');
  if(!files.length){ if(report) report.innerHTML='<div class="empty">No .json files found in the selection.</div>'; return; }
  if(report) report.innerHTML='<div class="muted">⏳ Processing '+files.length+' file(s)…</div>';
  var markFree = !document.getElementById('bulk-free') || document.getElementById('bulk-free').checked;
  var folderId = curFolderId();   // everything goes into the folder you're currently in

  var ok=[], fail=[];
  for(var i=0;i<files.length;i++){
    var f=files[i];
    try{
      var text=await f.text();
      var obj; try{ obj=JSON.parse(text); }catch(pe){ throw new Error('Invalid JSON'); }
      var res=adminNormalize(obj);
      if(!res.ok) throw new Error(res.errors[0] + (res.errors.length>1?(' (+'+(res.errors.length-1)+' more)'):''));
      var hasId = (obj.test && obj.test.id) || (obj.meta && obj.meta.id);
      if(!hasId) res.test.id = slug(f.name.replace(/\.json$/i,'')) || res.test.id;
      res.test.exam_id=ADMIN.examId; res.test.folder_id=folderId; res.test.is_free=markFree;
      await MockAPI.uploadTest(res);
      var q=res.sections.reduce(function(a,s){return a+s.questions.length;},0);
      ok.push({ name:f.name, title:res.test.title, q:q });
    }catch(e){ fail.push({ name:f.name, err:(e.message||String(e)) }); }
  }

  try { ADMIN.allTests=await MockAPI.listAllTests(ADMIN.examId); }catch(e){}
  renderTestsHere();

  var html='<div style="font-weight:700;margin-bottom:8px;">Imported '+ok.length+' / '+files.length+(fail.length?(' · <span style="color:var(--red);">'+fail.length+' failed</span>'):'')+'</div>';
  if(ok.length) html += ok.map(function(o){ return '<div class="muted">✅ '+esc(o.name)+' → <b>'+esc(o.title)+'</b> ('+o.q+' Qs)</div>'; }).join('');
  if(fail.length) html += '<div style="color:var(--red);font-weight:700;margin-top:10px;">Errors — fix these and re-import:</div>'+
    fail.map(function(fl){ return '<div style="color:var(--red);">❌ '+esc(fl.name)+' — '+esc(fl.err)+'</div>'; }).join('');
  if(report) report.innerHTML=html;
  toast('✅ '+ok.length+' uploaded'+(fail.length?(' · ❌ '+fail.length+' failed'):''));
  try{ input.value=''; }catch(e){}
}

/* ── ⑤ Tests list (current folder) ── */
async function adminRefreshTests(){
  if(!ADMIN.examId) return;
  try{ ADMIN.allTests = await MockAPI.listAllTests(ADMIN.examId); }catch(e){ ADMIN.allTests=[]; }
  renderTestsHere();
}
async function adminTogglePublish(id,val){ try{ await MockAPI.setPublished(id,val); toast('✅ Updated'); adminRefreshTests(); }catch(e){ toast('Failed: '+(e.message||e)); } }
async function adminDeleteTest(id){ if(!confirm('Delete test "'+id+'"?'))return; try{ await MockAPI.deleteTest(id); toast('🗑 Deleted'); adminRefreshTests(); }catch(e){ toast('Failed: '+(e.message||e)); } }

/* ── Images ── */
async function adminUploadImage(input){
  var f=input.files&&input.files[0]; if(!f)return;
  var box=document.getElementById('mock-img-result'); if(box) box.innerHTML='<div class="muted">⏳ Uploading…</div>';
  try{ var path=Date.now()+'-'+f.name.replace(/[^a-zA-Z0-9._-]/g,'_'); var url=await MockAPI.uploadImage(f,path);
    if(box) box.innerHTML='<div class="muted">✅ Public URL:</div><input type="text" readonly value="'+esc(url)+'" style="width:100%;margin-top:4px;" onclick="this.select()">'+
      '<div style="margin-top:8px;"><img src="'+esc(url)+'" style="max-width:200px;max-height:120px;border:1px solid var(--border);border-radius:6px;"></div>';
  }catch(e){ if(box) box.innerHTML='<div class="empty" style="color:var(--red);">Upload failed: '+esc(e.message||e)+'</div>'; }
}

adminBoot();
