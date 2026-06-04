// ============================================================
//  AUDIOMANAGER — TECHNO REACTIVO (build-up 1 min + DROP brutal)
//  👤 DUEÑO: Persona 2 (Audio)
//
//  Estrategia: techno 100% sintetizado (Web Audio API).
//  Capas en orden de entrada (cuando intensity sube):
//    1. kick    — four-on-the-floor, siempre presente
//    2. hihat   — closed en cada semicorchea, open en off-beats
//    3. snare   — beats 2 y 4 (entra a mitad del build)
//    4. acid    — bass acid TB-303 style con filtro que abre
//    5. riser   — white noise que crece los últimos 8s del build
//    6. lead    — supersaw + sub-bass MASIVO en el DROP
//
//  La curva de intensity (calculada por el Motor) define el mix.
//  En PHASE.DROP el master sube 1.5x y entra el lead.
// ============================================================

import { EventBus, EVENTS } from '../core/EventBus.js';
import { GameState } from '../core/GameState.js';
import { CONFIG, PHASE } from '../core/config.js';

// Notas (Hz) del patrón de bass: A minor pentatónica, octava grave.
// A1, A1, G1, A1, E2, E2, F2, G1 — típico walking bass de techno minimal.
const BASS_PATTERN = [55.00, 55.00, 49.00, 55.00, 82.41, 82.41, 87.31, 49.00];
const LEAD_PATTERN = [220.00, 220.00, 196.00, 220.00, 329.63, 293.66, 261.63, 196.00];

let _instance = null;

export class AudioManager {
  static preload(scene) {
    // Sin archivos: todo es Web Audio API.
  }

  constructor(scene) {
    if (_instance) {
      _instance.scene = scene;
      return _instance;
    }
    _instance = this;

    this.scene = scene;
    this.ctx = scene.sound.context;
    this.ready = false;

    if (!this.ctx) {
      console.warn('[AudioManager] AudioContext no disponible.');
      return;
    }

    this._unlockOnGesture();
    this._buildGraph();
    this._buildSubBass();
    this._buildRiser();

    // Secuenciador: 16 semicorcheas por compás (4 negras).
    this._stepIdx = 0;
    this._stepTimer = 0;
    this._lastTickAt = this.ctx.currentTime;

    this.ready = true;

    EventBus.on(EVENTS.TICK, this.onTick, this);
    EventBus.on(EVENTS.COLLISION, this.onCollision, this);
    EventBus.on(EVENTS.ORB, this.onOrb, this);
    EventBus.on(EVENTS.PHASE_CHANGE, this.onPhaseChange, this);
    EventBus.on(EVENTS.GAME_WIN, this.onGameWin, this);
    EventBus.on(EVENTS.GAME_OVER, this.onGameOver, this);
    EventBus.on(EVENTS.RESET, this.onReset, this);
  }

  // --------------------------------------------------------------
  // SETUP
  // --------------------------------------------------------------

  _unlockOnGesture() {
    const resume = () => {
      if (this._userPaused) return; // no re-activar si el jugador puso pausa
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if (this.ctx.state === 'running') {
        window.removeEventListener('click', resume);
        window.removeEventListener('keydown', resume);
        window.removeEventListener('touchstart', resume);
      }
    };
    window.addEventListener('click', resume);
    window.addEventListener('keydown', resume);
    window.addEventListener('touchstart', resume);
    resume();
  }

  // Pausa/reanuda TODO el audio (lo usa GameScene con el menu de pausa).
  pause() { this._userPaused = true; if (this.ctx && this.ctx.suspend) this.ctx.suspend(); }
  resume() { this._userPaused = false; if (this.ctx && this.ctx.resume) this.ctx.resume(); }

