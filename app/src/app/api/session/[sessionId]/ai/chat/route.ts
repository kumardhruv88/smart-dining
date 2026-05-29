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
  try {
    const { sessionId } = params;

    // Validate session
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found or expired." },
        { status: 404 }
      );
    }

    // Cookie check
    const cookieSid = req.cookies.get("sid")?.value;
    if (!cookieSid || cookieSid !== sessionId) {
      return NextResponse.json(
        { error: "Unauthorized: session cookie mismatch." },
        { status: 401 }
      );
    }

    // Per-session rate limit
    const allowed = await checkSessionRateLimit(sessionId);
    if (!allowed) {
      return NextResponse.json(
        { error: "AI chat rate limit exceeded. Try again in a minute." },
        { status: 429 }
      );
    }

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

    // Build cart summary for context
    const cartItems = await getCart(sessionId);
    const { subtotal, total } = calculateTotal(cartItems);
    const cartSummary = {
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

    const aiServiceUrl = process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'https://kumardhruv88-smart-dining-ai.hf.space';
    if (!aiServiceUrl) {
      return NextResponse.json(
        { error: "AI service URL is not configured." },
        { status: 500 }
      );
    }

    // Emit user's message
    emitAiMessage(session.tableId, {
      sender: "user",
      text: message,
      timestamp: new Date(),
    });

    // Forward to FastAPI AI service
    const aiRes = await fetch(`${aiServiceUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        sessionId,
        tableId: session.tableId,
        preferences: session.preferences,
        cartSummary,
        timeOfDay: getTimeOfDay(),
        addedBy,
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      console.error("[AI service error]", aiRes.status, text);
      return NextResponse.json(
        { error: "AI service returned an error." },
        { status: 502 }
      );
    }

    const aiData: unknown = await aiRes.json();
    
    // Emit AI's message
    if (aiData && typeof aiData === "object" && "message" in aiData) {
      emitAiMessage(session.tableId, {
        sender: "Zara",
        text: (aiData as { message: string }).message,
        timestamp: new Date(),
      });
    }

    return NextResponse.json(aiData);
  } catch (error) {
    console.error("[POST /api/session/[sessionId]/ai/chat]", error);
    return NextResponse.json(
      { error: "Failed to process AI chat request." },
      { status: 500 }
    );
  }
}
