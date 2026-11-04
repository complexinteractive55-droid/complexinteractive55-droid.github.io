// Modo demo: las mismas reglas que la base para la circular enviada a la bandeja y la mensajería resuelta en el servidor
// (supabase/migrations/20261104100000_circular_envio_bandeja.sql y 20261104110000_mensajeria_servidor_mis_docentes.sql).
// Datos ficticios en el navegador; nada sale del equipo.
export function crearEnviosDemo({ tabla, usuario, guardar, ahora, err, esAdmin, contactos, emitir, existeArchivo, emisorCirc }) {
  // «Enviar» (20261105120000): Administración, o quien fue designado en un área (solo SU circular de SU área)
  const envia = (col) => esAdmin(col) || !!emisorCirc?.(col)?.area_id;
  const enviaBorrador = (b) => esAdmin(b.colegio_id) || (b.autor_id === usuario() && !!b.area_id && emisorCirc?.(b.colegio_id)?.area_id === b.area_id);
  const activo = (col, pid, rol) => tabla('miembros').some((m) => m.colegio_id === col && m.perfil_id === pid && m.activo !== false && (!rol || m.rol === rol));
  const miembro = (col, pid) => tabla('miembros').some((m) => m.colegio_id === col && m.perfil_id === pid);
  const huella = (ids) => { let h = 0x811c9dc5; for (const ch of [...ids].sort().join(',')) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0; return 'demo' + h.toString(16).padStart(8, '0') + ids.length; };
  const msg = (m, extra = {}) => Object.assign(new Error(m), extra);

  // ------------------------------------------------ Audiencia (private.audiencia_resolver)
  function resolver(col, c) {
    if (!c || typeof c !== 'object') err('Falta el colegio o la selección de destinatarios.');
    const roles = [...new Set(c.roles || [])], alcance = c.alcance || 'colegio', ids = [...new Set(c.ids || [])], personas = [...new Set(c.personas || [])];
    if (roles.some((r) => !['estudiante', 'profesor', 'acudiente', 'director_seccion', 'enfermeria', 'admin'].includes(r))) err('Hay un grupo de destinatarios que no existe.');
    if (!['colegio', 'sede', 'grado', 'curso'].includes(alcance)) err('El alcance debe ser todo el colegio, sedes, grados o cursos.');
    if (alcance !== 'colegio' && !ids.length) err('Elige al menos una sede, un grado o un curso.');
    if (alcance !== 'colegio' && roles.some((r) => !['estudiante', 'profesor', 'acudiente'].includes(r))) err('Con sedes, grados o cursos se eligen estudiantes, docentes o acudientes; al personal de apoyo agrégalo por persona.');
    if (!roles.length && !personas.length) err('Elige a quién enviar.');
    const t = { sede: 'sedes', grado: 'grados', curso: 'cursos' }[alcance];
    if (t && ids.some((i) => !tabla(t).some((x) => x.id === i && x.colegio_id === col))) err('Ese alcance no es de este colegio.');
    const cursos = new Set(tabla('cursos').filter((x) => x.colegio_id === col && ((alcance === 'sede' && ids.includes(x.sede_id)) || (alcance === 'grado' && ids.includes(x.grado_id)) || (alcance === 'curso' && ids.includes(x.id)))).map((x) => x.id));
    const mats = tabla('matriculas').filter((x) => x.colegio_id === col && (x.estado || 'activa') === 'activa');
    const cand = [];
    const add = (pid, via, ok, no) => pid && cand.push({ pid, via, ok, no });
    if (alcance === 'colegio') {
      for (const m of tabla('miembros').filter((x) => x.colegio_id === col && roles.includes(x.rol))) {
        const vigente = m.rol !== 'estudiante' || mats.some((x) => x.estudiante_id === m.perfil_id);
        add(m.perfil_id, m.rol, m.activo !== false && vigente, m.activo === false ? 'Membresía inactiva o revocada' : 'Sin matrícula vigente');
      }
    } else {
      const enAlc = mats.filter((x) => cursos.has(x.curso_id));
      if (roles.includes('estudiante')) enAlc.forEach((x) => add(x.estudiante_id, 'estudiante', activo(col, x.estudiante_id, 'estudiante'), 'Membresía inactiva o revocada'));
      if (roles.includes('profesor')) {
        const doc = new Set([...tabla('asignaciones').filter((a) => a.colegio_id === col && cursos.has(a.curso_id) && a.profesor_id).map((a) => a.profesor_id),
          ...tabla('cursos').filter((x) => cursos.has(x.id) && x.director_id).map((x) => x.director_id)]);
        doc.forEach((pid) => add(pid, 'profesor', activo(col, pid, 'profesor'), 'Membresía inactiva o revocada'));
      }
      if (roles.includes('acudiente')) for (const x of enAlc) tabla('acudientes').filter((a) => a.colegio_id === col && a.estudiante_id === x.estudiante_id)
        .forEach((a) => add(a.acudiente_id, 'acudiente', activo(col, a.acudiente_id, 'acudiente'), 'Membresía inactiva o revocada'));
    }
    for (const pid of personas) add(pid, 'individual', activo(col, pid), miembro(col, pid) ? 'Membresía inactiva o revocada' : 'No pertenece a este colegio');
    const por = new Map();
    for (const x of cand) { const g = por.get(x.pid) || { ok: [], todas: new Set(), alguno: false, no: null }; g.todas.add(x.via); if (x.ok) { g.ok.push(x.via); g.alguno = true; } else g.no ??= x.no; por.set(x.pid, g); }
    return [...por].map(([pid, g]) => {
      const cuenta = tabla('perfiles').some((p) => p.id === pid);
      return { perfil_id: pid, vias: [...new Set(g.alguno ? g.ok : g.todas)].sort(), incluido: g.alguno && cuenta, motivo: !g.alguno ? g.no : !cuenta ? 'Sin cuenta de acceso' : null };
    });
  }
  function previa(col, c) {
    if (!envia(col)) err('Solo Administración, o quien fue designado en un área, envía circulares a la comunidad del colegio.');
    const a = resolver(col, c), inc = a.filter((x) => x.incluido), exc = a.filter((x) => !x.incluido);
    const cuenta = (l, k) => l.reduce((o, x) => { for (const v of [].concat(k(x))) o[v] = (o[v] || 0) + 1; return o; }, {});
    const P = new Map(tabla('perfiles').map((p) => [p.id, p]));
    return { total: inc.length, excluidos: exc.length, por_grupo: cuenta(inc, (x) => x.vias), motivos: cuenta(exc, (x) => x.motivo),
      excluidos_detalle: exc.filter((x) => miembro(col, x.perfil_id)).slice(0, 100).map((x) => ({ perfil_id: x.perfil_id, nombre: `${P.get(x.perfil_id)?.nombres || ''} ${P.get(x.perfil_id)?.apellidos || ''}`.trim(), motivo: x.motivo })),
      huella: huella(inc.map((x) => x.perfil_id)), calculado_en: ahora() };
  }

  // ------------------------------------------------ Envío de la circular (public.circular_enviar)
  const resumen = (e) => {
    const exc = tabla('circular_envio_destinatarios').filter((x) => x.envio_id === e.id && x.estado === 'excluido');
    return { id: e.id, mensaje_id: e.id, borrador_id: e.borrador_id, consecutivo: e.consecutivo, version: e.version, sha256: e.sha256, total_previsto: e.total_previsto,
      total_entregado: e.total_entregado, total_excluido: e.total_excluido, en_bandeja: tabla('mensaje_destinatarios').filter((d) => d.mensaje_id === e.id).length,
      motivos: exc.reduce((o, x) => ((o[x.motivo] = (o[x.motivo] || 0) + 1), o), {}), enviado_en: e.enviado_en };
  };
  async function enviar(a) {
    const yo = usuario();
    if (!a.p_envio) err('Falta la identificación del envío.');
    const ya = tabla('circular_envios').find((e) => e.id === a.p_envio);
    if (ya) { if (!esAdmin(ya.colegio_id) && ya.enviado_por !== yo) err('Ese envío no existe o no tienes acceso.'); return { ...resumen(ya), repetido: true }; }
    if (tabla('mensajes').some((m) => m.id === a.p_envio)) err('Esa identificación de envío ya se usó: vuelve a revisar el envío.');
    const b = tabla('circular_borradores').find((x) => x.id === a.p_borrador);
    if (!b || !enviaBorrador(b)) err('Solo Administración, o quien fue designado en un área, envía circulares a la comunidad del colegio.');
    if (b.estado === 'anulada') err('Esa circular está anulada: no se envía.');
    if (b.version !== a.p_version) throw msg(`La circular cambió después de generar el PDF (versión ${a.p_version} → ${b.version}): genera el PDF otra vez y revísalo antes de enviar.`, { pista: 'version_cambio' });
    if (!b.consecutivo) err('La circular aún no tiene su número: guárdala con su área y serie antes de enviarla.');
    const rv = tabla('circular_revisiones_pdf').filter((r) => r.borrador_id === b.id && r.version === a.p_version && r.sha256 === a.p_sha256 && r.envio_id === a.p_envio && r.ruta).at(-1);
    if (!rv) throw msg('Falta el PDF de esta versión: genéralo y revísalo antes de enviar.', { pista: 'pdf_falta' });
    if (!existeArchivo('mensajes', rv.ruta)) throw msg('El PDF no quedó guardado: genéralo otra vez antes de enviar.', { pista: 'pdf_falta' });
    const aud = resolver(b.colegio_id, a.p_criterios), inc = aud.filter((x) => x.incluido);
    if (!inc.length) err('Con esa selección nadie recibiría la circular.');
    if (a.p_huella !== huella(inc.map((x) => x.perfil_id))) throw msg(`La lista de destinatarios cambió desde la revisión: ahora son ${inc.length}. Revisa el envío y confírmalo otra vez.`, { pista: 'audiencia_cambio' });
    if (b.estado === 'borrador') await emitir(b.id, a.p_envio); // mismas reglas de emisión (serie validada)
    const t = tabla('tipos_mensaje').find((x) => x.colegio_id === b.colegio_id && x.activo !== false && x.nombre.trim().toLowerCase() === 'circulares');
    const en = ahora();
    tabla('mensajes').push({ id: a.p_envio, colegio_id: b.colegio_id, autor_id: yo, asunto: `${b.consecutivo} · ${(b.datos?.titulo || '').trim() || 'Circular institucional'}`.slice(0, 200),
      cuerpo: `Circular institucional ${b.consecutivo}. El documento oficial es el PDF adjunto: ábrelo o descárgalo desde este mensaje.`, responde_a: null, permite_respuesta: false,
      ocultar_destinatarios: true, destacado: false, autor_archivado: false, autor_eliminado: false, permite_responder_todos: false, permite_reenviar: false, expira_en: null,
      evento_inicio: null, evento_fin: null, evento_todo_el_dia: true, tipo_id: t?.id || null, numero: null, editado_en: null, creado_en: en });
    for (const x of inc) tabla('mensaje_destinatarios').push({ mensaje_id: a.p_envio, colegio_id: b.colegio_id, perfil_id: x.perfil_id, leido_en: null, archivado: false, eliminado: false });
    tabla('mensaje_adjuntos').push({ id: crypto.randomUUID(), colegio_id: b.colegio_id, mensaje_id: a.p_envio, ruta: rv.ruta, nombre: b.consecutivo.replace(/[^A-Za-z0-9._-]+/g, '_') + '.pdf',
      tipo: 'application/pdf', bytes: rv.bytes, principal: true, sha256: rv.sha256 });
    const e = { id: a.p_envio, colegio_id: b.colegio_id, borrador_id: b.id, version: a.p_version, consecutivo: b.consecutivo, sha256: rv.sha256, ruta: rv.ruta, criterios: a.p_criterios,
      huella_audiencia: a.p_huella, total_previsto: inc.length, total_entregado: inc.length, total_excluido: aud.length - inc.length, enviado_por: yo, enviado_en: en };
    tabla('circular_envios').push(e);
    for (const x of aud) tabla('circular_envio_destinatarios').push({ envio_id: e.id, colegio_id: b.colegio_id, perfil_id: x.perfil_id, vias: x.vias, estado: x.incluido ? 'entregado' : 'excluido', motivo: x.motivo });
    guardar();
    return { ...resumen(e), repetido: false };
  }

  // ------------------------------------------------ Mensajería (public.mensaje_enviar, bandeja_mia, enviados_mios, mensaje_lecturas)
  function mensajeEnviar(a) {
    const yo = usuario(), r = a.p_mensaje || {};
    if (!r.id || !r.colegio_id) err('Falta la identificación del mensaje.');
    const o = tabla('mensajes').find((m) => m.id === r.id);
    if (o) { if (o.autor_id !== yo) err('Ese mensaje no es tuyo.'); return { id: o.id, repetido: true, destinatarios: tabla('mensaje_destinatarios').filter((d) => d.mensaje_id === o.id).length }; }
    if (!activo(r.colegio_id, yo)) err('No perteneces a este colegio.');
    if (r.destacado && !esAdmin(r.colegio_id) && !activo(r.colegio_id, yo, 'profesor')) err('Solo Administración y los docentes destacan mensajes en la cartelera.');
    const perm = contactos(r.colegio_id, yo).map((c) => ({ perfil_id: c.perfil_id, grupo: c.grupo }));
    for (const m of tabla('mensajes').filter((m) => m.colegio_id === r.colegio_id && m.permite_respuesta && m.autor_id)) if (tabla('mensaje_destinatarios').some((d) => d.mensaje_id === m.id && d.perfil_id === yo)) perm.push({ perfil_id: m.autor_id });
    if (r.responde_a) {
      const orig = tabla('mensajes').find((m) => m.id === r.responde_a);
      if (orig && orig.permite_respuesta && orig.permite_responder_todos && !orig.ocultar_destinatarios && (!orig.expira_en || orig.expira_en > ahora())
        && tabla('mensaje_destinatarios').some((d) => d.mensaje_id === orig.id && d.perfil_id === yo)) {
        perm.push({ perfil_id: orig.autor_id }, ...tabla('mensaje_destinatarios').filter((d) => d.mensaje_id === orig.id).map((d) => ({ perfil_id: d.perfil_id })));
      }
    }
    const para = [...new Set([...(a.p_para || []), ...perm.filter((p) => (a.p_grupos || []).includes(p.grupo)).map((p) => p.perfil_id)])].filter((x) => x && x !== yo);
    if (!para.length) err('Elige al menos un destinatario.');
    const ok = new Set(perm.map((p) => p.perfil_id)), no = para.filter((x) => !ok.has(x)).length;
    if (no) throw msg(`${no} destinatario(s) ya no están disponibles para ti (cambió su curso, su rol o su cuenta). Revisa la lista y envía otra vez.`, { pista: 'destinatarios_no_disponibles' });
    return { r, para };
  }
  function bandeja(a) {
    const yo = usuario(), q = (a.p_buscar || '').trim().toLowerCase(), P = new Map(tabla('perfiles').map((p) => [p.id, p]));
    const filas = tabla('mensaje_destinatarios').filter((d) => d.perfil_id === yo && d.colegio_id === a.p_colegio).map((d) => ({ d, m: tabla('mensajes').find((m) => m.id === d.mensaje_id) }))
      .filter(({ d, m }) => m && (!m.expira_en || m.expira_en > ahora())
        && (a.p_vista === 'eliminados' ? d.eliminado : a.p_vista === 'archivados' ? !d.eliminado && d.archivado : !d.eliminado && !d.archivado)
        && (!a.p_tipo || (a.p_tipo === 'ninguno' ? !m.tipo_id : m.tipo_id === a.p_tipo))
        && (!a.p_ver || (a.p_ver === 'no' ? !d.leido_en : !!d.leido_en))
        && (!q || `${P.get(m.autor_id)?.nombres || ''} ${P.get(m.autor_id)?.apellidos || ''} ${m.asunto} ${m.cuerpo}`.toLowerCase().includes(q)))
      .sort((x, y) => (y.m.creado_en || '').localeCompare(x.m.creado_en || '') || y.m.id.localeCompare(x.m.id))
      .filter(({ m }) => !a.p_antes || m.creado_en < a.p_antes || (m.creado_en === a.p_antes && m.id < a.p_antes_id));
    return filas.slice(0, Math.min(Math.max(a.p_limite || 50, 1), 200)).map(({ d, m }) => ({ mensaje_id: m.id, autor_id: m.autor_id, asunto: m.asunto, cuerpo: (m.cuerpo || '').slice(0, 300),
      creado_en: m.creado_en, editado_en: m.editado_en, destacado: m.destacado, tipo_id: m.tipo_id, numero: m.numero, leido_en: d.leido_en, archivado: d.archivado, eliminado: d.eliminado,
      con_pdf: tabla('mensaje_adjuntos').some((x) => x.mensaje_id === m.id && x.principal) }));
  }
  function enviados(a) {
    const yo = usuario(), P = new Map(tabla('perfiles').map((p) => [p.id, p]));
    return tabla('mensajes').filter((m) => m.colegio_id === a.p_colegio && m.autor_id === yo && !m.autor_eliminado)
      .sort((x, y) => (y.creado_en || '').localeCompare(x.creado_en || '') || y.id.localeCompare(x.id))
      .filter((m) => !a.p_antes || m.creado_en < a.p_antes || (m.creado_en === a.p_antes && m.id < a.p_antes_id))
      .slice(0, Math.min(Math.max(a.p_limite || 50, 1), 200)).map((m) => {
        const ds = tabla('mensaje_destinatarios').filter((d) => d.mensaje_id === m.id);
        const orden = ds.map((d) => d.perfil_id).sort((x, y) => `${P.get(x)?.apellidos} ${P.get(x)?.nombres}`.localeCompare(`${P.get(y)?.apellidos} ${P.get(y)?.nombres}`));
        return { mensaje_id: m.id, asunto: m.asunto, cuerpo: (m.cuerpo || '').slice(0, 300), creado_en: m.creado_en, editado_en: m.editado_en, destacado: m.destacado, tipo_id: m.tipo_id, numero: m.numero,
          total: ds.length, leidos: ds.filter((d) => d.leido_en).length, primeros: orden.slice(0, 3), con_pdf: tabla('mensaje_adjuntos').some((x) => x.mensaje_id === m.id && x.principal) };
      });
  }
  function lecturas(a) {
    const m = tabla('mensajes').find((x) => x.id === a.p_mensaje);
    if (!m || m.autor_id !== usuario()) err('Solo quien escribió el mensaje ve sus lecturas.');
    const P = new Map(tabla('perfiles').map((p) => [p.id, p]));
    const ds = tabla('mensaje_destinatarios').filter((d) => d.mensaje_id === m.id).sort((x, y) => `${P.get(x.perfil_id)?.apellidos} ${P.get(x.perfil_id)?.nombres}`.localeCompare(`${P.get(y.perfil_id)?.apellidos} ${P.get(y.perfil_id)?.nombres}`));
    const desde = Math.max(a.p_desde || 0, 0);
    return { total: ds.length, leidos: ds.filter((d) => d.leido_en).length, filas: ds.slice(desde, desde + Math.min(Math.max(a.p_limite || 100, 1), 500)).map((d) => ({ perfil_id: d.perfil_id, leido_en: d.leido_en })) };
  }
  function diagnostico(a) {
    const yo = usuario(), col = a.p_colegio;
    const mats = tabla('matriculas').filter((x) => x.colegio_id === col && x.estudiante_id === yo && (x.estado || 'activa') === 'activa');
    const asig = tabla('asignaciones').filter((x) => x.colegio_id === col && mats.some((m) => m.curso_id === x.curso_id));
    return { es_estudiante: activo(col, yo, 'estudiante'), matricula_vigente: mats.length > 0, materias: asig.length, materias_sin_docente: asig.filter((x) => !x.profesor_id).length,
      docentes_inactivos: new Set(asig.filter((x) => x.profesor_id && !activo(col, x.profesor_id, 'profesor')).map((x) => x.profesor_id)).size,
      cursos: tabla('cursos').filter((c) => mats.some((m) => m.curso_id === c.id)).map((c) => c.nombre).sort() };
  }

  return async function (nombre, a) {
    if (nombre === 'audiencia_previa') return previa(a.p_colegio, a.p_criterios);
    if (nombre === 'circular_enviar') return enviar(a);
    if (nombre === 'circular_envio_estado') {
      const e = tabla('circular_envios').find((x) => x.id === a.p_envio);
      if (!e) return null;
      if (!esAdmin(e.colegio_id) && e.enviado_por !== usuario()) err('Ese envío no existe o no tienes acceso.');
      return resumen(e);
    }
    if (nombre === 'mensaje_enviar') return mensajeEnviar(a); // la escritura la hace db.js (mismos datos que un insert)
    if (nombre === 'bandeja_mia') return bandeja(a);
    if (nombre === 'enviados_mios') return enviados(a);
    if (nombre === 'mensaje_lecturas') return lecturas(a);
    if (nombre === 'mis_docentes_diagnostico') return diagnostico(a);
    err('Función desconocida: ' + nombre);
  };
}

export const RPC_ENVIOS = ['audiencia_previa', 'circular_enviar', 'circular_envio_estado', 'mensaje_enviar', 'bandeja_mia', 'enviados_mios', 'mensaje_lecturas', 'mis_docentes_diagnostico'];
