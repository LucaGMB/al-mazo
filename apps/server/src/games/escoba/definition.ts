import { Card, CardTemplate, GameSchemaDefinition } from '../../engine/types.js';

const SUITS = ['ESPADAS', 'BASTOS', 'OROS', 'COPAS'] as const;
const VALUES = ['1', '2', '3', '4', '5', '6', '7', '10', '11', '12'];

// Capture value of each card: 1-7 face value, Sota=8, Caballo=9, Rey=10
export const ESCOBA_VALUES: Record<string, number> = {
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '10': 8,
  '11': 9,
  '12': 10,
};

export function getEscobaCardValue(card: Card): number {
  return ESCOBA_VALUES[String(card.value)] ?? 0;
}

function generateSpanishDeckTemplates(): CardTemplate[] {
  const templates: CardTemplate[] = [];

  for (const suit of SUITS) {
    for (const value of VALUES) {
      templates.push({ count: 1, type: 'NUMBER', color: suit, value });
    }
  }

  return templates;
}

export function calculateEscobaValues(handCard: Card, tableCards: Card[]): boolean {
  if (tableCards.length === 0) return false;
  const total = [handCard, ...tableCards].reduce(
    (sum, card) => sum + getEscobaCardValue(card),
    0
  );
  return total === 15;
}

/**
 * Finds all subsets of tableCards that sum to (15 - handCard.value).
 */
export function findEscobaCaptures(handCard: Card, tableCards: Card[]): Card[][] {
  const handVal = getEscobaCardValue(handCard);
  const target = 15 - handVal;
  if (target < 0) return [];

  const results: Card[][] = [];

  function backtrack(startIndex: number, currentSubset: Card[], currentSum: number) {
    if (currentSum === target && currentSubset.length > 0) {
      results.push([...currentSubset]);
      return;
    }
    if (currentSum > target) return;

    for (let i = startIndex; i < tableCards.length; i++) {
      const val = getEscobaCardValue(tableCards[i]);
      currentSubset.push(tableCards[i]);
      backtrack(i + 1, currentSubset, currentSum + val);
      currentSubset.pop();
    }
  }

  backtrack(0, [], 0);
  return results;
}

/**
 * Regla especial del reparto inicial:
 * Si las 4 cartas iniciales de la mesa suman 15 o 30, el dador las recoge para sí,
 * contando 1 o 2 Escobas respectivamente, y la mesa queda limpia.
 */
export function checkInitialTableSpecialRule(tableCards: Card[]): {
  escobas: number;
  capturesAll: boolean;
} {
  if (tableCards.length !== 4) return { escobas: 0, capturesAll: false };
  const sum = tableCards.reduce((acc, c) => acc + getEscobaCardValue(c), 0);
  if (sum === 15) return { escobas: 1, capturesAll: true };
  if (sum === 30) return { escobas: 2, capturesAll: true };
  return { escobas: 0, capturesAll: false };
}

export function scoreRound(capturedCards: Card[], escobasCount: number): Record<string, number> {
  const sevens = capturedCards.filter((card) => card.value === '7');
  const sieteDeVelo = sevens.some((card) => card.color === 'OROS') ? 1 : 0;

  return {
    cards: capturedCards.length,
    oros: capturedCards.filter((card) => card.color === 'OROS').length,
    sevens: sevens.length,
    sieteDeVelo,
    escobas: escobasCount,
    total: sieteDeVelo + escobasCount,
  };
}

export interface PlayerRoundScore {
  playerId: string;
  cardsCount: number;
  orosCount: number;
  sevensCount: number;
  hasSieteDeOros: boolean;
  escobasCount: number;
  pointsBreakdown: {
    escobas: number;
    sieteDeOros: number;
    mayoriaOros: number;
    todosLosOros: number;
    mayoriaSietes: number;
    cuatroSietes: number;
    mayoriaCartas: number;
    menosDeDiezCartas: number;
  };
  roundPoints: number;
  autoLoss?: boolean;
}

export interface EscobaRoundResult {
  playerScores: Record<string, PlayerRoundScore>;
  autoLossPlayerId?: string | null;
}

/**
 * Official Escoba Round Scoring:
 * - 1 pt per Escoba
 * - 2 pts for all 10 Oros
 * - 1 pt for majority of Oros (if not all 10; tie = 0)
 * - 1 pt for Siete de Oros (Guindis)
 * - 3 pts for all 4 Sevens
 * - 1 pt for majority of Sevens (if not all 4; tie = 0)
 * - 1 pt for majority of cards (tie = 0)
 * - 2 pts if opponent has less than 10 cards (in 2-player games)
 * - Automatic loss if an opponent made 0 captures
 */
