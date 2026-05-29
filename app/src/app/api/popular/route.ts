/**
 * GET /api/popular?time=
 *
 * Returns the top 5 popular menu items filtered by time-of-day category mapping.
 *
 * Time param:   "breakfast" | "lunch" | "evening" | "dinner"
 *               Auto-detected from server time (IST +05:30) if not provided.
 *
 * Category mapping:
 *   breakfast → Beverages Hot
 *   lunch     → Mains
 *   evening   → Starters, Beverages Cold
 *   dinner    → Mains, Starters
 *
 * Response: { items: MenuItem[], timeOfDay: string }
 */

import { db } from "@/lib/db";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type TimeOfDay = "breakfast" | "lunch" | "evening" | "dinner";

const TimeSchema = z
  .enum(["breakfast", "lunch", "evening", "dinner"])
  .optional();

// ─────────────────────────────────────────────────────────────────────────────
// Category mappings
// ─────────────────────────────────────────────────────────────────────────────

const TIME_CATEGORY_MAP: Record<TimeOfDay, string[]> = {
  breakfast: ["Beverages Hot"],
  lunch: ["Mains"],
  evening: ["Starters", "Beverages Cold"],
  dinner: ["Mains", "Starters"],
};

// ─────────────────────────────────────────────────────────────────────────────
// Server-time auto-detection (IST = UTC+5:30)
// ─────────────────────────────────────────────────────────────────────────────

function detectTimeOfDay(): TimeOfDay {
  // Server is UTC; convert to IST for local context
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // 5h 30m in ms
  const istDate = new Date(now.getTime() + istOffset);
  const hour = istDate.getUTCHours();

  if (hour >= 6 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 19) return "evening";
  return "dinner"; // 19:00–06:00
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const rawTime = searchParams.get("time") ?? undefined;

    const parsed = TimeSchema.safeParse(rawTime);

    if (rawTime && !parsed.success) {
      return NextResponse.json(
        {
          error:
            'Invalid "time" parameter. Must be one of: breakfast, lunch, evening, dinner.',
        },
        { status: 400 }
      );
    }

    const timeOfDay: TimeOfDay = parsed.success && parsed.data
      ? parsed.data
      : detectTimeOfDay();

    const categories = TIME_CATEGORY_MAP[timeOfDay];

    const items = await db.menuItem.findMany({
      where: {
        available: true,
        category: { in: categories },
      },
      orderBy: { popularScore: "desc" },
      take: 5,
    });

    return NextResponse.json({ items, timeOfDay });
  } catch (error) {
    console.error("[GET /api/popular]", error);
    return NextResponse.json(
      { error: "Failed to fetch popular items." },
      { status: 500 }
    );
  }
}
