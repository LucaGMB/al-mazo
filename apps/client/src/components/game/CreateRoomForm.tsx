"use client";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { randomPlayerName } from "@/types/shared/names";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/Button";
import { createSocket } from "@/lib/socket/client";
import { createRoom, waitForConnect } from "@/lib/socket/actions";
import { saveRoomCredentials } from "@/lib/room/credentials";
import { encodePlayerName } from "@/lib/room/player-name";
import { DISCONNECT_POLICIES } from "@/lib/room/room-context";
import { useSession } from "@/lib/session/use-session";
import { getGame, type GameDetail } from "@/lib/api/games";
import type {
  DisconnectPolicy,
  DrawStackRule,
  ColorMatchMode,
  FinishOnSpecialCardRule,
} from "@/types/realtime";

type Tab = "crear" | "unirse";

const COLOR_MATCH_MODES: {
  value: ColorMatchMode;
  label: string;
  badge: string;
  icon: string;
  description: string;
}[] = [
  {
    value: "CLASSIC",
    label: "Clásico",
    badge: "108 cartas",
    icon: "pixelarticons:sliders",
    description: "7 cartas por jugador, mazo estándar. El juego clásico que todos conocen.",
  },
  {
    value: "BLITZ",
    label: "Blitz",
    badge: "52 cartas · Rápido",
    icon: "pixelarticons:zap",
    description: "4 cartas iniciales, ritmo rápido, números 1 al 5 y doble de cartas de acción.",
  },
  {
    value: "CHAOS",
    label: "Chaos",
    badge: "62 cartas · Caos",
    icon: "pixelarticons:reload",
    description: "6 cartas iniciales con cartas de intercambio (SWAP) y descarte de color entero.",
  },
];

const FINISH_ON_SPECIAL_OPTIONS: {
  value: FinishOnSpecialCardRule;
  label: string;
  description: string;
}[] = [
  {
    value: "ALLOW",
    label: "Permitido (gana con especial)",
    description: "Podés vaciar tu mano con una carta de acción o comodín y ganar la partida.",
  },
  {
    value: "BLOCK",
    label: "Bloqueado (no puede terminar)",
    description: "No podés bajar tu última carta si es especial: debés jugar otra carta o robar.",
  },
  {
    value: "DRAW_PENALTY",
    label: "Roba 2 y sigue",
    description: "La carta especial se juega, pero robás 2 cartas automáticamente y la partida continúa.",
  },
];

const DRAW_STACK_OPTIONS: { value: DrawStackRule; label: string; description: string }[] = [
  {
    value: "ALL",
    label: "Encadenar cualquier robo (+2 y +4)",
    description: "Podés responder a cualquier +2 o +4 con otra carta de robo para acumular y pasar el castigo al siguiente jugador.",
  },
  {
    value: "SAME_TYPE",
    label: "Solo del mismo tipo (+2 con +2, +4 con +4)",
    description: "Solo podés responder un +2 con otro +2, o un +4 con otro +4. No se pueden mezclar.",
  },
  {
    value: "HIGHER_OR_EQUAL",
    label: "Igual o mayor valor (+4 supera a +2)",
    description: "Un +4 contrarresta a un +2 o a un +4; un +2 solo puede responder a otro +2.",
  },
  {
    value: "OFF",
    label: "Desactivado (sin encadenar)",
    description: "Sin acumulación. Quien recibe un +2 o +4 roba de inmediato y pierde su turno.",
  },
];

const TURN_PRESETS = [
  { seconds: 15, label: "Rápido", description: "15s para pensar" },
  { seconds: 25, label: "Normal", description: "25s para pensar" },
  { seconds: 40, label: "Pausado", description: "40s para pensar" },
] as const;

