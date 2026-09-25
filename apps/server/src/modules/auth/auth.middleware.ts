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