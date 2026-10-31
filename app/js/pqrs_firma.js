// Verificación del FORMATO de un adjunto de PQRS por su firma (los primeros bytes), no por el nombre ni por lo que diga el
// navegador. La usa la Edge Function pqrs-adjuntos (copia idéntica en supabase/functions/pqrs-adjuntos/firma.mjs; la prueba
// pruebas/unitarias/pqrs_archivos.test.mjs comprueba que sean iguales) y el modo demo.
// NO es un antivirus: comprueba que el contenido sea del formato permitido y rechaza lo que trae código (PDF con JavaScript o
// acciones de abrir programas, Office con macros). Un archivo «listo» tiene el formato verificado, no está «analizado».
const empieza = (b, firma, desde = 0) => firma.every((x, i) => b[desde + i] === x);
const ascii = (b, desde, largo) => String.fromCharCode(...b.subarray(desde, desde + largo));
const texto = (b) => new TextDecoder('latin1').decode(b);
const ESPERADO = { jpg: 'jpeg', jpeg: 'jpeg', png: 'png', webp: 'webp', heic: 'heif', heif: 'heif', pdf: 'pdf', docx: 'zip', xlsx: 'zip' };

export function verificarFirma(bytes, ext) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  ext = String(ext || '').toLowerCase();
  if (!b.length) return { ok: false, formato: null, motivo: 'El archivo está vacío.' };
  let formato = null;
  if (empieza(b, [0xff, 0xd8, 0xff])) formato = 'jpeg';
  else if (empieza(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) formato = 'png';
  else if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') formato = 'webp';
  else if (b.length >= 12 && ascii(b, 4, 4) === 'ftyp' && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1|heif)$/.test(ascii(b, 8, 4))) formato = 'heif';
  else if (ascii(b, 0, 5) === '%PDF-') formato = 'pdf';
  else if (empieza(b, [0x50, 0x4b, 0x03, 0x04])) formato = 'zip';
  const esperado = ESPERADO[ext];
  if (!esperado) return { ok: false, formato, motivo: 'Ese tipo de archivo no se admite.' };
  if (formato !== esperado) return { ok: false, formato, motivo: `El contenido no es un ${ext.toUpperCase()} aunque el nombre lo diga.` };
  if (formato === 'pdf' && /\/(JavaScript|JS|Launch|EmbeddedFiles?|RichMedia)\b/.test(texto(b))) {
    return { ok: false, formato, motivo: 'El PDF trae código o archivos incrustados: no se admite.' };
  }
  if (formato === 'zip') {
    const t = texto(b);
    if (!t.includes('[Content_Types].xml') || (ext === 'docx' && !t.includes('word/')) || (ext === 'xlsx' && !t.includes('xl/'))) {
      return { ok: false, formato, motivo: `El archivo no es un documento ${ext.toUpperCase()} válido.` };
    }
    if (/vbaProject\.bin|macroEnabled/i.test(t)) return { ok: false, formato, motivo: 'El documento trae macros: no se admite.' };
    formato = ext;
  }
  return { ok: true, formato, motivo: null };
}