// Formulario standalone en /juego/[slug]/mesa (sin roomCode todavía).
// "Crear sala" abre un socket temporal solo para emitir room:create, guarda
// las credenciales de reconexión y navega a /mesa/<CODE> (ahí el
// RoomProvider las toma y reconecta). "Unirse a sala" no abre socket acá:
// solo navega a /mesa/<CODE>, donde el RoomProvider muestra el formulario de
// unión si no hay credenciales guardadas para ese código.
export default function CreateRoomForm({ slug }: { slug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, createGuest } = useSession();

  const isColorMatch =
    slug === "color-match" || slug === "color-match-blitz" || slug === "color-match-chaos";
  const isTruco = slug === "truco";

  const urlMode = searchParams?.get("mode")?.toUpperCase();
  const initialMode: ColorMatchMode =
    urlMode === "BLITZ" || slug.includes("blitz")
      ? "BLITZ"
      : urlMode === "CHAOS" || slug.includes("chaos")
      ? "CHAOS"
      : "CLASSIC";

  const [tab, setTab] = useState<Tab>("crear");
  const [name, setName] = useState(user?.name ?? "");
  const [roomCode, setRoomCode] = useState("");
  const [colorMatchMode, setColorMatchMode] = useState<ColorMatchMode>(initialMode);
  const [finishOnSpecialCard, setFinishOnSpecialCard] =
    useState<FinishOnSpecialCardRule>("ALLOW");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [graceSeconds, setGraceSeconds] = useState(initialMode === "BLITZ" ? 15 : 25);
  const [policy, setPolicy] = useState<DisconnectPolicy>("DISCARD_AND_CONTINUE");
  const [drawStackRule, setDrawStackRule] = useState<DrawStackRule>("ALL");
  const [endsTurnOnDraw, setEndsTurnOnDraw] = useState(true);
  const [allowAnyColorDraw2OnDraw4, setAllowAnyColorDraw2OnDraw4] = useState(true);
  const [targetScore, setTargetScore] = useState<number>(30);
  const [gameDetail, setGameDetail] = useState<GameDetail | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getGame(slug)
      .then((data) => {
        if (!cancelled && data) {
          setGameDetail(data);
          const score = data.game.rules.targetScore ?? data.game.rules.winCondition?.targetScore;
          if (score) {
            setTargetScore(score);
          }
        }
      })
      .catch(() => {
        // Non-blocking fallback for preview/offline
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const supportsDrawStack = Boolean(
    gameDetail
      ? gameDetail.game.rules.drawStack !== undefined ||
        (gameDetail.game.rules.effects &&
          Object.values(gameDetail.game.rules.effects).some(
            (e: unknown) =>
              typeof e === "object" &&
              e !== null &&
              "type" in e &&
              (e as { type?: unknown }).type === "DRAW_CARDS"
          ))
      : isColorMatch || slug === "descarte-criollo"
  );

  const isScoreThreshold =
    isTruco || gameDetail?.game.rules.winCondition?.type === "SCORE_THRESHOLD";

  function handleSelectMode(m: ColorMatchMode) {
    setColorMatchMode(m);
    if (m === "BLITZ" && graceSeconds === 25) {
      setGraceSeconds(15);
    } else if (m !== "BLITZ" && graceSeconds === 15) {
      setGraceSeconds(25);
    }
  }

  function randomizeName() {
    let pick = randomPlayerName();
    for (let i = 0; pick === name.trim() && i < 10; i += 1) {
      pick = randomPlayerName();
    }
    setName(pick);
  }

  async function handleCreate() {
    if (!name.trim()) {
      setError("Ingresá tu nombre");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const guest = user ?? (await createGuest(name.trim()));
      const socket = createSocket();
      socket.connect();
      await waitForConnect(socket);

      const targetSlug = isColorMatch ? "color-match" : slug;
      const res = await createRoom(socket, {
        gameSlug: targetSlug,
        playerName: encodePlayerName(name.trim(), guest.id),
        options: {
          disconnectGraceSeconds: graceSeconds,
          disconnectPolicy: policy,
          turnTimeoutSeconds: graceSeconds,
          ...(supportsDrawStack
            ? {
                drawStack: {
                  rule: drawStackRule,
                  endsTurnOnDraw,
                  allowAnyColorDraw2OnDraw4,
                },
              }
            : {}),
          ...(isScoreThreshold ? { targetScore } : {}),
          ...(isColorMatch ? { colorMatchMode, finishOnSpecialCard } : {}),
        },
      });

      socket.disconnect();

      if (!res.success || !res.roomCode || !res.playerId || !res.reconnectToken) {
        setError(res.error ?? "No se pudo crear la sala");
        return;
      }

      saveRoomCredentials(res.roomCode, {
        gameSlug: targetSlug,
        playerId: res.playerId,
        reconnectToken: res.reconnectToken,
        isHost: true,
      });
      router.push(`/juego/${targetSlug}/mesa/${res.roomCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la sala");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleJoinNavigate() {
    const code = roomCode.trim().toUpperCase();
    if (!code) {
      setError("Ingresá el código de la sala");
      return;
    }
    const targetSlug = isColorMatch ? "color-match" : slug;
    const params = name.trim() ? `?name=${encodeURIComponent(name.trim())}` : "";
    router.push(`/juego/${targetSlug}/mesa/${code}${params}`);
  }

  return (
    <div className="max-w-md w-full mx-auto my-auto p-6 md:p-8 border-[3px] border-subtle bg-statusbar/90 shadow-[6px_8px_0_0_rgba(0,0,0,0.35)] flex flex-col gap-5">
 <div className="flex items-center gap-3 border-2 border-subtle bg-app/60 px-4 py-3">
 <span className="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-subtle bg-gradient-to-br from-accent/30 to-accent/5 text-accent">
          <Icon icon="pixelarticons:gamepad" width={24} height={24} />
        </span>
        <div>
          <div className="font-display font-black text-ink">Mesa de Juego</div>
          <div className="text-[11px] text-ink-faint">Creá una sala para jugar con amigos o unite con un código</div>
        </div>
      </div>

 <div className="grid grid-cols-2 gap-1 border-2 border-subtle bg-app/60 p-1">
        {(["crear", "unirse"] as Tab[]).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setError(null);
              }}
 className={`flex items-center justify-center gap-2 px-3 py-2 text-[13px] font-bold transition-colors duration-150 cursor-pointer ${
                active
                  ? "bg-accent text-[#171a35] shadow-[0_0_14px_rgba(255,210,63,0.4)]"
                  : "text-ink-faint hover:text-ink"
              }`}
            >
              <Icon
                icon={t === "crear" ? "pixelarticons:plus" : "pixelarticons:login"}
                width={16}
                height={16}
              />
              {t === "crear" ? "Crear sala" : "Unirse con código"}
            </button>
          );
        })}
      </div>

      <label className="flex flex-col gap-1.5 text-[13px] text-ink-soft">
        <span className="font-bold text-ink">Tu nombre o apodo</span>
        <div className="flex items-center gap-2">
 <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-subtle bg-app/60 text-ink-faint">
            <Icon icon="pixelarticons:user" width={20} height={20} />
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Ana"
 className="h-10 min-w-0 flex-1 border border-subtle bg-app/60 text-ink text-sm px-3 focus:outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={randomizeName}
            aria-label="Generar apodo al azar"
            title="Generar apodo al azar"
 className="flex h-10 w-10 shrink-0 items-center justify-center border border-subtle text-ink-faint transition-colors duration-150 hover:border-accent hover:text-accent cursor-pointer"
          >
            <Icon icon="pixelarticons:shuffle" width={18} height={18} />
          </button>
        </div>
      </label>

      {tab === "unirse" && (
        <label className="flex flex-col gap-1.5 text-[13px] text-ink-soft">
          <span className="font-bold text-ink">Código de sala</span>
          <span className="text-[11px] text-ink-faint">
            Ingresá el código de 5 letras compartido por quien creó la sala:
          </span>
          <input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 5))}
            placeholder="A3F9K"
            maxLength={5}
            autoComplete="off"
 className="h-12 border border-subtle bg-app/60 text-ink text-center font-mono text-lg font-black tracking-[0.5em] uppercase focus:outline-none focus:border-accent"
          />
        </label>
      )}

      {tab === "crear" && (
        <div className="flex flex-col gap-3">
          {isColorMatch && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[13px] text-ink-soft">
                <span>Modo de juego</span>
                <span className="text-[11px] font-bold text-accent">
                  {COLOR_MATCH_MODES.find((m) => m.value === colorMatchMode)?.badge}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {COLOR_MATCH_MODES.map((modeOpt) => {
                  const active = colorMatchMode === modeOpt.value;
                  return (
                    <button
                      key={modeOpt.value}
                      type="button"
                      onClick={() => handleSelectMode(modeOpt.value)}
                      className={`border-2 p-2 text-left transition-colors duration-150 cursor-pointer flex flex-col justify-between ${
                        active
                          ? "border-accent bg-accent/15 text-ink shadow-[0_0_10px_rgba(255,210,63,0.2)]"
                          : "border-subtle text-ink-faint hover:border-medium hover:text-ink"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-black flex items-center gap-1 text-ink">
                          <Icon
                            icon={modeOpt.icon}
                            width={14}
                            height={14}
                            className={active ? "text-accent" : "text-ink-faint"}
                          />
                          {modeOpt.label}
                        </span>
                      </div>
                      <div className="text-[10px] text-ink-soft leading-tight mt-1 line-clamp-2">
                        {modeOpt.description}
                      </div>
                    </button>
                  );
                })}
              </div>

              <label className="flex flex-col gap-1.5 border-2 border-subtle bg-app/40 p-3 text-[13px] text-ink-soft">
                <span className="font-bold text-ink">Terminar con carta especial</span>
                <span className="text-[11px] text-ink-faint">
                  Qué pasa si un jugador intenta vaciar su mano con una carta de acción o comodín:
                </span>
                <select
                  value={finishOnSpecialCard}
                  onChange={(e) => setFinishOnSpecialCard(e.target.value as FinishOnSpecialCardRule)}
                  className="h-10 border border-subtle bg-app/60 text-ink text-sm px-3 focus:outline-none focus:border-accent"
                >
                  {FINISH_ON_SPECIAL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-accent leading-snug">
                  {FINISH_ON_SPECIAL_OPTIONS.find((opt) => opt.value === finishOnSpecialCard)?.description}
                </span>
              </label>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] font-bold text-ink">Tiempo para jugar por turno</span>
              <span className="text-[11px] text-ink-faint">
                Límite de tiempo por jugada antes de que el juego pase el turno automáticamente:
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {TURN_PRESETS.map((preset) => {
                const active = graceSeconds === preset.seconds;
                return (
                  <button
                    key={preset.seconds}
                    type="button"
                    onClick={() => setGraceSeconds(preset.seconds)}
 className={` border-2 px-2 py-2.5 text-center transition-colors duration-150 cursor-pointer ${
                      active
                        ? "border-accent bg-accent/15 text-ink shadow-[0_0_10px_rgba(255,210,63,0.25)]"
                        : "border-subtle text-ink-faint hover:border-medium hover:text-ink"
                    }`}
                  >
                    <div className="text-sm font-black">{preset.seconds}s</div>
                    <div className="text-[11px] font-bold text-ink">{preset.label}</div>
                    <div className="text-[9px] uppercase tracking-wider text-ink-faint">{preset.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1 self-start text-[12px] font-bold text-accent cursor-pointer"
          >
            <Icon
              icon="pixelarticons:chevron-down"
              width={14}
              height={14}
              className={`transition-transform duration-150 ${showAdvanced ? "rotate-180" : ""}`}
            />
            {showAdvanced ? "Ocultar reglas adicionales de la mesa" : "Configurar reglas adicionales de la mesa (opcional)"}
          </button>
          {showAdvanced && (
            <div className="flex flex-col gap-3.5 border-2 border-subtle p-3.5 bg-app/40">
              {isTruco && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-bold text-ink">Puntos de la partida</span>
                    <span className="text-[11px] text-ink-faint">
                      Límite de puntos para consagrar al ganador del Truco:
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { points: 15, label: "15 Puntos", badge: "Partida corta", desc: "A las 15 malas" },
                      { points: 30, label: "30 Puntos", badge: "Predeterminado", desc: "15 malas y 15 buenas" },
                    ].map((opt) => {
                      const active = targetScore === opt.points;
                      return (
                        <button
                          key={opt.points}
                          type="button"
                          onClick={() => setTargetScore(opt.points)}
                          className={`border-2 p-2.5 text-left transition-colors duration-150 cursor-pointer flex flex-col justify-between ${
                            active
                              ? "border-accent bg-accent/15 text-ink shadow-[0_0_10px_rgba(255,210,63,0.25)]"
                              : "border-subtle text-ink-faint hover:border-medium hover:text-ink"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-sm font-black text-ink">{opt.label}</span>
                            <span className="text-[10px] font-bold text-accent font-mono">
                              {opt.badge}
                            </span>
                          </div>
                          <span className="text-[10px] text-ink-soft leading-tight">{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {supportsDrawStack && (
                <>
                  <label className="flex flex-col gap-1.5 text-[13px] text-ink-soft">
                    <span className="font-bold text-ink">Acumulación de cartas de robo (+2 / +4)</span>
                    <span className="text-[11px] text-ink-faint">
                      Permite responder a un castigo de cartas jugando otra carta de robo en lugar de robar en el acto:
                    </span>
                    <select
                      value={drawStackRule}
                      onChange={(e) => setDrawStackRule(e.target.value as DrawStackRule)}
                      className="h-10 border border-subtle bg-app/60 text-ink text-sm px-3 focus:outline-none focus:border-accent"
                    >
                      {DRAW_STACK_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <span className="text-[11px] text-accent leading-snug">
                      {DRAW_STACK_OPTIONS.find((opt) => opt.value === drawStackRule)?.description}
                    </span>
                  </label>

                  {drawStackRule !== "OFF" && (
                    <div className="flex flex-col gap-2.5 pt-2.5 border-t border-subtle/50">
                      <label className="flex items-start gap-2.5 text-[12px] text-ink cursor-pointer">
                        <input
                          type="checkbox"
                          checked={endsTurnOnDraw}
                          onChange={(e) => setEndsTurnOnDraw(e.target.checked)}
                          className="accent-accent h-4 w-4 mt-0.5 border-subtle shrink-0"
                        />
                        <div className="flex flex-col">
                          <span className="font-bold">Finalizar turno al robar pozo acumulado</span>
                          <span className="text-[11px] text-ink-faint">
                            Si no podés responder y robás el pozo de cartas acumuladas, tu turno termina de inmediato.
                          </span>
                        </div>
                      </label>

                      {drawStackRule === "ALL" && (
                        <label className="flex items-start gap-2.5 text-[12px] text-ink cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allowAnyColorDraw2OnDraw4}
                            onChange={(e) => setAllowAnyColorDraw2OnDraw4(e.target.checked)}
                            className="accent-accent h-4 w-4 mt-0.5 border-subtle shrink-0"
                          />
                          <div className="flex flex-col">
                            <span className="font-bold">Responder a un +4 con un +2 de cualquier color</span>
                            <span className="text-[11px] text-ink-faint">
                              Permite jugar un +2 sin importar qué color haya elegido quien tiró el comodín +4.
                            </span>
                          </div>
                        </label>
                      )}
                    </div>
                  )}
                </>
              )}

              <label className={`flex flex-col gap-1.5 text-[13px] text-ink-soft ${supportsDrawStack || isTruco ? "pt-2.5 border-t border-subtle/50" : ""}`}>
                <span className="font-bold text-ink">Si un jugador se desconecta y no regresa:</span>
                <span className="text-[11px] text-ink-faint">
                  Acción a aplicar tras cumplirse el tiempo de reconexión ({graceSeconds}s):
                </span>
                <select
                  value={policy}
                  onChange={(e) => setPolicy(e.target.value as DisconnectPolicy)}
                  className="h-10 border border-subtle bg-app/60 text-ink text-sm px-3 focus:outline-none focus:border-accent"
                >
                  {DISCONNECT_POLICIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-accent leading-snug">
                  {DISCONNECT_POLICIES.find((p) => p.value === policy)?.description}
                </span>
              </label>
            </div>
          )}
        </div>
      )}

      {error && <div className="text-[13px] text-danger">{error}</div>}

      <Button
        variant="primary"
        fullWidth
        disabled={isSubmitting}
        onClick={tab === "crear" ? handleCreate : handleJoinNavigate}
        className="!h-12 !text-base"
      >
        <Icon
          icon={tab === "crear" ? "pixelarticons:play" : "pixelarticons:arrow-right"}
          width={18}
          height={18}
        />
        {tab === "crear" ? (isSubmitting ? "Creando sala..." : "Crear sala e invitar") : "Entrar a la partida"}
      </Button>
    </div>
  );
}
