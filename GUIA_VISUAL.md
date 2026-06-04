# 🎮 Sinfonía de Caos — Guía para el colaborador visual

## 📁 Tu archivo
`src/VisualManager.js` — es el ÚNICO archivo que debes tocar.

---

## 🏗️ Arquitectura del proyecto (lo que necesitas saber)

### Stack
- **Phaser 4.1.0** — motor del juego
- **Vite** — servidor de desarrollo
- **Canvas:** 800 × 500 px

### Cómo corre el juego
```
GameScene.js  (Persona 1 — NO tocar)
  └── crea: this.visualManager = new VisualManager(this)
  └── genera texturas base: 'ship', 'obstacle', 'orb'
  └── crea grupos: this.obstacles, this.orbs
  └── expone: this.player  (sprite de la nave)
```

### Eventos que emite GameScene (tú los escuchas)
| Evento | Datos | Cuándo |
|--------|-------|--------|
| `TICK` | `{ intensity, phase, bpm, progress }` | Cada frame/beat |
| `COLLISION` | — | Nave choca con obstáculo |
| `ORB` | `{ x, y }` | Nave recoge un orbe |
| `PHASE_CHANGE` | `{ phase }` | Cambia la fase musical |

### Fases del juego (en orden)
1. `BUILDUP` — intro oscura, poca intensidad
2. `DROP` — momento climático (agujero negro)
3. `OUTRO` — fase final colorida, cometas

### Valores clave de TICK
- `intensity`: 0.0 → 1.0 (qué tan intensa es la música)
- `progress`: 0.0 → 1.0 (qué tan avanzada está la canción)
- `bpm`: beats por minuto (ej: 120)
- `phase`: string con la fase actual

---

## 🎨 Lo que hace el VisualManager actual

### Arco visual completo
```
Inicio (oscuro)
  → estrellas aparecen progresivamente
  → nebulosas tenues se mueven
  → obstáculos galácticos variados

DROP (momento WOW)
  → agujero negro crece desde el centro
  → nave alienígena es jalada y absorbida
  → flash blanco total
  → explosión de 120+ partículas-estrella
  → agujero negro se contrae
  → nave reaparece

Post-DROP (galaxia vívida)
  → fondo se ilumina (azul→púrpura)
  → nebulosas se tornan de colores (violeta, cian, magenta)
  → estrellas parpadean en colores pastel
  → auroras se deslizan por el fondo

Final (progress > 0.85)
  → cometas/estrellas fugaces cruzan la pantalla
```

### Tipos de obstáculos (se asignan aleatoriamente)
- `planet` — planeta con o sin anillo
- `asteroid` — roca irregular
- `supernova` — estrella con rayos explosivos
- `abandoned_ship` — nave destruida
- `creature` — medusa galáctica con tentáculos

### Pulso rítmico
Todos los sprites hacen micro-zoom al ritmo de `intensity` en cada TICK.

---

## 🔌 API pública (métodos que puedes llamar desde GameScene)

```js
visualManager.updateShipGlow(ship)
// Colorea el tint de la nave según intensity (cian → magenta en DROP)
```

---

## 🚀 Cómo correr el proyecto

```bash
npm install        # solo la primera vez
npm run dev        # abre http://localhost:5173
```

### Teclas de debug (dentro del juego)
| Tecla | Acción |
|-------|--------|
| `1` | Salta al inicio |
| `2` | Salta al DROP (minuto ~1:00) |
| `3` | Salta al final (minuto ~1:55) |

---

## ⚠️ Reglas del equipo

1. **Regla #1:** El juego siempre debe correr sin errores de consola
2. **NO tocar:** `GameScene.js`, `AudioEngine.js`, `HUD.js`, `MenuScene.js`
3. **Sí tocar:** solo `src/VisualManager.js`
4. Hacer `git pull` antes de empezar a trabajar
5. Hacer `git push` al terminar cada sesión

---

## 📐 Profundidades (depth) — para no tapar el HUD

| Capa | depth |
|------|-------|
| Fondo (bgRect) | -10 |
| Estrellas | -9 |
| Nebulosas | -8 |
| Auroras | -7 |
| Cometas | -6 |
| Objetos del juego | 0 |
| Ondas de energía | 5 |
| HUD (Persona 2) | 100 |
| Cinemática agujero negro | 60 |
| Flash de pantalla | 90 |

> **Importante:** no uses depth > 99 en efectos normales o tapas el HUD.

---

## 🎨 Paleta de colores de referencia

```
Pre-drop (frío/oscuro):  #001133  #0d0020  #000005
Post-drop (vívido):      #6600cc  #00aacc  #cc0088  #009966
Nave alienígena:         #88ccff (cuerpo)  #44eebb (cúpula)  #00ffff (halo)
Estrellas post-drop:     #cc99ff  #99ddff  #ffccff
Cometas:                 #ffffff  #ccddff  #ffccee  #aaffee
```

---

## 🗂️ Estructura de archivos relevante

```
sinfonia-de-caos/
├── src/
│   ├── VisualManager.js   ← TU ARCHIVO ✏️
│   ├── GameScene.js       ← NO tocar
│   ├── AudioEngine.js     ← NO tocar
│   ├── HUD.js             ← NO tocar (Persona 2)
│   └── MenuScene.js       ← NO tocar (Persona 2)
├── público/
│   └── (assets de audio)
├── índice.html
├── paquete.json
└── HACKATHON_BASE.md      ← contexto del proyecto
```

---

*Repo: https://github.com/RuDomiv/sinfonia-de-caos*
