import { z } from 'zod';

const cardTemplateSchema = z.object({
  count: z.number().int().positive(),
  type: z.string().min(1),
  color: z.string().min(1).optional(),
  value: z.union([z.string(), z.number()]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const deckConfigSchema = z.object({
  templates: z.array(cardTemplateSchema).min(1),
});

const conditionSchema = z.object({
  type: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
});

const effectSchema = z.object({
  type: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
});

const zoneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['HAND', 'DRAW_PILE', 'DISCARD_PILE', 'TRICK_TABLE', 'COMMUNITY', 'REVEALED']),
  visibility: z.enum(['PRIVATE_OWNER', 'PUBLIC', 'HIDDEN']),
  perPlayer: z.boolean().optional(),
  maxCards: z.number().int().positive().optional(),
});

const phaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  allowedActions: z.array(z.string()),
  onEnter: z.array(effectSchema).optional(),
  onExit: z.array(effectSchema).optional(),
  nextPhase: z.string().optional(),
});

const winConditionSchema = z.object({
  type: z.enum(['EMPTY_HAND', 'SCORE_THRESHOLD', 'LAST_REMAINING']),
  targetScore: z.number().optional(),
});

const rulesSchema = z.object({
  initialHandSize: z.number().int().positive().optional(),
  minPlayers: z.number().int().min(2),
  maxPlayers: z.number().int().max(12),
  matchingProperties: z.array(z.enum(['color', 'value'])).optional(),
  allowWildOnAny: z.boolean().optional(),
  reshuffleDiscardPile: z.boolean().optional(),
  effects: z.record(z.string(), effectSchema).optional(),
  winCondition: winConditionSchema,
  zones: z.array(zoneSchema).optional(),
  phases: z.array(phaseSchema).optional(),
  cardHierarchy: z.record(z.string(), z.number()).optional(),
  customState: z.record(z.string(), z.unknown()).optional(),
  targetScore: z.number().optional(),
  roundScoring: z.record(z.string(), z.unknown()).optional(),
});

const gameSchema = z
  .object({
    slug: z
      .string()
      .min(3)
      .regex(/^[a-z0-9-]+$/, 'slug must contain only lowercase letters, numbers and hyphens')
      .optional(),
    title: z.string().min(3),
    description: z.string(),
    deckConfig: deckConfigSchema,
    rules: rulesSchema,
  })
  .superRefine((game, ctx) => {
    if (game.rules.maxPlayers < game.rules.minPlayers) {
      ctx.addIssue({
        code: 'custom',
        path: ['rules', 'maxPlayers'],
        message: 'maxPlayers must be greater than or equal to minPlayers',
      });
    }

    const hasMatching =
      Array.isArray(game.rules.matchingProperties) && game.rules.matchingProperties.length > 0;
    const hasPhases = Array.isArray(game.rules.phases) && game.rules.phases.length > 0;
    const hasZones = Array.isArray(game.rules.zones) && game.rules.zones.length > 0;
    if (!hasMatching && !hasPhases && !hasZones) {
      ctx.addIssue({
        code: 'custom',
        path: ['rules'],
        message: 'rules must define matchingProperties, phases or zones',
      });
    }
  });

export interface GameSchemaValidationResult {
  valid: boolean;
  errors?: string[];
}

export function validateGameSchema(data: unknown): GameSchemaValidationResult {
  const result = gameSchema.safeParse(data);
  if (result.success) {
    return { valid: true };
  }

  return {
    valid: false,
    errors: result.error.issues.map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    }),
  };
}