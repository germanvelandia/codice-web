import React, { useEffect, useMemo, useState } from "react";
import * as api from "../lib/api";
import { ordenarPorApellido } from "../lib/gamification";

export function VistaAccionesMasivas({ grados }) {
  const [gradoId, setGradoId] = useState(grados[0]?.id || "");
  const [estudiantes, setEstudiantes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [reinoFiltro, setReinoFiltro] = useState("Todos");
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [pestaña, setPestaña] = useState("oro"); // "oro" | "experiencia" | "vida" | "comportamiento"

  const [valorOro, setValorOro] = useState("");
  const [valorXp, setValorXp] = useState("");
  const [valorVida, setValorVida] = useState("");
  const [motivoNumero, setMotivoNumero] = useState("");
  const [aplicando, setAplicando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const [comportamientos, setComportamientos] = useState([]);
  const [categoriaComportamiento, setCategoriaComportamiento] = useState("convivencial");
  const [comportamientoId, setComportamientoId] = useState("");
  const [motivoComportamiento, setMotivoComportamiento] = useState("");
  const [fechaComportamiento, setFechaComportamiento] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => { if (grados.length && !gradoId) setGradoId(grados[0].id); }, [grados]);
  useEffect(() => {
    if (!gradoId) return;
    setCargando(true);
    api.fetchEstudiantesPorGrado(gradoId).then((d) => { setEstudiantes(ordenarPorApellido(d)); setSeleccionados(new Set()); setResultado(null); setCargando(false); });
  }, [gradoId]);
  useEffect(() => { api.fetchComportamientos(categoriaComportamiento).then(setComportamientos); }, [categoriaComportamiento]);

  const reinos = useMemo(() => ["Todos", ...new Set(estudiantes.map((s) => s.reino_actual || s.reino_original || "Sin grupo"))], [estudiantes]);
  const visibles = estudiantes.filter((s) => reinoFiltro === "Todos" || (s.reino_actual || s.reino_original) === reinoFiltro);

  const toggleUno = (id) => setSeleccionados((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const seleccionarTodo = () => setSeleccionados(new Set(visibles.map((s) => s.id)));
  const limpiarSeleccion = () => setSeleccionados(new Set());
  const seleccionarAleatorio = () => {
    const cantidadTexto = prompt(`¿Cuántos estudiantes al azar (de los ${visibles.length} visibles)?`, "3");
    const cantidad = parseInt(cantidadTexto, 10);
    if (!cantidad || cantidad <= 0) return;
    const barajados = [...visibles].sort(() => Math.random() - 0.5);
    setSeleccionados(new Set(barajados.slice(0, cantidad).map((s) => s.id)));
  };
  const seleccionarPorReino = (reino) => {
    setReinoFiltro(reino);
    setSeleccionados(new Set(estudiantes.filter((s) => reino === "Todos" || (s.reino_actual || s.reino_original) === reino).map((s) => s.id)));
  };

  const ids = Array.from(seleccionados);

  const aplicarNumero = async (tipo) => {
    const valor = parseInt(tipo === "oro" ? valorOro : tipo === "experiencia" ? valorXp : valorVida, 10);
    if (isNaN(valor)) { alert("Escribí un número (puede ser negativo)."); return; }
    if (ids.length === 0) { alert("Elegí al menos un estudiante."); return; }
    setAplicando(true);
    try {
      const tipoRegistro = tipo === "oro" ? "monedas" : tipo === "experiencia" ? "xp" : "vida";
      if (tipo === "oro") await api.ajustarMonedasMasivo(ids, valor);
      if (tipo === "experiencia") await api.ajustarXpMasivo(ids, valor);
      if (tipo === "vida") await api.ajustarVidaMasivo(ids, valor);
      await api.registrarHistorialPuntoMasivo(ids, tipoRegistro, valor, motivoNumero.trim() || null);
      setResultado({ tipo, valor, cantidad: ids.length });
      setValorOro(""); setValorXp(""); setValorVida(""); setMotivoNumero("");
    } catch (e) {
      alert("Error al aplicar: " + e.message);
    }
    setAplicando(false);
  };

  const aplicarComportamiento = async () => {
    const comportamiento = comportamientos.find((c) => c.id === parseInt(comportamientoId, 10));
    if (!comportamiento) { alert("Elegí un comportamiento del catálogo."); return; }
    if (ids.length === 0) { alert("Elegí al menos un estudiante."); return; }
    setAplicando(true);
    try {
      const r = await api.aplicarComportamientoMasivo(ids, comportamiento, motivoComportamiento, fechaComportamiento);
      setResultado({ tipo: "comportamiento", nombre: comportamiento.nombre, ...r });
      setMotivoComportamiento("");
    } catch (e) {
      alert("Error al aplicar: " + e.message);
    }
    setAplicando(false);
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">🎯 Acciones Masivas</h2>
      <p className="text-sm text-slate-400 mb-4">Dale oro, experiencia, vida, o aplicá un comportamiento del catálogo — a uno, a varios, a todo el curso, o por reino.</p>

      <div className="flex flex-wrap gap-2 items-center mb-3">
        <select value={gradoId} onChange={(e) => setGradoId(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {grados.map((g) => <option key={g.id} value={g.id}>Curso {g.id}</option>)}
        </select>
        <select value={reinoFiltro} onChange={(e) => setReinoFiltro(e.target.value)} className="text-sm rounded-full px-3 py-2 border border-slate-200 outline-none bg-white">
          {reinos.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <button onClick={seleccionarTodo} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-violet-200 text-violet-600">☑️ Seleccionar todo{reinoFiltro !== "Todos" ? ` (${reinoFiltro})` : ""}</button>
        <button onClick={limpiarSeleccion} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-500">✕ Limpiar selección</button>
        <button onClick={seleccionarAleatorio} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-amber-200 text-amber-600">🎲 Aleatorio</button>
        {reinos.filter((r) => r !== "Todos").map((r) => (
          <button key={r} onClick={() => seleccionarPorReino(r)} className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-500">👑 {r}</button>
        ))}
      </div>

      <p className="text-xs text-slate-500 mb-2">{ids.length} estudiante(s) seleccionado(s) de {visibles.length} visibles.</p>

      {cargando ? (
        <div className="text-sm text-slate-400">Cargando…</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-4 max-h-56 overflow-y-auto bg-white rounded-2xl border border-slate-100 p-3">
          {visibles.map((s) => (
            <label key={s.id} className={`flex items-center gap-1.5 text-xs rounded-lg px-2 py-1.5 cursor-pointer ${seleccionados.has(s.id) ? "bg-violet-50 text-violet-700" : "text-slate-600"}`}>
              <input type="checkbox" checked={seleccionados.has(s.id)} onChange={() => toggleUno(s.id)} />
              {s.nombre}
            </label>
          ))}
        </div>
      )}

      <div className="flex gap-1 rounded-full bg-slate-100 p-1 w-fit mb-4">
        <button onClick={() => setPestaña("oro")} className={`text-xs px-3 py-1.5 rounded-full ${pestaña === "oro" ? "bg-amber-500 text-white" : "text-slate-600"}`}>🪙 Oro</button>
        <button onClick={() => setPestaña("experiencia")} className={`text-xs px-3 py-1.5 rounded-full ${pestaña === "experiencia" ? "bg-violet-500 text-white" : "text-slate-600"}`}>⭐ Experiencia</button>
        <button onClick={() => setPestaña("vida")} className={`text-xs px-3 py-1.5 rounded-full ${pestaña === "vida" ? "bg-rose-500 text-white" : "text-slate-600"}`}>❤️ Vida</button>
        <button onClick={() => setPestaña("comportamiento")} className={`text-xs px-3 py-1.5 rounded-full ${pestaña === "comportamiento" ? "bg-slate-700 text-white" : "text-slate-600"}`}>📋 Comportamiento</button>
      </div>

      {(pestaña === "oro" || pestaña === "experiencia" || pestaña === "vida") && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <label className="text-xs text-slate-500 block mb-1">
            {pestaña === "oro" ? "Monedas a dar (negativo para quitar)" : pestaña === "experiencia" ? "Puntos de experiencia a dar (negativo para quitar)" : "Puntos de vida a dar (negativo para quitar)"}
          </label>
          <div className="flex gap-2 mb-2">
            <input type="number" value={pestaña === "oro" ? valorOro : pestaña === "experiencia" ? valorXp : valorVida}
              onChange={(e) => (pestaña === "oro" ? setValorOro : pestaña === "experiencia" ? setValorXp : setValorVida)(e.target.value)}
              placeholder="Ej: 10 o -5" className="flex-1 text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
          </div>
          <label className="text-xs text-slate-500 block mb-1">Motivo (el estudiante lo va a ver en su historial)</label>
          <div className="flex gap-2">
            <input value={motivoNumero} onChange={(e) => setMotivoNumero(e.target.value)} placeholder="Ej: Excelente participación en clase"
              className="flex-1 text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none" />
            <button disabled={aplicando} onClick={() => aplicarNumero(pestaña)} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white disabled:opacity-50">
              {aplicando ? "Aplicando…" : `Aplicar a ${ids.length}`}
            </button>
          </div>
        </div>
      )}

      {pestaña === "comportamiento" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <div className="flex gap-1 rounded-full bg-slate-100 p-1 w-fit mb-3">
            <button onClick={() => { setCategoriaComportamiento("convivencial"); setComportamientoId(""); }} className={`text-xs px-3 py-1.5 rounded-full ${categoriaComportamiento === "convivencial" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Convivencial</button>
            <button onClick={() => { setCategoriaComportamiento("academico"); setComportamientoId(""); }} className={`text-xs px-3 py-1.5 rounded-full ${categoriaComportamiento === "academico" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Académico</button>
          </div>
          <label className="text-xs text-slate-500 block mb-1">Comportamiento del catálogo</label>
          <select value={comportamientoId} onChange={(e) => setComportamientoId(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none">
            <option value="">— Elegir —</option>
            {comportamientos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <label className="text-xs text-slate-500 block mb-1">Fecha</label>
          <input type="date" value={fechaComportamiento} onChange={(e) => setFechaComportamiento(e.target.value)} className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none" />
          <label className="text-xs text-slate-500 block mb-1">Motivo / nota (opcional — si lo dejás vacío, usa el nombre del comportamiento)</label>
          <textarea value={motivoComportamiento} onChange={(e) => setMotivoComportamiento(e.target.value)} rows={2} className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />
          <button disabled={aplicando} onClick={aplicarComportamiento} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-50">
            {aplicando ? "Aplicando…" : `Crear acta para ${ids.length} estudiante(s)`}
          </button>
          <p className="text-[10px] text-slate-400 mt-2">Esto crea un acta individual para cada estudiante seleccionado, igual que si la hicieras una por una desde Actas.</p>
        </div>
      )}

      {resultado && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mt-3">
          {resultado.tipo === "comportamiento" ? (
            <p className="text-sm text-emerald-700">✔ "{resultado.nombre}" aplicado a {resultado.hechos} de {resultado.total} estudiante(s).</p>
          ) : (
            <p className="text-sm text-emerald-700">✔ {resultado.valor > 0 ? "+" : ""}{resultado.valor} {resultado.tipo} aplicado a {resultado.cantidad} estudiante(s).</p>
          )}
        </div>
      )}
    </div>
  );
}
