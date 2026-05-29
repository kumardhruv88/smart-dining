import logging
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_groq import ChatGroq
from config import GROQ_MODEL, GROQ_API_KEY
from models.schemas import ChatResponse

logger = logging.getLogger(__name__)

GREETER_SYSTEM_PROMPT = """You are Zara, a warm and witty dining assistant at [Restaurant Name].
Welcome the user. Ask ONE question about their preference today.
Keep it to 1-2 sentences max. Be warm, never robotic.
Never say 'I am an AI'.
If they used Hinglish, respond in Hinglish. If English, respond in English."""

async def run_greeter(message: str, language: str) -> ChatResponse:
    llm = ChatGroq(model=GROQ_MODEL, api_key=GROQ_API_KEY, temperature=0.8, max_tokens=150)
    
    prompt = f"{GREETER_SYSTEM_PROMPT}\nUser language detected: {language}"
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
