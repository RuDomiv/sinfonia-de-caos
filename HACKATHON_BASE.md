# 🎵 Sinfonía de Caos — Base del Equipo

> Hackathon Platzi | Tiempo: **90 min** | Equipo: **3 personas** | Corre en **Chrome**

---

## 🧠 La Idea (versión final)

Un juego de **nave en scroll lateral** con una **línea de tiempo musical de 2 minutos**:

```
0:00 ──────── 1:00 ──────────── 2:00
  CALMA → BUILD-UP      DROP (máx)   → SINFONÍA COMPLETA
  música suave   crece   intensidad y dificultad máximas
```

- La música **empieza muy tranquila** y **crece progresivamente** durante el primer minuto.
- En el minuto 2 entra el **DROP**: dificultad e intensidad al máximo.
- Si sobrevives los 2 minutos → **completas la sinfonía** (mensaje final + victoria).
- **Las visuales están sincronizadas con la música** y evolucionan con ella.
- **Al chocar:** distorsión de sonido + **bajan los BPM** + **vibración visual** (la pantalla tiembla).

**El momento WOW:** ver y oír cómo todo el mundo (color, partículas, capas de audio) crece junto, y cómo cada golpe "glitchea" la canción.

---

## 🔑 EL SECRETO PARA TRABAJAR LOS 3 EN PARALELO

Todo gira en torno a **un solo valor maestro: `intensity` (0 a 1)**.

- **Persona 1 (Motor)** es la ÚNICA que **escribe** `intensity` (lo calcula desde la línea de tiempo).
- **Persona 2 (Audio)** y **Persona 3 (Visual/UI)** solo **LEEN** `intensity` y reaccionan.

Como audio y visuales leen **el mismo número**, quedan **sincronizados automáticamente** sin tener que hablar entre ellos. 🎯

La comunicación es por **eventos** (EventBus), no editando el código del otro. Por eso **cada persona toca solo SUS archivos** → al unir no hay conflictos.

---

## 📁 Quién toca qué archivo (NO se pisan)

```
src/
├── core/                  ← 🔒 CONTRATO COMPARTIDO (no cambiar sin avisar a los 3)
│   ├── config.js          ←     constantes y tuning
│   ├── GameState.js       ←     estado único (intensity, bpm, score, phase...)
│   └── EventBus.js        ←     canal de eventos entre módulos
│
├── scenes/
│   ├── GameScene.js       ← 👤 PERSONA 1 (Motor + mecánicas)
│   └── MenuScene.js       ← 👤 PERSONA 3 (menú e instrucciones)
│
├── audio/
│   └── AudioManager.js    ← 👤 PERSONA 2 (audio reactivo)
│
├── visuals/
│   └── VisualManager.js   ← 👤 PERSONA 3 (efectos sincronizados)
│
└── ui/
    └── HUD.js             ← 👤 PERSONA 3 (puntaje, barras, fase)
```

> ⚠️ **REGLA #1:** nadie edita un archivo que no es suyo. Si necesitas un dato o evento nuevo del Motor, **pídeselo a Persona 1** y ella lo agrega al contrato.

---

## 📜 EL CONTRATO (lo que todos deben conocer)

### `GameState` — solo lo lees (excepto Persona 1)
| Campo | Rango | Significado |
|---|---|---|
| `intensity` | 0–1 | **valor maestro**: audio y visuales se sincronizan con esto |
| `progress` | 0–1 | avance de la línea de tiempo (tiempo / 120s) |
| `bpm` | 90–160 | derivado de la intensidad |
| `phase` | `calm`/`build`/`drop`/`complete` | fase actual |
| `score` | número | puntaje |
| `stability` | 0–100 | baja al chocar; si llega a 0 → game over |
| `glitch` | 0–1 | bajón temporal por colisión (para distorsión) |

