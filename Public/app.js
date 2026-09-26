let token=localStorage.getItem("chat_token"), me=JSON.parse(localStorage.getItem("chat_user")||"null");
let socket=null,current=null,users=[];
const $=id=>document.getElementById(id);
const auth=$("auth"), app=$("app"), authBtn=$("authBtn"), sw=$("switch");
let signup=false;
function showApp(){auth.classList.add("hidden");app.classList.remove("hidden");connect();loadUsers()}
function showAuth(){auth.classList.remove("hidden");app.classList.add("hidden")}
if(token&&me)showApp();
function setMode(){signup=!signup;auth.classList.toggle("signup",signup);$("authTitle").textContent=signup?"Create account":"Welcome back";$("authSub").textContent=signup?"Create your ChatApp account":"Login to continue chatting";authBtn.textContent=signup?"Sign up":"Login";sw.innerHTML=signup?'Already have an account? <b>Login</b>':"Don't have an account? <b>Sign up</b>"}
sw.onclick=setMode; setMode(); setMode(); // return to login by default
authBtn.onclick=async()=>{
 const body={name:$("name").value,email:$("email").value,password:$("password").value};
 const r=await fetch(signup?"/api/register":"/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
 const d=await r.json(); if(!r.ok){$("error").textContent=d.error;return}
 token=d.token;me=d.user;localStorage.setItem("chat_token",token);localStorage.setItem("chat_user",JSON.stringify(me));showApp()
};
$("logout").onclick=()=>{localStorage.clear();if(socket)socket.disconnect();location.reload()};
async function loadUsers(){const r=await fetch("/api/users",{headers:{Authorization:"Bearer "+token}});users=await r.json();renderUsers(users)}
function renderUsers(list){$("users").innerHTML=list.map(u=>`<div class="user ${current&&current._id===u._id?"active":""}" data-id="${u._id}"><div class="avatar">${u.name[0].toUpperCase()}</div><div class="uinfo"><b>${escapeHtml(u.name)}</b><small>${u.online?'<span class="dot"></span>online':'offline'}</small></div></div>`).join("");document.querySelectorAll(".user").forEach(x=>x.onclick=()=>openChat(x.dataset.id))}
$("search").oninput=e=>{let q=e.target.value.toLowerCase();renderUsers(users.filter(u=>u.name.toLowerCase().includes(q)))};
async function openChat(id){current=users.find(u=>u._id===id);if(!current)return;renderUsers(users);$("chatName").textContent=current.name;$("chatAvatar").textContent=current.name[0].toUpperCase();$("chatStatus").textContent=current.online?"online":"offline";$("message").disabled=false;$("send").disabled=false;$("messages").innerHTML="";if(innerWidth<=700){$("app").querySelector(".sidebar").classList.add("mobile-hide");$("app").querySelector(".chat").classList.add("mobile-show")}const r=await fetch("/api/messages/"+id,{headers:{Authorization:"Bearer "+token}});(await r.json()).forEach(addMessage);scroll()}
function addMessage(m){let div=document.createElement("div");div.className="bubble "+(String(m.sender)===String(me.id)?"out":"in");let t=new Date(m.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});div.innerHTML=escapeHtml(m.text)+`<small>${t} ${String(m.sender)===String(me.id)?"✓✓":""}</small>`;$("messages").appendChild(div)}
$("form").onsubmit=e=>{e.preventDefault();let text=$("message").value.trim();if(!text||!current)return;socket.emit("send_message",{receiverId:current._id,text});$("message").value=""};
function connect(){socket=io({auth:{token}});socket.on("message",m=>{if(current&&(String(m.sender)===String(current._id)||String(m.receiver)===String(current._id)))addMessage(m);scroll()});socket.on("presence",p=>{let u=users.find(x=>String(x._id)===String(p.userId));if(u){u.online=p.online;renderUsers(users);if(current&&String(current._id)===String(p.userId))$("chatStatus").textContent=p.online?"online":"offline"}})}
function scroll(){$("messages").scrollTop=$("messages").scrollHeight}
function escapeHtml(s){let d=document.createElement("div");d.textContent=s;return d.innerHTML}
