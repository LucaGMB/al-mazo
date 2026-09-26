const TOKEN_STORAGE_KEY = "almazo.token";
const REQUEST_TIMEOUT_MS = 15000;

export type ReportReason = "COPYRIGHT" | "INAPPROPRIATE" | "SPAM" | "BROKEN" | "OTHER";
export type ReportStatus = "PENDING" | "RESOLVED" | "DISMISSED";

export interface GameReport {
  id: string;
  gameId: string;
  gameSlug: string;
  gameTitle: string;
  gameStatus?: string;
  gameIsPublished?: boolean;
  reporterId: string;
  reporterName?: string;
  reporterEmail?: string;
  reason: ReportReason;
  description: string;
  status: ReportStatus;
  adminNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCommunityGame {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: string;
  isPublished: boolean;
  author: { id: string; name?: string; email?: string } | null;
  reportsCount: number;
  createdAt: string;
  updatedAt: string;
}

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_STORAGE_KEY) : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function submitGameReport(
  gameId: string,
  data: { reason: ReportReason; description: string }
): Promise<{ report: GameReport }> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const res = await fetchWithTimeout(`${baseUrl}/api/games/${encodeURIComponent(gameId)}/reports`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorBody.error || "Error al enviar el reporte");
  }

  return res.json();
}

export async function listReports(status?: ReportStatus): Promise<GameReport[]> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await fetchWithTimeout(`${baseUrl}/api/admin/reports${query}`, {
    method: "GET",
    headers: authHeaders(),
  });

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorBody.error || "Error al obtener los reportes");
  }

  const json = (await res.json()) as { reports: GameReport[] };
  return json.reports;
}

export async function updateReport(
  id: string,
  data: { status?: ReportStatus; adminNotes?: string }
): Promise<GameReport> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const res = await fetchWithTimeout(`${baseUrl}/api/admin/reports/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorBody.error || "Error al actualizar el reporte");
  }

  const json = (await res.json()) as { report: GameReport };
  return json.report;
}

export async function takedownGame(
  gameId: string,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const res = await fetchWithTimeout(`${baseUrl}/api/admin/games/${encodeURIComponent(gameId)}/takedown`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ reason }),
  });

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorBody.error || "Error al retirar el juego");
  }

  return res.json();
}

export async function restoreGame(
  gameId: string
): Promise<{ success: boolean; message: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const res = await fetchWithTimeout(`${baseUrl}/api/admin/games/${encodeURIComponent(gameId)}/restore`, {
    method: "POST",
    headers: authHeaders(),
  });

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorBody.error || "Error al restaurar el juego");
  }

  return res.json();
}

export async function listAdminGames(): Promise<AdminCommunityGame[]> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const res = await fetchWithTimeout(`${baseUrl}/api/admin/games`, {
    method: "GET",
    headers: authHeaders(),
  });

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorBody.error || "Error al obtener juegos");
  }

  const json = (await res.json()) as { games: AdminCommunityGame[] };
  return json.games;
}
