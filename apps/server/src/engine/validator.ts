import { Card, GameRulesConfig } from './types.js';

export interface PlayValidationResult {
  isValid: boolean;
  reason?: string;
}

export function validateCardPlay(
  card: Card,
  topDiscardCard: Card | null,
  activeColor: string | null,
  rules: GameRulesConfig
): PlayValidationResult {
  if (!topDiscardCard) {
    return { isValid: true };
  }

  if (!rules.matchingProperties || rules.matchingProperties.length === 0) {
    return { isValid: true };
  }

  if (card.type === 'WILD' && rules.allowWildOnAny) {
    return { isValid: true };
  }

  const effectiveColor = activeColor ?? topDiscardCard.color;
  const matchesColor =
    rules.matchingProperties.includes('color') &&
    Boolean(card.color && effectiveColor && card.color === effectiveColor);
  if (matchesColor) {
    return { isValid: true };
  }

  const matchesValue =
    rules.matchingProperties.includes('value') &&
    topDiscardCard.type !== 'WILD' &&
    card.value !== undefined &&
    topDiscardCard.value !== undefined &&
    String(card.value) === String(topDiscardCard.value);
  if (matchesValue) {
    return { isValid: true };
  }

  return {
    isValid: false,
    reason: `Card (${card.color} ${card.value}) does not match top card (${effectiveColor} ${topDiscardCard.value})`,
  };
}
