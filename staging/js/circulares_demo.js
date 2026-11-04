// Numeración de circulares por área en el MODO DEMO (todo queda en este navegador): las mismas reglas y mensajes que
// supabase/migrations/20261029130000_circular_series_area.sql (configurar áreas y series, validar, vista previa, emitir, anular).
// 2-nov-2026 (20261102140000_circular_firmas_emisores): quién prepara circulares (además de Administración), con su cargo y
// área, y la firma propia de cada persona (imagen PNG que solo ve su dueño).
// 5-nov-2026 (20261105100000_circular_series_varias_numero_envio): varias series por área y período, la serie elegida en la circular
// y el número oficial al confirmar el envío (circular_asignar_numero); el selector pide circular_series_disponibles.
export function crearCircularesDemo({ tabla, usuario, guardar, ahora, err, esAdmin, consecutivoCircular, numeroDeSerie, vigentesDe, hoyLocal, formatoCirc, emisorCirc, puedePreparar, existeArchivo }) {
  const soloAdmin = (c) => { if (!usuario() || !esAdmin(c)) err('Solo el administrador del colegio configura y emite las circulares.'); };
  // Ajustes por área (20261105110000): Administración, todo; quien fue designado en un área, solo las series de SU área
  const configuraArea = (c, area) => !!usuario() && (esAdmin(c) || (!!area && emisorCirc(c)?.area_id === area));
  const areaDesignada = (c) => (esAdmin(c) ? null : emisorCirc(c)?.area_id || null);
  const historia = (c, objeto, id, accion, antes, despues) => tabla('circular_config_historial').push({ id: Date.now() + Math.random(), colegio_id: c, actor_id: usuario(), objeto, objeto_id: id, accion,
    antes: antes ? JSON.parse(JSON.stringify(antes)) : null, despues: despues ? JSON.parse(JSON.stringify(despues)) : null, creado_en: ahora() });
  const nombreDe = (id) => { const p = tabla('perfiles').find((x) => x.id === id); return p ? `${p.nombres || ''} ${p.apellidos || ''}`.trim() : null; };
  const texto = (s, n) => { try { return formatoCirc(s, n); } catch { return null; } };
  const existe = (c, txt, salvoSerie) => {
    const ya = (b) => b.colegio_id === c && String(b.consecutivo || '').toLowerCase() === txt.toLowerCase() && (!salvoSerie || b.serie_id !== salvoSerie);
    return tabla('circular_borradores').some(ya) || tabla('circular_numeros_anulados').some(ya);
  };

  // Formatos que puede usar una persona (como private.circular_formatos_de): {todos} | {permitidas} | {prohibidas}
  const formatosDe = (c, p) => {
    const e = emisorCirc(c, p);
    if (!e) return { todos: tabla('miembros').some((m) => m.colegio_id === c && m.perfil_id === p && m.rol === 'admin' && m.activo !== false) };
    const mias = tabla('circular_area_formatos').filter((x) => e.area_id && x.area_id === e.area_id).map((x) => x.plantilla_id);
    if (mias.length) return { todos: false, permitidas: mias };
    return { todos: false, prohibidas: [...new Set(tabla('circular_area_formatos').filter((x) => x.colegio_id === c && x.area_id !== e.area_id).map((x) => x.plantilla_id))] };
  };
  const F = {
    circular_area_guardar(a) {
      soloAdmin(a.p_colegio);
      const nombre = String(a.p_nombre || '').trim();
      if (nombre.length < 2) err('Escribe el nombre del área (p. ej. Rectoría).');
      if (tabla('circular_areas').some((x) => x.colegio_id === a.p_colegio && x.id !== a.p_id && x.nombre.trim().toLowerCase() === nombre.toLowerCase())) err('Ya hay un área con ese nombre.');
      if (!a.p_id) {
        const x = { id: crypto.randomUUID(), colegio_id: a.p_colegio, nombre, activo: a.p_activo !== false, creado_en: ahora() };
        tabla('circular_areas').push(x); historia(a.p_colegio, 'area', x.id, 'creada', null, x);
        return { ...x };
      }
      const x = tabla('circular_areas').find((y) => y.id === a.p_id && y.colegio_id === a.p_colegio);
      if (!x) err('Esa área no es de este colegio.');
      const antes = { ...x };
      Object.assign(x, { nombre, activo: a.p_activo !== false });
      historia(a.p_colegio, 'area', x.id, 'cambiada', antes, x);
      return { ...x };
    },
    circular_serie_guardar(a) {
      // una serie que ya existe se juzga por su área, no por la que diga la petición
      const c = a.p_colegio, area = a.p_id ? (tabla('circular_series').find((x) => x.id === a.p_id && x.colegio_id === c)?.area_id || null) : a.p_area || null;
      if (!configuraArea(c, area)) err('Solo el administrador del colegio, o quien fue designado en esa área, configura sus series.');
      const suf = a.p_sufijo || null, ultimo = Number(a.p_ultimo_usado);
      if (area && !tabla('circular_areas').some((x) => x.id === area && x.colegio_id === c)) err('Esa área no es de este colegio.');
      if (!String(a.p_prefijo || '').trim() || a.p_prefijo.length > 30) err('Escribe el código de la serie (hasta 30 caracteres), p. ej. «Memo E2-» o «CT Q-».');
      if (!/^[0-9]{4}(-[0-9]{4})?$/.test(a.p_periodo || '')) err('El período va como 2026 o 2026-2027.');
      if (!(a.p_ancho >= 1 && a.p_ancho <= 6)) err('El ancho del número va de 1 a 6 cifras.');
      if (!Number.isInteger(ultimo) || ultimo < 0) err('Indica el último número oficialmente usado (0 si la serie empieza).');
      if (a.p_vigente_desde && a.p_vigente_hasta && a.p_vigente_hasta < a.p_vigente_desde) err('La vigencia termina antes de empezar.');
      // Duplicado real: el mismo código (sin mayúsculas ni espacios de los extremos) en el mismo período del colegio
      const norm = (t) => String(t || '').trim().toLowerCase();
      const otra = tabla('circular_series').find((x) => x.colegio_id === c && norm(x.prefijo) === norm(a.p_prefijo) && x.periodo === a.p_periodo && x.id !== a.p_id);
      if (otra) err(`Ya existe la serie «${otra.prefijo.trim()}» del período ${otra.periodo} (${tabla('circular_areas').find((x) => x.id === otra.area_id)?.nombre || 'del colegio, sin área'}). Usa otro código o período (no se repiten: darían los mismos números).`);
      const molde = { prefijo: a.p_prefijo, periodo: a.p_periodo, ancho: Number(a.p_ancho), sufijo: suf, area_id: area || 'x' };
      const sig = formatoCirc(molde, ultimo + 1);
      if (existe(c, sig, a.p_id)) err(`${sig} ya existe en el colegio: revisa el último número usado.`);
      let s;
      if (!a.p_id) {
        // Varias series vigentes por área (5-nov): reemplazar solo si se pide (las demás de esa área dejan de estar vigentes)
        if (a.p_reemplazar) for (const vig of vigentesDe(c, area)) { vig.vigente = false; historia(c, 'serie', vig.id, 'reemplazada', vig, null); }
        s = { id: crypto.randomUUID(), colegio_id: c, area_id: area, prefijo: a.p_prefijo, periodo: a.p_periodo, ancho: Number(a.p_ancho), sufijo: suf, ultimo, vigente: true, provisional: true,
          vigente_desde: a.p_vigente_desde || null, vigente_hasta: a.p_vigente_hasta || null, validada_por: null, validada_en: null, nota: (a.p_nota || '').trim() || null, creado_en: ahora() };
        tabla('circular_series').push(s); historia(c, 'serie', s.id, 'creada', null, s);
      } else {
        s = tabla('circular_series').find((x) => x.id === a.p_id && x.colegio_id === c);
        if (!s) err('Esa serie no es de este colegio.');
        if (ultimo < s.ultimo) err(`El último número usado ya va en ${s.ultimo}: no puede bajar (no se reutilizan números).`);
        const formato = [a.p_prefijo, a.p_periodo, Number(a.p_ancho), suf].join('|') !== [s.prefijo, s.periodo, s.ancho, s.sufijo].join('|');
        if (s.ultimo > 0 && (formato || (area || null) !== (s.area_id || null))) err('Una serie con números asignados no cambia de formato: crea una serie nueva.');
        const antes = { ...s };
        const cambia = formato || ultimo !== s.ultimo;
        Object.assign(s, { prefijo: a.p_prefijo, periodo: a.p_periodo, ancho: Number(a.p_ancho), sufijo: suf, ultimo, vigente_desde: a.p_vigente_desde || null, vigente_hasta: a.p_vigente_hasta || null,
          nota: (a.p_nota || '').trim() || null, ...(cambia ? { provisional: true, validada_por: null, validada_en: null } : {}) });
        historia(c, 'serie', s.id, 'cambiada', antes, s);
      }
      return { ...s, siguiente: sig };
    },
    circular_serie_validar(a) {
      if (!usuario() || !(esAdmin(a.p_colegio) || areaDesignada(a.p_colegio))) err('Solo el administrador del colegio configura y emite las circulares.');
      if (String(a.p_constancia || '').trim().length < 10) err('Escribe con qué registro del colegio comprobaste el área, el formato y el último número (mínimo 10 letras).');
      const s = tabla('circular_series').find((x) => x.id === a.p_id && x.colegio_id === a.p_colegio);
      if (!s) err('Esa serie no es de este colegio.');
      if (!configuraArea(a.p_colegio, s.area_id || null)) err('Solo el administrador del colegio, o quien fue designado en esa área, valida sus series.');
      const antes = { ...s };
      Object.assign(s, { provisional: false, validada_por: usuario(), validada_en: ahora(), nota: a.p_constancia.trim().slice(0, 500) });
      historia(a.p_colegio, 'serie', s.id, 'validada', antes, s);
      return { ...s };
    },
    circular_ajustes_guardar(a) {
      soloAdmin(a.p_colegio);
      if (!['guardar', 'emitir'].includes(a.p_asignar_numero)) err('Elige al guardar o al emitir.');
      let x = tabla('circular_ajustes').find((y) => y.colegio_id === a.p_colegio);
      const antes = x ? { ...x } : null;
      if (!x) tabla('circular_ajustes').push((x = { colegio_id: a.p_colegio }));
      Object.assign(x, { asignar_numero: a.p_asignar_numero, actualizado_por: usuario(), actualizado_en: ahora() });
      historia(a.p_colegio, 'ajustes', null, 'cambiados', antes, x);
      return { ...x };
    },
    circular_numeracion(a) {
      const c = a.p_colegio, admin = !!usuario() && esAdmin(c), soloArea = admin ? null : areaDesignada(c);
      if (!admin && !soloArea) err('Solo el administrador del colegio configura y emite las circulares.');
      const mia = (s) => admin || s.area_id === soloArea;
      const misSeries = new Set(tabla('circular_series').filter((s) => s.colegio_id === c && mia(s)).map((s) => s.id));
      return {
        asignar_numero: tabla('circular_ajustes').find((x) => x.colegio_id === c)?.asignar_numero || 'guardar', solo_area: soloArea,
        areas: tabla('circular_areas').filter((x) => x.colegio_id === c && (admin || x.id === soloArea)).sort((x, y) => x.nombre.localeCompare(y.nombre)).map((x) => ({ ...x })),
        series: tabla('circular_series').filter((s) => s.colegio_id === c && mia(s)).sort((x, y) => (y.vigente - x.vigente) || String(y.creado_en).localeCompare(String(x.creado_en))).map((s) => {
          const ult = tabla('circular_borradores').filter((b) => b.serie_id === s.id).sort((x, y) => y.numero - x.numero)[0];
          return { ...s, area: tabla('circular_areas').find((x) => x.id === s.area_id)?.nombre || null,
            ultimo_texto: s.ultimo > 0 ? texto({ ...s, area_id: null }, s.ultimo) : null, ultimo_texto_area: s.ultimo > 0 ? texto(s, s.ultimo) : null,
            siguiente: texto(s, s.ultimo + 1), agotada: !!s.area_id && String(s.ultimo + 1).length > s.ancho, validada_por_nombre: nombreDe(s.validada_por),
            ultimo_documento: ult ? { id: ult.id, consecutivo: ult.consecutivo, titulo: ult.datos?.titulo || null, estado: ult.estado || 'borrador', version: ult.version, actualizado_en: ult.actualizado_en } : null,
            anulados: tabla('circular_numeros_anulados').filter((x) => x.serie_id === s.id).length };
        }),
        historial: tabla('circular_config_historial').filter((h) => h.colegio_id === c && (admin || (h.objeto === 'serie' && misSeries.has(h.objeto_id)))).slice(-50).reverse().map((h) => ({ ...h, actor: nombreDe(h.actor_id) })),
      };
    },
    circular_previsualizar_numero(a) {
      if (!puedePreparar(a.p_colegio)) err('Solo Administración o quien el administrador designe preparan circulares institucionales.');
      if (emisorCirc(a.p_colegio) || !esAdmin(a.p_colegio)) a = { ...a, p_area: emisorCirc(a.p_colegio)?.area_id || null }; // numera en su área designada
      const modo = tabla('circular_ajustes').find((x) => x.colegio_id === a.p_colegio)?.asignar_numero || 'guardar';
      const vs = vigentesDe(a.p_colegio, a.p_area || null), s = vs[0];
      if (!s) return { hay_serie: false, asignar_numero: modo };
      return { hay_serie: true, asignar_numero: modo, serie_id: s.id, provisional: s.provisional, varias: vs.length > 1, siguiente: texto(s, s.ultimo + 1), agotada: !!s.area_id && String(s.ultimo + 1).length > s.ancho };
    },
    // Selector de «Consecutivo»: las series vigentes del área que emite (quien fue designado: las de SU área), con el próximo ESTIMADO
    circular_series_disponibles(a) {
      if (!puedePreparar(a.p_colegio)) err('Solo Administración o quien el administrador designe preparan circulares institucionales.');
      const area = emisorCirc(a.p_colegio) || !esAdmin(a.p_colegio) ? emisorCirc(a.p_colegio)?.area_id || null : a.p_area || null;
      const hoy = hoyLocal(), nomArea = (id) => tabla('circular_areas').find((x) => x.id === id)?.nombre || null;
      return {
        asignar_numero: tabla('circular_ajustes').find((x) => x.colegio_id === a.p_colegio)?.asignar_numero || 'guardar', area_id: area, area: nomArea(area),
        series: vigentesDe(a.p_colegio, area).sort((x, y) => x.prefijo.trim().toLowerCase().localeCompare(y.prefijo.trim().toLowerCase()) || x.periodo.localeCompare(y.periodo)).map((s) => ({
          id: s.id, prefijo: s.prefijo, periodo: s.periodo, sufijo: s.sufijo ?? null, ancho: s.ancho, area_id: s.area_id || null, area: nomArea(s.area_id), provisional: s.provisional,
          vigente_desde: s.vigente_desde || null, vigente_hasta: s.vigente_hasta || null, vigente_hoy: (!s.vigente_desde || hoy >= s.vigente_desde) && (!s.vigente_hasta || hoy <= s.vigente_hasta),
          agotada: String(s.ultimo + 1).length > s.ancho, siguiente: String(s.ultimo + 1).length > s.ancho ? null : texto({ ...s, area_id: s.area_id || 'x' }, s.ultimo + 1) })),
      };
    },
    // Número oficial al confirmar el envío: una vez por circular (reintentos y otras pestañas reciben el mismo)
    circular_asignar_numero(a) {
      const b = tabla('circular_borradores').find((x) => x.id === a.p_borrador);
      if (!b || !esAdmin(b.colegio_id)) err('Solo Administración envía circulares a la comunidad del colegio.');
      if (b.estado === 'anulada') err('Esa circular está anulada: no se envía.');
      const r = (repetido) => ({ id: b.id, version: b.version, serie_id: b.serie_id, numero: b.numero, consecutivo: b.consecutivo, estado: b.estado || 'borrador', repetido });
      if (b.numero) {
        if ((b.estado || 'borrador') === 'borrador' && tabla('circular_series').find((s) => s.id === b.serie_id)?.provisional) err(`El número ${b.consecutivo} viene de una serie provisional: valida la serie con los registros del colegio antes de emitir.`);
        return r(true);
      }
      if (b.version !== a.p_version) err(`La circular cambió mientras la enviabas (versión ${a.p_version} → ${b.version}): ábrela otra vez y revisa antes de enviar.`);
      const n = b.serie_id ? numeroDeSerie(b.colegio_id, b.serie_id, b.area_id || null, true) : consecutivoCircular(b.colegio_id, b.area_id || null, true);
      tabla('circular_borrador_versiones').push({ borrador_id: b.id, version: b.version, datos: b.datos, guardado_por: b.actualizado_por || null, guardado_en: b.actualizado_en || null });
      Object.assign(b, n, { datos: { ...b.datos, consecutivo: n.consecutivo }, version: b.version + 1, actualizado_en: ahora(), actualizado_por: usuario() });
      return r(false);
    },
    circular_mi_perfil(a) {
      const c = a.p_colegio, yo = usuario();
      if (!yo || !tabla('miembros').some((m) => m.colegio_id === c && m.perfil_id === yo && m.activo !== false)) return { admin: false, puede_preparar: false };
      const e = emisorCirc(c), f = tabla('circular_firmas').find((x) => x.colegio_id === c && x.perfil_id === yo);
      const area = e?.area_id ? tabla('circular_areas').find((x) => x.id === e.area_id) : null;
      return { admin: esAdmin(c), puede_preparar: puedePreparar(c), nombre: nombreDe(yo),
        emisor: e ? { cargo: e.cargo, area: area ? { id: area.id, nombre: area.nombre } : null } : null,
        firma: f ? { ruta: f.ruta, sha256: f.sha256, ancho: f.ancho, alto: f.alto, actualizado_en: f.actualizado_en } : null, formatos: formatosDe(c, yo) };
    },
    circular_area_formato_guardar(a) {
      soloAdmin(a.p_colegio);
      const c = a.p_colegio;
      if (!tabla('circular_areas').some((x) => x.id === a.p_area && x.colegio_id === c)) err('Esa área no es de este colegio.');
      if (!a.p_plantilla) err('Elige el formato.');
      // un solo formato por área: el nuevo reemplaza al que tuviera (como la base)
      if (a.p_asignar !== false) for (const x of tabla('circular_area_formatos').filter((y) => y.area_id === a.p_area && y.plantilla_id !== a.p_plantilla)) {
        tabla('circular_area_formatos').splice(tabla('circular_area_formatos').indexOf(x), 1); historia(c, 'area', a.p_area, 'formato_quitado', { plantilla_id: x.plantilla_id }, null);
      }
      const i = tabla('circular_area_formatos').findIndex((x) => x.area_id === a.p_area && x.plantilla_id === a.p_plantilla);
      if (a.p_asignar !== false && i < 0) { tabla('circular_area_formatos').push({ colegio_id: c, area_id: a.p_area, plantilla_id: a.p_plantilla, asignado_por: usuario(), asignado_en: ahora() }); historia(c, 'area', a.p_area, 'formato_asignado', null, { plantilla_id: a.p_plantilla }); }
      if (a.p_asignar === false && i >= 0) { tabla('circular_area_formatos').splice(i, 1); historia(c, 'area', a.p_area, 'formato_quitado', { plantilla_id: a.p_plantilla }, null); }
      return F.circular_formatos_por_area({ p_colegio: c });
    },
    circular_formatos_por_area(a) {
      soloAdmin(a.p_colegio);
      return tabla('circular_area_formatos').filter((x) => x.colegio_id === a.p_colegio).map((x) => ({ area_id: x.area_id, area: tabla('circular_areas').find((y) => y.id === x.area_id)?.nombre || '', plantilla_id: x.plantilla_id }));
    },
    circular_firma_guardar(a) {
      const c = a.p_colegio, yo = usuario();
      if (!puedePreparar(c)) err('Solo quien prepara circulares institucionales (Administración o quien el administrador designe) carga su firma.');
      if (!/^[0-9a-f]{64}$/.test(a.p_sha256 || '') || a.p_ruta !== `${c}/${yo}/${a.p_sha256}.png`) err('La firma no tiene una ruta válida.');
      if (!(a.p_ancho >= 20 && a.p_ancho <= 2000 && a.p_alto >= 10 && a.p_alto <= 1000)) err('La imagen de la firma no tiene un tamaño válido.');
      if (!existeArchivo('firmas', a.p_ruta)) err('La imagen de la firma no se alcanzó a subir. Intenta de nuevo.');
      let f = tabla('circular_firmas').find((x) => x.colegio_id === c && x.perfil_id === yo);
      const antes = f?.ruta || null;
      if (!f) tabla('circular_firmas').push((f = { colegio_id: c, perfil_id: yo }));
      Object.assign(f, { ruta: a.p_ruta, sha256: a.p_sha256, ancho: a.p_ancho, alto: a.p_alto, actualizado_en: ahora() });
      return { ruta: a.p_ruta, anterior: antes !== a.p_ruta ? antes : null };
    },
    circular_firma_borrar(a) {
      if (!usuario()) err('Inicia sesión para quitar tu firma.');
      const f = tabla('circular_firmas').find((x) => x.colegio_id === a.p_colegio && x.perfil_id === usuario());
      if (f) tabla('circular_firmas').splice(tabla('circular_firmas').indexOf(f), 1);
      return { anterior: f?.ruta || null };
    },
    circular_emisor_guardar(a) {
      soloAdmin(a.p_colegio);
      const c = a.p_colegio, cargo = String(a.p_cargo || '').trim();
      if (!tabla('miembros').some((m) => m.colegio_id === c && m.perfil_id === a.p_perfil && m.activo !== false && ['admin', 'profesor', 'director_seccion', 'enfermeria'].includes(m.rol))) err('Solo el personal del colegio (no familias ni estudiantes) prepara circulares.');
      if (cargo.length < 2 || cargo.length > 160) err('Escribe el cargo con el que firma (ej.: Gerente, Directora de Sección Infantil, Rectora).');
      if (a.p_area && !tabla('circular_areas').some((x) => x.id === a.p_area && x.colegio_id === c)) err('Esa área no es de este colegio.');
      let e = tabla('circular_emisores').find((x) => x.colegio_id === c && x.perfil_id === a.p_perfil);
      const antes = e ? { ...e } : null;
      if (!e) tabla('circular_emisores').push((e = { colegio_id: c, perfil_id: a.p_perfil }));
      Object.assign(e, { cargo, area_id: a.p_area || null, activo: a.p_activo !== false, asignado_por: usuario(), asignado_en: ahora() });
      historia(c, 'emisor', a.p_perfil, !antes ? 'crear' : !e.activo ? 'retirar' : 'editar', antes, e);
      return { ...e };
    },
    circular_emisores_ver(a) {
      soloAdmin(a.p_colegio);
      const c = a.p_colegio;
      return tabla('circular_emisores').filter((e) => e.colegio_id === c).map((e) => {
        const area = e.area_id ? tabla('circular_areas').find((x) => x.id === e.area_id) : null;
        return { perfil_id: e.perfil_id, nombre: nombreDe(e.perfil_id) || '', cargo: e.cargo, activo: e.activo, asignado_en: e.asignado_en,
          area: area ? { id: area.id, nombre: area.nombre } : null, tiene_firma: tabla('circular_firmas').some((f) => f.colegio_id === c && f.perfil_id === e.perfil_id) };
      }).sort((x, y) => (y.activo - x.activo) || x.nombre.localeCompare(y.nombre));
    },
    circular_emitir(a) {
      const b = tabla('circular_borradores').find((x) => x.id === a.p_id);
      if (!b) err('Esa circular no existe o no tienes acceso.');
      soloAdmin(b.colegio_id);
      if (!a.p_solicitud) err('Falta la identificación de la operación.');
      if (b.estado === 'emitida') return { ...b, repetido: true };
      if (b.estado === 'anulada') err('Esa circular está anulada.');
      if (!b.numero) {
        const n = b.serie_id ? numeroDeSerie(b.colegio_id, b.serie_id, b.area_id || null, true) : consecutivoCircular(b.colegio_id, b.area_id || null, true);
        Object.assign(b, n, { datos: { ...b.datos, consecutivo: n.consecutivo } });
      } else if (tabla('circular_series').find((s) => s.id === b.serie_id)?.provisional !== false) {
        err(`El número ${b.consecutivo} viene de una serie provisional: valida la serie con los registros del colegio antes de emitir.`);
      }
      Object.assign(b, { estado: 'emitida', emitida_en: ahora(), emitida_por: usuario(), emision_solicitud: a.p_solicitud });
      return { ...b, repetido: false };
    },
    circular_anular(a) {
      const b = tabla('circular_borradores').find((x) => x.id === a.p_id);
      if (!b) err('Esa circular no existe o no tienes acceso.');
      soloAdmin(b.colegio_id);
      if (b.estado === 'anulada') return { ...b, repetido: true };
      if (b.estado !== 'emitida') err('Solo se anula una circular emitida (un borrador se elimina y su número queda anulado).');
      if (String(a.p_motivo || '').trim().length < 5) err('Escribe el motivo de la anulación.');
      Object.assign(b, { estado: 'anulada', anulada_en: ahora(), anulada_por: usuario(), anulacion_motivo: a.p_motivo.trim().slice(0, 500) });
      if (!tabla('circular_numeros_anulados').some((x) => x.serie_id === b.serie_id && x.numero === b.numero)) tabla('circular_numeros_anulados').push({ serie_id: b.serie_id, numero: b.numero, colegio_id: b.colegio_id,
        consecutivo: b.consecutivo, borrador_id: b.id, solicitud_id: b.solicitud_id, titulo: b.datos?.titulo || null, anulado_por: usuario(), anulado_en: ahora(), motivo: b.anulacion_motivo });
      return { ...b, repetido: false };
    },
  };
  return (nombre, a) => {
    const f = F[nombre];
    if (!f) err(`Función desconocida: ${nombre}`);
    const r = f(a || {});
    guardar();
    return JSON.parse(JSON.stringify(r));
  };
}
