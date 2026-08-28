import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { personajeSvg } from "../lib/avatarPartes";

const LABELS_CATEGORIA = { cuerpo: "🧍 Cuerpo", pelo: "💇 Pelo", atuendo: "👕 Atuendo", accesorio: "🎩 Accesorio" };

// Vista previa en hex de cada color con nombre del paquete — solo para
// pintar los botones de selección, el color real lo trae la pieza SVG.
const COLORES_PELO_HEX = {
  black: "#1F2937", blond: "#FDE68A", blue: "#3B82F6", brown: "#78350F",
  green: "#16A34A", orange: "#F97316", red: "#DC2626", violet: "#7C3AED", white: "#F8FAFC",
};
const COLORES_ATUENDO_HEX = {
  black: "#1F2937", blue: "#3B82F6", green: "#16A34A",
  orange: "#F97316", red: "#DC2626", violet: "#7C3AED", white: "#F8FAFC",
};

export function PersonajePreview({ config, size = 100 }) {
  return (
    <svg viewBox="0 0 145 165" width={size} height={size * (165 / 145)} dangerouslySetInnerHTML={{ __html: personajeSvg({
      cuerpoKey: config.cuerpo_key, peloKey: config.pelo_key, peloColor: config.pelo_color,
      atuendoKey: config.atuendo_key, atuendoColor: config.atuendo_color, accesorioKey: config.accesorio_key,
    }) }} />
  );
}

