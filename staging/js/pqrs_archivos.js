// Adjuntos de PQRS en el navegador: formatos y límites (propuesta; los que valen son los de la base, private.pqrs_limites),
// revisión rápida antes de subir y preparación de fotos. La revisión de aquí es solo para avisar pronto: la que decide es la
// del servidor (formato por la firma en la Edge Function pqrs-adjuntos, tamaño medido por Storage).
export const LIMITES = { max_mb: 10, por_mensaje: 5, formatos: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'pdf'] };
export const IMAGENES = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
export const extension = (nombre) => (String(nombre || '').match(/\.([A-Za-z0-9]{1,5})$/)?.[1] || '').toLowerCase();
export const tamanoTexto = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1).replace('.', ',')} MB`);
export const ACEPTA = LIMITES.formatos.map((f) => '.' + f).join(',') + ',image/*,application/pdf';

export function revisarArchivo(archivo, lim = LIMITES) {
  const ext = extension(archivo.name);
  if (!ext || !lim.formatos.includes(ext)) return { ok: false, ext, error: `«${archivo.name}»: ese tipo de archivo no se admite (permitidos: ${lim.formatos.filter((f) => f !== 'jpeg' && f !== 'heif').map((f) => f.toUpperCase()).join(', ')}).` };
  if (!archivo.size) return { ok: false, ext, error: `«${archivo.name}» está vacío.` };
  if (archivo.size > lim.max_mb * 1048576) return { ok: false, ext, error: `«${archivo.name}» pesa ${tamanoTexto(archivo.size)}: el máximo es ${lim.max_mb} MB.` };
  return { ok: true, ext };
}

// Fotos: se vuelven a guardar como JPEG (máx. 2000 px). Así se quitan los datos ocultos de la foto (ubicación GPS, cámara)
// —importante con fotos de estudiantes— y pesan menos. Si el navegador no puede leerla (p. ej. HEIC en Windows), va tal cual.
export async function prepararFoto(archivo, lado = 2000) {
  if (!IMAGENES.includes(extension(archivo.name)) || typeof createImageBitmap !== 'function') return archivo;
  try {
    const img = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
    const k = Math.min(1, lado / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.86));
    if (!blob) return archivo;
    return new File([blob], archivo.name.replace(/\.[A-Za-z0-9]{1,5}$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch { return archivo; }
}
