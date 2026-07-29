import { randomUUID } from "node:crypto";
import { OAuth2Client } from "google-auth-library";

const ALLOWED_DOMAIN = "gr0.com";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export interface SessionUser {
  email: string;
  name: string;
  picture: string;
}

interface Session extends SessionUser {
  expiresAt: number;
}

const sessions = new Map<string, Session>();

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now >= session.expiresAt) sessions.delete(id);
  }
}

setInterval(cleanupExpiredSessions, SESSION_CLEANUP_INTERVAL_MS);

/**
 * Verifies a Google Identity Services ID token and enforces that the signed-in
 * account belongs to the gr0.com Workspace domain. Throws if the token is
 * invalid/expired or the account isn't a gr0.com address.
 */
export async function verifyGoogleToken(
  idToken: string,
  clientId: string
): Promise<SessionUser> {
  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({ idToken, audience: clientId });
  const payload = ticket.getPayload();

  if (!payload || !payload.email) {
    throw new Error("Google token did not include an email address");
  }
  if (!payload.email_verified) {
    throw new Error("Google account email is not verified");
  }

  const email = payload.email.toLowerCase();
  const isGr0Domain = payload.hd === ALLOWED_DOMAIN || email.endsWith(`@${ALLOWED_DOMAIN}`);
  if (!isGr0Domain) {
    throw new Error(`Only @${ALLOWED_DOMAIN} accounts are allowed to sign in`);
  }

  return {
    email,
    name: payload.name ?? email,
    picture: payload.picture ?? "",
  };
}

export function createSession(user: SessionUser): string {
  const id = randomUUID();
  sessions.set(id, { ...user, expiresAt: Date.now() + SESSION_TTL_MS });
  return id;
}

export function getSession(id: string): SessionUser | null {
  const session = sessions.get(id);
  if (!session) return null;
  if (Date.now() >= session.expiresAt) {
    sessions.delete(id);
    return null;
  }
  const { expiresAt: _expiresAt, ...user } = session;
  return user;
}

export function destroySession(id: string): void {
  sessions.delete(id);
}
