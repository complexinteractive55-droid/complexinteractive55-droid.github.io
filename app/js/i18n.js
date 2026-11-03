// Multilingüe (español / inglés). Primera etapa: la interfaz (menús, pestañas, títulos, botones, avisos)
// se traduce al pintar, buscando cada texto en el diccionario es → en. Lo que escriben las personas
// (mensajes, nombres, notas, observaciones) NO se traduce. Lo que se guarda en la base sigue siendo
// la clave en español (estados, roles, categorías): solo cambia lo que se muestra.
// En "Mi cuenta y ajustes → Idioma" (también en el modo demo) se elige Automático, Español o English. Por defecto es
// Automático: el idioma del dispositivo (inglés si el dispositivo está en inglés; español si está en español o en otro
// idioma que la app aún no tiene). Pedido de Fabio, 2-nov-2026.

const CLAVE = 'complex_idioma';
const leer = () => { try { return localStorage.getItem(CLAVE); } catch { return null; } };
// El primero de los idiomas preferidos del dispositivo que la app tiene; si ninguno, español
export function idiomaDispositivo() {
  const lista = (typeof navigator !== 'undefined' && (navigator.languages?.length ? navigator.languages : [navigator.language])) || [];
  for (const l of lista) { const b = String(l || '').toLowerCase().slice(0, 2); if (b === 'es' || b === 'en') return b; }
  return 'es';
}
// Lo que eligió la persona: 'es', 'en' o 'auto' (nada guardado = automático)
export let preferenciaIdioma = ['es', 'en'].includes(leer()) ? leer() : 'auto';
export const idioma = preferenciaIdioma === 'auto' ? idiomaDispositivo() : preferenciaIdioma;
// Los diccionarios (unos 60 KB) se bajan solo si la app se va a ver en inglés
const DIC = { en: idioma === 'en' ? Object.assign({}, ...(await Promise.all(['en1', 'en2', 'en3', 'en4'].map((n) => import(`./i18n/${n}.js`)))).map((m) => m.default)) : {} };
export const enIngles = idioma === 'en';
// Guarda la elección; si cambia el idioma que se ve, recarga para pintar todo de nuevo (devuelve true si recarga)
export function elegirIdioma(l) {
  try { if (l === 'auto') localStorage.removeItem(CLAVE); else localStorage.setItem(CLAVE, l); } catch {}
  preferenciaIdioma = l;
  if ((l === 'auto' ? idiomaDispositivo() : l) === idioma) return false;
  location.reload();
  return true;
}
document.documentElement.lang = idioma;

// "✏️ Redactar" → "✏️ Compose"; "Pendientes (3)" → "Pending (3)"; "Notas:" → "Grades:"
const BORDES = /^([^\p{L}¿¡"(]*)(.*?)(\s*(?:\(\d+\)|\d+)?[\s:…]*)$/u;
export function t(s) {
  if (!enIngles || s == null) return s;
  const d = DIC.en;
  const k = String(s);
  if (d[k]) return d[k];
  const k2 = k.trim();
  if (d[k2]) return k.replace(k2, d[k2]);
  const m = k2.match(BORDES);
  if (m && m[2] && d[m[2]]) return k.replace(k2, m[1] + d[m[2]] + m[3]);
  for (const [re, en] of PATRONES) if (re.test(k2)) return k.replace(k2, k2.replace(re, en));
  return s;
}
// Textos con datos adentro (nombres, números): se traducen por patrón
const PATRONES = [
  [/^Hola, (.+)$/, 'Hi, $1'], [/^Para: (.+)$/, 'To: $1'], [/^Por (\p{Lu}.+)$/u, 'By $1'], [/^Curso (\S+)$/, 'Class $1'],
  [/^(\d+) seleccionado\(s\)$/, '$1 selected'], [/^(\d+) sin leer$/, '$1 unread'], [/^✓ Leído por (\d+) de (\d+)$/, '✓ Read by $1 of $2'], [/^✓✓ Leído por todos$/, '✓✓ Read by everyone'],
  [/^Procesos abiertos · (\d+) respuestas$/, 'Open processes · $1 answers'], [/^(\d+) estudiantes activos$/, '$1 active students'], [/^(\d+) estudiantes$/, '$1 students'],
  [/^(\d+) actividades · (\d+) estudiantes$/, '$1 activities · $2 students'], [/^Ahora: (.+)$/, 'Now: $1'], [/^(.+) · avance de notas en (.+)$/, '$1 · grade progress in $2'],
  [/^Clases · avance de notas en (.+)$/, 'Classes · grade progress in $1'], [/^(\d+) pendiente\(s\)$/, '$1 pending'], [/^Tienes (\d+) mensaje\(s\) sin leer$/, 'You have $1 unread message(s)'],
  [/^Sin tomar hoy$/, 'Not taken today'], [/^(\d+) anotaciones hoy$/, '$1 notes today'], [/^Versión del (.+)$/, 'Version of $1'], [/^Editado (.+)$/, 'Edited $1'],
  [/^Firmado por (.+) el (.+)$/, 'Signed by $1 on $2'], [/^Asistencia ya tomada para el (.+)\. Puedes corregirla\.$/, 'Attendance already taken for $1. You can correct it.'],
  [/^Periodo (\d+)$/, 'Term $1'], [/^P(\d+)$/, 'T$1'], [/^Sexto$/, 'Sixth'], [/^Primero$/, 'First'], [/^Segundo$/, 'Second'], [/^Tercero$/, 'Third'], [/^Cuarto$/, 'Fourth'], [/^Quinto$/, 'Fifth'],
  [/^Envían: (.+)$/, 'Sent by: $1'], [/^Te escribimos a (\S+) cuando te llegue un mensaje o una circular\.$/, 'We email you at $1 when you get a message or a circular.'],
  [/^Octavo$/, 'Eighth'], [/^Noveno$/, 'Ninth'], [/^Once$/, 'Eleventh'],
];

// ---------------------------------------------------------------- Traducir lo que se pinta
const NO = 'SCRIPT,STYLE,TEXTAREA,INPUT,CODE,PRE,[translate="no"],.mensaje-cuerpo,.obs p,[contenteditable]';
const ATRIBUTOS = ['placeholder', 'title', 'aria-label'];
function traducirNodo(raiz) {
  if (!raiz) return;
  if (raiz.nodeType === Node.TEXT_NODE) { const v = t(raiz.data); if (v !== raiz.data && !raiz.parentElement?.closest(NO)) raiz.data = v; return; }
  if (raiz.nodeType !== Node.ELEMENT_NODE || raiz.closest(NO)) return;
  const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) => (n.nodeType === Node.ELEMENT_NODE ? (n.matches(NO) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP) : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = w.nextNode(); n; n = w.nextNode()) { const v = t(n.data); if (v !== n.data) n.data = v; }
  for (const el of [raiz, ...raiz.querySelectorAll('[placeholder],[title],[aria-label]')]) {
    if (el.closest?.(NO) && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') continue;
    for (const a of ATRIBUTOS) { const v0 = el.getAttribute?.(a); if (v0) { const v = t(v0); if (v !== v0) el.setAttribute(a, v); } }
  }
}
// Con inglés activo, todo lo nuevo que aparece en la página se traduce (pantallas, ventanas, avisos)
export function activarTraduccion() {
  if (!enIngles) return;
  traducirNodo(document.body);
  document.title = t(document.title);
  new MutationObserver((cambios) => {
    for (const c of cambios) {
      if (c.type === 'characterData') traducirNodo(c.target);
      else c.addedNodes.forEach(traducirNodo);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}
