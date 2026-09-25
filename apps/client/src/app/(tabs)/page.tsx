"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import GameCard from "@/components/GameCard";
import SearchInput from "@/components/SearchInput";
import TopBar from "@/components/TopBar";
import { useGames } from "@/lib/api/use-games";
import { useUserStats } from "@/lib/api/use-user-stats";
import { useSession } from "@/lib/session/use-session";

const filters = [
  { id: "all", label: "Todos", icon: "grid" },
  { id: "quick", label: "Rápidos", icon: "zap" },
  { id: "chaos", label: "Caos", icon: "reload" },
  { id: "classic", label: "Tradicional", icon: "sword" },
] as const;

function levelFor(matchesPlayed: number, matchesWon: number): number {
  return Math.min(50, Math.floor(Math.sqrt(matchesPlayed * 3 + matchesWon * 6)) + 1);
}

function categoryFor(slug: string): string {
  if (slug.includes("blitz")) return "quick";
  if (slug.includes("chaos")) return "chaos";
  return "classic";
}

// A diferencia de la demo (secciones "Populares"/"Seguís jugando"/"Comunidad"
// armadas sobre datos ficticios), acá mostramos el catálogo real de
// GET /api/games con un buscador que filtra client-side por título/descripción.
export default function Hub() {
  const { games, error, isLoading } = useGames();
  const { user } = useSession();
  const { stats } = useUserStats(user?.id ?? null);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [roomCode, setRoomCode] = useState("");

  const totals = stats?.reduce(
    (acc, stat) => ({
      matchesPlayed: acc.matchesPlayed + stat.matchesPlayed,
      matchesWon: acc.matchesWon + stat.matchesWon,
    }),
    { matchesPlayed: 0, matchesWon: 0 },
  );
  const level = levelFor(totals?.matchesPlayed ?? 0, totals?.matchesWon ?? 0);
  const winRate = totals?.matchesPlayed ? Math.round((totals.matchesWon / totals.matchesPlayed) * 100) : 0;

  const filtered = useMemo(() => {
    if (!games) return [];
    const q = query.trim().toLowerCase();
    return games.filter(
      (game) =>
        (!q || game.title.toLowerCase().includes(q) || game.description.toLowerCase().includes(q)) &&
        (filter === "all" || categoryFor(game.slug) === filter),
    );
  }, [games, query, filter]);

  function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (code.length === 5) router.push(`/juego/color-match/mesa/${code}`);
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6 px-4 md:px-8 pb-6 md:pb-10">
      <TopBar title="Al Mazo" />

      <div className="relative overflow-hidden border-[3px] border-accent bg-wood px-5 py-7 shadow-[6px_8px_0_0_rgba(0,0,0,0.35)] md:px-9 md:py-10">
        <div className="pointer-events-none absolute inset-0 grain" />
        <div className="pointer-events-none absolute -right-3 top-5 hidden h-40 w-32 rotate-12 border-2 border-paper/20 bg-paper/5 shadow-[12px_12px_0_rgba(0,0,0,0.2)] md:block">
          <div className="absolute inset-3 border border-paper/25" />
        </div>
        <div className="relative flex max-w-xl flex-col gap-3 md:gap-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-warning">
 <span className="h-2 w-2 animate-pulse bg-warning" /> Mesa abierta
          </div>
          <h2 className="font-display text-2xl font-black uppercase tracking-tight text-ink md:text-4xl">AL MAZO: Partidas en Vivo</h2>
          <p className="text-[13px] text-ink-soft md:text-[15px]">
            Entrá en segundos, desafiá amigos o jugá contra bots inteligentes.
          </p>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <Button to="/juego/color-match-blitz"><Icon icon="pixelarticons:zap" width={16} height={16} /> Partida Rápida</Button>
 <form onSubmit={joinRoom} className="flex h-11 overflow-hidden border border-paper/25 bg-black/25">
              <label htmlFor="room-code" className="sr-only">Código de sala</label>
              <input
                id="room-code"
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value.replace(/[^a-z0-9]/gi, "").slice(0, 5))}
                placeholder="CÓDIGO"
                maxLength={5}
                className="w-24 bg-transparent px-3 text-center font-mono text-xs font-bold tracking-[0.2em] text-ink outline-none placeholder:text-ink-faint"
              />
              <button type="submit" aria-label="Unirse con código" className="flex w-11 items-center justify-center bg-paper/10 text-ink transition-colors hover:bg-paper/20">
                <Icon icon="pixelarticons:arrow-right" width={18} height={18} />
              </button>
            </form>
          </div>
        </div>
      </div>

      {user && (
 <div className="flex flex-wrap items-center gap-4 border-2 border-success/40 bg-success/10 px-4 py-3 md:gap-6 md:px-5">
          <div className="flex items-center gap-2.5">
 <div className="flex h-9 w-9 items-center justify-center border border-success/40 bg-success/20 text-success"><Icon icon="pixelarticons:user" width={19} height={19} /></div>
            <div><div className="text-sm font-bold text-ink">¡Hola, {user.name}!</div><div className="text-[11px] text-success">Nivel {level}</div></div>
          </div>
          <div className="h-8 w-px bg-success/20" />
          <div className="flex gap-4 text-[11px] text-ink-soft">
            <span><strong className="block text-sm text-ink">{totals?.matchesPlayed ?? 0}</strong>partidas</span>
            <span><strong className="block text-sm text-ink">{totals?.matchesWon ?? 0}</strong>ganadas</span>
            <span className="flex items-start gap-1"><Icon icon="pixelarticons:trophy" width={14} height={14} className="mt-0.5 text-warning" /><strong className="block text-sm text-ink">{winRate}%</strong> win-rate</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
 <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={`inline-flex items-center gap-1.5 border-2 px-3 py-1.5 text-[11px] font-bold transition-colors ${filter === item.id ? "border-accent bg-accent/15 text-accent" : "border-subtle bg-surface text-ink-faint hover:border-medium hover:text-ink"}`}>
              <Icon icon={`pixelarticons:${item.icon}`} width={14} height={14} /> {item.label}
            </button>
          ))}
        </div>
        <SearchInput
          placeholder="Buscar juegos..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {isLoading && <div className="text-[13px] text-ink-faint">Cargando juegos...</div>}
      {error && <div className="text-[13px] text-danger">No pudimos cargar el catálogo: {error}</div>}

      {games && (
        <div className="flex flex-col gap-2">
 <div className="flex items-center gap-2"><h2 className="text-base font-bold text-ink">Catálogo de Juegos</h2><span className=" bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">4 Modos</span></div>
          {filtered.length === 0 ? (
            <div className="text-[13px] text-ink-faint">No encontramos juegos con ese criterio.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5 md:gap-4">
              {filtered.map((game) => (
                <GameCard key={game.slug} game={game} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
