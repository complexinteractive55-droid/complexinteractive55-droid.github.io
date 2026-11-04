// Iconos de la interfaz (input de Fabio 3-nov-2026, §17–§19). La app no tenía biblioteca de iconos (el menú usaba emojis, que cada
// sistema dibuja distinto) y sus únicos iconos propios eran los del ojo de la contraseña: este juego sigue ESE estilo (24×24,
// trazo 2, extremos redondeados, color del texto). Son SVG en línea, sin dependencias, archivos ni imágenes externas (unos 9 KB).
// Acompañan la etiqueta: son decorativos (aria-hidden) y el lector de pantalla anuncia el texto una sola vez. Un control que es
// SOLO icono (la tuerca de Ajustes, cerrar, menú) lleva su nombre en aria-label donde se usa.
const T = {
  tablero: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  persona: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  ficha: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16.5c.6-1.6 1.8-2.5 3.2-2.5s2.6.9 3.2 2.5M14.5 10h4M14.5 14h3"/>',
  documento: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  cuenta: '<circle cx="10" cy="8" r="4"/><path d="M3 21c0-4 3.1-7 7-7 1.2 0 2.3.3 3.3.8"/><circle cx="18" cy="17" r="2.5"/><path d="M18 12.5V14M18 20v1.5M13.5 17H15M21 17h1.5"/>',
  // la tuerca (engranaje de 8 dientes con su hueco): Ajustes
  ajustes: '<path d="M10.1 5L10.5 2.3L13.5 2.3L13.9 5L15.6 5.8L17.8 4.1L19.9 6.2L18.2 8.4L19 10.1L21.7 10.5L21.7 13.5L19 13.9L18.2 15.6L19.9 17.8L17.8 19.9L15.6 18.2L13.9 19L13.5 21.7L10.5 21.7L10.1 19L8.4 18.2L6.2 19.9L4.1 17.8L5.8 15.6L5 13.9L2.3 13.5L2.3 10.5L5 10.1L5.8 8.4L4.1 6.2L6.2 4.1L8.4 5.8Z"/><circle cx="12" cy="12" r="3"/>',
  ayuda: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5h.01"/>',
  mensajes: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/>',
  bandeja: '<path d="M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 13h5l1.5 3h5L16 13h5"/>',
  redactar: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  enviar: '<path d="M21 3 10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>',
  megafono: '<path d="M3 11v2a1 1 0 0 0 1 1h2l8 5V5L6 10H4a1 1 0 0 0-1 1z"/><path d="M6 14l1 5h2.5l-1-4.5M18 9a3 3 0 0 1 0 6"/>',
  circular: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 8h6M9 12h6M9 16h2.5"/><circle cx="15" cy="16.5" r="1.8"/>',
  pqrs: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/><path d="M12 8v4M12 15.5h.01"/>',
  salas: '<path d="M16 10a6 6 0 0 1-8.7 5.3L3.5 16.5l1.1-3.6A6 6 0 1 1 16 10z"/><path d="M18.6 8.6A5 5 0 0 1 20 17l.9 2.8-3.3-1A5 5 0 0 1 10.5 18"/>',
  comunidad: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M15.5 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2.1.8 3.5 2.9 3.5 5.7"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  seguimiento: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
  compromiso: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/>',
  ausencia: '<circle cx="10" cy="8" r="4"/><path d="M3 21c0-4 3.1-7 7-7s7 3 7 7M16 9h6"/>',
  procesos: '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/><path d="M6 9v4a2 2 0 0 0 2 2h7"/>',
  carpeta: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  academia: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5M22 9v6"/>',
  edificio: '<path d="M4 21V5l8-3 8 3v16M2 21h20"/><path d="M9 21v-5h6v5M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  album: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  libro: '<path d="M2 5h6a4 4 0 0 1 4 4v11a3 3 0 0 0-3-3H2z"/><path d="M22 5h-6a4 4 0 0 0-4 4v11a3 3 0 0 1 3-3h7z"/>',
  grafica: '<path d="M3 21h18M6 17v-5M11 17V6M16 17v-8"/>',
  puerta: '<path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18M14.5 12h.01"/>',
  billetera: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z"/><path d="M16.5 14.5h.01"/>',
  factura: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  tarjeta: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  etiqueta: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><path d="M7.5 7.5h.01"/>',
  enlace: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  salir: '<path d="M10 4H5v16h5"/><path d="M14 8l4 4-4 4M18 12H9"/>',
  pizarra: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v3M8 21l4-2 4 2"/>',
  bandera: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  cuaderno: '<path d="M5 4a2 2 0 0 1 2-2h12v16H7a2 2 0 0 0-2 2z"/><path d="M5 20a2 2 0 0 0 2 2h12v-4"/>',
  pantalla: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 21h8M12 16v5"/>',
  progreso: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  asistencia: '<path d="M10 6h11M10 12h11M10 18h11"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>',
  salud: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/>',
  corazon: '<path d="M20.8 8.6a5 5 0 0 0-8.8-3.2 5 5 0 0 0-8.8 3.2c0 5.4 8.8 11.4 8.8 11.4s8.8-6 8.8-11.4z"/>',
  docente: '<circle cx="10" cy="8" r="4"/><path d="M3 21c0-4 3.1-7 7-7s7 3 7 7M16 11l2 2 4-4"/>',
  mochila: '<path d="M8 5V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1"/><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 13h8v4H8z"/>',
  obligacion: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 15l2 2 4-4"/>',
  consolidado: '<path d="M21 12A9 9 0 1 1 12 3v9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
  cambiar: '<path d="M4 9h13l-3-3M20 15H7l3 3"/>',
  // Acciones (botones)
  mas: '<path d="M12 5v14M5 12h14"/>',
  guardar: '<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h8V3M7 21v-7h10v7"/>',
  ver: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  abrir: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  descargar: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
  eliminar: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  editar: '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  cerrar: '<path d="M6 6l12 12M18 6 6 18"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  validar: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  volver: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  actualizar: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4"/>',
  responder: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 5 5v5"/>',
  reenviar: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0-5 5v5"/>',
  camara: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  subir: '<path d="M12 20V9M7 14l5-5 5 5M4 4h16"/>',
  llave: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>',
  imprimir: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  clip: '<path d="M20 11.5 12.3 19.2a5 5 0 0 1-7.1-7.1l7.8-7.8a3.3 3.3 0 0 1 4.7 4.7l-7.8 7.8a1.7 1.7 0 0 1-2.4-2.4l7.1-7.1"/>',
  anterior: '<path d="m15 6-6 6 6 6"/>',
  siguiente: '<path d="m9 6 6 6-6 6"/>',
  play: '<path d="M7 4v16l13-8z"/>',
  chispa: '<path d="M12 3c.5 4 1.9 5.5 6 6-4.1.5-5.5 2-6 6-.5-4-1.9-5.5-6-6 4.1-.5 5.5-2 6-6zM19 15v4M17 17h4"/>',
  objetivo: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  huella: '<path d="M6.5 7.5a7 7 0 0 1 11 0M5 12a7 7 0 0 1 14 0v1M8.5 20a10 10 0 0 0 1.5-6 2 2 0 0 1 4 0 14 14 0 0 1-1 6M16.5 18.5c.3-1.5.5-3 .5-4.5"/>',
  menos: '<path d="M5 12h14"/>',
};
export const icono = (n, clase = '') => (T[n] ? `<svg class="ico${clase ? ' ' + clase : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${T[n]}</svg>` : '');
export const NOMBRES_ICONOS = Object.keys(T);

