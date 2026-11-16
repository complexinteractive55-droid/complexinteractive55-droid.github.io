// Botón Atrás del celular (Android) y del navegador (Fabio, 16-nov-2026, video: con el detalle de un día abierto, «Atrás» no lo cerraba
// y la pantalla de abajo cambiaba sola; «tenemos que ajustar los botones de navegación para que hagan las respectivas navegaciones»).
// Regla: Atrás cierra primero lo que está ENCIMA (una ventana, el menú lateral) y, solo si no hay nada encima, vuelve a la pantalla
// anterior (eso ya lo hace el historial con el #/…).
// Cómo: cada capa que se abre agrega una entrada al historial con la MISMA dirección (history.pushState: no cambia el #, no hay
// hashchange). Si el usuario presiona Atrás, el navegador quita esa entrada (popstate) y aquí se cierra la capa de arriba. Si la capa
// se cierra por la interfaz (✕, Escape, un botón), se quita su entrada con history.back() para que el siguiente Atrás no quede
// «muerto»; si enseguida se abre otra capa (p. ej. «Editar» desde el detalle), reutiliza esa entrada. Si con una capa abierta se cambia
// de pantalla (un enlace dentro de la ventana), la capa se cierra sola.
const pila = []; // capas abiertas, la última es la de arriba: { id, cerrar, hash }
let siguiente = 0;
let ignorar = 0; // popstate que provocamos nosotros al quitar la entrada de una capa cerrada por la interfaz
const luegoDe = []; // qué hacer cuando termine ese history.back() (p. ej. ir a la pantalla del enlace que se tocó en el menú)
const porEmpujar = []; // capas abiertas mientras uno de esos history.back() estaba en camino: su entrada se agrega al terminar
const hayHistorial = typeof window !== 'undefined' && typeof history !== 'undefined';

function empujar(id) { try { history.pushState({ ...(history.state || {}), capa: id }, ''); } catch { /* sin historial: Atrás no la cierra */ } }

// Registra una capa abierta. `cerrar` la cierra (lo llama Atrás). Devuelve `quitar(luego)`: llamarlo cuando la capa se cierra por la
// interfaz; `luego` (opcional) se ejecuta cuando el historial ya quedó limpio (para navegar sin dejar entradas de más).
export function abrirCapa(cerrar) {
  const id = ++siguiente;
  pila.push({ id, cerrar, hash: hayHistorial ? location.hash : '' });
  if (!hayHistorial) return () => {};
  const actual = history.state?.capa;
  if (ignorar) porEmpujar.push(id);
  else if (actual && !pila.some((x) => x.id === actual)) { try { history.replaceState({ ...history.state, capa: id }, ''); } catch { /* */ } } // reutiliza la entrada de una capa recién cerrada
  else empujar(id);
  return (luego) => quitar(id, luego);
}

function quitar(id, luego) {
  const i = pila.findIndex((x) => x.id === id);
  if (i >= 0) pila.splice(i, 1);
  const limpiar = () => {
    if (history.state?.capa === id) { ignorar++; luegoDe.push(luego || null); history.back(); }
    else luego?.(); // ya no es la entrada de arriba (se cambió de pantalla o la reutilizó otra capa): nada que quitar
  };
  if (luego) limpiar(); else setTimeout(limpiar, 0); // sin `luego`, se espera un instante por si quien cerró la capa abre otra o navega
}

if (hayHistorial) {
  window.addEventListener('popstate', () => {
    if (ignorar) {
      ignorar--;
      const l = luegoDe.shift();
      if (!ignorar) for (const id of porEmpujar.splice(0)) if (pila.some((x) => x.id === id)) empujar(id);
      l?.();
      return;
    }
    const arriba = pila.pop();
    if (arriba) arriba.cerrar(); // su entrada del historial ya la quitó el navegador
  });
  // Cambió la pantalla con una capa abierta (p. ej. un enlace dentro de la ventana): se cierran las que se abrieron en la anterior
  window.addEventListener('hashchange', () => {
    for (const x of [...pila]) if (x.hash !== location.hash) { pila.splice(pila.indexOf(x), 1); x.cerrar(); }
  });
}

export const capasAbiertas = () => pila.length;
