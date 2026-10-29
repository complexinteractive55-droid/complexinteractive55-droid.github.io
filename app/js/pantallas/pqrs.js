// PQRS — Peticiones, Quejas, Reclamos y Sugerencias (pedido de Fabio, 28-oct-2026). Necesita la migración 20261028200000_pqrs.
// Todos los perfiles presentan PQRS (#/pqrs?tab=nueva) y ven las suyas («Mis PQRS»). Los responsables de un área ven su bandeja;
// el administrador general, la supervisión y la configuración de áreas, responsables, secciones y permisos de salud.
// La base decide qué ve cada quien (lo de salud llega oculto a quien no tiene permiso): esta pantalla solo lo muestra.
// Lo escrito se guarda en el equipo hasta que el servidor confirma, con el mismo identificador de envío (reintentar no duplica).
import { E } from '../estado.js';
import { esc, aviso, ventana, vacio, fechaHora, fecha, ROL } from '../ui.js';
import { cabecera, pestanas } from './comun.js';
import { TIPOS, ESTADO_AREA, ESTADO_GENERAL, AYUDA_ESTADO, MAX_ASUNTO, MAX_DESCRIPCION, MAX_TEXTO, AREAS, SECCIONES, validar, esSinRed } from '../pqrs_reglas.js';

const nuevoId = () => crypto.randomUUID?.() || '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
const clave = (k) => `complex_pqrs_${k}_${E.colegio.id}_${E.yo.id}`;
const leer = (k) => { try { return JSON.parse(localStorage.getItem(clave(k)) || 'null'); } catch { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(clave(k), JSON.stringify(v)); } catch {} };
const borrar = (k) => { try { localStorage.removeItem(clave(k)); } catch {} };
const lista = (xs) => (xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1]);
const DESC_TIPO = {
  peticion: 'Pides algo: información, un trámite o un servicio.',
  queja: 'Algo del servicio o de la atención no te gustó.',
  reclamo: 'Algo no se cumplió o se cobró mal y pides que se corrija.',
  sugerencia: 'Una idea para mejorar.',
};
const chipEstado = (e) => `<span class="pq-estado pq-e-${esc(e)}" title="${esc(AYUDA_ESTADO[e] || '')}">${esc(ESTADO_GENERAL[e] || e)}</span>`;
const chipArea = (a) => `<span class="pq-area pq-a-${esc(a.estado)}">${a.estado === 'respondida' ? '✓ ' : a.estado === 'en_revision' ? '… ' : ''}${esc(a.nombre)} · ${esc(ESTADO_AREA[a.estado] || a.estado)}${a.aporte_pendiente ? ' · información nueva' : ''}</span>`;

function estilos() {
  if (document.getElementById('estilos-pqrs')) return;
  const s = document.createElement('style');
  s.id = 'estilos-pqrs';
  s.textContent = `
  .form .pq-tipos { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; border: 0; padding: 0; margin: 0 0 8px; min-width: 0; }
  .form .pq-tipos legend { grid-column: 1 / -1; font-weight: 700; margin-bottom: 6px; padding: 0; }
  .form .pq-op { display: flex; flex-direction: row; align-items: flex-start; gap: 10px; min-height: 48px; padding: 10px 12px; border: 1px solid var(--borde); border-radius: var(--radio); background: var(--superficie); cursor: pointer; font-weight: 600; }
  .form .pq-op small { display: block; font-weight: 400; color: var(--texto-2); }
  .pq-op:has(input:checked) { border-color: var(--primario); box-shadow: inset 0 0 0 1px var(--primario); background: var(--primario-suave); }
  .pq-op input { width: 20px; height: 20px; flex: none; margin: 2px 0 0; }
  .pq-op:focus-within { outline: 3px solid var(--primario); outline-offset: 2px; }
  .form .pq-op.pq-interno:has(input:checked) { border-color: var(--alerta); box-shadow: inset 0 0 0 2px var(--alerta); background: var(--superficie-2); }
  .pq-err { color: var(--peligro); font-weight: 600; display: block; margin-top: 4px; }
  .pq-err:empty { display: none; }
  [aria-invalid="true"] { border-color: var(--peligro) !important; }
  .pq-msg { margin: 10px 0 0; padding: 10px 12px; border-radius: var(--radio); border: 1px solid var(--borde); }
  .pq-msg:empty { display: none; }
  .pq-msg.error { border-color: var(--peligro); } .pq-msg.ok { border-color: var(--ok); }
  .pq-acciones { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
  .pq-acciones .btn { min-height: 44px; }
  .pq-contador { display: block; text-align: right; color: var(--texto-2); font-size: 13px; }
  .pq-lista { display: grid; gap: 10px; }
  .pq-caso { display: block; color: inherit; text-decoration: none; }
  .pq-caso:focus-visible { outline: 3px solid var(--primario); outline-offset: 2px; }
  .pq-caso-cab { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .pq-caso p { margin: 6px 0; }
  .pq-areas { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
  .pq-estado, .pq-area, .pq-badge, .pq-tipo { display: inline-block; padding: 2px 10px; border-radius: 999px; border: 1px solid currentColor; font-size: 13px; font-weight: 600; white-space: nowrap; }
  .pq-area, .pq-badge { white-space: normal; max-width: 100%; overflow-wrap: anywhere; border-radius: 14px; }
  .pq-tipo { color: var(--texto-2); }
  .pq-e-pendiente_clasificacion { color: var(--alerta); } .pq-e-pendiente { color: var(--texto-2); } .pq-e-en_atencion { color: var(--primario); }
  .pq-e-respuesta_parcial { color: var(--alerta); } .pq-e-respondida { color: var(--ok); } .pq-e-cerrada { color: var(--texto-2); background: var(--superficie-2); }
  .pq-a-pendiente { color: var(--texto-2); } .pq-a-en_revision { color: var(--primario); } .pq-a-respondida { color: var(--ok); }
  .pq-badge { color: var(--peligro); } .pq-badge.suave { color: var(--alerta); } .pq-badge.info { color: var(--primario); }
  .pq-resumen { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 10px; }
  .pq-resumen .btn { min-height: 44px; }
  .pq-resumen .btn[aria-pressed="true"] { border-color: var(--primario); background: var(--primario-suave); box-shadow: inset 0 0 0 1px var(--primario); }
  .pq-filtros { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; align-items: end; margin-bottom: 10px; }
  .pq-datos dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 12px; margin: 0; }
  .pq-datos dt { font-weight: 700; } .pq-datos dd { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  .pq-reservado { padding: 10px 12px; border-radius: var(--radio); background: var(--superficie-2); border: 1px dashed var(--borde); }
  .pq-int { border: 1px solid var(--borde); border-radius: var(--radio); padding: 10px 12px; margin: 0 0 10px; background: var(--superficie); }
  .pq-int header { font-weight: 700; } .pq-int .meta { color: var(--texto-2); font-size: 14px; margin: 2px 0 6px; }
  .pq-int .texto { white-space: pre-wrap; overflow-wrap: anywhere; }
  .pq-int-respuesta { border-left: 4px solid var(--ok); }
  .pq-int-comentario { border-left: 4px solid var(--alerta); background: var(--superficie-2); }
  .pq-int-aporte { border-left: 4px solid var(--primario); }
  .pq-aviso-modo { margin: 8px 0; padding: 10px 12px; border-radius: var(--radio); font-weight: 700; }
  .pq-aviso-modo:empty { display: none; }
  .pq-aviso-modo.respuesta { border: 2px solid var(--ok); } .pq-aviso-modo.comentario { border: 2px solid var(--alerta); background: var(--superficie-2); }
  .pq-crono { list-style: none; margin: 0; padding: 0; }
  .pq-crono li { padding: 8px 0; border-bottom: 1px solid var(--borde); }
  .pq-crono li:last-child { border-bottom: 0; }
  .pq-crono small { color: var(--texto-2); display: block; }
  .pq-area-fila { padding: 8px 0; border-bottom: 1px solid var(--borde); }
  .pq-area-fila:last-child { border-bottom: 0; }
  .pq-area-fila.retirada { opacity: .75; }
  .pq-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
  .pq-chip-x { display: inline-flex; align-items: center; gap: 4px; padding: 2px 4px 2px 10px; border: 1px solid var(--borde); border-radius: 999px; font-size: 14px; }
  .pq-chip-x button { min-width: 32px; min-height: 32px; border: 0; background: none; color: var(--peligro); font-size: 18px; cursor: pointer; }
  .pq-grados { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 6px 0; }
  @media (max-width: 520px) { .pq-datos dl { grid-template-columns: 1fr; gap: 0; } .pq-datos dd { margin-bottom: 8px; } }`;
  document.head.appendChild(s);
}