// Correspondencia estable función → icono para los menús (la misma en todos los perfiles). Clave: la ruta sin parámetros
// (estudiante/…?tab=X → est-X; tesoreria?tab=X → tes-X); los grupos, por su título.
export const ICONO_GRUPO = { Tablero: 'tablero', Perfil: 'persona', 'Comunicación': 'mensajes', Comunidad: 'comunidad', 'Académico': 'academia', Academia: 'academia',
  Docencia: 'pizarra', 'Tesorería': 'billetera', 'Enfermería': 'salud', 'Matrícula': 'mochila', Pasarelas: 'enlace' };
export const ICONO_RUTA = {
  inicio: 'tablero', pasarelas: 'enlace', 'info-personal': 'ficha', edocs: 'documento', perfil: 'cuenta', 'ajustes-colegio': 'ajustes', ayuda: 'ayuda',
  bandeja: 'bandeja', 'bandeja-hijo': 'bandeja', redactar: 'redactar', enviados: 'enviar', cartelera: 'megafono', circulares: 'circular', pqrs: 'pqrs', salas: 'salas',
  calendario: 'calendario', personas: 'comunidad', seguimientos: 'seguimiento', compromisos: 'compromiso', ausencias: 'ausencia', procesos: 'procesos', archivos: 'carpeta',
  estructura: 'edificio', horario: 'reloj', album: 'album', planeaciones: 'libro', planeacion: 'libro', reportes: 'grafica', 'espacios-solicitudes': 'puerta', espacios: 'puerta',
  'tes-cartera': 'billetera', 'tes-facturar': 'factura', 'tes-pagos': 'tarjeta', 'tes-conceptos': 'etiqueta', tesoreria: 'consolidado', 'estado-cuenta': 'consolidado',
  salidas: 'salir', direccion: 'bandera', clases: 'cuaderno', aula: 'pantalla', docentes: 'docente', obligaciones: 'obligacion',
  'est-notas': 'progreso', 'est-asistencia': 'asistencia', 'est-observador': 'seguimiento', 'est-compromisos': 'compromiso', 'est-ficha': 'corazon',
};
export const claveRuta = (r) => {
  const [p, q] = String(r).split('?');
  const tab = new URLSearchParams(q || '').get('tab');
  if (p.startsWith('estudiante/') && tab) return 'est-' + tab;
  if (p === 'tesoreria' && tab) return 'tes-' + tab;
  return p.split('/')[0];
};
export const iconoRuta = (r) => icono(ICONO_RUTA[claveRuta(r)]);

