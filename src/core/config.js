// ============================================================
//  CONFIG — Constantes compartidas y "tuning" del juego.
//  CONTRATO: cualquiera puede LEER esto. Para CAMBIAR un valor,
//  avisa al equipo (afecta a los 3). No renombrar claves.
// ============================================================

export const CONFIG = {
  width: 800,
  height: 500,

  // --- Línea de tiempo maestra (en segundos) ---
  duration: 120,   // duración total del juego: 2 minutos
  buildEnd: 60,    // 0–60s = build (de calma a intenso) | 60–120s = drop

  // --- BPM (derivado de la intensidad) ---
  bpmBase: 90,
  bpmMax: 160,

  // --- Colisiones: bajan intensidad + bpm + vibración ---
  collisionGlitch: 0.25,   // cuánto cae la intensidad al chocar (0..1)
  glitchRecovery: 0.4,     // cuánto se recupera la intensidad por segundo
  collisionShake: 0.012,   // fuerza de la vibración visual al chocar

  // --- Estabilidad (condición de derrota) ---
  stabilityMax: 100,
  collisionDamage: 18,     // estabilidad perdida por golpe
  stabilityRegen: 4,       // estabilidad recuperada por segundo

  // --- Puntaje ---
  scorePerSecond: 10,
  scorePerOrb: 50,
};

// Las 4 fases del juego. TODOS usan estos strings exactos.
export const PHASE = {
  CALM: 'calm',         // primeros segundos del build, muy tranquilo
  BUILD: 'build',       // la música/visuales crecen
  DROP: 'drop',         // dificultad e intensidad máximas
  COMPLETE: 'complete', // se terminó el juego (victoria)
};
