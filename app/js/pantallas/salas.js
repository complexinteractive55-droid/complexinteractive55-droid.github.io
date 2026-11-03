// Salas de sección y avisos destacados (input de desarrollo 2-nov-2026 §9). El chat es para el día a día; lo importante va como
// AVISO (con vigencia) y se muestra arriba, aparte del chat, para que no se entierre. Todo lo decide el servidor (migración
// 20261103150000): miembros explícitos, quién publica, versiones, vencimiento. Leído / visto: solo lo que estuvo en pantalla con la
// pestaña visible (como en PQRS).
import { E } from '../estado.js';
import { esc, aviso, ventana, confirmar, vacio, fechaHora } from '../ui.js';
import { cabecera, pestanas } from './comun.js';

const PRIO = { urgente: '🔴 Urgente', importante: '🟠 Importante', normal: 'Normal' };
const nuevoId = () => crypto.randomUUID();
const rpc = (n, a) => E.db.rpc(n, a);
const local = (iso) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
let soltar = null; // deja de escuchar la sala al salir de la pantalla
window.addEventListener('hashchange', () => { if (!/^#\/sala\//.test(location.hash)) { soltar?.(); soltar = null; } });
const pendientes = new Map(); // sala → mensajes sin confirmar (en memoria: se olvidan al cerrar sesión)
export function olvidar() { soltar?.(); soltar = null; pendientes.clear(); }

const tarjetaAviso = (a) => `<a class="tarjeta aviso-tarjeta prio-${esc(a.prioridad)}" href="#/aviso/${esc(a.id)}">
    <span class="aviso-prio">${esc(PRIO[a.prioridad] || a.prioridad)}</span>${a.vigente ? '' : `<span class="aviso-estado">${a.estado === 'retirado' ? 'Retirado' : 'Vencido'}</span>`}
    <b>${esc(a.titulo)}</b>
    <small>${a.sala ? esc(a.sala) + ' · ' : ''}Vigente hasta ${esc(fechaHora(a.fin))}${a.editado ? ` · editado (v${a.version})` : ''}${a.comentarios ? ` · ${a.comentarios} comentario${a.comentarios === 1 ? '' : 's'}` : ''}${a.visto_por_mi ? '' : ' · <span class="aviso-nuevo">sin ver</span>'}</small>
  </a>`;

// ---------------------------------------------------------------- Lista de salas
export async function salas(m) {
  let lista = await rpc('salas_mias', { p_colegio: E.colegio.id });
  const admin = E.rol === 'admin';
  if (!lista.length) {
    m.innerHTML = cabecera('Salas de sección') + (admin
      ? `${vacio('Aún no hay salas de sección en el colegio.')}<p class="centro"><button type="button" class="btn btn-primario" data-preparar>Crear las salas Infantil, Prejuvenil y Juvenil</button></p>`
      : vacio('No estás en ninguna sala de sección. El administrador agrega a cada persona a la sala de su sección.'));
    m.querySelector('[data-preparar]')?.addEventListener('click', async () => { try { await rpc('salas_preparar', { p_colegio: E.colegio.id }); salas(m); } catch (e) { aviso(e.message, 'error'); } });
    return;
  }
  m.innerHTML = cabecera('Salas de sección') + `
    <p class="ayuda">El chat de cada sección es para el día a día. Lo importante se publica como <b>aviso</b> y queda arriba, con su vigencia.</p>
    <div class="lista">${lista.map((s) => `<a class="fila fila-boton" href="#/sala/${esc(s.id)}${s.miembro ? '' : '?tab=miembros'}">
        <span>💬</span><span class="crece"><b>${esc(s.nombre)}</b><small>${s.miembro ? '' : 'No eres miembro · '}${s.avisos_vigentes} aviso${s.avisos_vigentes === 1 ? '' : 's'} vigente${s.avisos_vigentes === 1 ? '' : 's'}${s.miembros != null ? ` · ${s.miembros} miembro${s.miembros === 1 ? '' : 's'}` : ''}</small></span>
        ${s.sin_leer ? `<span class="contador" aria-label="${s.sin_leer} mensajes sin leer">${s.sin_leer}</span>` : ''}</a>`).join('')}</div>`;
}

// ---------------------------------------------------------------- Una sala: avisos vigentes arriba, chat abajo
export async function sala(m, p) {
  soltar?.(); soltar = null;
  const lista = await rpc('salas_mias', { p_colegio: E.colegio.id });
  const s = lista.find((x) => x.id === p.id);
  if (!s) { m.innerHTML = cabecera('Sala', { volver: '#/salas' }) + vacio('No tienes acceso a esta sala.'); return; }
  const tabs = [...(s.miembro ? [['chat', 'Chat y avisos']] : []), ['avisos', 'Todos los avisos'], ['miembros', 'Miembros']];
  const tab = tabs.some(([k]) => k === p.tab) ? p.tab : tabs[0][0];
  m.innerHTML = cabecera(esc(s.nombre), { volver: '#/salas', acciones: s.puede_publicar ? '<button type="button" class="btn btn-primario" data-publicar>＋ Aviso</button>' : '' })
    + pestanas(tabs, tab, `#/sala/${s.id}?tab=`) + '<div data-sala-cuerpo></div>';
  const cuerpo = m.querySelector('[data-sala-cuerpo]');
  m.querySelector('[data-publicar]')?.addEventListener('click', () => formularioAviso(s, null).then((ok) => ok && sala(m, p)));
  if (tab === 'miembros') return miembros(cuerpo, s);
  if (tab === 'avisos') {
    const todos = await rpc('avisos_ver', { p_colegio: E.colegio.id, p_sala: s.id, p_pasados: true });
    cuerpo.innerHTML = todos.length ? `<div class="avisos-lista">${todos.map(tarjetaAviso).join('')}</div>` : vacio('Esta sala aún no tiene avisos.');
    return;
  }
  return chat(cuerpo, s);
}

async function chat(cuerpo, s) {
  cuerpo.innerHTML = `
    <section class="avisos-vigentes" aria-label="Avisos vigentes" data-vigentes></section>
    <section class="tarjeta sala-chat">
      <div class="sala-hilo" data-hilo role="log" aria-live="polite" aria-label="Conversación de la sala"></div>
      <form class="sala-escribir" data-escribir>
        <label class="oculto-visual" for="sala-texto">Mensaje</label>
        <textarea id="sala-texto" name="texto" rows="2" maxlength="4000" placeholder="Escribe a la sala…"></textarea>
        <button class="btn btn-primario" data-enviar>Enviar</button>
      </form>
    </section>`;
  const hilo = cuerpo.querySelector('[data-hilo]'), vig = cuerpo.querySelector('[data-vigentes]');
  const st = { mensajes: new Map(), ultimo: 0, leido: -1, verHasta: -1 };
  const pend = pendientes.get(s.id) || new Map(); pendientes.set(s.id, pend);
  const pintarVigentes = async () => {
    const v = await rpc('avisos_ver', { p_colegio: E.colegio.id, p_sala: s.id, p_pasados: false }).catch(() => []);
    vig.innerHTML = v.length ? `<h2 class="avisos-titulo">Avisos vigentes</h2><div class="avisos-lista">${v.map(tarjetaAviso).join('')}</div>` : '';
  };
  const burbuja = (x) => x.aviso
    ? `<div class="sala-msj anuncio" data-seq="${x.seq}"><small>${esc(x.autor)} publicó un aviso · ${esc(fechaHora(x.creado_en))}</small>${tarjetaAviso(x.aviso)}</div>`
    : `<div class="sala-msj ${x.mio ? 'mio' : ''}" data-seq="${x.seq}"><small><b>${esc(x.autor)}</b> · ${esc(fechaHora(x.creado_en))}</small><p>${esc(x.texto).replace(/\n/g, '<br>')}</p></div>`;
  const burbujaPend = (x) => `<div class="sala-msj mio pendiente"><p>${esc(x.texto).replace(/\n/g, '<br>')}</p>
      ${x.estado === 'error' ? `<small class="falla" role="alert">⚠ No enviado${x.error ? ': ' + esc(x.error) : ''} <button type="button" class="btn btn-chico" data-reintentar="${esc(x.solicitud)}">Reintentar</button></small>` : '<small>⏳ Enviando…</small>'}</div>`;
  const pintar = () => {
    const abajo = hilo.scrollHeight - hilo.scrollTop - hilo.clientHeight < 80;
    const lista = [...st.mensajes.values()].sort((a, z) => a.seq - z.seq);
    for (const k of [...pend.keys()]) if (lista.some((x) => x.solicitud_id === k)) pend.delete(k);
    hilo.innerHTML = lista.map(burbuja).join('') + [...pend.values()].map(burbujaPend).join('') || '<p class="ayuda">Aún no hay mensajes en la sala.</p>';
    if (abajo) hilo.scrollTop = hilo.scrollHeight;
    observar();
  };
  // Leído de verdad: solo lo que estuvo en pantalla con la pestaña visible
  let marcando = null;
  const marcar = () => { clearTimeout(marcando); marcando = setTimeout(async () => {
    if (document.visibilityState !== 'visible' || !document.body.contains(hilo) || st.verHasta <= st.leido) return;
    try { const r = await rpc('sala_marcar_leido', { p_sala: s.id, p_hasta: st.verHasta }); st.leido = Math.max(st.leido, r.leido_seq); } catch {}
  }, 700); };
  const visor = 'IntersectionObserver' in window ? new IntersectionObserver((v) => {
    if (document.visibilityState !== 'visible') return;
    for (const x of v) if (x.isIntersecting) st.verHasta = Math.max(st.verHasta, Number(x.target.dataset.seq));
    marcar();
  }, { threshold: 0.5 }) : null;
  function observar() { if (!visor) return; visor.disconnect(); hilo.querySelectorAll('[data-seq]').forEach((el) => visor.observe(el)); }
  const traer = async () => {
    if (!document.body.contains(hilo)) return;
    try {
      const r = await rpc('sala_mensajes', { p_sala: s.id, p_desde: st.ultimo || null, p_antes: null, p_limite: 100 });
      for (const x of r.mensajes) { st.mensajes.set(x.id, x); st.ultimo = Math.max(st.ultimo, x.seq); }
      if (Number.isInteger(r.leido_seq)) st.leido = Math.max(st.leido, r.leido_seq);
      pintar();
      if (r.mensajes.some((x) => x.aviso)) pintarVigentes();
    } catch (e) { if (/acceso/i.test(e.message)) { hilo.innerHTML = `<p class="pq-msg error">${esc(e.message)}</p>`; soltar?.(); } }
  };
  const enviar = async (x) => {
    x.estado = 'enviando'; x.error = null; pintar();
    try { const r = await rpc('sala_enviar', { p_sala: s.id, p_solicitud: x.solicitud, p_texto: x.texto }); st.mensajes.set(r.id, r); st.ultimo = Math.max(st.ultimo, r.seq); pend.delete(x.solicitud); }
    catch (e) { x.estado = 'error'; x.error = e.message; } // el texto se conserva; reintentar usa la misma identificación (no duplica)
    pintar();
  };
  cuerpo.querySelector('[data-escribir]').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = e.target.texto, texto = t.value.trim();
    if (!texto) return;
    const x = { solicitud: nuevoId(), texto, estado: 'enviando' };
    pend.set(x.solicitud, x); t.value = '';
    enviar(x);
  });
  hilo.addEventListener('click', (e) => { const b = e.target.closest('[data-reintentar]'); if (b) { const x = pend.get(b.dataset.reintentar); if (x) enviar(x); } });
  await Promise.all([pintarVigentes(), traer()]);
  hilo.scrollTop = hilo.scrollHeight;
  // En vivo (señal sin contenido) y, por si acaso, consulta cada 15 s con la pestaña visible
  const dejar = E.db.escucharCanal ? E.db.escucharCanal('sala:' + s.id, () => traer(), () => {}) : () => {};
  const reloj = setInterval(() => { if (document.visibilityState === 'visible') traer(); }, 15000);
  const alVolver = () => { if (document.visibilityState === 'visible') { traer(); observar(); } };
  document.addEventListener('visibilitychange', alVolver);
  soltar = () => { dejar(); clearInterval(reloj); clearTimeout(marcando); visor?.disconnect(); document.removeEventListener('visibilitychange', alVolver); };
}

async function miembros(cuerpo, s) {
  const lista = await rpc('sala_miembros_ver', { p_sala: s.id }).catch((e) => { cuerpo.innerHTML = vacio(e.message); return null; });
  if (!lista) return;
  cuerpo.innerHTML = `
    ${s.admin ? '<p class="ayuda">Solo el administrador agrega o quita miembros. Un miembro de esta sala no entra a las demás.</p>' : ''}
    <div class="lista">${lista.map((x) => `<div class="fila"><span>👤</span><span class="crece"><b>${esc(x.nombre)}</b><small>${x.puede_publicar ? 'Publica avisos' : 'Miembro'}${x.activo ? '' : ' · sin acceso (quitado o membresía inactiva)'}</small></span>
        ${s.admin ? `<span class="botones-fila"><button type="button" class="btn btn-chico" data-publica="${esc(x.perfil_id)}" data-valor="${x.puede_publicar ? '0' : '1'}">${x.puede_publicar ? 'Quitar permiso de publicar' : 'Puede publicar'}</button>
          <button type="button" class="btn btn-chico" data-quitar="${esc(x.perfil_id)}">${x.activo ? 'Quitar' : 'Volver a agregar'}</button></span>` : ''}</div>`).join('') || vacio('La sala aún no tiene miembros.')}</div>
    ${s.admin ? '<p><button type="button" class="btn" data-agregar>＋ Agregar persona</button></p>' : ''}`;
  const guardar = async (perfil, activo, publica) => { try { await rpc('sala_miembro_guardar', { p_sala: s.id, p_perfil: perfil, p_activo: activo, p_puede_publicar: publica }); miembros(cuerpo, s); } catch (e) { aviso(e.message, 'error'); } };
  cuerpo.querySelectorAll('[data-publica]').forEach((b) => b.addEventListener('click', () => { const x = lista.find((y) => y.perfil_id === b.dataset.publica); guardar(x.perfil_id, true, b.dataset.valor === '1'); }));
  cuerpo.querySelectorAll('[data-quitar]').forEach((b) => b.addEventListener('click', async () => {
    const x = lista.find((y) => y.perfil_id === b.dataset.quitar);
    if (x.activo && !(await confirmar('¿Quitar de la sala?', `${x.nombre} dejará de ver el chat y los avisos de ${s.nombre}.`, 'Quitar'))) return;
    guardar(x.perfil_id, !x.activo, x.puede_publicar);
  }));
  cuerpo.querySelector('[data-agregar]')?.addEventListener('click', async () => {
    const miembrosCol = await E.db.select('miembros', { eq: { colegio_id: E.colegio.id } });
    const ya = new Set(lista.filter((x) => x.activo).map((x) => x.perfil_id));
    const ids = [...new Set(miembrosCol.filter((x) => x.activo !== false && ['admin', 'profesor', 'director_seccion', 'enfermeria'].includes(x.rol) && !ya.has(x.perfil_id)).map((x) => x.perfil_id))];
    const perfs = ids.length ? await E.db.select('perfiles', { in: { id: ids } }) : [];
    const elegido = await ventana({ titulo: 'Agregar a ' + s.nombre,
      html: perfs.length ? `<div class="lista">${perfs.sort((a, z) => `${a.nombres} ${a.apellidos}`.localeCompare(`${z.nombres} ${z.apellidos}`)).map((x) => `<button type="button" class="fila fila-boton" data-elegir="${esc(x.id)}"><b>${esc(`${x.nombres || ''} ${x.apellidos || ''}`)}</b></button>`).join('')}</div>` : vacio('No hay más personal para agregar.'),
      alAbrir: (caja, cerrar) => caja.querySelectorAll('[data-elegir]').forEach((b) => (b.onclick = () => cerrar(b.dataset.elegir))), botones: [{ texto: 'Cancelar', valor: null }] });
    if (elegido) guardar(elegido, true, false);
  });
}

// ---------------------------------------------------------------- Publicar o editar un aviso (fin obligatorio; 7 días propuestos)
async function formularioAviso(s, a) {
  const ini = a ? new Date(a.inicio) : new Date(), fin = a ? new Date(a.fin) : new Date(Date.now() + 7 * 86400000);
  const solicitud = nuevoId();
  return ventana({
    titulo: a ? 'Editar aviso' : 'Nuevo aviso en ' + s.nombre,
    html: `<form class="form" data-f novalidate>
      <label>Título<input name="titulo" maxlength="140" required value="${esc(a?.titulo || '')}"></label>
      <label>Contenido<textarea name="contenido" rows="5" maxlength="4000" required>${esc(a?.contenido || '')}</textarea></label>
      <label>Prioridad<select name="prioridad">${Object.entries(PRIO).map(([k, t]) => `<option value="${k}" ${(a?.prioridad || 'normal') === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      <label>Vigente desde<input type="datetime-local" name="inicio" value="${local(ini)}"></label>
      <label>Vigente hasta (obligatorio, máximo 60 días)<input type="datetime-local" name="fin" required value="${local(fin)}"></label>
      ${a ? '' : '<label class="check"><input type="checkbox" name="anunciar" checked> Anunciarlo en el chat de la sala (enlaza este mismo aviso)</label>'}
      <p class="error" data-error role="alert"></p></form>`,
    botones: [{ texto: 'Cancelar', valor: null }, { texto: a ? 'Guardar cambios' : 'Publicar', antes: async (caja) => {
      const f = caja.querySelector('[data-f]'), el = (n) => f.elements[n];
      const datos = { p_titulo: el('titulo').value.trim(), p_contenido: el('contenido').value.trim(), p_prioridad: el('prioridad').value,
        p_inicio: el('inicio').value ? new Date(el('inicio').value).toISOString() : null, p_fin: el('fin').value ? new Date(el('fin').value).toISOString() : null };
      try {
        if (a) await rpc('aviso_editar', { p_id: a.id, p_version: a.version, ...datos });
        else await rpc('aviso_publicar', { p_sala: s.id, p_solicitud: solicitud, ...datos, p_anunciar: el('anunciar').checked });
        aviso(a ? 'Aviso actualizado' : 'Aviso publicado');
        return true;
      } catch (e) { caja.querySelector('[data-error]').textContent = e.message; return false; } // el formulario conserva lo escrito
    } }],
  });
}

// ---------------------------------------------------------------- Un aviso: contenido, versiones y comentarios
export async function avisoDetalle(m, p) {
  let a;
  try { a = await rpc('aviso_detalle', { p_id: p.id }); } catch (e) { m.innerHTML = cabecera('Aviso', { volver: '#/salas' }) + vacio(e.message); return; }
  const s = { id: a.sala_id, nombre: a.sala };
  m.innerHTML = cabecera('Aviso', { volver: `#/sala/${a.sala_id}`, acciones: a.puede_editar ? '<button type="button" class="btn" data-editar>Editar</button><button type="button" class="btn" data-retirar>Retirar</button>' : '' }) + `
    <article class="tarjeta aviso-detalle prio-${esc(a.prioridad)}" data-aviso-contenido>
      <p class="aviso-prio">${esc(PRIO[a.prioridad] || a.prioridad)} · ${esc(a.sala || '')}${a.vigente ? '' : ` · <b>${a.estado === 'retirado' ? 'Retirado' : 'Vencido'}</b>`}</p>
      <h2>${esc(a.titulo)}</h2>
      <p class="aviso-texto">${esc(a.contenido).replace(/\n/g, '<br>')}</p>
      <small>Publicado por ${esc(a.autor)} · vigente del ${esc(fechaHora(a.inicio))} al ${esc(fechaHora(a.fin))}${a.editado ? ` · editado (versión ${a.version}, ${esc(fechaHora(a.actualizado_en))})` : ''}</small>
      ${a.vistas != null ? `<p class="ayuda">Lo visualizaron ${a.vistas} de ${a.miembros} miembros (verlo en pantalla no es una confirmación de lectura).</p>` : ''}
    </article>
    ${a.versiones.length ? `<details class="tarjeta"><summary>Versiones anteriores (${a.versiones.length})</summary>${a.versiones.map((v) => `<div class="aviso-version"><b>Versión ${v.version}: ${esc(v.titulo)}</b><p>${esc(v.contenido).replace(/\n/g, '<br>')}</p><small>${esc(PRIO[v.prioridad] || v.prioridad)} · hasta ${esc(fechaHora(v.fin))}</small></div>`).join('')}</details>` : ''}
    <section class="tarjeta"><h2>Comentarios</h2>
      <div class="lista" data-comentarios>${a.comentarios_lista.map((c) => `<div class="fila"><span class="crece"><b>${esc(c.autor)}</b><small>${esc(fechaHora(c.creado_en))}</small><span>${esc(c.texto).replace(/\n/g, '<br>')}</span></span></div>`).join('') || '<p class="ayuda">Sin comentarios.</p>'}</div>
      ${a.estado === 'publicado' ? `<form class="sala-escribir" data-comentar><label class="oculto-visual" for="aviso-com">Comentario</label><textarea id="aviso-com" name="texto" rows="2" maxlength="2000" placeholder="Comentar este aviso…"></textarea><button class="btn btn-primario">Comentar</button></form><p class="error" data-error-com role="alert"></p>` : ''}
    </section>`;
  // Visto: solo con el aviso en pantalla y la pestaña visible
  const art = m.querySelector('[data-aviso-contenido]');
  const marcarVisto = () => { if (document.visibilityState === 'visible' && document.body.contains(art) && !a.visto_por_mi) rpc('aviso_marcar_visto', { p_id: a.id }).then(() => { a.visto_por_mi = true; }).catch(() => {}); };
  if ('IntersectionObserver' in window) { const o = new IntersectionObserver((v) => { if (v.some((x) => x.isIntersecting)) { setTimeout(marcarVisto, 700); } }, { threshold: 0.5 }); o.observe(art); } else marcarVisto();
  const solicitud = { id: nuevoId() };
  m.querySelector('[data-comentar]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const t = e.target.texto, txt = t.value.trim();
    if (!txt) return;
    try { await rpc('aviso_comentar', { p_id: a.id, p_solicitud: solicitud.id, p_texto: txt }); solicitud.id = nuevoId(); avisoDetalle(m, p); }
    catch (err) { m.querySelector('[data-error-com]').textContent = 'No se guardó: ' + err.message + ' (tu texto sigue aquí; puedes reintentar).'; }
  });
  m.querySelector('[data-editar]')?.addEventListener('click', () => formularioAviso(s, a).then((ok) => ok && avisoDetalle(m, p)));
  m.querySelector('[data-retirar]')?.addEventListener('click', async () => {
    const motivo = await ventana({ titulo: 'Retirar aviso', html: '<label>Motivo (obligatorio)<textarea name="motivo" rows="3" maxlength="1000"></textarea></label>',
      botones: [{ texto: 'Cancelar', valor: null }, { texto: 'Retirar', antes: (caja) => caja.querySelector('[name=motivo]').value.trim() || false }] });
    if (!motivo) return;
    try { const r = await rpc('aviso_retirar', { p_id: a.id, p_motivo: motivo }); aviso(r.igual ? 'Otra persona ya lo había retirado.' : 'Aviso retirado', r.igual ? 'error' : undefined); avisoDetalle(m, p); }
    catch (e) { aviso(e.message, 'error'); }
  });
}

// ---------------------------------------------------------------- Recuadro en la cartelera del docente
export async function avisosCartelera() {
  const v = await rpc('avisos_ver', { p_colegio: E.colegio.id, p_sala: null, p_pasados: false }).catch(() => []);
  if (!v.length) return '';
  return `<section class="tarjeta"><div class="tarjeta-cab"><h2>Avisos de tu sección</h2><a class="btn btn-chico" href="#/salas">Salas</a></div>
    <div class="avisos-lista">${v.slice(0, 4).map(tarjetaAviso).join('')}</div>${v.length > 4 ? `<p class="ayuda">${v.length - 4} aviso(s) más en las salas.</p>` : ''}</section>`;
}
