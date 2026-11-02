// Firma propia para las circulares institucionales (Fabio, 2-nov-2026): Gerencia, directores de sección, la rectora y quien
// el administrador designe cargan una foto de su firma; Complex la limpia (fondo transparente, recortada), la guarda PRIVADA
// (bucket «firmas», solo su dueño la ve) y la pone ENCIMA de su nombre en el PDF de las circulares que esa persona genera.
// Nadie puede poner la firma de otro: el servidor usa siempre la de quien pide el PDF (migración 20261102140000).
import { E } from './estado.js';
import { esc, aviso, ventana, confirmar, fechaHora } from './ui.js';

const MAX_BYTES = 307200; // como el bucket
let cache = { clave: null, valor: null, pidiendo: null };

// Lo que la base dice de quien entra: si prepara circulares, su cargo y área, y si ya cargó su firma (una vez por colegio y persona)
export async function perfilCircular(forzar = false) {
  const clave = E.colegio?.id + '|' + E.yo?.id;
  if (!forzar && cache.clave === clave && cache.valor) return cache.valor;
  if (!forzar && cache.clave === clave && cache.pidiendo) return cache.pidiendo;
  cache = { clave, valor: null, pidiendo: null };
  cache.pidiendo = (async () => {
    let v;
    try { v = await E.db.rpc('circular_mi_perfil', { p_colegio: E.colegio.id }); }
    catch { v = null; } // base sin la migración: como antes, solo Administración
    v ||= { admin: E.rol === 'admin', puede_preparar: E.rol === 'admin', nombre: null, emisor: null, firma: null, sin_firmas: true };
    if (cache.clave === clave) cache.valor = v;
    return v;
  })();
  return cache.pidiendo;
}

export async function urlFirma(firma) { return firma?.ruta ? E.db.urlArchivo('firmas', firma.ruta) : null; }

// ---------------------------------------------------------------- Limpiar la foto de la firma
// Toma el tono del papel (el más común en la foto), deja transparente lo claro y opaco lo oscuro (la tinta), recorta al
// trazo con un margen y la deja de máximo 900 × 300 px en PNG (menos de 300 KB). Nada sale del equipo hasta «Guardar».
export async function prepararFirma(archivo) {
  if (!archivo || !/^image\//.test(archivo.type || '') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(archivo.name || '')) throw new Error('Elige una foto (JPG o PNG) de tu firma.');
  if (archivo.size > 20 * 1024 * 1024) throw new Error('La foto pesa más de 20 MB: toma una más liviana.');
  const url = URL.createObjectURL(archivo);
  let img;
  try { img = new Image(); img.src = url; await img.decode(); }
  catch { throw new Error('No se pudo leer la imagen. Usa una foto JPG o PNG.'); }
  finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); // una PNG con transparencia cuenta como papel blanco
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h), px = d.data, n = w * h;
  const L = new Uint8ClampedArray(n), hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) { const v = (px[i * 4] * 299 + px[i * 4 + 1] * 587 + px[i * 4 + 2] * 114) / 1000; L[i] = v; hist[L[i]]++; }
  let papel = 255;
  for (let v = 0, acum = 0; v < 256; v++) { acum += hist[v]; if (acum >= n * 0.55) { papel = v; break; } }
  if (papel < 110) throw new Error('El fondo se ve muy oscuro. Firma con tinta oscura sobre papel blanco y toma la foto con buena luz.');
  const claro = papel - 22, oscuro = Math.max(0, claro - 95);
  let x0 = w, y0 = h, x1 = -1, y1 = -1, tinta = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, Math.min(1, (claro - L[i]) / (claro - oscuro)));
    px[i * 4 + 3] = Math.round(a * 255);
    px[i * 4] = Math.round(px[i * 4] * 0.55); px[i * 4 + 1] = Math.round(px[i * 4 + 1] * 0.55); px[i * 4 + 2] = Math.round(px[i * 4 + 2] * 0.55); // tinta más nítida
    if (a > 0.16) { tinta++; const x = i % w, y = (i / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0 || tinta < n * 0.0015) throw new Error('No se ve la firma. Firma con tinta oscura sobre papel blanco y que ocupe buena parte de la foto.');
  const caja = (x1 - x0 + 1) * (y1 - y0 + 1);
  if (tinta > caja * 0.45) throw new Error('La foto no parece una firma sobre papel blanco (hay demasiadas zonas oscuras). Recórtala o tómala de nuevo.');
  ctx.putImageData(d, 0, 0);
  const m = Math.round(Math.max(w, h) * 0.01) + 4;
  x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w - 1, x1 + m); y1 = Math.min(h - 1, y1 + m);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  for (let escala = Math.min(1, 900 / cw, 300 / ch), intento = 0; intento < 6; intento++, escala *= 0.8) {
    const ancho = Math.max(20, Math.round(cw * escala)), alto = Math.max(10, Math.round(ch * escala));
    const o = document.createElement('canvas'); o.width = ancho; o.height = alto;
    const octx = o.getContext('2d');
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(c, x0, y0, cw, ch, 0, 0, ancho, alto);
    const blob = await new Promise((ok) => o.toBlob(ok, 'image/png'));
    if (blob && blob.size <= MAX_BYTES) return { blob, ancho, alto };
  }
  throw new Error('No se pudo dejar la firma por debajo de 300 KB. Toma una foto más cercana a la firma.');
}

