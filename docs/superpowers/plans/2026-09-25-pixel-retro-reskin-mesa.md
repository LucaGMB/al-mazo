# Reskin pixel retro — mesa (Familia B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin la mesa de juego y sus componentes de carta para usar assets
pixel art reales (sin gradientes ni blur decorativo) en los 3 juegos de la
Familia B (`color-match`, `color-match-chaos`, `color-match-blitz`); los 4
juegos de Familia A (naipe español real) siguen sin cambios visuales porque
no hay asset todavía (gap documentado en la spec).

**Architecture:** Un nuevo módulo `card-assets.ts` decide, por `card.color`,
si una carta pertenece a la Familia B (devuelve una ruta de imagen real bajo
`public/pixel/cards/`) o no (`null`, y el llamador sigue con el render
vectorial existente). `CardView` se ramifica en 3 casos: imagen real
(Familia B con asset), fondo de color + ícono vectorial (Familia B sin
asset: `REVERSE`/`DISCARD_ALL`), o el render vectorial de siempre (Familia
A). El resto de los componentes (`CardBack`, `DiscardPile`, `PlayerBadge`,
la mesa) pierden sus gradientes/blurs decorativos y usan color plano o los
assets ya vendorizados.

**Tech Stack:** Next.js 16 / React 19 / Tailwind v4 (`apps/client`). Sin test
runner en este paquete — la verificación de cada tarea es visual (dev server
+ navegador), no hay tests automatizados que escribir para JSX puramente
presentacional sin lógica nueva.

**Spec:** `docs/superpowers/specs/2026-09-25-pixel-retro-reskin-design.md`

## Global Constraints

- No tocar lógica de juego ni animaciones existentes (`CardFlight`,
  `table-shake`, confetti, drag-to-play de `Hand`).
- 0 `radial-gradient`/`linear-gradient` nuevos. 0 sombras con blur > 0 para
  "profundidad" decorativa (los glows de *feedback de interacción* ya
  existentes — anillo de `Hand` al arrastrar, `animate-pulse-glow`,
  "Tu turno" — quedan igual, no son parte de este reskin).
- Familia A (`ESPADAS/BASTOS/OROS/COPAS`) sigue renderizando exactamente
  como hoy: ningún cambio de comportamiento para `truco`, `escoba`,
  `chinchon`, `descarte-criollo`.
- Assets ya vendorizados en `apps/client/public/pixel/` (cards/ui/patterns) —
  no descargar nada nuevo en este plan.

---

### Task 1: `card-assets.ts` — resolver de imagen por carta (Familia B)

**Files:**
- Create: `apps/client/src/lib/game/card-assets.ts`
- Modify: `apps/client/src/lib/game/card-colors.ts:13` (fix hex de `COPAS`)

**Interfaces:**
- Produces: `getUnoCardImageSrc(card: Card): string | null`,
  `hasColorFallbackOnly(card: Card): boolean`, `CARD_BACK_SRC: string`
  (importados por `CardView`, `CardBack`, `DiscardPile`, `DrawPile` en las
  tareas siguientes).

- [ ] **Step 1: Corregir `COPAS` en `card-colors.ts`**

En `apps/client/src/lib/game/card-colors.ts:13`, cambiar:
```ts
  COPAS: "#ff8f4d",
```
por:
```ts
  COPAS: "#ff4d6d", // antes naranja sin relación con ningún color real del engine
```

- [ ] **Step 2: Crear `card-assets.ts`**

