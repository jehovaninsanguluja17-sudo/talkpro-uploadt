const API = "";
let token = localStorage.getItem("talkpro_v2_token");
let me = JSON.parse(localStorage.getItem("talkpro_v2_user") || "null");
let socket = null;
let users = [];
let groups = [];
let active = null;
let typingTimer = null;
let remoteTypingTimer = null;
let isRegister = false;
let mediaRecorder, chunks = [], recording = false;
let peer = null;
let localStream = null;
let currentCall = null;
let callStartedAt = null;
let callHistory = [];
let deferredInstallPrompt = null;
let currentTheme = localStorage.getItem('talkpro_theme') || 'light';

const $ = id => document.getElementById(id);
const avatar = name => `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00a884&color=fff`;
const headers = () => ({ "Content-Type":"application/json", "Authorization":"Bearer "+token });
const fileUrl = url => url && url.startsWith("http") ? url : API + url;

document.body.classList.toggle("dark", currentTheme === "dark");
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = $("installBtn");
  if(btn) btn.classList.remove("hidden");
});

async function api(path, options={}) {
  const res = await fetch(API + path, options);
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message || "Erreur serveur");
  return data;
}

$("showLogin").onclick = () => setMode(false);
$("showRegister").onclick = () => setMode(true);
function setMode(register){
  isRegister = register;
  $("showLogin").classList.toggle("active", !register);
  $("showRegister").classList.toggle("active", register);
  document.querySelectorAll(".register-only").forEach(x=>x.classList.toggle("hidden", !register));
  $("authSubmit").textContent = register ? "Créer mon compte" : "Se connecter";
}

$("authForm").onsubmit = async e => {
  e.preventDefault();
  $("authMessage").textContent = "";
  try {
    const body = { email:$("emailInput").value.trim().toLowerCase(), password:$("passwordInput").value };
    if(isRegister){
      body.name = $("nameInput").value.trim();
      body.avatar = $("avatarInput").value.trim() || avatar(body.name);
    }
    const data = await api(isRegister ? "/api/auth/register" : "/api/auth/login", {
      method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(body)
    });
    token = data.token; me = data.user;
    localStorage.setItem("talkpro_v2_token", token);
    localStorage.setItem("talkpro_v2_user", JSON.stringify(me));
    openApp();
  } catch(err) { $("authMessage").textContent = err.message; }
};

if(token && me) openApp();

async function openApp(){
  $("authPage").classList.add("hidden");
  $("appPage").classList.remove("hidden");
  $("myAvatar").src = me.avatar || avatar(me.name);
  $("myName").textContent = me.name;
  $("myEmail").textContent = me.email;
  $("myRole").textContent = me.role || "user";
  if(me.role === "admin") $("adminTab").classList.remove("hidden");
  connectSocket();
  await refresh();
}

