import { descargarPdfAlbum } from "../lib/albumPdf";
import React, { useEffect, useRef, useState } from "react";
import * as api from "../lib/albumColeccionApi";
import { SlotLamina, RAREZA, ESTILOS_ALBUM } from "./AlbumLibro";

/* ============================================================================
   📒 Álbumes de colección — panel del docente
   Crear álbumes, organizarlos en páginas y subir láminas (varias a la vez).
   ============================================================================ */

const inp = "text-sm rounded-lg px-3 py-2 border border-slate-200 bg-white outline-none focus:border-violet-400 w-full";
const orden = (a, b) => String(a.name).localeCompare(String(b.name), "es", { numeric: true, sensitivity: "base" });

function FormAlbum({ album, onGuardar, onCancelar }) {
  const [f, setF] = useState({
    nombre: album?.nombre || "", descripcion: album?.descripcion || "", color: album?.color || "#2F55A4", portada_url: album?.portada_url || "",
    costo_sobre: album?.costo_sobre ?? 10, laminas_por_sobre: album?.laminas_por_sobre ?? 3,
    premio_pagina: album?.premio_pagina ?? 20, premio_album: album?.premio_album ?? 100, activo: album?.activo ?? false,
  });
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const portada = async (file) => {
    if (!file) return; setSubiendo(true);
    try { set("portada_url", await api.subirImagenAlbum(file, { maxAncho: 800, maxAlto: 500 })); } catch (e) { alert("No se pudo subir la portada: " + e.message); }
    setSubiendo(false);
  };
  const guardar = async () => {
    if (!f.nombre.trim()) { alert("Escribe el nombre del álbum."); return; }
    setGuardando(true);
    try {
      await onGuardar({
        nombre: f.nombre.trim(), descripcion: f.descripcion.trim() || null, color: f.color, portada_url: f.portada_url || null,
        costo_sobre: Math.max(0, parseInt(f.costo_sobre, 10) || 0), laminas_por_sobre: Math.min(10, Math.max(1, parseInt(f.laminas_por_sobre, 10) || 3)),
        premio_pagina: Math.max(0, parseInt(f.premio_pagina, 10) || 0), premio_album: Math.max(0, parseInt(f.premio_album, 10) || 0), activo: !!f.activo,
      });
    } catch (e) { alert("No se pudo guardar: " + e.message); }
    setGuardando(false);
  };
  return (
    <div className="bg-violet-50 rounded-2xl p-4 mb-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-600">Nombre del álbum<input className={inp} value={f.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej: Grandes filósofos" /></label>
        <label className="text-xs text-slate-600">Color<input type="color" className="block h-10 w-full rounded-lg border border-slate-200 bg-white" value={f.color} onChange={(e) => set("color", e.target.value)} /></label>
        <label className="text-xs text-slate-600 sm:col-span-2">Descripción (opcional)<input className={inp} value={f.descripcion} onChange={(e) => set("descripcion", e.target.value)} /></label>
        <label className="text-xs text-slate-600">Costo de un sobre (monedas)<input type="number" min="0" className={inp} value={f.costo_sobre} onChange={(e) => set("costo_sobre", e.target.value)} /></label>
        <label className="text-xs text-slate-600">Láminas por sobre (1 a 10)<input type="number" min="1" max="10" className={inp} value={f.laminas_por_sobre} onChange={(e) => set("laminas_por_sobre", e.target.value)} /></label>
        <label className="text-xs text-slate-600">Premio por página completa (monedas)<input type="number" min="0" className={inp} value={f.premio_pagina} onChange={(e) => set("premio_pagina", e.target.value)} /></label>
        <label className="text-xs text-slate-600">Premio por álbum completo (monedas)<input type="number" min="0" className={inp} value={f.premio_album} onChange={(e) => set("premio_album", e.target.value)} /></label>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          <label className="text-xs text-slate-600">Portada (opcional) <input type="file" accept="image/*" className="text-xs" onChange={(e) => portada(e.target.files[0])} /></label>
          {subiendo && <span className="text-xs text-slate-400">Subiendo…</span>}
          {f.portada_url && <><img src={f.portada_url} alt="" className="h-12 rounded" /><button className="text-xs text-rose-500" onClick={() => set("portada_url", "")}>Quitar</button></>}
        </div>
        <label className="sm:col-span-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={f.activo} onChange={(e) => set("activo", e.target.checked)} /> Visible para los estudiantes
          <span className="text-[11px] font-normal text-slate-400">(déjalo apagado mientras subes las láminas)</span>
        </label>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={guardar} disabled={guardando || subiendo} className="text-sm font-semibold px-5 py-2 rounded-full bg-violet-600 text-white disabled:opacity-50">{guardando ? "Guardando…" : "Guardar"}</button>
        <button onClick={onCancelar} className="text-sm font-semibold px-5 py-2 rounded-full bg-white border border-slate-200 text-slate-600">Cancelar</button>
      </div>
    </div>
  );
}

function EditorLamina({ lamina, paginas, onCerrar, onGuardado }) {
  const [f, setF] = useState({ nombre: lamina.nombre || "", descripcion: lamina.descripcion || "", rareza: lamina.rareza, peso: lamina.peso, pagina_id: lamina.pagina_id || "", imagen_url: lamina.imagen_url || "" });
  const [subiendo, setSubiendo] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const guardar = async () => {
    if (!f.nombre.trim()) { alert("Escribe el nombre de la lámina."); return; }
    try {
      await api.editarLamina(lamina.id, { nombre: f.nombre.trim(), descripcion: f.descripcion.trim() || null, rareza: f.rareza, peso: Math.max(1, parseInt(f.peso, 10) || 10), pagina_id: f.pagina_id ? Number(f.pagina_id) : null, imagen_url: f.imagen_url || null });
      onGuardado();
    } catch (e) { alert("No se pudo guardar: " + e.message); }
  };
  const borrar = async () => {
    if (!confirm(`¿Eliminar la lámina #${lamina.numero} "${lamina.nombre}"? Los estudiantes que la tengan la perderán.`)) return;
    try { await api.eliminarLamina(lamina); onGuardado(); } catch (e) { alert("No se pudo eliminar: " + e.message); }
  };
  const cambiarImagen = async (file) => {
    if (!file) return; setSubiendo(true);
    try { set("imagen_url", await api.subirImagenAlbum(file)); } catch (e) { alert("No se pudo subir: " + e.message); }
    setSubiendo(false);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: "rgba(10,15,40,.7)" }} onClick={onCerrar}>
      <div className="bg-white rounded-2xl p-4 max-w-md w-full my-auto" onClick={(e) => e.stopPropagation()}>
        <div className="font-extrabold text-slate-800 mb-3">Lámina #{lamina.numero}</div>
        <div className="flex gap-3 mb-3">
          <div style={{ width: 110 }}><SlotLamina lamina={{ ...lamina, ...f, numero: lamina.numero }} tengo editable /></div>
          <div className="flex-1 text-xs text-slate-600">
            <label className="block mb-2">Cambiar imagen <input type="file" accept="image/*" className="text-xs w-full" onChange={(e) => cambiarImagen(e.target.files[0])} /></label>
            {subiendo && <span className="text-slate-400">Subiendo…</span>}
          </div>
        </div>
        <div className="grid gap-2">
          <label className="text-xs text-slate-600">Nombre<input className={inp} value={f.nombre} onChange={(e) => set("nombre", e.target.value)} /></label>
          <label className="text-xs text-slate-600">Descripción (la ve el estudiante al conseguirla)<textarea rows={2} className={inp} value={f.descripcion} onChange={(e) => set("descripcion", e.target.value)} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-600">Rareza<select className={inp} value={f.rareza} onChange={(e) => set("rareza", e.target.value)}>{Object.entries(RAREZA).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}</select></label>
            <label className="text-xs text-slate-600" title="Más alto = sale más seguido">Frecuencia (1–100)<input type="number" min="1" max="100" className={inp} value={f.peso} onChange={(e) => set("peso", e.target.value)} /></label>
          </div>
          <label className="text-xs text-slate-600">Página<select className={inp} value={f.pagina_id} onChange={(e) => set("pagina_id", e.target.value)}><option value="">— Sin página (no sale en sobres) —</option>{paginas.map((p) => <option key={p.id} value={p.id}>{p.titulo || `Página ${p.numero}`}</option>)}</select></label>
        </div>
        <div className="flex justify-between mt-4">
          <button onClick={borrar} className="text-xs font-semibold px-3 py-2 rounded-full text-rose-600 border border-rose-200">🗑️ Eliminar</button>
          <div className="flex gap-2">
            <button onClick={onCerrar} className="text-xs font-semibold px-4 py-2 rounded-full bg-slate-100 text-slate-600">Cancelar</button>
            <button onClick={guardar} disabled={subiendo} className="text-xs font-semibold px-4 py-2 rounded-full bg-violet-600 text-white disabled:opacity-50">Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaginaDocente({ pagina, laminas, color, albumId, onCambio, onEditar, ultimaPagina }) {
  const [titulo, setTitulo] = useState(pagina.titulo || "");
  const [progreso, setProgreso] = useState("");
  const [rarezaNueva, setRarezaNueva] = useState("comun");
  const entrada = useRef(null);
  useEffect(() => { setTitulo(pagina.titulo || ""); }, [pagina.titulo]);

  const guardarTitulo = async () => { if (titulo !== (pagina.titulo || "")) { try { await api.editarPagina(pagina.id, { titulo: titulo.trim() || null }); onCambio(); } catch (e) { alert(e.message); } } };
  const subir = async (files) => {
    const lista = [...files].sort(orden.bind(null)).filter((f) => f.type.startsWith("image/"));
    if (!lista.length) { alert("Elige archivos de imagen."); return; }
    const items = [];
    try {
      for (let i = 0; i < lista.length; i++) {
        setProgreso(`Subiendo ${i + 1} de ${lista.length}…`);
        items.push({ nombre: api.nombreDesdeArchivo(lista[i].name), imagen_url: await api.subirImagenAlbum(lista[i]), rareza: rarezaNueva });
      }
      setProgreso("Guardando…");
      await api.crearLaminas(albumId, pagina.id, items);
    } catch (e) { alert(`Se subieron ${items.length} de ${lista.length}. Error: ${e.message}`); if (items.length) { try { await api.crearLaminas(albumId, pagina.id, items); } catch { /* ya avisamos */ } } }
    setProgreso(""); if (entrada.current) entrada.current.value = ""; onCambio();
  };
  const quitar = async () => {
    if (!confirm(`¿Eliminar esta página? Sus ${laminas.length} láminas quedarán sin página (no saldrán en sobres hasta que las muevas a otra).`)) return;
    try { await api.eliminarPagina(pagina.id); onCambio(); } catch (e) { alert(e.message); }
  };
  return (
    <div className="rounded-2xl p-3 mb-4" style={{ background: "#FFF9EC", border: `2px solid ${color}55` }}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs font-extrabold px-2 py-1 rounded-full text-white" style={{ background: color }}>Página {pagina.numero}</span>
        <input className="text-sm font-semibold rounded-lg px-2 py-1 border border-transparent hover:border-slate-200 focus:border-violet-400 bg-transparent outline-none flex-1 min-w-[140px]" value={titulo} onChange={(e) => setTitulo(e.target.value)} onBlur={guardarTitulo} placeholder="Título de la página" />
        <select value={rarezaNueva} onChange={(e) => setRarezaNueva(e.target.value)} className="text-[11px] rounded-full px-2 py-1.5 border border-slate-200 bg-white" title="Rareza de las láminas que subas ahora">
          {Object.entries(RAREZA).map(([k, r]) => <option key={k} value={k}>Rareza: {r.label}</option>)}
        </select>
        <label className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-600 text-white cursor-pointer">
          ＋ Subir láminas
          <input ref={entrada} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files?.length && subir(e.target.files)} disabled={!!progreso} />
        </label>
        {!ultimaPagina || laminas.length === 0 ? <button onClick={quitar} className="text-xs text-rose-500 px-2" title="Eliminar página">🗑️</button> : null}
      </div>
      {progreso && <div className="text-xs text-violet-600 bg-violet-50 rounded-lg px-3 py-1.5 mb-2">{progreso}</div>}
      {laminas.length === 0 ? (
        <div className="text-center text-xs text-slate-400 py-6 border-2 border-dashed border-slate-200 rounded-xl">Sin láminas. Pulsa «Subir láminas» y elige varias imágenes a la vez.</div>
      ) : (
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))" }}>
          {laminas.map((l) => <SlotLamina key={l.id} lamina={{ ...l, cantidad: 1 }} tengo editable onClick={() => onEditar(l)} />)}
        </div>
      )}
    </div>
  );
}

