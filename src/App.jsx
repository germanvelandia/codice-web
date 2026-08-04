import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

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
  return session ? <Panel session={session} /> : <LoginScreen />;
}

function Centered({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-violet-50 text-slate-700">
      {children}
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
    <Centered>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-2xl font-bold text-violet-600 text-center mb-1">CÓDICE</h1>
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
    </Centered>
  );
}

function Panel({ session }) {
  const [estudiantes, setEstudiantes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoGrado, setNuevoGrado] = useState("801");

  const cargarEstudiantes = async () => {
    setCargando(true);
    const { data, error } = await supabase
      .from("estudiantes")
      .select("*")
      .eq("activo", true)
      .order("nombre");
    if (!error) setEstudiantes(data || []);
    setCargando(false);
  };

  useEffect(() => { cargarEstudiantes(); }, []);

  const agregarEstudiante = async () => {
    if (!nuevoNombre.trim()) return;
    await supabase.from("grados").upsert({ id: nuevoGrado }, { onConflict: "id" });
    await supabase.from("estudiantes").insert({ nombre: nuevoNombre.trim(), grado_id: nuevoGrado, reino_original: "Sin grupo" });
    setNuevoNombre("");
    cargarEstudiantes();
  };

  const darPunto = async (estudianteId) => {
    await supabase.from("historial_gamificacion").insert({
      estudiante_id: estudianteId, etiqueta: "Participación en clase", xp: 10, vida: 2, categoria: "academico",
    });
    const { data: actual } = await supabase.from("progreso").select("*").eq("estudiante_id", estudianteId).maybeSingle();
    await supabase.from("progreso").upsert({
      estudiante_id: estudianteId,
      xp: (actual?.xp || 0) + 10,
      vida: Math.min(100, (actual?.vida ?? 100) + 2),
      monedas: (actual?.monedas || 0) + 1,
    });
    alert("¡+10 XP registrado en Supabase!");
  };

  return (
    <div className="min-h-screen bg-violet-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-violet-700">CÓDICE — conectado a Supabase</h1>
        <button onClick={() => supabase.auth.signOut()} className="text-sm text-slate-500">Cerrar sesión ({session.user.email})</button>
      </div>

      <div className="bg-white rounded-2xl shadow p-4 mb-6 flex flex-wrap gap-2 items-center">
        <input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder="Nombre del estudiante"
          className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none flex-1 min-w-[200px]" />
        <input value={nuevoGrado} onChange={(e) => setNuevoGrado(e.target.value)} placeholder="Grado (ej: 801)"
          className="text-sm rounded-lg px-3 py-2 border border-slate-200 outline-none w-28" />
        <button onClick={agregarEstudiante} className="text-sm font-semibold px-4 py-2 rounded-lg bg-violet-500 text-white">Agregar</button>
      </div>

      <div className="bg-white rounded-2xl shadow divide-y divide-slate-100">
        {cargando && <div className="p-4 text-sm text-slate-400">Cargando estudiantes…</div>}
        {!cargando && estudiantes.length === 0 && (
          <div className="p-4 text-sm text-slate-400">Aún no hay estudiantes en la base de datos. Agrega el primero arriba.</div>
        )}
        {estudiantes.map((s) => (
          <div key={s.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-sm font-medium text-slate-800">{s.nombre}</div>
              <div className="text-xs text-slate-400">Grado {s.grado_id} · {s.reino_actual || s.reino_original}</div>
            </div>
            <button onClick={() => darPunto(s.id)} className="text-xs px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700">+10 XP</button>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 mt-6">
        Esto ya vive en una base de datos real y compartida. El siguiente paso es traer el resto de las pantallas
        del prototipo de Claude a este mismo patrón.
      </p>
    </div>
  );
}
