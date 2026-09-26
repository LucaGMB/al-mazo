import type {
  EffectType,
  PhaseDefinition,
  WinConditionDefinition,
  ZoneDefinition,
} from './capabilities.js';

export type { EffectType };

export type TurnDirection = 1 | -1;

/**
 * How the table is played, independent from the specific game:
 * - TRICK: bazas + apuestas (truco) → cada jugador juega a la mesa central.
 * - COMMUNITY: cartas comunitarias que se capturan (escoba del 15).
 * - DISCARD: robo/descarte clásico (color-match/UNO, chinchón, descarte criollo).
 * - PROMPT: preguntas reveladas en público, sin manos (desconectados).
 */
export type GameMode = 'TRICK' | 'COMMUNITY' | 'DISCARD' | 'PROMPT';

export interface Card {
  id: string;
  type: string; // 'NUMBER', 'ACTION', 'WILD'
  color?: string; // 'RED', 'BLUE', 'GREEN', 'YELLOW', 'ANY'
  value?: string | number; // '0'-'9', 'SKIP', 'REVERSE', 'DRAW_2', 'WILD', 'WILD_DRAW_4'
  metadata?: Record<string, unknown>;
}

export interface CardTemplate {
  count: number;
  type: string;
  color?: string;
  value?: string | number;
  metadata?: Record<string, unknown>;
}

export interface DeckConfig {
  templates: CardTemplate[];
}

export interface CardEffect {
  type: EffectType;
  params?: {
    drawCount?: number;
    skipTarget?: boolean;
    step?: number;
    target?: 'NEXT' | 'ALL_OTHERS';
  };
}

export type DrawStackRule = 'OFF' | 'SAME_TYPE' | 'HIGHER_OR_EQUAL' | 'ALL';

/**
 * What happens when a player would empty their hand with a special card
 * (ACTION or WILD) under an EMPTY_HAND win condition:
 * - ALLOW: the play wins (default, classic behavior).
 * - BLOCK: the play is rejected; the player must play another card or draw.
 * - DRAW_PENALTY: the card is played, the player draws 2 and the game continues.
 */
export type FinishOnSpecialCardRule = 'ALLOW' | 'BLOCK' | 'DRAW_PENALTY';

export interface DrawStackConfig {
  rule: DrawStackRule;
  endsTurnOnDraw: boolean;
  allowAnyColorDraw2OnDraw4: boolean;
}

export const DEFAULT_DRAW_STACK_CONFIG: DrawStackConfig = {
  rule: 'ALL',
  endsTurnOnDraw: true,
  allowAnyColorDraw2OnDraw4: true,
};

export type SubmissionPhase = 'PREPARE' | 'COLLECTING' | 'JUDGING' | 'RESOLVED';

/**
 * Declarative configuration for judge-based games where everyone answers a
 * prompt at the same time and a rotating judge picks the winning answer.
 */
export interface SubmissionConfig {
  promptCardType: string;
  answerCardType: string;
  excludeJudge: boolean;
  picksFromPrompt: boolean;
  defaultPicks: number;
  judgeExchange: boolean;
  refillToHandSize: boolean;
  pointsPerWin: number;
}

export interface SubmissionEntry {
  id: string;
  cards: Card[];
  /** Only present on the winning entry once the judge has picked it. */
  playerId?: string;
}

export interface SubmissionRoundState {
  phase: SubmissionPhase;
  judgeId: string;
  promptCard: Card | null;
  requiredPicks: number;
  expectedSubmitters: string[];
  submittedPlayerIds: string[];
  /** Hidden while collecting; anonymous until the winning entry is revealed. */
  submissions: SubmissionEntry[];
  winnerSubmissionId: string | null;
  winnerPlayerId: string | null;
}

export interface GameRulesConfig {
  initialHandSize: number;
  minPlayers: number;
  maxPlayers: number;
  matchingProperties: ('color' | 'value')[];
  allowWildOnAny: boolean;
  reshuffleDiscardPile: boolean;
  autoPassOnDraw?: boolean;
  drawStack?: DrawStackConfig;
  effects: Record<string, CardEffect>; // keyed by card.value or card.type
  /** Emptying the hand with a special card (ACTION/WILD). Defaults to ALLOW. */
  finishOnSpecialCard?: FinishOnSpecialCardRule;
  winCondition: WinConditionDefinition;
  zones?: ZoneDefinition[];
  phases?: PhaseDefinition[];
  cardHierarchy?: Record<string, number>;
  customState?: Record<string, unknown>;
  targetScore?: number;
  roundScoring?: Record<string, unknown>;
  /** Optional explicit table layout; when omitted the engine derives it. */
  gameMode?: GameMode;
  /** Seconds before the server auto-passes a human turn. 0 disables the timer. */
  turnTimeoutSeconds?: number;
  submission?: SubmissionConfig;
  /** Whether the starting discard card must be a normal number card without special effects. */
  requireNormalInitialCard?: boolean;
}

export interface GameSchemaDefinition {
  slug: string;
  title: string;
  description: string;
  deckConfig: DeckConfig;
  rules: GameRulesConfig;
}

export interface PlayerPublicInfo {
  id: string;
  name: string;
  cardCount: number;
  isConnected: boolean;
  seatIndex: number;
  isBot?: boolean;
}

export interface PublicGameState {
  status: 'LOBBY' | 'IN_PROGRESS' | 'FINISHED';
  currentTurnPlayerId: string | null;
  turnDirection: TurnDirection;
  topDiscardCard: Card | null;
  activeColor: string | null;
  drawPileCount: number;
  discardPileCount: number;
  players: PlayerPublicInfo[];
  winnerId: string | null;
  pendingChoice: {
    playerId: string;
    type: 'COLOR';
  } | null;
  pendingDrawCount?: number;
  turnExpiresAt?: number | null;
  currentPhase?: string | null;
  trickCards?: Array<{ playerId: string; card: Card }>;
  scores?: Record<string, number>;
  customState?: Record<string, unknown>;
  activeBets?: Record<string, unknown>;
  tableCards?: Card[];
  /** Modo de mesa que el cliente debe renderizar para este juego. */
  gameMode?: GameMode;
  /** Players who owe an action right now (simultaneous phases). */
  awaitingPlayerIds?: string[];
  submission?: SubmissionRoundState | null;
}
