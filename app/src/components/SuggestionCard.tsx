import React, { useState } from 'react'

function getRealImageUrl(imageUrl?: string, name?: string) {
  // If imageUrl is valid and not a placeholder, use it directly
  if (imageUrl && !imageUrl.includes('placehold.co') && imageUrl.startsWith('http')) {
    return imageUrl
  }
  
  // Smart keyword-based fallback using Unsplash food photos
  const txt = (name || '').toLowerCase()
  
  // Meat / Non-veg mains
  if (txt.includes('rogan') || txt.includes('josh')) return 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=300&q=80'
  if (txt.includes('mutton') || txt.includes('lamb')) return 'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?auto=format&fit=crop&w=300&q=80'
  if (txt.includes('chicken') || txt.includes('tikka') || txt.includes('butter chicken')) return 'https://images.unsplash.com/photo-1599487405270-81781229f338?auto=format&fit=crop&w=300&q=80'
  if (txt.includes('fish') || txt.includes('prawn') || txt.includes('seafood')) return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=300&q=80'
  if (txt.includes('kebab') || txt.includes('seekh') || txt.includes('tandoori')) return 'https://images.unsplash.com/photo-1529543544282-ea669407fca3?auto=format&fit=crop&w=300&q=80'
  
  // Veg mains
  if (txt.includes('paneer') || txt.includes('makhani')) return 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d6?auto=format&fit=crop&w=300&q=80'
  if (txt.includes('dal') || txt.includes('tadka') || txt.includes('makhani')) return 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=300&q=80'
  if (txt.includes('biryani') || txt.includes('pulao')) return 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=300&q=80'
  if (txt.includes('curry') || txt.includes('masala') || txt.includes('sabzi')) return 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=300&q=80'
  
  // Breads
  if (txt.includes('naan') || txt.includes('roti') || txt.includes('paratha') || txt.includes('bread')) return 'https://images.unsplash.com/photo-1610975989137-6e5d8f17e6a2?auto=format&fit=crop&w=300&q=80'
  if (txt.includes('rice') || txt.includes('chawal')) return 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=300&q=80'
  
  // Starters / Snacks
  if (txt.includes('samosa') || txt.includes('pakora') || txt.includes('chaat') || txt.includes('starter')) return 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=300&q=80'
  if (txt.includes('soup') || txt.includes('shorba')) return 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=300&q=80'
  
  // Desserts
  if (txt.includes('jamun') || txt.includes('kulfi') || txt.includes('kheer') || txt.includes('halwa')) return 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=300&q=80'
  if (txt.includes('cake') || txt.includes('brownie') || txt.includes('ice cream')) return 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=300&q=80'
  
  // Beverages
  if (txt.includes('lassi') || txt.includes('chaas') || txt.includes('buttermilk')) return 'https://images.unsplash.com/photo-1622597467836-f3e6dc5a7edd?auto=format&fit=crop&w=300&q=80'
  if (txt.includes('tea') || txt.includes('chai') || txt.includes('coffee')) return 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=300&q=80'
  if (txt.includes('juice') || txt.includes('lemonade') || txt.includes('shake')) return 'https://images.unsplash.com/photo-1546171753-97d7676e4602?auto=format&fit=crop&w=300&q=80'
  
  // Combo / Thali
  if (txt.includes('combo') || txt.includes('thali') || txt.includes('meal') || txt.includes('set')) return 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d6?auto=format&fit=crop&w=300&q=80'
  
  // Default food image
  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80'
}

interface SuggestionCardProps {
  itemId: string
  name: string
  price: number
  reason: string
  imageUrl?: string
  onAdd: (itemId: string) => Promise<boolean>
}

export function SuggestionCard({ itemId, name, price, reason, imageUrl, onAdd }: SuggestionCardProps) {
  const [added, setAdded] = useState(false)

  const handleAdd = async () => {
    const success = await onAdd(itemId)
    if (success) {
      setAdded(true)
      setTimeout(() => setAdded(false), 2000)
    }
  }

  return (
    <div
      style={{ 
        background: '#FFFFFF', 
        border: '1px solid #E8DCC8',
        borderRadius: '12px',
        padding: '8px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '180px',
        flexShrink: 0,
        marginRight: '8px',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#D4C4A8';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#E8DCC8';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      <div style={{ width: '44px', height: '44px', borderRadius: '8px', border: '1px solid #E8DCC8', flexShrink: 0, overflow: 'hidden', background: '#FAF7F2' }}>
        {getRealImageUrl(imageUrl, name) ? (
          <img src={getRealImageUrl(imageUrl, name)} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#B8A898' }}>No Img</div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <h4 style={{ color: '#2D1810', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: '0 0 2px 0', fontFamily: 'var(--font-sans)' }}>
          {name}
        </h4>
        <p style={{ color: '#8B7355', fontSize: '10px', fontStyle: 'italic', margin: '0 0 4px 0', lineHeight: 1.2, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          "{reason}"
        </p>
        <span style={{ color: '#E8650A', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-sans)' }}>₹{price}</span>
      </div>

      <button
        onClick={handleAdd}
        disabled={added}
        style={{
          background: added ? '#E8DCC8' : '#E8650A',
          color: added ? '#8B7355' : 'white',
          fontSize: '10px',
          padding: '4px 8px',
          borderRadius: '6px',
          border: 'none',
          whiteSpace: 'nowrap',
          cursor: added ? 'default' : 'pointer',
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          transition: 'all 0.2s',
          flexShrink: 0
        }}
        onMouseEnter={(e) => {
          if (!added) (e.currentTarget as HTMLButtonElement).style.background = '#D4580A'
        }}
        onMouseLeave={(e) => {
          if (!added) (e.currentTarget as HTMLButtonElement).style.background = '#E8650A'
        }}
      >
        {added ? 'Added' : 'Add'}
      </button>
    </div>
  )
}
