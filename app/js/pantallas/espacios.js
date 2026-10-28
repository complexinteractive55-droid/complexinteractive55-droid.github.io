// Solicitud de espacios académicos (Fabio, 28-oct-2026). ARCHIVO NUEVO: todavía NO está conectado al menú ni a las rutas
// (eso cambia app.js y sw.js y espera la autorización de Fabio). Necesita la migración 20261028150000_solicitudes_espacios.
// Profesor (solicitud): elige espacio y fecha, ve las franjas del horario de clases con «Disponible» / «No disponible»,
//   describe la actividad y envía la SOLICITUD. Queda pendiente: no es una reserva confirmada hasta que Administración la apruebe.
// Administración (solicitudesAdmin): aprueba o rechaza; la base vuelve a revisar cruces y bloqueos al aprobar.
// Lo escrito se guarda en el equipo hasta que el servidor confirma (no se pierde si falla la red o se cierra la app),
// con el mismo identificador de envío: reintentar nunca crea otra solicitud.
import { E, perfiles } from '../estado.js';
import { esc, aviso, ventana, nombre, vacio, fechaHora } from '../ui.js';
import { cabecera } from './comun.js';
import { ESTADO, MAX_TEXTO, etiquetaFranja, hhmm, hoyBogota, sumarDias, diaSemana, fechaLarga, diaHabil, ordenar, iniciosPosibles, finesPosibles, validar, esConflicto, esSinRed } from '../espacios_reglas.js';

const nuevoId = () => crypto.randomUUID?.() || '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
const claveBorrador = () => `complex_espacio_${E.colegio.id}_${E.yo.id}`;
const leerBorrador = () => { try { return JSON.parse(localStorage.getItem(claveBorrador()) || 'null'); } catch { return null; } };
const guardarBorrador = (v) => { try { localStorage.setItem(claveBorrador(), JSON.stringify(v)); } catch {} };
const borrarBorrador = () => { try { localStorage.removeItem(claveBorrador()); } catch {} };
const chip = (estado) => `<span class="esp-chip esp-chip-${esc(estado)}">${estado === 'aprobada' ? '✓ ' : estado === 'rechazada' ? '✕ ' : '… '}${esc(ESTADO[estado] || estado)}</span>`;

function estilos() {
  if (document.getElementById('estilos-espacios')) return;
  const s = document.createElement('style');
  s.id = 'estilos-espacios';
  s.textContent = `
  .form .esp-espacios { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; border: 0; padding: 0; margin: 0; min-width: 0; }
  .form .esp-espacios legend { grid-column: 1 / -1; }
  .esp-espacios legend, .esp-grupo legend { font-weight: 700; margin-bottom: 6px; padding: 0; }
  .form .esp-opcion { display: flex; flex-direction: row; align-items: center; gap: 10px; font-weight: 600; min-height: 48px; padding: 10px 12px; border: 1px solid var(--borde); border-radius: var(--radio); background: var(--superficie); cursor: pointer; }
  .esp-opcion:has(input:checked) { border-color: var(--primario); box-shadow: inset 0 0 0 1px var(--primario); background: var(--primario-suave); }
  .esp-opcion input { width: 20px; height: 20px; flex: none; margin: 0; }
  .esp-dia { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; }
  .esp-dia label { flex: 1 1 180px; }
  .esp-ver { display: flex; gap: 8px; margin: 4px 0 8px; }
  .esp-ver .btn { flex: 1 1 0; min-height: 44px; white-space: normal; }
  .esp-ver .btn[aria-pressed="true"] { border-color: var(--primario); background: var(--primario-suave); box-shadow: inset 0 0 0 1px var(--primario); }
  .esp-franjas { display: grid; gap: 6px; list-style: none; margin: 6px 0 12px; padding: 0; }
  .esp-franja { display: flex; justify-content: space-between; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 10px 12px; border: 1px solid var(--borde); border-radius: var(--radio); background: var(--superficie); color: var(--texto); font: inherit; text-align: left; cursor: pointer; }
  .esp-franja[aria-pressed="true"] { border-color: var(--primario); box-shadow: inset 0 0 0 2px var(--primario); background: var(--primario-suave); }
  .esp-franja:disabled { cursor: not-allowed; background: var(--superficie-2); color: var(--texto-2); }
  .esp-franja:focus-visible, .esp-opcion:focus-within { outline: 3px solid var(--primario); outline-offset: 2px; }
  .esp-franja > span:first-child { white-space: nowrap; }
  .esp-est { font-weight: 700; text-align: right; }
  .esp-horas { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .esp-resumen dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 12px; margin: 0 0 12px; }
  .esp-resumen dt { font-weight: 700; }
  .esp-resumen dd { margin: 0; }
  .esp-err { color: var(--peligro); font-weight: 600; display: block; margin-top: 4px; }
  .esp-err:empty { display: none; }
  [aria-invalid="true"] { border-color: var(--peligro) !important; }
  .esp-mensaje { margin: 10px 0 0; padding: 10px 12px; border-radius: var(--radio); border: 1px solid var(--borde); }
  .esp-mensaje:empty { display: none; }
  .esp-mensaje.error { border-color: var(--peligro); }
  .esp-mensaje.ok { border-color: var(--ok); }
  .esp-chip { display: inline-block; padding: 2px 10px; border-radius: 999px; border: 1px solid currentColor; font-size: 13px; font-weight: 600; }
  .esp-chip-aprobada { color: var(--ok); } .esp-chip-rechazada { color: var(--peligro); }
  .esp-espacio-todos h3 { margin: 12px 0 4px; font-size: 16px; }
  .esp-solicitud p { margin: 4px 0; }
  .esp-acciones { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
  .esp-acciones .btn { min-height: 44px; }
  @media (max-width: 520px) { .esp-horas { grid-template-columns: 1fr; } .esp-resumen dl { grid-template-columns: 1fr; gap: 0 0; } .esp-resumen dd { margin-bottom: 8px; } }`;
  document.head.appendChild(s);
}

