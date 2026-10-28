// Contenido de las circulares institucionales. Funciones puras (se prueban en pruebas/unitarias).
//
// El BORRADOR guarda la estructura tal como se ve en el editor (formato v1 con dos agregados):
//   { tipo: 'parrafo', segmentos: [{ texto, negrita }], sangria?: true }
//   { tipo: 'lista', ordenada, elementos: [{ segmentos, sub?: [{ segmentos }], despues?: [{ segmentos }] }] }
// (sub = sub-puntos a., b., c.; despues = párrafos con sangría dentro del punto, después de sus sub-puntos).
//
// El SERVIDOR (Edge Function circular-documentos, render-modelo-v4) recibe el formato v1 simple y reconoce la estructura
// del memo del colegio por convenciones de texto: un párrafo que empieza con "3. " es un punto numerado, con "a. " un
// sub-punto, y con sangría (8 espacios) un párrafo dentro del punto. aServidor() hace esa traducción.

export const LIMITES = { titulo: 250, destinatarios: 1000, dependencia: 160, responsable: 200, cargo: 160, consecutivo: 60, cuerpo: 80000 };
// Sugerencias (no reglas): el colegio puede escribir otra área o cargo
export const AREAS = ['Rectoría', 'Vicerrectoría', 'Coordinación académica', 'Coordinación de convivencia', 'Dirección de sección', 'Secretaría académica', 'Administración'];
export const CARGO_DE_AREA = { 'Rectoría': 'Rector(a)', 'Vicerrectoría': 'Vicerrector(a)', 'Coordinación académica': 'Coordinador(a) académico(a)', 'Coordinación de convivencia': 'Coordinador(a) de convivencia', 'Dirección de sección': 'Director(a) de sección', 'Secretaría académica': 'Secretario(a) académico(a)', 'Administración': 'Administrador(a)' };
export const CATEGORIAS = ['Profesores', 'Administrativos', 'Monitoras'];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NBSP = new RegExp(String.fromCharCode(160), 'g');
const LETRAS = 'abcdefghijklmnopqrstuvwxyz';
const SANGRIA = '        '; // 8 espacios = 36 pt en el servidor: alineado con el texto de los puntos (como en el memo)

