import Link from "next/link";
import { Icon } from "@iconify/react";
import Thumb from "./Thumb";
import type { GameSummary } from "@/types/api";

// A diferencia de la demo original, acá no hay rating/"jugando: X" — el
// backend no expone esos datos (ver GET /api/games en al-mazo-server). En su
// lugar mostramos el rango de jugadores, que sí es real.
export default function GameCard({ game, compact }: { game: GameSummary; compact?: boolean }) {
  const badge = game.slug.includes("blitz") ? "RÁPIDO" : game.slug.includes("chaos") ? "CAOS" : game.slug.includes("criollo") ? "CRIOLLO" : "CLÁSICO";

  return (
    <Link
      href={`/juego/${game.slug}`}
      className="group flex flex-col gap-1.5 text-inherit no-underline"
    >
 <div className=" border border-transparent transition-all duration-200 group-hover:-translate-y-1 group-hover:border-accent/50 group-hover:shadow-[4px_4px_0_0_rgba(0,0,0,0.35)]">
 <Thumb gameSlug={game.slug} className={`w-full ${compact ? "aspect-square" : "aspect-video"}`} />
      </div>
      <div className="flex items-center justify-between gap-2">
      <div
        className={`font-medium text-ink truncate transition-colors duration-150 group-hover:text-accent ${
          compact ? "text-xs" : "text-[13px] md:text-sm"
        }`}
      >
        {game.title}
      </div>
 {!compact && <span className=" bg-warning/10 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-warning">{badge}</span>}
      </div>
      {!compact && (
 <div className="inline-flex w-fit items-center gap-1 border border-subtle bg-surface px-2 py-0.5 text-[11px] text-ink-faint">
            <Icon icon="pixelarticons:users" width={13} height={13} />
            {game.minPlayers}–{game.maxPlayers} jugadores
          </div>
      )}
    </Link>
  );
}
