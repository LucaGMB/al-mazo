import { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';

export const AUTH_SECRET = process.env.AUTH_SECRET || 'al-mazo-jwt-secret-key-2026';

export interface AuthPayload {
  userId: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthPayload;
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, AUTH_SECRET, { expiresIn: '7d' });
}

export function getAdminEmails(): Set<string> {
  const envEmails = process.env.ADMIN_EMAILS || '';
  return new Set(
    envEmails
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return getAdminEmails().has(email.trim().toLowerCase());
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
  }

  try {
    const decoded = jwt.verify(header.slice(7), AUTH_SECRET) as AuthPayload;
    request.user = { userId: decoded.userId, role: decoded.role };
  } catch {
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    await authenticate(request, reply);
    if (reply.sent) return;
  }

  if (request.user?.role !== 'ADMIN') {
    return reply.status(403).send({ error: 'Acceso restringido: requiere rol de Administrador' });
  }
}