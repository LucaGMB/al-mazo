import type { Card, CardTemplate } from './engine.js';

export const TRUCO_CARD_HIERARCHY: Record<string, number> = {
  '1 ESPADAS': 14,
  '1 BASTOS': 13,
  '7 ESPADAS': 12,
  '7 OROS': 11,
  '3': 10,
  '2': 9,
  '1 OROS': 8,
  '1 COPAS': 8,
  '12': 7,
  '11': 6,
  '10': 5,
  '7 BASTOS': 4,
  '7 COPAS': 4,
  '6': 3,
  '5': 2,
  '4': 1,
};

export function getCardHierarchyValue(
  card: Card,
  hierarchy: Record<string, number> = TRUCO_CARD_HIERARCHY
): number {
  if (card.type === 'TAPADA' || card.value === 'TAPADA' || (card as { isTapada?: boolean }).isTapada) return 0;
  const suitKey = `${card.value} ${card.color}`;
  return hierarchy[suitKey] ?? hierarchy[String(card.value)] ?? 0;
}

export function envidoCardValue(card: Card): number {
  const numeric = Number(card.value);
  if (!Number.isFinite(numeric) || numeric >= 10) return 0;
  return numeric;
}

export function calculateEnvidoScore(cards: Card[]): { points: number; suit?: string } {
  let best = 0;
  let bestSuit: string | undefined = undefined;

  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (cards[i].color && cards[i].color === cards[j].color) {
        const sum = envidoCardValue(cards[i]) + envidoCardValue(cards[j]) + 20;
        if (sum > best) {
          best = sum;
          bestSuit = cards[i].color;
        }
      }
    }
  }

  if (best === 0 && cards.length > 0) {
    for (const card of cards) {
      const v = envidoCardValue(card);
      if (v >= best) {
        best = v;
        bestSuit = card.color;
      }
    }
  }

  return { points: best, suit: bestSuit };
}

export function calculateEnvidoPoints(cards: Card[]): number {
  return calculateEnvidoScore(cards).points;
}

export function calculateFaltaEnvidoPoints(
  scores: Record<string, number>,
  targetScore = 30,
  malasOnlyToHalf = false
): number {
  const maxScore = Math.max(...Object.values(scores), 0);
  const half = Math.floor(targetScore / 2);

  if (malasOnlyToHalf && maxScore < half) {
    return Math.max(1, half - maxScore);
  }

  return Math.max(1, targetScore - maxScore);
}

export function resolveTrickWinner(
  cards: Array<{ playerId: string; card: Card; isTapada?: boolean }>,
  hierarchy: Record<string, number> = TRUCO_CARD_HIERARCHY
): { winnerId: string | 'EMPATE'; maxRank: number } {
  if (cards.length === 0) {
    return { winnerId: 'EMPATE', maxRank: 0 };
  }

  let highestRank = -1;
  let leaderId: string | 'EMPATE' = 'EMPATE';

  for (const entry of cards) {
    const isCardTapada = entry.isTapada || entry.card.type === 'TAPADA' || (entry.card as { isTapada?: boolean }).isTapada;
    const rank = isCardTapada ? 0 : getCardHierarchyValue(entry.card, hierarchy);

    if (rank > highestRank) {
      highestRank = rank;
      leaderId = entry.playerId;
    } else if (rank === highestRank && highestRank > 0) {
      leaderId = 'EMPATE';
    }
  }

  return { winnerId: leaderId, maxRank: highestRank };
}

export function resolveRoundWinner(
  tricks: Array<{ trickNumber: number; winnerId: string | 'EMPATE' | null }>,
  manoPlayerId: string
): string | null {
  const t1 = tricks.find((t) => t.trickNumber === 1)?.winnerId ?? null;
  const t2 = tricks.find((t) => t.trickNumber === 2)?.winnerId ?? null;
  const t3 = tricks.find((t) => t.trickNumber === 3)?.winnerId ?? null;

  // Si la primera baza aún no terminó
  if (!t1) return null;

  // Caso 1: Alguien ganó 1ª y 2ª baza (2-0 directo)
  if (t1 !== 'EMPATE' && t1 === t2) return t1;

  // Caso 2: Parda en 1ª baza
  if (t1 === 'EMPATE') {
    if (t2 && t2 !== 'EMPATE') return t2;
    if (t2 === 'EMPATE' && t3 && t3 !== 'EMPATE') return t3;
    if (t2 === 'EMPATE' && t3 === 'EMPATE') return manoPlayerId;
    return null;
  }

  // Caso 3: Hubo ganador en 1ª baza y parda en 2ª baza -> Gana quien ganó la 1ª
  if (t1 !== 'EMPATE' && t2 === 'EMPATE') {
    return t1;
  }

  // Caso 4: Ganadores distintos en 1ª y 2ª baza (1-1)
  if (t1 !== 'EMPATE' && t2 !== 'EMPATE' && t1 !== t2) {
    if (!t3) return null; // Falta jugar la 3ª
    if (t3 !== 'EMPATE') return t3;
    // Si la 3ª baza es parda, gana quien ganó la 1ª
    return t1;
  }

  return null;
}

export function generateSpanishDeckTemplates(): CardTemplate[] {
  const SUITS = ['ESPADAS', 'BASTOS', 'OROS', 'COPAS'] as const;
  const VALUES = ['1', '2', '3', '4', '5', '6', '7', '10', '11', '12'];
  const templates: CardTemplate[] = [];

  for (const suit of SUITS) {
    for (const value of VALUES) {
      templates.push({ count: 1, type: 'NUMBER', color: suit, value });
    }
  }

  return templates;
}
