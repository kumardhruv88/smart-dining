/**
 * src/lib/otp.ts
 *
 * OTP generation, delivery, and verification utilities.
 *
 * Redis keys:
 *   otp:{phone}           — JSON { otp: string, createdAt: number (epoch ms) }  TTL 300s
 *   otp:attempts:{phone}  — integer attempt counter  TTL 300s
 *
 * Environment variables:
 *   OTP_PROVIDER         — "mock" (default) | "twilio"
 *   TWILIO_ACCOUNT_SID   — Twilio account SID
 *   TWILIO_AUTH_TOKEN    — Twilio auth token
 *   TWILIO_FROM_NUMBER   — Twilio sender phone number
 *   OTP_HMAC_SECRET      — Secret for HMAC comparison (falls back to JWT_SECRET)
 */

import crypto from "crypto";
import { redis } from "@/lib/redis";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const OTP_TTL_SECONDS = 300; // 5 minutes
const MAX_ATTEMPTS = 3;
const OTP_PROVIDER = process.env.OTP_PROVIDER ?? "mock";

const MOCK_OTP = "123456";

// ─────────────────────────────────────────────────────────────────────────────
// Redis key helpers
// ─────────────────────────────────────────────────────────────────────────────

function otpKey(phone: string): string {
  return `otp:${phone}`;
}

function attemptsKey(phone: string): string {
  return `otp:attempts:${phone}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// OTP payload stored in Redis
// ─────────────────────────────────────────────────────────────────────────────

interface StoredOtp {
  otp: string;
  createdAt: number; // epoch ms
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a 6-digit OTP.
 * In mock mode always returns "123456".
 */
export function generateOTP(): string {
  if (OTP_PROVIDER === "mock") return MOCK_OTP;

  // Cryptographically random 6-digit number (000000–999999)
  const bytes = crypto.randomBytes(4);
  const num = bytes.readUInt32BE(0) % 1_000_000;
  return num.toString().padStart(6, "0");
}

/**
 * Stores the OTP in Redis and sends it to the given phone number.
 * In mock mode, logs to console instead of sending via Twilio.
 */
async function sendViaMSG91(phone: string, otp: string): Promise<any> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;
  
  const response = await fetch(
    'https://control.msg91.com/api/v5/otp',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': authKey || '',
      },
      body: JSON.stringify({
        template_id: templateId,
        mobile: `91${phone}`,
        otp: otp,
      })
    }
  );
  return response.json();
}

/**
 * Stores the OTP in Redis and sends it to the given phone number.
 * Supports Twilio, MSG91, and Mock providers.
 */
export async function sendOTP(phone: string, otp: string): Promise<any> {
  const payload: StoredOtp = { otp, createdAt: Date.now() };

  await redis.set(otpKey(phone), JSON.stringify(payload), "EX", OTP_TTL_SECONDS);
  // Reset attempt counter when a fresh OTP is sent
  await redis.del(attemptsKey(phone));

  const provider = process.env.OTP_PROVIDER ?? "mock";

  if (provider === "mock") {
    console.log(`[OTP MOCK] Phone: ${phone} — OTP: ${otp}`);
    return { success: true, provider: "mock" };
  }

  if (provider === "msg91") {
    const result = await sendViaMSG91(phone, otp);
    return { success: true, provider: "msg91", result };
  }

  // ── Twilio ────────────────────────────────────────────────────────────────
  const { default: twilio } = await import("twilio");

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error(
      "Twilio credentials are not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER."
    );
  }

  // Format to E.164 (e.g. +91XXXXXXXXXX)
  let formattedTo = phone.trim();
  const digits = formattedTo.replace(/[\s\+\-\(\)]/g, "");
  if (/^\d{10}$/.test(digits)) {
    formattedTo = `+91${digits}`;
  } else if (/^91\d{10}$/.test(digits)) {
    formattedTo = `+${digits}`;
  } else if (!formattedTo.startsWith("+")) {
    formattedTo = `+${digits}`;
  }

  const client = twilio(accountSid, authToken);

  await client.messages.create({
    body: `Your Smart Dining OTP is: ${otp}. Valid for 5 minutes.`,
    from: fromNumber,
    to: formattedTo,
  });

  return { success: true, provider: "twilio" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Verification
// ─────────────────────────────────────────────────────────────────────────────

export interface VerifyOtpResult {
  valid: boolean;
  attemptsRemaining: number;
  reason?: "invalid_otp" | "expired" | "max_attempts" | "not_found";
}

/**
 * Verifies an OTP supplied by the user.
 *
 * Checks:
 *  1. Stored OTP exists in Redis
 *  2. Attempt counter has not exceeded MAX_ATTEMPTS
 *  3. OTP has not exceeded the 5-minute TTL
 *  4. HMAC-safe comparison of supplied vs stored OTP
 */
export async function verifyOTP(
  phone: string,
  suppliedOtp: string
): Promise<VerifyOtpResult> {
  const raw = await redis.get(otpKey(phone));

  if (!raw) {
    return { valid: false, attemptsRemaining: 0, reason: "not_found" };
  }

  const stored = JSON.parse(raw) as StoredOtp;

  // Check attempt counter before incrementing
  const attemptsRaw = await redis.get(attemptsKey(phone));
  const currentAttempts = attemptsRaw ? parseInt(attemptsRaw, 10) : 0;

  if (currentAttempts >= MAX_ATTEMPTS) {
    return { valid: false, attemptsRemaining: 0, reason: "max_attempts" };
  }

  // Increment attempt counter
  const newAttempts = currentAttempts + 1;
  await redis.set(attemptsKey(phone), String(newAttempts), "EX", OTP_TTL_SECONDS);

  // Check 5-minute TTL (belt-and-suspenders on top of Redis TTL)
  const ageMs = Date.now() - stored.createdAt;
  if (ageMs > OTP_TTL_SECONDS * 1000) {
    return {
      valid: false,
      attemptsRemaining: MAX_ATTEMPTS - newAttempts,
      reason: "expired",
    };
  }

  // HMAC-safe string comparison to prevent timing attacks
  const secret = process.env.OTP_HMAC_SECRET ?? process.env.JWT_SECRET ?? "otp-secret";
  const hmac = (val: string): Buffer =>
    crypto.createHmac("sha256", secret).update(val).digest();

  const supplied = hmac(suppliedOtp);
  const expected = hmac(stored.otp);

  const isValid =
    supplied.length === expected.length &&
    crypto.timingSafeEqual(supplied, expected);

  if (isValid) {
    // Clean up Redis keys on success
    await redis.del(otpKey(phone));
    await redis.del(attemptsKey(phone));
    return { valid: true, attemptsRemaining: 0 };
  }

  return {
    valid: false,
    attemptsRemaining: MAX_ATTEMPTS - newAttempts,
    reason: "invalid_otp",
  };
}
