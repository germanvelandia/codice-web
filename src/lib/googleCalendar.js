// Sincroniza CÓDICE → Google Calendar (en un calendario propio llamado "CÓDICE").
// Todo ocurre en el navegador del docente con su permiso de Google; no hay servidor.
import { supabase } from "./supabaseClient";

const TZ = "America/Bogota";
const SCOPE = "https://www.googleapis.com/auth/calendar.app.created";
export const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export const TIPOS = [
  { key: "clases", label: "Clases del horario (semanales)", icono: "🏫" },
  { key: "bitacoras", label: "Bitácoras de clase", icono: "📔" },
  { key: "tareas", label: "Actividades y tareas (fecha de entrega)", icono: "📌" },
  { key: "planeadas", label: "Tareas de las planeaciones", icono: "🗂️" },
  { key: "evaluaciones", label: "Evaluaciones (cierre)", icono: "📝" },
  { key: "coev", label: "Auto/coevaluaciones (cierre)", icono: "🤝" },
  { key: "cronograma", label: "Cronograma institucional", icono: "📅" },
];

/* ---------- Google: permiso y llamadas ---------- */
let gisPromesa = null;
function cargarGIS() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisPromesa) gisPromesa = new Promise((ok, mal) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client"; s.async = true;
    s.onload = ok; s.onerror = () => { gisPromesa = null; mal(new Error("No se pudo cargar el acceso de Google.")); };
    document.head.appendChild(s);
  });
  return gisPromesa;
}

export async function pedirToken() {
  if (!CLIENT_ID) throw new Error("Falta VITE_GOOGLE_CLIENT_ID en Vercel.");
  await cargarGIS();
  return new Promise((ok, mal) => {
    const cliente = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID, scope: SCOPE,
      callback: (r) => (r.error ? mal(new Error(r.error_description || r.error)) : ok(r.access_token)),
      error_callback: (e) => mal(new Error(e?.type === "popup_closed" ? "Cerraste la ventana de Google." : (e?.message || "No se pudo conectar con Google."))),
    });
    cliente.requestAccessToken({ prompt: "" });
  });
}

