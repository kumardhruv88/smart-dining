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

  // Use the DB imageUrl which is now a real Unsplash URL from seed
  const imgSrc = imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80'

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
