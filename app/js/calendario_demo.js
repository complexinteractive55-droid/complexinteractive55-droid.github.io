// Calendario institucional en el MODO DEMO (todo queda en este navegador): las mismas reglas que
// supabase/migrations/20261029140000_calendario_institucional.sql (calendario_importar, calendario_anotar).
import { huellaDia } from './calendario_importar.js';

export function crearCalendarioDemo({ tabla, usuario, guardar, ahora, err }) {
  const esAdmin = (colegio) => tabla('miembros').some((m) => m.colegio_id === colegio && m.perfil_id === usuario() && m.rol === 'admin' && m.activo !== false);
  const id = () => crypto.randomUUID();
  const entero = (v, a, b) => { if (v == null || v === '') return null; const n = Number(v); return Number.isInteger(n) && n >= a && n <= b ? n : NaN; };

  async function importar(a) {
    if (!usuario() || !esAdmin(a.p_colegio)) err('Solo el administrador del colegio importa el calendario institucional.');
    if (!/^[0-9a-f]{64}$/.test(a.p_sha256 || '')) err('Falta la huella del archivo.');
    const dias = Array.isArray(a.p_dias) ? a.p_dias : JSON.parse(a.p_dias || '[]');
    if (!dias.length) err('El archivo no trae fechas.');
    const desde = a.p_meta?.cobertura_desde || null, hasta = a.p_meta?.cobertura_hasta || null;
    const vistas = new Set(), errores = [];
    for (const x of dias) {
      const e = !/^\d{4}-\d{2}-\d{2}$/.test(x.fecha || '') ? 'sin fecha' : vistas.has(x.fecha) ? 'fecha repetida en el archivo'
        : (desde && x.fecha < desde) || (hasta && x.fecha > hasta) ? 'fuera de la cobertura del documento' : !String(x.tipo || '').trim() ? 'sin tipo de jornada o registro'
        : [entero(x.dia_ciclo, 1, 20), entero(x.ciclo, 1, 99), entero(x.pagina, 1, 999)].some(Number.isNaN) ? 'día de ciclo, ciclo o página fuera de rango' : null;
      vistas.add(x.fecha);
      if (e) errores.push({ fila: x.fila, fecha: x.fecha, error: e });
    }
    if (errores.length) err('El archivo tiene filas no válidas; no se importó nada.');
    let f = tabla('calendario_fuentes').find((x) => x.colegio_id === a.p_colegio && x.sha256 === a.p_sha256);
    if (f && !a.p_aplicar_cambios) return { fuente_id: f.id, ya_importado: true, nuevos: 0, iguales: f.fechas, cambios_aplicados: 0, cambios_pendientes: 0 };
    let nueva = false;
    if (!f) {
      f = { id: id(), colegio_id: a.p_colegio, sha256: a.p_sha256, nombre_archivo: String(a.p_nombre || 'cronograma.xlsx').slice(0, 200), documento: a.p_meta?.documento || null,
        institucion: a.p_meta?.institucion || null, notas: a.p_meta?.notas || {}, cobertura_desde: desde, cobertura_hasta: hasta, fechas: dias.length, importado_por: usuario(), importado_en: ahora() };
      tabla('calendario_fuentes').push(f);
      nueva = true;
    }
    let nuevos = 0, iguales = 0, aplicados = 0, pendientes = 0;
    for (const x of dias) {
      const d = { fecha: x.fecha, dia_ciclo: entero(x.dia_ciclo, 1, 20), ciclo: entero(x.ciclo, 1, 99), tipo: String(x.tipo).trim(), descripcion: x.descripcion || '',
        horario_texto: x.horario_texto || '', pagina: entero(x.pagina, 1, 999), estado_fuente: x.estado_fuente || '', dudas: x.dudas || '' };
      d.huella = await huellaDia(d);
      const ya = tabla('calendario_dias').find((y) => y.colegio_id === a.p_colegio && y.fecha === d.fecha && y.vigente);
      if (ya && ya.huella === d.huella) { iguales++; continue; }
      if (ya && !a.p_aplicar_cambios) { pendientes++; continue; }
      if (ya) { Object.assign(ya, { vigente: false, reemplazado_en: ahora(), reemplazado_por_fuente: f.id }); aplicados++; } else nuevos++;
      tabla('calendario_dias').push({ id: id(), colegio_id: a.p_colegio, fuente_id: f.id, ...d, fila: x.fila ?? null, vigente: true, reemplazado_en: null, reemplazado_por_fuente: null, creado_en: ahora() });
    }
    guardar();
    return { fuente_id: f.id, ya_importado: !nueva && !aplicados && !nuevos, nuevos, iguales, cambios_aplicados: aplicados, cambios_pendientes: pendientes };
  }

  function anotar(a) {
    if (!usuario() || !esAdmin(a.p_colegio)) err('Solo el administrador del colegio registra indicaciones en el calendario.');
    if (a.p_id) {
      if (!['pendiente_confirmacion', 'confirmada', 'descartada'].includes(a.p_estado)) err('Estado no válido.');
      const x = tabla('calendario_anotaciones').find((y) => y.id === a.p_id && y.colegio_id === a.p_colegio);
      if (!x) err('Esa indicación no existe en este colegio.');
      Object.assign(x, { estado: a.p_estado, revisado_por: usuario(), revisado_en: ahora() });
      guardar();
      return { ...x };
    }
    if (String(a.p_texto || '').trim().length < 3) err('Escribe la indicación.');
    if (String(a.p_origen || '').trim().length < 3) err('Escribe de dónde sale la indicación (no está impresa en el cronograma).');
    const x = { id: id(), colegio_id: a.p_colegio, fecha: a.p_fecha, texto: a.p_texto.trim(), origen: a.p_origen.trim(), impresa_en_fuente: false,
      estado: 'pendiente_confirmacion', creado_por: usuario(), creado_en: ahora(), revisado_por: null, revisado_en: null };
    tabla('calendario_anotaciones').push(x);
    guardar();
    return { ...x };
  }

  return (nombre, a) => {
    if (nombre === 'calendario_importar') return importar(a);
    if (nombre === 'calendario_anotar') return anotar(a);
    err(`Función desconocida: ${nombre}`);
  };
}
