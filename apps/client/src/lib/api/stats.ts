import { z } from "zod";
import { http } from "./http";
import type { PlayerStat } from "@/types/api";

const playerStatSchema = z.object({
  userId: z.string(),
  gameSlug: z.string(),
  matchesPlayed: z.number(),
  matchesWon: z.number(),
});

const userStatsResponseSchema = z.object({ stats: z.array(playerStatSchema) });

export async function getUserStats(userId: string): Promise<PlayerStat[]> {
  const data = await http.get<unknown>(`/api/users/${encodeURIComponent(userId)}/stats`);
  return userStatsResponseSchema.parse(data).stats;
}
