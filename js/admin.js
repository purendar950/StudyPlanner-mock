/* StudyPlanner Mock — admin (Supabase). Tree builder: categories → exams → folders → tests. */

var ADMIN = { user:null, cats:[], catId:null, exams:[], examId:null, folders:[], fpath:[], allTests:[], parsed:null, editCat:null, editExam:null, busy:false };

function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escA(s){ return String(s==null?'':s).replace(/'/g,"\\'").replace(/"/g,'&quot;'); }
function toast(m){ var t=document.getElementById('toast'); if(!t)return; t.textContent=m; t.style.opacity='1'; clearTimeout(t._t); t._t=setTimeout(function(){t.style.opacity='0';},2800); }
function slug(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40); }

/* ── Screen navigation (Categories ▸ Exams ▸ Exam) ── */
function showScreen(name){
  ADMIN.screen = name;
  ['categories','exams','exam','editor'].forEach(function(s){ var el=document.getElementById('screen-'+s); if(el) el.style.display = (s===name)?'block':'none'; });
  var back=document.getElementById('adm-back'); if(back) back.style.display = (name==='categories')?'none':'block';
  window.scrollTo({ top:0, behavior:'smooth' });
  saveAdminNav();
}
function saveAdminNav(){ try{ sessionStorage.setItem('sp_admin_nav', JSON.stringify({ screen:ADMIN.screen, catId:ADMIN.catId, examId:ADMIN.examId, fpath:ADMIN.fpath||[] })); }catch(e){} }
async function adminRestoreNav(){
  var s=null; try{ s=JSON.parse(sessionStorage.getItem('sp_admin_nav')||'null'); }catch(e){}
  if(!s || !s.catId || !ADMIN.cats.find(function(c){return c.id===s.catId;})) return;
  ADMIN.catId=s.catId; renderCategories(); clearExamForm(); setTitle(catName()); showScreen('exams'); await loadExams();
  if(s.examId && ADMIN.exams.find(function(e){return e.id===s.examId;})){
    ADMIN.examId=s.examId; renderExams(); var ex=ADMIN.exams.find(function(x){return x.id===s.examId;});
    setTitle(ex?ex.name:'Exam'); showScreen('exam'); await loadFolders();
    if(Array.isArray(s.fpath) && s.fpath.length){
      var path=[]; for(var i=0;i<s.fpath.length;i++){ if(folderById(s.fpath[i])) path.push(s.fpath[i]); else break; }
      ADMIN.fpath=path; renderFolders();
    }
  }
}
function setTitle(t){ var el=document.getElementById('adm-title'); if(el) el.textContent=t; }
function catName(){ var c=ADMIN.cats.find(function(x){return x.id===ADMIN.catId;}); return c?c.name:'Exams'; }
function admBack(){
  if(ADMIN.screen==='editor'){ var ex0=ADMIN.exams.find(function(x){return x.id===ADMIN.examId;}); setTitle(ex0?ex0.name:'Exam'); showScreen('exam'); return; }
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
    await adminLoadCategories();
    await adminRestoreNav();
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
async function adminSignOut(){ try{ await MockAPI.signOut(); }catch(e){} try{ sessionStorage.removeItem('sp_admin_nav'); }catch(e){} ADMIN.user=null; adminShow(); }

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
  saveAdminNav();
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
    var url=adminLiveTestUrl(t.id);
    return '<div class="item"><div style="flex:1;min-width:200px;">'+
      '<div class="t">'+esc(t.title||t.id)+' '+(t.is_free===false?'<span class="badge badge-paid">PAID</span>':'<span class="badge badge-free">FREE</span>')+(t.is_published?'':' <span class="badge badge-amber">Draft</span>')+'</div>'+
      '<div class="s">'+(t.total_questions||0)+' Qs · '+(t.total_sections||0)+' sections · ▶ <a href="'+url+'" target="_blank" style="color:var(--accent);">live link</a></div></div>'+
      '<div class="row"><button class="btn btn-sm" onclick="adminAttemptTest(\''+escA(t.id)+'\')">📝 Attempt Mock</button><button class="btn btn-sm" onclick="adminCopyTestLink(\''+escA(t.id)+'\')">🔗 Copy Link</button><button class="btn btn-sm" onclick="openEditor(\''+escA(t.id)+'\')">✏️ Edit</button>'+
      '<button class="btn btn-sm" onclick="adminTogglePublish(\''+escA(t.id)+'\','+(!t.is_published)+')">'+(t.is_published?'👁 Unpublish':'🚀 Publish')+'</button>'+
      '<button class="btn btn-red btn-sm" onclick="adminDeleteTest(\''+escA(t.id)+'\')">🗑</button></div></div>';
  }).join('');
}
function adminLiveTestUrl(id){
  var base = window.location.href.replace(/admin\.html.*$/,'').replace(/[#?].*$/,'');
  if(base && base.charAt(base.length-1)!=='/') base += '/';
  return base + 'index.html?test=' + encodeURIComponent(id);
}
function adminCopyTestLink(id){
  var url=adminLiveTestUrl(id);
  function done(){ toast('🔗 Live test link copied'); }
  if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(url).then(done).catch(function(){ prompt('Copy live test link:', url); }); }
  else prompt('Copy live test link:', url);
}
function adminAttemptTest(id){
  window.open(adminLiveTestUrl(id), '_blank', 'noopener');
}

/* ── ④ Upload test ── */
function adminTogglePaste(){ var ta=document.getElementById('mock-json-text'); if(ta) ta.style.display = ta.style.display==='none'?'block':'none'; }
function adminParseFile(input){ var f=input.files&&input.files[0]; if(!f)return; var r=new FileReader(); r.onload=function(){ adminTryParse(r.result); }; r.readAsText(f); }
function adminParseText(){ var ta=document.getElementById('mock-json-text'); if(ta) adminTryParse(ta.value); }
function adminParseJsonLenient(raw){
  try{ return { ok:true, obj:JSON.parse(raw), trailing:'' }; }
  catch(firstErr){
    // Some copied ProMocks files contain a valid JSON object followed by pasted notes/URLs.
    // Extract the first balanced root object so the admin can still import the mock.
    var start=String(raw).indexOf('{');
    if(start<0) return { ok:false, error:firstErr };
    var depth=0, inStr=false, escNext=false;
    for(var i=start;i<raw.length;i++){
      var ch=raw[i];
      if(inStr){
        if(escNext) escNext=false;
        else if(ch==='\\') escNext=true;
        else if(ch==='"') inStr=false;
      } else {
        if(ch==='"') inStr=true;
        else if(ch==='{') depth++;
        else if(ch==='}'){
          depth--;
          if(depth===0){
            try{ return { ok:true, obj:JSON.parse(raw.slice(start,i+1)), trailing:raw.slice(i+1).trim() }; }
            catch(e){ return { ok:false, error:e }; }
          }
        }
      }
    }
    return { ok:false, error:firstErr };
  }
}
function adminTryParse(raw){
  var prev=document.getElementById('mock-preview'); ADMIN.parsed=null;
  if(!raw||!raw.trim()){ if(prev) prev.innerHTML=''; return; }
  var parsed=adminParseJsonLenient(raw), obj;
  if(!parsed.ok){ prev.innerHTML='<div class="empty" style="color:var(--red);">❌ Invalid JSON: '+esc(parsed.error.message||parsed.error)+'</div>'; return; }
  obj=parsed.obj;
  var res=adminNormalize(obj);
  if(parsed.trailing) res.warnings.push('Ignored trailing text after JSON.');
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

  // ── Test config: accept obj.test OR obj.meta (+ top-level title/quiz_id/series_id) ──
  var test = obj.test ? Object.assign({}, obj.test) : {};
  var timer = null;
  if(!obj.test){
    var m=obj.meta||{};
    test.title = obj.title || obj.series_name || m.title || test.title;
    test.id = obj.quiz_id || obj.series_id || m.id || obj.id || test.id;
    var cs=(m.correct_score!=null)?m.correct_score:(m.marksPerQ!=null?m.marksPerQ:null);
    var ns=(m.negative_score!=null)?m.negative_score:(m.neg!=null?m.neg:null);
    if(cs!=null) test.correct_score=cs;
    if(ns!=null) test.negative_score=ns;
    if(m.timer_minutes!=null) timer=Number(m.timer_minutes);
    else if(m.mins!=null) timer=Number(m.mins);
    else if(m.time!=null) timer=Math.max(1,Math.round(Number(m.time)/60));   // seconds → minutes
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

  // ProMocks exports may contain a few placeholder rows with blank options/answers.
  // Keep the valid questions importable and report skipped rows in the preview.
  var isProMocks = obj.series_id!=null && obj.series_name!=null && Array.isArray(obj.questions);

  // ── Validate ──
  var total=0, skipped=0;
  sections.forEach(function(sec){
    var kept=[];
    (sec.questions||[]).forEach(function(q,qi){
      var oc=0; for(var n=1;n<=5;n++) if(q['option_'+n]!=null&&q['option_'+n]!=='') oc++;
      var miss=[];
      if(oc<2) miss.push('needs at least 2 options');
      if(q.answer==null||q.answer==='') miss.push('missing answer');
      if(q.question==null||q.question==='') miss.push('missing question');
      if(miss.length && isProMocks){ skipped++; warnings.push('Skipped Q'+(qi+1)+' in "'+sec.name+'": '+miss.join(', ')+'.'); return; }
      total++; kept.push(q);
      if(oc<2) errors.push('Q'+(qi+1)+' in "'+sec.name+'": needs at least 2 options.');
      if(q.answer==null||q.answer==='') errors.push('Q'+(qi+1)+' in "'+sec.name+'": missing "answer".');
      if(q.question==null||q.question==='') errors.push('Q'+(qi+1)+' in "'+sec.name+'": missing "question".');
    });
    sec.questions=kept;
    if(!sec.questions.length) warnings.push('Section "'+sec.name+'" has no importable questions.');
  });
  if(skipped) warnings.push('Skipped '+skipped+' incomplete ProMocks placeholder question(s).');
  if(obj.total!=null && Number(obj.total)!==total) warnings.push('Declared total '+obj.total+' does not match parsed questions '+total+'.');
  if(sections.length&&total===0) errors.push('No questions found.');
  if(errors.length) return {ok:false,errors:errors,warnings:warnings};
  return {ok:true,errors:[],warnings:warnings,test:test,sections:sections};
}

/* Convert one question of any supported shape to the engine shape:
   qid → id ; options[] → option_1..N ; solution → explanation ; marks → positive_marks ;
   answer letter/text/index → 1-based option number required by the test engine. */
function normalizeQuestion(q){
  q = Object.assign({}, q);
  if(q.id==null && q.qid!=null) q.id=String(q.qid);
  if(q.topic==null && q.topic_id!=null) q.topic=String(q.topic_id);
  if(q.positive_marks==null && q.marks!=null) q.positive_marks=Number(q.marks);

  function takeOpt(val,idx){
    if(val==null) return;
    if(typeof val==='object') val = val.text || val.value || val.label || val.en || val.hi || '';
    if(q['option_'+idx]==null || q['option_'+idx]==='') q['option_'+idx]=val;
  }
  if(Array.isArray(q.options)){
    q.options.forEach(function(opt,i){ takeOpt(opt,i+1); });
    delete q.options;
  }
  if(Array.isArray(q.choices)) q.choices.forEach(function(opt,i){ takeOpt(opt,i+1); });
  if(Array.isArray(q.answers)) q.answers.forEach(function(opt,i){ takeOpt(opt,i+1); });
  var optionAliases=[
    ['option1','optionA','option_a','opt1','optA','opt_a','A','a'],
    ['option2','optionB','option_b','opt2','optB','opt_b','B','b'],
    ['option3','optionC','option_c','opt3','optC','opt_c','C','c'],
    ['option4','optionD','option_d','opt4','optD','opt_d','D','d'],
    ['option5','optionE','option_e','opt5','optE','opt_e','E','e']
  ];
  optionAliases.forEach(function(keys,i){ keys.forEach(function(k){ if(q[k]!=null) takeOpt(q[k],i+1); }); });
  if((q.explanation==null||q.explanation==='') && q.solution!=null) q.explanation=q.solution;

  var optionVals=[];
  for(var n=1;n<=5;n++) if(q['option_'+n]!=null && q['option_'+n]!=='') optionVals.push(String(q['option_'+n]).trim());
  var compactText=function(v){ return String(v==null?'':v).replace(/\s+/g,' ').trim(); };

  // Answer resolution. Supported: answer (1-based number, A/B/C/D, exact option text, or whitespace-normalized option text) | correct (0-based index) | answer_index (0-based)
  if((q.answer==null||q.answer==='')){
    if(q.correct!=null){
      if(/^\d+$/.test(String(q.correct))) q.answer=String(Number(q.correct)+1);   // correct is 0-based
      else q.answer=String(q.correct);
    } else if(q.answer_index!=null && /^\d+$/.test(String(q.answer_index))){
      q.answer=String(Number(q.answer_index)+1);
    }
  }
  if(q.answer!=null){
    var a=String(q.answer).trim();
    if(/^[A-Ea-e]$/.test(a)) q.answer=String('abcde'.indexOf(a.toLowerCase())+1);   // A/B/C/D → 1/2/3/4
    else {
      var exactIndex=optionVals.findIndex(function(opt){ return opt===a; });
      if(exactIndex<0){
        var ca=compactText(a);
        exactIndex=optionVals.findIndex(function(opt){ return compactText(opt)===ca; });
      }
      if(exactIndex>=0) q.answer=String(exactIndex+1);
      else q.answer=a;
    }
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
    var extra='';
    if(document.getElementById('make-sectionals') && document.getElementById('make-sectionals').checked){
      try{ var n=await createSubjectSectionals(p, p.test.is_free); extra=' + '+n+' sectionals'; }catch(se){ extra=' (sectionals failed: '+(se.message||se)+')'; }
    }
    toast('✅ Uploaded '+r.questionCount+' questions'+extra+'.');
    ADMIN.parsed=null; var prev=document.getElementById('mock-preview'); if(prev) prev.innerHTML='<div class="muted">✅ Done.</div>';
    var ta=document.getElementById('mock-json-text'); if(ta) ta.value=''; var fi=document.getElementById('mock-file'); if(fi) fi.value='';
    renderFolders(); adminRefreshTests();
  }catch(e){ toast('Upload failed: '+(e.message||e)); }
  finally{ ADMIN.busy=false; }
}

/* ── Create subject-wise sectional tests from a full mock (Option A) ──
   For each section, make a single-section test under the sibling "Sectionals"
   folder → subject sub-folder (auto-created, with name mapping). */
var SUBJECT_MAP = {
  'reasoning':'Reasoning','general intelligence':'Reasoning','general intelligence & reasoning':'Reasoning','gi':'Reasoning','gir':'Reasoning',
  'gk':'General Awareness','ga':'General Awareness','general awareness':'General Awareness','general knowledge':'General Awareness','general knowledge & awareness':'General Awareness','gs':'General Awareness',
  'math':'Maths','maths':'Maths','mathematics':'Maths','quant':'Maths','quantitative aptitude':'Maths','elementary mathematics':'Maths','numerical ability':'Maths',
  'english':'English','english language':'English','english comprehension':'English',
  'hindi':'Hindi'
};
function titleCase(s){ return String(s||'').toLowerCase().replace(/\b\w/g,function(c){return c.toUpperCase();}); }

async function createSubjectSectionals(res, freeFlag){
  var folders = await MockAPI.listFolders(ADMIN.examId);
  var local = folders.slice();
  function child(parentId,name){ return local.find(function(f){ return (f.parent_id||null)===(parentId||null) && f.name.toLowerCase()===String(name).toLowerCase(); }); }
  async function ensure(parentId,name){ var ex=child(parentId,name); if(ex) return ex;
    var c=await MockAPI.createFolder({ exam_id:ADMIN.examId, parent_id:parentId, name:name, order_index:0 }); local.push(c); return c; }

  var curId=curFolderId();
  var curFolder=local.find(function(f){return f.id===curId;});
  var siblingParent = curFolder ? (curFolder.parent_id||null) : null;   // put "Sectionals" next to the full-mock folder
  var sectionalsRoot = await ensure(siblingParent, 'Sectionals');

  var made=0;
  for(var i=0;i<res.sections.length;i++){
    var sec=res.sections[i];
    if(!sec.questions || !sec.questions.length) continue;
    var disp = SUBJECT_MAP[String(sec.name).toLowerCase().trim()] || titleCase(sec.name);
    var subj = await ensure(sectionalsRoot.id, disp);
    var t = {
      id: (res.test.id||'mock') + '-' + slug(sec.name || ('sec'+(i+1))),
      title: res.test.title + ' – ' + disp,
      exam_id: ADMIN.examId,
      folder_id: subj.id,
      correct_score: res.test.correct_score,
      negative_score: res.test.negative_score,
      section_time_min: sec.time_min || res.test.section_time_min || 15,
      is_free: freeFlag,
      is_published: true
    };
    await MockAPI.uploadTest({ test:t, sections:[ { name: sec.name, time_min: sec.time_min, questions: sec.questions } ] });
    made++;
  }
  ADMIN.folders = await MockAPI.listFolders(ADMIN.examId);
  return made;
}

/* Generate subject-wise sectionals from the full mocks already in the current folder. */
async function generateSectionalsHere(){
  if(!ADMIN.examId) return;
  var here=(ADMIN.allTests||[]).filter(function(t){ return (t.folder_id||null)===curFolderId(); });
  if(!here.length){ toast('No tests in this folder.'); return; }
  if(!confirm('Create subject-wise sectional tests from '+here.length+' test(s) in this folder?\nThey will go into the sibling "Sectionals" folder.')) return;
  var rep=document.getElementById('sec-gen-report');
  var made=0, fail=0;
  for(var i=0;i<here.length;i++){
    if(rep) rep.textContent='⏳ '+(i+1)+' / '+here.length+'…';
    try{
      var got=await MockAPI.getTest(here[i].id);
      var secMap={}, order=[];
      got.questions.forEach(function(r){ var n=r.section_name||'Section 1'; if(!secMap[n]){secMap[n]=[];order.push(n);} secMap[n].push(r.data); });
      var res={ test:{ id:got.test.id, title:got.test.title, correct_score:got.test.correct_score, negative_score:got.test.negative_score, section_time_min:got.test.section_time_min },
        sections: order.map(function(n){ return { name:n, time_min:got.test.section_time_min, questions:secMap[n] }; }) };
      made += await createSubjectSectionals(res, here[i].is_free!==false);
    }catch(e){ fail++; }
  }
  try{ ADMIN.folders=await MockAPI.listFolders(ADMIN.examId); ADMIN.allTests=await MockAPI.listAllTests(ADMIN.examId); }catch(e){}
  renderFolders();
  if(rep) rep.textContent='✅ Created '+made+' sectional tests'+(fail?(' · '+fail+' failed'):'');
  toast('✅ '+made+' sectionals created'+(fail?(' · '+fail+' failed'):''));
}

/* ── Bulk import: upload many JSON mocks into the CURRENT folder (no sub-folders created), with per-file report ── */
async function bulkImport(input){
  if(!ADMIN.examId){ toast('Open an exam first.'); return; }
  var files = Array.prototype.slice.call(input.files||[]).filter(function(f){ return /\.json$/i.test(f.name); });
  var report=document.getElementById('bulk-report');
  if(!files.length){ if(report) report.innerHTML='<div class="empty">No .json files found in the selection.</div>'; return; }
  if(report) report.innerHTML='<div class="muted">⏳ Processing '+files.length+' file(s)…</div>';
  var markFree = !document.getElementById('bulk-free') || document.getElementById('bulk-free').checked;
  var makeSec = document.getElementById('bulk-sectionals') && document.getElementById('bulk-sectionals').checked;
  var folderId = curFolderId();   // everything goes into the folder you're currently in

  var ok=[], fail=[], secCount=0;
  for(var i=0;i<files.length;i++){
    var f=files[i];
    try{
      var text=await f.text();
      var parsed=adminParseJsonLenient(text);
      if(!parsed.ok) throw new Error('Invalid JSON: '+(parsed.error.message||parsed.error));
      var obj=parsed.obj;
      var res=adminNormalize(obj);
      if(parsed.trailing) res.warnings.push('Ignored trailing text after JSON.');
      if(!res.ok) throw new Error(res.errors[0] + (res.errors.length>1?(' (+'+(res.errors.length-1)+' more)'):''));
      var hasId = (obj.test && obj.test.id) || (obj.meta && obj.meta.id) || obj.quiz_id || obj.series_id || obj.id;
      if(!hasId) res.test.id = slug(f.name.replace(/\.json$/i,'')) || res.test.id;
      res.test.exam_id=ADMIN.examId; res.test.folder_id=folderId; res.test.is_free=markFree;
      await MockAPI.uploadTest(res);
      if(makeSec){ try{ secCount += await createSubjectSectionals(res, markFree); }catch(se){} }
      var q=res.sections.reduce(function(a,s){return a+s.questions.length;},0);
      ok.push({ name:f.name, title:res.test.title, q:q });
    }catch(e){ fail.push({ name:f.name, err:(e.message||String(e)) }); }
  }

  try { ADMIN.folders=await MockAPI.listFolders(ADMIN.examId); ADMIN.allTests=await MockAPI.listAllTests(ADMIN.examId); }catch(e){}
  renderFolders();

  var html='<div style="font-weight:700;margin-bottom:8px;">Imported '+ok.length+' / '+files.length+(secCount?(' · '+secCount+' sectionals'):'')+(fail.length?(' · <span style="color:var(--red);">'+fail.length+' failed</span>'):'')+'</div>';
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

/* ════════════ QUIZ / QUESTION EDITOR ════════════ */
var EDIT = { test:null, sectionsOrder:[], secMap:{}, flat:[], idx:0 };
function gel(id){ return document.getElementById(id); }
function gval(id){ var e=gel(id); return e?e.value:''; }
function toBi(v){ if(v==null) return {en:'',hi:''}; if(typeof v==='object') return {en:v.en||'',hi:v.hi||''}; return {en:String(v),hi:''}; }
function fromBi(b){ if(b.hi && String(b.hi).trim()) return {en:b.en,hi:b.hi}; return b.en; }

async function openEditor(testId){
  toast('Loading test…');
  try{
    var got=await MockAPI.getTest(testId);
    var secMap={}, order=[];
    (got.questions||[]).forEach(function(r){ var n=r.section_name||'Section 1'; if(!secMap[n]){secMap[n]=[];order.push(n);} secMap[n].push(r.data||{}); });
    EDIT={ test:got.test, sectionsOrder:order, secMap:secMap, flat:[], idx:0 };
    order.forEach(function(n){ secMap[n].forEach(function(q){ EDIT.flat.push({ sec:n, q:q, optN:0 }); }); });
    EDIT.flat.forEach(function(w){ var n=0; for(var k=1;k<=5;k++){ if(w.q['option_'+k]!=null && w.q['option_'+k]!=='') n=k; } w.optN = n<2?4:n; });
    setTitle('Edit: '+(got.test.title||testId)); showScreen('editor');
    renderEditorTest();
    if(EDIT.flat.length){ renderEditorQuestion(0); } else { gel('ed-qbox').innerHTML='<div class="empty">No questions in this test.</div>'; }
    gel('ed-save-msg').textContent='';
  }catch(e){ toast('Load failed: '+(e.message||e)); }
}
function renderEditorTest(){
  var t=EDIT.test||{};
  gel('ed-title').value=t.title||'';
  gel('ed-cmarks').value=(t.correct_score!=null?t.correct_score:2);
  gel('ed-nmarks').value=(t.negative_score!=null?t.negative_score:0.5);
  gel('ed-time').value=(t.section_time_min!=null?t.section_time_min:15);
  gel('ed-free').value=(t.is_free===false?'paid':'free');
  gel('ed-pub').value=(t.is_published===false?'0':'1');
  // jump dropdown
  var jump=gel('ed-jump');
  jump.innerHTML=EDIT.flat.map(function(w,i){ return '<option value="'+i+'">Q'+(i+1)+' · '+esc((w.sec||'').slice(0,14))+'</option>'; }).join('');
}
function imgRow(label, url, upFn, clrFn){
  return '<div style="margin:6px 0;"><div class="lbl">'+label+'</div>'+
    (url?'<img src="'+esc(url)+'" style="max-height:70px;border:1px solid var(--border);border-radius:6px;display:block;margin:4px 0;">':'')+
    '<button class="btn btn-sm" onclick="'+upFn+'">⬆ Upload image</button> '+
    (url?'<button class="btn btn-red btn-sm" onclick="'+clrFn+'">Clear</button>':'')+'</div>';
}
function renderEditorQuestion(i){
  edApplySilent();
  EDIT.idx=i;
  var w=EDIT.flat[i]; var q=w.q;
  gel('ed-qpos').textContent='Q '+(i+1)+' / '+EDIT.flat.length+'  ·  '+(w.sec||'');
  gel('ed-jump').value=String(i);
  var qb=toBi(q.question), eb=toBi(q.explanation);
  var h='';
  h+='<label class="lbl">Question (English)</label><textarea id="ed-q-en" oninput="edApply()" style="min-height:64px;">'+esc(qb.en)+'</textarea>';
  h+='<label class="lbl">Question (Hindi, optional)</label><textarea id="ed-q-hi" oninput="edApply()" style="min-height:64px;">'+esc(qb.hi)+'</textarea>';
  h+=imgRow('Question image', q.question_image, "edImg('question',0)", "edClear('question',0)");
  h+='<div style="font-weight:700;margin:12px 0 6px;">Options (pick the correct one)</div>';
  for(var k=1;k<=w.optN;k++){
    var ob=toBi(q['option_'+k]);
    h+='<div style="border:1px solid var(--border);border-radius:8px;padding:8px;margin-bottom:8px;">';
    h+='<label class="muted"><input type="radio" name="ed-correct" value="'+k+'" '+(String(q.answer)===String(k)?'checked':'')+' onchange="edApply()"> Correct answer</label>';
    h+='<input type="text" id="ed-opt-en-'+k+'" placeholder="Option '+k+' (English)" value="'+esc(ob.en)+'" oninput="edApply()" style="width:100%;margin-top:4px;">';
    h+='<input type="text" id="ed-opt-hi-'+k+'" placeholder="Option '+k+' (Hindi)" value="'+esc(ob.hi)+'" oninput="edApply()" style="width:100%;margin-top:4px;">';
    h+=imgRow('Option '+k+' image', q['option_image_'+k], "edImg('option',"+k+")", "edClear('option',"+k+")");
    if(k===w.optN && w.optN>2) h+='<button class="btn btn-red btn-sm" style="margin-top:6px;" onclick="edRemoveOption()">Remove this option</button>';
    h+='</div>';
  }
  if(w.optN<5) h+='<button class="btn btn-sm" onclick="edAddOption()">+ Add option</button>';
  h+='<label class="lbl" style="margin-top:12px;">Explanation (English)</label><textarea id="ed-exp-en" oninput="edApply()" style="min-height:60px;">'+esc(eb.en)+'</textarea>';
  h+='<label class="lbl">Explanation (Hindi, optional)</label><textarea id="ed-exp-hi" oninput="edApply()" style="min-height:60px;">'+esc(eb.hi)+'</textarea>';
  h+=imgRow('Solution image', q.solution_image, "edImg('solution',0)", "edClear('solution',0)");
  gel('ed-qbox').innerHTML=h;
}
/* Read the visible inputs back into the current question object */
function edApply(){
  var w=EDIT.flat[EDIT.idx]; if(!w) return; var q=w.q;
  if(gel('ed-q-en')) q.question=fromBi({en:gval('ed-q-en'),hi:gval('ed-q-hi')});
  for(var k=1;k<=w.optN;k++){ if(gel('ed-opt-en-'+k)) q['option_'+k]=fromBi({en:gval('ed-opt-en-'+k),hi:gval('ed-opt-hi-'+k)}); }
  if(gel('ed-exp-en')) q.explanation=fromBi({en:gval('ed-exp-en'),hi:gval('ed-exp-hi')});
  var r=document.querySelector('input[name=ed-correct]:checked'); if(r) q.answer=r.value;
}
function edApplySilent(){ try{ if(gel('ed-q-en')) edApply(); }catch(e){} }
function edPrev(){ if(EDIT.idx>0) renderEditorQuestion(EDIT.idx-1); }
function edNext(){ if(EDIT.idx<EDIT.flat.length-1) renderEditorQuestion(EDIT.idx+1); }
function edJump(v){ var i=parseInt(v,10); if(!isNaN(i)) renderEditorQuestion(i); }
function edAddOption(){ edApply(); var w=EDIT.flat[EDIT.idx]; if(w.optN<5){ w.optN++; if(w.q['option_'+w.optN]==null) w.q['option_'+w.optN]=''; } renderEditorQuestion(EDIT.idx); }
function edRemoveOption(){ edApply(); var w=EDIT.flat[EDIT.idx]; if(w.optN>2){ delete w.q['option_'+w.optN]; delete w.q['option_image_'+w.optN]; if(String(w.q.answer)===String(w.optN)) w.q.answer='1'; w.optN--; } renderEditorQuestion(EDIT.idx); }
function edImg(kind, idx){
  edApply();
  var inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
  inp.onchange=async function(){ var f=inp.files&&inp.files[0]; if(!f)return;
    try{ toast('⏳ Uploading image…'); var path='q/'+Date.now()+'-'+f.name.replace(/[^a-zA-Z0-9._-]/g,'_'); var url=await MockAPI.uploadImage(f,path);
      var q=EDIT.flat[EDIT.idx].q;
      if(kind==='question') q.question_image=url; else if(kind==='solution') q.solution_image=url; else q['option_image_'+idx]=url;
      toast('✅ Image added'); renderEditorQuestion(EDIT.idx);
    }catch(e){ toast('Image upload failed: '+(e.message||e)); }
  };
  inp.click();
}
function edClear(kind, idx){ edApply(); var q=EDIT.flat[EDIT.idx].q;
  if(kind==='question') q.question_image=''; else if(kind==='solution') q.solution_image=''; else q['option_image_'+idx]='';
  renderEditorQuestion(EDIT.idx); }
async function saveEditor(){
  edApply();
  var t=EDIT.test||{};
  var msg=gel('ed-save-msg'); if(msg) msg.textContent='⏳ Saving…';
  var payloadTest={
    id:t.id, title:gval('ed-title')||t.title, exam_id:t.exam_id, folder_id:t.folder_id,
    correct_score:Number(gval('ed-cmarks'))||0, negative_score:Number(gval('ed-nmarks'))||0,
    section_time_min:Number(gval('ed-time'))||15,
    is_free: gel('ed-free').value!=='paid', is_published: gel('ed-pub').value==='1'
  };
  var sections=EDIT.sectionsOrder.map(function(n){ return { name:n, time_min:payloadTest.section_time_min, questions:EDIT.secMap[n] }; });
  try{
    await MockAPI.uploadTest({ test:payloadTest, sections:sections });
    if(msg) msg.textContent='Saved ✓';
    toast('✅ Test saved');
    try{ ADMIN.allTests=await MockAPI.listAllTests(ADMIN.examId); }catch(e){}
  }catch(e){ if(msg) msg.textContent=''; toast('Save failed: '+(e.message||e)); }
}

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
