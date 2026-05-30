/**
 * PATCH  /api/session/[sessionId]/cart/[itemId]  — update cart item
 * DELETE /api/session/[sessionId]/cart/[itemId]  — remove cart item
 */

import { getSession, getSessionIdFromCookie } from "@/lib/session";
import { getCart, updateCartItem, removeFromCart, calculateTotal } from "@/lib/cart";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import {
  emitCartItemUpdated,
  emitCartItemRemoved,
  type CartItemUpdatedPayload,
  type CartItemRemovedPayload,
} from "@/lib/socket-emitter";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

interface RouteParams {
  params: { sessionId: string; itemId: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared: validate session ownership + item ownership
// ─────────────────────────────────────────────────────────────────────────────

async function validateOwnership(
  sessionId: string,
  itemId: string,
  req: NextRequest
): Promise<
  | { error: NextResponse }
  | { session: NonNullable<Awaited<ReturnType<typeof getSession>>> }
> {
  const session = await getSession(sessionId);

  if (!session) {
    return {
      error: NextResponse.json(
        { error: "Session not found or expired." },
        { status: 404 }
      ),
    };
  }

  // Allow internal server-to-server requests
  const isInternal = req.headers.get("x-internal-request") === "true";
  if (isInternal) {
    return { session };
  }

  const cookieSessionId =
    req.cookies.get("sid")?.value ?? getSessionIdFromCookie();

  if (!cookieSessionId || cookieSessionId !== sessionId) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized: session cookie mismatch." },
        { status: 401 }
      ),
    };
  }

  // Ensure the cart item belongs to this session
  const cartItem = await db.cartItem.findFirst({
    where: { id: itemId, sessionId },
  });

  if (!cartItem) {
    return {
      error: NextResponse.json(
        { error: "Cart item not found." },
        { status: 404 }
      ),
    };
  }

  return { session };
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/session/[sessionId]/cart/[itemId]
// ─────────────────────────────────────────────────────────────────────────────

const UpdateCartItemSchema = z
  .object({
    quantity: z.number().int().min(1).max(20).optional(),
    specialInstructions: z.string().max(500).optional(),
  })
  .refine(
    (d) => d.quantity !== undefined || d.specialInstructions !== undefined,
    { message: "Provide at least one of quantity or specialInstructions." }
  );

export async function PATCH(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { sessionId, itemId } = params;
    const ownerResult = await validateOwnership(sessionId, itemId, req);

    if ("error" in ownerResult) return ownerResult.error;

    const body: unknown = await req.json();
    const parsed = UpdateCartItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid request body." },
        { status: 400 }
      );
    }

    const { quantity, specialInstructions } = parsed.data;
    const cartItem = await updateCartItem(itemId, quantity, specialInstructions);

    const items = await getCart(sessionId);
    const cart = { items, ...calculateTotal(items) };

    // ── Conflict detection ─────────────────────────────────────────────────
    // If two different clients write the same CartItem within 3s, flag it.
    const currentWriter = req.headers.get("x-display-name") 
      ? decodeURIComponent(req.headers.get("x-display-name")!) 
      : "unknown";

    const lastWriterKey = `cart:last_writer:${itemId}`;
    const lastWriter = await redis.get(lastWriterKey);
    
    let conflictResolved = false;
    if (lastWriter && lastWriter !== currentWriter && currentWriter !== "unknown") {
      conflictResolved = true;
    }
    
    await redis.set(lastWriterKey, currentWriter, "EX", 3);

    // Emit cart:item_updated to all room members via Redis adapter
    const payload: CartItemUpdatedPayload = {
      itemId,
      newQty: cartItem.quantity,
      cartTotal: cart.total,
      timestamp: new Date(),
      ...(conflictResolved && {
        conflictResolved: true,
        message: "Cart was updated by another user",
      }),
    };
    emitCartItemUpdated(ownerResult.session.tableId, payload);

    return NextResponse.json({ cartItem, cart });
  } catch (error) {
    console.error("[PATCH /api/session/[sessionId]/cart/[itemId]]", error);
    return NextResponse.json(
      { error: "Failed to update cart item." },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/session/[sessionId]/cart/[itemId]
// ─────────────────────────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { sessionId, itemId } = params;
    const ownerResult = await validateOwnership(sessionId, itemId, req);

    if ("error" in ownerResult) return ownerResult.error;

    await removeFromCart(itemId);

    const items = await getCart(sessionId);
    const cart = { items, ...calculateTotal(items) };

    // Emit cart:item_removed to all room members via Redis adapter
    const payload: CartItemRemovedPayload = {
      itemId,
      addedBy: "unknown",
      cartTotal: cart.total,
      timestamp: new Date(),
    };
    emitCartItemRemoved(ownerResult.session.tableId, payload);

    return NextResponse.json({ success: true, cart });
  } catch (error) {
    console.error("[DELETE /api/session/[sessionId]/cart/[itemId]]", error);
    return NextResponse.json(
      { error: "Failed to remove cart item." },
      { status: 500 }
    );
  }
}
