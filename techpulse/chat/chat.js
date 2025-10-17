import { auth, db, rtdb, storage, serverTimestamp } from './api/firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { collection, addDoc, query, orderBy, onSnapshot, limit, doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { ref as rtdbRef, onDisconnect, set as rtdbSet, serverTimestamp as rtdbServerTimestamp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";
import { ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js";

// Firebase initialized via './api/firebase.js'

let currentUser = null;
let activeRoom = 'general';
let roomsCache = [];
let lastReadMap = {};

function slugify(name){
  return (name||'')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g,'')
    .trim()
    .replace(/\s+/g,'-')
    .slice(0,40) || 'room';
}

// Inline modal state
let modalOpen = false;
function openNewRoomModal(){
  const m = document.getElementById('newRoomModal');
  if (!m) return;
  m.classList.remove('hidden');
  modalOpen = true;
  const input = document.getElementById('roomName');
  const error = document.getElementById('roomError');
  const slugPrev = document.getElementById('slugPreview');
  const confirm = document.getElementById('confirmNewRoom');
  if (input) { input.value=''; setTimeout(()=> input.focus(), 0); }
  if (error) error.textContent='';
  if (slugPrev) slugPrev.textContent='';
  if (confirm) confirm.disabled = true;
}
function closeNewRoomModal(){
  const m = document.getElementById('newRoomModal');
  if (!m) return;
  m.classList.add('hidden');
  modalOpen = false;
}

function bindNewRoomModal(user){
  const input = document.getElementById('roomName');
  const error = document.getElementById('roomError');
  const slugPrev = document.getElementById('slugPreview');
  const confirm = document.getElementById('confirmNewRoom');
  const cancel = document.getElementById('cancelNewRoom');
  const modal = document.getElementById('newRoomModal');
  if (!input || !confirm || !cancel || !modal) return;

  const validate = () => {
    const name = (input.value||'').trim();
    const slug = slugify(name);
    slugPrev.textContent = name ? `Slug: #${slug}` : '';
    const ok = !!name && /^[a-z0-9\-]+$/.test(slug) && slug.length >= 2;
    confirm.disabled = !ok;
    if (!name) { error.textContent=''; return; }
    if (!ok) { error.textContent = 'Use letters, numbers, and hyphens (min 2).'; }
    else { error.textContent=''; }
  };
  input.addEventListener('input', validate);

  modal.addEventListener('click', (e)=>{
    if (e.target && e.target.getAttribute('data-close') === 'true') closeNewRoomModal();
  });
  cancel.addEventListener('click', closeNewRoomModal);
  document.addEventListener('keydown', (e)=>{ if(modalOpen && e.key==='Escape') closeNewRoomModal(); });

  confirm.addEventListener('click', async ()=>{
    const name = (input.value||'').trim();
    if (!name) return;
    const slug = slugify(name);
    try{
      // Generate roomId locally, then claim slug, then write room
      const roomsCol = collection(db,'rooms');
      const newRef = doc(roomsCol);
      const roomId = newRef.id;
      await setDoc(doc(db,'roomSlugs',slug), { roomId }); // create-only via rules
      await setDoc(newRef, { name, slug, createdBy: user.uid, isLocked:false, lastMessageAt: serverTimestamp(), lastMessageText:'' });
      activeRoom = roomId;
      await setDoc(doc(db,'userRooms',user.uid,'rooms',roomId), { lastReadAt: serverTimestamp() }, { merge:true });
      closeNewRoomModal();
      subscribeMessages(user);
      subscribeTyping(user);
      renderRooms(roomsCache, user);
    }catch(e){
      console.error(e);
      if (error) error.textContent = 'Channel exists or invalid. Try a different name.';
    }
  });
}

function msgEl(m) {
  const d = document.createElement('div');
  d.className = 'msg';
  const av = document.createElement('div');
  av.className = 'avatar';
  av.textContent = (m.initials || 'U');
  const body = document.createElement('div');
  body.className = 'bubble';
  const name = document.createElement('div');
  name.style.fontWeight = '600';
  const ts = m.ts && m.ts.seconds ? new Date(m.ts.seconds * 1000) : null;
  name.textContent = `${m.name || 'User'}${ts ? ' • ' + ts.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : ''}`;
  const text = document.createElement('div');
  if (m.type === 'image' && m.url) {
    const img = document.createElement('img');
    img.src = m.url; img.alt = 'attachment'; img.style.maxWidth = '320px'; img.style.borderRadius='10px';
    text.appendChild(img);
    if (m.text) { const cap = document.createElement('div'); cap.textContent = m.text; text.appendChild(cap); }
  } else if (m.type === 'file' && m.url) {
    const a = document.createElement('a'); a.href = m.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = m.text || 'Download file';
    text.appendChild(a);
  } else {
    text.textContent = m.text || '';
  }
  body.appendChild(name);
  body.appendChild(text);
  d.appendChild(av);
  d.appendChild(body);
  return d;
}