function connectSocket(){
  socket = io({ auth:{ token } });
  socket.on("message:new", msg => {
    if(active && active.type==="private" && (msg.from===active.id || msg.to===active.id)) {
      appendMessage(msg);
      if(msg.from === active.id) socket.emit("message:read", { from: active.id });
    }
    if(msg.type === "announcement") showModal("Annonce administrateur", msg.content);
    if(msg.from !== me.id) notifyUser("Nouveau message", "Vous avez reçu un nouveau message.");
  });

  socket.on("message:status", data => updateMessageStatus(data));
  socket.on("message:read:update", data => markConversationRead(data.by));

  socket.on("typing:start", data => {
    if(!active) return;
    const privateTyping = active.type==="private" && data.from===active.id;
    const groupTyping = active.type==="group" && data.groupId===active.id;
    if(privateTyping || groupTyping){
      $("chatStatus").textContent = `${data.name || "Utilisateur"} est en train d’écrire...`;
      clearTimeout(remoteTypingTimer);
      remoteTypingTimer = setTimeout(updateActiveStatus, 1800);
    }
  });

  socket.on("typing:stop", data => {
    if(!active) return;
    const privateTyping = active.type==="private" && data.from===active.id;
    const groupTyping = active.type==="group" && data.groupId===active.id;
    if(privateTyping || groupTyping) updateActiveStatus();
  });
  socket.on("message:group:new", msg => {
    if(active && active.type==="group" && String(msg.group)===active.id) appendMessage(msg, true);
  });
  socket.on("presence:update", p => {
    const u = users.find(x=>x.id===p.userId);
    if(u){
      u.online = p.online;
      if(p.lastSeen) u.lastSeen = p.lastSeen;
      renderUsers();
      renderFriends();
      if(active && active.type==="private" && active.id===p.userId) updateActiveStatus();
    }
  });
  socket.on("call:incoming", data => { showIncomingCall(data); notifyUser("Appel entrant", `${data.name} vous appelle`); });
  socket.on("call:accepted", data => onCallAccepted(data));
  socket.on("call:rejected", () => endCall(false, "Appel refusé"));
  socket.on("call:ended", () => endCall(false, "Appel terminé"));
  socket.on("webrtc:offer", data => handleOffer(data));
  socket.on("webrtc:answer", data => handleAnswer(data));
  socket.on("webrtc:ice", data => handleIce(data));
}

async function refresh(){
  const [u, r, g, c] = await Promise.all([
    api("/api/users", {headers:headers()}),
    api("/api/requests/incoming", {headers:headers()}),
    api("/api/groups", {headers:headers()}),
    api("/api/calls", {headers:headers()})
  ]);
  users = u.users;
  groups = g.groups;
  callHistory = c.calls || [];
  renderUsers();
  renderRequests(r.requests);
  renderFriends();
  renderGroups();
  renderCalls();
  if(me.role === "admin") loadAdmin();
}

document.querySelectorAll(".tab").forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
    tab.classList.add("active");
    ["usersList","requestsList","friendsList","groupsList","callsList","mediaList","profilePanel","adminPanel"].forEach(id=>$(id).classList.add("hidden"));
    const map = {users:"usersList", requests:"requestsList", friends:"friendsList", groups:"groupsList", calls:"callsList", media:"mediaList", profile:"profilePanel", admin:"adminPanel"};
    $(map[tab.dataset.tab]).classList.remove("hidden");
    if(tab.dataset.tab==="profile") renderProfilePanel();
    if(tab.dataset.tab==="media") loadMediaGallery().catch(()=>{});
  };
});
$("searchInput").oninput = () => { renderUsers(); renderFriends(); };

function formatLastSeen(date){
  if(!date) return "Hors ligne";
  return "Vu " + new Date(date).toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
}

function item(u, action, subtitle){
  const presence = u.online ? "🟢 En ligne" : "⚪ " + formatLastSeen(u.lastSeen);
  return `<div class="item"><img src="${u.avatar || avatar(u.name)}"><div class="item-info"><strong>${u.name}</strong><span>${subtitle || (presence + " • " + u.email)}</span></div><div class="item-actions">${action}</div></div>`;
}
function empty(text){ return `<div class="item"><div class="item-info"><span>${text}</span></div></div>`; }

function renderUsers(){
  const q = $("searchInput").value.toLowerCase();
  const list = users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  $("usersList").innerHTML = list.map(u => {
    let action = "";
    if(u.blocked) action = `<span class="badge">Bloqué</span>`;
    else if(u.relation==="friend") action = `<button class="btn-primary" onclick="openPrivate('${u.id}')">Discuter</button>`;
    else if(u.relation==="sent") action = `<span class="badge">Envoyée</span>`;
    else if(u.relation==="received") action = `<button class="btn-primary" onclick="acceptRequest('${u.id}')">Accepter</button>`;
    else action = `<button class="btn-primary" onclick="sendRequest('${u.id}')">Ajouter</button>`;
    return item(u, action);
  }).join("") || empty("Aucun utilisateur.");
}

