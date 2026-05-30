'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../store'
import { MenuCarousel, CarouselMenuItem } from './MenuCarousel'
import { MenuItemCard } from './MenuItemCard'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useParams } from 'next/navigation'
import { AiPickSection } from './AiPickSection'

/* ── Filter options ──────────────────────────────────────────────── */
const DIETARY_FILTERS = [
  { label: 'Spicy',         value: 'spicy' },
  { label: 'Light',         value: 'light' },
  { label: 'Veg Only',      value: 'veg' },
  { label: 'Non-Veg Only',  value: 'non-veg' },
  { label: 'Bestsellers',   value: 'bestseller' },
  { label: 'Quick Serve',   value: 'quick-serve' },
]

const ALLERGEN_FILTERS = [
  { label: 'Nuts',      value: 'nuts' },
  { label: 'Gluten',    value: 'gluten' },
  { label: 'Dairy',     value: 'dairy' },
  { label: 'Eggs',      value: 'eggs' },
  { label: 'Shellfish', value: 'shellfish' },
  { label: 'Soy',       value: 'soy' },
]

export function MainMenu() {
  const { cartItems, addCartItem, removeCartItem, sessionId, setCartDrawerOpen, setChatOpen, unreadCount } = useAppStore()
  const params = useParams()
  const tableId = (params?.tableId as string) || ''

  const [allItems, setAllItems] = useState<CarouselMenuItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuLoading, setMenuLoading] = useState(true)
  const [timeOfDay, setTimeOfDay] = useState('lunch')

  /* ── Filter panel state ─────────────────────────────────────────── */
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [activeDietary, setActiveDietary] = useState<string[]>([])
  const [excludeAllergens, setExcludeAllergens] = useState<string[]>([])
  const [activeOrders, setActiveOrders] = useState<string[]>([])

  const menuSectionRef = useRef<HTMLDivElement>(null)
  const aboutSectionRef = useRef<HTMLDivElement>(null)

  const cartQuantityMap = cartItems.reduce((acc: Record<string, number>, item: any) => {
    if (item.menuItem?.id) acc[item.menuItem.id] = item.quantity
    return acc
  }, {} as Record<string, number>)

  const cartCount = cartItems.reduce((acc: number, item: any) => acc + item.quantity, 0)

  const totalActiveFilters = activeDietary.length + excludeAllergens.length

  useEffect(() => {
    const now = new Date()
    const hour = now.getHours()
    if (hour >= 6 && hour < 11) setTimeOfDay('breakfast')
    else if (hour >= 11 && hour < 15) setTimeOfDay('lunch')
    else if (hour >= 15 && hour < 19) setTimeOfDay('evening')
    else setTimeOfDay('dinner')
  }, [])

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch('/api/menu')
        const data = await res.json()
        const items = Array.isArray(data) ? data : 
                      Array.isArray(data?.items) ? data.items : []
        setAllItems(items.map((d: any) => ({
          id: d.id,
          name: d.name,
          description: d.description,
          price: d.price,
          category: d.category,
          tags: d.tags || [],
          allergens: d.allergens || [],
          imageUrl: d.imageUrl,
          isAvailable: d.available,
        })))
      } catch (err) {
        console.error('Failed to load menu data:', err)
      } finally {
        setMenuLoading(false)
      }
    }
    loadData()
    
    // Load active orders
    if (typeof window !== 'undefined') {
      const orders = JSON.parse(localStorage.getItem('activeOrders') || '[]')
      setActiveOrders(orders)
    }
  }, [])

  const handleAddItem = async (item: any) => {
    const storeState = useAppStore.getState()
    const originalCart = storeState.cartItems
    const originalTotal = storeState.cartTotal
    const originalGst = storeState.cartGst

    storeState.addCartItem({
      quantity: 1,
      addedBy: typeof window !== 'undefined' ? (sessionStorage.getItem('displayName') || 'User') : 'User',
      menuItem: {
        id: item.id,
        name: item.name,
        price: item.price,
        imageUrl: item.imageUrl,
        tags: item.tags,
      }
    })

    if (sessionId) {
      const doApi = async () => {
        const displayName = sessionStorage.getItem('displayName') || 'User'
        const res = await fetch(`/api/session/${sessionId}/cart`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ menuItemId: item.id, quantity: 1, addedBy: displayName }),
        })
        if (!res.ok) throw new Error('API failed')
        const data = await res.json()
        if (data.cart) {
          useAppStore.getState().setCart(data.cart.items, data.cart.total, data.cart.gst)
        }

        const updatedCartItems = data.cart ? data.cart.items : useAppStore.getState().cartItems
        const cartTotal = data.cart ? data.cart.total : useAppStore.getState().cartTotal

        const upsellRes = await fetch('/api/upsell-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            lastAddedItemId: item.id,
            cartItems: updatedCartItems,
            cartTotal,
            timeOfDay,
          }),
        })

        if (upsellRes.ok) {
          const upsellData = await upsellRes.json()
          if (upsellData.suggestion) {
            useAppStore.getState().setUpsell(upsellData.suggestion)
          }
        }
      }
      doApi().catch(err => {
        console.error(err)
        storeState.setCart(originalCart, originalTotal, originalGst)
      })
    }
  }

  const handleRemoveItem = async (id: string) => {
    const storeState = useAppStore.getState()
    const originalCart = storeState.cartItems
    const originalTotal = storeState.cartTotal
    const originalGst = storeState.cartGst

    const item = storeState.cartItems.find((i: any) => i.menuItem?.id === id)
    if (item) {
      storeState.removeCartItem(id)
      if (sessionId && item.menuItem?.id) {
        const doApi = async () => {
          const res = await fetch(`/api/session/${sessionId}/cart/${item.menuItem.id}`, { method: 'DELETE' })
          if (!res.ok) throw new Error('API failed')
          const data = await res.json()
          if (data.cart) useAppStore.getState().setCart(data.cart.items, data.cart.total, data.cart.gst)
        }
        doApi().catch(err => {
          storeState.setCart(originalCart, originalTotal, originalGst)
        })
      }
    }
  }

  /* ── Derived data ─────────────────────────────────────────────── */
  const categories = ['All', ...Array.from(new Set(allItems.map(i => i.category)))]

  const filteredItems = allItems.filter(item => {
    const matchCat = activeCategory === 'All' || item.category === activeCategory
    const matchQ = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase())
    // dietary filters: item must have ALL selected tags
    const matchDietary = activeDietary.length === 0 || activeDietary.every(f => item.tags.includes(f))
    // allergen exclude: item must NOT have any excluded allergen
    const matchAllergen = excludeAllergens.length === 0 || !excludeAllergens.some(a => (item as any).allergens?.includes(a))
    return matchCat && matchQ && matchDietary && matchAllergen
  })

  // Grouped only when a specific category is selected
  const grouped = filteredItems.reduce((acc: Record<string, CarouselMenuItem[]>, item) => {
    const cat = item.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  const openFullMenu = () => {
    setMenuOpen(true)
    setTimeout(() => menuSectionRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const scrollToMenu = () => {
    if (!menuOpen) setMenuOpen(true)
    setTimeout(() => menuSectionRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const scrollToAbout = () => {
    aboutSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const clearFilters = () => { setActiveDietary([]); setExcludeAllergens([]) }

  const toggleDietary = (val: string) =>
    setActiveDietary(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])

  const toggleAllergen = (val: string) =>
    setExcludeAllergens(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])

  return (
    <div style={{ background: '#F5F0E8', minHeight: '100svh' }}>

      {/* ── Hero Carousel ─────────────────────────────────────────── */}
      <MenuCarousel
        items={allItems}
        onAddItem={handleAddItem}
        onOpenCart={() => setCartDrawerOpen(true)}
        onOpenChat={() => setChatOpen(true)}
        cartCount={cartCount}
        unreadCount={unreadCount}
        tableId={tableId}
        onScrollToMenu={scrollToMenu}
        onScrollToAbout={scrollToAbout}
      />

      {/* ── "Browse Full Menu" CTA ────────────────────────────────── */}
      <div
        id="full-menu-section"
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '28px 24px',
          background: 'linear-gradient(to bottom, #ede4d3 0%, #F5F0E8 100%)',
          gap: '12px',
          borderTop: '1px solid rgba(212, 196, 168, 0.5)',
          boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.02)'
        }}
      >
        <p style={{ fontFamily: 'var(--font-sans)', color: '#8B7355', fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: '700', opacity: 0.8 }}>
          or explore everything
        </p>
        <button
          onClick={openFullMenu}
          style={{
            padding: '12px 36px', borderRadius: '9999px',
            background: menuOpen ? '#2D1810' : 'transparent',
            border: '2px solid #2D1810',
            color: menuOpen ? '#ffffff' : '#2D1810',
            fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700',
            cursor: 'pointer', transition: 'all 0.25s ease',
            boxShadow: menuOpen ? '0 4px 14px rgba(45,24,16,0.2)' : 'none'
          }}
          onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = '#2D1810'; b.style.color = '#fff' }}
          onMouseLeave={e => { if (!menuOpen) { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'transparent'; b.style.color = '#2D1810' } }}
        >
          Browse Full Menu ↓
        </button>
      </div>

      {/* ── Full menu section ─────────────────────────────────────── */}
      <div
        ref={menuSectionRef}
        id="menu-section"
        style={{
          background: '#F5F0E8',
          minHeight: menuOpen ? '60vh' : '0',
          maxHeight: menuOpen ? '9999999px' : '0',
          overflow: 'hidden',
          transition: 'max-height 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Sticky header: search + category tabs + filter button */}
        <div style={{ position: 'sticky', top: 0, zIndex: 30, background: '#F5F0E8', borderBottom: '1px solid #D4C4A8', padding: '14px 20px 0' }}>
          {/* Top row: search + filter button */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#B8A898', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Search dishes…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', background: '#FAF7F2', border: '1px solid #D4C4A8',
                  borderRadius: '9999px', padding: '10px 16px 10px 40px',
                  color: '#2D1810', fontSize: '14px', outline: 'none',
                  fontFamily: 'var(--font-sans)', transition: 'border-color 0.2s',
                }}
                onFocus={e => (e.target.style.borderColor = '#E8650A')}
                onBlur={e => (e.target.style.borderColor = '#D4C4A8')}
              />
            </div>
            {/* Filter button */}
            <button
              onClick={() => setFilterPanelOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '9px 16px', borderRadius: '9999px',
                background: totalActiveFilters > 0 ? '#2D1810' : '#FAF7F2',
                border: '1px solid #D4C4A8',
                color: totalActiveFilters > 0 ? '#fff' : '#2D1810',
                fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                fontFamily: 'var(--font-sans)', flexShrink: 0, transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              <SlidersHorizontal style={{ width: '14px', height: '14px' }} />
              Filters
              {totalActiveFilters > 0 && (
                <span style={{
                  background: '#E8650A', color: '#fff',
                  borderRadius: '9999px', fontSize: '10px', fontWeight: '800',
                  padding: '1px 6px', marginLeft: '2px',
                }}>
                  {totalActiveFilters}
                </span>
              )}
            </button>
          </div>

          {/* Category tabs */}
          <div style={{ display: 'flex', overflowX: 'auto', gap: '0' }} className="no-scrollbar">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  whiteSpace: 'nowrap', padding: '9px 16px', borderRadius: '0',
                  borderBottom: activeCategory === cat ? '2px solid #2D1810' : '2px solid transparent',
                  background: 'transparent',
                  color: activeCategory === cat ? '#2D1810' : '#8B7355',
                  fontFamily: 'var(--font-sans)', fontSize: '13px',
                  fontWeight: activeCategory === cat ? '700' : '500',
                  cursor: 'pointer', transition: 'all 0.2s', letterSpacing: '0.01em', flexShrink: 0,
                }}
                onMouseEnter={e => { if (activeCategory !== cat) (e.currentTarget as HTMLButtonElement).style.color = '#2D1810' }}
                onMouseLeave={e => { if (activeCategory !== cat) (e.currentTarget as HTMLButtonElement).style.color = '#8B7355' }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ── Item display ─────────────────────────────────────────── */}
        <div style={{ padding: '0 20px 80px' }}>
          {sessionId && (
            <AiPickSection
              sessionId={sessionId}
              tableId={tableId || undefined}
              timeOfDay={timeOfDay}
              allItems={allItems}
              onAdd={(itemId) => {
                const item = allItems.find(i => i.id === itemId)
                if (item) handleAddItem(item)
              }}
            />
          )}

          {menuLoading ? (
            <div style={{ paddingTop: '24px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))',
                gap: '14px',
              }}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} style={{
                    height: '280px',
                    borderRadius: '20px',
                    background: '#F0EAE0',
                    animation: 'shimmer 1.5s infinite linear',
                    backgroundImage: 'linear-gradient(to right, #F0EAE0 4%, #E8DCC8 25%, #F0EAE0 36%)',
                    backgroundSize: '1000px 100%',
                  }} />
                ))}
              </div>
            </div>
          ) : activeCategory === 'All' ? (
            /* Flat grid — no category headers */
            <>
              {filteredItems.length === 0 ? (
                <div style={{ padding: '60px 24px', textAlign: 'center', color: '#8B7355', fontFamily: 'var(--font-display)', fontSize: '18px' }}>
                  No items match your search.
                </div>
              ) : (
                <div style={{ paddingTop: '24px' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))',
                    gap: '14px',
                  }}>
                    {filteredItems.map(item => (
                      <MenuItemCard
                        key={item.id}
                        {...item}
                        quantity={cartQuantityMap[item.id] || 0}
                        onAdd={() => handleAddItem(item)}
                        onRemove={() => handleRemoveItem(item.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Grouped by category with headers */
            <>
              {Object.entries(grouped).map(([category, catItems]) => (
                <div key={category}>
                  <div style={{ padding: '28px 0 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '8px' }}>
                      <h2 style={{ fontFamily: 'var(--font-display)', color: '#2D1810', fontSize: '22px', fontWeight: '700', letterSpacing: '-0.01em' }}>
                        {category}
                      </h2>
                      <span style={{
                        background: '#FAF7F2', border: '1px solid #D4C4A8', color: '#8B7355',
                        fontSize: '11px', fontWeight: '600', padding: '2px 10px', borderRadius: '9999px',
                        fontFamily: 'var(--font-sans)',
                      }}>
                        {catItems.length} items
                      </span>
                    </div>
                    <div style={{ width: '40px', height: '3px', background: '#E8650A', borderRadius: '2px' }} />
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))',
                    gap: '14px', marginBottom: '8px',
                  }}>
                    {catItems.map(item => (
                      <MenuItemCard
                        key={item.id}
                        {...item}
                        quantity={cartQuantityMap[item.id] || 0}
                        onAdd={() => handleAddItem(item)}
                        onRemove={() => handleRemoveItem(item.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {filteredItems.length === 0 && (
                <div style={{ padding: '60px 24px', textAlign: 'center', color: '#8B7355', fontFamily: 'var(--font-display)', fontSize: '18px' }}>
                  No items match your search.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── About section ─────────────────────────────────────────── */}
      <section
        ref={aboutSectionRef}
        id="about-section"
        style={{
          background: '#2D1810',
          padding: '60px 32px',
          textAlign: 'center',
        }}
      >
        <h2 style={{
          fontFamily: 'var(--font-display)', color: '#FAF7F2',
          fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: '700',
          marginBottom: '20px', letterSpacing: '-0.01em',
        }}>
          About Spice Garden
        </h2>
        <p style={{
          fontFamily: 'var(--font-sans)', color: 'rgba(250,247,242,0.7)',
          fontSize: '15px', lineHeight: '1.75', maxWidth: '600px', margin: '0 auto 24px',
        }}>
          An AI-powered dining experience where Zara, your personal dining assistant, helps you discover
          the perfect meal. Powered by advanced AI agents that understand your preferences, dietary needs,
          and group dynamics.
        </p>
        {tableId && (
          <p style={{
            fontFamily: 'var(--font-sans)', color: 'rgba(250,247,242,0.45)',
            fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            Table {tableId.toUpperCase()} · Powered by Zara AI
          </p>
        )}
      </section>

      {/* ── Filter slide-out panel ───────────────────────────────── */}
      {filterPanelOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 120, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '16px' }}>
          {/* Backdrop */}
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)' }}
            onClick={() => setFilterPanelOpen(false)}
          />
          {/* Panel */}
          <div
            className="animate-in slide-in-from-right duration-300"
            style={{
              position: 'relative', width: '100%', maxWidth: '300px',
              height: 'auto', maxHeight: '80vh',
              background: '#FAF7F2', overflowY: 'auto',
              display: 'flex', flexDirection: 'column',
              borderRadius: '16px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 16px 12px', borderBottom: '1px solid #E8DCC8', flexShrink: 0,
            }}>
              <h2 style={{ fontFamily: 'var(--font-display)', color: '#2D1810', fontSize: '18px', fontWeight: '700' }}>
                Filters
              </h2>
              <button
                onClick={() => setFilterPanelOpen(false)}
                style={{
                  width: '32px', height: '32px', borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  background: '#F5F0E8', border: '1px solid #D4C4A8',
                  cursor: 'pointer', color: '#2D1810',
                }}
              >
                <X style={{ width: '14px', height: '14px' }} />
              </button>
            </div>

            {/* Dietary section */}
            <div style={{ padding: '16px', borderBottom: '1px solid #E8DCC8' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', color: '#2D1810', fontSize: '13px', fontWeight: '700', marginBottom: '8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Dietary
              </h3>
              {DIETARY_FILTERS.map(f => (
                <label
                  key={f.value}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    minHeight: '32px', cursor: 'pointer',
                  }}
                >
                  <div
                    onClick={() => toggleDietary(f.value)}
                    style={{
                      width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                      border: activeDietary.includes(f.value) ? '2px solid #E8650A' : '2px solid #D4C4A8',
                      background: activeDietary.includes(f.value) ? '#E8650A' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s', cursor: 'pointer',
                    }}
                  >
                    {activeDietary.includes(f.value) && (
                      <svg width="10" height="8" viewBox="0 0 12 9" fill="none">
                        <path d="M1 4L4.5 7.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span
                    onClick={() => toggleDietary(f.value)}
                    style={{ fontFamily: 'var(--font-sans)', color: '#2D1810', fontSize: '14px', fontWeight: '500' }}
                  >
                    {f.label}
                  </span>
                </label>
              ))}
            </div>

            {/* Exclude allergens section */}
            <div style={{ padding: '16px', flex: 1 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', color: '#2D1810', fontSize: '13px', fontWeight: '700', marginBottom: '8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Exclude Allergens
              </h3>
              {ALLERGEN_FILTERS.map(f => (
                <label
                  key={f.value}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', minHeight: '32px', cursor: 'pointer' }}
                >
                  <div
                    onClick={() => toggleAllergen(f.value)}
                    style={{
                      width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                      border: excludeAllergens.includes(f.value) ? '2px solid #E8650A' : '2px solid #D4C4A8',
                      background: excludeAllergens.includes(f.value) ? '#E8650A' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s', cursor: 'pointer',
                    }}
                  >
                    {excludeAllergens.includes(f.value) && (
                      <svg width="10" height="8" viewBox="0 0 12 9" fill="none">
                        <path d="M1 4L4.5 7.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span
                    onClick={() => toggleAllergen(f.value)}
                    style={{ fontFamily: 'var(--font-sans)', color: '#2D1810', fontSize: '14px', fontWeight: '500' }}
                  >
                    {f.label}
                  </span>
                </label>
              ))}
            </div>

            {/* Footer: clear + apply */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid #E8DCC8', display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button
                onClick={clearFilters}
                style={{
                  flex: 1, padding: '12px', borderRadius: '9999px',
                  background: 'transparent', border: '1.5px solid #D4C4A8',
                  color: '#8B7355', fontWeight: '600', fontSize: '14px',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.borderColor = '#2D1810')}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.borderColor = '#D4C4A8')}
              >
                Clear all
              </button>
              <button
                onClick={() => setFilterPanelOpen(false)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '9999px',
                  background: '#E8650A', border: 'none',
                  color: '#fff', fontWeight: '700', fontSize: '14px',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
