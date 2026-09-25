"use client";

import { Icon } from "@iconify/react";
import { DEFAULT_ZONES, type PhaseDefinition, type ZoneDefinition } from "@/lib/editor/presets";

interface RulesSectionProps {
  winConditionType: "EMPTY_HAND" | "SCORE_THRESHOLD" | "LAST_REMAINING";
  targetScore?: number;
  matchingProperties: Array<"color" | "value">;
  allowWildOnAny: boolean;
  activeZones: ZoneDefinition[];
  phases: PhaseDefinition[];
  onChange: (fields: Partial<{
    winConditionType: "EMPTY_HAND" | "SCORE_THRESHOLD" | "LAST_REMAINING";
    targetScore?: number;
    matchingProperties: Array<"color" | "value">;
    allowWildOnAny: boolean;
    activeZones: ZoneDefinition[];
    phases: PhaseDefinition[];
  }>) => void;
}

const ACTION_OPTIONS = [
  { id: "PLAY_CARD", label: "Jugar Carta", desc: "Bajar carta a la mesa o descarte" },
  { id: "DRAW_CARD", label: "Robar Carta", desc: "Tomar carta del mazo" },
  { id: "PASS_TURN", label: "Pasar Turno", desc: "Ceder el turno al siguiente jugador" },
  { id: "CHOOSE_COLOR", label: "Elegir Color", desc: "Fijar color activo tras comodín" },
  { id: "CALL_BET", label: "Cantar Envite", desc: "Declarar envite o apuesta genérica" },
  { id: "CALL_ENVIDO", label: "Cantar Envido", desc: "Envido, Real Envido o Falta Envido" },
  { id: "CALL_TRUCO", label: "Cantar Truco", desc: "Truco, Retruco o Vale Cuatro" },
  { id: "QUIERO", label: "Quiero", desc: "Aceptar apuesta o envite pendiente" },
  { id: "NO_QUIERO", label: "No Quiero", desc: "Rechazar apuesta o envite pendiente" },
  { id: "RESPOND_BET", label: "Responder Envite", desc: "Aceptar, subir o no querer" },
  { id: "FOLD", label: "Irse al Mazo", desc: "Retirarse de la mano o ronda" },
  { id: "CAPTURE_CARDS", label: "Capturar Cartas", desc: "Sumar valor objetivo con cartas de la mesa" },
  { id: "DROP_CARD", label: "Tirar a la Mesa", desc: "Dejar carta en la mesa comunitaria sin capturar" },
];

export default function RulesSection({
  winConditionType,
  targetScore,
  matchingProperties,
  allowWildOnAny,
  activeZones,
  phases,
  onChange,
}: RulesSectionProps) {
  const currentActions = phases[0]?.allowedActions || ["PLAY_CARD", "DRAW_CARD", "PASS_TURN"];

  function toggleAction(actionId: string) {
    const nextActions = currentActions.includes(actionId)
      ? currentActions.filter((a) => a !== actionId)
      : [...currentActions, actionId];

    const updatedPhases: PhaseDefinition[] = [
      {
        id: phases[0]?.id || "main",
        name: phases[0]?.name || "Turno Principal",
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
    <div className="flex flex-col gap-5 rounded-2xl border border-subtle bg-statusbar/80 p-5 md:p-6 backdrop-blur">
      <div className="flex items-center gap-3 pb-3 border-b border-subtle">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-success/40 bg-success/15 text-success shadow-[0_0_12px_rgba(77,189,116,0.2)]">
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
          ].map((item) => {
            const isSelected = winConditionType === item.type;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => onChange({ winConditionType: item.type })}
                className={`flex flex-col text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
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
              className="h-10 rounded-xl border border-subtle bg-app/80 px-3 text-sm text-ink focus:border-accent focus:outline-none transition-colors"
            />
          </label>
        )}
      </div>

      {/* Coincidencia de Cartas */}
      <div className="rounded-xl border border-subtle bg-app/60 p-4 flex flex-col gap-3">
        <div className="text-xs font-bold text-ink">Reglas de Descarte &amp; Coincidencia</div>
        <p className="text-[11px] text-ink-faint -mt-1">
          Habilita cómo los jugadores pueden jugar cartas sobre la mesa
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="flex items-center gap-2.5 rounded-lg border border-subtle bg-statusbar/60 p-2.5 cursor-pointer hover:border-accent/40">
            <input
              type="checkbox"
              checked={matchingProperties.includes("color")}
              onChange={() => toggleMatchProperty("color")}
              className="w-4 h-4 accent-accent rounded cursor-pointer"
            />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-ink">Coincidir Color / Palo</span>
              <span className="text-[10px] text-ink-faint">Mismo palo o color</span>
            </div>
          </label>

          <label className="flex items-center gap-2.5 rounded-lg border border-subtle bg-statusbar/60 p-2.5 cursor-pointer hover:border-accent/40">
            <input
              type="checkbox"
              checked={matchingProperties.includes("value")}
              onChange={() => toggleMatchProperty("value")}
              className="w-4 h-4 accent-accent rounded cursor-pointer"
            />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-ink">Coincidir Valor / Número</span>
              <span className="text-[10px] text-ink-faint">Mismo número o rango</span>
            </div>
          </label>

          <label className="flex items-center gap-2.5 rounded-lg border border-subtle bg-statusbar/60 p-2.5 cursor-pointer hover:border-accent/40">
            <input
              type="checkbox"
              checked={allowWildOnAny}
              onChange={(e) => onChange({ allowWildOnAny: e.target.checked })}
              className="w-4 h-4 accent-accent rounded cursor-pointer"
            />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-ink">Comodín Universal</span>
              <span className="text-[10px] text-ink-faint">Válido sobre cualquier carta</span>
            </div>
          </label>
        </div>
      </div>

      {/* Zonas de la Mesa */}
      <div className="rounded-xl border border-subtle bg-app/60 p-4 flex flex-col gap-3">
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
                className={`flex items-center justify-between p-2.5 rounded-lg border text-left cursor-pointer transition-colors ${
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
      <div className="rounded-xl border border-subtle bg-app/60 p-4 flex flex-col gap-3">
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
                className={`flex items-center justify-between p-2.5 rounded-lg border text-left cursor-pointer transition-colors ${
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
    </div>
  );
}
