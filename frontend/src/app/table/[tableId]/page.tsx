'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAppStore } from '@/store'
import { MainMenu } from '@/components/MainMenu'
import { GreeterFlow } from '@/components/GreeterFlow'
import { useSocket } from '@/hooks/useSocket'
import { ChatButton } from '@/components/ChatButton'
import { ChatDrawer } from '@/components/ChatDrawer'
import { CartDrawer } from '@/components/CartDrawer'
import { GroupBanner } from '@/components/GroupBanner'

export default function TablePage() {
  const params = useParams()
  const tableId = params.tableId as string
  
  const { sessionId, setSession, preferences, setPreference, addChatMessage, setChatOpen, clearUnread, groupMembers } = useAppStore()
  
  const [loading, setLoading] = useState(true)
  const [showGreeter, setShowGreeter] = useState(false)

  // Initialize Socket via custom hook
  useSocket(sessionId ? tableId : null)

  useEffect(() => {
    async function initSession() {
      try {
        const res = await fetch(`/api/table/${tableId}/session`)
        const data = await res.json()
        
        if (data.sessionId) {
          setSession(data.sessionId, tableId)
          localStorage.setItem('sessionId', data.sessionId)
          
          if (Object.keys(data.preferences || {}).length === 0 && Object.keys(preferences).length === 0) {
            setShowGreeter(true)
          } else {
            Object.entries(data.preferences || {}).forEach(([k, v]) => {
              setPreference(k, v as boolean)
            })
          }

          // Fetch initial cart
          fetch(`/api/session/${data.sessionId}/cart`)
            .then(r => r.json())
            .then(cartData => {
              if (cartData.items) {
                useAppStore.getState().setCart(cartData.items, cartData.total, cartData.gst)
              }
            })
            .catch(console.error)
        }
      } catch (e) {
        console.error("Session init failed", e)
      } finally {
        setLoading(false)
      }
    }
    
    initSession()
  }, [tableId])

  const handleGreeterSubmit = async (selectedPrefs: string[]) => {
    // Save preferences locally in store
    selectedPrefs.forEach(p => setPreference(p, true))
    setShowGreeter(false)
    
    if (sessionId) {
      try {
        let greetMessage = 'Hello, I just joined the table!'
        if (selectedPrefs.includes('surprise')) {
          greetMessage = 'Surprise me! Suggest some delicious recommendations for me.'
        } else if (selectedPrefs.length > 0) {
          greetMessage = `Hello, I just joined! Suggest some items that are: ${selectedPrefs.join(', ')}.`
        }

        const res = await fetch(`/api/session/${sessionId}/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: greetMessage,
            tableId,
            preferences: selectedPrefs.reduce((acc, p) => ({ ...acc, [p]: true }), {})
          })
        })
        const aiResponse = await res.json()
        
        // Add user message first
        addChatMessage({
          id: Date.now().toString() + '-user',
          sender: 'user',
          text: greetMessage,
          timestamp: new Date()
        })
        
        // Add Zara's response
        addChatMessage({
          id: Date.now().toString(),
          sender: 'Zara',
          text: aiResponse.message || aiResponse.error || JSON.stringify(aiResponse),
          timestamp: new Date(),
          suggestions: aiResponse.suggestions || []
        })
        
        // Then open chat drawer directly
        setChatOpen(true)
        clearUnread()
      } catch (e) {
        console.error("Greeter AI update failed", e)
      }
    }
  }

  // Loading is now handled in the background, no blocking screen here

  return (
    <main>
      <GroupBanner members={groupMembers} />
      {/* Main content always visible */}
      <MainMenu />
      <ChatButton />
      <ChatDrawer />
      <CartDrawer />

      {/* Greeter appears as overlay modal on top */}
      {showGreeter && (
        <GreeterFlow
          tableId={tableId}
          onSubmit={handleGreeterSubmit}
          onSkip={() => setShowGreeter(false)}
        />
      )}
    </main>
  )
}