```ts
import type { Card } from "@/types/engine";

// Familia B (color-match, color-match-chaos, color-match-blitz): el color
// de la carta es literalmente uno de estos 4, coincide 1:1 con los assets
// vendorizados en public/pixel/cards/. Familia A (truco/escoba/chinchon/
// descarte-criollo) usa ESPADAS/BASTOS/OROS/COPAS y no tiene asset real
// todavía — para esas, las funciones de acá devuelven null y el llamador
// sigue usando el render vectorial existente.
const UNO_COLOR_SLUG: Record<string, string> = {
  RED: "red",
  BLUE: "blue",
  GREEN: "green",
  YELLOW: "yellow",
};

export const CARD_BACK_SRC = "/pixel/cards/back.png";

export function getUnoCardImageSrc(card: Card): string | null {
  const slug = card.color ? UNO_COLOR_SLUG[card.color] : undefined;

  if (card.type === "WILD" || card.value === "WILD") return "/pixel/cards/wild.png";
  if (card.value === "WILD_DRAW_4") return "/pixel/cards/wild_draw4.png";
  if (card.value === "SWAP") return "/pixel/cards/swap.png";

  if (!slug) return null; // no es Familia B (o es un WILD/SWAP ya resuelto arriba)

  if (card.type === "NUMBER") return `/pixel/cards/${slug}/${card.value}.png`;
  if (card.value === "DRAW_2") return `/pixel/cards/draw2_${slug}.png`;
  if (card.value === "SKIP") return `/pixel/cards/skip_${slug}.png`;

  return null; // REVERSE / DISCARD_ALL: sin asset real, ver hasColorFallbackOnly
}

// Cartas de Familia B cuyo valor no tiene asset real todavía (REVERSE,
// DISCARD_ALL): el llamador pinta un fondo de color plano + ícono vectorial
// superpuesto en vez de una imagen real.
export function hasColorFallbackOnly(card: Card): boolean {
  return !!card.color && card.color in UNO_COLOR_SLUG && (card.value === "REVERSE" || card.value === "DISCARD_ALL");
}
```

- [ ] **Step 3: Verificación manual (sin test runner en este paquete)**

Correr `npx tsc --noEmit -p apps/client` (o el comando de typecheck que use
el repo) para confirmar que el nuevo archivo tipa bien contra `Card`. No
hace falta un `.test.ts`: son 2 funciones puras de lookup por string, sin
ramas de negocio nuevas que puedan romperse silenciosamente — el
typecheck ya es la única red de seguridad que aporta valor acá.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/lib/game/card-assets.ts apps/client/src/lib/game/card-colors.ts
git commit -m "feat(client): add card-assets resolver for real UNO-family sprites"
```

---

### Task 2: `CardView` — usar assets reales para Familia B

**Files:**
- Modify: `apps/client/src/components/game/CardView.tsx` (archivo completo,
  ~100 líneas)

**Interfaces:**
- Consumes: `getUnoCardImageSrc`, `hasColorFallbackOnly` de
  `@/lib/game/card-assets` (Task 1).
- Produces: mismo export default `CardView({ card, selected, onClick, size })`
  — sin cambios de props, sólo de render interno.

- [ ] **Step 1: Reescribir el componente**

Reemplazar el archivo completo por:

```tsx
"use client";

import type { Card } from "@/types/engine";
import { Icon } from "@iconify/react";
import { CARD_COLORS } from "@/lib/game/card-colors";
import { getUnoCardImageSrc, hasColorFallbackOnly } from "@/lib/game/card-assets";

const SUIT_ICONS: Record<string, string> = {
  ESPADAS: "pixelarticons:sword",
  BASTOS: "pixelarticons:shield",
  OROS: "pixelarticons:coin",
  COPAS: "pixelarticons:trophy",
};

const ACTION_ICONS: Record<string, string> = {
  SKIP: "pixelarticons:close",
  REVERSE: "pixelarticons:sync",
  SWAP: "pixelarticons:reload",
  DISCARD_ALL: "pixelarticons:trash",
  WILD: "pixelarticons:sparkles",
};

// Contenido de las esquinas (sólo Familia A, naipe español): valor + palo.
function pipInfo(card: Card): { text: string | null; icon: string | null } {
  const suit = SUIT_ICONS[card.color ?? ""];
  if (suit) return { text: card.value != null ? String(card.value) : null, icon: suit };
  if (card.type === "NUMBER") return { text: String(card.value ?? ""), icon: null };
  if (card.value === "DRAW_2") return { text: "+2", icon: "pixelarticons:arrow-down" };
  if (card.value === "WILD_DRAW_4") return { text: "+4", icon: "pixelarticons:arrow-down" };
  if (card.value === "WILD") return { text: null, icon: "pixelarticons:sparkles" };
  return { text: null, icon: ACTION_ICONS[card.value ?? ""] ?? null };
}

