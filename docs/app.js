const DATA_PATH = './jar_data.json';

// Fallback sample data used when the page is opened from the file system
const FALLBACK_DATA = {
  users: ['travis','david'],
  entries: {}
};

// Simple status/banner helper - will create a small area under the header to show mode/errors
function ensureStatusArea(){
  let s = document.getElementById('appStatus');
  if(!s){
    s = document.createElement('div');
    s.id = 'appStatus';
    s.style.padding = '8px';
    s.style.background = '#fff6e6';
    s.style.border = '1px solid #ffdca8';
    s.style.margin = '8px 0';
    const header = document.querySelector('header') || document.body;
    header.parentNode.insertBefore(s, header.nextSibling);
  }
  return s;
}

function showStatus(msg, level='info'){
  const s = ensureStatusArea();
  s.textContent = msg;
  if(level==='error') s.style.background='#ffe6e6';
  else s.style.background='#fff6e6';
}

// global error catcher to surface JS errors to the user
window.addEventListener('error', function(ev){
  try{ showStatus('JavaScript error: ' + (ev && ev.message ? ev.message : ev), 'error'); }catch(e){}
});

async function loadData(){
  // Try to fetch the JSON (works when served over HTTP). If that fails (file:// or missing),
  // fall back to the embedded sample data so the UI is usable without running a local server.
  try{
    const r = await fetch(DATA_PATH);
    if(!r.ok) throw new Error('Not found');
    return r.json();
  }catch(e){
    return FALLBACK_DATA;
  }
}

// Name mapping (UI-only): map old names to new ones for display and in-memory usage
const NAME_MAP = { 'alice': 'travis', 'bob': 'david' };

function applyNameMapToData(data){
  if(!data) return data;
  // map users array
  if(Array.isArray(data.users)){
    data.users = data.users.map(u => NAME_MAP[u] || u);
  } else {
    data.users = [];
  }
  // map entries keys
  const newEntries = {};
  for(const [date, users] of Object.entries(data.entries || {})){
    const newUsers = {};
    for(const [u, s] of Object.entries(users || {})){
      const nu = NAME_MAP[u] || u;
      // if key already exists, prefer the new value (later wins)
      newUsers[nu] = s;
    }
    newEntries[date] = newUsers;
  }
  data.entries = newEntries;
  return data;
}

// Firestore helpers (if configured)
async function initFirestoreIfNeeded(){
  if(!window.FIREBASE_CONFIG) return null;
  try{
    firebase.initializeApp(window.FIREBASE_CONFIG);
    const db = firebase.firestore();
    const auth = firebase.auth ? firebase.auth() : null;
    // Try anonymous sign-in if auth is present. This allows Firestore rules requiring
    // authentication to accept writes.
    if(auth){
      try{
        await auth.signInAnonymously();
        console.log('Signed in anonymously to Firebase');
        // update header to show auth state if header exists
        const hdr = document.querySelector('header .muted');
        if(hdr) hdr.textContent = (hdr.textContent||'') + ' (connected to Firestore as anonymous)';
      }catch(e){
        console.warn('Anonymous sign-in failed', e);
        const hdr = document.querySelector('header .muted');
        if(hdr) hdr.textContent = (hdr.textContent||'') + ' (Firestore: anonymous sign-in failed — writes may be blocked)';
      }
    }

    const docRef = db.collection('jar').doc('data');
    // ensure doc exists
    try{
      await db.runTransaction(async (tx)=>{
        const snap = await tx.get(docRef);
        if(!snap.exists){
          tx.set(docRef, {users: [], entries: {}});
        }
      });
    }catch(e){
      console.warn('Firestore transaction to initialize doc failed', e);
    }
    return {db, docRef};
  }catch(e){
    console.error('Firestore init failed', e);
    return null;
  }
}

function computeTotals(data){
  const totals = {};
  for(const u of data.users) totals[u]=0;
  for(const d of Object.keys(data.entries||{})){
    const day = data.entries[d];
    for(const [u,s] of Object.entries(day)){
      if(s==='missed') totals[u] = (totals[u]||0)+1;
    }
  }
  return totals;
}

