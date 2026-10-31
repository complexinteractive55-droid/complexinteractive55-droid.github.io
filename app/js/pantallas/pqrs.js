// PQRS — Peticiones, Quejas, Reclamos y Sugerencias (pedido de Fabio, 28-oct-2026). Necesita la migración 20261028200000_pqrs.
// Todos los perfiles presentan PQRS (#/pqrs?tab=nueva) y ven las suyas («Mis PQRS»). Los responsables de un área ven su bandeja;
// el administrador general, la supervisión y la configuración de áreas, responsables, secciones y permisos de salud.
// La base decide qué ve cada quien (lo de salud llega oculto a quien no tiene permiso): esta pantalla solo lo muestra.
// Lo escrito se guarda en el equipo hasta que el servidor confirma, con el mismo identificador de envío (reintentar no duplica).
import { E } from '../estado.js';
import { esc, aviso, ventana, vacio, fechaHora, fecha, ROL, confirmar } from '../ui.js';
import { cabecera, pestanas } from './comun.js';
import { TIPOS, ESTADO_AREA, ESTADO_GENERAL, AYUDA_ESTADO, MAX_ASUNTO, MAX_DESCRIPCION, MAX_TEXTO, AREAS, SECCIONES, validar, esSinRed } from '../pqrs_reglas.js';
import { LIMITES, IMAGENES, revisarArchivo, prepararFoto, tamanoTexto } from '../pqrs_archivos.js';

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
  @media (max-width: 520px) { .pq-datos dl { grid-template-columns: 1fr; gap: 0; } .pq-datos dd { margin-bottom: 8px; } }
  .solo-lector { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .pq-chat { display: grid; gap: 10px; min-width: 0; }
  .pq-asunto { margin: 6px 0 2px; font-size: 18px; overflow-wrap: anywhere; }
  .pq-hilo { display: flex; flex-direction: column; gap: 8px; max-height: 62vh; min-height: 140px; overflow-y: auto; padding: 10px; border: 1px solid var(--borde); border-radius: var(--radio); background: var(--superficie-2); overscroll-behavior: contain; }
  .pq-burbuja { max-width: min(88%, 640px); padding: 8px 12px; border-radius: 14px; background: var(--superficie); border: 1px solid var(--borde); align-self: flex-start; min-width: 0; }
  .pq-burbuja.mia { align-self: flex-end; background: var(--primario-suave); }
  .pq-burbuja.inicio { border-left: 4px solid var(--primario); }
  .pq-burbuja.comentario { border: 2px dashed var(--alerta); }
  .pq-burbuja.pendiente[data-estado="error"], .pq-burbuja.pendiente[data-estado="sin_confirmar"] { border: 2px solid var(--peligro); }
  .pq-burbuja header { font-size: 13px; color: var(--texto-2); overflow-wrap: anywhere; } .pq-burbuja header b { color: var(--texto); }
  .pq-burbuja .texto { white-space: pre-wrap; overflow-wrap: anywhere; margin: 4px 0; }
  .pq-burbuja footer { font-size: 12px; color: var(--texto-2); display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .pq-etq { font-weight: 600; } .pq-pend { color: var(--texto-2); } .pq-falla { color: var(--peligro); font-weight: 600; } .pq-ok { color: var(--ok); }
  .pq-adjs { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
  .pq-adj-img { width: 120px; height: 90px; padding: 0; border: 1px solid var(--borde); border-radius: 10px; overflow: hidden; background: var(--superficie-2); cursor: zoom-in; }
  .pq-adj-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .pq-adj-doc { display: inline-flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 6px 10px; border: 1px solid var(--borde); border-radius: 10px; background: var(--superficie); max-width: 240px; text-align: left; cursor: pointer; color: inherit; font: inherit; }
  .pq-adj-doc span { overflow-wrap: anywhere; } .pq-adj-doc small, .pq-adj-error { font-size: 12px; color: var(--texto-2); }
  .pq-adj-botones { display: flex; flex-wrap: wrap; gap: 6px; }
  .pq-adj-botones .btn { min-height: 40px; }
  .pq-adj-lista { list-style: none; margin: 6px 0; padding: 0; display: grid; gap: 6px; }
  .pq-adj-item { display: flex; align-items: center; gap: 8px; padding: 6px; border: 1px solid var(--borde); border-radius: 10px; background: var(--superficie); }
  .pq-adj-item img, .pq-adj-ic { width: 44px; height: 44px; object-fit: cover; border-radius: 8px; flex: none; display: grid; place-items: center; font-size: 22px; }
  .pq-adj-item.error { border-color: var(--peligro); } .pq-adj-item.listo { border-color: var(--ok); }
  .pq-adj-info { flex: 1; min-width: 0; display: grid; } .pq-adj-info b { overflow-wrap: anywhere; font-size: 14px; } .pq-adj-info progress { width: 100%; }
  .pq-adj-item .btn-icono { min-width: 44px; min-height: 44px; }
  .pq-modos { display: flex; flex-wrap: wrap; gap: 8px; border: 0; padding: 0; margin: 0; min-width: 0; } .pq-modos legend { font-weight: 700; margin-bottom: 4px; padding: 0; }
  .pq-modo { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 6px 12px; border: 1px solid var(--borde); border-radius: 999px; cursor: pointer; font-weight: 600; }
  .pq-modo input { width: 20px; height: 20px; margin: 0; }
  .pq-modo:has(input:checked) { border-color: var(--primario); background: var(--primario-suave); box-shadow: inset 0 0 0 1px var(--primario); }
  .pq-modo.pq-interno:has(input:checked) { border-color: var(--alerta); background: var(--superficie-2); box-shadow: inset 0 0 0 2px var(--alerta); }
  .pq-modo:focus-within { outline: 3px solid var(--primario); outline-offset: 2px; }
  .pq-compositor.modo-interno textarea { border: 2px dashed var(--alerta); }
  .pq-escribir { display: flex; gap: 8px; align-items: flex-end; } .pq-texto { flex: 1; margin: 0; min-width: 0; } .pq-texto textarea { resize: none; min-height: 44px; width: 100%; }
  .pq-enviar { min-height: 44px; flex: none; }
  @media (max-width: 520px) { .pq-escribir { flex-wrap: wrap; } .pq-texto { flex-basis: 100%; } .pq-enviar { width: 100%; } }
  .pq-nuevos { justify-self: center; } .pq-mas, .pq-vacio { text-align: center; }
  .pq-finalizada { border-left: 5px solid var(--ok); }
  .pq-gestion summary { font-weight: 700; cursor: pointer; min-height: 44px; display: flex; align-items: center; }
  .pq-gestion h3 { margin: 14px 0 6px; font-size: 16px; }
  .pq-visor img { max-width: 100%; max-height: 70vh; display: block; margin: 0 auto; }`;
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
        <div class="pq-form-adjuntos"><b>Fotos o documentos (opcional)</b><div data-adjuntos></div></div>
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
  const adj = selectorAdjuntos(c.querySelector('[data-adjuntos]'), { pqrs: null });
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
    if (adj.ocupado()) { mensaje('<p>Espera a que terminen de subir y verificarse los archivos (o quítalos).</p>', 'error'); return; }
    enviando = true;
    const btn = c.querySelector('[data-enviar]');
    btn.disabled = true; btn.textContent = 'Enviando…';
    mensaje('<p>Enviando tu PQRS…</p>');
    recordar();
    try {
      const listos = adj.listos().map((x) => x.id);
      const r = await rpc('pqrs_presentar', { p_colegio: E.colegio.id, p_solicitud: st.solicitud, p_tipo: st.tipo, p_asunto: st.asunto.trim(),
        p_descripcion: st.descripcion.trim(), p_estudiante: st.estudiante || null, p_rol: E.rol, p_adjuntos: listos.length ? listos : null });
      if (!r?.id || !r?.consecutivo) throw new Error('El servidor no confirmó la PQRS. Intenta de nuevo.');
      borrar('borrador');
      adj.vaciar();
      mensaje(`<p><b>✓ PQRS recibida</b>${r.adjuntos ? ` con ${r.adjuntos} archivo(s)` : ''}</p>
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
  cerrada: (e) => `Se finalizó la PQRS${e.detalle.motivo ? ` · conclusión: ${e.detalle.motivo}` : ''}`,
  reabierta: (e) => `Se reabrió el caso${e.detalle.motivo ? ` · motivo: ${e.detalle.motivo}` : ''}`,
  resumen: () => 'Se actualizó el resumen para coordinar (sin datos clínicos)',
  salud: (e) => (e.detalle.sensible ? 'Se marcó con información de salud' : 'Se quitó la marca de salud') + (e.detalle.motivo ? ` · motivo: ${e.detalle.motivo}` : ''),
  clasificacion_confirmada: () => 'El administrador confirmó la clasificación',
};

// ---------------------------------------------------------------- Detalle: la PQRS como conversación (29-oct-2026)
// Encabezado compacto, el hilo (la descripción original es el primer mensaje; no se copia), el compositor con adjuntos y,
// aparte, «Gestión del caso» con todo lo de antes (áreas, salud, clasificación, visto por, cronología, finalizar).
// Lo que se envía aparece al instante como «Pendiente» y pasa a «Enviado» SOLO cuando el servidor lo confirma; si falla queda
// «No enviado» con el texto y Reintentar (mismo identificador: no se duplica). Los mensajes nuevos llegan por un aviso en vivo
// privado (sin contenido) y, si ese canal falla, por consulta cada pocos segundos.
const chats = new Map(); // estado por caso: mensajes confirmados, pendientes y borrador (sobrevive a repintar la pantalla)
let soltarChat = null;   // deja de escuchar el caso al salir de la pantalla
window.addEventListener('hashchange', () => { if (!/^#\/pqrs\/[0-9a-f-]{36}/.test(location.hash)) { soltarChat?.(); soltarChat = null; } });
const ICONO = { pdf: '📄', docx: '📝', xlsx: '📊' };
const horaCorta = (iso) => { const d = new Date(iso), hoy = new Date(); return d.toDateString() === hoy.toDateString() ? d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : fechaHora(iso); };
const etiquetaRol = (r) => ROL[r] || r || '';
const urls = new Map(); // persona|ruta → { url, hasta } (enlaces firmados de 2 minutos: se usan 90 s; nunca se comparten entre cuentas)
async function urlDe(a, descargar = false) {
  const k = E.yo.id + '|' + a.ruta + (descargar ? '|d' : '');
  const c = urls.get(k);
  if (c && c.hasta > Date.now()) return c.url;
  const url = await E.db.urlAdjunto(a.ruta, a.nombre, descargar);
  urls.set(k, { url, hasta: Date.now() + 90000 });
  return url;
}

// Por persona y caso: si en el mismo equipo entra otra cuenta, no ve nada de lo que se cargó para la anterior
function estadoDe(id) {
  const k = E.yo.id + '|' + id;
  if (!chats.has(k)) chats.set(k, { mensajes: new Map(), inicio: null, hayAnteriores: false, pendientes: new Map(), borrador: null, ultimo: null, cab: null, gestion: null });
  return chats.get(k);
}
const olvidarChat = (id) => chats.get(E.yo.id + '|' + id)?.mensajes.clear(); // tras una acción: se vuelve a pedir el hilo (se conserva lo pendiente y el panel abierto)
// Pendientes guardados en el equipo: si se recarga sin confirmación, siguen ahí para reintentar (no se dan por enviados)
const clavePend = (id) => `pend_${id}`;
const guardarPend = (id, st) => guardar(clavePend(id), [...st.pendientes.values()].map(({ solicitud, modo, area, texto, salud, adjuntos, estado, error, creado }) =>
  ({ solicitud, modo, area, texto, salud, adjuntos, estado: estado === 'enviando' ? 'sin_confirmar' : estado, error, creado })));

export async function detalle(m, p) {
  estilos();
  soltarChat?.(); soltarChat = null;
  let d;
  try { d = await rpc('pqrs_detalle', { p_id: p.id }); }
  catch (e) { m.innerHTML = cabecera('PQRS', { volver: '#/pqrs' }) + vacio(e.message); return; }
  const st = estadoDe(d.id);
  st.mensajes.clear(); st.inicio = null; st.ultimo = null; // el hilo se vuelve a pedir entero al abrir (lo confirmado viene del servidor)
  if (!st.pendientes.size) for (const x of leer(clavePend(d.id)) || []) st.pendientes.set(x.solicitud, x);
  const yo = d.yo, personal = yo.personal, abierto = d.estado !== 'cerrada';
  const misAreas = d.areas.filter((a) => a.activa && yo.areas.includes(a.id));
  const puedeEscribir = abierto && (misAreas.length || yo.admin || yo.puede_aportar);
  st.borrador ||= { modo: personal ? '' : 'aporte', area: misAreas[0]?.id || '', texto: '', salud: null, solicitud: nuevoId() };
  const borr = st.borrador;
  const volver = personal ? (yo.admin ? '#/pqrs?tab=supervision' : '#/pqrs?tab=area') : '#/pqrs?tab=mias';
  m.innerHTML = cabecera(esc(d.consecutivo), { volver }) + `
    <div class="pq-chat" data-pq-detalle>
      <section class="tarjeta pq-chat-cab" data-cab>${cabChat(d)}</section>
      <section class="pq-hilo" data-hilo role="log" aria-live="polite" aria-label="Conversación de la PQRS"></section>
      <button type="button" class="btn btn-chico pq-nuevos" data-ir-abajo hidden>Mensajes nuevos ↓</button>
      <div data-zona-escribir></div>
      <details class="tarjeta pq-gestion" data-gestion ${st.gestion ?? (personal && (d.revisar || !d.areas.length)) ? 'open' : ''}><summary>${personal ? 'Gestión del caso: áreas, datos, visto por y cronología' : 'Datos y cronología del caso'}</summary>${gestionHTML(d)}</details>
    </div>`;
  const raiz = m.querySelector('[data-pq-detalle]'), hiloEl = raiz.querySelector('[data-hilo]');
  raiz.querySelector('[data-gestion]').addEventListener('toggle', (e) => { st.gestion = e.target.open; }); // sigue abierto tras una acción
  const recargar = () => detalle(m, p);

  // ---- Hilo
  const abajo = () => hiloEl.scrollHeight - hiloEl.scrollTop - hiloEl.clientHeight < 80;
  const pintar = ({ alFinal = false } = {}) => {
    const seguir = alFinal || abajo();
    const confirmados = [...st.mensajes.values()].sort((x, y) => x.creado_en.localeCompare(y.creado_en) || x.id.localeCompare(y.id));
    const yaConfirmadas = new Set(confirmados.map((x) => x.solicitud_id).filter(Boolean));
    for (const s of [...st.pendientes.keys()]) if (yaConfirmadas.has(s)) st.pendientes.delete(s); // llegó por otro lado (reintento, recarga)
    hiloEl.innerHTML = (st.hayAnteriores ? '<div class="pq-mas"><button type="button" class="btn btn-chico" data-anteriores>Ver mensajes anteriores</button></div>' : '')
      + (st.inicio && !st.hayAnteriores ? burbujaInicio(st.inicio) : '')
      + confirmados.map((x) => burbuja(x, { abierto })).join('')
      + [...st.pendientes.values()].map(burbujaPendiente).join('')
      + (!confirmados.length && !st.pendientes.size ? `<p class="ayuda pq-vacio">${personal ? 'Aún no hay respuestas ni comentarios.' : 'Aún no hay respuestas. Te avisaremos por la Mensajería.'}</p>` : '');
    cargarImagenes(hiloEl);
    if (seguir) hiloEl.scrollTop = hiloEl.scrollHeight;
    else raiz.querySelector('[data-ir-abajo]').hidden = false;
    guardarPend(d.id, st);
  };
  const aplicar = (r, { inicial = false } = {}) => {
    if (r.inicio) st.inicio = r.inicio;
    if (inicial || r.inicio) st.hayAnteriores = r.hay_anteriores;
    for (const x of r.mensajes) if (x) st.mensajes.set(x.id, x);
    st.ultimo = r.ahora;
    st.cab = { estado: r.estado, pendientes: r.pendientes, cerrada: r.cerrada, cierre: r.cierre };
    const cab = raiz.querySelector('[data-cab]');
    if (cab) cab.innerHTML = cabChat({ ...d, estado: r.estado, pendientes: r.pendientes });
  };
  let pidiendo = false;
  const traerNuevos = async () => {
    if (pidiendo || !document.body.contains(hiloEl)) return;
    pidiendo = true;
    try {
      const desde = st.ultimo ? new Date(new Date(st.ultimo).getTime() - 120000).toISOString() : null; // 2 min de margen: no se pierde lo que llegó tarde
      const r = await rpc('pqrs_mensajes', { p_id: d.id, p_desde: desde, p_antes: null, p_limite: 50 });
      const antes = st.mensajes.size, cerrabaAntes = st.cab?.cerrada;
      aplicar(r);
      pintar();
      if (r.cerrada !== cerrabaAntes && cerrabaAntes !== undefined) recargar(); // se finalizó o reabrió: la pantalla cambia entera
      else if (st.mensajes.size !== antes) estadoConexion('');
    } catch (e) { if (esSinRed(e.message)) estadoConexion('Sin conexión: los mensajes nuevos llegarán al volver la conexión.'); }
    finally { pidiendo = false; }
  };
  const estadoConexion = (t) => { const el = raiz.querySelector('[data-conexion]'); if (el) el.textContent = t; };

  // Primera carga del hilo (los últimos 50) y recuperar lo pendiente
  try { aplicar(await rpc('pqrs_mensajes', { p_id: d.id, p_desde: null, p_antes: null, p_limite: 50 }), { inicial: true }); }
  catch (e) { hiloEl.innerHTML = `<p class="pq-msg error">${esc(e.message)}</p>`; }
  pintar({ alFinal: true });

  // ---- Aviso en vivo + consulta periódica (si el canal no está conectado, cada 15 s; si lo está, cada 60 s por si acaso)
  let enVivo = false, reloj = null;
  const programar = () => { clearTimeout(reloj); reloj = setTimeout(async () => { if (document.visibilityState === 'visible') await traerNuevos(); programar(); }, enVivo ? 60000 : 15000); };
  const dejar = E.db.escucharCanal ? E.db.escucharCanal(`${personal ? 'pqrs-personal' : 'pqrs'}:${d.id}`, () => traerNuevos(), (estado) => { enVivo = estado === 'SUBSCRIBED'; programar(); }) : () => {};
  const alVolver = () => { if (document.visibilityState === 'visible') traerNuevos(); };
  const alConectar = () => { estadoConexion(''); traerNuevos(); };
  document.addEventListener('visibilitychange', alVolver);
  window.addEventListener('online', alConectar);
  programar();
  soltarChat = () => { dejar(); clearTimeout(reloj); document.removeEventListener('visibilitychange', alVolver); window.removeEventListener('online', alConectar); };

  hiloEl.addEventListener('scroll', () => { if (abajo()) raiz.querySelector('[data-ir-abajo]').hidden = true; });
  raiz.querySelector('[data-ir-abajo]').onclick = () => { hiloEl.scrollTop = hiloEl.scrollHeight; raiz.querySelector('[data-ir-abajo]').hidden = true; };

  // ---- Compositor
  const zona = raiz.querySelector('[data-zona-escribir]');
  if (!abierto) {
    zona.innerHTML = `<section class="tarjeta pq-finalizada" data-finalizada><b>✅ PQRS finalizada</b>${d.cierre ? ` el ${esc(fechaHora(d.cierre.en))}${d.cierre.por ? ` por ${esc(d.cierre.por)}` : ''}` : ''}.
      ${d.cierre?.motivo ? `<p><b>Conclusión:</b> ${esc(d.cierre.motivo)}</p>` : ''}
      ${borr.texto.trim() ? `<div class="pq-reservado" data-borrador-guardado><b>Tenías un mensaje sin enviar</b> (no se envió: la PQRS se finalizó). Aquí sigue para que lo copies:<div class="texto">${esc(borr.texto)}</div></div>` : ''}<p class="ayuda">Ya no se pueden enviar mensajes. La conversación y los adjuntos siguen disponibles.${yo.puede_reabrir ? ' Puedes reabrirla en «Gestión del caso».' : ''}</p></section>`;
  } else if (puedeEscribir) {
    const comoSolicitante = !personal;
    zona.innerHTML = `<form class="tarjeta form pq-compositor" ${comoSolicitante ? 'data-aportar' : 'data-escribir'} novalidate autocomplete="off">
      ${comoSolicitante ? '' : `<fieldset class="pq-modos" aria-describedby="ayuda-modo"><legend>¿Para quién es? (elige uno)</legend>
        ${misAreas.length ? `<label class="pq-modo"><input type="radio" name="modo" value="respuesta" ${borr.modo === 'respuesta' ? 'checked' : ''}><span>✉ Para el solicitante</span></label>` : ''}
        <label class="pq-modo pq-interno"><input type="radio" name="modo" value="comentario" ${borr.modo === 'comentario' ? 'checked' : ''}><span>🔒 Comentario interno</span></label>
      </fieldset>
      ${misAreas.length > 1 || (misAreas.length && yo.admin) ? `<label>En nombre de<select name="area">${misAreas.map((a) => `<option value="${esc(a.id)}" ${borr.area === a.id ? 'selected' : ''}>${esc(a.nombre)}</option>`).join('')}${yo.admin ? `<option value="" ${borr.area === '' ? 'selected' : ''}>Administración general (solo comentario)</option>` : ''}</select></label>`
        : misAreas.length ? `<p class="ayuda">Escribes en nombre de <b>${esc(misAreas[0].nombre)}</b>.</p>` : '<p class="ayuda">Comentas como Administración general.</p>'}
      ${yo.salud && d.sensible ? '<label class="check"><input type="checkbox" name="salud"> Contiene información de salud (solo la verán Enfermería del caso y quienes tienen el permiso)</label>' : ''}
      <div class="pq-aviso-modo" data-aviso-modo id="ayuda-modo"></div>`}
      <div data-adjuntos></div>
      <div class="pq-escribir">
        <label class="pq-texto"><span class="solo-lector">${comoSolicitante ? 'Tu mensaje' : 'Mensaje'}</span><textarea name="${comoSolicitante ? 'aporte' : 'texto'}" rows="2" maxlength="${MAX_TEXTO}" placeholder="${comoSolicitante ? 'Escribe tu mensaje o agrega información…' : 'Escribe…'}"></textarea></label>
        <button type="submit" class="btn btn-primario pq-enviar" ${comoSolicitante ? 'data-enviar-aporte' : 'data-enviar-int'}>Enviar</button>
      </div>
      <div class="pq-msg" data-msg-int role="status" aria-live="polite"></div>
      <small class="ayuda" data-conexion aria-live="polite"></small>
    </form>`;
    const form = zona.querySelector('form'), txt = form.querySelector('textarea'), selArea = form.querySelector('[name=area]'), chkSalud = form.querySelector('[name=salud]');
    const msg = (t, tipo = '') => { const el = form.querySelector('[data-msg-int]'); el.className = 'pq-msg ' + tipo; el.textContent = t; };
    txt.value = borr.texto;
    const crecer = () => { txt.style.height = 'auto'; txt.style.height = Math.min(txt.scrollHeight, 200) + 'px'; };
    txt.addEventListener('input', () => { borr.texto = txt.value; crecer(); });
    crecer();
    const areaSel = () => (comoSolicitante ? null : selArea ? selArea.value || null : misAreas[0]?.id || null);
    const esEnf = () => d.areas.find((a) => a.id === areaSel())?.clave === 'enfermeria';
    if (chkSalud) chkSalud.checked = borr.salud ?? esEnf();
    const pintarModo = () => {
      if (comoSolicitante) return;
      const enAdmin = !areaSel(), r = form.querySelector('[value=respuesta]');
      if (r) { r.disabled = enAdmin; if (enAdmin && borr.modo === 'respuesta') { borr.modo = ''; r.checked = false; } }
      const caja = form.querySelector('[data-aviso-modo]'), btn = form.querySelector('[data-enviar-int]');
      caja.className = 'pq-aviso-modo ' + borr.modo;
      caja.textContent = borr.modo === 'respuesta' ? '✉ Lo verá el SOLICITANTE: queda como respuesta oficial de tu área.'
        : borr.modo === 'comentario' ? '🔒 COMENTARIO INTERNO: el solicitante NO lo verá; no marca el caso como respondido.' : 'Elige primero si es para el solicitante o interno.';
      form.classList.toggle('modo-interno', borr.modo === 'comentario');
      btn.textContent = borr.modo === 'respuesta' ? 'Enviar al solicitante' : borr.modo === 'comentario' ? 'Guardar interno' : 'Enviar';
    };
    pintarModo();
    form.addEventListener('change', (e) => {
      if (e.target.name === 'modo') borr.modo = e.target.value;
      if (e.target.name === 'area') { borr.area = e.target.value; if (chkSalud && borr.salud == null) chkSalud.checked = esEnf(); }
      if (e.target.name === 'salud') borr.salud = e.target.checked;
      pintarModo();
    });
    const adj = selectorAdjuntos(form.querySelector('[data-adjuntos]'), { pqrs: d.id, alCambiar: () => {} });
    // Enter envía en el computador; en el celular Enter es salto de línea (el teclado no tiene Mayús+Enter cómodo)
    txt.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(pointer: coarse)').matches) { e.preventDefault(); form.requestSubmit(); } });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const modo = comoSolicitante ? 'aporte' : borr.modo;
      if (!modo) { msg('Elige si es para el solicitante o un comentario interno.', 'error'); form.querySelector('[name=modo]')?.focus(); return; }
      if (adj.ocupado()) { msg('Espera a que terminen de subir y verificarse los archivos (o quítalos).', 'error'); return; }
      const texto = txt.value.trim(), listos = adj.listos();
      if (!texto && !listos.length) { msg(comoSolicitante ? 'Escribe tu mensaje o agrega un archivo.' : 'Escribe el mensaje o agrega un archivo.', 'error'); txt.focus(); return; }
      if (comoSolicitante && texto && texto.length < 3 && !listos.length) { msg('Escribe la información (mínimo 3 letras).', 'error'); txt.focus(); return; }
      msg('');
      const pend = { solicitud: borr.solicitud, modo, area: modo === 'aporte' ? null : areaSel(), texto, salud: chkSalud ? chkSalud.checked : null,
        adjuntos: listos.map(({ id, nombre, tamano, ext }) => ({ id, nombre, tamano, ext })), estado: 'enviando', error: null, creado: new Date().toISOString() };
      st.pendientes.set(pend.solicitud, pend);
      // Se limpia el compositor ya: se puede seguir escribiendo el siguiente mensaje (con otro identificador)
      Object.assign(borr, { texto: '', salud: null, solicitud: nuevoId() });
      txt.value = ''; crecer(); adj.vaciar(); txt.focus();
      pintar({ alFinal: true });
      enviarPendiente(pend);
    });
  } else {
    zona.innerHTML = '<p class="ayuda">Puedes leer el caso. No eres responsable de un área asignada, así que no puedes escribir en él.</p>';
  }

  // Envío (y reintento con el MISMO identificador: el servidor devuelve el mismo mensaje si ya lo tenía)
  async function enviarPendiente(pend) {
    pend.estado = 'enviando'; pend.error = null; pintar();
    try {
      const r = await rpc('pqrs_enviar', { p_id: d.id, p_modo: pend.modo, p_area: pend.area, p_solicitud: pend.solicitud, p_contenido: pend.texto, p_salud: pend.salud,
        p_adjuntos: pend.adjuntos.length ? pend.adjuntos.map((x) => x.id) : null });
      if (!r?.mensaje?.id) throw new Error('El servidor no confirmó el mensaje. Reintenta.');
      st.pendientes.delete(pend.solicitud);
      st.mensajes.set(r.mensaje.id, r.mensaje);
      const cab = raiz.querySelector('[data-cab]');
      if (cab) cab.innerHTML = cabChat({ ...d, estado: r.estado, pendientes: d.pendientes });
      pintar({ alFinal: true });
      traerNuevos();
    } catch (e) {
      pend.estado = 'error';
      pend.error = esSinRed(e.message) ? 'Sin conexión: no se envió. El texto sigue aquí.' : /cerrado|finalizada/.test(e.message) ? 'La PQRS se finalizó antes de que llegara: no se envió. Copia el texto si lo necesitas.' : e.message;
      pintar();
    }
  }

  // ---- Clics del hilo y de la gestión
  raiz.addEventListener('click', async (e) => {
    const b = e.target.closest('button, a[data-abrir-adjunto]');
    if (!b) return;
    if (b.hasAttribute('data-anteriores')) {
      const primero = [...st.mensajes.values()].sort((x, y) => x.creado_en.localeCompare(y.creado_en))[0];
      try {
        const r = await rpc('pqrs_mensajes', { p_id: d.id, p_desde: null, p_antes: primero?.creado_en || null, p_limite: 50 });
        for (const x of r.mensajes) if (x) st.mensajes.set(x.id, x);
        st.hayAnteriores = r.hay_anteriores;
        const alto = hiloEl.scrollHeight; pintar(); hiloEl.scrollTop = hiloEl.scrollHeight - alto;
      } catch (err) { aviso(err.message, 'error'); }
      return;
    }
    if (b.dataset.reintentar) { const pd = st.pendientes.get(b.dataset.reintentar); if (pd) enviarPendiente(pd); return; }
    if (b.dataset.descartar) {
      const pd = st.pendientes.get(b.dataset.descartar);
      if (pd && await confirmar('¿Descartar este mensaje?', 'No se envió. Si lo descartas, el texto se borra de este equipo.', 'Descartar')) { st.pendientes.delete(pd.solicitud); pintar(); }
      return;
    }
    if (b.dataset.abrirAdjunto) { e.preventDefault(); return abrirAdjunto(b.dataset.abrirAdjunto); }
    return accionGestion(b, d, recargar, conMotivo);
  });
  const conMotivo = (titulo, html, etiqueta, fn, ok) => ventana({
    titulo, html: `${html}<label>${esc(etiqueta)}<textarea name="motivo" rows="3" maxlength="1000"></textarea></label>`,
    botones: [{ texto: 'Cancelar', valor: null }, { texto: 'Guardar', antes: async (caja) => fn(caja.querySelector('[name=motivo]').value.trim(), caja) }],
  }).then((r) => { if (r) { aviso(ok); olvidarChat(d.id); recargar(); } });

  // Adjuntos: ver una imagen grande o descargar un documento (enlace firmado pedido en el momento)
  async function abrirAdjunto(id) {
    const a = [...st.mensajes.values()].flatMap((x) => x.adjuntos || []).concat(st.inicio?.adjuntos || []).find((x) => x.id === id);
    if (!a) return;
    try {
      if (a.imagen) {
        const url = await urlDe(a);
        await ventana({ titulo: a.nombre, html: `<div class="pq-visor"><img src="${esc(url)}" alt="${esc(a.nombre)}"></div><p class="ayuda">${esc(tamanoTexto(a.tamano))}</p>`,
          botones: [{ texto: 'Descargar', antes: async () => { window.open(await urlDe(a, true), '_blank', 'noopener'); return false; } }, { texto: 'Cerrar', valor: null }] });
      } else window.open(await urlDe(a, true), '_blank', 'noopener');
    } catch (err) { aviso(esSinRed(err.message) ? 'Sin conexión: no se pudo abrir el archivo.' : 'No se pudo abrir el archivo: ' + err.message, 'error'); }
  }
}

// Miniaturas de las fotos del hilo: el enlace firmado se pide al pintarlas; si falla, queda un botón para reintentar
function cargarImagenes(raiz) {
  for (const el of raiz.querySelectorAll('[data-miniatura]:not([data-cargada])')) {
    el.dataset.cargada = '1';
    const a = { ruta: el.dataset.ruta, nombre: el.dataset.nombre };
    urlDe(a).then((u) => { el.innerHTML = `<img src="${esc(u)}" alt="${esc(a.nombre)}" loading="lazy">`; })
      .catch(() => { el.innerHTML = '<span class="pq-adj-error">No se pudo cargar · toca para reintentar</span>'; delete el.dataset.cargada; });
  }
}

function cabChat(d) {
  const activas = d.areas.filter((a) => a.activa);
  return `<div class="pq-caso-cab"><span class="pq-tipo">${esc(TIPOS[d.tipo] || d.tipo)}</span>${chipEstado(d.estado)}${d.sensible ? '<span class="pq-badge info">🔒 Información de salud</span>' : ''}${d.revisar ? '<span class="pq-badge suave">Revisar clasificación</span>' : ''}</div>
    <h2 class="pq-asunto" data-asunto>${esc(d.asunto)}</h2>
    <div class="pq-areas">${activas.length ? activas.map(chipArea).join('') : '<span class="pq-badge suave">Pendiente de clasificación</span>'}</div>
    ${d.estado !== 'cerrada' && d.pendientes?.length && d.pendientes.length < activas.length ? `<small class="ayuda">Falta responder: <b>${esc(lista(d.pendientes))}</b></small>` : ''}`;
}

const adjuntosHTML = (as) => (as?.length ? `<div class="pq-adjs">${as.map((a) => a.imagen
  ? `<button type="button" class="pq-adj-img" data-abrir-adjunto="${esc(a.id)}" data-miniatura data-ruta="${esc(a.ruta)}" data-nombre="${esc(a.nombre)}" aria-label="Ver la foto ${esc(a.nombre)}"><span class="pq-adj-error">Cargando foto…</span></button>`
  : `<button type="button" class="pq-adj-doc" data-abrir-adjunto="${esc(a.id)}" aria-label="Descargar ${esc(a.nombre)}">${ICONO[a.extension] || '📎'} <span>${esc(a.nombre)}</span><small>${esc(tamanoTexto(a.tamano))} · descargar</small></button>`).join('')}</div>` : '');

function burbujaInicio(x) {
  return `<article class="pq-burbuja inicio ${x.mia ? 'mia' : ''}" data-inicio>
    <header><b>${esc(x.autor)}</b> · ${esc(etiquetaRol(x.rol))} · <span class="pq-etq">Descripción original</span></header>
    <div class="texto" data-descripcion>${x.oculto_salud ? '<span class="pq-reservado">Reservada: tiene información de salud. Solo la ven Enfermería del caso y quienes tienen el permiso de salud.</span>' : esc(x.contenido)}</div>
    ${adjuntosHTML(x.adjuntos)}
    <footer><time datetime="${esc(x.creado_en)}">${esc(fechaHora(x.creado_en))}</time></footer>
  </article>`;
}

function burbuja(i, { abierto }) {
  const etq = i.tipo === 'respuesta' ? `Respuesta al solicitante · ${esc(i.area || '')}` : i.tipo === 'comentario' ? `🔒 Comentario interno · ${esc(i.area || 'Administración general')}` : `Información del solicitante${i.rol ? ' · ' + esc(etiquetaRol(i.rol)) : ''}`;
  return `<article class="pq-burbuja ${i.tipo} ${i.mia ? 'mia' : ''}" data-int="${esc(i.id)}">
    <header><b>${esc(i.autor)}</b> · <span class="pq-etq">${etq}</span></header>
    ${i.oculto_salud ? `<p class="pq-reservado">Contenido de salud reservado: solo lo ven Enfermería del caso y quienes tienen el permiso de salud.${i.adjuntos_ocultos ? ` (${i.adjuntos_ocultos} adjunto(s) reservado(s))` : ''}</p>` : `${i.contenido ? `<div class="texto">${esc(i.contenido)}</div>` : ''}${adjuntosHTML(i.adjuntos)}`}
    <footer><time datetime="${esc(i.creado_en)}" title="${esc(fechaHora(i.creado_en))}">${esc(horaCorta(i.creado_en))}</time>${i.mia ? ' · <span class="pq-ok">✓ Enviado</span>' : ''}${i.editado_en ? ` · <b>corregido</b>` : ''}
      ${i.mia && i.tipo !== 'aporte' && abierto && !i.oculto_salud ? `<button type="button" class="btn-link" data-corregir="${esc(i.id)}">Corregir</button>` : ''}</footer>
  </article>`;
}

function burbujaPendiente(x) {
  const etq = x.modo === 'respuesta' ? 'Respuesta al solicitante' : x.modo === 'comentario' ? '🔒 Comentario interno' : 'Tu mensaje';
  const estado = x.estado === 'enviando' ? '<span class="pq-pend">⏳ Pendiente…</span>'
    : `<span class="pq-falla" role="alert">⚠ ${x.estado === 'sin_confirmar' ? 'Sin confirmar (se recargó la página antes de la respuesta del servidor)' : 'No enviado'}${x.error ? ': ' + esc(x.error) : ''}</span>
       <button type="button" class="btn btn-chico" data-reintentar="${esc(x.solicitud)}">Reintentar</button><button type="button" class="btn-link" data-descartar="${esc(x.solicitud)}">Descartar</button>`;
  return `<article class="pq-burbuja mia ${x.modo} pendiente" data-pendiente="${esc(x.solicitud)}" data-estado="${esc(x.estado)}">
    <header><span class="pq-etq">${etq}</span></header>
    ${x.texto ? `<div class="texto">${esc(x.texto)}</div>` : ''}
    ${x.adjuntos?.length ? `<div class="pq-adjs">${x.adjuntos.map((a) => `<span class="pq-adj-doc">📎 <span>${esc(a.nombre)}</span><small>${esc(tamanoTexto(a.tamano))}</small></span>`).join('')}</div>` : ''}
    <footer>${estado}</footer>
  </article>`;
}

// Selector de adjuntos (crear la PQRS y dentro del chat): tomar foto (si el equipo tiene cámara), galería y documentos.
// Cada archivo se prepara, sube y verifica apenas se elige; el mensaje solo lleva los que quedaron «listo».
function selectorAdjuntos(caja, { pqrs = null } = {}) {
  const items = [];
  caja.innerHTML = `<div class="pq-adj-botones">
      <button type="button" class="btn btn-chico" data-elegir="camara" aria-label="Tomar una foto con la cámara">📷 Foto</button>
      <button type="button" class="btn btn-chico" data-elegir="galeria" aria-label="Elegir fotos de la galería">🖼 Galería</button>
      <button type="button" class="btn btn-chico" data-elegir="documento" aria-label="Adjuntar un documento PDF">📄 Documento</button>
    </div>
    <input type="file" hidden data-entrada="camara" accept="image/*" capture="environment">
    <input type="file" hidden data-entrada="galeria" accept="image/*" multiple>
    <input type="file" hidden data-entrada="documento" accept=".pdf,application/pdf" multiple>
    <ul class="pq-adj-lista" data-adj-lista aria-label="Archivos adjuntos"></ul>
    <small class="ayuda">Fotos (JPG, PNG, WEBP, HEIC) o PDF, hasta ${LIMITES.max_mb} MB y ${LIMITES.por_mensaje} por mensaje. Las fotos se guardan sin los datos ocultos (ubicación).</small>`;
  const pintar = () => {
    caja.querySelector('[data-adj-lista]').innerHTML = items.map((x) => `<li class="pq-adj-item ${x.estado}" data-clave="${x.clave}">
      ${x.vista ? `<img src="${esc(x.vista)}" alt="">` : `<span class="pq-adj-ic" aria-hidden="true">${ICONO[x.ext] || '📎'}</span>`}
      <span class="pq-adj-info"><b>${esc(x.nombre)}</b><small>${esc(tamanoTexto(x.tamano))} · ${x.estado === 'listo' ? '✓ listo (formato verificado)' : x.estado === 'error' ? '' : x.estado === 'verificando' ? 'verificando el formato…' : x.estado === 'subiendo' ? 'subiendo…' : 'preparando…'}</small>
        ${x.estado === 'subiendo' ? `<progress max="1" value="${x.avance || 0}" aria-label="Subiendo ${esc(x.nombre)}"></progress>` : ''}
        ${x.error ? `<small class="pq-falla" role="alert">${esc(x.error)}</small>` : ''}</span>
      ${x.estado === 'error' && x.reintentable ? `<button type="button" class="btn btn-chico" data-adj-reintentar="${x.clave}">Reintentar</button>` : ''}
      <button type="button" class="btn-icono" data-adj-quitar="${x.clave}" aria-label="Quitar ${esc(x.nombre)}">✕</button></li>`).join('');
  };
  const procesar = async (x) => {
    try {
      x.estado = 'preparando'; x.error = null; pintar();
      if (!x.listoParaSubir) { x.archivo = await prepararFoto(x.archivo); Object.assign(x, { tamano: x.archivo.size, nombre: x.archivo.name, listoParaSubir: true }); }
      const pr = await rpc('pqrs_adjunto_preparar', { p_colegio: E.colegio.id, p_pqrs: pqrs, p_solicitud: x.solicitud, p_nombre: x.archivo.name, p_tamano: x.archivo.size });
      Object.assign(x, { id: pr.id, ruta: pr.ruta, tipo: pr.tipo });
      if (pr.estado === 'subiendo') {
        x.estado = 'subiendo'; pintar();
        await E.db.subirConAvance('pqrs-adjuntos', pr.ruta, x.archivo, pr.tipo, (k) => { x.avance = k; const bar = caja.querySelector(`[data-clave="${x.clave}"] progress`); if (bar) bar.value = k; });
        const sub = await rpc('pqrs_adjunto_subido', { p_id: pr.id });
        if (sub.estado === 'rechazado') throw Object.assign(new Error(sub.motivo || 'El archivo no se aceptó.'), { final: true });
      }
      x.estado = 'verificando'; pintar();
      const v = await E.db.verificarAdjunto(pr.id);
      if (v.estado === 'rechazado') throw Object.assign(new Error(v.motivo || 'El contenido no corresponde a un formato permitido.'), { final: true });
      if (v.estado !== 'listo') throw new Error('El archivo no quedó verificado. Reintenta.');
      x.estado = 'listo'; pintar();
    } catch (e) {
      x.estado = 'error'; x.reintentable = !e.final;
      x.error = esSinRed(e.message) ? 'Sin conexión: no se subió. Reintenta cuando vuelva la conexión.'
        : /pqrs-adjuntos|Function|función/i.test(e.message) ? 'No se pudo verificar el archivo (el servicio de verificación no respondió). Reintenta o quítalo.' : e.message;
      pintar();
    }
  };
  const agregar = (lista) => {
    for (const f of lista) {
      if (items.filter((x) => x.estado !== 'error').length >= LIMITES.por_mensaje) { aviso(`Máximo ${LIMITES.por_mensaje} archivos por mensaje.`, 'error'); break; }
      const rv = revisarArchivo(f);
      const x = { clave: nuevoId(), solicitud: nuevoId(), archivo: f, nombre: f.name, tamano: f.size, ext: rv.ext, estado: rv.ok ? 'preparando' : 'error', error: rv.ok ? null : rv.error,
        vista: rv.ok && IMAGENES.includes(rv.ext) ? URL.createObjectURL(f) : null };
      items.push(x);
      if (rv.ok) procesar(x);
    }
    pintar();
  };
  caja.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.elegir) { const inp = caja.querySelector(`[data-entrada="${b.dataset.elegir}"]`); inp.value = ''; inp.click(); }
    if (b.dataset.adjReintentar) { const x = items.find((y) => y.clave === b.dataset.adjReintentar); if (x) procesar(x); }
    if (b.dataset.adjQuitar) {
      const i = items.findIndex((y) => y.clave === b.dataset.adjQuitar);
      if (i < 0) return;
      const [x] = items.splice(i, 1);
      if (x.vista) URL.revokeObjectURL(x.vista);
      if (x.id) rpc('pqrs_adjunto_retirar', { p_id: x.id }).catch(() => {});
      pintar();
    }
  });
  caja.addEventListener('change', (e) => { if (e.target.dataset.entrada && e.target.files?.length) agregar([...e.target.files]); });
  pintar();
  return {
    listos: () => items.filter((x) => x.estado === 'listo').map((x) => ({ id: x.id, nombre: x.nombre, tamano: x.tamano, ext: x.ext })),
    ocupado: () => items.some((x) => ['preparando', 'subiendo', 'verificando'].includes(x.estado)),
    vaciar: () => { for (const x of items) if (x.vista) URL.revokeObjectURL(x.vista); items.length = 0; pintar(); },
  };
}

