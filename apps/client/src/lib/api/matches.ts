import { http } from "./http";
import type { Match, MatchesListResponse, SyncMatchInput, SyncMatchResponse } from "@/types/api";

export async function syncMatch(input: SyncMatchInput): Promise<SyncMatchResponse> {
  return http.post<SyncMatchResponse>("/api/matches/sync", input);
}

export async function getMatches(): Promise<Match[]> {
  const data = await http.get<MatchesListResponse>("/api/matches");
  return data.matches;
}

export async function getUserMatches(userId: string): Promise<Match[]> {
  const data = await http.get<MatchesListResponse>(
    `/api/users/${encodeURIComponent(userId)}/matches`,
  );
  return data.matches;
}
