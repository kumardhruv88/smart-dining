import React from 'react'
import { useAppStore } from '@/store'

export function ChatButton() {
  const { unreadCount, setChatOpen, clearUnread } = useAppStore()

  const handleClick = () => {
    setChatOpen(true)
    clearUnread()
  }

  return (
    <button
      onClick={handleClick}
      className="zara-chat-btn"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        background: '#E8650A',
        border: 'none',
        cursor: 'pointer',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(232,101,10,0.6)',
        animation: unreadCount > 0 ? 'pulseGlow 2s ease-in-out infinite' : 'subtlePulse 3s ease-in-out infinite',
      }}
    >
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes subtlePulse {
          0% { transform: translateX(-50%) scale(1); box-shadow: 0 4px 20px rgba(232,101,10,0.4); }
          50% { transform: translateX(-50%) scale(1.05); box-shadow: 0 4px 25px rgba(232,101,10,0.7); }
          100% { transform: translateX(-50%) scale(1); box-shadow: 0 4px 20px rgba(232,101,10,0.4); }
        }
      `}} />

      {/* Rotating orbit ring */}
      <div style={{
        position: 'absolute',
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        border: '2px solid rgba(255,255,255,0.3)',
        animation: 'orbitSpin 3s linear infinite',
      }}>
        {/* Orbiting dot */}
        <div style={{
          position: 'absolute',
          top: '-4px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: 'white',
          boxShadow: '0 0 6px rgba(255,255,255,0.8)',
        }}/>
      </div>

      {/* Second orbit at different angle */}
      <div style={{
        position: 'absolute',
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        border: '1.5px solid rgba(255,255,255,0.15)',
        animation: 'orbitSpin 5s linear infinite reverse',
      }}>
        <div style={{
          position: 'absolute',
          bottom: '-3px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.7)',
        }}/>
      </div>

      {/* Z letter in center */}
      <span style={{
        color: 'white',
        fontSize: '28px',
        fontWeight: '700',
        fontFamily: 'serif',
        zIndex: 2,
        letterSpacing: '-0.02em',
      }}>Z</span>

      {/* Unread badge */}
      {unreadCount > 0 && (
        <div style={{
          position: 'absolute',
          top: '0px',
          right: '0px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: '#ef4444',
          border: '2px solid white',
          fontSize: '11px',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: '700',
          zIndex: 3,
        }}>
          {unreadCount > 9 ? '9+' : unreadCount}
        </div>
      )}
    </button>
  )
}
