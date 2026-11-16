// Columna del día en el Tablero de TODOS los perfiles (Fabio, 15-nov-2026: «en el tablero que aparece el día en el que se está… que una flecha me señale la
// hora que es y también actúe por gestos del usuario zoom, mover»). Es la misma agenda de hoy que el recuadro «Hoy» del docente
// (agenda_hoy.js: mis clases + calendario institucional + eventos), pintada como una columna de horas: cada bloque ocupa su franja,
// los que se cruzan van lado a lado, y una flecha roja marca la hora de Colombia (con la hora del servidor como referencia).
// Gestos SOLO dentro de la columna (nunca en toda la app): dos dedos acercan o alejan las horas; un dedo (o arrastrar con el ratón)
// la mueve; Ctrl + rueda (o el pellizco del panel táctil) acerca en el PC; botones − / ＋ / «Ahora» y teclas + / − para el teclado.
// Lo de calcular está en funciones puras (pruebas en pruebas/unitarias/dia_columna.test.mjs); lo de pintar y los gestos, abajo.
// 16-nov-2026 (Fabio, con una captura de Google Calendar): «en el tablero del docente debe seguir apareciendo como estaba solo el día
// pero debe haber un botón ahí mismo que al presionar debe llevar al calendario para ver la semana» → botón «Ver semana» (Calendario ›
// Semana, ver la parte «Semana» abajo). Y: «En el calendario sí se puede hacer el zoom y demás; donde no se puede hacer es en tablero.
// En tablero el calendario del día no puede moverse, debe estar estático mostrando la franja horaria de 7:00 AM a 7:00 PM» → en el
// Tablero la columna NO tiene gestos ni se desplaza (arrastrar encima mueve la página) y muestra siempre 7 a.m.–7 p.m. completa
// (RANGO_TABLERO, escala ESCALA_TABLERO); el zoom y el desplazamiento quedan en Calendario › Semana (conectarColumna con zoom).
import { fechaLarga, construirAgenda, enBogota } from './agenda_hoy.js';
import { icono } from './iconos.js';

const SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
// En el Tablero, el nombre completo del día (Fabio, 16-nov-2026: «que apareciera todo el nombre, lunes, martes, miércoles…»); la
// semana del calendario usa la abreviatura (sus columnas son angostas)
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hhmm = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
// Etiqueta de cada hora a la izquierda, en a.m. / p.m. como Google Calendar (Fabio, 16-nov-2026: «de 7:00 AM a 7:00 PM»)
export const horaAmPm = (min) => { const h = Math.floor(min / 60) % 24; return `${h % 12 || 12} ${h < 12 ? 'a.m.' : 'p.m.'}`; };
export const ESCALA = { min: 0.5, max: 4, base: 1.2, paso: 1.25 }; // píxeles por minuto (1,2 → una hora mide 72 px)
// Tablero: siempre de 7 a.m. a 7 p.m., quieta. Escala de partida 1 hora = 44 px; al pintar se ajusta para que las 12 horas quepan
// ENTERAS en lo que queda de pantalla (escalaQueCabe), entre 27 px y 60 px por hora.
export const RANGO_TABLERO = { ini: 7 * 60, fin: 19 * 60 };
export const ESCALA_TABLERO = 44 / 60;
// Píxeles por minuto para que el lienzo (12 horas + 22 px de márgenes + 10 px de aire abajo) quepa en `alto` píxeles
export const escalaQueCabe = (alto) => Math.round(Math.min(1, Math.max(0.45, (Number(alto) - 32) / (RANGO_TABLERO.fin - RANGO_TABLERO.ini))) * 1000) / 1000;
export const limitar = (ppm) => Math.round(Math.min(ESCALA.max, Math.max(ESCALA.min, Number(ppm) || ESCALA.base)) * 1000) / 1000;