async function g(token, ruta, metodo = "GET", cuerpo) {
  for (let intento = 0; intento < 4; intento++) {
    const r = await fetch(`https://www.googleapis.com/calendar/v3${ruta}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, ...(cuerpo ? { "Content-Type": "application/json" } : {}) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    if (r.status === 403 || r.status === 429) {
      const t = await r.clone().text();
      if (/rateLimit|quota|Rate/i.test(t)) { await new Promise((x) => setTimeout(x, 800 * (intento + 1))); continue; }
    }
    if (r.status === 204) return null;
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j?.error?.message || `Google respondió ${r.status}`); e.status = r.status; throw e; }
    return j;
  }
  throw new Error("Google está limitando las peticiones; intenta de nuevo en un minuto.");
}

async function asegurarCalendario(token) {
  const { data: cfg } = await supabase.from("gcal_config").select("*").maybeSingle();
  if (cfg?.calendar_id) {
    try { await g(token, `/calendars/${encodeURIComponent(cfg.calendar_id)}`); return cfg.calendar_id; } catch (e) { if (e.status !== 404 && e.status !== 410) throw e; }
  }
  const cal = await g(token, "/calendars", "POST", { summary: "CÓDICE", description: "Clases, tareas y evaluaciones sincronizadas desde CÓDICE", timeZone: TZ });
  const { data: u } = await supabase.auth.getUser();
  await supabase.from("gcal_config").upsert({ docente_id: u?.user?.id, calendar_id: cal.id, actualizado_en: new Date().toISOString() });
  return cal.id;
}

/* ---------- fechas ---------- */
const ymd = (d) => d.toISOString().slice(0, 10);
const sumarDias = (f, n) => { const d = new Date(`${f}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
const soloFecha = (v) => (v ? String(v).slice(0, 10) : null);
function fechaBogota(v) { // timestamptz → fecha local de Colombia
  if (!v) return null;
  const s = String(v);
  if (s.length <= 10) return s;
  return new Date(new Date(s).getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}
const hhmm = (h) => (h ? String(h).slice(0, 5) : null);
const mas = (h, min) => { const [a, b] = h.split(":").map(Number); const t = a * 60 + b + min; return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };
const DIAS = { lunes: 1, martes: 2, miercoles: 3, miércoles: 3, jueves: 4, viernes: 5, sabado: 6, sábado: 6, domingo: 0 };
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
function numDia(v) { if (typeof v === "number") return v % 7; const n = Number(v); if (!Number.isNaN(n) && String(v).trim() !== "") return n % 7; return DIAS[String(v || "").toLowerCase().trim()]; }

const todoElDia = (fecha, resumen, descripcion) => ({ summary: resumen, description: descripcion || "", start: { date: fecha }, end: { date: sumarDias(fecha, 1) }, reminders: { useDefault: true } });

/* ---------- qué eventos debería haber ---------- */
export async function construirEventos(tipos, { desde, hasta }) {
  const { data: u } = await supabase.auth.getUser();
  const yo = u?.user?.id;
  const out = []; // {clave, tipo, evento}
  const dentro = (f) => f && f >= desde && f <= hasta;
  const q = async (p) => { const { data, error } = await p; if (error) throw error; return data || []; };
  const mat = (m) => m?.materias?.nombre || "";

  if (tipos.includes("clases")) {
    const filas = await q(supabase.from("horario").select("*, materias(nombre)").eq("docente_id", yo));
    for (const h of filas) {
      const dow = numDia(h.dia_semana); const ini = hhmm(h.hora_inicio);
      if (dow == null || Number.isNaN(dow) || !ini) continue;
      const fin = hhmm(h.hora_fin) || mas(ini, 55);
      const d0 = new Date(`${desde}T00:00:00Z`); const falta = (dow - d0.getUTCDay() + 7) % 7;
      const primera = sumarDias(desde, falta);
      if (primera > hasta) continue;
      out.push({ clave: `h:${h.id}`, tipo: "clases", evento: {
        summary: `🏫 ${mat(h) || "Clase"} · ${h.grado_id}`,
        location: h.salon || h.aula || "",
        description: "Clase del horario de CÓDICE.",
        start: { dateTime: `${primera}T${ini}:00`, timeZone: TZ }, end: { dateTime: `${primera}T${fin}:00`, timeZone: TZ },
        recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[dow]};UNTIL=${hasta.replace(/-/g, "")}T235959Z`],
      } });
    }
  }
  if (tipos.includes("bitacoras")) {
    const filas = await q(supabase.from("bitacora_clases").select("*, materias(nombre)").eq("docente_id", yo).gte("fecha", desde).lte("fecha", hasta));
    for (const b of filas) {
      const tema = b.tema || b.titulo || b.actividades || "";
      out.push({ clave: `b:${b.id}`, tipo: "bitacoras", evento: todoElDia(soloFecha(b.fecha), `📔 Bitácora ${mat(b)} ${b.grado_id}${tema ? ": " + String(tema).slice(0, 80) : ""}`, [b.actividades, b.observaciones].filter(Boolean).join("\n").slice(0, 1500)) });
    }
  }
  if (tipos.includes("tareas")) {
    const filas = await q(supabase.from("tareas_calificables").select("id, titulo, grado_id, fecha_entrega, descripcion, materias(nombre)").eq("docente_id", yo).not("fecha_entrega", "is", null));
    for (const t of filas) { const f = soloFecha(t.fecha_entrega); if (dentro(f)) out.push({ clave: `t:${t.id}`, tipo: "tareas", evento: todoElDia(f, `📌 Entrega: ${t.titulo} · ${mat(t)} ${t.grado_id}`, (t.descripcion || "").replace(/<[^>]+>/g, " ").slice(0, 800)) }); }
  }
  if (tipos.includes("planeadas")) {
    const pl = await q(supabase.from("planeaciones").select("id, titulo, grado_id").eq("docente_id", yo));
    const ids = pl.map((p) => p.id);
    if (ids.length) {
      const por = Object.fromEntries(pl.map((p) => [p.id, p]));
      const filas = await q(supabase.from("planeacion_tareas").select("*").in("planeacion_id", ids).not("fecha_entrega", "is", null));
      for (const t of filas) { const f = soloFecha(t.fecha_entrega); if (dentro(f)) out.push({ clave: `p:${t.id}`, tipo: "planeadas", evento: todoElDia(f, `🗂️ ${t.titulo || "Tarea"} · ${por[t.planeacion_id]?.grado_id || ""}`.trim(), por[t.planeacion_id]?.titulo || "") }); }
    }
  }
  if (tipos.includes("evaluaciones")) {
    const filas = await q(supabase.from("evaluaciones").select("id, titulo, grado_id, fecha_apertura, fecha_cierre, hora_cierre, materias(nombre)").eq("docente_id", yo));
    for (const e of filas) {
      const f = soloFecha(e.fecha_cierre);
      if (dentro(f)) out.push({ clave: `e:${e.id}`, tipo: "evaluaciones", evento: todoElDia(f, `📝 Cierra: ${e.titulo} · ${mat(e)} ${e.grado_id}`, e.hora_cierre ? `Hora de cierre: ${hhmm(e.hora_cierre)}` : "") });
    }
  }
  if (tipos.includes("coev")) {
    const filas = await q(supabase.from("coev_evaluaciones").select("id, titulo, grado_id, cierra").eq("docente_id", yo).not("cierra", "is", null));
    for (const e of filas) { const f = fechaBogota(e.cierra); if (dentro(f)) out.push({ clave: `c:${e.id}`, tipo: "coev", evento: todoElDia(f, `🤝 Cierra: ${e.titulo} · ${e.grado_id}`, "") }); }
  }
  if (tipos.includes("cronograma")) {
    const filas = await q(supabase.from("cronograma").select("*").eq("docente_id", yo));
    for (const c of filas) { const f = soloFecha(c.fecha); if (dentro(f)) out.push({ clave: `k:${c.id}`, tipo: "cronograma", evento: todoElDia(f, `📅 ${c.titulo || c.nombre || c.actividad || c.descripcion || "Evento"}`, c.descripcion || "") }); }
  }
  return out;
}

const huella = (o) => { const s = JSON.stringify(o); let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h); };

/* ---------- sincronizar ---------- */
export async function sincronizar(token, tipos, rango, avisar = () => {}) {
  const calId = await asegurarCalendario(token);
  const cal = encodeURIComponent(calId);
  avisar("Leyendo CÓDICE…");
  const deseados = await construirEventos(tipos, rango);
  const { data: u } = await supabase.auth.getUser();
  const yo = u?.user?.id;
  const { data: previos } = await supabase.from("gcal_eventos").select("*").eq("docente_id", yo);
  const mapa = Object.fromEntries((previos || []).map((p) => [p.clave, p]));
  const prefijos = new Set(tipos.map((t) => ({ clases: "h", bitacoras: "b", tareas: "t", planeadas: "p", evaluaciones: "e", coev: "c", cronograma: "k" }[t])));
  const res = { creados: 0, actualizados: 0, sinCambio: 0, borrados: 0, errores: [] };
  const vistos = new Set();
  let i = 0;
  for (const d of deseados) {
    vistos.add(d.clave); i++;
    if (i % 5 === 0) avisar(`Enviando a Google… ${i}/${deseados.length}`);
    const h = huella(d.evento); const prev = mapa[d.clave];
    try {
      if (prev && prev.huella === h) { res.sinCambio++; continue; }
      if (prev) {
        try { await g(token, `/calendars/${cal}/events/${prev.google_id}`, "PUT", d.evento); res.actualizados++; }
        catch (e) { if (e.status === 404 || e.status === 410) { const n = await g(token, `/calendars/${cal}/events`, "POST", d.evento); prev.google_id = n.id; res.creados++; } else throw e; }
        await supabase.from("gcal_eventos").upsert({ docente_id: yo, clave: d.clave, google_id: prev.google_id, huella: h, actualizado_en: new Date().toISOString() });
      } else {
        const n = await g(token, `/calendars/${cal}/events`, "POST", d.evento); res.creados++;
        await supabase.from("gcal_eventos").upsert({ docente_id: yo, clave: d.clave, google_id: n.id, huella: h, actualizado_en: new Date().toISOString() });
      }
    } catch (e) { res.errores.push(`${d.evento.summary}: ${e.message}`); }
  }
  for (const p of previos || []) { // lo que ya no existe en CÓDICE (o salió del rango) se quita de Google
    if (vistos.has(p.clave) || !prefijos.has(p.clave.split(":")[0])) continue;
    try { await g(token, `/calendars/${cal}/events/${p.google_id}`, "DELETE"); } catch (e) { if (e.status !== 404 && e.status !== 410) { res.errores.push(`Borrar: ${e.message}`); continue; } }
    await supabase.from("gcal_eventos").delete().eq("docente_id", yo).eq("clave", p.clave); res.borrados++;
  }
  return res;
}

export async function resumenPrevio(tipos, rango) {
  const ev = await construirEventos(tipos, rango);
  const por = {}; ev.forEach((e) => { por[e.tipo] = (por[e.tipo] || 0) + 1; });
  return { total: ev.length, por };
}

/* ---------- Archivo .ics (sin configurar nada en Google) ---------- */
const esc = (t) => String(t || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const plegar = (l) => { const o = []; let r = l; while (r.length > 70) { o.push(r.slice(0, 70)); r = " " + r.slice(70); } o.push(r); return o.join("\r\n"); };
const cmp = (f) => f.replace(/-/g, "");
const cmpDT = (dt) => dt.replace(/[-:]/g, "");

export async function generarICS(tipos, rango) {
  const ev = await construirEventos(tipos, rango);
  const ahora = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CODICE//Calendario//ES", "CALSCALE:GREGORIAN", "X-WR-CALNAME:CÓDICE", "X-WR-TIMEZONE:America/Bogota"];
  for (const { clave, evento: e } of ev) {
    L.push("BEGIN:VEVENT", `UID:${clave.replace(":", "-")}@codice`, `DTSTAMP:${ahora}`);
    if (e.start.date) { L.push(`DTSTART;VALUE=DATE:${cmp(e.start.date)}`, `DTEND;VALUE=DATE:${cmp(e.end.date)}`); }
    else { L.push(`DTSTART;TZID=${TZ}:${cmpDT(e.start.dateTime)}`, `DTEND;TZID=${TZ}:${cmpDT(e.end.dateTime)}`); }
    if (e.recurrence) e.recurrence.forEach((r) => L.push(r));
    L.push(`SUMMARY:${esc(e.summary)}`);
    if (e.description) L.push(`DESCRIPTION:${esc(e.description)}`);
    if (e.location) L.push(`LOCATION:${esc(e.location)}`);
    L.push("END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return { texto: L.map(plegar).join("\r\n"), total: ev.length };
}