function CardPip({ card, inverted, ink }: { card: Card; inverted?: boolean; ink: string }) {
  const { text, icon } = pipInfo(card);
  if (!text && !icon) return null;
  return (
    <span
      className={`pointer-events-none absolute z-10 flex flex-col items-center gap-px font-display font-bold leading-none ${
        inverted ? "bottom-[5%] right-[8%] rotate-180" : "top-[5%] left-[8%]"
      }`}
      style={{ color: ink }}
    >
      {text && <span className="text-[0.4em]">{text}</span>}
      {icon && <Icon icon={icon} width="0.44em" height="0.44em" />}
    </span>
  );
}

function cardCenter(card: Card) {
  const suitIcon = SUIT_ICONS[card.color ?? ""];
  if (suitIcon) {
    return (
      <>
        <Icon icon={suitIcon} width="1em" height="1em" />
        <span className="text-[0.7em] leading-none">{card.value}</span>
      </>
    );
  }

  if (card.type === "NUMBER") return String(card.value ?? "");
  if (card.value === "DRAW_2" || card.value === "WILD_DRAW_4") {
    return card.value === "DRAW_2" ? "+2" : "+4";
  }

  const icon = ACTION_ICONS[card.value ?? ""];
  return icon ? <Icon icon={icon} width="1.15em" height="1.15em" /> : "?";
}

const SIZE_CLASSES = {
  sm: "w-8 h-11 md:w-11 md:h-[60px] text-xs",
  md: "w-10 h-14 md:w-12 md:h-16 text-sm",
  lg: "w-[58px] h-[82px] md:w-20 md:h-[114px] text-base",
} as const;

export default function CardView({
  card,
  selected,
  onClick,
  size = "md",
}: {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
  size?: keyof typeof SIZE_CLASSES;
}) {
  const interactiveClasses = onClick
    ? "cursor-pointer hover:-translate-y-2 hover:scale-105"
    : "cursor-default";
  const selectedClasses = selected ? "outline outline-[3px] outline-accent" : "";

  // Familia B con asset real (color-match / -chaos / -blitz): sprite tal cual.
  const unoSrc = getUnoCardImageSrc(card);
  if (unoSrc) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={`group relative shrink-0 ${SIZE_CLASSES[size]} transition-transform duration-150 ${interactiveClasses} ${selectedClasses}`}
      >
        <img
          src={unoSrc}
          alt=""
          className="h-full w-full [image-rendering:pixelated] drop-shadow-[3px_4px_0_rgba(0,0,0,0.4)]"
        />
      </button>
    );
  }

  // Familia B sin asset todavía (REVERSE / DISCARD_ALL): color plano real +
  // ícono vectorial, sin gradiente ni blur.
  if (hasColorFallbackOnly(card)) {
    const bg = CARD_COLORS[card.color ?? "ANY"] ?? CARD_COLORS.ANY;
    const icon = ACTION_ICONS[card.value as string];
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={`group relative shrink-0 ${SIZE_CLASSES[size]} rounded-[14%] border-[3px] border-[#0b0812] flex items-center justify-center shadow-[3px_4px_0_0_rgba(0,0,0,0.4)] transition-transform duration-150 ${interactiveClasses} ${selectedClasses}`}
        style={{ backgroundColor: bg }}
      >
        {icon && <Icon icon={icon} width="1.4em" height="1.4em" className="text-white" />}
      </button>
    );
  }

  // Familia A (naipe español real): sin cambios, mismo render de siempre.
  const fg = CARD_COLORS[card.color ?? "ANY"] ?? CARD_COLORS.ANY;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`group relative shrink-0 ${SIZE_CLASSES[size]} rounded-[14%] card-paper border-[3px] border-[#241a44] flex items-center justify-center transition-all duration-150 shadow-[3px_4px_0_0_rgba(0,0,0,0.4)] ${interactiveClasses} ${
        selected ? "outline outline-[3px] outline-accent shadow-[0_0_0_3px_rgba(255,210,63,0.4),3px_4px_0_0_rgba(0,0,0,0.4)]" : ""
      }`}
    >
      <CardPip card={card} ink={fg} />
      <CardPip card={card} inverted ink={fg} />
      <span
        className="relative z-10 flex flex-col items-center gap-0.5 text-center text-[1.55em] leading-none font-display font-bold [text-shadow:2px_2px_0_rgba(0,0,0,0.15)]"
        style={{ color: fg }}
      >
        {cardCenter(card)}
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Levantar el dev server y verificar visualmente**

