// Enviar una circular institucional a la Bandeja de entrada (input de Fabio 3-nov-2026, puntos 1–3). Solo Administración.
//  1) A quién: roles (estudiantes, docentes…), alcance (todo el colegio, sedes, grados o cursos) y personas una por una.
//  2) Revisar: el SERVIDOR resuelve la audiencia (destinatarios únicos, excluidos con su causa) y prepara el PDF OFICIAL de la
//     versión guardada (lo guarda y registra su huella). Lo que se ve aquí es exactamente el archivo que recibirán.
//  3) Confirmar: una sola operación del servidor, todo o nada, que se puede repetir sin duplicar (mismo identificador). Si la
//     audiencia cambió desde la revisión, se muestra y se pide confirmar otra vez; si la circular cambió, se regenera el PDF.
//     Si la respuesta no llega (red), se CONSULTA el envío antes de repetirlo. El envío pendiente queda anotado en el equipo.
import { E, base, avisarPorCorreo } from '../estado.js';
import { esc, aviso, ventana, nombreLista, fechaHora } from '../ui.js';
import { icono } from '../iconos.js';

const GRUPOS = { estudiante: 'Estudiantes', profesor: 'Docentes', acudiente: 'Acudientes', director_seccion: 'Directores de sección', enfermeria: 'Enfermería', admin: 'Administración', individual: 'Elegidos uno por uno' };
const ALCANCE = { colegio: 'Todo el colegio', sede: 'Sedes', grado: 'Grados', curso: 'Cursos' };
const PENDIENTE = (borrador) => 'complex_envio_pendiente_' + borrador;
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const kb = (n) => `${Math.max(1, Math.round(n / 1024))} KB`;
const leer = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const anotar = (k, v) => { try { v ? localStorage.setItem(k, JSON.stringify(v)) : localStorage.removeItem(k); } catch { /* sin espacio: el servidor igual es idempotente */ } };
const incierto = (e) => /Failed to fetch|NetworkError|network|timeout|tardó|503|No se pudo confirmar/i.test(e?.message || '');

// Al abrir la circular: si un envío quedó sin respuesta en este equipo, se pregunta al servidor si se completó (nunca se repite a ciegas)
export async function revisarEnvioPendiente(borradorId) {
  const p = leer(PENDIENTE(borradorId));
  if (!p) return null;
  try {
    const r = await E.db.rpc('circular_envio_estado', { p_envio: p.envio });
    if (r) { anotar(PENDIENTE(borradorId), null); aviso(`El envío de esta circular sí se completó: ${r.en_bandeja} bandeja(s).`); return r; }
    if (Date.now() - p.en > 864e5) anotar(PENDIENTE(borradorId), null); // más de un día sin completarse: se descarta (nada se envió)
  } catch { /* sin conexión: se pregunta la próxima vez */ }
  return null;
}

