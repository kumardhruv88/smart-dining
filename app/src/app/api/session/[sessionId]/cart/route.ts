/**
 * GET  /api/session/[sessionId]/cart  — fetch cart with totals
 * POST /api/session/[sessionId]/cart  — add item to cart
 *
 * // Force editor TS server revalidation
 */

import { getSession, getSessionIdFromCookie } from "@/lib/session";
import { getCart, addToCart, calculateTotal, updateCartItem, removeFromCart } from "@/lib/cart";
import { db } from "@/lib/db";
import {
  emitCartItemAdded,
  type CartItemAddedPayload,
} from "@/lib/socket-emitter";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

interface RouteParams {
  params: { sessionId: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared: validate session ownership
// ─────────────────────────────────────────────────────────────────────────────

async function validateSessionOwnership(
  sessionId: string,
  req: NextRequest
): Promise<{ error: NextResponse } | { session: NonNullable<Awaited<ReturnType<typeof getSession>>> }> {
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

  // Verify cookie ownership
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

  return { session };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/session/[sessionId]/cart
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { sessionId } = params;
    const result = await validateSessionOwnership(sessionId, req);

    if ("error" in result) return result.error;

    const cartItems = await db.cartItem.findMany({
      where: { sessionId },
      include: { menuItem: true }
    });

    const subtotal = cartItems.reduce((sum, item) => {
      return sum + (Number(item.menuItem.price) * item.quantity)
    }, 0);

    const isFood = (category: string) => 
      !category.toLowerCase().includes('beverage');

    const gst = cartItems.reduce((sum, item) => {
      const price = Number(item.menuItem.price) * item.quantity;
      const rate = isFood(item.menuItem.category) ? 0.12 : 0.05;
      return sum + (price * rate);
    }, 0);

    const total = subtotal + gst;

    return NextResponse.json({
      items: cartItems.map(item => ({
        id: item.id,
        quantity: item.quantity,
        specialInstructions: item.specialInstructions,
        addedBy: item.addedBy,
        menuItem: {
          id: item.menuItem.id,
          name: item.menuItem.name,
          price: Number(item.menuItem.price),
          imageUrl: item.menuItem.imageUrl,
          category: item.menuItem.category,
          tags: item.menuItem.tags,
        }
      })),
      subtotal: subtotal,
      gst: gst,
      total: total
    });
  } catch (error) {
    console.error("[GET /api/session/[sessionId]/cart]", error);
    return NextResponse.json(
      { error: "Failed to fetch cart." },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/session/[sessionId]/cart
// ─────────────────────────────────────────────────────────────────────────────

const AddToCartSchema = z.object({
  menuItemId: z.string().min(1, "menuItemId is required."),
  quantity: z.number().int().min(1, "quantity must be at least 1.").max(20),
  addedBy: z.string().min(1).max(50),
});

export async function POST(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { sessionId } = params;
    const body: unknown = await req.json();
    const parsed = AddToCartSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid request body." },
        { status: 400 }
      );
    }

    const { menuItemId, quantity, addedBy } = parsed.data;

    // Check availability
    const menuItem = await db.menuItem.findUnique({
      where: { id: menuItemId },
    });

    if (!menuItem) {
      return NextResponse.json(
        { error: "Menu item not found." },
        { status: 404 }
      );
    }

    if (!menuItem.available) {
      return NextResponse.json(
        { error: "Item is currently unavailable." },
        { status: 400 }
      );
    }

    const cartItem = await db.cartItem.upsert({
      where: {
        sessionId_menuItemId: {
          sessionId,
          menuItemId,
        },
      },
      update: {
        quantity: { increment: quantity },
      },
      create: {
        sessionId,
        menuItemId,
        quantity,
        addedBy,
      },
      include: { menuItem: true },
    });

    // Fetch updated cart totals to emit socket event
    const items = await getCart(sessionId);
    const totals = calculateTotal(items);

    const payload: CartItemAddedPayload = {
      itemId: cartItem.id,
      name: cartItem.menuItem.name,
      qty: cartItem.quantity,
      addedBy: cartItem.addedBy,
      cartTotal: totals.total,
      timestamp: new Date(),
    };

    const sessionRecord = await getSession(sessionId);
    if (sessionRecord) {
      emitCartItemAdded(sessionRecord.tableId, payload);
    }

    return NextResponse.json({
      success: true,
      cartItem: {
        ...cartItem,
        menuItem: {
          ...cartItem.menuItem,
          price: Number(cartItem.menuItem.price),
        },
      },
      cart: { items, ...totals },
    });
  } catch (error) {
    console.error("[CART POST ERROR]", error);
    return NextResponse.json(
      { error: "Failed to add item to cart." },
      { status: 500 }
    );
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/session/[sessionId]/cart
// ─────────────────────────────────────────────────────────────────────────────

const UpdateCartSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
});

export async function PATCH(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { sessionId } = params;
    const result = await validateSessionOwnership(sessionId, req);

    if ("error" in result) return result.error;

    const body: unknown = await req.json();
    const parsed = UpdateCartSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid request body." },
        { status: 400 }
      );
    }

    const { itemId, quantity } = parsed.data;

    const cartItem = await updateCartItem(itemId, quantity);
    const items = await getCart(sessionId);
    const totals = calculateTotal(items);

    return NextResponse.json(
      { cartItem, cart: { items, ...totals } },
      { status: 200 }
    );
  } catch (error) {
    console.error("[PATCH /api/session/[sessionId]/cart]", error);
    return NextResponse.json(
      { error: "Failed to update cart item." },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/session/[sessionId]/cart
// ─────────────────────────────────────────────────────────────────────────────

const DeleteCartSchema = z.object({
  itemId: z.string().min(1),
});

export async function DELETE(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { sessionId } = params;
    const result = await validateSessionOwnership(sessionId, req);

    if ("error" in result) return result.error;

    const body: unknown = await req.json();
    const parsed = DeleteCartSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid request body." },
        { status: 400 }
      );
    }

    const { itemId } = parsed.data;

    await removeFromCart(itemId);
    const items = await getCart(sessionId);
    const totals = calculateTotal(items);

    return NextResponse.json(
      { success: true, cart: { items, ...totals } },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DELETE /api/session/[sessionId]/cart]", error);
    return NextResponse.json(
      { error: "Failed to delete cart item." },
      { status: 500 }
    );
  }
}
