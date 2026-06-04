// ============================================================
//  VISUALMANAGER — Galaxia alienígena sincronizada con la música.
//  👤 DUEÑO: Persona 3 (Visual / UI)
//
//  CONCEPTO: una nave alienígena cruza una galaxia.
//   · CALMA/BUILD: fondo oscuro, estrellas apagadas, colores apagados.
//   · Progresivamente: más estrellas, nebulosas y colores más vivos.
//   · DROP (1:00): la nave ATRAVIESA UN AGUJERO NEGRO → todo se vuelve
//     más bonito y colorido (paleta galáctica vívida).  ← momento WOW
//   · Cerca de la meta: cometas / estrellas fugaces cruzan el fondo.
//
//  REGLA DE ORO: solo LEE GameState (vía el payload de TICK).
//  El valor maestro es state.intensity (0..1): TODO "respira" con él.
//
//  Nota de equipo: reemplazo las texturas placeholder del Motor
//  (ship/obstacle/orb) por arte galáctico procedural y doy a los
//  planetas un hitbox circular más justo. No edito GameScene.js.
// ============================================================

import Phaser from 'phaser';
import { EventBus, EVENTS } from '../core/EventBus.js';
import { CONFIG, PHASE } from '../core/config.js';

// Paleta de planetas (se tiñe cada obstáculo con uno de estos).
const PLANET_COLORS = [0xff6a4a, 0x4ad6ff, 0xffc24a, 0xb96aff, 0x4affa0, 0xff5ea8, 0x6a8cff];
// Nebulosa apagada (inicio) y nebulosa vívida (tras el agujero negro).
const NEB_MUTED = [0x141433, 0x1c2447, 0x281640, 0x14303a, 0x201038];
const NEB_VIVID = [0x6a2cff, 0x00e5ff, 0xff3ca6, 0xffd24a, 0x2af0c0, 0x8a5cff];

export class VisualManager {
  constructor(scene) {
    this.scene = scene;
    // Motor responsive: el canvas llena la ventana. Tomamos el tamano
    // real de la escena (CONFIG.width/height ya no existen).
    this.W = scene.scale.width;
    this.H = scene.scale.height;

    this._beat = 0;
    this._pulse = 0;
    this._intensity = 0;
    this._vivid = 0;        // 0 antes del drop, →1 tras el agujero negro
    this._vividTarget = 0;
    this._cometTimer = 0;

    this._buildTextures();
    this._buildLayers();

    EventBus.on(EVENTS.TICK, this.onTick, this);
    EventBus.on(EVENTS.COLLISION, this.onCollision, this);
    EventBus.on(EVENTS.ORB, this.onOrb, this);
    EventBus.on(EVENTS.PHASE_CHANGE, this.onPhaseChange, this);
  }

  // ========================================================
  //  TEXTURAS procedurales (sin assets externos)
  // ========================================================
  _buildTextures() {
    this._softTexture('vm_soft', 32);
    this._starTileTexture('vm_stars_far', 256, 40, 1.0, 0.5);
    this._starTileTexture('vm_stars_near', 256, 70, 1.8, 0.9);
    this._nebulaTexture('vm_neb_muted', NEB_MUTED, 26, 0.5);
    this._nebulaTexture('vm_neb_vivid', NEB_VIVID, 34, 0.85);
    this._blackHoleTexture('vm_hole', 256);

    // Reemplazo de placeholders del Motor por arte galáctico.
    this._alienShipTexture('ship');   // nave alienígena
    this._planetTexture('obstacle');  // planeta (se tiñe por instancia)
    this._orbStarTexture('orb');      // estrella/orbe dorado
  }

  _newG() { return this.scene.make.graphics({ x: 0, y: 0, add: false }); }
  _replace(key) {
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
  }

  // Punto suave (glow/partículas): círculos concéntricos translúcidos.
  _softTexture(key, R) {
    if (this.scene.textures.exists(key)) return;
    const g = this._newG();
    for (let i = R; i > 0; i--) { g.fillStyle(0xffffff, 0.05); g.fillCircle(R, R, i); }
    g.generateTexture(key, R * 2, R * 2); g.destroy();
  }

