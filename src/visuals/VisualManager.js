// ============================================================
//  VISUALMANAGER — Estética neón sincronizada con la música.
//  👤 DUEÑO: Persona 3 (Visual / UI)   —   ⏳ AÚN SIN IMPLEMENTAR
//
//  Persona 1 dejó esto como LIENZO EN BLANCO a propósito.
//  Aquí van TODOS los efectos visuales (fondo, partículas, brillo,
//  flash y vibración en colisión, zoom-punch en el DROP, etc.).
//
//  REGLA DE ORO: solo LEES GameState (vía el payload de TICK).
//  El valor maestro es state.intensity (0..1): haz que TODO
//  "respire" con él para quedar sincronizado con el audio.
// ============================================================

import { EventBus, EVENTS } from '../core/EventBus.js';
// import { CONFIG, PHASE } from '../core/config.js';

export class VisualManager {
  constructor(scene) {
    this.scene = scene;

    // El Motor ya emite estos eventos. Implementa los handlers cuando quieras.
    EventBus.on(EVENTS.TICK, this.onTick, this);
    EventBus.on(EVENTS.COLLISION, this.onCollision, this);
    EventBus.on(EVENTS.ORB, this.onOrb, this);
    EventBus.on(EVENTS.PHASE_CHANGE, this.onPhaseChange, this);
  }

  onTick(state) {
    // TODO Persona 3: fondo/colores/partículas que crecen con state.intensity.
  }

  onCollision() {
    // TODO Persona 3: vibración (this.scene.cameras.main.shake) + flash rojo.
  }

  onOrb() {
    // TODO Persona 3: destello dorado / partículas.
  }

  onPhaseChange({ to }) {
    // TODO Persona 3: efecto WOW al entrar al DROP (zoom punch, flash, etc.).
  }
}
