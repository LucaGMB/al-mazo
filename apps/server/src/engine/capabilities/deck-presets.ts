import type { CardTemplate, DeckPresetSummary } from '../types.js';

export interface DeckPreset {
  id: string;
  name: string;
  description: string;
  templates: CardTemplate[];
}

const SPANISH_SUITS = ['OROS', 'COPAS', 'ESPADAS', 'BASTOS'] as const;
const SPANISH_40_VALUES = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12] as const;
const SPANISH_50_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const FRENCH_SUITS = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'] as const;
const FRENCH_RANKS: Array<{ value: string; type: string }> = [
  { value: '2', type: 'NUMBER' },
  { value: '3', type: 'NUMBER' },
  { value: '4', type: 'NUMBER' },
  { value: '5', type: 'NUMBER' },
  { value: '6', type: 'NUMBER' },
  { value: '7', type: 'NUMBER' },
  { value: '8', type: 'NUMBER' },
  { value: '9', type: 'NUMBER' },
  { value: '10', type: 'NUMBER' },
  { value: 'J', type: 'FACE' },
  { value: 'Q', type: 'FACE' },
  { value: 'K', type: 'FACE' },
  { value: 'A', type: 'ACE' },
];

const COLOR_MATCH_COLORS = ['RED', 'BLUE', 'GREEN', 'YELLOW'] as const;

function buildSpanishTemplates(values: readonly number[]): CardTemplate[] {
  const templates: CardTemplate[] = [];
  for (const suit of SPANISH_SUITS) {
    for (const value of values) {
      templates.push({ count: 1, type: 'NUMBER', color: suit, value: String(value) });
    }
  }
  return templates;
}

function buildFrenchTemplates(): CardTemplate[] {
  const templates: CardTemplate[] = [];
  for (const suit of FRENCH_SUITS) {
    for (const rank of FRENCH_RANKS) {
      templates.push({ count: 1, type: rank.type, color: suit, value: rank.value });
    }
  }
  return templates;
}

function buildColorMatchTemplates(): CardTemplate[] {
  const templates: CardTemplate[] = [];
  for (const color of COLOR_MATCH_COLORS) {
    templates.push({ count: 1, type: 'NUMBER', color, value: '0' });
    for (let num = 1; num <= 9; num++) {
      templates.push({ count: 2, type: 'NUMBER', color, value: String(num) });
    }
    templates.push(
      { count: 2, type: 'ACTION', color, value: 'SKIP' },
      { count: 2, type: 'ACTION', color, value: 'REVERSE' },
      { count: 2, type: 'ACTION', color, value: 'DRAW_2' }
    );
  }
  templates.push(
    { count: 4, type: 'WILD', color: 'ANY', value: 'WILD' },
    { count: 4, type: 'WILD', color: 'ANY', value: 'WILD_DRAW_4' }
  );
  return templates;
}

export const SPANISH_40: DeckPreset = {
  id: 'SPANISH_40',
  name: 'Baraja Española 40',
  description: 'Spanish 40-card deck (1-7, 10-12 across Oros, Copas, Espadas, Bastos).',
  templates: buildSpanishTemplates(SPANISH_40_VALUES),
};

export const SPANISH_50: DeckPreset = {
  id: 'SPANISH_50',
  name: 'Baraja Española 50',
  description: 'Spanish 48-card deck (1-12 across four suits) plus 2 comodines.',
  templates: [
    ...buildSpanishTemplates(SPANISH_50_VALUES),
    { count: 2, type: 'WILD', color: 'ANY', value: 'COMODIN' },
  ],
};

export const FRENCH_52: DeckPreset = {
  id: 'FRENCH_52',
  name: 'French 52',
  description: 'Standard 52-card French deck (2-10, J, Q, K, A across four suits).',
  templates: buildFrenchTemplates(),
};

export const COLOR_MATCH_108: DeckPreset = {
  id: 'COLOR_MATCH_108',
  name: 'ColorMatch 108',
  description: 'UNO-like 108-card deck with numbers, actions and wilds.',
  templates: buildColorMatchTemplates(),
};

export const DECK_PRESETS: DeckPreset[] = [
  SPANISH_40,
  SPANISH_50,
  FRENCH_52,
  COLOR_MATCH_108,
];

export function getDeckPreset(presetId: string): DeckPreset | undefined {
  return DECK_PRESETS.find((preset) => preset.id === presetId);
}

export function getDeckPresetTemplates(presetId: string): CardTemplate[] {
  const preset = getDeckPreset(presetId);
  if (!preset) {
    throw new Error(`Unknown deck preset: ${presetId}`);
  }
  return preset.templates.map((template) => ({ ...template }));
}

export function getDeckPresetsSummary(): DeckPresetSummary[] {
  return DECK_PRESETS.map((preset) => ({
    id: preset.id,
    name: preset.name,
    description: preset.description,
    totalCards: preset.templates.reduce((sum, template) => sum + template.count, 0),
  }));
}