import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { TarjetaComarcaPublica } from "./screens/ComarcaOakhaven";
import { PortalAcudiente } from "./app/PortalAcudiente";
import { PortalEstudiante } from "./app/PortalEstudiante";
import { PortalCraft } from "./app/PortalCraft";
import { Centered } from "./app/comunes";
import { Panel } from "./app/PanelDocente";
import { AccessGate } from "./app/AccessGate";

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Link dedicado para estudiantes: tu-sitio.vercel.app/#estudiante
  // No muestra ninguna opción de docente, ni espera sesión de Supabase.
  const soloEstudiante = typeof window !== "undefined" && window.location.hash === "#estudiante";
  const esTarjetaComarca = typeof window !== "undefined" && window.location.hash.startsWith("#comarca-tarjeta");
  const soloCraft = typeof window !== "undefined" && window.location.hash === "#craft"; // Códice Craft: link directo al mundo 3D
  const soloAcudiente = typeof window !== "undefined" && window.location.hash === "#acudiente";

  useEffect(() => {
    if (soloEstudiante || esTarjetaComarca || soloAcudiente || soloCraft) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (esTarjetaComarca) {
    return <TarjetaComarcaPublica />;
  }

  if (soloAcudiente) {
    return <PortalAcudiente />;
  }

  if (soloCraft) {
    return <PortalCraft />;
  }

  if (soloEstudiante) {
    return <PortalEstudiante />;
  }

  if (loading) return <Centered>Cargando…</Centered>;
  return session ? <Panel session={session} /> : <AccessGate />;
}
