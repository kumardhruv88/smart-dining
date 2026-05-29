import asyncio
import logging
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_groq import ChatGroq
from config import GROQ_MODEL, GROQ_API_KEY

from models.schemas import ChatRequest, ChatResponse
from agents.nlu_agent import run_nlu
from agents.greeter_agent import run_greeter
from agents.recommendation_agent import run_recommendation
from agents.upsell_agent import check_upsell_triggers
from agents.group_coordinator_agent import run_group_coordinator
from agents.sentiment_agent import monitor_sentiment
from agents.order_validation_agent import run_order_validation
from agents.context_memory_agent import update_context
from memory.session_memory import SessionMemory
from tools.cart_tools import add_to_cart

logger = logging.getLogger(__name__)

async def run_orchestrator(req: ChatRequest) -> ChatResponse:
    import json
    add_item_result = None

    # 1. Extract cart list and total safely from dict or list
    cart_summary = req.cartSummary
    if isinstance(cart_summary, dict):
        cart_list = cart_summary.get("items", [])
        cart_total = cart_summary.get("total", 0.0)
    else:
        cart_list = cart_summary or []
        cart_total = sum(item.get("price", 0) * (item.get("quantity") or item.get("qty", 1)) for item in cart_list)

    # Normalize items in cart_list to support both 'qty' and 'quantity', 'itemId' and 'menuItemId'
    normalized_cart = []
    for item in cart_list:
        normalized_cart.append({
            "itemId": item.get("itemId") or item.get("menuItemId"),
            "menuItemId": item.get("menuItemId") or item.get("itemId"),
            "name": item.get("name"),
            "price": item.get("price"),
            "quantity": item.get("quantity") or item.get("qty", 1),
            "qty": item.get("qty") or item.get("quantity", 1)
        })
    cart_list = normalized_cart

    # 1. Always run NLU agent first
    nlu_result = await run_nlu(req.message)
    logger.info(f"NLU Intent: {nlu_result.intent}")

    # Intercept generic ADD_ITEM intent and change to CHECKOUT
    if nlu_result.intent == "ADD_ITEM":
        item_name = nlu_result.entities.get("item_name")
        is_checkout_phrase = False
        message_lower = req.message.lower().strip()
        checkout_phrases = [
            "order this item", "order this", "order now", "place order",
            "place this order", "checkout now", "complete order", "confirm order",
            "order please", "order kar do", "order karo", "order kro", "bas order karo",
            "sirf order", "order de do", "order kardo", "karwa do", "karwa",
            "bas itna", "order place", "final order"
        ]
        generic_item_names = ["this", "it", "item", "this item", "that", "the item",
                               "everything", "all", "order", "now", "order now",
                               "order this", "order this item", "please", "yes", "ok"]
        if not item_name or item_name.lower().strip() in generic_item_names:
            is_checkout_phrase = True
        for phrase in checkout_phrases:
            if phrase in message_lower:
                is_checkout_phrase = True
        if is_checkout_phrase:
            nlu_result.intent = "CHECKOUT"
            logger.info("Redirected intent from ADD_ITEM to CHECKOUT due to generic order/checkout phrase.")

    # 2. Run sentiment agent (async, non-blocking) if message length > 10 chars
    asyncio.create_task(monitor_sentiment(req.sessionId, req.message))

    # 3. Read session memory for context
    working_memory = await SessionMemory.get_working_memory(req.sessionId)
    session_mem = await SessionMemory.get(req.sessionId)
    session_prefs = session_mem.get("preferences", {})
    should_rephrase = session_mem.get("should_rephrase", False)
    session_sentiment = session_mem.get("sentiment", "neutral")
    
    # Merge NLU preferences with session preferences (session preferences take lower priority to current turn)
    merged_prefs = {**session_prefs, **nlu_result.preferences}
    
    # 4. Route by intent
    response: ChatResponse = None

    if nlu_result.intent == "GREET" and not working_memory:
        response = await run_greeter(req.message, nlu_result.language_detected)
        
    elif nlu_result.intent == "RECOMMEND":
        response = await run_recommendation(req.message, req.timeOfDay, merged_prefs, cart_list)
        
    elif nlu_result.intent == "ADD_ITEM":
        from tools.cart_tools import add_to_cart_by_name
        from tools.menu_tools import MENU_CACHE
        item_name = nlu_result.entities.get("item_name")
        if not item_name:
            cleaned_msg = req.message.lower()
            for w in ["add", "to", "my", "cart", "please", "put", "zara", "in"]:
                cleaned_msg = cleaned_msg.replace(w, "")
            item_name = cleaned_msg.strip()
            
        menu_items = MENU_CACHE
        item = next(
            (i for i in menu_items 
             if item_name.lower() in i.name.lower()),
            None
        )
        
        already_in_cart = False
        if item:
            already_in_cart = any(
                str(c_item.get("itemId")) == str(item.id) or 
                str(c_item.get("menuItemId")) == str(item.id) or
                (c_item.get("name") and item.name.lower() in c_item.get("name").lower())
                for c_item in cart_list
            )
            
        if already_in_cart:
            add_item_result = {
                "success": True,
                "message": f"{item.name} is already in your cart.",
                "item": item
            }
        else:
            add_item_result = await add_to_cart_by_name(
                item_name,
                req.sessionId,
                req.tableId
            )
            
        upsell_msg = None
        if add_item_result.get("success") and add_item_result.get("item"):
            added_item = add_item_result["item"]
            last_item = {"id": added_item.id, "name": added_item.name}
            try:
                upsell_msg = await check_upsell_triggers(
                    cart_list,
                    cart_total,
                    req.timeOfDay,
                    last_added_item=last_item
                )
            except Exception as e:
                logger.error(f"Error checking upsell triggers in orchestrator: {e}")
                
        zara_msg = await generate_zara_response(
            intent="ADD_ITEM",
            user_message=req.message,
            language=nlu_result.language_detected,
            context_data={
                "item_name": item.name if item else item_name,
                "already_in_cart": already_in_cart,
                "upsell_msg": upsell_msg["message"] if (upsell_msg and isinstance(upsell_msg, dict)) else (upsell_msg or "")
            },
            should_rephrase=should_rephrase
        )
        
        if not zara_msg:
            if already_in_cart:
                zara_msg = f"{item.name} is already in your cart. Would you like me to place the order now?"
            else:
                zara_msg = add_item_result["message"] + "\n\nWould you like me to place the order now?"
                
        response = ChatResponse(
            message=zara_msg,
            suggestions=[],
            action="cart_updated" if (add_item_result["success"] and not already_in_cart) else None,
            agentUsed="orchestrator"
        )
                
    elif nlu_result.intent == "UPSELL_CHECK":
        upsell_msg = await check_upsell_triggers(cart_list, cart_total, req.timeOfDay, intent=nlu_result.intent)
        if isinstance(upsell_msg, dict):
            response = ChatResponse(
                message=upsell_msg.get("message") or "Is there anything else I can get for you?",
                action=None,
                agentUsed="upsell_agent",
                upsellSuggestion=json.dumps(upsell_msg)
            )
        else:
            response = ChatResponse(
                message=upsell_msg or "Is there anything else I can get for you?",
                action=None,
                agentUsed="upsell_agent"
            )
        
    elif nlu_result.intent == "GROUP_MERGE":
        group_size = nlu_result.entities.get("group_size", 4)
        response = await run_group_coordinator(req.message, cart_list, group_size)
        
    elif nlu_result.intent == "CHECKOUT":
        val_res = await run_order_validation(cart_list)
        zara_msg = await generate_zara_response(
            intent="CHECKOUT",
            user_message=req.message,
            language=nlu_result.language_detected,
            context_data={"valid": val_res.get("valid"), "issues": val_res.get("issues", [])},
            should_rephrase=should_rephrase
        )
        if not zara_msg:
            if val_res.get("valid"):
                zara_msg = "Your order looks perfect! To place the order, please provide your 10-digit mobile number."
            else:
                issues = "\n".join(val_res.get("issues", []))
                zara_msg = f"There are a few issues with your cart:\n{issues}"
                
        response = ChatResponse(
            message=zara_msg,
            action=None,
            agentUsed="order_validation_agent"
        )

    elif nlu_result.intent == "COLLECT_PHONE":
        from tools.checkout_tools import send_otp_via_chat
        phone = nlu_result.entities.get("phone", "")
        if phone:
            res = await send_otp_via_chat(phone)
            await SessionMemory.update(req.sessionId, "checkout_phone", phone)
            zara_msg = await generate_zara_response(
                intent="COLLECT_PHONE",
                user_message=req.message,
                language=nlu_result.language_detected,
                context_data={"phone": phone, "success": res.get("success", False), "api_msg": res.get("message", "")}
            )
            if not zara_msg:
                zara_msg = res.get("message")
        else:
            zara_msg = await generate_zara_response(
                intent="COLLECT_PHONE",
                user_message=req.message,
                language=nlu_result.language_detected,
                context_data={"phone": "", "success": False, "api_msg": ""}
            )
            if not zara_msg:
                zara_msg = "I couldn't quite catch your phone number. Could you please provide a valid 10-digit number?"
                
        response = ChatResponse(
            message=zara_msg,
            action=None,
            agentUsed="checkout_agent"
        )
            
    elif nlu_result.intent == "VERIFY_OTP":
        from tools.checkout_tools import verify_otp_via_chat, place_order_via_chat
        mem = await SessionMemory.get(req.sessionId)
        phone = mem.get("checkout_phone")
        otp = nlu_result.entities.get("otp", "")
        if not phone:
            zara_msg = "Please provide your mobile number first so I can send you an OTP."
            response = ChatResponse(
                message=zara_msg,
                action=None,
                agentUsed="checkout_agent"
            )
        else:
            res = await verify_otp_via_chat(phone, otp)
            if res.get("success"):
                order_res = await place_order_via_chat(req.sessionId, "Guest", phone, res.get("token"))
                zara_msg = await generate_zara_response(
                    intent="VERIFY_OTP",
                    user_message=req.message,
                    language=nlu_result.language_detected,
                    context_data={"success": True, "api_msg": order_res.get("message", "")}
                )
                if not zara_msg:
                    zara_msg = order_res.get("message")
                response = ChatResponse(
                    message=zara_msg,
                    action=None,
                    agentUsed="checkout_agent"
                )
                if order_res.get("redirectUrl"):
                    response.action = f"redirect:{order_res['redirectUrl']}"
            else:
                zara_msg = await generate_zara_response(
                    intent="VERIFY_OTP",
                    user_message=req.message,
                    language=nlu_result.language_detected,
                    context_data={"success": False, "api_msg": res.get("message", "")}
                )
                if not zara_msg:
                    zara_msg = res.get("message")
                response = ChatResponse(
                    message=zara_msg,
                    action=None,
                    agentUsed="checkout_agent"
                )
            
    else: # FALLBACK
        llm = ChatGroq(model=GROQ_MODEL, api_key=GROQ_API_KEY, temperature=0.5, max_tokens=200)
        fallback_prompt = "You are a dining assistant. A user said something off-script or general. Give a polite, helpful response keeping it dining-related."
        res = await llm.ainvoke([SystemMessage(content=fallback_prompt), HumanMessage(content=req.message)])
        response = ChatResponse(
            message=str(res.content).strip(),
            agentUsed="fallback_agent"
        )

    # 5. After response
    if nlu_result.intent == "ADD_ITEM" and add_item_result and add_item_result.get("success") and add_item_result.get("item"):
        added_item = add_item_result["item"]
        last_item = {"id": added_item.id, "name": added_item.name}
        upsell_msg = await check_upsell_triggers(cart_list, cart_total, req.timeOfDay, last_added_item=last_item)
        if isinstance(upsell_msg, dict):
            response.upsellSuggestion = json.dumps(upsell_msg)
        else:
            response.upsellSuggestion = upsell_msg

    asyncio.create_task(update_context(req.sessionId, nlu_result.preferences, nlu_result.language_detected, nlu_result.entities, req.message))

    await SessionMemory.append_exchange(req.sessionId, "user", req.message)
    await SessionMemory.append_exchange(req.sessionId, "assistant", response.message)

    return response