const rpc = (n, a) => E.db.rpc(n, a);
let yoCache = null;
async function miPerfil() {
  if (yoCache && yoCache.colegio === E.colegio.id && yoCache.uid === E.yo.id && Date.now() - yoCache.t < 60000) return yoCache.v;
  const v = await rpc('pqrs_yo', { p_colegio: E.colegio.id });
  yoCache = { colegio: E.colegio.id, uid: E.yo.id, t: Date.now(), v };
  return v;
}

// ---------------------------------------------------------------- Inicio del módulo (pestañas según quién soy)
export async function inicio(m, p = {}) {
  estilos();
  const yo = await miPerfil();
  const tabs = [['nueva', 'Nueva PQRS'], ['mias', 'Mis PQRS']];
  if (yo.areas.length) tabs.push(['area', 'Bandeja de mis áreas']);
  if (yo.admin) tabs.push(['supervision', 'Supervisión'], ['config', 'Áreas y responsables']);
  const tab = tabs.some(([k]) => k === p.tab) ? p.tab : yo.admin ? 'supervision' : yo.areas.length ? 'area' : 'nueva';
  m.innerHTML = cabecera('PQRS') + pestanas(tabs, tab, '#/pqrs?tab=') + '<div class="contenido" data-pq></div>';
  const c = m.querySelector('[data-pq]');
  if (tab === 'nueva') return formulario(c, yo);
  if (tab === 'mias') return listado(c, 'mias', yo);
  if (tab === 'area') return listado(c, 'area', yo);
  if (tab === 'supervision') return listado(c, 'supervision', yo);
  return configuracion(c);
}

// ---------------------------------------------------------------- Nueva PQRS
function formulario(c, yo) {
  const b = leer('borrador') || {};
  const st = { tipo: b.tipo || '', asunto: b.asunto || '', descripcion: b.descripcion || '', estudiante: b.estudiante || '', solicitud: b.solicitud || nuevoId() };
  let enviando = false, recien = false; // recien: acaba de enviarse (un doble clic no borra la confirmación)
  c.innerHTML = `
    <form class="form" data-form novalidate autocomplete="off">
      <section class="tarjeta">
        <p class="ayuda">Cuéntanos qué necesitas. <b>No tienes que saber qué área lo atiende</b>: Complex dirige tu PQRS a las áreas encargadas
          y en «Mis PQRS» verás su estado y las respuestas.</p>
        <fieldset class="pq-tipos" data-campo="tipo" aria-describedby="err-tipo">
          <legend>Tipo de solicitud (obligatorio)</legend>
          ${Object.entries(TIPOS).map(([k, t]) => `<label class="pq-op"><input type="radio" name="tipo" value="${k}" ${st.tipo === k ? 'checked' : ''}><span>${esc(t)}<small>${esc(DESC_TIPO[k])}</small></span></label>`).join('')}
        </fieldset>
        <small class="pq-err" id="err-tipo" data-err="tipo"></small>
        <label>Asunto (obligatorio)<input name="asunto" maxlength="${MAX_ASUNTO}" placeholder="Ej.: Costo y horario de la ruta" aria-describedby="err-asunto"></label>
        <small class="pq-err" id="err-asunto" data-err="asunto"></small>
        <label>Descripción (obligatoria)<textarea name="descripcion" rows="6" maxlength="${MAX_DESCRIPCION}" placeholder="Cuéntanos qué pasó o qué necesitas, con fechas si las tienes." aria-describedby="err-descripcion"></textarea></label>
        <small class="pq-contador" data-contador></small>
        <small class="pq-err" id="err-descripcion" data-err="descripcion"></small>
        ${yo.hijos.length > 1 ? `<label>¿Sobre cuál de tus hijos? (opcional)<select name="estudiante"><option value="">No es sobre un estudiante en particular</option>${yo.hijos.map((h) => `<option value="${esc(h.id)}" ${st.estudiante === h.id ? 'selected' : ''}>${esc(h.nombre)}</option>`).join('')}</select></label>` : ''}
        <p class="ayuda">Se registran automáticamente tu nombre, tu perfil (${esc(ROL[E.rol] || E.rol)}), el colegio, la fecha y la hora.</p>
        <button type="submit" class="btn btn-primario btn-ancho" data-enviar>Enviar PQRS</button>
        <div class="pq-msg" data-mensaje role="status" aria-live="polite"></div>
      </section>
    </form>`;
  const form = c.querySelector('[data-form]');
  form.elements.asunto.value = st.asunto;
  form.elements.descripcion.value = st.descripcion;
  const contar = () => { c.querySelector('[data-contador]').textContent = `${st.descripcion.length} / ${MAX_DESCRIPCION}`; };
  const recordar = () => guardar('borrador', st);
  const mensaje = (html, tipo = '') => { const el = c.querySelector('[data-mensaje]'); el.className = `pq-msg ${tipo}`; el.innerHTML = html; };
  const marcar = (campo, texto) => {
    c.querySelectorAll('[data-err]').forEach((e) => (e.textContent = ''));
    c.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
    if (!campo) return;
    c.querySelector(`[data-err="${campo}"]`).textContent = texto;
    const caja = c.querySelector(`[data-campo="${campo}"]`) || form.elements[campo];
    caja?.setAttribute?.('aria-invalid', 'true');
    (campo === 'tipo' ? form.querySelector('[name=tipo]') : form.elements[campo])?.focus();
  };
  contar();
  form.addEventListener('input', (e) => {
    if (['asunto', 'descripcion'].includes(e.target.name)) { recien = false; st[e.target.name] = e.target.value; contar(); recordar(); }
  });
  form.addEventListener('change', (e) => {
    if (e.target.name === 'tipo' || e.target.name === 'estudiante') { recien = false; st[e.target.name] = e.target.value; recordar(); }
  });
  c.addEventListener('click', (e) => {
    if (e.target.closest('[data-otra]')) { mensaje(''); form.elements.asunto.focus(); }
    if (e.target.closest('[data-reintentar]')) form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (enviando || (recien && !st.tipo && !st.asunto && !st.descripcion)) return;
    const v = validar(st);
    if (v.error) { marcar(v.campo, v.error); mensaje(`<p>${esc(v.error)}</p>`, 'error'); return; }
    marcar(null);
    enviando = true;
    const btn = c.querySelector('[data-enviar]');
    btn.disabled = true; btn.textContent = 'Enviando…';
    mensaje('<p>Enviando tu PQRS…</p>');
    recordar();
    try {
      const r = await rpc('pqrs_crear', { p_colegio: E.colegio.id, p_solicitud: st.solicitud, p_tipo: st.tipo, p_asunto: st.asunto.trim(),
        p_descripcion: st.descripcion.trim(), p_estudiante: st.estudiante || null, p_rol: E.rol });
      if (!r?.id || !r?.consecutivo) throw new Error('El servidor no confirmó la PQRS. Intenta de nuevo.');
      borrar('borrador');
      mensaje(`<p><b>✓ PQRS recibida</b></p>
        <p>Consecutivo: <b data-consecutivo>${esc(r.consecutivo)}</b><br>Registrada el ${esc(fechaHora(r.creado_en))}</p>
        <p>${r.areas.length ? `Áreas encargadas: <b>${esc(lista(r.areas))}</b>.` : 'El colegio la está revisando para dirigirla al área encargada.'}
          Te avisaremos por la Mensajería cuando haya respuestas.</p>
        <div class="pq-acciones"><a class="btn btn-primario" href="#/pqrs/${esc(r.id)}">Ver mi PQRS</a><button type="button" class="btn" data-otra>Presentar otra</button></div>`, 'ok');
      Object.assign(st, { tipo: '', asunto: '', descripcion: '', estudiante: '', solicitud: nuevoId() });
      form.reset(); contar(); recien = true;
    } catch (err) {
      const sinRed = esSinRed(err.message);
      mensaje(`<p><b>${sinRed ? 'No se pudo enviar: revisa la conexión a internet.' : esc(err.message)}</b></p>
        <p>Lo que escribiste sigue aquí${sinRed ? ' y en este equipo' : ''}. Si ya se había enviado, reintentar no crea otra PQRS.</p>
        <div class="pq-acciones"><button type="button" class="btn btn-primario" data-reintentar>Reintentar</button></div>`, 'error');
    } finally { enviando = false; btn.disabled = false; btn.textContent = 'Enviar PQRS'; }
  });
}

