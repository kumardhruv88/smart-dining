/**
 * GET /api/debug/ai-check
 *
 * Diagnostic endpoint to test the AI backend connectivity from Vercel.
 * This helps debug 502 errors by testing each step of the chain.
 */

import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      NEXT_PUBLIC_AI_SERVICE_URL: process.env.NEXT_PUBLIC_AI_SERVICE_URL || "(not set)",
      REDIS_URL: process.env.REDIS_URL ? "SET (hidden)" : "(not set)",
      DATABASE_URL: process.env.DATABASE_URL ? "SET (hidden)" : "(not set)",
      UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ? "SET (hidden)" : "(not set)",
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "(not set)",
      NODE_ENV: process.env.NODE_ENV,
    },
  };

  // Resolve AI URL
  const configuredUrl = process.env.NEXT_PUBLIC_AI_SERVICE_URL || '';
  const isLocalhost = configuredUrl.includes('localhost') || configuredUrl.includes('127.0.0.1') || configuredUrl.includes('api.example.com');
  const aiServiceUrl = (!configuredUrl || isLocalhost)
    ? 'https://aryan012234-smart-dining-backend.hf.space'
    : configuredUrl;

  results.resolvedAiUrl = aiServiceUrl;
  results.urlWasOverridden = isLocalhost || !configuredUrl;

  // Test 1: Health check
  try {
    const healthRes = await fetch(`${aiServiceUrl}/health`, {
      signal: AbortSignal.timeout(8000),
    });
    const healthData = await healthRes.text();
    results.healthCheck = {
      status: healthRes.status,
      ok: healthRes.ok,
      body: healthData,
    };
  } catch (err: unknown) {
    results.healthCheck = {
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Test 2: Chat endpoint with minimal payload
  try {
    const chatRes = await fetch(`${aiServiceUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "hello",
        sessionId: "debug-test",
        tableId: "T1",
        preferences: {},
        cartSummary: { itemCount: 0, items: [], subtotal: 0, total: 0 },
        timeOfDay: "lunch",
      }),
      signal: AbortSignal.timeout(15000),
    });
    const chatData = await chatRes.text();
    results.chatTest = {
      status: chatRes.status,
      ok: chatRes.ok,
      body: chatData.slice(0, 500),
    };
  } catch (err: unknown) {
    results.chatTest = {
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Test 3: Database connectivity
  try {
    const { db } = await import("@/lib/db");
    const count = await db.menuItem.count();
    results.database = { connected: true, menuItemCount: count };
  } catch (err: unknown) {
    results.database = {
      connected: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Test 4: Redis connectivity
  try {
    const { redis } = await import("@/lib/redis");
    await redis.ping();
    results.redis = { connected: true };
  } catch (err: unknown) {
    results.redis = {
      connected: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return NextResponse.json(results, { status: 200 });
}