// criterios: a quién (lo que se marcó en «¿Para quién?» de la circular, 3-nov-2026). Con ellos la ventana no vuelve a preguntar:
// revisa enseguida (audiencia del servidor + PDF oficial) y queda «Confirmar y enviar». Sin ellos, se eligen aquí como antes.
// Sin número todavía («número al emitir», input de Fabio 3-nov-2026 noche §9): tras confirmar, el SERVIDOR asigna el número de la
// serie elegida (circular_asignar_numero, una sola vez), después se genera el PDF final con ese número y se envía. Si algo falla
// después de numerar, la circular conserva su número y el reintento usa el mismo (nunca otro).
export async function enviarCircular({ borrador, plantilla, criterios: fijos = null, serie = null }) {
  if (!plantilla) { aviso('Esta circular no tiene un formato de PDF asignado: asígnalo antes de enviarla.', 'error'); return null; }
  borrador = { ...borrador };
  let porNumerar = !borrador.consecutivo, numerada = false, verMensaje = false;
  const b = await base();
  let personas = [];
  try { personas = await (E.db.rpcTodo || E.db.rpc).call(E.db, 'mis_contactos', { p_colegio: E.colegio.id }); } catch { /* sin la lista se puede enviar por roles */ }
  const unicas = [...new Map(personas.map((c) => [c.perfil_id, c])).values()].sort((x, y) => nombreLista(x).localeCompare(nombreLista(y)));
  const elegidas = new Map();
  const pend = leer(PENDIENTE(borrador.id));
  let envioId = pend && pend.version === borrador.version ? pend.envio : crypto.randomUUID();
  let revision = null; // { criterios, previa, sha, version }
  let resultado = null;
  const firmaOmitida = !!borrador.datos?.firmar && borrador.autor_id && borrador.autor_id !== E.yo.id;

  await ventana({
    titulo: borrador.consecutivo ? `Enviar ${borrador.consecutivo}` : 'Enviar la circular',
    html: `<div class="form" data-envio>
      ${fijos ? '' : `<fieldset><legend>¿A quién?</legend>
        ${Object.entries(GRUPOS).filter(([k]) => k !== 'individual').map(([k, t]) => `<label class="check"><input type="checkbox" name="rol" value="${k}"> ${t}</label>`).join('')}
      </fieldset>
      <label>Alcance<select data-alcance>${Object.entries(ALCANCE).map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select></label>
      <div class="envio-alcance" data-items hidden></div>
      <p class="ayuda" data-nota-alcance hidden>Con sedes, grados o cursos se envía a estudiantes, docentes o acudientes de allí; al personal de apoyo agrégalo por persona.</p>
      <details><summary>Agregar personas una por una</summary>
        <input type="search" data-buscar-persona placeholder="Buscar persona…" aria-label="Buscar persona">
        <div class="lista" data-resultados></div>
      </details>
      <p data-elegidas class="ayuda"></p>
      <div class="circ-acciones"><button type="button" class="btn btn-primario" data-revisar>Revisar el envío</button></div>`}
      <div class="envio-paso" data-paso2 ${fijos ? '' : 'hidden'}>
        <div data-resumen role="status" aria-live="polite">${fijos ? '<p class="ayuda">Calculando a quién llega y preparando el PDF oficial…</p>' : ''}</div>
        <div data-pdf></div>
        <div class="circ-acciones">${fijos ? `<button type="button" class="btn" data-revisar hidden>${icono('actualizar')}Volver a revisar</button>` : ''}<button type="button" class="btn btn-primario" data-confirmar disabled>Confirmar y enviar</button></div>
      </div>
      <div class="envio-paso" data-resultado hidden role="status" aria-live="polite"></div>
    </div>`,
    alAbrir: (caja) => {
      const $ = (s) => caja.querySelector(s);
      const btnRev = $('[data-revisar]'), btnConf = $('[data-confirmar]');
      // Cambiar la selección (o la circular) invalida la revisión: hay que revisar de nuevo antes de confirmar
      const invalidar = () => { revision = null; btnConf.disabled = true; if (fijos) btnRev.hidden = false; else $('[data-paso2]').hidden = true; };
      let criterios = () => fijos;
      if (!fijos) {
        const alcance = $('[data-alcance]'), items = $('[data-items]');
        const pintarItems = () => {
          const a = alcance.value, lista = a === 'sede' ? b.sedes : a === 'grado' ? b.grados : a === 'curso' ? b.cursos : [];
          items.hidden = a === 'colegio'; $('[data-nota-alcance]').hidden = a === 'colegio';
          items.innerHTML = lista.map((x) => `<label class="check"><input type="checkbox" name="item" value="${x.id}"> ${esc(x.nombre)}</label>`).join('') || '<p class="ayuda">No hay opciones.</p>';
          caja.querySelectorAll('[name=rol]').forEach((r) => { r.disabled = a !== 'colegio' && !['estudiante', 'profesor', 'acudiente'].includes(r.value); if (r.disabled) r.checked = false; });
          invalidar();
        };
        const pintarElegidas = () => {
          $('[data-elegidas]').innerHTML = elegidas.size ? 'Además: ' + [...elegidas.values()].map((c) => `<span class="chip">${esc(nombreLista(c))} <button type="button" data-quitar="${c.perfil_id}" aria-label="Quitar">×</button></span>`).join(' ') : '';
          caja.querySelectorAll('[data-quitar]').forEach((x) => (x.onclick = () => { elegidas.delete(x.dataset.quitar); pintarElegidas(); invalidar(); }));
        };
        alcance.onchange = pintarItems;
        caja.addEventListener('change', (e) => { if (e.target.matches('[name=rol], [name=item]')) invalidar(); });
        $('[data-buscar-persona]').oninput = (e) => {
          const q = e.target.value.trim().toLowerCase();
          const res = q.length < 2 ? [] : unicas.filter((c) => `${c.nombres} ${c.apellidos} ${c.grupo} ${c.detalle || ''}`.toLowerCase().includes(q)).slice(0, 20);
          $('[data-resultados]').innerHTML = res.map((c) => `<button type="button" class="fila fila-boton" data-persona="${c.perfil_id}"><span><b>${esc(nombreLista(c))}</b><small>${esc(c.grupo)}</small></span></button>`).join('')
            || (q.length >= 2 ? '<p class="ayuda">Nadie con ese nombre.</p>' : '');
          caja.querySelectorAll('[data-persona]').forEach((x) => (x.onclick = () => { elegidas.set(x.dataset.persona, unicas.find((c) => c.perfil_id === x.dataset.persona)); pintarElegidas(); invalidar(); }));
        };
        pintarItems();
        criterios = () => ({ roles: [...caja.querySelectorAll('[name=rol]:checked')].map((x) => x.value), alcance: alcance.value,
          ids: alcance.value === 'colegio' ? [] : [...caja.querySelectorAll('[name=item]:checked')].map((x) => x.value), personas: [...elegidas.keys()] });
      }
      const resumenHTML = (pv) => `<p><b>${pv.total}</b> destinatario(s) únicos${Object.keys(pv.por_grupo || {}).length ? ': ' + Object.entries(pv.por_grupo).map(([k, v]) => `${esc(GRUPOS[k] || k)} ${v}`).join(' · ') : ''}.</p>
        ${pv.excluidos ? `<details><summary>${pv.excluidos} no la recibirán: ${Object.entries(pv.motivos).map(([k, v]) => `${esc(k)} (${v})`).join(' · ')}</summary>
          <div class="lista">${(pv.excluidos_detalle || []).map((x) => `<div class="fila"><span class="crece">${esc(x.nombre)}</span><small>${esc(x.motivo)}</small></div>`).join('')}</div></details>` : ''}
        <p class="ayuda">Calculado por el servidor ${esc(fechaHora(pv.calculado_en))}. Una persona elegida por varias vías recibe una sola.</p>`;

      // ---- El PDF oficial de la versión guardada (con su número): lo genera y guarda el servidor para ESTE envío
      const prepararPdf = async () => {
        $('[data-pdf]').innerHTML = '<p class="ayuda">Generando el PDF oficial…</p>';
        const pdf = await E.db.funcion('circular-documentos', { accion: 'preparar_envio', colegio_id: E.colegio.id, plantilla_id: plantilla.id, borrador_id: borrador.id, version: borrador.version, envio_id: envioId });
        if (!(pdf instanceof Blob) || !pdf.size) throw new Error('El servidor no devolvió el PDF. No se envió nada; intenta de nuevo.');
        const sha = hex(await crypto.subtle.digest('SHA-256', await pdf.arrayBuffer()));
        const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
        Object.assign(revision, { sha, version: borrador.version });
        anotar(PENDIENTE(borrador.id), { envio: envioId, version: borrador.version, en: Date.now() });
        $('[data-pdf]').innerHTML = `<p data-pdf-envio>PDF oficial de la <b>versión ${borrador.version}</b>, con el número <b>${esc(borrador.consecutivo)}</b> · ${kb(pdf.size)} · huella <code>${esc(sha.slice(0, 16))}…</code>. Es el archivo que recibirán.</p>
          ${firmaOmitida ? '<p class="aviso-caja">Esta circular pedía la firma de quien la preparó; como la envía otra persona, el PDF va sin imagen de firma (con el nombre escrito).</p>' : ''}
          <div class="circ-acciones"><a class="btn" href="${url}" target="_blank" rel="noopener">${icono('abrir')}Abrir</a><a class="btn" href="${url}" download="${esc(borrador.consecutivo)}.pdf">${icono('descargar')}Descargar</a></div>`;
      };
      // ---- Revisar: audiencia del servidor + PDF oficial de la versión guardada (si ya tiene número)
      btnRev.onclick = async () => {
        const c = criterios();
        if (!c.roles.length && !c.personas.length) return aviso('Elige a quién enviar.', 'error');
        if (c.alcance !== 'colegio' && !c.ids.length) return aviso('Elige al menos una opción del alcance.', 'error');
        btnRev.disabled = true; btnRev.textContent = 'Revisando…'; invalidar();
        if (fijos) { btnRev.hidden = true; $('[data-resumen]').innerHTML = '<p class="ayuda">Calculando a quién llega y preparando el PDF oficial…</p>'; $('[data-pdf]').innerHTML = ''; }
        try {
          const pv = await E.db.rpc('audiencia_previa', { p_colegio: E.colegio.id, p_criterios: c });
          $('[data-paso2]').hidden = false;
          $('[data-resumen]').innerHTML = resumenHTML(pv);
          if (!pv.total) { $('[data-pdf]').innerHTML = ''; return; }
          revision = { criterios: c, previa: pv, sha: null, version: borrador.version };
          if (porNumerar) {
            // Sin número: NO se reserva al revisar (cancelar no gasta números); se asigna al confirmar y el PDF sale con él
            $('[data-pdf]').innerHTML = `<p data-pdf-envio>Número: <b>se asigna al confirmar</b>${serie?.siguiente ? ` (estimado <b>${esc(serie.siguiente)}</b>, serie ${esc(serie.prefijo.trim())}; no está reservado)` : ''}. Enseguida se genera el PDF oficial con ese número y se entrega.</p>
              <p class="ayuda">El contenido es el de la versión ${borrador.version} guardada (el que viste en «Ver PDF»). Si algo falla después de numerar, la circular conserva su número y el reintento usa el mismo.</p>`;
          } else await prepararPdf();
          btnConf.textContent = `Confirmar y enviar a ${pv.total}`;
          btnConf.disabled = false;
        } catch (e) {
          $('[data-pdf]').innerHTML = `<p class="error" data-error-envio>${esc(e.message)}</p><p class="ayuda">No se envió nada. El borrador sigue guardado.</p>`;
          if (fijos) btnRev.hidden = false;
        } finally { btnRev.disabled = false; btnRev.textContent = fijos ? 'Volver a revisar' : 'Revisar el envío'; }
      };

      // ---- Confirmar: todo o nada, sin duplicar; ante una respuesta perdida, se consulta antes de repetir
      btnConf.onclick = async () => {
        if (!revision) return;
        btnConf.disabled = true;
        // Sin número (o sin PDF de esta versión): número oficial UNA vez en el servidor → PDF final con ese número → envío
        if (porNumerar || !revision.sha) {
          try {
            if (porNumerar) {
              btnConf.textContent = 'Asignando el número…';
              const n = await E.db.rpc('circular_asignar_numero', { p_borrador: borrador.id, p_version: borrador.version });
              Object.assign(borrador, { consecutivo: n.consecutivo, version: n.version });
              porNumerar = false; numerada = true;
            }
            btnConf.textContent = 'Generando el PDF…';
            await prepararPdf();
          } catch (e) {
            $('[data-pdf]').insertAdjacentHTML('beforeend', `<p class="error" data-error-envio>${esc(e.message)}</p><p class="ayuda">No se envió nada. ${numerada ? `La circular conserva su número ${esc(borrador.consecutivo)}: al reintentar se usa el mismo.` : 'No se gastó ningún número.'}</p>`);
            btnConf.disabled = false; btnConf.textContent = `Reintentar: enviar a ${revision.previa.total}`;
            return;
          }
        }
        btnConf.textContent = 'Enviando…';
        const pedido = { p_envio: envioId, p_borrador: borrador.id, p_version: revision.version, p_sha256: revision.sha, p_criterios: revision.criterios, p_huella: revision.previa.huella };
        let r = null;
        try { r = await E.db.rpc('circular_enviar', pedido); }
        catch (e) {
          if (incierto(e)) r = await E.db.rpc('circular_envio_estado', { p_envio: envioId }).catch(() => null);
          if (!r) {
            if (/cambió desde la revisión/.test(e.message)) { // la audiencia cambió: se muestra la nueva y se pide confirmar otra vez
              try { const pv = await E.db.rpc('audiencia_previa', { p_colegio: E.colegio.id, p_criterios: revision.criterios }); revision.previa = pv; $('[data-resumen]').innerHTML = `<p class="aviso-caja">${esc(e.message)}</p>` + resumenHTML(pv); btnConf.textContent = `Confirmar y enviar a ${pv.total}`; btnConf.disabled = !pv.total; }
              catch (e2) { aviso(e2.message, 'error'); }
              return;
            }
            if (/cambió después de generar el PDF|Falta el PDF|no quedó guardado/.test(e.message)) { invalidar(); aviso(e.message + ' Revisa el envío otra vez.', 'error'); return; }
            btnConf.disabled = false; btnConf.textContent = `Confirmar y enviar a ${revision.previa.total}`;
            aviso((incierto(e) ? 'No hubo respuesta y el envío no aparece en el servidor: puedes reintentar sin duplicar. ' : '') + e.message, 'error');
            return;
          }
        }
        resultado = r;
        anotar(PENDIENTE(borrador.id), null);
        avisarPorCorreo('mensaje', envioId);
        E.db.refrescar?.('circular_borradores');
        caja.querySelectorAll('input, select, [data-revisar]').forEach((x) => (x.disabled = true));
        $('[data-paso2]').hidden = true;
        $('[data-resultado]').hidden = false;
        $('[data-resultado]').innerHTML = `<p class="ok"><b>✓ Enviada.</b> Llegó a <b>${r.en_bandeja}</b> bandeja(s) de entrada (${r.total_previsto} previstas)${r.repetido ? ' — ya se había enviado; no se repitió' : ''}.</p>
          ${r.total_excluido ? `<p class="ayuda">${r.total_excluido} no la recibieron: ${Object.entries(r.motivos || {}).map(([k, v]) => `${esc(k)} (${v})`).join(' · ')}</p>` : ''}
          <p><a class="btn btn-primario" href="#/mensaje/${r.mensaje_id}" data-ver-envio>${icono('ver')}Ver el mensaje enviado</a></p>`;
        caja.querySelector('[data-ver-envio]').onclick = () => { verMensaje = true; document.querySelector('.ventana [data-cerrar], .ventana-pie button')?.click(); };
      };
      if (fijos) btnRev.onclick(); // ya se sabe a quién: se revisa enseguida
    },
    botones: [{ texto: 'Cerrar' }],
  });
  // Enviada (verMensaje: se fue a «Ver el mensaje enviado»), o numerada aunque no se haya terminado de enviar: la circular cambió
  // de versión y el editor se vuelve a abrir
  return resultado ? { ...resultado, verMensaje } : numerada ? { numerada: true, consecutivo: borrador.consecutivo } : null;
}
