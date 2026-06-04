// ============================================================
//  AUDIOMANAGER — Música por capas sincronizada con la intensidad.
//  👤 DUEÑO: Persona 2 (Audio)
//
//  REGLA DE ORO: solo LEES GameState.intensity / phase / bpm.
//  No escribes en GameState ni tocas la lógica del juego.
//  Te comunicas por el EventBus (escuchando eventos del Motor).
//
//  Idea de capas (stems) que crecen con la intensidad:
//    - base:   loop suave, SIEMPRE sonando (volumen casi fijo)
//    - mid:    melodía/sintes, su volumen sube con intensity
//    - lead:   drop/lead pesado, entra fuerte en fase DROP
//  En colisión: distorsión (bajar pitch/rate) + golpe seco.
// ============================================================

import { EventBus, EVENTS } from '../core/EventBus.js';
import { GameState } from '../core/GameState.js';
import { PHASE } from '../core/config.js';

export class AudioManager {
  // Cargar audios. Pon los archivos en  public/audio/  y descomenta.
  static preload(scene) {
    // scene.load.audio('base', 'audio/base_loop.mp3');
    // scene.load.audio('mid',  'audio/mid_layer.mp3');
    // scene.load.audio('lead', 'audio/lead_drop.mp3');
    // scene.load.audio('hit',  'audio/hit_distort.mp3');
    // scene.load.audio('orb',  'audio/orb_synth.mp3');
  }

  constructor(scene) {
    this.scene = scene;
    this.ready = false;

    // TODO Persona 2: descomentar cuando tengas los audios.
    // this.base = scene.sound.add('base', { loop: true, volume: 0.5 });
    // this.mid  = scene.sound.add('mid',  { loop: true, volume: 0 });
    // this.lead = scene.sound.add('lead', { loop: true, volume: 0 });
    // this.base.play(); this.mid.play(); this.lead.play();
    // this.ready = true;

    // Suscripciones al Motor (esto ya funciona aunque no haya audio aún):
    EventBus.on(EVENTS.TICK, this.onTick, this);
    EventBus.on(EVENTS.COLLISION, this.onCollision, this);
    EventBus.on(EVENTS.ORB, this.onOrb, this);
    EventBus.on(EVENTS.PHASE_CHANGE, this.onPhaseChange, this);
  }

  // Cada frame: ajustar el mix según la intensidad (0..1).
  onTick(state) {
    if (!this.ready) return;
    // TODO Persona 2:
    // this.mid.setVolume(state.intensity * 0.7);
    // this.lead.setVolume(state.phase === PHASE.DROP ? state.intensity : 0);
    // // distorsión cuando hay glitch reciente:
    // const rate = 1 - state.glitch * 0.4;   // baja el tono al chocar
    // this.base.setRate(rate);
  }

  onCollision() {
    if (!this.ready) return;
    // TODO: this.scene.sound.play('hit', { volume: 0.9 });
  }

  onOrb() {
    if (!this.ready) return;
    // TODO: this.scene.sound.play('orb', { volume: 0.6 });
  }

  onPhaseChange({ to }) {
    // Ej: al entrar al DROP, un build-up o un impacto fuerte.
  }
}
