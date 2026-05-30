/**
 * src/middleware.ts
 *
 * Next.js Edge Middleware — runs before every matched request.
 *
 * Responsibilities:
 *  1. CORS — allow requests only from NEXT_PUBLIC_APP_URL
 *  2. Rate limiting — 60 req/min per IP using Redis sliding-window (ioredis)
 *     NOTE: Edge middleware cannot use ioredis (Node.js runtime).
 *           Rate limiting is implemented here via the fetch() API against
 *           Upstash Redis REST API, which works in the Edge runtime.
 *           Falls back to allowing the request if REDIS_URL is not set.
 *  3. Header forwarding — attach X-Table-Id and X-Session-Id to request context
 */

import { type NextRequest, NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// Config — which paths does middleware run on?
// ─────────────────────────────────────────────────────────────────────────────

export const config = {
  matcher: ["/api/:path*"],
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 60 seconds
const RATE_LIMIT_MAX = 60; // requests per window

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function getAllowedOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "";
}

function buildCorsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Table-Id, X-Session-Id",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Upstash Redis REST rate limiting (Edge-compatible)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sliding-window rate limiting using Upstash Redis REST API.
 * Returns true if the request is allowed, false if rate-limited.
 *
 * Uses a sorted set keyed by "rl:{ip}" where member = timestamp and score = timestamp.
 * Removes members older than the window, then counts remaining.
 */
async function checkRateLimit(ip: string): Promise<boolean> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  // If Upstash REST env vars not configured, fall back gracefully
  if (!redisUrl || !redisToken) {
    return true;
  }

  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const key = `rl:${ip}`;

  const pipeline = [
    ["ZREMRANGEBYSCORE", key, "-inf", String(windowStart)],
    ["ZADD", key, String(now), String(now)],
    ["ZCARD", key],
    ["EXPIRE", key, "120"],
  ];

  try {
    const res = await fetch(`${redisUrl}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pipeline),
    });

    if (!res.ok) return true; // allow on Redis failure

    const data = (await res.json()) as Array<{ result: unknown }>;
    const count = data[2]?.result;

    return typeof count === "number" ? count <= RATE_LIMIT_MAX : true;
  } catch {
    // Never block requests due to Redis unavailability
    return true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main middleware
// ─────────────────────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const allowedOrigin = getAllowedOrigin();
  const requestOrigin = req.headers.get("origin") ?? "";
  const corsHeaders = buildCorsHeaders(allowedOrigin);

  // ── Preflight (OPTIONS) ───────────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }

  // ── CORS check ────────────────────────────────────────────────────────────
  // Only enforce origin check if NEXT_PUBLIC_APP_URL is configured and the
  // request carries an Origin header (browser requests do; curl/server don't).
  if (
    allowedOrigin &&
    requestOrigin &&
    requestOrigin !== allowedOrigin
  ) {
    return NextResponse.json(
      { error: "CORS: origin not allowed" },
      { status: 403, headers: corsHeaders }
    );
  }

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const ip = getClientIp(req);
  const allowed = await checkRateLimit(ip);

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Retry-After": "60",
          "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
          "X-RateLimit-Window": "60",
        },
      }
    );
  }

  // ── Forward context headers ───────────────────────────────────────────────
  const requestHeaders = new Headers(req.headers);

  const tableId = req.headers.get("x-table-id");
  const sessionId = req.headers.get("x-session-id");

  if (tableId) requestHeaders.set("x-table-id", tableId);
  if (sessionId) requestHeaders.set("x-session-id", sessionId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Attach CORS headers to all successful responses
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}
