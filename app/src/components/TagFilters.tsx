import React, { useState } from 'react'

const TAGS = [
  { label: 'Spicy 🌶', value: 'spicy' },
  { label: 'Light', value: 'light' },
  { label: 'Veg', value: 'veg' },
  { label: 'Non-Veg', value: 'non-veg' },
  { label: 'Bestseller ⭐', value: 'bestseller' },
  { label: 'Quick Serve', value: 'quick-serve' },
]

const ALLERGENS = ['nuts', 'gluten', 'dairy', 'eggs', 'shellfish', 'soy']

interface TagFiltersProps {
  activeTags: string[]
  onToggleTag: (tag: string) => void
  excludedAllergens: string[]
  onToggleAllergen: (allergen: string) => void
}

export function TagFilters({ activeTags, onToggleTag, excludedAllergens, onToggleAllergen }: TagFiltersProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-2 px-4 no-scrollbar">
      {TAGS.map((tag) => {
        const isActive = activeTags.includes(tag.value)
        return (
          <button
            key={tag.value}
            onClick={() => onToggleTag(tag.value)}
            className="whitespace-nowrap px-4 py-2 rounded-full min-h-[44px] text-sm font-medium transition-all"
            style={
              isActive
                ? { background: '#2D1810', border: '1px solid #2D1810', color: '#FAF7F2' }
                : { background: '#FAF7F2', border: '1px solid #E8DCC8', color: '#8B7355' }
            }
            onMouseEnter={(e) => {
              if (!isActive) {
                const btn = e.currentTarget as HTMLButtonElement
                btn.style.borderColor = '#2D1810'
                btn.style.color = '#2D1810'
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                const btn = e.currentTarget as HTMLButtonElement
                btn.style.borderColor = '#E8DCC8'
                btn.style.color = '#8B7355'
              }
            }}
          >
            {tag.label}
          </button>
        )
      })}

      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="whitespace-nowrap px-4 py-2 rounded-full min-h-[44px] text-sm font-medium transition-all"
          style={
            excludedAllergens.length > 0
              ? { background: 'rgba(232,101,10,0.1)', border: '1px solid #E8650A', color: '#E8650A' }
              : { background: '#FAF7F2', border: '1px solid #E8DCC8', color: '#8B7355' }
          }
        >
          Exclude allergens {excludedAllergens.length > 0 && `(${excludedAllergens.length})`}
        </button>
        {dropdownOpen && (
          <div
            className="absolute top-full mt-2 left-0 rounded-lg shadow-xl p-2 z-50 w-48"
            style={{ background: '#FFFFFF', border: '1px solid #E8DCC8' }}
          >
            {ALLERGENS.map((a) => (
              <label
                key={a}
                className="flex items-center gap-2 p-2 min-h-[44px] cursor-pointer rounded-md transition-colors"
                style={{ color: '#8B7355' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#FAF7F2')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <input
                  type="checkbox"
                  checked={excludedAllergens.includes(a)}
                  onChange={() => onToggleAllergen(a)}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: '#E8650A' }}
                />
                <span className="text-sm capitalize" style={{ color: '#2D1810' }}>{a}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
