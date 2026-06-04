// ============================================================
//  GAMESTATE — La ÚNICA fuente de verdad del juego.
//
//  CONTRATO ENTRE LOS 3:
//   - Persona 1 (Motor) ESCRIBE estos valores cada frame.
//   - Persona 2 (Audio)   solo LEE intensity / phase / bpm.
//   - Persona 3 (Visual/UI) solo LEE intensity / phase / score / stability.
//
//  Nadie fuera del Motor debe escribir aquí. Si necesitas un dato
//  nuevo, AVISA y se agrega una clave (no se renombran las existentes).
// ============================================================

import { CONFIG, PHASE } from './config.js';

export const GameState = {
  running: false,
  elapsed: 0,        // segundos transcurridos
  progress: 0,       // 0..1 avance de la línea de tiempo (elapsed / duration)
  intensity: 0,      // 0..1 VALOR MAESTRO → audio y visuales se sincronizan con esto
  glitch: 0,         // bajón temporal de intensidad por colisión (0..1)
  bpm: CONFIG.bpmBase,
  phase: PHASE.CALM, // 'calm' | 'build' | 'drop' | 'complete'
  score: 0,
  stability: CONFIG.stabilityMax, // llega a 0 → game over
  gameOver: false,
};

export function resetState() {
  GameState.running = false;
  GameState.elapsed = 0;
  GameState.progress = 0;
  GameState.intensity = 0;
  GameState.glitch = 0;
  GameState.bpm = CONFIG.bpmBase;
  GameState.phase = PHASE.CALM;
  GameState.score = 0;
  GameState.stability = CONFIG.stabilityMax;
  GameState.gameOver = false;
}
