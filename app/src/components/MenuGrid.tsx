import React, { useMemo } from 'react'
import Fuse from 'fuse.js'
import { MenuItemCard } from './MenuItemCard'

export interface MenuItemType {
  id: string
  name: string
  description: string
  price: number
  category: string
  tags: string[]
  allergens: string[]
  imageUrl: string
  isAvailable: boolean
}

interface MenuGridProps {
  items: MenuItemType[]
  searchQuery: string
  activeCategory: string
  activeTags: string[]
  excludedAllergens: string[]
  cartQuantityMap: Record<string, number>
  onAddItem: (item: MenuItemType) => void
  onRemoveItem: (id: string) => void
}

export function MenuGrid({
  items,
  searchQuery,
  activeCategory,
  activeTags,
  excludedAllergens,
  cartQuantityMap,
  onAddItem,
  onRemoveItem,
}: MenuGridProps) {
  const fuse = useMemo(() => new Fuse(items, {
    keys: ['name', 'description', 'tags', 'category'],
    threshold: 0.4,
  }), [items])

  const filteredItems = useMemo(() => {
    let result = items
    if (searchQuery) result = fuse.search(searchQuery).map(r => r.item)
    if (activeCategory !== 'All') result = result.filter(i => i.category === activeCategory)
    if (activeTags.length > 0) result = result.filter(i => activeTags.every(t => i.tags.includes(t)))
    if (excludedAllergens.length > 0) result = result.filter(i => !i.allergens?.some(a => excludedAllergens.includes(a)))
    return result
  }, [items, fuse, searchQuery, activeCategory, activeTags, excludedAllergens])

  const grouped = useMemo(() => {
    if (activeCategory !== 'All' || searchQuery) return null
    const map: Record<string, MenuItemType[]> = {}
    filteredItems.forEach(item => {
      const cat = item.category || 'Uncategorized'
      if (!map[cat]) map[cat] = []
      map[cat].push(item)
    })
    return map
  }, [filteredItems, activeCategory, searchQuery])

  if (filteredItems.length === 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <p style={{ color: 'rgba(245,238,216,0.35)', fontFamily: 'var(--font-display)', fontSize: '18px', fontStyle: 'italic' }}>
          No items found matching your criteria.
        </p>
      </div>
    )
  }

  if (grouped && Object.keys(grouped).length > 0) {
    return (
      <div>
        {Object.entries(grouped).map(([category, catItems]) => (
          <div key={category} id={`category-${category.replace(/\s+/g, '-')}`}>
            <div style={{
              padding: '14px 16px 10px',
              borderBottom: '1px solid #2a2a2a',
              position: 'sticky',
              top: '110px',
              background: '#141414',
              zIndex: 20,
              display: 'flex',
              alignItems: 'baseline',
              gap: '10px',
            }}>
              <h2 style={{ fontFamily: 'var(--font-display)', color: '#f5eed8', fontSize: '20px', fontWeight: '700' }}>
                {category}
              </h2>
              <span style={{ color: '#525252', fontSize: '12px', fontWeight: '600' }}>
                {catItems.length} items
              </span>
            </div>
            <div>
              {catItems.map(item => (
                <MenuItemCard
                  key={item.id}
                  {...item}
                  quantity={cartQuantityMap[item.id] || 0}
                  onAdd={() => onAddItem(item)}
                  onRemove={() => onRemoveItem(item.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {filteredItems.map(item => (
        <MenuItemCard
          key={item.id}
          {...item}
          quantity={cartQuantityMap[item.id] || 0}
          onAdd={() => onAddItem(item)}
          onRemove={() => onRemoveItem(item.id)}
        />
      ))}
    </div>
  )
}