// Horas que muestra la columna: por lo menos de 7:00 a. m. a 7:00 p. m. (Fabio, 16-nov-2026; antes desde las 6:00), ampliadas para
// que quepan todos los bloques y la hora actual
export function rangoDia(items, ahoraMin, { desde = 7 * 60, hasta = 19 * 60 } = {}) {
  let ini = desde, fin = hasta;
  for (const x of items) { ini = Math.min(ini, x.ini); fin = Math.max(fin, x.fin); }
  if (Number.isFinite(ahoraMin)) { ini = Math.min(ini, ahoraMin); fin = Math.max(fin, ahoraMin + 1); }
  return { ini: Math.max(0, Math.floor(ini / 60) * 60), fin: Math.min(24 * 60, Math.ceil(fin / 60) * 60) };
}

// Carriles: los bloques que se cruzan se reparten lado a lado (carril 0, 1…) dentro de su grupo; `carriles` = cuántos tiene el grupo
export function carriles(items) {
  const orden = items.map((x) => ({ ...x })).sort((a, z) => a.ini - z.ini || z.fin - a.fin);
  let grupo = [], finGrupo = -Infinity;
  const cerrar = () => { const n = Math.max(...grupo.map((g) => g.carril)) + 1; for (const g of grupo) g.carriles = n; grupo = []; };
  for (const x of orden) {
    if (grupo.length && x.ini >= finGrupo) { cerrar(); finGrupo = -Infinity; }
    const ocupados = new Set(grupo.filter((g) => g.fin > x.ini).map((g) => g.carril));
    let c = 0; while (ocupados.has(c)) c++;
    x.carril = c; grupo.push(x); finGrupo = Math.max(finGrupo, x.fin);
  }
  if (grupo.length) cerrar();
  return orden;
}

// Minutos del día de la hora «hh:mm» que trae la agenda
export const minutosDe = (h) => { const [a, b] = String(h || '').split(':').map(Number); return a * 60 + b; };
const tono = (x) => (x.tipo === 'clase' ? (x.descanso ? 'descanso' : 'clase') : x.sub === 'Mi agenda' ? 'personal' : 'evento');

// ---------------------------------------------------------------- Pintar
// Encabezado: «vie 20» y el ciclo y el día de ciclo TAL COMO los imprime el calendario institucional (Fabio, 15-nov-2026: «debe
// aparecer el ciclo y día»): «Ciclo 3 · Día 5», o solo «Día 5» si la fuente no trae el ciclo ese día. Nunca se calculan ni se
// arrastran de otro día; si la fuente no trae el día de ciclo, lo dice: «Sin día de ciclo».
export function cabeceraDiaHTML(a) {
  const [y, m, d] = a.fecha.split('-').map(Number);
  const sem = DIAS_LARGOS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `<div class="dia-cab" title="${esc(fechaLarga(a.fecha))}"><span class="dia-semana">${sem}</span><b class="dia-num">${d}</b>
    ${a.ciclo ? `<span class="dia-ciclo">${a.ciclo.ciclo ? `Ciclo ${esc(a.ciclo.ciclo)} · ` : ''}Día ${esc(a.ciclo.dia)}</span>` : '<span class="dia-ciclo sin">Sin día de ciclo</span>'}</div>`;
}

