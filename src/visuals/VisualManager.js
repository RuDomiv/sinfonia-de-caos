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

    // Reemplazo de placeholders del Motor por arte 8-bit.
    this._alienShipTexture('ship');   // nave 8-bit (estilo arcade)
    this._planetTexture('obstacle');  // fallback del Motor
    this._orbStarTexture('orb');      // estrella/orbe dorado
    // Variantes de obstaculos 8-bit (se asignan al azar por instancia).
    this._pixelPlanetTexture('vm_planet');
    this._pixelAsteroidTexture('vm_asteroid');
    this._pixelSupernovaTexture('vm_supernova');
    this._pixelWreckTexture('vm_wreck');
    this._pixelCreatureTexture('vm_creature');
    this._obsKeys = ['vm_planet', 'vm_asteroid', 'vm_supernova', 'vm_wreck', 'vm_creature'];
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

  // Agujero negro pixel-art: disco de acrecion (maroon->rojo->naranja->amarillo),
  // anillo de fotones brillante, horizonte negro y dos jets de luz.
  _blackHoleTexture(key, S) {
    this._replace(key);
    const c = S / 2, g = this._newG();
    const E = (w, h, col, a = 1) => { g.fillStyle(col, a); g.fillEllipse(c, c, w, h); };
    // Jets: haces claros que cruzan el centro y sobresalen del disco.
    g.fillStyle(0xfff3c8, 0.4); g.fillRect(c - 5, 4, 10, S - 8);
    g.fillStyle(0xfffbe8, 0.85); g.fillRect(c - 2, 12, 4, S - 24);
    // Disco de acrecion (de afuera hacia adentro).
    E(S * 0.97, S * 0.42, 0x240910);
    E(S * 0.88, S * 0.37, 0x4d0d1a);
    E(S * 0.78, S * 0.32, 0x7e1222);
    E(S * 0.67, S * 0.27, 0xb91f2b);
    E(S * 0.56, S * 0.225, 0xe8401f);
    E(S * 0.46, S * 0.185, 0xff7a18);
    E(S * 0.37, S * 0.15, 0xffb22e);
    E(S * 0.30, S * 0.12, 0xffd84a);
    E(S * 0.25, S * 0.10, 0xfff0b0);
    // Anillo de fotones + horizonte de sucesos (negro).
    E(S * 0.205, S * 0.165, 0xffe79a);
    g.fillStyle(0x000000, 1); g.fillEllipse(c, c, S * 0.17, S * 0.135);
    g.generateTexture(key, S, S); g.destroy();
  }

  // Nave 8-bit estilo arcade (gris, cabina azul, acentos rojos, motor amarillo).
  _alienShipTexture(key) {
    this._replace(key);
    const px = 7, g = this._newG();
    const R = (x, y, w, h, c) => { g.fillStyle(c, 1); g.fillRect(x * px, y * px, w * px, h * px); };
    const H = 0xb8c0cc, H2 = 0x8a93a3, D = 0x4a4f5a, COCK = 0x32b6ff, RED = 0xd83a4a, YEL = 0xffe23a;
    R(6, 0, 1, 2, D);                 // nariz
    R(5, 2, 3, 2, H2);
    R(6, 3, 1, 1, RED);               // luz frontal
    R(4, 4, 5, 5, H);                 // cuerpo
    R(5, 5, 3, 2, COCK);              // cabina
    R(4, 8, 5, 1, D);
    R(2, 5, 2, 4, H2); R(9, 5, 2, 4, H2);   // alas
    R(2, 4, 1, 1, D); R(10, 4, 1, 1, D);     // puntas
    R(3, 6, 1, 1, RED); R(9, 6, 1, 1, RED);  // acentos
    R(1, 7, 1, 3, H2); R(11, 7, 1, 3, H2);   // alas exteriores
    R(5, 9, 3, 2, RED);               // motor
    R(6, 11, 1, 1, YEL); R(6, 12, 1, 1, YEL); // estela
    g.generateTexture(key, 13 * px, 14 * px); g.destroy();
  }

  // Helper de pixel-art: dibuja en una grilla escalada por px.
  _px(g, px) { return (x, y, w, h, c) => { g.fillStyle(c, 1); g.fillRect(x * px, y * px, w * px, h * px); }; }

  _pixelPlanetTexture(key) {
    this._replace(key); const px = 4, g = this._newG(), R = this._px(g, px);
    const A = 0x4ad6ff, B = 0x2a86c8, C = 0xbfeaff;
    R(3,1,6,1,A);R(2,2,8,1,A);R(1,3,10,4,A);R(2,7,8,1,A);R(3,8,6,1,A);
    R(4,3,4,2,C);R(2,5,3,1,B);R(6,6,4,1,B);R(0,4,12,1,0xffe23a);
    g.generateTexture(key, 12 * px, 10 * px); g.destroy();
  }
  _pixelAsteroidTexture(key) {
    this._replace(key); const px = 4, g = this._newG(), R = this._px(g, px);
    const A = 0x9a8f80, B = 0x6f6457, C = 0xc9bfae;
    R(3,1,5,1,A);R(2,2,7,1,A);R(1,3,9,4,A);R(2,7,7,1,A);R(4,8,4,1,A);
    R(3,2,2,2,C);R(6,4,2,2,B);R(2,5,2,1,B);R(7,6,2,1,B);R(4,5,1,1,B);
    g.generateTexture(key, 11 * px, 10 * px); g.destroy();
  }
  _pixelSupernovaTexture(key) {
    this._replace(key); const px = 4, g = this._newG(), R = this._px(g, px);
    const Y = 0xffe23a, O = 0xff7a1a, W = 0xffffff;
    R(5,0,1,2,Y);R(5,9,1,2,Y);R(0,5,2,1,Y);R(9,5,2,1,Y);
    R(1,1,1,1,O);R(9,1,1,1,O);R(1,9,1,1,O);R(9,9,1,1,O);
    R(3,3,5,5,O);R(4,2,3,1,O);R(2,4,1,3,O);R(8,4,1,3,O);R(4,8,3,1,O);
    R(4,4,3,3,Y);R(5,5,1,1,W);
    g.generateTexture(key, 11 * px, 11 * px); g.destroy();
  }
  _pixelWreckTexture(key) {
    this._replace(key); const px = 4, g = this._newG(), R = this._px(g, px);
    const A = 0x8a93a3, B = 0x4a4f5a;
    R(2,2,7,3,A);R(1,3,1,1,A);R(9,3,1,1,A);R(3,5,5,1,B);R(2,1,2,1,B);R(6,1,2,1,A);
    R(4,3,1,1,0xd83a4a);R(7,2,1,1,0x32b6ff);R(5,5,1,2,B);R(8,4,2,1,B);
    g.generateTexture(key, 11 * px, 8 * px); g.destroy();
  }
  _pixelCreatureTexture(key) {
    this._replace(key); const px = 4, g = this._newG(), R = this._px(g, px);
    const A = 0xff5ea8, B = 0xb96aff, E = 0x2af0c0;
    R(3,0,4,1,A);R(2,1,6,2,A);R(1,3,8,2,A);R(3,2,1,1,E);R(6,2,1,1,E);
    R(2,5,1,3,B);R(4,5,1,4,B);R(6,5,1,4,B);R(8,5,1,3,B);R(5,5,1,3,B);R(7,5,1,3,B);
    g.generateTexture(key, 10 * px, 9 * px); g.destroy();
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
    this.dust.setFrequency(Phaser.Math.Linear(120, 10, i));
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
    // Cometas/estrellas fugaces SIEMPRE (mas frecuentes con intensidad) -> fondo vivo.
    this._cometTimer -= dt;
    if (this._cometTimer <= 0) {
      this._cometTimer = Phaser.Math.FloatBetween(0.3, 1.1) * (1 - i * 0.6);
      this._spawnComet();
      if (v > 0.5) this._spawnComet();
    }
    // Galaxias de fondo que cruzan lentamente (parallax).
    if (this._decorTimer == null) this._decorTimer = 0;
    this._decorTimer -= dt;
    if (this._decorTimer <= 0) {
      this._decorTimer = Phaser.Math.FloatBetween(0.6, 1.6) * (v > 0.5 ? 0.5 : 1);
      this._spawnDecor(v);
    }
    // Agujeros negros ESTATICOS que atraen un poco a la nave (se puede escapar).
    this._updateHoles(dt, v);
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
        if (this._obsKeys && this._obsKeys.length) {
          spr.setTexture(Phaser.Utils.Array.GetRandom(this._obsKeys)); // tipo 8-bit al azar
          spr.clearTint();
        } else {
          spr.setTint(Phaser.Utils.Array.GetRandom(PLANET_COLORS));
        }
        spr._spin = Phaser.Math.FloatBetween(-2, 2);
      }
      spr.angle += spr._spin;
      // Mini zoom + mini vibracion al ritmo de la musica.
      spr.setScale(spr.scaleX * (1 + this._pulse * 0.28));
      spr.x += (Math.random() - 0.5) * this._pulse * 6;
      spr.y += (Math.random() - 0.5) * this._pulse * 6;
    }
  }

  // Galaxias espirales que CRUZAN el fondo lentamente (parallax = viaje real).
  _spawnDecor(v) {
    const s = this.scene;
    const fromLeft = Math.random() < 0.5;
    const y = Phaser.Math.Between(0, this.H);
    const startX = fromLeft ? -180 : this.W + 180;
    const endX = fromLeft ? this.W + 180 : -180;
    const dur = Phaser.Math.Between(10000, 17000); // lento => lejano
    const g = s.add.image(startX, y, 'vm_neb_vivid').setDepth(-27).setBlendMode('ADD')
      .setScale(Phaser.Math.FloatBetween(1.0, 2.4)).setAlpha(0);
    g.setTint(Phaser.Utils.Array.GetRandom([0xff5ea8, 0x6a8bff, 0x9af6ff, 0xffd24a, 0xb96aff, 0x7cffb2]));
    s.tweens.add({ targets: g, angle: g.angle + Phaser.Math.Between(20, 60), duration: dur });
    s.tweens.add({ targets: g, x: endX, duration: dur, ease: 'Linear', onComplete: () => g.destroy() });
    s.tweens.add({ targets: g, alpha: 0.35 + 0.3 * v, duration: dur * 0.3, yoyo: true, hold: dur * 0.4 });
  }

  // Agujeros negros ESTATICOS (no se trasladan): solo giran, brillan y ATRAEN a la nave.
  _spawnHole(v) {
    const s = this.scene, m = 150;
    const x = Phaser.Math.Between(m, this.W - m);
    const y = Phaser.Math.Between(m, this.H - m);
    const spr = s.add.image(x, y, 'vm_hole').setDepth(40).setAlpha(0)
      .setScale(Phaser.Math.FloatBetween(0.55, 1.0)).setAngle(Phaser.Math.Between(-32, -12));
    s.tweens.add({ targets: spr, alpha: 1, duration: 700 });
    this._holes.push({
      spr, x, y, t: 0,
      life: Phaser.Math.FloatBetween(5.5, 8.5),
      spin: Phaser.Math.FloatBetween(18, 40),
      radius: 320, pull: 200,
    });
  }

  // Atrae un poco a la nave hacia cada agujero (la nave SIEMPRE puede escapar).
  _updateHoles(dt, v) {
    if (!this._holes) this._holes = [];
    if (this._holeTimer == null) this._holeTimer = 3;
    const maxHoles = v > 0.5 ? 3 : 2;
    this._holeTimer -= dt;
    if (this._holeTimer <= 0 && this._holes.length < maxHoles) {
      this._holeTimer = Phaser.Math.FloatBetween(4, 8) * (v > 0.5 ? 0.6 : 1);
      this._spawnHole(v);
    }
    const p = this.scene.player;
    for (let k = this._holes.length - 1; k >= 0; k--) {
      const h = this._holes[k];
      h.t += dt;
      h.spr.angle += h.spin * dt;
      if (p && h.t < h.life) {
        const dx = h.x - p.x, dy = h.y - p.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < h.radius) {
          const strength = (1 - dist / h.radius) * h.pull;
          p.x += (dx / dist) * strength * dt;
          p.y += (dy / dist) * strength * dt;
        }
      }
      if (h.t >= h.life) {
        h.spr.setAlpha(Math.max(0, h.spr.alpha - dt * 1.1));
        if (h.spr.alpha <= 0.02) { h.spr.destroy(); this._holes.splice(k, 1); }
      }
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

  // Secuencia del DROP: el agujero negro ABSORBE la nave, pantalla en NEGRO 2s,
  // aparece "ERROR 404" y luego TODO se llena de estrellas (drop galactico).
  _blackHoleDrop() {
    const s = this.scene, cam = s.cameras.main;
    const cx = this.W / 2, cy = this.H / 2;
    const FONT = '"Courier New", monospace';
    const player = s.player;

    const black = s.add.rectangle(0, 0, this.W, this.H, 0x000000, 1)
      .setOrigin(0, 0).setDepth(150).setScrollFactor(0).setAlpha(0);

    // Agujero negro que crece y gira en el centro.
    const hole = s.add.image(cx, cy, 'vm_hole').setDepth(149).setBlendMode('ADD').setScale(0.05).setAlpha(0);
    cam.zoomTo(1.4, 1100, 'Cubic.easeIn');
    s.tweens.add({ targets: hole, scale: 5.5, alpha: 1, angle: 480, duration: 1100, ease: 'Cubic.easeIn' });
    s.tweens.add({ targets: black, alpha: 1, duration: 1100, ease: 'Cubic.easeIn' });

    // LA NAVE ES ABSORBIDA: un clon espirala hacia el agujero y se encoge.
    if (player) {
      player.setVisible(false);
      const ghost = s.add.image(player.x, player.y, 'ship').setDepth(151);
      s.tweens.add({ targets: ghost, x: cx, y: cy, scale: 0.04, angle: 900, alpha: 0.85,
        duration: 1050, ease: 'Cubic.easeIn', onComplete: () => ghost.destroy() });
    }

    s.time.delayedCall(1150, () => {
      hole.destroy();
      cam.zoomTo(1.0, 10);
      s.time.delayedCall(2000, () => {
        const err = s.add.text(cx, cy, 'ERROR 404', { fontFamily: FONT, fontSize: '96px', color: '#ff2b4a', fontStyle: 'bold' })
          .setOrigin(0.5).setDepth(152).setScrollFactor(0).setAlpha(0).setStroke('#220006', 8);
        const sub = s.add.text(cx, cy + 70, 'REALIDAD CORRUPTA', { fontFamily: FONT, fontSize: '22px', color: '#ff7a8a', fontStyle: 'bold' })
          .setOrigin(0.5).setDepth(152).setScrollFactor(0).setAlpha(0);
        s.tweens.add({ targets: [err, sub], alpha: 1, duration: 110, yoyo: true, repeat: 5, hold: 90,
          onComplete: () => {
            err.destroy(); sub.destroy();
            if (player) player.setVisible(true);
            // COMIENZA EL DROP: galaxia vivida + lluvia de estrellas.
            this._vividTarget = 1;
            cam.flash(600, 190, 230, 255);
            cam.shake(340, 0.016);
            this._vignettePulse(0x00e5ff, 0.9, 950);
            this._starBurst();
            s.tweens.add({ targets: black, alpha: 0, duration: 750, onComplete: () => black.destroy() });
          },
        });
      });
    });
  }

  // Estallido de estrellas + galaxias al entrar al drop ("todo se llena de estrellas").
  _starBurst() {
    const s = this.scene, cx = this.W / 2, cy = this.H / 2;
    if (this.dust && this.dust.explode) this.dust.explode(160, cx, cy);
    for (let k = 0; k < 14; k++) this._spawnDecor(1);
    const STAR = [0xffffff, 0x9af6ff, 0xffd24a, 0xff5ea8, 0xb96aff];
    for (let k = 0; k < 70; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = Phaser.Math.Between(40, Math.max(this.W, this.H) * 0.8);
      const st = s.add.image(cx, cy, 'vm_soft').setDepth(-24).setBlendMode('ADD').setScale(0.1).setAlpha(0);
      st.setTint(Phaser.Utils.Array.GetRandom(STAR));
      s.tweens.add({ targets: st, x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, alpha: 0.95, scale: Phaser.Math.FloatBetween(0.25, 0.5),
        duration: 750, ease: 'Cubic.easeOut',
        onComplete: () => s.tweens.add({ targets: st, alpha: 0, duration: 1500, onComplete: () => st.destroy() }) });
    }
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