def get_zara_prompt(
    intent: str,
    user_message: str,
    language: str,
    context_data: dict,
    should_rephrase: bool = False
) -> tuple[str, str]:
    """
    Generates the system prompt for Zara based on context.
    If should_rephrase=True, Zara uses a gentler, more simplified tone.
    """
    # Tone modifier when user is frustrated/confused
    tone_note = ""
    if should_rephrase:
        tone_note = "\n\nIMPORTANT: The user seems frustrated or confused. Be extra warm, empathetic, and concise. Acknowledge their frustration briefly, simplify your language, and offer ONE clear, actionable step. Do NOT suggest multiple things at once."

    # Construct the prompt based on the intent
    if intent == "ADD_ITEM":
        item_name = context_data.get("item_name", "the item")
        already_in_cart = context_data.get("already_in_cart", False)
        upsell_msg = context_data.get("upsell_msg", "")
        
        system_prompt = f"""You are Zara, a warm, witty, and natural dining assistant at Spice Garden.
Your job is to generate a conversational response to the user's request.
The user wants to order/add the item: "{item_name}".

Context:
- Is item already in the cart?: {already_in_cart}
- User's message: "{user_message}"
- Language detected: {language}
- Upsell suggestion to mention: {upsell_msg}

Rules:
1. DO NOT be robotic. Mirror the user's language (Hinglish, English, or Telugu-English) and conversational style.
2. If already_in_cart is True: state that the item is already added to the cart, and ask if they want to place the order now.
3. If already_in_cart is False: state that you've added the item to their cart, and ask if they want to place the order now or add anything else.
4. If an upsell suggestion is provided (not empty), weave it in naturally (e.g. "Most people pair it with X. Want to add that too?").
5. Keep the response brief, conversational, and friendly (max 2 sentences).
6. Return only the plain conversational message, do not add any JSON or tags.{tone_note}"""

    elif intent == "CHECKOUT":
        validation_valid = context_data.get("valid", True)
        validation_issues = context_data.get("issues", [])
        
        system_prompt = f"""You are Zara, a warm, witty, and natural dining assistant at Spice Garden.
Your job is to generate a conversational response to the user wanting to checkout/place their order.

Context:
- Is cart valid?: {validation_valid}
- Issues in cart: {validation_issues}
- User's message: "{user_message}"
- Language detected: {language}

Rules:
1. Mirror the user's language (Hinglish, English, or Telugu-English). If they used Hinglish, respond in Hinglish.
2. If cart is valid: ask them to provide their 10-digit mobile number to receive an OTP and place the order.
3. If cart is invalid: list the issues politely and guide them to resolve them.
4. Keep the response brief, warm, and conversational (max 2 sentences).
5. Return only the plain conversational message, do not add any JSON or tags.{tone_note}"""

    elif intent == "COLLECT_PHONE":
        phone = context_data.get("phone", "")
        success = context_data.get("success", False)
        api_msg = context_data.get("api_msg", "")
        
        system_prompt = f"""You are Zara, a warm, witty, and natural dining assistant at Spice Garden.
Your job is to generate a conversational response after a user provided their phone number.

Context:
- Did OTP send succeed?: {success}
- User's phone: "{phone}"
- API response message: "{api_msg}"
- User's message: "{user_message}"
- Language detected: {language}

Rules:
1. Mirror the user's language (Hinglish, English, or Telugu-English).
2. If OTP send succeeded: inform them that the OTP has been sent and they should enter the code.
3. If OTP send failed or phone is invalid: explain the error or ask them to provide a valid 10-digit mobile number.
4. Keep it brief, warm, and helpful (max 2 sentences).
5. Return only the plain conversational message, do not add any JSON or tags."""

    elif intent == "VERIFY_OTP":
        success = context_data.get("success", False)
        api_msg = context_data.get("api_msg", "")
        
        system_prompt = f"""You are Zara, a warm, witty, and natural dining assistant at Spice Garden.
Your job is to generate a conversational response after verification of OTP.

Context:
- Did OTP verification succeed?: {success}
- API response message: "{api_msg}"
- User's message: "{user_message}"
- Language detected: {language}

Rules:
1. Mirror the user's language (Hinglish, English, or Telugu-English).
2. If verification succeeded: tell them the order is confirmed and they are being redirected.
3. If verification failed: tell them the OTP is incorrect or expired, and ask them to try again.
4. Keep it brief, warm, and helpful (max 2 sentences).
5. Return only the plain conversational message, do not add any JSON or tags."""

    else:
        return "", ""

    return system_prompt, user_message


async def generate_zara_response(
    intent: str,
    user_message: str,
    language: str,
    context_data: dict,
    should_rephrase: bool = False
) -> str:
    system_prompt, _ = get_zara_prompt(intent, user_message, language, context_data, should_rephrase)
    if not system_prompt:
        return ""
        
    llm = ChatGroq(model=GROQ_MODEL, api_key=GROQ_API_KEY, temperature=0.5, max_tokens=100)
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_message)
    ]
    try:
        response = await llm.ainvoke(messages)
        return str(response.content).strip()
    except Exception as e:
        logger.error(f"Failed to generate Zara conversational response: {e}")
        return ""
