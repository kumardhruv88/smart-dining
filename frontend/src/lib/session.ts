/**
 * src/lib/session.ts
 *
 * Session management utilities for the Smart Dining App.
 * - createSession: creates a new Session in the DB (expiresAt = now + 4h)
 * - getSession:    fetches a Session from DB, returns null if expired
 * - Cookie name:   "sid" (HttpOnly, SameSite=Lax)
 */

import { db } from "@/lib/db";
import { type Session } from "@prisma/client";
import { cookies } from "next/headers";

/** Session duration: 4 hours in milliseconds */
const SESSION_TTL_MS = 4 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Core session helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a new ACTIVE session for the given table and persists it to the DB.
 * Sets expiresAt = now + 4 hours.
 */
export async function createSession(tableId: string): Promise<Session> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const session = await db.session.create({
    data: {
      tableId,
      expiresAt,
    },
  });

  return session;
}

/**
 * Fetches an existing session by ID.
 * Returns null if the session does not exist or has expired.
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  const session = await db.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) return null;

  // Treat expired sessions as if they don't exist
  if (session.expiresAt < new Date()) return null;

  return session;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cookie helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Name of the HttpOnly cookie that stores the session ID. */
export const SESSION_COOKIE_NAME = "sid";

/**
 * Reads the current session ID from the "sid" HttpOnly cookie.
 * Returns null if no cookie is present.
 */
export function getSessionIdFromCookie(): string | null {
  const cookieStore = cookies();
  const sid = cookieStore.get(SESSION_COOKIE_NAME);
  return sid?.value ?? null;
}

/**
 * Returns a Set-Cookie header value string for the "sid" cookie.
 * Used in API route responses (cannot call cookies().set() in Route Handlers
 * directly when streaming; use NextResponse headers instead).
 */
export function buildSessionCookieHeader(sessionId: string): string {
  const maxAge = SESSION_TTL_MS / 1000; // seconds
  const parts = [
    `${SESSION_COOKIE_NAME}=${sessionId}`,
    `Max-Age=${maxAge}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
}
