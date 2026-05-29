import json
import logging
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_groq import ChatGroq
from config import GROQ_MODEL, GROQ_API_KEY
from models.schemas import ChatResponse, Suggestion
from tools.menu_tools import search_menu

logger = logging.getLogger(__name__)

REC_SYSTEM_PROMPT = """You are Zara, a warm and witty dining assistant at Spice Garden restaurant.

Your job: Write a natural, friendly conversational message (max 2 sentences) recommending items to the user.
Mirror the user's language style (Hinglish in → Hinglish out, English in → English out).

CRITICAL RULES:
1. Write ONLY your conversational message first (in the user's language).
2. On a NEW LINE at the very end, append this EXACT JSON metadata block:
   {"__json_meta": {"suggestions": [{"itemId": "id", "name": "name", "price": 299, "reason": "short reason"}]}}
3. The JSON block MUST be valid and on its own line.
4. ONLY suggest items from the "Available items" list. Copy id/name/price EXACTLY.
5. Suggest exactly 3 items (or fewer if less available).
6. Do NOT include any JSON in your conversational message — keep them completely separate.
7. reason field: max 8 words explaining why you recommend it.

Context:
- Time: {time_of_day}
- User preferences remembered: {preferences}
- Cart: {cart_summary}
- Available items: {menu_items_json}"""

