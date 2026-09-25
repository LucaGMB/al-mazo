"use client";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { useParams } from "next/navigation";
import BackButton from "@/components/BackButton";
import Button from "@/components/Button";
import Thumb from "@/components/Thumb";
import { getGame, isSupportedGame, type GameDetail } from "@/lib/api/games";

const GAME_SHOWCASE: Record<string, { tagline: string; mechanics: string[] }> = {
  "color-match": {
    tagline: "Descarta por color o valor y vaciá tu mano antes que el resto.",
    mechanics: [
      "Cartas de colores y números",
      "Reversa, salto y robar +2",
      "Comodines y comodín +4",
      "Si no podés jugar, robá del mazo",
    ],
  },
  "color-match-blitz": {
    tagline: "Ronda rápida, manos chicas y puro vértigo.",
    mechanics: [
      "Manos iniciales de 4 cartas",
      "Alta frecuencia de acciones",
      "Reversa, salto y robar +2",
      "Comodines para cambiar el color",
    ],
  },
  "color-match-chaos": {
    tagline: "Caos total: cambiá manos y descartá en masa.",
    mechanics: [
      "SWAP: intercambiá tu mano con otro jugador",
      "DISCARD ALL: descartá un color entero",
      "Reversa, salto y robar +2",
      "Comodines para cambiar el color",
    ],
  },
  "descarte-criollo": {
    tagline: "Baraja española con poder en cada palo.",
    mechanics: [
      "40 cartas españolas",
      "Poderes en 1, 2, 4, 7 y 12",
      "Espadas, Bastos, Oros y Copas",
      "Cantá ¡AL MAZO! con una carta",
    ],
  },
};

export default function GameDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [game, setGame] = useState<GameDetail | null | undefined>(undefined); // undefined = cargando
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

  if (error || !game) {
    return (
      <div className="min-h-screen bg-app flex flex-col">
        <div className="max-w-4xl w-full mx-auto py-8 px-4 md:px-8">
          <BackButton />
        </div>
        <div className="flex-1 flex items-center justify-center text-[13px] text-ink-faint text-center px-6">
          {error ?? "No encontramos ese juego."}
        </div>
      </div>
    );
  }

  const supported = isSupportedGame(game.game.slug);
  const showcase = GAME_SHOWCASE[game.game.slug];

  return (
    <div className="min-h-screen bg-app">
      <div className="max-w-4xl mx-auto py-8 px-4 md:px-8">
        <div className="mb-6 md:mb-8">
          <BackButton />
        </div>

        <div className="grid gap-6 md:grid-cols-2 md:gap-10 md:items-start">
          <div className="animate-float">
            <div className="relative overflow-hidden border-[3px] border-subtle shadow-[6px_8px_0_0_rgba(0,0,0,0.4)] md:-rotate-2">
              <Thumb gameSlug={game.game.slug} className="w-full aspect-[4/3]" />
              <span className="absolute top-3 left-3 z-10 rounded-full border border-white/25 bg-black/60 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur">
                {game.isOfficial ? "Oficial" : "Comunidad"}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div>
              <h1 className="font-display text-2xl md:text-4xl font-black leading-tight text-ink">
                {game.game.title}
              </h1>
              {showcase && (
                <p className="mt-1.5 text-sm md:text-base text-ink-soft">{showcase.tagline}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-subtle bg-statusbar px-3 py-1.5 text-[12px] md:text-[13px] font-medium text-ink-soft">
                <Icon icon="pixelarticons:users" width={16} height={16} className="text-accent" />
                {game.game.rules.minPlayers}–{game.game.rules.maxPlayers} jugadores
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-subtle bg-statusbar px-3 py-1.5 text-[12px] md:text-[13px] font-medium text-ink-soft">
                <Icon icon="pixelarticons:gamepad" width={16} height={16} className="text-accent" />
                Multijugador online
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="font-medium text-[13px] text-ink-soft">Descripción</div>
              <p className="text-[13px] md:text-sm text-ink-faint leading-relaxed m-0">
                {game.game.description}
              </p>
            </div>

            {showcase && showcase.mechanics.length > 0 && (
              <div className="rounded-[8px] border-2 border-subtle bg-statusbar/70 p-4 md:p-5">
                <div className="flex items-center gap-2 text-sm font-bold text-ink">
                  <Icon icon="pixelarticons:notes" width={16} height={16} className="text-warning" />
                  Reglas &amp; Mecánicas
                </div>
                <ul className="mt-3 flex flex-col gap-2">
                  {showcase.mechanics.map((mechanic) => (
                    <li key={mechanic} className="flex items-start gap-2 text-[13px] text-ink-soft">
                      <Icon
                        icon="pixelarticons:check"
                        width={16}
                        height={16}
                        className="mt-0.5 shrink-0 text-success"
                      />
                      {mechanic}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {supported ? (
              <Button
                to={`/juego/${game.game.slug}/mesa`}
                variant="primary"
                fullWidth
                className="!h-14 !text-base !px-7 md:w-auto"
              >
                <Icon icon="pixelarticons:play" width={20} height={20} />
                Jugar ahora
              </Button>
            ) : (
              <div className="rounded-[6px] border-2 border-subtle px-4 py-3 text-[13px] text-ink-faint">
                Este juego todavía no se puede jugar desde el cliente.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
