/**
 * prisma/seed.ts
 *
 * Seeds the database with 30 menu items spread across 9 categories.
 * Run via: npm run db:seed
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns a random float in [min, max] rounded to 2 decimal places */
function rnd(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

const MENU_IMAGES: Record<string, string> = {
  "Paneer Tikka": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&q=80",
  "Hara Bhara Kabab": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80",
  "Veg Spring Roll": "https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=600&q=80",
  "Crispy Corn": "https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=600&q=80",
  "Chilli Chicken Bites": "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600&q=80",
  "Tandoori Fish Tikka": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&q=80",
  "Prawn Pepper Fry": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
  "Chicken Wings": "https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=600&q=80",
  "Butter Paneer": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&q=80",
  "Dal Makhani": "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&q=80",
  "Palak Tofu": "https://images.unsplash.com/photo-1574484284002-952d92456975?w=600&q=80",
  "Veg Biryani": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&q=80",
  "Chicken Biryani": "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=600&q=80",
  "Mutton Rogan Josh": "https://images.unsplash.com/photo-1545247181-516773cae754?w=600&q=80",
  "Prawn Masala": "https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=600&q=80",
  "Fish Curry": "https://images.unsplash.com/photo-1626509653291-18d9a934b9db?w=600&q=80",
  "Masala Naan": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&q=80",
  "Garlic Naan": "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&q=80",
  "Jeera Rice": "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=600&q=80",
  "Gulab Jamun": "https://images.unsplash.com/photo-1627308595229-7830a5c18106?w=600&q=80",
  "Mango Kulfi": "https://images.unsplash.com/photo-1488900128323-21503983a07e?w=600&q=80",
  "Chocolate Lava Cake": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&q=80",
  "Masala Chai": "https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?w=600&q=80",
  "Filter Coffee": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80",
  "Green Tea": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&q=80",
  "Mango Lassi": "https://images.unsplash.com/photo-1527156231393-7023794f363c?w=600&q=80",
  "Mint Lemonade": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&q=80",
  "Cold Coffee": "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&q=80",
  "Combo A — Classic Meal": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&q=80",
  "Combo B — Feast for Two": "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=600&q=80",
}

function imgUrl(name: string): string {
  return MENU_IMAGES[name] ?? `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80`
}

// ─────────────────────────────────────────────────────────────────────────────
// Menu item definitions (IDs are stable UUIDs so complementaryIds can ref them)
// ─────────────────────────────────────────────────────────────────────────────

type RawItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  tags: string[];
  allergens: string[];
  complementaryIds: string[];
  popularScore: number;
};

