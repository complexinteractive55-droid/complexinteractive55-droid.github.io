// PQRS — reglas compartidas (pedido de Fabio, 28-oct-2026). Las usan la pantalla (textos y estados), el modo demo y,
// por medio de herramientas/pqrs_reglas_sql.mjs, la base de datos: las señales y los patrones de abajo se copian a la
// migración, así la base y el demo clasifican igual (la prueba pruebas/pqrs/prueba_base.mjs lo comprueba).
//
// Cómo se clasifica (sin enviar el texto a ningún servicio externo):
//  1. Se juntan asunto y descripción, se quitan tildes y mayúsculas, y se parte en frases (puntos, "pero", "además"…).
//  2. En cada frase se buscan señales de cada área (palabras y expresiones con su peso: 3 fuerte, 2 media, 1 débil).
//  3. Una señal NO cuenta si la frase la niega o la descarta ("no tengo problemas con el bus", "no es sobre la ruta",
//     "…ni con el comedor") o si habla bien de ella ("la ruta está muy bien"). Un elogio solo cuenta si el mensaje es una
//     felicitación. Negar el servicio sí cuenta como queja ("el bus no llega a tiempo").
//  4. Un área se asigna con 3 puntos o más. Salud (2 o más) asigna Enfermería y marca el caso como sensible.
//     Lo académico o de convivencia de un estudiante va a la sección de su grado (grados que marca el administrador).
//     Gerencia nunca se asigna sola (decisión de Fabio): la agrega el administrador.
//  5. Si nada llega a 3 puntos, el caso queda «Pendiente de clasificación» y se avisa al administrador.

export const AREAS = [
  { clave: 'gerencia', nombre: 'Gerencia' },
  { clave: 'transporte', nombre: 'Transporte' },
  { clave: 'alimentacion', nombre: 'Alimentación' },
  { clave: 'enfermeria', nombre: 'Enfermería' },
  { clave: 'seccion_infantil', nombre: 'Sección Infantil' },
  { clave: 'seccion_prejuvenil', nombre: 'Sección Prejuvenil' },
  { clave: 'seccion_juvenil', nombre: 'Sección Juvenil' },
  { clave: 'finanzas', nombre: 'Servicios Financieros y Contabilidad' },
  { clave: 'servicios_generales', nombre: 'Servicios Generales y Mantenimiento' },
  { clave: 'biblioteca', nombre: 'Biblioteca' },
  { clave: 'tecnologia', nombre: 'Tecnología y Sistemas' },
];
export const SECCIONES = ['seccion_infantil', 'seccion_prejuvenil', 'seccion_juvenil'];
export const nombreArea = (clave) => AREAS.find((a) => a.clave === clave)?.nombre || clave;

export const TIPOS = { peticion: 'Petición', queja: 'Queja', reclamo: 'Reclamo', sugerencia: 'Sugerencia' };
export const ESTADO_AREA = { pendiente: 'Pendiente', en_revision: 'En revisión', respondida: 'Respondida' };
export const ESTADO_GENERAL = {
  pendiente_clasificacion: 'Pendiente de clasificación', pendiente: 'Pendiente', en_atencion: 'En atención',
  respuesta_parcial: 'Respuesta parcial', respondida: 'Respondida', cerrada: 'Cerrada',
};
export const AYUDA_ESTADO = {
  pendiente_clasificacion: 'Requiere asignación', pendiente: 'Tiene áreas asignadas; aún no empieza la atención',
  en_atencion: 'Un área empezó a gestionarlo', respuesta_parcial: 'Respondió al menos un área; faltan otras',
  respondida: 'Todas las áreas respondieron', cerrada: 'Finalizado con constancia del cierre',
};
export const MAX_ASUNTO = 150, MAX_DESCRIPCION = 5000, MAX_TEXTO = 5000;
export const UMBRAL = { asignar: 3, salud: 2, seccion: 3 };

