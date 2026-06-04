// ============================================================
//  GAMESCENE — Orquestador + MECÁNICAS.   👤 DUEÑO: Persona 1 (Motor)
//
//  Responsabilidades:
//   - Avanzar la línea de tiempo (elapsed, progress, phase, intensity, bpm).
//   - Mover nave, generar obstáculos y orbes, detectar colisiones.
//   - ESCRIBIR en GameState y EMITIR eventos.
//   - Instanciar los managers de Audio y Visual/UI (1 línea cada uno).
//
//  ⚠️ Persona 2 y 3: NO editen este archivo. Trabajen en sus managers.
//     Si necesitan un evento o dato nuevo, pídanlo y lo agrego aquí.
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
    // Persona 2 carga aquí sus audios (ver AudioManager.preload).
    AudioManager.preload(this);
  }

  create() {
    resetState();
    GameState.running = true;

    // Limpia suscripciones viejas del EventBus (evita fugas al reiniciar con R).
    EventBus.removeAllListeners();

    // --- Texturas simples generadas por código (sin assets externos) ---
    this._makeTexture('ship', 34, 22, 0x00ffff);
    this._makeTexture('obstacle', 26, 60, 0xff2266);
    this._makeCircleTexture('orb', 9, 0xffee44);

    // --- Managers de los otros 2 (cada uno se auto-suscribe al EventBus) ---
    this.visuals = new VisualManager(this);   // Persona 3
    this.audio = new AudioManager(this);       // Persona 2
    this.hud = new HUD(this);                   // Persona 3

    // --- Jugador ---
    this.player = this.physics.add.sprite(120, CONFIG.height / 2, 'ship');
    this.player.body.allowGravity = false;
    this.player.setCollideWorldBounds(true);

    // --- Grupos ---
    this.obstacles = this.physics.add.group();
    this.orbs = this.physics.add.group();

    this.physics.add.overlap(this.player, this.obstacles, this._onCollision, null, this);
    this.physics.add.overlap(this.player, this.orbs, this._onOrb, null, this);

    // --- Controles ---
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });

    // --- Spawners (la frecuencia se ajusta con la intensidad) ---
    this._obstacleTimer = 0;
    this._orbTimer = 0;

    // --- DEBUG (solo pruebas de Persona 1): saltar en la línea de tiempo ---
    // Tecla 1 = inicio | 2 = empieza el DROP (1:00) | 3 = casi el final (1:55)
    // Quitar antes de la demo final si quieren (es inofensivo).
    this.input.keyboard.on('keydown-ONE', () => { GameState.elapsed = 0; });
    this.input.keyboard.on('keydown-TWO', () => { GameState.elapsed = CONFIG.buildEnd; });
    this.input.keyboard.on('keydown-THREE', () => { GameState.elapsed = CONFIG.duration - 5; });
  }

  update(time, delta) {
    if (!GameState.running) return;
    const dt = delta / 1000;

    this._advanceTimeline(dt);
    this._handleInput();
    this._spawn(dt);
    this._scroll(dt);

    EventBus.emit(EVENTS.TICK, GameState); // Audio y Visual/UI reaccionan
  }

  // ---------- LÍNEA DE TIEMPO MAESTRA ----------
  _advanceTimeline(dt) {
    GameState.elapsed += dt;
    GameState.progress = Math.min(GameState.elapsed / CONFIG.duration, 1);

    // Recuperación del glitch de colisión
    GameState.glitch = Math.max(0, GameState.glitch - CONFIG.glitchRecovery * dt);
    // Regeneración de estabilidad
    GameState.stability = Math.min(CONFIG.stabilityMax, GameState.stability + CONFIG.stabilityRegen * dt);

    // intensity = curva del tiempo (build 0→0.65, drop 0.65→1) menos el glitch
    const p = GameState.progress;
    let target;
    if (p < 0.5) target = (p / 0.5) * 0.65;
    else target = 0.65 + ((p - 0.5) / 0.5) * 0.35;
    GameState.intensity = Phaser.Math.Clamp(target - GameState.glitch, 0, 1);
    GameState.bpm = Math.round(CONFIG.bpmBase + GameState.intensity * (CONFIG.bpmMax - CONFIG.bpmBase));

    // Cambio de fase
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

  _handleInput() {
    const speed = 320;
    let vx = 0, vy = 0;
    if (this.cursors.up.isDown || this.wasd.up.isDown) vy = -speed;
    if (this.cursors.down.isDown || this.wasd.down.isDown) vy = speed;
    if (this.cursors.left.isDown || this.wasd.left.isDown) vx = -speed;
    if (this.cursors.right.isDown || this.wasd.right.isDown) vx = speed;
    this.player.setVelocity(vx, vy);
  }

  _spawn(dt) {
    // Cuanto mayor la intensidad, más obstáculos y más rápido.
    const obsInterval = Phaser.Math.Linear(1.4, 0.45, GameState.intensity);
    this._obstacleTimer += dt;
    if (this._obstacleTimer >= obsInterval) {
      this._obstacleTimer = 0;
      const y = Phaser.Math.Between(40, CONFIG.height - 40);
      const o = this.obstacles.create(CONFIG.width + 30, y, 'obstacle');
      o.body.allowGravity = false;
    }

    this._orbTimer += dt;
    if (this._orbTimer >= 1.6) {
      this._orbTimer = 0;
      const y = Phaser.Math.Between(40, CONFIG.height - 40);
      const orb = this.orbs.create(CONFIG.width + 30, y, 'orb');
      orb.body.allowGravity = false;
    }
  }

  _scroll(dt) {
    const speed = Phaser.Math.Linear(160, 460, GameState.intensity);
    this.obstacles.getChildren().forEach((o) => {
      o.x -= speed * dt;
      if (o.x < -40) o.destroy();
    });
    this.orbs.getChildren().forEach((o) => {
      o.x -= speed * dt;
      if (o.x < -40) o.destroy();
    });
  }

  _onCollision(player, obstacle) {
    obstacle.destroy();
    GameState.glitch = Math.min(1, GameState.glitch + CONFIG.collisionGlitch);
    GameState.stability -= CONFIG.collisionDamage;
    EventBus.emit(EVENTS.COLLISION, { x: player.x, y: player.y });
  }

  _onOrb(player, orb) {
    orb.destroy();
    GameState.score += CONFIG.scorePerOrb;
    EventBus.emit(EVENTS.ORB, { x: player.x, y: player.y });
  }

  _win() {
    if (GameState.gameOver) return;
    GameState.running = false;
    EventBus.emit(EVENTS.GAME_WIN, { score: Math.floor(GameState.score) });
    this._endScreen('¡SINFONÍA COMPLETA!', '#44ff88',
      'Mantuviste el ritmo hasta el final.');
  }

  _gameOver() {
    GameState.gameOver = true;
    GameState.running = false;
    EventBus.emit(EVENTS.GAME_OVER, { score: Math.floor(GameState.score) });
    this._endScreen('LA CANCIÓN COLAPSÓ', '#ff4466',
      'Demasiado caos rompió la melodía.');
  }

  _endScreen(title, color, subtitle) {
    const cx = CONFIG.width / 2, cy = CONFIG.height / 2;
    this.add.text(cx, cy - 60, title, { fontSize: '46px', color, fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(cx, cy, subtitle, { fontSize: '18px', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(cx, cy + 40, 'Puntaje: ' + Math.floor(GameState.score), { fontSize: '24px', color: '#ffee44' }).setOrigin(0.5);
    this.add.text(cx, cy + 90, 'Presiona R para reiniciar', { fontSize: '18px', color: '#aaaaaa' }).setOrigin(0.5);
    this.input.keyboard.once('keydown-R', () => {
      EventBus.emit(EVENTS.RESET);
      this.scene.restart();
    });
  }

  // ---------- helpers de texturas ----------
  _makeTexture(key, w, h, color) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(color); g.fillRect(0, 0, w, h);
    g.generateTexture(key, w, h); g.destroy();
  }
  _makeCircleTexture(key, r, color) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(color); g.fillCircle(r, r, r);
    g.generateTexture(key, r * 2, r * 2); g.destroy();
  }
}
