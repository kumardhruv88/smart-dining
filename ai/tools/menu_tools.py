import httpx
import logging
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from config import NEXT_PUBLIC_APP_URL
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# In-memory cache for menu items
MENU_CACHE = []
vector_store = None

class MenuItem(BaseModel):
    id: str
    name: str
    description: str
    price: float
    category: str
    tags: list[str]
    popularScore: float
    isAvailable: bool = True
    imageUrl: str = ""
    complementaryIds: list[str] = []
    allergens: list[str] = []

embeddings = HuggingFaceEmbeddings(
    model_name="all-MiniLM-L6-v2",
    model_kwargs={"device": "cpu"}
)

def build_vector_store(menu_items: list) -> FAISS:
    texts = [
        f"{item['name']}. {item['description']}. Tags: {', '.join(item['tags'])}. Category: {item['category']}"
        for item in menu_items
    ]
    metadatas = [{"id": item["id"], "name": item["name"], "price": float(item["price"]), 
                  "category": item["category"], "tags": item["tags"], 
                  "allergens": item.get("allergens", []), "available": item.get("available", True),
                  "imageUrl": item.get("imageUrl", ""), "description": item["description"]}
                 for item in menu_items]
    
    vs = FAISS.from_texts(texts, embeddings, metadatas=metadatas)
    return vs

async def load_menu() -> None:
    global MENU_CACHE, vector_store
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{NEXT_PUBLIC_APP_URL}/api/menu")
            resp.raise_for_status()
            data = resp.json()
            
            # Handle wrapping dictionary
            if isinstance(data, dict) and "items" in data:
                items_list = data["items"]
            else:
                items_list = data

            parsed_items = []
            for item in items_list:
                # Map 'available' database field to 'isAvailable' pydantic field
                if "available" in item and "isAvailable" not in item:
                    item["isAvailable"] = item["available"]
                if "complementaryIds" not in item or item["complementaryIds"] is None:
                    item["complementaryIds"] = []
                parsed_items.append(MenuItem(**item))

            MENU_CACHE.clear()
            MENU_CACHE.extend(parsed_items)
            logger.info(f"Loaded {len(MENU_CACHE)} menu items from API.")
            
            vector_store = build_vector_store(items_list)
            logger.info("FAISS vector store initialized.")
    except Exception as e:
        logger.error(f"Failed to load menu from Next.js API: {e}")

def search_menu(query: str, filters: dict = {}) -> list[MenuItem]:
    global vector_store
    if not vector_store:
        return []

    results = vector_store.similarity_search(query, k=10)
    items = [doc.metadata for doc in results]
    
    # Apply filters
    if filters.get("veg"):
        items = [i for i in items if "veg" in i.get("tags", [])]
    if filters.get("non_veg"):
        items = [i for i in items if "non-veg" in i.get("tags", [])]
    if filters.get("spicy"):
        items = [i for i in items if "spicy" in i.get("tags", [])]
    if filters.get("light"):
        items = [i for i in items if "light" in i.get("tags", [])]
    if filters.get("exclude_allergens"):
        for allergen in filters["exclude_allergens"]:
            items = [i for i in items if allergen not in i.get("allergens", [])]
    
    # Filter unavailable
    items = [i for i in items if i.get("available", True)]
    
    # To prevent breaking other agents that expect MenuItem objects
    # we convert the dictionaries back to MenuItem objects via the MENU_CACHE
    final_items = []
    for doc in items[:10]:
        cached = next((i for i in MENU_CACHE if i.id == doc["id"]), None)
        if cached:
            final_items.append(cached)
            
    return final_items

def get_popular_items(time_of_day: str) -> list[MenuItem]:
    cat_map = {
        "breakfast": ["Beverages (Hot)"],
        "lunch": ["Mains (Veg)", "Mains (Non-Veg)"],
        "evening": ["Starters (Veg)", "Starters (Non-Veg)", "Beverages (Cold)"],
        "dinner": ["Mains (Veg)", "Mains (Non-Veg)", "Starters (Veg)", "Starters (Non-Veg)"]
    }
    allowed_categories = cat_map.get(time_of_day, [])
    
    filtered = [i for i in MENU_CACHE if i.isAvailable and i.category in allowed_categories]
    filtered.sort(key=lambda x: x.popularScore, reverse=True)
    return filtered[:5]

def get_complementary(item_id: str) -> list[MenuItem]:
    item = next((i for i in MENU_CACHE if i.id == item_id), None)
    if not item or not item.complementaryIds:
        return []
    
    comp_items = [i for i in MENU_CACHE if i.id in item.complementaryIds and i.isAvailable]
    return comp_items
