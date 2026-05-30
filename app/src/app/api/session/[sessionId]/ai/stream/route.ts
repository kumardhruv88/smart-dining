/**
 * GET /api/session/[sessionId]/ai/stream
 *
 * SSE endpoint that pipes the AI service's streaming response to the client.
 * Query param: message (string)
 *
 * Headers set:
 *   Content-Type: text/event-stream
 *   Cache-Control: no-cache
 *   X-Accel-Buffering: no
 */

import { getSession } from "@/lib/session";
import { getCart, calculateTotal } from "@/lib/cart";
import { type NextRequest, NextResponse } from "next/server";

// Opt out of static generation — this is a streaming route
export const dynamic = "force-dynamic";

interface RouteParams {
  params: { sessionId: string };
}

function getTimeOfDay(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const hour = ist.getUTCHours();
  if (hour >= 6 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 19) return "evening";
  return "dinner";
}

export async function GET(
  req: NextRequest,
  { params }: RouteParams
): Promise<Response | NextResponse> {
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

    const { searchParams } = new URL(req.url);
    const message = searchParams.get("message")?.trim();

    if (!message) {
      return NextResponse.json(
        { error: "message query param is required." },
        { status: 400 }
      );
    }

    // Sanitize
    const cleanMessage = message.replace(/<[^>]*>/g, "").slice(0, 500);

    // Resolve AI service URL — never use localhost on production
    const configuredUrl = process.env.NEXT_PUBLIC_AI_SERVICE_URL || '';
    const isLocalhost = configuredUrl.includes('localhost') || configuredUrl.includes('127.0.0.1') || configuredUrl.includes('api.example.com');
    const aiServiceUrl = (!configuredUrl || isLocalhost)
      ? 'https://aryan012234-smart-dining-backend.hf.space'
      : configuredUrl;

    // Build cart summary
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

    // Forward to FastAPI stream endpoint
    const upstreamUrl = new URL(`${aiServiceUrl}/stream`);
    upstreamUrl.searchParams.set("message", cleanMessage);
    upstreamUrl.searchParams.set("sessionId", sessionId);
    upstreamUrl.searchParams.set("tableId", session.tableId);
    upstreamUrl.searchParams.set("timeOfDay", getTimeOfDay());
    upstreamUrl.searchParams.set("cartSummary", JSON.stringify(cartSummary));
    upstreamUrl.searchParams.set(
      "preferences",
      JSON.stringify(session.preferences)
    );

    const upstream = await fetch(upstreamUrl.toString(), {
      headers: { Accept: "text/event-stream" },
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: "AI stream service unavailable." },
        { status: 502 }
      );
    }

    // Pipe the SSE stream back to the client
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[GET /api/session/[sessionId]/ai/stream]", error);
    return NextResponse.json(
      { error: "Failed to establish AI stream." },
      { status: 500 }
    );
  }
}