// ---------------------------------------------------------------- Listas: Mis PQRS, bandeja de áreas y supervisión
const filtrosDe = (vista) => leer('filtros_' + vista) || {};
async function listado(c, vista, yo) {
  c.innerHTML = vacio('Cargando…');
  let casos;
  try { casos = await rpc('pqrs_listar', { p_colegio: E.colegio.id, p_vista: vista }); }
  catch (e) { c.innerHTML = vacio('No se pudieron cargar las PQRS: ' + e.message); return; }
  if (!casos.length) {
    c.innerHTML = vacio(vista === 'mias' ? 'Todavía no has presentado PQRS.' : vista === 'area' ? 'Tus áreas no tienen PQRS.' : 'Aún no hay PQRS en el colegio.',
      vista === 'mias' ? '<a class="btn btn-primario" href="#/pqrs?tab=nueva">Presentar una PQRS</a>' : '');
    return;
  }
  const personal = vista !== 'mias';
  const f = { area: '', estado: '', desde: '', hasta: '', sin: false, ...filtrosDe(vista) };
  const sinRevisar = (x) => (vista === 'area' ? !x.visto_por_mi_area : !x.visto_por_mi);
  const sinResp = (x) => x.estado !== 'cerrada' && (vista === 'area' ? x.areas.some((a) => a.mia && a.estado !== 'respondida') : x.respuestas === 0);
  const areasEnLista = [...new Map(casos.flatMap((x) => x.areas).map((a) => [a.id, a.nombre])).entries()];
  const contar = (fn) => casos.filter(fn).length;
  const RESUMEN = personal ? [
    ['sin_revisar', 'Sin revisar', sinRevisar], ['pendiente_clasificacion', 'Por clasificar', (x) => x.estado === 'pendiente_clasificacion'],
    ['en_atencion', 'En atención', (x) => x.estado === 'en_atencion'], ['respuesta_parcial', 'Respuesta parcial', (x) => x.estado === 'respuesta_parcial'],
    ['respondida', 'Respondidas', (x) => x.estado === 'respondida'], ['cerrada', 'Cerradas', (x) => x.estado === 'cerrada'],
  ].filter(([k, , fn]) => k !== 'pendiente_clasificacion' || vista === 'supervision' || contar(fn)) : [];
  c.innerHTML = `
    ${personal ? `<div class="pq-resumen" role="group" aria-label="Resumen">${RESUMEN.map(([k, t, fn]) => `<button type="button" class="btn btn-chico" data-resumen="${k}" aria-pressed="${f.estado === k}">${esc(t)}: <b>${contar(fn)}</b></button>`).join('')}</div>
    <div class="form pq-filtros">
      <label>Área<select data-f="area"><option value="">Todas</option>${areasEnLista.map(([id, n]) => `<option value="${esc(id)}" ${f.area === id ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label>Estado<select data-f="estado"><option value="">Todos</option><option value="sin_revisar" ${f.estado === 'sin_revisar' ? 'selected' : ''}>Sin revisar</option>${Object.entries(ESTADO_GENERAL).map(([k, t]) => `<option value="${k}" ${f.estado === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      <label>Desde<input type="date" data-f="desde" value="${esc(f.desde)}"></label>
      <label>Hasta<input type="date" data-f="hasta" value="${esc(f.hasta)}"></label>
      <label class="check"><input type="checkbox" data-f="sin" ${f.sin ? 'checked' : ''}> ${vista === 'area' ? 'Sin respuesta de mi área' : 'Sin ninguna respuesta'}</label>
    </div>` : ''}
    <p class="ayuda" data-cuantos></p>
    <div class="pq-lista" data-lista></div>`;
  const pintar = () => {
    const dia = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
    const vis = casos.filter((x) => (!f.area || x.areas.some((a) => a.id === f.area))
      && (!f.estado || (f.estado === 'sin_revisar' ? sinRevisar(x) : x.estado === f.estado))
      && (!f.desde || dia(x.creado_en) >= f.desde) && (!f.hasta || dia(x.creado_en) <= f.hasta) && (!f.sin || sinResp(x)));
    c.querySelector('[data-cuantos]').textContent = personal ? `${vis.length} de ${casos.length} casos` : `${casos.length} PQRS`;
    c.querySelectorAll('[data-resumen]').forEach((b) => b.setAttribute('aria-pressed', String(f.estado === b.dataset.resumen)));
    c.querySelector('[data-lista]').innerHTML = vis.length ? vis.map((x) => tarjeta(x, vista)).join('') : vacio('No hay casos con esos filtros.');
  };
  const recordar = () => guardar('filtros_' + vista, f);
  c.addEventListener('change', (e) => {
    const k = e.target.dataset.f;
    if (!k) return;
    f[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    recordar(); pintar();
  });
  c.addEventListener('click', (e) => {
    const r = e.target.closest('[data-resumen]');
    if (!r) return;
    f.estado = f.estado === r.dataset.resumen ? '' : r.dataset.resumen;
    const sel = c.querySelector('[data-f="estado"]');
    if (sel) sel.value = f.estado;
    recordar(); pintar();
  });
  pintar();
}

function tarjeta(x, vista) {
  const personal = vista !== 'mias';
  const badges = [
    personal && (vista === 'area' ? !x.visto_por_mi_area : !x.visto_por_mi) ? '<span class="pq-badge">Sin revisar</span>' : '',
    x.aporte_pendiente ? '<span class="pq-badge info">Información nueva del solicitante</span>' : '',
    x.revisar ? '<span class="pq-badge suave">Revisar clasificación</span>' : '',
    personal && x.areas.some((a) => a.sin_responsables) ? '<span class="pq-badge suave">Área sin responsables</span>' : '',
    x.avisos_error ? '<span class="pq-badge suave">Aviso sin enviar</span>' : '',
    x.sensible ? '<span class="pq-badge info">🔒 Salud</span>' : '',
  ].join('');
  return `<a class="tarjeta pq-caso" href="#/pqrs/${esc(x.id)}" data-caso="${esc(x.id)}">
    <div class="pq-caso-cab"><b>${esc(x.consecutivo)}</b><span class="pq-tipo">${esc(TIPOS[x.tipo] || x.tipo)}</span>${chipEstado(x.estado)}${badges}</div>
    <p><b>${esc(x.asunto)}</b></p>
    <small class="ayuda">${personal && x.solicitante ? `${esc(x.solicitante)} (${esc(ROL[x.rol_solicitante] || x.rol_solicitante)}) · ` : ''}${esc(fechaHora(x.creado_en))}</small>
    <div class="pq-areas">${x.areas.length ? x.areas.map(chipArea).join('') : '<span class="pq-area pq-a-pendiente">Sin área asignada todavía</span>'}</div>
    ${x.estado !== 'cerrada' && x.pendientes.length && x.pendientes.length < x.areas.length ? `<small>Falta responder: <b>${esc(lista(x.pendientes))}</b></small>` : ''}
  </a>`;
}

// ---------------------------------------------------------------- Detalle de un caso
const borradores = new Map(); // texto a medio escribir por caso (no se pierde si la pantalla se repinta)
const TEXTO_EVENTO = {
  creada: (e, personal) => 'Se presentó la PQRS' + (personal ? (e.detalle.areas?.length ? ` · clasificación automática: ${lista(e.detalle.areas)}` : ' · pendiente de clasificación') + (e.detalle.sin_responsables?.length ? ` · sin responsables: ${lista(e.detalle.sin_responsables)}` : '') : ''),
  leida: (e) => `Lo vio ${e.actor}${e.detalle.areas?.length ? ` (${lista(e.detalle.areas)})` : e.detalle.admin ? ' (Administración)' : ''}`,
  asignada: (e, personal) => `Se asignó a ${e.area}${personal && e.detalle.motivo ? ` · motivo: ${e.detalle.motivo}` : ''}`,
  retirada: (e, personal) => `${e.area} dejó de participar${personal && e.detalle.motivo ? ` · motivo: ${e.detalle.motivo}` : ''}`,
  estado_area: (e) => `${e.area} pasó a «En revisión»`,
  respuesta: (e) => `${e.area} respondió al solicitante`,
  respuesta_corregida: (e) => `${e.area} corrigió su respuesta${e.detalle.motivo ? ` · motivo: ${e.detalle.motivo}` : ''}`,
  comentario: (e) => `Comentario interno de ${e.area || 'Administración'}`,
  comentario_corregido: () => 'Se corrigió un comentario interno',
  aporte: () => 'El solicitante aportó información',
  aporte_atendido: (e) => `${e.area} atendió la información nueva`,
  cerrada: (e) => `Se cerró el caso${e.detalle.motivo ? ` · constancia: ${e.detalle.motivo}` : ''}`,
  reabierta: (e) => `Se reabrió el caso${e.detalle.motivo ? ` · motivo: ${e.detalle.motivo}` : ''}`,
  resumen: () => 'Se actualizó el resumen para coordinar (sin datos clínicos)',
  salud: (e) => (e.detalle.sensible ? 'Se marcó con información de salud' : 'Se quitó la marca de salud') + (e.detalle.motivo ? ` · motivo: ${e.detalle.motivo}` : ''),
  clasificacion_confirmada: () => 'El administrador confirmó la clasificación',
};

export async function detalle(m, p) {
  estilos();
  let d;
  try { d = await rpc('pqrs_detalle', { p_id: p.id }); }
  catch (e) { m.innerHTML = cabecera('PQRS', { volver: '#/pqrs' }) + vacio(e.message); return; }
  const yo = d.yo, personal = yo.personal, abierto = d.estado !== 'cerrada';
  const misAreas = d.areas.filter((a) => a.activa && yo.areas.includes(a.id));
  const borr = borradores.get(d.id) || { modo: '', area: misAreas[0]?.id || '', texto: '', salud: null, aporte: '', solicitud: nuevoId(), solAporte: nuevoId() };
  borradores.set(d.id, borr);
  const intHTML = (i) => {
    const etiqueta = i.tipo === 'respuesta' ? 'Respuesta al solicitante' : i.tipo === 'comentario' ? '🔒 Comentario interno · solo personal autorizado' : 'Información del solicitante';
    const quien = i.tipo === 'aporte' ? i.autor : `${i.autor} · ${i.area || 'Administración'}`;
    return `<article class="pq-int pq-int-${i.tipo}" data-int="${esc(i.id)}">
      <header>${esc(etiqueta)}${i.tipo !== 'aporte' ? ` · Área: ${esc(i.area || 'Administración general')}` : ''}</header>
      <p class="meta">${esc(quien)} · ${esc(fechaHora(i.creado_en))}${i.editado_en ? ` · <b>corregida el ${esc(fechaHora(i.editado_en))}</b>` : ''}</p>
      ${i.oculto_salud ? '<p class="pq-reservado">Contenido de salud reservado: solo lo ven Enfermería del caso y quienes tienen el permiso de salud.</p>' : `<div class="texto">${esc(i.contenido)}</div>`}
      ${i.versiones.length ? `<details><summary>Ver ${i.versiones.length === 1 ? 'la versión anterior' : `las ${i.versiones.length} versiones anteriores`}</summary>${i.versiones.map((v) => `<div class="pq-int"><p class="meta">Versión ${v.version}, escrita el ${esc(fechaHora(v.escrito_en))} · reemplazada el ${esc(fechaHora(v.reemplazado_en))} · motivo: ${esc(v.motivo)}</p>${v.contenido == null ? '<p class="pq-reservado">Contenido de salud reservado.</p>' : `<div class="texto">${esc(v.contenido)}</div>`}</div>`).join('')}</details>` : ''}
      ${i.mia && i.tipo !== 'aporte' && abierto && !i.oculto_salud ? `<div class="pq-acciones"><button type="button" class="btn btn-chico" data-corregir="${esc(i.id)}">Corregir</button></div>` : ''}
    </article>`;
  };
  const respuestas = d.intervenciones.filter((i) => i.tipo === 'respuesta' || i.tipo === 'aporte' || personal);
  m.innerHTML = cabecera(esc(d.consecutivo), { volver: personal ? (yo.admin ? '#/pqrs?tab=supervision' : '#/pqrs?tab=area') : '#/pqrs?tab=mias' }) + `
    <div class="contenido" data-pq-detalle>
      <section class="tarjeta">
        <div class="pq-caso-cab"><span class="pq-tipo">${esc(TIPOS[d.tipo] || d.tipo)}</span>${chipEstado(d.estado)}${d.sensible ? '<span class="pq-badge info">🔒 Información de salud</span>' : ''}${d.revisar ? '<span class="pq-badge suave">Revisar clasificación</span>' : ''}</div>
        <p class="ayuda">${esc(AYUDA_ESTADO[d.estado] || '')}${abierto && d.pendientes.length && d.pendientes.length < d.areas.filter((a) => a.activa).length ? ` · <b>falta responder: ${esc(lista(d.pendientes))}</b>` : ''}</p>
        <div class="pq-datos"><dl>
          <dt>Asunto</dt><dd data-asunto>${esc(d.asunto)}</dd>
          <dt>Descripción</dt><dd data-descripcion>${d.oculto_salud ? '<span class="pq-reservado">Reservada: tiene información de salud. Solo la ven Enfermería del caso y quienes tienen el permiso de salud.</span>' : esc(d.descripcion)}</dd>
          <dt>Presentada</dt><dd>${esc(fechaHora(d.creado_en))}${personal || yo.solicitante ? ` · ${esc(d.solicitante.nombre)} (${esc(ROL[d.solicitante.rol] || d.solicitante.rol)})` : ''}</dd>
          ${d.estudiante ? `<dt>Estudiante</dt><dd>${esc(d.estudiante.nombre)}</dd>` : ''}
          ${d.cierre ? `<dt>Cierre</dt><dd>${esc(fechaHora(d.cierre.en))} · ${esc(d.cierre.por || '')}<br>${esc(d.cierre.motivo || '')}</dd>` : ''}
        </dl></div>
        ${d.sensible && personal ? `<div class="pq-reservado" data-resumen-salud><b>Resumen para coordinar (sin datos clínicos):</b> ${d.resumen_coordinacion ? `${esc(d.resumen_coordinacion)} <small class="ayuda">— ${esc(d.resumen_por || '')}, ${esc(fechaHora(d.resumen_en))}</small>` : 'Enfermería aún no lo ha escrito.'}
          ${yo.puede_resumen ? `<div class="pq-acciones"><button type="button" class="btn btn-chico" data-resumen>Escribir el resumen</button></div>` : ''}</div>` : ''}
        ${personal && abierto ? `<div class="pq-acciones">${d.sensible ? (yo.salud ? '<button type="button" class="btn btn-chico" data-salud="no">Quitar la marca de salud</button>' : '') : '<button type="button" class="btn btn-chico" data-salud="si">Marcar con información de salud</button>'}</div>` : ''}
      </section>

      <section class="tarjeta">
        <h2>Áreas encargadas</h2>
        ${d.areas.length ? d.areas.map((a) => `<div class="pq-area-fila ${a.activa ? '' : 'retirada'}" data-area-fila="${esc(a.id)}">
          <div class="pq-caso-cab">${a.activa ? chipArea(a) : `<span class="pq-area">${esc(a.nombre)} · retirada</span>`}${a.mia ? '<span class="pq-badge info">Tu área</span>' : ''}${personal && a.activa && !a.responsables?.length ? '<span class="pq-badge suave">Sin responsables configurados</span>' : ''}</div>
          ${personal && a.motivo ? `<small class="ayuda">Por qué: ${esc(a.motivo)} (${a.origen === 'automatica' ? 'automática' : `asignada por ${esc(a.asignada_por || '')}`}, ${esc(fechaHora(a.asignada_en))})</small>` : ''}
          ${personal && a.responsables?.length ? `<small class="ayuda">Responsables: ${esc(lista(a.responsables))}</small>` : ''}
          ${!a.activa ? `<small class="ayuda">Retirada por ${esc(a.retirada_por || '')} el ${esc(fechaHora(a.retirada_en))}: ${esc(a.retiro_motivo || '')}</small>` : ''}
          <div class="pq-acciones">
            ${a.mia && abierto && (a.estado === 'pendiente' || (a.estado === 'respondida' && a.aporte_pendiente)) ? `<button type="button" class="btn btn-chico" data-revision="${esc(a.id)}">Marcar «En revisión»</button>` : ''}
            ${a.mia && abierto && a.aporte_pendiente ? `<button type="button" class="btn btn-chico" data-atender="${esc(a.id)}">Información nueva atendida</button>` : ''}
            ${yo.puede_asignar && a.activa ? `<button type="button" class="btn btn-chico" data-retirar="${esc(a.id)}">Retirar</button>` : ''}
          </div></div>`).join('') : '<p>Sin áreas todavía: <b>pendiente de clasificación</b>.</p>'}
        ${yo.puede_asignar ? `<div class="pq-acciones"><button type="button" class="btn" data-asignar>Agregar un área</button>${d.revisar ? '<button type="button" class="btn" data-confirmar>Confirmar clasificación</button>' : ''}</div>` : ''}
        ${yo.admin && d.clasificacion && (d.clasificacion.razon || d.clasificacion.intencion?.length) ? `<details><summary>Cómo se clasificó</summary>
          <p class="ayuda">${d.clasificacion.razon ? esc(d.clasificacion.razon) + '<br>' : ''}${d.clasificacion.intencion?.length ? `Intención detectada: ${esc(lista(d.clasificacion.intencion))}. ` : ''}${d.clasificacion.descartes ? `${d.clasificacion.descartes} señal(es) descartadas por negación o elogio.` : ''}
          ${d.clasificacion.debiles?.length ? `<br>Señales débiles (no alcanzaron): ${esc(lista(d.clasificacion.debiles.map((k) => AREAS.find((a) => a.clave === k)?.nombre || (k === 'seccion' ? 'Sección' : k))))}.` : ''}</p></details>` : ''}
      </section>

      <section class="tarjeta">
        <h2>${personal ? 'Respuestas y comentarios' : 'Respuestas'}</h2>
        ${respuestas.length ? respuestas.map(intHTML).join('') : `<p class="ayuda">${personal ? 'Aún no hay respuestas ni comentarios.' : 'Aún no hay respuestas. Te avisaremos por la Mensajería.'}</p>`}
      </section>

      ${abierto && (misAreas.length || yo.admin) ? `<section class="tarjeta form" data-escribir>
        <h2>Escribir</h2>
        <fieldset class="pq-tipos" aria-describedby="ayuda-modo"><legend>¿Qué vas a escribir? (elige uno)</legend>
          ${misAreas.length ? `<label class="pq-op"><input type="radio" name="modo" value="respuesta" ${borr.modo === 'respuesta' ? 'checked' : ''}><span>Responder al solicitante<small>Lo verán el solicitante, las áreas del caso y el administrador.</small></span></label>` : ''}
          <label class="pq-op pq-interno"><input type="radio" name="modo" value="comentario" ${borr.modo === 'comentario' ? 'checked' : ''}><span>Comentario interno<small>Solo lo verá el personal autorizado del caso. El solicitante NO lo verá.</small></span></label>
        </fieldset>
        ${misAreas.length ? `<label>En nombre de<select name="area">${misAreas.map((a) => `<option value="${esc(a.id)}" ${borr.area === a.id ? 'selected' : ''}>${esc(a.nombre)}</option>`).join('')}${yo.admin ? `<option value="" ${borr.area === '' ? 'selected' : ''}>Administración general (solo comentario)</option>` : ''}</select></label>` : '<p class="ayuda">Comentas como Administración general.</p>'}
        <div class="pq-aviso-modo" data-aviso-modo id="ayuda-modo"></div>
        <label>Texto<textarea name="texto" rows="5" maxlength="${MAX_TEXTO}"></textarea></label>
        ${yo.salud && d.sensible ? `<label class="check"><input type="checkbox" name="salud"> Contiene información de salud (solo la verán Enfermería del caso y quienes tienen el permiso)</label>` : ''}
        <button type="button" class="btn btn-primario btn-ancho" data-enviar-int disabled>Elige si es respuesta o comentario</button>
        <div class="pq-msg" data-msg-int role="status" aria-live="polite"></div>
      </section>` : ''}

      ${yo.puede_aportar ? `<section class="tarjeta form" data-aportar>
        <h2>Agregar información o pedir una aclaración</h2>
        <p class="ayuda">Queda en esta misma PQRS y les avisamos a las áreas encargadas.</p>
        <label>Tu mensaje<textarea name="aporte" rows="4" maxlength="${MAX_TEXTO}"></textarea></label>
        <button type="button" class="btn btn-primario" data-enviar-aporte>Enviar</button>
        <div class="pq-msg" data-msg-aporte role="status" aria-live="polite"></div>
      </section>` : ''}

      ${personal && d.lecturas ? `<section class="tarjeta"><h2>Visto por</h2>${d.lecturas.length ? `<ul class="pq-crono">${d.lecturas.map((l) => `<li><b>${esc(l.nombre)}</b>${l.areas.length ? ` (${esc(lista(l.areas))})` : l.admin ? ' (Administración)' : ''}<small>Primera vez: ${esc(fechaHora(l.primera_en))}${l.ultima_en !== l.primera_en ? ` · última: ${esc(fechaHora(l.ultima_en))}` : ''}</small></li>`).join('')}</ul><p class="ayuda">Leer un caso no lo marca como respondido.</p>` : '<p class="ayuda">Nadie del personal lo ha abierto todavía.</p>'}</section>` : ''}

      <section class="tarjeta"><h2>Cronología</h2>
        <ul class="pq-crono">${d.eventos.map((e) => `<li data-evento="${esc(e.tipo)}">${esc((TEXTO_EVENTO[e.tipo] || (() => e.tipo))(e, personal))}<small>${esc(fechaHora(e.creado_en))}${e.actor && e.tipo !== 'leida' && (personal || e.tipo === 'respuesta') ? ` · ${esc(e.actor)}` : ''}</small></li>`).join('')}</ul>
      </section>

      ${yo.puede_cerrar || yo.puede_reabrir ? `<section class="tarjeta"><div class="pq-acciones">
        ${yo.puede_cerrar ? '<button type="button" class="btn btn-peligro" data-cerrar>Cerrar el caso</button>' : ''}${yo.puede_reabrir ? '<button type="button" class="btn" data-reabrir>Reabrir el caso</button>' : ''}
      </div></section>` : ''}
    </div>`;

  const raiz = m.querySelector('[data-pq-detalle]');
  const recargar = () => detalle(m, p);
  const conMotivo = (titulo, html, etiqueta, fn, ok) => ventana({
    titulo, html: `${html}<label>${esc(etiqueta)}<textarea name="motivo" rows="3" maxlength="1000"></textarea></label>`,
    botones: [{ texto: 'Cancelar', valor: null }, { texto: 'Guardar', antes: async (caja) => fn(caja.querySelector('[name=motivo]').value.trim(), caja) }],
  }).then((r) => { if (r) { aviso(ok); recargar(); } });

  // Escribir respuesta o comentario
  const esc_ = raiz.querySelector('[data-escribir]');
  if (esc_) {
    const txt = esc_.querySelector('[name=texto]'), selArea = esc_.querySelector('[name=area]'), chkSalud = esc_.querySelector('[name=salud]');
    txt.value = borr.texto;
    const areaSel = () => (selArea ? selArea.value : '');
    const esEnf = () => d.areas.find((a) => a.id === areaSel())?.clave === 'enfermeria';
    if (chkSalud) chkSalud.checked = borr.salud ?? esEnf();
    const pintarModo = () => {
      const enAdmin = !areaSel();
      const r = esc_.querySelector('[value=respuesta]');
      if (r) { r.disabled = enAdmin; if (enAdmin && borr.modo === 'respuesta') { borr.modo = ''; r.checked = false; } }
      const caja = esc_.querySelector('[data-aviso-modo]'), btn = esc_.querySelector('[data-enviar-int]');
      caja.className = 'pq-aviso-modo ' + borr.modo;
      caja.textContent = borr.modo === 'respuesta' ? '✉ Vas a enviar una RESPUESTA AL SOLICITANTE. La verá él y quedará como respuesta oficial de tu área.'
        : borr.modo === 'comentario' ? '🔒 Vas a guardar un COMENTARIO INTERNO. El solicitante NO lo verá; no marca el caso como respondido.' : '';
      btn.disabled = !borr.modo;
      btn.textContent = borr.modo === 'respuesta' ? 'Enviar respuesta al solicitante' : borr.modo === 'comentario' ? 'Guardar comentario interno' : 'Elige si es respuesta o comentario';
    };
    pintarModo();
    esc_.addEventListener('change', (e) => {
      if (e.target.name === 'modo') borr.modo = e.target.value;
      if (e.target.name === 'area') { borr.area = e.target.value; if (chkSalud && borr.salud == null) chkSalud.checked = esEnf(); }
      if (e.target.name === 'salud') borr.salud = e.target.checked;
      pintarModo();
    });
    txt.addEventListener('input', () => { borr.texto = txt.value; });
    let enviando = false;
    esc_.querySelector('[data-enviar-int]').addEventListener('click', async () => {
      if (enviando || !borr.modo) return;
      const msg = esc_.querySelector('[data-msg-int]');
      if (!txt.value.trim()) { msg.className = 'pq-msg error'; msg.textContent = 'Escribe el texto.'; txt.focus(); return; }
      enviando = true;
      const btn = esc_.querySelector('[data-enviar-int]'); btn.disabled = true;
      msg.className = 'pq-msg'; msg.textContent = 'Guardando…';
      try {
        await rpc(borr.modo === 'respuesta' ? 'pqrs_responder' : 'pqrs_comentar',
          { p_id: d.id, p_area: areaSel() || null, p_solicitud: borr.solicitud, p_contenido: txt.value.trim(), p_salud: chkSalud ? chkSalud.checked : null });
        borradores.delete(d.id);
        aviso(borr.modo === 'respuesta' ? 'Respuesta enviada al solicitante' : 'Comentario interno guardado');
        recargar();
      } catch (err) {
        msg.className = 'pq-msg error';
        msg.textContent = esSinRed(err.message) ? 'No se pudo guardar: revisa la conexión. Lo escrito sigue aquí; reintentar no lo duplica.' : err.message;
        enviando = false; btn.disabled = false;
      }
    });
  }

  // Aporte del solicitante
  const ap = raiz.querySelector('[data-aportar]');
  if (ap) {
    const t = ap.querySelector('[name=aporte]');
    t.value = borr.aporte;
    t.addEventListener('input', () => { borr.aporte = t.value; });
    let enviando = false;
    ap.querySelector('[data-enviar-aporte]').addEventListener('click', async () => {
      if (enviando) return;
      const msg = ap.querySelector('[data-msg-aporte]');
      if (t.value.trim().length < 3) { msg.className = 'pq-msg error'; msg.textContent = 'Escribe la información (mínimo 3 letras).'; t.focus(); return; }
      enviando = true;
      msg.className = 'pq-msg'; msg.textContent = 'Enviando…';
      try {
        await rpc('pqrs_aportar', { p_id: d.id, p_solicitud: borr.solAporte, p_contenido: t.value.trim() });
        borradores.delete(d.id);
        aviso('Información enviada a las áreas encargadas');
        recargar();
      } catch (err) {
        msg.className = 'pq-msg error';
        msg.textContent = esSinRed(err.message) ? 'No se pudo enviar: revisa la conexión. Lo escrito sigue aquí; reintentar no lo duplica.' : err.message;
        enviando = false;
      }
    });
  }

  raiz.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    try {
      if (b.dataset.revision) { await rpc('pqrs_estado_area', { p_id: d.id, p_area: b.dataset.revision, p_accion: 'en_revision' }); aviso('Tu área quedó «En revisión»'); return recargar(); }
      if (b.dataset.atender) { await rpc('pqrs_estado_area', { p_id: d.id, p_area: b.dataset.atender, p_accion: 'atender_aporte' }); aviso('Información nueva atendida'); return recargar(); }
    } catch (err) { return aviso(err.message, 'error'); }
    if (b.dataset.retirar) {
      const a = d.areas.find((x) => x.id === b.dataset.retirar);
      return conMotivo(`Retirar ${a.nombre}`, `<p>${esc(a.nombre)} dejará de participar en este caso. Queda en el historial con tu nombre, la hora y el motivo, y se le avisa.</p>`,
        '¿Por qué no debe intervenir? (obligatorio)', (motivo) => rpc('pqrs_retirar', { p_id: d.id, p_area: a.id, p_motivo: motivo }), 'Área retirada');
    }
    if (b.hasAttribute('data-asignar')) {
      const cfg = await rpc('pqrs_config', { p_colegio: E.colegio.id }).catch((err) => { aviso(err.message, 'error'); return null; });
      if (!cfg) return;
      const libres = cfg.areas.filter((a) => !d.areas.some((x) => x.id === a.id && x.activa));
      return conMotivo('Agregar un área', `<label>Área<select name="area">${libres.map((a) => `<option value="${esc(a.id)}">${esc(a.nombre)}${a.responsables.length ? '' : ' (sin responsables)'}</option>`).join('')}</select></label>`,
        'Motivo (obligatorio)', (motivo, caja) => rpc('pqrs_asignar', { p_id: d.id, p_area: caja.querySelector('[name=area]').value, p_motivo: motivo }), 'Área asignada');
    }
    if (b.hasAttribute('data-confirmar')) return conMotivo('Confirmar clasificación', '<p>Quita la marca «Revisar clasificación». Las áreas siguen como están.</p>', 'Nota (opcional)',
      (nota) => rpc('pqrs_confirmar_clasificacion', { p_id: d.id, p_nota: nota || null }), 'Clasificación confirmada');
    if (b.hasAttribute('data-cerrar')) return conMotivo('Cerrar el caso', d.pendientes.length ? `<p class="pq-reservado">Aún falta responder: <b>${esc(lista(d.pendientes))}</b>. Cerrar no marca sus respuestas; queda como constancia.</p>` : '<p>Todas las áreas respondieron.</p>',
      'Constancia del cierre (obligatoria)', (motivo) => rpc('pqrs_cerrar', { p_id: d.id, p_motivo: motivo }), 'Caso cerrado');
    if (b.hasAttribute('data-reabrir')) return conMotivo('Reabrir el caso', '', 'Motivo (obligatorio)', (motivo) => rpc('pqrs_reabrir', { p_id: d.id, p_motivo: motivo }), 'Caso reabierto');
    if (b.dataset.salud) {
      const si = b.dataset.salud === 'si';
      return conMotivo(si ? 'Marcar con información de salud' : 'Quitar la marca de salud',
        si ? '<p>El contenido quedará reservado para Enfermería del caso y quienes tienen el permiso de salud; Enfermería se suma al caso.</p>' : '<p>El contenido volverá a verlo todo el personal del caso.</p>',
        'Motivo (obligatorio)', (motivo) => rpc('pqrs_marcar_salud', { p_id: d.id, p_sensible: si, p_motivo: motivo }), 'Listo');
    }
    if (b.hasAttribute('data-resumen')) {
      const r = await ventana({ titulo: 'Resumen para coordinar', html: `<p>Lo verán las demás áreas del caso. <b>No escribas datos clínicos</b>: solo lo que necesitan para actuar.</p><label>Resumen<textarea name="resumen" rows="4" maxlength="1000">${esc(d.resumen_coordinacion || '')}</textarea></label>`,
        botones: [{ texto: 'Cancelar', valor: null }, { texto: 'Guardar', antes: (caja) => rpc('pqrs_resumen_salud', { p_id: d.id, p_resumen: caja.querySelector('[name=resumen]').value.trim() }) }] });
      if (r) { aviso('Resumen guardado'); recargar(); }
      return;
    }
    if (b.dataset.corregir) {
      const i = d.intervenciones.find((x) => x.id === b.dataset.corregir);
      const r = await ventana({ titulo: 'Corregir', html: `<p class="ayuda">La versión anterior queda guardada y se muestra que fue corregida.</p><label>Texto corregido<textarea name="texto" rows="5" maxlength="${MAX_TEXTO}">${esc(i.contenido)}</textarea></label><label>Motivo de la corrección (obligatorio)<input name="motivo" maxlength="300"></label>`,
        botones: [{ texto: 'Cancelar', valor: null }, { texto: 'Guardar corrección', antes: (caja) => rpc('pqrs_corregir', { p_intervencion: i.id, p_contenido: caja.querySelector('[name=texto]').value.trim(), p_motivo: caja.querySelector('[name=motivo]').value.trim() }) }] });
      if (r) { aviso('Corrección guardada'); recargar(); }
    }
  });
}

// ---------------------------------------------------------------- Áreas y responsables (administrador general)
async function configuracion(c) {
  c.innerHTML = vacio('Cargando…');
  let cfg;
  try { cfg = await rpc('pqrs_config', { p_colegio: E.colegio.id }); }
  catch (e) { c.innerHTML = vacio(e.message); return; }
  const recargar = () => { yoCache = null; configuracion(c); };
  const nombreGrado = (id) => cfg.grados.find((g) => g.id === id)?.nombre || 'Grado';
  c.innerHTML = `
    <p class="ayuda">Asigna quién atiende cada área. Una persona puede estar en varias áreas y un área puede tener varias personas.
      Ser responsable no da permisos de administrador. Los cambios quedan en el historial.</p>
    ${cfg.avisos_pendientes ? `<section class="tarjeta"><p><b>${cfg.avisos_pendientes} aviso(s) del chat no salieron.</b> Las PQRS están guardadas.</p><button type="button" class="btn btn-primario" data-reintentar>Reintentar los avisos</button></section>` : ''}
    ${cfg.areas.map((a) => `<section class="tarjeta" data-area="${esc(a.id)}">
      <h2>${esc(a.nombre)}</h2>
      ${a.clave === 'gerencia' ? '<p class="ayuda">Gerencia nunca se asigna sola: la agrega el administrador en cada caso.</p>' : ''}
      <div class="pq-chips">${a.responsables.length ? a.responsables.map((r) => `<span class="pq-chip-x">${esc(r.nombre)}<button type="button" aria-label="Quitar a ${esc(r.nombre)} de ${esc(a.nombre)}" data-quitar="${esc(r.id)}">×</button></span>`).join('') : '<span class="pq-badge suave">Sin responsables: sus casos quedan pendientes y se te avisa</span>'}</div>
      <div class="form pq-acciones"><label class="crece">Agregar responsable<select data-nuevo><option value="">Elige una persona…</option>${cfg.personal.filter((x) => !a.responsables.some((r) => r.id === x.id)).map((x) => `<option value="${esc(x.id)}">${esc(x.nombre)} (${esc(x.roles.map((r) => ROL[r] || r).join(', '))})</option>`).join('')}</select></label>
        <button type="button" class="btn" data-agregar>Agregar</button></div>
      ${SECCIONES.includes(a.clave) ? `<details ${a.grados.length ? '' : 'open'}><summary>Grados de esta sección${a.grados.length ? `: ${esc(lista(a.grados.map(nombreGrado)))}` : ' (sin marcar)'}</summary>
        ${cfg.grados.length ? `<p class="ayuda">Lo académico o de convivencia de un estudiante llega a la sección de su grado. Un grado solo puede estar en una sección.</p>
        <div class="pq-grados">${cfg.grados.map((g) => `<label class="check"><input type="checkbox" value="${esc(g.id)}" ${a.grados.includes(g.id) ? 'checked' : ''} data-grado> ${esc(g.nombre)}</label>`).join('')}</div>
        <button type="button" class="btn btn-chico" data-grados>Guardar grados</button>` : '<p class="ayuda">El colegio aún no tiene grados en «Estructura del colegio».</p>'}</details>` : ''}
    </section>`).join('')}
    <section class="tarjeta" data-salud>
      <h2>Permiso de salud</h2>
      <p class="ayuda">Los responsables de Enfermería ven el contenido de salud de sus casos. Este permiso se lo da a otras personas del personal
        (también al administrador) para los casos en los que participen. Queda registrado con el motivo.</p>
      <div class="pq-chips">${cfg.permisos_salud.length ? cfg.permisos_salud.map((s) => `<span class="pq-chip-x" title="${esc(s.motivo)} · ${esc(s.otorgado_por || '')}, ${esc(fecha(s.otorgado_en))}">${esc(s.nombre)}<button type="button" aria-label="Quitar el permiso de salud a ${esc(s.nombre)}" data-quitar-salud="${esc(s.id)}">×</button></span>`).join('') : '<span class="ayuda">Nadie más tiene el permiso.</span>'}</div>
      <div class="form pq-acciones"><label class="crece">Dar el permiso a<select data-nuevo-salud><option value="">Elige una persona…</option>${cfg.personal.filter((x) => !cfg.permisos_salud.some((s) => s.id === x.id)).map((x) => `<option value="${esc(x.id)}">${esc(x.nombre)}</option>`).join('')}</select></label>
        <button type="button" class="btn" data-dar-salud>Dar permiso</button></div>
    </section>
    ${cfg.historial.length ? `<section class="tarjeta"><h2>Historial de cambios</h2><ul class="pq-crono">${cfg.historial.map((h) => `<li>${esc({ responsable_agregado: `${h.persona} ahora es responsable de ${h.area}`, responsable_quitado: `${h.persona} ya no es responsable de ${h.area}`, grados_seccion: `Se cambiaron los grados de ${h.area}`, permiso_salud_dado: `Permiso de salud para ${h.persona}`, permiso_salud_quitado: `Se quitó el permiso de salud a ${h.persona}` }[h.accion] || h.accion)}<small>${esc(h.actor || '')} · ${esc(fechaHora(h.creado_en))}${h.detalle?.motivo ? ` · ${esc(h.detalle.motivo)}` : ''}</small></li>`).join('')}</ul></section>` : ''}`;

  c.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const sec = b.closest('[data-area]'), area = sec?.dataset.area;
    try {
      if (b.hasAttribute('data-reintentar')) { const r = await rpc('pqrs_reintentar_avisos', { p_colegio: E.colegio.id }); aviso(r.con_error ? `Salieron ${r.enviados}; ${r.con_error} siguen con error` : `Salieron ${r.enviados} aviso(s)`, r.con_error ? 'error' : 'ok'); return recargar(); }
      if (b.dataset.quitar) { await rpc('pqrs_responsable', { p_colegio: E.colegio.id, p_area: area, p_perfil: b.dataset.quitar, p_agregar: false }); aviso('Responsable quitado'); return recargar(); }
      if (b.hasAttribute('data-agregar')) {
        const v = sec.querySelector('[data-nuevo]').value;
        if (!v) return aviso('Elige una persona.', 'error');
        await rpc('pqrs_responsable', { p_colegio: E.colegio.id, p_area: area, p_perfil: v, p_agregar: true }); aviso('Responsable agregado'); return recargar();
      }
      if (b.hasAttribute('data-grados')) {
        const g = [...sec.querySelectorAll('[data-grado]:checked')].map((x) => x.value);
        await rpc('pqrs_grados_seccion', { p_colegio: E.colegio.id, p_area: area, p_grados: g }); aviso('Grados guardados'); return recargar();
      }
      if (b.dataset.quitarSalud || b.hasAttribute('data-dar-salud')) {
        const dar = b.hasAttribute('data-dar-salud');
        const perfil = dar ? c.querySelector('[data-nuevo-salud]').value : b.dataset.quitarSalud;
        if (!perfil) return aviso('Elige una persona.', 'error');
        const r = await ventana({ titulo: dar ? 'Dar el permiso de salud' : 'Quitar el permiso de salud', html: '<label>Motivo (obligatorio)<textarea name="motivo" rows="3" maxlength="300"></textarea></label>',
          botones: [{ texto: 'Cancelar', valor: null }, { texto: dar ? 'Dar permiso' : 'Quitar permiso', antes: (caja) => rpc('pqrs_permiso_salud', { p_colegio: E.colegio.id, p_perfil: perfil, p_otorgar: dar, p_motivo: caja.querySelector('[name=motivo]').value.trim() }) }] });
        if (r) { aviso('Listo'); recargar(); }
      }
    } catch (err) { aviso(err.message, 'error'); }
  });
}
