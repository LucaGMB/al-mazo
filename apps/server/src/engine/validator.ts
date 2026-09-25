import { Card, GameRulesConfig } from './types.js';

export interface PlayValidationResult {
  isValid: boolean;
  reason?: string;
}

export function validateCardPlay(
  card: Card,
  topDiscardCard: Card | null,
  activeColor: string | null,
  rules: GameRulesConfig,
  pendingDrawCount = 0
): PlayValidationResult {
  if (pendingDrawCount > 0) {
    const effectKey = String(card.value ?? card.type);
    const cardEffect = rules.effects[effectKey];
    if (!cardEffect || cardEffect.type !== 'DRAW_CARDS') {
      return {
        isValid: false,
        reason: 'Hay cartas de robo acumuladas. Debes responder con una carta de robo acumulable o robar el pozo de castigo.',
      };
    }

    const stackConfig = rules.drawStack ?? {
      rule: 'ALL',
      endsTurnOnDraw: true,
      allowAnyColorDraw2OnDraw4: true,
    };

    if (stackConfig.rule === 'OFF') {
      return {
        isValid: false,
        reason: 'La acumulación de cartas de robo está desactivada.',
      };
    }

    const topEffectKey = topDiscardCard
      ? String(topDiscardCard.value ?? topDiscardCard.type)
      : '';
    const topEffect = topDiscardCard ? rules.effects[topEffectKey] : undefined;
    const cardDrawCount = cardEffect.params?.drawCount ?? 2;
    const topDrawCount = topEffect?.params?.drawCount ?? 2;

    if (stackConfig.rule === 'SAME_TYPE' && cardDrawCount !== topDrawCount) {
      return {
        isValid: false,
        reason: 'Solo se pueden acumular cartas de robo del mismo tipo (+2 sobre +2 o +4 sobre +4).',
      };
    }

    if (stackConfig.rule === 'HIGHER_OR_EQUAL' && cardDrawCount < topDrawCount) {
      return {
        isValid: false,
        reason: 'Solo se pueden acumular cartas de robo de igual o mayor valor.',
      };
    }

    // Checking color restriction when playing a lower draw card over higher (e.g. +2 on +4)
    if (
      cardDrawCount < topDrawCount &&
      !stackConfig.allowAnyColorDraw2OnDraw4
    ) {
      const effectiveColor = activeColor ?? topDiscardCard?.color;
      if (card.color && effectiveColor && card.color !== effectiveColor) {
        return {
          isValid: false,
          reason: `Para responder a un +4 con un +2 debes coincidir con el color elegido (${effectiveColor}).`,
        };
      }
    }

    return { isValid: true };
  }

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
