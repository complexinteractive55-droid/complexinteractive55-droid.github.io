// PDF del MODO DEMO (sin servidor ni plantilla oficial): un documento sencillo y real (texto seleccionable, tildes, varias páginas)
// con el contenido GUARDADO de la circular, marcado «DEMO», para probar el envío a la bandeja sin datos reales. La circular oficial
// la dibuja siempre el servidor (Edge Function circular-documentos) con la plantilla aprobada del colegio.
const ANCHO = 612, ALTO = 792, MARGEN = 64, CUERPO = 11, LINEA = 15;
const winAnsi = (s) => { // Helvetica con WinAnsiEncoding: las letras del español (á, é, í, ó, ú, ñ, ü, ¿, ¡) son su mismo código Latin-1
  let o = '';
  for (const ch of String(s).normalize('NFC')) {
    const c = ch.codePointAt(0);
    const b = c < 256 ? c : { 0x2013: 150, 0x2014: 151, 0x2018: 145, 0x2019: 146, 0x201c: 147, 0x201d: 148, 0x2022: 149, 0x2026: 133, 0x20ac: 128 }[c] ?? 63;
    o += b === 40 || b === 41 || b === 92 ? '\\' + String.fromCharCode(b) : b < 32 || b > 126 ? '\\' + b.toString(8).padStart(3, '0') : String.fromCharCode(b);
  }
  return o;
};
// Ancho aproximado de Helvetica (promedio por carácter) para partir las líneas
const cabe = (t, tam, ancho) => t.length * tam * 0.5 <= ancho;
function partir(texto, tam, ancho) {
  const out = [];
  for (const par of String(texto).split('\n')) {
    let l = '';
    for (const w of par.split(/\s+/).filter(Boolean)) { const n = l ? l + ' ' + w : w; if (cabe(n, tam, ancho) || !l) l = n; else { out.push(l); l = w; } }
    out.push(l);
  }
  return out;
}

export function pdfDemo(datos, consecutivo, colegio) {
  const lineas = [];
  const poner = (t, { tam = CUERPO, negrita = false, sangria = 0 } = {}) => partir(t, tam, ANCHO - 2 * MARGEN - sangria).forEach((x) => lineas.push({ t: x, tam, negrita, sangria }));
  poner(colegio || 'Colegio', { tam: 14, negrita: true });
  poner('DEMO · documento de prueba (sin el formato oficial del colegio)', { tam: 9 });
  lineas.push({ t: '' });
  poner(`Circular ${consecutivo || ''}`, { negrita: true });
  if (datos.fecha_emision) poner(`Fecha: ${datos.fecha_emision}`);
  if (datos.destinatarios) poner(`Para: ${datos.destinatarios}`);
  if (datos.dependencia) poner(`De: ${datos.dependencia}`);
  poner(`Asunto: ${datos.titulo || ''}`, { negrita: true });
  lineas.push({ t: '' });
  for (const b of datos.contenido?.bloques || []) {
    if (b.tipo === 'parrafo') poner(b.segmentos.map((s) => s.texto).join(''));
    else if (b.tipo === 'lista') b.elementos.forEach((e, i) => poner(`${b.ordenada ? i + 1 + '.' : '•'} ${e.segmentos.map((s) => s.texto).join('')}`, { sangria: 14 }));
    lineas.push({ t: '' });
  }
  if (datos.responsable) { poner(datos.responsable, { negrita: true }); if (datos.cargo) poner(datos.cargo); }
  // Páginas
  const porPagina = Math.floor((ALTO - 2 * MARGEN) / LINEA), paginas = [];
  for (let i = 0; i < lineas.length; i += porPagina) paginas.push(lineas.slice(i, i + porPagina));
  const objs = [];
  const obj = (s) => { objs.push(s); return objs.length; };
  const fN = obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const fB = obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const raiz = objs.length + paginas.length * 2 + 1; // el árbol de páginas va después de las páginas (contenido + página cada una)
  const kids = [];
  paginas.forEach((pg, n) => {
    let y = ALTO - MARGEN, s = '';
    for (const l of pg) { if (l.t) s += `BT /${l.negrita ? 'B' : 'N'} ${l.tam || CUERPO} Tf ${MARGEN + (l.sangria || 0)} ${y} Td (${winAnsi(l.t)}) Tj ET\n`; y -= LINEA; }
    s += `BT /N 8 Tf ${MARGEN} 30 Td (${winAnsi(`${consecutivo || ''} · página ${n + 1} de ${paginas.length} · DEMO`)}) Tj ET\n`;
    const c = obj(`<< /Length ${new TextEncoder().encode(s).length} >>\nstream\n${s}endstream`);
    kids.push(obj(`<< /Type /Page /Parent ${raiz} 0 R /MediaBox [0 0 ${ANCHO} ${ALTO}] /Resources << /Font << /N ${fN} 0 R /B ${fB} 0 R >> >> /Contents ${c} 0 R >>`));
  });
  obj(`<< /Type /Pages /Kids [${kids.map((k) => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`);
  const cat = obj(`<< /Type /Catalog /Pages ${raiz} 0 R >>`);
  let out = '%PDF-1.4\n', off = [];
  const largo = (x) => new TextEncoder().encode(x).length;
  objs.forEach((o, i) => { off.push(largo(out)); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = largo(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${off.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root ${cat} 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return { bytes: new TextEncoder().encode(out), paginas: paginas.length };
}
