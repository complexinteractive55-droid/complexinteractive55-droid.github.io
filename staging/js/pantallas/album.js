// Álbum digital por curso (input de desarrollo 2-nov-2026 §8): foto, nombre y curso de los estudiantes para el PERSONAL autorizado de
// ese curso (lo decide el servidor: album_cursos / album_curso, migración 20261103140000). Sustituye el álbum físico, no es un
// directorio público. Páginas pequeñas y fotos con carga diferida (no se baja todo el colegio al abrir un curso); los enlaces de
// las fotos son firmados y de vida corta, guardados solo en memoria por colegio, usuario y ruta (la ruta cambia con cada foto
// nueva = versión) y se olvidan al cerrar sesión o cambiar de colegio. Sin foto: marcador neutral, nunca una imagen inventada.
import { E } from '../estado.js';
import { esc, vacio } from '../ui.js';
import { cabecera } from './comun.js';

const urls = new Map();
const VIDA = 45 * 60 * 1000; // los enlaces firmados duran 1 h: se usan 45 min
export function olvidar() { urls.clear(); }
async function enlaces(rutas) {
  const k = (r) => `${E.colegio.id}|${E.yo.id}|${r}`;
  const faltan = rutas.filter((r) => !(urls.get(k(r))?.hasta > Date.now()));
  if (faltan.length) {
    const m = await E.db.urlsArchivos('fotos', faltan).catch(() => ({}));
    for (const [r, u] of Object.entries(m)) urls.set(k(r), { url: u, hasta: Date.now() + VIDA });
  }
  return Object.fromEntries(rutas.map((r) => [r, urls.get(k(r))?.url || null]));
}
const SIN_FOTO = '<span class="album-sin-foto" role="img" aria-label="Sin foto"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="24" r="12"/><path d="M10 58c2-13 11-20 22-20s20 7 22 20z"/></svg><small>Sin foto</small></span>';

export async function album(m, p) {
  const cursos = await E.db.rpc('album_cursos', { p_colegio: E.colegio.id });
  if (!cursos.length) {
    m.innerHTML = cabecera('Álbum por curso') + vacio('No tienes cursos con álbum. Lo ven Administración, Enfermería, el director de cada curso, sus docentes y la dirección de su sección.');
    return;
  }
  const curso = p.curso ? cursos.find((c) => c.id === p.curso) : cursos.length === 1 ? cursos[0] : null;
  if (p.curso && !curso) { m.innerHTML = cabecera('Álbum por curso', { volver: '#/album' }) + vacio('No tienes acceso al álbum de ese curso.'); return; }
  if (!curso) {
    m.innerHTML = cabecera('Álbum por curso') + `
      <p class="ayuda">Foto, nombre y curso de cada estudiante, solo para el personal autorizado del curso.</p>
      <div class="rejilla album-cursos">${cursos.map((c) => `<a class="mini" href="#/album/${esc(c.id)}"><b>${esc(c.nombre)}</b><small>${esc(c.grado || '')} · ${c.estudiantes} estudiante${c.estudiantes === 1 ? '' : 's'}</small></a>`).join('')}</div>`;
    return;
  }
  m.innerHTML = cabecera('Álbum · ' + esc(curso.nombre), { volver: cursos.length > 1 ? '#/album' : '#/inicio' }) + `
    <div class="album-barra">
      ${cursos.length > 1 ? `<label class="en-linea">Curso <select data-curso>${cursos.map((c) => `<option value="${esc(c.id)}" ${c.id === curso.id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></label>` : ''}
      <input class="buscador" type="search" placeholder="Buscar por nombre…" aria-label="Buscar estudiante por nombre" data-buscar-album>
    </div>
    <p class="ayuda" data-cuantos aria-live="polite"></p>
    <ul class="album-rejilla" data-rejilla></ul>
    <div class="album-mas"><button type="button" class="btn" data-mas hidden>Ver más</button></div>
    <p class="ayuda">Las fotos son privadas: solo las ve el personal autorizado de este curso. Si no hay foto se muestra un marcador.</p>`;
  const rejilla = m.querySelector('[data-rejilla]'), mas = m.querySelector('[data-mas]'), cuantos = m.querySelector('[data-cuantos]');
  let buscar = '', siguiente = null, turno = 0, vistos = 0;
  const ficha = (x, url) => `<li class="album-ficha">
      <span class="album-foto">${url ? `<img src="${esc(url)}" alt="Foto de ${esc(x.nombres + ' ' + x.apellidos)}" loading="lazy" decoding="async">` : SIN_FOTO}</span>
      <b class="album-nombre">${esc(x.nombres)} ${esc(x.apellidos)}</b>
      <small>Curso ${esc(curso.nombre)}</small>
      ${x.homonimo ? '<small class="album-homonimo">Mismo nombre que otro estudiante del curso</small>' : ''}
    </li>`;
  async function cargar(desdeCero) {
    const t = ++turno; // si la búsqueda cambia mientras se carga, la respuesta vieja se descarta
    mas.disabled = true;
    try {
      const r = await E.db.rpc('album_curso', { p_colegio: E.colegio.id, p_curso: curso.id, p_buscar: buscar || null, p_despues: desdeCero ? null : siguiente, p_limite: 48 });
      const u = await enlaces(r.estudiantes.map((x) => x.foto).filter(Boolean));
      if (t !== turno || !document.body.contains(rejilla)) return;
      if (desdeCero) { rejilla.innerHTML = ''; vistos = 0; }
      rejilla.insertAdjacentHTML('beforeend', r.estudiantes.map((x) => ficha(x, x.foto ? u[x.foto] : null)).join(''));
      rejilla.querySelectorAll('img:not([data-con-error])').forEach((img) => { img.dataset.conError = '1'; img.onerror = () => { img.replaceWith(document.createRange().createContextualFragment(SIN_FOTO)); }; });
      vistos += r.estudiantes.length; siguiente = r.siguiente;
      cuantos.textContent = r.total ? `${vistos} de ${r.total} estudiante${r.total === 1 ? '' : 's'}${buscar ? ` con «${buscar}»` : ''}` : buscar ? `Ningún estudiante de ${curso.nombre} con «${buscar}».` : 'Este curso no tiene estudiantes activos.';
      mas.hidden = !siguiente;
    } catch (e) {
      if (t === turno) cuantos.textContent = 'No se pudo cargar el álbum: ' + e.message;
    } finally { mas.disabled = false; }
  }
  let espera = null;
  m.querySelector('[data-buscar-album]').addEventListener('input', (e) => { clearTimeout(espera); espera = setTimeout(() => { buscar = e.target.value.trim(); cargar(true); }, 350); });
  m.querySelector('[data-curso]')?.addEventListener('change', (e) => { location.hash = '#/album/' + e.target.value; });
  mas.onclick = () => cargar(false);
  await cargar(true);
}