// Gestión del caso: lo mismo que antes del chat (no se quitó nada), en un panel aparte
function gestionHTML(d) {
  const yo = d.yo, personal = yo.personal, abierto = d.estado !== 'cerrada';
  return `
    <section class="pq-datos"><dl>
      <dt>Asunto</dt><dd>${esc(d.asunto)}</dd>
      <dt>Presentada</dt><dd>${esc(fechaHora(d.creado_en))}${personal || yo.solicitante ? ` · ${esc(d.solicitante.nombre)} (${esc(ROL[d.solicitante.rol] || d.solicitante.rol)})` : ''}</dd>
      ${d.estudiante ? `<dt>Estudiante</dt><dd>${esc(d.estudiante.nombre)}</dd>` : ''}
      ${d.cierre ? `<dt>Finalizada</dt><dd>${esc(fechaHora(d.cierre.en))} · ${esc(d.cierre.por || '')}<br>Conclusión: ${esc(d.cierre.motivo || '')}</dd>` : ''}
    </dl><p class="ayuda">${esc(AYUDA_ESTADO[d.estado] || '')}</p></section>
    ${d.sensible && personal ? `<div class="pq-reservado" data-resumen-salud><b>Resumen para coordinar (sin datos clínicos):</b> ${d.resumen_coordinacion ? `${esc(d.resumen_coordinacion)} <small class="ayuda">— ${esc(d.resumen_por || '')}, ${esc(fechaHora(d.resumen_en))}</small>` : 'Enfermería aún no lo ha escrito.'}
      ${yo.puede_resumen ? `<div class="pq-acciones"><button type="button" class="btn btn-chico" data-resumen>Escribir el resumen</button></div>` : ''}</div>` : ''}
    ${personal && abierto ? `<div class="pq-acciones">${d.sensible ? (yo.salud ? '<button type="button" class="btn btn-chico" data-salud="no">Quitar la marca de salud</button>' : '') : '<button type="button" class="btn btn-chico" data-salud="si">Marcar con información de salud</button>'}</div>` : ''}
    <h3>Áreas encargadas</h3>
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
    ${personal ? '<p class="ayuda">Un área que se agrega ve toda la conversación del caso (salvo lo de salud, que sigue reservado); un área retirada deja de verla.</p>' : ''}
    ${yo.admin && d.clasificacion && (d.clasificacion.razon || d.clasificacion.intencion?.length) ? `<details><summary>Cómo se clasificó</summary>
      <p class="ayuda">${d.clasificacion.razon ? esc(d.clasificacion.razon) + '<br>' : ''}${d.clasificacion.intencion?.length ? `Intención detectada: ${esc(lista(d.clasificacion.intencion))}. ` : ''}${d.clasificacion.descartes ? `${d.clasificacion.descartes} señal(es) descartadas por negación o elogio.` : ''}
      ${d.clasificacion.debiles?.length ? `<br>Señales débiles (no alcanzaron): ${esc(lista(d.clasificacion.debiles.map((k) => AREAS.find((a) => a.clave === k)?.nombre || (k === 'seccion' ? 'Sección' : k))))}.` : ''}</p></details>` : ''}
    ${personal && d.lecturas ? `<h3>Visto por</h3>${d.lecturas.length ? `<ul class="pq-crono">${d.lecturas.map((l) => `<li><b>${esc(l.nombre)}</b>${l.areas.length ? ` (${esc(lista(l.areas))})` : l.admin ? ' (Administración)' : ''}<small>Primera vez: ${esc(fechaHora(l.primera_en))}${l.ultima_en !== l.primera_en ? ` · última: ${esc(fechaHora(l.ultima_en))}` : ''}</small></li>`).join('')}</ul><p class="ayuda">Leer un caso no lo marca como respondido.</p>` : '<p class="ayuda">Nadie del personal lo ha abierto todavía.</p>'}` : ''}
    <h3>Cronología</h3>
    <ul class="pq-crono">${d.eventos.map((e) => `<li data-evento="${esc(e.tipo)}">${esc((TEXTO_EVENTO[e.tipo] || (() => e.tipo))(e, personal))}<small>${esc(fechaHora(e.creado_en))}${e.actor && e.tipo !== 'leida' && (personal || e.tipo === 'respuesta') ? ` · ${esc(e.actor)}` : ''}</small></li>`).join('')}</ul>
    ${yo.puede_cerrar || yo.puede_reabrir ? `<div class="pq-acciones">
      ${yo.puede_cerrar ? '<button type="button" class="btn btn-peligro" data-cerrar>Finalizar PQRS</button>' : ''}${yo.puede_reabrir ? '<button type="button" class="btn" data-reabrir>Reabrir el caso</button>' : ''}
    </div>` : ''}`;
}