function renderRequests(requests=[]){
  $("requestCount").textContent = requests.length;
  $("requestsList").innerHTML = requests.map(r => item({
    id:r.from._id, name:r.from.name, email:r.from.email, avatar:r.from.avatar, online:r.from.online
  }, `<button class="btn-primary" onclick="acceptRequest('${r.from._id}')">Accepter</button><button class="btn-danger" onclick="rejectRequest('${r.from._id}')">Refuser</button>`)).join("") || empty("Aucune demande.");
}

function renderFriends(){
  const q = $("searchInput").value.toLowerCase();
  const friends = users.filter(u => u.relation==="friend").filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  $("friendsList").innerHTML = friends.map(u => item(u, `<button class="btn-primary" onclick="openPrivate('${u.id}')">Ouvrir</button>`)).join("") || empty("Aucun contact.");
}

function renderGroups(){
  $("groupsList").innerHTML = groups.map(g => item({
    id:g._id, name:g.name, avatar:g.avatar || avatar(g.name)
  }, `<button class="btn-primary" onclick="openGroup('${g._id}')">Ouvrir</button>`, `${g.members.length} membre(s)`)).join("") || empty("Aucun groupe.");
}

function renderCalls(){
  $("callsList").innerHTML = callHistory.map(c => {
    const other = String(c.from._id || c.from) === String(me.id) ? c.to : c.from;
    const mode = c.mode === "video" ? "📹 Vidéo" : "📞 Vocal";
    const status = c.status || "ended";
    const date = new Date(c.createdAt || c.startedAt).toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
    return item({
      id: other._id,
      name: other.name,
      email: other.email || "",
      avatar: other.avatar || avatar(other.name)
    }, `<span class="badge">${status}</span>`, `${mode} • ${date}`);
  }).join("") || empty("Aucun appel.");
}


window.sendRequest = async id => { await api(`/api/requests/${id}`, {method:"POST", headers:headers()}); await refresh(); };
window.acceptRequest = async id => { await api(`/api/requests/${id}/accept`, {method:"POST", headers:headers()}); await refresh(); openPrivate(id); };
window.rejectRequest = async id => { await api(`/api/requests/${id}/reject`, {method:"POST", headers:headers()}); await refresh(); };

window.openPrivate = async id => {
  const u = users.find(x=>x.id===id);
  active = {type:"private", id, data:u};
  prepareChat(u.name, u.avatar || avatar(u.name), u.online ? "En ligne" : formatLastSeen(u.lastSeen));
  openMobileChat();
  const data = await api(`/api/messages/private/${id}`, {headers:headers()});
  data.messages.forEach(m=>appendMessage(m));
  socket.emit("message:read", { from:id });
};

window.openGroup = async id => {
  const g = groups.find(x=>x._id===id);
  active = {type:"group", id, data:g};
  prepareChat(g.name, g.avatar || avatar(g.name), `${g.members.length} membre(s)`);
  openMobileChat();
  const data = await api(`/api/messages/group/${id}`, {headers:headers()});
  data.messages.forEach(m=>appendMessage(m, true));
};

function prepareChat(name, img, status){
  $("chatName").textContent = name;
  $("chatAvatar").src = img;
  $("chatStatus").textContent = status;
  $("emptyState").classList.add("hidden");
  $("messages").classList.remove("hidden");
  $("messages").innerHTML = "";
  $("messageInput").disabled = false;
  $("sendBtn").disabled = false;
}

function messageStatus(m){
  if(String(m.from?._id || m.from) !== String(me.id)) return "";
  if(m.readAt) return `<span class="ticks read">✓✓</span>`;
  if(m.deliveredAt) return `<span class="ticks delivered">✓✓</span>`;
  return `<span class="ticks sent-tick">✓</span>`;
}

