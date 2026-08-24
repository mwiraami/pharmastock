const DB = "pharmastock", STORES = ["settings","users","categories","suppliers","customers","patients","products","batches","movements","sales","cash","inventories","notifications","audit","licenses"];

let db, state={pharmacy:null,currentUser:null,products:[],batches:[],cart:[],page:"dashboard",openBatchForm:false,api:{available:false,accessToken:null,refreshToken:null}};

const $=s=>document.querySelector(s), id=()=>crypto.randomUUID(), day=()=>new Date().toISOString().slice(0,10), esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])), isActive=p=>String(p.status||"ACTIVE").toUpperCase()==="ACTIVE";

const fmt=n=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:state.pharmacy?.currency||"XOF",maximumFractionDigits:0}).format(+n||0);

async function hashPassword(password){let bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(password));return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,"0")).join("")}
const API_BASE=window.PHARMASTOCK_API||"http://localhost:5000";
async function apiRequest(path,options={}){let headers={"Content-Type":"application/json",...(options.headers||{})};if(state.api.accessToken)headers.Authorization=`Bearer ${state.api.accessToken}`;let response=await fetch(`${API_BASE}${path}`,{...options,headers});let body=await response.json().catch(()=>({success:false,message:"Réponse API invalide"}));if(!response.ok||body.success===false)throw Error(body.message||"Erreur API");return body.data}
async function detectApi(){try{await apiRequest("/api/health",{signal:AbortSignal.timeout(700)});state.api.available=true}catch{state.api.available=false}}

