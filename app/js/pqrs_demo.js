// PQRS en el modo demo (datos ficticios en el equipo). Copia las funciones de la base (20261028200000_pqrs.sql) con las mismas
// reglas, permisos y mensajes, y usa el mismo clasificador (pqrs_reglas.js). Los avisos llegan a la Mensajería del demo.
// En el demo algunas áreas ya tienen responsables (personas ficticias) para poder probar; las secciones quedan sin grados
// (el administrador los marca, igual que en el colegio real).
import { AREAS, analizar, decidir, motivos as motivosDe, estadoGeneral, TIPOS } from './pqrs_reglas.js';
import { verificarFirma } from './pqrs_firma.js';
// Desde el 29-oct también la conversación con adjuntos (20261029120000_pqrs_conversacion.sql): adjuntos en cuarentena, envío con
// adjuntos todo o nada, hilo paginado y avisos agrupados. En el demo los archivos quedan en este navegador y la verificación del
// formato (que en la base hace la Edge Function pqrs-adjuntos) se hace aquí mismo con la misma función (pqrs_firma.js).

const ESTADO_TXT = { pendiente_clasificacion: 'Pendiente de clasificación', pendiente: 'Pendiente', en_atencion: 'En atención', respuesta_parcial: 'Respuesta parcial', respondida: 'Respondida', cerrada: 'Cerrada' };
const PERSONAL = ['admin', 'profesor', 'enfermeria', 'director_seccion'];

