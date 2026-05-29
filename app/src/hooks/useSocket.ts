import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAppStore } from '@/store'

export function useSocket(tableId: string | null) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const { 
    isChatOpen, 
    incrementUnread, 
    addGroupMember,
    setCart
  } = useAppStore()

  useEffect(() => {
    if (!tableId) return

    const sessionId = useAppStore.getState().sessionId;
    let displayName: string = sessionStorage.getItem('displayName') || '';
    if (!displayName) {
      const names = ['Aarav', 'Ananya', 'Kabir', 'Diya', 'Vihaan', 'Ishaan', 'Meera', 'Rohan', 'Siddharth', 'Kiara']
      const randomName = names[Math.floor(Math.random() * names.length)] ?? 'Guest'
      displayName = randomName
      sessionStorage.setItem('displayName', displayName)
    }

    const newSocket = io({
      auth: {
        tableId,
        sessionId,
        displayName
      }
    })

    newSocket.on('connect', () => setIsConnected(true))
    newSocket.on('disconnect', () => setIsConnected(false))

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
      // Placeholder for toast: `addedBy` added `name` to cart
      console.log(`[Socket] ${data.addedBy} added item to cart`)
      const sid = localStorage.getItem('sessionId')
      if (sid) refreshCart(sid)
    })

    newSocket.on('cart:item_removed', () => {
      const sid = localStorage.getItem('sessionId')
      if (sid) refreshCart(sid)
    })

    newSocket.on('cart:item_updated', (data: any) => {
      const sid = localStorage.getItem('sessionId')
      if (sid) refreshCart(sid)
    })

    newSocket.on('ai:message', (data: any) => {
      if (data.sender === 'Zara') {
        const storeState = useAppStore.getState()
        if (!storeState.isChatOpen) {
          storeState.incrementUnread()
        }
      }
    })

    newSocket.on('session:members_list', (membersList: any[]) => {
      useAppStore.setState({ groupMembers: membersList })
      console.log('[Socket] Initial group members loaded:', membersList)
    })

    newSocket.on('session:user_joined', (member: any) => {
      const currentMembers = useAppStore.getState().groupMembers
      if (!currentMembers.some((m) => m.name === member.displayName)) {
        addGroupMember({ name: member.displayName, joinedAt: new Date() })
      }
      console.log(`[Socket] ${member.displayName} joined the table!`)
    })

    newSocket.on('order:placed', (data: any) => {
      const query = data?.orderId ? `?orderId=${data.orderId}` : ''
      window.location.href = `/table/${tableId}/confirmation${query}`
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [tableId]) // Omit store functions to prevent re-renders on every store change

  return { socket, isConnected }
}