function autoScroll(list){
  list.scrollTop = list.scrollHeight;
}

async function ensureDefaultRooms(uid){
  const generalRef = doc(db, 'rooms', 'general');
  const snap = await getDoc(generalRef);
  if (!snap.exists()) {
    await setDoc(generalRef, { name:'General', slug:'general', createdBy: uid, lastMessageAt: serverTimestamp() });
  }
}

async function unreadCountForRoom(room, uid){
  const lastReadAt = lastReadMap[room.id]?.lastReadAt;
  if (!lastReadAt || (room.lastMessageAt && room.lastMessageAt.toMillis && room.lastMessageAt.toMillis() <= lastReadAt.toMillis? lastReadAt.toMillis(): lastReadAt)) {
    // if never read, show at least 1 if there is any lastMessageAt
    return room.lastMessageAt ? 1 : 0;
  }
  try{
    const qRef = query(collection(db,'rooms',room.id,'messages'), orderBy('ts','asc'));
    // naive count: we'll fetch up to 50 after lastReadAt
    // dynamic import to use startAfter without importing here; instead filter in client after fetch
    let c = 0;
    // quick sample via onSnapshot once is heavy; skip exact counting
    // Return 1 to show badge if lastMessageAt > lastReadAt
    return 1;
  }catch{ return 0; }
}

function renderRooms(rooms, user){
  const list = document.getElementById('roomsList');
  if (!list) return;
  list.innerHTML='';
  rooms.forEach(r => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = '#';
    a.className = 'room-item' + (activeRoom===r.id ? ' active' : '');
    a.onclick = async (e)=>{
      e.preventDefault();
      if (activeRoom===r.id) return;
      activeRoom = r.id;
      const input = document.getElementById('chatInput'); if (input) input.placeholder = `Message #${r.slug || r.id}`;
      await setDoc(doc(db,'userRooms',user.uid,'rooms',r.id), { lastReadAt: serverTimestamp() }, { merge:true }).catch(()=>{});
      subscribeMessages(user);
      subscribeTyping(user);
      renderRooms(roomsCache, user);
    };
    const name = document.createElement('span');
    name.textContent = `#${r.slug || r.id}`;
    a.appendChild(name);
    // unread badge (simple indicator)
    const lastRead = lastReadMap[r.id]?.lastReadAt;
    const hasUnread = r.lastMessageAt && (!lastRead || (r.lastMessageAt.toMillis ? r.lastMessageAt.toMillis() : r.lastMessageAt.seconds*1000) > ((lastRead.toMillis? lastRead.toMillis(): lastRead.seconds*1000)));
    if (hasUnread) {
      const badge = document.createElement('span');
      badge.className='unread';
      badge.textContent='1';
      a.appendChild(badge);
    }
    li.appendChild(a);
    list.appendChild(li);
  });
}

let unsubMessages = null;
function subscribeMessages(user){
  const list = document.getElementById('chatMessages');
  if (unsubMessages) unsubMessages();
  const qRef = query(collection(db, 'rooms', activeRoom, 'messages'), orderBy('ts','desc'), limit(100));
  unsubMessages = onSnapshot(qRef, (snap)=>{
    const arr=[]; snap.forEach(d=> arr.push({id:d.id, ...d.data()}));
    arr.sort((a,b)=> (a.ts?.seconds||0)-(b.ts?.seconds||0));
    list.innerHTML='';
    // unread separator
    const lastRead = lastReadMap[activeRoom]?.lastReadAt;
    let sepInserted = false;
    for (let i=0;i<arr.length;i++){
      const m = arr[i];
      const prev = arr[i-1];
      const next = arr[i+1];
      const author = m.uid;
      const tsMs = m.ts?.seconds? m.ts.seconds*1000 : 0;
      const prevSame = prev && prev.uid===author && (tsMs - (prev.ts?.seconds? prev.ts.seconds*1000:0) <= 5*60*1000);
      const nextSame = next && next.uid===author && (((next.ts?.seconds? next.ts.seconds*1000:0) - tsMs) <= 5*60*1000);
      const classes = ['msg'];
      if (author===user.uid) classes.push('self');
      if (!prevSame && nextSame) classes.push('first');
      else if (prevSame && nextSame) classes.push('middle');
      else if (prevSame && !nextSame) classes.push('last');
      else classes.push('first','last');
      // unread separator insertion once when crossing lastRead
      if (!sepInserted && lastRead && tsMs > ((lastRead.toMillis? lastRead.toMillis(): lastRead.seconds*1000))) {
        const sep = document.createElement('div'); sep.className='unread-sep'; sep.textContent='New';
        list.appendChild(sep); sepInserted = true;
      }
      const el = msgEl(m);
      el.className = classes.join(' ');
      list.appendChild(el);
    }
    autoScroll(list);
  });
}