function appendMessage(m, group=false){
  const div = document.createElement("div");
  const mine = String(m.from?._id || m.from) === String(me.id);
  div.className = "bubble " + (m.type==="announcement" ? "announcement" : (mine ? "sent" : "received"));
  div.dataset.id = m._id || "";
  div.dataset.from = String(m.from?._id || m.from || "");
  let sender = group && !mine && m.from?.name ? `<div class="sender">${m.from.name}</div>` : "";
  let body = "";
  if(m.type==="text" || m.type==="announcement") body = escapeHtml(m.content);
  if(m.type==="image") body = `<img src="${fileUrl(m.content)}">`;
  if(m.type==="audio") body = `<audio controls src="${fileUrl(m.content)}"></audio>`;
  if(m.type==="file") body = `<div class="file-message"><span class="file-icon">📄</span><div><a href="${fileUrl(m.content)}" target="_blank" download>${escapeHtml(m.fileName || "Télécharger le fichier")}</a><small>${escapeHtml(m.mimeType || "document")}</small></div></div>`;
  div.innerHTML = sender + body + `<small>${new Date(m.createdAt || Date.now()).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})} <span class="message-status">${messageStatus(m)}</span></small>`;
  $("messages").appendChild(div);
  $("messages").scrollTop = $("messages").scrollHeight;
}

function updateMessageStatus(data){
  const bubble = document.querySelector(`.bubble[data-id="${data.messageId}"] .message-status`);
  if(!bubble) return;
  if(data.readAt) bubble.innerHTML = `<span class="ticks read">✓✓</span>`;
  else if(data.deliveredAt) bubble.innerHTML = `<span class="ticks delivered">✓✓</span>`;
}

function markConversationRead(readerId){
  document.querySelectorAll(`.bubble.sent .message-status`).forEach(el => {
    el.innerHTML = `<span class="ticks read">✓✓</span>`;
  });
}

function updateActiveStatus(){
  if(!active) return;
  if(active.type === "private"){
    const u = users.find(x=>x.id===active.id) || active.data;
    $("chatStatus").textContent = u.online ? "En ligne" : formatLastSeen(u.lastSeen);
  }
  if(active.type === "group"){
    $("chatStatus").textContent = `${active.data.members.length} membre(s)`;
  }
}

$("sendBtn").onclick = sendText;
$("messageInput").onkeydown = e => { if(e.key==="Enter") sendText(); };

$("messageInput").addEventListener("input", () => {
  if(!active || !socket) return;
  if(active.type==="private") socket.emit("typing:start", { to:active.id });
  if(active.type==="group") socket.emit("typing:start", { groupId:active.id });

  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    if(active.type==="private") socket.emit("typing:stop", { to:active.id });
    if(active.type==="group") socket.emit("typing:stop", { groupId:active.id });
  }, 1200);
});
function sendText(){
  const content = $("messageInput").value.trim();
  if(!content || !active) return;
  if(active.type==="private") socket.emit("message:private", {to:active.id, type:"text", content});
  if(active.type==="group") socket.emit("message:group", {groupId:active.id, type:"text", content});
  $("messageInput").value = "";
}

$("emojiBtn").onclick = () => $("emojiBox").classList.toggle("hidden");
document.querySelectorAll("#emojiBox span").forEach(e => e.onclick = () => { $("messageInput").value += e.textContent; $("messageInput").focus(); });

$("imageBtn").onclick = () => active && $("fileInput").click();
$("fileInput").onchange = async () => {
  const file = $("fileInput").files[0]; if(!file || !active) return;
  const form = new FormData(); form.append("file", file);
  const res = await fetch("/api/upload", {method:"POST", headers:{"Authorization":"Bearer "+token}, body:form});
  const data = await res.json();
  let type = "file";
  if(file.type.startsWith("audio")) type = "audio";
  if(file.type.startsWith("image")) type = "image";
  const payload = { type, content:data.url, fileName:data.fileName, mimeType:data.mimeType, size:data.size };
  if(active.type==="private") socket.emit("message:private", {to:active.id, ...payload});
  if(active.type==="group") socket.emit("message:group", {groupId:active.id, ...payload});
  $("fileInput").value = "";
};

