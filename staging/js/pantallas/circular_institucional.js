// Circular institucional (formato del colegio en PDF): Administración y quien el administrador designe (Gerencia, directores
// de sección…; Fabio, 2-nov-2026), cada quien con SUS circulares y su propia firma encima del nombre en el PDF.
// Se escribe aquí, se guarda como borrador (tabla circular_borradores, con versión para no pisar el trabajo de otro)
// y se pide el PDF de REVISIÓN al servidor (Edge Function circular-documentos, acción "previsualizar"), con la misma
// estructura del memo del colegio (Fabio, 27-oct). El consecutivo lo asigna la base al guardar por PRIMERA vez (Fabio, 28-oct):
// se crea con crear_circular_borrador y una solicitud_id propia de este documento, así un doble clic, un reintento o
// recargar la página traen el mismo borrador y el mismo número. Después no cambia. No publica ni envía nada.
// Lo escrito también se guarda en el equipo mientras tanto (no se pierde por red o al salir).
import { E, perfiles, logoHTML } from '../estado.js';
import { esc, aviso, ventana, confirmar, leerForm, nombre, vacio, fechaHora } from '../ui.js';
import { cabecera } from './comun.js';
import { AREAS, CARGO_DE_AREA, CATEGORIAS, LIMITES, hoyBogota, fechaLarga, textoDestinatarios, saludoSugerido, textoPlano, contenidoHTML, leerEditor, datosParaServidor, numeracion } from '../circular_contenido.js';
import { perfilCircular, urlFirma } from '../firma_circular.js';

const VOLVER = '#/circulares-institucionales';
const SIN_NUMERO = 'Sin número definitivo'; // lo mismo que pone el servidor cuando no hay consecutivo
// Identificador de la creación de un documento (el mismo en cada reintento)
const nuevoId = () => crypto.randomUUID?.() || '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
// El consecutivo de un borrador guardado es el de la base (columna), no lo que diga el formulario
const deFila = (f) => normal({ ...f.datos, consecutivo: f.consecutivo ?? f.datos?.consecutivo });

// Copia en el equipo de lo que aún no se guarda en el servidor (una por borrador; "nueva" = el que aún no existe)
const clave = (id) => `complexstg_circular_${E.colegio.id}_${id}`;
const leerLocal = (id) => { try { return JSON.parse(localStorage.getItem(clave(id)) || 'null'); } catch { return null; } };
const guardarLocal = (id, v) => { try { localStorage.setItem(clave(id), JSON.stringify(v)); return true; } catch { return false; } };
const borrarLocal = (id) => { try { localStorage.removeItem(clave(id)); } catch {} };

const nuevaCircular = () => ({ fecha_emision: hoyBogota(), consecutivo: '', dependencia: 'Rectoría', destinatarios: [], destinatarios_otros: '', titulo: '', contenido: { version: 1, bloques: [] }, responsable: '', cargo: CARGO_DE_AREA['Rectoría'], firmar: false });
// Una nueva lleva los datos de quien la prepara: su área y cargo designados y, si ya cargó su firma, su nombre y su firma
const nuevaDeMi = (yo) => {
  const n = nuevaCircular();
  if (!yo.admin && yo.emisor) Object.assign(n, { dependencia: yo.emisor.area?.nombre || '', cargo: yo.emisor.cargo || '' });
  if (yo.firma && yo.nombre) Object.assign(n, { firmar: true, responsable: yo.nombre });
  return n;
};
// Siempre los mismos campos y en el mismo orden (así se comparan dos versiones con JSON)
const normal = (d = {}) => {
  const n = nuevaCircular();
  return {
    fecha_emision: /^\d{4}-\d{2}-\d{2}$/.test(d.fecha_emision || '') ? d.fecha_emision : n.fecha_emision,
    consecutivo: d.consecutivo || '',
    dependencia: d.dependencia ?? n.dependencia,
    destinatarios: Array.isArray(d.destinatarios) ? d.destinatarios.filter((x) => CATEGORIAS.includes(x)) : [],
    destinatarios_otros: d.destinatarios_otros || '',
    titulo: d.titulo || '',
    contenido: d.contenido?.bloques ? { version: 1, bloques: d.contenido.bloques } : n.contenido,
    responsable: d.responsable || '',
    cargo: d.cargo ?? n.cargo,
    firmar: d.firmar === true,
    plantilla_id: typeof d.plantilla_id === 'string' ? d.plantilla_id : '',
  };
};
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Formatos del PDF en el modo demo (no hay servidor ni plantillas del colegio): solo para la vista previa
const PLANTILLAS_DEMO = [
  { id: 'demo-carta', revision: 2, nombre: 'Carta (como la circular E2-006)', configuracion: { estructura: 'carta-institucional-v1', carta: { ciudad: 'Cota, Cundinamarca' }, firma: { negrita: true, incluir_institucion: true } } },
  { id: 'demo-memo', revision: 1, nombre: 'Memorando (cuadro Fecha · De · Para)', configuracion: { estructura: 'memorando-institucional-v4', firma: { despedida: 'Cordialmente,', incluir_institucion: true } } },
  { id: 'demo-gerencia', revision: 3, nombre: 'Memorando de Gerencia (como el V2-2025-2026-1)', configuracion: { estructura: 'memorando-gerencia-v1', firma: { despedida: 'Atentamente,', incluir_institucion: false } } },
];
// Cada área su formato (2-nov-2026): quien fue designado en un área ve SOLO los formatos de su área (el servidor también lo revisa)
const formatoPermitido = (yo, x) => !yo.formatos || yo.formatos.todos || (Array.isArray(yo.formatos.permitidas) ? yo.formatos.permitidas.includes(x.id) : !(yo.formatos.prohibidas || []).includes(x.id));
const referencia = (id) => (id ? id.slice(0, 8).toUpperCase() : 'se asigna al guardar');
const soloAdmin = (m, titulo) => { m.innerHTML = cabecera(titulo, { volver: '#/circulares' }) + vacio('Solo Administración o quien el administrador designe prepara las circulares institucionales.'); };

// ---------------------------------------------------------------- Lista de borradores
export async function lista(m) {
  const yo = await perfilCircular();
  if (!yo.puede_preparar) return soloAdmin(m, 'Circulares institucionales');
  const admin = yo.admin;
  const filas = await E.db.select('circular_borradores', { eq: { colegio_id: E.colegio.id }, order: 'actualizado_en desc' });
  await perfiles(filas.map((f) => f.actualizado_por || f.autor_id).filter(Boolean));
  const sinGuardar = leerLocal('nueva');
  const fila = (href, d, linea, marca = '') => `
    <a class="fila fila-boton" href="${href}">
      <span class="avatar">📄</span>
      <span class="crece"><b>${esc(d.titulo || '(sin asunto)')}</b>
        <small>${esc([d.consecutivo, d.dependencia, textoDestinatarios(d.destinatarios, d.destinatarios_otros)].filter(Boolean).join(' · ') || '—')}</small>
        <small>${linea}${marca}</small></span>
    </a>`;
  m.innerHTML = cabecera('Circulares institucionales', { volver: '#/circulares', acciones: '<a class="btn btn-primario" href="#/circular-institucional/nueva">＋ Nueva</a>' }) + `
    <div class="aviso-caja"><p><b>Formato institucional en PDF.</b> ${admin ? 'Aquí se preparan, se guardan y se revisan en PDF.' : 'Aquí preparas TUS circulares, las guardas y las revisas en PDF (Administración también las ve).'}</p>
      <p class="ayuda">Nada se publica ni se envía. Complex asigna el consecutivo al guardar cada circular por primera vez y no lo vuelve a cambiar.</p>
      ${yo.firma || yo.sin_firmas ? '' : '<p class="ayuda">Para que tu firma vaya encima de tu nombre en el PDF, cárgala en <a href="#/perfil">Mi cuenta y ajustes → Mi firma</a>.</p>'}</div>
    ${sinGuardar || filas.length ? `<div class="lista">
      ${sinGuardar ? fila('#/circular-institucional/nueva', normal({ ...sinGuardar.datos, consecutivo: '' }), 'Sin guardar · solo en este equipo · aún sin consecutivo') : ''}
      ${filas.map((f) => fila(`#/circular-institucional/${f.id}`, deFila(f),
        `${f.estado === 'emitida' ? '✅ Emitida' : f.estado === 'anulada' ? '⛔ Anulada' : 'Borrador'}${!f.consecutivo && (!f.estado || f.estado === 'borrador') ? ' · aún sin número' : ''} · guardado ${esc(fechaHora(f.actualizado_en))} por ${esc(nombre(E.perfiles.get(f.actualizado_por || f.autor_id)))}`,
        leerLocal(f.id) ? ' · <b>con cambios sin guardar en este equipo</b>' : '')).join('')}
    </div>` : vacio('Aún no hay circulares institucionales en borrador.')}
    ${admin ? `<details class="tarjeta" data-emisores><summary><b>Quién prepara circulares</b> · además de Administración (Gerencia, direcciones de sección…) y su firma</summary><div data-emisores-cuerpo><p class="ayuda">Cargando…</p></div></details>
    <details class="tarjeta" data-numeracion><summary><b>Numeración por área</b> · series de consecutivos (prefijo, número y sufijo)</summary><div data-numeracion-cuerpo><p class="ayuda">Cargando…</p></div></details>` : ''}`;
  if (!admin) return;
  // Los paneles siguen abiertos cuando la lista se vuelve a pintar (llegan datos nuevos tras guardar algo en ellos)
  const det = m.querySelector('[data-numeracion]');
  det.addEventListener('toggle', () => { numeracionAbierta = det.open; if (det.open) numeracion_(det.querySelector('[data-numeracion-cuerpo]')); });
  if (numeracionAbierta) det.open = true;
  const dEm = m.querySelector('[data-emisores]');
  dEm.addEventListener('toggle', () => { emisoresAbierto = dEm.open; if (dEm.open) emisores_(dEm.querySelector('[data-emisores-cuerpo]')); });
  if (emisoresAbierto) dEm.open = true;
}

