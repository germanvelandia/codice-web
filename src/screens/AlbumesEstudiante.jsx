import { descargarPdfAlbum } from "../lib/albumPdf";
import React, { useEffect, useMemo, useState } from "react";
import * as api from "../lib/albumColeccionApi";
import { LibroAlbum, RAREZA, ESTILOS_ALBUM } from "./AlbumLibro";

/* ============================================================================
   📒 Álbumes de colección — portal del estudiante
   Lista de álbumes → libro con páginas y casillas → sobres con monedas.
   ============================================================================ */

const num = (n) => String(n).padStart(2, "0");

function Portada({ a, onAbrir }) {
  const pct = a.total ? Math.round((a.tengo / a.total) * 100) : 0;
  return (
    <button onClick={() => onAbrir(a)} className="text-left rounded-2xl overflow-hidden bg-white border border-slate-200 hover:shadow-lg transition-shadow">
      <div className="relative h-36 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${a.color}, ${a.color}99)` }}>
        {a.portada_url ? <img src={a.portada_url} alt="" className="absolute inset-0 w-full h-full object-cover" /> : <span className="text-6xl">📒</span>}
        {pct === 100 && <span className="absolute top-2 right-2 text-[10px] font-extrabold bg-amber-400 text-slate-900 rounded-full px-2 py-0.5">⭐ COMPLETO</span>}
      </div>
      <div className="p-3">
        <div className="font-extrabold text-slate-800 text-sm leading-tight">{a.nombre}</div>
        {a.descripcion && <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{a.descripcion}</div>}
        <div className="h-2 rounded-full bg-slate-200 mt-2 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: a.color }} /></div>
        <div className="flex justify-between text-[10px] font-semibold text-slate-500 mt-1"><span>{a.tengo}/{a.total} láminas</span><span>🪙 {a.costo_sobre} por sobre</span></div>
      </div>
    </button>
  );
}

function Sobre({ resultado, onCerrar }) {
  const cartas = resultado.laminas || [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: "rgba(10,15,40,.82)" }}>
      <style>{ESTILOS_ALBUM}</style>
      <div className="bg-white rounded-3xl p-5 max-w-lg w-full text-center my-auto">
        <div className="font-extrabold text-slate-800 mb-3">🎉 ¡Tu sobre!</div>
        <div className="flex flex-wrap justify-center gap-3">
          {cartas.map((c, i) => {
            const r = RAREZA[c.rareza] || RAREZA.comun;
            return (
              <div key={c.id + "-" + i} className="alb-voltear" style={{ animationDelay: `${i * 0.45}s`, width: 118 }}>
                <div className={`relative rounded-lg p-1 bg-white ${c.rareza === "legendaria" ? "alb-leg" : ""}`} style={{ border: `2px solid ${r.color}`, boxShadow: `0 3px 12px ${r.color}66` }}>
                  <div className="relative overflow-hidden rounded" style={{ aspectRatio: "3 / 4", background: `${r.color}18` }}>
                    {c.imagen_url ? <img src={c.imagen_url} alt={c.nombre} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-3xl">🖼️</div>}
                    <span className="absolute top-1 left-1 text-[8px] font-extrabold rounded-full px-1.5 py-0.5 text-white" style={{ background: c.nueva ? "#059669" : "#64748B" }}>{c.nueva ? "¡NUEVA!" : "Repetida"}</span>
                  </div>
                  <div className="mt-1 rounded bg-[#2F55A4] text-white font-extrabold truncate px-1 py-0.5" style={{ fontSize: 9 }}># {num(c.numero)} {String(c.nombre || "").toUpperCase()}</div>
                </div>
                <div className="text-[9px] font-bold mt-1" style={{ color: r.color }}>{r.label}</div>
              </div>
            );
          })}
        </div>
        {(resultado.premios || []).map((p, i) => (
          <div key={i} className="mt-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-bold p-2">
            {p.tipo === "album" ? "🏆 ¡Completaste el álbum!" : `⭐ ¡Completaste la página ${p.pagina}!`} {p.monedas > 0 && `+${p.monedas} 🪙`}
          </div>
        ))}
        <button onClick={onCerrar} className="mt-4 text-sm font-bold px-6 py-2.5 rounded-full bg-violet-600 text-white">📌 Pegar en el álbum</button>
      </div>
    </div>
  );
}

