import { GameSchemaDefinition } from '../../engine/types.js';
import { getDeckPresetTemplates } from '../../engine/capabilities/deck-presets.js';

export const hdpDefinition: GameSchemaDefinition = {
  slug: 'hdp',
  title: 'HDP (Hasta Donde Puedas)',
  description:
    'Juego de humor y creatividad: un HDP lee una consigna y todos los demás responden en secreto con sus cartas. El HDP elige la respuesta más zarpada y el ganador suma puntos.',
  deckConfig: {
    templates: getDeckPresetTemplates('HDP_DEMO'),
  },
  rules: {
    initialHandSize: 10,
    minPlayers: 3,
    maxPlayers: 8,
    matchingProperties: [],
    allowWildOnAny: false,
    reshuffleDiscardPile: true,
    effects: {},
    winCondition: {
      type: 'SCORE_THRESHOLD',
      targetScore: 5,
    },
    targetScore: 5,
    zones: [
      { id: 'hand', name: 'Mano', type: 'HAND', visibility: 'PRIVATE_OWNER', perPlayer: true },
      { id: 'prompt_pile', name: 'Mazo de Consignas', type: 'DRAW_PILE', visibility: 'HIDDEN' },
      { id: 'answer_pile', name: 'Mazo de Respuestas', type: 'DRAW_PILE', visibility: 'HIDDEN' },
      { id: 'submission_table', name: 'Respuestas Enviadas', type: 'REVEALED', visibility: 'PUBLIC' },
    ],
    phases: [
      {
        id: 'PREPARE',
        name: 'Consigna del HDP',
        allowedActions: ['EXCHANGE_CARDS', 'CONFIRM_PHASE'],
        nextPhase: 'COLLECT',
        onEnter: [{ type: 'DRAW_PROMPT' }],
      },
      {
        id: 'COLLECT',
        name: 'Respuestas Ocultas',
        allowedActions: ['SUBMIT_CARDS'],
        nextPhase: 'JUDGING',
        onEnter: [{ type: 'OPEN_SUBMISSIONS' }],
      },
      {
        id: 'JUDGING',
        name: 'El HDP Elige',
        allowedActions: ['PICK_SUBMISSION'],
        nextPhase: 'SCORING',
      },
      {
        id: 'SCORING',
        name: 'Puntaje y Reveal',
        allowedActions: ['CONFIRM_PHASE'],
        nextPhase: 'PREPARE',
        onEnter: [{ type: 'AWARD_SUBMISSION' }, { type: 'REFILL_HANDS' }],
        onExit: [{ type: 'ADVANCE_TURN', params: { step: 1 } }, { type: 'RESET_ROUND' }],
      },
    ],
    submission: {
      promptCardType: 'PROMPT',
      answerCardType: 'ANSWER',
      excludeJudge: true,
      picksFromPrompt: true,
      defaultPicks: 1,
      judgeExchange: true,
      refillToHandSize: true,
      pointsPerWin: 1,
    },
  },
};
