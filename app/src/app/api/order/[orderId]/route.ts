/**
 * GET /api/order/[orderId]
 *
 * Returns an order with its items and current status.
 *
 * Response: { order: Order & { items: OrderItem[] } }
 */

import { db } from "@/lib/db";
import { type NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: { orderId: string };
}

export async function GET(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { orderId } = params;

    if (!orderId || orderId.trim() === "") {
      return NextResponse.json(
        { error: "orderId is required." },
        { status: 400 }
      );
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { menuItem: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    const formattedOrder = {
      ...order,
      totalAmount: Number(order.totalAmount),
      taxAmount: Number(order.taxAmount),
      items: order.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        menuItem: {
          ...item.menuItem,
          price: Number(item.menuItem.price),
        },
      })),
    };

    return NextResponse.json({ order: formattedOrder });
  } catch (error) {
    console.error("[GET /api/order/[orderId]]", error);
    return NextResponse.json(
      { error: "Failed to fetch order." },
      { status: 500 }
    );
  }
}
