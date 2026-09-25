"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@iconify/react";
import Button from "@/components/Button";
import { ApiError } from "@/lib/api/http";
import { useSession } from "@/lib/session/use-session";

export type AuthTab = "login" | "register";

function authErrorMessage(err: unknown, tab: AuthTab): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Usuario o clave incorrectos.";
    if (err.status === 409) return "Ese email ya está registrado.";
    if (err.status === 400) {
      return tab === "register"
        ? "Revisá el email y usá una clave de al menos 6 caracteres."
        : "Ingresá un usuario o email válido.";
    }
    if (err.status === 503) return "El servidor no está disponible. Intentá más tarde.";
    return "No se pudo completar la operación.";
  }
  return err instanceof Error ? err.message : "Error inesperado.";
}

export function AuthForm({
  initialTab = "login",
  onSuccess,
}: {
  initialTab?: AuthTab;
  onSuccess?: () => void;
}) {
  const { login, register } = useSession();
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function switchTab(next: AuthTab) {
    setTab(next);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const trimmedId = identifier.trim();
    if (!trimmedId) {
      setError(tab === "login" ? "Ingresá tu usuario o email." : "Ingresá tu email.");
      return;
    }
    if (tab === "register" && password.length < 6) {
      setError("La clave debe tener al menos 6 caracteres.");
      return;
    }
    if (!password) {
      setError("Ingresá tu clave.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      if (tab === "login") {
        await login(trimmedId, password);
      } else {
        await register(trimmedId, password, name.trim() || undefined);
      }
      onSuccess?.();
    } catch (err) {
      setError(authErrorMessage(err, tab));
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    "h-11 w-full rounded border border-subtle bg-app/60 text-ink text-sm px-3 focus:outline-none focus:border-accent";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-1 rounded-[6px] border-2 border-subtle bg-app/60 p-1">
        {(["login", "register"] as AuthTab[]).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => switchTab(t)}
              className={`flex items-center justify-center gap-2 rounded-[4px] px-3 py-2 text-[13px] font-bold transition-colors duration-150 cursor-pointer ${
                active
                  ? "bg-accent text-[#171a35] shadow-[0_0_14px_rgba(255,210,63,0.4)]"
                  : "text-ink-faint hover:text-ink"
              }`}
            >
              <Icon
                icon={t === "login" ? "pixelarticons:login" : "pixelarticons:user-plus"}
                width={16}
                height={16}
              />
              {t === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-[13px] text-ink-soft">
          {tab === "login" ? "Usuario o email" : "Email"}
          <input
            type={tab === "login" ? "text" : "email"}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete={tab === "login" ? "username" : "email"}
            placeholder={tab === "login" ? "tu usuario o tu@email.com" : "tu@email.com"}
            className={inputClass}
          />
        </label>

        {tab === "register" && (
          <label className="flex flex-col gap-1.5 text-[13px] text-ink-soft">
            Nombre <span className="text-ink-faint">(opcional)</span>
            <input
              type="text"
              value={name}
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
              autoComplete="nickname"
              placeholder="¿Cómo te van a ver los demás?"
              className={inputClass}
            />
          </label>
        )}

        <label className="flex flex-col gap-1.5 text-[13px] text-ink-soft">
          Clave
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={tab === "login" ? "current-password" : "new-password"}
            placeholder={tab === "register" ? "Mínimo 6 caracteres" : "••••••••"}
            className={inputClass}
          />
        </label>

        {error && (
          <div className="flex items-center gap-1.5 text-[12px] text-danger">
            <Icon icon="pixelarticons:alert" width={14} height={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          fullWidth
          disabled={isSubmitting}
          className="!h-11 !text-sm"
        >
          <Icon
            icon={tab === "login" ? "pixelarticons:login" : "pixelarticons:user-plus"}
            width={16}
            height={16}
          />
          {isSubmitting
            ? tab === "login"
              ? "Ingresando..."
              : "Creando cuenta..."
            : tab === "login"
              ? "Entrar"
              : "Registrarme"}
        </Button>
      </form>
    </div>
  );
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
  initialTab?: AuthTab;
  onSuccess?: () => void;
}

export default function AuthModal({
  isOpen,
  onClose,
  message,
  initialTab = "login",
  onSuccess,
}: AuthModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Iniciar sesión o registrarse"
    >
      <div className="flex flex-col w-full max-w-md rounded-2xl border border-subtle bg-statusbar shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-subtle bg-surface">
          <div className="flex items-center gap-2.5">
            <Icon icon="pixelarticons:lock" width={20} height={20} className="text-accent" />
            <h3 className="text-sm font-bold text-ink">Jugador registrado</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-subtle text-ink-faint hover:text-ink cursor-pointer"
          >
            <Icon icon="pixelarticons:close" width={18} height={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          {message && (
            <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-ink-soft">
              <Icon
                icon="pixelarticons:info-box"
                width={16}
                height={16}
                className="shrink-0 text-warning mt-0.5"
              />
              <span>{message}</span>
            </div>
          )}

          <AuthForm
            initialTab={initialTab}
            onSuccess={() => {
              onSuccess?.();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
