/**
 * POST /api/session/[sessionId]/ai/chat
 *
 * Forwards a user message to the FastAPI AI service and returns the response.
 * Rate limit: 20 req/min per sessionId (sliding window via Redis).
 *
 * Body:   { message: string (max 500 chars), addedBy?: string }
 * Response: { message: string, suggestions?: Suggestion[], action?: string }
 */

import { getSession } from "@/lib/session";
import { getCart, calculateTotal } from "@/lib/cart";
import { redis } from "@/lib/redis";
import { emitAiMessage } from "@/lib/socket-emitter";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

interface RouteParams {
  params: { sessionId: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Zod schema
// ─────────────────────────────────────────────────────────────────────────────

const ChatSchema = z.object({
  message: z
    .string()
    .min(1, "message is required.")
    .max(500, "message must not exceed 500 characters.")
    .transform((s) => s.replace(/<[^>]*>/g, "").trim()), // strip HTML tags
  addedBy: z.string().max(50).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Per-session rate limiting (20 req/min, sliding window via ioredis)
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_RATE_LIMIT = 20;
const SESSION_RATE_WINDOW_MS = 60 * 1000;

async function checkSessionRateLimit(sessionId: string): Promise<boolean> {
  const key = `ai_rl:${sessionId}`;
  const now = Date.now();
  const windowStart = now - SESSION_RATE_WINDOW_MS;

  await redis.zremrangebyscore(key, "-inf", String(windowStart));
  await redis.zadd(key, now, String(now));
  const count = await redis.zcard(key);
  await redis.expire(key, 120);

  return count <= SESSION_RATE_LIMIT;
}

// ─────────────────────────────────────────────────────────────────────────────
// Time-of-day helper
// ─────────────────────────────────────────────────────────────────────────────

function getTimeOfDay(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const hour = ist.getUTCHours();
  if (hour >= 6 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 19) return "evening";
  return "dinner";
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const steps: string[] = [];
  try {
    const { sessionId } = params;
    steps.push(`1. sessionId=${sessionId}`);

    // Validate session
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found or expired." },
        { status: 404 }
      );
    }
    steps.push(`2. session found, tableId=${session.tableId}`);

    // Cookie check
    const cookieSid = req.cookies.get("sid")?.value;
    if (!cookieSid || cookieSid !== sessionId) {
      console.error("[AI Chat] Cookie mismatch", { cookieSid, sessionId });
      return NextResponse.json(
        { error: "Unauthorized: session cookie mismatch." },
        { status: 401 }
      );
    }
    steps.push("3. cookie OK");

    // Per-session rate limit
    let allowed = true;
    try {
      allowed = await checkSessionRateLimit(sessionId);
    } catch (rlErr) {
      console.error("[AI Chat] Rate limit check failed, allowing:", rlErr);
      // Don't block on rate limit failure
    }
    if (!allowed) {
      return NextResponse.json(
        { error: "AI chat rate limit exceeded. Try again in a minute." },
        { status: 429 }
      );
    }
    steps.push("4. rate limit OK");

    // Parse body
    const body: unknown = await req.json();
    const parsed = ChatSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid request body." },
        { status: 400 }
      );
    }

    const { message, addedBy } = parsed.data;
    steps.push(`5. parsed message="${message.slice(0, 50)}"`);

    // Build cart summary for context
    let cartSummary: Record<string, unknown> = { itemCount: 0, items: [], subtotal: 0, total: 0 };
    try {
      const cartItems = await getCart(sessionId);
      const { subtotal, total } = calculateTotal(cartItems);
      cartSummary = {
        itemCount: cartItems.reduce((acc, i) => acc + i.quantity, 0),
        items: cartItems.map((i) => ({
          itemId: i.menuItemId,
          name: i.menuItem.name,
          qty: i.quantity,
          price: i.menuItem.price,
        })),
        subtotal,
        total,
      };
    } catch (cartErr) {
      console.error("[AI Chat] Cart fetch failed, using empty cart:", cartErr);
    }
    steps.push(`6. cart built, ${cartSummary.itemCount} items`);

    // Resolve AI service URL — never use localhost on production (Vercel serverless can't reach localhost)
    const configuredUrl = process.env.NEXT_PUBLIC_AI_SERVICE_URL || '';
    const isLocalhost = configuredUrl.includes('localhost') || configuredUrl.includes('127.0.0.1') || configuredUrl.includes('api.example.com');
    const aiServiceUrl = (!configuredUrl || isLocalhost)
      ? 'https://aryan012234-smart-dining-backend.hf.space'
      : configuredUrl;

    console.log("[AI Chat] Using backend URL:", aiServiceUrl, "configured:", configuredUrl);
    steps.push(`7. AI URL=${aiServiceUrl}`);

    // Emit user's message (non-blocking, don't crash if socket fails)
    try {
      emitAiMessage(session.tableId, {
        sender: "user",
        text: message,
        timestamp: new Date(),
      });
    } catch (emitErr) {
      console.error("[AI Chat] Socket emit failed (non-fatal):", emitErr);
    }
    steps.push("8. emit done");

    // Build preferences safely
    let prefs: Record<string, unknown> = {};
    try {
      if (typeof session.preferences === 'string') {
        prefs = JSON.parse(session.preferences || '{}');
      } else if (session.preferences && typeof session.preferences === 'object') {
        prefs = session.preferences as Record<string, unknown>;
      }
    } catch {
      prefs = {};
    }

    // Forward to FastAPI AI service
    const requestBody = {
      message,
      sessionId,
      tableId: session.tableId,
      preferences: prefs,
      cartSummary,
      timeOfDay: getTimeOfDay(),
    };
    steps.push(`9. sending to HF: ${JSON.stringify(requestBody).slice(0, 200)}`);

    const aiRes = await fetch(`${aiServiceUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(9000), // 9s timeout to stay within Vercel's 10s limit
    });

    steps.push(`10. HF responded status=${aiRes.status}`);

    if (!aiRes.ok) {
      const text = await aiRes.text();
      console.error("[AI service error]", aiRes.status, text, "Steps:", steps);
      return NextResponse.json(
        { error: `AI service error: ${aiRes.status}`, details: text.slice(0, 200), debug: steps },
        { status: 502 }
      );
    }

    const aiData: unknown = await aiRes.json();
    steps.push("11. response parsed OK");
    
    // Emit AI's message (non-blocking)
    try {
      if (aiData && typeof aiData === "object" && "message" in aiData) {
        emitAiMessage(session.tableId, {
          sender: "Zara",
          text: (aiData as { message: string }).message,
          timestamp: new Date(),
        });
      }
    } catch (emitErr) {
      console.error("[AI Chat] AI emit failed (non-fatal):", emitErr);
    }

    return NextResponse.json(aiData);
  } catch (error) {
    console.error("[POST /api/session/[sessionId]/ai/chat]", error, "Steps:", steps);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to process AI chat request: ${errMsg}`, debug: steps },
      { status: 500 }
    );
  }
}
