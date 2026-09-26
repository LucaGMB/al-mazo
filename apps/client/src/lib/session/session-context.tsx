"use client";

import { createContext, useCallback, useEffect, useState, type ReactNode } from "react";
import {
  createGuestUser,
  loginUser,
  registerUser,
  updateUserName,
  type AuthUser,
} from "@/lib/api/auth";
import type { GuestUser } from "@/types/api";

const GUEST_STORAGE_KEY = "almazo.guestUser";
const TOKEN_STORAGE_KEY = "almazo.token";
const AUTH_USER_STORAGE_KEY = "almazo.authUser";

export interface SessionUser {
  id: string;
  name: string;
  isAnonymous: boolean;
  email?: string;
  role?: string;
}

interface SessionContextValue {
  user: SessionUser | null;
  token: string | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  createGuest: (name?: string) => Promise<GuestUser>;
  updateName: (name: string) => Promise<void>;
  clearGuest: () => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function readStoredGuest(): GuestUser | null {
  return readJson<GuestUser>(GUEST_STORAGE_KEY);
}

function persistAuth(user: AuthUser, token: string) {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
  window.localStorage.removeItem(GUEST_STORAGE_KEY);
}

// No creamos un guest automáticamente al cargar la app: recién se genera uno
// cuando hace falta un nombre para crear/unirse a una sala. Así evitamos
// registrar un usuario en la base por cada visita anónima al catálogo.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Hidratación intencional post-mount: localStorage no existe en el
    // render de servidor, así que el primer render siempre es user=null acá
    // (coincide con SSR) y recién after-mount leemos el valor real. No hay
    // forma de derivar esto sin un efecto (no es estado de React a
    // sincronizar, es lectura de un storage externo al montar).
    let nextToken: string | null = null;
    let nextUser: SessionUser | null = null;

    if (typeof window !== "undefined") {
      const storedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
      const storedAuth = readJson<AuthUser>(AUTH_USER_STORAGE_KEY);
      if (storedToken && storedAuth) {
        nextToken = storedToken;
        nextUser = storedAuth;
      } else {
        nextUser = readStoredGuest();
      }
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(nextToken);
    setUser(nextUser);
    setIsLoading(false);
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const session = await loginUser(identifier, password);
    persistAuth(session.user, session.token);
    setToken(session.token);
    setUser(session.user);
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const session = await registerUser(email, password, name);
    persistAuth(session.user, session.token);
    setToken(session.token);
    setUser(session.user);
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    setToken(null);
    setUser(readStoredGuest());
  }, []);

  const createGuest = useCallback(async (name?: string) => {
    const guest = await createGuestUser(name);
    window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guest));
    setUser(guest);
    setToken(null);
    return guest;
  }, []);

  const updateName = useCallback(
    async (name: string) => {
      if (!user) return;
      const next = { ...user, name };
      const key = user.isAnonymous ? GUEST_STORAGE_KEY : AUTH_USER_STORAGE_KEY;
      window.localStorage.setItem(key, JSON.stringify(next));
      setUser(next);
      await updateUserName(user.id, name);
    },
    [user],
  );

  const clearGuest = useCallback(() => {
    window.localStorage.removeItem(GUEST_STORAGE_KEY);
    setUser(null);
    setToken(null);
  }, []);

  const isLoggedIn = user !== null && !user.isAnonymous && Boolean(token);

  return (
    <SessionContext.Provider
      value={{
        user,
        token,
        isLoggedIn,
        isLoading,
        login,
        register,
        logout,
        createGuest,
        updateName,
        clearGuest,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
