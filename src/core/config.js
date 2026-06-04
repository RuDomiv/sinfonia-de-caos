// ============================================================
//  CONFIG — Constantes compartidas y "tuning" del juego.
//  CONTRATO: cualquiera puede LEER esto. Para CAMBIAR un valor,
//  avisa al equipo (afecta a los 3). No renombrar claves.
//
//  ⚠️ El TAMAÑO de pantalla ya NO es fijo: el juego es responsive
//     y llena toda la ventana. Para posiciones usa
//     scene.scale.width / scene.scale.height (NO un ancho fijo).
// ============================================================

export const CONFIG = {
  // --- Línea de tiempo maestra (en segundos) ---
  duration: 80,    // duración total del juego
  buildEnd: 28,    // 0–28s = build (mas corto) | 28–80s = drop

  // --- BPM (derivado de la intensidad) ---
  bpmBase: 90,
  bpmMax: 160,

  // --- Colisiones: bajan intensidad + bpm + vibración ---
  collisionGlitch: 0.25,   // cuánto cae la intensidad al chocar (0..1)
  glitchRecovery: 0.4,     // recuperación de intensidad por segundo
  collisionShake: 0.012,   // fuerza de la vibración visual (la usa Persona 3)
  iFrames: 0.8,            // segundos de invencibilidad tras un golpe

  // --- Estabilidad (condición de derrota) ---
  stabilityMax: 100,
  collisionDamage: 17,     // estabilidad perdida por golpe (mas duro)
  stabilityRegen: 4,       // estabilidad recuperada por segundo (menos perdon)

  // --- Puntaje ---
  scorePerSecond: 10,
  scorePerOrb: 50,

  // --- PERSPECTIVA (efecto túnel estilo Star Wars) ---
  // Los obstáculos nacen en el centro (lejos) y crecen al acercarse.
  persp: {
    zFar: 5.0,      // profundidad de aparición (lejos, pequeño)
    zNear: 0.55,    // profundidad de "cámara": al cruzarla, desaparece
    focal: 1.35,    // escala = focal / z  → TODO MAS GRANDE al acercarse
    spreadX: 0.55,  // dispersión horizontal (vienen mas abiertos = mas dificil)
    spreadY: 0.55,  // dispersión vertical
    hitScale: 0.55, // solo hay colisión cuando el obstáculo es así de grande
  },

  // --- DIFICULTAD (escala con la intensidad; sube fuerte en el DROP) ---
  diff: {
    spawnStart: 1.6,   // MENOS objetos al inicio
    spawnEnd: 0.55,    // MENOS objetos al final (pero grandes y dificiles)
    zSpeedStart: 0.8,  // mas LENTO al inicio
    zSpeedEnd: 2.6,    // mas LENTO al final
    exponent: 1.7,     // >1 = la dificultad se dispara cerca del final
    orbInterval: 1.5,  // segundos entre orbes
  },
};

// Las 4 fases del juego. TODOS usan estos strings exactos.
export const PHASE = {
  CALM: 'calm',         // primeros segundos del build, muy tranquilo
  BUILD: 'build',       // la música/visuales crecen
  DROP: 'drop',         // dificultad e intensidad máximas
  COMPLETE: 'complete', // se terminó el juego (victoria)
};
