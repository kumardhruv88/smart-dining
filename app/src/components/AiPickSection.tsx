import React, { useEffect, useState } from 'react'

interface AiSuggestion {
  itemId: string
  name: string
  price: number
  reason: string
  imageUrl?: string
}

interface AiPickSectionProps {
  sessionId: string
  timeOfDay: string
  onAdd: (itemId: string) => void
}

import { useAppStore } from '@/store'

function getSmartImage(imageUrl?: string, name?: string): string {
  if (imageUrl && !imageUrl.includes('placehold.co') && imageUrl.startsWith('http')) return imageUrl
  const txt = (name || '').toLowerCase()
  if (txt.includes('rogan') || txt.includes('josh')) return 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=400&q=80'
  if (txt.includes('mutton') || txt.includes('lamb')) return 'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?auto=format&fit=crop&w=400&q=80'
  if (txt.includes('chicken') || txt.includes('tikka') || txt.includes('butter chicken')) return 'https://images.unsplash.com/photo-1599487405270-81781229f338?auto=format&fit=crop&w=400&q=80'
  if (txt.includes('fish') || txt.includes('prawn') || txt.includes('seafood')) return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=400&q=80'
  if (txt.includes('kebab') || txt.includes('seekh') || txt.includes('tandoori')) return 'https://images.unsplash.com/photo-1529543544282-ea669407fca3?auto=format&fit=crop&w=400&q=80'
  if (txt.includes('paneer') || txt.includes('makhani')) return 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d6?auto=format&fit=crop&w=400&q=80'
  if (txt.includes('dal') || txt.includes('tadka')) return 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=400&q=80'
  if (txt.includes('biryani') || txt.includes('pulao')) return 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=400&q=80'
  if (txt.includes('naan') || txt.includes('roti') || txt.includes('paratha')) return 'https://images.unsplash.com/photo-1610975989137-6e5d8f17e6a2?auto=format&fit=crop&w=400&q=80'
  if (txt.includes('rice') || txt.includes('chawal')) return 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&q=80'
  if (txt.includes('samosa') || txt.includes('pakora') || txt.includes('chaat')) return 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=400&q=80'
  if (txt.includes('jamun') || txt.includes('kulfi') || txt.includes('kheer')) return 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=400&q=80'
  if (txt.includes('cake') || txt.includes('brownie') || txt.includes('ice cream')) return 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=400&q=80'
  if (txt.includes('lassi') || txt.includes('chaas')) return 'https://images.unsplash.com/photo-1622597467836-f3e6dc5a7edd?auto=format&fit=crop&w=400&q=80'
  if (txt.includes('tea') || txt.includes('chai') || txt.includes('coffee')) return 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=400&q=80'
  if (txt.includes('juice') || txt.includes('lemonade') || txt.includes('shake')) return 'https://images.unsplash.com/photo-1546171753-97d7676e4602?auto=format&fit=crop&w=400&q=80'
  if (txt.includes('combo') || txt.includes('thali') || txt.includes('meal')) return 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d6?auto=format&fit=crop&w=400&q=80'
  if (txt.includes('curry') || txt.includes('masala') || txt.includes('sabzi')) return 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=400&q=80'
  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80'
}

export function AiPickSection({ sessionId, timeOfDay, onAdd }: AiPickSectionProps) {
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const { preferences } = useAppStore()

  useEffect(() => {
    async function fetchPicks() {
      try {
        const res = await fetch(`/api/session/${sessionId}/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `suggest 3 items for me right now based on my preferences`,
            tableId: 'unknown',
            timeOfDay,
            preferences
          })
        })
        const data = await res.json()
        if (data.suggestions && data.suggestions.length > 0) {
          setSuggestions(data.suggestions.slice(0, 3))
        } else {
          setError(true)
        }
      } catch (e) {
        console.error("AI Pick error", e)
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    fetchPicks()
  }, [sessionId, timeOfDay, preferences])

  if (!loading && error && suggestions.length === 0) {
    return (
      <div 
        className="mx-4 my-4"
        style={{
          background: '#FAF7F2',
          border: '1px solid #E8DCC8',
          borderRadius: '16px',
          padding: '24px 20px',
        }}
      >
        <div className="mb-2">
          <h2 className="text-lg font-semibold" style={{ color: '#2D1810', fontFamily: 'serif' }}>✨ Zara's picks for you</h2>
        </div>
        <p className="text-sm" style={{ color: '#8B7355' }}>Zara is currently taking a quick break. Please browse the full menu below!</p>
      </div>
    )
  }

  if (!loading && suggestions.length === 0) return null

  return (
    <div 
      className="mx-4 my-4"
      style={{
        background: '#FAF7F2',
        border: '1px solid #E8DCC8',
        borderRadius: '16px',
        padding: '24px 20px',
      }}
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: '#2D1810', fontFamily: 'serif' }}>
          ✨ Zara's picks for you
        </h2>
        <p className="text-xs capitalize" style={{ color: '#8B7355' }}>Perfect for {timeOfDay} today</p>
      </div>

      <div className="flex overflow-x-auto gap-4 pb-4 no-scrollbar -mx-4 px-4 snap-x">
        {loading ? (
          [1,2,3].map(i => (
            <div
              key={i}
              className="min-w-[240px] w-64 rounded-xl p-3 flex-shrink-0 animate-pulse snap-center"
              style={{ background: '#FFFFFF', border: '1px solid #E8DCC8' }}
            >
              <div className="w-full h-32 rounded-lg mb-3" style={{ background: '#FAF7F2' }}></div>
              <div className="h-4 rounded w-3/4 mb-2" style={{ background: '#FAF7F2' }}></div>
              <div className="h-3 rounded w-1/2 mb-4" style={{ background: '#FAF7F2' }}></div>
              <div className="h-10 rounded w-full" style={{ background: '#FAF7F2' }}></div>
            </div>
          ))
        ) : (
          suggestions.map(item => (
            <div
              key={item.itemId}
              className="min-w-[240px] w-64 rounded-xl p-3 flex-shrink-0 flex flex-col snap-center transition-all duration-200 group cursor-pointer"
              style={{ background: '#FFFFFF', border: '1px solid #E8DCC8' }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement
                el.style.borderColor = '#E8650A'
                el.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement
                el.style.borderColor = '#E8DCC8'
                el.style.transform = 'translateY(0)'
              }}
            >
              <div className="w-full h-32 rounded-lg mb-3 overflow-hidden" style={{ background: '#FAF7F2', border: '1px solid #E8DCC8' }}>
                <img 
                  src={getSmartImage(item.imageUrl, item.name)} 
                  alt={item.name} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // If image fails to load, use default food image
                    (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80'
                  }}
                />
              </div>
              <h3 className="font-semibold leading-tight mb-1 text-[15px]" style={{ color: '#2D1810' }}>{item.name}</h3>
              <p className="text-xs line-clamp-2 mb-1 leading-snug italic" style={{ color: '#8B7355' }}>"{item.reason}"</p>
              <div className="flex items-center justify-between mt-auto pt-3">
                <span className="font-semibold text-base" style={{ color: '#E8650A' }}>₹{item.price}</span>
                <button
                  onClick={() => onAdd(item.itemId)}
                  className="text-xs font-semibold py-2 px-4 min-h-[40px] rounded-lg transition-colors"
                  style={{ background: '#2D1810', color: '#FAF7F2' }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#E8650A')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#2D1810')}
                >
                  ADD
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