export function VistaPersonaje({ estudianteId, monedas, onMonedasActualizadas }) {
  const [catalogo, setCatalogo] = useState([]);
  const [config, setConfig] = useState(null);
  const [desbloqueados, setDesbloqueados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState("cuerpo");
  const [comprando, setComprando] = useState(null);

  const cargar = async () => {
    setCargando(true);
    const [cat, cfg, desb] = await Promise.all([
      api.fetchAvatarCatalogo(), api.fetchAvatarConfig(estudianteId), api.fetchAvatarDesbloqueados(estudianteId),
    ]);
    setCatalogo(cat);
    setConfig(cfg);
    setDesbloqueados(desb);
    setCargando(false);
  };
  useEffect(() => { cargar(); }, [estudianteId]);

  if (cargando || !config) return <div className="text-sm text-slate-400">Cargando…</div>;

  // Traduce la config guardada (ids) a las claves de dibujo (svg_key) que necesita el renderer.
  const parteDe = (id) => catalogo.find((p) => p.id === id);
  const configVisual = {
    cuerpo_key: parteDe(config.cuerpo_id)?.svg_key || "tint_1_smile",
    pelo_key: parteDe(config.pelo_id)?.svg_key || "corto",
    pelo_color: config.pelo_color || "brown",
    atuendo_key: parteDe(config.atuendo_id)?.svg_key || "tunica",
    atuendo_color: config.atuendo_color || "blue",
    accesorio_key: parteDe(config.accesorio_id)?.svg_key || "ninguno",
  };

  const estaDesbloqueada = (parte) => parte.costo_monedas === 0 || desbloqueados.includes(parte.id);

  const equipar = async (categoria, parte) => {
    const campo = { cuerpo: "cuerpo_id", pelo: "pelo_id", atuendo: "atuendo_id", accesorio: "accesorio_id" }[categoria];
    if (!campo) return;
    await api.guardarAvatarConfig(estudianteId, { [campo]: parte.id });
    setConfig((prev) => ({ ...prev, [campo]: parte.id }));
  };

  const comprarYEquipar = async (categoria, parte) => {
    setComprando(parte.id);
    try {
      await api.comprarParteAvatar(estudianteId, parte.id, parte.costo_monedas, monedas);
      setDesbloqueados((prev) => [...prev, parte.id]);
      await equipar(categoria, parte);
      onMonedasActualizadas();
    } catch (e) {
      alert(e.message);
    }
    setComprando(null);
  };

  const cambiarColorPelo = async (color) => {
    await api.guardarAvatarConfig(estudianteId, { pelo_color: color });
    setConfig((prev) => ({ ...prev, pelo_color: color }));
  };
  const cambiarColorAtuendo = async (color) => {
    await api.guardarAvatarConfig(estudianteId, { atuendo_color: color });
    setConfig((prev) => ({ ...prev, atuendo_color: color }));
  };

  const itemsDeTab = catalogo.filter((p) => p.categoria === tab);
  const idEquipadoDeTab = { cuerpo: config.cuerpo_id, pelo: config.pelo_id, atuendo: config.atuendo_id, accesorio: config.accesorio_id }[tab];

  // Vista previa chica de un ítem del catálogo — arma un personaje base con
  // solo esa pieza puesta (más los colores actuales), para mostrar en la tarjeta.
  const previaDeItem = (parte) => {
    if (tab === "cuerpo") return personajeSvg({ cuerpoKey: parte.svg_key, peloKey: "calvo" });
    if (tab === "pelo") return personajeSvg({ cuerpoKey: "tint_1_smile", peloKey: parte.svg_key, peloColor: config.pelo_color });
    if (tab === "atuendo") return personajeSvg({ cuerpoKey: "tint_1_smile", atuendoKey: parte.svg_key, atuendoColor: config.atuendo_color });
    return personajeSvg({ cuerpoKey: "tint_1_smile", accesorioKey: parte.svg_key });
  };

  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-1">🎨 Mi Personaje</h3>
      <p className="text-xs text-slate-400 mb-3">Elegí cada parte y comprá las que quieras con tus monedas — se ve así en Ranking y Salón de Honor.</p>

      <div className="flex justify-center mb-4">
        <div className="bg-gradient-to-b from-violet-100 to-violet-50 rounded-2xl p-4 border border-violet-200">
          <PersonajePreview config={configVisual} size={140} />
        </div>
      </div>

      <div className="flex justify-center gap-1.5 mb-2 text-sm">
        <span className="font-bold text-amber-600">🪙 {monedas}</span>
      </div>

      <div className="flex gap-1 rounded-full bg-slate-100 p-1 mb-3 flex-wrap justify-center">
        {Object.entries(LABELS_CATEGORIA).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`text-xs px-3 py-1.5 rounded-full ${tab === key ? "bg-violet-500 text-white" : "text-slate-600"}`}>{label}</button>
        ))}
      </div>

      {(tab === "pelo" || tab === "atuendo") && (
        <div className="bg-white rounded-2xl border border-slate-100 p-3 mb-2">
          <p className="text-xs text-slate-500 mb-2">Color {tab === "pelo" ? "de pelo" : "del atuendo"} (gratis una vez que tengas el estilo)</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(tab === "pelo" ? COLORES_PELO_HEX : COLORES_ATUENDO_HEX).map(([nombre, hex]) => (
              <button key={nombre} onClick={() => (tab === "pelo" ? cambiarColorPelo(nombre) : cambiarColorAtuendo(nombre))}
                title={nombre}
                className="w-7 h-7 rounded-full border-2"
                style={{ background: hex, borderColor: (tab === "pelo" ? config.pelo_color : config.atuendo_color) === nombre ? "#7C3AED" : "#e2e8f0" }} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {itemsDeTab.map((parte) => {
          const desbloqueada = estaDesbloqueada(parte);
          const equipada = idEquipadoDeTab === parte.id;
          return (
            <div key={parte.id} className={`rounded-2xl border p-3 text-center ${equipada ? "border-violet-400 bg-violet-50" : "border-slate-100 bg-white"}`}>
              <div className="flex justify-center mb-1.5">
                <svg viewBox="0 0 145 135" width="80" height="75" dangerouslySetInnerHTML={{ __html: previaDeItem(parte) }} />
              </div>
              <div className="text-[11px] font-semibold text-slate-700 mb-1.5">{parte.nombre}</div>
              {equipada ? (
                <span className="text-[10px] font-semibold text-violet-600">✓ Puesto</span>
              ) : desbloqueada ? (
                <button onClick={() => equipar(tab, parte)} className="text-[10px] font-semibold px-2 py-1 rounded-full bg-violet-500 text-white">Ponerse</button>
              ) : (
                <button disabled={comprando === parte.id} onClick={() => comprarYEquipar(tab, parte)}
                  className="text-[10px] font-semibold px-2 py-1 rounded-full bg-amber-500 text-white disabled:opacity-60">
                  {comprando === parte.id ? "…" : `🪙 ${parte.costo_monedas}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
