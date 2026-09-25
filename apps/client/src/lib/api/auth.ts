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

export async function createGuestUser(name?: string): Promise<GuestUser> {
  const data = await http.post<unknown>("/api/auth/guest", name ? { name } : undefined);
  return createGuestResponseSchema.parse(data).user;
}

export async function updateUserName(
  id: string,
  name: string,
): Promise<Pick<GuestUser, "id" | "name" | "isAnonymous">> {
  const res = await fetch(`/api/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed to update user name");
  const data = await res.json();
  return updateUserResponseSchema.parse(data).user;
}
