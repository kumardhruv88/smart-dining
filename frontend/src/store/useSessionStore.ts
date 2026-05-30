/**
 * src/store/useSessionStore.ts
 *
 * Zustand store for managing the dining session on the client.
 * Persists to localStorage so state survives page refreshes.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SessionStatus = "ACTIVE" | "ORDERED" | "CLOSED";

export interface CartItemEntry {
  id: string;
  menuItemId: string;
  menuItemName: string;
  menuItemPrice: number;
  menuItemImageUrl: string;
  quantity: number;
  specialInstructions: string | null;
  addedBy: string;
}

export interface SessionPreferences {
  dietary: string[];
  spiceLevel: "mild" | "medium" | "hot" | null;
  allergens: string[];
}

export interface SessionState {
  // Session metadata
  sessionId: string | null;
  tableId: string | null;
  status: SessionStatus;
  preferences: SessionPreferences;
  guestName: string;

  // Cart
  cart: CartItemEntry[];

  // Conversation (for AI chat context)
  conversationHistory: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: number;
  }>;

  // Actions
  setSession: (sessionId: string, tableId: string) => void;
  clearSession: () => void;
  setStatus: (status: SessionStatus) => void;
  setGuestName: (name: string) => void;
  setPreferences: (prefs: Partial<SessionPreferences>) => void;

  // Cart actions
  addToCart: (item: Omit<CartItemEntry, "id">) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartItemCount: () => number;

  // Conversation actions
  addMessage: (role: "user" | "assistant", content: string) => void;
  clearConversation: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Default preferences
// ─────────────────────────────────────────────────────────────────────────────

const defaultPreferences: SessionPreferences = {
  dietary: [],
  spiceLevel: null,
  allergens: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      // ── Initial state ────────────────────────────────────────────────────
      sessionId: null,
      tableId: null,
      status: "ACTIVE",
      preferences: defaultPreferences,
      guestName: "Guest",
      cart: [],
      conversationHistory: [],

      // ── Session actions ──────────────────────────────────────────────────
      setSession: (sessionId, tableId) =>
        set({ sessionId, tableId, status: "ACTIVE" }),

      clearSession: () =>
        set({
          sessionId: null,
          tableId: null,
          status: "ACTIVE",
          preferences: defaultPreferences,
          guestName: "Guest",
          cart: [],
          conversationHistory: [],
        }),

      setStatus: (status) => set({ status }),

      setGuestName: (guestName) => set({ guestName }),

      setPreferences: (prefs) =>
        set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        })),

      // ── Cart actions ─────────────────────────────────────────────────────
      addToCart: (item) =>
        set((state) => {
          const existingIndex = state.cart.findIndex(
            (c) =>
              c.menuItemId === item.menuItemId &&
              c.addedBy === item.addedBy &&
              c.specialInstructions === item.specialInstructions
          );

          if (existingIndex !== -1) {
            // Increment quantity of existing item
            const updated = [...state.cart];
            const existing = updated[existingIndex];
            if (existing) {
              updated[existingIndex] = {
                ...existing,
                quantity: existing.quantity + item.quantity,
              };
            }
            return { cart: updated };
          }

          // Add new item with a client-side ID
          const newItem: CartItemEntry = {
            ...item,
            id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          };
          return { cart: [...state.cart, newItem] };
        }),

      removeFromCart: (cartItemId) =>
        set((state) => ({
          cart: state.cart.filter((c) => c.id !== cartItemId),
        })),

      updateQuantity: (cartItemId, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return { cart: state.cart.filter((c) => c.id !== cartItemId) };
          }
          return {
            cart: state.cart.map((c) =>
              c.id === cartItemId ? { ...c, quantity } : c
            ),
          };
        }),

      clearCart: () => set({ cart: [] }),

      getCartTotal: () => {
        const { cart } = get();
        return cart.reduce(
          (sum, item) => sum + item.menuItemPrice * item.quantity,
          0
        );
      },

      getCartItemCount: () => {
        const { cart } = get();
        return cart.reduce((sum, item) => sum + item.quantity, 0);
      },

      // ── Conversation actions ─────────────────────────────────────────────
      addMessage: (role, content) =>
        set((state) => ({
          conversationHistory: [
            ...state.conversationHistory,
            { role, content, timestamp: Date.now() },
          ],
        })),

      clearConversation: () => set({ conversationHistory: [] }),
    }),
    {
      name: "smart-dining-session",
      storage: createJSONStorage(() => localStorage),
      // Only persist non-sensitive fields
      partialize: (state) => ({
        sessionId: state.sessionId,
        tableId: state.tableId,
        status: state.status,
        preferences: state.preferences,
        guestName: state.guestName,
        cart: state.cart,
        conversationHistory: state.conversationHistory.slice(-20), // last 20 messages
      }),
    }
  )
);