// Lienzo de horas con los bloques y la flecha de «ahora». Las posiciones van en minutos (--i, --d) y la escala en --ppm (en la vista),
// así acercar o alejar solo cambia una variable y no hay que repintar.
export function lienzoHTML(a, rango) {
  const ahora = minutosDe(a.hora);
  const horas = [];
  for (let h = rango.ini; h <= rango.fin; h += 60) horas.push(h);
  // Lo que cae por fuera de las horas que se muestran (Tablero: 7 a.m.–7 p.m. fijas) se recorta; lo que queda del todo fuera no se pinta
  const bloques = carriles(a.items.filter((x) => x.fin > rango.ini && x.ini < rango.fin).map((x) => ({ ...x, ini: Math.max(x.ini, rango.ini), fin: Math.min(x.fin, rango.fin) })));
  const conFlecha = ahora >= rango.ini && ahora <= rango.fin;
  return `<div class="dia-lienzo" data-dia-lienzo data-ini="${rango.ini}" data-fin="${rango.fin}" style="--total:${rango.fin - rango.ini}">
    ${horas.map((h) => `<div class="dia-linea" style="--i:${h - rango.ini}"><span>${horaAmPm(h)}</span></div>`).join('')}
    <div class="dia-bloques">${bloques.map((x) => {
      const que = `${hhmm(x.ini)}${x.sinFin ? '' : '–' + hhmm(x.fin)} · ${x.titulo}${x.sub ? ' · ' + x.sub : ''}${x.actual ? ' · Ahora' : ''}${x.siguiente ? ' · Siguiente' : ''}${x.conflicto ? ' · Se cruza' : ''}${x.porConfirmar ? ' · Por confirmar' : ''}`;
      return `<a class="dia-bloque ${tono(x)}${x.carriles > 1 ? ' angosto' : ''}${x.actual ? ' actual' : ''}${x.conflicto ? ' conflicto' : ''}${x.porConfirmar ? ' por-confirmar' : ''}" draggable="false"
        href="${x.tipo === 'clase' ? '#/horario' : '#/calendario?fecha=' + a.fecha}" title="${esc(que)}" aria-label="${esc(que)}"
        style="--i:${x.ini - rango.ini};--d:${Math.max(x.fin - x.ini, 10)};--c:${x.carril};--n:${x.carriles}">
        <b>${esc(x.titulo)}</b><small>${x.actual ? '<i class="dia-etq">Ahora</i> ' : x.siguiente ? '<i class="dia-etq sig">Siguiente</i> ' : ''}${hhmm(x.ini)}${x.sinFin ? '' : '–' + hhmm(x.fin)}${x.sub ? ' · ' + esc(x.sub) : ''}</small></a>`;
    }).join('')}</div>
    ${conFlecha ? `<div class="dia-ahora" data-dia-ahora style="--i:${ahora - rango.ini}" role="img" aria-label="Hora actual ${esc(a.hora)}"><span class="dia-ahora-hora">${esc(a.hora)}</span></div>` : ''}
  </div>`;
}

// sola: la columna va sin tarjetas al lado (estudiante, familia). Quieta, de 7 a.m. a 7 p.m.; «Ver semana» abre el calendario
export const columnaCaja = ({ sola = false } = {}) => `
  <section class="dia-col${sola ? ' dia-sola' : ''}" data-dia-col aria-labelledby="dia-col-titulo">
    <h2 class="oculto-visual" id="dia-col-titulo">Mi día</h2>
    <div data-dia-cab><div class="dia-cab"><span class="dia-semana">…</span></div></div>
    <div class="dia-acciones"><a class="btn btn-chico" href="#/calendario?vista=semana" data-ver-semana>${icono('calendario')}Ver semana</a></div>
    <div data-dia-notas></div>
    <div class="dia-vista dia-quieta" data-dia-vista tabindex="0" role="group" aria-label="Mi día de 7 a.m. a 7 p.m. Enter abre el horario completo." style="--ppm:${ESCALA_TABLERO}" data-ppm="${Math.round(ESCALA_TABLERO * 1000) / 1000}">
      <p class="ayuda dia-cargando">Cargando…</p>
    </div>
  </section>`;

// Notas sobre la columna: tipo de día (festivo, jornada especial…), eventos de todo el día y «sin nada hoy»
export function notasHTML(a) {
  return `${a.nota ? `<p class="dia-nota ${a.tipoDia}" role="note">${esc(a.nota)}</p>` : ''}
    ${a.todoElDia.map((x) => `<a class="dia-todo" href="#/calendario?fecha=${a.fecha}">📌 ${esc(x.titulo)}</a>`).join('')}
    ${!a.items.length ? `<p class="ayuda dia-vacio">${a.tipoDia === 'sin_clases' ? 'Sin clases hoy.' : a.todoElDia.length ? 'Hoy no tienes clases ni eventos con hora.' : 'Hoy no tienes clases ni eventos.'}</p>` : ''}`;
}

