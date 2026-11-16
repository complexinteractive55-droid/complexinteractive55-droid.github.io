// SER · conversación privada con Psicología (Fabio, 15-nov-2026: «el botón del SER, donde los estudiantes pueden comunicarse con
// psicología… póngalo donde consideres importante y haga una versión similar»). Decisiones de Fabio: conversación privada 1 a 1, la
// psicóloga ya tiene cuenta y el administrador la designa en Ajustes del colegio, escriben estudiantes y acudientes.
// Todo lo decide el servidor (migración 20261116100000_ser_psicologia): la conversación la ven SOLO quien escribe y la persona
// designada; el administrador designa pero no lee. Chat como las salas: reintentos sin duplicar, leído solo con la pestaña visible.
import { E, base } from '../estado.js';
import { esc, aviso, vacio, fechaHora } from '../ui.js';
import { cabecera } from './comun.js';

const rpc = (n, a) => E.db.rpc(n, a);
const nuevoId = () => crypto.randomUUID();
let soltar = null; // deja de escuchar al salir de la pantalla
window.addEventListener('hashchange', () => { if (!/^#\/ser(\/|$|\?)/.test(location.hash)) { soltar?.(); soltar = null; } });
const pendientes = new Map(); // conversación → mensajes sin confirmar (en memoria: se olvidan al cerrar sesión)
export function olvidar() { soltar?.(); soltar = null; pendientes.clear(); }

// ---------------------------------------------------------------- Insignia
// La imagen de la insignia SER que mandó Fabio, tal cual (16-nov-2026: «debe ser el botón igual a este»), sin el fondo crema.
export function insigniaSER({ clase = '' } = {}) {
  return `<img class="ser-insignia ${clase}" src="img/ser_insignia.png" alt="SER · Social, Empathic, Responsible" width="552" height="438" decoding="async">`;
}
// Años de la cinta: los del año lectivo activo (inicio y fin); si no tiene fechas, su año
export async function aniosSER() {
  try {
    const b = await base();
    const an = b.anio;
    if (!an) return [];
    const ini = an.fecha_inicio ? Number(String(an.fecha_inicio).slice(0, 4)) : an.anio, fin = an.fecha_fin ? Number(String(an.fecha_fin).slice(0, 4)) : an.anio;
    return ini && fin && fin !== ini ? [ini, fin] : [an.anio];
  } catch { return []; }
}

// ---------------------------------------------------------------- Estado (contador del menú y del botón)
export async function estadoSER() {
  if (!E.colegio) return null;
  try { const s = await rpc('ser_estado', { p_colegio: E.colegio.id }); E.ser = { ...s, colegio: E.colegio.id }; return E.ser; }
  catch { return E.ser?.colegio === E.colegio.id ? E.ser : null; }
}

// Botón grande del Tablero (estudiante y acudiente)
export function botonSER(anios = []) {
  return `<a class="ser-boton" href="#/ser" data-ser-boton>
    ${insigniaSER({ anios })}
    <span class="ser-boton-texto"><b>SER</b><small data-ser-quien>Habla en privado con Psicología del colegio</small></span>
    <span class="contador" data-contador="ser" hidden></span>
  </a>`;
}
// Completa el botón con el nombre de quien responde (sin esperar para pintar el Tablero)
export async function completarBoton(raiz) {
  const el = raiz?.querySelector('[data-ser-boton]');
  if (!el) return;
  const s = await estadoSER();
  if (!s || !document.body.contains(el)) return;
  el.querySelector('[data-ser-quien]').textContent = s.responsable ? `Habla en privado con ${s.responsable} (Psicología)` : 'Psicología del colegio · pronto disponible';
  const n = Number(s.sin_leer) || 0;
  el.querySelector('[data-contador="ser"]').textContent = n; el.querySelector('[data-contador="ser"]').hidden = !n;
}
// Tarjeta del Tablero de la persona designada (solo ella la ve)
export function tarjetaResponsable(s) {
  const n = Number(s?.sin_leer) || 0;
  return `<a class="ser-boton ser-psi" href="#/ser" data-ser-psi>${insigniaSER({ clase: 'mini' })}<span class="ser-boton-texto"><b>SER</b>
    <small>${n ? `Tienes <b>${n}</b> mensaje${n === 1 ? '' : 's'} sin leer` : 'Conversaciones privadas con estudiantes y familias'}</small></span>${n ? `<span class="contador">${n}</span>` : ''}</a>`;
}

// ---------------------------------------------------------------- #/ser
export async function ser(m) {
  soltar?.(); soltar = null;
  const s = await estadoSER();
  if (!s) { m.innerHTML = cabecera('SER', { volver: '#/inicio' }) + vacio('No se pudo abrir SER. Revisa tu conexión e intenta de nuevo.'); return; }
  if (s.soy_responsable) return bandeja(m, s);
  if (!s.puedo_escribir) {
    m.innerHTML = cabecera('SER', { volver: '#/inicio' }) + `<section class="tarjeta ser-intro">${insigniaSER({ anios: await aniosSER(), clase: 'mediana' })}
      <p>SER es la conversación <b>privada</b> de estudiantes y familias con Psicología del colegio. Solo la ve la persona designada${s.responsable ? ` (hoy: <b>${esc(s.responsable)}</b>)` : ''}: ni el administrador ni los docentes la pueden leer.</p>
      ${s.admin ? `<p class="ayuda">${s.responsable ? 'Para cambiar quién responde' : 'Para que SER funcione, designa a quien responde'} en <a href="#/ajustes-colegio#f-ser">Ajustes del colegio → SER</a>.</p>` : ''}</section>`;
    return;
  }
  if (!s.responsable) {
    m.innerHTML = cabecera('SER', { volver: '#/inicio' }) + `<section class="tarjeta ser-intro">${insigniaSER({ anios: await aniosSER(), clase: 'mediana' })}
      <p><b>SER aún no tiene a alguien de Psicología designado.</b> Pronto podrás escribir aquí. Si necesitas ayuda ya, busca a un docente o a alguien del colegio en quien confíes.</p></section>`;
    return;
  }
  let conv = s.conversacion;
  if (!conv) {
    try { conv = (await rpc('ser_abrir', { p_colegio: E.colegio.id })).id; } catch (e) { m.innerHTML = cabecera('SER', { volver: '#/inicio' }) + vacio(e.message); return; }
  }
  return chat(m, conv, { volver: '#/inicio', anios: await aniosSER() });
}

// #/ser/:id (la persona designada abre una conversación)
export async function conversacion(m, p) {
  soltar?.(); soltar = null;
  return chat(m, p.id, { volver: '#/ser' });
}

// Bandeja de la persona designada
async function bandeja(m, s) {
  const lista = await rpc('ser_bandeja', { p_colegio: E.colegio.id }).catch((e) => { m.innerHTML = cabecera('SER', { volver: '#/inicio' }) + vacio(e.message); return null; });
  if (!lista) return;
  m.innerHTML = cabecera('SER', { volver: '#/inicio' }) + `
    <p class="ayuda ser-privado">🔒 Conversaciones privadas: solo tú (persona designada en Ajustes del colegio) y cada persona que te escribe las ven.</p>
    ${lista.length ? `<div class="lista ser-lista">${lista.map((c) => `
      <a class="fila ser-fila ${Number(c.sin_leer) ? 'sin-leer' : ''}" href="#/ser/${esc(c.id)}">
        <span class="crece"><b>${esc(c.de)}</b><small>${esc(c.quien || '')}${c.ultimo_en ? ' · ' + esc(fechaHora(c.ultimo_en)) : ''}</small>
          <small class="ser-ultimo">${c.ultimo ? (c.ultimo.de_psicologia ? 'Tú: ' : '') + esc(c.ultimo.texto) : ''}</small></span>
        ${Number(c.sin_leer) ? `<span class="contador">${Number(c.sin_leer)}</span>` : ''}<span class="flecha">›</span>
      </a>`).join('')}</div>` : vacio('Aún nadie ha escrito a SER.')}`;
  // En vivo: llega un mensaje nuevo → se vuelve a pintar la lista
  const dejar = E.db.escucharCanal ? E.db.escucharCanal('ser-psi:' + E.colegio.id, () => { if (location.hash === '#/ser') bandeja(m, s); }, () => {}) : () => {};
  const reloj = setInterval(() => { if (document.visibilityState === 'visible' && location.hash === '#/ser' && document.body.contains(m)) bandeja(m, s); }, 30000);
  soltar = () => { dejar(); clearInterval(reloj); };
}

// ---------------------------------------------------------------- Conversación (las dos partes)
async function chat(m, conv, { volver, anios = [] }) {
  m.innerHTML = cabecera('SER', { volver }) + `
    <section class="tarjeta ser-chat">
      <div class="ser-cab" data-ser-cab>${insigniaSER({ anios, clase: 'mini' })}<span class="crece"><b>…</b></span></div>
      <p class="ayuda ser-privado" data-ser-privado></p>
      <div class="sala-hilo ser-hilo" data-hilo role="log" aria-live="polite" aria-label="Conversación privada con Psicología"></div>
      <form class="sala-escribir" data-escribir>
        <label class="oculto-visual" for="ser-texto">Mensaje</label>
        <textarea id="ser-texto" name="texto" rows="2" maxlength="4000" placeholder="Escribe aquí…"></textarea>
        <button class="btn btn-primario" data-enviar>Enviar</button>
      </form>
    </section>`;
  const hilo = m.querySelector('[data-hilo]'), cab = m.querySelector('[data-ser-cab]'), priv = m.querySelector('[data-ser-privado]');
  const st = { mensajes: new Map(), ultimo: 0, leido: -1, verHasta: -1, leidoOtro: 0, info: null };
  const pend = pendientes.get(conv) || new Map(); pendientes.set(conv, pend);
  const burbuja = (x, ultimoMio) => `<div class="sala-msj ${x.mio ? 'mio' : ''} ${x.de_psicologia ? 'psi' : ''}" data-seq="${x.seq}">
      <small><b>${esc(x.autor)}</b>${x.de_psicologia ? ' · Psicología' : ''} · ${esc(fechaHora(x.creado_en))}</small><p>${esc(x.texto).replace(/\n/g, '<br>')}</p>
      ${x.mio && x.seq === ultimoMio && st.leidoOtro >= x.seq ? '<small class="ser-visto">✓✓ Visto</small>' : ''}</div>`;
  const burbujaPend = (x) => `<div class="sala-msj mio pendiente"><p>${esc(x.texto).replace(/\n/g, '<br>')}</p>
      ${x.estado === 'error' ? `<small class="falla" role="alert">⚠ No enviado${x.error ? ': ' + esc(x.error) : ''} <button type="button" class="btn btn-chico" data-reintentar="${esc(x.solicitud)}">Reintentar</button></small>` : '<small>⏳ Enviando…</small>'}</div>`;
  const pintar = () => {
    const abajo = hilo.scrollHeight - hilo.scrollTop - hilo.clientHeight < 80;
    const lista = [...st.mensajes.values()].sort((a, z) => a.seq - z.seq);
    for (const k of [...pend.keys()]) if (lista.some((x) => x.solicitud_id === k)) pend.delete(k);
    const ultimoMio = lista.filter((x) => x.mio).at(-1)?.seq;
    const vacioTxt = st.info?.mia ? '<p class="ayuda ser-vacio">Cuéntale a Psicología lo que quieras. Lo que escribas aquí es privado.</p>' : '<p class="ayuda">Aún no hay mensajes.</p>';
    hilo.innerHTML = lista.map((x) => burbuja(x, ultimoMio)).join('') + [...pend.values()].map(burbujaPend).join('') || vacioTxt;
    if (abajo) hilo.scrollTop = hilo.scrollHeight;
    observar();
  };
  // Leído de verdad: solo lo que estuvo en pantalla con la pestaña visible
  let marcando = null;
  const marcar = () => { clearTimeout(marcando); marcando = setTimeout(async () => {
    if (document.visibilityState !== 'visible' || !document.body.contains(hilo) || st.verHasta <= st.leido) return;
    try { const r = await rpc('ser_marcar_leido', { p_conv: conv, p_hasta: st.verHasta }); st.leido = Math.max(st.leido, r.leido_seq); window.dispatchEvent(new Event('complex:mensajes')); } catch {}
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
      const r = await rpc('ser_mensajes', { p_conv: conv, p_desde: st.ultimo || null, p_limite: 200 });
      if (!st.info) {
        st.info = r.conversacion;
        cab.querySelector('.crece').innerHTML = r.conversacion.mia ? `<b>Psicología · ${esc(r.responsable || '')}</b><small>Conversación privada</small>`
          : `<b>${esc(r.conversacion.de)}</b><small>${esc(r.conversacion.quien || '')}</small>`;
        priv.textContent = r.conversacion.mia
          ? `🔒 Solo tú y ${r.responsable || 'Psicología'} ven esta conversación: ni el administrador ni los docentes. Si es una emergencia, busca de inmediato a un adulto del colegio.`
          : '🔒 Conversación privada: solo tú (persona designada para SER) y quien te escribe la ven.';
      }
      for (const x of r.mensajes) { st.mensajes.set(x.id, x); st.ultimo = Math.max(st.ultimo, x.seq); }
      if (Number.isInteger(r.leido_seq)) st.leido = Math.max(st.leido, r.leido_seq);
      st.leidoOtro = Math.max(st.leidoOtro, Number(r.leido_otro) || 0);
      pintar();
    } catch (e) { if (/acceso/i.test(e.message)) { hilo.innerHTML = `<p class="pq-msg error">${esc(e.message)}</p>`; m.querySelector('[data-escribir]').hidden = true; soltar?.(); } }
  };
  const enviar = async (x) => {
    x.estado = 'enviando'; x.error = null; pintar();
    try { const r = await rpc('ser_enviar', { p_conv: conv, p_solicitud: x.solicitud, p_texto: x.texto }); st.mensajes.set(r.id, r); st.ultimo = Math.max(st.ultimo, r.seq); pend.delete(x.solicitud); }
    catch (e) { x.estado = 'error'; x.error = e.message; } // el texto se conserva; reintentar usa la misma identificación (no duplica)
    pintar();
  };
  m.querySelector('[data-escribir]').addEventListener('submit', (e) => {
    e.preventDefault();
    const t = e.target.texto, texto = t.value.trim();
    if (!texto) return;
    const x = { solicitud: nuevoId(), texto, estado: 'enviando' };
    pend.set(x.solicitud, x); t.value = '';
    enviar(x);
  });
  hilo.addEventListener('click', (e) => { const b = e.target.closest('[data-reintentar]'); if (b) { const x = pend.get(b.dataset.reintentar); if (x) enviar(x); } });
  await traer();
  hilo.scrollTop = hilo.scrollHeight;
  // En vivo (señal sin contenido) y, por si acaso, cada 15 s con la pestaña visible
  const dejar = E.db.escucharCanal ? E.db.escucharCanal('ser:' + conv, () => traer(), () => {}) : () => {};
  const reloj = setInterval(() => { if (document.visibilityState === 'visible') traer(); }, 15000);
  const alVolver = () => { if (document.visibilityState === 'visible') { traer(); observar(); } };
  document.addEventListener('visibilitychange', alVolver);
  soltar = () => { dejar(); clearInterval(reloj); clearTimeout(marcando); visor?.disconnect(); document.removeEventListener('visibilitychange', alVolver); };
}

// ---------------------------------------------------------------- Ajustes del colegio: quién responde SER (administrador)
export async function seccionAjustes() {
  return `<section class="tarjeta" id="f-ser">
      <div class="ser-cab">${insigniaSER({ clase: 'mini' })}<span class="crece"><h2>SER</h2><small>Quién responde las conversaciones privadas de estudiantes y familias</small></span></div>
      <div data-ser-ajustes><p class="ayuda">Cargando…</p></div>
    </section>`;
}
export async function conectarAjustes(raiz) {
  const caja = raiz.querySelector('[data-ser-ajustes]');
  if (!caja) return;
  const [actual, gente] = await Promise.all([
    rpc('ser_responsable_ver', { p_colegio: E.colegio.id }).catch(() => null),
    rpc('personas_colegio', { p_colegio: E.colegio.id }).catch(() => []),
  ]);
  if (!actual) { caja.innerHTML = '<p class="ayuda">SER aún no está disponible en este colegio.</p>'; return; }
  const PERSONAL = { admin: 'Administración', profesor: 'Docente', enfermeria: 'Enfermería', director_seccion: 'Dirección de sección' };
  const vistos = new Map();
  for (const g of gente) if (g.activo !== false && PERSONAL[g.rol] && !vistos.has(g.perfil_id)) vistos.set(g.perfil_id, `${[g.nombres, g.apellidos].filter(Boolean).join(' ')} · ${PERSONAL[g.rol]}`);
  const opciones = [...vistos].sort((a, z) => a[1].localeCompare(z[1]));
  caja.innerHTML = `
    <p class="ayuda">Solo esta persona ve las conversaciones de SER. Tú, como administrador, la designas pero <b>no</b> lees las conversaciones. Si la cambias, la nueva persona ve el historial y la anterior deja de verlo.</p>
    <label>Responde SER<select name="ser_responsable"><option value="">— Nadie (SER queda en pausa) —</option>${opciones.map(([id, t]) => `<option value="${esc(id)}" ${id === actual.responsable_id ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
    ${actual.actualizado_en ? `<p class="ayuda">Último cambio: ${esc(fechaHora(actual.actualizado_en))}${actual.actualizado_por ? ' por ' + esc(actual.actualizado_por) : ''}</p>` : ''}
    <button class="btn btn-primario" data-ser-guardar>Guardar</button>`;
  caja.querySelector('[data-ser-guardar]').onclick = async () => {
    const v = caja.querySelector('[name=ser_responsable]').value || null;
    try {
      const r = await rpc('ser_responsable_guardar', { p_colegio: E.colegio.id, p_perfil: v });
      aviso(r.responsable ? `SER: ahora responde ${r.responsable}` : 'SER quedó sin responsable');
      E.ser = null;
      conectarAjustes(raiz);
    } catch (e) { aviso(e.message, 'error'); }
  };
}
