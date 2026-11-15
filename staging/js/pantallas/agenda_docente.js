// Recuadro «Hoy» en la cartelera del docente (input de desarrollo 2-nov-2026 §7): carga sus clases de hoy de la MISMA fuente que
// «Mi horario», el día del calendario institucional y los eventos de hoy (del colegio para todo el colegio o sus cursos, y los suyos).
// Se actualiza solo: cada 30 s (ahora / siguiente), a medianoche de Colombia (otro día), al volver a la pestaña o al recuperar el foco.
import { E, misAsignaciones } from '../estado.js';
import { enBogota, construirAgenda, agendaHTML, conectarGestos } from '../agenda_hoy.js';

export const agendaCaja = () => `
  <section class="tarjeta agenda-hoy" data-agenda-hoy aria-labelledby="agenda-titulo">
    <div class="tarjeta-cab"><h2 id="agenda-titulo">Hoy</h2>
      <span class="agenda-acciones"><button type="button" class="btn btn-chico" data-agenda-menos aria-label="Alejar la agenda">−</button><button type="button" class="btn btn-chico" data-agenda-mas aria-label="Acercar la agenda">＋</button><a class="btn btn-chico" href="#/horario">Horario completo</a></span></div>
    <div class="agenda-caja" data-agenda-caja tabindex="0" role="group" aria-label="Agenda de hoy. Toca o pulsa Enter para abrir el horario completo.">
      <div class="agenda-zoom" data-agenda-zoom><div data-agenda-cuerpo aria-live="polite"><p class="ayuda">Cargando la agenda de hoy…</p></div></div>
    </div>
    <p class="ayuda agenda-pie">Con dos dedos puedes acercar el recuadro. <a href="#/calendario">Ver el calendario</a></p>
  </section>`;

// Fuente de «hoy» (la misma para el recuadro «Hoy» del docente y la columna del día del Tablero): mis clases de hoy (horario_bloques
// de mis asignaciones), el día del calendario institucional y los eventos de hoy (del colegio, de mis cursos y los míos), con la hora
// del servidor como referencia. f.cargar() trae los datos; f.ahora() es el instante de referencia; f.datos y f.cargadoPara, lo cargado.
export function fuenteDeHoy(b) {
  const mias = misAsignaciones(b);
  const misCursos = new Set(mias.map((a) => a.curso_id));
  const etiquetar = (x) => {
    const a = b.asignacionPorId.get(x.asignacion_id);
    return { titulo: (a && b.materiaPorId.get(a.materia_id)?.nombre) || x.titulo || 'Clase', sub: [a ? 'Curso ' + (b.cursoPorId.get(a.curso_id)?.nombre || '') : '', x.aula].filter(Boolean).join(' · '), descanso: !a };
  };
  let desfase = 0;
  const f = { etiquetar, datos: null, cargadoPara: null, ahora: () => new Date(Date.now() + desfase).toISOString() };
  f.cargar = async function cargar() {
    // Referencia horaria: la del servidor (el reloj del equipo puede estar mal); sin red o sin la función, la del equipo
    const t0 = Date.now();
    const srv = await E.db.rpc('hora_servidor').catch(() => null);
    if (srv) desfase = new Date(srv).getTime() - (t0 + Date.now()) / 2;
    const hoy = enBogota(f.ahora()).fecha;
    const [bloques, dias, eventos, propios] = await Promise.all([
      mias.length ? E.db.select('horario_bloques', { in: { asignacion_id: mias.map((a) => a.id) } }) : [],
      E.db.select('calendario_dias', { eq: { colegio_id: E.colegio.id, fecha: hoy, vigente: true } }).catch(() => []),
      E.db.select('eventos', { eq: { colegio_id: E.colegio.id } }).catch(() => []),
      E.db.select('eventos_personales', { eq: { colegio_id: E.colegio.id, perfil_id: E.yo.id } }).catch(() => []),
    ]);
    f.datos = { bloques, dia: dias[0] || null, eventos: [
      ...eventos.filter((e) => !e.curso_id || misCursos.has(e.curso_id)).map((e) => ({ ...e, origen: e.curso_id ? 'Curso ' + (b.cursoPorId.get(e.curso_id)?.nombre || '') : 'Colegio' })),
      ...propios.map((e) => ({ ...e, origen: 'Mi agenda' }))] };
    f.cargadoPara = hoy;
  };
  return f;
}

// Mantiene al día lo que pinta `pintar`: cada 30 s, a medianoche de Colombia (vuelve a cargar), al volver a la pestaña o al foco.
// Si `sec` ya no está en la página, deja de escuchar.
export function alDia(sec, f, pintar) {
  let ocupado = false;
  const refrescar = async () => {
    if (!document.body.contains(sec)) { soltar(); return; }
    if (document.visibilityState !== 'visible' || ocupado) return;
    ocupado = true;
    try { if (enBogota(f.ahora()).fecha !== f.cargadoPara) await f.cargar(); pintar(); } catch {} finally { ocupado = false; }
  };
  const reloj = setInterval(refrescar, 30000);
  const soltar = () => { clearInterval(reloj); document.removeEventListener('visibilitychange', refrescar); window.removeEventListener('focus', refrescar); };
  document.addEventListener('visibilitychange', refrescar);
  window.addEventListener('focus', refrescar);
}

export async function montarAgenda(sec, b) {
  const f = fuenteDeHoy(b);
  const cuerpo = sec.querySelector('[data-agenda-cuerpo]');
  const pintar = () => { if (f.datos) cuerpo.innerHTML = agendaHTML(construirAgenda({ ahora: f.ahora(), ...f.datos, etiquetar: f.etiquetar })); };
  const z = conectarGestos(sec.querySelector('[data-agenda-caja]'), sec.querySelector('[data-agenda-zoom]'), () => { location.hash = '#/horario'; });
  sec.querySelector('[data-agenda-mas]').onclick = z.acercar;
  sec.querySelector('[data-agenda-menos]').onclick = z.alejar;
  try { await f.cargar(); pintar(); }
  catch (e) { cuerpo.innerHTML = '<p class="ayuda">No se pudo cargar la agenda de hoy. <a href="#/horario">Abrir el horario</a></p>'; return; }
  alDia(sec, f, pintar);
}
