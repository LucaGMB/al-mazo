"use client";

import { useEffect, useState, useMemo } from "react";
import { Icon } from "@iconify/react";
import BackButton from "@/components/BackButton";
import Button from "@/components/Button";
import { useSession } from "@/lib/session/use-session";
import {
  listReports,
  updateReport,
  takedownGame,
  restoreGame,
  listAdminGames,
  type GameReport,
  type AdminCommunityGame,
  type ReportStatus,
} from "@/lib/api/reports";

const REASON_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  COPYRIGHT: {
    label: "Copyright / Propiedad Intelectual",
    icon: "pixelarticons:shield",
    color: "text-danger border-danger/40 bg-danger/10",
  },
  INAPPROPRIATE: {
    label: "Contenido Inapropiado",
    icon: "pixelarticons:alert",
    color: "text-warning border-warning/40 bg-warning/10",
  },
  SPAM: {
    label: "Spam / Engañoso",
    icon: "pixelarticons:message",
    color: "text-ink-soft border-medium bg-subtle",
  },
  BROKEN: {
    label: "Juego Roto",
    icon: "pixelarticons:close",
    color: "text-danger border-danger/40 bg-danger/10",
  },
  OTHER: {
    label: "Otro",
    icon: "pixelarticons:info-box",
    color: "text-ink-soft border-medium bg-subtle",
  },
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AdminPage() {
  const { user, isLoggedIn, isLoading: sessionLoading } = useSession();

  const [activeTab, setActiveTab] = useState<"reports" | "games">("reports");
  const [reportFilter, setReportFilter] = useState<ReportStatus | "ALL">("PENDING");

  const [reports, setReports] = useState<GameReport[]>([]);
  const [games, setGames] = useState<AdminCommunityGame[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingData, setLoadingData] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modal / Confirm state for Takedown
  const [takedownTarget, setTakedownTarget] = useState<{ id: string; title: string } | null>(null);
  const [takedownReason, setTakedownReason] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  const isAdmin = isLoggedIn && user?.role === "ADMIN";

  async function loadData() {
    setLoadingData(true);
    setActionError(null);
    try {
      const [fetchedReports, fetchedGames] = await Promise.all([
        listReports(reportFilter === "ALL" ? undefined : reportFilter),
        listAdminGames(),
      ]);
      setReports(fetchedReports);
      setGames(fetchedGames);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Error al cargar datos");
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    let isCancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingData(true);
    setActionError(null);

    Promise.all([
      listReports(reportFilter === "ALL" ? undefined : reportFilter),
      listAdminGames(),
    ])
      .then(([fetchedReports, fetchedGames]) => {
        if (isCancelled) return;
        setReports(fetchedReports);
        setGames(fetchedGames);
        setLoadingData(false);
      })
      .catch((err: unknown) => {
        if (isCancelled) return;
        setActionError(err instanceof Error ? err.message : "Error al cargar datos");
        setLoadingData(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isAdmin, reportFilter]);

  async function handleDismiss(reportId: string) {
    if (submittingAction) return;
    setSubmittingAction(true);
    try {
      await updateReport(reportId, {
        status: "DISMISSED",
        adminNotes: "Desestimado por moderación.",
      });
      await loadData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Error al desestimar reporte");
    } finally {
      setSubmittingAction(false);
    }
  }

  async function handleResolve(reportId: string) {
    if (submittingAction) return;
    setSubmittingAction(true);
    try {
      await updateReport(reportId, {
        status: "RESOLVED",
        adminNotes: "Marcado como resuelto.",
      });
      await loadData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Error al resolver reporte");
    } finally {
      setSubmittingAction(false);
    }
  }

  async function confirmTakedown() {
    if (!takedownTarget || submittingAction) return;
    setSubmittingAction(true);
    try {
      await takedownGame(takedownTarget.id, takedownReason || "Infracción de normas o copyright");
      setTakedownTarget(null);
      setTakedownReason("");
      await loadData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Error al dar de baja el juego");
    } finally {
      setSubmittingAction(false);
    }
  }

  async function handleRestore(gameId: string) {
    if (submittingAction) return;
    setSubmittingAction(true);
    try {
      await restoreGame(gameId);
      await loadData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Error al restaurar el juego");
    } finally {
      setSubmittingAction(false);
    }
  }

  const filteredGames = useMemo(() => {
    if (!searchQuery.trim()) return games;
    const q = searchQuery.toLowerCase();
    return games.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.slug.toLowerCase().includes(q) ||
        (g.author?.name && g.author.name.toLowerCase().includes(q))
    );
  }, [games, searchQuery]);

  const pendingReportsCount = useMemo(() => {
    return reports.filter((r) => r.status === "PENDING").length;
  }, [reports]);

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center text-xs text-ink-faint">
        Cargando sesión...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-app flex flex-col items-center justify-center p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center border-2 border-danger/40 bg-danger/10 text-danger mb-4">
          <Icon icon="pixelarticons:lock" width={32} height={32} />
        </div>
        <h1 className="text-xl font-bold text-ink">Acceso restringido</h1>
        <p className="mt-2 text-xs text-ink-faint max-w-sm">
          Esta sección es exclusiva para el equipo de Administradores y Moderación de Al-Mazo.
        </p>
        <Button to="/" variant="cta" className="mt-6">
          Volver al Inicio
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app pb-16">
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <BackButton to="/perfil" />
          <span className="inline-flex items-center gap-1.5 border border-accent/40 bg-accent/15 px-3 py-1 text-xs font-bold text-accent">
            <Icon icon="pixelarticons:shield" width={16} height={16} />
            ADMINISTRADOR
          </span>
        </div>

        {/* Title */}
        <div className="flex flex-col gap-1 mb-6">
          <h1 className="font-display text-2xl sm:text-3xl font-black text-ink">
            Panel de Moderación &amp; Legal
          </h1>
          <p className="text-xs sm:text-sm text-ink-faint">
            Revisión de denuncias por copyright, contenido inapropiado y control de juegos comunitarios.
          </p>
        </div>

        {/* Action Error Alert */}
        {actionError && (
          <div className="mb-6 flex items-center gap-2 border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
            <Icon icon="pixelarticons:alert" width={18} height={18} className="shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-subtle mb-6 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("reports")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 -mb-px transition-colors cursor-pointer ${
              activeTab === "reports"
                ? "border-accent text-accent bg-accent/5"
                : "border-transparent text-ink-faint hover:text-ink"
            }`}
          >
            <Icon icon="pixelarticons:flag" width={16} height={16} />
            <span>Reportes Recibidos</span>
            {pendingReportsCount > 0 && (
              <span className="bg-danger text-white px-1.5 py-0.2 rounded-full text-[10px] font-black">
                {pendingReportsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("games")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 -mb-px transition-colors cursor-pointer ${
              activeTab === "games"
                ? "border-accent text-accent bg-accent/5"
                : "border-transparent text-ink-faint hover:text-ink"
            }`}
          >
            <Icon icon="pixelarticons:gamepad" width={16} height={16} />
            <span>Juegos de la Comunidad ({games.length})</span>
          </button>
        </div>

        {/* TAB 1: REPORTS */}
        {activeTab === "reports" && (
          <div className="flex flex-col gap-5">
            {/* Filter bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {(["PENDING", "RESOLVED", "DISMISSED", "ALL"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setReportFilter(status)}
                    className={`px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer ${
                      reportFilter === status
                        ? "border-accent bg-accent/15 text-accent font-bold"
                        : "border-subtle bg-surface text-ink-faint hover:text-ink"
                    }`}
                  >
                    {status === "PENDING"
                      ? "Pendientes"
                      : status === "RESOLVED"
                      ? "Resueltos"
                      : status === "DISMISSED"
                      ? "Desestimados"
                      : "Todos"}
                  </button>
                ))}
              </div>

              <Button
                variant="ghost"
                onClick={() => void loadData()}
                disabled={loadingData}
                className="!text-xs !h-8"
              >
                <Icon icon="pixelarticons:reload" width={14} height={14} />
                Actualizar
              </Button>
            </div>

            {loadingData && (
              <div className="py-12 text-center text-xs text-ink-faint">Cargando reportes...</div>
            )}

            {!loadingData && reports.length === 0 && (
              <div className="border-2 border-subtle bg-statusbar/60 p-8 text-center flex flex-col items-center gap-2">
                <Icon icon="pixelarticons:check" width={32} height={32} className="text-success" />
                <span className="font-bold text-sm text-ink">Bandeja despejada</span>
                <span className="text-xs text-ink-faint">
                  No hay reportes en este estado en este momento.
                </span>
              </div>
            )}

            {!loadingData && reports.length > 0 && (
              <div className="flex flex-col gap-3">
                {reports.map((report) => {
                  const reasonInfo = REASON_LABELS[report.reason] || REASON_LABELS.OTHER;
                  const isPending = report.status === "PENDING";

                  return (
                    <div
                      key={report.id}
                      className="border border-subtle bg-surface p-4 sm:p-5 flex flex-col gap-3 shadow-sm hover:border-medium transition-colors"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold border ${reasonInfo.color}`}
                          >
                            <Icon icon={reasonInfo.icon} width={13} height={13} />
                            {reasonInfo.label}
                          </span>

                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold border ${
                              report.status === "PENDING"
                                ? "border-warning/40 bg-warning/15 text-warning"
                                : report.status === "RESOLVED"
                                ? "border-success/40 bg-success/15 text-success"
                                : "border-subtle bg-subtle text-ink-faint"
                            }`}
                          >
                            {report.status}
                          </span>
                        </div>

                        <span className="text-[11px] text-ink-faint">
                          {formatDate(report.createdAt)}
                        </span>
                      </div>

                      {/* Game & reporter info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs border-y border-subtle/60 py-2.5 my-0.5">
                        <div>
                          <span className="text-ink-faint">Juego denunciado: </span>
                          <a
                            href={`/juego/${report.gameSlug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-ink hover:text-accent underline"
                          >
                            {report.gameTitle}
                          </a>
                          {report.gameStatus === "BANNED" && (
                            <span className="ml-2 text-[10px] text-danger font-bold uppercase tracking-wider">
                              (RETIRADO)
                            </span>
                          )}
                        </div>

                        <div>
                          <span className="text-ink-faint">Reportado por: </span>
                          <span className="text-ink font-medium">
                            {report.reporterName || report.reporterEmail || "Usuario"}
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-semibold text-ink-soft">
                          Detalle del denunciante:
                        </span>
                        <p className="text-xs text-ink bg-app p-2.5 border border-subtle rounded-none whitespace-pre-wrap leading-relaxed">
                          {report.description}
                        </p>
                      </div>

                      {/* Admin notes if present */}
                      {report.adminNotes && (
                        <div className="text-[11px] text-ink-faint border-l-2 border-accent pl-2.5 py-0.5">
                          <span className="font-semibold text-ink-soft">Nota de resolución: </span>
                          <span>{report.adminNotes}</span>
                        </div>
                      )}

                      {/* Actions */}
                      {isPending && (
                        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-subtle">
                          <Button
                            variant="ghost"
                            onClick={() => void handleDismiss(report.id)}
                            disabled={submittingAction}
                            className="!h-8 !text-xs"
                          >
                            Desestimar
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => void handleResolve(report.id)}
                            disabled={submittingAction}
                            className="!h-8 !text-xs text-success hover:border-success"
                          >
                            Marcar Resuelto
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() =>
                              setTakedownTarget({ id: report.gameId, title: report.gameTitle })
                            }
                            disabled={submittingAction}
                            className="!h-8 !text-xs !text-danger !border-danger/60 hover:!bg-danger/10"
                          >
                            <Icon icon="pixelarticons:trash" width={14} height={14} />
                            Dar de baja juego
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: COMMUNITY GAMES */}
        {activeTab === "games" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Buscar por título, slug o autor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 text-xs bg-surface border border-subtle text-ink outline-none focus:border-accent"
                />
                <Icon
                  icon="pixelarticons:search"
                  width={16}
                  height={16}
                  className="absolute left-2.5 top-2.5 text-ink-faint"
                />
              </div>

              <Button
                variant="ghost"
                onClick={() => void loadData()}
                disabled={loadingData}
                className="!text-xs !h-9"
              >
                <Icon icon="pixelarticons:reload" width={14} height={14} />
              </Button>
            </div>

            {loadingData && (
              <div className="py-12 text-center text-xs text-ink-faint">Cargando catálogo...</div>
            )}

            {!loadingData && filteredGames.length === 0 && (
              <div className="border border-subtle bg-surface p-8 text-center text-xs text-ink-faint">
                No se encontraron juegos comunitarios.
              </div>
            )}

            {!loadingData && filteredGames.length > 0 && (
              <div className="flex flex-col gap-2">
                {filteredGames.map((game) => {
                  const isBanned = game.status === "BANNED";

                  return (
                    <div
                      key={game.id}
                      className="border border-subtle bg-surface p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs sm:text-sm text-ink truncate">
                            {game.title}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold border ${
                              isBanned
                                ? "border-danger/40 bg-danger/15 text-danger"
                                : game.isPublished
                                ? "border-success/40 bg-success/15 text-success"
                                : "border-subtle bg-subtle text-ink-faint"
                            }`}
                          >
                            {game.status}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-faint">
                          <span>Slug: {game.slug}</span>
                          <span>·</span>
                          <span>Autor: {game.author?.name || game.author?.email || "Anónimo"}</span>
                          {game.reportsCount > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-danger font-semibold">
                                {game.reportsCount} reporte(s)
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={`/juego/${game.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 text-xs text-ink-soft border border-subtle bg-statusbar hover:text-ink cursor-pointer"
                        >
                          Ver ficha
                        </a>

                        {isBanned ? (
                          <Button
                            variant="cta"
                            onClick={() => void handleRestore(game.id)}
                            disabled={submittingAction}
                            className="!h-8 !text-xs"
                          >
                            Restaurar
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() =>
                              setTakedownTarget({ id: game.id, title: game.title })
                            }
                            disabled={submittingAction}
                            className="!h-8 !text-xs !text-danger !border-danger/60 hover:!bg-danger/10"
                          >
                            Dar de baja
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Takedown Confirmation Modal */}
        {takedownTarget && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar baja del juego"
          >
            <div className="w-full max-w-md border-2 border-danger/60 bg-statusbar shadow-2xl p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2.5 text-danger">
                <Icon icon="pixelarticons:trash" width={24} height={24} />
                <h3 className="font-bold text-sm text-ink">Dar de baja por moderación</h3>
              </div>

              <p className="text-xs text-ink-soft leading-relaxed">
                ¿Estás seguro de que deseás retirar el juego{" "}
                <strong className="text-ink">&ldquo;{takedownTarget.title}&rdquo;</strong>?
                El juego quedará despublicado y en estado <span className="text-danger font-bold">BANNED</span>,
                impidiendo su acceso público y creación de mesas.
              </p>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="takedown-reason" className="text-xs font-medium text-ink-soft">
                  Motivo de la baja (visible para auditoría y denunciantes)
                </label>
                <input
                  id="takedown-reason"
                  type="text"
                  placeholder="Ej: Infracción confirmada de derechos de autor / DMCA"
                  value={takedownReason}
                  onChange={(e) => setTakedownReason(e.target.value)}
                  className="w-full h-8 px-2 text-xs bg-app border border-subtle text-ink outline-none focus:border-danger"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-subtle">
                <Button
                  variant="ghost"
                  onClick={() => setTakedownTarget(null)}
                  disabled={submittingAction}
                >
                  Cancelar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void confirmTakedown()}
                  disabled={submittingAction}
                  className="!text-danger !border-danger/60 hover:!bg-danger/10"
                >
                  {submittingAction ? "Retirando..." : "Confirmar baja"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
