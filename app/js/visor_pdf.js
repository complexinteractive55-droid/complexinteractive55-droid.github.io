// Visor de PDF DENTRO de la app (4-nov-2026, Fabio: la circular «debe verse el pdf de forma completa como tipo documento» en el
// mismo mensaje de la bandeja). Cada página se dibuja como una hoja a lo ancho de la pantalla, también en el celular (Chrome de
// Android no muestra un PDF dentro de la página: solo ofrecía abrirlo aparte). Usa PDF.js 6.4.299 (Mozilla, licencia Apache 2.0),
// guardado en vendor/ (versión «legacy», para celulares no tan nuevos): no se pide a ningún servicio externo y se carga solo la
// primera vez que se abre un documento. Las hojas son imágenes del documento; el archivo oficial sigue siendo el PDF.
const BASE = new URL('../vendor/pdfjs-6.4.299/', import.meta.url).href;
let cargando = null;
const pdfjs = () => (cargando ||= import(BASE + 'pdf.min.mjs').then((m) => { m.GlobalWorkerOptions.workerSrc = BASE + 'pdf.worker.min.mjs'; return m; })
  .catch((e) => { cargando = null; throw e; }));
// Tope de páginas que se dibujan aquí (una circular tiene 1 a 3); el resto se ve con «Abrir el PDF»
export const MAX_PAGINAS = 30;
const HOJA_MAX = 860; // ancho máximo de la hoja en pantalla (el mismo de .hoja-pdf en estilos.css)

// Dibuja las páginas de `datos` (ArrayBuffer o Uint8Array del PDF) en `caja`, a su ancho. Devuelve el número de páginas.
// Si el ancho de la caja crece bastante (el celular se gira), vuelve a dibujarlas con más detalle.
export async function dibujarPdf(caja, datos, { titulo = 'Documento' } = {}) {
  const bytes = new Uint8Array(datos instanceof ArrayBuffer ? datos : datos.buffer.slice(datos.byteOffset, datos.byteOffset + datos.byteLength));
  const lib = await pdfjs();
  let anchoDibujado = 0, total = 0, turno = 0;
  const dibujar = async () => {
    const mio = ++turno;
    const css = Math.min(Math.max(caja.clientWidth, 280), HOJA_MAX), dpr = Math.min(window.devicePixelRatio || 1, 3);
    const ancho = Math.min(Math.round(css * dpr), 2400); // píxeles reales de cada hoja (nítida sin gastar demasiada memoria)
    // copia: PDF.js se queda con el arreglo que recibe (lo pasa a su hilo)
    const tarea = lib.getDocument({ data: bytes.slice(), enableXfa: false, useWasm: false, isOffscreenCanvasSupported: false });
    try {
      const doc = await tarea.promise;
      total = doc.numPages;
      for (let n = 1; n <= Math.min(total, MAX_PAGINAS); n++) {
        if (mio !== turno || !caja.isConnected) return;
        const pag = await doc.getPage(n);
        const base = pag.getViewport({ scale: 1 }), vista = pag.getViewport({ scale: ancho / base.width });
        const lienzo = document.createElement('canvas');
        lienzo.width = Math.round(vista.width); lienzo.height = Math.round(vista.height);
        lienzo.className = 'hoja-pdf';
        lienzo.style.aspectRatio = `${base.width} / ${base.height}`;
        lienzo.setAttribute('role', 'img');
        lienzo.setAttribute('aria-label', `${titulo} · página ${n} de ${total}`);
        await pag.render({ canvas: lienzo, viewport: vista }).promise;
        pag.cleanup();
        // la primera hoja aparece apenas está lista; las demás se agregan en orden
        if (n === 1) caja.replaceChildren(lienzo); else caja.append(lienzo);
      }
      if (mio !== turno) return;
      if (total > MAX_PAGINAS) caja.insertAdjacentHTML('beforeend', `<p class="ayuda">El documento tiene ${total} páginas: aquí se ven las primeras ${MAX_PAGINAS}. Ábrelo completo con «Abrir el PDF».</p>`);
      anchoDibujado = ancho;
    } finally { tarea.destroy(); } // libera el documento y su hilo
  };
  await dibujar();
  if ('ResizeObserver' in window) {
    let espera = null;
    const ro = new ResizeObserver(() => {
      if (!caja.isConnected) { ro.disconnect(); return; }
      clearTimeout(espera);
      espera = setTimeout(() => {
        const dpr = Math.min(window.devicePixelRatio || 1, 3), quiere = Math.min(Math.round(Math.min(caja.clientWidth, HOJA_MAX) * dpr), 2400);
        if (anchoDibujado && quiere > anchoDibujado * 1.25) dibujar().catch(() => {});
      }, 300);
    });
    ro.observe(caja);
  }
  return total;
}