// Fecha de hoy en Bogotá (AAAA-MM-DD), sin importar la zona horaria del equipo
export function hoyBogota(ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
// Como en el formato del colegio y en el PDF del servidor: "26 de octubre 2026" (sin "de" antes del año)
export function fechaLarga(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} ${m[1]}` : '';
}

// "Profesores, Administrativos y Monitoras" (+ otros escritos a mano)
export function textoDestinatarios(categorias = [], otros = '') {
  const todos = [...categorias, ...String(otros || '').split(/[,;]/).map((s) => s.trim()).filter(Boolean)];
  if (todos.length <= 1) return todos[0] || '';
  return todos.slice(0, -1).join(', ') + ' y ' + todos.at(-1);
}
// "Estimados profesores, administrativos y monitoras:"
export function saludoSugerido(categorias = [], otros = '') {
  const t = textoDestinatarios(categorias, otros);
  return t ? `Estimados ${t.toLocaleLowerCase('es')}:` : '';
}

// Consecutivo que sigue al último usado: "memo E2-002-2026-2027" → "memo E2-003-2026-2027" (conserva los ceros).
// Solo es una sugerencia: el consecutivo lo escribe Administración (la regla oficial aún no está definida).
export function siguienteConsecutivo(usados = []) {
  let mejor = null;
  for (const c of usados) {
    const m = /^(.*?-)(\d{2,4})(-\d{4}(?:-\d{4})?)?\s*$/.exec(String(c || '').trim());
    if (!m) continue;
    const n = Number(m[2]);
    if (!mejor || n > mejor.n) mejor = { pre: m[1], n, ancho: m[2].length, suf: m[3] || '' };
  }
  return mejor ? mejor.pre + String(mejor.n + 1).padStart(mejor.ancho, '0') + mejor.suf : '';
}
const normalConsec = (c) => String(c || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
export const mismoConsecutivo = (a, b) => !!normalConsec(a) && normalConsec(a) === normalConsec(b);

// Número con el que empieza cada lista numerada: sigue la cuenta si entre dos listas solo hay párrafos con sangría
// (como el memo: 1, 2, 3, párrafo del punto 3, 4)
export function numeracion(bloques = []) {
  const ini = []; let siguiente = 1, abierta = false;
  bloques.forEach((b, i) => {
    if (b.tipo === 'lista' && b.ordenada) { const n = abierta ? siguiente : 1; ini[i] = n; siguiente = n + b.elementos.length; abierta = true; }
    else if (!(b.tipo === 'parrafo' && b.sangria)) abierta = false;
  });
  return ini;
}

const sinEspaciosIniciales = (ss = []) => {
  const out = ss.map((s) => ({ ...s }));
  while (out.length) { out[0].texto = out[0].texto.replace(/^[ \t]+/, ''); if (out[0].texto) break; out.shift(); }
  return out;
};
const conPrefijo = (txt, ss) => [{ texto: txt, negrita: false }, ...ss];

// Borrador → formato del servidor (v1 simple, con las convenciones de texto del memo)
export function aServidor(contenido) {
  const bloques = contenido?.bloques || [];
  const ini = numeracion(bloques);
  const out = [];
  const par = (segmentos) => out.push({ tipo: 'parrafo', segmentos });
  const hijos = (e) => {
    (e.sub || []).forEach((s, k) => par(conPrefijo(LETRAS[k] + '. ', sinEspaciosIniciales(s.segmentos))));
    (e.despues || []).forEach((p) => { const ss = sinEspaciosIniciales(p.segmentos); if (ss.length) par(conPrefijo(SANGRIA, ss)); });
  };
  bloques.forEach((b, i) => {
    if (b.tipo === 'parrafo') {
      const ss = sinEspaciosIniciales(b.segmentos); // un espacio al inicio no debe volverse sangría por accidente
      if (ss.length) par(b.sangria ? conPrefijo(SANGRIA, ss) : ss);
      return;
    }
    const conHijos = b.elementos.some((e) => e.sub?.length || e.despues?.length);
    if (b.ordenada && !conHijos && ini[i] === 1) { out.push({ tipo: 'lista', ordenada: true, elementos: b.elementos.map((e) => ({ segmentos: e.segmentos })) }); return; }
    if (b.ordenada) { b.elementos.forEach((e, j) => { par(conPrefijo(`${ini[i] + j}. `, sinEspaciosIniciales(e.segmentos))); hijos(e); }); return; }
    // viñetas: los puntos van en listas; los sub-puntos en medio, como párrafos "a. "
    let tanda = [];
    const soltar = () => { if (tanda.length) out.push({ tipo: 'lista', ordenada: false, elementos: tanda }); tanda = []; };
    for (const e of b.elementos) { tanda.push({ segmentos: e.segmentos.length ? e.segmentos : [{ texto: ' ', negrita: false }] }); if (e.sub?.length || e.despues?.length) { soltar(); hijos(e); } }
    soltar();
  });
  return { version: 1, bloques: out };
}

// Texto plano (igual que el servidor, sobre lo que se le envía) para contar caracteres y para buscar
export function textoPlano(contenido) {
  return aServidor(contenido).bloques.map((b) => (b.tipo === 'parrafo'
    ? b.segmentos.map((s) => s.texto).join('')
    : b.elementos.map((e, i) => (b.ordenada ? `${i + 1}. ` : '- ') + e.segmentos.map((s) => s.texto).join('')).join('\n'))).join('\n\n');
}

// Borrador → HTML (escapado) para el editor y la vista rápida
export function contenidoHTML(contenido) {
  const bloques = contenido?.bloques || [];
  const ini = numeracion(bloques);
  const run = (ss = []) => ss.map((s) => { const t = esc(s.texto).replace(/\n/g, '<br>'); return s.negrita ? `<b>${t}</b>` : t; }).join('');
  const punto = (e) => `<li>${run(e.segmentos)}${e.sub?.length ? `<ol type="a">${e.sub.map((s) => `<li>${run(s.segmentos)}</li>`).join('')}</ol>` : ''}${(e.despues || []).map((p) => `<p>${run(p.segmentos)}</p>`).join('')}</li>`;
  return bloques.map((b, i) => (b.tipo === 'parrafo'
    ? (b.sangria ? `<blockquote><p>${run(b.segmentos)}</p></blockquote>` : `<p>${run(b.segmentos)}</p>`)
    : `<${b.ordenada ? 'ol' : 'ul'}${b.ordenada && ini[i] > 1 ? ` start="${ini[i]}"` : ''}>${b.elementos.map(punto).join('')}</${b.ordenada ? 'ol' : 'ul'}>`)).join('');
}

// El servidor rechaza caracteres de control (salvo tabulación y salto de línea)
const sinControl = (t) => [...t].filter((ch) => { const c = ch.charCodeAt(0); return c >= 32 || c === 9 || c === 10; }).join('');

// Une segmentos vecinos con el mismo estilo y quita los vacíos
function compactar(ss) {
  const out = [];
  for (const s of ss) {
    s.texto = sinControl(s.texto);
    if (!s.texto) continue;
    const ult = out.at(-1);
    if (ult && ult.negrita === s.negrita) ult.texto += s.texto; else out.push({ texto: s.texto, negrita: s.negrita });
  }
  // sin saltos de línea sueltos al principio o al final del bloque
  if (out.length) { out[0].texto = out[0].texto.replace(/^\n+/, ''); out.at(-1).texto = out.at(-1).texto.replace(/\n+$/, ''); }
  return out.filter((s) => s.texto);
}
const tieneTexto = (ss) => ss.some((s) => s.texto.trim());
const BLOQUES = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'PRE']);
const esLista = (n) => n?.nodeType === 1 && (n.tagName === 'OL' || n.tagName === 'UL');
// Sangría que pone el navegador al usar "Aumentar sangría" en un párrafo (Chrome y Safari: <blockquote>; otros: margen)
const conSangria = (n) => n.tagName === 'BLOCKQUOTE' || parseFloat(n.style?.marginLeft || 0) > 0 || parseFloat(n.style?.paddingLeft || 0) > 0;

// Editor (contenteditable) → borrador. Los navegadores anidan distinto al editar (Chrome deja <p><ol>…</ol><p>…</p></p> y,
// al aumentar sangría en un punto, <ol><li>…</li><ol>…</ol></ol>; Safari, <div><ul>…</ul></div>): se lee por bloques a
// cualquier profundidad. Solo hay un nivel de sub-puntos (como el memo); uno más adentro queda como línea "a. …".
export function leerEditor(raiz) {
  const bloques = [];
  const corridas = (nodo, negrita = false, out = []) => {
    if (nodo.nodeType === 3) { if (nodo.textContent) out.push({ texto: nodo.textContent.replace(NBSP, ' '), negrita }); return out; }
    if (nodo.nodeType !== 1) return out;
    const tag = nodo.tagName;
    if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'IMG', 'SVG'].includes(tag)) return out;
    if (tag === 'BR') { out.push({ texto: '\n', negrita }); return out; }
    const neg = negrita || tag === 'B' || tag === 'STRONG' || Number(nodo.style?.fontWeight) >= 600;
    for (const h of nodo.childNodes) {
      if (esLista(h)) {
        [...h.children].filter((li) => li.tagName === 'LI').forEach((li, i) => {
          out.push({ texto: '\n' + (h.tagName === 'OL' ? LETRAS[i % 26] + '. ' : '• '), negrita: false });
          corridas(li, false, out);
        });
      } else if (h.nodeType === 1 && BLOQUES.has(h.tagName) && out.length) {
        out.push({ texto: '\n', negrita: false }); corridas(h, neg, out);
      } else corridas(h, neg, out);
    }
    return out;
  };
  // Sub-puntos de una lista anidada (y de las que estén más adentro, en el mismo nivel)
  const subDe = (lista) => {
    const subs = [];
    for (const h of lista.childNodes) {
      if (h.nodeType !== 1) continue;
      if (h.tagName === 'LI') {
        const ss = []; const mas = [];
        for (const x of h.childNodes) { if (esLista(x)) mas.push(x); else corridas(x, false, ss); }
        const seg = compactar(ss);
        if (tieneTexto(seg)) subs.push({ segmentos: seg });
        for (const l of mas) subs.push(...subDe(l));
      } else if (esLista(h)) subs.push(...subDe(h));
    }
    return subs;
  };
  // Un punto: su texto, sus sub-puntos y los párrafos que vengan después de ellos
  const elementoDe = (li) => {
    const antes = [], sub = [], despues = []; let parrafo = [], vioLista = false;
    const cerrarP = () => { const ss = compactar(parrafo); if (tieneTexto(ss)) despues.push({ segmentos: ss }); parrafo = []; };
    for (const h of li.childNodes) {
      if (esLista(h)) { cerrarP(); vioLista = true; sub.push(...subDe(h)); continue; }
      if (!vioLista) { if (h.nodeType === 1 && BLOQUES.has(h.tagName) && antes.length) antes.push({ texto: '\n', negrita: false }); corridas(h, false, antes); }
      else if (h.nodeType === 1 && BLOQUES.has(h.tagName)) { cerrarP(); parrafo = corridas(h); cerrarP(); }
      else parrafo.push(...corridas(h));
    }
    cerrarP();
    const e = { segmentos: compactar(antes) };
    if (sub.length) e.sub = sub;
    if (despues.length) e.despues = despues;
    return e;
  };
  const listaDe = (n) => {
    const elementos = [];
    for (const h of n.childNodes) {
      if (h.nodeType !== 1) continue;
      if (h.tagName === 'LI') elementos.push(elementoDe(h));
      else if (esLista(h)) { // sub-lista como hermana del punto (Chrome al aumentar sangría): es del punto anterior
        const subs = subDe(h);
        if (elementos.length) elementos.at(-1).sub = [...(elementos.at(-1).sub || []), ...subs];
        else subs.forEach((s) => elementos.push(s));
      }
    }
    return elementos.filter((e) => tieneTexto(e.segmentos) || e.sub?.length || e.despues?.length);
  };
  let suelto = [];
  const cerrar = (sangria) => {
    const ss = compactar(suelto); suelto = [];
    if (tieneTexto(ss)) bloques.push(sangria ? { tipo: 'parrafo', segmentos: ss, sangria: true } : { tipo: 'parrafo', segmentos: ss });
  };
  const bloque = (padre, sangria = false) => {
    for (const n of padre.childNodes) {
      const tag = n.nodeType === 1 ? n.tagName : '';
      if (esLista(n)) {
        cerrar(sangria);
        const elementos = listaDe(n);
        if (elementos.length) {
          const b = { tipo: 'lista', ordenada: tag === 'OL', elementos };
          Object.defineProperty(b, 'nodo', { value: n, enumerable: false }); // para mostrar la numeración que sigue (no se guarda)
          bloques.push(b);
        }
      } else if (BLOQUES.has(tag)) { cerrar(sangria); bloque(n, sangria || conSangria(n)); cerrar(sangria || conSangria(n)); }
      else suelto.push(...corridas(n)); // texto, negrita y saltos de línea (<br>) del mismo párrafo
    }
  };
  bloque(raiz);
  cerrar(false);
  return { version: 1, bloques };
}

// Datos tal como los pide el servidor (mismos nombres y límites). Devuelve { datos } o { error, campo }.
export function datosParaServidor(f) {
  const t = (v) => String(v ?? '').normalize('NFC').trim();
  const destinatarios = textoDestinatarios(f.destinatarios, f.destinatarios_otros);
  const datos = { titulo: t(f.titulo), destinatarios, dependencia: t(f.dependencia), responsable: t(f.responsable), cargo: t(f.cargo), fecha_emision: f.fecha_emision, contenido: aServidor(f.contenido) };
  const consecutivo = t(f.consecutivo).replace(/\s+/g, ' ');
  if (consecutivo) datos.consecutivo = consecutivo;
  const faltan = [['dependencia', 'el área emisora'], ['destinatarios', 'a quién va dirigida (marca al menos una casilla)'], ['titulo', 'el asunto'], ['responsable', 'el nombre de quien firma'], ['cargo', 'el cargo de quien firma']];
  for (const [k, txt] of faltan) if (!datos[k]) return { error: `Falta ${txt}.`, campo: k };
  for (const k of ['titulo', 'destinatarios', 'dependencia', 'responsable', 'cargo', 'consecutivo']) if (datos[k] && datos[k].length > LIMITES[k]) return { error: `El campo es muy largo (máximo ${LIMITES[k]} caracteres).`, campo: k };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha_emision || '')) return { error: 'Revisa la fecha de emisión.', campo: 'fecha_emision' };
  for (const b of f.contenido?.bloques || []) if ((b.elementos || []).some((e) => (e.sub || []).length > 26)) return { error: 'Un punto tiene más de 26 sub-puntos (a. a z.); divídelo.', campo: 'contenido' };
  const plano = textoPlano(f.contenido);
  if (!plano.trim()) return { error: 'Escribe el contenido de la circular.', campo: 'contenido' };
  if (plano.length > LIMITES.cuerpo) return { error: `El contenido es muy largo (máximo ${LIMITES.cuerpo.toLocaleString('es-CO')} caracteres).`, campo: 'contenido' };
  if (datos.contenido.bloques.length > 400) return { error: 'El contenido tiene demasiados párrafos (máximo 400).', campo: 'contenido' };
  for (const b of datos.contenido.bloques) {
    if (b.tipo === 'lista' && b.elementos.length > 200) return { error: 'Una lista tiene más de 200 puntos; divídela en dos.', campo: 'contenido' };
    if ((b.segmentos || []).length > 200 || (b.elementos || []).some((e) => e.segmentos.length > 200)) return { error: 'Un párrafo tiene demasiados cambios de negrita; simplifícalo.', campo: 'contenido' };
  }
  return { datos };
}
