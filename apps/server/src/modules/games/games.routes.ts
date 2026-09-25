import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { randomUUID } from 'node:crypto';
import { getAllOfficialGames, getOfficialGame } from '../../games/registry.js';
import { getCapabilitiesManifest } from '../../engine/capabilities/registry.js';
import { validateGameSchema } from './games.validator.js';
import { AUTH_SECRET } from '../auth/auth.middleware.js';
import { GameSchemaDefinition } from '../../engine/types.js';
import { prisma } from '../../db/prisma.js';

interface GameRecord {
  id: string;
  slug: string;
  title: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  isOfficial: boolean;
  isPublished: boolean;
  status: string;
  authorId: string | null;
  schemaJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory fallback so the API keeps working when the database is unreachable
// (local development without Postgres, preview deployments, tests).
const memoryGames = new Map<string, GameRecord>();

interface ListFilters {
  status?: string;
  type?: string;
  search?: string;
}

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'game';
}

function toRecord(game: {
  id: string;
  slug: string;
  title: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  isOfficial: boolean;
  isPublished: boolean;
  status: string;
  authorId: string | null;
  schemaJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}): GameRecord {
  return { ...game };
}

function toPublic(record: GameRecord) {
  const schema = (record.schemaJson ?? {}) as Record<string, unknown>;
  return {
    ...schema,
    id: record.id,
    slug: record.slug,
    title: record.title,
    description: record.description,
    minPlayers: record.minPlayers,
    maxPlayers: record.maxPlayers,
    isOfficial: record.isOfficial,
    status: record.status,
    authorId: record.authorId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function resolveAuthor(request: FastifyRequest, body: unknown): string | null {
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(header.slice(7), AUTH_SECRET) as { userId?: string };
      if (decoded.userId) return decoded.userId;
    } catch {
      // fall through to creator identity
    }
  }

  const payload = (body ?? {}) as { authorId?: unknown; creatorId?: unknown };
  const headerIdentity = request.headers['x-creator-id'];
  const creator =
    (typeof headerIdentity === 'string' ? headerIdentity : undefined) ??
    (typeof payload.authorId === 'string' ? payload.authorId : undefined) ??
    (typeof payload.creatorId === 'string' ? payload.creatorId : undefined);

  return creator ?? null;
}

async function reservedSlugs(): Promise<Set<string>> {
  const slugs = new Set(getAllOfficialGames().map((game) => game.slug));
  for (const game of memoryGames.values()) slugs.add(game.slug);
  try {
    const dbGames = await prisma.gameDefinition.findMany({ select: { slug: true } });
    for (const game of dbGames) slugs.add(game.slug);
  } catch {
    // DB offline, official + memory slugs are enough to avoid obvious collisions
  }
  return slugs;
}

async function uniqueSlug(base: string): Promise<string> {
  const reserved = await reservedSlugs();
  if (!reserved.has(base)) return base;
  return `${base}-${nanoid(4).toLowerCase()}`;
}

async function createGame(record: GameRecord): Promise<GameRecord> {
  try {
    const created = await prisma.gameDefinition.create({
      data: {
        id: record.id,
        slug: record.slug,
        title: record.title,
        description: record.description,
        minPlayers: record.minPlayers,
        maxPlayers: record.maxPlayers,
        isOfficial: false,
        isPublished: record.isPublished,
        status: record.status,
        authorId: record.authorId,
        schemaJson: record.schemaJson as any,
      },
    });
    return toRecord(created);
  } catch {
    memoryGames.set(record.id, record);
    return record;
  }
}

async function findGame(idOrSlug: string): Promise<GameRecord | null> {
  const inMemory =
    memoryGames.get(idOrSlug) ??
    Array.from(memoryGames.values()).find((game) => game.slug === idOrSlug);
  if (inMemory) return inMemory;

  try {
    const dbGame = await prisma.gameDefinition.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    });
    return dbGame ? toRecord(dbGame) : null;
  } catch {
    return null;
  }
}