const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

// Sube la firma (nombre = su huella, en la carpeta de la persona), la registra y borra la anterior
export async function guardarFirma({ blob, ancho, alto }) {
  const sha = hex(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
  const ruta = `${E.colegio.id}/${E.yo.id}/${sha}.png`;
  try { await E.db.subirArchivo('firmas', ruta, new File([blob], sha + '.png', { type: 'image/png' })); }
  catch (e) { if (!/exist|duplicate|409/i.test(e.message || '')) throw e; } // ya estaba (un intento anterior sí llegó)
  const r = await E.db.rpc('circular_firma_guardar', { p_colegio: E.colegio.id, p_ruta: ruta, p_sha256: sha, p_ancho: ancho, p_alto: alto });
  if (r?.anterior) E.db.borrarArchivo('firmas', r.anterior).catch(() => {});
  return perfilCircular(true);
}

export async function quitarFirma() {
  const r = await E.db.rpc('circular_firma_borrar', { p_colegio: E.colegio.id });
  if (r?.anterior) await E.db.borrarArchivo('firmas', r.anterior).catch(() => {});
  return perfilCircular(true);
}

// ---------------------------------------------------------------- «Mi firma» en Mi cuenta y ajustes
export async function pintarMiFirma(sec) {
  if (!sec) return;
  const p = await perfilCircular();
  if (!p.puede_preparar || p.sin_firmas || !sec.isConnected) { sec.hidden = true; return; }
  const url = p.firma ? await urlFirma(p.firma).catch(() => null) : null;
  sec.hidden = false;
  sec.innerHTML = `
    <h2>Mi firma</h2>
    <p class="ayuda">Para las circulares institucionales: va <b>encima de tu nombre</b> en el PDF de las circulares que tú generas.
      Es privada: solo tú la ves y nadie más puede ponerla en un documento.</p>
    ${p.firma ? `<div class="firma-muestra">${url ? `<img src="${esc(url)}" alt="Tu firma" data-firma-img>` : '<span class="ayuda">No se pudo mostrar tu firma.</span>'}
        <b>${esc((p.nombre || '').toLocaleUpperCase('es-CO'))}</b>${p.emisor?.cargo ? `<span>${esc(p.emisor.cargo)}</span>` : ''}</div>
      <small class="ayuda">Cargada ${esc(fechaHora(p.firma.actualizado_en))}</small>` : '<p>Aún no has cargado tu firma.</p>'}
    <div class="acciones-grupo">
      <label class="btn">✍️ ${p.firma ? 'Cambiar mi firma' : 'Cargar mi firma'}<input type="file" accept="image/*" data-firma-archivo hidden></label>
      ${p.firma ? '<button type="button" class="btn btn-peligro" data-firma-quitar>Quitar mi firma</button>' : ''}
    </div>
    <p class="ayuda">Firma con tinta oscura sobre una hoja blanca, toma la foto de cerca y con buena luz. Complex quita el fondo y la recorta.</p>`;
  sec.querySelector('[data-firma-archivo]').addEventListener('change', async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    let lista;
    try { lista = await prepararFirma(archivo); } catch (err) { aviso(err.message, 'error'); return; }
    const vista = URL.createObjectURL(lista.blob);
    const r = await ventana({
      titulo: 'Así quedará tu firma',
      html: `<div class="firma-muestra"><img src="${vista}" alt="Firma lista para guardar"><b>${esc((p.nombre || '').toLocaleUpperCase('es-CO'))}</b>${p.emisor?.cargo ? `<span>${esc(p.emisor.cargo)}</span>` : ''}</div>
        <p class="ayuda">Así va encima de tu nombre en el PDF. Si se ve cortada, borrosa o con manchas, cancela y toma otra foto.</p>`,
      botones: [{ texto: 'Cancelar' }, { texto: 'Guardar mi firma', valor: 'si' }],
    });
    URL.revokeObjectURL(vista);
    if (r !== 'si') return;
    try { await guardarFirma(lista); aviso('Firma guardada'); pintarMiFirma(sec); } catch (err) { aviso(err.message, 'error'); }
  });
  sec.querySelector('[data-firma-quitar]')?.addEventListener('click', async () => {
    if (!(await confirmar('¿Quitar tu firma?', 'Tus próximos PDF saldrán sin firma hasta que cargues otra. Los PDF que ya descargaste no cambian.', 'Quitar'))) return;
    try { await quitarFirma(); aviso('Firma quitada'); pintarMiFirma(sec); } catch (err) { aviso(err.message, 'error'); }
  });
}