```bash
cd apps/client && npm run dev
```

Abrir `http://localhost:3001`, entrar a una partida de `color-match` (crear
sala, agregar bot, empezar) y confirmar: las cartas en mano y el descarte
son sprites reales (número en rombo blanco sobre fondo de color plano), sin
gradiente. Repetir con `truco` o `escoba` y confirmar que esas cartas **no**
cambiaron (siguen con ícono de palo vectorial).

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components/game/CardView.tsx
git commit -m "feat(client): render Familia B cards with real pixel sprites"
```

---

### Task 3: `CardBack` — dorso real, sin gradiente

**Files:**
- Modify: `apps/client/src/components/game/CardBack.tsx` (archivo completo)

**Interfaces:**
- Consumes: `CARD_BACK_SRC` de `@/lib/game/card-assets` (Task 1).
- Produces: mismo export default `CardBack({ size, interactive, glow })`.

- [ ] **Step 1: Reescribir el componente**

```tsx
import { CARD_BACK_SRC } from "@/lib/game/card-assets";

const SIZE_CLASSES = {
  sm: "w-8 h-11 md:w-11 md:h-[60px]",
  md: "w-10 h-14 md:w-12 md:h-16",
  lg: "w-[58px] h-[82px] md:w-20 md:h-[114px]",
} as const;

// Dorso de naipe: sprite real (VerzatileDev, CC0), no dibujado en CSS.
// Compartido por DrawPile (el mazo real) y el vuelo de "robaste una carta"
// (CardFlight).
export default function CardBack({
  size = "md",
  interactive,
  glow,
}: {
  size?: keyof typeof SIZE_CLASSES;
  interactive?: boolean;
  glow?: boolean;
}) {
  return (
    <img
      src={CARD_BACK_SRC}
      alt=""
      className={`${SIZE_CLASSES[size]} [image-rendering:pixelated] drop-shadow-[3px_4px_0_rgba(0,0,0,0.4)] ${
        interactive ? "hover:brightness-110" : ""
      } ${glow ? "animate-pulse-glow" : ""}`}
    />
  );
}
```

- [ ] **Step 2: Verificar visualmente**

Con el dev server corriendo, entrar a una mesa y confirmar que el mazo para
robar (`DrawPile`) muestra el dorso real (rombo rojo sobre rayas negras),
no el degradé diagonal anterior.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components/game/CardBack.tsx
git commit -m "feat(client): use real card-back sprite instead of CSS gradient"
```

---

### Task 4: `DiscardPile` — sacar el halo con blur

**Files:**
- Modify: `apps/client/src/components/game/DiscardPile.tsx` (archivo
  completo)

- [ ] **Step 1: Reescribir el componente**

```tsx
import type { Card } from "@/types/engine";
import CardView from "./CardView";
import { CARD_COLORS } from "@/lib/game/card-colors";

export default function DiscardPile({
  topCard,
  count,
  activeColor,
}: {
  topCard: Card | null;
  count: number;
  activeColor: string | null;
}) {
  const activeHex = activeColor ? CARD_COLORS[activeColor] : null;

  return (
    <div className="relative flex flex-col items-center gap-1 font-mono text-[9px] md:text-[11px] text-ink-faint">
      <div data-discard-pile className="relative">
        {/* Capas apiladas: ilusión de pila orgánica de descartes, sin blur. */}
        <div className="absolute inset-0 translate-x-2 translate-y-2 rotate-6 rounded-lg bg-black/30" />
        <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rotate-3 rounded-lg bg-black/40" />
        <div className="absolute inset-0 translate-x-0.5 translate-y-0.5 -rotate-2 rounded-lg bg-black/50" />
        {activeHex && (
          // Color activo (comodín elegido): anillo sólido, sin glow difuso.
          <div className="absolute -inset-1.5 rounded-lg border-[3px]" style={{ borderColor: activeHex }} />
        )}
        <div key={topCard?.id ?? "empty"} className="relative -rotate-2 animate-pop-in">
          {topCard ? (
            <CardView card={{ ...topCard, color: activeColor ?? topCard.color }} size="md" />
          ) : (
            <div className="w-10 h-14 md:w-12 md:h-16 rounded-[10%] border-[3px] border-[#0b0812] bg-surface" />
          )}
        </div>
      </div>
      <span className="tracking-wide">descarte · {count}</span>
    </div>
  );
}
```

