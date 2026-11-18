// Manual de Convivencia (Fabio, 18-nov-2026): el documento institucional del colegio, para que lo que describe el docente en un
// llamado de atención quede SUSTENTADO por el manual. Lo consulta toda la comunidad. El texto (artículos y faltas) vive solo en la
// base del colegio (supabase/migrations/20261118100000_manual_convivencia.sql); el PDF es un archivo privado (enlace firmado).
//  · manual(m): índice por capítulos, buscador en el texto, faltas por gravedad y el PDF.
//  · selector de falta para el «Llamado de atención» (familia.js): elegir la falta es obligatorio; la cita la arma el servidor.
import { E } from '../estado.js';
import { esc, aviso, ventana, confirmar, vacio } from '../ui.js';
import { cabecera } from './comun.js';

export const GRAVEDAD = { leve: 'Leve', grave: 'Grave', muy_grave: 'Muy grave' };
const ICONO_G = { leve: '🟡', grave: '🟠', muy_grave: '🔴' };
const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const peso = (n) => (n == null ? '' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export const estadoManual = () => E.db.rpc('manual_estado', { p_colegio: E.colegio.id });

// «Art. 70 · Leve · A. Cuidado de sí mismo · num. 1 · Puntualidad»
export const rotuloFalta = (f) => [`Art. ${f.articulo}`, GRAVEDAD[f.gravedad], f.ambito, f.numeral && f.numeral !== '•' ? `num. ${f.numeral}` : '', f.titulo].filter(Boolean).join(' · ');

// La cita guardada en un registro (texto literal del manual como estaba al escribirlo)
export function citaHTML(c) {
  if (!c) return '';
  return `<details class="cita-manual"><summary>📘 <b>${esc(rotuloFalta(c))}</b> <small>${esc(c.manual || '')} ${esc(c.vigencia || '')}</small></summary>
    <blockquote>${esc(c.texto)}</blockquote></details>`;
}

async function abrirPDF(arch) {
  const w = E.db.modo === 'demo' ? null : window.open('', '_blank');
  try {
    const url = await E.db.urlArchivo('archivos', arch.ruta);
    if (E.db.modo === 'demo') { const a = document.createElement('a'); a.href = url; a.download = arch.nombre || 'manual.pdf'; document.body.appendChild(a); a.click(); a.remove(); }
    else if (w) w.location = url; else location.href = url;
  } catch (e) { w?.close(); aviso(e.message, 'error'); }
}

async function verArticulo(orden) {
  const x = await E.db.rpc('manual_articulo', { p_colegio: E.colegio.id, p_orden: Number(orden) });
  const titulo = x.anexo != null ? `Anexo ${x.anexo} · ${x.titulo}` : `Artículo ${x.numero}${x.titulo ? ' · ' + x.titulo : ''}`;
  const pag = x.pagina_desde ? `Página${x.pagina_hasta && x.pagina_hasta !== x.pagina_desde ? `s ${x.pagina_desde}–${x.pagina_hasta}` : ` ${x.pagina_desde}`} del manual` : '';
  await ventana({ titulo, html: `<p class="ayuda">${esc(x.capitulo)}${pag ? ' · ' + esc(pag) : ''}</p><div class="texto-manual">${esc(x.texto).replace(/\n/g, '<br>')}</div>`, botones: [{ texto: 'Cerrar' }] });
}

// ---------------------------------------------------------------- Pantalla
export async function manual(m) {
  const st = await estadoManual();
  const man = st.manual;
  const acciones = st.admin ? '<button class="btn" data-cargar>Cargar versión</button>' : '';
  if (!man) {
    m.innerHTML = cabecera('Manual de Convivencia', { acciones }) + vacio(st.admin
      ? 'El colegio aún no tiene su Manual de Convivencia en nodo. Con «Cargar versión» subes el manual preparado (artículos y faltas). Mientras no esté, los llamados de atención se registran como antes.'
      : 'El colegio aún no ha cargado su Manual de Convivencia.');
    conectarAdmin(m, st);
    return;
  }
  const porCap = new Map();
  for (const a of st.indice) { if (!porCap.has(a.capitulo)) porCap.set(a.capitulo, []); porCap.get(a.capitulo).push(a); }
  const fila = (a) => `<button class="fila fila-boton" data-art="${a.orden}"><span class="num">${a.anexo != null ? 'A' + a.anexo : a.numero ?? ''}</span><span class="crece"><b>${esc(a.titulo || (a.anexo != null ? 'Anexo ' + a.anexo : 'Artículo ' + a.numero))}</b>${a.pagina_desde ? `<small>Pág. ${a.pagina_desde}${a.pagina_hasta && a.pagina_hasta !== a.pagina_desde ? '–' + a.pagina_hasta : ''}</small>` : ''}</span><span class="flecha">›</span></button>`;
  const grupos = ['leve', 'grave', 'muy_grave'].map((g) => [g, st.faltas.filter((f) => f.gravedad === g)]).filter(([, l]) => l.length);
  m.innerHTML = cabecera('Manual de Convivencia', { acciones: (man.archivo ? '<button class="btn" data-pdf>📄 Ver PDF</button>' : '') + acciones }) + `
    <p class="ayuda"><b>${esc(man.titulo)}</b> · ${esc(man.vigencia)}${man.archivo ? ` · PDF ${esc(peso(man.archivo.bytes))}` : ''}. Cada llamado de atención cita la falta de este manual que lo sustenta.</p>
    <input class="buscador" type="search" data-buscar placeholder="Buscar en el manual (ej. celular, uniforme, debido proceso)…" aria-label="Buscar en el manual">
    <div data-resultados></div>
    <section class="tarjeta" data-faltas><h2>Faltas</h2>
      ${grupos.map(([g, l]) => `<details class="grupo-faltas"><summary>${ICONO_G[g]} <b>Faltas ${GRAVEDAD[g].toLowerCase()}s</b> <small>Art. ${[...new Set(l.map((f) => f.articulo))].join(', ')} · ${l.length}</small></summary>
        <div class="lista">${l.map((f) => `<details class="falta-manual"><summary>${esc([f.ambito, f.numeral && f.numeral !== '•' ? 'num. ' + f.numeral : '', f.titulo].filter(Boolean).join(' · '))}</summary><blockquote>${esc(f.texto)}</blockquote></details>`).join('')}</div>
        ${st.pasos_texto?.[g] ? `<p><button class="btn btn-chico" data-pasos="${g}">Qué hacer ante una falta ${GRAVEDAD[g].toLowerCase()} (Art. ${st.pasos_texto[g].numero})</button></p>` : ''}</details>`).join('')}
    </section>
    <section class="tarjeta"><h2>Contenido</h2>
      ${[...porCap].map(([cap, l]) => `<details class="capitulo-manual"><summary><b>${esc(cap)}</b> <small>${l.length}</small></summary><div class="lista">${l.map(fila).join('')}</div></details>`).join('')}
    </section>`;
  m.querySelector('[data-pdf]')?.addEventListener('click', () => abrirPDF(man.archivo));
  m.addEventListener('click', (e) => {
    const b = e.target.closest('[data-art]');
    if (b) verArticulo(b.dataset.art).catch((err) => aviso(err.message, 'error'));
    const p = e.target.closest('[data-pasos]');
    if (p) { const x = st.pasos_texto[p.dataset.pasos]; ventana({ titulo: `Artículo ${x.numero} · ${x.titulo}`, html: `<div class="texto-manual">${esc(x.texto).replace(/\n/g, '<br>')}</div>`, botones: [{ texto: 'Cerrar' }] }); }
  });
  const caja = m.querySelector('[data-resultados]');
  let turno = 0, espera = null;
  m.querySelector('[data-buscar]').addEventListener('input', (e) => {
    clearTimeout(espera);
    const q = e.target.value.trim();
    if (q.length < 3) { caja.innerHTML = q ? '<p class="ayuda">Escribe al menos 3 letras.</p>' : ''; return; }
    espera = setTimeout(async () => {
      const yo = ++turno;
      try {
        const r = await E.db.rpc('manual_buscar', { p_colegio: E.colegio.id, p_q: q });
        if (yo !== turno) return;
        const marca = (t) => { const i = sinTildes(t).indexOf(sinTildes(q)); return i < 0 ? esc(t) : esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length)); };
        caja.innerHTML = r.length ? `<section class="tarjeta"><h2>${r.length}${r.length === 60 ? '+' : ''} resultado(s)</h2><div class="lista">${r.map((a) => `<button class="fila fila-boton" data-art="${a.orden}"><span class="num">${a.anexo != null ? 'A' + a.anexo : a.numero ?? ''}</span><span class="crece"><b>${esc(a.titulo)}</b><small>…${marca(a.fragmento)}…</small></span><span class="flecha">›</span></button>`).join('')}</div></section>`
          : '<p class="ayuda">No aparece en el manual.</p>';
      } catch (err) { if (yo === turno) caja.innerHTML = `<p class="ayuda">${esc(err.message)}</p>`; }
    }, 300);
  });
  conectarAdmin(m, st);
}

