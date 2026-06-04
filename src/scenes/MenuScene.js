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

    this._makeShipTex('menu_ship');
    this._makeHoleTex('menu_hole', 240);

    // Fondo espacial.
    this.add.rectangle(0, 0, width, height, 0x05010f).setOrigin(0, 0);

    // Estrellas-pixel que titilan.
    for (let k = 0; k < 120; k++) {
      const sz = Phaser.Math.Between(2, 4);
      const st = this.add.rectangle(
        Phaser.Math.Between(0, width), Phaser.Math.Between(0, height),
        sz, sz, Phaser.Math.RND.pick([0x33ffff, 0xff5ea8, 0xffe23a, 0xffffff]),
        Phaser.Math.FloatBetween(0.3, 0.9)
      ).setOrigin(0.5);
      this.tweens.add({ targets: st, alpha: 0.1, duration: Phaser.Math.Between(700, 1900),
        yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 1200) });
    }

    // Agujero negro girando detras del titulo.
    this.hole = this.add.image(width / 2, height * 0.40, 'menu_hole')
      .setAngle(-22).setAlpha(0.92).setScale(1.15).setDepth(1);
    this.tweens.add({ targets: this.hole, angle: 338, duration: 26000, repeat: -1 });
    this.tweens.add({ targets: this.hole, scale: 1.24, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Titulo.
    const title = this.add.text(width / 2, height * 0.29, 'SINFONIA DE CAOS', {
      fontFamily: FONT, fontSize: '60px', color: '#00ffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5).setStroke('#aa008a', 9).setShadow(5, 5, '#ff2bb0', 0, true, true);
    this.tweens.add({ targets: title, scale: 1.04, duration: 560, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.add.text(width / 2, height * 0.29 + 52, '* MUEVE EL MOUSE PARA PILOTAR * CLICK = IMPULSO *', {
      fontFamily: FONT, fontSize: '15px', color: '#ff5ea8', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(5);

    const instrucciones = [
      'FLECHAS / WASD .... mover la nave',
      'ESQUIVA obstaculos  |  RECOGE orbes',
      'Cuidado: los AGUJEROS NEGROS te atraen',
      'Sobrevive al DROP y completa la sinfonia',
    ];
    this.add.text(width / 2, height * 0.60, instrucciones.join('\n'), {
      fontFamily: FONT, fontSize: '16px', color: '#cfd0ff', align: 'center', lineSpacing: 9,
    }).setOrigin(0.5, 0).setDepth(5).setStroke('#000018', 4);

    // Nave interactiva: sigue el cursor, con glow de motor.
    this._shipTarget = { x: width / 2, y: height * 0.82 };
    this.shipGlow = this.add.image(this._shipTarget.x, this._shipTarget.y, 'menu_ship')
      .setTint(0x00ffcc).setAlpha(0.25).setScale(1.7).setBlendMode('ADD').setDepth(8);
    this.ship = this.add.image(this._shipTarget.x, this._shipTarget.y, 'menu_ship').setDepth(9);
    this.input.on('pointermove', (p) => { this._shipTarget.x = p.x; this._shipTarget.y = p.y; });
    this.input.on('pointerdown', () => this._burst(this.ship.x, this.ship.y));

    const start = this.add.text(width / 2, height - 40, '> PRESIONA ENTER PARA COMENZAR <', {
      fontFamily: FONT, fontSize: '22px', color: '#ffee44', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10).setStroke('#5a4a00', 5);
    this.tweens.add({ targets: start, alpha: 0.15, duration: 480, yoyo: true, repeat: -1 });

    this.input.keyboard.once('keydown-ENTER', () => this.scene.start('GameScene'));
  }

  update(time, delta) {
    if (!this.ship) return;
    const tx = this._shipTarget.x, ty = this._shipTarget.y;
    const nx = Phaser.Math.Linear(this.ship.x, tx, 0.08);
    const ny = Phaser.Math.Linear(this.ship.y, ty, 0.08);
    const dx = nx - this.ship.x;
    this.ship.setPosition(nx, ny);
    this.ship.angle = Phaser.Math.Clamp(dx * 3, -24, 24);
    this.shipGlow.setPosition(nx, ny + 6);
    this.shipGlow.angle = this.ship.angle;
    this.shipGlow.alpha = 0.18 + Math.abs(dx) * 0.04;
  }

  _burst(x, y) {
    for (let k = 0; k < 16; k++) {
      const a = Math.random() * Math.PI * 2, r = Phaser.Math.Between(30, 130);
      const st = this.add.rectangle(x, y, 3, 3,
        Phaser.Math.RND.pick([0x9af6ff, 0xffe23a, 0xff5ea8, 0xffffff])).setDepth(7);
      this.tweens.add({ targets: st, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, alpha: 0,
        duration: 600, ease: 'Cubic.easeOut', onComplete: () => st.destroy() });
    }
  }

  _makeShipTex(key) {
    if (this.textures.exists(key)) this.textures.remove(key);
    const px = 7, g = this.make.graphics({ x: 0, y: 0, add: false });
    const R = (x, y, w, h, c) => { g.fillStyle(c, 1); g.fillRect(x * px, y * px, w * px, h * px); };
    const H = 0xb8c0cc, H2 = 0x8a93a3, D = 0x4a4f5a, COCK = 0x32b6ff, RED = 0xd83a4a, YEL = 0xffe23a;
    R(6,0,1,2,D); R(5,2,3,2,H2); R(6,3,1,1,RED); R(4,4,5,5,H); R(5,5,3,2,COCK); R(4,8,5,1,D);
    R(2,5,2,4,H2); R(9,5,2,4,H2); R(2,4,1,1,D); R(10,4,1,1,D); R(3,6,1,1,RED); R(9,6,1,1,RED);
    R(1,7,1,3,H2); R(11,7,1,3,H2); R(5,9,3,2,RED); R(6,11,1,1,YEL); R(6,12,1,1,YEL);
    g.generateTexture(key, 13 * px, 14 * px); g.destroy();
  }

  _makeHoleTex(key, S) {
    if (this.textures.exists(key)) this.textures.remove(key);
    const c = S / 2, TAU = Math.PI * 2, g = this.make.graphics({ x: 0, y: 0, add: false });
    for (let r = c; r > c * 0.45; r -= 3) { g.fillStyle(0x16265f, 0.018); g.fillCircle(c, c, r); }
    const ARM = [0x2b5cff, 0x00d0ff, 0x6a2cff, 0xff5ea8, 0x9af6ff];
    for (let arm = 0; arm < 2; arm++) {
      const base = (arm / 2) * TAU;
      for (let t = 0; t < 210; t++) {
        const ang = base + t * 0.085;
        const rad = 7 + t * (c * 0.82 / 210);
        const col = ARM[(t >> 4) % ARM.length];
        const a = Math.max(0.05, 0.55 * (1 - rad / c));
        g.fillStyle(col, a);
        g.fillCircle(c + Math.cos(ang) * rad, c + Math.sin(ang) * rad * 0.9, 5.5 * (1 - t / 320) + 1.6);
      }
    }
    for (let r = c * 0.3; r > 0; r -= 2) { g.fillStyle(0x9fe8ff, 0.5 * (1 - r / (c * 0.3))); g.fillCircle(c, c, r); }
    g.fillStyle(0xfff0c0, 0.95); g.fillCircle(c, c, c * 0.2);
    g.fillStyle(0x000000, 1); g.fillCircle(c, c, c * 0.15);
    g.generateTexture(key, S, S); g.destroy();
  }
}