  // Grafo: cada bus tiene su propio gain conectado al master.
  // Compresor antes del destination para que el drop "pegue" sin saturar.
  _buildGraph() {
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85; // techno suena más alto

    // Compresor estilo "glue": mantiene el punch del kick sin clipear.
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18;
    this.comp.knee.value = 12;
    this.comp.ratio.value = 6;
    this.comp.attack.value = 0.003;
    this.comp.release.value = 0.18;

    this.master.connect(this.comp);
    this.comp.connect(this.ctx.destination);

    // Buses por capa.
    this.kickBus = this._bus(0.0);
    this.hatBus = this._bus(0.0);
    this.snareBus = this._bus(0.0);
    this.acidBus = this._bus(0.0);
    this.leadBus = this._bus(0.0);
  }

  _bus(initialGain) {
    const g = this.ctx.createGain();
    g.gain.value = initialGain;
    g.connect(this.master);
    return g;
  }

  // Sub-bass: oscilador continuo de 55Hz con su propio gain (entra en DROP).
  // No es percutivo: es el "peso" que sostiene el drop.
  _buildSubBass() {
    this.subGain = this.ctx.createGain();
    this.subGain.gain.value = 0;
    this.subGain.connect(this.master);

    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 55; // A1
    sub.connect(this.subGain);
    sub.start();
    this.subOsc = sub;
  }

  // Riser: white noise filtrado por highpass que sube de frecuencia.
  // Activo solo en los últimos 8s del build-up.
  _buildRiser() {
    this.riserGain = this.ctx.createGain();
    this.riserGain.gain.value = 0;
    this.riserGain.connect(this.master);

    // Buffer largo de ruido en loop.
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;

    this.riserFilter = this.ctx.createBiquadFilter();
    this.riserFilter.type = 'highpass';
    this.riserFilter.frequency.value = 400;
    this.riserFilter.Q.value = 2;

    noise.connect(this.riserFilter);
    this.riserFilter.connect(this.riserGain);
    noise.start();
    this.riserSrc = noise;
  }

  // --------------------------------------------------------------
  // TICK PRINCIPAL — mezcla y secuenciador
  // --------------------------------------------------------------

  onTick(state) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const isDrop = state.phase === PHASE.DROP;

    // ---------- MIX DE CAPAS (suaves transiciones) ----------

    // Kick: presente desde el inicio, MUCHO más fuerte en drop.
    const kickVol = isDrop ? 1.35 : 0.6 + state.intensity * 0.35;
    this.kickBus.gain.setTargetAtTime(kickVol, now, 0.08);

    // Hi-hats: entran cuando intensity > 0.12.
    const hatVol = state.intensity > 0.06
      ? Math.min(0.5, (state.intensity - 0.06) * 1.1)
      : 0;
    this.hatBus.gain.setTargetAtTime(hatVol, now, 0.1);

    // Snare/clap: entra a mitad del build (intensity > 0.32).
    const snareVol = state.intensity > 0.2
      ? Math.min(0.6, (state.intensity - 0.2) * 1.9)
      : 0;
    this.snareBus.gain.setTargetAtTime(snareVol, now, 0.1);

    // Acid bass: entra después (intensity > 0.42), domina en drop.
    const acidVol = isDrop
      ? 0.95
      : state.intensity > 0.28
        ? Math.min(0.6, (state.intensity - 0.28) * 1.9)
        : 0;
    this.acidBus.gain.setTargetAtTime(acidVol, now, 0.1);

    // Lead supersaw: SOLO en el drop, a tope.
    const leadVol = isDrop ? 0.9 : 0;
    this.leadBus.gain.setTargetAtTime(leadVol, now, 0.15);

    // Sub-bass: MASIVO en drop, nada antes (excepto un fizz al final del build).
    const subVol = isDrop ? 0.95 : (state.progress > 0.4 ? 0.12 : 0);
    this.subGain.gain.setTargetAtTime(subVol, now, 0.15);

    // ---------- RISER (últimos 8s del build-up) ----------
    const elapsed = state.elapsed;
    const riserStart = CONFIG.buildEnd - 14;  // riser largo = mas tension
    const riserEnd = CONFIG.buildEnd;          // 60s
    if (!isDrop && elapsed > riserStart) {
      const p = Math.min(1, (elapsed - riserStart) / (riserEnd - riserStart));
      // Volumen sube exponencialmente
      this.riserGain.gain.setTargetAtTime(p * p * 0.75, now, 0.05);
      // Highpass sube de 400Hz → 6000Hz (sensación de "tensión que sube")
      this.riserFilter.frequency.setTargetAtTime(400 + p * 5600, now, 0.05);
    } else {
      this.riserGain.gain.setTargetAtTime(0, now, 0.1);
    }

