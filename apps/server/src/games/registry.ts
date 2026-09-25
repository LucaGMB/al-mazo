import { GameSchemaDefinition } from '../engine/types.js';
import { colorMatchDefinition } from './color-match/definition.js';
import { colorMatchBlitzDefinition } from './color-match-blitz/definition.js';
import { colorMatchChaosDefinition } from './color-match-chaos/definition.js';
import { descarteCriolloDefinition } from './descarte-criollo/definition.js';
import { escobaDefinition } from './escoba/definition.js';
import { chinchonDefinition } from './chinchon/definition.js';
import { trucoDefinition } from './truco/definition.js';

export const officialGames: Record<string, GameSchemaDefinition> = {
  [colorMatchDefinition.slug]: colorMatchDefinition,
  [colorMatchBlitzDefinition.slug]: colorMatchBlitzDefinition,
  [colorMatchChaosDefinition.slug]: colorMatchChaosDefinition,
  [descarteCriolloDefinition.slug]: descarteCriolloDefinition,
  [escobaDefinition.slug]: escobaDefinition,
  [chinchonDefinition.slug]: chinchonDefinition,
  [trucoDefinition.slug]: trucoDefinition,
};

export function getOfficialGame(slug: string): GameSchemaDefinition | undefined {
  return officialGames[slug];
}

export function getAllOfficialGames(): GameSchemaDefinition[] {
  return Object.values(officialGames);
}
