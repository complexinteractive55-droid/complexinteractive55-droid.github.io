// Calendario institucional desde el cronograma en Excel (.xlsx) — pedido de Fabio, 29-oct-2026.
// El archivo se lee en el equipo (no se envía a ningún servicio) y se arma una vista previa antes de importar.
// Reglas de la fuente (hoja «Fuente y lectura» del Excel), que aquí se respetan:
//  - no se extrapolan ciclos ni días: solo el día de ciclo y el ciclo IMPRESOS en cada fecha;
//  - una fecha que no está en el archivo, o una casilla vacía, NO es un día libre: es «sin registro»;
//  - no se inventan horarios: el horario solo existe como el texto que trae la fuente;
//  - las etiquetas repetidas (X-DAY, «Día 4» dos veces) se conservan tal cual, sin corregir la secuencia;
//  - un cambio posterior entra con su propia fuente y no reemplaza en silencio lo importado.
// Se usa igual en el navegador y en Node (pruebas): DecompressionStream existe en ambos.

const ZONA = 'America/Bogota';
export const COLUMNAS = {
  fecha: 'Fecha Bogotá', dia_semana: 'Día semana', dia_ciclo: 'Día de ciclo impreso', ciclo: 'Ciclo impreso',
  tipo: 'Tipo de jornada o registro', descripcion: 'Descripción en la fuente', horario: 'Horario textual explícito',
  pagina: 'Página PDF', estado: 'Estado', dudas: 'Dudas y alcance', fuente: 'Fuente Library',
};
// Tipos que el cronograma marca como jornada especial (no se afirma nada de los demás días: no se infiere «día ordinario»)
export const ESPECIALES = new Set(['X-DAY', 'Adaptación', 'Día de la Fantasía', 'Jornada pedagógica', 'Receso escolar', 'Festivo']);
export const CATEGORIA = {
  'Festivo': 'festivo', 'Receso escolar': 'receso', 'Jornada pedagógica': 'jornada', 'X-DAY': 'especial', 'Adaptación': 'especial',
  'Día de la Fantasía': 'especial', 'Etiqueta de día sin evento': 'etiqueta', 'Actividad institucional': 'actividad',
};
export const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// ---------------------------------------------------------------- Lectura del .xlsx (zip + XML), sin librerías
async function inflar(bytes) {
  const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function abrirZip(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('El archivo no es un Excel (.xlsx) válido.');
  const n = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder('utf-8');
  const archivos = {};
  for (let i = 0; i < n; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('El Excel está dañado (índice del zip).');
    const metodo = dv.getUint16(p + 10, true), comp = dv.getUint32(p + 20, true);
    const ln = dv.getUint16(p + 28, true), le = dv.getUint16(p + 30, true), lc = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const nombre = dec.decode(b.subarray(p + 46, p + 46 + ln));
    const inicio = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
    if (/\.(xml|rels)$/i.test(nombre)) {
      const datos = b.subarray(inicio, inicio + comp);
      archivos[nombre] = dec.decode(metodo === 8 ? await inflar(datos) : metodo === 0 ? datos : (() => { throw new Error('Compresión no soportada en el Excel.'); })());
    }
    p += 46 + ln + le + lc;
  }
  return archivos;
}
const P = '(?:\\w+:)?';
const re = (s, f = 'g') => new RegExp(s.replaceAll('@', P), f);
const desXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&');
const textos = (x) => [...x.matchAll(re('<@t(?:\\s[^>]*)?>([\\s\\S]*?)</@t>'))].map((t) => desXml(t[1])).join('');
const colANum = (c) => [...c].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;

// Devuelve { hojas: { nombre: [[celda…]…] } } con cada celda como texto (fechas: ISO o número de serie de Excel)
export async function leerXlsx(bytes) {
  const z = await abrirZip(bytes);
  const wb = z['xl/workbook.xml'];
  if (!wb) throw new Error('El archivo no es un libro de Excel (.xlsx).');
  const ss = [...(z['xl/sharedStrings.xml'] || '').matchAll(re('<@si>([\\s\\S]*?)</@si>'))].map((m) => textos(m[1]));
  const rels = z['xl/_rels/workbook.xml.rels'] || '';
  const hojas = {};
  for (const [, tag] of wb.matchAll(re('(<@sheet\\s[^>]*>)'))) {
    const nombre = desXml(tag.match(/\bname="([^"]*)"/)?.[1] || '');
    const rid = tag.match(/\br:id="([^"]*)"/)?.[1];
    const rel = [...rels.matchAll(/<(?:\w+:)?Relationship\s[^>]*>/g)].map((m) => m[0]).find((r) => r.includes(`Id="${rid}"`));
    const destino = rel?.match(/Target="([^"]*)"/)?.[1];
    if (!destino) continue;
    const xml = z[destino.startsWith('/') ? destino.slice(1) : 'xl/' + destino];
    if (!xml) continue;
    const filas = [];
    for (const fila of xml.matchAll(re('<@row\\s[^>]*?r="(\\d+)"[^>]*>([\\s\\S]*?)</@row>'))) {
      const celdas = [];
      for (const [, col, attrs, cont] of fila[2].matchAll(re('<@c\\s+r="([A-Z]+)\\d+"([^>]*?)(?:/>|>([\\s\\S]*?)</@c>)'))) {
        if (!cont) continue;
        const v = cont.match(re('<@v>([\\s\\S]*?)</@v>', ''))?.[1];
        const t = attrs.match(/\bt="(\w+)"/)?.[1];
        celdas[colANum(col)] = t === 's' ? ss[+v] ?? '' : t === 'inlineStr' ? textos(cont) : v != null ? desXml(v) : '';
      }
      filas[+fila[1] - 1] = Array.from(celdas, (x) => x ?? '');
    }
    hojas[nombre] = Array.from(filas, (x) => x ?? []);
  }
  return { hojas };
}