// Señales por área: patrón (sin tildes, en minúscula, palabras completas), peso, motivo (lo que se le muestra al área)
// y, si hace falta, un patrón "excluir" que la anula cuando aparece alrededor (ej. "ruta de aprendizaje").
// area 'seccion' = lo académico o de convivencia (se resuelve con el grado del estudiante).
export const SENALES = [
  // Servicios Financieros y Contabilidad
  { area: 'finanzas', peso: 3, motivo: 'cartera', patron: 'cartera' },
  { area: 'finanzas', peso: 3, motivo: 'facturación', patron: 'factura|facturas|facturacion|facturar|facturaron|facturado|facturada' },
  { area: 'finanzas', peso: 3, motivo: 'cobros', patron: 'cobro|cobros|cobra|cobran|cobrar|cobraron|cobrando|cobrado|cobrada|cobre|cobro de mas' },
  { area: 'finanzas', peso: 3, motivo: 'pagos', patron: 'pago|pagos|pagar|pague|pagamos|pagado|pagada|pagaron|pagando' },
  { area: 'finanzas', peso: 3, motivo: 'pensión o tarifas', patron: 'pension|pensiones|mensualidad|mensualidades|cuota|cuotas|tarifa|tarifas' },
  { area: 'finanzas', peso: 3, motivo: 'costos', patron: 'costo|costos|cuesta|cuestan|precio|precios|valor de|valor del|valores de|valor a pagar' },
  { area: 'finanzas', peso: 3, motivo: 'pagos y cartera', patron: 'recibo|recibos|paz y salvo|reembolso|reembolsos|devolucion del dinero|devolucion de dinero|saldo|saldos|deuda|deudas|mora|intereses|descuento|descuentos|beca|becas|cuenta de cobro|estado de cuenta|consignacion|transferencia bancaria' },
  { area: 'finanzas', peso: 1, motivo: 'dinero', patron: 'dinero|plata|caro|cara|caros|caras|costoso|costosa|carisimo|carisima' },
  // Transporte
  { area: 'transporte', peso: 3, motivo: 'ruta escolar', patron: 'ruta|rutas', excluir: 'ruta de aprendizaje|ruta pedagogica|ruta academica|ruta del proyecto|ruta de trabajo|ruta de atencion|hoja de ruta' },
  { area: 'transporte', peso: 3, motivo: 'bus o transporte', patron: 'bus|buses|buseta|busetas|microbus|van escolar|transporte|transporte escolar|recorrido|recorridos|paradero|paraderos|conductor|conductora|conductores|chofer|monitora de ruta|monitor de ruta|monitora de la ruta|monitor de la ruta' },
  { area: 'transporte', peso: 1, motivo: 'puntualidad', patron: 'llega tarde|llegan tarde|llegaba tarde|llegaban tarde|llego tarde|llegaron tarde|retraso|retrasos|retrasado|retrasada|impuntual|impuntuales|impuntualidad|puntualidad|demora|demoran|demorado|demorada|hora de recogida|lo recogen|la recogen|los recogen|lo dejan|la dejan|los dejan' },
  // Alimentación
  { area: 'alimentacion', peso: 3, motivo: 'comedor o alimentación', patron: 'comedor|restaurante|restaurante escolar|cafeteria|casino|tienda escolar|servicio de alimentacion|alimentacion' },
  { area: 'alimentacion', peso: 3, motivo: 'alimentos', patron: 'almuerzo|almuerzos|refrigerio|refrigerios|onces|merienda|meriendas|desayuno|desayunos|menu|menus|comida|comidas|alimento|alimentos|porcion|porciones|nutricion' },
  { area: 'alimentacion', peso: 1, motivo: 'comer', patron: 'lonchera|loncheras|comer|comio|comen' },
  // Enfermería (salud: el caso queda sensible)
  { area: 'enfermeria', peso: 3, motivo: 'enfermería', patron: 'enfermeria|enfermera|enfermero|enfermeras|primeros auxilios|botiquin' },
  { area: 'enfermeria', peso: 3, motivo: 'malestar', patron: 'malestar|dolor de|dolor en|dolores de|fiebre|vomito|vomitos|vomitar|vomito|mareo|mareos|mareado|mareada|desmayo|desmayos|desmayado|desmayada|nausea|nauseas|diarrea' },
  { area: 'enfermeria', peso: 3, motivo: 'accidente o lesión', patron: 'herida|heridas|herido|herida|se golpeo|golpe en|golpeado|golpeada|se cayo|caida|lesion|lesiones|lesionado|lesionada|fractura|fracturado|fracturada|esguince|sangre|sangrado|sangrando|accidente|accidentes|se lastimo|lastimado|lastimada', excluir: 'de golpe' },
  { area: 'enfermeria', peso: 3, motivo: 'salud', patron: 'alergia|alergias|alergico|alergica|medicamento|medicamentos|medicina|medicinas|pastilla|pastillas|inhalador|asma|asmatico|asmatica|convulsion|convulsiones|epilepsia|epileptico|epileptica|diabetes|diabetico|diabetica|enfermo|enferma|enfermedad|enfermedades|incapacidad medica|diagnostico|tratamiento medico' },
  { area: 'enfermeria', peso: 2, motivo: 'salud', patron: 'salud|medico|medica|clinica|hospital|urgencias' },
  // Biblioteca
  { area: 'biblioteca', peso: 3, motivo: 'biblioteca', patron: 'biblioteca|bibliotecas|bibliotecaria|bibliotecario|sala de lectura|multa de la biblioteca|multa de biblioteca' },
  { area: 'biblioteca', peso: 2, motivo: 'libros', patron: 'libro|libros' },
  { area: 'biblioteca', peso: 2, motivo: 'préstamos', patron: 'prestamo|prestamos|prestaron|prestarme|prestado|prestada|devolver el libro|devolver los libros|devolver un libro', excluir: 'prestamo de dinero|prestamo bancario|credito' },
  // Tecnología y Sistemas
  { area: 'tecnologia', peso: 3, motivo: 'plataforma', patron: 'plataforma|aplicacion|app|pagina web|sitio web|pagina del colegio|correo institucional|complex' },
  { area: 'tecnologia', peso: 3, motivo: 'acceso', patron: 'contrasena|clave de acceso|usuario y clave|iniciar sesion|inicio de sesion|no puedo entrar|no puedo ingresar|no puedo acceder|no pude entrar|no pude ingresar|no me deja entrar|no me deja ingresar|acceso a la plataforma' },
  { area: 'tecnologia', peso: 3, motivo: 'internet', patron: 'internet|wifi|wi fi|red inalambrica' },
  { area: 'tecnologia', peso: 3, motivo: 'equipos', patron: 'computador|computadores|computadora|computadoras|portatil|portatiles|tablet|tablets|tableta|tabletas|videobeam|video beam|proyector|proyectores|impresora|impresoras|equipo de computo|equipos de computo|sala de sistemas|software|tablero digital|tablero inteligente' },
  { area: 'tecnologia', peso: 2, motivo: 'falla informática', patron: 'sistema no funciona|sistema caido|el sistema esta caido|se cayo el sistema|no carga|se bloquea|se bloqueo' },
  // Servicios Generales y Mantenimiento
  { area: 'servicios_generales', peso: 3, motivo: 'limpieza', patron: 'limpieza|aseo|sucio|sucios|sucia|sucias|suciedad|basura|basuras|mal olor' },
  { area: 'servicios_generales', peso: 3, motivo: 'servicios básicos', patron: 'no hay luz|sin luz|se fue la luz|sin agua|no hay agua|fuga de agua|gotera|goteras|filtracion|filtraciones|inundacion|inundado|inundada' },
  { area: 'servicios_generales', peso: 2, motivo: 'baños', patron: 'bano|banos|sanitario|sanitarios|inodoro|inodoros|orinal|orinales|lavamanos|papel higienico|jabon' },
  { area: 'servicios_generales', peso: 2, motivo: 'instalaciones', patron: 'humedad|tuberia|tuberias|techo|cielo raso|pared|paredes|piso|pisos|puerta|puertas|ventana|ventanas|vidrio|vidrios|chapa|chapas|cerradura|cerraduras|silla|sillas|pupitre|pupitres|mesa|mesas|escritorio|escritorios|bombillo|bombillos|lampara|lamparas|iluminacion|ventilador|ventiladores|aire acondicionado|pintura|jardin|jardines|zonas verdes|cancha|canchas|parque|columpio|columpios|instalaciones|infraestructura' },
  { area: 'servicios_generales', peso: 1, motivo: 'daños o reparaciones', patron: 'danado|danada|danados|danadas|dano|danos|roto|rota|rotos|rotas|se rompio|quebrado|quebrada|mal estado|no sirve|no sirven|descompuesto|descompuesta|mantenimiento|reparacion|reparaciones|reparar|arreglar|arreglen|arreglo' },
  // Lo académico o de convivencia de un estudiante (sección según su grado)
  { area: 'seccion', peso: 3, motivo: 'convivencia', patron: 'convivencia|matoneo|bullying|acoso|acoso escolar|ciberacoso|intimidacion|agresion|agresiones|agredio|agredieron|agredido|agredida|pelea|peleas|pelearon|insulto|insultos|insulta|insultan|insultaron|maltrato|maltratan|maltrataron|amenaza|amenazas|amenazo|discriminacion|discriminan' },
  { area: 'seccion', peso: 3, motivo: 'docentes o coordinación', patron: 'profesor|profesora|profesores|profesoras|docente|docentes|maestro|maestra|maestros|maestras|director de grupo|directora de grupo|director de curso|directora de curso|coordinador|coordinadora|coordinacion academica|coordinacion de convivencia' },
  { area: 'seccion', peso: 2, motivo: 'académico', patron: 'nota|notas|calificacion|calificaciones|boletin|boletines|examen|examenes|evaluacion|evaluaciones|tarea|tareas|recuperacion|recuperaciones|materia|materias|asignatura|asignaturas|rendimiento academico|perdio el ano|perdio el periodo|perdio la materia|plan de mejoramiento|clase|clases|horario de clases|salon de clase|curso', excluir: 'nota de voz|tomar nota|examen medico|examenes medicos|evaluacion medica' },
  { area: 'seccion', peso: 1, motivo: 'compañeros', patron: 'companero|companera|companeros|companeras' },
];

