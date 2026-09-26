import { z } from "zod";
import { ApiError, http } from "./http";
import type { GameSummary } from "@/types/api";

// Validamos las respuestas con zod porque no hay contrato compartido con el
// server: si su forma cambia en silencio, preferimos un error explícito acá
// antes que romper la UI de forma críptica.

const gameSummarySchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  minPlayers: z.number(),
  maxPlayers: z.number(),
  isOfficial: z.boolean(),
});

const gamesListSchema = z.object({ games: z.array(gameSummarySchema) });

export async function getGames(): Promise<GameSummary[]> {
  const data = await http.get<unknown>("/api/games");
  return gamesListSchema.parse(data).games;
}

const myGameSchema = gameSummarySchema.extend({
  id: z.string(),
  status: z.string(),
});
const myGamesSchema = z.object({ games: z.array(myGameSchema) });

export type MyGameSummary = z.infer<typeof myGameSchema>;

export async function getMyGames(token?: string): Promise<MyGameSummary[]> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const res = await fetchWithTimeout(`${baseUrl}/api/games/mine`, {
    headers: gameHeaders(undefined, token),
  });
  if (!res.ok) {
    return [];
  }
  return myGamesSchema.parse(await res.json()).games;
}

const gameDetailSchema = z.object({
  game: z.object({
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    deckConfig: z.unknown(),
    // looseObject preserves engine fields the editor does not edit yet
    // (effects, drawStack, customState, roundScoring, ...) when re-saving.
    rules: z.looseObject({
      minPlayers: z.number(),
      maxPlayers: z.number(),
      initialHandSize: z.number().optional(),
      matchingProperties: z.array(z.enum(["color", "value"])).optional(),
      allowWildOnAny: z.boolean().optional(),
      reshuffleDiscardPile: z.boolean().optional(),
      winCondition: z
        .object({
          type: z.enum(["EMPTY_HAND", "SCORE_THRESHOLD", "LAST_REMAINING", "NONE"]),
          targetScore: z.number().optional(),
        })
        .optional(),
      zones: z.array(z.unknown()).optional(),
      phases: z.array(z.unknown()).optional(),
      cardHierarchy: z.record(z.string(), z.number()).optional(),
      targetScore: z.number().optional(),
      turnTimeoutSeconds: z.number().optional(),
      gameMode: z.enum(["TRICK", "COMMUNITY", "DISCARD", "PROMPT"]).optional(),
      customState: z.record(z.string(), z.unknown()).optional(),
    }),
  }),
  isOfficial: z.boolean(),
  id: z.string().optional(),
  status: z.string().optional(),
  authorId: z.string().nullable().optional(),
});

export type GameDetail = z.infer<typeof gameDetailSchema>;

