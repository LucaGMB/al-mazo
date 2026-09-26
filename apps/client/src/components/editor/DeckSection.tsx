"use client";

import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import {
  DECK_PRESET_OPTIONS,
  type CardTemplate,
} from "@/lib/editor/presets";

interface DeckSectionProps {
  templates: CardTemplate[];
  initialHandSize: number;
  reshuffleDiscardPile: boolean;
  onTemplatesChange: (templates: CardTemplate[]) => void;
  onInitialHandSizeChange: (size: number) => void;
  onReshuffleChange: (val: boolean) => void;
}

export default function DeckSection({
  templates,
  initialHandSize,
  reshuffleDiscardPile,
  onTemplatesChange,
  onInitialHandSizeChange,
  onReshuffleChange,
}: DeckSectionProps) {
  const [showCardList, setShowCardList] = useState(false);

  const totalCards = useMemo(() => {
    return templates.reduce((acc, t) => acc + (t.count || 1), 0);
  }, [templates]);

  // Breakdown by suit / color
  const colorBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of templates) {
      const key = t.color || "SIN_COLOR";
      map[key] = (map[key] || 0) + (t.count || 1);
    }
    return map;
  }, [templates]);

  // Breakdown by card type
  const typeBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of templates) {
      map[t.type] = (map[t.type] || 0) + (t.count || 1);
    }
    return map;
  }, [templates]);

  // Text cards (prompts/answers) used by judge-style games
  const textTemplates = useMemo(
    () =>
      templates
        .map((template, index) => ({ template, index }))
        .filter(({ template }) => template.type === "PROMPT" || template.type === "ANSWER"),
    [templates]
  );

  function updateTemplate(index: number, changes: { text?: string; picks?: number }) {
    onTemplatesChange(
      templates.map((template, i) => {
        if (i !== index) return template;
        const metadata = { ...(template.metadata ?? {}) };
        if (changes.text !== undefined) metadata.text = changes.text;
        if (changes.picks !== undefined) metadata.picks = changes.picks;
        return { ...template, metadata };
      })
    );
  }

  function addTextCard(type: "PROMPT" | "ANSWER") {
    const metadata =
      type === "PROMPT" ? { text: "Nueva consigna con ___", picks: 1 } : { text: "Nueva respuesta" };
    onTemplatesChange([...templates, { count: 1, type, metadata }]);
  }

  function removeTemplate(index: number) {
    onTemplatesChange(templates.filter((_, i) => i !== index));
  }

  // Identify active preset if any
  const activePresetId = useMemo(() => {
    for (const preset of DECK_PRESET_OPTIONS) {
      const presetTemplates = preset.templates();
      if (
        presetTemplates.length === templates.length &&
        preset.totalCards === totalCards &&
        presetTemplates[0]?.color === templates[0]?.color &&
        presetTemplates[0]?.type === templates[0]?.type
      ) {
        return preset.id;
      }
    }
    return "CUSTOM";
  }, [templates, totalCards]);

  function handleSelectPreset(presetId: string) {
    const preset = DECK_PRESET_OPTIONS.find((p) => p.id === presetId);
    if (preset) {
      onTemplatesChange(preset.templates());
    }
  }

  return (
 <div className="flex flex-col gap-5 border-2 border-subtle bg-statusbar p-5 md:p-6 shadow-[4px_4px_0_0_rgba(0,0,0,0.3)]">
      <div className="flex items-center gap-3 pb-3 border-b border-subtle">
 <span className="flex h-10 w-10 items-center justify-center border border-warning/40 bg-warning/15 text-warning shadow-[0_0_12px_rgba(255,193,7,0.2)]">
          <Icon icon="pixelarticons:notes" width={20} height={20} />
        </span>
        <div>
          <h2 className="text-base md:text-lg font-black text-ink">Mazo &amp; Cartas</h2>
          <p className="text-xs text-ink-faint">Seleccioná la baraja y configurá el reparto</p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <label className="text-xs font-bold text-ink-soft">Baraja Predefinida</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {DECK_PRESET_OPTIONS.map((preset) => {
            const isSelected = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset.id)}
 className={`flex flex-col text-left p-3 border transition-all cursor-pointer ${
                  isSelected
                    ? "border-warning bg-warning/10 shadow-[0_0_14px_rgba(255,193,7,0.25)]"
                    : "border-subtle bg-app/50 hover:border-medium hover:bg-app/80"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-black text-ink">{preset.name}</span>
 <span className="text-[10px] font-bold text-warning px-1.5 py-0.5 bg-warning/20">
                    {preset.totalCards} cartas
                  </span>
                </div>
                <p className="text-[11px] text-ink-faint line-clamp-2 leading-tight">
                  {preset.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary stats */}
 <div className=" border border-subtle bg-app/60 p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-subtle/60 pb-2.5">
          <div className="flex items-center gap-2">
            <Icon icon="pixelarticons:grid" width={18} height={18} className="text-warning" />
            <span className="text-xs font-bold text-ink">Composición del Mazo</span>
          </div>
          <span className="text-xs font-black text-warning">
            Total: {totalCards} cartas
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {Object.entries(colorBreakdown).map(([color, count]) => (
            <span
              key={color}
 className="inline-flex items-center gap-1.5 text-[11px] font-mono font-medium border border-subtle bg-statusbar px-2.5 py-1 text-ink-soft"
            >
 <span className="w-2 h-2 bg-accent" />
              {color}: <strong className="text-ink">{count}</strong>
            </span>
          ))}
          {Object.entries(typeBreakdown).map(([type, count]) => (
            <span
              key={type}
 className="inline-flex items-center gap-1.5 text-[11px] font-mono font-medium border border-subtle bg-statusbar px-2.5 py-1 text-ink-soft"
            >
              <Icon icon="pixelarticons:label" width={12} height={12} className="text-warning" />
              {type}: <strong className="text-ink">{count}</strong>
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowCardList((prev) => !prev)}
          className="flex items-center gap-1.5 self-start text-[11px] text-accent hover:underline cursor-pointer pt-1"
        >
          <Icon
            icon="pixelarticons:chevron-down"
            width={14}
            height={14}
            className={`transition-transform duration-150 ${showCardList ? "rotate-180" : ""}`}
          />
          {showCardList ? "Ocultar catálogo de cartas" : "Ver catálogo de cartas en el mazo"}
        </button>

        {showCardList && (
 <div className="max-h-56 overflow-y-auto border border-subtle bg-app/80 p-2.5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 text-[11px]">
            {templates.map((card, i) => (
              <div
                key={`${card.color || "n"}-${card.value || "v"}-${i}`}
 className="flex items-center justify-between border border-subtle/60 bg-statusbar/60 px-2 py-1"
              >
                <span className="truncate font-mono text-ink">
                  {card.value ?? "Carta"} {card.color ? `(${card.color})` : ""}
                </span>
                <span className="text-ink-faint font-bold text-[10px]">x{card.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Text Cards Editor (prompts & answers) */}
      <div className="rounded-xl border border-subtle bg-app/60 p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-bold text-ink">Cartas de Texto (Consignas &amp; Respuestas)</div>
            <div className="text-[10px] text-ink-faint">
              Editá el texto y los espacios a completar. PROMPT es la consigna negra y ANSWER la
              respuesta blanca.
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => addTextCard("PROMPT")}
              className="rounded-lg border border-subtle bg-statusbar px-2.5 py-1.5 text-[11px] font-bold text-ink-soft transition-colors hover:border-warning hover:text-ink cursor-pointer"
            >
              + Consigna
            </button>
            <button
              type="button"
              onClick={() => addTextCard("ANSWER")}
              className="rounded-lg border border-subtle bg-statusbar px-2.5 py-1.5 text-[11px] font-bold text-ink-soft transition-colors hover:border-accent hover:text-ink cursor-pointer"
            >
              + Respuesta
            </button>
          </div>
        </div>

        {textTemplates.length === 0 ? (
          <p className="text-[11px] text-ink-faint">
            Este mazo no tiene cartas de texto. Agregá consignas y respuestas para armar un juego de
            jurado.
          </p>
        ) : (
          <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1">
            {textTemplates.map(({ template, index }) => (
              <div key={`${template.type}-${index}`} className="flex items-center gap-2">
                <span
                  className={`w-16 shrink-0 rounded px-1.5 py-0.5 text-center text-[9px] font-black uppercase tracking-wide ${
                    template.type === "PROMPT"
                      ? "bg-[#15161a] text-white border border-white/20"
                      : "bg-[#f4f2ea] text-[#15161a] border border-black/20"
                  }`}
                >
                  {template.type === "PROMPT" ? "Negra" : "Blanca"}
                </span>
                <input
                  type="text"
                  aria-label={`Texto de la carta ${index + 1}`}
                  value={typeof template.metadata?.text === "string" ? template.metadata.text : ""}
                  onChange={(event) => updateTemplate(index, { text: event.target.value })}
                  placeholder="Texto de la carta"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-subtle bg-statusbar/60 px-2.5 text-[11px] text-ink transition-colors focus:border-accent focus:outline-none"
                />
                {template.type === "PROMPT" && (
                  <label className="flex shrink-0 items-center gap-1 text-[10px] text-ink-faint">
                    Espacios
                    <input
                      type="number"
                      min={1}
                      max={3}
                      aria-label={`Espacios de la consigna ${index + 1}`}
                      value={Number(template.metadata?.picks ?? 1)}
                      onChange={(event) =>
                        updateTemplate(index, { picks: Number(event.target.value) || 1 })
                      }
                      className="h-9 w-12 rounded-lg border border-subtle bg-statusbar/60 px-1.5 text-center text-[11px] text-ink focus:border-accent focus:outline-none"
                    />
                  </label>
                )}
                <span className="w-7 shrink-0 text-right text-[10px] font-bold text-ink-faint">
                  x{template.count}
                </span>
                <button
                  type="button"
                  onClick={() => removeTemplate(index)}
                  aria-label={`Eliminar carta ${index + 1}`}
                  className="shrink-0 rounded-lg border border-subtle p-1.5 text-ink-faint transition-colors hover:border-danger/50 hover:text-danger cursor-pointer"
                >
                  <Icon icon="pixelarticons:close" width={14} height={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hand & Discard Rules */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5 text-xs font-bold text-ink-soft">
          <div className="flex justify-between items-center">
            <span>Cartas Iniciales por Jugador</span>
            <span className="font-black text-warning text-sm">{initialHandSize}</span>
          </div>
          <input
            type="range"
            min={0}
            max={15}
            value={initialHandSize}
            onChange={(e) => onInitialHandSizeChange(Number(e.target.value))}
            className="w-full accent-warning cursor-pointer"
          />
          <span className="text-[10px] text-ink-faint">
            Cantidad de cartas repartidas al inicio de la ronda (ej: 3 en truco, 7 en color-match). Usá 0 para juegos que no reparten manos (ej: revelar preguntas).
          </span>
        </label>

 <div className="flex flex-col justify-center border border-subtle bg-app/50 p-4">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="flex flex-col">
              <span className="text-xs font-bold text-ink-soft">Rebarajar Pozo de Descarte</span>
              <span className="text-[10px] text-ink-faint">
                Si el mazo se acaba, el pozo se recicla automáticamente
              </span>
            </span>
            <input
              type="checkbox"
              checked={reshuffleDiscardPile}
              onChange={(e) => onReshuffleChange(e.target.checked)}
 className="w-5 h-5 accent-warning cursor-pointer"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