// ---------------------------------------------------------------- Gestos (solo dentro de la vista de la columna)
// zoom (Calendario › Semana; Fabio 16-nov-2026: «en el calendario sí se puede hacer el zoom y demás»): dos dedos acercan o alejan
// las horas alrededor del punto medio, Ctrl + rueda (o el pellizco del panel táctil) en el PC, y las teclas + / −.
export function conectarColumna(vista, { zoom = false, inicial = ESCALA.base, alCambiar = () => {}, abrir = () => { location.hash = '#/horario'; } } = {}) {
  let ppm = zoom ? limitar(inicial) : ESCALA.base, pinza = null, raton = null, arrastro = false;
  const lienzo = () => vista.querySelector('[data-dia-lienzo]');
  const aplicar = () => { vista.style.setProperty('--ppm', ppm); vista.dataset.ppm = ppm; };
  // Cambia la escala dejando quieto el minuto que está bajo `ay` (píxeles desde el borde de arriba de la vista)
  const escalar = (nuevo, ay = vista.clientHeight / 2) => {
    if (!zoom) return;
    nuevo = limitar(nuevo);
    if (nuevo === ppm) return;
    const arriba = lienzo()?.offsetTop || 0;
    const minuto = (vista.scrollTop + ay - arriba) / ppm;
    ppm = nuevo; aplicar();
    vista.scrollTop = minuto * ppm + arriba - ay;
    alCambiar(ppm);
  };
  aplicar();
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const medioY = (t) => (t[0].clientY + t[1].clientY) / 2 - vista.getBoundingClientRect().top;
  // Al llegar arriba o abajo de la columna, seguir arrastrando mueve la PÁGINA, como si se deslizara fuera de la columna (Fabio,
  // 15-nov-2026, video). Si el gesto empieza ya en el borde, eso lo hace el navegador solo (overscroll-behavior-y: auto); si llega al
  // borde a mitad del gesto, el navegador se queda «pegado» a la columna y aquí se le pasa el resto del movimiento a la página.
  const pagina = () => { for (let p = vista.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p).overflowY; if ((s === 'auto' || s === 'scroll') && p.scrollHeight > p.clientHeight) return p; } return document.scrollingElement || document.documentElement; };
  const enTope = () => vista.scrollTop <= 0;
  const enFondo = () => vista.scrollTop + vista.clientHeight >= vista.scrollHeight - 1;
  let dedo = null;
  // Un dedo mueve (desplazamiento nativo, touch-action: pan-y); con zoom, dos dedos acercan o alejan alrededor del punto medio
  vista.addEventListener('touchstart', (e) => {
    if (e.touches.length >= 2) { pinza = zoom ? { d: dist(e.touches), ppm } : null; dedo = null; return; }
    dedo = { y: e.touches[0].clientY, tope: enTope(), fondo: enFondo() };
  }, { passive: true });
  vista.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && dedo) {
      const y = e.touches[0].clientY, dy = y - dedo.y;
      dedo.y = y;
      if (!enTope()) dedo.tope = false;
      if (!enFondo()) dedo.fondo = false;
      if ((dy < 0 && enFondo() && !dedo.fondo) || (dy > 0 && enTope() && !dedo.tope)) pagina().scrollBy(0, -dy);
      return;
    }
    if (e.touches.length < 2 || !pinza) return;
    e.preventDefault();
    escalar(pinza.ppm * dist(e.touches) / pinza.d, medioY(e.touches));
  }, { passive: false });
  vista.addEventListener('touchend', (e) => { if (e.touches.length < 2) pinza = null; if (!e.touches.length) dedo = null; });
  // PC: Ctrl + rueda o pellizco del panel táctil (llega como rueda con Ctrl). La rueda sola desplaza como siempre.
  if (zoom) vista.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    escalar(ppm * Math.exp(-e.deltaY * 0.01), e.clientY - vista.getBoundingClientRect().top);
  }, { passive: false });
  // Ratón: arrastrar mueve la columna (y, pasado su borde, la página); si hubo arrastre, el clic que sigue no abre el bloque
  const mover = (e) => {
    if (!raton) return;
    if (!arrastro) { if (Math.abs(e.clientY - raton.y) <= 4) return; arrastro = true; }
    const d = e.clientY - raton.y, antes = vista.scrollTop;
    raton.y = e.clientY;
    vista.scrollTop = antes - d;
    const resto = -d - (vista.scrollTop - antes);
    if (Math.abs(resto) >= 1) pagina().scrollBy(0, resto);
  };
  const soltar = () => { raton = null; window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar); };
  vista.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    raton = { y: e.clientY }; arrastro = false;
    window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar);
  });
  vista.addEventListener('click', (e) => { if (arrastro) { e.preventDefault(); e.stopPropagation(); arrastro = false; } }, true);
  vista.addEventListener('keydown', (e) => {
    if (zoom && (e.key === '+' || e.key === '=')) { e.preventDefault(); escalar(ppm * ESCALA.paso); }
    else if (zoom && (e.key === '-' || e.key === '_')) { e.preventDefault(); escalar(ppm / ESCALA.paso); }
    else if ((e.key === 'Enter' || e.key === ' ') && e.target === vista) { e.preventDefault(); abrir(); } // en un bloque, Enter abre ese bloque
  });
  // Lleva la flecha de «ahora» a un tercio de la altura de la vista
  const irAhora = (suave = false) => {
    const l = lienzo(), f = vista.querySelector('[data-dia-ahora]');
    if (!l || !f) return;
    const i = Number(getComputedStyle(f).getPropertyValue('--i')) || 0;
    vista.scrollTo({ top: Math.max(0, l.offsetTop + i * ppm - vista.clientHeight / 3), behavior: suave ? 'smooth' : 'auto' });
  };
  return { irAhora, escala: () => ppm, acercar: () => escalar(ppm * ESCALA.paso), alejar: () => escalar(ppm / ESCALA.paso) };
}

