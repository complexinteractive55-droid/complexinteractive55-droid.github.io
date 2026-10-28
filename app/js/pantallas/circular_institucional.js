// Circular institucional (formato del colegio en PDF), solo Administración.
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

const VOLVER = '#/circulares-institucionales';
const SIN_NUMERO = 'Sin número definitivo'; // lo mismo que pone el servidor cuando no hay consecutivo
// Identificador de la creación de un documento (el mismo en cada reintento)
const nuevoId = () => crypto.randomUUID?.() || '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
// El consecutivo de un borrador guardado es el de la base (columna), no lo que diga el formulario
const deFila = (f) => normal({ ...f.datos, consecutivo: f.consecutivo ?? f.datos?.consecutivo });

// Copia en el equipo de lo que aún no se guarda en el servidor (una por borrador; "nueva" = el que aún no existe)
const clave = (id) => `complex_circular_${E.colegio.id}_${id}`;
const leerLocal = (id) => { try { return JSON.parse(localStorage.getItem(clave(id)) || 'null'); } catch { return null; } };
const guardarLocal = (id, v) => { try { localStorage.setItem(clave(id), JSON.stringify(v)); return true; } catch { return false; } };
const borrarLocal = (id) => { try { localStorage.removeItem(clave(id)); } catch {} };

const nuevaCircular = () => ({ fecha_emision: hoyBogota(), consecutivo: '', dependencia: 'Rectoría', destinatarios: [], destinatarios_otros: '', titulo: '', contenido: { version: 1, bloques: [] }, responsable: '', cargo: CARGO_DE_AREA['Rectoría'] });
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
  };
};
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const referencia = (id) => (id ? id.slice(0, 8).toUpperCase() : 'se asigna al guardar');
const soloAdmin = (m, titulo) => { m.innerHTML = cabecera(titulo, { volver: '#/circulares' }) + vacio('Solo Administración prepara las circulares institucionales.'); };

// ---------------------------------------------------------------- Lista de borradores
export async function lista(m) {
  if (E.rol !== 'admin') return soloAdmin(m, 'Circulares institucionales');
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
    <div class="aviso-caja"><p><b>Formato institucional en PDF.</b> Aquí se preparan, se guardan y se revisan en PDF.</p>
      <p class="ayuda">Nada se publica ni se envía. Complex asigna el consecutivo al guardar cada circular por primera vez y no lo vuelve a cambiar.</p></div>
    ${sinGuardar || filas.length ? `<div class="lista">
      ${sinGuardar ? fila('#/circular-institucional/nueva', normal({ ...sinGuardar.datos, consecutivo: '' }), 'Sin guardar · solo en este equipo · aún sin consecutivo') : ''}
      ${filas.map((f) => fila(`#/circular-institucional/${f.id}`, deFila(f),
        `Borrador · guardado ${esc(fechaHora(f.actualizado_en))} por ${esc(nombre(E.perfiles.get(f.actualizado_por || f.autor_id)))}`,
        leerLocal(f.id) ? ' · <b>con cambios sin guardar en este equipo</b>' : '')).join('')}
    </div>` : vacio('Aún no hay circulares institucionales en borrador.')}`;
}

