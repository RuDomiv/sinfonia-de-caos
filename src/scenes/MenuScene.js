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
    const FONT = '"Courier New", monospace';

    // Fondo espacial 8-bit con estrellas-pixel.
    this.add.rectangle(0, 0, width, height, 0x05010f).setOrigin(0, 0);
    for (let k = 0; k < 90; k++) {
      const sz = Phaser.Math.Between(2, 4);
      this.add.rectangle(
        Phaser.Math.Between(0, width), Phaser.Math.Between(0, height),
        sz, sz, Phaser.Math.RND.pick([0x33ffff, 0xff5ea8, 0xffe23a, 0xffffff]),
        Phaser.Math.FloatBetween(0.3, 0.9)
      ).setOrigin(0.5);
    }

    const title = this.add.text(width / 2, 92, 'SINFONIA DE CAOS', {
      fontFamily: FONT, fontSize: '54px', color: '#00ffff', fontStyle: 'bold',
    }).setOrigin(0.5).setStroke('#aa008a', 8).setShadow(4, 4, '#ff5ea8', 0, true, true);
    this.tweens.add({ targets: title, scale: 1.05, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.add.text(width / 2, 142, '* TUS ERRORES COMPONEN LA MUSICA *', {
      fontFamily: FONT, fontSize: '15px', color: '#ff5ea8', fontStyle: 'bold',
    }).setOrigin(0.5);

    const instrucciones = [
      '[ COMO JUGAR ]',
      'FLECHAS / WASD .... mover la nave',
      'ESQUIVA los obstaculos',
      'RECOGE los orbes dorados (+puntos)',
      '',
      'La musica crece 2 min: CALMA > BUILD > DROP',
      'Cada golpe distorsiona el sonido y baja estabilidad',
      'Si la estabilidad llega a 0, la cancion colapsa',
      '',
      'OBJETIVO: sobrevive 2 min y completa la sinfonia',
    ];
    this.add.text(width / 2, 178, instrucciones.join('\n'), {
      fontFamily: FONT, fontSize: '15px', color: '#cfd0ff', align: 'center', lineSpacing: 7,
    }).setOrigin(0.5, 0).setStroke('#000022', 4);

    const start = this.add.text(width / 2, height - 54, '> PRESIONA ENTER PARA COMENZAR <', {
      fontFamily: FONT, fontSize: '22px', color: '#ffee44', fontStyle: 'bold',
    }).setOrigin(0.5).setStroke('#5a4a00', 5);
    this.tweens.add({ targets: start, alpha: 0.15, duration: 480, yoyo: true, repeat: -1 });

    this.input.keyboard.once('keydown-ENTER', () => this.scene.start('GameScene'));
  }
}