function renderTotals(totals){
  const el = document.getElementById('totalsArea');
  if(Object.keys(totals).length===0){ el.textContent='(no users)'; return }
  const parts = Object.entries(totals).map(([u,v])=>`${u}: $${v}`);
  el.textContent = parts.join('  |  ');
}

function renderEntriesForDate(data, date){
  const area = document.getElementById('entriesArea');
  const day = data.entries?.[date]||{};
  if((data.users||[]).length===0){ area.textContent='(no users)'; return }
  const parts = data.users.map(u=>`${u}: ${day[u]||'none'}`);
  area.textContent = parts.join('\n');
}

function renderHistory(data){
  const tbody = document.querySelector('#historyTable tbody');
  tbody.innerHTML='';
  const rows = [];
  for(const d of Object.keys(data.entries||{}).sort()){
    for(const [u,s] of Object.entries(data.entries[d])){
      rows.push({date:d,user:u,status:s});
    }
  }
  for(const r of rows){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.date}</td><td>${r.user}</td><td>${r.status}</td>`;
    tbody.appendChild(tr);
  }
}

function makeCSV(data){
  const rows=[['date','user','status']];
  for(const d of Object.keys(data.entries||{}).sort()){
    for(const [u,s] of Object.entries(data.entries[d])) rows.push([d,u,s]);
  }
  return rows.map(r=>r.map(cell=>`"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
}

async function main(){
  const data = {}; // empty object for Firestore
  const dateInput = document.getElementById('date');
  const today = new Date().toISOString().slice(0,10);
  dateInput.value = today;

  if(window.FIREBASE_CONFIG){
    const fs = await initFirestoreIfNeeded();
    if(fs){
      showStatus('Using Firestore (shared) — attempts to write will target your Firestore project.');
      enableFirestoreUI(dateInput, data, today, fs.db, fs.docRef);
      return;
    }
  }

  showStatus('No backend configured — using local interactive mode.');
  enableLocalInteractiveUI(dateInput, data, today);
}


// Firestore-backed interactive UI
function enableFirestoreUI(dateInput, data, today, db, docRef){
  // subscribe to realtime updates
  docRef.onSnapshot((snap) => {
    let val = snap.data() || { users: [], entries: {} };
    console.log('Raw Firestore data:', val);
    
    // Check type of users
    console.log('data.users type:', typeof val.users);
    console.log('Is data.users an array?', Array.isArray(val.users));
    console.log('data.users value:', val.users);
    // Make sure users is always an array
    if (!Array.isArray(val.users)) {
      console.warn('Firestore users is not an array, forcing empty array:', val.users);
      val.users = [];
    }

    const mapped = applyNameMapToData(val);
    data.users = mapped.users || [];
    data.entries = mapped.entries || {};

    renderTotals(computeTotals(data));
    renderHistory(data);
    const d = dateInput.value || today;
    renderEntriesForDate(data, d);
    renderForDate(d);
  });


  const entriesArea = document.getElementById('entriesArea');
  function renderForDate(d){
    const day = data.entries?.[d]||{};
    entriesArea.innerHTML = '';
    for(const u of data.users){
      const row = document.createElement('div');
      row.style.marginBottom = '6px';
      const name = document.createElement('span');
      name.textContent = u + ': ' + (day[u]||'none');
      name.style.marginRight = '8px';
      const doneBtn = document.createElement('button');
      doneBtn.textContent = 'Done';
      doneBtn.addEventListener('click', ()=>{
        markFirestore(d,u,'done').catch(e=>{
          console.error('Firestore write failed', e);
          alert('Failed to save change to Firestore: ' + (e && e.message ? e.message : e));
        });
      });
      const missedBtn = document.createElement('button');
      missedBtn.textContent = 'Missed';
      missedBtn.style.marginLeft = '6px';
      missedBtn.addEventListener('click', ()=>{
        markFirestore(d,u,'missed').catch(e=>{
          console.error('Firestore write failed', e);
          alert('Failed to save change to Firestore: ' + (e && e.message ? e.message : e));
        });
      });
      row.appendChild(name);
      row.appendChild(doneBtn);
      row.appendChild(missedBtn);
      entriesArea.appendChild(row);
    }
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close day (mark unset as missed)';
    closeBtn.style.display = 'block';
    closeBtn.style.marginTop = '8px';
    closeBtn.addEventListener('click', ()=>{
      db.runTransaction(async (tx)=>{
        const snap = await tx.get(docRef);
        const cur = snap.data() || {users:[], entries:{}};
        cur.entries = cur.entries || {};
        cur.entries[d] = cur.entries[d] || {};
        for(const u of cur.users||[]) if(!(u in cur.entries[d])) cur.entries[d][u] = 'missed';
        tx.set(docRef, cur);
      });
    });
    entriesArea.appendChild(closeBtn);
  }

  dateInput.addEventListener('change', ()=>{
    const d = dateInput.value||today;
    renderForDate(d);
  });

  renderForDate(today);
}

