"use client";

import { Icon } from "@iconify/react";
import {
  DEFAULT_SUBMISSION_CONFIG,
  DEFAULT_ZONES,
  type PhaseDefinition,
  type SubmissionConfig,
  type ZoneDefinition,
} from "@/lib/editor/presets";

interface RulesSectionProps {
  winConditionType: "EMPTY_HAND" | "SCORE_THRESHOLD" | "LAST_REMAINING" | "NONE";
  targetScore?: number;
  matchingProperties: Array<"color" | "value">;
  allowWildOnAny: boolean;
  drawStack?: {
    rule: "OFF" | "SAME_TYPE" | "HIGHER_OR_EQUAL" | "ALL";
    endsTurnOnDraw?: boolean;
    allowAnyColorDraw2OnDraw4?: boolean;
  };
  activeZones: ZoneDefinition[];
  phases: PhaseDefinition[];
  turnTimeoutSeconds?: number;
  gameMode?: "TRICK" | "COMMUNITY" | "DISCARD" | "PROMPT";
  submission?: SubmissionConfig;
  requireNormalInitialCard?: boolean;
  onChange: (fields: Partial<{
    winConditionType: "EMPTY_HAND" | "SCORE_THRESHOLD" | "LAST_REMAINING" | "NONE";
    targetScore?: number;
    matchingProperties: Array<"color" | "value">;
    allowWildOnAny: boolean;
    drawStack?: {
      rule: "OFF" | "SAME_TYPE" | "HIGHER_OR_EQUAL" | "ALL";
      endsTurnOnDraw?: boolean;
      allowAnyColorDraw2OnDraw4?: boolean;
    };
    activeZones: ZoneDefinition[];
    phases: PhaseDefinition[];
    turnTimeoutSeconds?: number;
    gameMode?: "TRICK" | "COMMUNITY" | "DISCARD" | "PROMPT" | "AUTO";
    submission?: SubmissionConfig | null;
    requireNormalInitialCard?: boolean;
  }>) => void;
}

const DRAW_STACK_MODES = [
  {
    rule: "ALL" as const,
    label: "Todo acumulable",
    desc: "Permite responder +2 o +4 con cualquier otra carta de robo",
  },
  {
    rule: "SAME_TYPE" as const,
    label: "Mismo tipo",
    desc: "Solo +2 sobre +2, o +4 sobre +4. No se combinan entre sí",
  },
  {
    rule: "HIGHER_OR_EQUAL" as const,
    label: "Mismo o mayor",
    desc: "+4 puede responder a +2 o +4; +2 solo responde a +2",
  },
  {
    rule: "OFF" as const,
    label: "Desactivado",
    desc: "Sin encadenar: quien recibe el castigo roba y pierde el turno",
  },
];

