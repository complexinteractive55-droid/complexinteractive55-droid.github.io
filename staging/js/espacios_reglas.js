// Solicitud de espacios académicos: reglas puras de la pantalla (se prueban en pruebas/unitarias/espacios_reglas.test.mjs).
// La base las vuelve a revisar todas al enviar (solicitar_espacio) y al aprobar (decidir_solicitud_espacio).
// Reglas de Fabio (28-oct): solicitud con aprobación; franjas del horario de clases de lunes a viernes; una franja o varias
// seguidas; solo las aprobadas ocupan el espacio. Hora de Colombia.

export const ESPACIOS = ['Sala de consulta', 'Sala de sistemas', 'Laboratorio', 'Sala 1 del Majuy', 'Sala 2 del Majuy', 'Salón STEAM'];
export const MAX_TEXTO = 2000;
export const ESTADO = {
  pendiente: 'Solicitud enviada · pendiente de aprobación',
  aprobada: 'Reserva confirmada',
  rechazada: 'Rechazada',
};
export const MOTIVO = { pasado: 'ya pasó', reservado: 'reservado', bloqueado: 'bloqueado' };
export const etiquetaFranja = (f) => (f.disponible ? 'Disponible' : `No disponible${MOTIVO[f.motivo] ? ' · ' + MOTIVO[f.motivo] : ''}`);

export const hhmm = (t) => String(t || '').slice(0, 5);
const ZONA = 'America/Bogota';
export function hoyBogota(ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}
const comoFecha = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)) : null; };
export function sumarDias(iso, n) { const d = comoFecha(iso); if (!d) return ''; d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
// 1 = lunes … 7 = domingo
export function diaSemana(iso) { const d = comoFecha(iso); return d ? ((d.getUTCDay() + 6) % 7) + 1 : 0; }
export function fechaLarga(iso) {
  const d = comoFecha(iso);
  return d ? new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d) : '';
}
// El siguiente día de lunes a viernes desde iso (incluido)
export function diaHabil(iso) { let d = iso; for (let i = 0; i < 7 && diaSemana(d) > 5; i++) d = sumarDias(d, 1); return d; }

// Franjas de UN espacio en UNA fecha: [{ hora_inicio, hora_fin, disponible, motivo }]
export const ordenar = (franjas) => [...franjas].sort((a, b) => hhmm(a.hora_inicio).localeCompare(hhmm(b.hora_inicio)) || hhmm(a.hora_fin).localeCompare(hhmm(b.hora_fin)));
export const iniciosPosibles = (franjas) => [...new Set(ordenar(franjas).filter((f) => f.disponible).map((f) => hhmm(f.hora_inicio)))];
// Finales posibles desde un inicio: pasando solo por franjas disponibles y seguidas (una empieza cuando termina la anterior)
export function finesPosibles(franjas, inicio) {
  const disp = franjas.filter((f) => f.disponible);
  const fines = new Set();
  let frente = [hhmm(inicio)];
  const vistos = new Set();
  while (frente.length) {
    const sig = [];
    for (const t of frente) for (const f of disp) if (hhmm(f.hora_inicio) === t && !vistos.has(hhmm(f.hora_fin))) { vistos.add(hhmm(f.hora_fin)); fines.add(hhmm(f.hora_fin)); sig.push(hhmm(f.hora_fin)); }
    frente = sig;
  }
  return [...fines].sort();
}

// Errores en el orden del formulario; campo = el que hay que enfocar
export function validar(f, franjas = [], hoy = hoyBogota()) {
  const t = (s) => String(s ?? '').trim();
  if (!f.espacio) return { campo: 'espacio', error: 'Elige el espacio académico.' };
  if (!f.fecha) return { campo: 'fecha', error: 'Elige la fecha.' };
  if (f.fecha < hoy) return { campo: 'fecha', error: 'La fecha ya pasó: elige hoy o un día siguiente.' };
  if (diaSemana(f.fecha) > 5) return { campo: 'fecha', error: 'Los espacios se piden de lunes a viernes.' };
  if (!f.inicio) return { campo: 'inicio', error: 'Elige la hora de inicio (una franja «Disponible»).' };
  if (!f.fin) return { campo: 'fin', error: 'Elige la hora de finalización.' };
  if (f.fin <= f.inicio) return { campo: 'fin', error: 'La hora de finalización debe ser después de la de inicio.' };
  if (!iniciosPosibles(franjas).includes(f.inicio) || !finesPosibles(franjas, f.inicio).includes(f.fin))
    return { campo: 'inicio', error: 'Ese horario no está disponible completo: elige franjas «Disponible» seguidas.' };
  if (t(f.actividad).length < 3) return { campo: 'actividad', error: 'Describe la actividad que se realizará.' };
  if (t(f.objetivo).length < 3) return { campo: 'objetivo', error: 'Describe el objetivo de la actividad.' };
  if (f.requiere !== 'si' && f.requiere !== 'no') return { campo: 'requiere', error: 'Responde si requieres recursos adicionales.' };
  if (f.requiere === 'si' && !t(f.recursos)) return { campo: 'recursos', error: 'Escribe los recursos que necesitas y cuántos.' };
  for (const k of ['actividad', 'objetivo', 'recursos']) if (t(f[k]).length > MAX_TEXTO) return { campo: k, error: `Es muy largo (máximo ${MAX_TEXTO} caracteres).` };
  return { error: null };
}

// Lo que dice el servidor cuando el horario se ocupó o se bloqueó mientras tanto / cuando no hubo red
export const esConflicto = (m) => /ya no está disponible|se cruza|bloquead/i.test(String(m || ''));
export const esSinRed = (m) => /sin conexión|failed to fetch|networkerror|load failed|network/i.test(String(m || ''));