async function persistGame(record: GameRecord): Promise<GameRecord> {
  const stored = memoryGames.get(record.id);
  if (stored) {
    const updated = { ...record, updatedAt: new Date() };
    memoryGames.set(record.id, updated);
    return updated;
  }

  try {
    const updated = await prisma.gameDefinition.update({
      where: { id: record.id },
      data: {
        slug: record.slug,
        title: record.title,
        description: record.description,
        minPlayers: record.minPlayers,
        maxPlayers: record.maxPlayers,
        isPublished: record.isPublished,
        status: record.status,
        schemaJson: record.schemaJson as any,
      },
    });
    return toRecord(updated);
  } catch {
    memoryGames.set(record.id, record);
    return record;
  }
}

async function listCommunityGames(): Promise<GameRecord[]> {
  try {
    const dbGames = await prisma.gameDefinition.findMany({ where: { isOfficial: false } });
    return dbGames.map(toRecord);
  } catch {
    return Array.from(memoryGames.values()).filter((game) => !game.isOfficial);
  }
}

function applyFilters(games: GameRecord[], filters: ListFilters): GameRecord[] {
  const search = filters.search?.toLowerCase();
  return games.filter((game) => {
    if (filters.status && game.status !== filters.status) return false;
    if (filters.type === 'official' && !game.isOfficial) return false;
    if (filters.type === 'community' && game.isOfficial) return false;
    if (search) {
      const haystack = `${game.title} ${game.slug} ${game.description}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

function definitionOf(record: GameRecord): GameSchemaDefinition {
  const schema = (record.schemaJson ?? {}) as Partial<GameSchemaDefinition>;
  return {
    slug: schema.slug ?? record.slug,
    title: schema.title ?? record.title,
    description: schema.description ?? record.description,
    deckConfig: schema.deckConfig as GameSchemaDefinition['deckConfig'],
    rules: schema.rules as GameSchemaDefinition['rules'],
  };
}

export const gamesRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/games/capabilities
   * Returns the declarative engine capabilities manifest (actions, effects, zones, ...)
   */
  fastify.get('/api/games/capabilities', async (_request, reply) => {
    return reply.send(getCapabilitiesManifest());
  });

  /**
   * POST /api/games/validate
   * Validates a declarative game schema without persisting it
   */
  fastify.post('/api/games/validate', async (request, reply) => {
    const body = (request.body ?? {}) as { game?: unknown };
    const candidate = body.game ?? request.body;
    const result = validateGameSchema(candidate);
    return reply.send(result);
  });

  /**
   * GET /api/games
   * Lists official games and community games. Supports ?status, ?type and ?search
   */
  fastify.get<{ Querystring: { status?: string; type?: string; search?: string } }>(
    '/api/games',
    async (request, reply) => {
      const official: GameRecord[] = getAllOfficialGames().map((game) => ({
        id: game.slug,
        slug: game.slug,
        title: game.title,
        description: game.description,
        minPlayers: game.rules.minPlayers,
        maxPlayers: game.rules.maxPlayers,
        isOfficial: true,
        isPublished: true,
        status: 'PUBLISHED',
        authorId: null,
        schemaJson: game,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      }));

      const community = await listCommunityGames();
      const games = applyFilters([...official, ...community], request.query ?? {}).map(toPublic);

      return reply.send({ games });
    }
  );

  /**
   * POST /api/games
   * Creates a new community game as a DRAFT owned by the authenticated author
   */
  fastify.post('/api/games', async (request, reply) => {
    const authorId = resolveAuthor(request, request.body);
    if (!authorId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const body = (request.body ?? {}) as Record<string, unknown>;
    const definition = body.game ?? body;
    const validation = validateGameSchema(definition);
    if (!validation.valid) {
      return reply.status(400).send({ error: 'Validation failed', errors: validation.errors });
    }

    const input = definition as GameSchemaDefinition;
    const slug = await uniqueSlug(input.slug ?? slugify(input.title));
    const now = new Date();
    const record: GameRecord = {
      id: randomUUID(),
      slug,
      title: input.title,
      description: input.description,
      minPlayers: input.rules.minPlayers,
      maxPlayers: input.rules.maxPlayers,
      isOfficial: false,
      isPublished: false,
      status: 'DRAFT',
      authorId,
      schemaJson: { ...input, slug },
      createdAt: now,
      updatedAt: now,
    };

    const created = await createGame(record);
    return reply.status(201).send({ game: toPublic(created) });
  });

  /**
   * PUT /api/games/:id
   * Updates a game definition owned by the authenticated author
   */
  fastify.put<{ Params: { id: string } }>('/api/games/:id', async (request, reply) => {
    const authorId = resolveAuthor(request, request.body);
    if (!authorId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const record = await findGame(request.params.id);
    if (!record) {
      return reply.status(404).send({ error: 'Game not found' });
    }
    if (record.authorId !== authorId) {
      return reply.status(403).send({ error: 'You do not own this game' });
    }

    const body = (request.body ?? {}) as Record<string, unknown>;
    const patch = (body.game ?? body) as Partial<GameSchemaDefinition>;
    const merged: GameSchemaDefinition = {
      ...definitionOf(record),
      ...patch,
      slug: record.slug,
    };

    const validation = validateGameSchema(merged);
    if (!validation.valid) {
      return reply.status(400).send({ error: 'Validation failed', errors: validation.errors });
    }

    const updated = await persistGame({
      ...record,
      title: merged.title,
      description: merged.description,
      minPlayers: merged.rules.minPlayers,
      maxPlayers: merged.rules.maxPlayers,
      schemaJson: merged,
    });

    return reply.send({ game: toPublic(updated) });
  });

  /**
   * POST /api/games/:id/publish
   * Publishes a fully valid game owned by the authenticated author
   */
  fastify.post<{ Params: { id: string } }>('/api/games/:id/publish', async (request, reply) => {
    const authorId = resolveAuthor(request, request.body);
    if (!authorId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const record = await findGame(request.params.id);
    if (!record) {
      return reply.status(404).send({ error: 'Game not found' });
    }
    if (record.authorId !== authorId) {
      return reply.status(403).send({ error: 'You do not own this game' });
    }

    const validation = validateGameSchema(definitionOf(record));
    if (!validation.valid) {
      return reply.status(400).send({ error: 'Validation failed', errors: validation.errors });
    }

    const updated = await persistGame({ ...record, status: 'PUBLISHED', isPublished: true });
    return reply.send({ game: toPublic(updated) });
  });

  /**
   * POST /api/games/:id/fork
   * Clones an official or community game as a new DRAFT owned by the author
   */
  fastify.post<{ Params: { id: string } }>('/api/games/:id/fork', async (request, reply) => {
    const authorId = resolveAuthor(request, request.body);
    if (!authorId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const { id } = request.params;
    const official = getOfficialGame(id);
    let source: GameSchemaDefinition | null = official ?? null;

    if (!source) {
      const record = await findGame(id);
      if (record) source = definitionOf(record);
    }

    if (!source) {
      return reply.status(404).send({ error: 'Game not found' });
    }

    const slug = await uniqueSlug(`${slugify(source.slug || source.title)}-fork`);
    const now = new Date();
    const clone: GameSchemaDefinition = {
      ...source,
      slug,
      title: `${source.title} (copia)`,
    };

    const created = await createGame({
      id: randomUUID(),
      slug,
      title: clone.title,
      description: clone.description,
      minPlayers: clone.rules.minPlayers,
      maxPlayers: clone.rules.maxPlayers,
      isOfficial: false,
      isPublished: false,
      status: 'DRAFT',
      authorId,
      schemaJson: clone,
      createdAt: now,
      updatedAt: now,
    });

    return reply.status(201).send({ game: toPublic(created) });
  });

  /**
   * GET /api/games/:slug
   * Returns full declarative schema definition for the game
   */
  fastify.get<{ Params: { slug: string } }>('/api/games/:slug', async (request, reply) => {
    const { slug } = request.params;

    // Check official games first
    const official = getOfficialGame(slug);
    if (official) {
      return reply.send({
        game: official,
        isOfficial: true,
      });
    }

    const record = await findGame(slug);
    if (record) {
      return reply.send({
        game: definitionOf(record),
        isOfficial: false,
      });
    }

    return reply.status(404).send({
      error: 'Game not found',
      message: `No game found with slug '${slug}'`,
    });
  });
};
