/**
 * GET /api/menu/search?q=
 *
 * Returns menu items matching the search query.
 * - DB performs ILIKE search on name and description (server-side fallback)
 * - Client uses Fuse.js for fuzzy filtering on the full list
 *
 * Response: { items: MenuItem[] }
 */

import { db } from "@/lib/db";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";

    if (!q) {
      // No query — return all available items (client will filter with Fuse.js)
      const items = await db.menuItem.findMany({
        where: { available: true },
        orderBy: { popularScore: "desc" },
      });
      return NextResponse.json({ items });
    }

    // DB ILIKE search as fallback for server-side filtering
    const items = await db.menuItem.findMany({
      where: {
        available: true,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { popularScore: "desc" },
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[GET /api/menu/search]", error);
    return NextResponse.json(
      { error: "Search failed." },
      { status: 500 }
    );
  }
}