// Patrones de contexto (texto ya normalizado: minúsculas, sin tildes, un espacio entre palabras).
// \b = borde de palabra (en la base se escribe \y).
const ART = '(?:(?:el|la|los|las|lo|al|del|un|una|mi|mis|su|sus|tu|tus|nuestro|nuestra|nuestros|nuestras|este|esta|estos|estas|ese|esa|esos|esas|servicio de|servicio del|tema de|tema del|parte de|parte del) ){0,3}';
export const PATRONES = {
  // Separa frases: puntuación y conectores de contraste o suma
  separador: '[.;:!?]+|\\b(?:pero|aunque|sin embargo|ademas|por otro lado|por otra parte|tambien|asimismo|igualmente)\\b',
  // Justo antes de la señal: la frase la descarta ("no tengo problemas con el", "no es sobre la", "no tiene que ver con")
  descarte_antes: '\\b(?:(?:no|nunca|jamas) (?:(?:tengo|tenemos|tiene|tienen|hay|he tenido|hemos tenido|ha habido|tuve|tuvimos|existe|existen|pongo|presento) (?:ningun |ninguna |ningunos |ningunas |nada de )?(?:problema|problemas|queja|quejas|inconveniente|inconvenientes|reclamo|reclamos|novedad|novedades|dificultad|dificultades|nada) (?:(?:con|en|de|del|sobre|por|respecto a|respecto al|respecto de|frente a|frente al) )?|(?:es|son|era|fue) (?:sobre|por|de|del|acerca de|acerca del|respecto a|respecto al|respecto de|un tema de|un tema del|un asunto de|un asunto del|una queja de|una queja del|una queja sobre|un reclamo de|un reclamo del|un reclamo sobre) |(?:tiene|tienen) que ver (?:con )?|se trata (?:de |del )?|me quejo (?:de |del |por |sobre )?|(?:hablo|escribo|pregunto|me refiero) (?:de |del |sobre |por |a |al )?)|nada que ver con |sin (?:ningun |ninguna )?(?:problema|problemas|queja|quejas|inconveniente|inconvenientes) (?:con|en|de|del) )' + ART + '$',
  // "…ni con el comedor": cuenta como descarte si la frase ya descartó algo antes
  ni_antes: '\\bni (?:(?:con|en|de|del|al|sobre|por) )?' + ART + '$',
  descarte_frase: '\\b(?:no|nunca|jamas) (?:tengo|tenemos|tiene|tienen|hay|he tenido|hemos tenido|tuve|tuvimos|es|son|era|fue|tiene que ver|tienen que ver|se trata|me quejo|hablo|escribo|me refiero)\\b|\\bnada que ver\\b|\\bsin (?:ningun |ninguna )?(?:problema|problemas|queja|quejas|inconveniente|inconvenientes)\\b',
  // Justo después de la señal: habla bien de ella ("está muy bien", "siempre llega a tiempo"), sin "no" en medio
  elogio_despues: '^ (?:(?!no |nunca |jamas )[a-z0-9]+ ){0,3}(?:esta|estan|estuvo|estuvieron|ha estado|han estado|es|son|fue|fueron|ha sido|han sido|funciona|funcionan|ha funcionado|va|van|llega|llegan|me parece|nos parece|parece|se ve|se ven|quedo|quedaron)(?: muy| super| bastante| siempre| realmente| todo| todos| tan)? (?:bien|excelente|excelentes|buen|bueno|buena|buenos|buenas|perfecto|perfecta|perfectos|perfectas|puntual|puntuales|a tiempo|limpio|limpia|limpios|limpias|rico|rica|ricos|ricas|delicioso|deliciosa|deliciosos|deliciosas|agradable|agradables|impecable|impecables)\\b(?! (?:sucio|sucia|sucios|sucias|feo|fea|mal|malo|mala|caro|cara|caros|caras|tarde|lento|lenta|frio|fria|dificil|costoso|costosa)\\b)',
  // Justo antes de la señal: elogio ("excelente servicio de", "felicito al")
  elogio_antes: '\\b(?:excelente|excelentes|muy buen|muy buena|muy bueno|buenisimo|buenisima|maravilloso|maravillosa|impecable|felicitaciones por|felicitaciones a|felicitaciones al|felicito a|felicito al|felicitamos a|felicitamos al|agradezco a|agradezco al|agradecemos a|agradecemos al|gracias a|gracias al|gracias por) (?:servicio (?:de |del )?)?' + ART + '$',
  // Intención (se guarda para que el administrador la vea; el tipo lo elige quien escribe)
  felicitacion: '\\b(?:felicito|felicitamos|felicitar|felicitaciones|felicitacion|agradezco|agradecemos|agradecer|agradecimiento|gracias|reconocimiento|excelente labor|excelente servicio|muy contento|muy contenta|muy contentos|muy contentas|satisfecho|satisfecha|satisfechos|satisfechas)\\b',
  sugerencia: '\\b(?:sugiero|sugerimos|sugerencia|sugerencias|propongo|proponemos|propuesta|seria bueno|seria ideal|seria importante|recomiendo|recomendamos|recomendaria|podrian mejorar|deberian|deberia)\\b',
  peticion: '\\b(?:solicito|solicitamos|solicitud|quisiera|quiero pedir|pido|pedimos|necesito|necesitamos|por favor|me pueden|nos pueden|me podrian|nos podrian|podrian|requiero|requerimos|agradeceria|agradeceriamos|informacion sobre|como hago|como puedo)\\b',
  queja: '\\b(?:queja|quejas|reclamo|reclamos|inconforme|inconformidad|molesto|molesta|molestos|molestas|pesimo|pesima|terrible|inaceptable|indignado|indignada|indignados|no es justo|injusto|injusta|mal servicio|mala atencion|no responden|nadie responde|cobraron de mas|cobro de mas|cobro doble|demasiado|muy alto|muy alta|muy caro|muy cara|llega tarde|llegan tarde|sucio|sucia)\\b',
};
export const INTENCIONES = ['queja', 'peticion', 'sugerencia', 'felicitacion'];

