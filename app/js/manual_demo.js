// Manual de Convivencia en el MODO DEMO: mismas reglas que la base (supabase/migrations/20261118100000_manual_convivencia.sql).
// El manual del demo es FICTICIO (texto inventado, sin datos de ningún colegio real): el manual real de un colegio solo vive en su
// base de datos, nunca en el código de la app (el sitio es público).
const quitarTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function manualFicticio() {
  const art = (numero, titulo, capitulo, pagina, texto) => ({ numero, titulo, capitulo, pagina_desde: pagina, pagina_hasta: pagina, texto: `ARTÍCULO ${numero}. ${titulo}. ${texto}` });
  const C1 = 'Capítulo Primero · DISPOSICIONES GENERALES (DEMO)', C2 = 'Capítulo Segundo · FALTAS Y PROCEDIMIENTOS (DEMO)';
  return {
    titulo: 'Manual de Convivencia (DEMO)', vigencia: '2025-2026',
    pasos: { leve: 3, grave: 5, muy_grave: 7 },
    articulos: [
      art(1, 'Objeto', C1, 1, 'Este manual FICTICIO del modo demo muestra cómo se citan las faltas en los llamados de atención.'),
      art(2, 'Faltas leves', C2, 2, 'Son faltas leves (demo): 1. Puntualidad: llegar tarde sin justificación. 2. Uniforme: no portar el uniforme completo. 3. Respeto a los demás: burlarse de un compañero sin causarle daño.'),
      art(3, 'Procedimiento para faltas leves', C2, 2, '1. El docente dialoga con el estudiante sobre lo ocurrido. 2. Deja registro en la plataforma. 3. Si el estudiante reincide, avisa a la familia con copia a la Dirección de Sección (texto de demostración).'),
      art(4, 'Faltas graves', C2, 3, 'Son faltas graves (demo): 1. Daño a bienes del colegio. 2. Irrespeto reiterado a un miembro de la comunidad.'),
      art(5, 'Procedimiento para faltas graves', C2, 3, '1. El docente informa al Director de Sección. 2. El Director de Sección toma la versión libre del estudiante. 3. Se cita a la familia (texto de demostración).'),
      art(6, 'Faltas muy graves', C2, 4, 'Son faltas muy graves (demo): 1. Agresión física a un miembro de la comunidad.'),
      art(7, 'Procedimiento para faltas muy graves', C2, 4, 'La Rectoría, con la Dirección de Sección, abre el debido proceso (texto de demostración).'),
    ],
    anexos: [{ anexo: 1, titulo: 'FORMATO DE COMPROMISO (DEMO)', pagina_desde: 5, pagina_hasta: 5, texto: 'Formato ficticio de compromiso del modo demo.' }],
    faltas: [
      { articulo: 2, gravedad: 'leve', ambito: 'A. Cuidado de sí mismo', numeral: '1', titulo: 'Puntualidad', texto: 'Puntualidad: llegar tarde sin justificación a clase o a las actividades (texto de demostración).' },
      { articulo: 2, gravedad: 'leve', ambito: 'A. Cuidado de sí mismo', numeral: '2', titulo: 'Uniforme', texto: 'Uniforme: no portar el uniforme completo según lo establecido (texto de demostración).' },
      { articulo: 2, gravedad: 'leve', ambito: 'B. Cuidado de los otros', numeral: '3', titulo: 'Respeto a los demás', texto: 'Respeto a los demás: burlarse de un compañero de manera incidental, sin causarle daño (texto de demostración).' },
      { articulo: 4, gravedad: 'grave', ambito: 'C. Cuidado de lo público', numeral: '1', titulo: 'Daño a bienes del colegio', texto: 'Daño a bienes del colegio: dañar muebles, salones o materiales del colegio (texto de demostración).' },
      { articulo: 4, gravedad: 'grave', ambito: 'B. Cuidado de los otros', numeral: '2', titulo: 'Irrespeto reiterado', texto: 'Irrespeto reiterado a un miembro de la comunidad de forma verbal o gestual (texto de demostración).' },
      { articulo: 6, gravedad: 'muy_grave', ambito: 'B. Cuidado de los otros', numeral: '1', titulo: 'Agresión física', texto: 'Agresión física a cualquier miembro de la comunidad educativa (texto de demostración).' },
    ],
  };
}

