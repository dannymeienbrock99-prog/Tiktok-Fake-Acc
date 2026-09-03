const $ = (id) => document.getElementById(id);
let source = null;
let candidates = [];

function esc(v='') { return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function num(v) { return new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(v || 0)); }
function normalizeText(v='') { return String(v).toLowerCase().replace(/[^a-z0-9äöüß]/g,''); }
function similarity(a,b) {
  a=normalizeText(a); b=normalizeText(b); if(!a || !b) return 0; if(a===b) return 1;
  const longer=a.length>=b.length?a:b, shorter=a.length>=b.length?b:a;
  let hits=0; for (const ch of shorter) if(longer.includes(ch)) hits++;
  const contains=longer.includes(shorter) ? .25 : 0;
  return Math.min(1,(hits/longer.length)*.75+contains);
}
function scoreCandidate(a,b) {
  let score=0; const reasons=[];
  const hs=similarity(a.unique_id,b.unique_id); if(hs>.35){score+=Math.round(hs*35);reasons.push(`Handle ${Math.round(hs*100)}%`)}
  const ns=similarity(a.nickname,b.nickname); if(ns>.45){score+=Math.round(ns*25);reasons.push(`Nickname ${Math.round(ns*100)}%`)}
  const bs=similarity(a.bio,b.bio); if(bs>.5){score+=Math.round(bs*20);reasons.push(`Bio ${Math.round(bs*100)}%`)}
  if(a.region && b.region && a.region===b.region){score+=8;reasons.push(`gleiche Region ${a.region}`)}
  if(a.avatar_url && b.avatar_url && a.avatar_url===b.avatar_url){score+=12;reasons.push('identische Avatar-URL')}
  if(a.user_id && b.user_id && a.user_id===b.user_id){score=100;reasons.unshift('gleiche numerische User-ID')}
  return {score:Math.min(100,score), reasons};
}
function avatar(p){ return p.avatar_url ? `<img class="avatar" src="${esc(p.avatar_url)}" referrerpolicy="no-referrer"/>` : `<div class="avatar"></div>`; }
function stats(p){return `<div class="stats"><div class="stat"><strong>${num(p.follower_count)}</strong><span>Follower</span></div><div class="stat"><strong>${num(p.following_count)}</strong><span>Folgt</span></div><div class="stat"><strong>${num(p.likes_count)}</strong><span>Likes</span></div><div class="stat"><strong>${num(p.video_count)}</strong><span>Videos</span></div></div>`}
function renderSource(){
  if(!source){$('sourceProfile').innerHTML='';return}
  $('sourceProfile').innerHTML=`<div class="profile-card card">${avatar(source)}<div><h3>${esc(source.nickname||source.unique_id)} ${source.verified?'✓':''}</h3><div class="handle">@${esc(source.unique_id)}</div>${source.bio?`<p class="bio">${esc(source.bio)}</p>`:''}${stats(source)}</div><div><small>Provider</small><strong>${esc(source.provider)}</strong>${source.user_id?`<div><small>User-ID</small><div>${esc(source.user_id)}</div></div>`:''}</div></div>`;
}
function renderCandidates(){
  if(!source){$('candidateGrid').innerHTML='<div class="card">Zuerst einen Hauptaccount laden.</div>';return}
  $('candidateGrid').innerHTML=candidates.map(p=>{const s=scoreCandidate(source,p);return `<article class="candidate-card card"><div class="candidate-top">${avatar(p)}<div><strong>${esc(p.nickname||p.unique_id)}</strong><div class="handle">@${esc(p.unique_id)}</div></div><div class="score">${s.score}%<small>Ähnlichkeit</small></div></div>${stats(p)}<div class="reasons">${(s.reasons.length?s.reasons:['keine starken öffentlichen Übereinstimmungen']).map(r=>`<span class="pill">${esc(r)}</span>`).join('')}</div></article>`}).join('') || '<div class="card">Noch keine Kandidaten geladen.</div>';
}
async function doFetch(handle, isCandidate=false){
  const provider=$('provider').value; const clean=String(handle||'').trim(); if(!clean) return;
  $('status').className='status'; $('status').textContent=`Lade ${clean} über ${provider} …`;
  try{
    const p=await window.appAPI.fetchProfile(provider,clean);
    if(isCandidate){ candidates=candidates.filter(x=>!(x.provider===p.provider&&x.unique_id===p.unique_id)); candidates.unshift(p); renderCandidates(); }
    else { source=p; candidates=[]; renderSource(); renderCandidates(); }
    $('status').textContent=`Profil @${p.unique_id} geladen und lokal gespeichert.`;
  }catch(e){ $('status').className='status error'; $('status').textContent=e?.message||String(e); }
}
async function loadHistory(){
  const rows=await window.appAPI.listProfiles();
  $('historyGrid').innerHTML=rows.map(p=>`<article class="candidate-card card"><div class="candidate-top">${avatar(p)}<div><strong>${esc(p.nickname||p.unique_id)}</strong><div class="handle">@${esc(p.unique_id)}</div></div></div>${stats(p)}<div class="reasons"><span class="pill">${esc(p.provider)}</span>${p.region?`<span class="pill">${esc(p.region)}</span>`:''}<span class="pill">zuletzt ${esc(p.last_seen_at)}</span></div></article>`).join('')||'<div class="card">Noch keine Profile gespeichert.</div>';
}
async function loadSettings(){for(const key of ['eulerKey','eulerBaseUrl','tikapiKey','customKey','customTemplate']) $(key).value=await window.appAPI.getSetting(key) || (key==='eulerBaseUrl'?'https://api.eulerstream.com':'');}
async function saveSettings(){for(const key of ['eulerKey','eulerBaseUrl','tikapiKey','customKey','customTemplate']) await window.appAPI.setSetting(key,$(key).value.trim());$('settingsStatus').textContent='Einstellungen gespeichert.';}

document.querySelectorAll('.nav').forEach(btn=>btn.addEventListener('click',async()=>{document.querySelectorAll('.nav,.view').forEach(x=>x.classList.remove('active'));btn.classList.add('active');$(btn.dataset.view).classList.add('active');if(btn.dataset.view==='history') await loadHistory();if(btn.dataset.view==='settings') await loadSettings();}));
$('fetchBtn').addEventListener('click',()=>doFetch($('handle').value,false));
$('handle').addEventListener('keydown',e=>{if(e.key==='Enter')doFetch(e.target.value,false)});
$('candidateBtn').addEventListener('click',()=>doFetch($('candidateHandle').value,true));
$('candidateHandle').addEventListener('keydown',e=>{if(e.key==='Enter')doFetch(e.target.value,true)});
$('clearCandidates').addEventListener('click',()=>{candidates=[];renderCandidates()});
$('saveSettings').addEventListener('click',saveSettings);
renderCandidates();
