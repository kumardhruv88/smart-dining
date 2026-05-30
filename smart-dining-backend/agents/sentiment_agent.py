import json
import logging
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_groq import ChatGroq
from config import GROQ_MODEL, GROQ_API_KEY
from memory.session_memory import SessionMemory

logger = logging.getLogger(__name__)

SENTIMENT_SYSTEM_PROMPT = """Classify the sentiment of this message from a restaurant customer.
Return ONLY valid JSON, no other text:
{"sentiment": "frustrated|confused|happy|neutral", "confidence": 0.0-1.0}

Rules:
- "frustrated": angry, annoyed, CAPS, swear words, complaints, "stop", "I don't want", "ugh", "why can't you"
- "confused": doesn't understand, asking same thing again, "what?", "how", "I don't get it"
- "happy": thank you, great, love it, awesome, perfect, 
- "neutral": normal requests, queries, browsing"""

async def monitor_sentiment(session_id: str, message: str) -> None:
    if len(message) <= 8:
        return

    llm = ChatGroq(model=GROQ_MODEL, api_key=GROQ_API_KEY, temperature=0.2, max_tokens=150)
    messages = [
        SystemMessage(content=SENTIMENT_SYSTEM_PROMPT),
        HumanMessage(content=message)
    ]
    try:
        response = await llm.ainvoke(messages)
        content = str(response.content).strip()

        # Parse JSON
        if content.startswith("```"):
            content = content.replace("```json", "").replace("```", "").strip()

        import re
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            content = json_match.group(0)

        data = json.loads(content)
        sentiment = data.get("sentiment", "neutral")

        # Get current session memory
        mem = await SessionMemory.get(session_id)
        prev_sentiment = mem.get("sentiment", "neutral")
        prev_neg_count = mem.get("negative_count", 0)

        # Track consecutive negative sentiments
        is_negative = sentiment in ("frustrated", "confused")
        if is_negative:
            neg_count = prev_neg_count + 1
        else:
            neg_count = 0  # Reset on positive/neutral

        # Trigger rephrase after 2+ consecutive negative messages
        should_rephrase = neg_count >= 2

        # If extremely frustrated (caps, exclamation, rude), rephrase immediately
        msg_has_caps = sum(1 for c in message if c.isupper()) > len(message) * 0.4
        has_frustration_words = any(w in message.lower() for w in [
            "stop", "dont want", "don't want", "ridiculous", "stupid", "useless",
            "confusing", "why cant", "why can't", "ugh", "argh", "!!!"
        ])
        if msg_has_caps or has_frustration_words:
            should_rephrase = True

        # Also rephrase after 4+ messages with no cart additions (hesitation detection)
        msg_count = mem.get("msg_count", 0) + 1
        cart_additions = mem.get("cart_additions", 0)
        if msg_count >= 4 and cart_additions == 0:
            should_rephrase = True

        await SessionMemory.update(session_id, "sentiment", sentiment)
        await SessionMemory.update(session_id, "negative_count", neg_count)
        await SessionMemory.update(session_id, "should_rephrase", should_rephrase)
        await SessionMemory.update(session_id, "msg_count", msg_count)

        logger.info(f"Sentiment [{session_id}]: {sentiment}, neg_count={neg_count}, should_rephrase={should_rephrase}")
    except Exception as e:
        logger.error(f"Sentiment tracking failed: {e}")
