// SER · conversación privada con Psicología en el MODO DEMO: las mismas reglas que la base (migración 20261116100000_ser_psicologia).
// Se carga la primera vez que se usa (db.js). Datos solo en este equipo. Desde el 16-nov-2026 escribe cualquier persona del colegio
// (migración 20261116110000_ser_todos_los_perfiles), salvo quien responde SER.
export function crearSerDemo({ tabla, usuario, guardar, ahora, err }) {
  const T = (n) => tabla(n);
  const yo = () => usuario();
  const fallo = (m, codigo) => err(codigo === '42501' ? m : m);
  const PERSONAL = ['admin', 'profesor', 'enfermeria', 'director_seccion'];
  const miembro = (c, uid = yo(), roles = null) => T('miembros').some((m) => m.colegio_id === c && m.perfil_id === uid && m.activo !== false && (!roles || roles.includes(m.rol)));
  const nombreDe = (uid) => { const p = T('perfiles').find((x) => x.id === uid); return p ? `${p.nombres || ''} ${p.apellidos || ''}`.trim() : ''; };
  const responsable = (c) => { const a = T('ser_ajustes').find((x) => x.colegio_id === c); return a?.responsable_id && miembro(c, a.responsable_id, PERSONAL) ? a.responsable_id : null; };
  const soyResp = (c) => !!yo() && responsable(c) === yo();
  const puedeEscribir = (c) => miembro(c) && !soyResp(c);
  const conv = (id) => T('ser_conversaciones').find((x) => x.id === id);
  const veo = (id) => { const c = conv(id); return !!c && ((c.perfil_id === yo() && puedeEscribir(c.colegio_id)) || soyResp(c.colegio_id)); };
  const leidoDe = (cid, uid = yo()) => T('ser_lecturas').find((l) => l.conversacion_id === cid && l.perfil_id === uid)?.leido_seq || 0;
  const json = (x) => ({ id: x.id, seq: x.seq, autor: x.autor_nombre, de_psicologia: x.de_psicologia, mio: x.autor_id === yo(), solicitud_id: x.autor_id === yo() ? x.solicitud_id : null, texto: x.texto, creado_en: x.creado_en });
  const quien = (c, uid) => {
    const m = T('miembros').filter((x) => x.colegio_id === c && x.perfil_id === uid && x.activo !== false);
    if (m.some((x) => x.rol === 'estudiante')) {
      const mat = T('matriculas').find((x) => x.estudiante_id === uid && x.estado === 'activa' && x.colegio_id === c);
      const cur = mat && T('cursos').find((x) => x.id === mat.curso_id);
      return 'Estudiante' + (cur ? ' · ' + cur.nombre : '');
    }
    if (m.some((x) => x.rol === 'acudiente')) {
      const hijos = T('acudientes').filter((a) => a.colegio_id === c && a.acudiente_id === uid).map((a) => nombreDe(a.estudiante_id)).filter(Boolean);
      return 'Acudiente' + (hijos.length ? ' de ' + hijos.join(', ') : '');
    }
    const CARGO = { admin: 'Administración', profesor: 'Docente', enfermeria: 'Enfermería', director_seccion: 'Dirección de sección' };
    return [...new Set(m.map((x) => CARGO[x.rol] || x.rol))].join(' · ');
  };
  const sinAcceso = () => fallo('No tienes acceso a esta conversación.');
  const leer = (cid, hasta) => {
    const c = conv(cid);
    let l = T('ser_lecturas').find((x) => x.conversacion_id === cid && x.perfil_id === yo());
    if (!l) { l = { conversacion_id: cid, perfil_id: yo(), leido_seq: 0, actualizado_en: ahora() }; T('ser_lecturas').push(l); }
    const v = Math.min(Math.max(Number(hasta) || 0, 0), c.ultimo_seq);
    if (v > l.leido_seq) { l.leido_seq = v; l.actualizado_en = ahora(); }
    return l.leido_seq;
  };

  const F = {
    ser_estado(a) {
      if (!miembro(a.p_colegio)) fallo('No tienes acceso a este colegio.');
      const r = responsable(a.p_colegio), soy = !!r && r === yo(), pe = puedeEscribir(a.p_colegio);
      const c = T('ser_conversaciones').find((x) => x.colegio_id === a.p_colegio && x.perfil_id === yo());
      const esAdmin = miembro(a.p_colegio, yo(), ['admin']);
      let sin = 0;
      if (soy) sin = T('ser_conversaciones').filter((k) => k.colegio_id === a.p_colegio && k.perfil_id !== yo()).reduce((n, k) => n + T('ser_mensajes').filter((x) => x.conversacion_id === k.id && !x.de_psicologia && x.seq > leidoDe(k.id)).length, 0);
      else if (c && pe) sin = T('ser_mensajes').filter((x) => x.conversacion_id === c.id && x.de_psicologia && x.seq > leidoDe(c.id)).length;
      return { responsable: r ? nombreDe(r) : null, soy_responsable: soy, puedo_escribir: pe, admin: esAdmin, conversacion: c && pe ? c.id : null, sin_leer: sin };
    },
    ser_abrir(a) {
      if (soyResp(a.p_colegio)) fallo('Tú respondes SER: las conversaciones están en tu bandeja.');
      if (!puedeEscribir(a.p_colegio)) fallo('SER es para las personas del colegio.');
      if (!responsable(a.p_colegio)) fallo('SER aún no tiene a alguien de Psicología designado. Pronto podrás escribir.');
      let c = T('ser_conversaciones').find((x) => x.colegio_id === a.p_colegio && x.perfil_id === yo());
      if (!c) { c = { id: crypto.randomUUID(), colegio_id: a.p_colegio, perfil_id: yo(), ultimo_seq: 0, ultimo_en: null, creada_en: ahora() }; T('ser_conversaciones').push(c); guardar(); }
      return { id: c.id };
    },
    ser_mensajes(a) {
      if (!veo(a.p_conv)) sinAcceso();
      const c = conv(a.p_conv), lim = Math.min(Math.max(Number(a.p_limite) || 100, 1), 200);
      const todos = T('ser_mensajes').filter((x) => x.conversacion_id === c.id && (a.p_desde == null || x.seq > a.p_desde)).sort((x, z) => x.seq - z.seq);
      const tramo = todos.slice(-lim);
      const otros = T('ser_lecturas').filter((l) => l.conversacion_id === c.id && l.perfil_id !== yo()).map((l) => l.leido_seq);
      return { conversacion: { id: c.id, de: nombreDe(c.perfil_id), quien: quien(c.colegio_id, c.perfil_id), mia: c.perfil_id === yo() },
        responsable: nombreDe(responsable(c.colegio_id)), mensajes: tramo.map(json), ultimo_seq: c.ultimo_seq,
        leido_seq: T('ser_lecturas').find((l) => l.conversacion_id === c.id && l.perfil_id === yo())?.leido_seq ?? null,
        leido_otro: otros.length ? Math.max(...otros) : 0, hay_anteriores: tramo.length < todos.length };
    },
    ser_enviar(a) {
      if (!veo(a.p_conv)) sinAcceso();
      if (!a.p_solicitud) fallo('Falta la identificación del envío.');
      const c = conv(a.p_conv);
      const ya = T('ser_mensajes').find((x) => x.conversacion_id === c.id && x.solicitud_id === a.p_solicitud);
      if (ya) { if (ya.autor_id !== yo()) fallo('Ese envío es de otra persona.'); return json(ya); }
      if (!responsable(c.colegio_id)) fallo('SER no tiene a alguien de Psicología designado en este momento.');
      const txt = String(a.p_texto ?? '').trim();
      if (txt.length < 1 || txt.length > 4000) fallo('Escribe el mensaje (máximo 4000 caracteres).');
      c.ultimo_seq += 1; c.ultimo_en = ahora();
      const x = { id: crypto.randomUUID(), colegio_id: c.colegio_id, conversacion_id: c.id, seq: c.ultimo_seq, autor_id: yo(), autor_nombre: nombreDe(yo()), de_psicologia: c.perfil_id !== yo(), texto: txt, solicitud_id: a.p_solicitud, creado_en: ahora() };
      T('ser_mensajes').push(x);
      leer(c.id, x.seq);
      guardar();
      return json(x);
    },
    ser_marcar_leido(a) {
      if (!veo(a.p_conv)) sinAcceso();
      const v = leer(a.p_conv, a.p_hasta); guardar();
      return { leido_seq: v, ultimo_seq: conv(a.p_conv).ultimo_seq };
    },
    ser_bandeja(a) {
      if (!soyResp(a.p_colegio)) fallo('Solo quien responde SER en el colegio ve estas conversaciones.');
      return T('ser_conversaciones').filter((c) => c.colegio_id === a.p_colegio && c.ultimo_seq > 0 && c.perfil_id !== yo()).sort((x, z) => String(z.ultimo_en).localeCompare(String(x.ultimo_en))).map((c) => {
        const ult = T('ser_mensajes').filter((x) => x.conversacion_id === c.id).sort((x, z) => z.seq - x.seq)[0];
        return { id: c.id, de: nombreDe(c.perfil_id), quien: quien(a.p_colegio, c.perfil_id), ultimo_en: c.ultimo_en,
          ultimo: ult ? { texto: ult.texto.slice(0, 140), de_psicologia: ult.de_psicologia } : null,
          sin_leer: T('ser_mensajes').filter((x) => x.conversacion_id === c.id && !x.de_psicologia && x.seq > leidoDe(c.id)).length };
      });
    },
    ser_responsable_guardar(a) {
      if (!miembro(a.p_colegio, yo(), ['admin'])) fallo('Solo el administrador designa quién responde SER.');
      if (a.p_perfil && !miembro(a.p_colegio, a.p_perfil, PERSONAL)) fallo('Quien responde SER debe ser del personal activo del colegio (no un estudiante ni un acudiente).');
      let x = T('ser_ajustes').find((s) => s.colegio_id === a.p_colegio);
      const antes = x?.responsable_id || null;
      if (!x) { x = { colegio_id: a.p_colegio }; T('ser_ajustes').push(x); }
      Object.assign(x, { responsable_id: a.p_perfil || null, actualizado_por: yo(), actualizado_en: ahora() });
      if (antes !== (a.p_perfil || null)) T('ser_historial').push({ id: T('ser_historial').length + 1, colegio_id: a.p_colegio, actor_id: yo(), accion: 'designar', detalle: { antes, despues: a.p_perfil || null }, creado_en: ahora() });
      guardar();
      return { responsable_id: a.p_perfil || null, responsable: a.p_perfil ? nombreDe(a.p_perfil) : null };
    },
    ser_responsable_ver(a) {
      if (!miembro(a.p_colegio, yo(), ['admin'])) fallo('Solo el administrador ve esta configuración.');
      const x = T('ser_ajustes').find((s) => s.colegio_id === a.p_colegio), r = responsable(a.p_colegio);
      return { responsable_id: r, responsable: r ? nombreDe(r) : '', actualizado_en: x?.actualizado_en || null, actualizado_por: x?.actualizado_por ? nombreDe(x.actualizado_por) : '' };
    },
  };
  return (nombre, a = {}) => { if (!F[nombre]) fallo('Función no disponible en el demo: ' + nombre); return F[nombre](a); };
}
