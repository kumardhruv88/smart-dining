import json
import logging
import re
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_groq import ChatGroq
from config import GROQ_MODEL, GROQ_API_KEY
from models.schemas import NLUResult

logger = logging.getLogger(__name__)

NLU_SYSTEM_PROMPT = """You are a multilingual intent classifier for a restaurant ordering app.
Classify the user message into exactly one intent.
Detect language.
Extract structured preferences and entities.

INTENTS:
- GREET: first message, hello, hi, greetings, namaskar
- RECOMMEND: wants suggestions, browsing, asking what to order, "kya hai", "show me", "suggest"
- ADD_ITEM: explicitly wants to add/order a SPECIFIC named dish. Keywords: add, put, order, "daal do", "laga do", "chahiye" with item name
- UPSELL_CHECK: what goes with X, complement queries
- GROUP_MERGE: mentions group size, 'we are N people', 'hamare liye', multiple people
- CHECKOUT: wants to place order, pay, checkout, 'that's all', 'order kar do', 'bas itna hi', 'bill do'
- COLLECT_PHONE: user is providing their phone number (digits sequence that looks like a phone number)
- VERIFY_OTP: user is providing a 4-6 digit OTP code
- FALLBACK: anything else

PREFERENCES to extract: dairy_free, no_onions, veg_only, non_veg, spicy, light, filling, skip_dessert, sweet, bestseller
LANGUAGE: english, hinglish, telugu-english

IMPORTANT for ADD_ITEM:
- Extract the EXACT item name from the message into entities.item_name
- "add paneer tikka" → item_name: "paneer tikka"
- "kulfi daal do" → item_name: "kulfi"
- "mujhe chicken burger chahiye" → item_name: "chicken burger"
- "naan order kar do" → item_name: "naan"

IMPORTANT for GROUP_MERGE:
- Extract group_size from numbers: "we are 4" → group_size: 4

IMPORTANT for COLLECT_PHONE:
- If message is just digits (10+ digits) or looks like a phone number, intent=COLLECT_PHONE, entities.phone=the number

IMPORTANT for VERIFY_OTP:
- If message is 4-6 digits only or "otp is XXXXXX", intent=VERIFY_OTP, entities.otp=the digits

EXAMPLES:
- "kuch meetha chahiye" → RECOMMEND, {"sweet": true}, hinglish
- "light snack do bhai" → RECOMMEND, {"light": true}, hinglish  
- "spicy chicken kuch hai" → RECOMMEND, {"spicy": true, "non_veg": true}, hinglish
- "bas itna hi, order kar do" → CHECKOUT, {}, hinglish
- "kya best hai yahan" → RECOMMEND, {"bestseller": true}, hinglish
- "konchem spicy ga undali veg kaadu" → RECOMMEND, {"spicy": true, "non_veg": true}, telugu-english
- "sumthing swt plz" → RECOMMEND, {"sweet": true}, english
- "add paneer tikka" → ADD_ITEM, {}, english, entities: {item_name: "paneer tikka"}
- "kulfi daal do" → ADD_ITEM, {}, hinglish, entities: {item_name: "kulfi"}
- "9876543210" → COLLECT_PHONE, {}, entities: {phone: "9876543210"}
- "123456" → VERIFY_OTP, {}, entities: {otp: "123456"}
- "yes" → FALLBACK, {} (ambiguous without context)

Return ONLY valid JSON, no other text:
{
  "intent": "RECOMMEND",
  "preferences": {"spicy": true},
  "language_detected": "hinglish",
  "raw_text": "original message",
  "entities": {"item_name": "paneer tikka", "group_size": 4, "phone": "", "otp": ""}
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
    # "otp is 123456" or "my otp: 123456"
    m = re.search(r'\b(\d{4,6})\b', stripped)
    if m and len(m.group(1)) in (4, 5, 6):
        return m.group(1)
    return None

async def run_nlu(message: str) -> NLUResult:
    # Fast-path: phone number detection (no LLM needed)
    phone = _looks_like_phone(message)
    if phone:
        return NLUResult(
            intent="COLLECT_PHONE",
            preferences={},
            language_detected="english",
            raw_text=message,
            entities={"phone": phone}
        )
    
    # Fast-path: OTP detection
    otp = _looks_like_otp(message)
    if otp and len(message.strip()) <= 10:  # short message = likely OTP
        return NLUResult(
            intent="VERIFY_OTP",
            preferences={},
            language_detected="english",
            raw_text=message,
            entities={"otp": otp}
        )

    llm = ChatGroq(model=GROQ_MODEL, api_key=GROQ_API_KEY, temperature=0.1, max_tokens=120)
    messages = [
        SystemMessage(content=NLU_SYSTEM_PROMPT),
        HumanMessage(content=message)
    ]
    try:
        response = await llm.ainvoke(messages)
        content = str(response.content).strip()
        
        if content.startswith("```json"):
            content = content.replace("```json", "").replace("```", "").strip()
        elif content.startswith("```"):
            content = content.replace("```", "").strip()
        
        # Extract JSON from response
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