// ---------------------------------------------------------------- Quién prepara circulares (2-nov-2026; migración 20261102140000)
// El administrador designa a otras personas del personal (Gerencia, directores de sección…), con el cargo con el que firman
// y el área en la que numeran (sin área: la serie del colegio). Cada una ve y edita solo SUS circulares y pone SU firma.
let emisoresAbierto = false;
const PERSONAL = ['admin', 'profesor', 'director_seccion', 'enfermeria'];
const CARGOS = ['Rector(a)', 'Gerente', 'Director(a) de Sección Infantil', 'Director(a) de Sección Prejuvenil', 'Director(a) de Sección Juvenil', 'Coordinador(a) académico(a)', 'Coordinador(a) de convivencia'];
async function emisores_(caja) {
  let lista, num;
  try { [lista, num] = await Promise.all([E.db.rpc('circular_emisores_ver', { p_colegio: E.colegio.id }), E.db.rpc('circular_numeracion', { p_colegio: E.colegio.id }).catch(() => null)]); }
  catch (e) { caja.innerHTML = `<p class="ayuda">${esc(/circular_emisores_ver|PGRST202|not find/i.test(e.message) ? 'Esta función llega con la próxima actualización de la base.' : e.message)}</p>`; return; }
  const areas = (num?.areas || []).filter((a) => a.activo);
  caja.innerHTML = `<p class="ayuda">Cada persona designada prepara y guarda <b>sus</b> circulares (no ve las de los demás; Administración ve todas) y, si carga su firma en «Mi cuenta y ajustes», el PDF que ella genera la lleva encima de su nombre. Nadie puede poner la firma de otra persona.</p>
    ${lista.length ? `<div class="lista">${lista.map((x) => `<div class="fila"><span class="avatar">${x.tiene_firma ? '✍️' : '👤'}</span><span class="crece"><b>${esc(x.nombre)}</b>
        <small>${esc(x.cargo)} · ${x.area ? 'numera en ' + esc(x.area.nombre) : 'serie del colegio'} · ${x.tiene_firma ? 'firma cargada' : 'aún sin firma'}${x.activo ? '' : ' · <b>retirado</b>'}</small></span>
        <button type="button" class="btn btn-chico" data-emisor="${esc(x.perfil_id)}">Cambiar</button></div>`).join('')}</div>` : '<p>Aún no hay nadie designado: solo Administración prepara circulares.</p>'}
    <button type="button" class="btn" data-emisor-nuevo>＋ Designar a alguien</button>
    <div data-formatos-area></div>`;
  formatosArea_(caja.querySelector('[data-formatos-area]'), areas);
  const abrir = (x) => designar(x, areas, lista).then((ok) => ok && emisores_(caja));
  caja.querySelector('[data-emisor-nuevo]').addEventListener('click', () => abrir(null));
  caja.querySelectorAll('[data-emisor]').forEach((b) => b.addEventListener('click', () => abrir(lista.find((x) => x.perfil_id === b.dataset.emisor))));
}
// Formato del PDF de cada área (2-nov-2026, Fabio: «en gerencia no debe pasar que pueda enviar el formato como de rectoría y
// viceversa»; «esta opción no debe ser elegible»): el administrador asigna UN formato a cada área; quien emite por esa área usa ese
async function formatosArea_(div, areas) {
  if (!areas.length) { div.innerHTML = '<p class="ayuda"><b>Formato del PDF de cada área:</b> primero crea las áreas (Rectoría, Gerencia…) en «Numeración por área».</p>'; return; }
  let [plantillas, asignados] = await Promise.all([
    E.db.modo === 'demo' ? PLANTILLAS_DEMO : E.db.select('circular_plantillas', { eq: { colegio_id: E.colegio.id, estado: 'aprobada' }, order: 'revision desc' }).catch(() => []),
    E.db.rpc('circular_formatos_por_area', { p_colegio: E.colegio.id }).catch(() => null),
  ]);
  if (!asignados) { div.innerHTML = ''; return; } // la base aún no tiene la migración 20261102150000
  const de = (a) => asignados.find((y) => y.area_id === a)?.plantilla_id || '';
  div.innerHTML = `<h3>Formato del PDF de cada área</h3><p class="ayuda">Cada área tiene <b>un</b> formato y quien emite por esa área no lo elige: Gerencia no envía el de Rectoría ni al revés (el servidor también lo revisa). El área sin formato usa el general (el que no es de ningún área).</p>
    ${areas.map((a) => `<fieldset class="circ-formatos"><legend>${esc(a.nombre)}</legend>${plantillas.length ? [{ id: '', nombre: 'Sin formato propio (usa el general)' }, ...plantillas].map((p) => `<label class="check"><input type="radio" name="formato-${esc(a.id)}" data-formato-area="${esc(a.id)}" value="${esc(p.id)}" ${de(a.id) === p.id ? 'checked' : ''}> ${esc(p.nombre || 'Plantilla rev. ' + p.revision)}</label>`).join('') : '<p class="ayuda">No hay plantillas aprobadas.</p>'}</fieldset>`).join('')}`;
  div.querySelectorAll('[data-formato-area]').forEach((r) => r.addEventListener('change', async () => {
    const area = r.dataset.formatoArea, antes = de(area);
    const grupo = div.querySelectorAll(`[data-formato-area="${area}"]`);
    grupo.forEach((x) => { x.disabled = true; });
    try {
      asignados = r.value ? await E.db.rpc('circular_area_formato_guardar', { p_colegio: E.colegio.id, p_area: area, p_plantilla: r.value, p_asignar: true })
        : await E.db.rpc('circular_area_formato_guardar', { p_colegio: E.colegio.id, p_area: area, p_plantilla: antes, p_asignar: false });
      aviso(r.value ? 'Formato asignado al área' : 'El área usa el formato general');
    } catch (e) { grupo.forEach((x) => { x.checked = x.value === antes; }); aviso(e.message, 'error'); }
    finally { grupo.forEach((x) => { x.disabled = false; }); }
  }));
}
async function designar(x, areas, lista) {
  const miembros = await E.db.select('miembros', { eq: { colegio_id: E.colegio.id } });
  const ids = [...new Set(miembros.filter((mm) => mm.activo !== false && PERSONAL.includes(mm.rol)).map((mm) => mm.perfil_id))];
  await perfiles(ids);
  const ya = new Set(lista.map((y) => y.perfil_id));
  const opciones = ids.filter((id) => (x ? id === x.perfil_id : !ya.has(id))).map((id) => ({ id, n: nombre(E.perfiles.get(id)) })).sort((a, b) => a.n.localeCompare(b.n, 'es'));
  if (!opciones.length) { aviso('Todo el personal ya está designado.'); return false; }
  const r = await ventana({
    titulo: x ? 'Cambiar a quien prepara circulares' : 'Designar a quien prepara circulares',
    html: `<div class="form" data-designar>
      <label>Persona<select name="perfil" ${x ? 'disabled' : ''}>${opciones.map((o) => `<option value="${esc(o.id)}">${esc(o.n)}</option>`).join('')}</select></label>
      <label>Cargo con el que firma<input name="cargo" maxlength="160" list="circ-cargos" value="${esc(x?.cargo || '')}" placeholder="Ej.: Gerente"><datalist id="circ-cargos">${CARGOS.map((t) => `<option value="${esc(t)}">`).join('')}</datalist></label>
      <label>Área en la que numera<select name="area"><option value="">Serie del colegio (sin área)</option>${areas.map((a) => `<option value="${esc(a.id)}" ${x?.area?.id === a.id ? 'selected' : ''}>${esc(a.nombre)}</option>`).join('')}</select></label>
      ${x ? `<label class="check"><input type="checkbox" name="activo" ${x.activo ? 'checked' : ''}> Puede preparar circulares</label>` : ''}
      <p class="ayuda">Prepara y ve solo sus circulares; su firma la carga ella misma en «Mi cuenta y ajustes». Cada cambio queda en el historial.</p></div>`,
    botones: [{ texto: 'Cancelar' }, { texto: x ? 'Guardar' : 'Designar', antes: async (v) => {
      const f = leerForm(v.querySelector('[data-designar]'));
      await E.db.rpc('circular_emisor_guardar', { p_colegio: E.colegio.id, p_perfil: x?.perfil_id || f.perfil, p_cargo: f.cargo, p_area: f.area || null, p_activo: x ? f.activo : true });
      return 'ok';
    } }],
  });
  if (r === 'ok') aviso(x ? 'Cambios guardados' : 'Designación guardada');
  return r === 'ok';
}

