import { type NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const aiServiceUrl = process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'https://aryan012234-smart-dining-backend.hf.space';

    if (!aiServiceUrl) {
      console.warn("AI service URL not configured.");
      return NextResponse.json({ suggestion: null });
    }

    const response = await fetch(`${aiServiceUrl}/upsell-check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[Upsell Proxy Error]", errText);
      return NextResponse.json({ suggestion: null });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[POST /api/upsell-check]", error);
    return NextResponse.json({ suggestion: null });
  }
}
