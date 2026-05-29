import json
from typing import Any
import redis.asyncio as aioredis
from config import REDIS_URL

_redis_client = None

async def get_redis() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = await aioredis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)
    return _redis_client

class SessionMemory:
    @staticmethod
    async def get(session_id: str) -> dict:
        r = await get_redis()
        data = await r.get(f"session:{session_id}:memory")
        if data:
            return json.loads(data)
        return {
            "conversation_summary": "",
            "preferences": {},
            "cart_snapshot": [],
            "group_size": 1,
            "language": "english"
        }

    @staticmethod
    async def update(session_id: str, key: str, value: Any) -> None:
        r = await get_redis()
        mem = await SessionMemory.get(session_id)
        mem[key] = value
        await r.set(f"session:{session_id}:memory", json.dumps(mem), ex=14400)  # 4 hours TTL

    @staticmethod
    async def get_working_memory(session_id: str) -> list:
        # Get the last 5 exchanges. Let's store exchanges in a Redis List.
        r = await get_redis()
        raw_list = await r.lrange(f"session:{session_id}:working_memory", 0, -1)
        return [json.loads(x) for x in raw_list]

    @staticmethod
    async def append_exchange(session_id: str, role: str, content: str) -> None:
        r = await get_redis()
        key = f"session:{session_id}:working_memory"
        exchange = json.dumps({"role": role, "content": content})
        await r.rpush(key, exchange)
        # Keep only the last 5 exchanges (which means 10 messages if each exchange is 2 messages? Let's say last 10 messages total)
        await r.ltrim(key, -10, -1)
        await r.expire(key, 14400)

    @staticmethod
    async def get_preferences(session_id: str) -> dict:
        mem = await SessionMemory.get(session_id)
        return mem.get("preferences", {})

    @staticmethod
    async def update_preference(session_id: str, key: str, value: Any) -> None:
        mem = await SessionMemory.get(session_id)
        prefs = mem.get("preferences", {})
        prefs[key] = value
        await SessionMemory.update(session_id, "preferences", prefs)
