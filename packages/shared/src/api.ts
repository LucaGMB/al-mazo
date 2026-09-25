export interface GameSummary {
  slug: string;
  title: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  isOfficial: boolean;
}

export interface GamesListResponse {
  games: GameSummary[];
}

export interface GameDetailResponse {
  game: {
    slug: string;
    title: string;
    description: string;
    deckConfig: unknown;
    rules: unknown;
  };
  isOfficial: boolean;
}

export interface GuestUser {
  id: string;
  name: string;
  isAnonymous: boolean;
  createdAt: string;
}

export interface CreateGuestResponse {
  user: GuestUser;
}

export interface PlayerStat {
  userId: string;
  gameSlug: string;
  matchesPlayed: number;
  matchesWon: number;
}

export interface UserStatsResponse {
  stats: PlayerStat[];
}

export type MatchMode = 'LOCAL_OFFLINE' | 'ONLINE_ROOM';

export interface MatchParticipantInput {
  userId?: string;
  name: string;
  isWinner: boolean;
  score: number;
}

export interface SyncMatchInput {
  gameSlug: string;
  mode: MatchMode;
  startedAt: string;
  endedAt?: string;
  durationSec: number;
  winnerName?: string;
  participants: MatchParticipantInput[];
  metadata?: Record<string, unknown>;
}

export interface SyncMatchResponse {
  success: true;
  matchId: string;
}

export interface MatchParticipant {
  id: string;
  userId: string | null;
  name: string;
  isWinner: boolean;
  score: number;
}

export interface Match {
  id: string;
  gameId: string;
  game?: { slug: string; title: string };
  mode: MatchMode;
  startedAt: string;
  endedAt: string | null;
  durationSec: number;
  winnerId: string | null;
  participants: MatchParticipant[];
}

export interface MatchesListResponse {
  matches: Match[];
}