let numeracionAbierta = false;
// ---------------------------------------------------------------- Numeración por área (29-oct-2026; migración 20261029130000)
// Cada área tiene su serie y su contador. El campo pide el ÚLTIMO número oficialmente usado (el siguiente es +1).
// Una serie nueva queda PROVISIONAL: sirve para borradores, pero solo se emite cuando el administrador la valida con los
// registros del colegio. Nada de esto inventa los formatos oficiales: se configuran aquí cuando el colegio los confirme.
async function numeracion_(caja) {
  let n;
  try { n = await E.db.rpc('circular_numeracion', { p_colegio: E.colegio.id }); }
  catch (e) { caja.innerHTML = `<p class="ayuda">${/does not exist|no existe|function/i.test(e.message) ? 'La numeración por área aún no está instalada en la base de este colegio (migración pendiente).' : esc(e.message)}</p>`; return; }
  const otra = () => numeracion_(caja);
  const serieHTML = (s) => `<div class="fila" data-serie="${esc(s.id)}"><span class="crece">
      <b>${esc(s.area || 'Colegio (sin área)')}</b> ${s.vigente ? '' : '<small>(ya no vigente)</small>'}
      <small>Último usado: <b>${esc(s.area_id ? s.ultimo_texto_area || 'ninguno' : s.ultimo_texto || 'ninguno')}</b> · Siguiente: <b data-siguiente>${esc(s.siguiente || 'la serie se agotó: crea una nueva')}</b></small>
      <small>${s.provisional ? '⚠ Provisional: sirve para borradores; para emitir hay que validarla' : `✅ Validada por ${esc(s.validada_por_nombre || '—')} el ${esc(fechaHora(s.validada_en))}`}${s.vigente_desde || s.vigente_hasta ? ` · vigencia ${esc(s.vigente_desde || '…')} a ${esc(s.vigente_hasta || '…')}` : ''}${s.anulados ? ` · ${s.anulados} número(s) anulado(s)` : ''}</small>
      ${s.ultimo_documento ? `<small>Último documento: ${esc(s.ultimo_documento.consecutivo || '')} · «${esc(s.ultimo_documento.titulo || '(sin asunto)')}» · ${esc(s.ultimo_documento.estado)} · versión ${s.ultimo_documento.version}</small>` : ''}
      ${s.nota ? `<small>Nota: ${esc(s.nota)}</small>` : ''}</span>
    ${s.vigente ? `<span class="acciones-grupo"><button class="btn btn-chico" data-editar-serie="${esc(s.id)}">Editar</button>${s.provisional ? `<button class="btn btn-chico" data-validar="${esc(s.id)}">Validar</button>` : ''}</span>` : ''}</div>`;
  caja.innerHTML = `
    <p class="ayuda">Formato: <b>prefijo</b> + número con ceros (ancho) + <b>sufijo</b>. Ej.: «Memo E2-» + 008 + «-2026-2027». Solo sube el número; el prefijo y el sufijo no cambian dentro de la serie.
      No se reinicia sola al cambiar de año: abrir otra serie es una decisión explícita. <b>Los formatos oficiales de cada área están pendientes de confirmar con Gerencia.</b></p>
    <fieldset class="form" data-ajuste><legend><b>¿Cuándo queda definitivo el número?</b> (decisión pendiente)</legend>
      <label class="check"><input type="radio" name="asignar" value="guardar" ${n.asignar_numero === 'guardar' ? 'checked' : ''}> Al guardar el borrador por primera vez (como hoy)</label>
      <label class="check"><input type="radio" name="asignar" value="emitir" ${n.asignar_numero === 'emitir' ? 'checked' : ''}> Al emitir (el borrador muestra el número previsto, sin reservarlo)</label>
    </fieldset>
    <h3>Áreas</h3>
    <div class="acciones-grupo">${n.areas.map((a) => `<button class="btn btn-chico" data-area="${esc(a.id)}">${esc(a.nombre)}${a.activo ? '' : ' (inactiva)'}</button>`).join('') || '<span class="ayuda">Aún no hay áreas.</span>'}
      <button class="btn btn-chico" data-area-nueva>＋ Área</button></div>
    <h3>Series</h3>
    <div class="lista">${n.series.map(serieHTML).join('') || '<p class="ayuda">Aún no hay series.</p>'}</div>
    <div class="acciones"><button class="btn" data-serie-nueva>＋ Serie</button></div>
    ${n.historial.length ? `<details><summary>Historial de cambios (${n.historial.length})</summary><ul class="lista-simple">${n.historial.slice(0, 20).map((h) => `<li>${esc(fechaHora(h.creado_en))} · ${esc(h.actor || '—')} · ${esc(h.objeto)} ${esc(h.accion)}${h.despues?.prefijo ? ` · ${esc(h.despues.prefijo)}` : h.despues?.nombre ? ` · ${esc(h.despues.nombre)}` : h.despues?.asignar_numero ? ` · al ${esc(h.despues.asignar_numero)}` : ''}</li>`).join('')}</ul></details>` : ''}`;
  caja.querySelector('[data-ajuste]').addEventListener('change', async (e) => {
    try { await E.db.rpc('circular_ajustes_guardar', { p_colegio: E.colegio.id, p_asignar_numero: e.target.value }); aviso('Ajuste guardado'); otra(); }
    catch (err) { aviso(err.message, 'error'); otra(); }
  });
  const area = async (a) => {
    const r = await ventana({ titulo: a ? 'Área' : 'Nueva área', html: `<div class="form"><label>Nombre del área<input name="nombre" maxlength="80" value="${esc(a?.nombre || '')}" placeholder="Ej.: Rectoría"></label>
      ${a ? `<label class="check"><input type="checkbox" name="activo" ${a.activo ? 'checked' : ''}> Activa</label>` : ''}</div>`,
      botones: [{ texto: 'Cancelar' }, { texto: 'Guardar', antes: async (c) => { const d = leerForm(c); return E.db.rpc('circular_area_guardar', { p_colegio: E.colegio.id, p_id: a?.id || null, p_nombre: d.nombre, p_activo: a ? !!d.activo : true }); } }] });
    if (r) { aviso('Área guardada'); otra(); }
  };
  const serie = async (s) => {
    const vig = (areaId) => n.series.some((x) => x.vigente && (x.area_id || null) === (areaId || null) && x.id !== s?.id);
    const r = await ventana({ titulo: s ? 'Editar serie' : 'Nueva serie', html: `<div class="form">
      ${s ? `<p><b>${esc(s.area || 'Colegio (sin área)')}</b></p>` : `<label>Área<select name="area"><option value="">Colegio (sin área)</option>${n.areas.filter((a) => a.activo).map((a) => `<option value="${esc(a.id)}">${esc(a.nombre)}</option>`).join('')}</select></label>`}
      <label>Prefijo (constante)<input name="prefijo" maxlength="30" value="${esc(s?.prefijo || '')}" placeholder="Ej.: Memo E2-"></label>
      <label>Ancho del número (cifras con ceros)<input name="ancho" type="number" min="1" max="6" value="${esc(s?.ancho ?? 3)}"></label>
      <label>Sufijo (constante; vacío = «-» + período)<input name="sufijo" maxlength="40" value="${esc(s?.sufijo || '')}" placeholder="Ej.: -2026-2027"></label>
      <label>Período (año o año académico)<input name="periodo" maxlength="9" value="${esc(s?.periodo || '')}" placeholder="2026-2027"></label>
      <label><b>Último número OFICIALMENTE usado</b> (0 si empieza; el siguiente será +1)<input name="ultimo" type="number" min="0" value="${esc(s?.ultimo ?? 0)}"></label>
      <p class="ayuda" data-ejemplo></p>
      <label>Vigente desde (opcional)<input name="desde" type="date" value="${esc(s?.vigente_desde || '')}"></label>
      <label>Vigente hasta (opcional)<input name="hasta" type="date" value="${esc(s?.vigente_hasta || '')}"></label>
      <label>Nota (opcional)<input name="nota" maxlength="500" value="${esc(s?.nota || '')}"></label>
      <label class="check" data-reemplazar hidden><input type="checkbox" name="reemplazar"> Esta área ya tiene una serie vigente: abrir esta la reemplaza (la anterior conserva sus números)</label>
      <p class="ayuda">Al cambiar el formato o el último número, la serie queda provisional y hay que volver a validarla.</p></div>`,
      alAbrir: (c) => {
        const ver = () => {
          const d = leerForm(c), anc = Number(d.ancho) || 3, sig = String((Number(d.ultimo) || 0) + 1);
          c.querySelector('[data-ejemplo]').textContent = sig.length > anc ? `El siguiente número (${sig}) no cabe en ${anc} cifras.` : `Último: ${Number(d.ultimo) ? d.prefijo + String(Number(d.ultimo)).padStart(anc, '0') + (d.sufijo || '-' + d.periodo) : '(ninguno)'} → siguiente: ${d.prefijo}${sig.padStart(anc, '0')}${d.sufijo || '-' + d.periodo}`;
          const rem = c.querySelector('[data-reemplazar]'); if (rem) rem.hidden = s ? true : !vig(d.area);
        };
        c.addEventListener('input', ver); c.addEventListener('change', ver); ver();
      },
      botones: [{ texto: 'Cancelar' }, { texto: 'Guardar', antes: async (c) => { const d = leerForm(c);
        return E.db.rpc('circular_serie_guardar', { p_colegio: E.colegio.id, p_id: s?.id || null, p_area: s ? s.area_id : d.area || null, p_prefijo: d.prefijo, p_periodo: d.periodo, p_ancho: Number(d.ancho),
          p_sufijo: d.sufijo || null, p_ultimo_usado: Number(d.ultimo), p_vigente_desde: d.desde || null, p_vigente_hasta: d.hasta || null, p_nota: d.nota || null, p_reemplazar: !!d.reemplazar }); } }] });
    if (r) { aviso(`Serie guardada · siguiente: ${r.siguiente}`); otra(); }
  };
  // onclick (no addEventListener): el panel se vuelve a pintar en la misma caja y debe quedar UN solo manejador, con los datos nuevos
  caja.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-area-nueva')) return area(null);
    if (b.dataset.area) return area(n.areas.find((a) => a.id === b.dataset.area));
    if (b.hasAttribute('data-serie-nueva')) return serie(null);
    if (b.dataset.editarSerie) return serie(n.series.find((x) => x.id === b.dataset.editarSerie));
    if (b.dataset.validar) {
      const s = n.series.find((x) => x.id === b.dataset.validar);
      const r = await ventana({ titulo: 'Validar serie', html: `<p>Confirma que <b>${esc(s.area || 'el colegio')}</b> usa el formato <b>${esc(s.siguiente || '')}</b> y que el último número oficialmente usado es el correcto, comparándolo con los registros del colegio.</p>
        <div class="form"><label>¿Con qué registro lo comprobaste? (obligatorio)<textarea name="constancia" rows="3" maxlength="500" placeholder="Ej.: libro de memos de Rectoría, último memo E2-007-2026-2027"></textarea></label></div>`,
        botones: [{ texto: 'Cancelar' }, { texto: 'Validar', antes: (c) => E.db.rpc('circular_serie_validar', { p_colegio: E.colegio.id, p_id: s.id, p_constancia: leerForm(c).constancia }) }] });
      if (r) { aviso('Serie validada'); otra(); }
    }
  };
}