const ACTION_OPTIONS = [
  { id: "PLAY_CARD", label: "Jugar Carta", desc: "Bajar carta a la mesa o descarte" },
  { id: "DRAW_CARD", label: "Robar Carta", desc: "Tomar carta del mazo" },
  { id: "PASS_TURN", label: "Pasar Turno", desc: "Ceder el turno al siguiente jugador" },
  { id: "CHOOSE_COLOR", label: "Elegir Color", desc: "Fijar color activo tras comodín" },
  { id: "CALL_BET", label: "Cantar Envite", desc: "Declarar envite o apuesta genérica" },
  { id: "CALL_FLOR", label: "Cantar Flor", desc: "Declarar 3 cartas del mismo palo (3 pts o desafío)" },
  { id: "CALL_CONTRA_FLOR", label: "Contraflor", desc: "Subir la apuesta de flor a 6 puntos" },
  { id: "CON_FLOR_QUIERO", label: "Con Flor Quiero", desc: "Aceptar envite de flor rival" },
  { id: "CON_FLOR_ME_ACHICO", label: "Con Flor Me Achico", desc: "Rechazar envite de flor rival" },
  { id: "CALL_ENVIDO", label: "Cantar Envido", desc: "Envido, Real Envido o Falta Envido" },
  { id: "CALL_REAL_ENVIDO", label: "Cantar Real Envido", desc: "Subir el envite a 3 puntos" },
  { id: "CALL_FALTA_ENVIDO", label: "Cantar Falta Envido", desc: "Apostar lo que le falta al rival para ganar" },
  { id: "EL_ENVIDO_ESTA_PRIMERO", label: "El Envido está primero", desc: "Priorizar envido ante truco cantado en 1ª baza" },
  { id: "CALL_TRUCO", label: "Cantar Truco", desc: "Truco, Retruco o Vale Cuatro" },
  { id: "CALL_RETRUCO", label: "Cantar Retruco", desc: "Subir el truco a 3 puntos" },
  { id: "CALL_VALE_CUATRO", label: "Cantar Vale Cuatro", desc: "Subir el truco a 4 puntos" },
  { id: "CALL_CONTRA_FLOR_AL_RESTO", label: "Contraflor al Resto", desc: "Apostar la partida al envite de flor" },
  { id: "QUIERO", label: "Quiero", desc: "Aceptar apuesta o envite pendiente" },
  { id: "NO_QUIERO", label: "No Quiero", desc: "Rechazar apuesta o envite pendiente" },
  { id: "RESPOND_BET", label: "Responder Envite", desc: "Aceptar, subir o no querer" },
  { id: "FOLD", label: "Irse al Mazo", desc: "Retirarse de la mano o ronda" },
  { id: "CAPTURE_CARDS", label: "Capturar Cartas", desc: "Sumar valor objetivo con cartas de la mesa" },
  { id: "DROP_CARD", label: "Tirar a la Mesa", desc: "Dejar carta en la mesa comunitaria sin capturar" },
  { id: "REVEAL_CARD", label: "Revelar Carta", desc: "Da vuelta la carta superior del mazo en público y pasa el turno" },
  { id: "END_GAME", label: "Terminar Partida", desc: "Cierra la partida al instante (sin ganador si el efecto se configura así)" },
  { id: "SUBMIT_CARDS", label: "Enviar Respuestas", desc: "Respuesta oculta del jugador al jurado" },
  { id: "PICK_SUBMISSION", label: "Elegir Ganadora", desc: "El juez elige la respuesta que suma" },
  { id: "EXCHANGE_CARDS", label: "Recambiar Cartas", desc: "El juez cambia cartas antes de la ronda" },
  { id: "CONFIRM_PHASE", label: "Confirmar Fase", desc: "Avanzar de fase (leer consigna, seguir)" },
];

