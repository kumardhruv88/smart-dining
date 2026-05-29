from pydantic import BaseModel
from typing import Optional

class ChatRequest(BaseModel):
    message: str
    sessionId: str
    tableId: str
    preferences: dict = {}
    cartSummary: dict = {}
    timeOfDay: str = "lunch"

class Suggestion(BaseModel):
    itemId: str
    name: str
    price: float
    reason: str
    imageUrl: str = ""

class ChatResponse(BaseModel):
    message: str
    suggestions: list[Suggestion] = []
    action: Optional[str] = None  # "add_to_cart", "show_checkout", etc.
    agentUsed: str = ""
    upsellSuggestion: Optional[str] = None

class NLUResult(BaseModel):
    intent: str  # GREET|RECOMMEND|ADD_ITEM|UPSELL_CHECK|GROUP_MERGE|CHECKOUT|FALLBACK
    preferences: dict
    language_detected: str  # english|hinglish|telugu-english
    raw_text: str
    entities: dict = {}