// Botones: el icono sale del verbo de la etiqueta (la etiqueta no cambia). Sin verbo conocido, sin icono. También en inglés (la app
// se traduce en el equipo). «Confirmar y enviar» va antes que «Confirmar»: gana el primero que coincide.
const VERBO = [[/^(guardar|designar|save)\b/i, 'guardar'], [/^(eliminar|borrar|quitar|delete|remove)\b/i, 'eliminar'], [/^(confirmar y enviar|enviar|reenviar|reintentar: enviar|send|resend)\b/i, 'enviar'],
  [/^(descargar|download)\b/i, 'descargar'], [/^(abrir|open)\b/i, 'abrir'], [/^(validar|aprobar|aceptar|confirmar|listo|validate|approve|accept|confirm|done)\b/i, 'validar'],
  [/^(editar|cambiar|corregir|edit|change)\b/i, 'editar'], [/^(publicar|publish)\b/i, 'megafono'], [/^(cancelar|cerrar|cancel|close)$/i, 'cerrar'], [/^(ver|vista|view)\b/i, 'ver'],
  [/^(buscar|search)\b/i, 'buscar'], [/^(volver a revisar|reintentar|actualizar|retry|refresh)\b/i, 'actualizar'], [/^(imprimir|print)\b/i, 'imprimir'], [/^(exportar|export)\b/i, 'descargar'],
  [/^(crear|agregar|añadir|nuev[oa]|create|add|new)\b/i, 'mas'], [/^(hoy|calendario|today|calendar)\b/i, 'calendario'], [/^(estado de cuenta|account statement)/i, 'billetera'],
  [/^(respuestas|responder|answers|reply)\b/i, 'responder'], [/^(despublicar|unpublish)\b/i, 'cerrar'], [/^(ya tiene cuenta|has an account)/i, 'docente'], [/^(subir|cargar|upload)\b/i, 'subir'],
  [/^(adjuntar|attach)\b/i, 'clip'], [/^(entrar|ingresar|sign in|log in)\b/i, 'salir']];
