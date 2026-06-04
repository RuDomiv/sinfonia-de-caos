import Phaser from 'phaser';
import GameScene from './scenes/GameScene.js';
import MenuScene from './scenes/MenuScene.js';

const config = {
  type: Phaser.AUTO,
  pixelArt: true,
  roundPixels: true,
  parent: 'game',
  backgroundColor: '#05010f',
  scale: {
    mode: Phaser.Scale.RESIZE,        // el canvas llena toda la ventana
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  scene: [MenuScene, GameScene],
};

new Phaser.Game(config);