export function crearManualDemo({ tabla, usuario, guardar, ahora, err }) {
  const rol = (c, roles) => tabla('miembros').some((m) => m.colegio_id === c && m.perfil_id === usuario() && m.activo !== false && roles.includes(m.rol));
  const esMiembro = (c) => tabla('miembros').some((m) => m.colegio_id === c && m.perfil_id === usuario() && m.activo !== false);
  const esAdmin = (c) => rol(c, ['admin']);
  const vigente = (c) => tabla('manual_convivencia').find((m) => m.colegio_id === c && m.vigente);
  const nombre = (id) => { const p = tabla('perfiles').find((x) => x.id === id); return (p ? `${p.nombres || ''} ${p.apellidos || ''}`.trim() : '') || 'Estudiante'; };

  // Como manual_cargar
  function cargar(c, d) {
    if (!esAdmin(c)) err('Solo el administrador carga el Manual de Convivencia.');
    if (!Array.isArray(d?.articulos) || !Array.isArray(d?.faltas)) err('El archivo no tiene artículos y faltas del manual.');
    if (!d.faltas.length) err('El manual no trae faltas: sin ellas no se puede sustentar un llamado de atención.');
    if (d.faltas.some((f) => !['leve', 'grave', 'muy_grave'].includes(f.gravedad) || !String(f.titulo || '').trim() || !String(f.texto || '').trim() || !/^\d{1,4}$/.test(String(f.articulo))))
      err('Hay faltas sin gravedad, artículo, título o texto.');
    const pasos = d.pasos || {};
    if (Object.entries(pasos).some(([k, v]) => !['leve', 'grave', 'muy_grave'].includes(k) || !/^\d{1,4}$/.test(String(v)))) err('Los pasos deben indicar el artículo de cada gravedad.');
    for (const m of tabla('manual_convivencia')) if (m.colegio_id === c) m.vigente = false;
    const man = { id: crypto.randomUUID(), colegio_id: c, titulo: String(d.titulo || '').trim() || 'Manual de Convivencia', vigencia: String(d.vigencia || '').trim() || String(new Date().getFullYear()),
      archivo_id: null, pasos: Object.fromEntries(Object.entries(pasos).map(([k, v]) => [k, Number(v)])), vigente: true, cargado_por: usuario(), cargado_en: ahora() };
    tabla('manual_convivencia').push(man);
    d.articulos.forEach((a, i) => tabla('manual_articulos').push({ manual_id: man.id, colegio_id: c, orden: i + 1, numero: a.numero ?? null, anexo: null, titulo: String(a.titulo || '').slice(0, 300), capitulo: String(a.capitulo || '').slice(0, 300), pagina_desde: a.pagina_desde ?? null, pagina_hasta: a.pagina_hasta ?? null, texto: a.texto || '' }));
    (d.anexos || []).forEach((a, i) => tabla('manual_articulos').push({ manual_id: man.id, colegio_id: c, orden: d.articulos.length + i + 1, numero: null, anexo: a.anexo ?? null, titulo: String(a.titulo || '').slice(0, 300), capitulo: 'Anexos', pagina_desde: a.pagina_desde ?? null, pagina_hasta: a.pagina_hasta ?? null, texto: a.texto || '' }));
    d.faltas.forEach((f, i) => tabla('manual_faltas').push({ id: crypto.randomUUID(), manual_id: man.id, colegio_id: c, orden: i + 1, articulo: Number(f.articulo), gravedad: f.gravedad, ambito: f.ambito || '', numeral: f.numeral || '', titulo: String(f.titulo).slice(0, 300), texto: f.texto }));
    guardar();
    return { id: man.id, articulos: tabla('manual_articulos').filter((x) => x.manual_id === man.id).length, faltas: d.faltas.length };
  }

  // El colegio del demo trae un manual ficticio ya cargado (como si el administrador lo hubiera subido)
  function asegurar() {
    for (const n of ['manual_convivencia', 'manual_articulos', 'manual_faltas']) tabla(n);
    const col = tabla('colegios')[0];
    if (!col || tabla('manual_convivencia').some((m) => m.colegio_id === col.id)) return;
    const admin = tabla('miembros').find((m) => m.colegio_id === col.id && m.rol === 'admin');
    const antes = usuario;
    usuario = () => admin?.perfil_id; // se carga «como el administrador»
    try { cargar(col.id, manualFicticio()); } finally { usuario = antes; }
  }

  function rpc(nombre, a) {
    asegurar();
    const c = a.p_colegio;
    if (!esMiembro(c)) err('No tienes acceso a este colegio.');
    const man = vigente(c);
    if (nombre === 'manual_estado') {
      if (!man) return { manual: null, admin: esAdmin(c) };
      const arts = tabla('manual_articulos').filter((x) => x.manual_id === man.id).sort((x, y) => x.orden - y.orden);
      const arch = man.archivo_id && tabla('archivos').find((x) => x.id === man.archivo_id);
      return {
        admin: esAdmin(c),
        manual: { id: man.id, titulo: man.titulo, vigencia: man.vigencia, pasos: man.pasos, archivo: arch ? { id: arch.id, ruta: arch.ruta, nombre: arch.nombre, bytes: arch.bytes } : null },
        faltas: tabla('manual_faltas').filter((f) => f.manual_id === man.id).sort((x, y) => x.orden - y.orden)
          .map(({ id, articulo, gravedad, ambito, numeral, titulo, texto }) => ({ id, articulo, gravedad, ambito, numeral, titulo, texto })),
        indice: arts.map(({ orden, numero, anexo, titulo, capitulo, pagina_desde, pagina_hasta }) => ({ orden, numero, anexo, titulo, capitulo, pagina_desde, pagina_hasta })),
        pasos_texto: Object.fromEntries(Object.entries(man.pasos || {}).map(([k, n]) => [k, arts.find((x) => x.anexo == null && x.numero === n)]).filter(([, x]) => x)
          .map(([k, x]) => [k, { numero: x.numero, titulo: x.titulo, texto: x.texto }])),
      };
    }
    if (nombre === 'manual_articulo') {
      const x = man && tabla('manual_articulos').find((y) => y.manual_id === man.id && y.orden === a.p_orden);
      if (!x) err('Ese artículo no está en el manual vigente.');
      const { orden, numero, anexo, titulo, capitulo, pagina_desde, pagina_hasta, texto } = x;
      return { orden, numero, anexo, titulo, capitulo, pagina_desde, pagina_hasta, texto };
    }
    if (nombre === 'manual_buscar') {
      const q = quitarTildes(String(a.p_q || '').trim());
      if (q.length < 3 || !man) return [];
      return tabla('manual_articulos').filter((x) => x.manual_id === man.id && quitarTildes(x.titulo + ' ' + x.texto).includes(q)).sort((x, y) => x.orden - y.orden).slice(0, 60)
        .map((x) => { const i = quitarTildes(x.texto).indexOf(q); return { orden: x.orden, numero: x.numero, anexo: x.anexo, titulo: x.titulo, capitulo: x.capitulo, fragmento: x.texto.slice(Math.max(0, i - 79), Math.max(0, i - 79) + 220) }; });
    }
    if (nombre === 'manual_vincular_pdf') {
      if (!esAdmin(c)) err('Solo el administrador enlaza el PDF del manual.');
      if (a.p_archivo && !tabla('archivos').some((x) => x.id === a.p_archivo && x.colegio_id === c)) err('Ese archivo no es de este colegio.');
      if (!man) err('Este colegio aún no tiene un manual cargado.');
      man.archivo_id = a.p_archivo || null; guardar();
      return { id: man.id, archivo_id: man.archivo_id };
    }
    if (nombre === 'manual_cargar') return cargar(c, a.p_datos);
    err(`Función desconocida en el demo: ${nombre}`);
  }

  // Como el trigger observacion_sustento: la cita la arma «el servidor» y queda congelada; avisos solo al crear
  function sustento(nueva, vieja) {
    asegurar();
    if (vieja && nueva.tipo === vieja.tipo && (nueva.manual_falta_id ?? null) === (vieja.manual_falta_id ?? null)) {
      Object.assign(nueva, { manual_cita: vieja.manual_cita ?? null, manual_aviso: vieja.manual_aviso ?? null, avisar_familia: vieja.avisar_familia ?? false });
      return;
    }
    if (vieja) Object.assign(nueva, { manual_aviso: vieja.manual_aviso ?? null, avisar_familia: vieja.avisar_familia ?? false });
    if (nueva.tipo !== 'negativa') {
      Object.assign(nueva, { manual_falta_id: null, manual_cita: null });
      if (!vieja) Object.assign(nueva, { avisar_familia: false, manual_aviso: null });
      return;
    }
    const man = vigente(nueva.colegio_id);
    if (!nueva.manual_falta_id) {
      if (!man) { nueva.manual_cita = null; if (!vieja) Object.assign(nueva, { avisar_familia: false, manual_aviso: null }); return; }
      err('Elige la falta del Manual de Convivencia que sustenta el llamado de atención.');
    }
    const f = tabla('manual_faltas').find((x) => x.id === nueva.manual_falta_id && x.colegio_id === nueva.colegio_id);
    if (!f) err('Esa falta no está en el Manual de Convivencia de este colegio.');
    if (!man || f.manual_id !== man.id) err('Esa falta es de una versión del Manual de Convivencia que ya no está vigente.');
    nueva.manual_cita = { manual_id: man.id, manual: man.titulo, vigencia: man.vigencia, falta_id: f.id, articulo: f.articulo, gravedad: f.gravedad, ambito: f.ambito,
      numeral: f.numeral, titulo: f.titulo, texto: f.texto, pasos_articulo: man.pasos?.[f.gravedad] ?? null, citado_en: ahora() };
    if (vieja) return;

    const est = nombre(nueva.estudiante_id);
    const grav = { leve: 'falta leve', grave: 'falta grave', muy_grave: 'falta muy grave' }[f.gravedad];
    const grados = tabla('matriculas').filter((m) => m.colegio_id === nueva.colegio_id && m.estudiante_id === nueva.estudiante_id && (m.estado || 'activa') === 'activa')
      .map((m) => tabla('cursos').find((c) => c.id === m.curso_id)?.grado_id).filter(Boolean);
    const dir = [...new Set(tabla('miembros').filter((m) => m.colegio_id === nueva.colegio_id && m.rol === 'director_seccion' && m.activo !== false && (m.seccion_grados || []).some((g) => grados.includes(g))).map((m) => m.perfil_id))];
    const fechaTxt = String(nueva.fecha || '').split('-').reverse().join('/');
    const cuerpo = `${nombre(nueva.autor_id)} registró un llamado de atención a ${est} el ${fechaTxt}.\n\nSustento: ${man.titulo} ${man.vigencia}, Art. ${f.articulo} · ${grav[0].toUpperCase() + grav.slice(1).replace(/ (\w)/g, (_, l) => ' ' + l.toUpperCase())} · ${f.ambito}${['', '•'].includes(f.numeral) ? '' : ' · num. ' + f.numeral} · ${f.titulo}.\n«${f.texto}»\n\nLo que describe el docente:\n${nueva.descripcion}`;
    const enviar = (asunto, texto, para) => {
      const m = { id: crypto.randomUUID(), colegio_id: nueva.colegio_id, autor_id: nueva.autor_id, asunto, cuerpo: texto, responde_a: null, permite_respuesta: true,
        ocultar_destinatarios: false, destacado: false, autor_archivado: false, autor_eliminado: false, permite_responder_todos: false, permite_reenviar: true, expira_en: null,
        evento_inicio: null, evento_fin: null, evento_todo_el_dia: true, tipo_id: null, numero: null, editado_en: null, creado_en: ahora() };
      tabla('mensajes').push(m);
      for (const p of para) tabla('mensaje_destinatarios').push({ mensaje_id: m.id, colegio_id: nueva.colegio_id, perfil_id: p, leido_en: null, archivado: false, eliminado: false });
      return para.length;
    };
    nueva.manual_aviso = { directores: 0, familia: 0, sin_director: false };
    if (f.gravedad !== 'leve') {
      const para = dir.filter((x) => x !== nueva.autor_id);
      if (!dir.length) nueva.manual_aviso.sin_director = true;
      else if (para.length) nueva.manual_aviso.directores = enviar(`Llamado de atención · ${grav} (Art. ${f.articulo}) · ${est}`,
        cuerpo + `\n\nSegún el Art. ${man.pasos?.[f.gravedad] ?? '?'} del Manual de Convivencia, la atención de esta falta corresponde a la Dirección de Sección.`, para);
    }
    if (nueva.avisar_familia) {
      if (!nueva.visible_acudiente) err('Para avisar a la familia, el registro debe ser visible para el estudiante y su acudiente.');
      const fam = [...new Set([nueva.estudiante_id, ...tabla('acudientes').filter((x) => x.colegio_id === nueva.colegio_id && x.estudiante_id === nueva.estudiante_id).map((x) => x.acudiente_id)])];
      const para = [...new Set([...fam, ...dir])].filter((x) => x !== nueva.autor_id);
      if (para.length) {
        enviar(`Llamado de atención · ${est}`, cuerpo + '\n\nEste mensaje va con copia a la Dirección de Sección.', para);
        Object.assign(nueva.manual_aviso, { familia: fam.filter((x) => x !== nueva.autor_id).length, copia_direccion: dir.filter((x) => x !== nueva.autor_id).length });
      }
    }
  }

  return { rpc, sustento };
}
