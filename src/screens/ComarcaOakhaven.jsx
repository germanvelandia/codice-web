import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { agruparPorNivel } from "../lib/gamification";

function SubirImagenReino({ reino, onGuardado }) {
  const [subiendo, setSubiendo] = useState(false);

  const subir = (file) => {
    if (file.size > 800 * 1024) { alert("La imagen es muy grande — usá una de menos de 800 KB."); return; }
    setSubiendo(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        await api.guardarImagenReino(reino.id, e.target.result);
        onGuardado();
      } catch (err) {
        alert("Error al guardar la imagen: " + err.message);
      }
      setSubiendo(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <label className="text-[10px] font-semibold px-2 py-1 rounded-full bg-white/80 text-slate-600 cursor-pointer">
      {subiendo ? "Subiendo…" : reino.imagen_url ? "🖼️ Cambiar imagen" : "🖼️ Subir imagen"}
      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && subir(e.target.files[0])} />
    </label>
  );
}

function AjustarEconomiaModal({ sesion, reino, onClose, onCambio }) {
  const [tipo, setTipo] = useState("gp");
  const [cantidad, setCantidad] = useState(5);
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  const aplicar = async (signo) => {
    setGuardando(true);
    try {
      await api.ajustarEconomiaReino(sesion.id, reino.id, tipo, signo * (parseInt(cantidad, 10) || 0), motivo.trim() || null);
      onCambio();
      onClose();
    } catch (e) {
      alert("Error: " + e.message);
    }
    setGuardando(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-4 w-full max-w-xs shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-bold text-slate-800">{reino.emoji} {reino.nombre}</h4>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <div className="flex gap-1 rounded-full bg-slate-100 p-1 mb-3">
          <button onClick={() => setTipo("gp")} className={`flex-1 text-xs py-1.5 rounded-full ${tipo === "gp" ? "bg-amber-500 text-white" : "text-slate-600"}`}>🪙 GP</button>
          <button onClick={() => setTipo("fp")} className={`flex-1 text-xs py-1.5 rounded-full ${tipo === "fp" ? "bg-violet-500 text-white" : "text-slate-600"}`}>🕊️ FP</button>
        </div>
        <input type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="Cantidad"
          className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none text-center" />
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (opcional, ej: Peaje cobrado)"
          className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />
        <div className="flex gap-2">
          <button disabled={guardando} onClick={() => aplicar(-1)} className="flex-1 text-sm font-semibold py-2 rounded-lg bg-rose-100 text-rose-700 disabled:opacity-50">− Quitar</button>
          <button disabled={guardando} onClick={() => aplicar(1)} className="flex-1 text-sm font-semibold py-2 rounded-lg bg-emerald-100 text-emerald-700 disabled:opacity-50">+ Dar</button>
        </div>
      </div>
    </div>
  );
}

function TransferirProvinciaModal({ provincia, reinos, onClose, onCambio }) {
  const transferir = async (reinoId) => {
    try {
      await api.transferirProvincia(provincia.id, reinoId);
      onCambio();
      onClose();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-4 w-full max-w-xs shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-bold text-slate-800 text-sm">{provincia.nombre}</h4>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">¿A qué reino pasa esta provincia? (por compra, duelo o juicio)</p>
        <div className="space-y-1.5">
          {reinos.map((r) => (
            <button key={r.id} onClick={() => transferir(r.id)}
              className={`w-full text-left text-sm px-3 py-2 rounded-lg ${provincia.reino_actual_id === r.id ? "bg-violet-100 text-violet-700 font-semibold" : "bg-slate-50 hover:bg-slate-100"}`}>
              {r.emoji} {r.nombre} {provincia.reino_actual_id === r.id && "· Dueño actual"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TableroSesion({ sesion, onVolver }) {
  const [reinos, setReinos] = useState([]);
  const [provincias, setProvincias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [ajustandoEconomiaDe, setAjustandoEconomiaDe] = useState(null);
  const [transfiriendo, setTransfiriendo] = useState(null);
  const [evento, setEvento] = useState(sesion.evento_actual || "");
  const [guardandoEvento, setGuardandoEvento] = useState(false);

  const cargar = () => {
    setCargando(true);
    Promise.all([api.fetchReinosDeSesion(sesion.id), api.fetchProvinciasDeSesion(sesion.id)]).then(([r, p]) => {
      setReinos(r); setProvincias(p); setCargando(false);
    });
  };
  useEffect(() => { cargar(); }, [sesion.id]);

  const guardarEvento = async () => {
    setGuardandoEvento(true);
    try { await api.guardarEventoSesion(sesion.id, evento.trim() || null); } catch (e) { alert(e.message); }
    setGuardandoEvento(false);
  };

  const finalizar = async () => {
    if (!confirm("¿Finalizar esta sesión? El tablero queda guardado como historial, pero no se va a poder seguir jugando en ella.")) return;
    await api.finalizarSesionComarca(sesion.id);
    onVolver();
  };

  if (cargando) return <div className="text-sm text-slate-400">Cargando el tablero…</div>;

  return (
    <div>
      <button onClick={onVolver} className="text-sm text-violet-500 mb-3">← Volver a mis sesiones</button>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800">🗺️ {sesion.titulo}</h2>
          <p className="text-sm text-slate-400">Curso {sesion.grado_id} · {sesion.fecha} · {sesion.estado === "activa" ? "🟢 En juego" : "⚪ Finalizada"}</p>
        </div>
        {sesion.estado === "activa" && (
          <button onClick={finalizar} className="text-xs font-semibold px-3 py-2 rounded-full border border-slate-200 text-slate-600">🏁 Finalizar sesión</button>
        )}
      </div>

      {/* Carta de Destino actual */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 mb-4">
        <div className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">🎲 Carta de Destino Inesperado (evento actual)</div>
        <div className="flex gap-2">
          <input value={evento} onChange={(e) => setEvento(e.target.value)} placeholder="Ej: Peste Fiscal — el Banco sube todos sus precios esta ronda"
            className="flex-1 text-sm rounded-lg px-3 py-2 border border-amber-200 outline-none bg-white" />
          <button disabled={guardandoEvento} onClick={guardarEvento} className="text-xs font-semibold px-3 py-2 rounded-lg bg-amber-500 text-white disabled:opacity-60">Guardar</button>
        </div>
      </div>

      {/* Los 6 reinos */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        {reinos.map((reino) => {
          const susProvincias = provincias.filter((p) => p.reino_actual_id === reino.id);
          return (
            <div key={reino.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="relative h-24 bg-gradient-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center">
                {reino.imagen_url ? (
                  <img src={reino.imagen_url} alt={reino.nombre} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl">{reino.emoji}</span>
                )}
                <div className="absolute bottom-1.5 right-1.5"><SubirImagenReino reino={reino} onGuardado={cargar} /></div>
              </div>
              <div className="p-3">
                <div className="font-bold text-slate-800 text-sm mb-1">{reino.emoji} {reino.nombre}</div>
                <div className="flex gap-2 mb-2">
                  <button onClick={() => setAjustandoEconomiaDe(reino)} className="text-[11px] font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700">🪙 {reino.gp} GP</button>
                  <button onClick={() => setAjustandoEconomiaDe(reino)} className="text-[11px] font-semibold px-2 py-1 rounded-full bg-violet-100 text-violet-700">🕊️ {reino.fp} FP</button>
                </div>
                <div className="text-[10px] text-slate-400 mb-1">Provincias controladas: {susProvincias.length}/24</div>
                <div className="flex flex-wrap gap-1">
                  {susProvincias.map((p) => (
                    <button key={p.id} onClick={() => setTransfiriendo(p)} title={p.recurso}
                      className={`text-[9px] px-1.5 py-0.5 rounded ${p.reino_original_id === p.reino_actual_id ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700"}`}>
                      {p.nombre.split("— ")[1]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {ajustandoEconomiaDe && <AjustarEconomiaModal sesion={sesion} reino={ajustandoEconomiaDe} onClose={() => setAjustandoEconomiaDe(null)} onCambio={cargar} />}
      {transfiriendo && <TransferirProvinciaModal provincia={transfiriendo} reinos={reinos} onClose={() => setTransfiriendo(null)} onCambio={cargar} />}
    </div>
  );
}

export function VistaComarcaOakhaven({ grados, gradoActivo }) {
  const [sesiones, setSesiones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [sesionAbierta, setSesionAbierta] = useState(null);
  const [creandoAbierto, setCreandoAbierto] = useState(false);
  const [gradoId, setGradoId] = useState(gradoActivo || grados[0]?.id || "");
  const [titulo, setTitulo] = useState("Comarca de Oakhaven");
  const [reinosDelCurso, setReinosDelCurso] = useState([]);
  const [cargandoReinos, setCargandoReinos] = useState(false);
  const [creando, setCreando] = useState(false);

  const cargar = () => { setCargando(true); api.fetchSesionesComarca().then((d) => { setSesiones(d); setCargando(false); }); };
  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    if (!gradoId) return;
    setCargandoReinos(true);
    api.fetchReinosDeGrado(gradoId).then((r) => { setReinosDelCurso(r); setCargandoReinos(false); });
  }, [gradoId]);

  const crear = async () => {
    if (reinosDelCurso.length === 0) { alert("Este curso todavía no tiene estudiantes con un Reino asignado — asigná Reinos primero en la pantalla de Estudiantes."); return; }
    setCreando(true);
    try {
      const nueva = await api.crearSesionComarca(gradoId, titulo.trim() || "Comarca de Oakhaven", reinosDelCurso);
      setCreandoAbierto(false);
      setSesionAbierta(nueva);
    } catch (e) {
      alert("Error al crear la sesión: " + e.message);
    }
    setCreando(false);
  };

  if (sesionAbierta) return <TableroSesion sesion={sesionAbierta} onVolver={() => { setSesionAbierta(null); cargar(); }} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-xl font-bold text-slate-800">🏛️ Comarca de Oakhaven</h2>
          <p className="text-sm text-slate-400">6 Reinos rivales, provincias en disputa, y una economía viva — para vivirlo en el aula.</p>
        </div>
        <button onClick={() => setCreandoAbierto((v) => !v)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-500 text-white">
          {creandoAbierto ? "Cerrar" : "+ Nueva sesión"}
        </button>
      </div>

      {creandoAbierto && (
        <div className="bg-violet-50 rounded-2xl p-4 my-4">
          <label className="text-xs text-slate-500 block mb-1">Curso</label>
          <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none bg-white">
            {grados.map((g) => <option key={g.id} value={g.id}>Curso {g.id}</option>)}
          </select>
          <label className="text-xs text-slate-500 block mb-1">Título de la sesión</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none bg-white" />

          <label className="text-xs text-slate-500 block mb-1">Reinos de este curso (los mismos de "Mi Reino")</label>
          {cargandoReinos ? (
            <p className="text-xs text-slate-400 mb-3">Buscando…</p>
          ) : reinosDelCurso.length === 0 ? (
            <p className="text-xs text-rose-500 mb-3">Este curso todavía no tiene Reinos asignados a sus estudiantes.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {reinosDelCurso.map((r, i) => (
                <span key={r} className="text-xs font-semibold px-2 py-1 rounded-full bg-white border border-violet-200 text-violet-700">
                  {api.COMARCA_REINOS_BASE[i]?.emoji || "🏰"} {r}
                </span>
              ))}
            </div>
          )}

          <p className="text-[11px] text-slate-400 mb-3">Se va a crear un Reino de la Comarca por cada uno de estos, con sus 4 provincias, listos para repartir entre las mesas.</p>
          <button disabled={creando || reinosDelCurso.length === 0} onClick={crear} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
            {creando ? "Creando el tablero…" : "🏛️ Fundar la Comarca"}
          </button>
        </div>
      )}

      {cargando ? (
        <div className="text-sm text-slate-400 mt-4">Cargando…</div>
      ) : sesiones.length === 0 ? (
        <div className="text-sm text-slate-400 bg-white rounded-2xl p-6 text-center border border-dashed border-slate-200 mt-4">
          Todavía no armaste ninguna sesión. Creá la primera con "+ Nueva sesión".
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
          {sesiones.map((s) => (
            <button key={s.id} onClick={() => setSesionAbierta(s)} className="bg-white rounded-2xl border border-slate-100 p-4 text-left hover:border-violet-300">
              <div className="font-bold text-slate-800">{s.titulo}</div>
              <div className="text-xs text-slate-400">Curso {s.grado_id} · {s.fecha}</div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1.5 inline-block ${s.estado === "activa" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {s.estado === "activa" ? "🟢 En juego" : "⚪ Finalizada"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
