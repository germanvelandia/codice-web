import React, { useState } from "react";
import * as api from "../lib/api";
import { GAM_CATEGORIAS_OPCIONES } from "../lib/calificaciones";

// Ventana de la planilla para configurar el bono de participación del periodo.
export function BonoParticipacionModal({ materiaId, periodo, cfg, estudiantes, bonos, config, onClose, onGuardado }) {
  const [activo, setActivo] = useState(cfg ? cfg.activo !== false : true);
  const [bonoMax, setBonoMax] = useState(cfg?.bono_max ?? 0.5);
  const [xpMeta, setXpMeta] = useState(cfg?.xp_meta ?? 100);
  const [categoria, setCategoria] = useState(cfg?.gam_categoria || "todas");
  const [desde, setDesde] = useState(cfg?.desde || "");
  const [guardando, setGuardando] = useState(false);

  const num = (v) => parseFloat(String(v).replace(",", "."));
  const guardar = async () => {
    const max = num(bonoMax), meta = num(xpMeta);
    if (!(max > 0) || max > (config?.nota_maxima || 5)) { alert("El tope del bono debe ser mayor que 0 y no pasar la nota máxima."); return; }
    if (!(meta > 0)) { alert("Escribe cuánto XP da el bono completo."); return; }
    setGuardando(true);
    try {
      await api.guardarBono(materiaId, periodo, { bono_max: max, xp_meta: meta, gam_categoria: categoria, desde: desde || null, activo });
      onGuardado();
    } catch (e) { alert("No se pudo guardar el bono: " + e.message); }
    setGuardando(false);
  };

  const conBono = (estudiantes || []).filter((s) => (bonos?.[s.id] || 0) > 0).sort((a, b) => (bonos[b.id] || 0) - (bonos[a.id] || 0));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-bold text-slate-800">⭐ Bono de participación — Periodo {periodo}</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">Suma puntos a la <b>nota final del periodo</b> según el XP que gane cada estudiante. Tiene un tope y la nota nunca pasa de {config?.nota_maxima || 5}.</p>

        <label className="flex items-center gap-2 text-sm text-slate-700 mb-3">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} /> Bono activo en este periodo
        </label>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">Tope del bono (puntos de nota)</label>
            <input type="text" inputMode="decimal" value={bonoMax} onChange={(e) => setBonoMax(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">XP para ganar el bono completo</label>
            <input type="text" inputMode="decimal" value={xpMeta} onChange={(e) => setXpMeta(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">XP de qué área cuenta</label>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none bg-white">
              <option value="todas">Todas las áreas</option>
              {GAM_CATEGORIAS_OPCIONES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">Contar XP desde (opcional)</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
          </div>
        </div>
        <p className="text-[10px] text-slate-400 mb-3">Ejemplo: tope 0.5 y 100 XP → quien lleve 50 XP recibe +0.3 (se redondea a un decimal). Usa "desde" para que el XP del periodo anterior no cuente.</p>

        <div className="flex justify-end gap-2 mb-3">
          <button onClick={onClose} className="text-xs text-slate-500 px-3 py-2">Cancelar</button>
          <button disabled={guardando} onClick={guardar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-60">{guardando ? "Guardando…" : "Guardar bono"}</button>
        </div>

        {cfg && (
          <div className="bg-violet-50 rounded-xl p-3">
            <div className="text-[11px] font-semibold text-violet-700 mb-1">Con la configuración guardada hoy: {conBono.length} de {(estudiantes || []).length} estudiantes tienen bono</div>
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {conBono.map((s) => (
                <div key={s.id} className="flex justify-between text-[11px] text-slate-600"><span>{s.nombre}</span><b className="text-violet-600">+{bonos[s.id]}</b></div>
              ))}
              {conBono.length === 0 && <div className="text-[11px] text-slate-400">Todavía nadie tiene XP en lo que cuenta.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
