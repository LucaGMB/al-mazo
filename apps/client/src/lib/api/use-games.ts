"use client";

import { useEffect, useState } from "react";
import { getGames } from "./games";
import type { GameSummary } from "@/types/api";

// Fetch en el cliente (no en un Server Component): http.ts usa rutas
// relativas a propósito ("/api/games") para que funcionen igual en dev
// (rewrite) y prod (reverse proxy same-origin); eso solo lo resuelve el
// navegador, no `fetch` corriendo del lado servidor de Next.js.
export function useGames() {
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getGames()
      .then((data) => {
        if (!cancelled) setGames(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar juegos");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { games, error, isLoading: games === null && error === null };
}