function enableInteractiveUI(dateInput, data, today){
  // Add mark buttons to entries area
  const entriesArea = document.getElementById('entriesArea');
  function renderInteractiveForDate(d){
    const day = data.entries?.[d]||{};
    entriesArea.innerHTML = '';
    for(const u of data.users){
      const row = document.createElement('div');
      row.style.marginBottom = '6px';
      const name = document.createElement('span');
      name.textContent = u + ': ' + (day[u]||'none');
      name.style.marginRight = '8px';
      const doneBtn = document.createElement('button');
      doneBtn.textContent = 'Done';
      doneBtn.addEventListener('click', ()=>markRemote(d, u, 'done').then(()=>{
        day[u] = 'done';
        renderInteractiveForDate(d);
        renderTotals(computeTotals(data));
        renderHistory(data);
      }).catch(e=>{
        console.error('API mark failed', e);
        showStatus('Failed to mark via API: ' + (e && e.message ? e.message : e), 'error');
        alert('Failed to save change to server: ' + (e && e.message ? e.message : e));
      }));
      const missedBtn = document.createElement('button');
      missedBtn.textContent = 'Missed';
      missedBtn.style.marginLeft = '6px';
      missedBtn.addEventListener('click', ()=>markRemote(d, u, 'missed').then(()=>{
        day[u] = 'missed';
        renderInteractiveForDate(d);
        renderTotals(computeTotals(data));
        renderHistory(data);
      }).catch(e=>{
        console.error('API mark failed', e);
        showStatus('Failed to mark via API: ' + (e && e.message ? e.message : e), 'error');
        alert('Failed to save change to server: ' + (e && e.message ? e.message : e));
      }));
      row.appendChild(name);
      row.appendChild(doneBtn);
      row.appendChild(missedBtn);
      entriesArea.appendChild(row);
    }
    // close-day button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close day (mark unset as missed)';
    closeBtn.style.display = 'block';
    closeBtn.style.marginTop = '8px';
    closeBtn.addEventListener('click', ()=>{
      fetch('/api/close-day', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({date:d})})
        .then(async r=>{
          if(!r.ok){ const txt = await r.text(); throw new Error('close-day failed: '+txt); }
          return r.json();
        })
        .then(j=>{
          // reflect change by reloading from API
          return fetch('/api/data').then(async r=>{ if(!r.ok){ const t=await r.text(); throw new Error('failed to fetch data: '+t); } return r.json(); }).then(remote=>{ const mapped = applyNameMapToData(remote); data.users = mapped.users; data.entries = mapped.entries; renderInteractiveForDate(d); renderTotals(computeTotals(data)); renderHistory(data); });
        }).catch(e=>{
          console.error('close-day API failed', e);
          showStatus('Failed to close day via API: ' + (e && e.message ? e.message : e), 'error');
          alert('Failed to close day: ' + (e && e.message ? e.message : e));
        });
    });
    entriesArea.appendChild(closeBtn);
  }

  dateInput.addEventListener('change', ()=>{
    const d = dateInput.value||today;
    renderInteractiveForDate(d);
  });

  // initial
  renderInteractiveForDate(today);
}

