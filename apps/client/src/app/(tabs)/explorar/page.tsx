"use client";

import { useMemo, useState } from "react";
import FilterChip from "@/components/FilterChip";
import GameCard from "@/components/GameCard";
import SearchInput from "@/components/SearchInput";
import { useGames } from "@/lib/api/use-games";

type SourceFilter = "Todos" | "Oficiales" | "Comunidad";
const sourceFilters: SourceFilter[] = ["Todos", "Oficiales", "Comunidad"];

// La demo original filtraba por "categoría" (Estrategia/Rápidos/Nuevos), un
// campo que no existe en el backend real. Lo reemplazamos por un filtro sobre
// `isOfficial`, que sí es un dato real de GET /api/games.
export default function Explore() {
  const { games, error, isLoading } = useGames();
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SourceFilter>("Todos");

  const filtered = useMemo(() => {
    if (!games) return [];
    const q = query.trim().toLowerCase();
    return games.filter((game) => {
      const matchesQuery =
        !q || game.title.toLowerCase().includes(q) || game.description.toLowerCase().includes(q);
      const matchesSource =
        source === "Todos" ||
        (source === "Oficiales" && game.isOfficial) ||
        (source === "Comunidad" && !game.isOfficial);
      return matchesQuery && matchesSource;
    });
  }, [games, query, source]);

  return (
    <div className="flex flex-col gap-4 md:gap-6 px-4 md:px-8 pb-6 md:pb-10">
      <div className="flex flex-col gap-3 pt-4 md:pt-8">
        <div className="font-bold text-lg md:text-2xl text-ink">Explorar</div>
        <div className="md:max-w-md">
          <SearchInput placeholder="Buscar" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {sourceFilters.map((label) => (
          <FilterChip key={label} label={label} active={label === source} onClick={() => setSource(label)} />
        ))}
      </div>

      {isLoading && <div className="text-[13px] text-ink-faint">Cargando juegos...</div>}
      {error && <div className="text-[13px] text-danger">No pudimos cargar el catálogo: {error}</div>}

      {games && filtered.length === 0 && (
        <div className="text-[13px] text-ink-faint">No encontramos juegos con ese criterio.</div>
      )}

      {games && filtered.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 md:gap-4">
          {filtered.map((game) => (
            <GameCard key={game.slug} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}
