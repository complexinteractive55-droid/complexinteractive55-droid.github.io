window.COMPLEX_CONFIG={"url":"https://auyfjqprhspncctnufzi.supabase.co","key":"sb_publishable_EVa1hK-iCblROySnmEOFag_7dkPbXLt"};
(function cloudBoot(){
"use strict";
const config=window.COMPLEX_CONFIG;
const sb=window.supabase.createClient(config.url,config.key,{auth:{persistSession:true,autoRefreshToken:true,storageKey:"complex_school_new_auth_v1",detectSessionInUrl:true}});
const recovery=location.hash.includes("type=recovery");
let ctx={user:null,school:null,roles:[],members:[],students:0,courses:0},pendingInstall=null;
const escape=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fail=error=>{if(error)throw Error(error.message||"No se pudo completar la operación.");};
const translate=e=>{const s=e?.message||String(e);if(/Invalid login credentials/i.test(s))return"El correo o la contraseña no son correctos.";if(/Email not confirmed/i.test(s))return"Confirma tu correo antes de entrar.";if(/rate.limit|too many|security purposes/i.test(s))return"Espera un momento antes de volver a intentarlo.";if(/fetch|network|load failed/i.test(s))return"No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.";return s;};
function gate(mode="login",message=""){
document.querySelector(".sidebar").hidden=true;document.querySelector(".workspace-main").hidden=true;
let holder=document.querySelector("#cloud-gate");if(!holder){holder=document.createElement("section");holder.id="cloud-gate";document.body.append(holder);}
holder.innerHTML=`<div class="auth-brand"><img src="logo-complex.svg" alt="Complex_"><span>GESTIÓN ESCOLAR</span></div><div class="auth-card"><span class="eyebrow">${mode==="school"?"TU COMUNIDAD EMPIEZA AQUÍ":"BIENVENIDO A TU COLEGIO"}</span><h1>${mode==="register"?"Crea tu cuenta":mode==="school"?"Prepara tu colegio":mode==="recovery"?"Nueva contraseña":"Un colegio. Una comunidad."}</h1><p>${mode==="register"?"Esta es tu cuenta personal. Después podrás crear el colegio y añadir a tu comunidad.":mode==="school"?"Tu cuenta ya está conectada. Da nombre al colegio para comenzar.":mode==="recovery"?"Elige la contraseña con la que entrarás a Complex_.":"Entra para acceder a los espacios de tu comunidad escolar."}</p>${message?`<div class="auth-message" role="status">${escape(message)}</div>`:""}<form id="cloud-auth-form">
${mode==="register"?'<div class="form-grid"><label>Nombres<input name="firstName" autocomplete="given-name" required maxlength="80"></label><label>Apellidos<input name="lastName" autocomplete="family-name" required maxlength="80"></label></div>':""}
${mode==="school"?'<label>Nombre del colegio<input name="school" required maxlength="150" placeholder="Nombre de tu institución"></label><label>Ciudad<input name="city" maxlength="100" autocomplete="address-level2"></label>':mode==="recovery"?'<label>Nueva contraseña<input name="password" type="password" autocomplete="new-password" minlength="8" required></label>':`<label>Correo o número de documento<input name="email" type="${mode==="register"?"email":"text"}" autocomplete="username" required placeholder="${mode==="register"?"tu@correo.com":"Correo o documento"}"></label><label>Contraseña<input name="password" type="password" autocomplete="${mode==="register"?"new-password":"current-password"}" minlength="${mode==="register"?"8":"1"}" required></label>`}
<p class="form-error" id="cloud-auth-error" role="alert" hidden></p><button class="btn primary auth-submit" type="submit">${mode==="register"?"Crear mi cuenta":mode==="school"?"Crear colegio":mode==="recovery"?"Guardar contraseña":"Entrar"}</button></form><div class="auth-links">${mode==="login"?'<button data-gate="register">Crear una cuenta</button><button id="forgot-password">Olvidé mi contraseña</button>':mode==="register"?'<button data-gate="login">Ya tengo cuenta · Entrar</button>':mode==="school"?'<button id="gate-signout">Salir de esta cuenta</button>':""}</div></div><div class="auth-install"><button id="gate-install" class="btn secondary">Instalar Complex_</button><small>Tu colegio también puede acompañarte en el celular.</small></div>`;
holder.querySelectorAll("[data-gate]").forEach(b=>b.onclick=()=>gate(b.dataset.gate));
holder.querySelector("#gate-install").onclick=()=>install();
holder.querySelector("#gate-signout")?.addEventListener("click",async()=>{await sb.auth.signOut({scope:"local"});location.reload();});
holder.querySelector("#forgot-password")?.addEventListener("click",async()=>{
const email=String(holder.querySelector('[name="email"]').value).trim();const error=holder.querySelector("#cloud-auth-error");
if(!email.includes("@")){error.textContent="Escribe tu correo y después pulsa «Olvidé mi contraseña».";error.hidden=false;return;}
const {error:err}=await sb.auth.resetPasswordForEmail(email,{redirectTo:new URL("./",location.href).href});error.textContent=err?translate(err):"Si el correo está registrado, recibirás un enlace para recuperar el acceso.";error.hidden=false;
});
holder.querySelector("#cloud-auth-form").onsubmit=async event=>{
event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;
const values=new FormData(form),button=form.querySelector('[type="submit"]'),error=holder.querySelector("#cloud-auth-error");button.disabled=true;error.hidden=true;
try{
if(mode==="school"){const name=String(values.get("school")||"").trim();if(!name)throw Error("Escribe el nombre del colegio.");const {error:err}=await sb.rpc("crear_colegio",{p_nombre:name,p_ciudad:String(values.get("city")||"").trim()||null});fail(err);location.reload();return;}
if(mode==="recovery"){const {error:err}=await sb.auth.updateUser({password:String(values.get("password"))});fail(err);location.hash="#/cuentas";location.reload();return;}
let email=String(values.get("email")||"").trim().toLowerCase();if(!email.includes("@"))email=email.replace(/[^a-z0-9]/g,"")+"@usuarios.complex";
if(mode==="register"){
const firstName=String(values.get("firstName")||"").trim(),lastName=String(values.get("lastName")||"").trim();if(!firstName||!lastName)throw Error("Escribe tus nombres y apellidos.");
const {data,error:err}=await sb.auth.signUp({email,password:String(values.get("password")),options:{data:{nombres:firstName,apellidos:lastName},emailRedirectTo:new URL("./",location.href).href}});fail(err);
if(data.session)location.reload();else gate("login","Revisa tu correo y confirma tu cuenta. Después vuelve a esta pantalla para entrar.");return;
}
const {error:err}=await sb.auth.signInWithPassword({email,password:String(values.get("password"))});fail(err);location.reload();
}catch(e){error.textContent=translate(e);error.hidden=false;button.disabled=false;}
};
}
async function refresh(){
if(!ctx.school)return;
if(ctx.roles.includes("admin")){const {data,error}=await sb.rpc("personas_colegio",{p_colegio:ctx.school.id});fail(error);ctx.members=(data||[]).map(r=>({id:r.perfil_id+"|"+r.rol,profileId:r.perfil_id,firstName:r.nombres||"",lastName:r.apellidos||"",email:r.correo||"",role:r.rol,active:r.activo}));}
else ctx.members=[];
const [s,c]=await Promise.all([sb.from("miembros").select("perfil_id",{count:"exact",head:true}).eq("colegio_id",ctx.school.id).eq("rol","estudiante").eq("activo",true),sb.from("cursos").select("id",{count:"exact",head:true}).eq("colegio_id",ctx.school.id)]);
ctx.students=s.error?null:s.count;ctx.courses=c.error?null:c.count;
return ctx;
}
async function initialize(){
try{
const {data:session,error:sessionError}=await sb.auth.getSession();fail(sessionError);
if(!session.session){gate();return false;}
const {data:auth,error:authError}=await sb.auth.getUser();fail(authError);ctx.user=auth.user;
if(recovery){gate("recovery");return false;}
const {data:members,error:memberError}=await sb.from("miembros").select("colegio_id,rol,activo").eq("perfil_id",ctx.user.id).eq("activo",true);fail(memberError);
if(!members?.length){gate("school");return false;}
let chosen;try{chosen=localStorage.getItem("complex_selected_school_v1");}catch{}
const schoolId=members.some(m=>m.colegio_id===chosen)?chosen:members[0].colegio_id;
ctx.roles=members.filter(m=>m.colegio_id===schoolId).map(m=>m.rol);
const {data:school,error:schoolError}=await sb.from("colegios").select("id,nombre").eq("id",schoolId).single();fail(schoolError);ctx.school=school;
ctx.schools=await Promise.all([...new Set(members.map(m=>m.colegio_id))].map(async id=>{const {data}=await sb.from("colegios").select("id,nombre").eq("id",id).single();return data;}));
await refresh();document.body.dataset.connected="true";return ctx;
}catch(e){gate("login","No pudimos cargar el acceso: "+translate(e));return false;}
}
async function createUser(person){
if(!ctx.roles.includes("admin"))throw Error("Solo Administración puede añadir cuentas.");
const {data,error}=await sb.functions.invoke("admin-usuarios",{body:{accion:"crear",colegio_id:ctx.school.id,personas:[{nombres:person.firstName,apellidos:person.lastName,correo:person.email,rol:person.role}]}});
if(error){let message=error.message;try{message=(await error.context.json()).error||message;}catch{}throw Error(message);}
if(data?.error)throw Error(data.error);
const result=data?.resultados?.[0];if(!result?.ok)throw Error(result?.error||"No se pudo crear la cuenta.");return result;
}
async function signOut(){await sb.auth.signOut({scope:"local"});location.reload();}
function chooseSchool(id){if(!ctx.schools?.some(s=>s?.id===id))return;localStorage.setItem("complex_selected_school_v1",id);location.reload();}
async function install(){
if(pendingInstall){const e=pendingInstall;pendingInstall=null;await e.prompt();await e.userChoice;return;}
let d=document.querySelector("#cloud-install-dialog");if(!d){d=document.createElement("dialog");d.id="cloud-install-dialog";d.innerHTML='<h2>Instalar Complex_</h2><p>Android: abre en Chrome → menú ⋮ → Instalar app.</p><p>iPhone: Safari → Compartir → Añadir a inicio.</p><p>Computador: usa la opción de instalar en Chrome o Edge.</p><form method="dialog"><button class="btn primary">Entendido</button></form>';document.body.append(d);}d.showModal();
}
async function changePassword(){
let d=document.querySelector("#cloud-password-dialog");
if(!d){d=document.createElement("dialog");d.id="cloud-password-dialog";d.innerHTML='<h2>Cambiar contraseña</h2><form><label>Nueva contraseña<input name="password" type="password" minlength="8" autocomplete="new-password" required></label><label>Repite la contraseña<input name="confirm" type="password" minlength="8" autocomplete="new-password" required></label><p class="form-error" role="alert" hidden></p><div class="dialog-actions"><button class="btn secondary" type="button">Cancelar</button><button class="btn primary" type="submit">Guardar contraseña</button></div></form>';document.body.append(d);d.querySelector('[type="button"]').onclick=()=>d.close();d.querySelector("form").onsubmit=async e=>{e.preventDefault();if(!e.currentTarget.reportValidity())return;const f=new FormData(e.currentTarget),err=d.querySelector(".form-error"),btn=d.querySelector('[type="submit"]');err.hidden=true;if(f.get("password")!==f.get("confirm")){err.textContent="Las contraseñas no coinciden.";err.hidden=false;return;}btn.disabled=true;try{const {error}=await sb.auth.updateUser({password:String(f.get("password"))});if(error){err.textContent=translate(error);err.hidden=false;}else{e.currentTarget.reset();d.close();}}catch(e){err.textContent=translate(e);err.hidden=false;}finally{btn.disabled=false;}};}d.showModal();
}
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();pendingInstall=e;});
sb.auth.onAuthStateChange((event)=>{if(event==="SIGNED_OUT")setTimeout(()=>{ctx={user:null,school:null,roles:[],members:[],students:0,courses:0};document.querySelectorAll("dialog[open]").forEach(d=>d.close());gate("login");},0);if(event==="PASSWORD_RECOVERY")setTimeout(()=>gate("recovery"),0);});
window.ComplexCloud={initialize,refresh,createUser,signOut,chooseSchool,install,changePassword,get context(){return ctx;},translate};
})();
