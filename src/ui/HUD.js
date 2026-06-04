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

const FONT = '"Courier New", monospace';

export class HUD {
  constructor(scene) {
    this.scene = scene;
    this._beat = 0;
    this._pulse = 0;
    const d = 100;
    const W = scene.scale.width;

    // Panel superior translucido estilo arcade.
    this.panel = scene.add.rectangle(0, 0, W, 124, 0x05010f, 0.4)
      .setOrigin(0, 0).setDepth(d - 1).setScrollFactor(0);

    this.scoreText = scene.add.text(18, 16, 'SCORE 0',
      { fontFamily: FONT, fontSize: '22px', color: '#ffee44', fontStyle: 'bold' })
      .setDepth(d).setScrollFactor(0).setStroke('#5a4a00', 4);

    this.phaseText = scene.add.text(W / 2, 14, 'CALMA',
      { fontFamily: FONT, fontSize: '26px', color: '#00ffff', fontStyle: 'bold' })
      .setOrigin(0.5, 0).setDepth(d).setScrollFactor(0).setStroke('#003344', 5);

    this.bpmText = scene.add.text(W - 18, 18, 'BPM 90',
      { fontFamily: FONT, fontSize: '18px', color: '#ff5ea8', fontStyle: 'bold' })
      .setOrigin(1, 0).setDepth(d).setScrollFactor(0).setStroke('#330022', 4);

    // Barra de INTENSIDAD.
    scene.add.text(18, 58, 'INTENSITY', { fontFamily: FONT, fontSize: '11px', color: '#8aa' })
      .setDepth(d).setScrollFactor(0);
    this.intBarBg = scene.add.rectangle(18, 74, 200, 14, 0x18183a).setOrigin(0, 0)
      .setDepth(d).setScrollFactor(0).setStrokeStyle(2, 0x00ffff, 0.7);
    this.intBar = scene.add.rectangle(20, 76, 0, 10, 0x00ffff).setOrigin(0, 0)
      .setDepth(d + 1).setScrollFactor(0);

    // Barra de ESTABILIDAD.
    scene.add.text(18, 94, 'STABILITY', { fontFamily: FONT, fontSize: '11px', color: '#8aa' })
      .setDepth(d).setScrollFactor(0);
    this.stabBarBg = scene.add.rectangle(18, 110, 200, 14, 0x18183a).setOrigin(0, 0)
      .setDepth(d).setScrollFactor(0).setStrokeStyle(2, 0x44ff88, 0.7);
    this.stabBar = scene.add.rectangle(20, 112, 196, 10, 0x44ff88).setOrigin(0, 0)
      .setDepth(d + 1).setScrollFactor(0);

    EventBus.on(EVENTS.TICK, this.onTick, this);
  }

  onTick(state) {
    const dt = Math.min(this.scene.game.loop.delta, 50) / 1000;
    this._beat += dt * ((state.bpm || CONFIG.bpmBase) / 60);
    if (this._beat >= 1) { this._beat -= 1; this._pulse = 1; }
    this._pulse = Math.max(0, this._pulse - dt * 4);
    const pulse = this._pulse;

    const W = this.scene.scale.width;
    this.panel.width = W;
    this.phaseText.x = W / 2;
    this.bpmText.x = W - 18;

    this.scoreText.setText('SCORE ' + Math.floor(state.score));
    this.phaseText.setText(PHASE_LABEL[state.phase] || '');
    this.phaseText.setScale(1 + pulse * 0.14);
    this.bpmText.setText('BPM ' + Math.round(state.bpm));

    this.intBar.width = 196 * state.intensity;
    this.intBar.setFillStyle(state.phase === PHASE.DROP ? 0xff5ea8 : 0x00ffff);

    const stabPct = Math.max(0, state.stability / CONFIG.stabilityMax);
    this.stabBar.width = 196 * stabPct;
    this.stabBar.setFillStyle(stabPct > 0.4 ? 0x44ff88 : 0xff4466);
  }
}
