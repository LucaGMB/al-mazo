import { GameSchemaDefinition } from '../engine/types.js';
import { prisma } from '../db/prisma.js';
import { getOfficialGame } from './registry.js';

/**
 * Resolves a game definition by slug: official in-memory registry first, then
 * community/editor games persisted in the database (drafts included, so the
 * editor's "Probar Mesa" can test unsaved-to-community games).
 */
export async function resolveGameDefinition(
  slug: string
): Promise<GameSchemaDefinition | undefined> {
  const official = getOfficialGame(slug);
  if (official) return official;

  try {
    const record = await prisma.gameDefinition.findFirst({ where: { slug } });
    const schema = record?.schemaJson as Partial<GameSchemaDefinition> | null | undefined;
    if (!record || !schema?.deckConfig || !schema?.rules) return undefined;

    return {
      ...schema,
      slug: record.slug,
      title: record.title,
      description: record.description,
    } as GameSchemaDefinition;
  } catch (error) {
    console.error(`[games] Could not resolve game '${slug}' from the database`, error);
    return undefined;
  }
}
