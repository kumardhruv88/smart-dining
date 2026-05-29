import json
import logging
import re
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_groq import ChatGroq
from config import GROQ_MODEL, GROQ_API_KEY
from models.schemas import ChatResponse, Suggestion
from tools.menu_tools import search_menu

logger = logging.getLogger(__name__)

GROUP_SYSTEM_PROMPT = """You are Zara, a warm and witty dining assistant at Spice Garden restaurant.
You are helping the user coordinate an order for a group of {group_size} people.

You MUST ALWAYS respond in this EXACT JSON format:
{{
  "message": "2 sentences max, warm and brief about group sharing/choices",
  "suggestions": [
    {{
      "itemId": "id_from_available_items",
      "name": "exact item name",
      "price": 299,
      "reason": "one line reason why it is great for a group"
    }}
  ]
}}

Rules:
- ALWAYS return valid JSON, never plain text
- Suggest exactly 3-4 items for groups
- IMPORTANT: If user mentions "mix veg and non-veg" or "kuch veg kuch non-veg": suggest 50% veg items and 50% non-veg items from the available list
- CRITICAL: You must ONLY suggest items that are present in the "Shareable suggestions available" list.
- CRITICAL: For each suggested item, you MUST copy the "id" exactly into the "itemId" field. Do NOT generate or modify IDs.
- CRITICAL: For each suggested item, copy "name" and "price" EXACTLY as they appear. Do NOT change them.
- CRITICAL: If no available items exist, return "suggestions": [] (empty). Do NOT invent items.
- Match user language: Hinglish in → Hinglish out, English in → English out
- message field: max 2 sentences, warm tone, acknowledge group size
- reason field: max 8 words, why it works for the group

Current context:
- Group size: {group_size}
- Current cart: {cart_summary}
- Shareable suggestions available: {menu_items}"""


async def run_group_coordinator(message: str, cart_summary: list, group_size: int) -> ChatResponse:
    # Look for shareables or group-friendly dishes
    shareables = search_menu("shareable starters platters veg non-veg group portions")
    
    # Filter out items already in cart
    cart_item_ids = [item.get("itemId") or item.get("menuItemId") for item in cart_summary] if cart_summary else []
    available_items = [i for i in shareables if i.id not in cart_item_ids]
    
    menu_items_json = json.dumps([{"id": i.id, "name": i.name, "price": i.price, "description": i.description, "category": i.category} for i in available_items])
    
    prompt = GROUP_SYSTEM_PROMPT.format(
        group_size=group_size,
        cart_summary=json.dumps(cart_summary),
        menu_items=menu_items_json
    )
    
    llm = ChatGroq(model=GROQ_MODEL, api_key=GROQ_API_KEY, temperature=0.5, max_tokens=400)
    messages = [
        SystemMessage(content=prompt),
        HumanMessage(content=message)
    ]
    
    def parse_agent_response(raw: str) -> dict:
        try:
            return json.loads(raw)
        except:
            pass
        match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', raw)
        if match:
            try:
                return json.loads(match.group(1))
            except:
                pass
        match = re.search(r'\{[\s\S]*\}', raw)
        if match:
            try:
                return json.loads(match.group(0))
            except:
                pass
        return {
            "message": raw[:200],
            "suggestions": []
        }

    try:
        response = await llm.ainvoke(messages)
        content = str(response.content).strip()
        data = parse_agent_response(content)
        
        suggestions = [Suggestion(**s) for s in data.get("suggestions", [])]
        
        return ChatResponse(
            message=data.get("message", "Here are some great options for your group."),
            suggestions=suggestions,
            action=None,
            agentUsed="group_coordinator_agent"
        )
    except Exception as e:
        logger.error(f"Group coordinator failed: {e}")
        return ChatResponse(
            message="I can help you order for the group. How about some shareable platters?",
            suggestions=[],
            action=None,
            agentUsed="group_coordinator_agent"
        )