// ---------------------------------------------------------------- Editor
export async function editor(m, p) {
  const yo = await perfilCircular();
  if (!yo.puede_preparar) return soloAdmin(m, 'Circular institucional');
  // La app vuelve a pintar la pantalla cuando llegan datos nuevos del servidor; el editor ya abierto de este mismo
  // borrador se deja quieto (si no, se perdería el cursor de quien está escribiendo).
  if (m.querySelector(`[data-circ][data-id="${CSS.escape(p.id)}"]`)) return;
  const nueva = p.id === 'nueva';
  let fila = null;
  if (!nueva) {
    E.db.refrescar('circular_borradores'); // el borrador siempre del servidor, no de la memoria del equipo
    [fila] = await E.db.select('circular_borradores', { eq: { id: p.id } });
    if (!fila) {
      const local = leerLocal(p.id);
      m.innerHTML = cabecera('Circular institucional', { volver: VOLVER }) + vacio('Ese borrador no existe o lo eliminaron.', local ? '<button class="btn" data-rescatar>Rescatar lo escrito en este equipo como borrador nuevo</button>' : '');
      m.querySelector('[data-rescatar]')?.addEventListener('click', () => {
        guardarLocal('nueva', { datos: local.datos, version: 0, en: Date.now() }); borrarLocal(p.id);
        location.hash = '#/circular-institucional/nueva';
      });
      return;
    }
  }
  // La serie de consecutivos vigente (para decir si es provisional) y la plantilla vigente (firma y revisión)
  const [series, plantillasTodas] = await Promise.all([
    E.db.select('circular_series', { eq: { colegio_id: E.colegio.id, vigente: true } }).catch(() => []),
    E.db.modo === 'demo' ? PLANTILLAS_DEMO : E.db.select('circular_plantillas', { eq: { colegio_id: E.colegio.id, estado: 'aprobada' }, order: 'revision desc' }).catch(() => []),
  ]);
  const plantillas = plantillasTodas.filter((x) => formatoPermitido(yo, x));
  let plantilla = null; // el formato del área que emite (ponerFormato)
  // Numeración por área (si la migración 20261029130000 está en la base): áreas configuradas y número PREVISTO (no reservado)
  const num = await E.db.rpc('circular_numeracion', { p_colegio: E.colegio.id }).catch(() => null);
  const areasCfg = (num?.areas || []).filter((a) => a.activo);
  const areaDe = (txt) => areasCfg.find((a) => a.nombre.trim().toLowerCase() === String(txt || '').trim().toLowerCase()) || null;
  // Formato del PDF (2-nov-2026, Fabio: «esta opción no debe ser elegible»): no se elige, es el del área que emite (uno por área,
  // lo asigna el administrador). El área sin formato propio usa el formato general (el que no es de ningún área)
  const asignados = yo.admin ? await E.db.rpc('circular_formatos_por_area', { p_colegio: E.colegio.id }).catch(() => null) : null;
  const generales = plantillas.filter((x) => !(asignados || []).some((y) => y.plantilla_id === x.id));
  const formatoDe = (dep) => {
    const a = asignados && areaDe(dep), y = a && asignados.find((z) => z.area_id === a.id);
    return (y && plantillas.find((x) => x.id === y.plantilla_id)) || generales[0] || null; // nunca el de otra área
  };
  let prevista = null;
  const provisional = series[0]?.provisional !== false;
  // Estado del borrador en el servidor: id, versión con la que se abrió, lo último guardado y su consecutivo (fijo).
  // Uno nuevo lleva su identificador de creación, guardado con la copia del equipo: el reintento tras recargar es el mismo.
  const srv = { id: fila?.id || null, version: fila?.version || 0, datos: fila ? deFila(fila) : null, en: fila?.actualizado_en || null, consecutivo: fila?.consecutivo || fila?.datos?.consecutivo || '' };
  let llave = srv.id || 'nueva';
  let d = srv.datos || nuevaDeMi(yo);
  const local = leerLocal(llave);
  srv.solicitud = srv.id ? null : local?.solicitud || nuevoId();
  const recuperado = !!local && !igual(normal({ ...local.datos, consecutivo: srv.consecutivo }), d);
  if (recuperado) { d = normal({ ...local.datos, consecutivo: srv.consecutivo }); srv.version = local.version ?? srv.version; } // se guarda sobre la versión que tenía este equipo
  else if (local && srv.id) borrarLocal(llave);

  m.innerHTML = cabecera(nueva ? 'Nueva circular institucional' : 'Circular institucional', { volver: VOLVER }) + `
    <div data-circ data-id="${esc(p.id)}">
    ${recuperado ? `<div class="aviso-caja" data-recuperado><p><b>Se recuperó lo que escribiste en este equipo</b> y no alcanzaste a guardar.</p>
      <button class="btn btn-chico" data-descartar>${srv.datos ? 'Descartar y ver lo guardado' : 'Empezar en blanco'}</button></div>` : ''}
    <form class="form circ-form" data-form autocomplete="off" novalidate>
      <section class="tarjeta">
        <h2>Encabezado</h2>
        <div class="circ-datos">
          <div><span>Fecha</span><b data-fecha-txt></b><small class="ayuda">Hora de Colombia. Queda fija en el borrador. <button type="button" class="btn-link" data-hoy hidden>Usar la de hoy</button></small></div>
        </div>
        <label>Consecutivo<input data-consec readonly aria-readonly="true" placeholder="Se asigna al guardar"></label>
        <div class="circ-consec"><small class="ayuda" data-consec-ayuda></small></div>
        <small class="ayuda">Referencia interna del borrador: <span data-ref>${esc(referencia(srv.id))}</span></small>
        <label>Área que emite<input name="dependencia" list="circ-areas" maxlength="${LIMITES.dependencia}" placeholder="Ej.: Rectoría"><datalist id="circ-areas">${[...new Set([...areasCfg.map((a) => a.nombre), ...AREAS])].map((a) => `<option value="${esc(a)}">`).join('')}</datalist></label>
        <div class="circ-datos" data-formato-fila><div><span>Formato del PDF</span><b data-formato-txt></b><small class="ayuda">${yo.emisor?.area ? 'Es el formato de tu área: lo asigna el administrador.' : 'Lo define el área que emite (el administrador asigna el formato de cada área).'}</small></div></div>
      </section>
      <section class="tarjeta">
        <h2>Para</h2>
        <fieldset class="circ-para"><legend>Marca uno o varios</legend>
          ${CATEGORIAS.map((c) => `<label class="check"><input type="checkbox" name="destinatarios" data-multi="1" value="${esc(c)}"> ${esc(c)}</label>`).join('')}
          <label>Otros (opcional)<input name="destinatarios_otros" maxlength="300" placeholder="Ej.: Familias de transición"></label>
        </fieldset>
        <p class="ayuda">En la circular dirá: <b data-para-txt>—</b>. No se envía a nadie.</p>
      </section>
      <section class="tarjeta">
        <h2>Asunto y contenido</h2>
        <label>Asunto<input name="titulo" maxlength="${LIMITES.titulo}" placeholder="Ej.: Protocolo de salidas pedagógicas"></label>
        <div class="circ-herr" role="toolbar" aria-label="Formato del contenido">
          <button type="button" class="btn btn-chico" data-cmd="bold" aria-label="Negrita" title="Negrita"><b>N</b></button>
          <button type="button" class="btn btn-chico" data-cmd="insertOrderedList">1. Lista</button>
          <button type="button" class="btn btn-chico" data-cmd="insertUnorderedList">• Viñetas</button>
          <button type="button" class="btn btn-chico" data-cmd="indent" title="Tab: en un punto crea sub-puntos a., b., c.; en un párrafo le pone sangría">→ Sangría</button>
          <button type="button" class="btn btn-chico" data-cmd="outdent" title="Mayús + Tab">← Sangría</button>
          <button type="button" class="btn btn-chico" data-saludo hidden>Empezar con el saludo</button>
        </div>
        <div class="circ-editor" data-editor contenteditable="true" role="textbox" aria-multiline="true" aria-label="Contenido de la circular" spellcheck="true" data-ph="Escribe aquí el contenido de la circular…"></div>
        <small class="ayuda" data-cuenta></small>
      </section>
      <section class="tarjeta">
        <h2>Firma</h2>
        <label class="check" data-firmar-fila hidden><input type="checkbox" name="firmar"> <span><b>Firmar con mi firma</b> (va encima de mi nombre en el PDF)</span></label>
        <p class="ayuda" data-firmar-ayuda hidden></p>
        <label>Nombre de quien firma<input name="responsable" maxlength="${LIMITES.responsable}" placeholder="Nombre y apellidos"></label>
        <label>Cargo<input name="cargo" maxlength="${LIMITES.cargo}" placeholder="Ej.: Rector(a)"></label>
        <p class="ayuda">Como en el memo del colegio: «Cordialmente,», la firma (si la marcas), el nombre en mayúsculas, el cargo y el nombre del colegio.</p>
      </section>
    </form>
    <section class="tarjeta">
      <h2>Emitir</h2>
      <button class="btn" disabled>Emitir con número oficial</button>
      <p class="ayuda">El consecutivo ya queda reservado al guardar el borrador. Emitir (dejarla oficial y definitiva) se habilita cuando se confirme la convención de numeración. Mientras tanto nada se publica ni se envía.</p>
      <button class="btn btn-peligro btn-chico" data-eliminar ${srv.id ? '' : 'hidden'}>Eliminar borrador</button>
    </section>
    <div class="pie-fijo circ-pie">
      <p class="circ-estado" data-estado role="status" aria-live="polite"></p>
      <div class="circ-acciones">
        <button type="button" class="btn" data-vista>Vista previa</button>
        <button type="button" class="btn" data-pdf>PDF de revisión</button>
        <button type="button" class="btn btn-primario" data-guardar>Guardar</button>
      </div>
    </div>
    </div>`;

  const caja = m.querySelector('[data-circ]');
  const form = caja.querySelector('[data-form]');
  const ed = caja.querySelector('[data-editor]');
  const $c = (sel) => caja.querySelector(sel);
  form.addEventListener('submit', (e) => e.preventDefault());

  // ----- Firma: SIEMPRE la de quien genera el PDF (el servidor no pone la de otro). Si este borrador lo firma otra persona,
  // aquí no se marca y el PDF que se genere aquí sale sin firma (la marca de esa persona queda como estaba).
  const ajeno = (x) => x.firmar && !!x.responsable && x.responsable !== yo.nombre;
  const firmaAjena = ajeno(d);
  const pintarFirmar = () => {
    const cb = form.elements.firmar, fila = $c('[data-firmar-fila]'), ayuda = $c('[data-firmar-ayuda]'), r = form.elements.responsable;
    fila.hidden = firmaAjena || !yo.firma;
    ayuda.innerHTML = firmaAjena ? `La firma <b>${esc(d.responsable)}</b> con su firma: solo esa persona genera el PDF firmado. Si generas el PDF aquí, sale sin firma.`
      : !yo.firma && !yo.sin_firmas ? 'Para firmar con tu firma, cárgala en <a href="#/perfil">Mi cuenta y ajustes → Mi firma</a>.' : '';
    ayuda.hidden = !ayuda.innerHTML;
    r.readOnly = !fila.hidden && cb.checked;
    if (r.readOnly && r.value !== yo.nombre) r.value = yo.nombre;
  };
  // ----- Pintar los datos en el formulario
  const ponerFormato = () => {
    plantilla = formatoDe(form.elements.dependencia.value);
    $c('[data-formato-txt]').textContent = plantilla ? plantilla.nombre || 'Plantilla rev. ' + plantilla.revision : (yo.emisor?.area ? 'Tu área todavía no tiene formato: pídeselo al administrador.' : 'Esa área no tiene formato: asígnalo en «Formato del PDF de cada área».');
  };
  const poner = (x) => {
    for (const k of ['dependencia', 'destinatarios_otros', 'titulo', 'responsable', 'cargo']) form.elements[k].value = x[k];
    // Quien fue designado en un área emite como esa área: el «De:» no se cambia (el servidor también lo fija)
    if (yo.emisor?.area?.nombre) form.elements.dependencia.value = yo.emisor.area.nombre;
    for (const cb of form.querySelectorAll('[name=destinatarios]')) cb.checked = x.destinatarios.includes(cb.value);
    form.elements.firmar.checked = x.firmar && !ajeno(x);
    ed.innerHTML = contenidoHTML(x.contenido);
    ponerFormato();
  };
  poner(d);
  pintarFirmar();
  if (yo.emisor?.area?.nombre) { form.elements.dependencia.readOnly = true; form.elements.dependencia.removeAttribute('list'); form.elements.dependencia.title = 'Es tu área: la asignó el administrador'; }
  form.elements.firmar.addEventListener('change', pintarFirmar);

  // ----- Leer el formulario
  const actual = () => {
    const f = leerForm(form);
    // el formato ya no se elige (es el del área): lo guardado en el borrador no cambia y no cuenta como cambio
    return normal({ ...f, plantilla_id: d.plantilla_id, firmar: firmaAjena ? d.firmar : f.firmar === true && !!yo.firma, consecutivo: srv.consecutivo, fecha_emision: d.fecha_emision, contenido: leerEditor(ed) });
  };

  let guardando = false, localT = null;
  // Vista previa del número (solo lectura): se pide al abrir y al cambiar el área
  const previsualizar = async () => {
    if ((!num && !yo.emisor) || srv.consecutivo) { prevista = null; return; }
    const a = yo.admin ? areaDe(form.elements.dependencia.value) : yo.emisor?.area || null; // quien no es administrador numera en su área designada
    try { prevista = { area: a, ...(await E.db.rpc('circular_previsualizar_numero', { p_colegio: E.colegio.id, p_area: a?.id || null })) }; } catch { prevista = null; }
    pintar();
  };
  const conArea = (x) => { if (!yo.admin) return x; const a = areaDe(x.dependencia); return a && !srv.consecutivo ? { ...x, area_id: a.id } : x; }; // el área solo cuenta mientras no tenga número
  const pintar = () => {
    const x = actual();
    $c('[data-fecha-txt]').textContent = fechaLarga(x.fecha_emision);
    $c('[data-hoy]').hidden = x.fecha_emision === hoyBogota();
    $c('[data-para-txt]').textContent = textoDestinatarios(x.destinatarios, x.destinatarios_otros) || '—';
    // Consecutivo: solo lectura; lo pone la base al guardar por primera vez
    $c('[data-consec]').value = srv.consecutivo;
    $c('[data-consec]').placeholder = !srv.consecutivo && prevista?.siguiente ? 'Previsto: ' + prevista.siguiente : 'Se asigna al guardar';
    if (!srv.consecutivo && prevista && (prevista.hay_serie || prevista.area)) {
      $c('[data-consec-ayuda]').textContent = prevista.hay_serie
        ? `Próximo previsto: ${prevista.siguiente || '(la serie se agotó: crea una nueva)'}. Es una vista previa, NO queda reservado: ${prevista.asignar_numero === 'emitir' ? 'el número definitivo se asigna al emitir' : 'se asigna al guardar por primera vez'}; si otra persona guarda antes, toma el siguiente.${prevista.provisional ? ' Serie provisional: para emitir hay que validarla.' : ''}`
        : `«${prevista.area.nombre}» no tiene serie de consecutivos: el borrador se guarda sin número y no se podrá emitir hasta configurarla y validarla (Numeración por área).`;
    } else $c('[data-consec-ayuda]').textContent = (srv.consecutivo
      ? 'Lo asignó Complex al guardar por primera vez. No cambia al editar, previsualizar ni descargar.'
      : 'Complex lo asigna al guardar por primera vez. Abrir el formulario o previsualizar no gasta números.')
      + (provisional ? ' Numeración provisional: la convención oficial está pendiente.' : '');
    // La lista numerada que sigue a un párrafo con sangría continúa la cuenta (1, 2, 3, párrafo, 4), como en el PDF
    const ini = numeracion(x.contenido.bloques);
    x.contenido.bloques.forEach((b, i) => { if (b.nodo && b.ordenada) { if (ini[i] > 1) b.nodo.start = ini[i]; else b.nodo.removeAttribute('start'); } });
    const plano = textoPlano(x.contenido);
    ed.classList.toggle('vacio', !plano.trim());
    $c('[data-cuenta]').textContent = `${plano.length.toLocaleString('es-CO')} de ${LIMITES.cuerpo.toLocaleString('es-CO')} caracteres`;
    // Saludo según las casillas: se ofrece al empezar, y si el primer párrafo es un saludo sugerido que ya no
    // coincide con las casillas marcadas ("Estimados profesores:" → "Estimados profesores y monitoras:"), se ofrece cambiarlo
    const saludo = saludoSugerido(x.destinatarios, x.destinatarios_otros);
    const b0 = x.contenido.bloques[0];
    const primero = b0?.tipo === 'parrafo' ? b0.segmentos.map((s) => s.texto).join('') : '';
    const cambiar = !!saludo && /^Estimados [^\n]*:$/.test(primero) && primero !== saludo && ed.firstElementChild?.tagName === 'P';
    const btnS = $c('[data-saludo]');
    btnS.dataset.modo = cambiar ? 'cambiar' : 'insertar';
    btnS.hidden = !saludo || (!cambiar && /^\s*(estimad|apreciad|querid|señor|respetad)/i.test(plano));
    btnS.textContent = !saludo ? '' : cambiar ? `Cambiar el saludo a «${saludo}»` : `Empezar con «${saludo}»`;
    const cambios = !srv.datos || !igual(x, srv.datos);
    $c('[data-estado]').textContent = guardando ? 'Guardando…'
      : !srv.id ? (textoPlano(x.contenido).trim() || x.titulo ? 'Aún no se guarda en el servidor (lo escrito queda en este equipo).' : 'Nueva circular: aún sin guardar.')
      : cambios ? 'Cambios sin guardar (a salvo en este equipo).'
      : `Guardado ${fechaHora(srv.en)} · versión ${srv.version}.`;
    return x;
  };
  const cambio = () => {
    const x = pintar();
    clearTimeout(localT);
    localT = setTimeout(() => {
      if (srv.datos && igual(x, srv.datos)) borrarLocal(llave);
      else if (!guardarLocal(llave, { datos: x, version: srv.version, en: Date.now(), ...(srv.id ? {} : { solicitud: srv.solicitud }) })) $c('[data-estado]').textContent = 'Este equipo no tiene espacio para la copia de seguridad: guarda en el servidor.';
    }, 300);
  };
  pintar();
  previsualizar();
  form.addEventListener('input', cambio);
  form.addEventListener('change', cambio);

  // El área sugiere el cargo (si el cargo está vacío o era la sugerencia del área anterior)
  let areaAntes = d.dependencia;
  form.elements.dependencia.addEventListener('change', () => {
    const area = form.elements.dependencia.value.trim();
    const cargo = form.elements.cargo;
    if (CARGO_DE_AREA[area] && (!cargo.value.trim() || cargo.value === CARGO_DE_AREA[areaAntes])) { cargo.value = CARGO_DE_AREA[area]; cambio(); }
    areaAntes = area;
    ponerFormato();
    cambio();
    previsualizar();
  });
  $c('[data-hoy]').addEventListener('click', () => { d = { ...d, fecha_emision: hoyBogota() }; cambio(); });

  // ----- Editor de contenido: párrafos, negrita y listas (lo que acepta el formato del servidor)
  ed.addEventListener('focus', () => { try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch {} });
  ed.addEventListener('paste', (e) => { // se pega como texto simple: sin colores, tablas ni imágenes de otra página
    e.preventDefault();
    const t = (e.clipboardData || window.clipboardData)?.getData('text/plain') || '';
    document.execCommand('insertText', false, t.replace(/\r\n?/g, '\n'));
  });
  ed.addEventListener('drop', (e) => e.preventDefault());
  // Tab / Mayús+Tab: sangría (en un punto: sub-puntos a., b., c.; en un párrafo: párrafo con sangría)
  ed.addEventListener('keydown', (e) => { if (e.key === 'Tab') { e.preventDefault(); document.execCommand(e.shiftKey ? 'outdent' : 'indent'); cambio(); } });
  const herr = $c('.circ-herr');
  // pointerdown sin efecto: el botón no le quita el foco (ni el teclado del celular) al editor
  herr.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
  herr.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
  herr.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.saludo !== undefined) {
      const x = actual();
      const saludo = saludoSugerido(x.destinatarios, x.destinatarios_otros);
      if (b.dataset.modo === 'cambiar') ed.firstElementChild.textContent = saludo;
      else ed.insertAdjacentHTML('afterbegin', `<p>${esc(saludo)}</p>`);
      cambio();
      return;
    }
    if (!ed.contains(document.getSelection()?.anchorNode)) { // el cursor no estaba en el editor: al final
      ed.focus();
      const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false);
      const s = document.getSelection(); s.removeAllRanges(); s.addRange(r);
    }
    document.execCommand(b.dataset.cmd);
    cambio();
  });

  // ----- Descartar lo recuperado
  $c('[data-descartar]')?.addEventListener('click', () => {
    borrarLocal(llave);
    d = srv.datos || nuevaDeMi(yo);
    if (fila) srv.version = fila.version;
    poner(d); pintar();
    $c('[data-recuperado]').remove();
  });

  // ----- Guardar en el servidor (con la versión que se abrió: si otra persona guardó antes, no se pisa)
  const btnGuardar = $c('[data-guardar]');
  const guardar = async () => {
    if (guardando) return false;
    const x = actual();
    guardando = true; btnGuardar.disabled = true; pintar();
    try {
      let r;
      const primera = !srv.id;
      if (primera) {
        // La copia del equipo lleva el identificador de esta creación: si la red falla y se recarga, el reintento es el mismo
        guardarLocal('nueva', { datos: x, version: 0, en: Date.now(), solicitud: srv.solicitud });
        r = await E.db.rpc('crear_circular_borrador', { p_colegio: E.colegio.id, p_solicitud: srv.solicitud, p_datos: conArea(x) });
        E.db.refrescar('circular_borradores');
        borrarLocal('nueva');
        llave = r.id;
        caja.dataset.id = r.id;
        $c('[data-ref]').textContent = referencia(r.id);
        history.replaceState(null, '', '#/circular-institucional/' + r.id);
      } else {
        [r] = await E.db.update('circular_borradores', { datos: conArea(x) }, { id: srv.id, version: srv.version });
        if (!r) { guardando = false; btnGuardar.disabled = false; pintar(); await conflicto(x); return false; }
      }
      Object.assign(srv, { id: r.id, version: r.version, datos: deFila(r), en: r.actualizado_en, consecutivo: r.consecutivo || r.datos?.consecutivo || '' });
      // si siguió escribiendo mientras se guardaba (o era un reintento de algo ya creado), lo nuevo se queda en el equipo
      if (igual(actual(), srv.datos)) borrarLocal(llave);
      else guardarLocal(llave, { datos: actual(), version: srv.version, en: Date.now() });
      $c('[data-eliminar]').hidden = false;
      $c('[data-recuperado]')?.remove();
      aviso(primera ? `Borrador guardado con el consecutivo ${srv.consecutivo}` : 'Borrador guardado');
      return true;
    } catch (e) {
      aviso(e.message, 'error');
      return false;
    } finally {
      guardando = false; btnGuardar.disabled = false; pintar();
    }
  };
  btnGuardar.addEventListener('click', guardar);

  const conflicto = async (mios) => {
    E.db.refrescar('circular_borradores');
    const [otro] = await E.db.select('circular_borradores', { eq: { id: srv.id } });
    if (otro) await perfiles([otro.actualizado_por].filter(Boolean));
    const r = await ventana({
      titulo: otro ? 'Otra persona guardó este borrador' : 'Este borrador ya no existe',
      html: `<p>${otro ? `Se guardó ${esc(fechaHora(otro.actualizado_en))} por ${esc(nombre(E.perfiles.get(otro.actualizado_por)))}, después de que lo abriste aquí. Para no borrar su trabajo, tus cambios <b>no</b> se guardaron encima.` : 'Lo eliminaron desde otro equipo.'}</p>
        <p>Tus cambios siguen en este equipo. Puedes <b>guardarlos aparte</b> como otro borrador (con su propio consecutivo)${otro ? ' o <b>ver la guardada</b> (se descartan los cambios de este equipo)' : ''}.</p>`,
      botones: [...(otro ? [{ texto: 'Ver la guardada', valor: 'recargar' }] : []), { texto: 'Guardar aparte', valor: 'nuevo' }],
    });
    if (r === 'nuevo') {
      try {
        const n = await E.db.rpc('crear_circular_borrador', { p_colegio: E.colegio.id, p_solicitud: nuevoId(), p_datos: { ...mios, consecutivo: '' } });
        E.db.refrescar('circular_borradores');
        borrarLocal(llave);
        aviso(`Guardado como borrador nuevo con el consecutivo ${n.consecutivo || ''}`);
        location.hash = '#/circular-institucional/' + n.id;
      } catch (e) { aviso(e.message, 'error'); }
    } else if (r === 'recargar') {
      borrarLocal(llave);
      caja.remove();
      editor(m, { id: srv.id });
    }
  };

  // ----- Vista previa rápida (en pantalla) y PDF de revisión (servidor, formato oficial)
  $c('[data-vista]').addEventListener('click', async () => {
    const x = actual();
    const falta = datosParaServidor(x).error;
    const r = await ventana({
      titulo: 'Vista previa',
      html: `${falta ? `<div class="aviso-caja"><p>${esc(falta)}</p></div>` : ''}${vistaHTML(x, plantilla, x.firmar && !firmaAjena && yo.firma ? await urlFirma(yo.firma).catch(() => null) : null)}
        <p class="ayuda">Vista rápida para revisar el texto. El PDF de revisión usa el formato oficial del colegio (membrete, marca de agua y pie).</p>`,
      botones: [{ texto: 'Cerrar' }, { texto: 'PDF de revisión', valor: 'pdf' }],
    });
    if (r === 'pdf') pdfRevision();
  });
  const btnPdf = $c('[data-pdf]');
  const pdfRevision = async () => {
    const x = actual();
    const v = datosParaServidor({ ...x, firmar: x.firmar && !firmaAjena && !!yo.firma }); // la firma, solo la propia
    if (v.error) { aviso(v.error, 'error'); enfocar(v.campo); return; }
    if (E.db.modo === 'demo') {
      await ventana({ titulo: 'PDF de revisión', html: '<p>En el modo de prueba no hay servidor: el PDF de revisión se genera con la plantilla oficial del colegio cuando se usa la app con la cuenta del colegio.</p><p class="ayuda">Usa «Vista previa» para revisar el texto.</p>', botones: [{ texto: 'Entendido' }] });
      return;
    }
    btnPdf.disabled = true;
    const antes = btnPdf.textContent;
    btnPdf.textContent = 'Generando…';
    try {
      if (!plantilla) throw new Error(plantillasTodas.length ? 'Tu área todavía no tiene un formato de PDF asignado: pídele al administrador que lo asigne.' : 'El colegio aún no tiene una plantilla institucional aprobada.');
      const t0 = performance.now();
      const pdf = await E.db.funcion('circular-documentos', { accion: 'previsualizar', colegio_id: E.colegio.id, plantilla_id: plantilla.id, datos: v.datos });
      if (!(pdf instanceof Blob) || !pdf.size) throw new Error('El servidor no devolvió el PDF. Intenta de nuevo.');
      const seg = ((performance.now() - t0) / 1000).toFixed(1).replace('.', ',');
      const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
      const archivo = `Circular_revision_${v.datos.fecha_emision}.pdf`;
      await ventana({
        titulo: 'PDF de revisión listo',
        html: `<p>Es una <b>vista previa</b> con el formato del colegio: no queda emitida y no se envía a nadie. ${srv.consecutivo ? `Lleva el consecutivo del borrador guardado (${esc(srv.consecutivo)}).` : 'Aún sin consecutivo: se asigna al guardar.'}${v.datos.firmar ? ' Lleva tu firma encima de tu nombre.' : ''}</p>
          <p class="ayuda">${Math.max(1, Math.round(pdf.size / 1024))} KB · generado en ${seg} s · plantilla rev. ${esc(plantilla.revision)}</p>
          <div class="circ-acciones"><a class="btn btn-primario" href="${url}" target="_blank" rel="noopener">Abrir</a><a class="btn" href="${url}" download="${esc(archivo)}">Descargar</a></div>`,
        botones: [{ texto: 'Cerrar' }],
      });
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch (e) {
      aviso(e.message, 'error');
    } finally {
      btnPdf.disabled = false; btnPdf.textContent = antes;
    }
  };
  btnPdf.addEventListener('click', pdfRevision);

  const enfocar = (campo) => {
    const el = campo === 'contenido' ? ed : campo === 'destinatarios' ? form.querySelector('[name=destinatarios]') : form.elements[campo];
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el?.focus({ preventScroll: true });
  };

  // ----- Eliminar el borrador (no hay otra copia: se pide confirmación)
  $c('[data-eliminar]').addEventListener('click', async () => {
    if (!(await confirmar('¿Eliminar el borrador?', `${yo.admin ? 'Se borra para todo el equipo de Administración.' : 'Se borra tu borrador (Administración tampoco lo verá).'} Su consecutivo${srv.consecutivo ? ` «${srv.consecutivo}»` : ''} queda anulado: no se vuelve a usar. No se puede deshacer.`, 'Eliminar'))) return;
    try {
      await E.db.remove('circular_borradores', { id: srv.id });
      borrarLocal(llave);
      aviso('Borrador eliminado');
      location.hash = VOLVER;
    } catch (e) { aviso(e.message, 'error'); }
  });
}

