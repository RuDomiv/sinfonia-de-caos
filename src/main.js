import Phaser from 'phaser';
import GameScene from './scenes/GameScene.js';
import MenuScene from './scenes/MenuScene.js';

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 500,
  backgroundColor: '#1a1a2e',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 600 }, debug: false },
  },
  scene: [MenuScene, GameScene],
};

new Phaser.Game(config);
