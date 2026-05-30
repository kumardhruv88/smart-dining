/**
 * POST /api/otp/send
 *
 * Generates and sends an OTP to the given phone number.
 *
 * Body:     { phone: string }
 * Response: { success: true, message: "OTP sent" }
 */

import { generateOTP, sendOTP } from "@/lib/otp";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const SendOtpSchema = z.object({
  phone: z
    .string()
    .regex(
      /^\+?[1-9]\d{9,14}$/,
      "Invalid phone number format. Use international format e.g. +919876543210."
    ),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await req.json();
    const parsed = SendOtpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid request body." },
        { status: 400 }
      );
    }

    const { phone } = parsed.data;
    const otp = generateOTP();

    // Respond immediately, send OTP in the background
    sendOTP(phone, otp).catch((err) => {
      console.error("[OTP send background error]", err);
    });

    // Never reveal the OTP in the response, but give hint in mock provider mode
    return NextResponse.json(
      {
        success: true,
        message: "OTP sent",
        ...(process.env.OTP_PROVIDER === "mock" && { hint: "Demo OTP: 123456" }),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/otp/send]", error);
    return NextResponse.json(
      { error: "Failed to send OTP. Please try again." },
      { status: 500 }
    );
  }
}