### `EventBus` — eventos que emite el Motor (los demás escuchan)
| Evento | Cuándo | Payload |
|---|---|---|
| `TICK` | cada frame | `GameState` completo |
| `PHASE_CHANGE` | cambia de fase | `{ from, to }` |
| `COLLISION` | choca con obstáculo | `{ x, y }` |
| `ORB` | recoge un orbe | `{ x, y }` |
| `GAME_WIN` | completa los 2 min | `{ score }` |
| `GAME_OVER` | estabilidad = 0 | `{ score }` |
| `RESET` | reinicia partida | — |

**Cómo escuchar (Persona 2 y 3):**
```js
import { EventBus, EVENTS } from '../core/EventBus.js';
EventBus.on(EVENTS.TICK, (state) => {
  // reacciona a state.intensity, state.phase, etc.
});
EventBus.on(EVENTS.COLLISION, ({ x, y }) => { /* distorsión / vibración */ });
```

---

## 👥 División del Equipo (90 minutos)

### 🔴 PERSONA 1 — Motor & Mecánicas
**Archivos:** `core/*` (ya hechos) + `scenes/GameScene.js`
**Tu trabajo es que el juego corra y se sienta bien jugarlo. Tú alimentas el `intensity`.**

- **0–15:** Probar que el esqueleto corre (`npm run dev`). Ajustar movimiento de la nave.
- **15–45:** Afinar la **curva de intensidad** y dificultad por fase. Spawns de obstáculos/orbes que escalen con `intensity`. Verificar colisiones (bajan estabilidad + emiten `COLLISION`).
- **45–70:** Balancear: que el primer minuto sea cómodo y el DROP sea intenso pero jugable. Condición de victoria (llegar a 2:00) y derrota (estabilidad 0).
- **70–90:** Testing con los otros 2 ya integrados. Botón **R** de reinicio funcionando.

### 🔵 PERSONA 2 — Audio Reactivo
**Archivo:** `audio/AudioManager.js`
**Tu trabajo es la música por capas que crece con `intensity`.**

- **0–20:** Conseguir/generar 3 capas de música que **encajen entre sí** (mismo tempo y tono):
  - `base_loop` — suave, siempre suena
  - `mid_layer` — melodía/sintes (sube de volumen con `intensity`)
  - `lead_drop` — lead pesado (entra fuerte en fase `drop`)
  - `hit_distort` — golpe corto + `orb_synth` — nota dorada
  - Fuentes: **freesound.org**, **pixabay.com/music**, o IA (**Suno / Udio / ElevenLabs SFX**).
  - Guardar en `juego-hackathon/public/audio/`
- **20–55:** En `AudioManager`, mezclar volúmenes según `state.intensity` en `onTick`. En `COLLISION` → bajar `rate` (pitch/distorsión) + sonido de golpe. En `ORB` → nota dorada.
- **55–80:** Que el DROP (`PHASE_CHANGE → drop`) se sienta épico. Ajustar volúmenes para que no sature.
- **80–90:** Pulir mezcla con Persona 1 jugando en vivo.

> 💡 Si no consigues 3 stems sincronizados a tiempo: usa **1 loop** y sube/baja su volumen y `rate` con la intensidad. Mejor simple que roto.

### 🟢 PERSONA 3 — Visuales, UI & Demo (+ Devin)
**Archivos:** `visuals/VisualManager.js`, `ui/HUD.js`, `scenes/MenuScene.js`
**Tu trabajo es que se vea increíble, esté completo y luzca en la presentación.**

- **0–20:** Usar **Devin** para generar efectos visuales neón (partículas, grid de fondo, brillo de la nave) sincronizados con `intensity`. Revisar e integrar en `VisualManager`.
- **20–50:** En `VisualManager.onTick`: fondo/colores/partículas que crecen con `intensity`. En `COLLISION`: **vibración** (camera shake — ya está el esqueleto) + flash. En `PHASE_CHANGE → drop`: efecto WOW (zoom punch). Pulir `HUD` (barras de intensidad y estabilidad, fase, puntaje).
- **50–70:** `MenuScene` con instrucciones claras (ya hay base). Verificar pantallas de victoria/derrota y botón **R**.
- **70–90:** Preparar y ensayar la **demo de 90 segundos**.

---

