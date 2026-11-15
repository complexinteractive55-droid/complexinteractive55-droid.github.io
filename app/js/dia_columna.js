// Columna del día en el Tablero de TODOS los perfiles (Fabio, 15-nov-2026: «en el tablero que aparece el día en el que se está… que una flecha me señale la
// hora que es y también actúe por gestos del usuario zoom, mover»). Es la misma agenda de hoy que el recuadro «Hoy» del docente
// (agenda_hoy.js: mis clases + calendario institucional + eventos), pintada como una columna de horas: cada bloque ocupa su franja,
// los que se cruzan van lado a lado, y una flecha roja marca la hora de Colombia (con la hora del servidor como referencia).
// Gestos SOLO dentro de la columna (nunca en toda la app): dos dedos acercan o alejan las horas; un dedo (o arrastrar con el ratón)
// la mueve; Ctrl + rueda (o el pellizco del panel táctil) acerca en el PC; botones − / ＋ / «Ahora» y teclas + / − para el teclado.
// Lo de calcular está en funciones puras (pruebas en pruebas/unitarias/dia_columna.test.mjs); lo de pintar y los gestos, abajo.
import { fechaLarga } from './agenda_hoy.js';

const SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hhmm = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
export const ESCALA = { min: 0.5, max: 4, base: 1.2, paso: 1.25 }; // píxeles por minuto (1,2 → una hora mide 72 px)
export const limitar = (ppm) => Math.round(Math.min(ESCALA.max, Math.max(ESCALA.min, Number(ppm) || ESCALA.base)) * 1000) / 1000;

// Horas que muestra la columna: por lo menos de 6:00 a 19:00, ampliadas para que quepan todos los bloques y la hora actual
export function rangoDia(items, ahoraMin, { desde = 6 * 60, hasta = 19 * 60 } = {}) {
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
  const sem = SEMANA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `<div class="dia-cab" title="${esc(fechaLarga(a.fecha))}"><span class="dia-semana">${sem}</span><b class="dia-num">${d}</b>
    ${a.ciclo ? `<span class="dia-ciclo">${a.ciclo.ciclo ? `Ciclo ${esc(a.ciclo.ciclo)} · ` : ''}Día ${esc(a.ciclo.dia)}</span>` : '<span class="dia-ciclo sin">Sin día de ciclo</span>'}</div>`;
}

// Lienzo de horas con los bloques y la flecha de «ahora». Las posiciones van en minutos (--i, --d) y la escala en --ppm (en la vista),
// así acercar o alejar solo cambia una variable y no hay que repintar.
export function lienzoHTML(a, rango) {
  const ahora = minutosDe(a.hora);
  const horas = [];
  for (let h = rango.ini; h <= rango.fin; h += 60) horas.push(h);
  const bloques = carriles(a.items);
  return `<div class="dia-lienzo" data-dia-lienzo data-ini="${rango.ini}" data-fin="${rango.fin}" style="--total:${rango.fin - rango.ini}">
    ${horas.map((h) => `<div class="dia-linea" style="--i:${h - rango.ini}"><span>${hhmm(h)}</span></div>`).join('')}
    <div class="dia-bloques">${bloques.map((x) => {
      const que = `${hhmm(x.ini)}${x.sinFin ? '' : '–' + hhmm(x.fin)} · ${x.titulo}${x.sub ? ' · ' + x.sub : ''}${x.actual ? ' · Ahora' : ''}${x.siguiente ? ' · Siguiente' : ''}${x.conflicto ? ' · Se cruza' : ''}${x.porConfirmar ? ' · Por confirmar' : ''}`;
      return `<a class="dia-bloque ${tono(x)}${x.carriles > 1 ? ' angosto' : ''}${x.actual ? ' actual' : ''}${x.conflicto ? ' conflicto' : ''}${x.porConfirmar ? ' por-confirmar' : ''}" draggable="false"
        href="${x.tipo === 'clase' ? '#/horario' : '#/calendario?fecha=' + a.fecha}" title="${esc(que)}" aria-label="${esc(que)}"
        style="--i:${x.ini - rango.ini};--d:${Math.max(x.fin - x.ini, 10)};--c:${x.carril};--n:${x.carriles}">
        <b>${esc(x.titulo)}</b><small>${x.actual ? '<i class="dia-etq">Ahora</i> ' : x.siguiente ? '<i class="dia-etq sig">Siguiente</i> ' : ''}${hhmm(x.ini)}${x.sinFin ? '' : '–' + hhmm(x.fin)}${x.sub ? ' · ' + esc(x.sub) : ''}</small></a>`;
    }).join('')}</div>
    <div class="dia-ahora" data-dia-ahora style="--i:${ahora - rango.ini}" role="img" aria-label="Hora actual ${esc(a.hora)}"><span class="dia-ahora-hora">${esc(a.hora)}</span></div>
  </div>`;
}

