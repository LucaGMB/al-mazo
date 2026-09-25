# Reskin visual pixel-art retro — Al Mazo (apps/client)

## Resumen

Rehacer la piel visual de `apps/client` completa (nav, catálogo, editor, perfil,
mesa de juego) con una dirección **pixel art retro plana** inspirada en
Balatro: colores planos saturados, sin gradientes ni glow/blur, tipografía
pixel, y assets reales (texturas, cartas, paneles) en vez de formas dibujadas
en CSS. Confirmado con el usuario vía un demo en Artifact
(`https://claude.ai/artifact/PZhC7FJGXSCgwEPUCHPjT3`).

**No-goals:** no se toca lógica de juego, animaciones (`CardFlight`,
`table-shake`, confetti, etc.) ni el motor de reglas. Es un reskin de piel
visual únicamente.

> **Corrección (post-brainstorming):** una primera versión de esta spec
> asumía que "Al Mazo" era un único clon de UNO con los palos españoles
> haciendo de color. Es falso: es una **plataforma de 7 juegos** que
> comparten los mismos componentes de render (`CardView`, `CardBack`,
> `DrawPile`, `DiscardPile`, etc.) pero con dos sistemas de carta
> completamente distintos. Ver la sección siguiente.

## Contexto del motor: dos familias de juego, un solo set de componentes

`apps/server/src/games/` define 7 juegos sobre un engine genérico. El campo
`card.color` de cada uno cae en una de dos familias, y `CardView` /
`CARD_COLORS` / `SUIT_ICONS` en el cliente ya soportan ambas por diseño (no
es una casualidad ni algo a "simplificar"):

### Familia A — baraja española real (palo + número, sin color como mecánica)

`truco`, `escoba`, `chinchon`, `descarte-criollo`. `card.color` es literal
`ESPADAS | BASTOS | OROS | COPAS`, `card.value` son números reales de la
baraja de 40 (`1,2,3,4,5,6,7,10,11,12`). En `descarte-criollo` algunos
valores (`1,2,4,7,12`) además disparan un efecto especial (reversa,
robar 2, saltear, descartar el palo, elegir palo) **pero la carta se ve
igual que cualquier otra de ese palo** — la regla especial no es visible en
el arte, tal como en un juego criollo real jugado con mazo común. Estos 4
juegos necesitan una **baraja española real** (palo + número tradicional),
no cartas de color estilo UNO.

### Familia B — cartas de color estilo UNO

`color-match`, `color-match-chaos`, `color-match-blitz`. `card.color` es
literal `RED | BLUE | GREEN | YELLOW | ANY`, con cartas `NUMBER` 0-9,
acciones con nombre (`SKIP`, `REVERSE`, `DRAW_2`, y en el modo *chaos*
también `DISCARD_ALL`, coloreadas) y comodines sin color (`WILD`,
`WILD_DRAW_4`, y en *chaos* `SWAP`). Esto **sí** es UNO estándar y es lo
que resuelve el mazo de VerzatileDev (ver abajo).

Esta spec (y el plan que la sigue) cubre **la Familia B completa** más el
resto de la piel (paleta, mesa, botones, nav). La Familia A queda como gap
explícito documentado al final — necesita un asset distinto que todavía no
se consiguió.

## Paleta

Colores planos, sin gradiente, definidos como tokens (reemplaza los actuales
en `globals.css`):

| Token | Hex | Uso |
|---|---|---|
| `--bg` | `#150f1e` | fondo app (violeta casi negro) |
| `--panel` | `#241a3d` | superficies/paneles |
| `--ink` | `#f3ecd9` | texto principal (crema) |
| `--ink-dim` | `#b7add0` | texto secundario |
| `--gold` | `#f2b636` | acento único (fichas/highlights) |
| `--felt` | `#1e5c42` | paño de mesa |

Colores de carta (Familia B, `CARD_COLORS`) ya coinciden con la paleta
existente salvo `COPAS`, que hoy es un naranja (`#ff8f4d`) sin relación con
ningún color real del engine (`RED/BLUE/GREEN/YELLOW`) y sin asset. Se
corrige para que **todas** las claves usen exactamente los 4 hex reales:

| Clave `CARD_COLORS` | Hex correcto |
|---|---|
| `RED` / `COPAS` | `#ff4d6d` |
| `BLUE` / `ESPADAS` | `#4fa8ff` (sin cambios) |
| `GREEN` / `BASTOS` | `#33c48d` (sin cambios) |
| `YELLOW` / `OROS` | `#ffd23f` (sin cambios) |