// ---------------------------------------------------------------- Editor
export async function editor(m, p) {
  if (E.rol !== 'admin') return soloAdmin(m, 'Circular institucional');
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
  const [series, plantillas] = await Promise.all([
    E.db.select('circular_series', { eq: { colegio_id: E.colegio.id, vigente: true } }).catch(() => []),
    E.db.modo === 'demo' ? [] : E.db.select('circular_plantillas', { eq: { colegio_id: E.colegio.id, estado: 'aprobada' }, order: 'revision desc', limit: 1 }).catch(() => []),
  ]);
  let plantilla = plantillas[0] || null;
  const provisional = series[0]?.provisional !== false;
  // Estado del borrador en el servidor: id, versión con la que se abrió, lo último guardado y su consecutivo (fijo).
  // Uno nuevo lleva su identificador de creación, guardado con la copia del equipo: el reintento tras recargar es el mismo.
  const srv = { id: fila?.id || null, version: fila?.version || 0, datos: fila ? deFila(fila) : null, en: fila?.actualizado_en || null, consecutivo: fila?.consecutivo || fila?.datos?.consecutivo || '' };
  let llave = srv.id || 'nueva';
  let d = srv.datos || nuevaCircular();
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
        <label>Área que emite<input name="dependencia" list="circ-areas" maxlength="${LIMITES.dependencia}" placeholder="Ej.: Rectoría"><datalist id="circ-areas">${AREAS.map((a) => `<option value="${esc(a)}">`).join('')}</datalist></label>
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
        <label>Nombre de quien firma<input name="responsable" maxlength="${LIMITES.responsable}" placeholder="Nombre y apellidos"></label>
        <label>Cargo<input name="cargo" maxlength="${LIMITES.cargo}" placeholder="Ej.: Rector(a)"></label>
        <p class="ayuda">Como en el memo del colegio: «Cordialmente,», el nombre en mayúsculas, el cargo y el nombre del colegio (sin firma escaneada).</p>
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

  // ----- Pintar los datos en el formulario
  const poner = (x) => {
    for (const k of ['dependencia', 'destinatarios_otros', 'titulo', 'responsable', 'cargo']) form.elements[k].value = x[k];
    for (const cb of form.querySelectorAll('[name=destinatarios]')) cb.checked = x.destinatarios.includes(cb.value);
    ed.innerHTML = contenidoHTML(x.contenido);
  };
  poner(d);

  // ----- Leer el formulario
  const actual = () => {
    const f = leerForm(form);
    return normal({ ...f, consecutivo: srv.consecutivo, fecha_emision: d.fecha_emision, contenido: leerEditor(ed) });
  };

  let guardando = false, localT = null;
  const pintar = () => {
    const x = actual();
    $c('[data-fecha-txt]').textContent = fechaLarga(x.fecha_emision);
    $c('[data-hoy]').hidden = x.fecha_emision === hoyBogota();
    $c('[data-para-txt]').textContent = textoDestinatarios(x.destinatarios, x.destinatarios_otros) || '—';
    // Consecutivo: solo lectura; lo pone la base al guardar por primera vez
    $c('[data-consec]').value = srv.consecutivo;
    $c('[data-consec-ayuda]').textContent = (srv.consecutivo
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
  form.addEventListener('input', cambio);
  form.addEventListener('change', cambio);

  // El área sugiere el cargo (si el cargo está vacío o era la sugerencia del área anterior)
  let areaAntes = d.dependencia;
  form.elements.dependencia.addEventListener('change', () => {
    const area = form.elements.dependencia.value.trim();
    const cargo = form.elements.cargo;
    if (CARGO_DE_AREA[area] && (!cargo.value.trim() || cargo.value === CARGO_DE_AREA[areaAntes])) { cargo.value = CARGO_DE_AREA[area]; cambio(); }
    areaAntes = area;
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
    d = srv.datos || nuevaCircular();
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
        r = await E.db.rpc('crear_circular_borrador', { p_colegio: E.colegio.id, p_solicitud: srv.solicitud, p_datos: x });
        E.db.refrescar('circular_borradores');
        borrarLocal('nueva');
        llave = r.id;
        caja.dataset.id = r.id;
        $c('[data-ref]').textContent = referencia(r.id);
        history.replaceState(null, '', '#/circular-institucional/' + r.id);
      } else {
        [r] = await E.db.update('circular_borradores', { datos: x }, { id: srv.id, version: srv.version });
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
      html: `${falta ? `<div class="aviso-caja"><p>${esc(falta)}</p></div>` : ''}${vistaHTML(x, plantilla)}
        <p class="ayuda">Vista rápida para revisar el texto. El PDF de revisión usa el formato oficial del colegio (membrete, marca de agua y pie).</p>`,
      botones: [{ texto: 'Cerrar' }, { texto: 'PDF de revisión', valor: 'pdf' }],
    });
    if (r === 'pdf') pdfRevision();
  });
  const btnPdf = $c('[data-pdf]');
  const pdfRevision = async () => {
    const x = actual();
    const v = datosParaServidor(x);
    if (v.error) { aviso(v.error, 'error'); enfocar(v.campo); return; }
    if (E.db.modo === 'demo') {
      await ventana({ titulo: 'PDF de revisión', html: '<p>En el modo de prueba no hay servidor: el PDF de revisión se genera con la plantilla oficial del colegio cuando se usa la app con la cuenta del colegio.</p><p class="ayuda">Usa «Vista previa» para revisar el texto.</p>', botones: [{ texto: 'Entendido' }] });
      return;
    }
    btnPdf.disabled = true;
    const antes = btnPdf.textContent;
    btnPdf.textContent = 'Generando…';
    try {
      plantilla ??= (await E.db.select('circular_plantillas', { eq: { colegio_id: E.colegio.id, estado: 'aprobada' }, order: 'revision desc', limit: 1 }))[0];
      if (!plantilla) throw new Error('El colegio aún no tiene una plantilla institucional aprobada.');
      const t0 = performance.now();
      const pdf = await E.db.funcion('circular-documentos', { accion: 'previsualizar', colegio_id: E.colegio.id, plantilla_id: plantilla.id, datos: v.datos });
      if (!(pdf instanceof Blob) || !pdf.size) throw new Error('El servidor no devolvió el PDF. Intenta de nuevo.');
      const seg = ((performance.now() - t0) / 1000).toFixed(1).replace('.', ',');
      const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
      const archivo = `Circular_revision_${v.datos.fecha_emision}.pdf`;
      await ventana({
        titulo: 'PDF de revisión listo',
        html: `<p>Es una <b>vista previa</b> con el formato del colegio: no queda emitida y no se envía a nadie. ${srv.consecutivo ? `Lleva el consecutivo del borrador guardado (${esc(srv.consecutivo)}).` : 'Aún sin consecutivo: se asigna al guardar.'}</p>
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
    if (!(await confirmar('¿Eliminar el borrador?', `Se borra para todo el equipo de Administración. Su consecutivo${srv.consecutivo ? ` «${srv.consecutivo}»` : ''} queda anulado: no se vuelve a usar. No se puede deshacer.`, 'Eliminar'))) return;
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
function vistaHTML(x, plantilla) {
  const firma = plantilla?.configuracion?.firma;
  const colegio = (firma?.incluir_institucion !== false) ? (firma?.institucion_texto || E.colegio.nombre) : '';
  return `<div class="circ-hoja">
    <header class="circ-membrete">${logoHTML('circ-logo')}<b>${esc(E.colegio.nombre)}</b></header>
    <table class="circ-cuadro">
      <tr><td><b>Fecha:</b> ${esc(fechaLarga(x.fecha_emision))}</td><td><b>De:</b> ${esc(x.dependencia || '—')}</td></tr>
      <tr><td><b>Consecutivo:</b><br>${esc(x.consecutivo.trim() || SIN_NUMERO)}</td><td><b>Para:</b><br>${esc(textoDestinatarios(x.destinatarios, x.destinatarios_otros) || '—')}</td></tr>
    </table>
    <p class="circ-asunto"><b>Asunto:</b> <u>${esc(x.titulo || '—')}</u></p>
    <div class="circ-cuerpo">${contenidoHTML(x.contenido) || '<p class="ayuda">(sin contenido)</p>'}</div>
    <div class="circ-firma"><p>${esc(firma?.despedida ?? 'Cordialmente,')}</p><b>${esc((x.responsable || 'Nombre de quien firma').toLocaleUpperCase('es-CO'))}</b><span>${esc(x.cargo || 'Cargo')}</span>${colegio ? `<span>${esc(colegio)}</span>` : ''}</div>
    <p class="circ-marca">VISTA RÁPIDA · el PDF de revisión trae el membrete, la marca de agua y el pie del colegio</p>
  </div>`;
}
