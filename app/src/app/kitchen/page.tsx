'use client'

import React, { useState, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'

interface KitchenOrder {
  id: string
  tableId: string
  items: { name: string; quantity: number }[]
  status: string
  timeElapsed: number
  timestamp: Date
}

export default function KitchenDashboard() {
  const [auth, setAuth] = useState(false)
  const [pass, setPass] = useState('')
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    if (auth) {
      const newSocket = io({ auth: { kitchen: true } })
      
      // Fetch initial active orders
      const fetchInitialOrders = async () => {
        try {
          const res = await fetch('/api/order')
          const data = await res.json()
          if (data.orders) {
            const mapped = data.orders.map((o: any) => ({
              id: o.id,
              tableId: o.session?.tableId || 'T1',
              items: o.items.map((i: any) => ({
                name: i.menuItem?.name || 'Item',
                quantity: i.quantity,
              })),
              status: o.status, // uppercase from DB
              timeElapsed: Math.round((Date.now() - new Date(o.createdAt).getTime()) / 60000),
              timestamp: new Date(o.createdAt),
            }))
            setOrders(mapped)
          }
        } catch (e) {
          console.error("Failed to fetch initial orders:", e)
        }
      }
      fetchInitialOrders()

      // Handle real-time incoming orders
      newSocket.on('order:placed', async (data: any) => {
        try {
          const res = await fetch(`/api/order/${data.orderId}`)
          const resData = await res.json()
          if (resData.order) {
            const o = resData.order
            const newOrder: KitchenOrder = {
              id: o.id,
              tableId: o.session?.tableId || 'T1',
              items: o.items.map((i: any) => ({
                name: i.menuItem?.name || 'Item',
                quantity: i.quantity,
              })),
              status: o.status,
              timeElapsed: 0,
              timestamp: new Date(o.createdAt),
            }
            setOrders(prev => {
              if (prev.some(x => x.id === o.id)) return prev
              return [newOrder, ...prev]
            })
          }
        } catch (e) {
          console.error("Failed to handle order:placed event:", e)
        }
      })

      // Sync status updates from other kitchen clients or server
      newSocket.on('order:status_updated', (data: { orderId: string; status: string }) => {
        setOrders(prev => {
          if (data.status === 'DELIVERED') {
            return prev.filter(o => o.id !== data.orderId)
          }
          return prev.map(o => o.id === data.orderId ? { ...o, status: data.status } : o)
        })
      })
      
      setSocket(newSocket)

      const interval = setInterval(() => {
        setOrders(prev => prev.map(o => ({
          ...o,
          timeElapsed: Math.round((Date.now() - new Date(o.timestamp).getTime()) / 60000)
        })))
      }, 60000)

      return () => { 
        newSocket.disconnect() 
        clearInterval(interval)
      }
    }
  }, [auth])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (pass === 'kitchen123') setAuth(true)
    else alert('Invalid password')
  }

  const advanceStatus = async (order: KitchenOrder) => {
    const sequence = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED']
    const currIdx = sequence.indexOf(order.status)
    if (currIdx < sequence.length - 1) {
      const nextStatus = sequence[currIdx + 1] as string
      
      // Optimistic update
      setOrders(prev => {
        if (nextStatus === 'DELIVERED') {
          return prev.filter(o => o.id !== order.id)
        }
        return prev.map(o => o.id === order.id ? { ...o, status: nextStatus } : o)
      })
      
      if (socket) {
        socket.emit('kitchen:status_update', { orderId: order.id, status: nextStatus })
      }
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-gray-100 text-gray-800'
      case 'CONFIRMED': return 'bg-blue-100 text-blue-800'
      case 'PREPARING': return 'bg-orange-100 text-orange-800'
      case 'READY': return 'bg-green-100 text-green-800'
      case 'DELIVERED': return 'bg-gray-200 text-gray-500'
      default: return 'bg-gray-100'
    }
  }

  if (!auth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 w-80">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 text-center">Kitchen Portal</h2>
          <input 
            type="password" 
            value={pass} 
            onChange={e => setPass(e.target.value)}
            className="w-full border border-gray-300 px-4 py-3 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Enter password"
            autoFocus
          />
          <button 
            type="submit"
            className="w-full bg-orange-600 text-white font-bold h-[48px] rounded-xl hover:bg-orange-700"
          >
            Login
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 font-sans">
      <header className="flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Kitchen Dashboard</h1>
          <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Connected to socket
          </p>
        </div>
        <button onClick={() => setAuth(false)} className="text-sm font-semibold text-gray-500 hover:text-gray-800">Logout</button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {orders.map(order => (
          <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col animate-in fade-in duration-200">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Table {order.tableId}</h3>
                <span className="text-xs font-medium text-gray-500">#{order.id.slice(0,8).toUpperCase()}</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-red-600 mb-1">{order.timeElapsed}m elapsed</div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${getStatusColor(order.status)}`}>
                  {order.status}
                </span>
              </div>
            </div>
            
            <div className="p-4 flex-1">
              <ul className="space-y-2">
                {order.items.map((item, i) => (
                  <li key={i} className="flex justify-between text-sm">
                    <span className="font-medium text-gray-800">{item.name}</span>
                    <span className="font-bold text-gray-500">x{item.quantity}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="p-4 border-t border-gray-100 bg-gray-50">
              {order.status !== 'DELIVERED' ? (
                <button 
                  onClick={() => advanceStatus(order)}
                  className="w-full bg-black text-white font-bold h-[44px] rounded-lg hover:bg-gray-800 active:scale-95 transition-transform"
                >
                  {order.status === 'PENDING' ? 'Confirm Order' : 
                   order.status === 'CONFIRMED' ? 'Start Preparing' : 
                   order.status === 'PREPARING' ? 'Mark Ready' : 
                   'Mark Delivered'}
                </button>
              ) : (
                <button disabled className="w-full bg-gray-200 text-gray-500 font-bold h-[44px] rounded-lg">
                  Completed
                </button>
              )}
            </div>
          </div>
        ))}
        {orders.length === 0 && (
          <div className="col-span-full py-16 text-center text-gray-500">
            No active orders. New orders will appear here automatically.
          </div>
        )}
      </div>
    </div>
  )
}
