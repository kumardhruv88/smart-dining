import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from config import NEXT_PUBLIC_APP_URL
from models.schemas import ChatRequest, ChatResponse
from tools.menu_tools import load_menu, MENU_CACHE
from agents.orchestrator import run_orchestrator, generate_zara_response
from agents.order_validation_agent import run_order_validation
from agents.upsell_agent import check_upsell_triggers
from memory.session_memory import get_redis
from tools.cart_tools import add_to_cart_by_name
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s — %(message)s")
logger = logging.getLogger("smart-dining-ai")

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Starting AI service lifespan...")
    await load_menu()
    
    # Initialize Redis
    await get_redis()
    
    n_menu = len(MENU_CACHE)
    n_embeds = 0
    # In a real scenario, chroma db ids count
    logger.info(f"AI service ready. {n_menu} menu items loaded, {n_embeds} embeddings indexed")
    yield
    # Cleanup
    r = await get_redis()
    if r:
        await r.aclose()

app = FastAPI(title="Smart Dining AI Microservice", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[NEXT_PUBLIC_APP_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "ok", "agents": 8, "vectorStore": "ready"}

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    if not MENU_CACHE:
        await load_menu()
    return await run_orchestrator(req)

@app.get("/stream")
async def stream_chat(
    message: str = Query(..., description="User message"),
    sessionId: str = Query(..., description="Session ID"),
    tableId: str = Query(..., description="Table ID"),
    timeOfDay: str = Query("lunch", description="Time of day"),
    cartSummary: str = Query("[]", description="Cart summary JSON"),
    preferences: str = Query("{}", description="Preferences JSON")
):
    if not MENU_CACHE:
        await load_menu()
    import json
    from langchain_core.messages import SystemMessage, HumanMessage
    from langchain_groq import ChatGroq
    from config import GROQ_MODEL, GROQ_API_KEY
    from agents.nlu_agent import run_nlu
    
    try:
        cart_data = json.loads(cartSummary)
        if isinstance(cart_data, dict):
            cart_list = cart_data.get("items", [])
            cart_total = cart_data.get("total", 0.0)
        else:
            cart_list = cart_data
            cart_total = sum(float(item.get("price", 0)) * (item.get("quantity") or item.get("qty", 1)) for item in cart_list)
    except:
        cart_list = []
        cart_total = 0.0
        
    try:
        prefs_dict = json.loads(preferences)
    except:
        prefs_dict = {}

    # 1. Run NLU first
    nlu_result = await run_nlu(message)
    logger.info(f"[Stream] Routed Intent: {nlu_result.intent}")

    # 1b. Read session memory for sentiment state and persisted preferences
    from memory.session_memory import SessionMemory
    session_mem = await SessionMemory.get(sessionId)
    should_rephrase = session_mem.get("should_rephrase", False)
    session_prefs = session_mem.get("preferences", {})
    # Merge session preferences with current turn preferences
    merged_prefs = {**session_prefs, **nlu_result.preferences}
    prefs_dict = {**prefs_dict, **merged_prefs}

    # Intercept generic ADD_ITEM intent and change to CHECKOUT
    if nlu_result.intent == "ADD_ITEM":
        item_name = nlu_result.entities.get("item_name")
        is_checkout_phrase = False
        message_lower = message.lower().strip()
        # Expanded Hinglish checkout phrases
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
            logger.info("[Stream] Redirected intent from ADD_ITEM to CHECKOUT due to generic order/checkout phrase.")

    if nlu_result.intent == "ADD_ITEM":
        # MENU_CACHE is imported at top level
        
        item_name = nlu_result.entities.get("item_name")
        if not item_name:
            cleaned_msg = message.lower()
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
                sessionId,
                tableId
            )
        
        upsell_msg = None
        if add_item_result.get("success") and add_item_result.get("item"):
            added_item = add_item_result["item"]
            last_item = {"id": added_item.id, "name": added_item.name}
            try:
                upsell_msg = await check_upsell_triggers(
                    cart_items=cart_list,
                    cart_total=cart_total,
                    time_of_day=timeOfDay,
                    last_added_item=last_item
                )
            except Exception as e:
                logger.error(f"Error checking upsell triggers in stream: {e}")
            
        from agents.orchestrator import get_zara_prompt
        
        system_prompt, user_msg = get_zara_prompt(
            intent="ADD_ITEM",
            user_message=message,
            language=nlu_result.language_detected,
            context_data={
                "item_name": item.name if item else item_name,
                "already_in_cart": already_in_cart,
                "upsell_msg": upsell_msg["message"] if (upsell_msg and isinstance(upsell_msg, dict)) else (upsell_msg or "")
            },
            should_rephrase=should_rephrase
        )
        
        suggestions = []
        if upsell_msg and isinstance(upsell_msg, dict):
            suggestions.append({
                "itemId": upsell_msg["itemId"],
                "name": upsell_msg["name"],
                "price": upsell_msg["price"],
                "reason": "Pairs perfectly!",
                "imageUrl": upsell_msg.get("imageUrl", "")
            })
            
        async def event_generator():
            if not system_prompt:
                if already_in_cart:
                    zara_msg = f"{item.name} is already in your cart. Would you like me to place the order now?"
                else:
                    zara_msg = add_item_result["message"] + "\n\nWould you like me to place the order now?"
                yield f"data: {json.dumps(zara_msg)}\n\n"
            else:
                llm = ChatGroq(model=GROQ_MODEL, api_key=GROQ_API_KEY, temperature=0.5, max_tokens=100, streaming=True)
                messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_msg)]
                try:
                    async for chunk in llm.astream(messages):
                        token = chunk.content
                        if token:
                            yield f"data: {json.dumps(token)}\n\n"
                except Exception as e:
                    logger.error(f"Stream error in ADD_ITEM: {e}")
                    
            if suggestions:
                meta = {"__json_meta": {"suggestions": suggestions}}
                yield f"data: {json.dumps(json.dumps(meta))}\n\n"
                
            yield "data: [DONE]\n\n"
            
        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream"
        )
        
    elif nlu_result.intent == "GREET":
        from agents.greeter_agent import run_greeter
        response = await run_greeter(message, nlu_result.language_detected)
        response_obj = {
            "message": response.message,
            "suggestions": []
        }
        
        async def event_generator_static():
            yield f"data: {json.dumps(json.dumps(response_obj))}\n\n"
            yield "data: [DONE]\n\n"
            
        return StreamingResponse(
            event_generator_static(),
            media_type="text/event-stream"
        )
 
    elif nlu_result.intent == "CHECKOUT":
        from agents.order_validation_agent import run_order_validation
        from agents.orchestrator import get_zara_prompt
        val_res = await run_order_validation(cart_list)
        
        system_prompt, user_msg = get_zara_prompt(
            intent="CHECKOUT",
            user_message=message,
            language=nlu_result.language_detected,
            context_data={"valid": val_res.get("valid"), "issues": val_res.get("issues", [])}
        )
        
        async def event_generator():
            if not system_prompt:
                if val_res.get("valid"):
                    zara_msg = "Your order looks perfect! To place the order, please provide your 10-digit mobile number."
                else:
                    issues = "\n".join(val_res.get("issues", []))
                    zara_msg = f"There are a few issues with your cart:\n{issues}"
                yield f"data: {json.dumps(zara_msg)}\n\n"
            else:
                llm = ChatGroq(model=GROQ_MODEL, api_key=GROQ_API_KEY, temperature=0.5, max_tokens=100, streaming=True)
                messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_msg)]
                try:
                    async for chunk in llm.astream(messages):
                        token = chunk.content
                        if token:
                            yield f"data: {json.dumps(token)}\n\n"
                except Exception as e:
                    logger.error(f"Stream error in CHECKOUT: {e}")
            yield "data: [DONE]\n\n"
            
        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream"
        )
 
    elif nlu_result.intent == "COLLECT_PHONE":
        from tools.checkout_tools import send_otp_via_chat
        from memory.session_memory import SessionMemory
        from agents.orchestrator import get_zara_prompt
        
        phone = nlu_result.entities.get("phone", "")
        if phone:
            res = await send_otp_via_chat(phone)
            await SessionMemory.update(sessionId, "checkout_phone", phone)
            system_prompt, user_msg = get_zara_prompt(
                intent="COLLECT_PHONE",
                user_message=message,
                language=nlu_result.language_detected,
                context_data={"phone": phone, "success": res.get("success", False), "api_msg": res.get("message", "")}
            )
            fallback_msg = res.get("message")
        else:
            system_prompt, user_msg = get_zara_prompt(
                intent="COLLECT_PHONE",
                user_message=message,
                language=nlu_result.language_detected,
                context_data={"phone": "", "success": False, "api_msg": ""}
            )
            fallback_msg = "I couldn't quite catch your phone number. Could you please provide a valid 10-digit number?"
            
        async def event_generator():
            if not system_prompt:
                yield f"data: {json.dumps(fallback_msg)}\n\n"
            else:
                llm = ChatGroq(model=GROQ_MODEL, api_key=GROQ_API_KEY, temperature=0.5, max_tokens=100, streaming=True)
                messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_msg)]
                try:
                    async for chunk in llm.astream(messages):
                        token = chunk.content
                        if token:
                            yield f"data: {json.dumps(token)}\n\n"
                except Exception as e:
                    logger.error(f"Stream error in COLLECT_PHONE: {e}")
            yield "data: [DONE]\n\n"
            
        return StreamingResponse(event_generator(), media_type="text/event-stream")
 
    elif nlu_result.intent == "VERIFY_OTP":
        from tools.checkout_tools import verify_otp_via_chat, place_order_via_chat
        from memory.session_memory import SessionMemory
        mem = await SessionMemory.get(sessionId)
        phone = mem.get("checkout_phone")
        otp = nlu_result.entities.get("otp", "")
        
        if not phone:
            async def event_generator_fail():
                yield f"data: {json.dumps('Please provide your mobile number first so I can send you an OTP.')}\n\n"
                yield "data: [DONE]\n\n"
            return StreamingResponse(event_generator_fail(), media_type="text/event-stream")
            
        res = await verify_otp_via_chat(phone, otp)
        action = None
        clear_cart = False
        
        if res.get("success"):
            # Pass tableId so redirect URL is correct
            order_res = await place_order_via_chat(sessionId, "Guest", phone, res.get("token"), table_id=tableId)
            fallback_msg = order_res.get("message", "Your order has been placed successfully!")
            if order_res.get("redirectUrl"):
                action = f"redirect:{order_res['redirectUrl']}"
            clear_cart = order_res.get("clearCart", False)
        else:
            fallback_msg = res.get("message", "OTP verification failed. Please try again.")
            
        async def event_generator():
            # Stream message word by word for natural feel
            words = fallback_msg.split(" ")
            for i, word in enumerate(words):
                token = (word + " ") if i < len(words) - 1 else word
                yield f"data: {json.dumps(token)}\n\n"
                    
            # Send action + clearCart as meta so frontend can redirect and clear cart
            if action or clear_cart:
                meta_payload: dict = {}
                if action:
                    meta_payload["action"] = action
                if clear_cart:
                    meta_payload["clearCart"] = True
                meta = {"__json_meta": meta_payload}
                yield f"data: {json.dumps(json.dumps(meta))}\n\n"
            yield "data: [DONE]\n\n"
            
        return StreamingResponse(event_generator(), media_type="text/event-stream")

    elif nlu_result.intent == "GROUP_MERGE":
        from agents.group_coordinator_agent import run_group_coordinator
        group_size = nlu_result.entities.get("group_size", 4)
        response = await run_group_coordinator(message, cart_list, group_size)
        
        response_obj = {
            "message": response.message,
            "suggestions": [
                {
                    "itemId": s.itemId,
                    "name": s.name,
                    "price": s.price,
                    "reason": s.reason,
                    "imageUrl": getattr(s, "imageUrl", "")
                } for s in response.suggestions
            ] if response.suggestions else []
        }
        
        async def event_generator_static():
            yield f"data: {json.dumps(json.dumps(response_obj))}\n\n"
            yield "data: [DONE]\n\n"
            
        return StreamingResponse(
            event_generator_static(),
            media_type="text/event-stream"
        )

    elif nlu_result.intent == "UPSELL_CHECK":
        from agents.upsell_agent import check_upsell_triggers
        upsell_msg = await check_upsell_triggers(
            cart_list,
            cart_total,
            timeOfDay,
            intent=nlu_result.intent
        )
        if upsell_msg:
            response_obj = {
                "message": upsell_msg["message"],
                "suggestions": [
                    {
                        "itemId": upsell_msg["itemId"],
                        "name": upsell_msg["name"],
                        "price": upsell_msg["price"],
                        "reason": "Pairs perfectly!",
                        "imageUrl": upsell_msg.get("imageUrl", "")
                    }
                ]
            }
        else:
            response_obj = {
                "message": "Is there anything else I can get for you?",
                "suggestions": []
            }
        
        async def event_generator_static():
            yield f"data: {json.dumps(json.dumps(response_obj))}\n\n"
            yield "data: [DONE]\n\n"
            
        return StreamingResponse(
            event_generator_static(),
            media_type="text/event-stream"
        )

    elif nlu_result.intent == "RECOMMEND":
        from agents.recommendation_agent import run_recommendation
        
        # run_recommendation handles all filtering (allergens, skip_dessert, veg/non-veg, etc.)
        rec_response = await run_recommendation(
            message=message,
            time_of_day=timeOfDay,
            preferences=prefs_dict,  # Already merged with session prefs above
            cart_summary=cart_list
        )
        
        response_obj = {
            "message": rec_response.message,
            "suggestions": [
                {
                    "itemId": s.itemId,
                    "name": s.name,
                    "price": s.price,
                    "reason": s.reason,
                    "imageUrl": getattr(s, "imageUrl", "")
                } for s in (rec_response.suggestions or [])
            ]
        }
        
        async def event_generator():
            # Stream the message word by word for natural feel, then send JSON meta
            words = rec_response.message.split(" ")
            for i, word in enumerate(words):
                token = (word + " ") if i < len(words) - 1 else word
                yield f"data: {json.dumps(token)}\n\n"
            
            # Send suggestions as metadata
            if response_obj["suggestions"]:
                meta = {"__json_meta": {"suggestions": response_obj["suggestions"]}}
                yield f"data: {json.dumps(json.dumps(meta))}\n\n"
            yield "data: [DONE]\n\n"
        
        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream"
        )

    else: # FALLBACK
        fallback_prompt = "You are a dining assistant. A user said something off-script or general. Give a polite, helpful response keeping it dining-related."
        
        llm = ChatGroq(model=GROQ_MODEL, api_key=GROQ_API_KEY, temperature=0.5, max_tokens=200, streaming=True)
        messages = [
            SystemMessage(content=fallback_prompt),
            HumanMessage(content=message)
        ]
        
        async def event_generator():
            try:
                async for chunk in llm.astream(messages):
                    token = chunk.content
                    if token:
                        token_esc = json.dumps(token)
                        yield f"data: {token_esc}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as e:
                logger.error(f"Stream error: {e}")
                yield f"data: {json.dumps(str(e))}\n\n"

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream"
        )

class ValidateOrderReq(BaseModel):
    sessionId: str
    cartItems: list
    tableId: str

@app.post("/validate-order")
async def validate_order(req: ValidateOrderReq):
    return await run_order_validation(req.cartItems)

class UpsellCheckReq(BaseModel):
    sessionId: str
    lastAddedItemId: str = ""
    cartItems: list
    cartTotal: float
    timeOfDay: str

@app.post("/upsell-check")
async def upsell_endpoint(req: UpsellCheckReq):
    last_item = None
    if req.lastAddedItemId:
        last_item = {"id": req.lastAddedItemId, "name": "Item"}
    
    suggestion = await check_upsell_triggers(req.cartItems, req.cartTotal, req.timeOfDay, last_added_item=last_item)
    return {"suggestion": suggestion}
