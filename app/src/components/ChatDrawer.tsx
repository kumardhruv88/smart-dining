import React, { useState, useRef, useEffect } from 'react'
import { useAppStore } from '@/store'
import { SuggestionCard } from './SuggestionCard'
import { Sparkles, X, Send, Mic } from 'lucide-react'

const QUICK_TAPS = [
  { label: 'Spicy',        msg: 'Show me spicy popular items' },
  { label: 'Light',        msg: 'I want something light and low-calorie' },
  { label: 'Filling',      msg: 'I want a heavy filling main course' },
  { label: 'Dessert',      msg: 'What desserts do you recommend?' },
  { label: 'Pairing',      msg: "What drinks go well with what I've ordered?" },
  { label: 'Best Sellers', msg: 'Show me the best sellers right now' },
  { label: 'Chef Special', msg: "What's the chef's special today?" },
  { label: 'Good for Groups', msg: "We're a group, suggest items that work for everyone" },
]

export function ChatDrawer() {
  const { isChatOpen, setChatOpen, sessionId, tableId, setCart, chatMessages, addChatMessage, updateChatMessage } = useAppStore()
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        const rec = new SpeechRecognition()
        rec.continuous = false
        rec.interimResults = false
        rec.lang = 'en-US'

        rec.onstart = () => {
          setIsListening(true)
        }

        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript
          setInput((prev) => {
            const separator = prev.trim() ? ' ' : ''
            return prev + separator + transcript
          })
        }

        rec.onerror = (e: any) => {
          console.error('Speech recognition error', e)
          setIsListening(false)
        }

        rec.onend = () => {
          setIsListening(false)
        }

        recognitionRef.current = rec
      }
    }
  }, [])

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please try Chrome or Safari.')
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
    } else {
      recognitionRef.current.start()
    }
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chatMessages, isTyping])

  const handleClose = () => setChatOpen(false)

  const handleSend = async (text: string) => {
    if (!text.trim() || !sessionId) return
    const newMsg = { id: Date.now().toString(), sender: 'user', text, timestamp: new Date() }
    addChatMessage(newMsg)
    setInput('')
    setIsTyping(true)

    const zaraId = 'zara_' + Date.now().toString()
    addChatMessage({ id: zaraId, sender: 'Zara', text: '', suggestions: [], timestamp: new Date() })

    const eventSource = new EventSource(
      `/api/session/${sessionId ?? ''}/ai/stream?message=${encodeURIComponent(text)}&tableId=${encodeURIComponent(tableId ?? 'T1')}`
    )
    let fullText = ''

    eventSource.onmessage = (e) => {
      if (e.data === '[DONE]') {
        eventSource.close()
        setIsTyping(false)
        
        let suggestions: any[] = []
        let action = ''
        let displayMsg = fullText

        // Clean markdown
        const cleanText = fullText.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim()
        const firstBrace = cleanText.indexOf('{')
        const lastBrace = cleanText.lastIndexOf('}')

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
          const textBefore = cleanText.substring(0, firstBrace).trim()
          const jsonStr = cleanText.substring(firstBrace, lastBrace + 1)
          let parsed: any = null
          try {
            parsed = JSON.parse(jsonStr)
            
            // Check for __json_meta or direct structure
            if (parsed.__json_meta) {
              suggestions = parsed.__json_meta.suggestions || []
              action = parsed.__json_meta.action || ''
            } else if (parsed.suggestions || parsed.items || parsed.message) {
              suggestions = parsed.suggestions || parsed.items || []
              action = parsed.action || ''
            }

            // Display message: prefer text before JSON. If none, use parsed.message
            if (textBefore) {
              displayMsg = textBefore
            } else if (parsed.message) {
              displayMsg = parsed.message
            } else {
              displayMsg = ''
            }
          } catch {
            // If parse fails, at least hide the JSON string if there was text before it
            if (textBefore) displayMsg = textBefore
          }

          updateChatMessage(zaraId, displayMsg, suggestions)

          // Handle clearCart: wipe cart store so items disappear after AI-driven order
          if (parsed?.__json_meta?.clearCart) {
            setCart([], 0, 0)
          }
        } else {
          displayMsg = cleanText
          updateChatMessage(zaraId, displayMsg, suggestions)
        }

        if (action && action.startsWith('redirect:')) {
          const redirectUrl = action.replace('redirect:', '')
          setTimeout(() => {
            window.location.href = redirectUrl
          }, 2000)
        }
        return
      }
      
      try {
        const parsedData = JSON.parse(e.data)
        fullText += parsedData
      } catch {
        fullText += e.data
      }

      let displayMsg = fullText
      const cleanText = fullText.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim()
      const firstBrace = cleanText.indexOf('{')
      
      if (firstBrace !== -1) {
         const textBefore = cleanText.substring(0, firstBrace).trim()
         if (textBefore) {
            displayMsg = textBefore
         } else {
            // If there's no text before, try extracting a "message": "..." field with regex
            const msgMatch = cleanText.match(/"message"\s*:\s*"([^"]+)/)
            if (msgMatch) {
               displayMsg = msgMatch[1] ?? ''
            } else {
               displayMsg = '' // Hide raw JSON brackets from user while streaming
            }
         }
      } else {
         displayMsg = cleanText
      }
      
      updateChatMessage(zaraId, displayMsg)
    }

    eventSource.onerror = () => { eventSource.close(); setIsTyping(false) }
  }

  const handleAddSuggestion = async (itemId: string) => {
    try {
      const displayName = sessionStorage.getItem('displayName') || 'User'
      const res = await fetch(`/api/session/${sessionId ?? ''}/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuItemId: itemId, quantity: 1, addedBy: displayName }),
      })
      if (!res.ok) throw new Error('Failed')
      return true
    } catch { return false }
  }

  if (!isChatOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 110, display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end' }}>
      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
        onClick={handleClose}
      />

      {/* Drawer panel — warm cream minimalist theme */}
      <div
        className="animate-in slide-in-from-right duration-300"
        style={{
          position: 'relative',
          width: '360px',
          maxWidth: 'calc(100vw - 40px)',
          height: '70vh',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#FAF7F2',
          borderRadius: '20px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          border: '1px solid #E8DCC8',
          overflow: 'hidden',
          marginRight: '20px',
          marginBottom: '88px',
          zIndex: 1,
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '52px',
          padding: '0 16px',
          borderBottom: '1px solid #F0EAE0',
          background: '#ffffff',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Minimalist AI Avatar */}
            <div style={{
              width: '32px',
              height: '32px', 
              borderRadius: '50%',
              background: '#E8650A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '14px',
              fontWeight: '700',
              fontFamily: 'var(--font-serif)',
            }}>Z</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', color: '#2D1810', fontSize: '14px', fontWeight: '600', lineHeight: '1.2' }}>
                Zara AI
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#16a34a' }} />
                <span style={{ fontSize: '11px', color: '#8B7355', fontFamily: 'var(--font-sans)', fontWeight: '500' }}>Dining Assistant</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: '1px solid #D4C4A8',
              color: '#2D1810', cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              const b = e.currentTarget as HTMLButtonElement
              b.style.background = '#E8DCC8'
              b.style.borderColor = '#C4B498'
            }}
            onMouseLeave={e => {
              const b = e.currentTarget as HTMLButtonElement
              b.style.background = 'transparent'
              b.style.borderColor = '#D4C4A8'
            }}
          >
            <X style={{ width: '14px', height: '14px' }} />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{ height: 'calc(70vh - 180px)', overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '16px', scrollbarWidth: 'thin', scrollbarColor: '#E8DCC8 transparent' }}>
          <div style={{ textAlign: 'center', fontSize: '10px', color: '#B8A898', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-sans)', fontWeight: '600' }}>
            Today
          </div>

          {chatMessages.map(msg => {
            const isUser = msg.sender === 'user'
            const isUpsell = msg.isUpsell
            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  padding: '8px 12px',
                  fontSize: '13px',
                  lineHeight: '1.45',
                  fontFamily: 'var(--font-sans)',
                  ...(isUser ? {
                    background: '#2D1810',
                    color: '#FAF7F2',
                    borderRadius: '14px 14px 4px 14px',
                    maxWidth: '78%',
                  } : isUpsell ? {
                    background: '#FDF8F5',
                    border: '1px solid #E8DCC8',
                    color: '#D4580A',
                    borderRadius: '14px 14px 14px 4px',
                    maxWidth: '82%',
                  } : {
                    background: '#ffffff',
                    border: '1px solid #E8DCC8',
                    color: '#2D1810',
                    borderRadius: '14px 14px 14px 4px',
                    maxWidth: '82%',
                  }),
                }}>
                  <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{msg.text}</p>
                </div>

                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div style={{ marginTop: '12px', display: 'flex', overflowX: 'auto', gap: '12px', paddingBottom: '6px', width: '100%' }} className="no-scrollbar">
                    {msg.suggestions.map((s: any) => (
                      <SuggestionCard key={s.itemId} {...s} onAdd={handleAddSuggestion} />
                    ))}
                  </div>
                )}

                <span style={{ fontSize: '10px', color: '#B8A898', marginTop: '2px', padding: '0 4px', fontFamily: 'var(--font-sans)' }}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )
          })}

          {isTyping && (
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{
                background: '#ffffff',
                border: '1px solid #E8DCC8',
                borderRadius: '14px 14px 14px 4px',
                padding: '12px',
                display: 'flex',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              }}>
                {[0, 0.2, 0.4].map((delay, i) => (
                  <div key={i} style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: '#E8650A',
                    animation: `floatY 0.8s ${delay}s ease-in-out infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div style={{ background: '#ffffff', borderTop: '1px solid #E8DCC8', paddingBottom: 'env(safe-area-inset-bottom)', flexShrink: 0 }}>
          {/* Quick taps */}
          <div style={{ display: 'flex', overflowX: 'auto', gap: '6px', padding: '6px 12px', borderBottom: '1px solid #E8DCC8' }} className="no-scrollbar">
            {QUICK_TAPS.map((qt, i) => (
              <button
                key={i}
                onClick={() => handleSend(qt.msg)}
                style={{
                  whiteSpace: 'nowrap',
                  height: '28px',
                  padding: '0 10px',
                  borderRadius: '14px',
                  fontSize: '11px',
                  fontWeight: '600',
                  background: '#FAF7F2',
                  border: '1px solid #D4C4A8',
                  color: '#5C4A35',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: 'var(--font-sans)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={e => {
                  const b = e.currentTarget as HTMLButtonElement
                  b.style.borderColor = '#E8650A'
                  b.style.color = '#E8650A'
                }}
                onMouseLeave={e => {
                  const b = e.currentTarget as HTMLButtonElement
                  b.style.borderColor = '#D4C4A8'
                  b.style.color = '#5C4A35'
                }}
              >
                {qt.label}
              </button>
            ))}
          </div>

          {/* Text input */}
          <div style={{ padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'center', background: '#ffffff' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(input) }
              }}
              placeholder="Ask Zara anything…"
              maxLength={500}
              rows={1}
              style={{
                flex: 1,
                background: '#FAF7F2',
                border: '1.5px solid #D4C4A8',
                borderRadius: '18px',
                padding: '8px 12px',
                color: '#2D1810',
                fontSize: '13px',
                resize: 'none',
                outline: 'none',
                height: '36px',
                minHeight: '36px',
                maxHeight: '100px',
                fontFamily: 'var(--font-sans)',
                transition: 'border-color 0.2s',
                lineHeight: '1.4',
              }}
              onFocus={e => {
                e.target.style.borderColor = '#E8650A'
              }}
              onBlur={e => {
                e.target.style.borderColor = '#D4C4A8'
              }}
            />
            {/* Microphone button */}
            <button
              onClick={toggleListening}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: isListening ? '#ef4444' : '#FAF7F2',
                border: '1px solid #D4C4A8',
                color: isListening ? '#ffffff' : '#5C4A35',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                if (!isListening) {
                  (e.currentTarget as HTMLButtonElement).style.background = '#E8DCC8'
                }
              }}
              onMouseLeave={e => {
                if (!isListening) {
                  (e.currentTarget as HTMLButtonElement).style.background = '#FAF7F2'
                }
              }}
              title={isListening ? 'Stop listening' : 'Start speaking'}
            >
              <Mic style={{ width: '15px', height: '15px' }} />
            </button>

            {/* Send button (upward arrow) */}
            <button
              onClick={() => handleSend(input)}
              disabled={!input.trim()}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#E8650A',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                opacity: input.trim() ? 1 : 0.5,
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                if (input.trim()) {
                  (e.currentTarget as HTMLButtonElement).style.background = '#D4580A'
                  ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
                }
              }}
              onMouseLeave={e => {
                if (input.trim()) {
                  (e.currentTarget as HTMLButtonElement).style.background = '#E8650A'
                  ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
                }
              }}
            >
              <span style={{ marginLeft: '1px', fontSize: '15px', fontWeight: 'bold', lineHeight: '1' }}>↑</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
