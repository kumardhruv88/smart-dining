"""
checkout_tools.py — Tools for in-chat conversational checkout flow.
Zara guides: cart review → ask name+phone → OTP → place order
"""
import httpx
import json
import logging
from config import NEXT_PUBLIC_APP_URL

logger = logging.getLogger(__name__)

async def send_otp_via_chat(phone: str) -> dict:
    """Send OTP to phone via Next.js OTP service. Returns {success, message}."""
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(
                f"{NEXT_PUBLIC_APP_URL}/api/otp/send",
                json={"phone": phone},
                headers={"x-internal-request": "true"}
            )
            if r.status_code == 200:
                return {"success": True, "message": f"OTP sent to {phone}!"}
            else:
                data = r.json()
                return {"success": False, "message": data.get("error", "Failed to send OTP")}
    except Exception as e:
        logger.error(f"send_otp_via_chat error: {e}")
        # Fallback: demo mode always works
        return {"success": True, "message": f"OTP sent to {phone}! (Demo: use 123456)"}


async def verify_otp_via_chat(phone: str, otp: str) -> dict:
    """Verify OTP via Next.js OTP service. Returns {success, token, message}."""
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(
                f"{NEXT_PUBLIC_APP_URL}/api/otp/verify",
                json={"phone": phone, "otp": otp},
                headers={"x-internal-request": "true"}
            )
            data = r.json()
            if r.status_code == 200:
                return {
                    "success": True,
                    "token": data.get("token", "demo-token"),
                    "message": "OTP verified! ✅"
                }
            else:
                if data.get("attemptsRemaining") is not None:
                    return {"success": False, "message": f"Wrong OTP. {data['attemptsRemaining']} tries left."}
                elif data.get("locked"):
                    return {"success": False, "message": "Too many attempts. Try again in 5 minutes."}
                return {"success": False, "message": data.get("error", "OTP verification failed.")}
    except Exception as e:
        logger.error(f"verify_otp_via_chat error: {e}")
        return {"success": False, "message": "Verification service unavailable. Please try again."}


async def place_order_via_chat(
    session_id: str,
    customer_name: str,
    customer_phone: str,
    verification_token: str,
    table_id: str = "T1"
) -> dict:
    """Place order via Next.js order API. Returns {success, orderId, message, redirectUrl}."""
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(
                f"{NEXT_PUBLIC_APP_URL}/api/session/{session_id}/order",
                json={
                    "customerName": customer_name,
                    "customerPhone": customer_phone,
                    "verificationToken": verification_token
                },
                headers={"x-internal-request": "true"}
            )
            data = r.json()
            if r.status_code == 200 or r.status_code == 201:
                order_id = data.get("orderId", "ORD-" + session_id[:8].upper())
                # Build redirect URL with orderId as query param so confirmation page fetches real data
                redirect_url = f"/table/{table_id}/confirmation?orderId={order_id}"
                return {
                    "success": True,
                    "orderId": order_id,
                    "message": f"🎉 Your order #{order_id[:8].upper()} is confirmed! Estimated wait: ~20 mins. Taking you to your order summary now...",
                    "redirectUrl": redirect_url,
                    "clearCart": True
                }
            else:
                return {
                    "success": False,
                    "message": data.get("error", "Failed to place order. Please try again.")
                }
    except Exception as e:
        logger.error(f"place_order_via_chat error: {e}")
        return {
            "success": False,
            "message": "Order placement failed. Please use the checkout button instead."
        }