// Tablero: la columna quieta no escucha gestos (arrastrar encima mueve la página como cualquier otra parte); Enter abre el horario
export function conectarQuieta(vista, abrir = () => { location.hash = '#/horario'; }) {
  vista.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === vista) { e.preventDefault(); abrir(); } });
}

// ---------------------------------------------------------------- Semana (Fabio, 16-nov-2026: «por semana como el de Google calendario»)
// Las 7 fechas (AAAA-MM-DD) de la semana de `fecha`, de domingo a sábado como la captura de Google Calendar que mandó Fabio
export function semanaDe(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  const base = Date.UTC(y, m - 1, d), dow = new Date(base).getUTCDay();
  return Array.from({ length: 7 }, (_, i) => new Date(base + (i - dow) * 864e5).toISOString().slice(0, 10));
}
// La agenda de cada día de la semana de `fecha` (por defecto, la de hoy), con las MISMAS reglas que la del día (construirAgenda):
// clases del horario según el día de la semana y el calendario institucional de ESE día, y los eventos de ese día. «Ahora» y
// «Siguiente» solo en hoy.
export function agendaSemana({ ahora, fecha: deLaSemana = null, bloques = [], etiquetar, diasSemana = [], eventos = [] }) {
  const hoy = enBogota(ahora);
  return semanaDe(deLaSemana || hoy.fecha).map((fecha) => {
    const esHoy = fecha === hoy.fecha;
    const a = construirAgenda({ ahora: esHoy ? ahora : `${fecha}T${hoy.hhmm}:00-05:00`, bloques, etiquetar, dia: diasSemana.find((x) => x.fecha === fecha) || null, eventos });
    if (!esHoy) for (const x of a.items) { delete x.actual; delete x.siguiente; }
    return { ...a, esHoy };
  });
}
// Horas de la semana: las de todos los días juntos (y la hora actual)
export const rangoSemana = (dias, ahoraMin) => rangoDia(dias.flatMap((a) => a.items), ahoraMin);