$("recordBtn").onclick = async () => {
  if(!active) return;
  if(!recording){
    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
    mediaRecorder = new MediaRecorder(stream);
    chunks = [];
    mediaRecorder.ondataavailable = e => chunks.push(e.data);
    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunks, {type:"audio/webm"});
      const form = new FormData();
      form.append("file", new File([blob], "message-vocal.webm"));
      const res = await fetch("/api/upload", {method:"POST", headers:{"Authorization":"Bearer "+token}, body:form});
      const data = await res.json();
      if(active.type==="private") socket.emit("message:private", {to:active.id, type:"audio", content:data.url});
      if(active.type==="group") socket.emit("message:group", {groupId:active.id, type:"audio", content:data.url});
    };
    mediaRecorder.start(); recording = true; $("recordBtn").textContent = "⏹️";
  } else {
    mediaRecorder.stop(); recording = false; $("recordBtn").textContent = "🎙️";
  }
};

$("voiceCall").onclick = () => startCall("audio");
$("videoCall").onclick = () => startCall("video");

async function startCall(mode){
  if(!active || active.type!=="private") return showModal("Appel impossible", "Choisissez un contact privé accepté.");
  openCallPanel(`Appel ${mode === "video" ? "vidéo" : "vocal"} avec ${active.data.name}`, "Appel en cours...");
  currentCall = { to:active.id, mode, incoming:false };
  await prepareLocalMedia(mode);
  createPeer(active.id, true);

  socket.emit("call:start", {to:active.id, mode}, async res => {
    if(!res || !res.ok) return endCall(false, res?.error || "Appel impossible");
    currentCall.callId = res.callId;
    callStartedAt = Date.now();
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("webrtc:offer", {to:active.id, callId:res.callId, offer});
  });
}

function openCallPanel(title, state){
  $("callName").textContent = title;
  $("callState").textContent = state;
  $("callPanel").classList.remove("hidden");
  $("acceptCallBtn").classList.add("hidden");
  $("rejectCallBtn").classList.add("hidden");
}

async function prepareLocalMedia(mode){
  localStream = await navigator.mediaDevices.getUserMedia({ audio:true, video: mode === "video" });
  $("localVideo").srcObject = localStream;
  $("localVideo").classList.toggle("hidden", mode !== "video");
}

function createPeer(remoteId, caller=false){
  peer = new RTCPeerConnection({
    iceServers: [{ urls:"stun:stun.l.google.com:19302" }]
  });

  localStream?.getTracks().forEach(track => peer.addTrack(track, localStream));

  peer.ontrack = event => {
    $("remoteVideo").srcObject = event.streams[0];
  };

  peer.onicecandidate = event => {
    if(event.candidate && currentCall){
      socket.emit("webrtc:ice", { to:remoteId, callId:currentCall.callId, candidate:event.candidate });
    }
  };

  peer.onconnectionstatechange = () => {
    if(peer.connectionState === "connected") $("callState").textContent = "Connecté";
    if(["failed","disconnected","closed"].includes(peer.connectionState)) $("callState").textContent = "Connexion terminée";
  };
}

function showIncomingCall(data){
  const caller = users.find(u => u.id === data.from) || { name:data.name, id:data.from };
  currentCall = { callId:data.callId, to:data.from, mode:data.mode, incoming:true, data:caller };
  openCallPanel(`${data.name} vous appelle`, data.mode === "video" ? "Appel vidéo entrant" : "Appel vocal entrant");
  $("acceptCallBtn").classList.remove("hidden");
  $("rejectCallBtn").classList.remove("hidden");
}

$("acceptCallBtn").onclick = async () => {
  if(!currentCall) return;
  $("acceptCallBtn").classList.add("hidden");
  $("rejectCallBtn").classList.add("hidden");
  $("callState").textContent = "Connexion...";
  await prepareLocalMedia(currentCall.mode);
  createPeer(currentCall.to, false);
  socket.emit("call:accept", { callId:currentCall.callId, to:currentCall.to });
  callStartedAt = Date.now();
};

