"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import Button from "@/components/Button";
import MetadataSection from "./MetadataSection";
import DeckSection from "./DeckSection";
import RulesSection from "./RulesSection";
import JsonModal from "./JsonModal";
import AuthModal, { AuthForm } from "@/components/auth/AuthModal";
import {
  DEFAULT_NEW_GAME,
  type CardTemplate,
  type GameDefinitionData,
} from "@/lib/editor/presets";
import {
  createGame,
  getGame,
  getGames,
  getMyGames,
  publishGame,
  updateGame,
  validateGame,
  type MyGameSummary,
} from "@/lib/api/games";
import { useSession } from "@/lib/session/use-session";
import type { GameSummary } from "@/types/api";

import { validateGameClient } from "@/lib/editor/validation";

type EditorTab = "metadata" | "deck" | "rules" | "validation";

const LOGIN_REQUIRED_MESSAGE =
  "Solo los jugadores registrados con usuario y clave pueden crear o publicar juegos.";

export default function GameEditor() {
  const { user, token, isLoggedIn, isLoading } = useSession();
  const [, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<EditorTab>("metadata");
  const [gameData, setGameData] = useState<GameDefinitionData>(DEFAULT_NEW_GAME);
  const [gameId, setGameId] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);

  // Validation state (derived on client + asynchronous deep check on server)
  const clientValidation = useMemo(() => validateGameClient(gameData), [gameData]);
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [validationRetry, setValidationRetry] = useState(0);

  const validationErrors = useMemo(() => {
    if (!clientValidation.valid) return clientValidation.errors;
    return serverErrors;
  }, [clientValidation, serverErrors]);

  const isValid = clientValidation.valid && serverErrors.length === 0;

  // Action states
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Modals & fork
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [availableGames, setAvailableGames] = useState<GameSummary[]>([]);
  const [isForkModalOpen, setIsForkModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [myGames, setMyGames] = useState<MyGameSummary[]>([]);
  const [isMyGamesOpen, setIsMyGamesOpen] = useState(false);
  const [isLoadingGame, setIsLoadingGame] = useState(false);

  // Fetch games list for fork options
  useEffect(() => {
    getGames()
      .then((games) => setAvailableGames(games))
      .catch(() => {});
  }, []);

  async function refreshMyGames() {
    if (!isLoggedIn) return;
    try {
      setMyGames(await getMyGames(token ?? undefined));
    } catch {
      // Offline or server unreachable: keep the previous list.
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshMyGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, token]);

  // Resume a saved game (draft or published) from /editor?game=<slug>
  async function loadGame(slug: string) {
    setIsLoadingGame(true);
    setStatusMessage(null);
    try {
      const detail = await getGame(slug);
      if (!detail) throw new Error("El juego ya no existe");
      startTransition(() => {
        const rules = (detail.game.rules ?? {}) as Partial<GameDefinitionData["rules"]>;
        setGameData({
          slug: detail.game.slug,
          title: detail.game.title,
          description: detail.game.description,
          deckConfig:
            (detail.game.deckConfig as GameDefinitionData["deckConfig"] | null) ??
            DEFAULT_NEW_GAME.deckConfig,
          rules: { ...DEFAULT_NEW_GAME.rules, ...rules },
        });
        setGameId(detail.id ?? null);
        setIsPublished(detail.status === "PUBLISHED");
        setActiveTab("metadata");
      });
      window.history.replaceState(null, "", `/editor?game=${encodeURIComponent(slug)}`);
      setStatusMessage({ text: `'${detail.game.title}' cargado para editar.`, type: "success" });
    } catch (err) {
      setStatusMessage({
        text: err instanceof Error ? err.message : "No se pudo cargar el juego",
        type: "error",
      });
    } finally {
      setIsLoadingGame(false);
    }
  }

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("game");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (slug) void loadGame(slug);
  }, []);

  // Validate on server when client validation passes
  useEffect(() => {
    let cancelled = false;

    if (!clientValidation.valid) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsValidating(true);
      try {
        const payload = {
          slug: gameData.slug,
          title: gameData.title,
          description: gameData.description,
          deckConfig: gameData.deckConfig,
          rules: gameData.rules,
        };

        const res = await validateGame(payload);
        if (!cancelled) {
          if (!res.valid && res.errors && res.errors.length > 0) {
            setServerErrors(res.errors);
          } else {
            setServerErrors([]);
          }
        }
      } catch {
        // Backend offline or unreachable: do not assume the schema is valid.
        if (!cancelled) {
          setServerErrors(["No se pudo validar con el servidor. Revisá tu conexión."]);
        }
      } finally {
        if (!cancelled) {
          setIsValidating(false);
        }
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [gameData, clientValidation.valid, validationRetry]);

  function requireAuthorId(): string | null {
    if (isLoggedIn && user) return user.id;
    setAuthMessage(LOGIN_REQUIRED_MESSAGE);
    setIsAuthModalOpen(true);
    return null;
  }

  // The server may rename the slug on collision; keep the editor in sync so
  // "Probar Mesa" and subsequent saves target the persisted game.
  function syncSavedSlug(res: { game?: { slug?: string } }) {
    const savedSlug = res.game?.slug;
    if (!savedSlug) return;
    setGameData((prev) => (prev.slug === savedSlug ? prev : { ...prev, slug: savedSlug }));
  }

  async function handleSaveDraft() {
    const authorId = requireAuthorId();
    if (!authorId) return;

    setIsSaving(true);
    setStatusMessage(null);
    try {
      const payload = {
        slug: gameData.slug,
        title: gameData.title,
        description: gameData.description,
        deckConfig: gameData.deckConfig,
        rules: gameData.rules,
      };

      if (gameId) {
        const res = await updateGame(gameId, payload, authorId, token ?? undefined);
        setStatusMessage({ text: "¡Borrador actualizado con éxito!", type: "success" });
        if (res.game?.id) setGameId(res.game.id);
        syncSavedSlug(res);
        void refreshMyGames();
      } else {
        const res = await createGame(payload, authorId, token ?? undefined);
        setStatusMessage({ text: "¡Borrador creado con éxito!", type: "success" });
        if (res.game?.id) {
          setGameId(res.game.id);
        }
        syncSavedSlug(res);
        void refreshMyGames();
      }
    } catch (err) {
      setStatusMessage({
        text: err instanceof Error ? err.message : "Error al guardar el borrador",
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublish() {
    const authorId = requireAuthorId();
    if (!authorId) return;

    if (!isValid) {
      setStatusMessage({
        text: "No podés publicar un juego con errores de validación. Revisá los campos requeridos.",
        type: "error",
      });
      setActiveTab("validation");
      return;
    }

    setIsPublishing(true);
    setStatusMessage(null);
    try {
      const authToken = token ?? undefined;

      // Ensure game is saved first if no id
      let targetId = gameId;
      if (!targetId) {
        const createRes = await createGame(
          {
            slug: gameData.slug,
            title: gameData.title,
            description: gameData.description,
            deckConfig: gameData.deckConfig,
            rules: gameData.rules,
          },
          authorId,
          authToken
        );
        targetId = createRes.game?.id;
        if (targetId) setGameId(targetId);
        syncSavedSlug(createRes);
      } else {
        const updateRes = await updateGame(
          targetId,
          {
            slug: gameData.slug,
            title: gameData.title,
            description: gameData.description,
            deckConfig: gameData.deckConfig,
            rules: gameData.rules,
          },
          authorId,
          authToken
        );
        syncSavedSlug(updateRes);
      }

      if (!targetId) throw new Error("No se pudo obtener el identificador del juego");

      await publishGame(targetId, authorId, authToken);
      setIsPublished(true);
      setStatusMessage({
        text: "¡Juego publicado en la comunidad! Ya está disponible en Explorar y listo para jugar en línea.",
        type: "success",
      });
      void refreshMyGames();
    } catch (err) {
      setStatusMessage({
        text: err instanceof Error ? err.message : "Error al publicar el juego",
        type: "error",
      });
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleLoadTemplate(slug: string) {
    setIsForkModalOpen(false);
    setStatusMessage(null);
    try {
      const detail = await getGame(slug);
      if (detail?.game) {
        const g = detail.game as {
          slug: string;
          title: string;
          description: string;
          deckConfig?: { templates: CardTemplate[] };
          rules?: Partial<GameDefinitionData["rules"]>;
        };
        startTransition(() => {
          setGameData({
            slug: `${g.slug}-custom`,
            title: `${g.title} (Personalizado)`,
            description: g.description,
            deckConfig: g.deckConfig ?? DEFAULT_NEW_GAME.deckConfig,
            rules: {
              ...DEFAULT_NEW_GAME.rules,
              ...g.rules,
            },
          });
          setGameId(null);
          setIsPublished(false);
        });
        setStatusMessage({
          text: `Plantilla de '${g.title}' cargada en el editor.`,
          type: "success",
        });
      }
    } catch {
      setStatusMessage({ text: "Error al cargar la plantilla del juego", type: "error" });
    }
  }

  function handleReset() {
    if (confirm("¿Estás seguro de reiniciar el editor? Se perderán los cambios no guardados.")) {
      setGameData(DEFAULT_NEW_GAME);
      setGameId(null);
      setIsPublished(false);
      setStatusMessage(null);
      setActiveTab("metadata");
      window.history.replaceState(null, "", "/editor");
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-ink-faint text-xs">
        <Icon icon="pixelarticons:loader" className="animate-spin mb-2" width={28} height={28} />
        <span>Cargando editor...</span>
      </div>
    );
  }

  if (!isLoggedIn || !user || user.isAnonymous) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12 md:py-16 max-w-lg mx-auto w-full text-center">
 <div className="w-16 h-16 border-2 border-accent/50 bg-accent/15 flex items-center justify-center text-accent shadow-[0_0_24px_rgba(255,210,63,0.3)] mb-4">
          <Icon icon="pixelarticons:lock" width={32} height={32} />
        </div>
        <h1 className="font-display font-black text-xl md:text-2xl text-ink">
          Acceso exclusivo para creadores
        </h1>
        <p className="text-xs md:text-sm text-ink-faint mt-2 mb-6 max-w-sm">
          Los juegos personalizados solo pueden ser creados por usuarios registrados previamente.
          Iniciá sesión o registrate para diseñar cartas, configurar reglas y publicar en la comunidad.
        </p>

        {user?.isAnonymous && (
 <div className="mb-6 w-full border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs text-warning flex items-center gap-2.5 text-left">
            <Icon icon="pixelarticons:info-box" width={18} height={18} className="shrink-0" />
            <span>
              Actualmente estás jugando como invitado (<strong>{user.name}</strong>). Creá tu cuenta o iniciá sesión para desbloquear el editor.
            </span>
          </div>
        )}

 <div className="w-full max-w-sm border-2 border-subtle bg-statusbar/90 p-5 shadow-[4px_6px_0_0_rgba(0,0,0,0.35)] text-left">
          <AuthForm
            initialTab="login"
            onSuccess={() => {
              setStatusMessage(null);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full px-4 md:px-8 pt-6 md:pt-10 pb-28 md:pb-36">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-subtle pb-5">
        <div className="flex items-center gap-3.5">
 <span className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-accent/60 bg-accent/15 text-accent shadow-[0_0_18px_rgba(32,168,216,0.3)]">
            <Icon icon="pixelarticons:sliders" width={26} height={26} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-ink">Editor de Juegos</h1>
              {isPublished ? (
 <span className=" border border-success/40 bg-success/15 px-2.5 py-0.5 text-[10px] font-black uppercase text-success">
                  Publicado
                </span>
              ) : gameId ? (
 <span className=" border border-warning/40 bg-warning/15 px-2.5 py-0.5 text-[10px] font-black uppercase text-warning">
                  Borrador Guardado
                </span>
              ) : (
 <span className=" border border-subtle bg-app/80 px-2.5 py-0.5 text-[10px] font-bold uppercase text-ink-faint">
                  Nuevo
                </span>
              )}
            </div>
            <p className="text-xs md:text-sm text-ink-faint">
              Creá, personalizá y publicá juegos de mesa con el motor modular
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isLoggedIn && user ? (
 <span className="flex items-center gap-1.5 border border-success/40 bg-success/10 px-3 py-2 text-xs font-bold text-success">
              <Icon icon="pixelarticons:user" width={16} height={16} />
              Creador: {user.name}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAuthMessage(LOGIN_REQUIRED_MESSAGE);
                setIsAuthModalOpen(true);
              }}
 className="flex items-center gap-1.5 border border-accent/40 bg-accent/15 px-3 py-2 text-xs font-bold text-accent hover:bg-accent/25 transition-colors cursor-pointer"
            >
              <Icon icon="pixelarticons:login" width={16} height={16} />
              Iniciar sesión
            </button>
          )}

          {isLoggedIn && (
            <button
              type="button"
              onClick={() => {
                setIsMyGamesOpen(true);
                void refreshMyGames();
              }}
              disabled={isLoadingGame}
              className="flex items-center gap-1.5 border border-subtle bg-statusbar/80 px-3 py-2 text-xs font-bold text-ink-soft hover:border-accent hover:text-ink transition-colors cursor-pointer disabled:opacity-60"
            >
              <Icon icon="pixelarticons:folder" width={16} height={16} className="text-success" />
              {isLoadingGame ? "Cargando..." : "Mis Juegos"}
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsForkModalOpen(true)}
 className="flex items-center gap-1.5 border border-subtle bg-statusbar/80 px-3 py-2 text-xs font-bold text-ink-soft hover:border-accent hover:text-ink transition-colors cursor-pointer"
          >
            <Icon icon="pixelarticons:copy" width={16} height={16} className="text-warning" />
            Cargar Plantilla
          </button>

          <button
            type="button"
            onClick={() => setIsJsonModalOpen(true)}
 className="flex items-center gap-1.5 border border-subtle bg-statusbar/80 px-3 py-2 text-xs font-bold text-ink-soft hover:border-accent hover:text-ink transition-colors cursor-pointer"
          >
            <Icon icon="pixelarticons:code" width={16} height={16} className="text-accent" />
            Ver JSON
          </button>

          <button
            type="button"
            onClick={handleReset}
            title="Reiniciar formulario"
 className="flex items-center justify-center h-9 w-9 border border-subtle bg-statusbar/80 text-ink-faint hover:text-danger hover:border-danger/40 transition-colors cursor-pointer"
          >
            <Icon icon="pixelarticons:reload" width={16} height={16} />
          </button>
        </div>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div
 className={`flex items-center justify-between p-3.5 border text-xs font-medium ${
            statusMessage.type === "success"
              ? "border-success/50 bg-success/15 text-success"
              : "border-danger/50 bg-danger/15 text-danger"
          }`}
        >
          <div className="flex items-center gap-2">
            <Icon
              icon={
                statusMessage.type === "success" ? "pixelarticons:check" : "pixelarticons:alert"
              }
              width={16}
              height={16}
            />
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-current opacity-70 hover:opacity-100 cursor-pointer"
          >
            <Icon icon="pixelarticons:close" width={14} height={14} />
          </button>
        </div>
      )}

      {/* Navigation tabs */}
      <div className="flex border-b border-subtle overflow-x-auto gap-2">
        {[
          { id: "metadata" as const, label: "1. Información", icon: "pixelarticons:edit" },
          { id: "deck" as const, label: "2. Mazo & Cartas", icon: "pixelarticons:notes" },
          { id: "rules" as const, label: "3. Reglas & Zonas", icon: "pixelarticons:sliders" },
          {
            id: "validation" as const,
            label: "4. Validación & Publicar",
            icon: isValid ? "pixelarticons:check" : "pixelarticons:alert",
          },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs md:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? "border-accent text-accent bg-accent/5"
                  : "border-transparent text-ink-faint hover:text-ink hover:border-subtle"
              }`}
            >
              <Icon icon={tab.icon} width={16} height={16} />
              {tab.label}
              {tab.id === "validation" && (
                <span
 className={`h-2 w-2 ${
                    isValid ? "bg-success shadow-[0_0_6px_rgba(77,189,116,0.8)]" : "bg-danger"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="flex flex-col gap-6">
        {activeTab === "metadata" && (
          <MetadataSection
            title={gameData.title}
            slug={gameData.slug}
            description={gameData.description}
            minPlayers={gameData.rules.minPlayers}
            maxPlayers={gameData.rules.maxPlayers}
            isExisting={Boolean(gameId)}
            onChange={(fields) =>
              setGameData((prev) => ({
                ...prev,
                ...fields,
                rules: {
                  ...prev.rules,
                  minPlayers: fields.minPlayers ?? prev.rules.minPlayers,
                  maxPlayers: fields.maxPlayers ?? prev.rules.maxPlayers,
                },
              }))
            }
          />
        )}

        {activeTab === "deck" && (
          <DeckSection
            templates={gameData.deckConfig.templates}
            initialHandSize={gameData.rules.initialHandSize ?? 3}
            reshuffleDiscardPile={gameData.rules.reshuffleDiscardPile ?? true}
            onTemplatesChange={(templates: CardTemplate[]) =>
              setGameData((prev) => ({
                ...prev,
                deckConfig: { templates },
              }))
            }
            onInitialHandSizeChange={(initialHandSize) =>
              setGameData((prev) => ({
                ...prev,
                rules: { ...prev.rules, initialHandSize },
              }))
            }
            onReshuffleChange={(reshuffleDiscardPile) =>
              setGameData((prev) => ({
                ...prev,
                rules: { ...prev.rules, reshuffleDiscardPile },
              }))
            }
          />
        )}

        {activeTab === "rules" && (
          <RulesSection
            winConditionType={gameData.rules.winCondition.type}
            targetScore={gameData.rules.winCondition.targetScore}
            matchingProperties={gameData.rules.matchingProperties ?? ["color", "value"]}
            allowWildOnAny={gameData.rules.allowWildOnAny ?? true}
            drawStack={gameData.rules.drawStack}
            activeZones={gameData.rules.zones ?? []}
            phases={gameData.rules.phases ?? []}
            turnTimeoutSeconds={gameData.rules.turnTimeoutSeconds}
            gameMode={gameData.rules.gameMode}
            submission={gameData.rules.submission}
            requireNormalInitialCard={gameData.rules.requireNormalInitialCard ?? false}
            onChange={(fields) =>
              setGameData((prev) => ({
                ...prev,
                rules: {
                  ...prev.rules,
                  winCondition: {
                    type: fields.winConditionType ?? prev.rules.winCondition.type,
                    targetScore:
                      fields.targetScore !== undefined
                        ? fields.targetScore
                        : prev.rules.winCondition.targetScore,
                  },
                  matchingProperties: fields.matchingProperties ?? prev.rules.matchingProperties,
                  allowWildOnAny: fields.allowWildOnAny ?? prev.rules.allowWildOnAny,
                  drawStack: fields.drawStack !== undefined ? fields.drawStack : prev.rules.drawStack,
                  zones: fields.activeZones ?? prev.rules.zones,
                  phases: fields.phases ?? prev.rules.phases,
                  turnTimeoutSeconds:
                    fields.turnTimeoutSeconds ?? prev.rules.turnTimeoutSeconds,
                  requireNormalInitialCard:
                    fields.requireNormalInitialCard ?? prev.rules.requireNormalInitialCard,
                  ...(fields.gameMode !== undefined
                    ? { gameMode: fields.gameMode === "AUTO" ? undefined : fields.gameMode }
                    : {}),
                  submission:
                    fields.submission === undefined
                      ? prev.rules.submission
                      : fields.submission === null
                        ? undefined
                        : fields.submission,
                },
              }))
            }
          />
        )}

        {activeTab === "validation" && (
 <div className="flex flex-col gap-5 border-2 border-subtle bg-statusbar p-5 md:p-6 shadow-[4px_4px_0_0_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-3 pb-3 border-b border-subtle">
              <span
 className={`flex h-10 w-10 items-center justify-center border ${
                  isValid
                    ? "border-success/40 bg-success/15 text-success"
                    : "border-danger/40 bg-danger/15 text-danger"
                }`}
              >
                <Icon
                  icon={isValid ? "pixelarticons:check" : "pixelarticons:alert"}
                  width={20}
                  height={20}
                />
              </span>
              <div>
                <h2 className="text-base md:text-lg font-black text-ink">
                  {isValid ? "Esquema Válido para el Motor" : "Validación de Reglas"}
                </h2>
                <p className="text-xs text-ink-faint">
                  {isValidating
                    ? "Comprobando compatibilidad..."
                    : isValid
                    ? "Todas las reglas y estructuras cumplen con las especificaciones del motor modular."
                    : "Existen problemas que deben resolverse antes de publicar."}
                </p>
              </div>
            </div>

            {isValid ? (
 <div className=" border border-success/40 bg-success/10 p-4 flex items-start gap-3 text-xs text-ink-soft">
                <Icon
                  icon="pixelarticons:check-double"
                  width={20}
                  height={20}
                  className="text-success shrink-0 mt-0.5"
                />
                <div>
                  <span className="font-bold text-success">¡Todo listo para publicar!</span>
                  <p className="text-ink-faint mt-1">
                    Tu juego cumple con todos los requisitos: mazo definido ({gameData.deckConfig.templates.length} plantillas), reglas de fin de partida, zonas y fases operativas.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-danger">Problemas encontrados:</span>
                <div className="flex flex-col gap-1.5">
                  {validationErrors.map((err, idx) => (
                    <div
                      key={idx}
  className="flex items-center gap-2 border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
                    >
                      <Icon icon="pixelarticons:close" width={14} height={14} className="shrink-0" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
                {clientValidation.valid && serverErrors.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setValidationRetry((r) => r + 1)}
                    className="flex items-center gap-1.5 self-start border border-subtle px-3 py-1.5 text-xs font-bold text-ink-soft hover:border-accent hover:text-ink transition-colors cursor-pointer"
                  >
                    <Icon icon="pixelarticons:reload" width={14} height={14} />
                    Reintentar validación
                  </button>
                )}
              </div>
            )}

            {/* Quick summary of the game */}
 <div className=" border border-subtle bg-app/60 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-ink-faint block text-[10px]">Identificador</span>
                <span className="font-mono font-bold text-ink">{gameData.slug}</span>
              </div>
              <div>
                <span className="text-ink-faint block text-[10px]">Jugadores</span>
                <span className="font-bold text-ink">
                  {gameData.rules.minPlayers} - {gameData.rules.maxPlayers}
                </span>
              </div>
              <div>
                <span className="text-ink-faint block text-[10px]">Victoria</span>
                <span className="font-bold text-ink">{gameData.rules.winCondition.type}</span>
              </div>
              <div>
                <span className="text-ink-faint block text-[10px]">Mano inicial</span>
                <span className="font-bold text-ink">
                  {gameData.rules.initialHandSize ?? 3} cartas
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sticky Action Bar */}
 <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 border-2 border-subtle bg-statusbar p-4 shadow-[0_-4px_0_0_rgba(0,0,0,0.35)]">
        <div className="flex items-center gap-2 text-xs">
          <span
 className={`h-2.5 w-2.5 ${
              isValid ? "bg-success shadow-[0_0_8px_rgba(77,189,116,0.8)]" : "bg-warning"
            }`}
          />
          <span className="text-ink-faint font-medium">
            {isValid ? "Listo para jugar o publicar" : "Faltan ajustar configuraciones"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="ghost"
            disabled={isSaving || isPublishing}
            onClick={handleSaveDraft}
            className="!h-10 !text-xs !px-4"
          >
            <Icon icon="pixelarticons:save" width={16} height={16} />
            {isSaving ? "Guardando..." : "Guardar Borrador"}
          </Button>

          <Button
            variant="primary"
            disabled={isSaving || isPublishing || !isValid}
            onClick={handlePublish}
            className="!h-10 !text-xs !px-5 shadow-[0_0_14px_rgba(32,168,216,0.35)]"
          >
            <Icon icon="pixelarticons:upload" width={16} height={16} />
            {isPublishing ? "Publicando..." : "Publicar en Comunidad"}
          </Button>

          {gameId ? (
            <Link
              href={`/juego/${gameData.slug}/mesa`}
              target="_blank"
              className="inline-flex items-center gap-1.5 h-10 px-4 border border-accent/40 bg-accent/15 text-accent text-xs font-bold hover:bg-accent/25 transition-all no-underline shadow-[0_0_12px_rgba(32,168,216,0.2)]"
            >
              <Icon icon="pixelarticons:play" width={16} height={16} />
              Probar Mesa
            </Link>
          ) : (
            <span
              title="Guardá el borrador para poder probar la mesa"
              className="inline-flex items-center gap-1.5 h-10 px-4 border border-subtle text-ink-faint text-xs font-bold opacity-60 cursor-not-allowed"
            >
              <Icon icon="pixelarticons:play" width={16} height={16} />
              Probar Mesa
            </span>
          )}
        </div>
      </div>

      {/* Login / Register Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        message={authMessage ?? undefined}
        onSuccess={() =>
          setStatusMessage({
            text: "¡Sesión iniciada! Ya podés guardar y publicar tus juegos.",
            type: "success",
          })
        }
      />

      {/* JSON Inspection Modal */}
      <JsonModal
        gameData={gameData}
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        onImport={(imported) => {
          setGameData(imported);
          setStatusMessage({ text: "Esquema JSON importado con éxito.", type: "success" });
        }}
      />

      {/* Fork / Template Selection Modal */}
      {isForkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
 <div className="flex flex-col w-full max-w-lg max-h-[80vh] border-2 border-subtle bg-statusbar shadow-[6px_6px_0_0_rgba(0,0,0,0.4)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-subtle bg-surface">
              <div className="flex items-center gap-2">
                <Icon icon="pixelarticons:copy" width={20} height={20} className="text-warning" />
                <h3 className="text-sm font-bold text-ink">Cargar Plantilla de Juego</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsForkModalOpen(false)}
 className="flex h-8 w-8 items-center justify-center border border-subtle text-ink-faint hover:text-ink cursor-pointer"
              >
                <Icon icon="pixelarticons:close" width={18} height={18} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex flex-col gap-2">
              <p className="text-xs text-ink-faint mb-2">
                Elegí un juego existente para usar su baraja, reglas y estructura como punto de partida:
              </p>
              {availableGames.map((game) => (
                <button
                  key={game.slug}
                  type="button"
                  onClick={() => handleLoadTemplate(game.slug)}
 className="flex items-center justify-between p-3 border border-subtle bg-app/50 hover:border-accent hover:bg-app/80 text-left transition-colors cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-ink">{game.title}</span>
                    <span className="text-[11px] text-ink-faint line-clamp-1">
                      {game.description}
                    </span>
                  </div>
 <span className="text-[10px] font-bold text-accent px-2 py-0.5 bg-accent/15 shrink-0 ml-2">
                    {game.isOfficial ? "Oficial" : "Comunidad"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* My Games Modal */}
      {isMyGamesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
  <div className="flex flex-col w-full max-w-lg max-h-[80vh] border-2 border-subtle bg-statusbar shadow-[6px_6px_0_0_rgba(0,0,0,0.4)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-subtle bg-surface">
              <div className="flex items-center gap-2">
                <Icon icon="pixelarticons:folder" width={20} height={20} className="text-success" />
                <h3 className="text-sm font-bold text-ink">Mis Juegos</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMyGamesOpen(false)}
  className="flex h-8 w-8 items-center justify-center border border-subtle text-ink-faint hover:text-ink cursor-pointer"
              >
                <Icon icon="pixelarticons:close" width={18} height={18} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsMyGamesOpen(false);
                  handleReset();
                }}
  className="flex items-center justify-center gap-1.5 border-2 border-dashed border-accent/40 bg-accent/10 px-3 py-2.5 text-xs font-bold text-accent hover:bg-accent/20 transition-colors cursor-pointer"
              >
                <Icon icon="pixelarticons:plus" width={16} height={16} />
                Nuevo Juego
              </button>

              {myGames.length === 0 ? (
                <p className="py-6 text-center text-xs text-ink-faint">
                  Todavía no creaste juegos. Guardá un borrador para verlo acá.
                </p>
              ) : (
                myGames.map((game) => (
                  <div
                    key={game.id}
                    className="flex items-center justify-between gap-3 border border-subtle bg-app/50 p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-bold text-ink">{game.title}</span>
                        <span
                          className={`shrink-0 border px-2 py-0.5 text-[10px] font-black uppercase ${
                            game.status === "PUBLISHED"
                              ? "border-success/40 bg-success/15 text-success"
                              : "border-warning/40 bg-warning/15 text-warning"
                          }`}
                        >
                          {game.status === "PUBLISHED" ? "Publicado" : "Borrador"}
                        </span>
                      </div>
                      <span className="block truncate font-mono text-[11px] text-ink-faint">
                        {game.slug}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsMyGamesOpen(false);
                          void loadGame(game.slug);
                        }}
                        disabled={isLoadingGame}
                        className="flex items-center gap-1 border border-accent/40 bg-accent/15 px-2.5 py-1.5 text-[11px] font-bold text-accent hover:bg-accent/25 transition-colors cursor-pointer disabled:opacity-60"
                      >
                        <Icon icon="pixelarticons:edit" width={14} height={14} />
                        Editar
                      </button>
                      <Link
                        href={`/juego/${game.slug}/mesa`}
                        target="_blank"
                        className="flex items-center gap-1 border border-subtle px-2.5 py-1.5 text-[11px] font-bold text-ink-soft hover:border-accent hover:text-ink transition-colors no-underline"
                      >
                        <Icon icon="pixelarticons:play" width={14} height={14} />
                        Probar
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
