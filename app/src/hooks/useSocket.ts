import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'

// Detect if we're on Vercel (no persistent WebSocket support)
function isVercelEnvironment(): boolean {
  if (typeof window === 'undefined') return false
  const hostname = window.location.hostname
  return hostname.includes('vercel.app') || hostname.includes('.vercel.')
}

export function useSocket(tableId: string | null) {
  const [isConnected, setIsConnected] = useState(false)
  const { setCart } = useAppStore()

  useEffect(() => {
    if (!tableId) return

    // On Vercel, socket.io is not supported — use polling fallback
    if (isVercelEnvironment()) {
      console.info('[Socket] Vercel environment detected. Socket.io disabled. Using REST polling.')
      setIsConnected(false)
      return
    }

    // Only attempt socket.io on environments that support it (local dev / custom server)
    let socketModule: any = null
    let newSocket: any = null

    const loadSocket = async () => {
      try {
        const { io } = await import('socket.io-client')

        const sessionId = useAppStore.getState().sessionId
        let displayName: string = sessionStorage.getItem('displayName') || ''
        if (!displayName) {
          const names = ['Aarav', 'Ananya', 'Kabir', 'Diya', 'Vihaan', 'Ishaan', 'Meera', 'Rohan', 'Siddharth', 'Kiara']
          const randomName = names[Math.floor(Math.random() * names.length)] ?? 'Guest'
          displayName = randomName
          sessionStorage.setItem('displayName', displayName)
        }

        newSocket = io({
          auth: { tableId, sessionId, displayName },
          timeout: 5000,
          reconnectionAttempts: 2,
        })

        newSocket.on('connect', () => setIsConnected(true))
        newSocket.on('disconnect', () => setIsConnected(false))
        newSocket.on('connect_error', (err: any) => {
          console.warn('[Socket] Connection failed (expected on Vercel):', err.message)
          newSocket?.disconnect()
        })

        // Re-fetch cart when events happen to ensure sync
        const refreshCart = async (sessionId: string) => {
          try {
            const res = await fetch(`/api/session/${sessionId}/cart`)
            const data = await res.json()
            if (data.items) {
              setCart(data.items, data.total, data.gst)
            }
          } catch (e) {
            console.error(e)
          }
        }

        newSocket.on('cart:item_added', (data: any) => {
          const sid = localStorage.getItem('sessionId')
          if (sid) refreshCart(sid)
        })

        newSocket.on('cart:item_removed', () => {
          const sid = localStorage.getItem('sessionId')
          if (sid) refreshCart(sid)
        })

        newSocket.on('cart:item_updated', () => {
          const sid = localStorage.getItem('sessionId')
          if (sid) refreshCart(sid)
        })

        newSocket.on('order:placed', (data: any) => {
          const query = data?.orderId ? `?orderId=${data.orderId}` : ''
          window.location.href = `/table/${tableId}/confirmation${query}`
        })

        socketModule = newSocket
      } catch (err) {
        console.warn('[Socket] Failed to load socket.io-client:', err)
      }
    }

    loadSocket()

    return () => {
      socketModule?.disconnect()
    }
  }, [tableId])

  return { isConnected }
}
