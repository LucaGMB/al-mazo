"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import Button from "@/components/Button";
import PromptCardView from "./PromptCardView";
import {
  buildLocalPromptDeck,
  promptCategoryMeta,
  shufflePromptDeck,
  type PromptCard,
} from "@/lib/game/desconectados";

interface LocalGameState {
  version: 1;
  players: string[];
  turnIndex: number;
  remaining: PromptCard[];
  current: PromptCard | null;
  blankQuestion: string;
  totalCards: number;
  categoryIds: string[];
}

const STORAGE_PREFIX = "al-mazo:local:";
const MAX_PLAYERS = 12;

function storageKey(slug: string) {
  return `${STORAGE_PREFIX}${slug}`;
}

function readStoredGame(slug: string): LocalGameState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalGameState;
    if (
      parsed?.version !== 1 ||
      !Array.isArray(parsed.players) ||
      parsed.players.length < 2 ||
      !Array.isArray(parsed.remaining)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export default function LocalDesconectados({
  slug,
  deckConfig,
}: {
  slug: string;
  deckConfig: unknown;
}) {
  const fullDeck = useMemo(() => buildLocalPromptDeck(deckConfig), [deckConfig]);
  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const card of fullDeck) {
      if (!seen.has(card.category)) {
        seen.set(card.category, card.categoryLabel || promptCategoryMeta(card.category).label);
      }
    }
    return Array.from(seen, ([id, label]) => ({ id, label }));
  }, [fullDeck]);

  const [phase, setPhase] = useState<"setup" | "playing" | "finished">("setup");
  const [game, setGame] = useState<LocalGameState | null>(null);
  const [playerNames, setPlayerNames] = useState<string[]>(["Jugador 1", "Jugador 2"]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Restaura una partida local en curso (sobrevive a un refresh o bloqueo).
  // Se hace post-mount a propósito: leer localStorage en el initializer
  // rompería la hidratación (el server no tiene window).
  useEffect(() => {
    const stored = readStoredGame(slug);
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGame(stored);
      setPlayerNames(stored.players);
      setSelectedCategories(stored.categoryIds ?? []);
      setPhase(stored.remaining.length === 0 && !stored.current ? "finished" : "playing");
    }
  }, [slug]);

  useEffect(() => {
    if (typeof window === "undefined" || !game) return;
    window.localStorage.setItem(storageKey(slug), JSON.stringify(game));
  }, [game, slug]);

  function buildDeckFor(selectedIds: string[]): PromptCard[] {
    const filtered = selectedIds.length
      ? fullDeck.filter((card) => selectedIds.includes(card.category))
      : fullDeck;
    return shufflePromptDeck(filtered.length >= 10 ? filtered : fullDeck);
  }

  function startGame(players: string[], selectedIds: string[]) {
    const deck = buildDeckFor(selectedIds);
    const [opener, ...remaining] = deck;
    const next: LocalGameState = {
      version: 1,
      players,
      turnIndex: 0,
      remaining,
      current: opener ?? null,
      blankQuestion: "",
      totalCards: deck.length,
      categoryIds: selectedIds,
    };
    setGame(next);
    setPhase(deck.length === 0 ? "finished" : "playing");
  }

  function handleStart() {
    const cleanPlayers = playerNames.map((name) => name.trim()).filter(Boolean);
    if (cleanPlayers.length < 2) return;
    startGame(cleanPlayers, selectedCategories);
  }

  function nextPrompt() {
    if (!game) return;
    if (game.remaining.length === 0) {
      setGame({ ...game, current: null, blankQuestion: "" });
      setPhase("finished");
      return;
    }
    const [nextCard, ...remaining] = game.remaining;
    setGame({
      ...game,
      current: nextCard,
      remaining,
      blankQuestion: "",
      turnIndex: (game.turnIndex + 1) % game.players.length,
    });
  }

  function clearGame() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey(slug));
    }
    setGame(null);
    setPhase("setup");
  }

  function addPlayer() {
    const name = newPlayerName.trim();
    if (!name || playerNames.length >= MAX_PLAYERS) return;
    setPlayerNames((prev) => [...prev, name]);
    setNewPlayerName("");
  }

  const turnPlayer = game?.players[game.turnIndex] ?? "";
  const currentCard = game?.current ?? null;
  const isBlankPending =
    currentCard?.type === "BLANK" && !game?.blankQuestion.trim();
  const answered = game ? Math.max(0, game.totalCards - game.remaining.length - (currentCard ? 1 : 0)) : 0;

  return (
    <div className="relative max-w-[560px] mx-auto min-h-screen flex flex-col bg-app">
      <div className="flex-none px-4 pt-4 flex items-center justify-between">
        <a
          href={`/juego/${slug}`}
          className="inline-flex h-9 w-9 items-center justify-center border-2 border-subtle bg-statusbar text-ink hover:border-accent hover:text-accent"
          aria-label="Volver"
        >
          <Icon icon="pixelarticons:arrow-left" width={18} height={18} />
        </a>
        <span className="font-display text-xs font-black uppercase tracking-[0.2em] text-ink">
          Desconectados
        </span>
        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-ink-faint">
          <Icon icon="pixelarticons:device-mobile" width={13} height={13} />
          LOCAL
        </span>
      </div>

      {phase === "setup" && (
        <div className="flex flex-1 flex-col gap-5 px-4 py-6">
          <div className="text-center">
            <p className="m-0 font-display text-lg font-black text-ink">
              Un dispositivo, todas las voces
            </p>
            <p className="mt-1 text-[13px] text-ink-faint">
              Elijan la carta, respondan en voz alta y pasen el turno.
            </p>
          </div>

          <section className="border-[3px] border-subtle bg-statusbar/80 p-4">
            <h2 className="m-0 font-display text-xs font-black uppercase tracking-wider text-ink">
              Jugadores
            </h2>
            <div className="mt-3 flex flex-col gap-2">
              {playerNames.map((name, index) => (
                <div
                  key={`${name}-${index}`}
                  className="flex items-center gap-2 border-2 border-subtle bg-app/50 px-3 py-2"
                >
                  <span className="font-mono text-[10px] text-ink-faint">#{index + 1}</span>
                  <span className="flex-1 truncate text-[13px] font-medium text-ink">{name}</span>
                  <button
                    type="button"
                    aria-label={`Quitar a ${name}`}
                    disabled={playerNames.length <= 2}
                    onClick={() =>
                      setPlayerNames((prev) => prev.filter((_, i) => i !== index))
                    }
                    className="inline-flex h-6 w-6 items-center justify-center border border-danger/40 bg-danger/10 text-danger hover:bg-danger/25 disabled:opacity-30"
                  >
                    <Icon icon="pixelarticons:close" width={13} height={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={newPlayerName}
                onChange={(event) => setNewPlayerName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addPlayer();
                }}
                placeholder="Nombre"
                maxLength={24}
                className="h-10 flex-1 border-2 border-subtle bg-app/80 px-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
              />
              <Button
                variant="outline"
                onClick={addPlayer}
                disabled={!newPlayerName.trim() || playerNames.length >= MAX_PLAYERS}
              >
                <Icon icon="pixelarticons:plus" width={14} height={14} />
                Agregar
              </Button>
            </div>
          </section>

          <section className="border-[3px] border-subtle bg-statusbar/80 p-4">
            <h2 className="m-0 font-display text-xs font-black uppercase tracking-wider text-ink">
              Secciones
            </h2>
            <p className="mt-1 text-[11px] text-ink-faint">
              Sin selección se usan todas. Tocá para armar la combinación.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {categories.map((category) => {
                const meta = promptCategoryMeta(category.id);
                const isSelected = selectedCategories.includes(category.id);
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() =>
                      setSelectedCategories((prev) =>
                        isSelected
                          ? prev.filter((id) => id !== category.id)
                          : [...prev, category.id]
                      )
                    }
                    className={`inline-flex items-center gap-1.5 border-2 px-2.5 py-1.5 font-display text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      isSelected
                        ? "border-[#241a44] text-[#171a35]"
                        : "border-subtle bg-app/50 text-ink-faint hover:text-ink"
                    }`}
                    style={isSelected ? { backgroundColor: meta.color } : undefined}
                  >
                    <Icon icon={meta.icon} width={13} height={13} />
                    {category.label || meta.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 font-mono text-[10px] text-ink-faint">
              {fullDeck.length} preguntas en total
            </p>
          </section>

          <Button variant="primary" fullWidth onClick={handleStart} disabled={playerNames.length < 2}>
            <Icon icon="pixelarticons:play" width={16} height={16} />
            Empezar a jugar
          </Button>
        </div>
      )}

      {phase === "playing" && game && (
        <div className="flex flex-1 flex-col gap-3 px-4 py-4">
          <div className="flex items-center justify-between font-mono text-[10px] text-ink-faint">
            <span>
              {answered} respondidas · quedan {game.remaining.length + (currentCard ? 1 : 0)}
            </span>
            <button
              type="button"
              onClick={clearGame}
              className="inline-flex items-center gap-1 text-ink-faint hover:text-danger"
            >
              <Icon icon="pixelarticons:reload" width={12} height={12} />
              Reiniciar
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 border-[3px] border-accent bg-accent/15 px-3 py-2">
            <Icon icon="pixelarticons:user" width={15} height={15} className="text-accent" />
            <span className="font-display text-xs font-black uppercase tracking-wider text-accent">
              Turno de {turnPlayer}
            </span>
          </div>

          <div className="flex flex-1 items-center justify-center py-2">
            {currentCard ? (
              <PromptCardView prompt={currentCard} blankText={game.blankQuestion}>
                <div className="flex w-full flex-col gap-2">
                  <p className="m-0 font-display text-[13px] font-bold">
                    Pregunta libre: escribí la que quieras hacer
                  </p>
                  <input
                    value={game.blankQuestion}
                    onChange={(event) =>
                      setGame({ ...game, blankQuestion: event.target.value })
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && game.blankQuestion.trim()) nextPrompt();
                    }}
                    maxLength={180}
                    autoFocus
                    placeholder="¿Qué querés preguntar?"
                    className="h-10 w-full border-2 border-[#241a44] bg-white/70 px-3 text-sm text-[#241a44] placeholder:text-[#241a44]/40 focus:outline-none"
                  />
                </div>
              </PromptCardView>
            ) : (
              <p className="font-display text-sm text-ink-faint">No quedan preguntas</p>
            )}
          </div>

          <div className="flex flex-col items-center gap-2">
            {isBlankPending ? (
              <p className="m-0 text-center text-[11px] text-ink-faint">
                Escriban la pregunta para poder responderla.
              </p>
            ) : (
              <Button
                variant="primary"
                disabled={isBlankPending}
                onClick={nextPrompt}
              >
                <Icon
                  icon={game.remaining.length === 0 ? "pixelarticons:flag" : "pixelarticons:arrow-right"}
                  width={16}
                  height={16}
                />
                {game.remaining.length === 0 ? "Cerrar la ronda" : "Siguiente jugador"}
              </Button>
            )}
            <p className="m-0 text-center text-[11px] text-ink-faint">
              {game.remaining.length === 0
                ? "Última pregunta: cuando terminen de responder, cierren la ronda."
                : "Respondan en voz alta y pasen el dispositivo si hace falta."}
            </p>
          </div>
        </div>
      )}

      {phase === "finished" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <Icon icon="pixelarticons:coffee" width={52} height={52} className="animate-bounce text-warning" />
          <p className="m-0 font-display text-lg font-black text-ink">
            Se acabaron las preguntas
          </p>
          <p className="m-0 text-[13px] text-ink-faint">
            Gracias por desconectar un rato y escucharse.
          </p>
          <div className="mt-2 flex w-full max-w-[260px] flex-col gap-2">
            <Button
              variant="primary"
              fullWidth
              onClick={() =>
                startGame(game?.players ?? playerNames, game?.categoryIds ?? selectedCategories)
              }
            >
              <Icon icon="pixelarticons:reload" width={16} height={16} />
              Jugar otra vez
            </Button>
            <Button variant="outline" fullWidth onClick={clearGame}>
              <Icon icon="pixelarticons:users" width={16} height={16} />
              Cambiar jugadores
            </Button>
            <Button variant="ghost" fullWidth to="/">
              <Icon icon="pixelarticons:home" width={16} height={16} />
              Volver al catálogo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
