'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '@/store'
import { ShoppingBag } from 'lucide-react'

const HERO_CONTENT = [
  { name: 'PANEER TIKKA', image: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=1600&q=80' },
  { name: 'CHICKEN BIRYANI', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1600&q=80' },
  { name: 'MASALA DOSA', image: 'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&w=1600&q=80' },
  { name: 'GULAB JAMUN', image: 'https://images.unsplash.com/photo-1666789826285-7cab1e40ffbb?auto=format&fit=crop&w=1600&q=80' },
  { name: 'IDLI SAMBAR', image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=1600&q=80' },
  { name: 'MASALA CHAI', image: 'https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?auto=format&fit=crop&w=1600&q=80' },
]

export interface CarouselMenuItem {
  id: string
  name: string
  price: number
  description: string
  imageUrl?: string
  tags: string[]
  category: string
  isAvailable: boolean
}

interface MenuCarouselProps {
  items: CarouselMenuItem[]
  onAddItem: (item: CarouselMenuItem) => void
  onOpenCart: () => void
  onOpenChat: () => void
  cartCount: number
  unreadCount: number
  tableId?: string
  onScrollToMenu?: () => void
  onScrollToAbout?: () => void
}

export function MenuCarousel({
  items,
  onAddItem,
  onOpenCart,
  onOpenChat,
  cartCount,
  unreadCount,
  tableId,
  onScrollToMenu,
  onScrollToAbout,
}: MenuCarouselProps) {
  /* ── Combined Image & Dish Carousel state ────────────────────── */
  const [activeIndex, setActiveIndex] = useState(0)
  const [imgVisible, setImgVisible] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [addedFeedback, setAddedFeedback] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const dragStartX = useRef<number | null>(null)

  const currentHero = HERO_CONTENT[activeIndex]!
  const activeItem = items.find(i => i.name.toUpperCase() === currentHero.name) ?? null

  /* ── Fade-in on mount ────────────────────────────────────────── */
  useEffect(() => {
    const t = setTimeout(() => setImgVisible(true), 120)
    return () => clearTimeout(t)
  }, [])

  /* ── Image & Text carousel navigation ────────────────────────── */
  const navigate = useCallback((dir: 'prev' | 'next') => {
    if (isTransitioning) return
    setIsTransitioning(true)
    setImgVisible(false) // Trigger fade out
    setTimeout(() => {
      setActiveIndex(i => dir === 'next' ? (i + 1) % HERO_CONTENT.length : (i - 1 + HERO_CONTENT.length) % HERO_CONTENT.length)
      setTimeout(() => { 
        setImgVisible(true) // Trigger fade in
        setIsTransitioning(false) 
      }, 80)
    }, 400) // Half of the 0.8s transition
  }, [isTransitioning])

  /* ── Auto-advance every 3s ───────────────────────────────────── */
  useEffect(() => {
    const t = setInterval(() => navigate('next'), 3000)
    return () => clearInterval(t)
  }, [navigate])

  /* ── Keyboard navigation ─────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') navigate('prev')
      if (e.key === 'ArrowRight') navigate('next')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  /* ── Touch/drag ──────────────────────────────────────────────── */
  const onPointerDown = (e: React.PointerEvent) => { dragStartX.current = e.clientX }
  const onPointerUp = (e: React.PointerEvent) => {
    if (dragStartX.current === null) return
    const dx = e.clientX - dragStartX.current
    if (Math.abs(dx) > 55) navigate(dx < 0 ? 'next' : 'prev')
    dragStartX.current = null
  }

  /* ── Add to cart ─────────────────────────────────────────────── */
  const handleAdd = () => {
    if (!activeItem || !activeItem.isAvailable) return
    onAddItem(activeItem)
    setAddedFeedback(true)
    setTimeout(() => setAddedFeedback(false), 1800)
  }

  return (
    <div
      ref={containerRef}
      id="hero-section"
      className="relative w-full overflow-hidden select-none"
      style={{ height: '100vh', minHeight: '600px', background: '#E8DCC8', cursor: 'grab', outline: 'none', border: 'none', boxShadow: 'none' }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {/* ── Background Hero Image ───────────────────────────────── */}
      <div
        className="absolute inset-0 z-0"
        style={{ 
          opacity: imgVisible ? 1 : 0, 
          transition: 'opacity 0.8s ease',
          backgroundImage: `url('${currentHero.image}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 40%',
          backgroundRepeat: 'no-repeat',
          width: '100%',
          height: '100vh',
        }}
      >
        {/* Gradient Overlay for Text Readability */}
        <div
          style={{ 
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(232, 220, 200, 0.88) 0%, rgba(232, 220, 200, 0.65) 35%, rgba(232, 220, 200, 0.20) 65%, rgba(232, 220, 200, 0.10) 100%)' 
          }}
        />
      </div>

      {/* ── Navbar ───────────────────────────────────────────────── */}
      <nav className="relative z-50 w-full" style={{ borderBottom: '1px solid #D4C4A8' }}>
        <div className="flex items-center justify-between px-6 sm:px-10 py-4">
          {/* Left links */}
          <div className="flex items-center gap-6 sm:gap-8">
            <button
              className="text-sm font-medium tracking-wide transition-opacity hover:opacity-60"
              style={{ color: '#2D1810', fontFamily: 'var(--font-sans)' }}
              onClick={onScrollToMenu}
            >
              Menu
            </button>
            <button
              className="text-sm font-medium tracking-wide transition-opacity hover:opacity-60"
              style={{ color: '#2D1810', fontFamily: 'var(--font-sans)' }}
              onClick={onOpenCart}
            >
              Order
            </button>
            <button
              className="hidden sm:block text-sm font-medium tracking-wide transition-opacity hover:opacity-60"
              style={{ color: '#2D1810', fontFamily: 'var(--font-sans)' }}
              onClick={onScrollToAbout}
            >
              About
            </button>
          </div>

          {/* Center logo */}
          <div
            style={{
              fontFamily: 'var(--font-display)',
              color: '#2D1810',
              fontSize: 'clamp(18px, 3.5vw, 26px)',
              fontWeight: '800',
              letterSpacing: '-0.02em',
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          >
            Spice Garden
          </div>

          {/* Right: table badge + cart */}
          <div className="flex items-center gap-3">
            {tableId && (
              <span
                style={{
                  background: '#2D1810',
                  color: '#E8DCC8',
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  letterSpacing: '0.08em',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Table {tableId.toUpperCase()}
              </span>
            )}
            <button
              onClick={onOpenCart}
              className="relative flex items-center justify-center transition-opacity hover:opacity-70"
              style={{ width: '44px', height: '44px', color: '#2D1810' }}
            >
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span
                  className="absolute flex items-center justify-center"
                  style={{
                    top: '4px',
                    right: '4px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: '#E8650A',
                    color: '#ffffff',
                    fontSize: '9px',
                    fontWeight: '800',
                    border: '1.5px solid #E8DCC8',
                  }}
                >
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero Content ─────────────────────────────────────────── */}
      <div className="relative z-20 flex flex-col items-center justify-center" style={{ height: 'calc(100vh - 65px)', paddingBottom: '80px' }}>
        {/* Subtitle */}
        <p
          style={{
            color: '#8B5E3C',
            fontSize: '11px',
            fontWeight: '600',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            marginBottom: '24px',
            fontStyle: 'italic',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Open Everyday 9AM – 11PM
        </p>

        {/* Giant rotating dish name */}
        <div className="relative text-center w-full">
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              color: '#2D1810',
              fontSize: 'clamp(60px, 10vw, 130px)',
              fontWeight: '900',
              lineHeight: '0.95',
              letterSpacing: '-0.03em',
              textTransform: 'uppercase',
              opacity: imgVisible ? 1 : 0,
              transform: imgVisible ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity 0.8s ease, transform 0.8s ease',
            }}
          >
            — {currentHero.name} —
          </h1>

          {/* Script accent overlay */}
          <div
            style={{
              position: 'absolute',
              bottom: '-28px',
              right: '5%',
              fontFamily: "'Dancing Script', 'Brush Script MT', cursive",
              color: '#8B5E3C',
              fontSize: 'clamp(28px, 4vw, 52px)',
              fontWeight: '700',
              transform: 'rotate(-4deg)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              textShadow: '1px 1px 3px rgba(0,0,0,0.2)',
            }}
          >
            Freshly Prepared
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-4 mt-20 pointer-events-auto">
          <button
            onClick={(e) => { e.stopPropagation(); handleAdd() }}
            disabled={!activeItem?.isAvailable}
            style={{
              padding: '14px 32px',
              borderRadius: '9999px',
              background: addedFeedback ? '#4caf50' : '#ffffff',
              color: '#2D1810',
              fontWeight: '700',
              fontSize: '14px',
              border: 'none',
              cursor: activeItem?.isAvailable ? 'pointer' : 'not-allowed',
              opacity: activeItem?.isAvailable ? 1 : 0.5,
              boxShadow: '0 4px 24px rgba(45,24,16,0.15)',
              transition: 'all 0.2s ease',
              fontFamily: 'var(--font-sans)',
            }}
            onMouseEnter={e => { if (activeItem?.isAvailable) (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)' }}
          >
            {addedFeedback ? '✓ Added!' : 'Order Now'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (onScrollToMenu) onScrollToMenu()
              else document.getElementById('full-menu-section')?.scrollIntoView({ behavior: 'smooth' })
            }}
            style={{
              padding: '14px 32px',
              borderRadius: '9999px',
              background: 'transparent',
              color: '#2D1810',
              fontWeight: '700',
              fontSize: '14px',
              border: '1.5px solid rgba(45,24,16,0.5)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'var(--font-sans)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2D1810' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(45,24,16,0.5)' }}
          >
            See More
          </button>
        </div>
      </div>

      {/* ── Footer bottom bar ─────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-30 flex justify-between items-end px-6 sm:px-10 pb-6 pointer-events-none">
        <div style={{ color: '#2D1810', maxWidth: '260px' }}>
          <h3 style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px', fontFamily: 'var(--font-display)' }}>
            100% Authentic &amp; Fresh
          </h3>
          <p style={{ fontSize: '11px', opacity: 0.65, lineHeight: '1.5', fontFamily: 'var(--font-sans)' }}>
            Prepared by hand with traditional techniques, using clean, natural, and organic ingredients.
          </p>
        </div>
        <div style={{ color: '#2D1810', opacity: 0.6, fontSize: '12px', fontWeight: '600', letterSpacing: '0.06em' }}>
          ©2026
        </div>
      </div>

        <div
          className="absolute z-40 flex gap-2"
          style={{ bottom: '28px', left: '50%', transform: 'translateX(-50%)' }}
        >
          {HERO_CONTENT.map((_, i) => (
            <div
              key={i}
              onClick={(e) => { e.stopPropagation(); if (!isTransitioning) setActiveIndex(i) }}
              style={{
                width: i === activeIndex ? '20px' : '6px',
                height: '6px',
                borderRadius: '9999px',
                background: i === activeIndex ? '#2D1810' : 'rgba(45,24,16,0.3)',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                pointerEvents: 'auto',
              }}
            />
          ))}
        </div>
    </div>
  )
}
