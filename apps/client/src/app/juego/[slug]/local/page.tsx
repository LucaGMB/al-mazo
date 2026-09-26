"use client";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { useParams } from "next/navigation";
import BackButton from "@/components/BackButton";
import LocalDesconectados from "@/components/game/LocalDesconectados";
import { getGame, type GameDetail } from "@/lib/api/games";

/**
 * Modo local (pass-and-play) de juegos basados en preguntas declarativos.
 * El mazo se arma desde el `deckConfig` de la definición oficial y se juega
 * enteramente en el dispositivo, sin sockets.
 */
export default function LocalGamePage() {
  const { slug } = useParams<{ slug: string }>();
  const [game, setGame] = useState<GameDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getGame(slug)
      .then((data) => {
        if (!cancelled) setGame(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar el juego");
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!game && !error) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center text-[13px] text-ink-faint">
        Cargando...
      </div>
    );
  }

  const isPromptGame = game?.game.rules.gameMode === "PROMPT";

  if (error || !game || !isPromptGame) {
    return (
      <div className="min-h-screen bg-app flex flex-col">
        <div className="max-w-2xl w-full mx-auto py-8 px-4 md:px-8">
          <BackButton to={`/juego/${slug}`} />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
          <Icon icon="pixelarticons:device-mobile" width={40} height={40} className="text-ink-faint" />
          <p className="m-0 text-[13px] text-ink-faint max-w-md">
            {error ?? "Este juego todavía no tiene modo local pass-and-play."}
          </p>
        </div>
      </div>
    );
  }

  return <LocalDesconectados slug={slug} deckConfig={game.game.deckConfig} />;
}
