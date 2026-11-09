// Sonido del Mundo 3D, generado con la Web Audio API (sin archivos de audio).
// Pasos según el suelo, picar y poner bloques, viento, pájaros de día, grillos de noche, lluvia, animales y
// una música suave y espaciada. Solo empieza después de que el estudiante toca la pantalla (regla de los navegadores).

const rnd = (a, b) => a + Math.random() * (b - a);

export function crearSonido(inicial = {}) {
  let ac = null, maestro = null, bufRuido = null, nodos = [];
  let volumen = inicial.volumen != null ? inicial.volumen : .7, musica = inicial.musica !== false, silencio = !!inicial.silencio;
  let tPajaro = 3, tGrillo = 2, tNota = 8, tVaca = 0;
  let viento = null, lluviaN = null;

  const listo = () => !!ac && ac.state === "running" && !silencio;
  const vol = () => (silencio ? 0 : volumen);

  function activar() {
    if (ac) { if (ac.state === "suspended") ac.resume().catch(() => {}); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    try { ac = new C(); } catch (_) { ac = null; return; }
    maestro = ac.createGain(); maestro.gain.value = vol() * .8; maestro.connect(ac.destination);
    // ruido blanco de 2 s para el viento, la lluvia y los golpes
    bufRuido = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = bufRuido.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // viento y lluvia: dos bucles de ruido filtrado cuya fuerza se ajusta en cada cuadro
    const lazo = (tipo, f, q) => {
      const s = ac.createBufferSource(); s.buffer = bufRuido; s.loop = true;
      const fl = ac.createBiquadFilter(); fl.type = tipo; fl.frequency.value = f; fl.Q.value = q;
      const g = ac.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(maestro); s.start();
      nodos.push(s); return { g, fl };
    };
    viento = lazo("lowpass", 380, .6); lluviaN = lazo("bandpass", 3200, .5);
  }

  // Golpe de ruido filtrado con envolvente rápida
  function ruido(dur, { tipo = "lowpass", f = 800, q = .7, g = .15, ataque = .004, f2 = null, destino = null } = {}) {
    if (!listo()) return;
    const t = ac.currentTime, s = ac.createBufferSource(); s.buffer = bufRuido; s.loop = true;
    const fl = ac.createBiquadFilter(); fl.type = tipo; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(40, f2), t + dur); fl.Q.value = q;
    const e = ac.createGain(); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + ataque); e.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(fl); fl.connect(e); e.connect(destino || maestro); s.start(t, Math.random() * 1.5); s.stop(t + dur + .05);
  }
  // Tono con barrido de frecuencia
  function tono(f1, f2, dur, { tipo = "sine", g = .12, ataque = .01, vib = 0, destino = null, t0 = 0 } = {}) {
    if (!listo()) return;
    const t = ac.currentTime + t0, o = ac.createOscillator(); o.type = tipo; o.frequency.setValueAtTime(f1, t); if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + dur);
    const e = ac.createGain(); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + ataque); e.gain.exponentialRampToValueAtTime(.0001, t + dur);
    if (vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 6; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + .05); }
    o.connect(e); e.connect(destino || maestro); o.start(t); o.stop(t + dur + .05);
  }

  // --- efectos ---
  const SUELOS = { // id de bloque → cómo suena al pisarlo
    1: ["lowpass", 700, .1], 2: ["lowpass", 520, .11], 3: ["bandpass", 1900, .09], 4: ["bandpass", 650, .1], 5: ["lowpass", 1200, .06],
    6: ["bandpass", 700, .11], 7: ["bandpass", 2100, .09], 8: ["highpass", 2600, .06], 9: ["highpass", 2800, .05], 10: ["bandpass", 1800, .09], 13: ["bandpass", 1700, .1],
  };
  const paso = (bloque, corriendo) => {
    if (bloque === 11) return ruido(.22, { tipo: "bandpass", f: 900, g: .1, ataque: .02 });
    const [tipo, f, g] = SUELOS[bloque] || SUELOS[1]; ruido(.09, { tipo, f: f * rnd(.85, 1.15), g: g * (corriendo ? 1.2 : 1), q: 1.2 });
  };
  const picar = (bloque) => { const [tipo, f] = SUELOS[bloque] || SUELOS[3]; ruido(.07, { tipo, f: f * rnd(.9, 1.1), g: .09, q: 2 }); };
  const romper = (bloque) => { const [tipo, f] = SUELOS[bloque] || SUELOS[3]; ruido(.2, { tipo, f: f * 1.2, f2: f * .5, g: .2, q: 1.5 }); tono(160, 70, .14, { tipo: "triangle", g: .1 }); };
  const poner = (bloque) => { const [tipo, f] = SUELOS[bloque] || SUELOS[3]; tono(130, 85, .12, { tipo: "triangle", g: .14 }); ruido(.06, { tipo, f, g: .07 }); };
  const agua = () => ruido(.35, { tipo: "bandpass", f: 700, f2: 1600, g: .16, ataque: .03 });
  const salto = () => ruido(.08, { tipo: "lowpass", f: 500, g: .05 });
  const portal = () => { tono(220, 660, .9, { tipo: "sine", g: .1, vib: 8 }); tono(330, 990, .9, { tipo: "triangle", g: .05 }); ruido(.9, { tipo: "bandpass", f: 500, f2: 3000, g: .08, ataque: .2 }); };
  const abrirPuerta = () => { tono(110, 190, .55, { tipo: "sawtooth", g: .05, vib: 6 }); ruido(.5, { tipo: "bandpass", f: 400, f2: 900, g: .06 }); tono(520, 780, .25, { tipo: "sine", g: .06, t0: .45 }); };
  const puertaCerrada = () => { tono(95, 80, .22, { tipo: "square", g: .06 }); tono(80, 70, .22, { tipo: "square", g: .06, t0: .26 }); };
  const recoger = () => { tono(880, 1320, .09, { tipo: "sine", g: .08 }); tono(1320, 1760, .08, { tipo: "sine", g: .05, t0: .05 }); };
  const dano = () => { tono(220, 90, .22, { tipo: "sawtooth", g: .12 }); ruido(.12, { tipo: "lowpass", f: 700, g: .12 }); };
  const pegar = () => { ruido(.08, { tipo: "bandpass", f: 1400, g: .12, q: 2 }); tono(300, 160, .08, { tipo: "square", g: .05 }); };
  const monstruo = (t) => { if (t === "limo") tono(140, 260, .18, { tipo: "sine", g: .07, vib: 12 }); else if (t === "sombra") tono(330, 210, .35, { tipo: "sine", g: .05, vib: 9 }); else tono(180, 120, .2, { tipo: "square", g: .04 }); };
  const vencido = () => { tono(500, 180, .25, { tipo: "triangle", g: .09 }); ruido(.18, { tipo: "bandpass", f: 900, g: .08 }); };
  const desmayo = () => { tono(400, 70, .9, { tipo: "sine", g: .12 }); };
  const clic = () => ruido(.04, { tipo: "bandpass", f: 2400, g: .06, q: 3 });
  const logro = () => [523, 659, 784, 1047].forEach((f, i) => tono(f, f, .5, { tipo: "triangle", g: .09, t0: i * .11 }));
  const trueno = () => { ruido(2.4, { tipo: "lowpass", f: 240, g: .3, ataque: .06 }); tono(62, 34, 1.8, { tipo: "sawtooth", g: .07, ataque: .05 }); };
  const animal = (tipo) => {
    if (tipo === "vaca") { tono(150, 105, .85, { tipo: "sawtooth", g: .09, vib: 5, ataque: .08 }); ruido(.8, { tipo: "lowpass", f: 400, g: .04 }); }
    else if (tipo === "oveja") { tono(420, 360, .6, { tipo: "sawtooth", g: .06, vib: 28, ataque: .05 }); tono(430, 380, .5, { tipo: "triangle", g: .04, vib: 24, t0: .02 }); }
    else if (tipo === "cerdo") { for (let i = 0; i < 2; i++) { ruido(.14, { tipo: "bandpass", f: 330, g: .13, q: 3, ataque: .02, f2: 250 }); tono(240, 190, .13, { tipo: "square", g: .03, t0: i * .2 }); } }
    else if (tipo === "conejo") { for (let i = 0; i < 2; i++) tono(rnd(1500, 1900), rnd(1900, 2400), .05, { tipo: "triangle", g: .04, t0: i * .08 }); }
    else if (tipo === "gallina") { for (let i = 0; i < 4; i++) tono(rnd(900, 1300), rnd(1100, 1700), .08, { tipo: "triangle", g: .06, t0: i * .11 }); }
  };

  // --- ambiente (se llama en cada cuadro) ---
  const NOTAS = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3]; // pentatónica de do, suave
  function pajaro() { const f = rnd(2400, 3800), n = (Math.random() * 3 | 0) + 2; for (let i = 0; i < n; i++) tono(f * rnd(.95, 1.1), f * rnd(1.15, 1.4), .09, { g: .035, t0: i * .13 }); }
  function grillo() { const f = 4300; for (let i = 0; i < 5; i++) tono(f, f, .05, { tipo: "square", g: .008, t0: i * .08 }); }
  function nota() { // un motivo breve, tocado como una campanita de piano
    const n = 2 + (Math.random() * 3 | 0); let k = (Math.random() * NOTAS.length) | 0;
    for (let i = 0; i < n; i++) { k = Math.max(0, Math.min(NOTAS.length - 1, k + ((Math.random() * 3 | 0) - 1))); const f = NOTAS[k]; tono(f, f, 2.4, { tipo: "sine", g: .05, ataque: .02, t0: i * rnd(.55, .9) }); tono(f * 2, f * 2, 1.2, { tipo: "triangle", g: .012, t0: i * .7 }); }
  }
  function actualizar(dt, e) { // e: { dia, noche, lluvia, bajoTecho, enAgua, altura, cerca }
    if (!ac) return;
    if (maestro) maestro.gain.setTargetAtTime(vol() * .8, ac.currentTime, .1);
    if (!listo()) return;
    const techo = e.bajoTecho ? .35 : 1;
    viento.g.gain.setTargetAtTime((.035 + Math.min(.06, Math.max(0, (e.altura - 14) * .004)) + e.lluvia * .03) * techo, ac.currentTime, .6);
    lluviaN.g.gain.setTargetAtTime(e.lluvia * .09 * techo, ac.currentTime, .8);
    if (e.enAgua) viento.fl.frequency.setTargetAtTime(180, ac.currentTime, .1); else viento.fl.frequency.setTargetAtTime(380, ac.currentTime, .3);
    tPajaro -= dt; if (tPajaro <= 0) { tPajaro = rnd(3, 9); if (e.dia > .5 && e.lluvia < .3 && !e.bajoTecho) pajaro(); }
    tGrillo -= dt; if (tGrillo <= 0) { tGrillo = rnd(1.2, 3.5); if (e.noche > .6 && e.lluvia < .3 && !e.bajoTecho) grillo(); }
    if (musica) { tNota -= dt; if (tNota <= 0) { tNota = rnd(14, 30); if (e.lluvia < .6) nota(); } }
  }

  return {
    activar, actualizar, paso, picar, romper, poner, agua, salto, portal, abrirPuerta, puertaCerrada, clic, recoger, logro, animal, trueno, dano, pegar, monstruo, vencido, desmayo,
    ajustar: (o) => { if (o.volumen != null) volumen = Math.max(0, Math.min(1, o.volumen)); if (o.musica != null) musica = !!o.musica; if (o.silencio != null) silencio = !!o.silencio; },
    estado: () => ({ volumen, musica, silencio, activo: !!ac }),
    cerrar: () => { try { nodos.forEach((n) => n.stop()); } catch (_) {} if (ac) ac.close().catch(() => {}); ac = null; },
  };
}
