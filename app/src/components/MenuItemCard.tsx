import React from 'react'

interface MenuItemCardProps {
  id: string
  name: string
  price: number
  description: string
  imageUrl?: string
  tags?: string[]
  isAvailable: boolean
  quantity: number
  onAdd: () => void
  onRemove: () => void
}

export function MenuItemCard({
  id,
  name,
  price,
  description,
  imageUrl,
  tags = [],
  isAvailable,
  quantity,
  onAdd,
  onRemove,
}: MenuItemCardProps) {
  const isBestseller = tags.includes('bestseller')
  const isSpicy = tags.includes('spicy')
  const isVeg = tags.includes('veg')

  // Smart image lookup - covers Indian food items that might not have DB images
  function getItemImage(imageUrl?: string, itemName?: string): string {
    if (imageUrl && !imageUrl.includes('placehold.co') && imageUrl.startsWith('http')) return imageUrl
    const txt = (itemName || '').toLowerCase()
    if (txt.includes('idli') || txt.includes('idly')) return 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80'
    if (txt.includes('dosa') || txt.includes('uttapam')) return 'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&w=600&q=80'
    if (txt.includes('sambar')) return 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80'
    if (txt.includes('vada') || txt.includes('medu')) return 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d6?auto=format&fit=crop&w=600&q=80'
    if (txt.includes('gulab') || txt.includes('jamun')) return 'https://images.unsplash.com/photo-1666789826285-7cab1e40ffbb?auto=format&fit=crop&w=600&q=80'
    if (txt.includes('halwa') || txt.includes('kheer') || txt.includes('kulfi')) return 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=600&q=80'
    if (txt.includes('biryani') || txt.includes('pulao')) return 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80'
    if (txt.includes('paneer') || txt.includes('makhani')) return 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d6?auto=format&fit=crop&w=600&q=80'
    if (txt.includes('chicken') || txt.includes('tikka')) return 'https://images.unsplash.com/photo-1599487405270-81781229f338?auto=format&fit=crop&w=600&q=80'
    if (txt.includes('mutton') || txt.includes('lamb') || txt.includes('rogan')) return 'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?auto=format&fit=crop&w=600&q=80'
    if (txt.includes('fish') || txt.includes('prawn') || txt.includes('seafood')) return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&q=80'
    if (txt.includes('dal') || txt.includes('tadka')) return 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80'
    if (txt.includes('samosa') || txt.includes('pakora') || txt.includes('chaat')) return 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80'
    if (txt.includes('naan') || txt.includes('roti') || txt.includes('paratha')) return 'https://images.unsplash.com/photo-1610975989137-6e5d8f17e6a2?auto=format&fit=crop&w=600&q=80'
    if (txt.includes('lassi') || txt.includes('chai') || txt.includes('coffee')) return 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=600&q=80'
    return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80'
  }

  const imgSrc = getItemImage(imageUrl, name)

  return (
    <div
      className="group"
      style={{
        background: '#FAF7F2',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid #E8DCC8',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = 'translateY(-2px)'
        el.style.boxShadow = '0 8px 28px rgba(45,24,16,0.11)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = 'translateY(0)'
        el.style.boxShadow = 'none'
      }}
    >
      {/* Image — fixed 160px height */}
      <div style={{ position: 'relative', width: '100%', height: '160px', background: '#E8DCC8', overflow: 'hidden', flexShrink: 0 }}>
        <img
          src={imgSrc}
          alt={name}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            filter: !isAvailable ? 'grayscale(70%) brightness(0.85)' : 'none',
            transition: 'transform 0.4s ease',
          }}
          className="group-hover:scale-105"
          loading="lazy"
        />

        {/* Badges */}
        <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {isVeg && (
            <span style={{
              background: 'rgba(255,255,255,0.92)',
              color: '#16a34a',
              border: '1px solid #16a34a',
              fontSize: '8px',
              fontWeight: '700',
              padding: '2px 6px',
              borderRadius: '3px',
              fontFamily: 'var(--font-sans)',
            }}>VEG</span>
          )}
        </div>

        {isSpicy && (
          <span style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '14px' }} title="Spicy">🌶</span>
        )}

        {!isAvailable && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(250,247,242,0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              background: '#FAF7F2', color: '#8B7355',
              fontSize: '9px', fontWeight: '700',
              padding: '3px 10px', borderRadius: '9999px',
              border: '1px solid #D4C4A8',
              fontFamily: 'var(--font-sans)',
              letterSpacing: '0.06em',
            }}>UNAVAILABLE</span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', flex: 1, gap: '4px' }}>
        {/* Name — 1 line, truncate */}
        <h3 style={{
          fontFamily: 'var(--font-display)',
          color: '#2D1810',
          fontSize: '14px',
          fontWeight: '600',
          lineHeight: '1.2',
          margin: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {name}
        </h3>

        {/* Price */}
        <p style={{ color: '#E8650A', fontSize: '15px', fontWeight: '700', margin: 0, fontFamily: 'var(--font-sans)' }}>
          ₹{price}
        </p>

        {/* Description — 2 lines max */}
        <p style={{
          color: '#8B7355',
          fontSize: '12px',
          lineHeight: '1.4',
          margin: '0 0 6px',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          fontFamily: 'var(--font-sans)',
        }}>
          {description}
        </p>

        <div style={{ flex: 1 }} />

        {/* Add / stepper */}
        {isAvailable ? (
          quantity > 0 ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#2D1810', borderRadius: '8px', overflow: 'hidden', height: '36px',
            }}>
              <button
                onClick={onRemove}
                style={{
                  width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#E8650A', fontWeight: '800', fontSize: '18px',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                }}
              >−</button>
              <span style={{ color: '#E8650A', fontWeight: '700', fontSize: '14px', minWidth: '20px', textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
                {quantity}
              </span>
              <button
                onClick={onAdd}
                style={{
                  width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#E8650A', fontWeight: '800', fontSize: '18px',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                }}
              >+</button>
            </div>
          ) : (
            <button
              onClick={onAdd}
              style={{
                width: '100%', height: '36px',
                background: 'transparent', color: '#E8650A',
                fontWeight: '600', fontSize: '13px',
                letterSpacing: '0.05em', borderRadius: '8px',
                border: '1px solid #E8650A', cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'var(--font-sans)',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement
                el.style.background = '#E8650A'
                el.style.color = '#fff'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement
                el.style.background = 'transparent'
                el.style.color = '#E8650A'
              }}
            >
              ADD
            </button>
          )
        ) : (
          <button disabled style={{
            width: '100%', height: '36px',
            background: '#F5F0E8', color: '#B8A898',
            fontWeight: '700', fontSize: '13px',
            borderRadius: '8px', border: '1px solid #D4C4A8',
            cursor: 'not-allowed', fontFamily: 'var(--font-sans)',
          }}>
            UNAVAILABLE
          </button>
        )}
      </div>
    </div>
  )
}
