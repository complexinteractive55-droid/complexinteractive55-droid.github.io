// Comunidad > Calendario (REA Phidias §3.2): vistas Mes y Agenda, capas de color
// (eventos del colegio por tipo y tareas por estudiante), navegación ‹ Hoy ›, exportar .ics.
// 29-oct-2026: tarjeta «Hoy» y cronograma institucional importado del Excel (capas propias, separadas de los eventos que
// crea el administrador), y reuniones privadas de cada persona (solo las ve su dueño). Ver calendario_importar.js.
import { E, base, misEstudiantes, perfiles, misAsignaciones, pref } from '../estado.js';
import { esc, aviso, ventana, leerForm, confirmar, nombre, vacio, fecha, fechaHora } from '../ui.js';
import { cabecera, camposHTML } from './comun.js';
import { leerXlsx, leerCronograma, planImportacion, paraImportar, sha256, hoyDe, fechaBogota, diaSemana } from '../calendario_importar.js';

const TIPOS = {
  institucional: ['Institucional', '#1f4fd1'], reunion: ['Reunión', '#7a4fa3'], festivo: ['Festivo / sin clases', '#c62828'],
  evaluacion: ['Evaluaciones', '#b26a00'], cultural: ['Cultural', '#2f8f6a'], deportivo: ['Deportivo', '#2f7f8f'],
};
const COLOR_TAREAS = ['#e0752d', '#8a5cf6', '#14a37f', '#d6457a'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const clave = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Cronograma institucional importado: capas propias. La «etiqueta de día» (solo «Día N», sin evento) no es un evento:
// se ve como la marca de día de ciclo en la casilla. Sin hora en la fuente → «hora no indicada» (no «todo el día»).
const CAPAS_CRONO = {
  cr_actividad: ['Cronograma: actividades', '#3b5ba5'], cr_especial: ['Cronograma: jornadas especiales', '#8e44ad'],
  cr_festivo: ['Cronograma: festivos y recesos', '#c0392b'],
};
const capaCrono = (d) => (d.categoria === 'festivo' || d.categoria === 'receso' ? 'cr_festivo' : d.especial ? 'cr_especial' : 'cr_actividad');
const ESPECIALES_CRONO = new Set(['X-DAY', 'Adaptación', 'Día de la Fantasía', 'Jornada pedagógica', 'Receso escolar', 'Festivo']);
const CATEGORIA_CRONO = { 'Festivo': 'festivo', 'Receso escolar': 'receso' };
const primeraLinea = (s) => String(s || '').split('\n')[0].trim();
async function cargarCronograma() {
  const eq = { colegio_id: E.colegio.id };
  const [dias, anotaciones, fuentes] = await Promise.all([
    E.db.select('calendario_dias', { eq: { ...eq, vigente: true }, order: 'fecha' }).catch(() => []),
    E.db.select('calendario_anotaciones', { eq }).catch(() => []),
    E.db.select('calendario_fuentes', { eq }).catch(() => []),
  ]);
  for (const d of dias) { d.especial = ESPECIALES_CRONO.has(d.tipo); d.categoria = CATEGORIA_CRONO[d.tipo] || ''; d.fuente = fuentes.find((f) => f.id === d.fuente_id) || null; }
  return { dias, anotaciones: anotaciones.filter((a) => a.estado !== 'descartada'), fuentes };
}

async function cargarItems(b, crono) {
  const eventos = await E.db.select('eventos', { eq: { colegio_id: E.colegio.id } });
  const items = eventos.map((e) => ({ tipo: 'evento', capa: 'ev_' + e.tipo, color: TIPOS[e.tipo]?.[1] || '#1f4fd1', titulo: e.titulo, cuando: e.inicio, todo: e.todo_el_dia, dato: e,
    sub: e.curso_id ? 'Curso ' + (b.cursoPorId.get(e.curso_id)?.nombre || '') : '' }));
  const capas = Object.entries(TIPOS).map(([k, [t, c]]) => ({ id: 'ev_' + k, nombre: t, color: c }));
  // Cronograma institucional (importado): una capa por clase de registro
  if (crono.dias.length) {
    for (const [k, [t, c]] of Object.entries(CAPAS_CRONO)) capas.push({ id: k, nombre: t, color: c });
    for (const d of crono.dias.filter((x) => x.tipo !== 'Etiqueta de día sin evento')) {
      const capa = capaCrono(d);
      items.push({ tipo: 'crono', capa, color: CAPAS_CRONO[capa][1], titulo: primeraLinea(d.descripcion) || d.tipo, cuando: d.fecha + 'T12:00:00', todo: true, dato: d,
        hora: d.horario_texto ? 'Horario según la fuente: ' + d.horario_texto : 'Hora no indicada en la fuente', sub: d.especial ? d.tipo : '' });
    }
  }
  // Reuniones privadas: solo las mías (la base no deja ver las de otros)
  const propias = await E.db.select('eventos_personales', { eq: { colegio_id: E.colegio.id, perfil_id: E.yo.id } }).catch(() => []);
  capas.push({ id: 'personal', nombre: 'Mis reuniones (privadas)', color: '#5d6d7e' });
  for (const x of propias) items.push({ tipo: 'personal', capa: 'personal', color: '#5d6d7e', titulo: '🔒 ' + x.titulo, cuando: x.inicio, todo: x.todo_el_dia, dato: x, sub: 'Privada: solo la ves tú' });
  // tareas: por cada estudiante visible (familia) o por mis clases (profesor)
  let grupos = [];
  if (E.rol === 'profesor') grupos = [{ id: 'yo', nombre: 'Mis tareas', asigs: misAsignaciones(b).map((a) => a.id) }];
  else if (E.rol !== 'admin') {
    const ests = await misEstudiantes();
    await perfiles(ests);
    const mats = ests.length ? (await E.db.select('matriculas', { in: { estudiante_id: ests } })).filter((x) => x.estado === 'activa') : [];
    grupos = ests.map((id) => {
      const cursos = new Set(mats.filter((x) => x.estudiante_id === id).map((x) => x.curso_id));
      return { id, nombre: 'Tareas de ' + (E.perfiles.get(id)?.nombres || ''), asigs: b.asignaciones.filter((a) => cursos.has(a.curso_id)).map((a) => a.id) };
    });
  }
  const todas = [...new Set(grupos.flatMap((g) => g.asigs))];
  const tareas = todas.length ? await E.db.select('tareas', { in: { asignacion_id: todas } }) : [];
  // Exámenes (capa propia por persona, como Phidias: "examenes (NOMBRE)")
  const examenes = todas.length ? (await E.db.select('examenes', { in: { asignacion_id: todas } }).catch(() => [])).filter((x) => (E.rol === 'profesor' || (x.publicado && new Date(x.abre) <= new Date())) && (x.cierra || x.abre)) : [];
  grupos.forEach((g, i) => {
    const c = COLOR_TAREAS[i % COLOR_TAREAS.length];
    capas.push({ id: 'ta_' + g.id, nombre: g.nombre, color: c });
    for (const t of tareas.filter((x) => g.asigs.includes(x.asignacion_id) && x.entrega_en)) {
      const a = b.asignacionPorId.get(t.asignacion_id);
      items.push({ tipo: 'tarea', capa: 'ta_' + g.id, color: c, titulo: '📝 ' + t.titulo, cuando: t.entrega_en, todo: false, dato: t,
        sub: (b.materiaPorId.get(a?.materia_id)?.nombre || '') + (E.rol === 'profesor' ? ' · ' + (b.cursoPorId.get(a?.curso_id)?.nombre || '') : '') });
    }
    const exG = examenes.filter((x) => g.asigs.includes(x.asignacion_id));
    if (exG.length) {
      const cE = COLOR_TAREAS[(i + 3) % COLOR_TAREAS.length];
      capas.push({ id: 'ex_' + g.id, nombre: g.nombre.replace(/^Tareas/, 'Exámenes').replace(/^Mis tareas/, 'Mis exámenes'), color: cE });
      for (const x of exG) {
        const a = b.asignacionPorId.get(x.asignacion_id);
        items.push({ tipo: 'examen', capa: 'ex_' + g.id, color: cE, titulo: '🧪 ' + x.titulo, cuando: x.cierra || x.abre, todo: false, dato: x,
          sub: (b.materiaPorId.get(a?.materia_id)?.nombre || '') + (x.cierra ? ' · fecha límite' : ' · disponible') });
      }
    }
  });
  // Mensajes "marcados en el calendario" (REA Phidias): los que recibí y los que envié
  const recibidos = (await E.db.select('mensaje_destinatarios', { eq: { perfil_id: E.yo.id } }).catch(() => [])).filter((d) => !d.eliminado).map((d) => d.mensaje_id);
  const [deOtros, mios] = await Promise.all([
    recibidos.length ? E.db.select('mensajes', { in: { id: recibidos } }).catch(() => []) : [],
    E.db.select('mensajes', { eq: { autor_id: E.yo.id } }).catch(() => []),
  ]);
  const ahoraIso = new Date().toISOString();
  const conEvento = [...new Map([...deOtros, ...mios].filter((x) => x.evento_inicio && (!x.expira_en || x.expira_en > ahoraIso || x.autor_id === E.yo.id)).map((x) => [x.id, x])).values()];
  if (conEvento.length) {
    // como Phidias: cada tipo de mensaje es una capa con su color
    const tiposMsg = await E.db.select('tipos_mensaje', { eq: { colegio_id: E.colegio.id }, order: 'orden' }).catch(() => []);
    for (const x of conEvento) {
      const tm = tiposMsg.find((t) => t.id === x.tipo_id);
      const capa = tm ? 'msg-' + tm.id : 'msg', color = tm?.color || '#7a3fd1';
      if (!capas.some((k) => k.id === capa)) capas.push({ id: capa, nombre: tm?.nombre || 'Mensajes', color });
      items.push({ tipo: 'mensaje', capa, color, titulo: '✉️ ' + x.asunto, cuando: x.evento_inicio, todo: x.evento_todo_el_dia !== false, dato: x, sub: tm?.nombre || 'Mensaje' });
    }
  }
  return { items, capas };
}

export async function calendario(m, p) {
  const b = await base();
  const vista = p.vista === 'agenda' ? 'agenda' : 'mes';
  const ref = p.fecha ? new Date(p.fecha + 'T12:00:00') : new Date();
  const crono = await cargarCronograma();
  const { items, capas } = await cargarItems(b, crono);
  const cronoDe = new Map(crono.dias.map((d) => [d.fecha, d]));
  const anotDe = (f) => crono.anotaciones.filter((a) => a.fecha === f);
  // «Hoy» en la hora de Bogotá (en el demo se puede fijar con ?hoy=AAAA-MM-DD para probar otra fecha)
  const ahora = E.db.modo === 'demo' && /^\d{4}-\d{2}-\d{2}$/.test(p.hoy || '') ? new Date(p.hoy + 'T17:00:00Z') : new Date();
  const hoy = hoyDe(crono.dias, crono.anotaciones, ahora);
  const staff = ['admin', 'profesor', 'director_seccion', 'enfermeria'].includes(E.rol);
  const ocultas = new Set(pref('cal_ocultas') || []);
  const visibles = items.filter((x) => !ocultas.has(x.capa));
  const porDia = new Map();
  for (const x of visibles) { const k = clave(new Date(x.cuando)); if (!porDia.has(k)) porDia.set(k, []); porDia.get(k).push(x); }
  const mover = (meses) => { const d = new Date(ref); d.setDate(1); d.setMonth(d.getMonth() + meses); return clave(d); };
  const ruta = (f, v = vista) => `#/calendario?vista=${v}&fecha=${f}`;

  let cuerpo = '';
  if (vista === 'mes') {
    const ini = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const desde = new Date(ini); desde.setDate(1 - ((ini.getDay() + 6) % 7)); // lunes
    const celdas = [];
    for (let i = 0; i < 42; i++) { const d = new Date(desde); d.setDate(desde.getDate() + i); celdas.push(d); }
    const hoyK = hoy.fecha;
    cuerpo = `<div class="mes">${DIAS.map((d) => `<div class="mes-dia-nombre">${d}</div>`).join('')}${celdas.map((d) => {
      const k = clave(d), lista = porDia.get(k) || [], cr = cronoDe.get(k);
      const marca = cr && (cr.dia_ciclo != null || cr.ciclo != null) ? `<span class="mes-ciclo" title="Impreso en el cronograma">${cr.ciclo != null ? `C${cr.ciclo}·` : ''}D${cr.dia_ciclo ?? '?'}</span>` : '';
      return `<button class="mes-celda ${d.getMonth() !== ref.getMonth() ? 'fuera' : ''} ${k === hoyK ? 'hoy' : ''} ${d.getDay() === 0 || d.getDay() === 6 ? 'finde' : ''} ${cr?.especial ? 'especial' : ''}" data-dia="${k}" aria-label="${d.getDate()} de ${MESES[d.getMonth()]}${cr?.dia_ciclo != null ? ', día ' + cr.dia_ciclo + ' del ciclo' : ''}${lista.length ? ', ' + lista.length + ' evento(s)' : ''}">
        <span class="mes-num">${d.getDate()}</span>${marca}
        ${lista.slice(0, 3).map((x) => `<span class="mes-ev" style="background:${x.color}">${esc(x.titulo)}</span>`).join('')}
        ${lista.length > 3 ? `<span class="mes-mas">+${lista.length - 3}</span>` : ''}
        ${lista.length ? `<span class="mes-puntos">${lista.slice(0, 4).map((x) => `<i style="background:${x.color}"></i>`).join('')}</span>` : ''}
      </button>`;
    }).join('')}</div>`;
  } else {
    const desde = new Date(ref); desde.setHours(0, 0, 0, 0);
    const prox = visibles.filter((x) => new Date(x.cuando) >= desde).sort((x, y) => (x.cuando > y.cuando ? 1 : -1)).slice(0, 60);
    const dias = new Map();
    for (const x of prox) { const k = clave(new Date(x.cuando)); if (!dias.has(k)) dias.set(k, []); dias.get(k).push(x); }
    cuerpo = dias.size ? [...dias.entries()].map(([k, l]) => `
      <h3 class="sub">${fecha(k)}</h3>
      <div class="lista">${l.map((x) => itemHTML(x)).join('')}</div>`).join('') : vacio('No hay eventos próximos.');
  }

  estilos();
  m.innerHTML = cabecera('Calendario', { acciones: `${E.rol === 'admin' ? '<button class="btn btn-primario" data-nuevo>＋ Evento</button><button class="btn" data-importar>📥 Importar cronograma</button>' : ''}${staff ? '<button class="btn" data-privada>＋ Reunión privada</button>' : ''}<button class="btn" data-exportar>⬇ Exportar</button>` }) + `
    ${tarjetaHoy(hoy, crono)}
    <div class="cal-barra">
      <div class="cal-nav">
        <a class="btn btn-chico" href="${ruta(vista === 'mes' ? mover(-1) : clave(new Date(ref.getTime() - 30 * 864e5)))}" aria-label="Anterior">‹</a>
        <a class="btn btn-chico" href="${ruta(clave(new Date()))}">Hoy</a>
        <a class="btn btn-chico" href="${ruta(vista === 'mes' ? mover(1) : clave(new Date(ref.getTime() + 30 * 864e5)))}" aria-label="Siguiente">›</a>
        <h2 class="${vista === "mes" ? "mes-titulo" : ""}">${vista === "mes" ? `${MESES[ref.getMonth()]} ${ref.getFullYear()}` : "Desde " + fecha(clave(ref))}</h2>
      </div>
      <div class="segmentos"><a href="${ruta(clave(ref), 'mes')}" class="${vista === 'mes' ? 'activo' : ''}">Mes</a><a href="${ruta(clave(ref), 'agenda')}" class="${vista === 'agenda' ? 'activo' : ''}">Agenda</a></div>
    </div>
    <div class="cal-cuerpo">
      <div class="cal-principal">${cuerpo}</div>
      <aside class="cal-capas"><h3 class="sub">Capas</h3>${capas.map((c) => `<label class="check"><input type="checkbox" data-capa="${c.id}" ${ocultas.has(c.id) ? '' : 'checked'}><i class="capa-color" style="background:${c.color}"></i> ${esc(c.nombre)}</label>`).join('')}</aside>
    </div>`;

  m.querySelectorAll('[data-capa]').forEach((c) => (c.onchange = () => {
    const s = new Set(pref('cal_ocultas') || []);
    c.checked ? s.delete(c.dataset.capa) : s.add(c.dataset.capa);
    pref('cal_ocultas', [...s]);
    calendario(m, p);
  }));
  m.querySelectorAll('[data-dia]').forEach((c) => (c.onclick = () => {
    const lista = porDia.get(c.dataset.dia) || [], cr = cronoDe.get(c.dataset.dia), an = anotDe(c.dataset.dia);
    if (!lista.length && !cr && !an.length && E.rol !== 'admin') return;
    ventana({
      titulo: `${diaSemana(c.dataset.dia)} ${fecha(c.dataset.dia)}`,
      html: (cr || an.length ? bloqueCrono(cr, an) : crono.dias.length ? '<p class="ayuda">El cronograma no tiene registro para esta fecha (eso no significa que sea un día libre).</p>' : '')
        + (lista.length ? `<div class="lista">${lista.map((x) => itemHTML(x)).join('')}</div>` : vacio('Sin eventos este día.')),
      botones: E.rol === 'admin' ? [{ texto: '＋ Evento este día', valor: 'nuevo' }] : [],
      alAbrir: (caja, cerrar) => conectarItems(caja, lista, () => { cerrar(null); calendario(m, p); }),
    }).then((v) => v === 'nuevo' && editarEvento(b, null, c.dataset.dia).then((r) => r && calendario(m, p)));
  }));
  conectarItems(m, visibles, () => calendario(m, p));
  m.querySelector('[data-nuevo]')?.addEventListener('click', async () => { if (await editarEvento(b, null, clave(ref))) calendario(m, p); });
  m.querySelector('[data-privada]')?.addEventListener('click', async () => { if (await editarPrivada(null, hoy.fecha)) calendario(m, p); });
  m.querySelector('[data-importar]')?.addEventListener('click', async () => { if (await importarCronograma(crono)) calendario(m, p); });
  m.querySelector('[data-exportar]').onclick = () => exportarICS(visibles);
}

const itemHTML = (x) => `
  <button class="fila fila-boton" data-item="${x.dato.id}">
    <i class="capa-color" style="background:${x.color}"></i>
    <span><b>${esc(x.titulo)}</b><small>${x.hora ? esc(x.hora) : x.todo ? 'Todo el día' : new Date(x.cuando).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}${x.sub ? ' · ' + esc(x.sub) : ''}</small></span>
    <span class="flecha">›</span>
  </button>`;

// ---------------------------------------------------------------- Cronograma institucional: «Hoy», detalle e importación
function estilos() {
  if (document.getElementById('estilos-cronograma')) return;
  const s = document.createElement('style');
  s.id = 'estilos-cronograma';
  s.textContent = `
  .cal-hoy { display: grid; gap: 4px; margin: 0 0 12px; padding: 12px 14px; border: 1px solid var(--borde); border-left: 5px solid var(--primario); border-radius: var(--radio); background: var(--superficie); }
  .cal-hoy h2 { margin: 0; font-size: 18px; } .cal-hoy p { margin: 2px 0; } .cal-hoy small { color: var(--texto-2); }
  .cal-ciclo { display: flex; flex-wrap: wrap; gap: 6px; }
  .cal-chip { display: inline-block; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--borde); font-size: 13px; font-weight: 600; }
  .cal-chip.especial { border-color: #8e44ad; color: #8e44ad; } .cal-chip.alerta { border-color: var(--alerta); color: var(--alerta); } .cal-chip.sin { color: var(--texto-2); font-weight: 400; }
  .cal-anot { margin: 6px 0 0; padding: 8px 10px; border: 1px dashed var(--alerta); border-radius: var(--radio); background: var(--superficie-2); }
  .cal-anot b { display: block; }
  .cal-fuente { white-space: pre-wrap; overflow-wrap: anywhere; }
  .mes-ciclo { font-size: 10px; font-weight: 700; color: var(--texto-2); margin-left: 4px; }
  .mes-celda.especial { box-shadow: inset 0 -3px 0 #8e44ad; }
  .cal-prev-resumen { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
  .cal-prev-filtros { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 10px; }
  .cal-prev-filtros .btn[aria-pressed="true"] { border-color: var(--primario); background: var(--primario-suave); }
  .cal-prev-lista { display: grid; gap: 8px; max-height: 55vh; overflow: auto; padding-right: 4px; }
  .cal-prev-fila { border: 1px solid var(--borde); border-radius: var(--radio); padding: 8px 10px; background: var(--superficie); }
  .cal-prev-fila header { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-weight: 700; }
  .cal-prev-fila .desc { white-space: pre-wrap; overflow-wrap: anywhere; margin: 4px 0; }
  .cal-prev-fila details { color: var(--texto-2); font-size: 13px; }
  .cal-prev-fila.nuevo { border-left: 4px solid var(--ok); } .cal-prev-fila.cambio { border-left: 4px solid var(--alerta); } .cal-prev-fila.igual { opacity: .8; }
  .cal-aviso { color: var(--alerta); font-size: 13px; display: block; }`;
  document.head.appendChild(s);
}

// Lo impreso en el cronograma para una fecha, y aparte (nunca mezclado) lo que se indicó después
function bloqueCrono(d, anotaciones = []) {
  const f = d?.fuente;
  return `<section class="cal-hoy" data-cronograma>
    ${d ? `<div class="cal-ciclo">
      <span class="cal-chip">${d.dia_ciclo != null ? `Día ${d.dia_ciclo} del ciclo` : 'Día de ciclo: no impreso'}</span>
      <span class="cal-chip ${d.ciclo != null ? '' : 'sin'}">${d.ciclo != null ? `Ciclo ${d.ciclo}` : 'Ciclo: no impreso'}</span>
      <span class="cal-chip ${d.especial ? 'especial' : ''}">${esc(d.tipo)}${d.especial ? ' · jornada especial' : ''}</span>
      ${/revisar|discrepancia/i.test(d.estado_fuente) ? `<span class="cal-chip alerta">⚠ ${esc(d.estado_fuente)}</span>` : ''}
      ${/\bposible\b/i.test(d.descripcion) ? '<span class="cal-chip alerta">Tentativo («Posible» en la fuente)</span>' : ''}
    </div>
    ${d.descripcion ? `<p class="cal-fuente"><b>${esc(d.descripcion)}</b></p>` : ''}
    <p>${d.horario_texto ? `Horario según la fuente: ${esc(d.horario_texto)}` : 'Hora no indicada en la fuente.'}</p>
    <small>Impreso en el cronograma${f?.documento ? ` «${esc(f.documento)}»` : ''}${d.pagina ? `, página ${d.pagina}` : ''}${f ? ` · importado de ${esc(f.nombre_archivo)}` : ''}</small>
    ${d.dudas ? `<details><summary>Notas de la transcripción</summary><p class="cal-fuente"><small>${esc(d.dudas)}</small></p></details>` : ''}` : '<p class="ayuda">El cronograma no tiene registro para esta fecha.</p>'}
    ${anotaciones.map((a) => `<div class="cal-anot" data-anotacion><b>Indicación posterior — NO impresa en el cronograma</b>${esc(a.texto)}<br><small>Origen: ${esc(a.origen)} · ${a.estado === 'confirmada' ? 'confirmada' : 'pendiente de confirmación'}</small></div>`).join('')}
  </section>`;
}

function tarjetaHoy(hoy, crono) {
  const [a, mm, dd] = hoy.fecha.split('-').map(Number);
  const titulo = `Hoy · ${hoy.dia_semana} ${dd} de ${MESES[mm - 1]} de ${a}`;
  if (!crono.dias.length) return `<section class="cal-hoy" data-hoy><h2>${titulo}</h2><small>Hora de Bogotá. Aún no se ha importado el cronograma institucional${E.rol === 'admin' ? ': usa «📥 Importar cronograma»' : ''}.</small></section>`;
  if (!hoy.registro && !hoy.anotaciones.length) return `<section class="cal-hoy" data-hoy><h2>${titulo}</h2><p>El cronograma no tiene registro para hoy.</p><small>Hora de Bogotá. Una fecha sin registro no significa que sea un día libre.</small></section>`;
  return `<div data-hoy><h2 class="sub">${titulo} <small>(hora de Bogotá)</small></h2>${bloqueCrono(hoy.registro, hoy.anotaciones)}</div>`;
}

// Vista previa e importación (administrador). El archivo se lee en el equipo; al servidor van solo las filas.
async function importarCronograma(crono) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; inp.hidden = true;
  document.body.appendChild(inp);
  const archivo = await new Promise((ok) => {
    let listo = false;
    const fin = (f) => { if (!listo) { listo = true; inp.remove(); ok(f); } };
    inp.addEventListener('change', () => fin(inp.files?.[0] || null));
    inp.addEventListener('cancel', () => fin(null));
    window.addEventListener('focus', () => setTimeout(() => fin(inp.files?.[0] || null), 4000), { once: true });
    inp.click();
  });
  if (!archivo) return false;
  if (!/\.xlsx$/i.test(archivo.name)) { aviso('Elige el cronograma en Excel (.xlsx).', 'error'); return false; }
  if (archivo.size > 5 * 1024 * 1024) { aviso('El archivo pesa más de 5 MB.', 'error'); return false; }
  let leido, plan, sha;
  try {
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    sha = await sha256(bytes);
    leido = await leerCronograma(await leerXlsx(bytes));
    plan = planImportacion(leido, { existentes: crono.dias, fuentesPrevias: crono.fuentes,
      eventos: (await E.db.select('eventos', { eq: { colegio_id: E.colegio.id } }).catch(() => [])).map((e) => ({ id: e.id, titulo: e.titulo, fecha: fechaBogota(new Date(e.inicio)) })) }, sha);
  } catch (e) { aviso(e.message, 'error'); return false; }
  const r = plan.resumen;
  const fantasia = leido.dias.find((d) => d.tipo === 'Día de la Fantasía' && !d.dia_ciclo);
  const yaAnotada = fantasia && crono.anotaciones.some((a) => a.fecha === fantasia.fecha);
  const fila = (d) => `<article class="cal-prev-fila ${d.accion}" data-prev="${d.fecha}" data-accion="${d.accion}" data-avisos="${d.avisos.length}" data-especial="${d.especial ? 1 : 0}" data-dup="${d.posibles_duplicados.length}">
    <header><span>${esc(d.dia_semana)} ${esc(fecha(d.fecha))}</span>
      <span class="cal-chip">${d.dia_ciclo != null ? 'Día ' + d.dia_ciclo : 'Día: —'}${d.ciclo != null ? ' · Ciclo ' + d.ciclo : ''}</span>
      <span class="cal-chip ${d.especial ? 'especial' : ''}">${esc(d.tipo)}</span>
      <span class="cal-chip">${d.accion === 'nuevo' ? 'Nueva' : d.accion === 'igual' ? 'Ya está igual' : 'Cambia lo importado'}</span>
      ${d.posibles_duplicados.length ? `<span class="cal-chip alerta">Posible duplicado: ${esc(d.posibles_duplicados.map((x) => x.titulo).join(', '))}</span>` : ''}</header>
    ${d.descripcion ? `<p class="desc">${esc(d.descripcion)}</p>` : '<p class="desc ayuda">(sin evento: solo la etiqueta de día)</p>'}
    ${d.horario_texto ? `<small>Horario textual: ${esc(d.horario_texto)}</small>` : ''}
    ${d.accion === 'cambio' ? `<small class="cal-aviso">Antes: ${esc(d.anterior.tipo)} · ${esc(primeraLinea(d.anterior.descripcion))}</small>` : ''}
    ${d.avisos.map((a) => `<small class="cal-aviso">⚠ ${esc(a)}</small>`).join('')}
    <details><summary>Fuente: página ${d.pagina ?? '—'} · fila ${d.fila} del Excel${d.dudas ? ' · notas' : ''}</summary>${d.estado_fuente ? `<p>Estado: ${esc(d.estado_fuente)}</p>` : ''}${d.dudas ? `<p class="cal-fuente">${esc(d.dudas)}</p>` : ''}</details>
  </article>`;
  return ventana({
    titulo: 'Vista previa del cronograma',
    html: `<p class="ayuda">Esto es lo que dice el Excel. <b>Todavía no se ha importado nada.</b> Coteja con el PDF las fechas marcadas con ⚠.</p>
      <div class="cal-hoy"><b>${esc(leido.institucion || 'Institución no indicada')}</b>
        <small>Documento: ${esc(leido.documento || '—')} · Cobertura: ${leido.cobertura ? `${esc(fecha(leido.cobertura.desde))} a ${esc(fecha(leido.cobertura.hasta))}` : 'no indicada'}<br>Archivo: ${esc(archivo.name)} · huella ${sha.slice(0, 12)}…</small>
        ${leido.notas['Campos vacíos'] ? `<small>${esc(leido.notas['Campos vacíos'])}</small>` : ''}
        ${leido.notas['Vigencia'] ? `<small>${esc(leido.notas['Vigencia'])}</small>` : ''}</div>
      ${plan.ya_importado ? '<p class="pq-msg ok"><b>Este mismo archivo ya se importó.</b> Volver a importarlo no crea nada.</p>' : ''}
      ${leido.errores.length ? `<p class="cal-aviso">${leido.errores.length} fila(s) con error: ${esc(leido.errores.map((e) => `fila ${e.fila}: ${e.error}`).join('; '))}. No se puede importar hasta corregirlas.</p>` : ''}
      <div class="cal-prev-resumen" data-resumen>
        <span class="cal-chip">${r.fechas} fechas</span><span class="cal-chip">${r.nuevos} nuevas</span><span class="cal-chip">${r.iguales} iguales</span>
        <span class="cal-chip ${r.cambios ? 'alerta' : ''}">${r.cambios} cambian</span><span class="cal-chip">${r.con_ciclo} con día de ciclo impreso</span>
        <span class="cal-chip especial">${r.especiales} jornadas especiales</span><span class="cal-chip ${r.con_avisos ? 'alerta' : ''}">${r.con_avisos} con aviso</span>
        <span class="cal-chip ${r.posibles_duplicados ? 'alerta' : ''}">${r.posibles_duplicados} posibles duplicados</span>
        ${r.ausentes ? `<span class="cal-chip alerta">${r.ausentes} ya importadas que no vienen en este archivo (no se borran)</span>` : ''}
      </div>
      ${r.cambios ? `<label class="check"><input type="checkbox" name="aplicar"> Reemplazar las ${r.cambios} fecha(s) que cambian (lo anterior queda en el historial)</label>` : ''}
      ${fantasia && !yaAnotada ? `<label class="check"><input type="checkbox" name="anotar"> Registrar aparte, para el ${esc(fecha(fantasia.fecha))}, la indicación posterior «acompañamiento según día 2»: <b>no está impresa en el cronograma</b> y queda pendiente de confirmación</label>` : ''}
      <div class="cal-prev-filtros" role="group" aria-label="Filtrar la vista previa">
        ${[['todas', 'Todas'], ['avisos', 'Con aviso'], ['especial', 'Jornadas especiales'], ['cambio', 'Cambios'], ['dup', 'Posibles duplicados']].map(([k, t], i) => `<button type="button" class="btn btn-chico" data-filtro="${k}" aria-pressed="${i === 0}">${t}</button>`).join('')}
      </div>
      <div class="cal-prev-lista" data-lista>${plan.filas.map(fila).join('')}</div>
`,
    alAbrir: (caja) => caja.querySelectorAll('[data-filtro]').forEach((b) => (b.onclick = () => {
      caja.querySelectorAll('[data-filtro]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      const k = b.dataset.filtro;
      caja.querySelectorAll('[data-prev]').forEach((el) => (el.hidden = !(k === 'todas' || (k === 'avisos' && +el.dataset.avisos) || (k === 'especial' && el.dataset.especial === '1')
        || (k === 'cambio' && el.dataset.accion === 'cambio') || (k === 'dup' && +el.dataset.dup))));
    })),
    botones: [{ texto: leido.errores.length || (plan.ya_importado && !r.cambios) ? 'Cerrar' : 'Cancelar', valor: false }, ...(leido.errores.length || (plan.ya_importado && !r.cambios) ? [] : [{ texto: r.nuevos ? `Importar ${r.nuevos} fecha(s) nuevas` : 'Importar', clase: 'btn-primario', antes: async (caja) => {
      const aplicar = !!caja.querySelector('[name=aplicar]')?.checked;
      const res = await E.db.rpc('calendario_importar', { p_colegio: E.colegio.id, p_sha256: sha, p_nombre: archivo.name,
        p_meta: { documento: leido.documento, institucion: leido.institucion, notas: leido.notas, cobertura_desde: leido.cobertura?.desde, cobertura_hasta: leido.cobertura?.hasta },
        p_dias: leido.dias.map(paraImportar), p_aplicar_cambios: aplicar });
      if (caja.querySelector('[name=anotar]')?.checked) await E.db.rpc('calendario_anotar', { p_colegio: E.colegio.id, p_fecha: fantasia.fecha, p_texto: 'Acompañamiento según día 2.',
        p_origen: `Indicación posterior mencionada en conversación, no impresa en el cronograma; la registró ${nombre(E.yo)} el ${fechaBogota()}` });
      aviso(res.ya_importado ? 'Ese archivo ya estaba importado: no se creó nada' : `Cronograma importado: ${res.nuevos} nueva(s)${res.cambios_aplicados ? `, ${res.cambios_aplicados} reemplazada(s)` : ''}${res.cambios_pendientes ? `, ${res.cambios_pendientes} cambio(s) sin aplicar` : ''}`);
      return true;
    } }])],
  });
}

// Reunión privada: solo la ve y la cambia su dueño (la base no deja verla a nadie más, ni al administrador)
async function editarPrivada(ev, dia) {
  const local = (iso) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const r = await ventana({
    titulo: ev ? 'Mi reunión privada' : 'Nueva reunión privada',
    html: `<p class="ayuda">🔒 Solo la ves tú. No se publica en el calendario del colegio ni se copia de otros calendarios.</p>` + camposHTML([
      { name: 'titulo', label: 'Título' },
      { name: 'inicio', label: 'Inicio', tipo: 'datetime-local', def: local(ev?.inicio) || (dia ? dia + 'T08:00' : '') },
      { name: 'fin', label: 'Fin (opcional)', tipo: 'datetime-local', def: local(ev?.fin) },
      { name: 'descripcion', label: 'Notas', tipo: 'textarea', filas: 3 },
    ], ev ? { ...ev, inicio: local(ev.inicio), fin: local(ev.fin) } : {}),
    botones: [
      ...(ev ? [{ texto: 'Eliminar', clase: 'btn-peligro', antes: async () => { if (!(await confirmar('¿Eliminar la reunión?', 'No se puede deshacer.', 'Eliminar'))) return false; await E.db.remove('eventos_personales', { id: ev.id }); return true; } }] : []),
      { texto: 'Cancelar' },
      { texto: 'Guardar', antes: async (c) => {
        const d = leerForm(c);
        if (!d.titulo || !d.inicio) throw new Error('Escribe el título y la fecha de inicio.');
        const datos = { titulo: d.titulo, inicio: new Date(d.inicio).toISOString(), fin: d.fin ? new Date(d.fin).toISOString() : null, descripcion: d.descripcion || null, todo_el_dia: false };
        if (datos.fin && datos.fin < datos.inicio) throw new Error('El fin no puede ser antes del inicio.');
        if (ev) await E.db.update('eventos_personales', datos, { id: ev.id });
        else await E.db.insert('eventos_personales', [{ colegio_id: E.colegio.id, perfil_id: E.yo.id, ...datos }]);
        return true;
      } },
    ],
  });
  if (r) aviso('Reunión privada guardada');
  return r;
}

function conectarItems(raiz, lista, recargar) {
  raiz.querySelectorAll('[data-item]').forEach((el) => (el.onclick = async (e) => {
    e.stopPropagation();
    const x = lista.find((i) => i.dato.id === el.dataset.item);
    if (!x) return;
    if (x.tipo === 'tarea') { location.hash = '#/tarea/' + x.dato.id; document.querySelector('.ventana')?.remove(); return; }
    if (x.tipo === 'examen') { location.hash = '#/examen/' + x.dato.id; document.querySelector('.ventana')?.remove(); return; }
    if (x.tipo === 'mensaje') { location.hash = '#/mensaje/' + x.dato.id; document.querySelector('.ventana')?.remove(); return; }
    if (x.tipo === 'crono') { await ventana({ titulo: `${diaSemana(x.dato.fecha)} ${fecha(x.dato.fecha)}`, html: bloqueCrono(x.dato, []), botones: [{ texto: 'Cerrar' }] }); return; }
    if (x.tipo === 'personal') { if (await editarPrivada(x.dato)) recargar(); return; }
    const ev = x.dato;
    const r = await ventana({
      titulo: ev.titulo,
      html: `<p><span class="chip" style="background:${x.color};color:#fff">${esc(TIPOS[ev.tipo]?.[0] || ev.tipo)}</span></p>
        <p><b>${ev.todo_el_dia ? fecha(ev.inicio) + ' · todo el día' : fechaHora(ev.inicio)}</b>${ev.fin ? ' → ' + (ev.todo_el_dia ? fecha(ev.fin) : fechaHora(ev.fin)) : ''}</p>
        ${x.sub ? `<p class="ayuda">${esc(x.sub)}</p>` : ''}
        ${ev.descripcion ? `<p class="texto-largo">${esc(ev.descripcion)}</p>` : ''}`,
      botones: E.rol === 'admin' ? [{ texto: 'Editar', valor: 'editar' }] : [],
    });
    if (r === 'editar' && (await editarEvento(await base(), ev))) recargar();
  }));
}

async function editarEvento(b, ev, dia) {
  const local = (iso) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const r = await ventana({
    titulo: ev ? 'Editar evento' : 'Nuevo evento',
    html: camposHTML([
      { name: 'titulo', label: 'Título' },
      { name: 'tipo', label: 'Tipo', tipo: 'select', opciones: Object.entries(TIPOS).map(([k, [t]]) => [k, t]) },
      { name: 'todo_el_dia', label: 'Todo el día', tipo: 'checkbox', def: true },
      { name: 'inicio', label: 'Inicio', tipo: 'datetime-local', def: local(ev?.inicio || (dia ? dia + 'T08:00' : null)) || (dia ? dia + 'T08:00' : '') },
      { name: 'fin', label: 'Fin (opcional)', tipo: 'datetime-local', def: local(ev?.fin) },
      { name: 'curso_id', label: 'Para', tipo: 'select', vacio: 'Todo el colegio', opciones: b.cursos.map((c) => [c.id, 'Curso ' + c.nombre]) },
      { name: 'descripcion', label: 'Descripción', tipo: 'textarea', filas: 4 },
    ], ev ? { ...ev, inicio: local(ev.inicio), fin: local(ev.fin) } : {}),
    botones: [
      ...(ev ? [{ texto: 'Eliminar', clase: 'btn-peligro', antes: async () => { if (!(await confirmar('¿Eliminar el evento?', 'No se puede deshacer.', 'Eliminar'))) return false; await E.db.remove('eventos', { id: ev.id }); return true; } }] : []),
      { texto: 'Cancelar' },
      { texto: 'Guardar', antes: async (c) => {
        const d = leerForm(c);
        if (!d.titulo || !d.inicio) throw new Error('Escribe el título y la fecha de inicio.');
        const datos = { titulo: d.titulo, tipo: d.tipo, todo_el_dia: !!d.todo_el_dia, inicio: new Date(d.inicio).toISOString(), fin: d.fin ? new Date(d.fin).toISOString() : null, curso_id: d.curso_id || null, descripcion: d.descripcion || null };
        if (ev) await E.db.update('eventos', datos, { id: ev.id });
        else await E.db.insert('eventos', [{ colegio_id: E.colegio.id, creado_por: E.yo.id, ...datos }]);
        return true;
      } },
    ],
  });
  if (r) aviso('Calendario actualizado');
  return r;
}

// Exporta a un archivo .ics (Google Calendar, Outlook, iPhone)
function exportarICS(items) {
  const f = (iso, todo) => { const d = new Date(iso); return todo ? clave(d).replace(/-/g, '') : d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''); };
  const limpiar = (s) => String(s || '').replace(/[\\,;]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
  const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Complex_//Calendario//ES', `X-WR-CALNAME:${limpiar(E.colegio.nombre)}`];
  for (const x of items) {
    lineas.push('BEGIN:VEVENT', `UID:${x.dato.id}@complex`, `DTSTAMP:${f(new Date().toISOString())}`,
      x.todo ? `DTSTART;VALUE=DATE:${f(x.cuando, true)}` : `DTSTART:${f(x.cuando)}`,
      `SUMMARY:${limpiar(x.titulo)}`, x.sub ? `DESCRIPTION:${limpiar(x.sub)}` : 'DESCRIPTION:', 'END:VEVENT');
  }
  lineas.push('END:VCALENDAR');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lineas.join('\r\n')], { type: 'text/calendar' }));
  a.download = 'calendario-complex.ics';
  document.body.appendChild(a); a.click(); a.remove();
  aviso('Calendario exportado');
}