function DetalleLamina({ l, onCerrar }) {
  const r = RAREZA[l.rareza] || RAREZA.comun;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(10,15,40,.8)" }} onClick={onCerrar}>
      <div className="bg-white rounded-2xl p-3 max-w-xs w-full text-center" onClick={(e) => e.stopPropagation()}>
        <div className="rounded-lg overflow-hidden" style={{ border: `3px solid ${r.color}` }}>
          {l.imagen_url ? <img src={l.imagen_url} alt={l.nombre} className="w-full object-cover" /> : <div className="py-16 text-5xl">🖼️</div>}
        </div>
        <div className="font-extrabold text-slate-800 mt-2"># {num(l.numero)} · {l.nombre}</div>
        <div className="text-[11px] font-bold" style={{ color: r.color }}>{r.label}{l.cantidad > 1 ? ` · la tienes ${l.cantidad} veces` : ""}</div>
        {l.descripcion && <div className="text-xs text-slate-500 mt-1 italic">{l.descripcion}</div>}
        <button onClick={onCerrar} className="mt-3 text-xs font-semibold px-4 py-1.5 rounded-full bg-slate-100 text-slate-600">Cerrar</button>
      </div>
    </div>
  );
}

function AlbumAbierto({ estudianteId, albumId, onVolver, onMonedas }) {
  const [det, setDet] = useState(null);
  const [error, setError] = useState("");
  const [abriendo, setAbriendo] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [resaltar, setResaltar] = useState(new Set());
  const [irA, setIrA] = useState(null);
  const [ver, setVer] = useState(null);

  const cargar = () => api.albDetalle(estudianteId, albumId).then(setDet).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, [estudianteId, albumId]); // eslint-disable-line

  const stats = useMemo(() => {
    const ls = (det?.paginas || []).flatMap((p) => p.laminas);
    return { total: ls.length, tengo: ls.filter((l) => l.cantidad > 0).length, repetidas: ls.reduce((a, l) => a + Math.max(0, l.cantidad - 1), 0) };
  }, [det]);

  if (error) return <div className="text-xs text-rose-600 bg-rose-50 rounded-lg p-3">No se pudo abrir el álbum: {error}</div>;
  if (!det) return <div className="text-sm text-slate-400">Abriendo álbum…</div>;
  const a = det.album;
  const puede = det.monedas >= a.costo_sobre && stats.total > 0;

  const abrirSobre = async () => {
    setAbriendo(true); setError("");
    try {
      const r = await api.albAbrirSobre(estudianteId, albumId);
      await new Promise((ok) => setTimeout(ok, 1100));
      if (!r?.ok) {
        setAbriendo(false);
        setError(r?.motivo === "monedas" ? `Te faltan monedas: necesitas ${r.costo} y tienes ${r.monedas}.` : r?.motivo === "sin_laminas" ? "Este álbum todavía no tiene láminas." : "Este álbum no está disponible.");
        return;
      }
      setAbriendo(false); setResultado(r); onMonedas?.(r.monedas);
    } catch (e) { setAbriendo(false); setError(e.message); }
  };
  const cerrarSobre = async () => {
    const nuevas = (resultado?.laminas || []).filter((l) => l.nueva);
    setResaltar(new Set(nuevas.map((l) => l.id)));
    if (nuevas[0]) setIrA(nuevas[0].pagina_id);
    setResultado(null);
    await cargar();
    setTimeout(() => setResaltar(new Set()), 4500);
  };

  return (
    <div>
      <style>{ESTILOS_ALBUM}</style>
      <button onClick={onVolver} className="text-xs font-semibold text-slate-500 mb-2">← Mis álbumes</button>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="font-extrabold text-slate-800 text-lg leading-tight">📒 {a.nombre}</h3>
          <div className="text-[11px] text-slate-500">{stats.tengo}/{stats.total} láminas · {stats.repetidas} repetidas · 🪙 {det.monedas}</div>
        </div>
        <div className="flex items-center gap-2">
        <button onClick={() => descargarPdfAlbum({ album: a, modo: "estudiante", paginas: det.paginas, quien: det.estudiante_nombre || "" })} className="text-xs font-semibold px-3 py-2 rounded-full border border-slate-300 text-slate-600" title="Elige «Guardar como PDF»">📄 PDF</button>
        <button onClick={abrirSobre} disabled={!puede || abriendo} className="text-sm font-extrabold px-5 py-2.5 rounded-full text-white disabled:opacity-50" style={{ background: a.color }}>
          {abriendo ? <span className="inline-block alb-sacudir">✉️</span> : "✉️"} {abriendo ? "Abriendo…" : `Abrir sobre (🪙 ${a.costo_sobre})`}
        </button>
        </div>
      </div>
      <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden mb-1"><div className="h-full rounded-full transition-all" style={{ width: `${stats.total ? (stats.tengo / stats.total) * 100 : 0}%`, background: a.color }} /></div>
      <div className="text-[10px] text-slate-400 mb-3">Cada sobre trae {a.laminas_por_sobre} láminas al azar. Completa una página y ganas 🪙 {a.premio_pagina}; completa el álbum y ganas 🪙 {a.premio_album}.</div>
      {!puede && !abriendo && stats.total > 0 && <div className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 mb-3">Necesitas {a.costo_sobre} monedas para abrir un sobre. Gánalas en clase y vuelve. 🪙</div>}
      {error && <div className="text-xs text-rose-600 bg-rose-50 rounded-lg p-2 mb-3">{error}</div>}
      {stats.total === 0
        ? <div className="text-sm text-slate-500 bg-slate-50 rounded-xl p-6 text-center">Este álbum aún no tiene láminas. ¡Pronto!</div>
        : <LibroAlbum paginas={det.paginas} color={a.color} resaltarIds={resaltar} irAPagina={irA} onVerLamina={setVer} />}
      {resultado && <Sobre resultado={resultado} onCerrar={cerrarSobre} />}
      {ver && <DetalleLamina l={ver} onCerrar={() => setVer(null)} />}
    </div>
  );
}

