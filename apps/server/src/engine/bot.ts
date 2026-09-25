import { Card, GameRulesConfig } from './types.js';
import { validateCardPlay } from './validator.js';
import { findEscobaCaptures, getEscobaCardValue } from '../games/escoba/definition.js';

export interface BotMove {
  cardId: string;
  chosenColor?: string;
}

export interface EscobaBotMove {
  action: 'CAPTURE_CARDS' | 'DROP_CARD';
  cardId: string;
  tableCardIds?: string[];
}

const FALLBACK_COLOR = 'RED';

/**
 * Picks the color the bot holds most of. Ties resolve to the first color
 * encountered in hand; falls back to RED when the hand is colorless.
 */
export function chooseColor(hand: Card[]): string {
  const counts = new Map<string, number>();
  for (const card of hand) {
    if (!card.color || card.color === 'ANY') continue;
    counts.set(card.color, (counts.get(card.color) ?? 0) + 1);
  }

  if (counts.size === 0) return hand[0]?.color ?? FALLBACK_COLOR;

  let best = FALLBACK_COLOR;
  let bestCount = 0;
  for (const [color, count] of counts) {
    if (count > bestCount) {
      best = color;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Strategic weight of a playable card. Draw attacks disrupt most, action
 * cards next, number cards to shed, plain wilds saved for last.
 */
function priority(card: Card): number {
  if (card.value === 'DRAW_2' || card.value === 'WILD_DRAW_4') return 3;
  if (card.value === 'SKIP' || card.value === 'REVERSE') return 2;
  if (card.type === 'WILD') return 0;
  return 1;
}

/**
 * Chooses the next bot move for UNO/ColorMatch: the highest-priority playable card,
 * or null when the bot must draw.
 */
export function decideBotMove(
  hand: Card[],
  topDiscardCard: Card | null,
  activeColor: string | null,
  rules: GameRulesConfig
): BotMove | null {
  let best: Card | null = null;
  let bestPriority = -1;

  for (const card of hand) {
    if (!validateCardPlay(card, topDiscardCard, activeColor, rules).isValid) continue;
    const cardPriority = priority(card);
    if (cardPriority > bestPriority) {
      best = card;
      bestPriority = cardPriority;
    }
  }

  if (!best) return null;

  const move: BotMove = { cardId: best.id };
  if (best.type === 'WILD' || rules.effects[String(best.value)]?.type === 'CHOOSE_COLOR') {
    move.chosenColor = chooseColor(hand);
  }
  return move;
}

/**
 * Chooses the next bot move for Escoba del 15.
 * Evaluates all valid 15-sum captures and picks the most strategic one.
 * If no capture is possible, drops the safest card (protecting Guindis, 7s, and Oros).
 */
export function decideEscobaBotMove(hand: Card[], tableCards: Card[]): EscobaBotMove {
  let bestMove: {
    cardId: string;
    tableCardIds: string[];
    score: number;
  } | null = null;

  for (const handCard of hand) {
    const captures = findEscobaCaptures(handCard, tableCards);
    for (const capture of captures) {
      let score = 0;
      // Huge bonus if making an Escoba (cleans all table cards)
      if (capture.length === tableCards.length) {
        score += 100;
      }
      const allCards = [handCard, ...capture];
      for (const c of allCards) {
        if (c.value === '7' && c.color === 'OROS') score += 50; // Siete de velo (guindis)
        else if (c.value === '7') score += 20; // 7s for majority
        else if (c.color === 'OROS') score += 10; // Oros for majority
        score += 2; // Each card counts towards majority
      }

      if (!bestMove || score > bestMove.score) {
        bestMove = {
          cardId: handCard.id,
          tableCardIds: capture.map((c) => c.id),
          score,
        };
      }
    }
  }

  if (bestMove) {
    return {
      action: 'CAPTURE_CARDS',
      cardId: bestMove.cardId,
      tableCardIds: bestMove.tableCardIds,
    };
  }

  // No capture possible: pick safest card to drop to the table
  let safestCard = hand[0];
  let lowestDanger = Number.POSITIVE_INFINITY;

  for (const c of hand) {
    let danger = 0;
    if (c.value === '7' && c.color === 'OROS') danger += 100;
    else if (c.value === '7') danger += 50;
    else if (c.color === 'OROS') danger += 25;
    else danger += getEscobaCardValue(c);

    if (danger < lowestDanger) {
      lowestDanger = danger;
      safestCard = c;
    }
  }

  return {
    action: 'DROP_CARD',
    cardId: safestCard.id,
  };
}
