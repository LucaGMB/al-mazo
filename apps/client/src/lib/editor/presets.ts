export interface CardTemplate {
  count: number;
  type: string;
  color?: string;
  value?: string | number;
  metadata?: Record<string, unknown>;
}

export interface ZoneDefinition {
  id: string;
  name: string;
  type: "HAND" | "DRAW_PILE" | "DISCARD_PILE" | "TRICK_TABLE" | "COMMUNITY" | "REVEALED";
  visibility: "PRIVATE_OWNER" | "PUBLIC" | "HIDDEN";
  perPlayer?: boolean;
  maxCards?: number;
}

export interface PhaseDefinition {
  id: string;
  name: string;
  allowedActions: string[];
  nextPhase?: string;
}

export interface GameDefinitionData {
  id?: string;
  slug: string;
  title: string;
  description: string;
  deckConfig: {
    templates: CardTemplate[];
  };
  rules: {
    minPlayers: number;
    maxPlayers: number;
    initialHandSize?: number;
    matchingProperties?: Array<"color" | "value">;
    allowWildOnAny?: boolean;
    reshuffleDiscardPile?: boolean;
    winCondition: {
      type: "EMPTY_HAND" | "SCORE_THRESHOLD" | "LAST_REMAINING";
      targetScore?: number;
    };
    zones?: ZoneDefinition[];
    phases?: PhaseDefinition[];
    cardHierarchy?: Record<string, number>;
    targetScore?: number;
    effects?: Record<string, { type: string; params?: Record<string, unknown> }>;
  };
}

const SPANISH_SUITS = ["OROS", "COPAS", "ESPADAS", "BASTOS"] as const;
const SPANISH_40_VALUES = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12] as const;
const SPANISH_50_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const FRENCH_SUITS = ["HEARTS", "DIAMONDS", "CLUBS", "SPADES"] as const;
const FRENCH_RANKS = [
  { value: "2", type: "NUMBER" },
  { value: "3", type: "NUMBER" },
  { value: "4", type: "NUMBER" },
  { value: "5", type: "NUMBER" },
  { value: "6", type: "NUMBER" },
  { value: "7", type: "NUMBER" },
  { value: "8", type: "NUMBER" },
  { value: "9", type: "NUMBER" },
  { value: "10", type: "NUMBER" },
  { value: "J", type: "FACE" },
  { value: "Q", type: "FACE" },
  { value: "K", type: "FACE" },
  { value: "A", type: "ACE" },
] as const;

const COLOR_MATCH_COLORS = ["RED", "BLUE", "GREEN", "YELLOW"] as const;

export function buildSpanishTemplates(values: readonly number[]): CardTemplate[] {
  const templates: CardTemplate[] = [];
  for (const suit of SPANISH_SUITS) {
    for (const val of values) {
      templates.push({ count: 1, type: "NUMBER", color: suit, value: String(val) });
    }
  }
  return templates;
}

export function buildFrenchTemplates(): CardTemplate[] {
  const templates: CardTemplate[] = [];
  for (const suit of FRENCH_SUITS) {
    for (const rank of FRENCH_RANKS) {
      templates.push({ count: 1, type: rank.type, color: suit, value: rank.value });
    }
  }
  return templates;
}

export function buildColorMatchTemplates(): CardTemplate[] {
  const templates: CardTemplate[] = [];
  for (const color of COLOR_MATCH_COLORS) {
    templates.push({ count: 1, type: "NUMBER", color, value: "0" });
    for (let num = 1; num <= 9; num++) {
      templates.push({ count: 2, type: "NUMBER", color, value: String(num) });
    }
    templates.push(
      { count: 2, type: "ACTION", color, value: "SKIP" },
      { count: 2, type: "ACTION", color, value: "REVERSE" },
      { count: 2, type: "ACTION", color, value: "DRAW_2" }
    );
  }
  templates.push(
    { count: 4, type: "WILD", color: "ANY", value: "WILD" },
    { count: 4, type: "WILD", color: "ANY", value: "WILD_DRAW_4" }
  );
  return templates;
}

export interface DeckPresetOption {
  id: string;
  name: string;
  description: string;
  totalCards: number;
  templates: () => CardTemplate[];
}

export const DECK_PRESET_OPTIONS: DeckPresetOption[] = [
  {
    id: "SPANISH_40",
    name: "Baraja Española 40",
    description: "40 cartas tradicionales (1-7, 10-12 en Oros, Copas, Espadas y Bastos).",
    totalCards: 40,
    templates: () => buildSpanishTemplates(SPANISH_40_VALUES),
  },
  {
    id: "SPANISH_50",
    name: "Baraja Española 50",
    description: "48 cartas (1-12 en los 4 palos) más 2 comodines.",
    totalCards: 50,
    templates: () => [
      ...buildSpanishTemplates(SPANISH_50_VALUES),
      { count: 2, type: "WILD", color: "ANY", value: "COMODIN" },
    ],
  },
  {
    id: "FRENCH_52",
    name: "Baraja Francesa 52",
    description: "52 cartas de póker estándar (2-10, J, Q, K, A en Picas, Corazones, Diamantes y Tréboles).",
    totalCards: 52,
    templates: () => buildFrenchTemplates(),
  },
  {
    id: "COLOR_MATCH_108",
    name: "Baraja ColorMatch 108",
    description: "108 cartas tipo UNO (4 colores, 0-9, reversa, salto, robar +2 y comodines).",
    totalCards: 108,
    templates: () => buildColorMatchTemplates(),
  },
];

