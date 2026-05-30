import json
import logging
import re
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_groq import ChatGroq
from config import GROQ_API_KEY, GROQ_MODEL
from models.schemas import NLUResult

logger = logging.getLogger(__name__)

NLU_SYSTEM_PROMPT = """You are a multilingual intent classifier for a restaurant ordering app called Spice Garden.
Classify the user message into exactly one intent.
Detect language.
Extract structured preferences and entities.

INTENTS:
- GREET: first message, hello, hi, greetings, namaskar, "kya haal"
- RECOMMEND: wants suggestions, browsing, asking what to order, "kya hai", "kya h", "show me", "suggest", "kuch dikhao", "batao", "menu me kya hai", "lunch me kya hai"
- ADD_ITEM: explicitly wants to add/order a SPECIFIC named dish. Keywords: add, put, order, "daal do", "laga do", "chahiye" with item name, "le lo", "de do"
- UPSELL_CHECK: what goes with X, complement queries, "kya pair hoga", "kya accha lagega", "kaisa lagega saath"
- GROUP_MERGE: mentions group size, 'we are N people', 'hamare liye', multiple people
- CHECKOUT: wants to place final order, pay, checkout, "order kar do", "order place kro", "bas itna", "order kro", "bill do", "place order", "confirm order", "that's all", "order kar", "place karo", "final order", "order de do", "ha kr do", "place it", "do it order"
- COLLECT_PHONE: user is providing their phone number (digits sequence that looks like a phone number)
- VERIFY_OTP: user is providing a 4-6 digit OTP code
- FALLBACK: anything else

PREFERENCES to extract: dairy_free, no_onions, veg_only, non_veg, spicy, light, filling, skip_dessert, sweet, bestseller
LANGUAGE: english, hinglish, telugu-english

IMPORTANT for ADD_ITEM:
- Extract the EXACT item name from the message into entities.item_name
- "add paneer tikka" -> item_name: "paneer tikka"
- "kulfi daal do" -> item_name: "kulfi"
- "mujhe chicken burger chahiye" -> item_name: "chicken burger"
- "naan order kar do" -> item_name: "naan"
- SPECIAL CASE: if message has BOTH a specific item name AND a checkout phrase like "order kar do / place kro / order kro", use ADD_ITEM and set entities.also_checkout=true
- "jeera rice order place kro" -> ADD_ITEM, item_name: "jeera rice", also_checkout: true
- "no just order jeera rice" -> ADD_ITEM, item_name: "jeera rice", also_checkout: true

IMPORTANT for CHECKOUT:
- "order kro", "bas order karo", "order kar do", "order place karo", "checkout karo", "bill do", "ha kr do", "place it", "do it order" -> CHECKOUT
- If JUST "order kro" or "order kar do" with NO specific named item -> CHECKOUT

IMPORTANT for RECOMMEND:
- "lunch me kya hai", "kya h menu me", "kuch batao", "kya order karu" -> RECOMMEND
- "kya accha hai", "best kya hai" -> RECOMMEND with bestseller=true

IMPORTANT for GROUP_MERGE:
- Extract group_size from numbers: "we are 4" -> group_size: 4

IMPORTANT for COLLECT_PHONE:
- If message is just digits (10+ digits) or looks like a phone number, intent=COLLECT_PHONE, entities.phone=the number

IMPORTANT for VERIFY_OTP:
- If message is 4-6 digits only or "otp is XXXXXX", intent=VERIFY_OTP, entities.otp=the digits

EXAMPLES:
- "kuch meetha chahiye" -> RECOMMEND, {"sweet": true}, hinglish
- "light snack do bhai" -> RECOMMEND, {"light": true}, hinglish
- "spicy chicken kuch hai" -> RECOMMEND, {"spicy": true, "non_veg": true}, hinglish
- "bas itna hi, order kar do" -> CHECKOUT, {}, hinglish
- "kya best hai yahan" -> RECOMMEND, {"bestseller": true}, hinglish
- "konchem spicy ga undali veg kaadu" -> RECOMMEND, {"spicy": true, "non_veg": true}, telugu-english
- "sumthing swt plz" -> RECOMMEND, {"sweet": true}, english
- "add paneer tikka" -> ADD_ITEM, {}, english, entities: {item_name: "paneer tikka"}
- "kulfi daal do" -> ADD_ITEM, {}, hinglish, entities: {item_name: "kulfi"}
- "jeera rice order place kro" -> ADD_ITEM, {}, hinglish, entities: {item_name: "jeera rice", also_checkout: true}
- "ise cart me daal do aur order place kr do" -> ADD_ITEM, {}, hinglish, entities: {item_name: "current_item", also_checkout: true}
- "just jeera rice" -> ADD_ITEM, {}, english, entities: {item_name: "jeera rice"}
- "cart me add kro" -> ADD_ITEM, {}, hinglish, entities: {item_name: "current_item"}
- "order kro" -> CHECKOUT, {}, hinglish
- "ha kr do" -> CHECKOUT, {}, hinglish
- "place it" -> CHECKOUT, {}, english
- "order kar do" -> CHECKOUT, {}, hinglish
- "9876543210" -> COLLECT_PHONE, {}, entities: {phone: "9876543210"}
- "123456" -> VERIFY_OTP, {}, entities: {otp: "123456"}
- "lunch me kya hai" -> RECOMMEND, {}, hinglish
- "menu me kya h" -> RECOMMEND, {}, hinglish
- "yes" -> FALLBACK, {} (ambiguous without context)

Return ONLY valid JSON, no other text:
{
  "intent": "RECOMMEND",
  "preferences": {"spicy": true},
  "language_detected": "hinglish",
  "raw_text": "original message",
  "entities": {"item_name": "paneer tikka", "group_size": 4, "phone": "", "otp": "", "also_checkout": false}
}"""