- [ ] **Step 2: Verificar visualmente**

En una partida de `color-match`, jugar un comodín y confirmar que el
indicador de color activo es un borde sólido (no un resplandor difuso).

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components/game/DiscardPile.tsx
git commit -m "fix(client): replace blurred discard-pile halo with solid ring"
```

---

### Task 5: `PlayerBadge` — avatar sin gradiente, sin blur

**Files:**
- Modify: `apps/client/src/components/game/PlayerBadge.tsx:14-23` (paleta),
  `:55-61` (color elegido), `:67-69` (anillo de turno), `:114-147` (avatar +
  badge de robo)

- [ ] **Step 1: Paleta plana en vez de gradientes**

Reemplazar (líneas 14-23):
```tsx
const AVATAR_GRADIENTS = [
  "from-[#4fa8ff] to-[#1f5aa8]",
  "from-[#ff8f4d] to-[#b0521f]",
  "from-[#ff6b9d] to-[#a8356e]",
  "from-[#33c48d] to-[#197a55]",
  "from-[#9b6bff] to-[#5a3aa0]",
  "from-[#ffb84d] to-[#b0781f]",
];
```
por:
```tsx
const AVATAR_COLORS = ["#4fa8ff", "#ff8f4d", "#ff6b9d", "#33c48d", "#9b6bff", "#ffb84d"];
```

- [ ] **Step 2: Usar el color plano al elegir avatar**

Reemplazar (líneas 55-61):
```tsx
  const avatarGradient = player.isBot
    ? "from-[#33c48d] to-[#197a55]"
    : isSelf
      ? "from-[#ffd23f] to-[#b9860f]"
      : isHost
        ? "from-[#ff4d6d] to-[#a02138]"
        : AVATAR_GRADIENTS[hashName(player.name) % AVATAR_GRADIENTS.length];
```
por:
```tsx
  const avatarColor = player.isBot
    ? "#33c48d"
    : isSelf
      ? "#ffd23f"
      : isHost
        ? "#ff4d6d"
        : AVATAR_COLORS[hashName(player.name) % AVATAR_COLORS.length];
```

- [ ] **Step 3: Anillo de turno sin blur**

Reemplazar (líneas 67-69):
```tsx
  const ringClasses = isCurrentTurn
    ? "border-warning border-[3px] shadow-[0_0_18px_rgba(255,143,77,0.5)]"
    : "";
```
por:
```tsx
  const ringClasses = isCurrentTurn ? "border-warning border-[3px]" : "";
