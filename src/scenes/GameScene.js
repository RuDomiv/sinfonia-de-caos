// ============================================================
//  GAMESCENE — Orquestador + MECÁNICAS.   👤 DUEÑO: Persona 1 (Motor)
//
//  Modo de juego: TÚNEL EN PERSPECTIVA (estilo Star Wars).
//   - La nave está al centro y se mueve por TODA la pantalla.
//   - Los obstáculos nacen en el punto de fuga (centro), lejos y
//     pequeños, y se acercan creciendo hasta pasar por la cámara.
//   - La nave solo ESQUIVA lo que llega; no avanza.
//   - Dificultad sube con la intensidad y se dispara en el DROP.
//
//  ESCRIBE en GameState y EMITE eventos. Pantalla completa (responsive).
//
//  ⚠️ Persona 2 y 3: NO editen este archivo. Trabajen en sus managers.
// ============================================================

import Phaser from 'phaser';
import { CONFIG, PHASE } from '../core/config.js';
import { GameState, resetState } from '../core/GameState.js';
import { EventBus, EVENTS } from '../core/EventBus.js';
import { AudioManager } from '../audio/AudioManager.js';
import { VisualManager } from '../visuals/VisualManager.js';
import { HUD } from '../ui/HUD.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  preload() {
    AudioManager.preload(this); // Persona 2 carga aquí sus audios.
  }

  create() {
    resetState();
    GameState.running = true;

    // Limpia suscripciones viejas del EventBus (evita fugas al reiniciar con R).
    EventBus.removeAllListeners();

    // --- Texturas simples generadas por código (sin assets externos) ---
    this._makeShipTexture('ship', 46, 0x00ffff);
    this._makeObstacleTexture('obstacle', 80, 0xff2266);
    this._makeCircleTexture('orb', 14, 0xffee44);

    // --- Managers de los otros 2 (se auto-suscriben al EventBus) ---
    this.visuals = new VisualManager(this);   // Persona 3
    this.audio = new AudioManager(this);        // Persona 2
    this.hud = new HUD(this);                    // Persona 3

    // --- Punto de fuga / centro ---
    this.W = this.scale.width;
    this.H = this.scale.height;

    // --- Nave (se mueve manualmente por toda la pantalla) ---
    this.player = this.add.image(this.W / 2, this.H / 2, 'ship').setDepth(1000);

    // --- Listas de objetos en perspectiva ---
    this.obstacles = [];
    this.orbs = [];
    this._obsTimer = 0;
    this._orbTimer = 0;
    this._invUntil = 0; // invencibilidad tras golpe

    // --- Controles ---
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });

    // --- DEBUG (pruebas de Persona 1): saltar en la línea de tiempo ---
    // 1 = inicio | 2 = empieza el DROP (1:00) | 3 = casi el final (1:55)
    this.input.keyboard.on('keydown-ONE', () => { GameState.elapsed = 0; });
    this.input.keyboard.on('keydown-TWO', () => { GameState.elapsed = CONFIG.buildEnd; });
    this.input.keyboard.on('keydown-THREE', () => { GameState.elapsed = CONFIG.duration - 5; });

    // Reposicionar al cambiar tamaño de ventana.
    this.scale.on('resize', this._onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this._onResize, this));
  }

  update(time, delta) {
    if (!GameState.running) return;
    const dt = Math.min(delta / 1000, 0.05);
    this.W = this.scale.width;
    this.H = this.scale.height;

    this._advanceTimeline(dt);
    if (!GameState.running) return; // por si terminó (victoria/derrota)

    this._moveShip(dt);
    this._spawn(dt);
    this._updateObjects(dt);

    EventBus.emit(EVENTS.TICK, GameState); // Audio y Visual/UI reaccionan
  }

  // ---------- LÍNEA DE TIEMPO MAESTRA ----------
  _advanceTimeline(dt) {
    GameState.elapsed += dt;
    GameState.progress = Math.min(GameState.elapsed / CONFIG.duration, 1);

    GameState.glitch = Math.max(0, GameState.glitch - CONFIG.glitchRecovery * dt);
    GameState.stability = Math.min(CONFIG.stabilityMax, GameState.stability + CONFIG.stabilityRegen * dt);

    const p = GameState.progress;
    let target;
    if (p < 0.5) target = (p / 0.5) * 0.65;
    else target = 0.65 + ((p - 0.5) / 0.5) * 0.35;
    GameState.intensity = Phaser.Math.Clamp(target - GameState.glitch, 0, 1);
    GameState.bpm = Math.round(CONFIG.bpmBase + GameState.intensity * (CONFIG.bpmMax - CONFIG.bpmBase));

    const prev = GameState.phase;
    let next;
    if (GameState.elapsed >= CONFIG.duration) next = PHASE.COMPLETE;
    else if (GameState.elapsed >= CONFIG.buildEnd) next = PHASE.DROP;
    else if (GameState.elapsed < 8) next = PHASE.CALM;
    else next = PHASE.BUILD;
    if (next !== prev) {
      GameState.phase = next;
      EventBus.emit(EVENTS.PHASE_CHANGE, { from: prev, to: next });
    }

    if (GameState.phase === PHASE.COMPLETE) return this._win();
    if (GameState.stability <= 0 && !GameState.gameOver) return this._gameOver();

    GameState.score += CONFIG.scorePerSecond * dt;
  }

  _moveShip(dt) {
    const speed = 600;
    let vx = 0, vy = 0;
    if (this.cursors.left.isDown || this.wasd.left.isDown) vx = -speed;
    if (this.cursors.right.isDown || this.wasd.right.isDown) vx = speed;
    if (this.cursors.up.isDown || this.wasd.up.isDown) vy = -speed;
    if (this.cursors.down.isDown || this.wasd.down.isDown) vy = speed;
    this.player.x = Phaser.Math.Clamp(this.player.x + vx * dt, 26, this.W - 26);
    this.player.y = Phaser.Math.Clamp(this.player.y + vy * dt, 26, this.H - 26);

    // parpadeo durante invencibilidad
    this.player.setAlpha(GameState.elapsed < this._invUntil
      ? (Math.floor(GameState.elapsed * 20) % 2 ? 0.3 : 1)
      : 1);
  }

  // ---------- SPAWNS (dificultad escala con la intensidad) ----------
  _spawn(dt) {
    const diff = Math.pow(GameState.intensity, CONFIG.diff.exponent); // 0..1
    const interval = Phaser.Math.Linear(CONFIG.diff.spawnStart, CONFIG.diff.spawnEnd, diff);

    this._obsTimer += dt;
    if (this._obsTimer >= interval) {
      this._obsTimer = 0;
      this._spawnObstacle();
      // En el DROP, a veces salen varios a la vez → mucho más difícil.
      if (GameState.phase === PHASE.DROP && Math.random() < diff * 0.7) this._spawnObstacle();
      if (GameState.phase === PHASE.DROP && Math.random() < diff * 0.35) this._spawnObstacle();
    }

    this._orbTimer += dt;
    if (this._orbTimer >= CONFIG.diff.orbInterval) {
      this._orbTimer = 0;
      this._spawnOrb();
    }
  }

  _spawnObstacle() {
    const angle = Math.random() * Math.PI * 2;
    const radius = Phaser.Math.FloatBetween(0.32, 1.0);
    const sprite = this.add.image(this.W / 2, this.H / 2, 'obstacle');
    this.obstacles.push({
      sprite,
      wx: Math.cos(angle) * radius,
      wy: Math.sin(angle) * radius,
      z: CONFIG.persp.zFar,
      speedMul: Phaser.Math.FloatBetween(0.85, 1.15),
    });
  }

  _spawnOrb() {
    const angle = Math.random() * Math.PI * 2;
    const radius = Phaser.Math.FloatBetween(0.35, 1.0);
    const sprite = this.add.image(this.W / 2, this.H / 2, 'orb');
    this.orbs.push({
      sprite,
      wx: Math.cos(angle) * radius,
      wy: Math.sin(angle) * radius,
      z: CONFIG.persp.zFar,
      speedMul: 1,
    });
  }

  // ---------- ACTUALIZAR OBJETOS EN PERSPECTIVA ----------
  _updateObjects(dt) {
    const P = CONFIG.persp;
    const cx = this.W / 2, cy = this.H / 2;
    const spreadX = this.W * P.spreadX;
    const spreadY = this.H * P.spreadY;
    const zSpeed = Phaser.Math.Linear(
      CONFIG.diff.zSpeedStart, CONFIG.diff.zSpeedEnd,
      Math.pow(GameState.intensity, CONFIG.diff.exponent)
    );

    // Obstáculos
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.z -= zSpeed * o.speedMul * dt;
      if (o.z <= P.zNear) { o.sprite.destroy(); this.obstacles.splice(i, 1); continue; }

      const scale = P.focal / o.z;
      o.sprite.setPosition(cx + (o.wx * spreadX) / o.z, cy + (o.wy * spreadY) / o.z);
      o.sprite.setScale(scale);
      o.sprite.setDepth(Math.round(1000 - o.z * 100));
      o.sprite.setAlpha(Phaser.Math.Clamp(1.15 - o.z * 0.14, 0.25, 1));

      if (scale > P.hitScale && GameState.elapsed >= this._invUntil && this._overlapsShip(o.sprite)) {
        o.sprite.destroy(); this.obstacles.splice(i, 1);
        this._hit(o);
      }
    }

    // Orbes (se recogen al tocarlos)
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.z -= zSpeed * dt;
      if (o.z <= P.zNear) { o.sprite.destroy(); this.orbs.splice(i, 1); continue; }

      const scale = P.focal / o.z;
      o.sprite.setPosition(cx + (o.wx * spreadX) / o.z, cy + (o.wy * spreadY) / o.z);
      o.sprite.setScale(scale);
      o.sprite.setDepth(Math.round(1000 - o.z * 100));

      if (scale > 0.45 && this._overlapsShip(o.sprite)) {
        o.sprite.destroy(); this.orbs.splice(i, 1);
        GameState.score += CONFIG.scorePerOrb;
        EventBus.emit(EVENTS.ORB, { x: o.sprite.x, y: o.sprite.y });
      }
    }
  }

  _overlapsShip(sprite) {
    const dx = Math.abs(sprite.x - this.player.x);
    const dy = Math.abs(sprite.y - this.player.y);
    const ow = sprite.displayWidth * 0.5 * 0.8;
    const oh = sprite.displayHeight * 0.5 * 0.8;
    const pw = this.player.displayWidth * 0.5 * 0.55;
    const ph = this.player.displayHeight * 0.5 * 0.55;
    return dx < ow + pw && dy < oh + ph;
  }

  _hit(o) {
    GameState.glitch = Math.min(1, GameState.glitch + CONFIG.collisionGlitch);
    GameState.stability -= CONFIG.collisionDamage;
    this._invUntil = GameState.elapsed + CONFIG.iFrames;
    EventBus.emit(EVENTS.COLLISION, { x: this.player.x, y: this.player.y });
  }

  _onResize() {
    // Mantener la nave dentro de los nuevos límites.
    if (this.player) {
      this.player.x = Phaser.Math.Clamp(this.player.x, 26, this.scale.width - 26);
      this.player.y = Phaser.Math.Clamp(this.player.y, 26, this.scale.height - 26);
    }
  }

  _win() {
    if (GameState.gameOver) return;
    GameState.running = false;
    EventBus.emit(EVENTS.GAME_WIN, { score: Math.floor(GameState.score) });
    this._endScreen('¡SINFONÍA COMPLETA!', '#44ff88', 'Mantuviste el ritmo hasta el final.');
  }

  _gameOver() {
    GameState.gameOver = true;
    GameState.running = false;
    EventBus.emit(EVENTS.GAME_OVER, { score: Math.floor(GameState.score) });
    this._endScreen('LA CANCIÓN COLAPSÓ', '#ff4466', 'Demasiado caos rompió la melodía.');
  }

  _endScreen(title, color, subtitle) {
    const cx = this.scale.width / 2, cy = this.scale.height / 2;
    this.add.text(cx, cy - 70, title, { fontSize: '52px', color, fontStyle: 'bold' }).setOrigin(0.5).setDepth(2000);
    this.add.text(cx, cy - 10, subtitle, { fontSize: '20px', color: '#ffffff' }).setOrigin(0.5).setDepth(2000);
    this.add.text(cx, cy + 35, 'Puntaje: ' + Math.floor(GameState.score), { fontSize: '26px', color: '#ffee44' }).setOrigin(0.5).setDepth(2000);
    this.add.text(cx, cy + 90, 'Presiona R para reiniciar', { fontSize: '18px', color: '#aaaaaa' }).setOrigin(0.5).setDepth(2000);
    this.input.keyboard.once('keydown-R', () => {
      EventBus.emit(EVENTS.RESET);
      this.scene.restart();
    });
  }

  // ---------- helpers de texturas ----------
  _makeShipTexture(key, size, color) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(color);
    g.beginPath();
    g.moveTo(size / 2, 0);
    g.lineTo(size, size);
    g.lineTo(size / 2, size * 0.75);
    g.lineTo(0, size);
    g.closePath();
    g.fillPath();
    g.generateTexture(key, size, size);
    g.destroy();
  }
  _makeObstacleTexture(key, size, color) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(color);
    g.fillRect(0, 0, size, size);
    g.lineStyle(4, 0xffffff, 0.9);
    g.strokeRect(0, 0, size, size);
    g.generateTexture(key, size, size);
    g.destroy();
  }
  _makeCircleTexture(key, r, color) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(color);
    g.fillCircle(r, r, r);
    g.generateTexture(key, r * 2, r * 2);
    g.destroy();
  }
}