const verboDe = (t) => VERBO.find(([re]) => re.test(String(t || '').trim()))?.[1];
export const iconoDeTexto = (t) => icono(verboDe(t));

// Decorador compartido (§17): a los botones de TODA la app (.btn) les pone el icono de este juego, al principio y decorativo:
//  · solo texto → el icono de su verbo («Guardar», «Eliminar», «Enviar»…);
//  · con un emoji o símbolo al principio («🗑 Eliminar», «＋ Serie», «🖨 Imprimir») → ese símbolo se cambia por el icono equivalente,
//    para no mezclar dos estilos (los emojis cambian de color y forma en cada sistema). La traducción al inglés no se afecta: ya
//    separaba el símbolo de la palabra.
// No cambia la etiqueta, la acción, los permisos ni el orden. Sin equivalente, se deja como está. Si el botón cambia de texto
// («Ver PDF» → «Generando…» → «Ver PDF») el icono se vuelve a poner.
const EMOJI = { '🗑': 'eliminar', '✏': 'editar', '↩': 'responder', '↪': 'reenviar', '📊': 'grafica', '🔗': 'enlace', '📷': 'camara', '✍': 'redactar', '⬆': 'subir',
  '⬇': 'descargar', '🔑': 'llave', '🧑': 'persona', '📥': 'bandeja', '🖨': 'imprimir', '📎': 'clip', '🖥': 'pantalla', '📝': 'redactar', '✅': 'validar', '🚩': 'bandera',
  '🚪': 'salir', '✖': 'cerrar', '✕': 'cerrar', '📤': 'enviar', '🪪': 'ficha', '📜': 'documento', '💰': 'billetera', '⏱': 'reloj', '🗄': 'carpeta', '🔄': 'actualizar',
  '👥': 'comunidad', '🪄': 'chispa', '🎯': 'objetivo', '🏁': 'bandera', '📒': 'cuaderno', '🖼': 'album', '📄': 'documento', '💳': 'tarjeta', '📂': 'carpeta', '⚙': 'ajustes',
  '👆': 'huella', '＋': 'mas', '➕': 'mas', '−': 'menos', '✓': 'validar', '👁': 'ver', '📨': 'enviar', '📣': 'megafono', '🔍': 'buscar', '⬅': 'volver', '◀': 'anterior', '▶': 'play' };
const INICIAL = /^\s*(\p{Extended_Pictographic}|[＋−✓✕✖◀▶⬆⬇⬅↩↪➕])️?\s*/u;
export function decorarBotones(raiz = document) {
  for (const b of raiz.querySelectorAll('button.btn, a.btn')) {
    if (b.classList.contains('btn-icono') || b.classList.contains('btn-solo-icono') || b.querySelector(':scope > svg')) continue;
    const t = b.textContent.trim();
    if (!t) continue;
    const m = t.match(INICIAL);
    if (m) {
      const solo = m[0].trim() === t; // solo el símbolo (◀ ▶ de «día anterior/siguiente»: su nombre está en aria-label)
      const n = solo && m[1] === '▶' ? 'siguiente' : EMOJI[m[1]];
      if (!n) continue;
      // se quita el símbolo del primer texto del botón (la etiqueta queda igual) y va el icono en su lugar
      const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
      for (let x = w.nextNode(); x; x = w.nextNode()) { if (!x.data.trim()) continue; const mm = x.data.match(INICIAL); if (mm) x.data = x.data.slice(mm[0].length); break; }
      b.insertAdjacentHTML('afterbegin', icono(n));
      continue;
    }
    const n = verboDe(t);
    if (n) b.insertAdjacentHTML('afterbegin', icono(n));
  }
}
export function vigilarBotones(raiz = document.body) {
  let pendiente = false;
  const correr = () => { pendiente = false; decorarBotones(raiz); };
  new MutationObserver(() => { if (!pendiente) { pendiente = true; requestAnimationFrame(correr); } }).observe(raiz, { childList: true, subtree: true, characterData: true });
  correr();
}