function EditorAlbum({ album, onVolver, onCambioAlbum }) {
  const [est, setEst] = useState(null);
  const [editandoAlbum, setEditandoAlbum] = useState(false);
  const [lam, setLam] = useState(null);
  const [avance, setAvance] = useState(null);
  const cargar = () => api.fetchEstructuraAlbum(album.id).then(setEst).catch((e) => alert(e.message));
  useEffect(() => { cargar(); }, [album.id]); // eslint-disable-line
  if (!est) return <div className="text-sm text-slate-400">Cargando…</div>;
  const sinPagina = est.laminas.filter((l) => !l.pagina_id);
  const total = est.laminas.filter((l) => l.pagina_id).length;
  const verAvance = async () => { try { setAvance(await api.fetchAvanceAlbum(album.id)); } catch (e) { alert(e.message); } };
  const nuevaPagina = async () => { try { await api.crearPagina(album.id); cargar(); } catch (e) { alert(e.message); } };
  return (
    <div>
      <style>{ESTILOS_ALBUM}</style>
      <button onClick={onVolver} className="text-xs font-semibold text-slate-500 mb-2">← Mis álbumes</button>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="font-extrabold text-slate-800 text-lg leading-tight">📒 {album.nombre}</h3>
          <div className="text-[11px] text-slate-500">{est.paginas.length} páginas · {total} láminas · sobre 🪙 {album.costo_sobre} ({album.laminas_por_sobre} láminas) · {album.activo ? "🟢 visible para estudiantes" : "⚪ oculto"}</div>
        </div>
        <div className="flex gap-2">
          <button onClick={verAvance} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-300 text-slate-600">📊 Avance</button>
          <button onClick={() => descargarPdfAlbum({ album, modo: "docente", paginas: est.paginas.map((p) => ({ ...p, laminas: est.laminas.filter((l) => l.pagina_id === p.id) })) })} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-300 text-slate-600" title="Abre el cuadro de impresión: elige «Guardar como PDF»">📄 Descargar PDF</button>
          <button onClick={() => setEditandoAlbum(true)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-violet-300 text-violet-700">⚙️ Configurar</button>
        </div>
      </div>
      {editandoAlbum && <FormAlbum album={album} onCancelar={() => setEditandoAlbum(false)} onGuardar={async (c) => { await api.editarAlbum(album.id, c); setEditandoAlbum(false); onCambioAlbum({ ...album, ...c }); }} />}
      {avance && (
        <div className="bg-white rounded-xl border border-slate-200 p-3 mb-3 text-xs">
          <div className="font-bold text-slate-700 mb-1">Avance de los estudiantes ({avance.estudiantes.length} con láminas · {avance.total} en total)</div>
          {avance.estudiantes.length === 0 ? <div className="text-slate-400">Nadie ha abierto sobres todavía.</div> : (
            <div className="text-slate-600">{avance.estudiantes.slice(0, 40).map((e) => <span key={e.estudiante_id} className="inline-block mr-2 mb-1 bg-slate-100 rounded-full px-2 py-0.5">{e.nombre}: {e.tengo}/{avance.total}</span>)}</div>
          )}
          <button className="text-slate-400 mt-1" onClick={() => setAvance(null)}>Cerrar</button>
        </div>
      )}
      {est.paginas.map((p) => (
        <PaginaDocente key={p.id} pagina={p} laminas={est.laminas.filter((l) => l.pagina_id === p.id)} color={album.color} albumId={album.id}
          onCambio={cargar} onEditar={setLam} ultimaPagina={est.paginas.length === 1} />
      ))}
      <button onClick={nuevaPagina} className="text-sm font-semibold px-4 py-2 rounded-full border-2 border-dashed border-violet-300 text-violet-700 w-full">＋ Agregar página</button>
      {sinPagina.length > 0 && (
        <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-3">
          <div className="text-xs font-bold text-amber-800 mb-2">Láminas sin página ({sinPagina.length}): no salen en los sobres. Toca una para asignarle página.</div>
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))" }}>{sinPagina.map((l) => <SlotLamina key={l.id} lamina={{ ...l, cantidad: 1 }} tengo editable onClick={() => setLam(l)} />)}</div>
        </div>
      )}
      {lam && <EditorLamina lamina={lam} paginas={est.paginas} onCerrar={() => setLam(null)} onGuardado={() => { setLam(null); cargar(); }} />}
    </div>
  );
}

