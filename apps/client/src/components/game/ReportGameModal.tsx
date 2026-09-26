"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import Button from "@/components/Button";
import { submitGameReport, type ReportReason } from "@/lib/api/reports";
import { useSession } from "@/lib/session/use-session";

interface ReportGameModalProps {
  isOpen: boolean;
  gameId: string;
  gameTitle: string;
  onClose: () => void;
  onOpenAuth?: () => void;
}

const REPORT_REASONS: { value: ReportReason; label: string; description: string }[] = [
  {
    value: "COPYRIGHT",
    label: "Infracción de Copyright / Propiedad Intelectual",
    description: "Uso no autorizado de marcas, nombres, cartas, artes o contenido protegido por derechos de autor.",
  },
  {
    value: "INAPPROPRIATE",
    label: "Contenido Inapropiado u Ofensivo",
    description: "Mensajes de odio, discriminación, lenguaje explícito o contenido ofensivo.",
  },
  {
    value: "SPAM",
    label: "Spam o Información Engañosa",
    description: "Título o descripción falsos, publicidad encubierta o repetición abusiva.",
  },
  {
    value: "BROKEN",
    label: "Juego Roto o Injugable",
    description: "Configuración o reglas defectuosas que imposibilitan disputar la partida.",
  },
  {
    value: "OTHER",
    label: "Otro Motivo",
    description: "Cualquier otra infracción a los términos, normas de convivencia o leyes vigentes.",
  },
];

export function ReportGameModal({
  isOpen,
  gameId,
  gameTitle,
  onClose,
  onOpenAuth,
}: ReportGameModalProps) {
  const { user, isLoggedIn } = useSession();

  const [reason, setReason] = useState<ReportReason>("COPYRIGHT");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const isGuest = !isLoggedIn || !user || user.isAnonymous;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmed = description.trim();
    if (trimmed.length < 5) {
      setError("Por favor detallá el motivo del reporte (mínimo 5 caracteres).");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await submitGameReport(gameId, {
        reason,
        description: trimmed,
      });
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al enviar el reporte");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    setSubmitted(false);
    setDescription("");
    setError(null);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Reportar juego"
    >
      <div className="flex flex-col w-full max-w-lg border-2 border-subtle bg-statusbar shadow-[8px_8px_0_0_rgba(0,0,0,0.6)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-subtle bg-surface">
          <div className="flex items-center gap-2.5">
            <Icon icon="pixelarticons:flag" width={20} height={20} className="text-danger" />
            <div>
              <h3 className="text-sm font-bold text-ink">Reportar juego</h3>
              <p className="text-[11px] text-ink-faint truncate max-w-[280px] sm:max-w-xs">{gameTitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center border border-subtle text-ink-faint hover:text-ink cursor-pointer"
          >
            <Icon icon="pixelarticons:close" width={18} height={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4">
          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center border border-success/40 bg-success/15 text-success">
                <Icon icon="pixelarticons:check" width={28} height={28} />
              </div>
              <div className="font-bold text-sm text-ink">Reporte recibido con éxito</div>
              <p className="text-xs text-ink-faint max-w-sm">
                Gracias por ayudarnos a mantener una comunidad segura y en cumplimiento de normas y derechos de autor.
                El equipo de moderación revisará este contenido a la brevedad.
              </p>
              <Button variant="cta" onClick={handleClose} className="mt-2">
                Aceptar
              </Button>
            </div>
          ) : isGuest ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center border border-warning/40 bg-warning/15 text-warning">
                <Icon icon="pixelarticons:lock" width={28} height={28} />
              </div>
              <div className="font-bold text-sm text-ink">Iniciá sesión para reportar</div>
              <p className="text-xs text-ink-faint max-w-sm">
                Para prevenir spam y brindar trazabilidad en denuncias de copyright o contenido, solo los usuarios registrados pueden reportar juegos.
              </p>
              <div className="flex items-center gap-3 mt-2">
                <Button
                  variant="primary"
                  onClick={() => {
                    handleClose();
                    onOpenAuth?.();
                  }}
                >
                  Iniciar sesión o registrarse
                </Button>
                <Button variant="ghost" onClick={handleClose}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-ink-soft">Motivo de la denuncia</label>
                <div className="flex flex-col gap-2">
                  {REPORT_REASONS.map((r) => {
                    const isSelected = reason === r.value;
                    return (
                      <label
                        key={r.value}
                        className={`flex items-start gap-3 p-2.5 border cursor-pointer transition-colors ${
                          isSelected
                            ? "border-accent bg-accent/10 text-ink"
                            : "border-subtle bg-surface text-ink-soft hover:border-medium"
                        }`}
                      >
                        <input
                          type="radio"
                          name="reportReason"
                          value={r.value}
                          checked={isSelected}
                          onChange={() => setReason(r.value)}
                          className="mt-0.5 accent-accent cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-ink">{r.label}</span>
                          <span className="text-[11px] text-ink-faint leading-normal mt-0.5">
                            {r.description}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="report-desc" className="text-xs font-semibold text-ink-soft">
                    Explicación y detalles
                  </label>
                  <span className="text-[10px] text-ink-faint">{description.length}/1000</span>
                </div>
                <textarea
                  id="report-desc"
                  rows={3}
                  maxLength={1000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describí con claridad la infracción, enlaces de referencia o detalles para el moderador..."
                  className="w-full border border-subtle bg-app p-2.5 text-xs text-ink placeholder:text-ink-faint outline-none focus:border-accent resize-none"
                  required
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
                  <Icon icon="pixelarticons:alert" width={16} height={16} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-subtle">
                <Button variant="ghost" onClick={handleClose} type="button">
                  Cancelar
                </Button>
                <Button variant="cta" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Enviando..." : "Enviar reporte"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