// ---------------------------------------------------------------- Fechas en America/Bogota
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' });
export const fechaBogota = (d = new Date()) => fmt.format(d); // 'AAAA-MM-DD'
export const diaSemana = (iso) => DIAS_SEMANA[new Date(iso + 'T12:00:00Z').getUTCDay()];
// Celda de fecha: ISO ('2026-08-03T12:00:00.000Z' o '2026-08-03') o número de serie de Excel (días desde 1899-12-30)
export function fechaDeCelda(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) { const d = new Date(s); return isNaN(d) ? null : fechaBogota(d); }
  if (/^\d+(\.\d+)?$/.test(s)) { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(+s * 864e5)); return d.toISOString().slice(0, 10); }
  return null;
}
const entero = (v) => { const s = String(v ?? '').trim(); return s === '' ? null : /^\d+$/.test(s) ? +s : NaN; };
const limpio = (v) => String(v ?? '').replace(/\r\n?/g, '\n').trim();

// Huella del contenido de una fecha (lo que la fuente dice de ese día): SHA-256 de los campos separados por el carácter 31.
// La base calcula la misma (private.calendario_huella): reimportar lo mismo no cambia nada.
export const textoHuella = (d) => [d.fecha, d.dia_ciclo ?? '', d.ciclo ?? '', d.tipo, d.descripcion, d.horario_texto, d.pagina ?? '', d.estado_fuente, d.dudas]
  .map((x) => String(x ?? '')).join(String.fromCharCode(31));
export const huellaDia = (d) => sha256(new TextEncoder().encode(textoHuella(d)));