export async function getGame(slug: string): Promise<GameDetail | null> {
  try {
    const data = await http.get<unknown>(`/api/games/${encodeURIComponent(slug)}`);
    return gameDetailSchema.parse(data);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

// Slugs de juegos que el cliente sabe efectivamente renderizar en la mesa.
// GameDetail usa esto para habilitar/deshabilitar "Jugar ahora".
export const SUPPORTED_GAME_SLUGS = [
  "color-match",
  "color-match-blitz",
  "color-match-chaos",
  "descarte-criollo",
  "truco",
  "escoba-del-15",
  "chinchon",
  "desconectados",
] as const;

export interface GameResponseRecord {
  id: string;
  slug: string;
  title: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  isOfficial: boolean;
  status: string;
  authorId: string | null;
  deckConfig?: unknown;
  rules?: {
    minPlayers: number;
    maxPlayers: number;
    initialHandSize?: number;
    matchingProperties?: Array<"color" | "value">;
    allowWildOnAny?: boolean;
    reshuffleDiscardPile?: boolean;
    winCondition?: {
      type: "EMPTY_HAND" | "SCORE_THRESHOLD" | "LAST_REMAINING" | "NONE";
      targetScore?: number;
    };
    zones?: unknown[];
    phases?: unknown[];
    effects?: Record<string, unknown>;
    gameMode?: "TRICK" | "COMMUNITY" | "DISCARD" | "PROMPT";
    customState?: Record<string, unknown>;
  };
}

export function isSupportedGame(slug?: string): boolean {
  // Ahora soportamos todos los juegos oficiales y juegos comunitarios mediante el motor modular
  return Boolean(slug);
}

export interface CapabilitiesResponse {
  actions: Array<{ id: string; name: string; description: string; phase?: string }>;
  conditions: Array<{ type: string; description: string }>;
  effects: Array<{ type: string; description: string }>;
  zones: Array<{ id: string; name: string; type: string; visibility: string; perPlayer?: boolean }>;
  deckPresets: Array<{ id: string; name: string; description: string; totalCards: number }>;
}

export interface ValidationResponse {
  valid: boolean;
  errors?: string[];
}

export async function getCapabilities(): Promise<CapabilitiesResponse> {
  const data = await http.get<CapabilitiesResponse>("/api/games/capabilities");
  return data;
}

export async function validateGame(game: unknown): Promise<ValidationResponse> {
  const data = await http.post<ValidationResponse>("/api/games/validate", { game });
  return data;
}

const TOKEN_STORAGE_KEY = "almazo.token";
const REQUEST_TIMEOUT_MS = 15000;

// Sin timeout, una request colgada deja al editor en "Guardando..." para siempre.
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function gameHeaders(authorId?: string, token?: string) {
  const resolvedToken =
    token ??
    (typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_STORAGE_KEY) : null);
  return {
    "Content-Type": "application/json",
    ...(authorId ? { "x-creator-id": authorId } : {}),
    ...(resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {}),
  };
}

function gameApiErrorMessage(
  err: { message?: string; error?: string; errors?: string[] },
  fallback: string
): string {
  const base = err.message || err.error || fallback;
  return err.errors?.length ? `${base}: ${err.errors.join("; ")}` : base;
}

export async function createGame(
  game: unknown,
  authorId?: string,
  token?: string,
): Promise<{ game: GameResponseRecord }> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const res = await fetchWithTimeout(`${baseUrl}/api/games`, {
    method: "POST",
    headers: gameHeaders(authorId, token),
    body: JSON.stringify({ game, authorId }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: "Error creating game" }))) as {
      message?: string;
      error?: string;
      errors?: string[];
    };
    throw new Error(gameApiErrorMessage(err, "Error al crear el juego"));
  }
  return res.json();
}

export async function updateGame(
  id: string,
  game: unknown,
  authorId?: string,
  token?: string,
): Promise<{ game: GameResponseRecord }> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const res = await fetchWithTimeout(`${baseUrl}/api/games/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: gameHeaders(authorId, token),
    body: JSON.stringify({ game, authorId }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: "Error updating game" }))) as {
      message?: string;
      error?: string;
      errors?: string[];
    };
    throw new Error(gameApiErrorMessage(err, "Error al actualizar el juego"));
  }
  return res.json();
}

export async function publishGame(
  id: string,
  authorId?: string,
  token?: string,
): Promise<{ game: GameResponseRecord }> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const res = await fetchWithTimeout(`${baseUrl}/api/games/${encodeURIComponent(id)}/publish`, {
    method: "POST",
    headers: gameHeaders(authorId, token),
    body: JSON.stringify({ authorId }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: "Error publishing game" }))) as {
      message?: string;
      error?: string;
      errors?: string[];
    };
    throw new Error(gameApiErrorMessage(err, "Error al publicar el juego"));
  }
  return res.json();
}

export async function forkGame(
  id: string,
  authorId?: string,
  token?: string,
): Promise<{ game: GameResponseRecord }> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const res = await fetchWithTimeout(`${baseUrl}/api/games/${encodeURIComponent(id)}/fork`, {
    method: "POST",
    headers: gameHeaders(authorId, token),
    body: JSON.stringify({ authorId }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: "Error forking game" }))) as {
      message?: string;
      error?: string;
      errors?: string[];
    };
    throw new Error(gameApiErrorMessage(err, "Error al clonar el juego"));
  }
  return res.json();
}
