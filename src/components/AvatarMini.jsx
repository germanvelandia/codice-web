import React from "react";
import { initials } from "../lib/gamification";

// Avatar chico para poner junto al nombre de un estudiante. Si todavía no tiene personaje,
// se muestran sus iniciales para que las filas queden alineadas. Usa estilos en línea para
// que también se vea bien al imprimir.
export function AvatarMini({ src, nombre = "", size = 28 }) {
  const caja = { width: size, height: size, flexShrink: 0 };
  if (src) {
    return <img src={src} alt="" width={size} height={size} style={{ ...caja, imageRendering: "pixelated", objectFit: "contain" }} />;
  }
  return (
    <span style={{ ...caja, borderRadius: 9999, background: "#EDE9FE", color: "#6D28D9", fontSize: Math.max(8, Math.round(size * 0.36)), fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      {initials(nombre)}
    </span>
  );
}