async def run_recommendation(message: str, time_of_day: str, preferences: dict, cart_summary: list) -> ChatResponse:
    from tools.menu_tools import MENU_CACHE
    import re
    import random
    
    # ─────────────────────────────────────────────────────────────────
    # 1. Build filters from MERGED preferences (session + current turn)
    # ─────────────────────────────────────────────────────────────────
    filters = {}
    if preferences.get("veg_only") or preferences.get("veg"):
        filters["veg"] = True
    if preferences.get("non_veg") or preferences.get("non-veg"):
        filters["non_veg"] = True
    if preferences.get("spicy"):
        filters["spicy"] = True
    if preferences.get("light"):
        filters["light"] = True

    # Allergen exclusions from preferences
    exclude_allergens = []
    if preferences.get("dairy_free") or preferences.get("no_dairy"):
        exclude_allergens.append("dairy")
    if preferences.get("nuts_free") or preferences.get("no_nuts"):
        exclude_allergens.append("nuts")
        exclude_allergens.append("peanut")
    if preferences.get("gluten_free") or preferences.get("no_gluten"):
        exclude_allergens.append("gluten")
    if preferences.get("no_mushroom") or preferences.get("hate_mushroom") or preferences.get("mushroom_free"):
        exclude_allergens.append("mushroom")

    # Allergen exclusions from message text
    msg_lower = message.lower()
    allergen_negatives = ["no", "allergy", "free", "without", "se allergy", "allergic", "avoid", "na ho", "nai", "nahi", "hate", "don't like", "allergies"]
    if any(neg in msg_lower for neg in allergen_negatives):
        if any(w in msg_lower for w in ["dairy", "milk", "paneer", "doodh", "cheese"]):
            exclude_allergens.append("dairy")
        if any(w in msg_lower for w in ["nut", "peanut", "kaju", "badam"]):
            exclude_allergens.append("nuts")
            exclude_allergens.append("peanut")
        if any(w in msg_lower for w in ["gluten", "wheat", "atta"]):
            exclude_allergens.append("gluten")
        if any(w in msg_lower for w in ["mushroom", "fungus"]):
            exclude_allergens.append("mushroom")

    if exclude_allergens:
        filters["exclude_allergens"] = list(set(exclude_allergens))

    # Cart item IDs to avoid re-recommending
    cart_item_ids = [item.get("itemId") or item.get("menuItemId") for item in cart_summary] if cart_summary else []

    # ─────────────────────────────────────────────────────────────────
    # 2. Apply category exclusions (skip_dessert etc.)
    # ─────────────────────────────────────────────────────────────────
    skip_categories = []
    if preferences.get("skip_dessert"):
        skip_categories.append("dessert")

    # ─────────────────────────────────────────────────────────────────
    # 3. Check for "Surprise me" path
    # ─────────────────────────────────────────────────────────────────
    is_surprise = (
        preferences.get("surprise")
        or "surprise" in msg_lower
        or "kuch bhi" in msg_lower
        or "surprise me" in msg_lower
        or "apne hisab se" in msg_lower
    )

    if is_surprise:
        candidates = [i for i in MENU_CACHE if i.isAvailable and i.id not in cart_item_ids]
        if filters.get("veg"):
            candidates = [i for i in candidates if "veg" in i.tags and "non-veg" not in i.tags]
        if filters.get("non_veg"):
            candidates = [i for i in candidates if "non-veg" in i.tags]
        if filters.get("spicy"):
            candidates = [i for i in candidates if "spicy" in i.tags]
        if filters.get("light"):
            candidates = [i for i in candidates if "light" in i.tags]
        if filters.get("exclude_allergens"):
            for allergen in filters["exclude_allergens"]:
                candidates = [i for i in candidates if allergen not in getattr(i, "allergens", [])]
        for cat in skip_categories:
            candidates = [i for i in candidates if cat not in i.category.lower()]
        random.shuffle(candidates)
        available_items = candidates[:10]
    else:
        # 4. Semantic search
        query = message + " " + " ".join([str(k) for k, v in preferences.items() if v])
        items = search_menu(query, filters)
        # Filter cart items and skipped categories
        available_items = [
            i for i in items
            if i.id not in cart_item_ids
            and all(cat not in i.category.lower() for cat in skip_categories)
        ]
        
        # Apply mushroom exclusion post-search (MENU_CACHE allergens)
        if "mushroom" in (filters.get("exclude_allergens") or []):
            available_items = [i for i in available_items if "mushroom" not in [a.lower() for a in getattr(i, "allergens", [])]]
            # Also filter by name as backup
            available_items = [i for i in available_items if "mushroom" not in i.name.lower()]

    # ─────────────────────────────────────────────────────────────────
    # 5. Build prompt and call LLM
    # ─────────────────────────────────────────────────────────────────
    menu_items_json = json.dumps([{
        "id": i.id, "name": i.name, "price": i.price,
        "description": i.description, "category": i.category
    } for i in available_items])

    prompt = REC_SYSTEM_PROMPT.format(
        time_of_day=time_of_day,
        preferences=json.dumps(preferences),
        cart_summary=json.dumps(cart_summary),
        menu_items_json=menu_items_json
    )

    llm = ChatGroq(model=GROQ_MODEL, api_key=GROQ_API_KEY, temperature=0.3, max_tokens=450)
    messages = [
        SystemMessage(content=prompt),
        HumanMessage(content=message)
    ]

    # ─────────────────────────────────────────────────────────────────
    # 6. Parse response
    # ─────────────────────────────────────────────────────────────────
    def parse_agent_response(raw: str) -> tuple[str, list]:
        """Returns (conversational_message, suggestions_list)"""
        suggestions = []
        display_msg = raw.strip()

        # Primary: look for __json_meta block
        json_match = re.search(r'\{"__json_meta"[\s\S]*\}', raw)
        if json_match:
            try:
                meta = json.loads(json_match.group(0))
                suggestions = meta.get("__json_meta", {}).get("suggestions", [])
                display_msg = raw.replace(json_match.group(0), "").strip()
            except:
                pass
        else:
            # Fallback: find any trailing JSON block
            first_brace = raw.find('{')
            last_brace = raw.rfind('}')
            if first_brace != -1 and last_brace > first_brace:
                text_before = raw[:first_brace].strip()
                json_str = raw[first_brace:last_brace + 1]
                try:
                    parsed = json.loads(json_str)
                    if "suggestions" in parsed:
                        suggestions = parsed["suggestions"]
                    display_msg = text_before if text_before else parsed.get("message", raw[:200])
                except:
                    if text_before:
                        display_msg = text_before

        return display_msg, suggestions

    try:
        response = await llm.ainvoke(messages)
        content = str(response.content).strip()

        display_msg, suggestions_raw = parse_agent_response(content)

        # Inject imageUrl from MENU_CACHE
        for s in suggestions_raw:
            item_id = s.get("itemId") or s.get("id")
            matched = next((i for i in MENU_CACHE if i.id == item_id), None)
            if matched:
                s["imageUrl"] = matched.imageUrl or ""
                s["itemId"] = matched.id  # Normalize key
            else:
                s["imageUrl"] = ""
            # Ensure itemId key exists
            if "id" in s and "itemId" not in s:
                s["itemId"] = s["id"]

        suggestions = []
        for s in suggestions_raw:
            try:
                suggestions.append(Suggestion(**{k: v for k, v in s.items() if k in Suggestion.model_fields}))
            except Exception as se:
                logger.warning(f"Suggestion parse error: {se}, data: {s}")

        if not display_msg:
            display_msg = "Here are some great options for you!"

        return ChatResponse(
            message=display_msg,
            suggestions=suggestions,
            action=None,
            agentUsed="recommendation_agent"
        )
    except Exception as e:
        logger.error(f"Recommendation failed: {e}")
        return ChatResponse(
            message="I'm having trouble fetching recommendations right now. Please try again.",
            suggestions=[],
            action=None,
            agentUsed="recommendation_agent"
        )
