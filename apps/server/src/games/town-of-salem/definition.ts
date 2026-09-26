import type { GameSchemaDefinition } from '../../engine/types.js';
import { generateTownRoleCardTemplates } from './roles.js';

export const townOfSalemDefinition: GameSchemaDefinition = {
  slug: 'town-of-salem',
  title: 'Town of Salem',
  description:
    'Juego de deducción social y roles ocultos. Cada noche la Mafia ataca, el Doctor protege y el Sheriff investiga. De día el Pueblo debate y vota para linchar a los sospechosos.',
  deckConfig: {
    templates: generateTownRoleCardTemplates(),
  },
  rules: {
    initialHandSize: 1, // Carta de Rol Secreto
    minPlayers: 4,
    maxPlayers: 8,
    matchingProperties: [],
    allowWildOnAny: false,
    reshuffleDiscardPile: false,
    autoPassOnDraw: false,
    effects: {},
    gameMode: 'TOWN',
    turnTimeoutSeconds: 30,
    winCondition: {
      type: 'FACTION_ELIMINATION',
    },
    zones: [
      { id: 'roles', name: 'Mazo de Roles', type: 'DRAW_PILE', visibility: 'HIDDEN' },
      { id: 'town_square', name: 'Plaza del Pueblo', type: 'REVEALED', visibility: 'PUBLIC' },
    ],
    phases: [
      {
        id: 'TOWN_NIGHT',
        name: 'Noche',
        allowedActions: ['SUBMIT_NIGHT_ACTION'],
        nextPhase: 'TOWN_DAY_CHAT',
      },
      {
        id: 'TOWN_DAY_CHAT',
        name: 'Día - Debate',
        allowedActions: ['START_DAY_VOTE'],
        nextPhase: 'TOWN_DAY_VOTE',
      },
      {
        id: 'TOWN_DAY_VOTE',
        name: 'Día - Votación',
        allowedActions: ['CAST_VOTE'],
        nextPhase: 'TOWN_NIGHT',
      },
    ],
  },
};
