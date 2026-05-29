import httpx
import logging
from config import NEXT_PUBLIC_APP_URL

logger = logging.getLogger(__name__)

async def validate_stock(item_id: str) -> bool:
    from tools.menu_tools import MENU_CACHE
    try:
        item = next((i for i in MENU_CACHE if i.id == item_id), None)
        if item:
            return item.isAvailable
    except Exception as e:
        logger.error(f"Stock validation failed: {e}")
    return False

async def create_order(session_id: str, customer_name: str, phone: str, token: str) -> dict:
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{NEXT_PUBLIC_APP_URL}/api/session/{session_id}/order",
                json={"customerName": customer_name, "customerPhone": phone, "verificationToken": token}
            )
            return resp.json()
    except Exception as e:
        logger.error(f"Create order failed: {e}")
        return {"error": str(e)}

async def send_otp(phone: str) -> bool:
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{NEXT_PUBLIC_APP_URL}/api/otp/send",
                json={"phone": phone}
            )
            return resp.status_code == 200
    except Exception as e:
        logger.error(f"Send OTP failed: {e}")
        return False