// Administrador: cargar una versión (archivo .json con artículos y faltas) y subir el PDF
function conectarAdmin(m, st) {
  m.querySelector('[data-cargar]')?.addEventListener('click', async () => {
    const r = await ventana({
      titulo: 'Cargar versión del manual',
      html: `<div class="form"><p class="ayuda">Sube el manual preparado (.json con sus artículos y faltas, texto literal). La versión anterior deja de estar vigente pero no se borra: los llamados que ya la citaron la siguen mostrando tal como era.</p>
        <label>Manual preparado (.json)<input type="file" name="json" accept="application/json,.json"></label>
        <label>PDF del manual (opcional)<input type="file" name="pdf" accept="application/pdf,.pdf"></label>
        <div data-vista class="ayuda"></div></div>`,
      alAbrir: (caja) => {
        caja.querySelector('[name=json]').onchange = async (e) => {
          const v = caja.querySelector('[data-vista]');
          try { const d = JSON.parse(await e.target.files[0].text()); v.textContent = `${d.titulo || 'Manual'} ${d.vigencia || ''}: ${d.articulos?.length || 0} artículos, ${d.anexos?.length || 0} anexos, ${d.faltas?.length || 0} faltas.`; }
          catch { v.textContent = 'Ese archivo no es un manual preparado (.json).'; }
        };
      },
      botones: [{ texto: 'Cancelar' }, { texto: 'Cargar', antes: async (caja) => {
        const fj = caja.querySelector('[name=json]').files[0], fp = caja.querySelector('[name=pdf]').files[0];
        if (!fj && !fp) throw new Error('Elige el manual preparado (.json) o el PDF.');
        if (!fj && !st.manual) throw new Error('Primero carga el manual preparado (.json).');
        if (fp && fp.type && fp.type !== 'application/pdf') throw new Error('El archivo del manual debe ser PDF.');
        let datos = null;
        if (fj) { try { datos = JSON.parse(await fj.text()); } catch { throw new Error('Ese archivo no es un manual preparado (.json).'); } }
        if (datos && st.manual && !(await confirmar('¿Cargar una versión nueva?', `La versión vigente (${st.manual.titulo} ${st.manual.vigencia}) dejará de usarse para los llamados nuevos.`, 'Cargar'))) return false;
        if (datos) await E.db.rpc('manual_cargar', { p_colegio: E.colegio.id, p_datos: datos });
        if (fp) {
          const ruta = `${E.colegio.id}/manual_convivencia_${Date.now()}.pdf`;
          await E.db.subirArchivo('archivos', ruta, fp);
          const est = await estadoManual();
          const [a] = await E.db.insert('archivos', [{ colegio_id: E.colegio.id, carpeta: 'Manual de Convivencia', nombre: `${est.manual.titulo} ${est.manual.vigencia}.pdf`, descripcion: 'Documento institucional', ruta, tipo: 'application/pdf', bytes: fp.size, roles: null, subido_por: E.yo.id }]);
          await E.db.rpc('manual_vincular_pdf', { p_colegio: E.colegio.id, p_archivo: a.id });
        }
        return true;
      } }],
    });
    if (r) { aviso('Manual de Convivencia actualizado'); manual(m); }
  });
}

