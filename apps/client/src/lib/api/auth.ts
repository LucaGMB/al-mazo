import { z } from "zod";
import { http } from "./http";
import type { GuestUser } from "@/types/api";

const guestUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  isAnonymous: z.boolean(),
  createdAt: z.string(),
});

const createGuestResponseSchema = z.object({ user: guestUserSchema });

const updateUserResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    isAnonymous: z.boolean(),
  }),
});

const authUserSchema = z.object({
  id: z.string(),
  email: z.string().nullish().transform((value) => value ?? ""),
  name: z.string(),
  role: z.string(),
  // El server no envía isAnonymous en /login y /register: todo usuario con
  // credenciales es registrado, nunca invitado.
  isAnonymous: z.boolean().optional().default(false),
});

const authResponseSchema = z.object({
  user: authUserSchema,
  token: z.string(),
});

export type AuthUser = z.infer<typeof authUserSchema>;

export interface AuthSession {
  user: AuthUser;
  token: string;
}

export async function loginUser(identifier: string, password: string): Promise<AuthSession> {
  const data = await http.post<unknown>("/api/auth/login", {
    username: identifier,
    password,
  });
  return authResponseSchema.parse(data);
}

export async function registerUser(
  email: string,
  password: string,
  name?: string,
): Promise<AuthSession> {
  const data = await http.post<unknown>("/api/auth/register", { email, password, name });
  return authResponseSchema.parse(data);
}

export async function createGuestUser(name?: string): Promise<GuestUser> {
  const data = await http.post<unknown>("/api/auth/guest", name ? { name } : undefined);
  return createGuestResponseSchema.parse(data).user;
}

export async function updateUserName(
  id: string,
  name: string,
): Promise<Pick<GuestUser, "id" | "name" | "isAnonymous">> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const res = await fetch(`${baseUrl}/api/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed to update user name");
  const data = await res.json();
  return updateUserResponseSchema.parse(data).user;
}
