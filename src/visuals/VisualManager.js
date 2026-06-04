// ============================================================
//  VISUALMANAGER — Estética neón sincronizada con la música.
//  👤 DUEÑO: Persona 3 (Visual / UI)
//
//  REGLA DE ORO: solo LEES GameState.intensity / phase.
//  Las visuales deben "respirar" con la intensidad (mismo valor
//  que usa el audio → quedan sincronizadas automáticamente).
//  En colisión: VIBRACIÓN de pantalla (camera shake) + flash.
// ============================================================

import { EventBus, EVENTS } from '../core/EventBus.js';
import { CONFIG, PHASE } from '../core/config.js';

export class VisualManager {
  constructor(scene) {
    this.scene = scene;

    // Fondo base (rectángulo que cambiará de color con la intensidad).
    this.bg = scene.add.rectangle(0, 0, CONFIG.width, CONFIG.height, 0x12022a)
      .setOrigin(0).setDepth(-10);

    // Capa de flash para colisiones.
    this.flash = scene.add.rectangle(0, 0, CONFIG.width, CONFIG.height, 0xff2266)
      .setOrigin(0).setDepth(50).setAlpha(0);

    // TODO Persona 3: partículas que rodean la nave, grid neón de fondo, etc.

    EventBus.on(EVENTS.TICK, this.onTick, this);
    EventBus.on(EVENTS.COLLISION, this.onCollision, this);
    EventBus.on(EVENTS.ORB, this.onOrb, this);
    EventBus.on(EVENTS.PHASE_CHANGE, this.onPhaseChange, this);
  }

  onTick(state) {
    // El fondo se calienta con la intensidad (azul oscuro → magenta).
    const r = Math.floor(0x12 + state.intensity * 0x90);
    const g = Math.floor(0x02 + state.intensity * 0x10);
    const b = Math.floor(0x2a + state.intensity * 0x40);
    this.bg.setFillStyle(Phaser.Display.Color.GetColor(r, g, b));
    // TODO: pulsar partículas / brillo de la nave al ritmo del bpm.
  }

  onCollision() {
    // VIBRACIÓN visual pedida: sacude la cámara + flash rojo.
    this.scene.cameras.main.shake(180, CONFIG.collisionShake);
    this.flash.setAlpha(0.5);
    this.scene.tweens.add({ targets: this.flash, alpha: 0, duration: 250 });
  }

  onOrb() {
    // TODO: destello suave / partículas doradas.
  }

  onPhaseChange({ to }) {
    if (to === PHASE.DROP) {
      // Momento WOW: un zoom-punch al entrar al drop.
      this.scene.cameras.main.zoomTo(1.06, 120, 'Linear', true);
      this.scene.cameras.main.flash(300, 120, 0, 200);
    }
  }
}