export function crearPqrsDemo({ tabla, usuario, guardar, copia, ahora, err, archivo = () => null }) {
  const T = (n) => tabla(n);
  const yo = () => usuario();
  const miembroActivo = (c, p) => T('miembros').some((m) => m.colegio_id === c && m.perfil_id === p && m.activo !== false);
  const esMiembro = (c) => miembroActivo(c, yo());
  const esAdmin = (c, p = yo()) => T('miembros').some((m) => m.colegio_id === c && m.perfil_id === p && m.rol === 'admin' && m.activo !== false);
  const nombreDe = (p) => { const x = T('perfiles').find((y) => y.id === p); return x ? (`${x.nombres || ''} ${x.apellidos || ''}`.trim() || 'Sin nombre') : null; };
  const area = (id) => T('pqrs_areas').find((a) => a.id === id);
  const areaClave = (c, clave) => T('pqrs_areas').find((a) => a.colegio_id === c && a.clave === clave);
  const orden = (a) => a.orden;
  const responsables = (areaId) => T('pqrs_area_responsables').filter((r) => r.area_id === areaId).map((r) => r.perfil_id);
  const asign = (pid) => T('pqrs_asignaciones').filter((a) => a.pqrs_id === pid);
  const activas = (pid) => asign(pid).filter((a) => a.activa);
  const caso = (pid) => T('pqrs').find((p) => p.id === pid);
  const fallo = (m) => err(m);

  const preparar = (c) => {
    if (T('pqrs_areas').some((a) => a.colegio_id === c)) return;
    AREAS.forEach((a, i) => T('pqrs_areas').push({ id: crypto.randomUUID(), colegio_id: c, clave: a.clave, nombre: a.nombre, orden: i + 1, grados: [], activo: true, creado_en: ahora() }));
    // Responsables ficticios del demo (por nombre de la semilla): así se puede probar el recorrido completo
    const porNombre = (n) => T('perfiles').find((p) => p.nombres === n && miembroActivo(c, p.id))?.id;
    for (const [clave, quien] of [['transporte', 'Jorge'], ['tecnologia', 'Jorge'], ['finanzas', 'Luisa'], ['alimentacion', 'Carlos'], ['servicios_generales', 'Carlos'], ['enfermeria', 'Rosa']]) {
      const p = porNombre(quien), a = areaClave(c, clave);
      if (p && a) T('pqrs_area_responsables').push({ colegio_id: c, area_id: a.id, perfil_id: p, asignado_por: null, asignado_en: ahora() });
    }
  };
  const tipoMensaje = (c) => {
    let t = T('tipos_mensaje').find((x) => x.colegio_id === c && x.nombre === 'PQRS');
    if (!t) T('tipos_mensaje').push((t = { id: crypto.randomUUID(), colegio_id: c, nombre: 'PQRS', color: '#b45309', roles: ['admin'], permite_respuesta: false, numerar: false, consecutivo: 0, orden: 90, activo: true }));
    return t.activo ? t.id : null;
  };
  const consecutivo = (c) => {
    const periodo = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric' }).format(new Date());
    let s = T('pqrs_series').find((x) => x.colegio_id === c && x.periodo === periodo);
    if (!s) T('pqrs_series').push((s = { id: crypto.randomUUID(), colegio_id: c, prefijo: 'PQRS-', periodo, ancho: 4, ultimo: 0, provisional: true, creado_en: ahora() }));
    s.ultimo += 1;
    const n = String(s.ultimo);
    return { serie_id: s.id, numero: s.ultimo, consecutivo: s.prefijo + (n.length >= s.ancho ? n : n.padStart(s.ancho, '0')) + '-' + s.periodo };
  };
  const misAreas = (pid) => { const p = caso(pid); if (!p || !miembroActivo(p.colegio_id, yo())) return []; return activas(pid).filter((a) => responsables(a.area_id).includes(yo())).map((a) => a.area_id); };
  const veSalud = (pid) => {
    const p = caso(pid);
    if (!p || !esMiembro(p.colegio_id)) return false;
    return p.solicitante_id === yo() || T('pqrs_permisos_salud').some((s) => s.colegio_id === p.colegio_id && s.perfil_id === yo())
      || activas(pid).some((a) => area(a.area_id)?.clave === 'enfermeria' && responsables(a.area_id).includes(yo()));
  };
  const acceso = (pid) => {
    const p = caso(pid);
    if (!p || !yo() || !esMiembro(p.colegio_id)) return null;
    const sol = p.solicitante_id === yo(), adm = esAdmin(p.colegio_id), areas = misAreas(pid);
    if (!(sol || adm || areas.length)) return null;
    return { solicitante: sol, admin: adm, areas, personal: adm || areas.length > 0, salud: veSalud(pid) };
  };
  const estado = (pid) => estadoGeneral(caso(pid), asign(pid));
  const nombresAreas = (pid, soloPend = false) => activas(pid).filter((a) => !soloPend || a.estado !== 'respondida').map((a) => area(a.area_id)).sort((x, y) => orden(x) - orden(y)).map((a) => a.nombre);
  const tomar = (pid) => { const p = caso(pid); if (!p || !acceso(pid)) fallo('Esa PQRS no existe o no tienes acceso.'); return p; };

  // ---------------------------------------------------------------- Avisos (mensajes del sistema en la Mensajería del demo)
  const textoAviso = (e, vista) => {
    const p = caso(e.pqrs_id), ar = area(e.area_id)?.nombre, est = estado(p.id), pend = nombresAreas(p.id, true), act = nombresAreas(p.id);
    let corto, que;
    switch (e.tipo) {
      case 'creada': corto = act.length ? 'Nueva PQRS para ' + act.join(', ') : 'Nueva PQRS pendiente de clasificación';
        que = act.length ? 'Se presentó una PQRS y se asignó a: ' + act.join(', ') + '.' : 'Se presentó una PQRS que no se pudo clasificar: requiere asignación.'; break;
      case 'asignada': corto = 'Asignada a ' + ar; que = 'Se asignó el caso a ' + ar + '.'; break;
      case 'retirada': corto = 'Retirada de ' + ar; que = ar + ' ya no participa en este caso (corrección de asignación).'; break;
      case 'respuesta': corto = 'Respuesta de ' + ar; que = vista === 'solicitante' ? ar + ' respondió tu PQRS.' : ar + ' respondió al solicitante.'; break;
      case 'respuesta_corregida': corto = 'Respuesta corregida de ' + ar; que = ar + ' corrigió su respuesta; la versión anterior queda en el historial.'; break;
      case 'comentario': corto = 'Comentario interno de ' + (ar || 'Administración'); que = 'Hay un comentario interno nuevo (solo lo ve el personal del caso).'; break;
      case 'aporte': corto = 'El solicitante agregó información'; que = 'El solicitante aportó información o pidió una aclaración: hay una intervención pendiente de atender.'; break;
      case 'cerrada': corto = 'Caso cerrado'; que = 'El caso se cerró con constancia del cierre.'; break;
      case 'reabierta': corto = 'Caso reabierto'; que = 'El caso se reabrió.'; break;
      case 'resumen': corto = 'Resumen de Enfermería para coordinar'; que = 'Enfermería compartió un resumen sin datos clínicos para coordinar la atención.'; break;
      default: corto = 'Actualización'; que = 'El caso tuvo una actualización.';
    }
    const notas = vista === 'admin' && ['creada', 'asignada'].includes(e.tipo) ? [
      e.detalle.sin_responsables?.length ? `Atención: estas áreas no tienen responsables configurados: ${e.detalle.sin_responsables.join(', ')}. Asígnalos en PQRS → Áreas y responsables; mientras tanto el caso sigue pendiente.` : null,
      e.detalle.razon ? 'Revisa la clasificación: ' + e.detalle.razon : null].filter(Boolean).join('\n') : '';
    return {
      asunto: (p.consecutivo + ' · ' + corto).slice(0, 200),
      cuerpo: [`PQRS ${p.consecutivo} · ${TIPOS[p.tipo]}`, 'Asunto: ' + (p.sensible ? 'reservado (información de salud)' : p.asunto.slice(0, 90)), 'Qué pasó: ' + que,
        'Estado: ' + ESTADO_TXT[est] + (['pendiente', 'en_atencion', 'respuesta_parcial'].includes(est) && pend.length ? ' · falta: ' + pend.join(', ') : ''),
        notas || null, 'Abrir la PQRS: #/pqrs/' + p.id,
        'Aviso automático de Complex. La respuesta oficial y todo el historial están en la PQRS; este mensaje no admite respuestas.'].filter(Boolean).join('\n'),
    };
  };
  const enviar = (eventoId) => {
    const e = T('pqrs_eventos').find((x) => x.id === eventoId), p = caso(e.pqrs_id);
    const pend = T('pqrs_avisos').filter((a) => a.evento_id === eventoId && a.estado !== 'enviado');
    for (const vista of [...new Set(pend.map((a) => a.vista))]) {
      const grupo = pend.filter((a) => a.vista === vista);
      try {
        const t = textoAviso(e, vista);
        const m = { id: crypto.randomUUID(), colegio_id: p.colegio_id, autor_id: null, asunto: t.asunto, cuerpo: t.cuerpo, responde_a: null, permite_respuesta: false,
          permite_responder_todos: false, permite_reenviar: false, ocultar_destinatarios: true, destacado: false, autor_archivado: false, autor_eliminado: false,
          tipo_id: tipoMensaje(p.colegio_id), numero: null, creado_en: ahora() };
        T('mensajes').push(m);
        for (const a of grupo) {
          T('mensaje_destinatarios').push({ mensaje_id: m.id, colegio_id: p.colegio_id, perfil_id: a.perfil_id, leido_en: null, archivado: false, eliminado: false });
          Object.assign(a, { estado: 'enviado', mensaje_id: m.id, enviado_en: ahora(), intentos: a.intentos + 1, error: null });
        }
      } catch (x) { for (const a of grupo) Object.assign(a, { estado: 'error', error: String(x.message).slice(0, 300), intentos: a.intentos + 1 }); }
    }
  };
  const avisar = (eventoId) => {
    const e = T('pqrs_eventos').find((x) => x.id === eventoId), p = caso(e.pqrs_id);
    const staff = [...new Set(activas(p.id).flatMap((a) => responsables(a.area_id)))];
    const admins = [...new Set(T('miembros').filter((m) => m.colegio_id === p.colegio_id && m.rol === 'admin' && m.activo !== false).map((m) => m.perfil_id))];
    const delArea = e.area_id ? responsables(e.area_id) : [];
    const sol = p.solicitante_id ? [p.solicitante_id] : [];
    const dest = ['creada', 'comentario', 'aporte', 'resumen'].includes(e.tipo) ? [...staff, ...admins]
      : ['asignada', 'retirada'].includes(e.tipo) ? [...delArea, ...admins]
      : ['respuesta', 'respuesta_corregida', 'cerrada', 'reabierta'].includes(e.tipo) ? [...staff, ...admins, ...sol] : [];
    // Avisos sin saturar: por los mensajes del chat no se repite el aviso a quien tiene uno de este caso sin leer y no lo ha abierto
    const agrupar = ['respuesta', 'comentario', 'aporte'].includes(e.tipo) && limites(p.colegio_id).agrupar_avisos;
    const ultimaLectura = (d) => T('pqrs_lecturas').find((l) => l.pqrs_id === p.id && l.perfil_id === d)?.ultima_en || '';
    const tieneSinLeer = (d) => T('pqrs_avisos').some((a) => a.pqrs_id === p.id && a.perfil_id === d && a.estado === 'enviado' && a.enviado_en > ultimaLectura(d)
      && T('mensaje_destinatarios').some((md) => md.mensaje_id === a.mensaje_id && md.perfil_id === d && !md.leido_en));
    let agrupados = 0;
    for (const d of new Set(dest)) {
      if (!d || d === e.actor_id || !miembroActivo(p.colegio_id, d)) continue;
      if (T('pqrs_avisos').some((a) => a.evento_id === eventoId && a.perfil_id === d)) continue;
      if (agrupar && tieneSinLeer(d)) { agrupados++; continue; }
      T('pqrs_avisos').push({ evento_id: eventoId, perfil_id: d, colegio_id: p.colegio_id, pqrs_id: p.id, vista: admins.includes(d) ? 'admin' : staff.includes(d) || delArea.includes(d) ? 'area' : 'solicitante',
        estado: 'pendiente', mensaje_id: null, error: null, intentos: 0, creado_en: ahora(), enviado_en: null });
    }
    if (agrupados) e.detalle = { ...e.detalle, avisos_agrupados: agrupados };
    enviar(eventoId);
  };
  const evento = (pid, tipo, areaId = null, intervencion = null, detalle = {}, publico = false, conAviso = true) => {
    const p = caso(pid);
    const e = { id: Math.max(0, ...T('pqrs_eventos').map((x) => x.id)) + 1, // se calcula cada vez: otra pestaña del demo pudo agregar eventos
      colegio_id: p.colegio_id, pqrs_id: pid, tipo, actor_id: yo(), actor_nombre: nombreDe(yo()) || '', area_id: areaId, intervencion_id: intervencion, detalle: detalle || {}, publico, creado_en: ahora() };
    T('pqrs_eventos').push(e);
    if (tipo !== 'leida') { p.actualizado_en = ahora(); senal(pid, publico); }
    if (conAviso) avisar(e.id);
    return e.id;
  };

  // ---------------------------------------------------------------- Clasificación (igual que private.pqrs_clasificar)
  const grado = (c, est) => {
    const m = T('matriculas').filter((x) => x.colegio_id === c && x.estudiante_id === est && x.estado === 'activa').sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')))[0];
    return m ? T('cursos').find((cu) => cu.id === m.curso_id)?.grado_id || null : null;
  };
  const clasificar = (c, texto, est) => {
    const an = analizar(texto), d = decidir(an), mot = motivosDe(an);
    const areas = [...d.areas];
    let sec = null, revisar = false, razon = null;
    if (d.seccion) {
      const g = est ? grado(c, est) : null;
      sec = T('pqrs_areas').filter((a) => a.colegio_id === c && a.activo && a.clave.startsWith('seccion') && g && a.grados.includes(g)).sort((x, y) => orden(x) - orden(y))[0]?.clave || null;
      if (sec) areas.push(sec);
      else {
        revisar = true;
        razon = !est ? 'Parece académico o de convivencia, pero no se sabe de qué estudiante: asigna la sección.'
          : !g ? 'Parece académico o de convivencia, pero el estudiante no tiene una matrícula activa con grado: asigna la sección.'
          : 'Parece académico o de convivencia, pero el grado del estudiante no está en ninguna sección (márcalo en Áreas y responsables).';
      }
    }
    if (mot.seccion) { mot[sec || 'seccion'] = mot.seccion; if (sec) delete mot.seccion; }
    const ord = (k) => areaClave(c, k)?.orden ?? 99;
    return { areas: areas.sort((a, b) => ord(a) - ord(b)), salud: d.salud, seccion: d.seccion, seccion_area: sec, revisar, razon, debiles: d.debiles, motivos: mot, puntos: d.puntos, intencion: an.intencion, descartes: an.descartes.length };
  };

  // ---------------------------------------------------------------- Vistas
  const item = (pid) => {
    const acc = acceso(pid);
    if (!acc) return null;
    const p = caso(pid);
    return {
      id: p.id, consecutivo: p.consecutivo, tipo: p.tipo, asunto: p.sensible && !acc.salud ? 'Caso con información de salud' : p.asunto, sensible: p.sensible,
      solicitante: acc.personal || acc.solicitante ? p.solicitante_nombre : null, rol_solicitante: p.rol_solicitante, creado_en: p.creado_en, actualizado_en: p.actualizado_en,
      estado: estado(pid), pendientes: nombresAreas(pid, true),
      areas: activas(pid).map((a) => ({ a, ar: area(a.area_id) })).sort((x, y) => orden(x.ar) - orden(y.ar)).map(({ a, ar }) => ({ id: ar.id, clave: ar.clave, nombre: ar.nombre, estado: a.estado,
        aporte_pendiente: a.aporte_pendiente, mia: acc.areas.includes(ar.id), sin_responsables: acc.personal && !responsables(ar.id).length })),
      visto_por_mi: T('pqrs_lecturas').some((l) => l.pqrs_id === pid && l.perfil_id === yo()),
      visto_por_mi_area: acc.personal && T('pqrs_lecturas').some((l) => l.pqrs_id === pid && acc.areas.some((ar) => responsables(ar).includes(l.perfil_id))),
      aporte_pendiente: acc.personal && activas(pid).some((a) => a.aporte_pendiente && (acc.admin || acc.areas.includes(a.area_id))),
      respuestas: T('pqrs_intervenciones').filter((i) => i.pqrs_id === pid && i.tipo === 'respuesta').length,
      ultima_respuesta_en: T('pqrs_intervenciones').filter((i) => i.pqrs_id === pid && i.tipo === 'respuesta').map((i) => i.creado_en).sort().pop() ?? null,
      revisar: acc.admin ? p.revisar_clasificacion : null,
      avisos_error: acc.admin ? T('pqrs_avisos').some((a) => a.pqrs_id === pid && a.estado !== 'enviado') : null,
    };
  };
  const confirmacion = (pid) => { const p = caso(pid); return { id: p.id, consecutivo: p.consecutivo, creado_en: p.creado_en, estado: estado(pid), areas: nombresAreas(pid) }; };
  const nuevaIntervencion = (p, tipo, areaId, texto, salud, solicitud) => {
    const i = { id: crypto.randomUUID(), colegio_id: p.colegio_id, pqrs_id: p.id, tipo, area_id: areaId, autor_id: yo(), autor_nombre: nombreDe(yo()) || '', contenido: texto, salud, solicitud_id: solicitud, version: 1, editado_en: null, editado_por: null, creado_en: ahora() };
    T('pqrs_intervenciones').push(i);
    return i;
  };
  const yaEnviada = (p, solicitud) => T('pqrs_intervenciones').find((i) => i.pqrs_id === p.id && i.solicitud_id === solicitud);
  const largo = (t, min, max, msg) => { const v = String(t ?? '').trim(); if (v.length < min || v.length > max) fallo(msg); return v; };
  const soloAdmin = (c, msg) => { if (!esAdmin(c)) fallo(msg); };
  const abierto = (p) => { if (p.cerrado_en) fallo('El caso está cerrado.'); };
  let canal = null;
  // Se avisa DESPUÉS de guardar (la función del demo guarda al terminar): la otra pestaña ya encuentra el cambio
  const senal = (pid, publico) => setTimeout(() => { try { (canal ||= new BroadcastChannel('complex-demo-pqrs')).postMessage({ pqrs: pid, publico }); } catch {} }, 30);

  // ---------------------------------------------------------------- Conversación y adjuntos (20261029120000)
  const FORMATOS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'pdf'];
  const TIPO_ARCHIVO = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  const limites = (c) => { const x = T('pqrs_ajustes').find((y) => y.colegio_id === c);
    return x ? { max_mb: x.adjunto_max_mb, por_mensaje: x.adjuntos_por_mensaje, por_caso: x.adjuntos_por_caso, formatos: x.formatos, agrupar_avisos: x.agrupar_avisos }
      : { max_mb: 10, por_mensaje: 5, por_caso: 30, formatos: FORMATOS, agrupar_avisos: true }; };
  const SIN_TILDE = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U', ñ: 'n', Ñ: 'N', ü: 'u', Ü: 'U' };
  const nombreArchivo = (n) => (String(n || '').replace(/^.*[\\/]/, '').replace(/[áéíóúÁÉÍÓÚñÑüÜ]/g, (c) => SIN_TILDE[c]).replace(/[^A-Za-z0-9 ._()-]/g, '_').replace(/_+/g, '_')
    .replace(/^[ ._]+|[ ._]+$/g, '') || 'archivo').slice(0, 120);
  const adj = (id) => T('pqrs_adjuntos').find((x) => x.id === id);
  const adjuntosJson = (pid, iid, desc) => T('pqrs_adjuntos').filter((x) => x.pqrs_id === pid && x.estado === 'listo' && (desc ? x.en_descripcion : x.intervencion_id === iid))
    .sort((x, y) => x.creado_en.localeCompare(y.creado_en) || x.id.localeCompare(y.id))
    .map((x) => ({ id: x.id, nombre: x.nombre, extension: x.extension, tipo: x.tipo, tamano: x.tamano, ruta: x.ruta, imagen: x.tipo.startsWith('image/') }));
  // Revisión de los adjuntos (mismos errores que private.pqrs_vincular) ANTES de escribir: si uno no sirve, no se guarda nada
  const revisarAdjuntos = (c, pid, iid, ids) => {
    const lim = limites(c), unicos = [...new Set(ids)];
    if (unicos.length > lim.por_mensaje) fallo(`Un mensaje admite hasta ${lim.por_mensaje} adjuntos.`);
    for (const id of unicos) {
      const a = adj(id);
      if (!a || a.subido_por !== yo() || a.colegio_id !== c || (a.pqrs_id && pid && a.pqrs_id !== pid)) fallo('Uno de los adjuntos no existe o no es tuyo.');
      if ((iid && a.intervencion_id === iid) || (!iid && a.en_descripcion && a.pqrs_id === pid)) continue;
      if (a.intervencion_id || a.en_descripcion) fallo('Uno de los adjuntos ya está en otro mensaje.');
      if (a.estado === 'subiendo') fallo(`«${a.nombre}» no terminó de subirse.`);
      if (a.estado === 'verificando') fallo(`«${a.nombre}» aún se está verificando. Espera un momento.`);
      if (a.estado !== 'listo') fallo(`«${a.nombre}» no se puede enviar: ${a.motivo || 'fue retirado.'}`);
    }
    const ya = T('pqrs_adjuntos').filter((x) => pid && x.pqrs_id === pid && (x.intervencion_id || x.en_descripcion)).length;
    const nuevos = unicos.filter((id) => !adj(id).vinculado_en).length;
    if (ya + nuevos > lim.por_caso) fallo(`Una PQRS admite hasta ${lim.por_caso} adjuntos en total.`);
    return unicos;
  };
  const vincular = (p, iid, ids) => {
    if (!ids?.length) return 0;
    const unicos = revisarAdjuntos(p.colegio_id, p.id, iid, ids);
    for (const id of unicos) { const a = adj(id); if (!a.vinculado_en) Object.assign(a, { pqrs_id: p.id, intervencion_id: iid, en_descripcion: !iid, vinculado_en: ahora() }); }
    return unicos.length;
  };
  // Las tres clases de mensaje con las mismas comprobaciones (y en el mismo orden) que private.pqrs_intervenir
  const intervenir = (a, tipo, adjuntos = null) => {
    if (!['respuesta', 'comentario', 'aporte'].includes(tipo)) fallo('Tipo de mensaje no válido.');
    const p = tomar(a.p_id);
    if (tipo === 'aporte' && p.solicitante_id !== yo()) fallo('Solo quien presentó la PQRS puede aportar información.');
    if (!a.p_solicitud) fallo('Falta la identificación del envío.');
    const ya = yaEnviada(p, a.p_solicitud);
    if (ya) return tipo === 'aporte' ? { id: ya.id, repetido: true } : { id: ya.id, repetido: true, estado: estado(p.id) };
    if (p.cerrado_en) fallo(tipo === 'aporte' ? 'El caso está cerrado: si necesitas algo más, presenta una PQRS nueva.' : 'El caso está cerrado.');
    const con = (adjuntos?.length || 0) > 0, txt = String(a.p_contenido ?? '').trim();
    const area0 = tipo === 'aporte' ? null : a.p_area || null;
    if (tipo === 'respuesta') {
      if (!misAreas(p.id).includes(area0)) fallo('Solo los responsables de esa área responden en su nombre.');
      if (txt.length < 1 && !con) fallo('Escribe la respuesta.');
      if (txt.length > 5000) fallo('La respuesta admite hasta 5000 caracteres.');
    } else if (tipo === 'comentario') {
      if (!area0) { if (!esAdmin(p.colegio_id)) fallo('Elige el área en cuyo nombre comentas.'); }
      else if (!misAreas(p.id).includes(area0)) fallo('Solo los responsables de esa área comentan en su nombre.');
      if (txt.length < 1 && !con) fallo('Escribe el comentario.');
      if (txt.length > 5000) fallo('El comentario admite hasta 5000 caracteres.');
    } else if ((txt.length < 3 && !con) || txt.length > 5000) fallo('Escribe la información (de 3 a 5000 caracteres).');
    let salud = tipo === 'aporte' ? p.sensible : a.p_salud ?? (area(area0)?.clave === 'enfermeria' && p.sensible);
    if (tipo !== 'aporte' && salud && !veSalud(p.id)) salud = false;
    if (con) revisarAdjuntos(p.colegio_id, p.id, '__nuevo__', adjuntos); // un adjunto de la descripción no se reutiliza en un mensaje
    const i = nuevaIntervencion(p, tipo, area0, txt, salud, a.p_solicitud);
    const n = vincular(p, i.id, adjuntos);
    const det = n > 0 ? { adjuntos: n } : {};
    if (tipo === 'respuesta') {
      Object.assign(asign(p.id).find((x) => x.area_id === area0), { estado: 'respondida', aporte_pendiente: false, estado_por: yo(), estado_en: ahora() });
      evento(p.id, 'respuesta', area0, i.id, det, true);
      return { id: i.id, repetido: false, estado: estado(p.id) };
    }
    if (tipo === 'comentario') {
      let paso = false;
      if (area0) { const s = asign(p.id).find((x) => x.area_id === area0); if (s.estado === 'pendiente') { Object.assign(s, { estado: 'en_revision', estado_por: yo(), estado_en: ahora() }); paso = true; } }
      evento(p.id, 'comentario', area0, i.id, { paso_a_revision: paso, ...det }, false);
      return { id: i.id, repetido: false, estado: estado(p.id) };
    }
    for (const s of activas(p.id)) s.aporte_pendiente = true;
    evento(p.id, 'aporte', null, i.id, det, true);
    return { id: i.id, repetido: false };
  };
  const mensajeJson = (iid) => {
    const i = T('pqrs_intervenciones').find((x) => x.id === iid);
    if (!i) return null;
    const acc = acceso(i.pqrs_id);
    if (!acc || !(acc.personal || ['respuesta', 'aporte'].includes(i.tipo))) return null;
    const p = caso(i.pqrs_id), oculto = i.salud && !acc.salud;
    return { id: i.id, tipo: i.tipo, area: area(i.area_id)?.nombre ?? null, area_id: i.area_id, autor: i.autor_nombre, rol: i.tipo === 'aporte' ? p.rol_solicitante : null,
      mia: i.autor_id === yo(), solicitud_id: i.autor_id === yo() ? i.solicitud_id : null, contenido: oculto ? null : i.contenido, oculto_salud: oculto, salud: i.salud,
      creado_en: i.creado_en, version: i.version, editado_en: i.editado_en, versiones: T('pqrs_intervencion_versiones').filter((v) => v.intervencion_id === i.id).length,
      adjuntos: oculto ? [] : adjuntosJson(i.pqrs_id, i.id, false), adjuntos_ocultos: oculto ? T('pqrs_adjuntos').filter((x) => x.intervencion_id === i.id && x.estado === 'listo').length : 0 };
  };
  const bytesDe = (url) => { try { const b = atob(String(url || '').split(',')[1] || ''); return Uint8Array.from(b, (c) => c.charCodeAt(0)); } catch { return new Uint8Array(); } };


  const F = {
    pqrs_yo(a) {
      if (!yo() || !esMiembro(a.p_colegio)) fallo('No perteneces a este colegio.');
      preparar(a.p_colegio);
      return {
        admin: esAdmin(a.p_colegio),
        areas: T('pqrs_areas').filter((x) => x.colegio_id === a.p_colegio && x.activo && responsables(x.id).includes(yo())).sort((x, y) => orden(x) - orden(y)).map((x) => ({ id: x.id, clave: x.clave, nombre: x.nombre })),
        hijos: T('acudientes').filter((x) => x.colegio_id === a.p_colegio && x.acudiente_id === yo()).map((x) => ({ id: x.estudiante_id, nombre: nombreDe(x.estudiante_id) })).sort((x, y) => x.nombre.localeCompare(y.nombre)),
      };
    },
    pqrs_crear(a) {
      const c = a.p_colegio;
      if (!yo() || !esMiembro(c)) fallo('Solo las personas del colegio pueden presentar una PQRS.');
      if (!a.p_solicitud) fallo('Falta la identificación del envío.');
      const ya = T('pqrs').find((p) => p.colegio_id === c && p.solicitud_id === a.p_solicitud);
      if (ya) { if (ya.solicitante_id !== yo()) fallo('Ese envío es de otra persona.'); return confirmacion(ya.id); }
      const asunto = String(a.p_asunto ?? '').trim(), desc = String(a.p_descripcion ?? '').trim();
      if (!TIPOS[a.p_tipo]) fallo('Elige el tipo de solicitud.');
      if (asunto.length < 3) fallo('Escribe el asunto (mínimo 3 letras).');
      if (asunto.length > 150) fallo('El asunto admite hasta 150 caracteres.');
      if (desc.length < 10) fallo('Cuéntanos qué pasó o qué necesitas (mínimo 10 letras).');
      if (desc.length > 5000) fallo('La descripción admite hasta 5000 caracteres.');
      const roles = T('miembros').filter((m) => m.colegio_id === c && m.perfil_id === yo() && m.activo !== false).map((m) => m.rol);
      const ORDEN_ROL = ['admin', 'profesor', 'acudiente', 'estudiante', 'enfermeria', 'director_seccion'];
      const rol = a.p_rol ? (roles.includes(a.p_rol) ? a.p_rol : null) : roles.sort((x, y) => ORDEN_ROL.indexOf(x) - ORDEN_ROL.indexOf(y))[0];
      if (!rol) fallo('No tienes ese perfil en el colegio.');
      const hijos = T('acudientes').filter((x) => x.colegio_id === c && x.acudiente_id === yo()).map((x) => x.estudiante_id);
      let est = null;
      if (a.p_estudiante) { if (!(a.p_estudiante === yo() || hijos.includes(a.p_estudiante))) fallo('Solo puedes relacionar a un estudiante a tu cargo.'); est = a.p_estudiante; }
      else if (rol === 'estudiante') est = yo();
      else if (rol === 'acudiente' && hijos.length === 1) est = hijos[0];
      preparar(c);
      const s = consecutivo(c);
      const p = { id: crypto.randomUUID(), colegio_id: c, solicitud_id: a.p_solicitud, ...s, solicitante_id: yo(), solicitante_nombre: nombreDe(yo()) || '', rol_solicitante: rol, estudiante_id: est,
        tipo: a.p_tipo, asunto, descripcion: desc, sensible: false, resumen_coordinacion: null, resumen_por: null, resumen_en: null, revisar_clasificacion: false, clasificacion: {},
        cerrado_en: null, cerrado_por: null, cierre_motivo: null, creado_en: ahora(), actualizado_en: ahora() };
      T('pqrs').push(p);
      const cl = clasificar(c, asunto + '. ' + desc, est);
      Object.assign(p, { clasificacion: cl, sensible: cl.salud, revisar_clasificacion: cl.revisar });
      const sin = [];
      for (const k of cl.areas) {
        const ar = areaClave(c, k);
        T('pqrs_asignaciones').push({ id: crypto.randomUUID(), colegio_id: c, pqrs_id: p.id, area_id: ar.id, estado: 'pendiente', activa: true, origen: 'automatica', motivo: (cl.motivos[k] || '').slice(0, 500),
          aporte_pendiente: false, asignada_por: null, asignada_en: ahora(), retirada_por: null, retirada_en: null, retiro_motivo: null, estado_por: null, estado_en: null });
        if (!responsables(ar.id).length) sin.push(ar.nombre);
      }
      evento(p.id, 'creada', null, null, { areas: nombresAreas(p.id), pendiente_clasificacion: cl.areas.length === 0, sin_responsables: sin, razon: cl.razon, salud: cl.salud }, true);
      return confirmacion(p.id);
    },
    pqrs_listar(a) {
      if (!yo() || !esMiembro(a.p_colegio)) fallo('No perteneces a este colegio.');
      if (a.p_vista === 'supervision' && !esAdmin(a.p_colegio)) fallo('Solo el administrador general ve la supervisión de PQRS.');
      return T('pqrs').filter((p) => p.colegio_id === a.p_colegio && (a.p_vista === 'mias' ? p.solicitante_id === yo()
        : a.p_vista === 'area' ? activas(p.id).some((x) => responsables(x.area_id).includes(yo())) : a.p_vista === 'supervision'))
        .sort((x, y) => y.creado_en.localeCompare(x.creado_en)).slice(0, 500).map((p) => item(p.id)).filter(Boolean);
    },
    pqrs_detalle(a) {
      const acc = acceso(a.p_id);
      if (!acc) fallo('Esa PQRS no existe o no tienes acceso.');
      const p = caso(a.p_id), ocultar = p.sensible && !acc.salud;
      let l = T('pqrs_lecturas').find((x) => x.pqrs_id === p.id && x.perfil_id === yo());
      if (l) l.ultima_en = ahora();
      else {
        T('pqrs_lecturas').push((l = { pqrs_id: p.id, colegio_id: p.colegio_id, perfil_id: yo(), primera_en: ahora(), ultima_en: ahora() }));
        if (acc.personal && !acc.solicitante) evento(p.id, 'leida', null, null, { areas: acc.areas.map((x) => area(x)).sort((x, y) => orden(x) - orden(y)).map((x) => x.nombre), admin: acc.admin }, false, false);
      }
      const nombreAreaDe = (id) => area(id)?.nombre ?? null;
      const cl = acc.admin ? (ocultar ? (({ motivos, puntos, ...r }) => r)(p.clasificacion) : p.clasificacion) : null;
      return copia({
        id: p.id, colegio_id: p.colegio_id, consecutivo: p.consecutivo, tipo: p.tipo, creado_en: p.creado_en, actualizado_en: p.actualizado_en,
        asunto: ocultar ? 'Caso con información de salud' : p.asunto, descripcion: ocultar ? null : p.descripcion, oculto_salud: ocultar, sensible: p.sensible,
        resumen_coordinacion: acc.personal ? p.resumen_coordinacion : null, resumen_por: acc.personal ? nombreDe(p.resumen_por) : null, resumen_en: acc.personal ? p.resumen_en : null,
        solicitante: { id: acc.personal || acc.solicitante ? p.solicitante_id : null, nombre: p.solicitante_nombre, rol: p.rol_solicitante },
        estudiante: (acc.personal || acc.solicitante) && p.estudiante_id ? { id: p.estudiante_id, nombre: nombreDe(p.estudiante_id) } : null,
        estado: estado(p.id), pendientes: nombresAreas(p.id, true),
        cierre: p.cerrado_en ? { en: p.cerrado_en, por: nombreDe(p.cerrado_por), motivo: p.cierre_motivo } : null,
        revisar: acc.admin ? p.revisar_clasificacion : null, clasificacion: cl,
        areas: asign(p.id).filter((x) => x.activa || acc.personal).map((x) => ({ x, ar: area(x.area_id) })).sort((u, v) => (v.x.activa - u.x.activa) || orden(u.ar) - orden(v.ar)).map(({ x, ar }) => ({
          id: ar.id, clave: ar.clave, nombre: ar.nombre, estado: x.estado, activa: x.activa, origen: x.origen,
          motivo: !acc.personal ? null : ar.clave === 'enfermeria' && p.sensible && !acc.salud ? 'Información de salud (reservada)' : x.motivo,
          aporte_pendiente: x.aporte_pendiente, asignada_en: x.asignada_en, asignada_por: acc.personal ? nombreDe(x.asignada_por) : null,
          retirada_en: x.retirada_en, retirada_por: acc.personal ? nombreDe(x.retirada_por) : null, retiro_motivo: acc.personal ? x.retiro_motivo : null, mia: acc.areas.includes(ar.id),
          responsables: acc.personal ? responsables(ar.id).map(nombreDe).sort() : null })),
        intervenciones: T('pqrs_intervenciones').filter((i) => i.pqrs_id === p.id && (acc.personal || ['respuesta', 'aporte'].includes(i.tipo))).sort((x, y) => x.creado_en.localeCompare(y.creado_en)).map((i) => ({
          id: i.id, tipo: i.tipo, area: nombreAreaDe(i.area_id), area_id: i.area_id, autor: i.autor_nombre, mia: i.autor_id === yo(),
          contenido: i.salud && !acc.salud ? null : i.contenido, oculto_salud: i.salud && !acc.salud, salud: i.salud, creado_en: i.creado_en, version: i.version, editado_en: i.editado_en,
          versiones: T('pqrs_intervencion_versiones').filter((v) => v.intervencion_id === i.id).sort((x, y) => x.version - y.version).map((v) => ({ version: v.version, escrito_en: v.escrito_en, reemplazado_en: v.reemplazado_en, motivo: v.motivo, contenido: v.salud && !acc.salud ? null : v.contenido })) })),
        lecturas: acc.personal ? T('pqrs_lecturas').filter((x) => x.pqrs_id === p.id && x.perfil_id !== p.solicitante_id).sort((x, y) => x.primera_en.localeCompare(y.primera_en)).map((x) => ({
          nombre: nombreDe(x.perfil_id), primera_en: x.primera_en, ultima_en: x.ultima_en, admin: esAdmin(p.colegio_id, x.perfil_id),
          areas: activas(p.id).filter((s) => responsables(s.area_id).includes(x.perfil_id)).map((s) => area(s.area_id)).sort((u, v) => orden(u) - orden(v)).map((u) => u.nombre) })) : null,
        eventos: T('pqrs_eventos').filter((e) => e.pqrs_id === p.id && (acc.personal || e.publico)).sort((x, y) => x.id - y.id).map((e) => ({
          id: e.id, tipo: e.tipo, actor: e.actor_nombre, area: nombreAreaDe(e.area_id), creado_en: e.creado_en,
          detalle: acc.personal ? e.detalle : (({ motivo, razon, sin_responsables, salud, ...r }) => r)(e.detalle) })),
        yo: { solicitante: acc.solicitante, admin: acc.admin, personal: acc.personal, salud: acc.salud, areas: acc.areas, puede_aportar: acc.solicitante && !p.cerrado_en,
          puede_cerrar: acc.admin && !p.cerrado_en, puede_reabrir: acc.admin && !!p.cerrado_en, puede_asignar: acc.admin && !p.cerrado_en, puede_resumen: acc.personal && acc.salud && p.sensible && !p.cerrado_en },
      });
    },
    pqrs_responder(a) { return intervenir(a, 'respuesta'); },
    pqrs_comentar(a) { return intervenir(a, 'comentario'); },
    pqrs_corregir(a) {
      const i0 = T('pqrs_intervenciones').find((x) => x.id === a.p_intervencion);
      if (!i0) fallo('Esa intervención no existe o no tienes acceso.');
      const p = tomar(i0.pqrs_id);
      if (i0.autor_id !== yo() || i0.tipo === 'aporte') fallo('Solo quien escribió la respuesta o el comentario puede corregirlo.');
      if (i0.area_id && !misAreas(p.id).includes(i0.area_id)) fallo('Ya no eres responsable de esa área en este caso.');
      abierto(p);
      const txt = largo(a.p_contenido, 1, 5000, 'Escribe el texto corregido (hasta 5000 caracteres).');
      const mot = String(a.p_motivo ?? '').trim();
      if (mot.length < 3) fallo('Escribe el motivo de la corrección.');
      if (txt === i0.contenido) return { id: i0.id, version: i0.version, igual: true };
      T('pqrs_intervencion_versiones').push({ intervencion_id: i0.id, version: i0.version, contenido: i0.contenido, salud: i0.salud, escrito_en: i0.editado_en || i0.creado_en, reemplazado_en: ahora(), reemplazado_por: yo(), motivo: mot.slice(0, 300) });
      Object.assign(i0, { contenido: txt, version: i0.version + 1, editado_en: ahora(), editado_por: yo() });
      evento(p.id, i0.tipo === 'respuesta' ? 'respuesta_corregida' : 'comentario_corregido', i0.area_id, i0.id, { motivo: mot.slice(0, 300), version: i0.version }, i0.tipo === 'respuesta', i0.tipo === 'respuesta');
      return { id: i0.id, version: i0.version, igual: false };
    },
    pqrs_aportar(a) { return intervenir(a, 'aporte'); },
    // ---------------------------------------------------------------- Conversación y adjuntos
    pqrs_adjunto_preparar(a) {
      if (!yo() || !esMiembro(a.p_colegio)) fallo('No perteneces a este colegio.');
      if (!a.p_solicitud) fallo('Falta la identificación del archivo.');
      const ya = T('pqrs_adjuntos').find((x) => x.subido_por === yo() && x.solicitud_id === a.p_solicitud);
      if (ya) return { id: ya.id, ruta: ya.ruta, tipo: ya.tipo, estado: ya.estado, nombre: ya.nombre, repetido: true };
      if (a.p_pqrs) {
        const p = caso(a.p_pqrs);
        if (!p || p.colegio_id !== a.p_colegio || !acceso(a.p_pqrs)) fallo('Esa PQRS no existe o no tienes acceso.');
        if (p.cerrado_en) fallo('La PQRS está finalizada: ya no recibe adjuntos.');
      }
      const lim = limites(a.p_colegio), ext = (String(a.p_nombre || '').match(/\.([A-Za-z0-9]{1,5})$/)?.[1] || '').toLowerCase();
      if (!ext || !lim.formatos.includes(ext)) fallo(`Ese tipo de archivo no se admite. Formatos permitidos: ${lim.formatos.map((f) => f.toUpperCase()).join(', ')}.`);
      if (!(a.p_tamano > 0)) fallo('El archivo está vacío.');
      if (a.p_tamano > lim.max_mb * 1048576) fallo(`El archivo pesa más de ${lim.max_mb} MB.`);
      if (T('pqrs_adjuntos').filter((x) => x.subido_por === yo() && !x.intervencion_id && !x.en_descripcion && ['subiendo', 'verificando', 'listo'].includes(x.estado)).length >= 20) fallo('Tienes muchos archivos sin enviar. Envía o quita alguno antes de agregar más.');
      const id = crypto.randomUUID();
      const x = { id, colegio_id: a.p_colegio, pqrs_id: a.p_pqrs || null, intervencion_id: null, en_descripcion: false, solicitud_id: a.p_solicitud, subido_por: yo(), nombre: nombreArchivo(a.p_nombre),
        extension: ext, tipo: TIPO_ARCHIVO[ext], tamano: a.p_tamano, ruta: `${a.p_colegio}/${id}.${ext}`, estado: 'subiendo', motivo: null, formato_detectado: null, verificado_en: null, creado_en: ahora(), vinculado_en: null };
      T('pqrs_adjuntos').push(x);
      return { id, ruta: x.ruta, tipo: x.tipo, estado: x.estado, nombre: x.nombre, repetido: false };
    },
    pqrs_adjunto_subido(a) {
      const x = adj(a.p_id);
      if (!x || x.subido_por !== yo()) fallo('Ese adjunto no existe o no es tuyo.');
      if (x.estado !== 'subiendo') return { id: x.id, estado: x.estado, motivo: x.motivo };
      const url = archivo('pqrs-adjuntos', x.ruta);
      if (!url) fallo('El archivo no llegó al servidor. Reintenta la subida.');
      if (bytesDe(url).length !== x.tamano) Object.assign(x, { estado: 'rechazado', motivo: 'El tamaño subido no coincide con el del archivo elegido.' });
      else x.estado = 'verificando';
      return { id: x.id, estado: x.estado, motivo: x.motivo };
    },
    // En la base esto lo hace la Edge Function pqrs-adjuntos; en el demo, la misma verificación aquí (pqrs_firma.js)
    pqrs_adjunto_verificar_demo(a) {
      const x = adj(a.p_id);
      if (!x || x.subido_por !== yo()) fallo('Ese adjunto no existe o no es tuyo.');
      if (x.estado === 'verificando') {
        const r = verificarFirma(bytesDe(archivo('pqrs-adjuntos', x.ruta)), x.extension);
        Object.assign(x, { estado: r.ok ? 'listo' : 'rechazado', formato_detectado: r.formato, motivo: r.ok ? null : r.motivo, verificado_en: ahora() });
      }
      return { id: x.id, estado: x.estado, motivo: x.motivo };
    },
    pqrs_adjunto_estado(a) { return T('pqrs_adjuntos').filter((x) => (a.p_ids || []).includes(x.id) && x.subido_por === yo()).map((x) => ({ id: x.id, estado: x.estado, motivo: x.motivo, formato: x.formato_detectado })); },
    pqrs_adjunto_retirar(a) {
      const x = adj(a.p_id);
      if (!x || x.subido_por !== yo()) fallo('Ese adjunto no existe o no es tuyo.');
      if (x.intervencion_id || x.en_descripcion) fallo('Ese adjunto ya se envió: queda en la PQRS.');
      x.estado = 'retirado';
      return { id: x.id, estado: 'retirado' };
    },
    pqrs_enviar(a) {
      const r = intervenir(a, a.p_modo, a.p_adjuntos);
      return { ...r, mensaje: mensajeJson(r.id), estado: estado(a.p_id) };
    },
    pqrs_presentar(a) {
      const previo = T('pqrs').find((p) => p.colegio_id === a.p_colegio && p.solicitud_id === a.p_solicitud);
      if (a.p_adjuntos?.length) revisarAdjuntos(a.p_colegio, previo?.id || null, null, a.p_adjuntos); // antes de crear: todo o nada
      const r = F.pqrs_crear(a);
      const n = a.p_adjuntos?.length ? vincular(caso(r.id), null, a.p_adjuntos) : 0;
      return { ...r, adjuntos: n };
    },
    pqrs_mensajes(a) {
      const acc = acceso(a.p_id);
      if (!acc) fallo('Esa PQRS no existe o no tienes acceso.');
      const p = caso(a.p_id), oculto = p.sensible && !acc.salud, lim = Math.min(Math.max(a.p_limite || 50, 1), 200);
      const vis = T('pqrs_intervenciones').filter((i) => i.pqrs_id === p.id && (acc.personal || ['respuesta', 'aporte'].includes(i.tipo)))
        .sort((x, y) => x.creado_en.localeCompare(y.creado_en) || x.id.localeCompare(y.id));
      let lista, mas = false;
      if (a.p_desde) lista = vis.filter((i) => (i.editado_en && i.editado_en > i.creado_en ? i.editado_en : i.creado_en) >= a.p_desde);
      else { const previos = a.p_antes ? vis.filter((i) => i.creado_en < a.p_antes) : vis; lista = previos.slice(-lim); mas = previos.length > lista.length; }
      return {
        id: p.id, consecutivo: p.consecutivo, estado: estado(p.id), pendientes: nombresAreas(p.id, true), cerrada: !!p.cerrado_en,
        cierre: p.cerrado_en ? { en: p.cerrado_en, por: nombreDe(p.cerrado_por), motivo: p.cierre_motivo } : null, actualizado_en: p.actualizado_en, ahora: ahora(),
        inicio: a.p_desde ? null : { autor: p.solicitante_nombre, rol: p.rol_solicitante, creado_en: p.creado_en, mia: p.solicitante_id === yo(), contenido: oculto ? null : p.descripcion,
          oculto_salud: oculto, adjuntos: oculto ? [] : adjuntosJson(p.id, null, true) },
        hay_anteriores: mas, mensajes: lista.map((i) => mensajeJson(i.id)),
      };
    },
    pqrs_estado_area(a) {
      const p = tomar(a.p_id);
      abierto(p);
      if (!misAreas(p.id).includes(a.p_area)) fallo('Solo los responsables de esa área cambian su estado.');
      const s = asign(p.id).find((x) => x.area_id === a.p_area);
      if (a.p_accion === 'en_revision') { if (s.estado !== 'en_revision') { const antes = s.estado; Object.assign(s, { estado: 'en_revision', estado_por: yo(), estado_en: ahora() }); evento(p.id, 'estado_area', a.p_area, null, { estado: 'en_revision', antes }, true, false); } }
      else if (a.p_accion === 'atender_aporte') { if (s.aporte_pendiente) { s.aporte_pendiente = false; evento(p.id, 'aporte_atendido', a.p_area, null, {}, false, false); } }
      else fallo('Acción no válida.');
      return { estado: estado(p.id) };
    },
    pqrs_asignar(a) {
      const p = tomar(a.p_id);
      soloAdmin(p.colegio_id, 'Solo el administrador general corrige las asignaciones.');
      abierto(p);
      const ar = T('pqrs_areas').find((x) => x.id === a.p_area && x.colegio_id === p.colegio_id && x.activo);
      if (!ar) fallo('Elige un área del colegio.');
      const mot = String(a.p_motivo ?? '').trim();
      if (mot.length < 3) fallo('Escribe el motivo de la asignación.');
      const s = asign(p.id).find((x) => x.area_id === ar.id);
      if (s?.activa) return { estado: estado(p.id), igual: true };
      if (s) Object.assign(s, { activa: true, estado: 'pendiente', origen: 'manual', motivo: mot.slice(0, 500), aporte_pendiente: false, asignada_por: yo(), asignada_en: ahora(), retirada_por: null, retirada_en: null, retiro_motivo: null });
      else T('pqrs_asignaciones').push({ id: crypto.randomUUID(), colegio_id: p.colegio_id, pqrs_id: p.id, area_id: ar.id, estado: 'pendiente', activa: true, origen: 'manual', motivo: mot.slice(0, 500), aporte_pendiente: false, asignada_por: yo(), asignada_en: ahora(), retirada_por: null, retirada_en: null, retiro_motivo: null, estado_por: null, estado_en: null });
      evento(p.id, 'asignada', ar.id, null, { motivo: mot.slice(0, 500), sin_responsables: responsables(ar.id).length ? [] : [ar.nombre] }, true);
      return { estado: estado(p.id), igual: false };
    },
    pqrs_retirar(a) {
      const p = tomar(a.p_id);
      soloAdmin(p.colegio_id, 'Solo el administrador general corrige las asignaciones.');
      abierto(p);
      const mot = String(a.p_motivo ?? '').trim();
      if (mot.length < 3) fallo('Escribe por qué esa área no debe intervenir.');
      const s = asign(p.id).find((x) => x.area_id === a.p_area);
      if (!s || !s.activa) return { estado: estado(p.id), igual: true };
      const antes = s.estado;
      Object.assign(s, { activa: false, aporte_pendiente: false, retirada_por: yo(), retirada_en: ahora(), retiro_motivo: mot.slice(0, 500) });
      evento(p.id, 'retirada', a.p_area, null, { motivo: mot.slice(0, 500), estado_antes: antes }, true);
      return { estado: estado(p.id), igual: false };
    },
    pqrs_confirmar_clasificacion(a) {
      const p = tomar(a.p_id);
      soloAdmin(p.colegio_id, 'Solo el administrador general confirma la clasificación.');
      if (p.revisar_clasificacion) { p.revisar_clasificacion = false; evento(p.id, 'clasificacion_confirmada', null, null, { motivo: String(a.p_nota ?? '').trim().slice(0, 300) || null }, false, false); }
      return { estado: estado(p.id) };
    },
    pqrs_cerrar(a) {
      const p = tomar(a.p_id);
      soloAdmin(p.colegio_id, 'Solo el administrador general cierra las PQRS.');
      if (p.cerrado_en) return { estado: 'cerrada', igual: true };
      const mot = String(a.p_motivo ?? '').trim();
      if (mot.length < 3) fallo('Escribe la constancia del cierre.');
      const pend = nombresAreas(p.id, true);
      Object.assign(p, { cerrado_en: ahora(), cerrado_por: yo(), cierre_motivo: mot.slice(0, 1000) });
      evento(p.id, 'cerrada', null, null, { motivo: mot.slice(0, 1000), sin_responder: pend }, true);
      return { estado: 'cerrada', igual: false };
    },
    pqrs_reabrir(a) {
      const p = tomar(a.p_id);
      soloAdmin(p.colegio_id, 'Solo el administrador general reabre las PQRS.');
      if (!p.cerrado_en) return { estado: estado(p.id), igual: true };
      const mot = String(a.p_motivo ?? '').trim();
      if (mot.length < 3) fallo('Escribe por qué se reabre.');
      const anterior = p.cierre_motivo;
      Object.assign(p, { cerrado_en: null, cerrado_por: null, cierre_motivo: null });
      evento(p.id, 'reabierta', null, null, { motivo: mot.slice(0, 1000), cierre_anterior: anterior }, true);
      return { estado: estado(p.id), igual: false };
    },
    pqrs_resumen_salud(a) {
      const p = tomar(a.p_id), acc = acceso(p.id);
      if (!(acc.personal && acc.salud)) fallo('Solo Enfermería del caso o quien tenga el permiso de salud escribe este resumen.');
      abierto(p);
      const txt = largo(a.p_resumen, 3, 1000, 'Escribe el resumen (de 3 a 1000 caracteres), sin datos clínicos.');
      Object.assign(p, { resumen_coordinacion: txt, resumen_por: yo(), resumen_en: ahora() });
      evento(p.id, 'resumen', null, null, {}, false);
      return { ok: true };
    },
    pqrs_marcar_salud(a) {
      const p = tomar(a.p_id), acc = acceso(p.id);
      if (!acc.personal) fallo('Solo el personal del caso puede hacerlo.');
      abierto(p);
      if (p.sensible === a.p_sensible) return { sensible: p.sensible, igual: true };
      const mot = String(a.p_motivo ?? '').trim();
      if (mot.length < 3) fallo('Escribe el motivo.');
      if (!a.p_sensible && !acc.salud) fallo('Solo Enfermería del caso o quien tenga el permiso de salud puede quitar la marca de salud.');
      p.sensible = a.p_sensible;
      evento(p.id, 'salud', null, null, { sensible: a.p_sensible, motivo: mot.slice(0, 300) }, false, false);
      if (a.p_sensible) {
        const enf = areaClave(p.colegio_id, 'enfermeria');
        const s = asign(p.id).find((x) => x.area_id === enf.id);
        if (!s?.activa) {
          if (s) Object.assign(s, { activa: true, estado: 'pendiente', origen: 'manual', motivo: 'Marcado con información de salud', asignada_por: yo(), asignada_en: ahora(), retirada_por: null, retirada_en: null, retiro_motivo: null });
          else T('pqrs_asignaciones').push({ id: crypto.randomUUID(), colegio_id: p.colegio_id, pqrs_id: p.id, area_id: enf.id, estado: 'pendiente', activa: true, origen: 'manual', motivo: 'Marcado con información de salud', aporte_pendiente: false, asignada_por: yo(), asignada_en: ahora(), retirada_por: null, retirada_en: null, retiro_motivo: null, estado_por: null, estado_en: null });
          evento(p.id, 'asignada', enf.id, null, { motivo: 'Marcado con información de salud', sin_responsables: responsables(enf.id).length ? [] : ['Enfermería'] }, true);
        }
      }
      return { sensible: a.p_sensible, igual: false };
    },
    pqrs_config(a) {
      soloAdmin(a.p_colegio, 'Solo el administrador general configura las PQRS.');
      preparar(a.p_colegio);
      const c = a.p_colegio;
      const personal = [...new Set(T('miembros').filter((m) => m.colegio_id === c && m.activo !== false && PERSONAL.includes(m.rol)).map((m) => m.perfil_id))]
        .map((id) => ({ id, nombre: nombreDe(id), roles: T('miembros').filter((m) => m.colegio_id === c && m.perfil_id === id && m.activo !== false && PERSONAL.includes(m.rol)).map((m) => m.rol).sort() })).sort((x, y) => x.nombre.localeCompare(y.nombre));
      return copia({
        areas: T('pqrs_areas').filter((x) => x.colegio_id === c && x.activo).sort((x, y) => orden(x) - orden(y)).map((x) => ({ id: x.id, clave: x.clave, nombre: x.nombre, grados: x.grados,
          responsables: responsables(x.id).map((id) => ({ id, nombre: nombreDe(id) })).sort((u, v) => u.nombre.localeCompare(v.nombre)) })),
        grados: T('grados').filter((g) => g.colegio_id === c).sort((x, y) => x.orden - y.orden).map((g) => ({ id: g.id, nombre: g.nombre })),
        personal,
        permisos_salud: T('pqrs_permisos_salud').filter((s) => s.colegio_id === c).map((s) => ({ id: s.perfil_id, nombre: nombreDe(s.perfil_id), motivo: s.motivo, otorgado_por: nombreDe(s.otorgado_por), otorgado_en: s.otorgado_en })),
        avisos_pendientes: T('pqrs_avisos').filter((x) => x.colegio_id === c && x.estado !== 'enviado').length,
        historial: T('pqrs_config_historial').filter((h) => h.colegio_id === c).slice(-50).reverse().map((h) => ({ accion: h.accion, actor: nombreDe(h.actor_id), area: area(h.area_id)?.nombre ?? null, persona: nombreDe(h.perfil_id), detalle: h.detalle, creado_en: h.creado_en })),
      });
    },
    pqrs_responsable(a) {
      soloAdmin(a.p_colegio, 'Solo el administrador general asigna responsables.');
      const ar = T('pqrs_areas').find((x) => x.id === a.p_area && x.colegio_id === a.p_colegio);
      if (!ar) fallo('Esa área no es de este colegio.');
      const lista = T('pqrs_area_responsables');
      let cambio = false;
      if (a.p_agregar) {
        if (!T('miembros').some((m) => m.colegio_id === a.p_colegio && m.perfil_id === a.p_perfil && m.activo !== false && PERSONAL.includes(m.rol))) fallo('Solo el personal activo del colegio puede ser responsable de un área.');
        if (!lista.some((r) => r.area_id === ar.id && r.perfil_id === a.p_perfil)) { lista.push({ colegio_id: a.p_colegio, area_id: ar.id, perfil_id: a.p_perfil, asignado_por: yo(), asignado_en: ahora() }); cambio = true; }
      } else {
        const i = lista.findIndex((r) => r.area_id === ar.id && r.perfil_id === a.p_perfil);
        if (i >= 0) { lista.splice(i, 1); cambio = true; }
      }
      if (cambio) T('pqrs_config_historial').push({ id: Date.now(), colegio_id: a.p_colegio, actor_id: yo(), accion: a.p_agregar ? 'responsable_agregado' : 'responsable_quitado', area_id: ar.id, perfil_id: a.p_perfil, detalle: {}, creado_en: ahora() });
      return { cambio };
    },
    pqrs_grados_seccion(a) {
      soloAdmin(a.p_colegio, 'Solo el administrador general configura las secciones.');
      const ar = T('pqrs_areas').find((x) => x.id === a.p_area && x.colegio_id === a.p_colegio && x.clave.startsWith('seccion'));
      if (!ar) fallo('Esa área no es una sección de este colegio.');
      const g = [...new Set((a.p_grados || []).filter(Boolean))];
      if (g.some((id) => !T('grados').some((x) => x.id === id && x.colegio_id === a.p_colegio))) fallo('Hay grados que no son de este colegio.');
      const otro = T('pqrs_areas').find((x) => x.colegio_id === a.p_colegio && x.id !== ar.id && x.clave.startsWith('seccion') && x.grados.some((id) => g.includes(id)));
      if (otro) fallo('Uno de esos grados ya está en ' + otro.nombre + '.');
      const antes = ar.grados;
      ar.grados = g;
      T('pqrs_config_historial').push({ id: Date.now(), colegio_id: a.p_colegio, actor_id: yo(), accion: 'grados_seccion', area_id: ar.id, perfil_id: null, detalle: { antes, ahora: g }, creado_en: ahora() });
      return { grados: g };
    },
    pqrs_permiso_salud(a) {
      soloAdmin(a.p_colegio, 'Solo el administrador general da el permiso de salud.');
      const mot = String(a.p_motivo ?? '').trim();
      if (mot.length < 3) fallo('Escribe el motivo.');
      const lista = T('pqrs_permisos_salud');
      let cambio = false;
      if (a.p_otorgar) {
        if (!T('miembros').some((m) => m.colegio_id === a.p_colegio && m.perfil_id === a.p_perfil && m.activo !== false && PERSONAL.includes(m.rol))) fallo('Solo el personal activo del colegio puede tener este permiso.');
        if (!lista.some((s) => s.colegio_id === a.p_colegio && s.perfil_id === a.p_perfil)) { lista.push({ colegio_id: a.p_colegio, perfil_id: a.p_perfil, motivo: mot.slice(0, 300), otorgado_por: yo(), otorgado_en: ahora() }); cambio = true; }
      } else {
        const i = lista.findIndex((s) => s.colegio_id === a.p_colegio && s.perfil_id === a.p_perfil);
        if (i >= 0) { lista.splice(i, 1); cambio = true; }
      }
      if (cambio) T('pqrs_config_historial').push({ id: Date.now(), colegio_id: a.p_colegio, actor_id: yo(), accion: a.p_otorgar ? 'permiso_salud_dado' : 'permiso_salud_quitado', area_id: null, perfil_id: a.p_perfil, detalle: { motivo: mot.slice(0, 300) }, creado_en: ahora() });
      return { cambio };
    },
    pqrs_reintentar_avisos(a) {
      soloAdmin(a.p_colegio, 'Solo el administrador general reintenta los avisos.');
      const pend = () => T('pqrs_avisos').filter((x) => x.colegio_id === a.p_colegio && x.estado !== 'enviado');
      const antes = pend().length;
      for (const e of [...new Set(pend().map((x) => x.evento_id))].sort((x, y) => x - y)) enviar(e);
      const despues = pend().length;
      return { pendientes_antes: antes, enviados: antes - despues, con_error: despues };
    },
  };

  return (nombre, a) => {
    const f = F[nombre];
    if (!f) fallo(`La función ${nombre} no existe en el demo.`);
    const r = f(a || {});
    guardar();
    return copia(r);
  };
}
