import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import * as api from "./lib/api";
import { nextLevel } from "./lib/gamification";
import { VistaGrados, VistaReinos, VistaEstudiantes } from "./screens/Estudiantes";
import { VistaAsistencia } from "./screens/Asistencia";
import { VistaRuleta, VistaTemporizador, VistaHerramientas } from "./screens/Herramientas";
import { VistaRoles } from "./screens/Roles";
import { VistaCalificaciones } from "./screens/Calificaciones";
import { VistaReportes } from "./screens/Reportes";

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) return <Centered>Cargando…</Centered>;
  return session ? <Panel session={session} /> : <AccessGate />;
}

function Centered({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-violet-50 text-slate-700">
      {children}
    </div>
  );
}

function AccessGate() {
  const [modo, setModo] = useState("docente");
  return (
    <Centered>
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-violet-600 text-center mb-1">CÓDICE</h1>
        <div className="flex gap-1 mb-4 rounded-full bg-white p-1 shadow-sm">
          <button onClick={() => setModo("docente")} className={`flex-1 text-xs py-1.5 rounded-full ${modo === "docente" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Soy docente</button>
          <button onClick={() => setModo("estudiante")} className={`flex-1 text-xs py-1.5 rounded-full ${modo === "estudiante" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Soy estudiante</button>
        </div>
        {modo === "docente" ? <LoginScreen /> : <PortalEstudiante />}
      </div>
    </Centered>
  );
}

function PortalEstudiante() {
  const [codigo, setCodigo] = useState("");
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const consultar = async () => {
    if (!codigo.trim()) return;
    setCargando(true);
    setError("");
    try {
      const res = await api.consultarPortalEstudiante(codigo);
      if (!res) { setError("Código no encontrado. Verifica con tu docente."); setDatos(null); }
      else setDatos(res);
    } catch (e) {
      setError("Ocurrió un error: " + e.message);
    }
    setCargando(false);
  };

  if (datos) {
    const { level, next, pct } = nextLevel(datos.xp || 0);
    const totalAsis = Number(datos.total_asistencia) || 0;
    const pctAsis = totalAsis > 0 ? Math.round((Number(datos.presentes) / totalAsis) * 100) : null;
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="text-center mb-4">
          <div className="text-lg font-bold text-slate-800">{datos.nombre}</div>
          <div className="text-xs text-slate-400">Grado {datos.grado_id} · {datos.grupo}</div>
        </div>
        <div className="mb-3">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold text-violet-600">{level.name}</span>
            <span>{datos.xp}{next ? ` / ${next.min} XP` : " XP · nivel máximo"}</span>
          </div>
          <div className="h-2.5 rounded-full bg-violet-100 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-600" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-emerald-50 rounded-xl p-2 text-center">
            <div className="text-sm font-bold text-emerald-600">{datos.vida}</div>
            <div className="text-[10px] text-slate-400">Vida</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-2 text-center">
            <div className="text-sm font-bold text-amber-600">{datos.monedas}</div>
            <div className="text-[10px] text-slate-400">Monedas</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-2 text-center">
            <div className="text-sm font-bold text-blue-600">{pctAsis ?? "—"}{pctAsis !== null && "%"}</div>
            <div className="text-[10px] text-slate-400">Asistencia</div>
          </div>
        </div>
        <div className="text-xs text-slate-500 mb-4">
          Presentes: {datos.presentes} · Retardos: {datos.retardos} · Faltas injustificadas: {datos.faltas_injustificadas} · Faltas justificadas: {datos.faltas_justificadas}
        </div>
        <button onClick={() => { setDatos(null); setCodigo(""); }} className="w-full text-xs text-violet-500">← Consultar otro código</button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <p className="text-sm text-slate-500 text-center mb-4">Ingresa el código de acceso que te dio tu docente para ver tu progreso.</p>
      <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="Ej: AB3D9K" maxLength={6}
        className="w-full text-center text-lg font-mono font-bold tracking-widest rounded-lg px-3 py-3 mb-3 border border-slate-200 outline-none" />
      {error && <p className="text-xs text-rose-500 mb-2 text-center">{error}</p>}
      <button disabled={cargando} onClick={consultar} className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
        {cargando ? "Consultando…" : "Ver mi progreso"}
      </button>
    </div>
  );
}

function LoginScreen() {
  const [modo, setModo] = useState("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  const entrar = async () => {
    setCargando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setCargando(false);
    if (error) setMensaje(error.message);
  };

  const crearCuenta = async () => {
    setCargando(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { setMensaje(error.message); setCargando(false); return; }
    if (data.user) {
      await supabase.from("profesores").insert({ id: data.user.id, nombre: nombre || email, email });
    }
    setCargando(false);
    setMensaje("Cuenta creada. Si tu proyecto de Supabase exige confirmar el correo, revisa tu bandeja de entrada.");
  };

  const recuperar = async () => {
    if (!email) { setMensaje("Escribe tu correo arriba primero."); return; }
    setCargando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setCargando(false);
    setMensaje(error ? error.message : "Te enviamos un correo para restablecer tu contraseña.");
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <p className="text-sm text-slate-500 text-center mb-5">Acceso de docentes</p>

      <div className="flex gap-1 mb-4 rounded-full bg-violet-50 p-1">
        <button onClick={() => setModo("entrar")} className={`flex-1 text-xs py-1.5 rounded-full ${modo === "entrar" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Iniciar sesión</button>
        <button onClick={() => setModo("crear")} className={`flex-1 text-xs py-1.5 rounded-full ${modo === "crear" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Crear cuenta</button>
      </div>

      {modo === "crear" && (
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre completo"
          className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none" />
      )}
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo" type="email"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" type="password"
        className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />

      {mensaje && <p className="text-xs text-rose-500 mb-2">{mensaje}</p>}

      <button disabled={cargando} onClick={modo === "entrar" ? entrar : crearCuenta}
        className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
        {cargando ? "Un momento…" : modo === "entrar" ? "Entrar" : "Crear cuenta"}
      </button>

      {modo === "entrar" && (
        <button onClick={recuperar} className="w-full text-xs text-violet-500 mt-3">¿Olvidaste tu contraseña?</button>
      )}
    </div>
  );
}

function Panel({ session }) {
  const [tab, setTab] = useState("estudiantes");
  const [subTabHerramientas, setSubTabHerramientas] = useState("ruleta");
  const [grado, setGrado] = useState(null);
  const [reino, setReino] = useState(null);
  const [modoLista, setModoLista] = useState(false);
  const [grados, setGrados] = useState([]);

  useEffect(() => {
    api.asegurarProfesor().then(() => api.asegurarGradosBase()).then(() => api.fetchGrados()).then(setGrados);
  }, []);

  const irAEstudiantes = () => { setTab("estudiantes"); setGrado(null); setReino(null); setModoLista(false); };

  return (
    <div className="min-h-screen bg-violet-50">
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-bold text-violet-700 cursor-pointer" onClick={irAEstudiantes}>CÓDICE</h1>
        <div className="flex gap-1 rounded-full bg-violet-50 p-1 flex-wrap">
          <button onClick={irAEstudiantes} className={`text-xs px-3 py-1.5 rounded-full ${tab === "estudiantes" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Estudiantes</button>
          <button onClick={() => setTab("asistencia")} className={`text-xs px-3 py-1.5 rounded-full ${tab === "asistencia" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Asistencia</button>
          <button onClick={() => setTab("herramientas")} className={`text-xs px-3 py-1.5 rounded-full ${tab === "herramientas" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Herramientas</button>
          <button onClick={() => setTab("roles")} className={`text-xs px-3 py-1.5 rounded-full ${tab === "roles" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Roles</button>
          <button onClick={() => setTab("calificaciones")} className={`text-xs px-3 py-1.5 rounded-full ${tab === "calificaciones" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Calificaciones</button>
          <button onClick={() => setTab("reportes")} className={`text-xs px-3 py-1.5 rounded-full ${tab === "reportes" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Reportes</button>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="text-sm text-slate-500">Cerrar sesión ({session.user.email})</button>
      </div>
      <div className="p-6 max-w-6xl mx-auto">
        {tab === "estudiantes" && (
          <>
            {!grado && <VistaGrados onElegirGrado={(g) => { setGrado(g); setReino(null); setModoLista(false); }} />}
            {grado && !modoLista && !reino && (
              <VistaReinos
                gradoId={grado}
                onElegirReino={(r) => setReino(r)}
                onVerTodos={() => setModoLista(true)}
                onVolver={() => setGrado(null)}
              />
            )}
            {grado && (modoLista || reino) && (
              <VistaEstudiantes
                gradoId={grado}
                reinoFiltro={modoLista ? null : reino}
                onVolver={() => { setReino(null); setModoLista(false); }}
              />
            )}
          </>
        )}
        {tab === "asistencia" && grados.length > 0 && <VistaAsistencia grados={grados} />}
        {tab === "herramientas" && grados.length > 0 && (
          <>
            <div className="flex gap-1 mb-6 rounded-full bg-white p-1 w-fit border border-slate-100 shadow-sm">
              <button onClick={() => setSubTabHerramientas("ruleta")} className={`text-xs px-3 py-1.5 rounded-full ${subTabHerramientas === "ruleta" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Ruleta</button>
              <button onClick={() => setSubTabHerramientas("temporizador")} className={`text-xs px-3 py-1.5 rounded-full ${subTabHerramientas === "temporizador" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Temporizador</button>
              <button onClick={() => setSubTabHerramientas("otras")} className={`text-xs px-3 py-1.5 rounded-full ${subTabHerramientas === "otras" ? "bg-violet-500 text-white" : "text-slate-600"}`}>Otras herramientas</button>
            </div>
            {subTabHerramientas === "ruleta" && <VistaRuleta grados={grados} />}
            {subTabHerramientas === "temporizador" && <VistaTemporizador />}
            {subTabHerramientas === "otras" && <VistaHerramientas grados={grados} />}
          </>
        )}
        {tab === "roles" && <VistaRoles />}
        {tab === "calificaciones" && grados.length > 0 && <VistaCalificaciones grados={grados} />}
        {tab === "reportes" && grados.length > 0 && <VistaReportes grados={grados} />}
      </div>
    </div>
  );
}
