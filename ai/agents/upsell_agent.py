import logging
from tools.menu_tools import get_complementary, get_popular_items, search_menu, MENU_CACHE

logger = logging.getLogger(__name__)

def make_suggestion(message: str, item) -> dict:
    return {
        "message": message,
        "itemId": item.id,
        "name": item.name,
        "price": float(item.price),
        "imageUrl": getattr(item, "imageUrl", "") or ""
    }

async def check_upsell_triggers(cart_items: list, cart_total: float, time_of_day: str, last_added_item=None, intent=None) -> dict | None:
    def get_item_prop(item, prop_name):
        aliases = [prop_name]
        if prop_name == "id":
            aliases.extend(["itemId", "menuItemId"])
        elif prop_name == "itemId":
            aliases.extend(["id", "menuItemId"])
        elif prop_name == "menuItemId":
            aliases.extend(["itemId", "id"])
        elif prop_name == "quantity":
            aliases.extend(["qty"])
        elif prop_name == "qty":
            aliases.extend(["quantity"])
        elif prop_name == "category":
            # Also check nested menuItem object
            pass

        for alias in aliases:
            if alias in item:
                return item[alias]
            if "menuItem" in item and isinstance(item["menuItem"], dict) and alias in item["menuItem"]:
                return item["menuItem"][alias]
        return None

    # ─────────────────────────────────────────────────────────────────
    # Trigger 1 — After any add_to_cart: show complementary item
    # ─────────────────────────────────────────────────────────────────
    if last_added_item:
        item_id = last_added_item.get("id") or last_added_item.get("itemId") or last_added_item.get("menuItemId")
        complementary = get_complementary(item_id) if item_id else []
        if complementary:
            comp = complementary[0]
            already_in_cart = any(
                get_item_prop(ci, "id") == comp.id or get_item_prop(ci, "menuItemId") == comp.id
                for ci in cart_items
            )
            if not already_in_cart:
                return make_suggestion(
                    f"Great choice! Most people pair {last_added_item.get('name')} with {comp.name}. Want to add it?",
                    comp
                )

    # ─────────────────────────────────────────────────────────────────
    # Trigger 2 — Cart total approaching ₹500 (between ₹400 and ₹499)
    # Encourage the user to cross the threshold for Meal Deal
    # ─────────────────────────────────────────────────────────────────
    if 400 <= cart_total < 500:
        remaining = 500 - cart_total
        populars = get_popular_items(time_of_day)
        if populars:
            # Find an item that would push them over ₹500 and isn't in cart
            candidate = next(
                (p for p in populars
                 if not any(get_item_prop(ci, "id") == p.id or get_item_prop(ci, "menuItemId") == p.id for ci in cart_items)),
                None
            )
            if candidate:
                return make_suggestion(
                    f"You're just ₹{int(remaining)} away from our Meal Deal! Add {candidate.name} to unlock it.",
                    candidate
                )
    
    # Trigger 2b — Cart crossed ₹500 already: celebrate + suggest high value
    if cart_total >= 500:
        populars = get_popular_items(time_of_day)
        if populars:
            high_value = next(
                (p for p in populars
                 if not any(get_item_prop(ci, "id") == p.id or get_item_prop(ci, "menuItemId") == p.id for ci in cart_items)),
                None
            )
            if high_value:
                return make_suggestion(
                    f"You've unlocked the Meal Deal! Why not add {high_value.name} to make it perfect?",
                    high_value
                )

    # ─────────────────────────────────────────────────────────────────
    # Trigger 3 — Cart has mains but NO beverages
    # ─────────────────────────────────────────────────────────────────
    if cart_items:
        def get_category(item):
            cat = get_item_prop(item, "category") or ""
            if cat:
                return cat.lower()
            # Look up in MENU_CACHE by item ID
            item_id = get_item_prop(item, "id") or get_item_prop(item, "menuItemId")
            if item_id:
                cached = next((m for m in MENU_CACHE if m.id == item_id), None)
                if cached:
                    return cached.category.lower()
            return ""

        has_main = any("main" in get_category(item) for item in cart_items)
        has_drink = any(
            any(kw in get_category(item) for kw in ["beverage", "drink", "cold", "hot", "juice", "lassi"])
            for item in cart_items
        )

        if has_main and not has_drink:
            # Search specifically for beverages
            beverages = [i for i in MENU_CACHE if i.isAvailable and "beverage" in i.category.lower()]
            if not beverages:
                beverages = search_menu("cold drink refreshing beverage lassi juice", {})
            if beverages:
                # Pick the most popular one not already in cart
                cart_ids = {get_item_prop(ci, "id") or get_item_prop(ci, "menuItemId") for ci in cart_items}
                bev = next((b for b in beverages if b.id not in cart_ids), None)
                if bev:
                    return make_suggestion(
                        f"Looks like you're missing a drink! {bev.name} pairs perfectly with your order. Want to add it?",
                        bev
                    )

    # ─────────────────────────────────────────────────────────────────
    # Trigger 4 — Cart has only veg items (and has 2+ items)
    # ─────────────────────────────────────────────────────────────────
    if cart_items and len(cart_items) >= 2:
        def is_item_veg(item):
            item_id = get_item_prop(item, "id") or get_item_prop(item, "menuItemId")
            # Look up in MENU_CACHE for accurate tags
            cached = next((m for m in MENU_CACHE if m.id == item_id), None)
            if cached:
                tags = cached.tags
            else:
                tags = get_item_prop(item, "tags") or []
            return any("veg" in str(t).lower() and "non-veg" not in str(t).lower() for t in tags)

        all_veg = all(is_item_veg(item) for item in cart_items)
        if all_veg:
            cart_ids = {get_item_prop(ci, "id") or get_item_prop(ci, "menuItemId") for ci in cart_items}
            non_veg_items = [i for i in MENU_CACHE if i.isAvailable and "non-veg" in i.tags and i.id not in cart_ids]
            if not non_veg_items:
                non_veg_items = search_menu("non-veg chef special", {"non_veg": True})
            if non_veg_items:
                pick = max(non_veg_items, key=lambda x: x.popularScore)
                return make_suggestion(
                    f"Feeling adventurous? Our {pick.name} is today's chef special — loved by non-veg fans!",
                    pick
                )

    # ─────────────────────────────────────────────────────────────────
    # Trigger 5 — Evening time (4–7 PM IST): dessert special
    # ─────────────────────────────────────────────────────────────────
    from datetime import datetime, timedelta
    ist_time = datetime.utcnow() + timedelta(hours=5, minutes=30)
    if 16 <= ist_time.hour <= 19:
        already_has_dessert = any(
            "dessert" in str(get_item_prop(item, "category") or "").lower()
            for item in cart_items
        )
        if not already_has_dessert:
            # Search desserts from MENU_CACHE directly
            desserts = [i for i in MENU_CACHE if i.isAvailable and "dessert" in i.category.lower()]
            if not desserts:
                desserts = search_menu("dessert sweet kulfi", {})
            if desserts:
                pick = max(desserts, key=lambda x: x.popularScore)
                return make_suggestion(
                    f"Evening special: {pick.name} is half-price until 8 PM. Don't miss out!",
                    pick
                )

    # ─────────────────────────────────────────────────────────────────
    # Trigger 6 — User says "that's all" / CHECKOUT intent
    # ─────────────────────────────────────────────────────────────────
    if intent == "CHECKOUT":
        populars = get_popular_items(time_of_day)
        if populars:
            cart_ids = {get_item_prop(ci, "id") or get_item_prop(ci, "menuItemId") for ci in cart_items}
            high_margin = next((p for p in populars if p.id not in cart_ids), None)
            if high_margin:
                return make_suggestion(
                    f"Before you go — {high_margin.name} takes only 5 mins and pairs perfectly with what you have!",
                    high_margin
                )

    return None
