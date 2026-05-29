'use client'

import React, { useEffect } from 'react'
import { useAppStore } from '@/store'

export function UpsellCard() {
  const { activeUpsell, clearUpsell, sessionId } = useAppStore()

  useEffect(() => {
    if (activeUpsell) {
      const timer = setTimeout(clearUpsell, 10000) // 10 seconds auto-dismiss
      return () => clearTimeout(timer)
    }
  }, [activeUpsell, clearUpsell])

  if (!activeUpsell) return null

  const handleAdd = async () => {
    try {
      const displayName = sessionStorage.getItem('displayName') || 'User'
      await fetch(`/api/session/${sessionId}/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuItemId: activeUpsell.itemId, quantity: 1, addedBy: displayName })
      })
      clearUpsell()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div
      className="fixed bottom-24 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-4 z-[105] w-[90%] md:w-[320px] rounded-lg shadow-xl p-3 animate-in slide-in-from-bottom fade-in duration-300"
      style={{
        background: '#FAF7F2',
        border: '1px solid #E8DCC8',
        borderLeft: '4px solid #E8650A',
      }}
    >
      <div className="flex justify-between items-start mb-2">
        <p className="text-sm font-medium pr-6 leading-tight" style={{ color: '#2D1810' }}>
          <span className="font-bold mr-1" style={{ color: '#E8650A' }}>✨ Zara suggests:</span>
          {activeUpsell.message}
        </p>
        <button
          onClick={clearUpsell}
          className="absolute top-2 right-2 p-1"
          style={{ color: '#8B7355', background: 'transparent' }}
        >
          &times;
        </button>
      </div>
      
      <div
        className="flex items-center gap-3 rounded-lg p-2"
        style={{ background: '#FFFFFF', border: '1px solid #E8DCC8' }}
      >
        <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0" style={{ background: '#FAF7F2', border: '1px solid #E8DCC8' }}>
          {activeUpsell.imageUrl ? (
            <img src={activeUpsell.imageUrl} alt={activeUpsell.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px]" style={{ color: '#8B7355' }}>No Img</div>
          )}
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold leading-tight line-clamp-1" style={{ color: '#2D1810' }}>{activeUpsell.name}</h4>
          <span className="text-xs font-bold" style={{ color: '#E8650A' }}>₹{activeUpsell.price}</span>
        </div>
        <button
          onClick={handleAdd}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          style={{ background: '#2D1810', color: '#FAF7F2' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#1A0E08')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#2D1810')}
        >
          Add
        </button>
      </div>
    </div>
  )
}