export const DEFAULT_ZONES: ZoneDefinition[] = [
  { id: "hand", name: "Mano del Jugador", type: "HAND", visibility: "PRIVATE_OWNER", perPlayer: true },
  { id: "draw_pile", name: "Mazo de Robo", type: "DRAW_PILE", visibility: "HIDDEN" },
  { id: "discard_pile", name: "Pozo de Descarte", type: "DISCARD_PILE", visibility: "PUBLIC" },
  { id: "trick_table", name: "Mesa de Bazas", type: "TRICK_TABLE", visibility: "PUBLIC" },
  { id: "community", name: "Cartas Comunitarias", type: "COMMUNITY", visibility: "PUBLIC" },
  { id: "revealed", name: "Cartas Reveladas", type: "REVEALED", visibility: "PUBLIC" },
];

export const DEFAULT_NEW_GAME: GameDefinitionData = {
  slug: "mi-nuevo-juego",
  title: "Mi Nuevo Juego",
  description: "Un juego de cartas personalizado creado con el editor visual de Al Mazo.",
  deckConfig: {
    templates: buildSpanishTemplates(SPANISH_40_VALUES),
  },
  rules: {
    minPlayers: 2,
    maxPlayers: 4,
    initialHandSize: 3,
    matchingProperties: ["color", "value"],
    allowWildOnAny: true,
    reshuffleDiscardPile: true,
    winCondition: {
      type: "EMPTY_HAND",
    },
    zones: [
      { id: "hand", name: "Mano", type: "HAND", visibility: "PRIVATE_OWNER", perPlayer: true },
      { id: "draw_pile", name: "Mazo", type: "DRAW_PILE", visibility: "HIDDEN" },
      { id: "discard_pile", name: "Descarte", type: "DISCARD_PILE", visibility: "PUBLIC" },
    ],
    phases: [
      {
        id: "main",
        name: "Turno Principal",
        allowedActions: ["PLAY_CARD", "DRAW_CARD", "PASS_TURN"],
      },
    ],
  },
};

export const TRUCO_CARD_HIERARCHY: Record<string, number> = {
  "1 ESPADAS": 14,
  "1 BASTOS": 13,
  "7 ESPADAS": 12,
  "7 OROS": 11,
  "3": 10,
  "2": 9,
  "1 OROS": 8,
  "1 COPAS": 8,
  "12": 7,
  "11": 6,
  "10": 5,
  "7 BASTOS": 4,
  "7 COPAS": 4,
  "6": 3,
  "5": 2,
  "4": 1,
};

export const TRUCO_GAME_PRESET: GameDefinitionData = {
  slug: "truco-personalizado",
  title: "Truco Personalizado",
  description: "Juego tradicional de bazas y envites con baraja española de 40 cartas y jerarquía.",
  deckConfig: {
    templates: buildSpanishTemplates(SPANISH_40_VALUES),
  },
  rules: {
    minPlayers: 2,
    maxPlayers: 2,
    initialHandSize: 3,
    matchingProperties: [],
    allowWildOnAny: false,
    reshuffleDiscardPile: false,
    cardHierarchy: TRUCO_CARD_HIERARCHY,
    winCondition: {
      type: "SCORE_THRESHOLD",
      targetScore: 30,
    },
    targetScore: 30,
    zones: [
      { id: "hand", name: "Mano", type: "HAND", visibility: "PRIVATE_OWNER", perPlayer: true },
      { id: "trick_table", name: "Mesa de Bazas", type: "TRICK_TABLE", visibility: "PUBLIC" },
    ],
    phases: [
      {
        id: "ENVIDO_PHASE",
        name: "Canto de Envido y Flor",
        allowedActions: [
          "CALL_FLOR",
          "CALL_CONTRA_FLOR",
          "CALL_CONTRA_FLOR_AL_RESTO",
          "CON_FLOR_QUIERO",
          "CON_FLOR_ME_ACHICO",
          "CALL_ENVIDO",
          "CALL_REAL_ENVIDO",
          "CALL_FALTA_ENVIDO",
          "EL_ENVIDO_ESTA_PRIMERO",
          "RESPOND_BET",
          "QUIERO",
          "NO_QUIERO",
          "FOLD",
        ],
      },
      {
        id: "TRICK_PLAY",
        name: "Juego de Bazas",
        allowedActions: [
          "PLAY_CARD",
          "CALL_FLOR",
          "CALL_CONTRA_FLOR",
          "CALL_CONTRA_FLOR_AL_RESTO",
          "CON_FLOR_QUIERO",
          "CON_FLOR_ME_ACHICO",
          "CALL_ENVIDO",
          "CALL_REAL_ENVIDO",
          "CALL_FALTA_ENVIDO",
          "EL_ENVIDO_ESTA_PRIMERO",
          "CALL_TRUCO",
          "CALL_RETRUCO",
          "CALL_VALE_CUATRO",
          "RESPOND_BET",
          "QUIERO",
          "NO_QUIERO",
          "FOLD",
        ],
      },
      {
        id: "ROUND_SCORING",
        name: "Puntaje de Ronda",
        allowedActions: [],
      },
    ],
  },
};

export const GAME_PRESETS = [
  {
    id: "default",
    name: "Descarte Simple",
    description: "Juego base de descarte y robo por coincidencia de color o valor.",
    data: DEFAULT_NEW_GAME,
  },
  {
    id: "truco",
    name: "Truco Criollo (Bazas y Envites)",
    description: "Juego de 3 cartas, bazas con jerarquía, envido, truco y puntos a 30.",
    data: TRUCO_GAME_PRESET,
  },
];

