// Agenda de HOY en la cartelera del docente (input de desarrollo 2-nov-2026 §7). Misma fuente de verdad que «Mi horario»
// (horario_bloques de sus asignaciones, por día de la semana) + el calendario institucional del día (calendario_dias: festivo,
// receso, jornada, X-DAY…, y el día de ciclo SOLO si la fuente lo imprime: nunca se calcula) + los eventos del día (del colegio y
// los propios: reuniones, tutorías). Hora y fecha de Colombia (America/Bogota), con la hora del servidor como referencia.
// Lo de calcular está en funciones puras (pruebas en pruebas/unitarias/agenda_hoy.test.mjs); lo de pintar y los gestos, abajo.
import { CATEGORIA } from './calendario_importar.js';

export const ZONA = 'America/Bogota';
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Un instante → fecha y hora en Bogotá (no la del equipo): { fecha 'AAAA-MM-DD', dia 1..7 (lunes = 1), hhmm, min (minutos del día) }
export function enBogota(instante) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' })
    .formatToParts(new Date(instante)).map((x) => [x.type, x.value]));
  const h = Number(p.hour) % 24, m = Number(p.minute);
  const dia = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday];
  return { fecha: `${p.year}-${p.month}-${p.day}`, dia, hhmm: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, min: h * 60 + m };
}
const minDe = (hhmm) => { const [h, m] = String(hhmm || '').slice(0, 5).split(':').map(Number); return h * 60 + m; };
const hhmm = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
export const fechaLarga = (fecha) => { const [y, m, d] = fecha.split('-').map(Number); return `${DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} de ${MESES[m - 1]}`; };

// Tipo de día según el calendario institucional (si no hay registro de ese día, NO se supone nada: «ordinario» sin nota)
export function tipoDeDia(dia) {
  const cat = dia ? CATEGORIA[dia.tipo] : null;
  if (cat === 'festivo' || cat === 'receso') return { tipo: 'sin_clases', nota: `${dia.tipo}: según el calendario institucional no hay clases.` };
  if (cat === 'jornada') return { tipo: 'sin_clases', nota: `${dia.tipo}: según el calendario institucional no hay clases con estudiantes.` };
  if (cat === 'especial') return { tipo: 'especial', nota: `${dia.tipo}: jornada especial.${dia.horario_texto ? ' Horario del calendario: ' + dia.horario_texto + '.' : ''} El horario regular puede no aplicar hoy.` };
  return { tipo: 'ordinario', nota: dia && dia.descripcion && cat === 'actividad' ? dia.descripcion : '' };
}

// Arma la agenda del día. bloques: horario_bloques del docente; etiquetar(b) → { titulo, sub }; dia: calendario_dias vigente de hoy
// (o null); eventos: [{ titulo, inicio, fin, todo_el_dia, origen }] (los que caen hoy en Bogotá). ahora = instante de referencia.
export function construirAgenda({ ahora, bloques = [], etiquetar = (b) => ({ titulo: b.titulo || 'Clase', sub: '' }), dia = null, eventos = [] }) {
  const hoy = enBogota(ahora);
  const td = tipoDeDia(dia && dia.fecha === hoy.fecha ? dia : null);
  const items = [];
  if (td.tipo !== 'sin_clases') {
    for (const b of bloques.filter((x) => x.dia === hoy.dia)) {
      const e = etiquetar(b);
      items.push({ tipo: 'clase', ini: minDe(b.hora_inicio), fin: minDe(b.hora_fin), titulo: e.titulo, sub: e.sub, porConfirmar: td.tipo === 'especial' });
    }
  }
  const todoElDia = [];
  // Un evento de día completo guardado como medianoche UTC es una FECHA: no se corre al día anterior por la zona horaria (§7.3)
  const soloFecha = (iso) => /T00:00(:00(\.0+)?)?(Z|\+00(:00)?)$/.test(String(iso || ''));
  for (const ev of eventos) {
    const i = ev.todo_el_dia && soloFecha(ev.inicio) ? { fecha: String(ev.inicio).slice(0, 10), min: 0 } : enBogota(ev.inicio);
    const f = !ev.fin ? null : ev.todo_el_dia && soloFecha(ev.fin) ? { fecha: String(ev.fin).slice(0, 10), min: 0 } : enBogota(ev.fin);
    if (i.fecha > hoy.fecha || (f ? f.fecha : i.fecha) < hoy.fecha) continue; // no es de hoy
    if (ev.todo_el_dia || i.fecha < hoy.fecha) { todoElDia.push({ tipo: 'evento', titulo: ev.titulo, sub: ev.origen || '', todoElDia: true }); continue; }
    items.push({ tipo: 'evento', ini: i.min, fin: f && f.fecha === hoy.fecha ? Math.max(f.min, i.min) : i.min + 60, titulo: ev.titulo, sub: ev.origen || '', sinFin: !ev.fin });
  }
  items.sort((a, z) => a.ini - z.ini || a.fin - z.fin);
  // Cruces: se MUESTRAN en los dos (no se corrige nada)
  for (let a = 0; a < items.length; a++) for (let z = a + 1; z < items.length; z++) {
    if (items[a].ini < items[z].fin && items[z].ini < items[a].fin) { items[a].conflicto = true; items[z].conflicto = true; }
  }
  // Ahora y siguiente: solo en un día ordinario (en una jornada especial el horario regular está por confirmar)
  if (td.tipo === 'ordinario') {
    for (const x of items) if (x.ini <= hoy.min && hoy.min < x.fin) x.actual = true;
    const sig = items.find((x) => x.ini > hoy.min);
    if (sig) sig.siguiente = true;
  }
  return {
    fecha: hoy.fecha, hora: hoy.hhmm, tipoDia: td.tipo, nota: td.nota,
    ciclo: dia && dia.fecha === hoy.fecha && dia.dia_ciclo ? { dia: dia.dia_ciclo, ciclo: dia.ciclo || null } : null,
    todoElDia, items, vacio: !items.length && !todoElDia.length,
  };
}

