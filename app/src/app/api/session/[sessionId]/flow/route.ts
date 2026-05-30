import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { flow } = await req.json();
    const aiServiceUrl = process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'https://kumardhruv88-smart-dining-ai.hf.space';
    
    if (aiServiceUrl) {
      await fetch(`${aiServiceUrl}/set-order-flow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: params.sessionId,
          flow
        }),
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to set flow" }, { status: 500 });
  }
}