// ---------------------------------------------------------------- Profesor: solicitar un espacio
export async function solicitud(m, p = {}) {
  estilos();
  if (E.rol !== 'profesor') { m.innerHTML = cabecera('Solicitud de espacios académicos') + vacio('Solo los profesores solicitan espacios académicos.'); return; }
  const espacios = await E.db.select('espacios', { eq: { colegio_id: E.colegio.id, activo: true }, order: 'orden' }).catch(() => []);
  if (!espacios.length) { m.innerHTML = cabecera('Solicitud de espacios académicos') + vacio('El colegio aún no tiene espacios académicos configurados.'); return; }
  const hoy = hoyBogota();
  const b = leerBorrador() || {};
  const st = {
    espacio: espacios.some((e) => e.id === (p.espacio || b.espacio)) ? (p.espacio || b.espacio) : '',
    fecha: (p.fecha || b.fecha) >= hoy ? (p.fecha || b.fecha) : diaHabil(hoy),
    inicio: b.inicio || '', fin: b.fin || '',
    actividad: b.actividad || '', objetivo: b.objetivo || '', requiere: b.requiere || 'no', recursos: b.recursos || '',
    solicitud: b.solicitud || nuevoId(),
    ver: b.espacio ? 'espacio' : 'todos',
  };
  let dispo = [], cargando = false, enviando = false;
  const porEspacio = (id) => ordenar(dispo.filter((x) => x.espacio_id === id));

  m.innerHTML = cabecera('Solicitud de espacios académicos') + `
    <div data-esp>
    <p class="ayuda">Elige el espacio y la fecha, mira qué franjas del horario de clases están disponibles y cuéntanos la actividad.
      Es una <b>solicitud</b>: Administración la revisa y, si la aprueba, queda como <b>reserva confirmada</b>. Hora de Colombia.</p>
    <form class="form" data-form novalidate autocomplete="off">
      <section class="tarjeta">
        <h2>1. Espacio y fecha</h2>
        <fieldset class="esp-espacios" data-campo="espacio" aria-describedby="err-espacio">
          <legend>Espacio académico (obligatorio)</legend>
          ${espacios.map((e) => `<label class="esp-opcion"><input type="radio" name="espacio" value="${esc(e.id)}" ${e.id === st.espacio ? 'checked' : ''}> ${esc(e.nombre)}</label>`).join('')}
        </fieldset>
        <small class="esp-err" id="err-espacio" data-err="espacio"></small>
        <div class="esp-dia">
          <button type="button" class="btn" data-dia="-1" aria-label="Día anterior">◀</button>
          <label>Fecha (obligatoria)<input type="date" name="fecha" min="${hoy}" value="${esc(st.fecha)}" required aria-describedby="err-fecha ayuda-fecha"></label>
          <button type="button" class="btn" data-dia="1" aria-label="Día siguiente">▶</button>
        </div>
        <small class="ayuda" id="ayuda-fecha">De lunes a viernes, en las franjas del horario de clases. No se pueden elegir fechas pasadas.</small>
        <small class="esp-err" id="err-fecha" data-err="fecha"></small>
      </section>
      <section class="tarjeta">
        <h2>2. Disponibilidad</h2>
        <div class="esp-ver" role="group" aria-label="Qué espacios ver">
          <button type="button" class="btn btn-chico" data-ver="espacio">Solo este espacio</button>
          <button type="button" class="btn btn-chico" data-ver="todos">Todos los espacios</button>
        </div>
        <div data-dispo aria-live="polite"></div>
        <div class="esp-horas">
          <label>Hora de inicio (obligatoria)<select name="inicio" aria-describedby="err-inicio"></select></label>
          <label>Hora de finalización (obligatoria)<select name="fin" aria-describedby="err-fin"></select></label>
        </div>
        <small class="ayuda">Toca una franja «Disponible» para elegirla; para más tiempo, elige una hora de finalización más tarde (franjas seguidas).</small>
        <small class="esp-err" id="err-inicio" data-err="inicio"></small><small class="esp-err" id="err-fin" data-err="fin"></small>
      </section>
      <section class="tarjeta">
        <h2>3. La actividad</h2>
        <label>Actividad que se realizará (obligatoria)<textarea name="actividad" rows="3" maxlength="${MAX_TEXTO}" placeholder="Ej.: Práctica de laboratorio sobre mezclas con 7.° B" aria-describedby="err-actividad"></textarea></label>
        <small class="esp-err" id="err-actividad" data-err="actividad"></small>
        <label>Objetivo de la actividad (obligatorio)<textarea name="objetivo" rows="3" maxlength="${MAX_TEXTO}" placeholder="Ej.: Que los estudiantes separen mezclas con métodos físicos" aria-describedby="err-objetivo"></textarea></label>
        <small class="esp-err" id="err-objetivo" data-err="objetivo"></small>
        <fieldset class="esp-grupo" data-campo="requiere" aria-describedby="err-requiere">
          <legend>¿Requiere recursos adicionales?</legend>
          <label class="check"><input type="radio" name="requiere" value="no"> No</label>
          <label class="check"><input type="radio" name="requiere" value="si"> Sí</label>
        </fieldset>
        <small class="esp-err" id="err-requiere" data-err="requiere"></small>
        <div data-recursos-caja hidden>
          <label>Recursos requeridos (obligatorio si respondiste «Sí»)<textarea name="recursos" rows="3" maxlength="${MAX_TEXTO}" placeholder="Ej.: 25 tabletas, 1 videobeam, 2 extensiones eléctricas" aria-describedby="err-recursos ayuda-recursos"></textarea></label>
          <small class="ayuda" id="ayuda-recursos">Escribe cada recurso y cuántos. Pedirlos no garantiza que estén disponibles ni que se entreguen: Complex aún no tiene un proceso que los confirme, así que Administración te dirá si los hay.</small>
          <small class="esp-err" id="err-recursos" data-err="recursos"></small>
        </div>
      </section>
      <section class="tarjeta esp-resumen">
        <h2>4. Resumen</h2>
        <dl data-resumen></dl>
        <p class="ayuda">Al enviarla queda como <b>solicitud pendiente de aprobación</b>. Todavía no es una reserva confirmada.</p>
        <button type="submit" class="btn btn-primario btn-ancho" data-enviar>Enviar solicitud</button>
        <div class="esp-mensaje" data-mensaje role="status" aria-live="polite"></div>
      </section>
    </form>
    <section class="tarjeta"><h2>Mis solicitudes</h2><div data-mias>${vacio('Cargando…')}</div></section>
    </div>`;

  const raiz = m.querySelector('[data-esp]');
  const form = raiz.querySelector('[data-form]');
  const $r = (s) => raiz.querySelector(s);
  for (const k of ['actividad', 'objetivo', 'recursos']) form.elements[k].value = st[k];
  form.querySelector(`[name=requiere][value="${st.requiere}"]`).checked = true;

  const nombreEsp = (id) => espacios.find((e) => e.id === id)?.nombre || '';
  const guardar = () => guardarBorrador({ espacio: st.espacio, fecha: st.fecha, inicio: st.inicio, fin: st.fin, actividad: st.actividad, objetivo: st.objetivo, requiere: st.requiere, recursos: st.recursos, solicitud: st.solicitud });
  const mensaje = (html, tipo = '') => { const el = $r('[data-mensaje]'); el.className = `esp-mensaje ${tipo}`; el.innerHTML = html; };
  const marcarError = (campo, texto) => {
    raiz.querySelectorAll('[data-err]').forEach((e) => (e.textContent = ''));
    raiz.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
    if (!campo) return;
    const err = raiz.querySelector(`[data-err="${campo}"]`);
    if (err) err.textContent = texto;
    const el = form.elements[campo] instanceof RadioNodeList ? form.querySelector(`[name="${campo}"]:checked`) || form.querySelector(`[name="${campo}"]`) : form.elements[campo];
    const caja = raiz.querySelector(`[data-campo="${campo}"]`) || el;
    caja?.setAttribute('aria-invalid', 'true');
    caja?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    el?.focus?.({ preventScroll: true });
  };

  const franjaHTML = (f, espId) => {
    const elegida = espId === st.espacio && st.inicio && hhmm(f.hora_inicio) >= st.inicio && hhmm(f.hora_fin) <= st.fin && st.fin;
    return `<li><button type="button" class="esp-franja" data-franja data-esp-id="${esc(espId)}" data-ini="${hhmm(f.hora_inicio)}" data-fin="${hhmm(f.hora_fin)}"
      ${f.disponible ? '' : 'disabled'} aria-pressed="${elegida ? 'true' : 'false'}"
      aria-label="${esc(nombreEsp(espId))}, de ${hhmm(f.hora_inicio)} a ${hhmm(f.hora_fin)}: ${esc(etiquetaFranja(f))}">
      <span>${hhmm(f.hora_inicio)} – ${hhmm(f.hora_fin)}</span><span class="esp-est">${f.disponible ? '✓' : '✕'} ${esc(etiquetaFranja(f))}</span></button></li>`;
  };
  const pintarDispo = () => {
    const caja = $r('[data-dispo]');
    raiz.querySelectorAll('[data-ver]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.ver === st.ver)));
    if (cargando) { caja.innerHTML = '<p class="ayuda">Consultando la disponibilidad…</p>'; return; }
    if (diaSemana(st.fecha) > 5) { caja.innerHTML = `<p>${esc(fechaLarga(st.fecha))}: los espacios se piden de lunes a viernes.</p>`; return; }
    if (!dispo.length) { caja.innerHTML = `<p>${esc(fechaLarga(st.fecha))}: el colegio no tiene franjas del horario de clases para este día.</p>`; return; }
    const ver = st.ver === 'espacio' && st.espacio ? [espacios.find((e) => e.id === st.espacio)] : espacios;
    caja.innerHTML = `<p class="ayuda">${esc(fechaLarga(st.fecha))}</p>` + (ver.length === 1
      ? `<ul class="esp-franjas">${porEspacio(ver[0].id).map((f) => franjaHTML(f, ver[0].id)).join('')}</ul>`
      : `<div class="esp-espacio-todos">${ver.map((e) => `<h3>${esc(e.nombre)}</h3><ul class="esp-franjas">${porEspacio(e.id).map((f) => franjaHTML(f, e.id)).join('')}</ul>`).join('')}</div>`);
  };
  const pintarHoras = () => {
    const fr = st.espacio ? porEspacio(st.espacio) : [];
    const inicios = iniciosPosibles(fr);
    if (st.inicio && !inicios.includes(st.inicio)) { st.inicio = ''; st.fin = ''; }
    const fines = st.inicio ? finesPosibles(fr, st.inicio) : [];
    if (st.fin && !fines.includes(st.fin)) st.fin = fines[0] || '';
    if (st.inicio && !st.fin) st.fin = fines[0] || '';
    form.elements.inicio.innerHTML = `<option value="">${st.espacio ? (inicios.length ? 'Elige…' : 'Sin franjas disponibles') : 'Primero elige el espacio'}</option>` + inicios.map((t) => `<option ${t === st.inicio ? 'selected' : ''}>${t}</option>`).join('');
    form.elements.fin.innerHTML = `<option value="">${st.inicio ? 'Elige…' : 'Primero la hora de inicio'}</option>` + fines.map((t) => `<option ${t === st.fin ? 'selected' : ''}>${t}</option>`).join('');
    form.elements.inicio.disabled = !st.espacio || !inicios.length;
    form.elements.fin.disabled = !st.inicio;
  };
  const pintarResumen = () => {
    $r('[data-recursos-caja]').hidden = st.requiere !== 'si';
    $r('[data-resumen]').innerHTML = `
      <dt>Espacio</dt><dd>${esc(nombreEsp(st.espacio) || '— (elige uno)')}</dd>
      <dt>Fecha</dt><dd>${esc(fechaLarga(st.fecha) || '—')}</dd>
      <dt>Hora de inicio</dt><dd>${esc(st.inicio || '—')}</dd>
      <dt>Hora de finalización</dt><dd>${esc(st.fin || '—')}</dd>
      <dt>Recursos</dt><dd>${st.requiere === 'si' ? esc(st.recursos.trim() || '— (escribe cuáles)') : 'No requiere'}</dd>`;
  };
  const pintar = () => { pintarDispo(); pintarHoras(); pintarResumen(); };

  const cargarDispo = async () => {
    cargando = true; pintarDispo();
    try {
      dispo = diaSemana(st.fecha) > 5 ? [] : await E.db.rpc('disponibilidad_espacios', { p_colegio: E.colegio.id, p_desde: st.fecha, p_dias: 1 });
    } catch (e) {
      dispo = [];
      cargando = false;
      $r('[data-dispo]').innerHTML = `<p class="esp-err">No se pudo consultar la disponibilidad: ${esc(e.message)}</p><button type="button" class="btn btn-chico" data-recargar>Intentar de nuevo</button>`;
      pintarHoras(); pintarResumen();
      return;
    }
    cargando = false;
    pintar();
  };
  const cargarMias = async () => {
    const caja = $r('[data-mias]');
    try {
      const filas = await E.db.select('solicitudes_espacio', { eq: { solicitante_id: E.yo.id }, order: 'inicio desc', limit: 40 });
      caja.innerHTML = filas.length ? `<div class="lista">${filas.map((x) => `<div class="fila esp-solicitud"><span class="crece">
        <b>${esc(nombreEsp(x.espacio_id) || 'Espacio')}</b> · ${esc(fechaLarga(x.fecha))}, ${hhmm(x.hora_inicio)}–${hhmm(x.hora_fin)}
        <p>${chip(x.estado)}</p>${x.nota_decision ? `<p class="ayuda">Nota de Administración: ${esc(x.nota_decision)}</p>` : ''}
        <small class="ayuda">${esc(x.actividad)}</small></span></div>`).join('')}</div>` : vacio('Todavía no has enviado solicitudes.');
    } catch (e) { caja.innerHTML = vacio('No se pudieron cargar tus solicitudes: ' + e.message); }
  };

  // ----- Eventos (teclado, toque y mouse: todo son botones, radios y campos nativos)
  form.addEventListener('change', (e) => {
    const n = e.target.name;
    if (n === 'espacio') { st.espacio = e.target.value; st.ver = 'espacio'; st.inicio = ''; st.fin = ''; pintar(); }
    else if (n === 'fecha') {
      const v = e.target.value;
      if (v === st.fecha) return;
      if (v && v < hoy) { marcarError('fecha', 'La fecha ya pasó: elige hoy o un día siguiente.'); e.target.value = st.fecha; return; }
      if (v) { st.fecha = v; st.inicio = ''; st.fin = ''; marcarError(null); cargarDispo(); }
    } else if (n === 'inicio') { st.inicio = e.target.value; st.fin = ''; pintar(); }
    else if (n === 'fin') { st.fin = e.target.value; pintar(); }
    else if (n === 'requiere') { st.requiere = e.target.value; pintarResumen(); }
    guardar();
  });
  form.addEventListener('input', (e) => {
    if (['actividad', 'objetivo', 'recursos'].includes(e.target.name)) { st[e.target.name] = e.target.value; if (e.target.name === 'recursos') pintarResumen(); guardar(); }
  });
  raiz.addEventListener('click', (e) => {
    const fr = e.target.closest('[data-franja]');
    if (fr && !fr.disabled) {
      st.espacio = fr.dataset.espId; st.inicio = fr.dataset.ini; st.fin = fr.dataset.fin;
      form.querySelector(`[name=espacio][value="${CSS.escape(st.espacio)}"]`).checked = true;
      marcarError(null); pintar(); guardar();
      raiz.querySelector(`[data-franja][data-esp-id="${CSS.escape(st.espacio)}"][data-ini="${st.inicio}"]`)?.focus();
      return;
    }
    const dia = e.target.closest('[data-dia]');
    if (dia) {
      let f = sumarDias(st.fecha, +dia.dataset.dia);
      while (diaSemana(f) > 5) f = sumarDias(f, +dia.dataset.dia);
      if (f < hoy) { marcarError('fecha', 'No se pueden elegir fechas pasadas.'); return; }
      st.fecha = f; form.elements.fecha.value = f; st.inicio = ''; st.fin = ''; marcarError(null); guardar(); cargarDispo();
      return;
    }
    const ver = e.target.closest('[data-ver]');
    if (ver) { st.ver = ver.dataset.ver; pintarDispo(); return; }
    if (e.target.closest('[data-recargar]')) cargarDispo();
    if (e.target.closest('[data-reintentar]')) { if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event('submit', { cancelable: true })); }
    if (e.target.closest('[data-otra]')) { mensaje(''); form.elements.actividad.focus(); }
  });

  // ----- Enviar: el servidor revisa todo otra vez; éxito solo cuando el servidor confirma que quedó guardada
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (enviando) return;
    const v = validar(st, st.espacio ? porEspacio(st.espacio) : [], hoy);
    if (v.error) { marcarError(v.campo, v.error); mensaje(`<p>${esc(v.error)}</p>`, 'error'); return; }
    marcarError(null);
    enviando = true;
    const btn = $r('[data-enviar]');
    btn.disabled = true; btn.textContent = 'Enviando…';
    mensaje('<p>Enviando la solicitud…</p>');
    guardar();
    try {
      const r = await E.db.rpc('solicitar_espacio', {
        p_colegio: E.colegio.id, p_solicitud: st.solicitud, p_espacio: st.espacio, p_fecha: st.fecha, p_inicio: st.inicio, p_fin: st.fin,
        p_actividad: st.actividad.trim(), p_objetivo: st.objetivo.trim(), p_requiere_recursos: st.requiere === 'si', p_recursos: st.requiere === 'si' ? st.recursos.trim() : null,
      });
      if (!r?.id) throw new Error('El servidor no confirmó la solicitud. Intenta de nuevo.');
      E.db.refrescar('solicitudes_espacio');
      borrarBorrador();
      mensaje(`<p><b>✓ ${esc(ESTADO[r.estado] || r.estado)}</b></p>
        <p>${esc(nombreEsp(r.espacio_id))} · ${esc(fechaLarga(r.fecha))}, de ${hhmm(r.hora_inicio)} a ${hhmm(r.hora_fin)}.</p>
        <p class="ayuda">${r.estado === 'aprobada' ? 'Es una reserva confirmada.' : 'Todavía no es una reserva confirmada: Administración la revisará y verás aquí la respuesta.'}</p>
        <div class="esp-acciones"><button type="button" class="btn" data-otra>Hacer otra solicitud</button></div>`, 'ok');
      // Formulario listo para otra (mismo espacio y fecha); nuevo identificador de envío
      Object.assign(st, { inicio: '', fin: '', actividad: '', objetivo: '', requiere: 'no', recursos: '', solicitud: nuevoId() });
      for (const k of ['actividad', 'objetivo', 'recursos']) form.elements[k].value = '';
      form.querySelector('[name=requiere][value="no"]').checked = true;
      await Promise.all([cargarDispo(), cargarMias()]);
    } catch (err) {
      if (esConflicto(err.message)) {
        mensaje(`<p><b>${esc(err.message)}</b></p><p>Tus datos siguen aquí: elige otra franja «Disponible» y vuelve a enviar.</p>`, 'error');
        st.inicio = ''; st.fin = ''; guardar();
        await cargarDispo();
        $r('[data-dispo] [data-franja]:not(:disabled)')?.focus();
      } else {
        mensaje(`<p><b>${esSinRed(err.message) ? 'No se pudo enviar: revisa la conexión a internet.' : esc(err.message)}</b></p>
          <p>Tus datos siguen aquí${esSinRed(err.message) ? ' y en este equipo' : ''}. Si ya se había enviado, reintentar no crea otra solicitud.</p>
          <div class="esp-acciones"><button type="button" class="btn btn-primario" data-reintentar>Reintentar</button></div>`, 'error');
      }
    } finally {
      enviando = false; btn.disabled = false; btn.textContent = 'Enviar solicitud';
    }
  });

  pintar();
  await Promise.all([cargarDispo(), cargarMias()]);
}

