import { GameSchemaDefinition } from '../engine/types.js';
import {
  colorMatchDefinition,
  colorMatchBlitzDefinition,
  colorMatchChaosDefinition,
} from './color-match/definition.js';
import { descarteCriolloDefinition } from './descarte-criollo/definition.js';
import { desconectadosDefinition } from './desconectados/definition.js';
import { escobaDefinition } from './escoba/definition.js';
import { chinchonDefinition } from './chinchon/definition.js';
import { trucoDefinition } from './truco/definition.js';
import { hdpDefinition } from './hdp/definition.js';
import { townOfSalemDefinition } from './town-of-salem/definition.js';

export const officialGames: Record<string, GameSchemaDefinition> = {
  [colorMatchDefinition.slug]: colorMatchDefinition,
  [descarteCriolloDefinition.slug]: descarteCriolloDefinition,
  [desconectadosDefinition.slug]: desconectadosDefinition,
  [escobaDefinition.slug]: escobaDefinition,
  [chinchonDefinition.slug]: chinchonDefinition,
  [trucoDefinition.slug]: trucoDefinition,
  [hdpDefinition.slug]: hdpDefinition,
  [townOfSalemDefinition.slug]: townOfSalemDefinition,
};

export function getOfficialGame(slug: string): GameSchemaDefinition | undefined {
  if (slug === 'color-match-blitz') return colorMatchBlitzDefinition;
  if (slug === 'color-match-chaos') return colorMatchChaosDefinition;
  return officialGames[slug];
}

export function getAllOfficialGames(): GameSchemaDefinition[] {
  return Object.values(officialGames);
}
