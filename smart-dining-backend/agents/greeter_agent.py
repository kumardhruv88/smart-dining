import logging
import json
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_groq import ChatGroq
from models.schemas import ChatResponse
from config import GROQ_API_KEY, GROQ_MODEL
from tools.menu_tools import get_popular_items

logger = logging.getLogger(__name__)

GREETER_SYSTEM_PROMPT = """You are Zara, a warm and witty dining assistant at Spice Garden.
1. Welcome the user warmly. 
2. Ask ONE question about their preference today or what they are in the mood for.
3. Keep it VERY concise. Max 2 short sentences.
4. Do NOT say things like 'I completely understand' or 'I'm here to help'. Be direct and friendly like a knowledgeable friend.
5. Never say 'I am an AI'.
6. If the user language is Hinglish, respond in Hinglish using Roman script ONLY (NO Devanagari/Hindi fonts). 
   Example Hinglish: "Kya haal hai! Main Zara hoon — aaj khane mein kya loge? Spice Garden ke yeh kuch bestsellers hain:"
7. If the user language is English, respond in English.
8. Weave the provided popular items naturally into your greeting, or just present them after your greeting.

Popular items to suggest right now:
{popular_items}"""

async def run_greeter(message: str, language: str) -> ChatResponse:
    # Get top 3 popular items for right now
    popular = get_popular_items("lunch")[:3]
    popular_str = ", ".join([f"{i.name} (₹{i.price})" for i in popular])
    
    llm = ChatGroq(model=GROQ_MODEL, api_key=GROQ_API_KEY, temperature=0.7, max_tokens=150)
    
    prompt = GREETER_SYSTEM_PROMPT.replace("{popular_items}", popular_str)
    prompt = f"{prompt}\n\nUser language detected: {language}"
    
    messages = [
        SystemMessage(content=prompt),
        HumanMessage(content=message)
    ]
    
    response = await llm.ainvoke(messages)
    return ChatResponse(
        message=str(response.content).strip(),
        suggestions=[],
        action=None,
        agentUsed="greeter_agent"
    )
