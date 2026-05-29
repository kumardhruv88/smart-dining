import React, { useState } from 'react'

/* ── Chip labels: no emojis ─────────────────────────────────────── */
const PREFERENCES = [
  { label: 'Spicy',       value: 'spicy' },
  { label: 'Light',       value: 'light' },
  { label: 'Sweet',       value: 'sweet' },
  { label: 'Filling',     value: 'filling' },
  { label: 'Surprise me', value: 'surprise' },
]

interface GreeterFlowProps {
  tableId: string
  onSubmit: (preferences: string[]) => void
  onSkip: () => void
}

export function GreeterFlow({ tableId, onSubmit, onSkip }: GreeterFlowProps) {
  const [selected, setSelected] = useState<string[]>([])

  const togglePref = (val: string) => {
    setSelected(prev =>
      prev.includes(val) ? prev.filter(p => p !== val) : [...prev, val]
    )
  }

  return (
    /* Backdrop — slightly less dark, hero visible behind */
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-400"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}
    >
      {/* Modal card — warm cream theme */}
      <div
        style={{
          background: '#FAF7F2',
          border: '1px solid #D4C4A8',
          borderRadius: '20px',
          padding: '48px 40px',
          width: '100%',
          maxWidth: '420px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
        }}
      >
        {/* Table badge */}
        <span style={{
          background: 'transparent',
          border: '1px solid #D4C4A8',
          color: '#8B7355',
          fontSize: '11px',
          fontWeight: '500',
          padding: '4px 14px',
          borderRadius: '9999px',
          letterSpacing: '0.15em',
          fontFamily: 'var(--font-sans)',
          textTransform: 'uppercase',
        }}>
          Table {tableId.toUpperCase()}
        </span>

        {/* Zara avatar — 72px, orange outline */}
        <div style={{ position: 'relative' }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: '#E8650A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '30px',
            fontWeight: '800',
            color: '#ffffff',
            fontFamily: 'var(--font-display)',
            outline: '2px solid #E8650A',
            outlineOffset: '3px',
          }}>
            Z
          </div>
        </div>

        {/* Greeting */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            color: '#2D1810',
            fontSize: '28px',
            fontWeight: '600',
            lineHeight: '1.2',
            letterSpacing: '-0.02em',
            marginBottom: '8px',
          }}>
            Hi! I'm Zara
          </h1>
          <p style={{
            color: '#8B7355',
            fontSize: '15px',
            fontWeight: '400',
            fontFamily: 'var(--font-sans)',
          }}>
            What's your vibe today?
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
          <button
            onClick={onSkip}
            style={{
              flex: 1,
              background: 'transparent',
              border: '1.5px solid #D4C4A8',
              color: '#2D1810',
              fontWeight: '500',
              borderRadius: '10px',
              height: '48px',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s',
              fontFamily: 'var(--font-sans)',
            }}
            onMouseEnter={e => {
              const b = e.currentTarget as HTMLButtonElement
              b.style.borderColor = '#E8650A'
              b.style.color = '#E8650A'
            }}
            onMouseLeave={e => {
              const b = e.currentTarget as HTMLButtonElement
              b.style.borderColor = '#D4C4A8'
              b.style.color = '#2D1810'
            }}
          >
            Just browsing
          </button>
          <button
            onClick={() => onSubmit(selected)}
            style={{
              flex: 1,
              background: '#E8650A',
              border: 'none',
              color: '#ffffff',
              fontWeight: '600',
              borderRadius: '10px',
              height: '48px',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'background 0.2s',
              fontFamily: 'var(--font-sans)',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#D4580A')}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = '#E8650A')}
          >
            Tell me what's good
          </button>
        </div>

        {/* Preference chips */}
        <div style={{ width: '100%' }}>
          <p style={{
            color: '#B8A898',
            fontSize: '10px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontWeight: '400',
            marginBottom: '10px',
            textAlign: 'center',
            fontFamily: 'var(--font-sans)',
          }}>
            Select your preferences
          </p>
          <div style={{ display: 'flex', overflowX: 'auto', gap: '8px', paddingBottom: '4px' }} className="no-scrollbar">
            {PREFERENCES.map(pref => {
              const active = selected.includes(pref.value)
              return (
                <button
                  key={pref.value}
                  onClick={() => togglePref(pref.value)}
                  style={{
                    whiteSpace: 'nowrap',
                    padding: '0 16px',
                    height: '36px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    background: active ? '#E8650A' : '#F0EAE0',
                    border: active ? '1px solid #E8650A' : '1px solid #D4C4A8',
                    color: active ? '#ffffff' : '#5C4A35',
                    fontFamily: 'var(--font-sans)',
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => {
                    if (!active) (e.currentTarget as HTMLButtonElement).style.borderColor = '#E8650A'
                  }}
                  onMouseLeave={e => {
                    if (!active) (e.currentTarget as HTMLButtonElement).style.borderColor = '#D4C4A8'
                  }}
                >
                  {pref.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* "Let's go" — appears when preferences selected */}
        {selected.length > 0 && (
          <button
            onClick={() => onSubmit(selected)}
            className="animate-in slide-in-from-bottom-4"
            style={{
              width: '100%',
              background: '#E8650A',
              border: 'none',
              color: '#ffffff',
              fontWeight: '700',
              borderRadius: '10px',
              height: '48px',
              cursor: 'pointer',
              fontSize: '15px',
              fontFamily: 'var(--font-display)',
              letterSpacing: '0.01em',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#D4580A')}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = '#E8650A')}
          >
            Let's go →
          </button>
        )}
      </div>
    </div>
  )
}
