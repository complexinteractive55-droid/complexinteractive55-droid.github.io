(async function complexSkeletonApp() {
"use strict";
const $=s=>document.querySelector(s);
const icons={
home:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
school:'<path d="m3 10 9-7 9 7v11H3Z"/><path d="M9 21v-6h6v6M8 11h.01M16 11h.01M12 8h.01"/>',
book:'<path d="M12 7v14M3 3h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5v17h-5a4 4 0 0 0-4 1 4 4 0 0 0-4-1H3Z"/>',
message:'<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9H13a8.5 8.5 0 0 1 8 8Z"/><path d="M8 11h8M8 15h5"/>',
wallet:'<rect x="3" y="5" width="18" height="15" rx="2"/><path d="m3 7 15-4v2M16 11h5v5h-5z"/>',
settings:'<path d="m9 3-1 3-3 1-2 3 2 3-1 3 3 2 3-1 3 2 3-2 3-1v-4l2-3-2-3-3-1-1-3Z"/><circle cx="12" cy="11" r="3"/>',
help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.4 1.6c-1.1.7-1.9 1.2-1.9 2.9M12 17h.01"/>',
info:'<circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/>',
plus:'<path d="M12 5v14M5 12h14"/>',
close:'<path d="m6 6 12 12M6 18 18 6"/>',
search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
shield:'<path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
edit:'<path d="m16 3 5 5-12 12-6 1 1-6ZM14 5l5 5"/>',
trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
save:'<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z"/><path d="M7 3v6h10V3M7 21v-8h10v8"/>',
menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
check:'<path d="m5 12 4 4L19 6"/>',
download:'<path d="M12 3v12m-5-5 5 5 5-5M5 15v6h14v-6"/>',
heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
folder:'<path d="M3 7V4h6l3 3h9v13H3Z"/>'
};
const icon=n=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[n]||icons.folder}</svg>`;
function hydrate(){document.querySelectorAll("[data-icon]").forEach(el=>el.innerHTML=icon(el.dataset.icon));}
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const roles=[
{id:"admin",label:"Administración",icon:"shield",description:"Configura el colegio, su estructura, las cuentas y las reglas de trabajo."},
{id:"profesor",label:"Docente",icon:"book",description:"Gestiona sus clases, registra notas y asistencia, y prepara actividades."},
{id:"acudiente",label:"Padre / acudiente",icon:"heart",description:"Consulta la información escolar y acompaña a sus hijos."},
{id:"estudiante",label:"Estudiante",icon:"users",description:"Consulta sus materias, tareas, notas, horario y comunicaciones."},
{id:"enfermeria",label:"Enfermería",icon:"heart",description:"Atiende la información de salud y los permisos de salida autorizados."},
{id:"director_seccion",label:"Director de sección",icon:"school",description:"Acompaña los grados y cursos asignados a su sección."}
];
const nav=[["inicio","home","Tablero"],["cuentas","users","Cuentas"],["estructura","school","Estructura del colegio"],["academia","book","Academia"],["comunicacion","message","Comunicación"],["comunidad","calendar","Comunidad"],["tesoreria","wallet","Tesorería"],["ajustes","settings","Ajustes"]];
const cloud=window.ComplexCloud;
if(!cloud){document.body.innerHTML="<p>No se pudo cargar la conexión. Recarga la aplicación.</p>";return;}
const connection=await cloud.initialize();if(!connection)return;
let accounts=connection.members;
document.querySelector(".workspace strong").textContent=connection.school.nombre;
document.querySelector(".workspace small").textContent="Colegio conectado";
document.querySelector(".profile-label").innerHTML="Mi cuenta<small>"+esc(connection.user.email)+"</small>";
document.querySelector(".profile-avatar").textContent=(connection.user.email||"C")[0].toUpperCase();
if(connection.schools.filter(Boolean).length>1){const select=document.createElement("select");select.className="school-picker";select.setAttribute("aria-label","Cambiar colegio");select.innerHTML=connection.schools.filter(Boolean).map(x=>'<option value="'+esc(x.id)+'"'+(x.id===connection.school.id?' selected':'')+'>'+esc(x.nombre)+'</option>').join("");document.querySelector(".workspace").append(select);select.onchange=()=>cloud.chooseSchool(select.value);}
const exit=document.createElement("button");exit.className="top-help";exit.textContent="Cerrar sesión";exit.onclick=()=>cloud.signOut();document.querySelector(".topbar-actions").prepend(exit);

let query="",roleFilter="",toastTimer,installPrompt=null,infoConfirm=null;
const roleLabel=id=>roles.find(r=>r.id===id)?.label||id;
const newButton=label=>`<button class="btn primary" data-action="new-account" ${cloud.context.roles.includes("admin")?"":"disabled"}>${icon("plus")}${label||"Añadir cuenta"}</button>`;
const heading=(eyebrow,title,description,actions="")=>`<section class="page-heading"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${description}</p></div>${actions?`<div class="heading-actions">${actions}</div>`:""}</section>`;
const metric=(label,value,note,i)=>`<article class="metric"><div><div class="metric-label">${label}</div><div class="metric-value">${value}</div><small>${note}</small></div><span class="metric-icon">${icon(i)}</span></article>`;
const note=(title,text)=>`<aside class="ready-note"><span>${icon("shield")}</span><div><strong>${title}</strong><p>${text}</p></div></aside>`;
function toast(message){clearTimeout(toastTimer);$("#toast").textContent=message;$("#toast").hidden=false;toastTimer=setTimeout(()=>$("#toast").hidden=true,3600);}

function menu(open){$("#sidebar").classList.toggle("open",open);$("#menu-backdrop").hidden=!open;$("#menu-button").setAttribute("aria-expanded",String(open));}
function accountRows(){
const normalize=s=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase(),q=normalize(query.trim());
const visible=accounts.filter(a=>(!roleFilter||a.role===roleFilter)&&(!q||normalize(`${a.firstName} ${a.lastName} ${a.email}`).includes(q)));
const body=$("#account-rows");if(!body)return;
body.innerHTML=visible.length?visible.map(a=>`<tr><td><div class="person"><span class="person-avatar">${esc((a.firstName[0]||"")+(a.lastName[0]||""))}</span><span><span class="person-name">${esc((a.firstName+" "+a.lastName).trim()||a.email)}</span><small>${esc(a.email)}</small></span></div></td><td>${esc(roleLabel(a.role))}</td><td><span class="badge ${a.active?"active-badge":""}">${a.active?"Activa":"Inactiva"}</span></td><td><button class="icon-button" data-person="${esc(a.id)}" aria-label="Ver cuenta de ${esc(a.firstName||a.email)}">${icon("info")}</button></td></tr>`).join(""):`<tr><td class="empty-cell" colspan="4"><div class="empty"><div class="empty-icon">${icon(q||roleFilter?"search":"users")}</div><h3>${q||roleFilter?"No encontramos coincidencias":"Aquí empieza tu comunidad"}</h3><p>${q||roleFilter?"Prueba con otro nombre, correo o rol.":"Añade las cuentas de docentes, estudiantes y familias.<br>Sus accesos quedarán guardados en el colegio."}</p>${q||roleFilter?'<button class="btn secondary" data-action="clear-filters">Limpiar filtros</button>':newButton("Añadir primera cuenta")}</div></td></tr>`;
$("#accounts-count").textContent=`${visible.length} de ${accounts.length} accesos por rol`;
}
function accountsView(tab){
if(!cloud.context.roles.includes("admin"))return heading("TU COLEGIO","Cuentas","La gestión de cuentas está reservada a Administración.")+note("Tu acceso está conectado","Puedes entrar a los espacios correspondientes a tu rol. Pide a Administración que añada o actualice las cuentas del colegio.");
const tabs=[["usuarios","users","Cuentas"],["roles","shield","Roles y permisos"],["invitaciones","mail","Invitaciones"]];
let inner;
if(tab==="roles")inner=`<p class="section-intro">Los perfiles del colegio organizan el acceso a la información.</p><div class="roles-grid">${roles.map(r=>`<article class="role-card">${icon(r.icon)}<h3>${esc(r.label)}</h3><p>${esc(r.description)}</p><span>${accounts.filter(a=>a.role===r.id).length} accesos asignados</span></article>`).join("")}</div>`;
else if(tab==="invitaciones")inner=`<div class="empty"><div class="empty-icon">${icon("mail")}</div><h3>Las invitaciones por correo llegarán después</h3><p>Ya puedes crear cuentas y entregar sus credenciales.<br>El envío de invitaciones todavía no está habilitado.</p>${newButton("Crear una cuenta")}</div>`;
else inner=`<div class="toolbar"><label class="search">${icon("search")}<input id="account-search" type="search" aria-label="Buscar cuentas por nombre o correo" placeholder="Buscar por nombre o correo…" value="${esc(query)}"></label><label class="filter">Filtrar por rol<select id="role-filter" aria-label="Filtrar cuentas por rol"><option value="">Todos los roles</option>${roles.map(r=>`<option value="${r.id}"${roleFilter===r.id?" selected":""}>${esc(r.label)}</option>`).join("")}</select></label></div><div class="table-scroll"><table class="accounts-table"><thead><tr><th>PERSONA</th><th>ROL</th><th>ESTADO</th><th>DETALLES</th></tr></thead><tbody id="account-rows"></tbody></table></div><div class="table-footer"><span id="accounts-count"></span><span>Datos del colegio · Guardados en la nube</span></div>`;
return heading("ADMINISTRACIÓN DE TU COMUNIDAD","Cuentas","Añade las cuentas y organiza los accesos de tu colegio.",newButton())+`<section class="metric-grid">${metric("Accesos activos",accounts.filter(a=>a.active).length,"Vinculados al colegio","users")}${metric("Roles disponibles","6","Un espacio para cada persona","shield")}${metric("Personas",new Set(accounts.map(a=>a.profileId)).size,"Usuarios del colegio","check")}</section>`+`<section class="panel"><div class="tabs" aria-label="Vistas de cuentas">${tabs.map(([id,i,title])=>`<a class="tab ${tab===id?"active":""}" href="#/cuentas?tab=${id}"${tab===id?' aria-current="page"':""}>${icon(i)}${title}${id==="usuarios"?`<span class="count-pill">${accounts.length}</span>`:""}</a>`).join("")}</div>${inner}</section>`+note("Conectado a tu colegio","Las cuentas se guardan en el nuevo Supabase de Complex_. Solo Administración puede crearlas y cada rol recibe el acceso que le corresponde.");
}
const moduleData={
estructura:{title:"Estructura del colegio",description:"Prepara las piezas que darán forma a tu institución.",items:[["Sedes","Los lugares donde aprende tu comunidad.","school"],["Años y periodos","Los ciclos y fechas de tu calendario académico.","calendar"],["Grados y cursos","La organización de los grupos de estudiantes.","users"],["Materias","Las áreas y asignaturas del colegio.","book"],["Asignaciones docentes","La relación entre cursos, materias y profesores.","shield"],["Matrículas","El espacio para vincular estudiantes a sus cursos.","folder"]]},
academia:{title:"Academia",description:"Todo lo académico tendrá su lugar, de la planeación al boletín.",items:[["Clases y actividades","Criterios, experiencias, tareas y exámenes por grupo.","book"],["Notas y boletines","Planillas, recuperaciones y resultados por periodo.","folder"],["Asistencia","Registro por clase, tipos y justificaciones.","check"],["Planeaciones","Archivos y revisión de los planes del docente.","calendar"],["Seguimientos y compromisos","Acompañamiento y acuerdos con cada estudiante.","heart"],["Horarios","La distribución de las clases durante la semana.","clock"]]},
comunicacion:{title:"Comunicación",description:"Un espacio para mantener a tu comunidad informada y cerca.",items:[["Bandeja de entrada","Los mensajes de tu comunidad, en un mismo lugar.","mail"],["Circulares","Los comunicados oficiales del colegio.","folder"],["Cartelera","La información que necesita estar a la vista.","message"]]},
comunidad:{title:"Comunidad",description:"Los espacios que conectan la vida diaria del colegio.",items:[["Calendario","Fechas, actividades y eventos de la comunidad.","calendar"],["Procesos y archivos","Formularios, autorizaciones y documentos institucionales.","folder"],["Enfermería y salidas","Atenciones de salud y permisos de salida.","heart"]]},
tesoreria:{title:"Tesorería",description:"El espacio para organizar los cobros y pagos del colegio.",items:[["Conceptos y facturación","Los conceptos de cobro y sus periodos.","folder"],["Cartera","El seguimiento de saldos y obligaciones.","wallet"],["Pagos","El registro de pagos y los estados de cuenta.","check"]]}
};
function moduleView(route){
const data=moduleData[route];
return heading("ESPACIOS DEL COLEGIO",esc(data.title),esc(data.description))+
`<section class="module-grid">${data.items.map(([title,description,i])=>`<article class="module-card"><span class="metric-icon">${icon(i)}</span><h3>${esc(title)}</h3><p>${esc(description)}</p>${title==="Circulares"?'<a class="btn secondary" href="#/circulares">Abrir Circulares</a>':`<button class="btn secondary" data-module="${esc(title)}">Ver espacio ${icon("arrow")}</button>`}</article>`).join("")}</section>`+
note("Una estructura lista para completar","Estas secciones muestran la estructura inicial. La gestión de cuentas ya está conectada; los formularios de los demás módulos se completarán después.");
}
function dashboard(){
return heading("TU ESPACIO DE TRABAJO","Bienvenido a Complex_","El punto de partida para organizar la vida de tu colegio.")+
`<section class="welcome-banner"><span class="eyebrow">CADA COMUNIDAD TIENE UN COMIENZO</span><h2>Tu colegio está listo<br>para tomar forma.</h2><p>Organiza su estructura, prepara las cuentas y deja cada espacio listo para las personas que lo harán posible.</p><a class="btn primary" href="#/cuentas">${icon("users")}Añadir cuentas</a></section>`+
`<section class="metric-grid">${metric("Estudiantes",cloud.context.students??"—","Miembros activos del colegio","users")}${metric("Cursos",cloud.context.courses??"—","Cursos del colegio","book")}${metric("Accesos del colegio",accounts.length,"Guardados en la nube","users")}</section>`+
`<section class="panel"><div class="section-intro"><h2>Primeros pasos</h2></div><div class="setup-list">${[["estructura","Define la estructura","Sedes, grados, cursos y periodos."],["cuentas","Añade las cuentas","Administración, docentes, estudiantes y familias."],["academia","Organiza lo académico","Materias, actividades, horarios y planeaciones."]].map(([route,title,text],i)=>`<div class="setup-row"><span class="step-num">0${i+1}</span><div><h3>${title}</h3><p>${text}</p></div><a class="outline-link" href="#/${route}">Explorar ${icon("arrow")}</a></div>`).join("")}</div></section>`;
}
function settings(){
return heading("PREFERENCIAS DE TU ESPACIO","Ajustes","El acceso al colegio ya está conectado; las demás preferencias se completarán después.")+
`<section class="panel"><div class="settings-row"><div><h3>Mi contraseña</h3><p>Actualiza la contraseña de tu cuenta.</p></div><button class="btn secondary" data-action="change-password">Cambiar contraseña</button></div>${[["Identidad del colegio","Nombre, escudo y color institucional.","Por configurar"],["Acceso de las cuentas","Inicio de sesión y creación de usuarios del colegio.","Conectado"],["Avisos e invitaciones","Correo y notificaciones para tu comunidad.","Pendiente"],["Idioma","Español de Colombia.","Español"]].map(([title,text,status])=>`<div class="settings-row"><div><h3>${title}</h3><p>${text}</p></div><span class="badge">${status}</span></div>`).join("")}<div class="settings-row"><div><h3>Complex_ en tu dispositivo</h3><p>Instala esta versión cuando la abras desde una dirección compatible.</p></div><button class="btn secondary" data-action="install">${icon("download")}Instalar</button></div></section>`+
note("Vista de preparación","La app se conecta al nuevo Supabase. Los módulos académicos y las preferencias avanzadas conservan su espacio para la siguiente etapa.");
}
function render(){
window.ComplexCirculares?.cleanup();
const [raw,params]=location.hash.replace(/^#\/?/,"").split("?");
const route=raw||"cuentas";
const section=route==="circulares"?"comunicacion":route;
const title=route==="circulares"?"Circulares":nav.find(n=>n[0]===route)?.[2]||"Página no encontrada";
document.title=`${title} · Complex_`;
$("#breadcrumb-current").textContent=title;
$("#nav").innerHTML=nav.map(([id,i,label])=>`<a href="#/${id}" class="${section===id?"active":""}"${section===id?' aria-current="page"':""}>${icon(i)}${label}</a>`).join("");
let html;
if(route==="cuentas"){const t=new URLSearchParams(params||"").get("tab");const tab=["roles","invitaciones"].includes(t)?t:"usuarios";html=accountsView(tab);}
else if(route==="circulares")html='<div id="circulares-root"><p role="status">Cargando Circulares…</p></div>';
else if(route==="inicio")html=dashboard();
else if(route==="ajustes")html=settings();
else if(moduleData[route])html=moduleView(route);
else html=heading("COMPLEX_","Este espacio no existe","Puedes volver al tablero para continuar.",'<a class="btn primary" href="#/inicio">Ir al tablero</a>');
$("#contenido").innerHTML=html;
if(route==="circulares")window.ComplexCirculares?.mount($("#circulares-root"),cloud).catch(e=>{$("#circulares-root").textContent=e.message;});
accountRows();
$("#account-search")?.addEventListener("input",e=>{query=e.target.value;accountRows();});
$("#role-filter")?.addEventListener("change",e=>{roleFilter=e.target.value;accountRows();});
menu(false);
}
function openAccount(){
if(!cloud.context.roles.includes("admin")){toast("Solo Administración puede añadir cuentas.");return;}
$("#account-form").reset();$("#account-id").value="";$("#first-name").value="";$("#last-name").value="";$("#account-email").value="";$("#account-role").value="estudiante";$("#account-title").textContent="Añadir cuenta";$("#role-hint").textContent=roles.find(r=>r.id===$("#account-role").value)?.description||"";$("#form-error").hidden=true;$("#account-dialog").showModal();$("#first-name").focus();
}
function showInfo(title,body,confirm=null){
infoConfirm=null;$("#info-title").textContent=title;$("#info-body").innerHTML=body;
$("#info-actions").innerHTML=false?'<button class="btn secondary" data-action="close-info">Cancelar</button><button class="btn danger" data-action="confirm-delete">Eliminar borrador</button>':'<button class="btn primary" data-action="close-info">Entendido</button>';
$("#info-dialog").showModal();
}
async function install(){return cloud.install();}
$("#account-role").innerHTML=roles.map(r=>`<option value="${r.id}">${esc(r.label)}</option>`).join("");
$("#account-role").addEventListener("change",()=>$("#role-hint").textContent=roles.find(r=>r.id===$("#account-role").value)?.description||"");

$("#account-form").addEventListener("submit",async e=>{
e.preventDefault();const form=e.currentTarget;if(!form.reportValidity())return;const data=new FormData(form),button=form.querySelector('[type="submit"]');
const firstName=String(data.get("firstName")||"").trim(),lastName=String(data.get("lastName")||"").trim(),email=String(data.get("email")||"").trim().toLowerCase(),role=String(data.get("role")||"");let error="";
if(!firstName||!lastName)error="Escribe los nombres y apellidos.";else if(!roles.some(r=>r.id===role))error="Selecciona un rol válido.";
if(error){$("#form-error").textContent=error;$("#form-error").hidden=false;return;}
button.disabled=true;$("#form-error").hidden=true;
try{
const result=await cloud.createUser({firstName,lastName,email,role});$("#account-dialog").close();
try{await cloud.refresh();accounts=cloud.context.members;render();}catch{toast("La cuenta se creó. Recarga para actualizar la lista.");}
showInfo(result.ya_existia?"Acceso añadido":"Cuenta creada",`<p>${result.ya_existia?"La persona ya tenía cuenta y se añadió al colegio. Usará su contraseña actual.":"Entrega estas credenciales a la persona. La contraseña temporal solo se muestra ahora."}</p><div class="credentials"><strong>${esc(firstName+" "+lastName)}</strong><label>Usuario<code>${esc(result.usuario||email)}</code></label>${result.clave?`<label>Contraseña temporal<code>${esc(result.clave)}</code></label>`:""}<small>La persona debe cambiar su contraseña al entrar.</small></div>`);
}catch(err){$("#form-error").textContent=cloud.translate(err);$("#form-error").hidden=false;}
finally{button.disabled=false;}
});

document.addEventListener("click",e=>{
const person=e.target.closest("[data-person]");if(person){const a=accounts.find(x=>x.id===person.dataset.person);if(a)showInfo("Cuenta del colegio","<p><strong>"+esc(a.firstName+" "+a.lastName)+"</strong></p><p>"+esc(a.email)+"</p><p>Rol: "+esc(roleLabel(a.role))+"</p><p>Estado: "+(a.active?"Activa":"Inactiva")+"</p>");return;}
const module=e.target.closest("[data-module]");if(module){showInfo(module.dataset.module,`<p>Este espacio está preparado para la información del colegio.</p><p>Actualmente no hay registros. Su gestión se habilitará al conectar la aplicación con los servicios reales.</p>`);return;}
const action=e.target.closest("[data-action]")?.dataset.action;
if(action==="new-account")openAccount();
if(action==="close-dialog")$("#account-dialog").close();
if(action==="close-info"){$("#info-dialog").close();infoConfirm=null;}

if(action==="clear-filters"){query="";roleFilter="";render();}
if(action==="help")showInfo("Todo listo para empezar",`<p>Esta versión está conectada al nuevo Supabase de Complex_.</p><ol><li>Recorre <strong>Estructura del colegio</strong> para ver sus apartados.</li><li>En <strong>Cuentas</strong>, pulsa Añadir cuenta para crear su acceso real.</li><li>Consulta los seis <strong>Roles y permisos</strong> antes de organizar tu comunidad.</li></ol><p>Las cuentas se guardan en el colegio. Al crearlas, Administración recibe la contraseña temporal para entregarla. Los módulos académicos siguen siendo el esqueleto visual que se completará después.</p>`);
if(action==="install")install();if(action==="change-password")cloud.changePassword();
});
$("#menu-button").addEventListener("click",()=>menu(!$("#sidebar").classList.contains("open")));
$("#menu-backdrop").addEventListener("click",()=>menu(false));
document.addEventListener("keydown",e=>{if(e.key==="Escape")menu(false);});
window.addEventListener("hashchange",render);
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;});
window.addEventListener("appinstalled",()=>toast("Complex_ se instaló en este dispositivo."));
hydrate();render();

})();
