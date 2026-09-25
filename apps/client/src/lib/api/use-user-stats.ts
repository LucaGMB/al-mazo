"use client";

import { useEffect, useState } from "react";
import { getUserStats } from "./stats";
import { getUserMatches } from "./matches";
import type { Match, PlayerStat } from "@/types/api";

export function useUserStats(userId: string | null) {
  const [stats, setStats] = useState<PlayerStat[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getUserStats(userId)
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar stats");
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Si no hay userId, no dependemos de un setState en el efecto: derivamos
  // directamente en vez de "resetear" stats desde adentro del efecto.
  const effectiveStats = userId ? stats : null;
  return { stats: effectiveStats, error, isLoading: !!userId && stats === null && error === null };
}

export function useUserMatches(userId: string | null) {
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getUserMatches(userId)
      .then((data) => {
        if (!cancelled) setMatches(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar partidas");
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const effectiveMatches = userId ? matches : null;
  return {
    matches: effectiveMatches,
    error,
    isLoading: !!userId && matches === null && error === null,
  };
}
