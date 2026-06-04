// ============================================================
//  HUD — Interfaz en pantalla durante el juego.
//  👤 DUEÑO: Persona 3 (Visual / UI)
//
//  Muestra: puntaje, barra de intensidad/bpm, estabilidad, fase.
//  Solo LEE GameState (vía el payload del evento TICK).
// ============================================================

import { EventBus, EVENTS } from '../core/EventBus.js';
import { CONFIG, PHASE } from '../core/config.js';

const PHASE_LABEL = {
  [PHASE.CALM]: 'CALMA',
  [PHASE.BUILD]: 'BUILD-UP',
  [PHASE.DROP]: '¡DROP!',
  [PHASE.COMPLETE]: 'FIN',
};

export class HUD {
  constructor(scene) {
    this.scene = scene;
    const d = 100;

    this.scoreText = scene.add.text(16, 14, 'Puntos: 0',
      { fontSize: '20px', color: '#ffffff' }).setDepth(d).setScrollFactor(0);

    this.phaseText = scene.add.text(CONFIG.width / 2, 14, 'CALMA',
      { fontSize: '20px', color: '#00ffff', fontStyle: 'bold' })
      .setOrigin(0.5, 0).setDepth(d).setScrollFactor(0);

    // Barra de INTENSIDAD (sube con el tiempo).
    scene.add.text(16, 44, 'Intensidad', { fontSize: '11px', color: '#8888aa' }).setDepth(d);
    this.intBarBg = scene.add.rectangle(16, 60, 180, 12, 0x222244).setOrigin(0, 0).setDepth(d);
    this.intBar = scene.add.rectangle(16, 60, 0, 12, 0x00ffff).setOrigin(0, 0).setDepth(d);

    // Barra de ESTABILIDAD (baja al chocar → si llega a 0, game over).
    scene.add.text(16, 80, 'Estabilidad', { fontSize: '11px', color: '#8888aa' }).setDepth(d);
    this.stabBarBg = scene.add.rectangle(16, 96, 180, 12, 0x222244).setOrigin(0, 0).setDepth(d);
    this.stabBar = scene.add.rectangle(16, 96, 180, 12, 0x44ff88).setOrigin(0, 0).setDepth(d);

    EventBus.on(EVENTS.TICK, this.onTick, this);
  }

  onTick(state) {
    this.scoreText.setText('Puntos: ' + Math.floor(state.score));
    this.phaseText.setText(PHASE_LABEL[state.phase] || '');
    this.intBar.width = 180 * state.intensity;

    const stabPct = Math.max(0, state.stability / CONFIG.stabilityMax);
    this.stabBar.width = 180 * stabPct;
    this.stabBar.setFillStyle(stabPct > 0.4 ? 0x44ff88 : 0xff4466);
  }
}