$("rejectCallBtn").onclick = () => {
  if(currentCall) socket.emit("call:reject", { callId:currentCall.callId, to:currentCall.to });
  endCall(false, "Appel refusé");
};

async function handleOffer(data){
  if(!currentCall) currentCall = { callId:data.callId, to:data.from, mode:"video", incoming:true };
  currentCall.callId = data.callId;
  currentCall.to = data.from;
  if(!peer){
    await prepareLocalMedia(currentCall.mode || "video");
    createPeer(data.from, false);
  }
  await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  socket.emit("webrtc:answer", { to:data.from, callId:data.callId, answer });
}

async function handleAnswer(data){
  if(peer && data.answer) await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
}

async function handleIce(data){
  if(peer && data.candidate){
    try{ await peer.addIceCandidate(new RTCIceCandidate(data.candidate)); }catch(e){}
  }
}

function onCallAccepted(){
  $("callState").textContent = "Appel accepté";
}

$("endCallBtn").onclick = () => endCall(true, "Appel terminé");
$("closeCallPanel").onclick = () => endCall(true, "Appel fermé");

function endCall(notify=true, state="Appel terminé"){
  $("callState").textContent = state;
  if(notify && currentCall?.to){
    const durationSeconds = callStartedAt ? Math.floor((Date.now() - callStartedAt)/1000) : 0;
    socket.emit("call:end", { callId:currentCall.callId, to:currentCall.to, durationSeconds });
  }

  if(peer){ peer.close(); peer = null; }
  if(localStream){ localStream.getTracks().forEach(t=>t.stop()); localStream = null; }
  $("localVideo").srcObject = null;
  $("remoteVideo").srcObject = null;

  setTimeout(() => {
    $("callPanel").classList.add("hidden");
    currentCall = null;
    callStartedAt = null;
    refresh().catch(()=>{});
  }, 700);
}

$("muteBtn").onclick = () => {
  if(!localStream) return;
  const track = localStream.getAudioTracks()[0];
  if(!track) return;
  track.enabled = !track.enabled;
  $("muteBtn").textContent = track.enabled ? "🎙️" : "🔇";
};

$("cameraBtn").onclick = () => {
  if(!localStream) return;
  const track = localStream.getVideoTracks()[0];
  if(!track) return;
  track.enabled = !track.enabled;
  $("cameraBtn").textContent = track.enabled ? "📷" : "🚫";
};

$("newGroupBtn").onclick = () => {
  const friendOptions = users.filter(u=>u.relation==="friend").map(u => `<label><input type="checkbox" value="${u.id}"> ${u.name}</label><br>`).join("") || "Aucun contact accepté.";
  showModal("Créer un groupe", "Donnez un nom au groupe et choisissez les membres.");
  $("modalExtra").innerHTML = `<input id="groupName" placeholder="Nom du groupe"><input id="groupDesc" placeholder="Description"><div class="check-list">${friendOptions}</div><button class="btn-primary full" onclick="createGroup()">Créer le groupe</button>`;
};
window.createGroup = async () => {
  const members = Array.from(document.querySelectorAll("#modalExtra input[type=checkbox]:checked")).map(x=>x.value);
  await api("/api/groups", {method:"POST", headers:headers(), body:JSON.stringify({name:$("groupName").value, description:$("groupDesc").value, members})});
  $("modal").classList.add("hidden");
  $("modalExtra").innerHTML = "";
  await refresh();
};

