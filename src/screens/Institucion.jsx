import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

export function InstitucionModal({ onClose }) {
  const [nombre, setNombre] = useState("");
  const [ciclo, setCiclo] = useState("");
  const [anio, setAnio] = useState("");
  const [logoUrl, setLogoUrl] = useState(null);
  const [imagenMenuUrl, setImagenMenuUrl] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api.fetchInstitucion().then((data) => {
      setNombre(data.nombre || "");
      setCiclo(data.ciclo || "");
      setAnio(data.anio || "");
      setLogoUrl(data.logo_url || null);
      setImagenMenuUrl(data.imagen_menu_url || null);
      setCargando(false);
    });
  }, []);

  const subirImagen = (file, setter) => {
    if (file.size > 500 * 1024) {
      alert("La imagen es muy grande. Usa una imagen pequeña (menos de 500 KB) para que cargue rápido.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setter(e.target.result);
    reader.readAsDataURL(file);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await api.guardarInstitucion({ nombre: nombre.trim() || "Institución Educativa", ciclo: ciclo.trim(), anio: anio.trim(), logo_url: logoUrl, imagen_menu_url: imagenMenuUrl });
      onClose();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-800">Datos de la institución</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        {cargando ? (
          <div className="text-sm text-slate-400">Cargando…</div>
        ) : (
          <>
            <p className="text-xs text-slate-400 mb-3">Esto aparece en el encabezado de las actas y planillas impresas.</p>

            <label className="text-xs text-slate-500 block mb-1">Nombre de la institución</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Institución Educativa San José"
              className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Ciclo</label>
                <input value={ciclo} onChange={(e) => setCiclo(e.target.value)} placeholder="Ej: Ciclo III"
                  className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Año</label>
                <input value={anio} onChange={(e) => setAnio(e.target.value)} placeholder="Ej: 2026"
                  className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
              </div>
            </div>

            <label className="text-xs text-slate-500 block mb-1">Logo (opcional)</label>
            <p className="text-[11px] text-slate-400 mb-1">Este aparece en el encabezado de las actas y planillas impresas.</p>
            <div className="flex items-center gap-3 mb-4">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-14 w-14 object-contain rounded-lg border border-slate-200" />
              ) : (
                <div className="h-14 w-14 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-xs text-slate-400">Sin logo</div>
              )}
              <div className="flex flex-col gap-1">
                <input type="file" accept="image/*" onChange={(e) => { if (e.target.files[0]) subirImagen(e.target.files[0], setLogoUrl); }} className="text-xs" />
                {logoUrl && <button onClick={() => setLogoUrl(null)} className="text-xs text-rose-500 text-left">Quitar logo</button>}
              </div>
            </div>

            <label className="text-xs text-slate-500 block mb-1">Imagen del menú (opcional, independiente del logo)</label>
            <p className="text-[11px] text-slate-400 mb-1">Esta se muestra arriba del menú lateral de la app — es una imagen distinta, no afecta a las actas.</p>
            <div className="flex items-center gap-3 mb-4">
              {imagenMenuUrl ? (
                <img src={imagenMenuUrl} alt="Imagen del menú" className="h-14 w-14 object-cover rounded-lg border border-slate-200" />
              ) : (
                <div className="h-14 w-14 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-xs text-slate-400">Sin imagen</div>
              )}
              <div className="flex flex-col gap-1">
                <input type="file" accept="image/*" onChange={(e) => { if (e.target.files[0]) subirImagen(e.target.files[0], setImagenMenuUrl); }} className="text-xs" />
                {imagenMenuUrl && <button onClick={() => setImagenMenuUrl(null)} className="text-xs text-rose-500 text-left">Quitar imagen del menú</button>}
              </div>
            </div>

            <button disabled={guardando} onClick={guardar} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