// ---------------------------------------------------------------- Pintar
export function agendaHTML(a) {
  const estado = (x) => [x.actual ? '<span class="agenda-etq ahora">Ahora</span>' : '', x.siguiente ? '<span class="agenda-etq sig">Siguiente</span>' : '',
    x.conflicto ? '<span class="agenda-etq cruce">⚠ Se cruza</span>' : '', x.porConfirmar ? '<span class="agenda-etq conf">Por confirmar</span>' : ''].join('');
  return `
    <p class="agenda-fecha"><b>${esc(fechaLarga(a.fecha))}</b> · <span data-agenda-hora>${esc(a.hora)}</span> · ${a.ciclo ? `Día de ciclo ${a.ciclo.dia}${a.ciclo.ciclo ? ` (ciclo ${a.ciclo.ciclo})` : ''}` : 'Día de ciclo: no disponible'}</p>
    ${a.nota ? `<p class="agenda-nota ${a.tipoDia}" role="note">${esc(a.nota)}</p>` : ''}
    ${a.todoElDia.length ? `<ul class="agenda-todo-dia">${a.todoElDia.map((x) => `<li>📌 <b>${esc(x.titulo)}</b>${x.sub ? ` <small>${esc(x.sub)}</small>` : ''} <small>(todo el día)</small></li>`).join('')}</ul>` : ''}
    ${a.items.length ? `<ol class="agenda-lista">${a.items.map((x) => `
      <li class="agenda-item ${x.tipo}${x.actual ? ' actual' : ''}${x.siguiente ? ' siguiente' : ''}${x.conflicto ? ' conflicto' : ''}${x.porConfirmar ? ' por-confirmar' : ''}">
        <span class="agenda-hora">${hhmm(x.ini)}${x.sinFin ? '' : '–' + hhmm(x.fin)}</span>
        <span class="agenda-que"><b>${esc(x.titulo)}</b>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</span>
        <span class="agenda-estados">${estado(x)}</span>
      </li>`).join('')}</ol>`
      : `<p class="ayuda agenda-vacia">${a.tipoDia === 'sin_clases' ? 'Sin clases hoy.' : a.vacio ? 'Hoy no tienes clases asignadas en el horario ni eventos.' : 'Sin clases asignadas hoy.'}</p>`}`;
}

// Gestos dentro del recuadro (§7.5): dos dedos acercan o alejan SOLO el recuadro; arrastrar desplaza la página como siempre; un
// toque deliberado (sin moverse, corto) abre el horario completo. Nada de esto navega por accidente. Botones − / + y Enter para
// quien usa teclado o lector de pantalla. Las escuchas son del recuadro: al repintar, se van con él (no se acumulan).
export function conectarGestos(caja, zoomEl, abrir, { umbral = 10, toqueMax = 600 } = {}) {
  let escala = 1, ini = null, pinza = null, huboPinza = false, ultimoToque = 0;
  const poner = (e) => { escala = Math.round(Math.min(2, Math.max(1, e)) * 100) / 100; zoomEl.style.setProperty('--agenda-escala', escala); caja.dataset.escala = escala; };
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  caja.addEventListener('touchstart', (e) => {
    if (e.touches.length >= 2) { pinza = { d: dist(e.touches), e: escala }; huboPinza = true; ini = null; return; }
    if (e.touches.length === 1) { ini = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now(), movio: false }; huboPinza = false; }
  }, { passive: true });
  caja.addEventListener('touchmove', (e) => {
    if (e.touches.length >= 2 && pinza) { e.preventDefault(); poner(pinza.e * dist(e.touches) / pinza.d); return; }
    if (ini && e.touches.length === 1 && Math.hypot(e.touches[0].clientX - ini.x, e.touches[0].clientY - ini.y) > umbral) ini.movio = true;
  }, { passive: false });
  caja.addEventListener('touchend', (e) => {
    if (e.touches.length) return;
    ultimoToque = Date.now();
    const toque = ini && !ini.movio && !huboPinza && Date.now() - ini.t <= toqueMax;
    ini = null; pinza = null;
    if (toque) abrir();
  });
  caja.addEventListener('click', (e) => { if (Date.now() - ultimoToque < 800) return; if (!e.target.closest('a, button')) abrir(); }); // ratón (el toque ya se atendió arriba)
  caja.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } });
  return { acercar: () => poner(escala + 0.25), alejar: () => poner(escala - 0.25), escala: () => escala };
}