```

- [ ] **Step 4: Avatar plano, sin ficha conic-gradient ni inset shadows**

Reemplazar el bloque completo del avatar (líneas 114-147):
```tsx
      {/* "Ficha" de póker en vez de avatar genérico: reja conic-gradient simula el
          canto ranurado de una ficha real, con el color/gradiente por dentro. */}
      <div
        className={`relative shrink-0 rounded-full p-[2px] ${
          isSelf ? "w-7 h-7 md:w-9 md:h-9" : "w-6 h-6 md:w-8 md:h-8"
        } ${!player.isConnected ? "opacity-40" : ""}`}
        style={{
          backgroundImage:
            "repeating-conic-gradient(var(--color-paper) 0deg 9deg, rgba(0,0,0,0.35) 9deg 20deg)",
        }}
      >
        <div
          className={`relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br ${avatarGradient} shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),inset_0_-2px_3px_rgba(0,0,0,0.4)]`}
        >
          <Icon
            icon={avatarIcon}
            width={isSelf ? 16 : 14}
            height={isSelf ? 16 : 14}
            className="text-[#f4f1ff] drop-shadow-[0_1px_1px_rgba(0,0,0,0.55)]"
            aria-hidden
          />
          {!player.isConnected && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full border border-statusbar bg-danger shadow-[0_0_6px_rgba(255,77,109,0.9)]" />
          )}
        </div>
        {drawPulse && (
          <span
            key={drawPulse.key}
            className="pointer-events-none absolute -right-1.5 -top-1.5 z-20 rounded-[6px] border-2 border-[#241a44] bg-warning px-1.5 py-0.5 font-display text-[10px] text-[#171a35] shadow-[0_0_8px_rgba(255,143,77,0.7)] animate-draw-pulse"
          >
            +{drawPulse.amount}
          </span>
        )}
      </div>
```
por:
```tsx
      {/* Avatar plano: círculo de color sólido + borde grueso, sin gradiente
          ni relieve simulado. */}
      <div
        className={`relative shrink-0 rounded-full border-[3px] border-[#0b0812] flex items-center justify-center ${
          isSelf ? "w-7 h-7 md:w-9 md:h-9" : "w-6 h-6 md:w-8 md:h-8"
        } ${!player.isConnected ? "opacity-40" : ""}`}
        style={{ backgroundColor: avatarColor }}
      >
        <Icon
          icon={avatarIcon}
          width={isSelf ? 16 : 14}
          height={isSelf ? 16 : 14}
          className="text-[#f4f1ff]"
          aria-hidden
        />
        {!player.isConnected && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full border border-statusbar bg-danger" />
        )}
        {drawPulse && (
          <span
            key={drawPulse.key}
            className="pointer-events-none absolute -right-1.5 -top-1.5 z-20 rounded-[6px] border-2 border-[#241a44] bg-warning px-1.5 py-0.5 font-display text-[10px] text-[#171a35] animate-draw-pulse"
          >
            +{drawPulse.amount}
          </span>
        )}
      </div>
```

(Nota: `drawPulse` se movió adentro del `div` del avatar porque ya no
existe el wrapper extra de la ficha — mismo posicionamiento absoluto,
mismo resultado visual, un nivel menos de anidamiento.)

- [ ] **Step 5: Verificar visualmente**

Entrar a una mesa con 2+ jugadores (agregar bot) y confirmar: avatares son
círculos de color sólido con borde, sin degradé ni relieve; el jugador con
el turno activo tiene borde naranja sólido sin resplandor difuso.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/components/game/PlayerBadge.tsx
git commit -m "fix(client): flatten player avatar, remove gradients and glow"
```

---

### Task 6: Mesa — contenedor rectangular con fieltro real

**Files:**
- Modify: `apps/client/src/app/globals.css` (agregar `.felt-texture` y
  `.pixel-rivet`)
- Modify: `apps/client/src/app/juego/[slug]/mesa/[roomCode]/page.tsx:553-584`

**Interfaces:**
- Consumes: `public/pixel/patterns/felt.png` (ya vendorizado).

- [ ] **Step 1: Agregar utilidades de mesa a `globals.css`**

Agregar al final del archivo (después de las clases `.animate-*`
existentes):

```css
/* ---------------------------------------------------------------------- */
/* Mesa pixel art: fieltro con textura real (multiply), sin radial-gradient */
/* ni tachas con gradiente. Reemplaza la mesa circular anterior.           */
/* ---------------------------------------------------------------------- */

.felt-texture {
  background-color: var(--color-felt);
  background-image: url(/pixel/patterns/felt.png);
  background-size: 72px 72px;
  background-blend-mode: multiply;
  image-rendering: pixelated;
}

.pixel-rivet {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--color-accent);
  border: 2px solid #0b0812;
}
```

- [ ] **Step 2: Reemplazar el contenedor de la mesa**

