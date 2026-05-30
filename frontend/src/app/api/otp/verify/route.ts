/**
 * POST /api/otp/verify
 *
 * Verifies an OTP for a phone number.
 * On success, returns a signed JWT verification token.
 *
 * Body:     { phone: string, otp: string }
 * Response:
 *   200 — { verified: true, token: string }
 *   401 — { verified: false, attemptsRemaining: number }
 */

import { verifyOTP } from "@/lib/otp";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SignJWT } from "jose";

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

const VerifyOtpSchema = z.object({
  phone: z
    .string()
    .regex(
      /^\+?[1-9]\d{9,14}$/,
      "Invalid phone number format."
    ),
  otp: z
    .string()
    .length(6, "OTP must be exactly 6 digits.")
    .regex(/^\d{6}$/, "OTP must contain only digits."),
});

// ─────────────────────────────────────────────────────────────────────────────
// JWT signing
// ─────────────────────────────────────────────────────────────────────────────

async function signVerificationToken(phone: string): Promise<string> {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured.");

  const encodedSecret = new TextEncoder().encode(secret);

  return new SignJWT({ phone, purpose: "otp_verified" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30m") // 30 minutes to complete the order
    .sign(encodedSecret);
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await req.json();
    const parsed = VerifyOtpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid request body." },
        { status: 400 }
      );
    }

    const { phone, otp } = parsed.data;
    const result = await verifyOTP(phone, otp);

    if (!result.valid) {
      const message =
        result.reason === "max_attempts"
          ? "Maximum OTP attempts reached. Request a new OTP."
          : result.reason === "expired"
          ? "OTP has expired. Request a new one."
          : result.reason === "not_found"
          ? "No OTP found for this number. Request a new OTP."
          : "Invalid OTP.";

      return NextResponse.json(
        { verified: false, attemptsRemaining: result.attemptsRemaining, message },
        { status: 401 }
      );
    }

    const token = await signVerificationToken(phone);

    return NextResponse.json({ verified: true, token });
  } catch (error) {
    console.error("[POST /api/otp/verify]", error);
    return NextResponse.json(
      { error: "OTP verification failed. Please try again." },
      { status: 500 }
    );
  }
}
