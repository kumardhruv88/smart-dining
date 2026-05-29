import httpx
import logging
from config import NEXT_PUBLIC_APP_URL

logger = logging.getLogger(__name__)

async def get_cart(session_id: str) -> list:
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{NEXT_PUBLIC_APP_URL}/api/session/{session_id}/cart",
                headers={"x-internal-request": "true"}
            )
            if resp.status_code == 200:
                data = resp.json()
                if "cart" in data and isinstance(data["cart"], dict):
                    return data["cart"].get("items", [])
                return data.get("items", [])
    except Exception as e:
        logger.error(f"Failed to get cart: {e}")
    return []

async def add_to_cart(session_id: str, item_id: str, quantity: int = 1, added_by: str = "Zara") -> bool:
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{NEXT_PUBLIC_APP_URL}/api/session/{session_id}/cart",
                json={"menuItemId": item_id, "quantity": quantity, "addedBy": added_by},
                headers={"x-internal-request": "true"}
            )
            return resp.status_code == 200 or resp.status_code == 201
    except Exception as e:
        logger.error(f"Failed to add to cart: {e}")
        return False

async def add_to_cart_by_name(
    item_name: str, 
    session_id: str, 
    table_id: str
) -> dict:
    from tools.menu_tools import MENU_CACHE
    if not item_name:
        return {"success": False, "message": "Item name is required."}

    # Search menu for item
    menu_items = MENU_CACHE
    item = next(
        (i for i in menu_items 
         if item_name.lower() in i.name.lower()),
        None
    )
    if not item:
        return {"success": False, 
                "message": f"Couldn't find {item_name} on the menu."}
    
    # Call Next.js cart API
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{NEXT_PUBLIC_APP_URL}/api/session/{session_id}/cart",
                json={
                    "menuItemId": item.id,
                    "quantity": 1,
                    "addedBy": "Zara"
                },
                headers={"x-internal-request": "true"}
            )
            if response.status_code == 200 or response.status_code == 201:
                return {
                    "success": True,
                    "message": f"Added {item.name} to your cart!",
                    "item": item
                }
            else:
                return {
                    "success": False,
                    "message": f"Could not add {item.name} to cart. API returned {response.status_code}."
                }
    except Exception as e:
        logger.error(f"Failed to add to cart by name: {e}")
        return {
            "success": False,
            "message": f"Failed to add {item.name} to cart due to connection issue."
        }
