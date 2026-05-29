/**
 * POST /api/session/[sessionId]/order
 *
 * Places an order for the current session.
 *
 * Flow:
 *  1. Validate JWT verificationToken (issued by /api/otp/verify)
 *  2. Fetch and validate cart (must be non-empty)
 *  3. Call FastAPI /validate-order for Order Validation Agent check
 *  4. Create Order + OrderItems in DB
 *  5. Clear cart (delete all CartItems for session)
 *  6. Update session status to ORDERED
 *  7. Increment popularScore (+0.01) for each ordered MenuItem
 *  8. Emit order:placed via Redis pub/sub
 *
 * Body:     { customerName: string, customerPhone: string, verificationToken: string }
 * Response: { orderId, status, estimatedWait, items, total, tax }
 */

import { getSession } from "@/lib/session";
import { getCart, calculateTotal } from "@/lib/cart";
import { db } from "@/lib/db";
import { emitOrderPlaced } from "@/lib/socket-emitter";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jwtVerify } from "jose";
import { Decimal } from "@prisma/client/runtime/library";

interface RouteParams {
  params: { sessionId: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

const OrderSchema = z.object({
  customerName: z.string().min(1).max(100),
  customerPhone: z
    .string()
    .regex(/^\+?[1-9]\d{9,14}$/, "Invalid phone number format."),
  verificationToken: z.string().min(1, "verificationToken is required."),
});

// ─────────────────────────────────────────────────────────────────────────────
// JWT verification
// ─────────────────────────────────────────────────────────────────────────────

async function verifyToken(
  token: string,
  expectedPhone: string
): Promise<boolean> {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured.");

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );
    return (
      payload["purpose"] === "otp_verified" &&
      payload["phone"] === expectedPhone
    );
  } catch {
    return false;
  }
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

    // 1. Validate session
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found or expired." },
        { status: 404 }
      );
    }

    const cookieSid = req.cookies.get("sid")?.value;
    if (!cookieSid || cookieSid !== sessionId) {
      return NextResponse.json(
        { error: "Unauthorized: session cookie mismatch." },
        { status: 401 }
      );
    }

    if (session.status === "ORDERED") {
      return NextResponse.json(
        { error: "An order has already been placed for this session." },
        { status: 400 }
      );
    }

    // 2. Parse and validate body
    const body: unknown = await req.json();
    const parsed = OrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid request body." },
        { status: 400 }
      );
    }

    const { customerName, customerPhone, verificationToken } = parsed.data;

    // 3. Validate JWT verification token
    const tokenValid = await verifyToken(verificationToken, customerPhone);
    if (!tokenValid) {
      return NextResponse.json(
        { error: "Invalid or expired verification token." },
        { status: 401 }
      );
    }

    // 4. Fetch cart
    const cartItems = await getCart(sessionId);
    if (cartItems.length === 0) {
      return NextResponse.json(
        { error: "Cart is empty. Add items before placing an order." },
        { status: 400 }
      );
    }

    const { subtotal, gst, total } = calculateTotal(cartItems);

    // 5. Call FastAPI Order Validation Agent
    const aiServiceUrl = process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'https://kumardhruv88-smart-dining-ai.hf.space';
    if (aiServiceUrl) {
      try {
        const validationRes = await fetch(`${aiServiceUrl}/validate-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            tableId: session.tableId,
            cartItems: cartItems.map((i) => ({
              menuItemId: i.menuItemId,
              name: i.menuItem.name,
              quantity: i.quantity,
              price: new Decimal(i.menuItem.price).toNumber(),
              specialInstructions: i.specialInstructions,
            })),
            total,
            preferences: session.preferences,
          }),
        });

        if (!validationRes.ok) {
          const errData = (await validationRes.json().catch(() => ({}))) as {
            detail?: string;
          };
          return NextResponse.json(
            {
              error:
                errData.detail ??
                "Order validation failed. Please review your cart.",
            },
            { status: 422 }
          );
        }
      } catch (validationErr) {
        // Log but don't block order if AI service is unavailable
        console.warn("[Order validation] AI service unreachable:", validationErr);
      }
    }

    // 6. Create Order + OrderItems in a transaction
    const order = await db.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          sessionId,
          customerName,
          customerPhone,
          totalAmount: new Decimal(total),
          taxAmount: new Decimal(gst),
          items: {
            create: cartItems.map((item) => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              unitPrice: item.menuItem.price,
            })),
          },
        },
        include: { items: { include: { menuItem: true } } },
      });

      // Clear cart
      await tx.cartItem.deleteMany({ where: { sessionId } });

      // Update session status to ORDERED
      await tx.session.update({
        where: { id: sessionId },
        data: { status: "ORDERED" },
      });

      return newOrder;
    });

    // 7. Increment popularScore (+0.01) for each ordered menu item
    const menuItemIds = [...new Set(cartItems.map((i) => i.menuItemId))];
    await Promise.all(
      menuItemIds.map((id) =>
        db.menuItem.update({
          where: { id },
          data: { popularScore: { increment: 0.01 } },
        })
      )
    );

    // 8. Emit order:placed to table room + kitchen room via Redis adapter
    emitOrderPlaced(session.tableId, {
      orderId: order.id,
      status: "PENDING",
      estimatedWait: 20,
      timestamp: new Date(),
      customerName,
      itemCount: cartItems.length,
      total,
    });

    return NextResponse.json(
      {
        orderId: order.id,
        status: order.status,
        estimatedWait: 20, // minutes
        items: order.items,
        total,
        tax: gst,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/session/[sessionId]/order]", error);
    return NextResponse.json(
      { error: "Failed to place order. Please try again." },
      { status: 500 }
    );
  }
}
