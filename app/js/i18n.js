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
const DIC = { en: idioma === 'en' ? Object.assign({}, ...(await Promise.all(['en1', 'en2', 'en3', 'en4', 'en5'].map((n) => import(`./i18n/${n}.js`)))).map((m) => m.default)) : {} };
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
  // Líneas compuestas «fecha · estado · quién» (3-nov-2026): si nada tradujo la línea entera, cada parte por separado; una lista
  // «A, B» solo si se traduce entera (si no, es un dato escrito por alguien y queda como está)
  if (k2.includes(' · ')) {
    const partes = k2.split(' · '), tr = partes.map(parte);
    if (tr.some((x, i) => x !== partes[i])) return k.replace(k2, tr.join(' · '));
  }
  return s;
}
function parte(p) {
  const x = t(p);
  if (x !== p || !p.includes(', ')) return x;
  const sub = p.split(', '), ts = sub.map((y) => t(y));
  return ts.every((y, i) => y !== sub[i]) ? ts.join(', ') : p;
}
const MESES = { enero: 'January', febrero: 'February', marzo: 'March', abril: 'April', mayo: 'May', junio: 'June', julio: 'July', agosto: 'August', septiembre: 'September', octubre: 'October', noviembre: 'November', diciembre: 'December' };
const miles = (n) => n.replace(/\./g, ',');
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
  // Circulares institucionales (3-nov-2026 noche)
  [/^(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre) (?:de )?(\d{4})$/, (_, d, m, y) => `${MESES[m]} ${d}, ${y}`],
  [/^([\d.]+) de ([\d.]+) caracteres$/, (_, a, b) => `${miles(a)} of ${miles(b)} characters`],
  [/^guardado (.+) por (.+)$/, 'saved $1 by $2'], [/^Guardado ([^·]+)$/, 'Saved $1'], [/^versión (\d+)(\.?)$/, 'version $1$2'],
  [/^Borrador guardado con el consecutivo (.+)$/, 'Draft saved with number $1'], [/^siguiente: (.+)$/, 'next: $1'], [/^numera en (.+)$/, 'numbers in $1'],
  [/^Último: (.+) → siguiente: (.+)$/, (_, a, b) => `Last: ${a === '(ninguno)' ? '(none)' : a} → next: ${b}`], [/^El siguiente número \((\d+)\) no cabe en (\d+) cifras\.$/, 'The next number ($1) does not fit in $2 digits.'],
  [/^(✅ )?Validada por (.+) el (.+)$/, '$1Validated by $2 on $3'], [/^vigencia (.+) a (.+)$/, 'valid $1 to $2'], [/^(\d+) número\(s\) anulado\(s\)$/, '$1 cancelled number(s)'],
  [/^Último documento: (.+)$/, 'Last document: $1'], [/^Nota: (.+)$/, 'Note: $1'],
  [/^(\d+) no la recibirán \((.+)\)$/, (_, n, r) => `${n} will not receive it (${r.split(', ').map((x) => { const [a, b] = x.split(': '); return `${t(a)}: ${b}`; }).join(', ')})`],
  [/^destinatario\(s\) únicos(?:: (.+))?\.$/, (_, g) => `unique recipient(s)${g ? ': ' + t(g) : ''}.`],
  [/^Calculado por el servidor (.+)\. Una persona elegida por varias vías recibe una sola\.$/, 'Calculated by the server $1. A person chosen in several ways receives only one.'],
  [/^El contenido es el de la versión (\d+) guardada \(el que viste en «Ver PDF»\)\. Si algo falla después de numerar, la circular conserva su número y el reintento usa el mismo\.$/, 'The content is that of saved version $1 (the one you saw in “View PDF”). If something fails after numbering, the circular keeps its number and the retry uses the same one.'],
  [/^, serie (.+); no está reservado\)\. Enseguida se genera el PDF oficial con ese número y se entrega\.$/, ', series $1; not reserved). The official PDF is then generated with that number and delivered.'],
  [/^bandeja\(s\) de entrada \((\d+) previstas\)( — ya se había enviado; no se repitió)?\.$/, (_, n, r) => `inbox(es) (${n} expected)${r ? ' — it had already been sent; it was not repeated' : ''}.`],
  [/^(\d+) no la recibieron: (.+)$/, '$1 did not receive it: $2'], [/^Enviar (\S.*)$/, 'Send $1'],
  [/^La circular conserva su número (.+): al reintentar se usa el mismo\.$/, 'The circular keeps its number $1: the retry uses the same one.'],
  [/^Ya existe la serie «(.+)» del período (\S+) \((.+)\)\. Usa otro código o período \(no se repiten: darían los mismos números\)\.$/,
    (_, s, p, a) => `The series “${s}” for period ${p} already exists (${a === 'del colegio, sin área' ? 'school, no area' : a}). Use another code or period (they cannot repeat: they would give the same numbers).`],
  [/^La serie «(.+)» es provisional: para emitir oficialmente, el administrador debe validarla con los registros del colegio\.$/, 'The series “$1” is provisional: to issue officially, the administrator must validate it with the school’s records.'],
  [/^El número (.+) viene de una serie provisional: valida la serie con los registros del colegio antes de emitir\.$/, 'Number $1 comes from a provisional series: validate the series with the school’s records before issuing.'],
  [/^La serie «(.+)» ya no está vigente: elige otra serie en «Consecutivo»\. El borrador sigue guardado\.$/, 'The series “$1” is no longer active: choose another series in “Number”. The draft is still saved.'],
  [/^La serie «(.+)» no está vigente hoy(: elige otra serie o corrige su vigencia en Ajustes)?\.$/, (_, s, x) => `The series “${s}” is not valid today${x ? ': choose another series or correct its validity in Settings' : ''}.`],
  [/^La serie «(.+)» es de otra área: elige una serie del área que emite\.$/, 'The series “$1” belongs to another area: choose a series of the issuing area.'],
  [/^La circular cambió mientras la enviabas \(versión (\d+) → (\d+)\): ábrela otra vez y revisa antes de enviar\.$/, 'The circular changed while you were sending it (version $1 → $2): open it again and review before sending.'],
  [/^(.+) ya existe en el colegio: revisa el último número usado\.$/, '$1 already exists in the school: check the last number used.'],
  [/^Serie guardada · siguiente: (.+)$/, 'Series saved · next: $1'],
  [/^Series de (.+)$/, 'Series of $1'],
  [/^Circular (.+) enviada: llegó a (\d+) bandeja\(s\) de entrada\.$/, 'Circular $1 sent: it reached $2 inbox(es).'],
  [/^(✅ Emitida y enviada|⛔ Anulada)(?: el (.+?))?\.? Su contenido y su número ya no cambian(, y no se vuelve a enviar)?\.$/,
    (_, e, f, r) => `${e[0] === '✅' ? '✅ Issued and sent' : '⛔ Cancelled'}${f ? ' on ' + f : ''}. Its content and number no longer change${r ? ', and it is not sent again' : ''}.`],
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
