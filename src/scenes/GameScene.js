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
    this._makeShipTexture('ship', 56, 0x00ffff);
    this._makeObstacleTexture('obstacle', 112, 0xff2266);
    this._makeCircleTexture('orb', 22, 0xffee44);

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

    // --- PAUSA (boton clicable + tecla ESC / P) ---
    this.paused = false;
    this._buildPauseUI();
    this.input.keyboard.on('keydown-ESC', () => this._togglePause());
    this.input.keyboard.on('keydown-P', () => this._togglePause());

    // Reposicionar al cambiar tamaño de ventana.
    this.scale.on('resize', this._onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this._onResize, this));
  }

  update(time, delta) {
    if (!GameState.running) return;
    if (this.paused) return;
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
    const mx = this.player.displayWidth / 2;
    const my = this.player.displayHeight / 2;
    this.player.x = Phaser.Math.Clamp(this.player.x + vx * dt, mx, this.W - mx);
    this.player.y = Phaser.Math.Clamp(this.player.y + vy * dt, my, this.H - my);

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

  // ---------- PAUSA + MUERTE ----------
  _buildPauseUI() {
    const FONT = '"Courier New", monospace';
    const W = this.scale.width, H = this.scale.height;
    this.pauseBtn = this.add.text(W - 16, 46, '[ PAUSA ]', {
      fontFamily: FONT, fontSize: '18px', color: '#00ffff', fontStyle: 'bold',
    }).setOrigin(1, 0).setDepth(3000).setScrollFactor(0).setStroke('#003344', 4)
      .setInteractive({ useHandCursor: true });
    this.pauseBtn.on('pointerdown', () => this._togglePause());

    this.pauseOverlay = this.add.container(0, 0).setDepth(2990).setVisible(false);
    const bg = this.add.rectangle(0, 0, W, H, 0x05010f, 0.82).setOrigin(0, 0);
    const t = this.add.text(W / 2, H / 2 - 30, 'PAUSA', {
      fontFamily: FONT, fontSize: '64px', color: '#00ffff', fontStyle: 'bold',
    }).setOrigin(0.5).setStroke('#aa008a', 8).setShadow(4, 4, '#ff2bb0', 0, true, true);
    const hint = this.add.text(W / 2, H / 2 + 40, 'ESC / P / CLICK para continuar', {
      fontFamily: FONT, fontSize: '18px', color: '#cfd0ff',
    }).setOrigin(0.5);
    this.pauseOverlay.add([bg, t, hint]);
  }

  _togglePause() {
    if (!GameState.running || GameState.gameOver) return;
    this.paused = !this.paused;
    this.pauseOverlay.setVisible(this.paused);
    if (this.pauseBtn) this.pauseBtn.setText(this.paused ? '[ SEGUIR ]' : '[ PAUSA ]');
    if (this.paused) {
      this.tweens.pauseAll();
      this.time.paused = true;
      if (this.audio && this.audio.pause) this.audio.pause();
    } else {
      this.tweens.resumeAll();
      this.time.paused = false;
      if (this.audio && this.audio.resume) this.audio.resume();
    }
  }

  // La llama el VisualManager cuando la nave entra a un agujero negro.
  killShip() {
    if (!GameState.running || GameState.gameOver) return;
    GameState.glitch = 1;
    GameState.stability = 0;
    this._gameOver();
  }

  _onResize() {
    // Mantener la nave dentro de los nuevos límites.
    if (this.player) {
      const mx = this.player.displayWidth / 2;
      const my = this.player.displayHeight / 2;
      this.player.x = Phaser.Math.Clamp(this.player.x, mx, this.scale.width - mx);
      this.player.y = Phaser.Math.Clamp(this.player.y, my, this.scale.height - my);
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
    const FONT = '"Courier New", monospace';
    const cx = this.scale.width / 2, cy = this.scale.height / 2;
    if (this.pauseBtn) this.pauseBtn.setVisible(false);
    if (this.pauseOverlay) this.pauseOverlay.setVisible(false);
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x05010f, 0.72).setOrigin(0, 0).setDepth(1999);
    this.add.text(cx, cy - 70, title, { fontFamily: FONT, fontSize: '54px', color, fontStyle: 'bold' }).setOrigin(0.5).setDepth(2000).setStroke('#000018', 8);
    this.add.text(cx, cy - 10, subtitle, { fontFamily: FONT, fontSize: '18px', color: '#cfd0ff' }).setOrigin(0.5).setDepth(2000);
    this.add.text(cx, cy + 35, 'PUNTAJE: ' + Math.floor(GameState.score), { fontFamily: FONT, fontSize: '26px', color: '#ffee44', fontStyle: 'bold' }).setOrigin(0.5).setDepth(2000).setStroke('#5a4a00', 4);
    this.add.text(cx, cy + 90, '> PRESIONA R PARA REINICIAR <', { fontFamily: FONT, fontSize: '18px', color: '#00ffff' }).setOrigin(0.5).setDepth(2000);
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
