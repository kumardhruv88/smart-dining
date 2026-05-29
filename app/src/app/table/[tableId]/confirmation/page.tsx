'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { io } from 'socket.io-client'
import { useAppStore } from '@/store'

const STATUS_STEPS = [
  { key: 'PENDING',   label: 'Placed',     icon: '✓' },
  { key: 'CONFIRMED', label: 'Confirmed',  icon: '📋' },
  { key: 'PREPARING', label: 'Preparing',  icon: '🍳' },
  { key: 'READY',     label: 'Ready',      icon: '🔔' },
  { key: 'DELIVERED', label: 'Delivered',  icon: '🎉' },
]

export default function ConfirmationPage() {
  const params = useParams()
  const tableId = params.tableId as string
  const { setSession } = useAppStore()
  
  const [orderId, setOrderId] = useState<string | null>(null)
  const [status, setStatus] = useState('pending')
  const [orderItems, setOrderItems] = useState<any[]>([])
  const [orderTotal, setOrderTotal] = useState(0)
  const [orderTax, setOrderTax] = useState(0)
  const [loading, setLoading] = useState(true)

  // Safe search params parsing for client-side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      setOrderId(urlParams.get('orderId'))
    }
  }, [])

  // Fetch order details
  useEffect(() => {
    if (!orderId) return
    const fetchOrder = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/order/${orderId}`)
        const data = await res.json()
        if (data.order) {
          setOrderItems(data.order.items || [])
          setOrderTotal(Number(data.order.totalAmount || 0))
          setOrderTax(Number(data.order.taxAmount || 0))
          setStatus(data.order.status.toLowerCase())
        }
      } catch (e) {
        console.error("Failed to fetch order:", e)
      } finally {
        setLoading(false)
      }
    }
    fetchOrder()
  }, [orderId])

  // Real-time socket updates for order status
  useEffect(() => {
    if (!tableId || !orderId) return
    const socket = io({ auth: { tableId } })
    
    socket.on('order:status_updated', (data: { orderId: string, status: string }) => {
      if (data.orderId === orderId) {
        setStatus(data.status.toLowerCase())
      }
    })

    return () => {
      socket.disconnect()
    }
  }, [tableId, orderId])

  const handleNewSession = () => {
    setSession(null as any, tableId)
    useAppStore.getState().setCart([], 0, 0)
    window.location.href = `/table/${tableId}`
  }

  const currentIdx = STATUS_STEPS.findIndex(s => s.key === status.toUpperCase())

  if (loading && orderId) {
    return (
      <div style={{ minHeight: '100svh', background: '#FAF7F2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #E8DCC8', borderTopColor: '#2D1810', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ marginTop: '16px', color: '#2D1810', fontWeight: '500', fontFamily: 'serif' }}>Loading order details...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100svh', background: '#FAF7F2', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 16px 60px' }}>
      
      {/* Card */}
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          borderRadius: '24px',
          overflow: 'hidden',
          border: '1px solid #E8DCC8',
          background: '#FFFFFF',
          boxShadow: '0 12px 40px rgba(45,24,16,0.06)',
        }}
      >
        {/* Banner */}
        <div style={{
          padding: '32px 24px',
          textAlign: 'center',
          background: '#2D1810',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative rings */}
          <div style={{ position: 'absolute', width: '200px', height: '200px', borderRadius: '50%', border: '1px solid rgba(250,247,242,0.04)', top: '-80px', right: '-60px', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', width: '140px', height: '140px', borderRadius: '50%', border: '1px solid rgba(232,101,10,0.1)', bottom: '-60px', left: '-40px', pointerEvents: 'none' }} />

          <h1 style={{ fontFamily: 'serif', color: '#FAF7F2', fontSize: '28px', fontWeight: '600', marginBottom: '8px', position: 'relative', zIndex: 1 }}>
            Hold tight! ⏳
          </h1>
          <p style={{ color: '#B8A898', position: 'relative', zIndex: 1, marginBottom: '16px', fontSize: '15px' }}>
            Estimated wait:{' '}
            <strong style={{ color: '#FAF7F2', fontSize: '20px', fontFamily: 'serif' }}>~20 mins</strong>
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', position: 'relative', zIndex: 1 }}>
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#E8650A', animation: 'pulseRing 1.5s ease-out infinite', position: 'absolute', opacity: 0.6 }} />
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#E8650A' }} />
            </span>
            <span style={{ fontSize: '13px', color: '#FAF7F2', opacity: 0.8, letterSpacing: '0.04em' }}>Tracking in real-time</span>
          </div>
        </div>

        <div style={{ padding: '28px 24px' }}>
          {/* Status tracker */}
          <div style={{ marginBottom: '28px' }}>
            {/* Progress bar */}
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <div style={{ position: 'absolute', top: '14px', left: '12px', right: '12px', height: '2px', background: '#E8DCC8' }} />
              <div style={{
                position: 'absolute',
                top: '14px',
                left: '12px',
                height: '2px',
                background: 'linear-gradient(90deg, #E8650A, #FF9F43)',
                width: `${(currentIdx / (STATUS_STEPS.length - 1)) * 100}%`,
                maxWidth: 'calc(100% - 24px)',
                transition: 'width 0.6s ease',
              }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
                {STATUS_STEPS.map((s, i) => {
                  const isActive = i === currentIdx
                  const isCompleted = i < currentIdx
                  const isUpcoming = i > currentIdx

                  let bg = '#FFFFFF'
                  let border = '2px solid #D4C4A8'
                  let color = '#8B7355'
                  let boxShadow = 'none'
                  let iconToShow = s.icon

                  if (isActive) {
                    bg = '#E8650A'
                    border = '2px solid #E8650A'
                    color = '#FAF7F2'
                    boxShadow = '0 0 12px rgba(232,101,10,0.2)'
                  } else if (isCompleted) {
                    bg = '#E8650A'
                    border = '2px solid #E8650A'
                    color = '#FAF7F2'
                    iconToShow = '✓'
                  } else if (isUpcoming) {
                    bg = '#FFFFFF'
                    border = '2px solid #D4C4A8'
                    color = '#B8A898'
                  }

                  return (
                    <div key={s.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '13px',
                        background: bg,
                        border: border,
                        color: color,
                        boxShadow: boxShadow,
                        transition: 'all 0.4s ease',
                        transform: isActive ? 'scale(1.2)' : 'scale(1)',
                      }}>
                        {iconToShow}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            {/* Labels */}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '2px', paddingRight: '2px' }}>
              {STATUS_STEPS.map((s, i) => (
                <div key={s.key} style={{ width: '44px', textAlign: 'center' }}>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: '700',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: i <= currentIdx ? '#E8650A' : '#8B7355',
                  }}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ height: '1px', background: '#E8DCC8', marginBottom: '20px' }} />

          {/* Order summary */}
          <h3 style={{ fontFamily: 'serif', color: '#2D1810', fontSize: '18px', fontWeight: '600', marginBottom: '14px' }}>
            Order Summary
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {orderItems.length > 0 ? (
              orderItems.map((item: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                  <div style={{ display: 'flex', gap: '8px', color: '#8B7355' }}>
                    <span style={{ fontWeight: '700', color: '#2D1810' }}>{item.quantity}×</span>
                    <span>{item.menuItem?.name || 'Item'}</span>
                  </div>
                  <span style={{ fontWeight: '700', color: '#2D1810' }}>₹{Number(item.unitPrice || item.menuItem?.price || 0) * item.quantity}</span>
                </div>
              ))
            ) : (
              <p style={{ fontSize: '13px', color: '#8B7355', fontStyle: 'italic' }}>No items in summary.</p>
            )}
          </div>

          <div style={{
            borderRadius: '14px',
            background: '#FAF7F2',
            border: '1px solid #E8DCC8',
            padding: '16px',
            marginBottom: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            {[
              { label: 'Subtotal', value: orderTotal - orderTax },
              { label: 'Taxes & Charges', value: orderTax },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#8B7355' }}>
                <span>{row.label}</span><span>₹{row.value >= 0 ? Math.round(row.value) : 0}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #E8DCC8', fontFamily: 'serif' }}>
              <span style={{ color: '#2D1810', fontSize: '18px', fontWeight: '600' }}>Total</span>
              <span style={{ color: '#E8650A', fontSize: '20px', fontWeight: '700' }}>₹{orderTotal}</span>
            </div>
          </div>

          <button
            onClick={handleNewSession}
            style={{
              width: '100%',
              height: '50px',
              borderRadius: '14px',
              background: '#2D1810',
              border: 'none',
              color: '#FAF7F2',
              fontFamily: 'serif',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              letterSpacing: '0.01em',
            }}
            onMouseEnter={e => {
              const b = e.currentTarget as HTMLButtonElement
              b.style.background = '#1A0E08'
            }}
            onMouseLeave={e => {
              const b = e.currentTarget as HTMLButtonElement
              b.style.background = '#2D1810'
            }}
          >
            Order something else →
          </button>
        </div>
      </div>
    </div>
  )
}
