// PQRS en el modo demo (datos ficticios en el equipo). Copia las funciones de la base (20261028200000_pqrs.sql) con las mismas
// reglas, permisos y mensajes, y usa el mismo clasificador (pqrs_reglas.js). Los avisos llegan a la Mensajería del demo.
// En el demo algunas áreas ya tienen responsables (personas ficticias) para poder probar; las secciones quedan sin grados
// (el administrador los marca, igual que en el colegio real).
import { AREAS, analizar, decidir, motivos as motivosDe, estadoGeneral, TIPOS } from './pqrs_reglas.js';

const ESTADO_TXT = { pendiente_clasificacion: 'Pendiente de clasificación', pendiente: 'Pendiente', en_atencion: 'En atención', respuesta_parcial: 'Respuesta parcial', respondida: 'Respondida', cerrada: 'Cerrada' };
const PERSONAL = ['admin', 'profesor', 'enfermeria', 'director_seccion'];

export function crearPqrsDemo({ tabla, usuario, guardar, copia, ahora, err }) {
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
    for (const d of new Set(dest)) {
      if (!d || d === e.actor_id || !miembroActivo(p.colegio_id, d)) continue;
      if (T('pqrs_avisos').some((a) => a.evento_id === eventoId && a.perfil_id === d)) continue;
      T('pqrs_avisos').push({ evento_id: eventoId, perfil_id: d, colegio_id: p.colegio_id, pqrs_id: p.id, vista: admins.includes(d) ? 'admin' : staff.includes(d) || delArea.includes(d) ? 'area' : 'solicitante',
        estado: 'pendiente', mensaje_id: null, error: null, intentos: 0, creado_en: ahora(), enviado_en: null });
    }
    enviar(eventoId);
  };
  let nEvento = Math.max(0, ...T('pqrs_eventos').map((e) => e.id));
  const evento = (pid, tipo, areaId = null, intervencion = null, detalle = {}, publico = false, conAviso = true) => {
    const p = caso(pid);
    const e = { id: ++nEvento, colegio_id: p.colegio_id, pqrs_id: pid, tipo, actor_id: yo(), actor_nombre: nombreDe(yo()) || '', area_id: areaId, intervencion_id: intervencion, detalle: detalle || {}, publico, creado_en: ahora() };
    T('pqrs_eventos').push(e);
    if (tipo !== 'leida') p.actualizado_en = ahora();
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
    pqrs_responder(a) {
      const p = tomar(a.p_id);
      if (!a.p_solicitud) fallo('Falta la identificación del envío.');
      const ya = yaEnviada(p, a.p_solicitud);
      if (ya) return { id: ya.id, repetido: true, estado: estado(p.id) };
      abierto(p);
      if (!misAreas(p.id).includes(a.p_area)) fallo('Solo los responsables de esa área responden en su nombre.');
      const txt = largo(a.p_contenido, 1, 5000, 'Escribe la respuesta (hasta 5000 caracteres).');
      let salud = a.p_salud ?? (area(a.p_area)?.clave === 'enfermeria' && p.sensible);
      if (salud && !veSalud(p.id)) salud = false;
      const i = nuevaIntervencion(p, 'respuesta', a.p_area, txt, salud, a.p_solicitud);
      Object.assign(asign(p.id).find((x) => x.area_id === a.p_area), { estado: 'respondida', aporte_pendiente: false, estado_por: yo(), estado_en: ahora() });
      evento(p.id, 'respuesta', a.p_area, i.id, {}, true);
      return { id: i.id, repetido: false, estado: estado(p.id) };
    },
    pqrs_comentar(a) {
      const p = tomar(a.p_id);
      if (!a.p_solicitud) fallo('Falta la identificación del envío.');
      const ya = yaEnviada(p, a.p_solicitud);
      if (ya) return { id: ya.id, repetido: true, estado: estado(p.id) };
      abierto(p);
      if (!a.p_area) { if (!esAdmin(p.colegio_id)) fallo('Elige el área en cuyo nombre comentas.'); }
      else if (!misAreas(p.id).includes(a.p_area)) fallo('Solo los responsables de esa área comentan en su nombre.');
      const txt = largo(a.p_contenido, 1, 5000, 'Escribe el comentario (hasta 5000 caracteres).');
      let salud = a.p_salud ?? (area(a.p_area)?.clave === 'enfermeria' && p.sensible);
      if (salud && !veSalud(p.id)) salud = false;
      const i = nuevaIntervencion(p, 'comentario', a.p_area || null, txt, salud, a.p_solicitud);
      let paso = false;
      if (a.p_area) { const s = asign(p.id).find((x) => x.area_id === a.p_area); if (s.estado === 'pendiente') { Object.assign(s, { estado: 'en_revision', estado_por: yo(), estado_en: ahora() }); paso = true; } }
      evento(p.id, 'comentario', a.p_area || null, i.id, { paso_a_revision: paso }, false);
      return { id: i.id, repetido: false, estado: estado(p.id) };
    },
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
    pqrs_aportar(a) {
      const p = tomar(a.p_id);
      if (p.solicitante_id !== yo()) fallo('Solo quien presentó la PQRS puede aportar información.');
      if (!a.p_solicitud) fallo('Falta la identificación del envío.');
      const ya = yaEnviada(p, a.p_solicitud);
      if (ya) return { id: ya.id, repetido: true };
      if (p.cerrado_en) fallo('El caso está cerrado: si necesitas algo más, presenta una PQRS nueva.');
      const txt = largo(a.p_contenido, 3, 5000, 'Escribe la información (de 3 a 5000 caracteres).');
      const i = nuevaIntervencion(p, 'aporte', null, txt, p.sensible, a.p_solicitud);
      for (const s of activas(p.id)) s.aporte_pendiente = true;
      evento(p.id, 'aporte', null, i.id, {}, true);
      return { id: i.id, repetido: false };
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