// Quita tildes (mayúsculas y minúsculas: así no depende del idioma de la base), pasa a minúscula y deja solo
// letras, números, espacios y la puntuación que separa frases. Igual que private.pqrs_normalizar en la base.
const DE = 'ÁÉÍÓÚÜÀÈÌÒÙÄËÏÖÂÊÎÔÛÑÇáéíóúüàèìòùäëïöâêîôûñç';
const A_ = 'AEIOUUAEIOUAEIOAEIOUNCaeiouuaeiouaeioaeiounc';
export function normalizar(texto) {
  let s = '';
  for (const ch of String(texto ?? '')) { const i = DE.indexOf(ch); s += i >= 0 ? A_[i] : ch; }
  return s.replace(/[¿¡\r\n]+/g, '.').toLowerCase().replace(/[^a-z0-9.,;:!? ]/g, ' ').replace(/ +/g, ' ').trim();
}

// Alternativas de la más larga a la más corta: así el navegador toma la coincidencia más larga, como la base
// ("transporte escolar" antes que "transporte").
export const alternativas = (p) => p.split('|').sort((a, b) => b.length - a.length || (a < b ? -1 : 1)).join('|');
export const patronSenal = (s) => '\\b(?:' + alternativas(s.patron) + ')\\b';
export const patronExcluir = (s) => (s.excluir ? alternativas(s.excluir) : null);