export default function RulesSection({
  winConditionType,
  targetScore,
  matchingProperties,
  allowWildOnAny,
  drawStack,
  activeZones,
  phases,
  turnTimeoutSeconds,
  gameMode,
  submission,
  requireNormalInitialCard = false,
  onChange,
}: RulesSectionProps) {
  const currentActions = phases[0]?.allowedActions || ["PLAY_CARD", "DRAW_CARD", "PASS_TURN"];
  const currentStackRule = drawStack?.rule ?? "ALL";
  const currentEndsTurn = drawStack?.endsTurnOnDraw ?? true;
  const currentAllowAnyColor = drawStack?.allowAnyColorDraw2OnDraw4 ?? true;

  function toggleAction(actionId: string) {
    const nextActions = currentActions.includes(actionId)
      ? currentActions.filter((a) => a !== actionId)
      : [...currentActions, actionId];

    const updatedPhases: PhaseDefinition[] =
      phases.length > 0
        ? phases.map((phase, index) =>
            index === 0 ? { ...phase, allowedActions: nextActions } : phase
          )
        : [
            {
              id: "main",
              name: "Turno Principal",
              allowedActions: nextActions,
            },
          ];
    onChange({ phases: updatedPhases });
  }

  function toggleZone(defaultZone: ZoneDefinition) {
    const exists = activeZones.some((z) => z.id === defaultZone.id);
    let nextZones: ZoneDefinition[];
    if (exists) {
      // Don't allow removing all zones if no matching/phases
      nextZones = activeZones.filter((z) => z.id !== defaultZone.id);
    } else {
      nextZones = [...activeZones, defaultZone];
    }
    onChange({ activeZones: nextZones });
  }

  function toggleMatchProperty(prop: "color" | "value") {
    const next = matchingProperties.includes(prop)
      ? matchingProperties.filter((p) => p !== prop)
      : [...matchingProperties, prop];
    onChange({ matchingProperties: next });
  }

  return (
 <div className="flex flex-col gap-5 border-2 border-subtle bg-statusbar p-5 md:p-6 shadow-[4px_4px_0_0_rgba(0,0,0,0.3)]">
      <div className="flex items-center gap-3 pb-3 border-b border-subtle">
 <span className="flex h-10 w-10 items-center justify-center border border-success/40 bg-success/15 text-success shadow-[0_0_12px_rgba(77,189,116,0.2)]">
          <Icon icon="pixelarticons:sliders" width={20} height={20} />
        </span>
        <div>
          <h2 className="text-base md:text-lg font-black text-ink">Mecánicas &amp; Reglas</h2>
          <p className="text-xs text-ink-faint">Condición de victoria, coincidencia y zonas de juego</p>
        </div>
      </div>

      {/* Condición de Victoria */}
      <div className="flex flex-col gap-2.5">
        <label className="text-xs font-bold text-ink-soft">Condición de Victoria *</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[
            {
              type: "EMPTY_HAND" as const,
              label: "Vaciar Mano",
              desc: "Gana el primer jugador en quedarse sin cartas",
              icon: "pixelarticons:cards",
            },
            {
              type: "SCORE_THRESHOLD" as const,
              label: "Llegar a Puntaje",
              desc: "Gana quien alcance o supere el puntaje objetivo",
              icon: "pixelarticons:trophy",
            },
            {
              type: "LAST_REMAINING" as const,
              label: "Último en Pie",
              desc: "Gana el último jugador que no haya sido eliminado",
              icon: "pixelarticons:user",
            },
            {
              type: "NONE" as const,
              label: "Sin Ganador",
              desc: "Cooperativo o conversación: termina por acción del esquema",
              icon: "pixelarticons:coffee",
            },
          ].map((item) => {
            const isSelected = winConditionType === item.type;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => onChange({ winConditionType: item.type })}
 className={`flex flex-col text-left p-3.5 border transition-all cursor-pointer ${
                  isSelected
                    ? "border-success bg-success/10 shadow-[0_0_14px_rgba(77,189,116,0.25)]"
                    : "border-subtle bg-app/50 hover:border-medium hover:bg-app/80"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon
                    icon={item.icon}
                    width={18}
                    height={18}
                    className={isSelected ? "text-success" : "text-ink-faint"}
                  />
                  <span className="text-xs font-black text-ink">{item.label}</span>
                </div>
                <p className="text-[11px] text-ink-faint leading-tight">{item.desc}</p>
              </button>
            );
          })}
        </div>

        {winConditionType === "SCORE_THRESHOLD" && (
          <label className="flex flex-col gap-1.5 text-xs font-bold text-ink-soft mt-1 sm:max-w-xs">
            <span>Puntaje Objetivo</span>
            <input
              type="number"
              min={1}
              max={10000}
              value={targetScore ?? 30}
              onChange={(e) => onChange({ targetScore: Number(e.target.value) })}
 className="h-10 border border-subtle bg-app/80 px-3 text-sm text-ink focus:border-accent focus:outline-none transition-colors"
            />
          </label>
        )}

        <label className="flex flex-col gap-1.5 text-xs font-bold text-ink-soft mt-1 sm:max-w-xs">
          <span>Tiempo por Turno (segundos)</span>
          <input
            type="number"
            min={0}
            max={3600}
            value={turnTimeoutSeconds ?? 25}
            onChange={(e) => onChange({ turnTimeoutSeconds: Number(e.target.value) })}
            className="h-10 rounded-xl border border-subtle bg-app/80 px-3 text-sm text-ink focus:border-accent focus:outline-none transition-colors"
          />
          <span className="text-[10px] text-ink-faint font-normal">
            Pasado ese tiempo el turno avanza solo. Usá 0 para juegos de conversación sin límite.
          </span>
        </label>

        <div className="flex flex-col gap-2 mt-1">
          <span className="text-xs font-bold text-ink-soft">Modo de Mesa</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {[
              { id: "AUTO" as const, label: "Automático", desc: "El motor lo deduce" },
              { id: "DISCARD" as const, label: "Descarte", desc: "Mazo, pozo y mano" },
              { id: "TRICK" as const, label: "Bazas", desc: "Mesa de bazas y envites" },
              { id: "COMMUNITY" as const, label: "Comunitaria", desc: "Cartas para capturar" },
              { id: "PROMPT" as const, label: "Preguntas", desc: "Revelado público sin manos" },
            ].map((item) => {
              const current = gameMode ?? "AUTO";
              const isSelected = current === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChange({ gameMode: item.id })}
                  className={`flex flex-col text-left p-2.5 border transition-colors cursor-pointer ${
                    isSelected
                      ? "border-accent bg-accent/10"
                      : "border-subtle bg-app/50 hover:border-medium"
                  }`}
                >
                  <span className="text-[11px] font-black text-ink">{item.label}</span>
                  <span className="text-[10px] text-ink-faint leading-tight">{item.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Coincidencia de Cartas */}
 <div className=" border border-subtle bg-app/60 p-4 flex flex-col gap-3">
        <div className="text-xs font-bold text-ink">Reglas de Descarte &amp; Coincidencia</div>
        <p className="text-[11px] text-ink-faint -mt-1">
          Habilita cómo los jugadores pueden jugar cartas sobre la mesa
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="flex items-center gap-2.5 border border-subtle bg-statusbar/60 p-2.5 cursor-pointer hover:border-accent/40">
            <input
              type="checkbox"
              checked={matchingProperties.includes("color")}
              onChange={() => toggleMatchProperty("color")}
              className="w-4 h-4 accent-accent cursor-pointer"
            />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-ink">Coincidir Color / Palo</span>
              <span className="text-[10px] text-ink-faint">Mismo palo o color</span>
            </div>
          </label>

          <label className="flex items-center gap-2.5 border border-subtle bg-statusbar/60 p-2.5 cursor-pointer hover:border-accent/40">
            <input
              type="checkbox"
              checked={matchingProperties.includes("value")}
              onChange={() => toggleMatchProperty("value")}
              className="w-4 h-4 accent-accent cursor-pointer"
            />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-ink">Coincidir Valor / Número</span>
              <span className="text-[10px] text-ink-faint">Mismo número o rango</span>
            </div>
          </label>

          <label className="flex items-center gap-2.5 border border-subtle bg-statusbar/60 p-2.5 cursor-pointer hover:border-accent/40">
            <input
              type="checkbox"
              checked={allowWildOnAny}
              onChange={(e) => onChange({ allowWildOnAny: e.target.checked })}
              className="w-4 h-4 accent-accent cursor-pointer"
            />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-ink">Comodín Universal</span>
              <span className="text-[10px] text-ink-faint">Válido sobre cualquier carta</span>
            </div>
          </label>

          <label className="flex items-center gap-2.5 border border-subtle bg-statusbar/60 p-2.5 cursor-pointer hover:border-accent/40">
            <input
              type="checkbox"
              checked={requireNormalInitialCard}
              onChange={(e) => onChange({ requireNormalInitialCard: e.target.checked })}
              className="w-4 h-4 accent-accent cursor-pointer"
            />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-ink">Carta Inicial Normal</span>
              <span className="text-[10px] text-ink-faint">Sin comodines ni cartas de acción al inicio</span>
            </div>
          </label>
        </div>
      </div>

      {/* Acumulación de Cartas de Robo */}
      <div className="rounded-xl border border-subtle bg-app/60 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-ink">Acumulación de Cartas de Robo (+2 / +4)</div>
            <p className="text-[11px] text-ink-faint">
              Permite a los jugadores responder a un castigo jugando otra carta de robo
            </p>
          </div>
          <span className="text-xs font-bold text-accent font-mono uppercase">
            {currentStackRule}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {DRAW_STACK_MODES.map((mode) => {
            const isSelected = currentStackRule === mode.rule;
            return (
              <button
                key={mode.rule}
                type="button"
                onClick={() =>
                  onChange({
                    drawStack: {
                      rule: mode.rule,
                      endsTurnOnDraw: currentEndsTurn,
                      allowAnyColorDraw2OnDraw4: currentAllowAnyColor,
                    },
                  })
                }
                className={`flex flex-col text-left p-3 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? "border-accent bg-accent/10 shadow-[0_0_12px_rgba(255,210,63,0.2)] text-ink"
                    : "border-subtle bg-statusbar/40 text-ink-faint hover:border-medium hover:text-ink"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-ink">{mode.label}</span>
                  <Icon
                    icon={isSelected ? "pixelarticons:check" : "pixelarticons:chevron-right"}
                    width={14}
                    height={14}
                    className={isSelected ? "text-accent" : "text-ink-faint"}
                  />
                </div>
                <p className="text-[10px] text-ink-faint leading-tight">{mode.desc}</p>
              </button>
            );
          })}
        </div>

        {currentStackRule !== "OFF" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-subtle/50">
            <label className="flex items-center gap-2.5 rounded-lg border border-subtle bg-statusbar/60 p-2.5 cursor-pointer hover:border-accent/40">
              <input
                type="checkbox"
                checked={currentEndsTurn}
                onChange={(e) =>
                  onChange({
                    drawStack: {
                      rule: currentStackRule,
                      endsTurnOnDraw: e.target.checked,
                      allowAnyColorDraw2OnDraw4: currentAllowAnyColor,
                    },
                  })
                }
                className="w-4 h-4 accent-accent rounded cursor-pointer"
              />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-ink">Perder el turno al robar pozo</span>
                <span className="text-[10px] text-ink-faint">
                  Si no tiene carta para contrarrestar, roba todo el pozo y su turno termina en el acto
                </span>
              </div>
            </label>

            {currentStackRule === "ALL" && (
              <label className="flex items-center gap-2.5 rounded-lg border border-subtle bg-statusbar/60 p-2.5 cursor-pointer hover:border-accent/40">
                <input
                  type="checkbox"
                  checked={currentAllowAnyColor}
                  onChange={(e) =>
                    onChange({
                      drawStack: {
                        rule: currentStackRule,
                        endsTurnOnDraw: currentEndsTurn,
                        allowAnyColorDraw2OnDraw4: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4 accent-accent rounded cursor-pointer"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-ink">Responder a un +4 con cualquier +2</span>
                  <span className="text-[10px] text-ink-faint">
                    Permite tirar un +2 sin respetar el color elegido en el comodín +4
                  </span>
                </div>
              </label>
            )}
          </div>
        )}
      </div>

      {/* Zonas de la Mesa */}
 <div className=" border border-subtle bg-app/60 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-ink">Zonas de Juego en Mesa</div>
            <div className="text-[10px] text-ink-faint">
              Zonas activas donde se alojan y mueven las cartas
            </div>
          </div>
          <span className="text-xs font-bold text-success font-mono">
            {activeZones.length} zonas activas
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DEFAULT_ZONES.map((zone) => {
            const isActive = activeZones.some((z) => z.id === zone.id);
            return (
              <button
                key={zone.id}
                type="button"
                onClick={() => toggleZone(zone)}
 className={`flex items-center justify-between p-2.5 border text-left cursor-pointer transition-colors ${
                  isActive
                    ? "border-success/50 bg-success/10 text-ink"
                    : "border-subtle bg-statusbar/40 text-ink-faint hover:text-ink"
                }`}
              >
                <div className="flex flex-col">
                  <span className="text-xs font-bold">{zone.name}</span>
                  <span className="text-[9px] uppercase tracking-wider text-ink-faint font-mono">
                    {zone.type}
                  </span>
                </div>
                <Icon
                  icon={isActive ? "pixelarticons:check" : "pixelarticons:close"}
                  width={16}
                  height={16}
                  className={isActive ? "text-success" : "text-ink-faint"}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Acciones Permitidas */}
 <div className=" border border-subtle bg-app/60 p-4 flex flex-col gap-3">
        <div>
          <div className="text-xs font-bold text-ink">Acciones Permitidas en Turno</div>
          <div className="text-[10px] text-ink-faint">
            Comportamientos y decisiones que puede ejecutar el jugador en su turno
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {ACTION_OPTIONS.map((action) => {
            const isAllowed = currentActions.includes(action.id);
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => toggleAction(action.id)}
 className={`flex items-center justify-between p-2.5 border text-left cursor-pointer transition-colors ${
                  isAllowed
                    ? "border-accent/50 bg-accent/10 text-ink"
                    : "border-subtle bg-statusbar/40 text-ink-faint hover:text-ink"
                }`}
              >
                <div className="flex flex-col">
                  <span className="text-xs font-bold">{action.label}</span>
                  <span className="text-[10px] text-ink-faint">{action.desc}</span>
                </div>
                <Icon
                  icon={isAllowed ? "pixelarticons:check" : "pixelarticons:close"}
                  width={16}
                  height={16}
                  className={isAllowed ? "text-accent" : "text-ink-faint"}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Modo Jurado / Submissions */}
      <div className="rounded-xl border border-subtle bg-app/60 p-4 flex flex-col gap-3">
        <label className="flex items-center justify-between cursor-pointer gap-3">
          <div>
            <div className="text-xs font-bold text-ink">Modo Jurado (Respuestas Ocultas)</div>
            <div className="text-[10px] text-ink-faint">
              Rondas simultáneas donde un juez rota y elige la respuesta ganadora (estilo HDP).
            </div>
          </div>
          <input
            type="checkbox"
            checked={Boolean(submission)}
            onChange={(event) =>
              onChange({
                submission: event.target.checked ? { ...DEFAULT_SUBMISSION_CONFIG } : null,
              })
            }
            className="w-5 h-5 accent-accent rounded cursor-pointer shrink-0"
          />
        </label>

        {submission && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-subtle/60 pt-3">
            <label className="flex flex-col gap-1 text-[11px] font-bold text-ink-soft">
              Puntos por ronda
              <input
                type="number"
                min={1}
                max={100}
                value={submission.pointsPerWin}
                onChange={(event) =>
                  onChange({
                    submission: {
                      ...submission,
                      pointsPerWin: Math.max(1, Number(event.target.value) || 1),
                    },
                  })
                }
                className="h-9 rounded-lg border border-subtle bg-statusbar/60 px-2.5 text-[11px] text-ink focus:border-accent focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1 text-[11px] font-bold text-ink-soft">
              Respuestas por defecto (si la consigna no define espacios)
              <input
                type="number"
                min={1}
                max={3}
                value={submission.defaultPicks}
                onChange={(event) =>
                  onChange({
                    submission: {
                      ...submission,
                      defaultPicks: Math.min(3, Math.max(1, Number(event.target.value) || 1)),
                    },
                  })
                }
                className="h-9 rounded-lg border border-subtle bg-statusbar/60 px-2.5 text-[11px] text-ink focus:border-accent focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1 text-[11px] font-bold text-ink-soft">
              Tipo de carta consigna
              <input
                type="text"
                value={submission.promptCardType}
                onChange={(event) =>
                  onChange({ submission: { ...submission, promptCardType: event.target.value } })
                }
                className="h-9 rounded-lg border border-subtle bg-statusbar/60 px-2.5 text-[11px] text-ink focus:border-accent focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1 text-[11px] font-bold text-ink-soft">
              Tipo de carta respuesta
              <input
                type="text"
                value={submission.answerCardType}
                onChange={(event) =>
                  onChange({ submission: { ...submission, answerCardType: event.target.value } })
                }
                className="h-9 rounded-lg border border-subtle bg-statusbar/60 px-2.5 text-[11px] text-ink focus:border-accent focus:outline-none"
              />
            </label>

            <label className="flex items-center gap-2.5 rounded-lg border border-subtle bg-statusbar/60 p-2.5 cursor-pointer hover:border-accent/40">
              <input
                type="checkbox"
                checked={submission.excludeJudge}
                onChange={(event) =>
                  onChange({ submission: { ...submission, excludeJudge: event.target.checked } })
                }
                className="w-4 h-4 accent-accent rounded cursor-pointer"
              />
              <span className="text-[11px] text-ink-soft">El juez no envía respuesta</span>
            </label>

            <label className="flex items-center gap-2.5 rounded-lg border border-subtle bg-statusbar/60 p-2.5 cursor-pointer hover:border-accent/40">
              <input
                type="checkbox"
                checked={submission.picksFromPrompt}
                onChange={(event) =>
                  onChange({ submission: { ...submission, picksFromPrompt: event.target.checked } })
                }
                className="w-4 h-4 accent-accent rounded cursor-pointer"
              />
              <span className="text-[11px] text-ink-soft">Espacios definidos por cada consigna</span>
            </label>

            <label className="flex items-center gap-2.5 rounded-lg border border-subtle bg-statusbar/60 p-2.5 cursor-pointer hover:border-accent/40">
              <input
                type="checkbox"
                checked={submission.judgeExchange}
                onChange={(event) =>
                  onChange({ submission: { ...submission, judgeExchange: event.target.checked } })
                }
                className="w-4 h-4 accent-accent rounded cursor-pointer"
              />
              <span className="text-[11px] text-ink-soft">El juez puede recambiar cartas</span>
            </label>

            <label className="flex items-center gap-2.5 rounded-lg border border-subtle bg-statusbar/60 p-2.5 cursor-pointer hover:border-accent/40">
              <input
                type="checkbox"
                checked={submission.refillToHandSize}
                onChange={(event) =>
                  onChange({
                    submission: { ...submission, refillToHandSize: event.target.checked },
                  })
                }
                className="w-4 h-4 accent-accent rounded cursor-pointer"
              />
              <span className="text-[11px] text-ink-soft">Reponer manos al tamaño inicial</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