export function scoreEscobaMatchRound(
  playersCards: Record<string, Card[]>,
  escobasCount: Record<string, number> = {}
): EscobaRoundResult {
  const playerIds = Object.keys(playersCards);
  const playerScores: Record<string, PlayerRoundScore> = {};

  let autoLossPlayerId: string | null = null;

  for (const id of playerIds) {
    const cards = playersCards[id] ?? [];
    const sevens = cards.filter((c) => String(c.value) === '7');
    const oros = cards.filter((c) => c.color === 'OROS');
    const hasSieteDeOros = sevens.some((c) => c.color === 'OROS');
    const escobas = escobasCount[id] ?? 0;

    if (cards.length === 0) {
      autoLossPlayerId = id;
    }

    playerScores[id] = {
      playerId: id,
      cardsCount: cards.length,
      orosCount: oros.length,
      sevensCount: sevens.length,
      hasSieteDeOros,
      escobasCount: escobas,
      pointsBreakdown: {
        escobas,
        sieteDeOros: hasSieteDeOros ? 1 : 0,
        mayoriaOros: 0,
        todosLosOros: 0,
        mayoriaSietes: 0,
        cuatroSietes: 0,
        mayoriaCartas: 0,
        menosDeDiezCartas: 0,
      },
      roundPoints: 0,
      autoLoss: cards.length === 0,
    };
  }

  // Check majorities across players
  const maxOros = Math.max(...playerIds.map((id) => playerScores[id].orosCount), 0);
  const orosLeaders = playerIds.filter((id) => playerScores[id].orosCount === maxOros);
  if (maxOros === 10 && orosLeaders.length === 1) {
    playerScores[orosLeaders[0]].pointsBreakdown.todosLosOros = 2;
  } else if (maxOros > 0 && orosLeaders.length === 1) {
    playerScores[orosLeaders[0]].pointsBreakdown.mayoriaOros = 1;
  }

  const maxSevens = Math.max(...playerIds.map((id) => playerScores[id].sevensCount), 0);
  const sevensLeaders = playerIds.filter((id) => playerScores[id].sevensCount === maxSevens);
  if (maxSevens === 4 && sevensLeaders.length === 1) {
    playerScores[sevensLeaders[0]].pointsBreakdown.cuatroSietes = 3;
  } else if (maxSevens > 0 && sevensLeaders.length === 1) {
    playerScores[sevensLeaders[0]].pointsBreakdown.mayoriaSietes = 1;
  }

  const maxCards = Math.max(...playerIds.map((id) => playerScores[id].cardsCount), 0);
  const cardsLeaders = playerIds.filter((id) => playerScores[id].cardsCount === maxCards);
  if (maxCards > 0 && cardsLeaders.length === 1) {
    playerScores[cardsLeaders[0]].pointsBreakdown.mayoriaCartas = 1;
  }

  // In 2-player games: if opponent has < 10 cards and player has more cards, player gets 2 pts
  if (playerIds.length === 2) {
    const [p1, p2] = playerIds;
    if (playerScores[p2].cardsCount < 10 && playerScores[p1].cardsCount > playerScores[p2].cardsCount) {
      playerScores[p1].pointsBreakdown.menosDeDiezCartas = 2;
    } else if (playerScores[p1].cardsCount < 10 && playerScores[p2].cardsCount > playerScores[p1].cardsCount) {
      playerScores[p2].pointsBreakdown.menosDeDiezCartas = 2;
    }
  }

  // Sum total round points for each player
  for (const id of playerIds) {
    const b = playerScores[id].pointsBreakdown;
    playerScores[id].roundPoints =
      b.escobas +
      b.sieteDeOros +
      b.mayoriaOros +
      b.todosLosOros +
      b.mayoriaSietes +
      b.cuatroSietes +
      b.mayoriaCartas +
      b.menosDeDiezCartas;
  }

  return { playerScores, autoLossPlayerId };
}

export const escobaDefinition: GameSchemaDefinition = {
  slug: 'escoba-del-15',
  title: 'Escoba del 15',
  description:
    'Juego tradicional español de captura: suma 15 puntos combinando una carta de la mano con una o varias de la mesa. Escoba limpia la mesa.',
  deckConfig: {
    templates: generateSpanishDeckTemplates(),
  },
  rules: {
    initialHandSize: 3,
    minPlayers: 2,
    maxPlayers: 4,
    matchingProperties: [],
    allowWildOnAny: false,
    reshuffleDiscardPile: false,
    effects: {},
    winCondition: {
      type: 'SCORE_THRESHOLD',
      targetScore: 15,
    },
    zones: [
      {
        id: 'hand',
        name: 'Mano',
        type: 'HAND',
        visibility: 'PRIVATE_OWNER',
        perPlayer: true,
      },
      {
        id: 'draw_pile',
        name: 'Mazo',
        type: 'DRAW_PILE',
        visibility: 'HIDDEN',
      },
      {
        id: 'table',
        name: 'Mesa',
        type: 'COMMUNITY',
        visibility: 'PUBLIC',
      },
    ],
    phases: [
      {
        id: 'PLAY_PHASE',
        name: 'Turno de Juego',
        allowedActions: ['CAPTURE_CARDS', 'DROP_CARD', 'PLAY_CARD'],
      },
    ],
    customState: {
      initialTableCards: 4,
      targetScore: 15,
    },
    targetScore: 15,
  },
};
