(function(){
"use strict";
const APP_VERSION='20261027183746';
let registration=null,checking=false;
function safe(){return !document.querySelector('dialog[open]')&&!Array.from(document.querySelectorAll('input:not([type="hidden"]),textarea')).some(el=>el.value)&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);}
async function checkAppUpdate(){
if(APP_VERSION==='__BUILD__'||checking||document.hidden)return;
checking=true;
try{const r=await fetch('./version.txt?t='+Date.now(),{cache:'no-store'});if(!r.ok)return;const v=(await r.text()).trim();if(v&&v!==APP_VERSION&&/^\d{14}$/.test(v)){await registration?.update();if(safe()){const next=new URL(location.href);next.searchParams.set('v',v);location.replace(next.href);}}}catch{}finally{checking=false;}}
window.addEventListener('load',async()=>{if('serviceWorker'in navigator&&(location.protocol==='https:'||/^(localhost|127\.0\.0\.1)$/.test(location.hostname))){try{registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});await registration.update();}catch{}}setTimeout(checkAppUpdate,3000);});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkAppUpdate();});
})();

