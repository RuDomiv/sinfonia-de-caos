// ============================================================
//  EVENTBUS — Canal de comunicación entre los 3 módulos.
//
//  El Motor (Persona 1) EMITE eventos.
//  Audio (Persona 2) y Visual/UI (Persona 3) ESCUCHAN.
//  Así nadie necesita llamar funciones del código de otro.
//
//  Uso:
//    import { EventBus, EVENTS } from '../core/EventBus.js';
//    EventBus.emit(EVENTS.COLLISION, { x, y });        // emitir
//    EventBus.on(EVENTS.COLLISION, (data) => { ... }); // escuchar
// ============================================================

import Phaser from 'phaser';

export const EventBus = new Phaser.Events.EventEmitter();

export const EVENTS = {
  TICK: 'tick',                 // cada frame: payload = GameState (ya actualizado)
  PHASE_CHANGE: 'phase-change', // cambió de fase: payload = { from, to }
  COLLISION: 'collision',       // el jugador chocó: payload = { x, y }
  ORB: 'orb-collected',         // recogió un orbe: payload = { x, y }
  GAME_WIN: 'game-win',         // completó los 2 minutos: payload = { score }
  GAME_OVER: 'game-over',       // estabilidad llegó a 0: payload = { score }
  RESET: 'reset',               // se reinició la partida: sin payload
};
