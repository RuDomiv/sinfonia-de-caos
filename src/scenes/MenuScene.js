// ============================================================
//  MENUSCENE — Pantalla inicial + instrucciones.
//  👤 DUEÑO: Persona 3 (Visual / UI)
// ============================================================

import Phaser from 'phaser';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const { width, height } = this.scale;

    this.add.text(width / 2, 90, 'SINFONÍA DE CAOS', {
      fontSize: '52px', color: '#00ffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(width / 2, 140, 'Tus errores componen la música. Mantén el ritmo.', {
      fontSize: '16px', color: '#aaaaff',
    }).setOrigin(0.5);

    const instrucciones = [
      'CÓMO JUGAR',
      'Flechas / WASD  →  mover la nave',
      'Esquiva los obstáculos rojos',
      'Recoge los orbes dorados (+puntos y armonía)',
      '',
      'La música crece durante 2 minutos: calma → build → DROP',
      'Cada golpe distorsiona el sonido y baja tu estabilidad',
      'Si la estabilidad llega a 0, la canción colapsa',
      '',
      'OBJETIVO: sobrevive los 2 minutos para completar la sinfonía',
    ];
    this.add.text(width / 2, 175, instrucciones.join('\n'), {
      fontSize: '15px', color: '#cfd0ff', align: 'center', lineSpacing: 6,
    }).setOrigin(0.5, 0);

    const start = this.add.text(width / 2, height - 50, '▶  Presiona ENTER para comenzar', {
      fontSize: '22px', color: '#ffee44', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.tweens.add({ targets: start, alpha: 0.2, duration: 650, yoyo: true, repeat: -1 });

    this.input.keyboard.once('keydown-ENTER', () => this.scene.start('GameScene'));
  }
}
