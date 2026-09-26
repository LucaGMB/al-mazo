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
  "truco": {
    tagline: "El clásico juego criollo de astucia, mentira y estrategia argentina.",
    mechanics: [
      "Baraja española de 40 cartas (sin 8 ni 9)",
      "Partida a 30 puntos (15 malas y 15 buenas)",
      "Envido, Real Envido y Falta Envido",
      "Truco, Retruco y Vale Cuatro",
      "Pardas, cartas tapadas y viveza criolla",
    ],
  },
  "escoba-del-15": {
    tagline: "Sumá 15 capturando cartas de la mesa y barré con todo.",
    mechanics: [
      "Baraja española de 40 cartas (Sota=8, Caballo=9, Rey=10)",
      "Sumá 15 combinando una carta de tu mano con las de la mesa",
      "Hacé Escoba limpiando la mesa completa (+1 punto)",
      "Puntos por mayoría de cartas, oros, sietes, guindis y escobas",
    ],
  },
  desconectados: {
    tagline: "Un juego de preguntas para conectar sin pantallas.",
    mechanics: [
      "192 preguntas en 4 secciones",
      "Perspectiva, Presentación, Profundidad y Descomprimir",
      "Cartas en blanco para sumar tus preguntas",
      "Sin ganador: solo conversar, reír y escucharse",
      "Online o pass-and-play en un mismo dispositivo",
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
          <BackButton to="/" />
        </div>
        <div className="flex-1 flex items-center justify-center text-[13px] text-ink-faint text-center px-6">
          {error ?? "No encontramos ese juego."}
        </div>
      </div>
    );
  }

  const supported = isSupportedGame(game.game.slug);
  const showcase = GAME_SHOWCASE[game.game.slug];
  const localSupported = game.game.rules.gameMode === "PROMPT";

  return (
    <div className="min-h-screen bg-app">
      <div className="max-w-4xl mx-auto py-8 px-4 md:px-8">
        <div className="mb-6 md:mb-8">
          <BackButton to="/" />
        </div>

        <div className="grid gap-6 md:grid-cols-2 md:gap-10 md:items-start">
          <div className="animate-float">
            <div className="relative overflow-hidden border-[3px] border-subtle shadow-[6px_8px_0_0_rgba(0,0,0,0.4)] md:-rotate-2">
              <Thumb gameSlug={game.game.slug} className="w-full aspect-[4/3]" />
 <span className="absolute top-3 left-3 z-10 border border-white/25 bg-black/60 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur">
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
 <span className="inline-flex items-center gap-2 border border-subtle bg-statusbar px-3 py-1.5 text-[12px] md:text-[13px] font-medium text-ink-soft">
                <Icon icon="pixelarticons:users" width={16} height={16} className="text-accent" />
                {game.game.rules.minPlayers}–{game.game.rules.maxPlayers} jugadores
              </span>
 <span className="inline-flex items-center gap-2 border border-subtle bg-statusbar px-3 py-1.5 text-[12px] md:text-[13px] font-medium text-ink-soft">
                <Icon icon="pixelarticons:gamepad" width={16} height={16} className="text-accent" />
                Multijugador online
              </span>
              {localSupported && (
                <span className="inline-flex items-center gap-2 rounded-full border border-subtle bg-statusbar px-3 py-1.5 text-[12px] md:text-[13px] font-medium text-ink-soft">
                  <Icon
                    icon="pixelarticons:device-mobile"
                    width={16}
                    height={16}
                    className="text-accent"
                  />
                  Modo local
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="font-medium text-[13px] text-ink-soft">Descripción</div>
              <p className="text-[13px] md:text-sm text-ink-faint leading-relaxed m-0">
                {game.game.description}
              </p>
            </div>

            {showcase && showcase.mechanics.length > 0 && (
 <div className=" border-2 border-subtle bg-statusbar/70 p-4 md:p-5">
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
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <Button
                  to={`/juego/${game.game.slug}/mesa`}
                  variant="primary"
                  fullWidth
                  className="!h-14 !text-base !px-7 md:w-auto"
                >
                  <Icon icon="pixelarticons:play" width={20} height={20} />
                  Jugar online
                </Button>
                {localSupported && (
                  <Button
                    to={`/juego/${game.game.slug}/local`}
                    variant="outline"
                    fullWidth
                    className="!h-14 !text-sm !px-7 md:w-auto"
                  >
                    <Icon icon="pixelarticons:device-mobile" width={18} height={18} />
                    Jugar en este dispositivo
                  </Button>
                )}
              </div>
            ) : (
 <div className=" border-2 border-subtle px-4 py-3 text-[13px] text-ink-faint">
                Este juego todavía no se puede jugar desde el cliente.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
