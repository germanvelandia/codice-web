import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { nivelYCurso } from "../lib/gamification";

// Sugerencia automática: de "601" a "701" (sube el nivel, mantiene el sufijo).
// Es solo un punto de partida — el docente puede corregir cualquiera.
function sugerirDestino(gradoId) {
  const { nivel, curso } = nivelYCurso(gradoId);
  const nivelNum = parseInt(nivel, 10);
  if (isNaN(nivelNum)) return "";
  return `${nivelNum + 1}${curso}`;
}

function PasoPrevia({ mapa, onVolver, onConfirmado }) {
  const [previa, setPrevia] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [reiniciarProgreso, setReiniciarProgreso] = useState(true);
  const [ejecutando, setEjecutando] = useState(false);
  const [confirmacionTexto, setConfirmacionTexto] = useState("");

  useEffect(() => { api.fetchPreviaPromocion(mapa).then((d) => { setPrevia(d); setCargando(false); }); }, []);

  const totalEstudiantes = previa.reduce((a, p) => a + p.estudiantes.length, 0);

  const ejecutar = async () => {
    if (confirmacionTexto.trim().toUpperCase() !== "PROMOVER") {
      alert('Para confirmar, escribí exactamente la palabra PROMOVER en el cuadro de abajo.');
      return;
    }
    setEjecutando(true);
    try {
      const detalle = await api.ejecutarPromocion(mapa, reiniciarProgreso);
      onConfirmado(detalle);
    } catch (e) {
      alert("Error al ejecutar la promoción: " + e.message);
    }
    setEjecutando(false);
  };

  if (cargando) return <div className="text-sm text-slate-400">Cargando vista previa…</div>;

  return (
    <div>
      <button onClick={onVolver} className="text-sm text-violet-500 mb-3">← Volver a ajustar</button>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
        <p className="text-sm text-amber-800 font-semibold">⚠️ Revisá bien antes de confirmar</p>
        <p className="text-xs text-amber-700 mt-1">Esto va a mover a {totalEstudiantes} estudiante(s) de curso. Las notas y asistencia de este año NO se borran — quedan guardadas tal como están, solo se actualiza el curso actual del estudiante hacia adelante.</p>
      </div>

      <div className="space-y-3 mb-4">
        {previa.map((p) => (
          <div key={p.origen} className="bg-white rounded-xl border border-slate-100 p-3">
            <div className="text-sm font-semibold text-slate-700 mb-1">
              {p.origen} → {p.graduacion ? <span className="text-emerald-600">🎓 Graduación (queda inactivo)</span> : <span className="text-violet-600">{p.destino}</span>}
              <span className="text-slate-400 font-normal"> · {p.estudiantes.length} estudiante(s)</span>
            </div>
            {p.estudiantes.length > 0 && (
              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer text-violet-500">Ver nombres</summary>
                <ul className="list-disc list-inside mt-1">
                  {p.estudiantes.map((e) => <li key={e.id}>{e.nombre}</li>)}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600 mb-4 bg-violet-50 rounded-xl p-3">
        <input type="checkbox" checked={reiniciarProgreso} onChange={(e) => setReiniciarProgreso(e.target.checked)} />
        Reiniciar XP, vida y monedas de los promovidos (empiezan el año de cero). Los graduados no se ven afectados por esta opción.
      </label>

      <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
        <label className="text-xs text-rose-700 block mb-1.5">Para confirmar, escribí <b>PROMOVER</b> en mayúsculas:</label>
        <input value={confirmacionTexto} onChange={(e) => setConfirmacionTexto(e.target.value)} placeholder="PROMOVER"
          className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-rose-200 outline-none" />
        <button disabled={ejecutando} onClick={ejecutar} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-rose-500 text-white disabled:opacity-60">
          {ejecutando ? "Ejecutando…" : `Confirmar y promover a ${totalEstudiantes} estudiante(s)`}
        </button>
      </div>
    </div>
  );
}

function PasoResultado({ detalle, onCerrar }) {
  const graduados = detalle.filter((d) => d.grado_nuevo === "graduado");
  const promovidos = detalle.filter((d) => d.grado_nuevo !== "graduado");
  return (
    <div>
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4">
        <p className="text-sm font-semibold text-emerald-700">✔ Promoción completada</p>
        <p className="text-xs text-emerald-600 mt-1">{promovidos.length} estudiante(s) promovido(s), {graduados.length} graduado(s).</p>
      </div>
      <button onClick={onCerrar} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white">Listo</button>
    </div>
  );
}

export function VistaPromocion() {
  const [grados, setGrados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [destinos, setDestinos] = useState({});
  const [graduaciones, setGraduaciones] = useState({});
  const [paso, setPaso] = useState("editar"); // "editar" | "previa" | "resultado"
  const [resultadoDetalle, setResultadoDetalle] = useState([]);
  const [historialAbierto, setHistorialAbierto] = useState(false);

  useEffect(() => {
    api.fetchGradosConConteo().then((d) => {
      setGrados(d);
      const dest = {}; d.forEach((g) => { dest[g.id] = sugerirDestino(g.id); });
      setDestinos(dest);
      setCargando(false);
    });
  }, []);

  const gradosConEstudiantes = grados.filter((g) => g.cantidadEstudiantes > 0);

  const irAPrevia = () => {
    const mapa = gradosConEstudiantes.map((g) => ({
      origen: g.id,
      destino: destinos[g.id],
      graduacion: !!graduaciones[g.id],
    }));
    const conError = mapa.find((m) => !m.graduacion && !m.destino.trim());
    if (conError) { alert(`Falta el curso de destino para ${conError.origen} (o marcalo como graduación).`); return; }
    setPaso("previa");
  };

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;

  if (paso === "previa") {
    const mapa = gradosConEstudiantes.map((g) => ({ origen: g.id, destino: destinos[g.id], graduacion: !!graduaciones[g.id] }));
    return <PasoPrevia mapa={mapa} onVolver={() => setPaso("editar")} onConfirmado={(detalle) => { setResultadoDetalle(detalle); setPaso("resultado"); }} />;
  }

  if (paso === "resultado") {
    return <PasoResultado detalle={resultadoDetalle} onCerrar={() => { setPaso("editar"); api.fetchGradosConConteo().then(setGrados); }} />;
  }

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1">🔄 Promoción de fin de año</h3>
      <p className="text-xs text-slate-400 mb-4">
        Para cada curso, definí a qué curso pasan sus estudiantes el año que viene (o marcalo como graduación, si es el último grado).
        No se borra ningún dato histórico — solo se actualiza el curso actual de cada estudiante.
      </p>

      {gradosConEstudiantes.length === 0 ? (
        <p className="text-sm text-slate-400">No hay estudiantes activos en ningún curso.</p>
      ) : (
        <div className="space-y-2 mb-4">
          {gradosConEstudiantes.map((g) => (
            <div key={g.id} className="flex items-center gap-2 bg-white rounded-xl border border-slate-100 p-3 flex-wrap">
              <div className="text-sm font-semibold text-slate-700 w-20">{g.id}</div>
              <div className="text-xs text-slate-400 w-32">{g.cantidadEstudiantes} estudiante(s)</div>
              <span className="text-slate-300">→</span>
              {graduaciones[g.id] ? (
                <span className="text-sm text-emerald-600 font-semibold flex-1">🎓 Graduación (quedan inactivos)</span>
              ) : (
                <input value={destinos[g.id] || ""} onChange={(e) => setDestinos((prev) => ({ ...prev, [g.id]: e.target.value }))}
                  placeholder="Ej: 701" className="text-sm rounded-lg px-3 py-1.5 border border-slate-200 outline-none w-24" />
              )}
              <label className="flex items-center gap-1.5 text-xs text-slate-500 ml-auto">
                <input type="checkbox" checked={!!graduaciones[g.id]} onChange={(e) => setGraduaciones((prev) => ({ ...prev, [g.id]: e.target.checked }))} />
                Es graduación
              </label>
            </div>
          ))}
        </div>
      )}

      <button onClick={irAPrevia} disabled={gradosConEstudiantes.length === 0} className="text-sm font-semibold px-4 py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-50">
        Ver vista previa →
      </button>

      <div className="mt-6 border-t border-slate-100 pt-3">
        <button onClick={() => setHistorialAbierto((v) => !v)} className="text-xs text-slate-400">
          {historialAbierto ? "Ocultar" : "Ver"} historial de promociones anteriores
        </button>
        {historialAbierto && <HistorialPromociones />}
      </div>
    </div>
  );
}

function HistorialPromociones() {
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  useEffect(() => { api.fetchHistorialPromociones().then((d) => { setHistorial(d); setCargando(false); }); }, []);

  if (cargando) return <div className="text-xs text-slate-400 mt-2">Cargando…</div>;
  if (historial.length === 0) return <p className="text-xs text-slate-400 mt-2">Todavía no se ejecutó ninguna promoción.</p>;

  return (
    <div className="space-y-2 mt-2">
      {historial.map((h) => (
        <details key={h.id} className="text-xs bg-slate-50 rounded-lg p-2">
          <summary className="cursor-pointer text-slate-600">{new Date(h.creado_en).toLocaleString("es-CO")} · {h.detalle.length} estudiante(s){h.reinicio_progreso ? " · con reinicio de progreso" : ""}</summary>
          <ul className="list-disc list-inside mt-1 text-slate-500">
            {h.detalle.map((d, i) => <li key={i}>{d.nombre}: {d.grado_anterior} → {d.grado_nuevo}</li>)}
          </ul>
        </details>
      ))}
    </div>
  );
}