// Encabezado: nombre y número de cada día (hoy resaltado) y debajo, por día, el día de ciclo como lo imprime el calendario
// institucional («Día 4»; el ciclo completo va en el título), el tipo de día (festivo, receso…) y los eventos de todo el día.
export function cabeceraSemanaHTML(dias) {
  const chips = (a) => {
    const t = [];
    if (a.ciclo) t.push(`<span class="sem-chip ciclo" title="${a.ciclo.ciclo ? 'Ciclo ' + esc(a.ciclo.ciclo) + ' · ' : ''}Día ${esc(a.ciclo.dia)}">Día ${esc(a.ciclo.dia)}</span>`);
    if (a.tipoDia !== 'ordinario' && a.nota) t.push(`<span class="sem-chip tipo ${a.tipoDia}" title="${esc(a.nota)}">${esc(a.nota.split(':')[0])}</span>`);
    for (const x of a.todoElDia) t.push(`<a class="sem-chip evento" href="#/calendario?fecha=${a.fecha}" title="${esc(x.titulo)}">${esc(x.titulo)}</a>`);
    return t.join('');
  };
  // El ciclo de la semana arriba (Fabio, 15-nov: «debe aparecer el ciclo y día»): en cada día solo cabe «Día N»
  const ciclos = [...new Set(dias.map((a) => a.ciclo?.ciclo).filter((c) => c != null && c !== ''))];
  const titulo = ciclos.length === 1 ? `Ciclo ${esc(ciclos[0])}` : ciclos.length > 1 ? `Ciclos ${esc(ciclos[0])}–${esc(ciclos.at(-1))}` : '';
  return `${titulo ? `<p class="sem-titulo" data-sem-ciclo>${titulo}</p>` : ''}<div class="sem-cab">
      <span class="sem-hueco"></span>
      ${dias.map((a) => { const [y, m, d] = a.fecha.split('-').map(Number); const sem = SEMANA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
        return `<a class="sem-dia${a.esHoy ? ' hoy' : ''}" href="#/calendario?fecha=${a.fecha}" title="${esc(fechaLarga(a.fecha))}"${a.esHoy ? ' aria-current="date"' : ''}><span class="sem-nom">${sem}</span><b class="sem-num">${d}</b></a>`; }).join('')}
    </div>
    <div class="sem-todo">
      <span class="sem-hueco"></span>
      ${dias.map((a) => `<div class="sem-chips" data-fecha="${a.fecha}">${chips(a)}</div>`).join('')}
    </div>`;
}

// Lienzo de la semana: las líneas de las horas a lo ancho, una columna por día con sus bloques (los que se cruzan, lado a lado) y la
// flecha roja de «ahora» SOLO en la columna de hoy. Escala fija (--ppm), como la de entrada de la columna del día.
export function lienzoSemanaHTML(dias, rango, horaHoy) {
  const horas = [];
  for (let h = rango.ini; h <= rango.fin; h += 60) horas.push(h);
  const ahora = minutosDe(horaHoy);
  const bloque = (a, x) => {
    const que = `${fechaLarga(a.fecha)} · ${hhmm(x.ini)}${x.sinFin ? '' : '–' + hhmm(x.fin)} · ${x.titulo}${x.sub ? ' · ' + x.sub : ''}${x.actual ? ' · Ahora' : ''}${x.siguiente ? ' · Siguiente' : ''}${x.conflicto ? ' · Se cruza' : ''}${x.porConfirmar ? ' · Por confirmar' : ''}`;
    return `<a class="dia-bloque ${tono(x)}${x.carriles > 1 ? ' angosto' : ''}${x.actual ? ' actual' : ''}${x.conflicto ? ' conflicto' : ''}${x.porConfirmar ? ' por-confirmar' : ''}" draggable="false"
      href="${x.tipo === 'clase' ? '#/horario' : '#/calendario?fecha=' + a.fecha}" title="${esc(que)}" aria-label="${esc(que)}"
      style="--i:${x.ini - rango.ini};--d:${Math.max(x.fin - x.ini, 10)};--c:${x.carril};--n:${x.carriles}"><b>${esc(x.titulo)}</b></a>`;
  };
  return `<div class="dia-lienzo sem-lienzo" data-dia-lienzo data-ini="${rango.ini}" data-fin="${rango.fin}" style="--total:${rango.fin - rango.ini}">
    ${horas.map((h) => `<div class="dia-linea" style="--i:${h - rango.ini}"><span>${horaAmPm(h)}</span></div>`).join('')}
    <div class="sem-cols">${dias.map((a) => `<div class="sem-col${a.esHoy ? ' hoy' : ''}" data-fecha="${a.fecha}">${carriles(a.items).map((x) => bloque(a, x)).join('')}${a.esHoy ? `<div class="dia-ahora" data-dia-ahora style="--i:${ahora - rango.ini}" role="img" aria-label="Hora actual ${esc(horaHoy)}"><span class="dia-ahora-hora">${esc(horaHoy)}</span></div>` : ''}</div>`).join('')}</div>
  </div>`;
}