const RX = Object.fromEntries(Object.entries(PATRONES).map(([k, v]) => [k, new RegExp(v)]));
const RX_SEP = new RegExp(PATRONES.separador, 'g');
const RX_SENALES = SENALES.map((s) => ({ ...s, rx: new RegExp(patronSenal(s), 'g'), rxExcluir: s.excluir ? new RegExp(patronExcluir(s)) : null }));
const sumar = (obj, k, v) => { obj[k] = (obj[k] || 0) + v; };

// Igual que private.pqrs_analizar: puntos por área, elogios por área, señales encontradas, descartes e intención
export function analizar(texto) {
  const t = normalizar(texto);
  const puntos = {}, elogios = {}, senales = [], descartes = [];
  for (let frase of t.split(RX_SEP)) {
    frase = (frase || '').trim();
    if (!frase) continue;
    for (const c of RX_SENALES) {
      c.rx.lastIndex = 0;
      let m;
      while ((m = c.rx.exec(frase))) {
        if (m[0] === '') { c.rx.lastIndex++; continue; }
        const ini = m.index, fin = ini + m[0].length;
        const antes = frase.slice(Math.max(0, ini - 70), ini), despues = frase.slice(fin, fin + 50);
        if (c.rxExcluir && c.rxExcluir.test(frase.slice(Math.max(0, ini - 30), fin + 30))) continue;
        if (RX.descarte_antes.test(antes) || (RX.ni_antes.test(antes) && RX.descarte_frase.test(frase))) {
          descartes.push({ area: c.area, senal: c.motivo, por: 'negacion' });
          continue;
        }
        if (RX.elogio_despues.test(despues) || RX.elogio_antes.test(antes)) {
          sumar(elogios, c.area, c.peso);
          descartes.push({ area: c.area, senal: c.motivo, por: 'elogio' });
          continue;
        }
        sumar(puntos, c.area, c.peso);
        senales.push({ area: c.area, senal: c.motivo, peso: c.peso });
      }
    }
  }
  const intencion = INTENCIONES.filter((k) => RX[k].test(t));
  return { puntos, elogios, senales, descartes, intencion };
}

