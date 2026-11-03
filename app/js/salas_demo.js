// Salas de sección y avisos en el MODO DEMO: las mismas reglas que la base (migración 20261103150000_salas_avisos). Se carga la
// primera vez que se usa (db.js). Datos solo en este equipo.
export function crearSalasDemo({ tabla, usuario, guardar, ahora, err }) {
  const T = (n) => tabla(n);
  const yo = () => usuario();
  const fallo = (m) => err(m);
  const ROL_PERSONAL = ['admin', 'profesor', 'director_seccion', 'enfermeria'];
  const miembroColegio = (c, uid = yo()) => T('miembros').some((m) => m.colegio_id === c && m.perfil_id === uid && m.activo !== false);
  const esAdmin = (c) => T('miembros').some((m) => m.colegio_id === c && m.perfil_id === yo() && m.rol === 'admin' && m.activo !== false);
  const sala = (id) => T('salas').find((s) => s.id === id);
  const soyMiembro = (sid) => { const s = sala(sid); return !!s && s.activa !== false && miembroColegio(s.colegio_id) && T('sala_miembros').some((m) => m.sala_id === sid && m.perfil_id === yo() && m.activo); };
  const puedePublicar = (sid) => { const s = sala(sid); return !!s && s.activa !== false && (esAdmin(s.colegio_id) || (miembroColegio(s.colegio_id) && T('sala_miembros').some((m) => m.sala_id === sid && m.perfil_id === yo() && m.activo && m.puede_publicar))); };
  const veAvisos = (sid) => soyMiembro(sid) || (!!sala(sid) && esAdmin(sala(sid).colegio_id));
  const nombreDe = (uid) => { const p = T('perfiles').find((x) => x.id === uid); return p ? `${p.nombres || ''} ${p.apellidos || ''}`.trim() : ''; };
  const historia = (c, sid, aid, accion, detalle = {}) => T('sala_historial').push({ id: T('sala_historial').length + 1, colegio_id: c, sala_id: sid, aviso_id: aid, actor_id: yo(), accion, detalle, creado_en: ahora() });
  const vigente = (a) => a.estado === 'publicado' && a.inicio <= ahora() && ahora() < a.fin;
  const PRIO = { urgente: 0, importante: 1, normal: 2 };
  const avisoJson = (a) => ({
    id: a.id, sala_id: a.sala_id, autor: a.autor_nombre, mio: a.autor_id === yo(), titulo: a.titulo, contenido: a.contenido, prioridad: a.prioridad, inicio: a.inicio, fin: a.fin,
    estado: a.estado, version: a.version, editado: a.version > 1, actualizado_en: a.actualizado_en, vigente: vigente(a),
    comentarios: T('aviso_comentarios').filter((c) => c.aviso_id === a.id).length,
    visto_por_mi: T('aviso_vistas').some((v) => v.aviso_id === a.id && v.perfil_id === yo() && v.version === a.version),
    puede_editar: a.estado === 'publicado' && (esAdmin(a.colegio_id) || (a.autor_id === yo() && puedePublicar(a.sala_id))),
  });
  const mensajeJson = (x) => ({ id: x.id, seq: x.seq, autor: x.autor_nombre, mio: x.autor_id === yo(), solicitud_id: x.autor_id === yo() ? x.solicitud_id : null, texto: x.texto, creado_en: x.creado_en,
    aviso: x.aviso_id && T('avisos').find((a) => a.id === x.aviso_id) ? avisoJson(T('avisos').find((a) => a.id === x.aviso_id)) : null });
  const sinAcceso = () => fallo('No tienes acceso a esta sala.');
  const avisoDe = (id) => { const a = T('avisos').find((x) => x.id === id); if (!a || !veAvisos(a.sala_id)) fallo('Ese aviso no existe o no tienes acceso.'); return a; };
  const largo = (t, min, max) => { const v = String(t ?? '').trim(); return v.length >= min && v.length <= max ? v : null; };
  const vigencia = (ini, fin) => { if (!fin) fallo('Indica hasta cuándo está vigente el aviso.'); if (!(fin > ini) || new Date(fin) - new Date(ini) > 60 * 86400000) fallo('La vigencia debe terminar después del inicio y durar como máximo 60 días.'); };
  const iso = (x) => (x ? new Date(x).toISOString() : null);
  const anunciar = (s, a) => { s.ultimo_seq = (s.ultimo_seq || 0) + 1; T('sala_mensajes').push({ id: crypto.randomUUID(), colegio_id: s.colegio_id, sala_id: s.id, seq: s.ultimo_seq, autor_id: yo(), autor_nombre: nombreDe(yo()), texto: '', aviso_id: a.id, solicitud_id: crypto.randomUUID(), creado_en: ahora() }); };

  const F = {
    salas_preparar(a) {
      if (!esAdmin(a.p_colegio)) fallo('Solo el administrador prepara las salas.');
      for (const [clave, nombre] of [['seccion_infantil', 'Sección Infantil'], ['seccion_prejuvenil', 'Sección Prejuvenil'], ['seccion_juvenil', 'Sección Juvenil']]) {
        if (!T('salas').some((s) => s.colegio_id === a.p_colegio && s.clave === clave)) T('salas').push({ id: crypto.randomUUID(), colegio_id: a.p_colegio, clave, nombre, activa: true, ultimo_seq: 0, creada_en: ahora() });
      }
      return F.salas_mias(a);
    },
    salas_mias(a) {
      if (!miembroColegio(a.p_colegio)) fallo('No tienes acceso a este colegio.');
      const adm = esAdmin(a.p_colegio);
      return T('salas').filter((s) => s.colegio_id === a.p_colegio && s.activa !== false && (adm || soyMiembro(s.id))).sort((x, z) => x.clave.localeCompare(z.clave)).map((s) => {
        const miembro = soyMiembro(s.id), leido = T('sala_lecturas').find((l) => l.sala_id === s.id && l.perfil_id === yo())?.leido_seq ?? 0;
        return { id: s.id, clave: s.clave, nombre: s.nombre, miembro, puede_publicar: puedePublicar(s.id), admin: adm,
          sin_leer: miembro ? T('sala_mensajes').filter((x) => x.sala_id === s.id && x.autor_id !== yo() && x.seq > leido).length : 0,
          avisos_vigentes: T('avisos').filter((x) => x.sala_id === s.id && vigente(x)).length,
          miembros: adm ? T('sala_miembros').filter((m) => m.sala_id === s.id && m.activo).length : null };
      });
    },
    sala_miembros_ver(a) {
      const s = sala(a.p_sala);
      if (!s || !(soyMiembro(s.id) || esAdmin(s.colegio_id))) sinAcceso();
      return T('sala_miembros').filter((m) => m.sala_id === s.id && (m.activo || esAdmin(s.colegio_id)))
        .map((m) => ({ perfil_id: m.perfil_id, nombre: nombreDe(m.perfil_id), puede_publicar: m.puede_publicar, activo: m.activo && miembroColegio(s.colegio_id, m.perfil_id) }))
        .sort((x, z) => x.nombre.localeCompare(z.nombre));
    },
    sala_miembro_guardar(a) {
      const s = sala(a.p_sala);
      if (!s || !esAdmin(s.colegio_id)) fallo('Solo el administrador define quién está en cada sala.');
      const activo = a.p_activo !== false, publica = !!a.p_puede_publicar;
      if (activo && !T('miembros').some((m) => m.colegio_id === s.colegio_id && m.perfil_id === a.p_perfil && m.activo !== false && ROL_PERSONAL.includes(m.rol))) fallo('Solo el personal activo del colegio puede estar en una sala de sección.');
      const antes = T('sala_miembros').find((m) => m.sala_id === s.id && m.perfil_id === a.p_perfil);
      if (antes) Object.assign(antes, { activo, puede_publicar: publica });
      else T('sala_miembros').push({ colegio_id: s.colegio_id, sala_id: s.id, perfil_id: a.p_perfil, puede_publicar: publica, activo, agregado_por: yo(), agregado_en: ahora() });
      historia(s.colegio_id, s.id, null, !activo ? 'miembro_quitado' : !antes || !antes.activo ? 'miembro_agregado' : 'permiso_cambiado', { perfil: a.p_perfil, puede_publicar: publica });
      guardar();
      return F.sala_miembros_ver({ p_sala: s.id });
    },
    sala_mensajes(a) {
      if (!soyMiembro(a.p_sala)) sinAcceso();
      const s = sala(a.p_sala), lim = Math.min(Math.max(a.p_limite || 50, 1), 200);
      const todos = T('sala_mensajes').filter((x) => x.sala_id === s.id).sort((x, z) => x.seq - z.seq);
      const elegidos = todos.filter((x) => (a.p_desde == null || x.seq > a.p_desde) && (a.p_antes == null || x.seq < a.p_antes)).slice(-lim);
      const min = elegidos[0]?.seq;
      return { sala: { id: s.id, nombre: s.nombre }, mensajes: elegidos.map(mensajeJson), ultimo_seq: s.ultimo_seq || 0,
        leido_seq: T('sala_lecturas').find((l) => l.sala_id === s.id && l.perfil_id === yo())?.leido_seq ?? null, hay_anteriores: min != null && todos.some((x) => x.seq < min) };
    },
    sala_enviar(a) {
      if (!soyMiembro(a.p_sala)) sinAcceso();
      if (!a.p_solicitud) fallo('Falta la identificación del envío.');
      const s = sala(a.p_sala), ya = T('sala_mensajes').find((x) => x.sala_id === s.id && x.solicitud_id === a.p_solicitud);
      if (ya) { if (ya.autor_id !== yo()) fallo('Ese envío es de otra persona.'); return mensajeJson(ya); }
      const txt = largo(a.p_texto, 1, 4000);
      if (!txt) fallo('Escribe el mensaje (máximo 4000 caracteres).');
      s.ultimo_seq = (s.ultimo_seq || 0) + 1;
      const x = { id: crypto.randomUUID(), colegio_id: s.colegio_id, sala_id: s.id, seq: s.ultimo_seq, autor_id: yo(), autor_nombre: nombreDe(yo()), texto: txt, aviso_id: null, solicitud_id: a.p_solicitud, creado_en: ahora() };
      T('sala_mensajes').push(x); guardar();
      return mensajeJson(x);
    },
    sala_marcar_leido(a) {
      if (!soyMiembro(a.p_sala)) sinAcceso();
      const s = sala(a.p_sala), hasta = Math.min(Math.max(Number(a.p_hasta) || 0, 0), s.ultimo_seq || 0);
      let l = T('sala_lecturas').find((x) => x.sala_id === s.id && x.perfil_id === yo());
      if (!l) T('sala_lecturas').push((l = { sala_id: s.id, perfil_id: yo(), leido_seq: hasta, actualizado_en: ahora() }));
      else if (hasta > l.leido_seq) Object.assign(l, { leido_seq: hasta, actualizado_en: ahora() });
      guardar();
      return { leido_seq: l.leido_seq, ultimo_seq: s.ultimo_seq || 0 };
    },
    aviso_publicar(a) {
      if (!puedePublicar(a.p_sala)) fallo('No puedes publicar avisos en esta sala.');
      if (!a.p_solicitud) fallo('Falta la identificación del envío.');
      const s = sala(a.p_sala), ya = T('avisos').find((x) => x.sala_id === s.id && x.solicitud_id === a.p_solicitud);
      if (ya) return avisoJson(ya);
      const ini = iso(a.p_inicio) || ahora(), fin = iso(a.p_fin);
      vigencia(ini, fin);
      if (!['normal', 'importante', 'urgente'].includes(a.p_prioridad || 'normal')) fallo('Prioridad no válida.');
      const titulo = largo(a.p_titulo, 3, 140), contenido = largo(a.p_contenido, 1, 4000);
      if (!titulo || !contenido) fallo('Escribe el título y el contenido del aviso.');
      const av = { id: crypto.randomUUID(), colegio_id: s.colegio_id, sala_id: s.id, autor_id: yo(), autor_nombre: nombreDe(yo()), titulo, contenido, prioridad: a.p_prioridad || 'normal',
        inicio: ini, fin, estado: 'publicado', version: 1, solicitud_id: a.p_solicitud, creado_en: ahora(), actualizado_en: ahora(), editado_por: null, retirado_por: null, retirado_en: null };
      T('avisos').push(av);
      historia(s.colegio_id, s.id, av.id, 'aviso_publicado', { prioridad: av.prioridad, inicio: av.inicio, fin: av.fin });
      if (a.p_anunciar !== false) anunciar(s, av);
      guardar();
      return avisoJson(av);
    },
    aviso_editar(a) {
      const av = avisoDe(a.p_id);
      if (!(esAdmin(av.colegio_id) || (av.autor_id === yo() && puedePublicar(av.sala_id)))) fallo('Solo su autor o el administrador editan el aviso.');
      if (av.estado !== 'publicado') fallo('El aviso fue retirado: no se edita.');
      if (a.p_version !== av.version) fallo('Otra persona editó el aviso mientras lo tenías abierto: vuelve a abrirlo para ver la versión actual.');
      const ini = iso(a.p_inicio) || av.inicio, fin = iso(a.p_fin);
      vigencia(ini, fin);
      if (!['normal', 'importante', 'urgente'].includes(a.p_prioridad || av.prioridad)) fallo('Prioridad no válida.');
      const titulo = largo(a.p_titulo, 3, 140), contenido = largo(a.p_contenido, 1, 4000);
      if (!titulo || !contenido) fallo('Escribe el título y el contenido del aviso.');
      T('aviso_versiones').push({ aviso_id: av.id, version: av.version, titulo: av.titulo, contenido: av.contenido, prioridad: av.prioridad, inicio: av.inicio, fin: av.fin, editado_por: av.editado_por, editado_en: av.actualizado_en });
      Object.assign(av, { titulo, contenido, prioridad: a.p_prioridad || av.prioridad, inicio: ini, fin, version: av.version + 1, actualizado_en: ahora(), editado_por: yo() });
      historia(av.colegio_id, av.sala_id, av.id, 'aviso_editado', { version: av.version });
      guardar();
      return avisoJson(av);
    },
    aviso_retirar(a) {
      const av = avisoDe(a.p_id);
      if (!(esAdmin(av.colegio_id) || (av.autor_id === yo() && puedePublicar(av.sala_id)))) fallo('Solo su autor o el administrador retiran el aviso.');
      if (av.estado === 'retirado') return { ...avisoJson(av), igual: true };
      if (!largo(a.p_motivo, 3, 1000)) fallo('Escribe el motivo del retiro.');
      Object.assign(av, { estado: 'retirado', retirado_por: yo(), retirado_en: ahora(), actualizado_en: ahora() });
      historia(av.colegio_id, av.sala_id, av.id, 'aviso_retirado', { motivo: String(a.p_motivo).trim().slice(0, 300) });
      guardar();
      return avisoJson(av);
    },
    avisos_ver(a) {
      if (!miembroColegio(a.p_colegio)) fallo('No tienes acceso a este colegio.');
      if (a.p_sala && !veAvisos(a.p_sala)) sinAcceso();
      return T('avisos').filter((x) => x.colegio_id === a.p_colegio && (!a.p_sala || x.sala_id === a.p_sala) && veAvisos(x.sala_id) && (a.p_pasados || vigente(x)))
        .sort((x, z) => (vigente(z) - vigente(x)) || PRIO[x.prioridad] - PRIO[z.prioridad] || (x.inicio < z.inicio ? 1 : -1))
        .map((x) => ({ ...avisoJson(x), sala: sala(x.sala_id)?.nombre }));
    },
    aviso_detalle(a) {
      const av = avisoDe(a.p_id), gestiona = esAdmin(av.colegio_id) || av.autor_id === yo();
      return { ...avisoJson(av), sala: sala(av.sala_id)?.nombre, retirado_en: av.retirado_en,
        comentarios_lista: T('aviso_comentarios').filter((c) => c.aviso_id === av.id).sort((x, z) => (x.creado_en < z.creado_en ? -1 : 1)).map((c) => ({ id: c.id, autor: c.autor_nombre, mio: c.autor_id === yo(), texto: c.texto, creado_en: c.creado_en })),
        versiones: T('aviso_versiones').filter((v) => v.aviso_id === av.id).sort((x, z) => x.version - z.version)
          .map((v) => ({ version: v.version, titulo: v.titulo, contenido: v.contenido, prioridad: v.prioridad, inicio: v.inicio, fin: v.fin, editado_en: v.editado_en, por: v.editado_por ? nombreDe(v.editado_por) : null })),
        vistas: gestiona ? T('aviso_vistas').filter((v) => v.aviso_id === av.id && v.version === av.version).length : null,
        miembros: gestiona ? T('sala_miembros').filter((m) => m.sala_id === av.sala_id && m.activo).length : null };
    },
    aviso_comentar(a) {
      const av = avisoDe(a.p_id);
      if (!a.p_solicitud) fallo('Falta la identificación del envío.');
      const ya = T('aviso_comentarios').find((c) => c.aviso_id === av.id && c.solicitud_id === a.p_solicitud);
      if (ya) return { id: ya.id, autor: ya.autor_nombre, mio: true, texto: ya.texto, creado_en: ya.creado_en };
      if (av.estado !== 'publicado') fallo('El aviso fue retirado: ya no admite comentarios.');
      const txt = largo(a.p_texto, 1, 2000);
      if (!txt) fallo('Escribe el comentario (máximo 2000 caracteres).');
      const c = { id: crypto.randomUUID(), colegio_id: av.colegio_id, aviso_id: av.id, autor_id: yo(), autor_nombre: nombreDe(yo()), texto: txt, solicitud_id: a.p_solicitud, creado_en: ahora() };
      T('aviso_comentarios').push(c); guardar();
      return { id: c.id, autor: c.autor_nombre, mio: true, texto: c.texto, creado_en: c.creado_en };
    },
    aviso_marcar_visto(a) {
      const av = avisoDe(a.p_id);
      const v = T('aviso_vistas').find((x) => x.aviso_id === av.id && x.perfil_id === yo());
      if (!v) T('aviso_vistas').push({ aviso_id: av.id, perfil_id: yo(), version: av.version, visto_en: ahora() });
      else if (av.version > v.version) Object.assign(v, { version: av.version, visto_en: ahora() });
      guardar();
      return { version: av.version };
    },
  };
  return (nombre, a = {}) => { if (!F[nombre]) fallo('Función no disponible en el demo: ' + nombre); return F[nombre](a); };
}
