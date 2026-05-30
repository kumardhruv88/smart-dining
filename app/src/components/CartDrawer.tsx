import React, { useState } from 'react'
import { useAppStore } from '@/store'
import { CheckoutModal } from './CheckoutModal'

export function CartDrawer() {
  const { cartDrawerOpen, setCartDrawerOpen, cartItems, cartTotal, cartGst, removeCartItem, sessionId } = useAppStore()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const handleClose = () => setCartDrawerOpen(false)
  const currentUser = typeof window !== 'undefined' ? (sessionStorage.getItem('displayName') || 'User') : 'User'

  const handleQtyChange = async (itemId: string, newQty: number) => {
    const storeState = useAppStore.getState()
    const originalCart = storeState.cartItems
    const originalTotal = storeState.cartTotal
    const originalGst = storeState.cartGst

    if (newQty <= 0) {
      storeState.removeCartItem(itemId)
      const doApi = async () => {
        const res = await fetch(`/api/session/${sessionId}/cart/${itemId}`, {
          method: 'DELETE',
          headers: { 'x-display-name': encodeURIComponent(currentUser) }
        })
        if (!res.ok) throw new Error('API failed')
        const data = await res.json()
        if (data.cart) useAppStore.getState().setCart(data.cart.items, data.cart.total, data.cart.gst)
      }
      doApi().catch(() => storeState.setCart(originalCart, originalTotal, originalGst))
    } else if (sessionId) {
      const updatedCart = originalCart.map((ci: any) => ci.menuItem.id === itemId || ci.id === itemId ? { ...ci, quantity: newQty } : ci)
      const newTotal = updatedCart.reduce((acc, ci) => acc + (ci.menuItem?.price || 0) * ci.quantity, 0)
      storeState.setCart(updatedCart, newTotal, newTotal * 0.05)

      const doApi = async () => {
        const res = await fetch(`/api/session/${sessionId}/cart/${itemId}`, {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            'x-display-name': encodeURIComponent(currentUser)
          },
          body: JSON.stringify({ quantity: newQty }),
        })
        if (!res.ok) throw new Error('API failed')
        const data = await res.json()
        if (data.cart) useAppStore.getState().setCart(data.cart.items, data.cart.total, data.cart.gst)
      }
      doApi().catch(() => storeState.setCart(originalCart, originalTotal, originalGst))
    }
  }

  const handleInstructionsChange = async (itemId: string, val: string) => {
    if (sessionId) {
      try {
        const res = await fetch(`/api/session/${sessionId}/cart/${itemId}`, {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            'x-display-name': encodeURIComponent(currentUser)
          },
          body: JSON.stringify({ specialInstructions: val }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.cart) useAppStore.getState().setCart(data.cart.items, data.cart.total, data.cart.gst)
        }
      } catch {}
    }
  }

  if (!cartDrawerOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 110, display: 'flex', justifyContent: 'flex-end' }}>
      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)' }}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        className="animate-in slide-in-from-right duration-300"
        style={{
          position: 'relative', width: '100%', maxWidth: '380px', height: '100%',
          display: 'flex', flexDirection: 'column',
          background: '#FAF7F2',
          borderLeft: '1px solid #D4C4A8',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px',
          borderBottom: '1px solid #E8DCC8',
          background: '#FAF7F2',
        }}>
          <div>
            <h2 style={{
              fontFamily: 'var(--font-display)', color: '#2D1810',
              fontSize: '20px', fontWeight: '600', lineHeight: '1', marginBottom: '4px',
            }}>
              Your Order
            </h2>
            <p style={{ color: '#8B7355', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
              {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{
              width: '36px', height: '36px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none',
              color: '#8B7355', fontSize: '20px', cursor: 'pointer', transition: 'color 0.2s',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = '#2D1810')}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = '#8B7355')}
          >✕</button>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {cartItems.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D4C4A8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', color: '#8B7355', fontSize: '16px', fontWeight: 'normal', margin: '0 0 4px 0' }}>
                  Your cart is empty
                </h3>
                <span style={{ fontSize: '13px', color: '#B8A898', fontFamily: 'var(--font-sans)' }}>Ask Zara what to order</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <style>{`
                @keyframes highlightPulse {
                  0% { background-color: rgba(22, 163, 74, 0.15); border-color: #16a34a; }
                  100% { background-color: #FFFFFF; border-color: #E8DCC8; }
                }
              `}</style>
              {cartItems.map((item: any, i: number) => {
                const isExternal = item.addedBy !== currentUser;
                return (
                  <div
                    key={item.id || i}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      padding: '12px',
                      borderRadius: '12px',
                      background: '#FFFFFF',
                      border: '1px solid #E8DCC8',
                      animation: isExternal ? 'highlightPulse 2.5s ease-out' : 'none',
                    }}
                  >
                    {/* Top Row: Thumbnail + Info + Stepper */}
                    <div style={{ display: 'flex', gap: '12px', width: '100%', alignItems: 'center' }}>
                      {/* Thumbnail */}
                      <div style={{ width: '56px', height: '56px', borderRadius: '8px', overflow: 'hidden', background: '#F5F0E8', flexShrink: 0 }}>
                        {item.menuItem?.imageUrl && (
                          <img src={item.menuItem.imageUrl} alt={item.menuItem.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                      </div>
                      
                      {/* Item Info */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <h4 style={{ fontFamily: 'var(--font-display)', color: '#2D1810', fontSize: '14px', fontWeight: '500', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.menuItem?.name}
                        </h4>
                        <span style={{ color: '#8B7355', fontSize: '12px', fontFamily: 'var(--font-sans)', marginTop: '2px' }}>
                          ₹{Number(item.menuItem?.price || 0).toFixed(2)}
                        </span>
                        {/* Added by Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            background: item.addedBy === currentUser ? '#2D1810' : '#E8650A',
                            color: '#FAF7F2',
                            fontSize: '9px',
                            fontWeight: '700',
                          }} title={`Added by ${item.addedBy || 'Guest'}`}>
                            {(item.addedBy || 'G').charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontSize: '11px', color: '#8B7355', fontFamily: 'var(--font-sans)' }}>
                            {item.addedBy === currentUser ? 'You' : item.addedBy || 'Guest'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Stepper + Subtotal stacked */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <button
                            onClick={() => handleQtyChange(item.id, item.quantity - 1)}
                            style={{
                              width: '24px',
                              height: '24px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#2D1810',
                              fontSize: '14px',
                              borderRadius: '50%',
                              background: '#FFFFFF',
                              border: '1px solid #D4C4A8',
                              cursor: 'pointer',
                              transition: 'border-color 0.2s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = '#E8650A')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = '#D4C4A8')}
                          >−</button>
                          <span style={{ minWidth: '24px', textAlign: 'center', color: '#2D1810', fontWeight: '600', fontSize: '14px', fontFamily: 'var(--font-sans)' }}>
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleQtyChange(item.id, item.quantity + 1)}
                            style={{
                              width: '24px',
                              height: '24px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#2D1810',
                              fontSize: '14px',
                              borderRadius: '50%',
                              background: '#FFFFFF',
                              border: '1px solid #D4C4A8',
                              cursor: 'pointer',
                              transition: 'border-color 0.2s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = '#E8650A')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = '#D4C4A8')}
                          >+</button>
                        </div>
                        <span style={{ color: '#E8650A', fontWeight: '600', fontSize: '13px', textAlign: 'right', fontFamily: 'var(--font-sans)' }}>
                          ₹{(Number(item.menuItem?.price || 0) * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Row: Special Instructions Input */}
                    <div style={{ width: '100%', borderTop: '1px dashed #E8DCC8', paddingTop: '8px' }}>
                      <input
                        type="text"
                        placeholder="Add special instructions (e.g. no onions)..."
                        value={item.specialInstructions || ''}
                        onChange={async (e) => {
                          const val = e.target.value;
                          // Optimistic store update to prevent lag
                          const updatedItems = cartItems.map((ci: any) => 
                            ci.id === item.id ? { ...ci, specialInstructions: val } : ci
                          );
                          useAppStore.getState().setCart(updatedItems, cartTotal, cartGst);
                          await handleInstructionsChange(item.id, val);
                        }}
                        style={{
                          width: '100%',
                          fontSize: '11px',
                          padding: '6px 10px',
                          background: '#FAF7F2',
                          border: '1px solid #E8DCC8',
                          borderRadius: '6px',
                          color: '#2D1810',
                          outline: 'none',
                          fontFamily: 'var(--font-sans)',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Summary + CTA */}
        {cartItems.length > 0 && (
          <div style={{ padding: '16px', borderTop: '1px solid #E8DCC8', background: '#FAF7F2' }}>
            <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#5C4A35', fontFamily: 'var(--font-sans)' }}>
                <span>Subtotal</span>
                <span>₹{Number(cartTotal || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#8B7355', fontFamily: 'var(--font-sans)' }}>
                <span>GST (5%)</span>
                <span>₹{Number(cartGst || 0).toFixed(2)}</span>
              </div>
              
              <div style={{ height: '1px', background: '#E8DCC8', margin: '4px 0' }} />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#2D1810', fontSize: '16px', fontWeight: '700', fontFamily: 'var(--font-display)' }}>Total</span>
                <span style={{ color: '#E8650A', fontSize: '18px', fontWeight: '700', fontFamily: 'var(--font-sans)' }}>₹{(Number(cartTotal || 0) + Number(cartGst || 0)).toFixed(2)}</span>
              </div>
            </div>
            
            <button
              onClick={() => setCheckoutOpen(true)}
              style={{
                width: '100%', height: '48px', borderRadius: '12px',
                background: '#2D1810', border: 'none',
                color: '#FAF7F2', fontFamily: 'var(--font-sans)',
                fontSize: '15px', fontWeight: '600',
                cursor: 'pointer', transition: 'background 0.2s',
                letterSpacing: '0.03em',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#1A0E08' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#2D1810' }}
            >
              Place Order →
            </button>
          </div>
        )}
      </div>
      <CheckoutModal isOpen={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
    </div>
  )
}