export function VistaAlbumesDocente() {
  const [albumes, setAlbumes] = useState(null);
  const [error, setError] = useState("");
  const [creando, setCreando] = useState(false);
  const [abierto, setAbierto] = useState(null);

  const cargar = () => api.fetchAlbumesDocente().then(setAlbumes).catch((e) => { setError(e.message?.includes("alb_") ? "Falta correr el script 127_albumes_coleccion.sql en Supabase." : e.message); setAlbumes([]); });
  useEffect(() => { cargar(); }, []);

  if (!albumes) return <div className="text-sm text-slate-400">Cargando…</div>;
  if (abierto) {
    const a = albumes.find((x) => x.id === abierto);
    if (!a) { setAbierto(null); return null; }
    return <EditorAlbum album={a} onVolver={() => { setAbierto(null); cargar(); }} onCambioAlbum={(n) => setAlbumes((l) => l.map((x) => (x.id === n.id ? { ...x, ...n } : x)))} />;
  }
  const alternar = async (a) => { try { await api.editarAlbum(a.id, { activo: !a.activo }); cargar(); } catch (e) { alert(e.message); } };
  const borrar = async (a) => {
    if (!confirm(`¿Eliminar el álbum "${a.nombre}" con sus páginas, láminas y lo que los estudiantes hayan conseguido? No se puede deshacer.`)) return;
    try { await api.eliminarAlbum(a.id); cargar(); } catch (e) { alert(e.message); }
  };
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="font-extrabold text-slate-800 text-lg leading-tight">📒 Álbumes de colección</h3>
          <p className="text-xs text-slate-500">Crea álbumes con páginas y láminas. Los estudiantes compran sobres con monedas y descubren las láminas, que pasan de gris a color.</p>
        </div>
        <button onClick={() => setCreando(true)} className="text-sm font-semibold px-4 py-2 rounded-full bg-violet-600 text-white">＋ Nuevo álbum</button>
      </div>
      {error && <div className="text-xs text-rose-600 bg-rose-50 rounded-lg p-3 mb-3">{error}</div>}
      {creando && <FormAlbum onCancelar={() => setCreando(false)} onGuardar={async (c) => { const a = await api.crearAlbum(c); setCreando(false); await cargar(); setAbierto(a.id); }} />}
      {albumes.length === 0 && !creando && !error && <div className="text-sm text-slate-500 bg-slate-50 rounded-xl p-8 text-center">Todavía no tienes álbumes. Crea el primero con «Nuevo álbum».</div>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {albumes.map((a) => (
          <div key={a.id} className="rounded-2xl overflow-hidden bg-white border border-slate-200">
            <button onClick={() => setAbierto(a.id)} className="block w-full text-left">
              <div className="relative h-28 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${a.color}, ${a.color}99)` }}>
                {a.portada_url ? <img src={a.portada_url} alt="" className="absolute inset-0 w-full h-full object-cover" /> : <span className="text-5xl">📒</span>}
                <span className="absolute top-2 right-2 text-[10px] font-extrabold rounded-full px-2 py-0.5" style={{ background: a.activo ? "#059669" : "#64748B", color: "#fff" }}>{a.activo ? "Visible" : "Oculto"}</span>
              </div>
              <div className="p-3">
                <div className="font-extrabold text-slate-800 text-sm">{a.nombre}</div>
                <div className="text-[11px] text-slate-500">{a.total_laminas} láminas · sobre 🪙 {a.costo_sobre}</div>
              </div>
            </button>
            <div className="flex justify-between px-3 pb-3">
              <button onClick={() => alternar(a)} className="text-[11px] font-semibold text-slate-600 px-3 py-1 rounded-full border border-slate-200">{a.activo ? "Ocultar" : "Publicar"}</button>
              <button onClick={() => borrar(a)} className="text-[11px] text-rose-500">🗑️ Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