// ---------------------------------------------------------------- Selector para el llamado de atención (familia.js)
// HTML del bloque «Sustento en el Manual de Convivencia»; queda oculto si el tipo no es «Llamado de atención»
export function selectorHTML(st) {
  if (!st?.manual) return '';
  return `<fieldset class="sustento-manual" data-sustento hidden>
    <legend>Sustento en el Manual de Convivencia *</legend>
    <p class="ayuda">Elige la falta del ${esc(st.manual.titulo)} ${esc(st.manual.vigencia)} que sustenta lo que describes. Se guarda con su texto exacto.</p>
    <div class="chips" data-grav>${['', 'leve', 'grave', 'muy_grave'].map((g) => `<button type="button" class="chip ${g ? '' : 'ok'}" data-g="${g}">${g ? ICONO_G[g] + ' ' + GRAVEDAD[g] : 'Todas'}</button>`).join('')}</div>
    <input type="search" class="buscador" data-buscar-falta placeholder="Buscar la falta (ej. puntualidad, celular, uniforme)…" aria-label="Buscar la falta">
    <div class="lista lista-faltas" data-lista-faltas role="radiogroup" aria-label="Faltas del manual"></div>
    <div data-elegida></div>
  </fieldset>`;
}

// previos: llamados de atención anteriores del estudiante (para detectar reincidencia en la misma falta)
export function conectarSelector(caja, st, previos, alCambiar) {
  const fs = caja.querySelector('[data-sustento]');
  if (!fs) return { elegida: () => null };
  let g = '', q = '', elegida = null;
  const lista = fs.querySelector('[data-lista-faltas]');
  const pintar = () => {
    const qs = sinTildes(q);
    const l = st.faltas.filter((f) => (!g || f.gravedad === g) && (!qs || sinTildes(`${f.titulo} ${f.ambito} ${f.texto}`).includes(qs)));
    lista.innerHTML = l.length ? l.map((f) => `<label class="fila falta-opcion ${elegida?.id === f.id ? 'elegida' : ''}"><input type="radio" name="falta_manual" value="${f.id}" ${elegida?.id === f.id ? 'checked' : ''}>
      <span class="crece"><b>${ICONO_G[f.gravedad]} ${esc(f.titulo)}</b><small>${esc(`Art. ${f.articulo} · ${GRAVEDAD[f.gravedad]} · ${f.ambito}${f.numeral && f.numeral !== '•' ? ' · num. ' + f.numeral : ''}`)}</small></span></label>`).join('')
      : '<p class="ayuda">Ninguna falta coincide.</p>';
  };
  const pintarElegida = () => {
    const box = fs.querySelector('[data-elegida]');
    if (!elegida) { box.innerHTML = ''; return; }
    const reinc = previos.filter((o) => o.manual_cita && o.manual_cita.articulo === elegida.articulo && o.manual_cita.titulo === elegida.titulo && o.manual_cita.numeral === elegida.numeral).length;
    const pasos = st.pasos_texto?.[elegida.gravedad];
    const visible = caja.querySelector('[name=visible_acudiente]')?.checked;
    box.innerHTML = `<div class="cita-elegida">
      <p><b>📘 ${esc(rotuloFalta(elegida))}</b></p><blockquote>${esc(elegida.texto)}</blockquote>
      ${pasos ? `<details><summary>Qué dice el manual que sigue (Art. ${pasos.numero})</summary><div class="texto-manual">${esc(pasos.texto).replace(/\n/g, '<br>')}</div></details>` : ''}
      ${elegida.gravedad !== 'leve' ? `<p class="aviso-manual">🔔 Al guardar, le llega un aviso al Director de Sección del estudiante (falta ${GRAVEDAD[elegida.gravedad].toLowerCase()}).</p>` : ''}
      ${elegida.gravedad === 'leve' && reinc ? `<p class="aviso-manual">⚠️ El estudiante ya tiene ${reinc} llamado(s) de atención por esta misma falta: es reincidencia.</p>
        <label class="fila-check"><input type="checkbox" name="avisar_familia" ${visible ? 'checked' : 'disabled'}> <span><b>Avisar a la familia con copia a la Dirección de Sección</b><small>${visible ? 'Les llega un mensaje con la falta y lo que describes.' : 'Para avisar a la familia, marca «Visible para el estudiante y su acudiente».'}</small></span></label>` : ''}
    </div>`;
  };
  fs.querySelector('[data-grav]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    g = b.dataset.g; fs.querySelectorAll('[data-g]').forEach((x) => x.classList.toggle('ok', x === b)); pintar();
  });
  fs.querySelector('[data-buscar-falta]').addEventListener('input', (e) => { q = e.target.value; pintar(); });
  lista.addEventListener('change', (e) => {
    if (e.target.name !== 'falta_manual') return;
    elegida = st.faltas.find((f) => f.id === e.target.value) || null;
    lista.querySelectorAll('.falta-opcion').forEach((x) => x.classList.toggle('elegida', x.querySelector('input').checked));
    pintarElegida(); alCambiar?.();
  });
  caja.querySelector('[name=visible_acudiente]')?.addEventListener('change', pintarElegida);
  pintar();
  return {
    elegida: () => elegida,
    avisarFamilia: () => !!caja.querySelector('[name=avisar_familia]:checked'),
    mostrar: (si) => { fs.hidden = !si; },
  };
}
