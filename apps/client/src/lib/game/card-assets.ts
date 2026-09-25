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
