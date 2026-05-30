/**
 * src/lib/redis.ts  (updated)
 *
 * ioredis client singleton + dedicated pub/sub clients for Socket.io adapter.
 * Server-only — do NOT import in client components.
 *
 * Exports:
 *   redis       — general-purpose client (cache, OTP, rate-limiting)
 *   pub         — dedicated publish client (socket emitter, API pub/sub)
 *   sub         — dedicated subscribe client (socket adapter subscriber)
 *   redisClient — alias for `redis` (spec-compat name)
 */

import Redis from "ioredis";

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

function createRedisClient(tag = "main"): Redis {
  const url = process.env.REDIS_URL;

  if (!url) {
    throw new Error(
      "REDIS_URL is not defined. Please set it in your .env file."
    );
  }

  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    tls: url.startsWith("rediss://") ? {} : undefined,
    lazyConnect: true,
    retryStrategy(times: number): number | null {
      if (times > 10) return null; // stop retrying
      return Math.min(times * 100, 3000);
    },
  });

  client.on("error", (err: Error) => {
    console.error(`[Redis:${tag}] Connection error:`, err.message);
  });

  client.on("connect", () => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[Redis:${tag}] Connected to Upstash Redis.`);
    }
  });

  client.on("reconnecting", () => {
    console.log(`[Redis:${tag}] Reconnecting…`);
  });

  return client;
}

// ─────────────────────────────────────────────────────────────────────────────
// Singletons (hot-reload safe in Next.js dev)
// ─────────────────────────────────────────────────────────────────────────────

const g = globalThis as unknown as {
  _redis: Redis | undefined;
  _redisPub: Redis | undefined;
  _redisSub: Redis | undefined;
};

/** General-purpose client — for cache, OTP, rate-limiting, etc. */
export const redis: Redis = g._redis ?? createRedisClient("main");

/**
 * Dedicated publish client.
 * Used by: @socket.io/redis-emitter and API routes that need pub/sub.
 */
export const pub: Redis = g._redisPub ?? createRedisClient("pub");

/**
 * Dedicated subscribe client.
 * Used by: @socket.io/redis-adapter (puts client into subscriber mode).
 * Do NOT use this for anything except subscribing.
 */
export const sub: Redis = g._redisSub ?? createRedisClient("sub");

/** Alias required by the spec. */
export const redisClient = redis;

if (process.env.NODE_ENV !== "production") {
  g._redis = redis;
  g._redisPub = pub;
  g._redisSub = sub;
}

// ─────────────────────────────────────────────────────────────────────────────
// Typed cache helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Get a JSON-serialised value from Redis. Returns null if key does not exist. */
export async function getCache<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  if (raw === null) return null;
  return JSON.parse(raw) as T;
}

/** Set a JSON-serialised value in Redis with an optional TTL (seconds). */
export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<void> {
  const serialised = JSON.stringify(value);
  if (ttlSeconds !== undefined) {
    await redis.set(key, serialised, "EX", ttlSeconds);
  } else {
    await redis.set(key, serialised);
  }
}

/** Delete a key from Redis. */
export async function deleteCache(key: string): Promise<void> {
  await redis.del(key);
}