  // Baldosa de estrellas (se repite con tileSprite).
  _starTileTexture(key, S, count, maxR, maxA) {
    if (this.scene.textures.exists(key)) return;
    const g = this._newG();
    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.Between(0, S), y = Phaser.Math.Between(0, S);
      const r = Phaser.Math.FloatBetween(0.4, maxR);
      const a = Phaser.Math.FloatBetween(0.25, maxA);
      g.fillStyle(0xffffff, a); g.fillCircle(x, y, r);
    }
    g.generateTexture(key, S, S); g.destroy();
  }

  // Nebulosa a pantalla completa: nubes suaves de colores.
  _nebulaTexture(key, palette, blobs, maxA) {
    if (this.scene.textures.exists(key)) return;
    const { W, H } = this;
    const g = this._newG();
    for (let n = 0; n < blobs; n++) {
      const cx = Phaser.Math.Between(0, W), cy = Phaser.Math.Between(0, H);
      const R = Phaser.Math.Between(70, 200);
      const col = palette[n % palette.length];
      for (let r = R; r > 0; r -= 5) {
        g.fillStyle(col, maxA * (1 - r / R) * 0.05);
        g.fillCircle(cx, cy, r);
      }
    }
    g.generateTexture(key, W, H); g.destroy();
  }

  // Agujero negro: glow morado + anillo de acreción + núcleo oscuro.
  _blackHoleTexture(key, S) {
    if (this.scene.textures.exists(key)) return;
    const c = S / 2, g = this._newG();
    for (let r = c; r > 70; r -= 3) { g.fillStyle(0x6a2cff, 0.025); g.fillCircle(c, c, r); }
    g.lineStyle(16, 0xffae3b, 0.95); g.strokeCircle(c, c, 70);
    g.lineStyle(8, 0x66e0ff, 0.9); g.strokeCircle(c, c, 54);
    g.lineStyle(6, 0xff5ea8, 0.7); g.strokeCircle(c, c, 84);
    g.fillStyle(0x000000, 1); g.fillCircle(c, c, 48);
    // arcos brillantes para que se note el giro
    for (const ang of [0.4, 2.3, 4.1]) {
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(c + Math.cos(ang) * 70, c + Math.sin(ang) * 70, 6);
    }
    g.generateTexture(key, S, S); g.destroy();
  }

  // Nave alienígena: platillo con cúpula y luces.
  _alienShipTexture(key) {
    this._replace(key);
    const W = 40, H = 26, g = this._newG();
    // estela/glow inferior
    g.fillStyle(0x00ffcc, 0.25); g.fillEllipse(W / 2, H / 2 + 4, W, 12);
    // cuerpo del platillo
    g.fillStyle(0x8fa6c8, 1); g.fillEllipse(W / 2, H / 2 + 3, W, 13);
    g.fillStyle(0x5e7396, 1); g.fillEllipse(W / 2, H / 2 + 6, W, 7);
    // cúpula
    g.fillStyle(0x9af6ff, 0.95); g.fillEllipse(W / 2, H / 2 - 2, 18, 16);
    g.fillStyle(0xd9ffff, 0.9); g.fillCircle(W / 2 - 2, H / 2 - 4, 3);
    // luces
    for (const lx of [10, 20, 30]) { g.fillStyle(0xfff35e, 1); g.fillCircle(lx, H / 2 + 4, 1.6); }
    g.generateTexture(key, W, H); g.destroy();
  }

  // Planeta claro (para que el tinte por instancia lo coloree) con anillo.
  _planetTexture(key) {
    this._replace(key);
    const S = 46, c = S / 2, g = this._newG();
    g.fillStyle(0xffffff, 1); g.fillCircle(c, c, 18);            // cuerpo
    g.fillStyle(0xbfc6d8, 1); g.fillCircle(c + 5, c + 5, 14);    // sombra
    g.fillStyle(0xffffff, 0.9); g.fillCircle(c - 5, c - 6, 6);   // brillo
    g.lineStyle(3, 0xffffff, 0.85); g.strokeEllipse(c, c, 44, 16); // anillo
    g.generateTexture(key, S, S); g.destroy();
  }

  // Orbe/estrella dorada con destellos.
  _orbStarTexture(key) {
    this._replace(key);
    const S = 22, c = S / 2, g = this._newG();
    g.fillStyle(0xffee44, 0.3); g.fillCircle(c, c, 10);
    g.fillStyle(0xfff7a8, 1); g.fillCircle(c, c, 5);
    g.fillStyle(0xffffff, 1); g.fillCircle(c, c, 2.5);
    g.fillStyle(0xffee88, 0.9);
    g.fillTriangle(c, 0, c - 1.5, c, c + 1.5, c);          // punta arriba
    g.fillTriangle(c, S, c - 1.5, c, c + 1.5, c);          // abajo
    g.fillTriangle(0, c, c, c - 1.5, c, c + 1.5);          // izq
    g.fillTriangle(S, c, c, c - 1.5, c, c + 1.5);          // der
    g.generateTexture(key, S, S); g.destroy();
  }

  // ========================================================
  //  CAPAS
  // ========================================================
  _buildLayers() {
    const s = this.scene, { W, H } = this;
    s.cameras.main.setBackgroundColor(0x05060f);

    this.sky = s.add.rectangle(0, 0, W, H, 0x05060f).setOrigin(0, 0).setDepth(-40);

    this.nebMuted = s.add.image(0, 0, 'vm_neb_muted').setOrigin(0, 0).setDepth(-38).setBlendMode('ADD');
    this.nebVivid = s.add.image(0, 0, 'vm_neb_vivid').setOrigin(0, 0).setDepth(-37).setBlendMode('ADD').setAlpha(0);

    this.starsFar = s.add.tileSprite(0, 0, W, H, 'vm_stars_far').setOrigin(0, 0).setDepth(-35).setAlpha(0.15);
    this.starsNear = s.add.tileSprite(0, 0, W, H, 'vm_stars_near').setOrigin(0, 0).setDepth(-33).setAlpha(0);

    // Polvo cósmico que viaja con el scroll.
    this.dust = s.add.particles(0, 0, 'vm_soft', {
      x: W + 12, y: { min: 0, max: H },
      speedX: { min: -220, max: -80 }, speedY: { min: -8, max: 8 },
      lifespan: 3400, scale: { min: 0.06, max: 0.3 },
      alpha: { start: 0.6, end: 0 }, blendMode: 'ADD',
      frequency: 240, quantity: 1,
    });
    this.dust.setDepth(-10);
    this.dust.particleTint = 0x66e0ff;

    // Halo de la nave (sigue al jugador en onTick).
    this.glow = s.add.image(120, H / 2, 'vm_soft').setDepth(-1).setBlendMode('ADD').setTint(0x00ffcc).setScale(1.2);

    // Grading de color + viñeta del drop.
    this.grade = s.add.rectangle(0, 0, W, H, 0xff3ca6, 0).setOrigin(0, 0).setDepth(50).setBlendMode('ADD');
    this.vignette = s.add.rectangle(0, 0, W, H).setOrigin(0, 0).setDepth(60);
    this.vignette.setFillStyle(0x000000, 0);
    this.vignette.setStrokeStyle(2, 0xff3ca6, 0);
  }

  // ========================================================
  //  helpers de color
  // ========================================================
  _lerpColor(a, b, t) {
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    return (Math.round(ar + (br - ar) * t) << 16) |
           (Math.round(ag + (bg - ag) * t) << 8) |
            Math.round(ab + (bb - ab) * t);
  }
  _accent() {
    const t = Phaser.Math.Clamp(this._intensity * 0.5 + this._vivid * 0.6, 0, 1);
    return this._lerpColor(0x66e0ff, 0xff6ad5, t);
  }

  // ========================================================
  //  CADA FRAME
  // ========================================================
  onTick(state) {
    const dt = Math.min(this.scene.game.loop.delta, 50) / 1000;
    this._intensity += (state.intensity - this._intensity) * Math.min(1, dt * 6);
    this._vivid += (this._vividTarget - this._vivid) * Math.min(1, dt * 0.9);
    const i = this._intensity, v = this._vivid;

    // BEAT derivado del bpm.
    this._beat += dt * ((state.bpm || CONFIG.bpmBase) / 60);
    if (this._beat >= 1) { this._beat -= 1; this._pulse = 1; }
    this._pulse = Math.max(0, this._pulse - dt * 3.2);
    const pulse = this._pulse;

    // Estrellas: parallax + más densas/brillantes con la intensidad.
    this.starsFar.tilePositionX += (12 + i * 70) * dt;
    this.starsFar.setAlpha(0.12 + i * 0.18);
    this.starsNear.tilePositionX += (30 + i * 160) * dt;
    this.starsNear.setAlpha(i * 0.4 + v * 0.45 + pulse * 0.05);

    // Nebulosa: apagada al inicio, vívida tras el agujero negro.
    this.nebMuted.tilePositionX; // (imagen estática)
    this.nebMuted.setAlpha((0.3 + i * 0.25) * (1 - 0.65 * v));
    this.nebVivid.setAlpha(v * (0.4 + i * 0.4) + pulse * 0.05 * v);

    const accent = this._accent();

    // Polvo cósmico: más denso con la intensidad.
    this.dust.setFrequency(Phaser.Math.Linear(260, 50, i));
    this.dust.particleTint = accent;

    // Grading sutil + calor en el drop.
    this.grade.setFillStyle(accent);
    this.grade.setAlpha(Math.max(0, i - 0.35) * 0.14 + v * 0.06 + pulse * 0.1);

    // Halo de la nave alienígena.
    const p = this.scene.player;
    if (p) {
      this.glow.setPosition(p.x, p.y);
      this.glow.setTint(this._lerpColor(0x00ffcc, accent, v));
      this.glow.setScale(1.0 + i * 1.3 + pulse * 0.35);
      this.glow.setAlpha(0.35 + i * 0.4 + pulse * 0.22);
    }

    // Planetas: tinte + rotación variados (decoración una sola vez).
    this._decorateObstacles(dt);

    // Cerca de la meta: cometas / estrellas fugaces.
    if (state.progress > 0.85) {
      this._cometTimer -= dt;
      if (this._cometTimer <= 0) {
        this._cometTimer = Phaser.Math.FloatBetween(0.5, 1.1);
        this._spawnComet();
      }
    }
  }

  // Da a cada planeta color/escala/giro propios y un hitbox circular justo.
  _decorateObstacles(dt) {
    // El Motor guarda this.obstacles como ARRAY de { sprite, wx, wy, z }.
    // (Antes era un grupo de fisica.) Decoramos el sprite de cada uno.
    const list = this.scene.obstacles;
    if (!Array.isArray(list)) return;
    for (const o of list) {
      const spr = o.sprite || o;
      if (!spr || !spr.setTint) continue;
      if (!spr._vmDecor) {
        spr._vmDecor = true;
        spr.setTint(Phaser.Utils.Array.GetRandom(PLANET_COLORS));
        spr._spin = Phaser.Math.FloatBetween(-1.4, 1.4);
        // No tocamos la escala: el Motor la controla cada frame (perspectiva).
      }
      spr.angle += spr._spin;
      // Objetos sincronizados con la musica: laten en cada beat.
      spr.setScale(spr.scaleX * (1 + this._pulse * 0.2));
    }
  }

  // Estrella fugaz que cruza el fondo de derecha a izquierda.
  _spawnComet() {
    const s = this.scene;
    const y = Phaser.Math.Between(20, this.H * 0.55);
    const comet = s.add.image(this.W + 40, y, 'vm_soft').setDepth(-30).setBlendMode('ADD');
    comet.setTint(this._lerpColor(0x9af6ff, 0xffd24a, Math.random()));
    comet.scaleX = 2.4; comet.scaleY = 0.18; comet.setAngle(18);
    s.tweens.add({
      targets: comet, x: -80, y: y + 150, alpha: 0,
      duration: Phaser.Math.Between(700, 1100), ease: 'Sine.easeIn',
      onComplete: () => comet.destroy(),
    });
  }

  // ========================================================
  //  COLISIÓN: vibración + flash + reventón
  // ========================================================
  onCollision({ x, y } = {}) {
    const cam = this.scene.cameras.main;
    cam.shake(180, CONFIG.collisionShake * 2.4);
    cam.flash(160, 255, 60, 100);
    if (x != null) {
      this.scene.add.particles(x, y, 'vm_soft', {
        speed: { min: 80, max: 260 }, angle: { min: 0, max: 360 },
        lifespan: 420, scale: { start: 0.5, end: 0 }, alpha: { start: 0.9, end: 0 },
        blendMode: 'ADD', tint: 0xff4466, emitting: false,
      }).explode(18, x, y);
    }
    this._vignettePulse(0xff4466, 0.6, 240);
  }

  // ========================================================
  //  ORBE: destello dorado
  // ========================================================
  onOrb({ x, y } = {}) {
    this.scene.cameras.main.flash(120, 120, 100, 20);
    if (x == null) return;
    const ring = this.scene.add.image(x, y, 'vm_soft').setDepth(5).setBlendMode('ADD').setTint(0xffee44).setScale(0.3);
    this.scene.tweens.add({
      targets: ring, scale: 2.2, alpha: 0, duration: 420, ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
    this.scene.add.particles(x, y, 'vm_soft', {
      speed: { min: 40, max: 160 }, angle: { min: 0, max: 360 },
      lifespan: 500, scale: { start: 0.35, end: 0 }, alpha: { start: 0.9, end: 0 },
      blendMode: 'ADD', tint: 0xffee44, emitting: false,
    }).explode(12, x, y);
  }

  // ========================================================
  //  CAMBIO DE FASE: el WOW del DROP (agujero negro)
  // ========================================================
  onPhaseChange({ to } = {}) {
    if (to === PHASE.DROP) this._blackHoleDrop();
    if (to === PHASE.COMPLETE) this.scene.cameras.main.flash(700, 80, 255, 160);
  }

  // La nave ATRAVIESA un agujero negro y la galaxia se vuelve vívida.
  _blackHoleDrop() {
    const s = this.scene, cam = s.cameras.main;
    const hole = s.add.image(this.W / 2, this.H / 2, 'vm_hole').setDepth(65).setBlendMode('ADD').setScale(0.05).setAlpha(0);

    // succión: zoom hacia adentro + giro del agujero
    cam.zoomTo(1.18, 700, 'Cubic.easeIn');
    s.tweens.add({ targets: hole, scale: 3.2, alpha: 1, angle: 220, duration: 700, ease: 'Cubic.easeIn' });

    // al "cruzarlo": flash blanco, la galaxia se vuelve colorida, expulsión
    s.time.delayedCall(700, () => {
      cam.flash(420, 255, 255, 255);
      cam.shake(260, 0.012);
      this._vividTarget = 1;          // ← la galaxia se vuelve vívida
      cam.zoomTo(1.0, 600, 'Cubic.easeOut');
      s.tweens.add({ targets: hole, scale: 8, alpha: 0, angle: 360, duration: 650, ease: 'Cubic.easeOut', onComplete: () => hole.destroy() });
      this._vignettePulse(0xff3ca6, 0.8, 700);

      // texto "¡DROP!" épico
      const txt = s.add.text(this.W / 2, this.H / 2, '¡DROP!', { fontSize: '92px', color: '#ff5ea8', fontStyle: 'bold' })
        .setOrigin(0.5).setDepth(90).setScale(0.2).setAlpha(0);
      s.tweens.add({
        targets: txt, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut',
        onComplete: () => s.tweens.add({ targets: txt, alpha: 0, scale: 1.4, duration: 700, delay: 300, onComplete: () => txt.destroy() }),
      });
    });
  }

  // Pulso de viñeta (marco de color que aparece y decae).
  _vignettePulse(color, strength, duration) {
    const v = this.vignette, aux = { w: 18 };
    this.scene.tweens.add({
      targets: aux, w: 0, duration, ease: 'Cubic.easeOut',
      onUpdate: () => v.setStrokeStyle(Math.max(0.001, aux.w), color, strength),
      onComplete: () => v.setStrokeStyle(2, color, 0),
    });
  }
}
