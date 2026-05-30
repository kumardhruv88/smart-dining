import React from 'react'

const CATEGORIES = [
  'All',
  'Veg Starters',
  'Non-Veg Starters',
  'Mains (Veg)',
  'Mains (Non-Veg)',
  'Breads & Rice',
  'Desserts',
  'Beverages (Hot)',
  'Beverages (Cold)',
  'Combos'
]

interface CategoryTabsProps {
  activeCategory: string
  onSelectCategory: (category: string) => void
}

export function CategoryTabs({ activeCategory, onSelectCategory }: CategoryTabsProps) {
  return (
    <div
      className="flex overflow-x-auto scrollbar-hide no-scrollbar"
      style={{ borderBottom: '1px solid #2a2a2a' }}
    >
      {CATEGORIES.map((cat) => {
        const isActive = activeCategory === cat
        return (
          <button
            key={cat}
            onClick={() => onSelectCategory(cat)}
            className="whitespace-nowrap px-4 py-3 min-h-[44px] text-sm font-medium border-b-2 transition-colors"
            style={
              isActive
                ? { borderBottomColor: '#f97316', color: '#f97316' }
                : { borderBottomColor: 'transparent', color: '#a3a3a3' }
            }
            onMouseEnter={(e) => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = '#ffffff'
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = '#a3a3a3'
            }}
          >
            {cat}
          </button>
        )
      })}
    </div>
  )
}
