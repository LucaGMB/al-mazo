import type { Card } from "@/types/engine";

// Réplica cliente de validateCardPlay (apps/server/src/engine/validator.ts)
// para la familia DISCARD (color-match/-chaos/-blitz, descarte-criollo): sin
// esto, tocar/arrastrar una carta que no matchea manda la jugada al server y
// vuelve como error genérico ("Card (...) does not match top card (...)").
export function canPlayDiscardCard(
  card: Card,
  topDiscardCard: Card | null | undefined,
  activeColor: string | null | undefined
): boolean {
  if (!topDiscardCard) return true;
  if (card.type === "WILD") return true;

  const effectiveColor = activeColor ?? topDiscardCard.color;
  if (card.color && effectiveColor && card.color === effectiveColor) return true;

  return (
    topDiscardCard.type !== "WILD" &&
    card.value !== undefined &&
    topDiscardCard.value !== undefined &&
    String(card.value) === String(topDiscardCard.value)
  );
}
