from memory.session_memory import SessionMemory

async def get_session_context(session_id: str) -> dict:
    return await SessionMemory.get(session_id)

async def update_preference(session_id: str, key: str, value: any) -> None:
    await SessionMemory.update_preference(session_id, key, value)