async function loadAdmin(){
  const [stats, data] = await Promise.all([
    api("/api/admin/stats", {headers:headers()}),
    api("/api/admin/users", {headers:headers()})
  ]);
  $("stats").innerHTML = Object.entries(stats).map(([k,v]) => `<div class="stat"><strong>${v}</strong>${k}</div>`).join("");
  $("adminUsers").innerHTML = data.users.map(u => `
    <div class="item">
      <img src="${u.avatar || avatar(u.name)}">
      <div class="item-info"><strong>${u.name}</strong><span>${u.email} • ${u.role} ${u.blocked ? "• bloqué" : ""}</span></div>
      <div class="item-actions">
        <button class="btn-blue" onclick="setRole('${u._id}','admin')">Admin</button>
        <button class="btn-blue" onclick="setRole('${u._id}','user')">User</button>
        <button class="btn-danger" onclick="blockUser('${u._id}',${!u.blocked})">${u.blocked ? "Débloquer" : "Bloquer"}</button>
        <button class="btn-danger" onclick="deleteUser('${u._id}')">Supprimer</button>
      </div>
    </div>`).join("");
}
window.setRole = async (id, role) => { await api(`/api/admin/users/${id}/role`, {method:"PATCH", headers:headers(), body:JSON.stringify({role})}); await loadAdmin(); };
window.blockUser = async (id, blocked) => { await api(`/api/admin/users/${id}/block`, {method:"PATCH", headers:headers(), body:JSON.stringify({blocked})}); await loadAdmin(); await refresh(); };
window.deleteUser = async id => { if(confirm("Supprimer cet utilisateur ?")) { await api(`/api/admin/users/${id}`, {method:"DELETE", headers:headers()}); await loadAdmin(); await refresh(); } };
$("sendAnnouncement").onclick = async () => {
  const content = $("announcementText").value.trim();
  if(!content) return;
  await api("/api/admin/announcement", {method:"POST", headers:headers(), body:JSON.stringify({content})});
  $("announcementText").value = "";
  showModal("Annonce envoyée", "L’annonce a été enregistrée pour les utilisateurs.");
};


async function requestNotifications(){
  if(!("Notification" in window)) return showModal("Notifications", "Votre navigateur ne supporte pas les notifications.");
  const permission = await Notification.requestPermission();
  if(permission === "granted") showModal("Notifications activées", "TalkPro peut maintenant afficher des notifications.");
  else showModal("Notifications refusées", "Vous pouvez les réactiver dans les paramètres du navigateur.");
}

function notifyUser(title, body){
  if(!("Notification" in window)) return;
  if(Notification.permission !== "granted") return;
  if(document.hasFocus()) return;
  new Notification(title, { body, icon:"/icons/icon-192.png" });
}

function renderProfilePanel(){
  $("profilePanel").innerHTML = `
    <h3>Profil utilisateur</h3>
    <input id="profileName" placeholder="Nom" value="${escapeHtml(me.name || "")}">
    <input id="profileAvatar" placeholder="Lien photo de profil" value="${escapeHtml(me.avatar || "")}">
    <input id="profilePhone" placeholder="Téléphone" value="${escapeHtml(me.phone || "")}">
    <input id="profileStatus" placeholder="Statut" value="${escapeHtml(me.statusText || "Disponible")}">
    <textarea id="profileBio" placeholder="Bio">${escapeHtml(me.bio || "")}</textarea>
    <button class="btn-primary full" onclick="saveProfile()">Enregistrer le profil</button>

    <h3>Mot de passe</h3>
    <input id="oldPassword" type="password" placeholder="Ancien mot de passe">
    <input id="newPassword" type="password" placeholder="Nouveau mot de passe">
    <button class="btn-blue full" onclick="changePassword()">Changer le mot de passe</button>
  `;
}

window.saveProfile = async () => {
  const data = await api("/api/profile", {
    method:"PATCH",
    headers:headers(),
    body:JSON.stringify({
      name:$("profileName").value,
      avatar:$("profileAvatar").value,
      phone:$("profilePhone").value,
      statusText:$("profileStatus").value,
      bio:$("profileBio").value
    })
  });
  me = { ...me, ...data.user };
  localStorage.setItem("talkpro_v2_user", JSON.stringify(me));
  $("myAvatar").src = me.avatar || avatar(me.name);
  $("myName").textContent = me.name;
  showModal("Profil mis à jour", "Vos informations ont été enregistrées.");
};

