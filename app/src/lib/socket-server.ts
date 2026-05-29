/**
 * src/lib/socket-server.ts
 *
 * Socket.io server-side event handler setup.
 * Called once from server.ts after the io instance is created.
 *
 * Rooms:
 *   "table:{tableId}"  — one room per restaurant table
 *   "kitchen"          — kitchen dashboard room
 *
 * Server → client events:
 *   session:cart_state  — full cart snapshot sent on join / sync request
 *   session:user_joined — notifies room when a new client joins
 *
 * Client → server events:
 *   cart:request_sync   — client asks for a fresh cart snapshot
 *
 * Conflict resolution:
 *   When two clients write to the same CartItem within a 3-second window,
 *   the second broadcast includes conflictResolved=true so clients can
 *   display a toast notification.
 *   Detection uses a Redis INCR counter per itemId with a 3s TTL.
 */

import type { Server as SocketServer, Socket } from "socket.io";
import { getCart, calculateTotal } from "./cart";
import { db } from "./db";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface HandshakeAuth {
  tableId?: string;
  sessionId?: string;
  displayName?: string;
  kitchen?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

export function setupSocketHandlers(io: SocketServer): void {
  io.on("connection", async (socket: Socket) => {
    const auth = socket.handshake.auth as HandshakeAuth;
    const { tableId, sessionId, displayName = "Guest", kitchen } = auth;

    // ── Check if kitchen dashboard ───────────────────────────────────────────
    if (kitchen) {
      await socket.join("kitchen");
      console.log(`[Socket] Kitchen dashboard connected — id=${socket.id}`);

      socket.on("kitchen:status_update", async (data: { orderId: string; status: any }) => {
        try {
          const { orderId, status } = data;
          
          // Update order status in DB
          const order = await db.order.update({
            where: { id: orderId },
            data: { status },
            include: { session: true },
          });

          // Broadcast status change to table room
          io.to(`table:${order.session.tableId}`).emit("order:status_updated", {
            orderId,
            status,
          });

          // Also broadcast to kitchen room to sync other kitchen instances
          io.to("kitchen").emit("order:status_updated", {
            orderId,
            status,
          });
          
          console.log(`[Socket] Order ${orderId} updated to status ${status}`);
        } catch (err) {
          console.error("[Socket] kitchen:status_update failed:", err);
        }
      });

      socket.on("disconnect", (reason: string) => {
        console.log(`[Socket] Kitchen disconnected — id=${socket.id}, reason=${reason}`);
      });
      return;
    }

    // ── Regular customer table validation ────────────────────────────────────
    if (!tableId) {
      console.warn("[Socket] Connection rejected: missing tableId");
      socket.disconnect(true);
      return;
    }

    const room = `table:${tableId}`;
    await socket.join(room);

    console.log(
      `[Socket] Client connected — table=${tableId}, session=${sessionId ?? "n/a"}, id=${socket.id}`
    );

    // ── Send current cart state to the joining socket only ───────────────────
    if (sessionId) {
      try {
        const cartItems = await getCart(sessionId);
        const totals = calculateTotal(cartItems);

        socket.emit("session:cart_state", {
          items: cartItems,
          ...totals,
          timestamp: new Date(),
        });
      } catch (err) {
        console.error("[Socket] Failed to fetch cart on connection:", err);
      }
    }

    // ── Notify other room members and sync members list ─────────────────────
    const activeSockets = await io.in(room).fetchSockets();
    const currentMembers = activeSockets.map((s) => {
      const sAuth = s.handshake.auth as HandshakeAuth;
      return {
        name: sAuth.displayName || "Guest",
        joinedAt: new Date(),
      };
    });

    socket.emit("session:members_list", currentMembers);

    socket.to(room).emit("session:user_joined", {
      displayName,
      tableId,
      timestamp: new Date(),
    });

    // ── cart:request_sync ────────────────────────────────────────────────────
    socket.on("cart:request_sync", async () => {
      if (!sessionId) {
        socket.emit("error", { message: "No sessionId in handshake auth." });
        return;
      }

      try {
        const cartItems = await getCart(sessionId);
        const totals = calculateTotal(cartItems);

        socket.emit("session:cart_state", {
          items: cartItems,
          ...totals,
          timestamp: new Date(),
        });
      } catch (err) {
        console.error("[Socket] cart:request_sync failed:", err);
        socket.emit("error", { message: "Failed to sync cart." });
      }
    });

    // ── disconnect ───────────────────────────────────────────────────────────
    socket.on("disconnect", (reason: string) => {
      console.log(
        `[Socket] Client disconnected — table=${tableId}, id=${socket.id}, reason=${reason}`
      );
    });
  });

  console.log("[Socket.io] Event handlers registered.");
}
