/**
 * src/lib/socket-emitter.ts
 *
 * Thin wrappers around @socket.io/redis-emitter for emitting Socket.io events
 * from API routes (serverless-compatible — no direct socket connection needed).
 *
 * The Emitter publishes events via the same Redis adapter protocol used by the
 * Socket.io server in server.ts, so events are received by all connected
 * clients in the target room.
 *
 * Rooms are keyed "table:{tableId}".
 * Kitchen room:  "kitchen"
 */

import { Emitter } from "@socket.io/redis-emitter";
import Redis from "ioredis";

// ─────────────────────────────────────────────────────────────────────────────
// Emitter singleton (hot-reload safe in Next.js dev)
// ─────────────────────────────────────────────────────────────────────────────

function createEmitterClient(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not defined.");

  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    tls: url.startsWith("rediss://") ? {} : undefined,
    lazyConnect: true,
  });

  client.on("error", (err: Error) => {
    console.error("[SocketEmitter] Redis error:", err.message);
  });

  return client;
}

const globalForEmitter = globalThis as unknown as {
  _socketEmitter: Emitter | undefined;
};

const emitter: Emitter =
  globalForEmitter._socketEmitter ??
  new Emitter(createEmitterClient());

if (process.env.NODE_ENV !== "production") {
  globalForEmitter._socketEmitter = emitter;
}

// ─────────────────────────────────────────────────────────────────────────────
// Payload types
// ─────────────────────────────────────────────────────────────────────────────

export interface CartItemAddedPayload {
  itemId: string;
  name: string;
  qty: number;
  addedBy: string;
  cartTotal: number;
  timestamp: Date;
  conflictResolved?: boolean;
  message?: string;
}

export interface CartItemRemovedPayload {
  itemId: string;
  addedBy: string;
  cartTotal: number;
  timestamp: Date;
  conflictResolved?: boolean;
  message?: string;
}

export interface CartItemUpdatedPayload {
  itemId: string;
  newQty: number;
  cartTotal: number;
  timestamp: Date;
  conflictResolved?: boolean;
  message?: string;
}

export interface AiMessagePayload {
  sender: "Zara" | "user";
  text: string;
  timestamp: Date;
}

export interface OrderPlacedPayload {
  orderId: string;
  status: "PENDING";
  estimatedWait: number;
  timestamp: Date;
  customerName?: string;
  itemCount?: number;
  total?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Emit helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Emit "cart:item_added" to the table room. */
export function emitCartItemAdded(
  tableId: string,
  payload: CartItemAddedPayload
): void {
  emitter.to(`table:${tableId}`).emit("cart:item_added", payload);
}

/** Emit "cart:item_removed" to the table room. */
export function emitCartItemRemoved(
  tableId: string,
  payload: CartItemRemovedPayload
): void {
  emitter.to(`table:${tableId}`).emit("cart:item_removed", payload);
}

/** Emit "cart:item_updated" to the table room. */
export function emitCartItemUpdated(
  tableId: string,
  payload: CartItemUpdatedPayload
): void {
  emitter.to(`table:${tableId}`).emit("cart:item_updated", payload);
}

/** Emit "ai:message" to the table room. */
export function emitAiMessage(
  tableId: string,
  payload: AiMessagePayload
): void {
  emitter.to(`table:${tableId}`).emit("ai:message", payload);
}

/**
 * Emit "order:placed" to both the table room AND the kitchen room.
 * Kitchen dashboard subscribes to room "kitchen" to display incoming orders.
 */
export function emitOrderPlaced(
  tableId: string,
  payload: OrderPlacedPayload
): void {
  emitter.to(`table:${tableId}`).emit("order:placed", payload);
  emitter.to("kitchen").emit("order:placed", {
    ...payload,
    tableId,
  });
}