let typingTimeout = null;
let unsubTyping = null;
function subscribeTyping(user){
  const typingEl = document.getElementById('typing');
  if (unsubTyping) unsubTyping();
  const q = collection(db, 'rooms', activeRoom, 'typing');
  unsubTyping = onSnapshot(q, (snap)=>{
    const names=[]; const now = Date.now();
    snap.forEach(d=>{ const v=d.data(); if(d.id!==user.uid && (!v.until || v.until>now)) names.push(v.name||'Someone'); });
    typingEl.textContent = names.length? `${names.join(', ')} typing…` : '';
  });
}

async function signalTyping(user){
  const until = Date.now()+5000;
  await setDoc(doc(db,'rooms',activeRoom,'typing',user.uid), { name: user.displayName || (user.email||'').split('@')[0] || 'User', until }, { merge:true });
}

async function initPresence(user){
  const pRef = rtdbRef(rtdb, `presence/${user.uid}`);
  await rtdbSet(pRef, { status:'online', lastSeen: rtdbServerTimestamp() });
  onDisconnect(pRef).set({ status:'offline', lastSeen: rtdbServerTimestamp() });
}

function initComposer(user){
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  const fileInput = document.getElementById('fileInput');
  const attachBtn = document.getElementById('attachBtn');

  attachBtn.addEventListener('click',()=> fileInput.click());
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    const name = currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'User');
    const initials = name.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase();
    const path = `uploads/${activeRoom}/${currentUser.uid}/${Date.now()}-${f.name}`;
    const ref = sRef(storage, path);
    try{
      await uploadBytes(ref, f);
      const url = await getDownloadURL(ref);
      const type = f.type.startsWith('image/') ? 'image' : 'file';
      await addDoc(collection(db,'rooms',activeRoom,'messages'), { uid: currentUser.uid, name, initials, url, type, ts: serverTimestamp() });
    }catch(_){}
    fileInput.value='';
  });

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const text=(input.value||'').trim();
    if(!text) return;
    if(text.length > 2000) { input.value = text.slice(0,2000); return; }
    input.value='';
    const name = currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'User');
    const initials = name.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase();
    try{
      await addDoc(collection(db, 'rooms', activeRoom, 'messages'), { uid:currentUser.uid, name, initials, text, ts: serverTimestamp(), type:'text' });
      await updateDoc(doc(db,'rooms',activeRoom), { lastMessageAt: serverTimestamp() }).catch(()=>{});
    }catch(_){}
  });

  input.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); form.requestSubmit(); return; }
    signalTyping(currentUser).catch(()=>{});
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "/login/"; return; }
  currentUser = user;
  const name = user.displayName || (user.email ? user.email.split('@')[0] : 'User');
  const initials = name.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase();
  const av = document.getElementById('avatar'); if (av) av.textContent = initials;
  const pn = document.getElementById('prof-name'); if (pn) pn.textContent = name;
  const pe = document.getElementById('prof-email'); if (pe) pe.textContent = user.email || '';

  await ensureDefaultRooms(user.uid);
  // Load rooms list
  onSnapshot(query(collection(db,'rooms'), orderBy('slug','asc')), (snap)=>{
    roomsCache = snap.docs.map(d=> ({ id:d.id, ...d.data() }));
    renderRooms(roomsCache, user);
  });

  // Subscribe to user read markers
  onSnapshot(collection(db,'userRooms',user.uid,'rooms'), (snap)=>{
    lastReadMap = {};
    snap.forEach(d=> lastReadMap[d.id] = d.data());
    renderRooms(roomsCache, user);
  });

  // Ensure userRooms doc exists
  await setDoc(doc(db,'userRooms',user.uid,'rooms',activeRoom), { lastReadAt: serverTimestamp() }, { merge:true }).catch(()=>{});

  initPresence(user);
  initComposer(user);
  bindNewRoomModal(user);
  const newBtn = document.getElementById('newRoomBtn');
  if (newBtn) newBtn.onclick = ()=> openNewRoomModal();
  subscribeMessages(user);
  subscribeTyping(user);
});

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) logoutBtn.addEventListener('click', async () => {
  try { await signOut(auth); window.location.href = '/login/'; } catch(e){}
});