(`ESPADAS/BASTOS/OROS/COPAS` siguen existiendo como claves porque
`CardView` las usa para la Familia A — quedan con el mismo hex que su
color análogo sólo para que la paleta sea consistente a simple vista, no
porque compartan asset.)

Reglas duras (verificables en review de código):
- 0 `radial-gradient` / `linear-gradient` en la piel nueva.
- 0 `filter: blur(...)` / `box-shadow` con blur > 0 para "profundidad" — las
  sombras son sólidas y offset (`Npx Mpx 0 color`), sin blur.
- Bordes gruesos sólidos, esquinas rectas o apenas redondeadas (nunca
  `rounded-full` en contenedores grandes como la mesa).

## Assets: inventario y fuentes (Familia B)

Todo CC0. Vendorizados en `apps/client/public/pixel/` (ya bajados y
recortados durante el brainstorming, ver `public/pixel/CREDITS.md`).

| Asset | Fuente | Uso |
|---|---|---|
| `cards/{red,blue,green,yellow}/{0-9}.png` | VerzatileDev "4 Colour Cards (CC0)" | Cartas número, Familia B |
| `cards/draw2_{color}.png`, `cards/skip_{color}.png` | idem | Acciones coloreadas |
| `cards/wild.png`, `cards/wild_draw4.png`, `cards/swap.png` | idem (variante negra/sin color del pack) | Comodines |
| `cards/back.png` | idem | Dorso, genérico para toda la app |
| `ui/panel_{yellow,green,red,grey}[_pressed].png` | Kenney "Pixel UI Pack" | Botones 9-slice (fase futura, no bloquea el plan actual) |
| `patterns/felt.png` | Kenney "Pattern Pack" | Textura de mesa (multiply) |

### Gap real: `REVERSE` y `DISCARD_ALL` coloreados

El pack de VerzatileDev no tiene arte para estos dos. Fallback: fondo de
color real del pack (`cards/skip_{color}.png` recortado a sólo su fondo, o
un color plano `CARD_COLORS[color]`) + ícono vectorial ya existente
(`pixelarticons:sync` / `pixelarticons:trash`) superpuesto. No es 100%
"asset real" para estos dos casos puntuales; se documenta como deuda.

## Mesa ("mesa" de juego)

- Contenedor rectangular (no `rounded-full`), esquinas con `border-radius`
  chico.
- Fondo: color plano `--felt` + `patterns/felt.png` en
  `background-blend-mode: multiply` (reemplaza el `radial-gradient` + ruido
  SVG actual).
- Borde sólido grueso + sombra offset sin blur.
- "Tachas" de las esquinas: cuadrados planos con borde, no
  `radial-gradient`.

## Alcance de este plan

Esta spec + el plan de implementación que sigue cubren:

1. Tokens de paleta (`globals.css`, `card-colors.ts`).
2. `CardView`, `CardBack`, `DrawPile`, `DiscardPile` — usan assets reales
   para Familia B; para Familia A (palo español) siguen renderizando como
   hoy (ícono de palo + número vectorial) porque no hay asset todavía.
3. `PlayerBadge` — sacar gradientes/blur del avatar.
4. Mesa (`mesa/[roomCode]/page.tsx`) — contenedor rectangular + fieltro real.

**No cubre** (fases futuras, ya así en la spec original): nav/catálogo,
editor, perfil, botones con panel 9-slice real (assets ya vendorizados en
`ui/` para cuando se haga).

## Riesgos / gaps abiertos

- **Familia A (baraja española) sin asset real todavía.** `truco`,
  `escoba`, `chinchon` y `descarte-criollo` van a seguir viéndose como
  hoy (ícono vectorial de palo + número en tipografía pixel) hasta
  conseguir un pack CC0 de naipe español real (40 cartas: 1,2,3,4,5,6,7,
  10,11,12 × espadas/bastos/oros/copas). No se encontró ninguno
  verificado durante este brainstorming — queda pendiente para un
  brainstorming/spec aparte.
- **Accesibilidad daltónica** en Familia B: el valor siempre se muestra
  como texto además de color, no se pierde con el reskin.
- `REVERSE`/`DISCARD_ALL` coloreados quedan como híbrido (ver arriba).