// Decide con el análisis (igual que private.pqrs_clasificar, sin la parte del grado y los responsables, que son de la base)
export function decidir(an) {
  const total = { ...an.puntos };
  if (an.intencion.includes('felicitacion')) for (const [k, v] of Object.entries(an.elogios)) sumar(total, k, v); // la felicitación le llega al área
  const areas = Object.keys(total).filter((k) => k !== 'seccion' && k !== 'enfermeria' && total[k] >= UMBRAL.asignar);
  const salud = (total.enfermeria || 0) >= UMBRAL.salud;
  if (salud) areas.push('enfermeria');
  const seccion = (total.seccion || 0) >= UMBRAL.seccion;
  const debiles = Object.keys(total).filter((k) => !areas.includes(k) && !(k === 'seccion' && seccion) && total[k] > 0);
  const orden = (k) => AREAS.findIndex((a) => a.clave === k);
  return { areas: areas.sort((a, b) => orden(a) - orden(b)), salud, seccion, debiles: debiles.sort(), puntos: total };
}

// Motivo para cada área (sin datos clínicos: solo la categoría de la señal)
export function motivos(an) {
  const m = {};
  for (const s of an.senales) (m[s.area] ||= new Set()).add(s.senal);
  const r = Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [...v].sort().join(', ')]));
  if (an.intencion.includes('felicitacion')) for (const k of new Set(an.descartes.filter((d) => d.por === 'elogio').map((d) => d.area))) r[k] = r[k] ? r[k] + ', felicitación' : 'felicitación';
  return r;
}