En `apps/client/src/app/juego/[slug]/mesa/[roomCode]/page.tsx`, reemplazar
el bloque (líneas 553-584):

```tsx
        <div className="relative overflow-hidden bg-wood absolute top-[90px] md:top-[120px] left-1/2 -translate-x-1/2 w-[300px] h-[300px] md:w-[440px] md:h-[440px] rounded-full border-[6px] border-[#241a44] shadow-[inset_0_0_0_2px_rgba(255,210,63,0.45),inset_0_0_30px_rgba(0,0,0,0.55),0_0_24px_rgba(255,210,63,0.16)]">
          {/* Cuatro tachas de latón en el rail, como una mesa de café real. */}
          {[
            "top-0.5 left-1/2 -translate-x-1/2",
            "bottom-0.5 left-1/2 -translate-x-1/2",
            "left-0.5 top-1/2 -translate-y-1/2",
            "right-0.5 top-1/2 -translate-y-1/2",
          ].map((pos) => (
            <span
              key={pos}
              className={`absolute h-[9px] w-[9px] rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff3c4,#ffd23f_55%,#b9860f_100%)] shadow-[0_1px_2px_rgba(0,0,0,0.6)] ${pos}`}
            />
          ))}
          <div className="absolute inset-[10px] rounded-full bg-felt grain" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center gap-5 md:gap-8 pointer-events-auto">
            <DrawPile count={publicState.drawPileCount} disabled={!canAct} onClick={handleDraw} />
            <DiscardPile
              topCard={publicState.topDiscardCard}
              count={publicState.discardPileCount}
              activeColor={publicState.activeColor}
            />
          </div>
          {pendingChoiceForMe && (
            <ColorPicker
              gameSlug={slug}
              onChoose={(color) => {
                play("colorChosen");
                void chooseColor(color);
              }}
            />
          )}
        </div>
```

por:

```tsx
        <div className="felt-texture absolute top-[90px] md:top-[120px] left-1/2 -translate-x-1/2 w-[300px] h-[220px] md:w-[440px] md:h-[320px] rounded-[10px] border-[6px] border-[#0b0812] shadow-[6px_6px_0_0_rgba(0,0,0,0.5)]">
          <span className="pixel-rivet" style={{ top: 6, left: 6 }} />
          <span className="pixel-rivet" style={{ top: 6, right: 6 }} />
          <span className="pixel-rivet" style={{ bottom: 6, left: 6 }} />
          <span className="pixel-rivet" style={{ bottom: 6, right: 6 }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center gap-5 md:gap-8 pointer-events-auto">
            <DrawPile count={publicState.drawPileCount} disabled={!canAct} onClick={handleDraw} />
            <DiscardPile
              topCard={publicState.topDiscardCard}
              count={publicState.discardPileCount}
              activeColor={publicState.activeColor}
            />
          </div>
          {pendingChoiceForMe && (
            <ColorPicker
              gameSlug={slug}
              onChoose={(color) => {
                play("colorChosen");
                void chooseColor(color);
              }}
            />
          )}
        </div>
```

- [ ] **Step 3: Verificar visualmente**

Entrar a una mesa (cualquier juego) y confirmar: el área de juego es un
rectángulo de esquinas apenas curvas con textura de fieltro visible
(patrón real, no ruido/gradiente), borde negro grueso, sombra sólida sin
blur, y 4 remaches cuadrados dorados en las esquinas (no círculos con
gradiente radial).

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/app/globals.css "apps/client/src/app/juego/[slug]/mesa/[roomCode]/page.tsx"
git commit -m "fix(client): rectangular felt table with real texture, no gradients"
```

---

## Fuera de alcance (documentado, no bloquea este plan)

- Familia A (naipe español real) sin asset — gap de la spec, requiere un
  brainstorming aparte para conseguir el pack correcto.
- Nav, catálogo, editor, perfil, botones con panel 9-slice real (assets ya
  vendorizados en `public/pixel/ui/` para cuando se aborde esa fase).
- `REVERSE`/`DISCARD_ALL` coloreados quedan con el fallback vectorial
  descripto en la spec — no es un "asset real" al 100%.
