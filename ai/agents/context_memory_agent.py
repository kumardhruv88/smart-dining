import logging
from memory.session_memory import SessionMemory

logger = logging.getLogger(__name__)

async def update_context(session_id: str, new_preferences: dict, detected_language: str, entities: dict, message: str = "") -> None:
    """Persist preferences, language and extracted entities to session memory."""
    # Merge in explicit preferences from NLU
    if new_preferences:
        for k, v in new_preferences.items():
            await SessionMemory.update_preference(session_id, k, v)

    # Detect and persist dislikes / exclusions from raw message text
    msg_lower = (message or "").lower()

    # Dietary restrictions
    if any(w in msg_lower for w in ["vegetarian", "veg hoon", "veg only", "no meat", "mein veg"]):
        await SessionMemory.update_preference(session_id, "veg_only", True)
    if any(w in msg_lower for w in ["no dairy", "dairy free", "lactose", "no milk", "doodh nahi"]):
        await SessionMemory.update_preference(session_id, "dairy_free", True)
    if any(w in msg_lower for w in ["no gluten", "gluten free", "wheat free"]):
        await SessionMemory.update_preference(session_id, "gluten_free", True)

    # Food aversions / hates
    hate_keywords = ["hate", "don't like", "dislike", "can't stand", "nahi chahiye",
                     "nahi chahte", "avoid", "not a fan", "se nafrat", "bura lagta"]
    if any(kw in msg_lower for kw in hate_keywords):
        if any(w in msg_lower for w in ["mushroom", "fungus"]):
            await SessionMemory.update_preference(session_id, "no_mushroom", True)
        if any(w in msg_lower for w in ["onion", "pyaaz"]):
            await SessionMemory.update_preference(session_id, "no_onions", True)
        if any(w in msg_lower for w in ["spicy", "spice", "hot", "teekha", "mirch"]):
            await SessionMemory.update_preference(session_id, "no_spicy", True)
        if any(w in msg_lower for w in ["dairy", "milk", "cream", "paneer", "cheese"]):
            await SessionMemory.update_preference(session_id, "dairy_free", True)

    # Skip dessert intent
    if any(w in msg_lower for w in ["skip dessert", "no dessert", "dessert mat", "meetha nahi",
                                     "nothing sweet", "no sweets", "don't want dessert"]):
        await SessionMemory.update_preference(session_id, "skip_dessert", True)

    # Persist language
    if detected_language:
        await SessionMemory.update(session_id, "language", detected_language)

    # Persist entities
    if "group_size" in entities:
        await SessionMemory.update(session_id, "group_size", entities["group_size"])

    logger.info(f"Context updated for session {session_id}")