    // ---------- DISTORSIÓN POR GLITCH ----------
    const glitchAttn = 1 - state.glitch * 0.4;
    const masterTarget = (isDrop ? 1.55 : 1.1) * glitchAttn;
    this.master.gain.setTargetAtTime(masterTarget, now, 0.04);

    // ---------- SECUENCIADOR ----------
    const dt = now - this._lastTickAt;
    this._lastTickAt = now;
    const stepDuration = 60 / state.bpm / 4; // semicorchea según BPM

    this._stepTimer += dt;
    while (this._stepTimer >= stepDuration) {
      this._stepTimer -= stepDuration;
      this._fireStep(now + 0.02);
      this._stepIdx = (this._stepIdx + 1) % 16;
    }
  }

  // Dispara los elementos rítmicos del step actual.
  // 16 steps = 1 compás (4 negras × 4 semicorcheas).
  _fireStep(time) {
    const s = this._stepIdx;
    const isDrop = GameState.phase === PHASE.DROP;
    const beat = s % 4 === 0; // negras (0, 4, 8, 12)
    const offBeat = s % 4 === 2; // off-beats fuertes (2, 6, 10, 14)

    // KICK en cada negra (four-on-the-floor). Es el corazón del techno.
    if (beat) this._playKick(time);
    // HARDTECHNO: en el DROP, kick rodante en off-beats (mas duro).
    if (isDrop && offBeat) this._playKick(time);
    // En el pico del DROP, rolls de kick a 1/16 = estallido relentless.
    if (isDrop && GameState.intensity > 0.8 && s % 2 === 1) this._playKick(time);

    // HI-HAT CLOSED en cada step impar (semicorcheas).
    if (s % 2 === 1) this._playHat(time, false);
    // HI-HAT OPEN en off-beats fuertes (golpe abierto).
    if (offBeat) this._playHat(time, true);

    // SNARE/CLAP en beats 2 y 4 (steps 4 y 12).
    if (s === 4 || s === 12) this._playSnare(time);

    // ACID BASS en cada negra, patrón cíclico.
    if (beat) {
      const noteIdx = (s / 4) % BASS_PATTERN.length;
      const freq = BASS_PATTERN[noteIdx];
      this._playAcid(time, freq);
    }
    // Variación: nota extra en step 6 y 14 cuando ya hay energía
    if ((s === 6 || s === 14) && GameState.intensity > 0.5) {
      const freq = BASS_PATTERN[(s / 2) % BASS_PATTERN.length] * 2; // octava arriba
      this._playAcid(time, freq, 0.08);
    }

    // LEAD solo en DROP, cada negra (notas largas)
    if (isDrop && beat) {
      const noteIdx = (s / 4) % LEAD_PATTERN.length;
      const freq = LEAD_PATTERN[noteIdx];
      this._playLead(time, freq);
    }
    // SINTETIZADORES extra en el DROP: arpegio supersaw 1 octava arriba.
    if (isDrop && offBeat) {
      const f = LEAD_PATTERN[(s / 2) % LEAD_PATTERN.length] * 2;
      this._playLead(time, f);
    }
  }

  // --------------------------------------------------------------
  // SÍNTESIS DE INSTRUMENTOS
  // --------------------------------------------------------------

  // KICK 909 style: sine con pitch sweep brutal + click de ataque.
  _playKick(time) {
    // Cuerpo: sine con pitch que cae rápido.
    const body = this.ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(180, time);
    body.frequency.exponentialRampToValueAtTime(45, time + 0.08);

    const bodyEnv = this.ctx.createGain();
    bodyEnv.gain.setValueAtTime(0.0001, time);
    bodyEnv.gain.linearRampToValueAtTime(1.0, time + 0.002);
    bodyEnv.gain.exponentialRampToValueAtTime(0.0001, time + 0.32);

    body.connect(bodyEnv);
    bodyEnv.connect(this.kickBus);
    body.start(time);
    body.stop(time + 0.35);

    // Click del ataque: ruido cortísimo filtrado.
    const clickLen = Math.floor(this.ctx.sampleRate * 0.005);
    const clickBuf = this.ctx.createBuffer(1, clickLen, this.ctx.sampleRate);
    const clickData = clickBuf.getChannelData(0);
    for (let i = 0; i < clickLen; i++) clickData[i] = Math.random() * 2 - 1;
    const click = this.ctx.createBufferSource();
    click.buffer = clickBuf;
    const clickEnv = this.ctx.createGain();
    clickEnv.gain.value = 0.4;
    click.connect(clickEnv);
    clickEnv.connect(this.kickBus);
    click.start(time);
  }

  // HI-HAT: ruido blanco con highpass. Open = decay largo, closed = corto.
  _playHat(time, open) {
    const len = Math.floor(this.ctx.sampleRate * 0.12);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;

    const decay = open ? 0.12 : 0.04;
    const peak = open ? 0.35 : 0.25;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(peak, time);
    env.gain.exponentialRampToValueAtTime(0.0001, time + decay);

    src.connect(filter);
    filter.connect(env);
    env.connect(this.hatBus);
    src.start(time);
    src.stop(time + decay + 0.02);
  }

  // SNARE/CLAP: ruido bandpass + tono corto (típico techno snap).
  _playSnare(time) {
    // Cuerpo tonal
    const tone = this.ctx.createOscillator();
    tone.type = 'triangle';
    tone.frequency.setValueAtTime(220, time);
    tone.frequency.exponentialRampToValueAtTime(120, time + 0.05);
    const toneEnv = this.ctx.createGain();
    toneEnv.gain.setValueAtTime(0.4, time);
    toneEnv.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
    tone.connect(toneEnv);
    toneEnv.connect(this.snareBus);
    tone.start(time);
    tone.stop(time + 0.1);

    // Cuerpo ruidoso (snap)
    const len = Math.floor(this.ctx.sampleRate * 0.18);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    filter.Q.value = 1;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.7, time);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);

    noise.connect(filter);
    filter.connect(env);
    env.connect(this.snareBus);
    noise.start(time);
    noise.stop(time + 0.2);
  }

  // ACID BASS: saw con filtro lowpass resonante que abre con intensity.
  _playAcid(time, freq, duration = 0.18) {
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 12; // resonance alta = "acid"
    // Cutoff: más abierto cuanto más intenso. En drop, casi full open.
    const isDrop = GameState.phase === PHASE.DROP;
    const baseCutoff = isDrop ? 1800 : 400 + GameState.intensity * 1400;
    filter.frequency.setValueAtTime(baseCutoff * 2.5, time);
    filter.frequency.exponentialRampToValueAtTime(baseCutoff, time + duration);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(0.6, time + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(filter);
    filter.connect(env);
    env.connect(this.acidBus);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  // LEAD: supersaw (3 osciladores detuned) con filtro abierto. Solo en DROP.
  _playLead(time, freq) {
    const duration = 0.55;
    const detunes = [-12, 0, 12]; // cents

    const sumGain = this.ctx.createGain();
    sumGain.gain.value = 0.33; // para evitar clipping al sumar 3 osc

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, time);
    filter.frequency.exponentialRampToValueAtTime(3500, time + 0.05);
    filter.frequency.exponentialRampToValueAtTime(1200, time + duration);
    filter.Q.value = 4;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(0.7, time + 0.02);
    env.gain.setValueAtTime(0.55, time + duration * 0.5);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    detunes.forEach((d) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = d;
      osc.connect(sumGain);
      osc.start(time);
      osc.stop(time + duration + 0.05);
    });

    sumGain.connect(filter);
    filter.connect(env);
    env.connect(this.leadBus);
  }

  // --------------------------------------------------------------
  // EVENTOS DEL MOTOR (efectos puntuales)
  // --------------------------------------------------------------

  onCollision() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;

    // Crash de ruido grave con sweep descendente.
    const len = Math.floor(this.ctx.sampleRate * 0.22);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2800, t);
    filter.frequency.exponentialRampToValueAtTime(80, t + 0.22);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.7, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);

    noise.connect(filter);
    filter.connect(env);
    env.connect(this.master);
    noise.start(t);
    noise.stop(t + 0.25);
  }

  onOrb() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    [{ f: 880, g: 0.35 }, { f: 1760, g: 0.18 }, { f: 2640, g: 0.09 }].forEach(({ f, g }) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(g, t + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.connect(env);
      env.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  }

  // EL WOW del DROP: sweep + impacto sub MASIVO + silencio breve previo.
  onPhaseChange({ to }) {
    if (!this.ready) return;
    if (to !== PHASE.DROP) return;

    const t = this.ctx.currentTime;

    // 1. Crash blanco que "explota" en el momento del drop.
    const crashLen = Math.floor(this.ctx.sampleRate * 1.2);
    const crashBuf = this.ctx.createBuffer(1, crashLen, this.ctx.sampleRate);
    const cd = crashBuf.getChannelData(0);
    for (let i = 0; i < crashLen; i++) cd[i] = Math.random() * 2 - 1;
    const crash = this.ctx.createBufferSource();
    crash.buffer = crashBuf;
    const crashFilter = this.ctx.createBiquadFilter();
    crashFilter.type = 'highpass';
    crashFilter.frequency.value = 5000;
    const crashEnv = this.ctx.createGain();
    crashEnv.gain.setValueAtTime(1.0, t);
    crashEnv.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    crash.connect(crashFilter);
    crashFilter.connect(crashEnv);
    crashEnv.connect(this.master);
    crash.start(t);
    crash.stop(t + 1.3);

    // 2. Impacto sub: 90Hz → 35Hz, MUY fuerte.
    const impact = this.ctx.createOscillator();
    impact.type = 'sine';
    impact.frequency.setValueAtTime(110, t);
    impact.frequency.exponentialRampToValueAtTime(30, t + 0.6);
    const impactEnv = this.ctx.createGain();
    impactEnv.gain.setValueAtTime(1.9, t);
    impactEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    impact.connect(impactEnv);
    impactEnv.connect(this.master);
    impact.start(t);
    impact.stop(t + 0.75);

    // 3. "Punch" de reverb-tail: capa de saw cortado.
    const punch = this.ctx.createOscillator();
    punch.type = 'sawtooth';
    punch.frequency.setValueAtTime(55, t);
    const punchFilter = this.ctx.createBiquadFilter();
    punchFilter.type = 'lowpass';
    punchFilter.frequency.value = 600;
    const punchEnv = this.ctx.createGain();
    punchEnv.gain.setValueAtTime(1.1, t);
    punchEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    punch.connect(punchFilter);
    punchFilter.connect(punchEnv);
    punchEnv.connect(this.master);
    punch.start(t);
    punch.stop(t + 0.45);
  }

  onGameWin() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    // Cierre épico: acorde mayor con kick final
    const notes = [261.63, 329.63, 392.00, 523.25];
    notes.forEach((freq, idx) => {
      const start = t + idx * 0.12;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(0.4, start + 0.04);
      env.gain.exponentialRampToValueAtTime(0.0001, start + 2.0);
      osc.connect(env);
      env.connect(this.master);
      osc.start(start);
      osc.stop(start + 2.1);
    });
    this._playKick(t);
  }

  onGameOver() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 1.4);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.55, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    osc.connect(env);
    env.connect(this.master);
    osc.start(t);
    osc.stop(t + 1.7);
    // Apaga el mix
    this.master.gain.setTargetAtTime(0.05, t, 0.5);
  }

  onReset() {
    if (!this.ready) return;
    this._stepIdx = 0;
    this._stepTimer = 0;
    this.master.gain.setTargetAtTime(0.85, this.ctx.currentTime, 0.1);
  }
}
