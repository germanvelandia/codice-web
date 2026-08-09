import React, { useEffect, useState } from "react";
import * as api from "../lib/api";

const DIAS_NOMBRE = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const TIPO_EVENTO_COLOR = { institucional: "#8B5CF6", academico: "#7C3AED", convivencial: "#DB2777", festivo: "#F59E0B", otro: "#64748B" };

export function VistaInicio({ onIrA }) {
  const [stats, setStats] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [nombreDocente, setNombreDocente] = useState("");

  useEffect(() => {
    Promise.all([api.fetchStatsDocente(), api.fetchResumenDocente(), api.fetchMiPerfil()]).then(([s, r, perfil]) => {
      setStats(s); setResumen(r); setNombreDocente(perfil?.nombre || ""); setCargando(false);
    });
  }, []);

  const hoy = new Date();
  const fechaLegible = hoy.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  if (cargando) return <div className="text-sm text-slate-400">Cargando…</div>;

  const { level, pctNivel } = (() => {
    const niveles = [0, 100, 300, 600, 1000];
    const idx = niveles.filter((n) => stats.xp >= n).length - 1;
    const actual = niveles[idx] ?? 0;
    const siguiente = niveles[idx + 1];
    const pct = siguiente ? Math.min(100, Math.round(((stats.xp - actual) / (siguiente - actual)) * 100)) : 100;
    return { level: stats.nivel, pctNivel: pct };
  })();

  const MODULOS = [
    { key: "estudiantes", label: "Mi Reino", sub: "Tus estudiantes", icono: "🏰" },
    { key: "calificaciones", label: "Códice", sub: "Notas y planillas", icono: "📖" },
    { key: "evaluaciones", label: "Misiones", sub: "Evaluaciones", icono: "⚔️" },
    { key: "proyectosforja", label: "La Forja", sub: "Proyectos y talleres", icono: "🔨" },
    { key: "planeaciones", label: "Biblioteca", sub: "Planeaciones", icono: "📚" },
    { key: "herramientas", label: "Herramientas", sub: "Ruleta, banco, temporizador", icono: "🛠️" },
    { key: "horario", label: "Agenda", sub: "Horario y cronograma", icono: "🗓️" },
    { key: "reportes", label: "Reportes", sub: "Análisis y estadísticas", icono: "📊" },
  ];

  return (
    <div>
      {/* Banner de bienvenida */}
      <div className="rounded-2xl overflow-hidden mb-4" style={{ background: "linear-gradient(135deg, #2d2450 0%, #1e1b30 60%, #14101f 100%)", border: "1px solid #7c3aed55" }}>
        <div className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-violet-200 text-sm">¡Bienvenido de vuelta{nombreDocente ? `, ${nombreDocente}` : ""}!</div>
              <div className="text-white text-xl font-bold mt-0.5 capitalize">{fechaLegible}</div>
            </div>
            <div className="text-4xl">🏰</div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <div className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
              <div className="text-lg font-bold text-violet-100">{level}</div>
              <div className="text-[10px] text-violet-300 uppercase tracking-wide">Nivel</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
              <div className="text-lg font-bold text-violet-100">{stats.xp}</div>
              <div className="text-[10px] text-violet-300 uppercase tracking-wide">XP total</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
              <div className="text-lg font-bold text-violet-100">{stats.insignias}</div>
              <div className="text-[10px] text-violet-300 uppercase tracking-wide">Insignias</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
              <div className="text-lg font-bold text-violet-100">{stats.estudiantesACargo}</div>
              <div className="text-[10px] text-violet-300 uppercase tracking-wide">Estudiantes</div>
            </div>
          </div>
          <div className="mt-3">
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400" style={{ width: `${pctNivel}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Resumen del día */}
      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <div className="font-bold text-slate-800 mb-3">Resumen del día</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">📅 Clases de hoy</span><span className="font-semibold text-slate-700">{resumen.clasesHoy.length}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">🗓️ Eventos de hoy</span><span className="font-semibold text-slate-700">{resumen.eventosHoy.length}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">⚔️ Misiones publicadas</span><span className="font-semibold text-slate-700">{resumen.evaluacionesPublicadas}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">📝 Entregas por revisar</span><span className="font-semibold text-amber-600">{resumen.entregasPendientes}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">🔨 Tareas sin calificar</span><span className="font-semibold text-amber-600">{resumen.tareasSinCalificar}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">📖 Clases planeadas pendientes</span><span className="font-semibold text-amber-600">{resumen.clasesPendientes}</span></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <div className="font-bold text-slate-800 mb-3">Clases de hoy ({DIAS_NOMBRE[hoy.getDay()]})</div>
          {resumen.clasesHoy.length === 0 ? (
            <p className="text-xs text-slate-400">No tenés clases registradas para hoy en tu Horario.</p>
          ) : (
            <div className="space-y-1.5">
              {resumen.clasesHoy.map((h) => (
                <div key={h.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-2.5 py-1.5 text-xs">
                  <span className="font-semibold text-slate-700">{h.materias?.nombre || h.nombre_actividad || "—"}{h.grado_id ? ` · ${h.grado_id}` : ""}</span>
                  <span className="text-slate-400">{h.hora_inicio?.slice(0, 5)}–{h.hora_fin?.slice(0, 5)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <div className="font-bold text-slate-800 mb-3">Eventos de hoy</div>
          {resumen.eventosHoy.length === 0 ? (
            <p className="text-xs text-slate-400">No hay eventos del cronograma para hoy.</p>
          ) : (
            <div className="space-y-1.5">
              {resumen.eventosHoy.map((e) => (
                <div key={e.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TIPO_EVENTO_COLOR[e.tipo] || "#64748B" }} />
                  <span className="font-semibold text-slate-700 truncate">{e.titulo}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Módulos principales */}
      <div className="font-bold text-slate-800 mb-3">Módulos principales</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {MODULOS.map((m) => (
          <button key={m.key} onClick={() => onIrA(m.key)} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 text-left hover:border-violet-300 transition-colors">
            <div className="text-2xl mb-1">{m.icono}</div>
            <div className="text-sm font-bold text-slate-800">{m.label}</div>
            <div className="text-[11px] text-slate-400">{m.sub}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