window.changePassword = async () => {
  await api("/api/profile/password", {
    method:"PATCH",
    headers:headers(),
    body:JSON.stringify({ currentPassword:$("oldPassword").value, newPassword:$("newPassword").value })
  });
  showModal("Mot de passe modifié", "Votre mot de passe a été changé.");
};

async function loadMediaGallery(){
  if(!active){
    $("mediaList").innerHTML = empty("Ouvrez d’abord une discussion ou un groupe pour voir la galerie.");
    return;
  }
  const url = active.type === "private" ? `/api/media/private/${active.id}` : `/api/media/group/${active.id}`;
  const data = await api(url, { headers:headers() });
  if(!data.media.length){
    $("mediaList").innerHTML = empty("Aucun média dans cette discussion.");
    return;
  }
  $("mediaList").innerHTML = `<div class="media-grid">${data.media.map(m => {
    if(m.type === "image") return `<div class="media-card"><a href="${fileUrl(m.content)}" target="_blank"><img src="${fileUrl(m.content)}"></a><div class="media-info">${new Date(m.createdAt).toLocaleDateString("fr-FR")}</div></div>`;
    if(m.type === "audio") return `<div class="media-card"><div class="media-info">🎧 Message vocal<br><audio controls src="${fileUrl(m.content)}"></audio></div></div>`;
    return `<div class="media-card"><div class="media-info">📄 <a href="${fileUrl(m.content)}" target="_blank" download>${escapeHtml(m.fileName || "Document")}</a><br>${new Date(m.createdAt).toLocaleDateString("fr-FR")}</div></div>`;
  }).join("")}</div>`;
}

function toggleTheme(){
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  localStorage.setItem("talkpro_theme", currentTheme);
  document.body.classList.toggle("dark", currentTheme === "dark");
  $("themeBtn").textContent = currentTheme === "dark" ? "Mode clair" : "Mode sombre";
}

$("aboutBtn").onclick = () => showModal("À propos du développeur", "Je suis Jehovani Nsanguluja, fondateur et développeur de TalkPro Connect V2. Cette plateforme a été conçue pour offrir une communication professionnelle, moderne et évolutive.");
$("closeModal").onclick = () => { $("modal").classList.add("hidden"); $("modalExtra").innerHTML = ""; };
function showModal(title, text){ $("modalTitle").textContent = title; $("modalText").textContent = text; $("modalExtra").innerHTML = ""; $("modal").classList.remove("hidden"); }

$("notifyBtn").onclick = requestNotifications;
$("themeBtn").onclick = toggleTheme;
$("themeBtn").textContent = currentTheme === "dark" ? "Mode clair" : "Mode sombre";
$("installBtn").onclick = async () => {
  if(!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  $("installBtn").classList.add("hidden");
};

$("logoutBtn").onclick = () => { localStorage.removeItem("talkpro_v2_token"); localStorage.removeItem("talkpro_v2_user"); location.reload(); };
function escapeHtml(str){ return String(str).replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m])); }


/* =========================
   V5.1 MOBILE PRO
========================= */
function isMobileView(){
  return window.matchMedia("(max-width: 820px)").matches;
}

function openMobileChat(){
  if(isMobileView()){
    document.body.classList.add("mobile-chat-open");
  }
}

function closeMobileChat(){
  document.body.classList.remove("mobile-chat-open");
}

window.addEventListener("resize", () => {
  if(!isMobileView()) document.body.classList.remove("mobile-chat-open");
});

document.addEventListener("click", (e) => {
  const back = e.target.closest("#mobileBackBtn");
  if(back) closeMobileChat();
});

function ensureMobileBackButton(){
  const header = document.querySelector(".chat-header");
  if(!header || document.getElementById("mobileBackBtn")) return;
  const btn = document.createElement("button");
  btn.id = "mobileBackBtn";
  btn.className = "mobile-back-btn";
  btn.innerHTML = "←";
  header.prepend(btn);
}

ensureMobileBackButton();