async function markRemote(date, user, status){
  const r = await fetch('/api/mark', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({date, user, status})});
  if(!r.ok){
    let body='';
    try{ body = await r.text(); }catch(e){}
    throw new Error('mark failed: ' + (body||r.statusText||r.status));
  }
  return r.json();
}

// Local-only interactive UI: persists changes to browser localStorage under key 'jar.localdata'.
function enableLocalInteractiveUI(dateInput, data, today){
  const STORAGE_KEY = 'jar.localdata';
  // Merge persisted local data with loaded data
  const localRaw = localStorage.getItem(STORAGE_KEY);
  if(localRaw){
    try{
      const local = JSON.parse(localRaw);
      data.entries = Object.assign({}, data.entries || {}, local.entries || {});
      if(Array.isArray(local.users) && local.users.length) data.users = local.users;

      // Remove this line — it overwrites your merged data
      // applyNameMapToData(data);
    }catch(e){ console.warn('failed to parse local data', e); }
  }

  const entriesArea = document.getElementById('entriesArea');
  function saveLocal(){
    const payload = { users: data.users, entries: data.entries };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function renderLocalForDate(d){
    if(!data.users || !data.users.length) data.users = ['travis','david'];
    const day = data.entries?.[d]||{};
    entriesArea.innerHTML = '';
    for(const u of data.users){
      const row = document.createElement('div');
      row.style.marginBottom = '6px';
      const name = document.createElement('span');
      name.textContent = u + ': ' + (day[u]||'none');
      name.style.marginRight = '8px';
      const doneBtn = document.createElement('button');
      doneBtn.textContent = 'Done';
      doneBtn.addEventListener('click', ()=>{
        data.entries[d] = data.entries[d]||{};
        data.entries[d][u] = 'done';
        saveLocal();
        renderLocalForDate(d);
        renderTotals(computeTotals(data));
        renderHistory(data);
      });
      const missedBtn = document.createElement('button');
      missedBtn.textContent = 'Missed';
      missedBtn.style.marginLeft = '6px';
      missedBtn.addEventListener('click', ()=>{
        data.entries[d] = data.entries[d]||{};
        data.entries[d][u] = 'missed';
        saveLocal();
        renderLocalForDate(d);
        renderTotals(computeTotals(data));
        renderHistory(data);
      });
      row.appendChild(name);
      row.appendChild(doneBtn);
      row.appendChild(missedBtn);
      entriesArea.appendChild(row);
    }
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close day (mark unset as missed)';
    closeBtn.style.display = 'block';
    closeBtn.style.marginTop = '8px';
    closeBtn.addEventListener('click', ()=>{
      data.entries[d] = data.entries[d]||{};
      let changed = 0;
      for(const u of data.users){
        if(!(u in data.entries[d])){ data.entries[d][u] = 'missed'; changed++; }
      }
      saveLocal();
      renderLocalForDate(d);
      renderTotals(computeTotals(data));
      renderHistory(data);
      alert('Closed day. Marked ' + changed + ' users as missed.');
    });
    entriesArea.appendChild(closeBtn);
    // add a clear-local button
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear local changes';
    clearBtn.style.display = 'inline-block';
    clearBtn.style.marginLeft = '8px';
    clearBtn.addEventListener('click', ()=>{
      if(confirm('Clear local changes? This will remove marks saved in this browser.')){
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
      }
    });
    entriesArea.appendChild(clearBtn);

    // Export JSON button: download merged data so user can commit it into the repo
    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export JSON (download)';
    exportBtn.style.display = 'inline-block';
    exportBtn.style.marginLeft = '8px';
    exportBtn.addEventListener('click', ()=>{
      const payload = { users: data.users, entries: data.entries };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'jar_data_export.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
    entriesArea.appendChild(exportBtn);
  }

  dateInput.addEventListener('change', ()=>{
    const d = dateInput.value||today;
    renderLocalForDate(d);
  });

  renderLocalForDate(today);
}

main();