def _looks_like_phone(text: str) -> str | None:
    """Extract phone number if message is predominantly digits."""
    digits_only = re.sub(r'[\s\+\-\(\)]', '', text)
    if re.match(r'^\+?\d{10,13}$', digits_only):
        return digits_only
    return None

def _looks_like_otp(text: str) -> str | None:
    """Extract OTP if message is 4-6 digits."""
    stripped = text.strip()
    if re.match(r'^\d{4,6}$', stripped):
        return stripped
    m = re.search(r'\b(\d{4,6})\b', stripped)
    if m and len(m.group(1)) in (4, 5, 6):
        return m.group(1)
    return None

async def run_nlu(message: str, working_memory: str = "") -> NLUResult:
    # Quick regex checks for phone/OTP
    phone = _looks_like_phone(message)
    if phone:
        return NLUResult(
            intent="COLLECT_PHONE",
            preferences={},
            language_detected="hinglish",
            raw_text=message,
            entities={"phone": phone}
        )
        
    otp = _looks_like_otp(message)
    if otp:
        return NLUResult(
            intent="VERIFY_OTP",
            preferences={},
            language_detected="hinglish",
            raw_text=message,
            entities={"otp": otp}
        )

    # Use llama-3.3-70b-versatile via GROQ_MODEL
    llm = ChatGroq(model=GROQ_MODEL, api_key=GROQ_API_KEY, temperature=0.1, max_tokens=200)
    
    prompt = NLU_SYSTEM_PROMPT
    if working_memory:
        prompt += f"\n\nRECENT CONTEXT (use this to resolve pronouns like 'this', 'it', 'ise'):\n{working_memory}"
        
    messages = [
        SystemMessage(content=prompt),
        HumanMessage(content=message)
    ]
    try:
        response = await llm.ainvoke(messages)
        content = str(response.content).strip()
        
        if content.startswith("```json"):
            content = content.replace("```json", "").replace("```", "").strip()
        elif content.startswith("```"):
            content = content.replace("```", "").strip()
        
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            content = json_match.group(0)
            
        data = json.loads(content)
        return NLUResult(**data)
    except Exception as e:
        logger.error(f"NLU parsing failed: {e}")
        return NLUResult(
            intent="FALLBACK",
            preferences={},
            language_detected="english",
            raw_text=message,
            entities={}
        )
