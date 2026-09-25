import { CardTemplate, GameSchemaDefinition } from '../../engine/types.js';
import { BLANK_CARD_COUNT, PROMPT_CATEGORIES } from './questions.js';

function buildPromptTemplates(): CardTemplate[] {
  const templates: CardTemplate[] = [];

  for (const category of PROMPT_CATEGORIES) {
    category.questions.forEach((question, index) => {
      templates.push({
        count: 1,
        type: 'PROMPT',
        color: category.id,
        value: index + 1,
        metadata: {
          category: category.id,
          categoryLabel: category.label,
          question,
        },
      });
    });
  }

  templates.push({
    count: BLANK_CARD_COUNT,
    type: 'BLANK',
    color: 'EN_BLANCO',
    value: 'EN_BLANCO',
    metadata: {
      category: 'EN_BLANCO',
      categoryLabel: 'En blanco',
      question: '',
    },
  });

  return templates;
}

/**
 * Desconectados: juego de conversación sin ganador. Cada turno revela una
 * pregunta pública (REVEAL_CARD) y el jugador la responde en voz alta antes de
 * pasar a la siguiente. Cuando se agota el mazo, la partida se cierra sin
 * ganador (END_GAME / winCondition NONE).
 */
export const desconectadosDefinition: GameSchemaDefinition = {
  slug: 'desconectados',
  title: 'Desconectados',
  description:
    'Juego de preguntas para conectar sin pantallas. Cuatro secciones (Perspectiva, Presentación, Profundidad y Descomprimir) invitan a debatir, reír y abrirse. Elegís una carta, la respondés y escuchás. Sin ganador: solo el vínculo.',
  deckConfig: {
    templates: buildPromptTemplates(),
  },
  rules: {
    initialHandSize: 0,
    minPlayers: 2,
    maxPlayers: 12,
    matchingProperties: [],
    allowWildOnAny: false,
    reshuffleDiscardPile: false,
    autoPassOnDraw: false,
    effects: {},
    winCondition: {
      type: 'NONE',
    },
    zones: [
      { id: 'draw_pile', name: 'Mazo de Preguntas', type: 'DRAW_PILE', visibility: 'HIDDEN' },
      { id: 'prompt', name: 'Pregunta Revelada', type: 'REVEALED', visibility: 'PUBLIC' },
    ],
    phases: [
      {
        id: 'PROMPT',
        name: 'Ronda de Preguntas',
        allowedActions: ['REVEAL_CARD', 'END_GAME'],
      },
    ],
    gameMode: 'PROMPT',
    // Responder puede llevar minutos: sin auto-pase por inactividad.
    turnTimeoutSeconds: 0,
  },
};