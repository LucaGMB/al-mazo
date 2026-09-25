"use client";

import { createContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { createGuestUser, updateUserName } from "@/lib/api/auth";
import type { GuestUser } from "@/types/api";

const STORAGE_KEY = "almazo.guestUser";

interface SessionContextValue {
  user: GuestUser | null;
  isLoading: boolean;
  createGuest: (name?: string) => Promise<GuestUser>;
  updateName: (name: string) => Promise<void>;
  clearGuest: () => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

function readStoredUser(): GuestUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GuestUser) : null;
  } catch {
    return null;
  }
}

// No creamos un guest automáticamente al cargar la app: recién se genera uno
// cuando hace falta un nombre para crear/unirse a una sala. Así evitamos
// registrar un usuario en la base por cada visita anónima al catálogo.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GuestUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Hidratación intencional post-mount: localStorage no existe en el
    // render de servidor, así que el primer render siempre es user=null acá
    // (coincide con SSR) y recién after-mount leemos el valor real. No hay
    // forma de derivar esto sin un efecto (no es estado de React a
    // sincronizar, es lectura de un storage externo al montar).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(readStoredUser());
    setIsLoading(false);
  }, []);

  const createGuest = useCallback(async (name?: string) => {
    const guest = await createGuestUser(name);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(guest));
    setUser(guest);
    return guest;
  }, []);

  const updateName = useCallback(
    async (name: string) => {
      if (!user) return;
      const next = { ...user, name };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setUser(next);
      await updateUserName(user.id, name);
    },
    [user],
  );

  const clearGuest = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  return (
    <SessionContext.Provider value={{ user, isLoading, createGuest, updateName, clearGuest }}>
      {children}
    </SessionContext.Provider>
  );
}
