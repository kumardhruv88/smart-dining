import json
import logging
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_groq import ChatGroq
from models.schemas import ChatResponse, Suggestion
from config import GROQ_API_KEY, GROQ_MODEL
from tools.menu_tools import search_menu

logger = logging.getLogger(__name__)

REC_SYSTEM_PROMPT = """You are Zara, a casual dining assistant at Spice Garden restaurant.
STRICT RULES:
- The output MUST be a valid JSON object. Do NOT wrap it in markdown block.
- Schema: {"message": "...", "suggestions": [{"itemId": "uuid", "name": "Item Name", "price": 249, "reason": "short reason"}]}
- message: MAX 2 short casual sentences. No paragraphs.
- suggestions: exactly 2-3 items, ONLY from the menu list provided below.
- NEVER suggest any item not present in the provided menu_items_json.
- reason: max 5 words per item.
- If user wrote in Hinglish, reply in Hinglish in the message field.
- Never ask follow-up questions. Just suggest items directly.
- Never mention cuisines or items not in our menu (no pizza, pasta, etc.)

Available menu items (use ONLY these):
{menu_items_json}

Current cart: {cart_summary}
Time of day: {time_of_day}
User preferences: {preferences}
{language_instruction}"""

async def run_recommendation(message: str, time_of_day: str, preferences: dict, cart_summary: list, language_detected: str = "english", working_memory: list = None) -> ChatResponse:
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
        print(f"FAISS results for '{message}': {len(items)} items found")
        print(f"Items: {[r.name for r in items]}")
        
        if not items:
            from tools.menu_tools import get_popular_items
            items = get_popular_items(time_of_day)
            
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

    if language_detected.lower() == "hinglish":
        language_instruction = "Reply in Hinglish using Roman script ONLY (no Devanagari/Hindi fonts). Example: 'Yaar, yeh try karo - bilkul light aur tasty hai!'"
    else:
        language_instruction = "Reply in casual English. Max 2 sentences."
        
    prompt = REC_SYSTEM_PROMPT
    prompt = prompt.replace("{time_of_day}", str(time_of_day))
    prompt = prompt.replace("{preferences}", json.dumps(preferences))
    prompt = prompt.replace("{cart_summary}", json.dumps(cart_summary))
    prompt = prompt.replace("{menu_items_json}", str(menu_items_json))
    prompt = prompt.replace("{language_instruction}", language_instruction)

    llm = ChatGroq(
        model=GROQ_MODEL, 
        api_key=GROQ_API_KEY, 
        temperature=0.7, 
        max_tokens=300,
        model_kwargs={"response_format": {"type": "json_object"}}
    )
    messages = [
        SystemMessage(content=prompt)
    ]
    if working_memory:
        for ex in working_memory[-3:]:
            if ex['role'] == 'user':
                messages.append(HumanMessage(content=ex['content']))
            elif ex['role'] == 'assistant':
                messages.append(SystemMessage(content=f"Zara: {ex['content']}"))
    
    messages.append(HumanMessage(content=message))

    # ─────────────────────────────────────────────────────────────────
    # 6. Parse response
    # ─────────────────────────────────────────────────────────────────
    def parse_recommendation_response(raw: str) -> dict:
        import re, json
        # Strip markdown code blocks if present
        clean = re.sub(r'```json|```', '', raw).strip()
        try:
            return json.loads(clean)
        except:
            # Fallback: extract JSON object
            match = re.search(r'\{.*\}', clean, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except: pass
            return {"message": clean, "suggestions": []}

    try:
        response = await llm.ainvoke(messages)
        content = str(response.content).strip()

        parsed = parse_recommendation_response(content)
        display_msg = parsed.get("message", "")
        suggestions_raw = parsed.get("suggestions", [])

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
