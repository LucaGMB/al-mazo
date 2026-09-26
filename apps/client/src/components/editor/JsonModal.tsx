"use client";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import Button from "@/components/Button";
import type { GameDefinitionData } from "@/lib/editor/presets";

interface JsonModalProps {
  gameData: GameDefinitionData;
  isOpen: boolean;
  onClose: () => void;
  onImport: (imported: GameDefinitionData) => void;
}

export default function JsonModal({ gameData, isOpen, onClose, onImport }: JsonModalProps) {
  const [jsonText, setJsonText] = useState(() => JSON.stringify(gameData, null, 2));
  const [copySuccess, setCopySuccess] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Re-sync the textarea every time the modal opens so it reflects the current game.
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setJsonText(JSON.stringify(gameData, null, 2));
      setParseError(null);
    }
  }, [isOpen, gameData]);

  if (!isOpen) return null;

  function handleCopy() {
    navigator.clipboard.writeText(jsonText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  }

  function handleApply() {
    try {
      const parsed = JSON.parse(jsonText) as GameDefinitionData;
      if (!parsed.title || typeof parsed.title !== "string") {
        throw new Error("El JSON debe incluir un title válido.");
      }
      if (!parsed.deckConfig || !Array.isArray(parsed.deckConfig.templates)) {
        throw new Error("deckConfig.templates debe ser un array de cartas.");
      }
      if (!parsed.rules || typeof parsed.rules !== "object") {
        throw new Error("El JSON debe incluir rules.");
      }
      if (!parsed.rules.winCondition || typeof parsed.rules.winCondition.type !== "string") {
        throw new Error("rules.winCondition.type es obligatorio.");
      }
      if (typeof parsed.rules.minPlayers !== "number" || typeof parsed.rules.maxPlayers !== "number") {
        throw new Error("rules.minPlayers y rules.maxPlayers deben ser números.");
      }
      setParseError(null);
      onImport(parsed);
      onClose();
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "JSON inválido");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
 <div className="flex flex-col w-full max-w-2xl max-h-[85vh] border-2 border-subtle bg-statusbar shadow-[6px_6px_0_0_rgba(0,0,0,0.4)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-subtle bg-surface">
          <div className="flex items-center gap-2.5">
            <Icon icon="pixelarticons:code" width={20} height={20} className="text-accent" />
            <h3 className="text-sm font-bold text-ink">Esquema Declarativo JSON</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
 className="flex h-8 w-8 items-center justify-center border border-subtle text-ink-faint hover:text-ink cursor-pointer"
          >
            <Icon icon="pixelarticons:close" width={18} height={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-ink-faint">
            <span>Podés editar el JSON directamente y pulsar &quot;Aplicar cambios&quot;</span>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-accent hover:underline cursor-pointer"
            >
              <Icon
                icon={copySuccess ? "pixelarticons:check" : "pixelarticons:copy"}
                width={14}
                height={14}
              />
              {copySuccess ? "Copiado!" : "Copiar JSON"}
            </button>
          </div>

          <textarea
            rows={14}
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setParseError(null);
            }}
 className="w-full font-mono text-xs border border-subtle bg-app/90 p-3 text-ink focus:border-accent focus:outline-none resize-none leading-relaxed"
          />

          {parseError && (
            <div className="text-xs text-danger flex items-center gap-1.5">
              <Icon icon="pixelarticons:alert" width={14} height={14} />
              {parseError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-subtle bg-surface">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleApply}>
            Aplicar cambios
          </Button>
        </div>
      </div>
    </div>
  );
}