function open(){return new Promise((ok,no)=>{let r=indexedDB.open(DB,3);
r.onupgradeneeded=()=>{db=r.result;
STORES.forEach(s=>{if(!db.objectStoreNames.contains(s))db.createObjectStore(s,{keyPath:"id"})})};
r.onsuccess=()=>{db=r.result;
ok()};
r.onerror=()=>no(r.error)})}function all(s){return new Promise(ok=>{let r=db.transaction(s).objectStore(s).getAll();
r.onsuccess=()=>ok(r.result)})}function put(s,x){return new Promise(ok=>{let r=db.transaction(s,"readwrite").objectStore(s).put(x);
r.onsuccess=ok})}
async function refresh(){state.products=await all("products");
for(const product of state.products){product.status=String(product.status||"ACTIVE").toUpperCase()}
state.batches=await all("batches");
for(const product of state.products){if(+product.qty>0&&!state.batches.some(batch=>batch.productId===product.id)){const batch={id:id(),productId:product.id,number:`MIG-${product.code||product.id.slice(0,8)}`,quantity:+product.qty,available:+product.qty,buyPrice:+product.buyPrice||0,salePrice:+product.salePrice||0,expiry:"2099-12-31",receivedAt:day(),legacy:true};await put("batches",batch);state.batches.push(batch)}}}async function audit(action,module,data={}){await put("audit",{id:id(),action,module,data,date:new Date().toISOString(),user:state.pharmacy.admin})}function note(m){let e=document.createElement("div");
e.className="toast";
e.textContent=m;
document.body.append(e);
setTimeout(()=>e.remove(),2500)}
async function init(){await open();
document.body.dataset.theme=localStorage.getItem("pharmastock-theme")||"light";
await detectApi();
state.pharmacy=(await all("settings")).find(x=>x.id==="pharmacy");
if(state.pharmacy){let sessionId=sessionStorage.getItem("pharmastock-user"),users=await all("users");state.currentUser=users.find(user=>user.id===sessionId&&user.active);state.api.accessToken=sessionStorage.getItem("pharmastock-access-token");state.api.refreshToken=sessionStorage.getItem("pharmastock-refresh-token")}
await refresh();
if("serviceWorker"in navigator&&location.protocol!=="file:")navigator.serviceWorker.register("./sw.js");
render()}
function login(){
$("#app").innerHTML=`<section class="setup"><div class="brand">✚ PharmaStock</div><h1>Connexion</h1><p class="muted">${esc(state.pharmacy.name)} · Accès sécurisé</p><form id="login"><label>E-mail ou nom d'utilisateur<input required name="identity" autocomplete="username"></label><label>Mot de passe<input required name="password" type="password" autocomplete="current-password"></label><button>Se connecter</button></form></section>`;
$("#login").onsubmit=async event=>{event.preventDefault();let values=Object.fromEntries(new FormData(event.target));try{if(state.api.available){let result=await apiRequest("/api/auth/login",{method:"POST",body:JSON.stringify({identity:values.identity,password:values.password})});state.currentUser=result.user;state.api.accessToken=result.accessToken;state.api.refreshToken=result.refreshToken;sessionStorage.setItem("pharmastock-user",result.user.id);sessionStorage.setItem("pharmastock-access-token",result.accessToken);sessionStorage.setItem("pharmastock-refresh-token",result.refreshToken)}else{let passwordHash=await hashPassword(values.password),users=await all("users"),user=users.find(candidate=>(candidate.email===values.identity||candidate.username===values.identity)&&candidate.passwordHash===passwordHash&&candidate.active);if(!user)return note("Identifiants invalides");state.currentUser=user;sessionStorage.setItem("pharmastock-user",user.id)}await audit("Connexion","Authentification");render()}catch(error){note(error.message)}}}
function setup(){$("#app").innerHTML=`<section class="setup"><div class="brand">✚ PharmaStock</div><h1>Créez votre pharmacie</h1><p class="muted">Configuration locale hors connexion. Les données restent sur cet appareil.</p><form id="setup"><h2>Pharmacie</h2>${fields([["name","Nom de la pharmacie","text",1],["license","N° licence/enregistrement","text"],["phone","Téléphone","tel"],["email","E-mail","email"],["address","Adresse","text"],["city","Ville","text",1],["country","Pays","text"],["tax","N° fiscal","text"],["currency","Devise (XOF, EUR…)","text",1,"XOF"]])}<h2>Administrateur</h2>${fields([["adminFirst","Prénom","text",1],["adminLast","Nom","text",1],["adminEmail","E-mail","email",1],["adminPhone","Téléphone","tel"],["username","Nom d'utilisateur","text",1],["password","Mot de passe","password",1],["confirm","Confirmation du mot de passe","password",1]])}<button type="submit">Créer ma pharmacie</button></form></section>`;
$("#setup").onsubmit=async e=>{e.preventDefault();
let x=Object.fromEntries(new FormData(e.target));
if(x.password!==x.confirm)return note("Les mots de passe ne correspondent pas");
if(state.api.available){try{let result=await apiRequest("/api/auth/register-pharmacy",{method:"POST",body:JSON.stringify({pharmacy:{name:x.name,licenseNumber:x.license,phone:x.phone,email:x.email,address:x.address,city:x.city,country:x.country,currency:x.currency,taxNumber:x.tax},admin:{firstName:x.adminFirst,lastName:x.adminLast,email:x.adminEmail,username:x.username,phone:x.adminPhone,password:x.password}})});state.pharmacy={id:result.pharmacy.id,...result.pharmacy,admin:`${result.user.email}`};state.currentUser={...result.user,firstName:x.adminFirst,lastName:x.adminLast};state.api.accessToken=result.accessToken;state.api.refreshToken=result.refreshToken;sessionStorage.setItem("pharmastock-user",state.currentUser.id);sessionStorage.setItem("pharmastock-access-token",result.accessToken);sessionStorage.setItem("pharmastock-refresh-token",result.refreshToken);note("Pharmacie créée sur le serveur");return render()}catch(error){return note(error.message)}}
state.pharmacy={id:"pharmacy",...x,admin:`${x.adminFirst} ${x.adminLast}`,createdAt:new Date().toISOString()};
delete state.pharmacy.confirm;
delete state.pharmacy.password;
await put("settings",state.pharmacy);
let user={id:id(),firstName:x.adminFirst,lastName:x.adminLast,email:x.adminEmail,phone:x.adminPhone,username:x.username,role:"ADMINISTRATEUR",active:true,passwordHash:await hashPassword(x.password)};
await put("users",user);state.currentUser=user;sessionStorage.setItem("pharmastock-user",user.id);
await audit("Création pharmacie","Configuration");
render()}}
function fields(a){return a.map(([n,l,t,r,v=""])=>`<label>${l}<input ${r?"required":""} name="${n}" type="${t}" value="${esc(v)}"></label>`).join("")}
function shell(content){let nav=[["dashboard","Tableau de bord"],["sale","Ventes"],["cash","Caisse"],["products","Produits"],["categories","Catégories"],["batches","Lots & expirations"],["stock","Stock / Mouvements"],["suppliers","Fournisseurs"],["customers","Clients"],["patients","Patients"],["inventory","Inventaire"],["users","Utilisateurs"],["reports","Rapports"],["license","Licence"],["notifications","Notifications"],["audit","Journal d'activité"],["settings","Paramètres"]],role=state.currentUser?.role;
if(role!=="ADMINISTRATEUR")nav=nav.filter(([page])=>!["users","license","audit","settings"].includes(page));
$("#app").innerHTML=`<div class="app"><aside class="sidebar"><h1>✚ PharmaStock</h1><nav class="nav">${nav.map(x=>`<button class="${state.page===x[0]?"active":""}" data-p="${x[0]}">${x[1]}</button>`).join("")}</nav></aside><main class="content"><header class="topbar"><div><div class="brand">${esc(state.pharmacy.name)}</div><span class="muted">${esc(state.pharmacy.city)} · ${esc(state.currentUser?.firstName||"")} ${esc(state.currentUser?.lastName||"")} · ${esc(role||"")}</span></div><div class="topbar-actions"><span class="offline">${navigator.onLine?"● En ligne":"● Hors connexion"}</span><button id="logout" class="secondary">Déconnexion</button></div></header>${content}</main></div>`;
document.querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>{state.page=b.dataset.p;
render()});$("#logout").onclick=async()=>{await audit("Déconnexion","Authentification");sessionStorage.removeItem("pharmastock-user");state.currentUser=null;render()}}
function status(b){return b.expiry<day()?"EXPIRE":b.expiry<=new Date(Date.now()+30*864e5).toISOString().slice(0,10)?"ATTENTION":"NORMAL"}async function generateAlerts(){let existing=await all("notifications"),add=async(key,title,message,level)=>{if(existing.some(n=>n.autoKey===key))return;
let n={id:id(),autoKey:key,title,message,level,status:"UNREAD",createdAt:new Date().toISOString()};
await put("notifications",n);
existing.push(n)};
for(let p of state.products)if(available(p.id)<=+p.minStock)await add(`low-${p.id}`,"Stock faible",`${p.name} est au seuil minimum ou en rupture.`,available(p.id)===0?"URGENT":"ATTENTION");
for(let b of state.batches){let s=status(b);
if(s!=="NORMAL")await add(`expiry-${b.id}-${s}`,s==="EXPIRE"?"Lot expiré":"Expiration proche",`${productName(b.productId)} · lot ${b.number} · expiration ${b.expiry}.`,s)}}async function dashboard(){await generateAlerts();
let qty=state.batches.reduce((s,b)=>s+(+b.available||0),0), val=state.batches.reduce((s,b)=>s+(+b.available||0)*(+b.buyPrice||0),0),low=state.products.filter(p=>available(p.id)<=+p.minStock).length, exp=state.batches.filter(b=>status(b)!="NORMAL").length;
shell(`<h2>Tableau de bord</h2><div class="grid">${[["Stock total",qty],["Valeur du stock",fmt(val)],["Stock faible",low],["Lots à surveiller",exp]].map(x=>`<div class="card"><p>${x[0]}</p><strong>${x[1]}</strong></div>`).join("")}</div><section class="panel"><h3>Alertes</h3><p>${low} produit(s) sous seuil minimum · ${exp} lot(s) expiré(s) ou proches de l'expiration.</p></section>`)}
function available(pid){return state.batches.filter(b=>b.productId===pid&&b.expiry>=day()).reduce((s,b)=>s+(+b.available||0),0)}function productName(pid){return state.products.find(p=>p.id===pid)?.name||"Produit supprimé"}
function physicalStock(pid){return state.batches.filter(b=>b.productId===pid).reduce((sum,b)=>sum+(+b.available||0),0)}
function saleBatch(pid){return state.batches.filter(b=>b.productId===pid&&b.available>0&&b.expiry>=day()).sort((a,b)=>a.expiry.localeCompare(b.expiry))[0]}
function saleRows(customer="Vente comptoir",suppliers=[]){return state.cart.map(item=>{let product=state.products.find(p=>p.id===item.productId)||{},batch=saleBatch(item.productId),supplier=suppliers.find(entry=>entry.id===batch?.supplier);return [new Date().toLocaleDateString("fr-FR"),esc(item.name),esc(product.form||"—"),esc(product.dosage||"—"),esc(supplier?.name||batch?.supplier||"—"),esc(customer),esc(batch?.number||"—"),batch?.expiry||"—",physicalStock(item.productId),available(item.productId),"À encaisser",fmt(item.price),fmt(item.quantity*item.price-item.discount)]})}
async function products(){if(state.api.available&&state.api.accessToken){try{let remoteProducts=await apiRequest("/api/products");if(remoteProducts.length&&state.batches.length)state.products=remoteProducts}catch(error){note(error.message)}}shell(`<div class="panel-head"><h2>Produits</h2><button id="new">Ajouter</button></div><section class="panel"><label>Rechercher<input id="search" placeholder="Nom, code ou code-barres"></label></section><section class="panel" id="form" hidden><form id="f" class="row">${fields([["code","Code produit","text",1],["barcode","Code-barres","text"],["name","Nom commercial","text",1],["genericName","Nom générique","text"],["category","Catégorie","text"],["form","Forme pharmaceutique","text"],["dosage","Dosage","text"],["unit","Unité","text"],["manufacturer","Fabricant","text"],["supplier","Fournisseur","text"],["buyPrice","Prix achat","number",1],["salePrice","Prix vente","number",1],["minStock","Stock minimum","number",1,"0"],["maxStock","Stock maximum","number"],["location","Emplacement","text"],["prescription","Ordonnance obligatoire (oui/non)","text"],["status","Statut ACTIVE/INACTIVE","text",1,"ACTIVE"]])}<button>Enregistrer</button></form></section><div id="product-table">${productTable(state.products)}</div>`);
$("#new").onclick=()=>$("#form").hidden=false;
$("#search").oninput=e=>{$("#product-table").innerHTML=productTable(state.products.filter(p=>`${p.name} ${p.code} ${p.barcode}`.toLowerCase().includes(e.target.value.toLowerCase())));
bindArchives()};
$("#f").onsubmit=async e=>{e.preventDefault();
let x=Object.fromEntries(new FormData(e.target));
x={id:id(),...x,status:String(x.status||"ACTIVE").toUpperCase(),buyPrice:+x.buyPrice,salePrice:+x.salePrice,minStock:+x.minStock,maxStock:+x.maxStock};
if(state.api.available&&state.api.accessToken){try{let remote=await apiRequest("/api/products",{method:"POST",body:JSON.stringify({code:x.code,barcode:x.barcode||undefined,name:x.name,genericName:x.genericName||undefined,buyPrice:x.buyPrice,salePrice:x.salePrice,minStock:x.minStock,maxStock:x.maxStock||undefined,prescriptionRequired:String(x.prescription).toLowerCase()==="oui"})});state.products.push(remote);await audit("Création produit","Produits",{name:remote.name});note("Produit enregistré sur le serveur");return products()}catch(error){return note(error.message)}}
await put("products",x);
state.products.push(x);
await audit("Création produit","Produits",{name:x.name});
note("Produit enregistré");
products()};
bindArchives()}
function productTable(list){return table(["Produit","Code","Stock","Prix vente","Statut","Action"],list.map(p=>[esc(p.name),esc(p.barcode||p.code),available(p.id),fmt(p.salePrice),esc(p.status),p.status!=="ARCHIVED"?`<button class="secondary archive" data-id="${p.id}">Archiver</button>`:"—"]))}function bindArchives(){document.querySelectorAll(".archive").forEach(b=>b.onclick=async()=>{let p=state.products.find(p=>p.id===b.dataset.id);
p.status="ARCHIVED";
await put("products",p);
await audit("Archivage produit","Produits",{name:p.name});
note("Produit archivé");
products()})}
function batches(){shell(`<div class="panel-head"><h2>Lots & expirations</h2><button id="new">Réceptionner un lot</button></div><section class="panel" id="form" ${state.openBatchForm?"":"hidden"}><form id="f" class="row"><label>Produit<select required name="productId">${state.products.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></label>${fields([["number","Numéro de lot","text",1],["quantity","Quantité reçue","number",1],["manufactured","Date de fabrication","date"],["expiry","Date d'expiration","date",1],["buyPrice","Prix achat","number",1],["salePrice","Prix vente","number",1],["supplier","Fournisseur","text"],["receivedAt","Date réception","date",1,day()]])}<button>Valider réception</button></form></section>${table(["Lot","Produit","Disponible","Expiration","Statut"],state.batches.map(b=>[b.number,productName(b.productId),b.available,b.expiry,`<span class="badge ${status(b)==="EXPIRE"?"danger":status(b)==="ATTENTION"?"warning":""}">${status(b)}</span>`]))}`);
$("#new").onclick=()=>{$("#form").hidden=false;state.openBatchForm=true};
$("#f").onsubmit=async e=>{e.preventDefault();
let x=Object.fromEntries(new FormData(e.target));
x={id:id(),...x,quantity:+x.quantity,available:+x.quantity,buyPrice:+x.buyPrice,salePrice:+x.salePrice};
if(x.expiry<day())return note("Un lot expiré ne peut pas être réceptionné");
await put("batches",x);
state.batches.push(x);
await put("movements",{id:id(),type:"ENTRÉE",productId:x.productId,batchId:x.id,quantity:x.quantity,reason:"Réception",date:new Date().toISOString()});
await audit("Entrée stock","Stock",{lot:x.number});
note("Lot reçu");
state.openBatchForm=false;
batches()}}
function stock(){shell(`<div class="panel-head"><h2>Stock & mouvements</h2><div class="panel-actions"><button id="entry">Entrée de stock</button><button id="out" class="secondary">Sortie de stock</button></div></div><section class="panel" id="form" hidden><form id="f" class="row"><label>Lot<select name="batchId">${state.batches.map(b=>`<option value="${b.id}">${productName(b.productId)} · ${b.number} (${b.available})</option>`).join("")}</select></label>${fields([["quantity","Quantité","number",1],["reason","Motif (expiré, endommagé, perte, retour, usage interne, correction, autre)","text",1],["comment","Commentaire","text"]])}<button>Enregistrer sortie</button></form></section>${table(["Produit","Lot","Disponible","Expiration","Valeur"],state.batches.map(b=>[productName(b.productId),b.number,b.available,b.expiry,fmt(b.available*b.buyPrice)]))}`);
$("#entry").onclick=()=>{state.page="batches";state.openBatchForm=true;render()};
$("#out").onclick=()=>$("#form").hidden=false;
$("#f").onsubmit=async e=>{e.preventDefault();
let x=Object.fromEntries(new FormData(e.target)),b=state.batches.find(b=>b.id===x.batchId);
if(+x.quantity>b.available)return note("Quantité indisponible");
b.available-=+x.quantity;
await put("batches",b);
await put("movements",{id:id(),type:"SORTIE",productId:b.productId,batchId:b.id,quantity:-x.quantity,...x,date:new Date().toISOString()});
await audit("Sortie stock","Stock",x);
note("Sortie enregistrée");
stock()}}
async function sale(){let active=state.products.filter(p=>available(p.id)>0&&isActive(p)),clients=await all("customers"),suppliers=await all("suppliers");
shell(`<h2>Nouvelle vente</h2><div class="sale"><section class="panel"><form id="add" class="row"><label>Produit<select name="productId">${active.map(p=>`<option value="${p.id}">${esc(p.name)} — ${available(p.id)}</option>`).join("")}</select></label>${fields([["quantity","Quantité","number",1,"1"],["discount","Remise","number",0,"0"]])}<button ${active.length?"":"disabled"}>Ajouter</button></form>${table(["Date","Produit","Forme","Dosage","Provenance","Destination","N° lot","Expiration","Stock physique","Stock théorique","Vente caisse","Prix unitaire","Prix total"],saleRows("Vente comptoir",suppliers))}</section><aside class="panel"><h3>Encaissement</h3><p class="total">${fmt(total())}</p><form id="pay"><label>Client (facultatif)<select name="customer"><option value="">Vente comptoir</option>${clients.map(c=>`<option value="${c.id}">${esc(c.name)}${c.phone?` · ${esc(c.phone)}`:""}</option>`).join("")}</select></label><label>Paiement<select name="method"><option>ESPÈCES</option><option>CARTE</option><option>MOBILE MONEY</option><option>VIREMENT</option><option>AUTRE</option></select></label><label>Montant payé<input required min="0" type="number" name="paid" value="${total()}"></label><button ${state.cart.length?"":"disabled"}>Encaisser</button></form></aside></div>`);
$("#add").onsubmit=e=>{e.preventDefault();
let x=Object.fromEntries(new FormData(e.target)),p=state.products.find(p=>p.id===x.productId),q=+x.quantity;
if(!p||q<1)return note("Produit ou quantité invalide");
if(q>available(p.id)-(state.cart.find(i=>i.productId===p.id)?.quantity||0))return note("Stock insuffisant");
let i=state.cart.find(i=>i.productId===p.id);
if(i)i.quantity+=q;
else state.cart.push({productId:p.id,name:p.name,form:p.form,dosage:p.dosage,quantity:q,price:+p.salePrice,discount:+x.discount});
sale()};
$("#pay").onsubmit=async e=>{e.preventDefault();
let v=Object.fromEntries(new FormData(e.target));
if(+v.paid<total()&&v.method==="ESPÈCES")return note("Paiement insuffisant");
for(let i of state.cart){let remaining=i.quantity,cost=0,lots=state.batches.filter(b=>b.productId===i.productId&&b.available>0&&b.expiry>=day()).sort((a,b)=>a.expiry.localeCompare(b.expiry));
for(let b of lots){let q=Math.min(remaining,b.available);
cost+=q*(+b.buyPrice||0);
b.available-=q;
remaining-=q;
await put("batches",b);
await put("movements",{id:id(),type:"VENTE",productId:b.productId,batchId:b.id,quantity:-q,date:new Date().toISOString()});
if(!remaining)break}i.cost=cost}let s={id:id(),ticket:`T-${Date.now()}`,items:state.cart,total:total(),paid:+v.paid,change:+v.paid-total(),method:v.method,customerId:v.customer||null,user:state.pharmacy.admin,status:"COMPLETED",date:new Date().toISOString()};
await put("sales",s);
await audit("Vente","Ventes",{ticket:s.ticket});
state.cart=[];
note(`Vente réussie · Ticket ${s.ticket}`);
await refresh();
sale()}}
function total(){return state.cart.reduce((s,i)=>s+i.quantity*i.price-i.discount,0)}function table(head,rows){return `<section class="panel"><table><thead><tr>${head.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(x=>`<td>${x}</td>`).join("")}</tr>`).join(""):`<tr><td colspan="${head.length}" class="empty">Aucune donnée.</td></tr>`}</tbody></table></section>`}
async function entity(page,store,title,schema){let data=await all(store);
let cols=schema.slice(0,5);
let body=table(cols.map(x=>x[1]),data.map(x=>cols.map(f=>esc(x[f[0]]||"—"))));
shell(`<div class="panel-head"><h2>${title}</h2><button id="new">Ajouter</button></div><section class="panel" id="form" hidden><form id="f" class="row">${fields(schema)}<button>Enregistrer</button></form></section>${body}`);
$("#new").onclick=()=>$("#form").hidden=false;
$("#f").onsubmit=async e=>{e.preventDefault();
let x={id:id(),...Object.fromEntries(new FormData(e.target)),createdAt:new Date().toISOString()};
await put(store,x);
await audit("Création",title,x);
note("Enregistré");
entity(page,store,title,schema)}}
async function inventory(){let rows=state.batches.map(b=>[productName(b.productId),b.number,b.available,`<input type="number" min="0" data-b="${b.id}" value="${b.available}">`]);
shell(`<div class="panel-head"><h2>Inventaire</h2><button id="validate">Valider l'inventaire</button></div>${table(["Produit","Lot","Théorique","Quantité réelle"],rows)}`);
$("#validate").onclick=async()=>{for(let e of document.querySelectorAll("[data-b]")){let b=state.batches.find(b=>b.id===e.dataset.b),real=+e.value;
if(real!==b.available){await put("movements",{id:id(),type:"AJUSTEMENT",batchId:b.id,productId:b.productId,quantity:real-b.available,reason:"Inventaire",date:new Date().toISOString()});
b.available=real;
await put("batches",b)}}await put("inventories",{id:id(),date:new Date().toISOString(),user:state.pharmacy.admin});
await audit("Inventaire validé","Inventaire");
note("Inventaire validé");
render()}}
function printTicket(s){let rows=s.items.map(i=>`<tr><td>${esc(i.name)}</td><td>${i.quantity}</td><td>${fmt(i.quantity*i.price-i.discount)}</td></tr>`).join(""),w=window.open("","_blank","width=430,height=650");
if(!w)return note("Autorisez les fenêtres pop-up pour imprimer le ticket");
w.document.write(`<!doctype html><title>Ticket ${s.ticket}</title><style>body{font:14px Arial;
padding:20px}h1{font-size:20px}table{width:100%;
border-collapse:collapse}td,th{padding:7px 0;
border-bottom:1px solid #ddd;
text-align:left}.total{font-weight:bold;
font-size:18px;
margin-top:16px}</style><h1>${esc(state.pharmacy.name)}</h1><p>${esc(state.pharmacy.address||state.pharmacy.city||"")}<br>Ticket : ${s.ticket}<br>${new Date(s.date).toLocaleString("fr-FR")}<br>Caissier : ${esc(s.user||state.pharmacy.admin)}</p><table><tr><th>Article</th><th>Qté</th><th>Total</th></tr>${rows}</table><p class="total">Total : ${fmt(s.total)}</p><p>Paiement : ${esc(s.method)}<br>Payé : ${fmt(s.paid)}<br>Monnaie : ${fmt(s.change)}</p><p>Merci de votre visite.</p><script>print()</script>`);
w.document.close()}
async function reports(){let s=await all("sales"), ca=s.filter(x=>x.status==="COMPLETED").reduce((n,x)=>n+x.total,0);
shell(`<h2>Rapports</h2><div class="grid"><div class="card"><p>Ventes</p><strong>${s.length}</strong></div><div class="card"><p>Chiffre d'affaires</p><strong>${fmt(ca)}</strong></div><div class="card"><p>Valeur du stock</p><strong>${fmt(state.batches.reduce((a,b)=>a+b.available*b.buyPrice,0))}</strong></div></div>${table(["Ticket","Date","Paiement","Total","Statut","Ticket"],s.map(x=>[x.ticket,new Date(x.date).toLocaleString("fr-FR"),x.method,fmt(x.total),x.status,`<button class="secondary ticket" data-id="${x.id}">Imprimer</button>`]))}`);
document.querySelectorAll(".ticket").forEach(b=>b.onclick=()=>printTicket(s.find(x=>x.id===b.dataset.id)))}
async function cash(){let sessions=await all("cash"),openSession=sessions.find(x=>x.status==="OPEN"),sales=await all("sales"),period=openSession?sales.filter(s=>s.date>=openSession.openedAt&&s.status==="COMPLETED"):[],byMethod=period.reduce((a,s)=>(a[s.method]=(a[s.method]||0)+s.total,a),{}),expected=(+openSession?.opening||0)+(+byMethod["ESPÈCES"]||0);
shell(`<div class="panel-head"><h2>Caisse</h2><span class="badge ${openSession?"":"warning"}">${openSession?"OUVERTE":"FERMÉE"}</span></div>${openSession?`<section class="panel"><h3>Session en cours</h3><div class="grid"><div class="card"><p>Fond initial</p><strong>${fmt(openSession.opening)}</strong></div><div class="card"><p>Espèces encaissées</p><strong>${fmt(byMethod["ESPÈCES"]||0)}</strong></div><div class="card"><p>Montant théorique</p><strong>${fmt(expected)}</strong></div></div><form id="close" class="row"><label>Montant réellement compté<input required type="number" min="0" name="counted" value="${expected}"></label><label>Commentaire<input name="comment"></label><button>Clôturer la caisse</button></form></section>`:`<section class="panel"><h3>Ouvrir une caisse</h3><form id="open" class="row"><label>Nom/numéro de caisse<input required name="register" value="CAISSE-1"></label><label>Fond de caisse initial<input required type="number" min="0" name="opening" value="0"></label><button>Ouvrir la caisse</button></form></section>`}${table(["Caisse","Ouverture","Clôture","Écart","Statut"],sessions.slice().reverse().map(x=>[esc(x.register),new Date(x.openedAt).toLocaleString("fr-FR"),x.closedAt?new Date(x.closedAt).toLocaleDateString("fr-FR"):"—",x.difference==null?"—":fmt(x.difference),x.status]))}`);
if(openSession){$("#close").onsubmit=async e=>{e.preventDefault();
let v=Object.fromEntries(new FormData(e.target));
openSession.status="CLOSED";
openSession.closedAt=new Date().toISOString();
openSession.counted=+v.counted;
openSession.expected=expected;
openSession.difference=+v.counted-expected;
openSession.comment=v.comment;
await put("cash",openSession);
await audit("Clôture de caisse","Caisse",{difference:openSession.difference});
note("Caisse clôturée");
cash()}}else $("#open").onsubmit=async e=>{e.preventDefault();
let v=Object.fromEntries(new FormData(e.target)),x={id:id(),...v,opening:+v.opening,status:"OPEN",openedAt:new Date().toISOString(),user:state.pharmacy.admin};
await put("cash",x);
await audit("Ouverture de caisse","Caisse",{register:x.register});
note("Caisse ouverte");
cash()}}
function plusMonths(date,months){let d=new Date(date);
d.setMonth(d.getMonth()+months);
return d.toISOString()}async function license(){let licenses=await all("licenses"),current=licenses.sort((a,b)=>b.expiresAt.localeCompare(a.expiresAt))[0],sales=await all("sales"),moves=await all("movements"),start=new Date();
start.setDate(1);
start.setHours(0,0,0,0);
let monthly=sales.filter(s=>s.status==="COMPLETED"&&new Date(s.date)>=start),turnover=monthly.reduce((n,s)=>n+s.total,0),cost=monthly.reduce((n,s)=>n+s.items.reduce((a,i)=>a+(i.cost??(+state.products.find(p=>p.id===i.productId)?.buyPrice||0)*i.quantity),0),0),profit=turnover-cost,fee=Math.max(0,profit*.05),movementCount=moves.filter(m=>new Date(m.date)>=start).length,valid=current&&new Date(current.expiresAt)>=new Date();
shell(`<div class="panel-head"><h2>Licence</h2><span class="badge ${valid?"":"danger"}">${valid?"ACTIVE":"À RENOUVELER"}</span></div><section class="panel"><p>Durée : <strong>3 mois</strong> · Renouvellement : <strong>0800273782</strong> · Redevance : <strong>5 % du bénéfice mensuel</strong>.</p><div class="grid"><div class="card"><p>Mouvements ce mois</p><strong>${movementCount}</strong></div><div class="card"><p>Chiffre d'affaires</p><strong>${fmt(turnover)}</strong></div><div class="card"><p>Coût réel des lots vendus</p><strong>${fmt(cost)}</strong></div><div class="card"><p>Bénéfice / redevance 5 %</p><strong>${fmt(profit)} / ${fmt(fee)}</strong></div></div><p>Licence actuelle : ${current?`du ${new Date(current.startedAt).toLocaleDateString("fr-FR")} au ${new Date(current.expiresAt).toLocaleDateString("fr-FR")}`:"aucune licence activée"}.</p><button id="renew">${valid?"Renouveler pour 3 mois":"Activer la licence pour 3 mois"}</button></section>${table(["Début","Fin","Redevance mensuelle (5 %)","Mouvements","Statut"],licenses.slice().reverse().map(x=>[new Date(x.startedAt).toLocaleDateString("fr-FR"),new Date(x.expiresAt).toLocaleDateString("fr-FR"),fmt(x.monthlyFee),x.movementCount,x.status]))}`);
$("#renew").onclick=async()=>{let startedAt=valid?current.expiresAt:new Date().toISOString(),x={id:id(),startedAt,expiresAt:plusMonths(startedAt,3),monthlyFee:fee,profit,turnover,cost,movementCount,status:"ACTIVE",contact:"0800273782",createdAt:new Date().toISOString()};
await put("licenses",x);
await audit("Activation/Renouvellement licence","Licence",{expiresAt:x.expiresAt,monthlyFee:fee});
note("Licence enregistrée pour 3 mois");
license()}}
async function backup(){let snapshot={};
for(let store of STORES)snapshot[store]=await all(store);
let blob=new Blob([JSON.stringify(snapshot,null,2)],{type:"application/json"}),a=document.createElement("a");
a.href=URL.createObjectURL(blob);
a.download=`pharmastock-sauvegarde-${day()}.json`;
a.click();
URL.revokeObjectURL(a.href)}async function restore(file){try{let data=JSON.parse(await file.text());
if(!data.settings||!Array.isArray(data.settings))throw Error();
if(!confirm("Cette importation remplacera les données locales portant le même identifiant. Continuer ?"))return;
for(let store of STORES)for(let item of(data[store]||[]))await put(store,item);
state.pharmacy=(await all("settings")).find(x=>x.id==="pharmacy");
await refresh();
note("Sauvegarde importée");
render()}catch{note("Fichier de sauvegarde invalide")}}
async function render(){if(!state.pharmacy)return setup();if(!state.currentUser)return login();
await refresh();
let p=state.page;
if(p==="products")return products();
if(p==="batches")return batches();
if(p==="stock")return stock();
if(p==="sale")return sale();
if(p==="cash")return cash();
if(p==="license")return license();
if(p==="inventory")return inventory();
if(p==="reports")return reports();
if(p==="categories")return entity(p,"categories","Catégories",[["name","Nom","text",1],["description","Description","text"],["status","Statut","text",1,"ACTIVE"]]);
if(p==="suppliers")return entity(p,"suppliers","Fournisseurs",[["name","Nom","text",1],["contact","Contact","text"],["phone","Téléphone","tel"],["email","E-mail","email"],["address","Adresse","text"],["tax","N° fiscal","text"],["status","Statut","text",1,"ACTIVE"]]);
if(p==="customers")return entity(p,"customers","Clients",[["name","Nom","text",1],["phone","Téléphone","tel"],["email","E-mail","email"],["address","Adresse","text"],["notes","Notes","text"]]);
if(p==="patients")return entity(p,"patients","Fiches patients",[["name","Nom complet","text",1],["birthDate","Date de naissance","date"],["phone","Téléphone","tel"],["address","Adresse","text"],["allergies","Allergies","text"],["conditions","Antécédents / maladies","text"],["notes","Notes de consultation","text"]]);
if(p==="users")return entity(p,"users","Utilisateurs",[["firstName","Prénom","text",1],["lastName","Nom","text",1],["email","E-mail","email",1],["phone","Téléphone","tel"],["username","Nom utilisateur","text",1],["role","Rôle","text",1,"CAISSIER"],["active","Statut","text",1,"ACTIVE"]]);
if(p==="notifications"){let n=await all("notifications");
shell(`<div class="panel-head"><h2>Notifications</h2><span class="badge">${n.filter(x=>x.status==="UNREAD").length} non lue(s)</span></div>${table(["Niveau","Titre","Message","Date","Statut","Action"],n.slice().reverse().map(x=>[`<span class="badge ${x.level==="URGENT"?"danger":x.level==="ATTENTION"?"warning":""}">${x.level}</span>`,esc(x.title),esc(x.message),new Date(x.createdAt).toLocaleString("fr-FR"),x.status,x.status==="UNREAD"?`<button class="secondary read" data-id="${x.id}">Marquer lue</button>`:"—"]))}`);
document.querySelectorAll(".read").forEach(b=>b.onclick=async()=>{let x=n.find(x=>x.id===b.dataset.id);
x.status="READ";
await put("notifications",x);
render()});
return}if(p==="audit"){let x=await all("audit");
shell(`<h2>Journal d'activité</h2>${table(["Date","Utilisateur","Action","Module"],x.slice().reverse().map(a=>[new Date(a.date).toLocaleString("fr-FR"),a.user,a.action,a.module]))}`);
return}if(p==="settings"){shell(`<div class="panel-head"><h2>Paramètres de la pharmacie</h2><button id="backup">Télécharger une sauvegarde</button></div><section class="panel"><form id="company" class="row">${fields([["name","Nom de l'entreprise","text",1,state.pharmacy.name||""],["phone","Téléphone","tel",0,state.pharmacy.phone||""],["email","E-mail","email",0,state.pharmacy.email||""],["address","Adresse","text",0,state.pharmacy.address||""],["city","Ville","text",0,state.pharmacy.city||""],["country","Pays","text",0,state.pharmacy.country||""],["currency","Devise","text",1,state.pharmacy.currency||"XOF"]])}<button>Enregistrer les informations</button></form><button id="theme-toggle" class="secondary">${document.body.dataset.theme==="dark"?"Activer le thème clair":"Activer le thème sombre"}</button><p>Une sauvegarde JSON protège les données locales de cet appareil.</p><label>Importer une sauvegarde<input id="restore" type="file" accept="application/json"></label></section>`);
$("#company").onsubmit=async e=>{e.preventDefault();Object.assign(state.pharmacy,Object.fromEntries(new FormData(e.target)));await put("settings",state.pharmacy);note("Informations enregistrées");render()};$("#theme-toggle").onclick=()=>{let theme=document.body.dataset.theme==="dark"?"light":"dark";document.body.dataset.theme=theme;localStorage.setItem("pharmastock-theme",theme);render()};
$("#backup").onclick=backup;
$("#restore").onchange=e=>e.target.files[0]&&restore(e.target.files[0]);
return}dashboard()}init();