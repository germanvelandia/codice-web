import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { VistaGrados, VistaReinos, VistaEstudiantes } from "./screens/Estudiantes";

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
  const [grado, setGrado] = useState(null);
  const [reino, setReino] = useState(null);
  const [modoLista, setModoLista] = useState(false);

  return (
    <div className="min-h-screen bg-violet-50">
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-violet-700 cursor-pointer" onClick={() => { setGrado(null); setReino(null); setModoLista(false); }}>CÓDICE</h1>
        <button onClick={() => supabase.auth.signOut()} className="text-sm text-slate-500">Cerrar sesión ({session.user.email})</button>
      </div>
      <div className="p-6 max-w-6xl mx-auto">
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
      </div>
    </div>
  );
}