// sola: la columna va sin tarjetas al lado (estudiante, familia) y tiene alto propio
export const columnaCaja = ({ sola = false } = {}) => `
  <section class="dia-col${sola ? ' dia-sola' : ''}" data-dia-col aria-labelledby="dia-col-titulo">
    <h2 class="oculto-visual" id="dia-col-titulo">Mi día</h2>
    <div data-dia-cab><div class="dia-cab"><span class="dia-semana">…</span></div></div>
    <div class="dia-acciones"><button type="button" class="btn btn-chico" data-dia-menos aria-label="Alejar las horas">−</button><button type="button" class="btn btn-chico" data-dia-ahora-btn>Ahora</button><button type="button" class="btn btn-chico" data-dia-mas aria-label="Acercar las horas">＋</button></div>
    <div data-dia-notas></div>
    <div class="dia-vista" data-dia-vista tabindex="0" role="group" aria-label="Mi día por horas. Dos dedos o las teclas + y − acercan o alejan; arrastra para moverte. Enter abre el horario completo.">
      <p class="ayuda dia-cargando">Cargando…</p>
    </div>
  </section>`;

// Notas sobre la columna: tipo de día (festivo, jornada especial…), eventos de todo el día y «sin nada hoy»
export function notasHTML(a) {
  return `${a.nota ? `<p class="dia-nota ${a.tipoDia}" role="note">${esc(a.nota)}</p>` : ''}
    ${a.todoElDia.map((x) => `<a class="dia-todo" href="#/calendario?fecha=${a.fecha}">📌 ${esc(x.titulo)}</a>`).join('')}
    ${!a.items.length ? `<p class="ayuda dia-vacio">${a.tipoDia === 'sin_clases' ? 'Sin clases hoy.' : 'Hoy no tienes clases ni eventos.'}</p>` : ''}`;
}

// ---------------------------------------------------------------- Gestos (solo dentro de la vista de la columna)
export function conectarColumna(vista, { inicial = ESCALA.base, alCambiar = () => {}, abrir = () => { location.hash = '#/horario'; } } = {}) {
  let ppm = limitar(inicial), pinza = null, raton = null, arrastro = false;
  const lienzo = () => vista.querySelector('[data-dia-lienzo]');
  const aplicar = () => { vista.style.setProperty('--ppm', ppm); vista.dataset.ppm = ppm; };
  // Cambia la escala dejando quieto el minuto que está bajo `ay` (píxeles desde el borde de arriba de la vista)
  const escalar = (nuevo, ay = vista.clientHeight / 2) => {
    nuevo = limitar(nuevo);
    if (nuevo === ppm) return;
    const arriba = lienzo()?.offsetTop || 0; // el lienzo empieza un poco más abajo del borde de la vista
    const minuto = (vista.scrollTop + ay - arriba) / ppm;
    ppm = nuevo; aplicar();
    vista.scrollTop = minuto * ppm + arriba - ay;
    alCambiar(ppm);
  };
  aplicar();
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const medioY = (t) => (t[0].clientY + t[1].clientY) / 2 - vista.getBoundingClientRect().top;
  // Dedos: uno mueve (desplazamiento nativo, touch-action: pan-y); dos acercan o alejan alrededor del punto medio
  vista.addEventListener('touchstart', (e) => { if (e.touches.length >= 2) pinza = { d: dist(e.touches), ppm }; }, { passive: true });
  vista.addEventListener('touchmove', (e) => {
    if (e.touches.length < 2 || !pinza) return;
    e.preventDefault();
    escalar(pinza.ppm * dist(e.touches) / pinza.d, medioY(e.touches));
  }, { passive: false });
  vista.addEventListener('touchend', (e) => { if (e.touches.length < 2) pinza = null; });
  // PC: Ctrl + rueda o pellizco del panel táctil (llega como rueda con Ctrl). La rueda sola desplaza como siempre.
  vista.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    escalar(ppm * Math.exp(-e.deltaY * 0.01), e.clientY - vista.getBoundingClientRect().top);
  }, { passive: false });
  // Ratón: arrastrar mueve la columna; si hubo arrastre, el clic que sigue no abre el bloque
  const mover = (e) => { if (!raton) return; const dy = e.clientY - raton.y; if (Math.abs(dy) > 4) arrastro = true; if (arrastro) vista.scrollTop = raton.top - dy; };
  const soltar = () => { raton = null; window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar); };
  vista.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    raton = { y: e.clientY, top: vista.scrollTop }; arrastro = false;
    window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar);
  });
  vista.addEventListener('click', (e) => { if (arrastro) { e.preventDefault(); e.stopPropagation(); arrastro = false; } }, true);
  vista.addEventListener('keydown', (e) => {
    if (e.key === '+' || e.key === '=') { e.preventDefault(); escalar(ppm * ESCALA.paso); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); escalar(ppm / ESCALA.paso); }
    else if ((e.key === 'Enter' || e.key === ' ') && e.target === vista) { e.preventDefault(); abrir(); } // en un bloque, Enter abre ese bloque
  });
  // Lleva la flecha de «ahora» a un tercio de la altura de la vista
  const irAhora = (suave = false) => {
    const l = lienzo(), f = vista.querySelector('[data-dia-ahora]');
    if (!l || !f) return;
    const i = Number(getComputedStyle(f).getPropertyValue('--i')) || 0;
    vista.scrollTo({ top: Math.max(0, l.offsetTop + i * ppm - vista.clientHeight / 3), behavior: suave ? 'smooth' : 'auto' });
  };
  return { acercar: () => escalar(ppm * ESCALA.paso), alejar: () => escalar(ppm / ESCALA.paso), irAhora, escala: () => ppm, escalar };
}