// ---------------------------------------------------------------- Administración: aprobar o rechazar
export async function solicitudesAdmin(m, p = {}) {
  estilos();
  if (E.rol !== 'admin') { m.innerHTML = cabecera('Solicitudes de espacios') + vacio('Solo Administración revisa las solicitudes de espacios.'); return; }
  const filtro = p.ver === 'todas' ? 'todas' : 'pendientes';
  const [espacios, filas] = await Promise.all([
    E.db.select('espacios', { eq: { colegio_id: E.colegio.id }, order: 'orden' }).catch(() => []),
    E.db.select('solicitudes_espacio', { eq: { colegio_id: E.colegio.id, ...(filtro === 'pendientes' ? { estado: 'pendiente' } : {}) }, order: 'inicio' }).catch(() => []),
  ]);
  await perfiles(filas.map((x) => x.solicitante_id));
  const nombreEsp = (id) => espacios.find((e) => e.id === id)?.nombre || 'Espacio';
  m.innerHTML = cabecera('Solicitudes de espacios', { acciones: `<a class="btn btn-chico" href="#/espacios-solicitudes${filtro === 'pendientes' ? '?ver=todas' : ''}">${filtro === 'pendientes' ? 'Ver todas' : 'Ver pendientes'}</a>` }) + `
    <div data-esp-admin>
    <p class="ayuda">Al aprobar, la base vuelve a revisar que el espacio no tenga otra reserva confirmada ni un bloqueo en ese horario.</p>
    ${filas.length ? `<div class="lista">${filas.map((x) => `<div class="tarjeta esp-solicitud" data-id="${esc(x.id)}">
      <p><b>${esc(nombreEsp(x.espacio_id))}</b> · ${esc(fechaLarga(x.fecha))}, ${hhmm(x.hora_inicio)}–${hhmm(x.hora_fin)}</p>
      <p>${chip(x.estado)} · ${esc(nombre(E.perfiles.get(x.solicitante_id)))} · enviada ${esc(fechaHora(x.creado_en))}</p>
      <p><b>Actividad:</b> ${esc(x.actividad)}</p><p><b>Objetivo:</b> ${esc(x.objetivo)}</p>
      <p><b>Recursos:</b> ${x.requiere_recursos ? esc(x.recursos) : 'No requiere'}</p>
      ${x.nota_decision ? `<p class="ayuda">Nota: ${esc(x.nota_decision)}</p>` : ''}
      ${x.estado === 'pendiente' ? `<div class="esp-acciones"><button class="btn btn-primario" data-decidir="si">Aprobar</button><button class="btn" data-decidir="no">Rechazar</button></div>` : ''}
    </div>`).join('')}</div>` : vacio(filtro === 'pendientes' ? 'No hay solicitudes pendientes.' : 'Aún no hay solicitudes de espacios.')}
    </div>`;

  m.querySelector('[data-esp-admin]').addEventListener('click', async (e) => {
    const bt = e.target.closest('[data-decidir]');
    if (!bt) return;
    const id = bt.closest('[data-id]').dataset.id;
    const aprobar = bt.dataset.decidir === 'si';
    const r = await ventana({
      titulo: aprobar ? 'Aprobar la solicitud' : 'Rechazar la solicitud',
      html: `<p>${aprobar ? 'Quedará como <b>reserva confirmada</b> y el profesor lo verá.' : 'El profesor verá que fue rechazada.'}</p>
        <label>Nota para el profesor (opcional)<textarea name="nota" rows="3" maxlength="500" placeholder="${aprobar ? 'Ej.: Los recursos se entregan en coordinación' : 'Ej.: Ese día el laboratorio está en mantenimiento'}"></textarea></label>`,
      botones: [{ texto: 'Cancelar', valor: null }, { texto: aprobar ? 'Aprobar' : 'Rechazar', antes: async (caja) => {
        const nota = caja.querySelector('[name=nota]').value;
        return await E.db.rpc('decidir_solicitud_espacio', { p_id: id, p_aprobar: aprobar, p_nota: nota || null });
      } }],
    });
    if (!r) return;
    E.db.refrescar('solicitudes_espacio');
    aviso(r.estado === 'aprobada' ? 'Reserva confirmada' : 'Solicitud rechazada');
    solicitudesAdmin(m, p);
  });
}