// Estado general a partir de las áreas (igual que private.pqrs_estado)
export function estadoGeneral(caso, asignaciones) {
  if (caso.cerrado_en) return 'cerrada';
  const act = asignaciones.filter((a) => a.activa !== false);
  if (!act.length) return 'pendiente_clasificacion';
  if (act.every((a) => a.estado === 'respondida')) return 'respondida';
  if (act.some((a) => a.estado === 'respondida')) return 'respuesta_parcial';
  if (act.some((a) => a.estado === 'en_revision')) return 'en_atencion';
  return 'pendiente';
}

// Formulario: lo mismo que revisa la base (el servidor vuelve a revisarlo todo)
export function validar(f) {
  const asunto = String(f.asunto || '').trim(), desc = String(f.descripcion || '').trim();
  if (!TIPOS[f.tipo]) return { campo: 'tipo', error: 'Elige el tipo de solicitud.' };
  if (asunto.length < 3) return { campo: 'asunto', error: 'Escribe el asunto (mínimo 3 letras).' };
  if (asunto.length > MAX_ASUNTO) return { campo: 'asunto', error: `El asunto admite hasta ${MAX_ASUNTO} caracteres.` };
  if (desc.length < 10) return { campo: 'descripcion', error: 'Cuéntanos qué pasó o qué necesitas (mínimo 10 letras).' };
  if (desc.length > MAX_DESCRIPCION) return { campo: 'descripcion', error: `La descripción admite hasta ${MAX_DESCRIPCION} caracteres.` };
  return {};
}
export const esSinRed = (m) => /conexi[oó]n|network|failed to fetch|internet/i.test(String(m || ''));