// Vista rápida con la misma estructura del memo del colegio: cuadro Fecha | De / Consecutivo | Para, asunto a la derecha,
// cuerpo, y firma con "Cordialmente,", NOMBRE, cargo y colegio (como lo escribe la plantilla vigente)
function vistaHTML(x, plantilla, firmaUrl = null) {
  const firma = plantilla?.configuracion?.firma;
  const colegio = (firma?.incluir_institucion !== false) ? (firma?.institucion_texto || E.colegio.nombre) : '';
  const imgFirma = firmaUrl ? `<img class="circ-firma-img" src="${esc(firmaUrl)}" alt="Firma">` : '';
  // Carta como la circular E2-006-2026-2027 del colegio: ciudad y fecha, consecutivo a la derecha, sin cuadro ni asunto; el saludo
  // y la despedida van en el cuerpo; nombre, cargo y colegio en negrita
  // Memorando de Gerencia como el V2-2025-2026-1: cuadro en negrita con la fecha dd/mm/aaaa, asunto centrado con el consecutivo,
  // «Atentamente,», nombre en negrita sin mayúsculas, cargo en cursiva y recuadro de recibido
  if (plantilla?.configuracion?.estructura === 'memorando-gerencia-v1') {
    const f = (x.fecha_emision || '').split('-'), num = x.consecutivo.trim() || SIN_NUMERO;
    return `<div class="circ-hoja circ-gerencia">
    <header class="circ-membrete">${logoHTML('circ-logo')}<b>${esc(E.colegio.nombre)}</b></header>
    <table class="circ-cuadro circ-cuadro-gerencia">
      <tr><td><b>Fecha:&nbsp; ${esc(f.length === 3 ? f[2] + '/' + f[1] + '/' + f[0] : '')}</b></td><td><b>De: ${esc(x.dependencia || '—')}</b></td></tr>
      <tr><td><b>Consecutivo:&nbsp; ${esc(num)}</b></td><td><b>Para: ${esc(textoDestinatarios(x.destinatarios, x.destinatarios_otros) || '—')}</b></td></tr>
    </table>
    <p class="circ-asunto-centro"><b>Asunto: ${esc(num)} – ${esc(x.titulo || '—')}</b></p>
    <div class="circ-cuerpo">${contenidoHTML(x.contenido) || '<p class="ayuda">(sin contenido)</p>'}</div>
    <div class="circ-firma"><p>${esc(firma?.despedida ?? 'Atentamente,')}</p>${imgFirma}<b>${esc(x.responsable || 'Nombre de quien firma')}</b><i>${esc(x.cargo || 'Cargo')}</i></div>
    <div class="circ-recibido"><b>Firma de recibido:</b><span></span><b>Fecha:</b><b>Hora:</b></div>
    <p class="circ-marca">VISTA RÁPIDA · el PDF de revisión trae el encabezado, la marca de agua y el pie del colegio</p>
  </div>`;
  }
  if (plantilla?.configuracion?.estructura === 'carta-institucional-v1') return `<div class="circ-hoja circ-carta">
    <header class="circ-membrete">${logoHTML('circ-logo')}<b>${esc(E.colegio.nombre)}</b></header>
    <p class="circ-carta-cab"><span>${esc(plantilla.configuracion.carta?.ciudad || '')} ${esc(fechaLarga(x.fecha_emision).replace(/ (\d{4})$/, ' de $1'))}</span><b>${esc(x.consecutivo.trim() || SIN_NUMERO)}</b></p>
    <div class="circ-cuerpo">${contenidoHTML(x.contenido) || '<p class="ayuda">(sin contenido)</p>'}</div>
    <div class="circ-firma circ-firma-negrita">${imgFirma}<b>${esc((x.responsable || 'Nombre de quien firma').toLocaleUpperCase('es-CO'))}</b><b>${esc(x.cargo || 'Cargo')}</b>${colegio ? `<b>${esc(colegio)}</b>` : ''}</div>
    <p class="circ-marca">VISTA RÁPIDA · el PDF de revisión trae el encabezado, la marca de agua y el pie del colegio</p>
  </div>`;
  return `<div class="circ-hoja">
    <header class="circ-membrete">${logoHTML('circ-logo')}<b>${esc(E.colegio.nombre)}</b></header>
    <table class="circ-cuadro">
      <tr><td><b>Fecha:</b> ${esc(fechaLarga(x.fecha_emision))}</td><td><b>De:</b> ${esc(x.dependencia || '—')}</td></tr>
      <tr><td><b>Consecutivo:</b><br>${esc(x.consecutivo.trim() || SIN_NUMERO)}</td><td><b>Para:</b><br>${esc(textoDestinatarios(x.destinatarios, x.destinatarios_otros) || '—')}</td></tr>
    </table>
    <p class="circ-asunto"><b>Asunto:</b> <u>${esc(x.titulo || '—')}</u></p>
    <div class="circ-cuerpo">${contenidoHTML(x.contenido) || '<p class="ayuda">(sin contenido)</p>'}</div>
    <div class="circ-firma"><p>${esc(firma?.despedida ?? 'Cordialmente,')}</p>${imgFirma}<b>${esc((x.responsable || 'Nombre de quien firma').toLocaleUpperCase('es-CO'))}</b><span>${esc(x.cargo || 'Cargo')}</span>${colegio ? `<span>${esc(colegio)}</span>` : ''}</div>
    <p class="circ-marca">VISTA RÁPIDA · el PDF de revisión trae el membrete, la marca de agua y el pie del colegio</p>
  </div>`;
}
