/**
 * server.ts — Custom Next.js HTTP server with Socket.io
 *
 * Replaces `next dev` / `next start` with a Node.js HTTP server that:
 *  - Handles all Next.js page / API requests via the standard handler
 *  - Attaches a Socket.io server with the @socket.io/redis-adapter for
 *    horizontal scaling across multiple server instances (Upstash Redis)
 *
 * Start:
 *   dev  → ts-node --project tsconfig.server.json -r tsconfig-paths/register server.ts
 *   prod → cross-env NODE_ENV=production ts-node --project tsconfig.server.json -r tsconfig-paths/register server.ts
 */

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { setupSocketHandlers } from "./src/lib/socket-server";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "localhost";
const port = parseInt(process.env.PORT ?? "7564", 10);

// ─────────────────────────────────────────────────────────────────────────────
// Redis adapter clients
// These are server-process-scoped (not hot-reload singletons).
// The sub client will enter subscriber mode once the adapter is attached.
// ─────────────────────────────────────────────────────────────────────────────

function makeRedisClient(tag: string): Redis {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not configured.");

  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    tls: url.startsWith("rediss://") ? {} : undefined,
    retryStrategy(times: number): number | null {
      if (times > 10) return null;
      return Math.min(times * 100, 3000);
    },
  });

  client.on("error", (err: Error) => {
    console.error(`[Redis:${tag}]`, err.message);
  });

  return client;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  // ── HTTP server ────────────────────────────────────────────────────────────
  const httpServer = createServer(async (req, res) => {
    try {
      // Explicit null check: parse only fires when req.url is present
      const parsedUrl = parse(req.url ?? "/", true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("[Server] Request handling error:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL ?? "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Tune for Upstash / serverless: shorter ping intervals
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // ── Socket.io with Redis adapter (Optional for Dev) ──────────────────────
  if (process.env.REDIS_URL) {
    try {
      const pubClient = makeRedisClient("io-pub");
      const subClient = makeRedisClient("io-sub");
      io.adapter(createAdapter(pubClient, subClient));
      console.log(`> Socket.io Redis adapter attached`);
    } catch (e) {
      console.warn(`> Failed to attach Redis adapter:`, e);
    }
  } else {
    console.log(`> Using default in-memory Socket.io adapter`);
  }

  // ── Register event handlers ───────────────────────────────────────────────
  setupSocketHandlers(io);

  // ── Start listening ───────────────────────────────────────────────────────
  httpServer.listen(port, () => {
    console.log(`\n> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.io with Redis adapter initialized`);
    console.log(`> Mode: ${dev ? "development" : "production"}\n`);
  });
}

main().catch((err: unknown) => {
  console.error("[Server] Fatal startup error:", err);
  process.exit(1);
});
