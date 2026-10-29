import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { FondoCastillo } from "./comunes";

export function AccessGate() {
  return (
    <div className="min-h-screen flex items-center justify-center relative">
      <FondoCastillo />
      <div className="w-full max-w-sm px-4">
        <div className="text-center mb-3">
          <div className="text-4xl mb-1">🏰</div>
          <h1 className="text-3xl font-bold text-white tracking-[0.15em]" style={{ fontFamily: "Georgia, serif", textShadow: "0 2px 8px rgba(76,29,149,0.6)" }}>CÓDICE</h1>
          <p className="text-violet-100 text-xs mt-1" style={{ textShadow: "0 1px 4px rgba(76,29,149,0.6)" }}>El reino del aprendizaje te espera</p>
        </div>
        <LoginScreen />
      </div>
    </div>
  );
}

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  const entrar = async () => {
    setCargando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setCargando(false);
    if (error) setMensaje(error.message);
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

      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo" type="email"
        className="w-full text-sm rounded-lg px-3 py-2 mb-2 border border-slate-200 outline-none" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" type="password"
        className="w-full text-sm rounded-lg px-3 py-2 mb-3 border border-slate-200 outline-none" />

      {mensaje && <p className="text-xs text-rose-500 mb-2">{mensaje}</p>}

      <button disabled={cargando} onClick={entrar}
        className="w-full text-sm font-semibold py-2.5 rounded-lg bg-violet-500 text-white disabled:opacity-60">
        {cargando ? "Un momento…" : "Entrar"}
      </button>

      <button onClick={recuperar} className="w-full text-xs text-violet-500 mt-3">¿Olvidaste tu contraseña?</button>
      <p className="text-[11px] text-slate-400 text-center mt-4">
        ¿Sos docente nuevo y no tenés cuenta? Pedile a un administrador de la plataforma que te invite.
      </p>
    </div>
  );
}