export function AlbumesEstudiante({ estudianteId, onMonedasActualizadas }) {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(null);

  const cargar = () => api.albListar(estudianteId).then(setLista).catch((e) => { setError(e.message); setLista([]); });
  useEffect(() => { cargar(); }, [estudianteId]); // eslint-disable-line

  if (!lista) return <div className="text-sm text-slate-400">Cargando álbumes…</div>;
  if (abierto) return <AlbumAbierto estudianteId={estudianteId} albumId={abierto} onVolver={() => { setAbierto(null); cargar(); }} onMonedas={onMonedasActualizadas} />;
  return (
    <div>
      <h3 className="font-extrabold text-slate-800 text-lg mb-1">📒 Mis álbumes</h3>
      <p className="text-xs text-slate-500 mb-3">Compra sobres con tus monedas, descubre láminas y pégalas en tu álbum. Las que aún no tienes se ven en gris.</p>
      {error && <div className="text-xs text-rose-600 bg-rose-50 rounded-lg p-2 mb-3">{error}</div>}
      {lista.length === 0
        ? <div className="text-sm text-slate-500 bg-slate-50 rounded-xl p-6 text-center">Todavía no hay álbumes disponibles. Tu docente los publicará pronto.</div>
        : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{lista.map((a) => <Portada key={a.id} a={a} onAbrir={(x) => setAbierto(x.id)} />)}</div>}
    </div>
  );
}