// ---------------------------------------------------------------- Del libro al cronograma (con dudas y errores)
export async function leerCronograma(libro) {
  const nombres = Object.keys(libro.hojas);
  const hojaCal = nombres.find((n) => /calendario/i.test(n)) || nombres[0];
  const hojaFuente = nombres.find((n) => /fuente/i.test(n));
  const filas = libro.hojas[hojaCal] || [];
  const iCab = filas.findIndex((f) => f.some((c) => limpio(c) === COLUMNAS.fecha));
  if (iCab < 0) throw new Error(`No encontré la columna «${COLUMNAS.fecha}» en la hoja «${hojaCal}».`);
  const cab = filas[iCab].map(limpio);
  const idx = Object.fromEntries(Object.entries(COLUMNAS).map(([k, t]) => [k, cab.indexOf(t)]));
  const faltan = Object.entries(idx).filter(([k, i]) => i < 0 && ['fecha', 'tipo', 'descripcion'].includes(k)).map(([k]) => COLUMNAS[k]);
  if (faltan.length) throw new Error(`Faltan columnas en el Excel: ${faltan.join(', ')}.`);
  // Hoja «Fuente y lectura»: pares etiqueta → valor
  const notas = {};
  for (const f of libro.hojas[hojaFuente] || []) if (limpio(f[0])) notas[limpio(f[0])] = limpio(f[1]);
  const cobertura = rangoCobertura(notas);
  const dias = [], errores = [];
  const vistos = new Map();
  filas.slice(iCab + 1).forEach((f, k) => {
    const filaExcel = iCab + 2 + k;
    if (!f.some((c) => limpio(c))) return;
    const val = (c) => (idx[c] >= 0 ? limpio(f[idx[c]]) : '');
    const fecha = fechaDeCelda(f[idx.fecha]);
    if (!fecha) { errores.push({ fila: filaExcel, error: `Fecha no válida: «${val('fecha')}»` }); return; }
    const d = {
      fila: filaExcel, fecha, dia_semana: diaSemana(fecha), dia_semana_archivo: val('dia_semana'),
      dia_ciclo: entero(val('dia_ciclo')), ciclo: entero(val('ciclo')),
      tipo: val('tipo'), descripcion: val('descripcion'), horario_texto: val('horario'),
      pagina: entero(val('pagina')), estado_fuente: val('estado'), dudas: val('dudas'), fuente_ref: val('fuente'),
      avisos: [],
    };
    if (Number.isNaN(d.dia_ciclo)) { d.avisos.push(`Día de ciclo no numérico («${val('dia_ciclo')}»): no se usa`); d.dia_ciclo = null; }
    if (Number.isNaN(d.ciclo)) { d.avisos.push(`Ciclo no numérico («${val('ciclo')}»): no se usa`); d.ciclo = null; }
    if (Number.isNaN(d.pagina)) { d.avisos.push(`Página no numérica («${val('pagina')}»)`); d.pagina = null; }
    if (d.dia_semana_archivo && d.dia_semana_archivo.toLowerCase() !== d.dia_semana) d.avisos.push(`El archivo dice «${d.dia_semana_archivo}» pero la fecha es ${d.dia_semana}`);
    if (!d.tipo) d.avisos.push('Sin tipo de jornada o registro');
    if (!d.descripcion && d.tipo !== 'Etiqueta de día sin evento') d.avisos.push('Sin descripción en la fuente');
    if (/discrepancia|revisar/i.test(d.estado_fuente)) d.avisos.push(`Estado en la fuente: ${d.estado_fuente}`);
    if (/\bposible\b/i.test(d.descripcion)) d.avisos.push('La fuente lo marca como «Posible»: se conserva como tentativo');
    if (d.pagina == null) d.avisos.push('Sin página del PDF para cotejar');
    if (cobertura && (fecha < cobertura.desde || fecha > cobertura.hasta)) d.avisos.push(`Fuera de la cobertura del documento (${cobertura.desde} a ${cobertura.hasta})`);
    if (vistos.has(fecha)) d.avisos.push(`Fecha repetida en el archivo (también en la fila ${vistos.get(fecha)})`);
    vistos.set(fecha, filaExcel);
    d.categoria = CATEGORIA[d.tipo] || 'otro';
    d.especial = ESPECIALES.has(d.tipo);
    d.tentativo = /\bposible\b/i.test(d.descripcion);
    dias.push(d);
  });
  for (const d of dias) d.huella = await huellaDia(d);
  dias.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.fila - b.fila));
  return {
    hoja: hojaCal, notas, cobertura,
    institucion: (notas['Institución'] || '').replace(/,.*$/, '').trim(),
    titulo: Object.keys(notas)[0] || '',
    documento: decodeURIComponent(notas['Fuente'] || ''),
    dias, errores,
  };
}