const ITEMS: RawItem[] = [
  // ─── Veg Starters (4) ────────────────────────────────────────────────────
  {
    id: "vs-001",
    name: "Paneer Tikka",
    category: "Veg Starters",
    price: 299,
    description:
      "Smoky cottage cheese cubes marinated in yoghurt & spices, grilled in a tandoor.",
    tags: ["veg", "spicy", "bestseller", "chef-special"],
    allergens: ["dairy"],
    complementaryIds: ["vs-002", "br-001", "bev-cold-001"],
    popularScore: rnd(0.4, 0.99),
  },
  {
    id: "vs-002",
    name: "Hara Bhara Kabab",
    category: "Veg Starters",
    price: 249,
    description:
      "Crispy spinach & pea patties with herbs, served with mint chutney.",
    tags: ["veg", "light", "quick-serve", "dairy-free"],
    allergens: ["gluten"],
    complementaryIds: ["vs-001", "bev-hot-003", "br-003"],
    popularScore: rnd(0.4, 0.99),
  },
  {
    id: "vs-003",
    name: "Veg Spring Roll",
    category: "Veg Starters",
    price: 219,
    description:
      "Golden crispy rolls stuffed with stir-fried vegetables & noodles.",
    tags: ["veg", "light", "quick-serve", "shareable"],
    allergens: ["gluten", "soy"],
    complementaryIds: ["vs-004", "bev-cold-002", "bev-hot-001"],
    popularScore: rnd(0.4, 0.99),
  },
  {
    id: "vs-004",
    name: "Crispy Corn",
    category: "Veg Starters",
    price: 199,
    description:
      "Fried sweet corn tossed with chilli, lemon, pepper & coriander.",
    tags: ["veg", "spicy", "quick-serve", "dairy-free"],
    allergens: [],
    complementaryIds: ["vs-003", "bev-cold-003", "bev-hot-002"],
    popularScore: rnd(0.4, 0.99),
  },

  // ─── Non-Veg Starters (4) ─────────────────────────────────────────────────
  {
    id: "nvs-001",
    name: "Chilli Chicken Bites",
    category: "Non-Veg Starters",
    price: 349,
    description:
      "Juicy chicken pieces tossed in Indo-Chinese chilli sauce, spring onions & peppers.",
    tags: ["non-veg", "spicy", "bestseller", "shareable"],
    allergens: ["soy", "eggs"],
    complementaryIds: ["nvs-002", "bev-cold-001", "br-002"],
    popularScore: rnd(0.4, 0.99),
  },
  {
    id: "nvs-002",
    name: "Tandoori Fish Tikka",
    category: "Non-Veg Starters",
    price: 399,
    description:
      "Tender fish marinated in tandoori masala, grilled to perfection with charred lemon.",
    tags: ["non-veg", "spicy", "chef-special", "quick-serve"],
    allergens: [],
    complementaryIds: ["nvs-001", "br-001", "bev-cold-002"],
    popularScore: rnd(0.4, 0.99),
  },
  {
    id: "nvs-003",
    name: "Prawn Pepper Fry",
    category: "Non-Veg Starters",
    price: 449,
    description:
      "Succulent prawns sautéed with freshly ground black pepper, curry leaves & shallots.",
    tags: ["non-veg", "spicy", "bestseller", "dairy-free"],
    allergens: ["shellfish"],
    complementaryIds: ["nvm-003", "br-003", "bev-cold-003"],
    popularScore: rnd(0.4, 0.99),
  },
  {
    id: "nvs-004",
    name: "Chicken Wings",
    category: "Non-Veg Starters",
    price: 329,
    description:
      "Sticky glazed wings marinated in honey, chilli & garlic, baked & finished on grill.",
    tags: ["non-veg", "spicy", "shareable", "bestseller"],
    allergens: ["gluten", "soy"],
    complementaryIds: ["nvs-001", "bev-cold-001", "bev-cold-003"],
    popularScore: rnd(0.4, 0.99),
  },

  // ─── Mains Veg (4) ────────────────────────────────────────────────────────
  {
    id: "mv-001",
    name: "Butter Paneer",
    category: "Mains Veg",
    price: 359,
    description:
      "Rich & creamy tomato-based curry with soft paneer cubes, kissed with butter & cream.",
    tags: ["veg", "bestseller", "filling", "chef-special"],
    allergens: ["dairy"],
    complementaryIds: ["br-001", "br-002", "br-003"],
    popularScore: rnd(0.4, 0.99),
  },
  {
    id: "mv-002",
    name: "Dal Makhani",
    category: "Mains Veg",
    price: 319,
    description:
      "Slow-cooked black lentils & kidney beans simmered overnight in butter & cream.",
    tags: ["veg", "filling", "chef-special", "bestseller"],
    allergens: ["dairy"],
    complementaryIds: ["br-001", "br-002", "mv-004"],
    popularScore: rnd(0.4, 0.99),
  },
  {
    id: "mv-003",
    name: "Palak Tofu",
    category: "Mains Veg",
    price: 339,
    description:
      "Silken tofu in velvety spinach & spice gravy, a protein-rich vegan delight.",
    tags: ["veg", "dairy-free", "light", "chef-special"],
    allergens: ["soy"],
    complementaryIds: ["mv-004", "br-003", "bev-hot-003"],
    popularScore: rnd(0.4, 0.99),
  },
  {
    id: "mv-004",
    name: "Veg Biryani",
    category: "Mains Veg",
    price: 299,
    description:
      "Fragrant basmati rice layered with seasonal vegetables, saffron & whole spices.",
    tags: ["veg", "filling", "bestseller", "shareable"],
    allergens: ["dairy", "nuts"],
    complementaryIds: ["mv-001", "mv-002", "bev-cold-001"],
    popularScore: rnd(0.4, 0.99),
  },

  // ─── Mains Non-Veg (4) ────────────────────────────────────────────────────
  {
    id: "nvm-001",
    name: "Chicken Biryani",
    category: "Mains Non-Veg",
    price: 379,
    description:
      "Hyderabadi-style dum biryani with tender chicken, caramelised onions & saffron.",
    tags: ["non-veg", "filling", "bestseller", "chef-special"],
    allergens: ["dairy", "nuts"],
    complementaryIds: ["nvm-002", "bev-cold-001", "des-001"],
    popularScore: rnd(0.4, 0.99),
  },
  {
    id: "nvm-002",
    name: "Mutton Rogan Josh",
    category: "Mains Non-Veg",
    price: 499,
    description:
      "Kashmiri slow-braised mutton in aromatic Rogan Josh spices with a rich red gravy.",
    tags: ["non-veg", "spicy", "filling", "chef-special"],
    allergens: ["dairy"],
    complementaryIds: ["br-001", "br-002", "bev-cold-002"],
    popularScore: rnd(0.4, 0.99),
  },
  {
    id: "nvm-003",
    name: "Prawn Masala",
    category: "Mains Non-Veg",
    price: 549,
    description:
      "Coastal-style prawns in a robust coconut & tomato masala, served with lemon.",
    tags: ["non-veg", "spicy", "bestseller", "dairy-free"],
    allergens: ["shellfish"],
    complementaryIds: ["br-003", "nvm-004", "bev-cold-003"],
    popularScore: rnd(0.4, 0.99),
  },
  {
    id: "nvm-004",
    name: "Fish Curry",
    category: "Mains Non-Veg",
    price: 449,
    description:
      "Kerala-style fish curry in tangy raw-mango coconut gravy with mustard tempering.",
    tags: ["non-veg", "spicy", "dairy-free", "chef-special"],
    allergens: [],
    complementaryIds: ["br-003", "nvm-003", "bev-hot-002"],
    popularScore: rnd(0.4, 0.99),
  },

  // ─── Breads & Rice (3) ────────────────────────────────────────────────────
  {
    id: "br-001",
    name: "Masala Naan",
    category: "Breads & Rice",
    price: 89,
    description:
      "Leavened flatbread stuffed with spiced onion filling, baked in tandoor.",
    tags: ["veg", "filling", "quick-serve", "bestseller"],
    allergens: ["gluten", "dairy"],
    complementaryIds: ["mv-001", "mv-002", "nvm-002"],
    popularScore: rnd(0.4, 0.99),
  },
  {
    id: "br-002",
    name: "Garlic Naan",
    category: "Breads & Rice",
    price: 79,
    description:
      "Soft fluffy naan topped with roasted garlic butter & fresh coriander.",
    tags: ["veg", "quick-serve", "bestseller"],
    allergens: ["gluten", "dairy"],
    complementaryIds: ["mv-001", "nvm-001", "nvm-002"],
    popularScore: rnd(0.4, 0.99),
  },
  {
    id: "br-003",
    name: "Jeera Rice",
    category: "Breads & Rice",
    price: 149,
    description:
      "Fragrant basmati rice tempered with cumin seeds, ghee & a hint of whole spices.",
    tags: ["veg", "light", "quick-serve", "dairy-free"],
    allergens: [],
    complementaryIds: ["mv-002", "nvm-003", "nvm-004"],
    popularScore: rnd(0.4, 0.99),
  },

  // ─── Desserts (3) ─────────────────────────────────────────────────────────
  {
    id: "des-001",
    name: "Gulab Jamun",
    category: "Desserts",
    price: 149,
    description:
      "Warm milk-solid dumplings soaked in rose-scented sugar syrup, served with rabri.",
    tags: ["veg", "bestseller", "filling"],
    allergens: ["dairy", "gluten"],
    complementaryIds: ["des-002", "bev-hot-001", "bev-hot-002"],
    popularScore: rnd(0.4, 0.99),
  },
  {
    id: "des-002",
    name: "Mango Kulfi",
    category: "Desserts",
    price: 169,
    description:
      "Creamy traditional Indian ice cream with real Alphonso mango pulp & pistachios.",
    tags: ["veg", "bestseller", "chef-special"],
    allergens: ["dairy", "nuts"],
    complementaryIds: ["des-001", "des-003", "bev-cold-001"],
    popularScore: rnd(0.4, 0.99),
  },
  {
    id: "des-003",
    name: "Chocolate Lava Cake",
    category: "Desserts",
    price: 249,
    description:
      "Warm chocolate cake with a molten centre, served with a scoop of vanilla ice cream.",
    tags: ["veg", "bestseller", "chef-special"],
    allergens: ["dairy", "eggs", "gluten"],
    complementaryIds: ["des-001", "des-002", "bev-hot-002"],
    popularScore: rnd(0.4, 0.99),
  },

  // ─── Beverages Hot (3) ────────────────────────────────────────────────────
  {
    id: "bev-hot-001",
    name: "Masala Chai",
    category: "Beverages Hot",
    price: 79,
    description:
      "Robust black tea brewed with ginger, cardamom, cinnamon & cloves, rich & warming.",
    tags: ["veg", "light", "quick-serve", "bestseller"],
    allergens: ["dairy"],
    complementaryIds: ["vs-001", "vs-002", "des-001"],
    popularScore: rnd(0.4, 0.99),
  },
  {
    id: "bev-hot-002",
    name: "Filter Coffee",
    category: "Beverages Hot",
    price: 89,
    description:
      "South Indian drip-brewed coffee with frothy steamed milk, served in a dabara set.",
    tags: ["veg", "light", "quick-serve", "bestseller"],
    allergens: ["dairy"],
    complementaryIds: ["vs-003", "des-003", "des-002"],
    popularScore: rnd(0.4, 0.99),
  },
  {
    id: "bev-hot-003",
    name: "Green Tea",
    category: "Beverages Hot",
    price: 99,
    description:
      "Premium Japanese sencha green tea, lightly steeped and served with lemon wedge.",
    tags: ["veg", "light", "dairy-free", "quick-serve"],
    allergens: [],
    complementaryIds: ["vs-002", "mv-003", "bev-cold-002"],
    popularScore: rnd(0.4, 0.99),
  },

  // ─── Beverages Cold (3) ───────────────────────────────────────────────────
  {
    id: "bev-cold-001",
    name: "Mango Lassi",
    category: "Beverages Cold",
    price: 149,
    description:
      "Thick chilled yoghurt drink blended with sweet Alphonso mango pulp & cardamom.",
    tags: ["veg", "bestseller", "filling", "quick-serve"],
    allergens: ["dairy"],
    complementaryIds: ["nvm-001", "mv-004", "des-002"],
    popularScore: rnd(0.4, 0.99),
  },
  {
    id: "bev-cold-002",
    name: "Mint Lemonade",
    category: "Beverages Cold",
    price: 119,
    description:
      "Freshly squeezed lemon with crushed mint, rock salt, and sparkling water.",
    tags: ["veg", "light", "dairy-free", "quick-serve"],
    allergens: [],
    complementaryIds: ["nvs-002", "mv-003", "vs-004"],
    popularScore: rnd(0.4, 0.99),
  },
  {
    id: "bev-cold-003",
    name: "Cold Coffee",
    category: "Beverages Cold",
    price: 169,
    description:
      "Chilled espresso blended with ice cream and milk, topped with whipped cream.",
    tags: ["veg", "bestseller", "filling"],
    allergens: ["dairy"],
    complementaryIds: ["des-003", "des-001", "vs-004"],
    popularScore: rnd(0.4, 0.99),
  },

  // ─── Combos & Deals (2) ───────────────────────────────────────────────────
  {
    id: "combo-001",
    name: "Combo A — Classic Meal",
    category: "Combos & Deals",
    price: 649,
    description:
      "1 starter + 1 main + 1 bread + 1 drink. Mix & match from our menu. Best value!",
    tags: ["veg", "filling", "bestseller", "shareable"],
    allergens: ["gluten", "dairy"],
    complementaryIds: ["des-001", "des-002", "bev-cold-001"],
    popularScore: rnd(0.4, 0.99),
  },
  {
    id: "combo-002",
    name: "Combo B — Feast for Two",
    category: "Combos & Deals",
    price: 1199,
    description:
      "2 starters + 2 mains + 2 drinks. Perfect for sharing. Save up to 20%!",
    tags: ["non-veg", "filling", "shareable", "bestseller"],
    allergens: ["gluten", "dairy", "soy"],
    complementaryIds: ["des-003", "des-002", "bev-cold-003"],
    popularScore: rnd(0.4, 0.99),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Seed function
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("🌱  Starting seed...\n");

  // Wipe existing data (order matters due to FK constraints)
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.session.deleteMany();
  await prisma.menuEmbedding.deleteMany();
  await prisma.menuItem.deleteMany();

  console.log("🗑️   Cleared existing records.\n");

  // Build create inputs
  const inputs: Prisma.MenuItemCreateInput[] = ITEMS.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    price: new Prisma.Decimal(item.price),
    description: item.description,
    imageUrl: imgUrl(item.name),
    tags: item.tags,
    allergens: item.allergens,
    available: true,
    popularScore: item.popularScore,
    complementaryIds: item.complementaryIds,
  }));

  let created = 0;
  for (const input of inputs) {
    await prisma.menuItem.create({ data: input });
    created++;
    console.log(`  ✅  [${created}/30] ${input.name}`);
  }

  console.log(`\n🎉  Seeded ${created} menu items successfully!`);

  // Summary by category
  const categories = await prisma.menuItem.groupBy({
    by: ["category"],
    _count: { id: true },
    orderBy: { category: "asc" },
  });

  console.log("\n📊  Items by category:");
  for (const cat of categories) {
    console.log(`     ${cat.category.padEnd(22)} → ${cat._count.id} items`);
  }
}

main()
  .catch((e) => {
    console.error("❌  Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
