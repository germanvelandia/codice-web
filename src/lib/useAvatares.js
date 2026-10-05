import { useEffect, useState } from "react";
import * as api from "./api";

// Avatares de los estudiantes (el personaje que tienen asignado o eligieron), para mostrarlos
// junto al nombre en listas y sorteos. El hook devuelve una función: avatarDe(id) -> imagen o null.
//
// Las imágenes pesan, así que se piden aparte (carga diferida) y solo cuando al menos un
// estudiante de la lista tiene personaje: abrir una pantalla sin personajes no descarga nada.
let pedidoImagenes = null;
function pedirImagenes() {
  if (!pedidoImagenes) pedidoImagenes = import("./personajesRol");
  return pedidoImagenes;
}

export function useAvataresEstudiantes(ids) {
  // Una "clave" estable (los mismos ids, en el mismo orden) para no volver a pedir en cada dibujo.
  const clave = (ids || []).map(Number).filter((n) => Number.isFinite(n)).sort((a, b) => a - b).join(",");
  const [mapa, setMapa] = useState({});
  const [imagenes, setImagenes] = useState(null);

  useEffect(() => {
    let vigente = true;
    if (!clave) { setMapa({}); return undefined; }
    api.fetchPersonajesMostrarMultiples(clave.split(",").map(Number))
      .then((m) => { if (vigente) setMapa(m); })
      .catch(() => {}); // si falla, simplemente no se muestran avatares
    return () => { vigente = false; };
  }, [clave]);

  useEffect(() => {
    let vigente = true;
    if (Object.keys(mapa).length === 0) return undefined;
    pedirImagenes().then((m) => { if (vigente) setImagenes(m); }).catch(() => {});
    return () => { vigente = false; };
  }, [mapa]);

  return (id) => {
    const p = mapa[id];
    return p && imagenes ? imagenes.imagenPersonajeRol(p.rolKey, p.genero) : null;
  };
}
