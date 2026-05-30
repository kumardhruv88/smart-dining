import json
import logging
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_groq import ChatGroq
from config import GROQ_MODEL, GROQ_API_KEY
from tools.order_tools import validate_stock

logger = logging.getLogger(__name__)

VALIDATOR_SYSTEM_PROMPT = """You are an order validator. Check this order for issues.
Verify: all items available, quantities reasonable (< 20 per item), no empty cart.
Return JSON: {"valid": bool, "issues": [], "message": str}"""

async def run_order_validation(cart_items: list, session_id: str = None) -> dict:
    issues = []
    
    if session_id:
        from tools.cart_tools import get_cart
        fetched_cart = await get_cart(session_id)
        if fetched_cart:
            cart_items = fetched_cart

    if not cart_items:
        issues.append("Cart is empty.")
    
    for item in cart_items:
        qty = item.get("quantity") or item.get("qty", 0)
        
        # Handle Next.js nested menuItem format OR direct flat format
        if "menuItem" in item and isinstance(item["menuItem"], dict):
            item_id = item["menuItem"].get("id")
            name = item["menuItem"].get("name", "Unknown item")
        else:
            item_id = item.get("menuItemId") or item.get("itemId")
            name = item.get("name", "Unknown item")

        if qty > 20:
            issues.append(f"Quantity for {name} is too high ({qty}).")
            
        is_avail = await validate_stock(item_id)
        if not is_avail:
            issues.append(f"'{name}' is currently unavailable.")
            
    llm = ChatGroq(model=GROQ_MODEL, api_key=GROQ_API_KEY, temperature=0.2, max_tokens=200)
    messages = [
        SystemMessage(content=VALIDATOR_SYSTEM_PROMPT),
        HumanMessage(content=f"Current Cart:\n{json.dumps(cart_items)}\nSystem detected issues:\n{json.dumps(issues)}")
    ]
    try:
        response = await llm.ainvoke(messages)
        content = str(response.content).strip()
        
        if content.startswith("```json"):
            content = content.replace("```json", "").replace("```", "").strip()
        elif content.startswith("```"):
            content = content.replace("```", "").strip()
            
        data = json.loads(content)
        return data
    except Exception as e:
        logger.error(f"Order validation LLM failed: {e}")
        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "message": "Order validation failed." if issues else "Order is valid."
        }