## ✅ Checklist de Rúbrica (apunta a los 100 pts)

| Criterio | Pts | Responsable | Estado |
|---|---|---|---|
| Juego funcional en Chrome (no se rompe) | 30 | Persona 1 | ⬜ |
| Jugabilidad y diversión | 20 | Persona 1 | ⬜ |
| Uso de IA (**Devin como principal**) | 15 | Persona 3 | ⬜ |
| Creatividad y momento WOW | 15 | Todos (drop sync) | ⬜ |
| Calidad visual y sonora | 10 | Personas 2 y 3 | ⬜ |
| Demo y comunicación (90s) | 10 | Persona 3 | ⬜ |

### Requisitos obligatorios del reglamento
- [ ] Pantalla inicial con instrucciones (`MenuScene`)
- [ ] Cómo se juega + puntaje + condición de cierre visibles
- [ ] Botón de reinicio (tecla **R**)
- [ ] Momento WOW (el DROP audiovisual)
- [ ] IA con **Devin como principal** — documentar qué generó
- [ ] Transparencia: anotar TODAS las herramientas usadas (ver abajo)
- [ ] Template 100% propio (no partimos de un repo open source) ✅ este proyecto es nuestro

---

## 🎤 Demo de 90 Segundos

```
0:00–0:12  "Sinfonía de Caos: un juego de 2 minutos donde la música
            crece contigo y tus errores la distorsionan."
0:12–0:50  Live en Chrome: jugar el build-up. Mostrar cómo el fondo,
            las partículas y la música suben JUNTOS con la intensidad.
            Chocar una vez → mostrar la vibración + distorsión de audio.
0:50–1:05  "Usamos Devin para [parte concreta]. Stack: Phaser 3 +
            Web Audio API, 100% en el navegador, template propio."
1:05–1:30  EL WOW: llegar al DROP. Todo al máximo, audiovisual sincronizado.
            Cerrar: "completas la sinfonía si mantienes el ritmo."
```

> Consejo: pre-jueguen hasta cerca del minuto 1:00 ANTES de presentar, para que el DROP caiga justo dentro de los 90s. O agreguen un atajo de debug para saltar a la fase drop.

---

## 🧾 Transparencia de Herramientas (rellenar durante el hackathon)

| Herramienta | Para qué la usamos | Quién |
|---|---|---|
| Devin | _(ej: generó la lógica de partículas)_ | Persona 3 |
| Phaser 3 | motor de juego | Todos |
| Vite | servidor/build | Todos |
| Suno/Udio/ElevenLabs | _(si generan audio con IA)_ | Persona 2 |
| Freesound/Pixabay | _(si usan samples libres)_ | Persona 2 |
| Claude Code | scaffolding inicial del proyecto | — |

---

## ⚡ Reglas de Equipo

1. **Commit cada 15 min:** `git add . && git commit -m "checkpoint"`
2. **Regla de los 20 min:** si algo se atasca 20 min, versión más simple y seguir.
3. **Prioridad #1:** que corra sin errores en Chrome (revisar la consola F12).
4. **El audio es lo primero en sacrificarse** si falta tiempo: el juego debe funcionar mudo.
5. **No editar archivos ajenos.** Pedir cambios al dueño del archivo.
6. **El contrato (`core/`) es sagrado:** cambios se acuerdan entre los 3.

---

## 🚀 Empezar Ahora

```bash
cd juego-hackathon
npm run dev          # → http://localhost:5173  (ábranlo en Chrome)
```

> El esqueleto **ya corre y es jugable** (nave, obstáculos, orbes, fases, HUD, vibración al chocar, victoria/derrota, reinicio). Cada persona ahora **profundiza su parte** sobre esta base.

Archivos del contrato (ya listos, no tocar sin avisar):
[config.js](juego-hackathon/src/core/config.js) · [GameState.js](juego-hackathon/src/core/GameState.js) · [EventBus.js](juego-hackathon/src/core/EventBus.js)

---

*Documento del equipo · Hackathon Platzi 2026 · scaffolding con Claude Code*
