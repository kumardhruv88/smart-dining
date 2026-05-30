/**
 * src/lib/cart.ts
 *
 * Cart CRUD utilities and GST calculation.
 *
 * GST rates:
 *   - Beverages (category contains "Beverages"): 5%
 *   - All other food items:                      12%
 */

import { db } from "@/lib/db";
import { type CartItem, type MenuItem } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CartItemWithMenuItem = CartItem & {
  menuItem: MenuItem;
};

export interface CartTotal {
  subtotal: number;
  gst: number;
  total: number;
  /** Breakdown of GST per tax bucket */
  gstBreakdown: {
    food: { rate: number; taxable: number; tax: number };
    beverages: { rate: number; taxable: number; tax: number };
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GST helpers
// ─────────────────────────────────────────────────────────────────────────────

const FOOD_GST_RATE = 0.12; // 12%
const BEVERAGE_GST_RATE = 0.05; // 5%

function isBeverage(category: string): boolean {
  return category.toLowerCase().includes("beverage");
}

// ─────────────────────────────────────────────────────────────────────────────
// Cart operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches all cart items for a session, including the associated MenuItem.
 */
export async function getCart(
  sessionId: string
): Promise<CartItemWithMenuItem[]> {
  return db.cartItem.findMany({
    where: { sessionId },
    include: { menuItem: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Adds an item to the cart.
 * If the same menuItemId already exists for the session AND the same addedBy,
 * increments the quantity (upsert-style). Otherwise creates a new CartItem.
 */
export async function addToCart(
  sessionId: string,
  menuItemId: string,
  qty: number,
  addedBy: string
): Promise<CartItemWithMenuItem> {
  // Look for an existing cart item with the same session + item + addedBy
  const existing = await db.cartItem.findFirst({
    where: { sessionId, menuItemId, addedBy },
  });

  if (existing) {
    const updated = await db.cartItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + qty },
      include: { menuItem: true },
    });
    return updated;
  }

  const created = await db.cartItem.create({
    data: { sessionId, menuItemId, quantity: qty, addedBy },
    include: { menuItem: true },
  });

  return created;
}

/**
 * Updates the quantity and/or special instructions of a cart item.
 * Pass undefined to leave a field unchanged.
 */
export async function updateCartItem(
  cartItemId: string,
  qty?: number,
  specialInstructions?: string
): Promise<CartItemWithMenuItem> {
  return db.cartItem.update({
    where: { id: cartItemId },
    data: {
      ...(qty !== undefined && { quantity: qty }),
      ...(specialInstructions !== undefined && { specialInstructions }),
    },
    include: { menuItem: true },
  });
}

/**
 * Removes a cart item by its ID.
 */
export async function removeFromCart(cartItemId: string): Promise<void> {
  await db.cartItem.delete({ where: { id: cartItemId } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Total calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates subtotal, GST (split by category), and total for a set of cart items.
 * All monetary values are returned as plain numbers rounded to 2 decimal places.
 */
export function calculateTotal(items: CartItemWithMenuItem[]): CartTotal {
  let foodTaxable = 0;
  let beverageTaxable = 0;

  for (const item of items) {
    const lineTotal =
      new Decimal(item.menuItem.price).toNumber() * item.quantity;

    if (isBeverage(item.menuItem.category)) {
      beverageTaxable += lineTotal;
    } else {
      foodTaxable += lineTotal;
    }
  }

  const subtotal = round(foodTaxable + beverageTaxable);
  const foodTax = round(foodTaxable * FOOD_GST_RATE);
  const beverageTax = round(beverageTaxable * BEVERAGE_GST_RATE);
  const gst = round(foodTax + beverageTax);
  const total = round(subtotal + gst);

  return {
    subtotal,
    gst,
    total,
    gstBreakdown: {
      food: {
        rate: FOOD_GST_RATE,
        taxable: round(foodTaxable),
        tax: foodTax,
      },
      beverages: {
        rate: BEVERAGE_GST_RATE,
        taxable: round(beverageTaxable),
        tax: beverageTax,
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
