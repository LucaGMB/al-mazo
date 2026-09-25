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
 */
export type GameMode = 'TRICK' | 'COMMUNITY' | 'DISCARD';

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

export interface GameRulesConfig {
  initialHandSize: number;
  minPlayers: number;
  maxPlayers: number;
  matchingProperties: ('color' | 'value')[];
  allowWildOnAny: boolean;
  reshuffleDiscardPile: boolean;
  autoPassOnDraw?: boolean;
  effects: Record<string, CardEffect>; // keyed by card.value or card.type
  winCondition: WinConditionDefinition;
  zones?: ZoneDefinition[];
  phases?: PhaseDefinition[];
  cardHierarchy?: Record<string, number>;
  customState?: Record<string, unknown>;
  targetScore?: number;
  roundScoring?: Record<string, unknown>;
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
  turnExpiresAt?: number | null;
  currentPhase?: string | null;
  trickCards?: Array<{ playerId: string; card: Card }>;
  scores?: Record<string, number>;
  customState?: Record<string, unknown>;
  activeBets?: Record<string, unknown>;
  tableCards?: Card[];
  /** Modo de mesa que el cliente debe renderizar para este juego. */
  gameMode?: GameMode;
}