// Acciones de la gestión (las mismas de antes; «Cerrar el caso» se llama ahora «Finalizar PQRS» y pide la conclusión)
async function accionGestion(b, d, recargar, conMotivo) {
  try {
    if (b.dataset.revision) { await rpc('pqrs_estado_area', { p_id: d.id, p_area: b.dataset.revision, p_accion: 'en_revision' }); aviso('Tu área quedó «En revisión»'); return recargar(); }
    if (b.dataset.atender) { await rpc('pqrs_estado_area', { p_id: d.id, p_area: b.dataset.atender, p_accion: 'atender_aporte' }); aviso('Información nueva atendida'); return recargar(); }
  } catch (err) { return aviso(err.message, 'error'); }
  if (b.dataset.retirar) {
    const a = d.areas.find((x) => x.id === b.dataset.retirar);
    return conMotivo(`Retirar ${a.nombre}`, `<p>${esc(a.nombre)} dejará de participar en este caso y ya no verá la conversación. Queda en el historial con tu nombre, la hora y el motivo, y se le avisa.</p>`,
      '¿Por qué no debe intervenir? (obligatorio)', (motivo) => rpc('pqrs_retirar', { p_id: d.id, p_area: a.id, p_motivo: motivo }), 'Área retirada');
  }
  if (b.hasAttribute('data-asignar')) {
    const cfg = await rpc('pqrs_config', { p_colegio: E.colegio.id }).catch((err) => { aviso(err.message, 'error'); return null; });
    if (!cfg) return;
    const libres = cfg.areas.filter((a) => !d.areas.some((x) => x.id === a.id && x.activa));
    return conMotivo('Agregar un área', `<label>Área<select name="area">${libres.map((a) => `<option value="${esc(a.id)}">${esc(a.nombre)}${a.responsables.length ? '' : ' (sin responsables)'}</option>`).join('')}</select></label>
      <p class="ayuda">El área nueva verá toda la conversación del caso (salvo lo de salud).</p>`,
      'Motivo (obligatorio)', (motivo, caja) => rpc('pqrs_asignar', { p_id: d.id, p_area: caja.querySelector('[name=area]').value, p_motivo: motivo }), 'Área asignada');
  }
  if (b.hasAttribute('data-confirmar')) return conMotivo('Confirmar clasificación', '<p>Quita la marca «Revisar clasificación». Las áreas siguen como están.</p>', 'Nota (opcional)',
    (nota) => rpc('pqrs_confirmar_clasificacion', { p_id: d.id, p_nota: nota || null }), 'Clasificación confirmada');
  if (b.hasAttribute('data-cerrar')) return conMotivo('Finalizar PQRS', (d.pendientes.length ? `<p class="pq-reservado">Aún falta responder: <b>${esc(lista(d.pendientes))}</b>. Finalizar no marca sus respuestas; queda como constancia.</p>` : '<p>Todas las áreas respondieron.</p>')
    + '<p class="ayuda">Al finalizar ya no se pueden enviar mensajes. La conversación y los adjuntos siguen disponibles para quienes participan.</p>',
    'Conclusión: solución y acuerdos (obligatoria)', (motivo) => rpc('pqrs_cerrar', { p_id: d.id, p_motivo: motivo }), 'PQRS finalizada');
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
    if (r) { aviso('Resumen guardado'); olvidarChat(d.id); recargar(); }
    return;
  }
  if (b.dataset.corregir) {
    const i = estadoDe(d.id).mensajes.get(b.dataset.corregir) || d.intervenciones.find((x) => x.id === b.dataset.corregir);
    const r = await ventana({ titulo: 'Corregir', html: `<p class="ayuda">La versión anterior queda guardada y se muestra que fue corregida.</p><label>Texto corregido<textarea name="texto" rows="5" maxlength="${MAX_TEXTO}">${esc(i.contenido)}</textarea></label><label>Motivo de la corrección (obligatorio)<input name="motivo" maxlength="300"></label>`,
      botones: [{ texto: 'Cancelar', valor: null }, { texto: 'Guardar corrección', antes: (caja) => rpc('pqrs_corregir', { p_intervencion: i.id, p_contenido: caja.querySelector('[name=texto]').value.trim(), p_motivo: caja.querySelector('[name=motivo]').value.trim() }) }] });
    if (r) { aviso('Corrección guardada'); olvidarChat(d.id); recargar(); }
  }
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
