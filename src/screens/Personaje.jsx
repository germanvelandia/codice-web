import React, { useEffect, useState } from "react";
import * as api from "../lib/api";
import { personajeSvg } from "../lib/avatarPartes";

const LABELS_CATEGORIA = { cuerpo: "🧍 Cuerpo", pelo: "💇 Pelo", atuendo: "👕 Atuendo", accesorio: "🎩 Accesorio" };
const COLORES_PIEL = ["#F5D0A9", "#E8B585", "#C68642", "#8D5524", "#5A3825", "#FFDFC4"];
const COLORES_PELO = ["#3B2314", "#000000", "#7C3AED", "#DC2626", "#F59E0B", "#FFFFFF", "#0891B2", "#EC4899"];

export function PersonajePreview({ config, size = 100 }) {
  return (
    <svg viewBox="0 0 100 120" width={size} height={size * 1.2} dangerouslySetInnerHTML={{ __html: personajeSvg({
      pielColor: config.piel_color, peloKey: config.pelo_key, peloColor: config.pelo_color,
      atuendoKey: config.atuendo_key, atuendoColor: config.atuendo_color, accesorioKey: config.accesorio_key,
    }) }} />
  );
}

export function VistaPersonaje({ estudianteId, monedas, onMonedasActualizadas }) {
  const [catalogo, setCatalogo] = useState([]);
  const [config, setConfig] = useState(null);
  const [desbloqueados, setDesbloqueados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState("pelo");
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
    piel_color: config.piel_color,
    pelo_key: parteDe(config.pelo_id)?.svg_key || "corto",
    pelo_color: config.pelo_color,
    atuendo_key: parteDe(config.atuendo_id)?.svg_key || "tunica",
    atuendo_color: config.atuendo_color,
    accesorio_key: parteDe(config.accesorio_id)?.svg_key || "ninguno",
  };

  const estaDesbloqueada = (parte) => parte.costo_monedas === 0 || desbloqueados.includes(parte.id);

  const equipar = async (categoria, parte) => {
    const campo = { pelo: "pelo_id", atuendo: "atuendo_id", accesorio: "accesorio_id" }[categoria];
    if (!campo) return; // "cuerpo" no tiene id que equipar, se maneja con color
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

  const cambiarColorPiel = async (color) => {
    await api.guardarAvatarConfig(estudianteId, { piel_color: color });
    setConfig((prev) => ({ ...prev, piel_color: color }));
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
  const idEquipadoDeTab = { pelo: config.pelo_id, atuendo: config.atuendo_id, accesorio: config.accesorio_id }[tab];

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

      {tab === "cuerpo" ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <p className="text-xs text-slate-500 mb-2">Color de piel (gratis, elegí el que quieras)</p>
          <div className="flex flex-wrap gap-2">
            {COLORES_PIEL.map((c) => (
              <button key={c} onClick={() => cambiarColorPiel(c)} className="w-9 h-9 rounded-full border-2" style={{ background: c, borderColor: config.piel_color === c ? "#7C3AED" : "transparent" }} />
            ))}
          </div>
        </div>
      ) : (
        <>
          {(tab === "pelo" || tab === "atuendo") && (
            <div className="bg-white rounded-2xl border border-slate-100 p-3 mb-2">
              <p className="text-xs text-slate-500 mb-2">Color {tab === "pelo" ? "de pelo" : "del atuendo"} (gratis una vez que tengas el estilo)</p>
              <div className="flex flex-wrap gap-2">
                {COLORES_PELO.map((c) => (
                  <button key={c} onClick={() => (tab === "pelo" ? cambiarColorPelo(c) : cambiarColorAtuendo(c))}
                    className="w-7 h-7 rounded-full border-2" style={{ background: c, borderColor: (tab === "pelo" ? config.pelo_color : config.atuendo_color) === c ? "#7C3AED" : "#e2e8f0" }} />
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {itemsDeTab.map((parte) => {
              const desbloqueada = estaDesbloqueada(parte);
              const equipada = idEquipadoDeTab === parte.id || (parte.svg_key === "ninguno" && !idEquipadoDeTab);
              return (
                <div key={parte.id} className={`rounded-2xl border p-3 text-center ${equipada ? "border-violet-400 bg-violet-50" : "border-slate-100 bg-white"}`}>
                  <div className="flex justify-center mb-1.5">
                    <svg viewBox="0 0 100 60" width="70" height="42">
                      <g dangerouslySetInnerHTML={{ __html:
                        tab === "pelo" ? personajeSvg({ pielColor: "#F5D0A9", peloKey: parte.svg_key, peloColor: config.pelo_color }) :
                        tab === "atuendo" ? personajeSvg({ pielColor: "#F5D0A9", peloKey: "corto", peloColor: config.pelo_color, atuendoKey: parte.svg_key, atuendoColor: config.atuendo_color }) :
                        personajeSvg({ pielColor: "#F5D0A9", peloKey: "corto", peloColor: config.pelo_color, accesorioKey: parte.svg_key })
                      }} />
                    </svg>
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
        </>
      )}
    </div>
  );
}
