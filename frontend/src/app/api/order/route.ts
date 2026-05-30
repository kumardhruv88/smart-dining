import { db } from "@/lib/db";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const orders = await db.order.findMany({
      where: {
        status: {
          not: "DELIVERED",
        },
      },
      include: {
        session: true,
        items: {
          include: {
            menuItem: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Helper to map decimals to numbers to avoid Next.js payload issues
    const formattedOrders = orders.map((order) => ({
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
    }));

    return NextResponse.json({ orders: formattedOrders });
  } catch (error) {
    console.error("[GET /api/order]", error);
    return NextResponse.json(
      { error: "Failed to fetch orders." },
      { status: 500 }
    );
  }
}