const MESES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
// «Agosto de 2026 a julio de 2027…» → { desde: '2026-08-01', hasta: '2027-07-31' }
function rangoCobertura(notas) {
  const t = (notas['Cobertura documental'] || notas['Límite temporal'] || '').toLowerCase();
  const m = [...t.matchAll(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+de)?\s+(\d{4})/g)];
  if (m.length < 2) return null;
  const [a, b] = [m[0], m[m.length - 1]];
  const fin = new Date(Date.UTC(+b[2], MESES[b[1]], 0)).getUTCDate();
  return { desde: `${a[2]}-${String(MESES[a[1]]).padStart(2, '0')}-01`, hasta: `${b[2]}-${String(MESES[b[1]]).padStart(2, '0')}-${fin}` };
}

// ---------------------------------------------------------------- Plan de importación (vista previa)
// existentes: días ya importados (vigentes) del colegio; eventos: eventos manuales del calendario (para posibles duplicados)
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
const VACIAS = new Set(['de', 'la', 'el', 'los', 'las', 'y', 'en', 'del', 'a', 'con', 'por', 'para', 'al', 'un', 'una']);
const palabras = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 2 && !VACIAS.has(w)));
export function parecidos(a, b) {
  const x = palabras(a), y = palabras(b);
  if (!x.size || !y.size) return false;
  const comunes = [...x].filter((w) => y.has(w)).length;
  return comunes / Math.min(x.size, y.size) >= 0.6;
}
export function planImportacion(crono, { existentes = [], eventos = [], fuentesPrevias = [] } = {}, sha = '') {
  const porFecha = new Map(existentes.map((d) => [d.fecha, d]));
  const fuente = fuentesPrevias.find((f) => f.sha256 === sha) || null;
  const filas = crono.dias.map((d) => {
    const ya = porFecha.get(d.fecha);
    const accion = !ya ? 'nuevo' : ya.huella === d.huella ? 'igual' : 'cambio';
    const dup = eventos.filter((e) => (e.fecha || String(e.inicio || '').slice(0, 10)) === d.fecha && d.descripcion && parecidos(e.titulo, d.descripcion));
    return { ...d, accion, anterior: accion === 'cambio' ? ya : null, posibles_duplicados: dup.map((e) => ({ id: e.id, titulo: e.titulo })) };
  });
  const enArchivo = new Set(crono.dias.map((d) => d.fecha));
  const ausentes = existentes.filter((d) => !enArchivo.has(d.fecha));
  const cuenta = (a) => filas.filter((f) => f.accion === a).length;
  return {
    ya_importado: !!fuente, fuente_previa: fuente, filas, ausentes,
    resumen: {
      fechas: filas.length, nuevos: cuenta('nuevo'), iguales: cuenta('igual'), cambios: cuenta('cambio'), ausentes: ausentes.length,
      con_notas_fuente: filas.filter((f) => f.dudas).length, con_avisos: filas.filter((f) => f.avisos.length).length,
      especiales: filas.filter((f) => f.especial).length, tentativos: filas.filter((f) => f.tentativo).length, posibles_duplicados: filas.filter((f) => f.posibles_duplicados.length).length,
      con_ciclo: filas.filter((f) => f.dia_ciclo != null).length, con_horario: filas.filter((f) => f.horario_texto).length, errores: crono.errores.length,
    },
  };
}

// Lo que se manda al servidor: solo los campos de la fuente (el servidor recalcula la huella y valida todo otra vez)
export const paraImportar = (d) => ({ fecha: d.fecha, dia_ciclo: d.dia_ciclo, ciclo: d.ciclo, tipo: d.tipo, descripcion: d.descripcion,
  horario_texto: d.horario_texto, pagina: d.pagina, estado_fuente: d.estado_fuente, dudas: d.dudas, fila: d.fila });

export async function sha256(bytes) {
  const h = await crypto.subtle.digest('SHA-256', bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------- Tarjeta «Hoy»
// Solo dice ciclo y día de ciclo si la fuente los imprime para esa fecha. Sin registro ≠ día libre.
export function hoyDe(dias, anotaciones = [], ahora = new Date()) {
  const fecha = fechaBogota(ahora);
  const d = dias.find((x) => x.fecha === fecha && x.vigente !== false) || null;
  return { fecha, dia_semana: diaSemana(fecha), registro: d, anotaciones: anotaciones.filter((a) => a.fecha === fecha && a.estado !== 'descartada') };
}
