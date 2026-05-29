import { create } from 'zustand'

export interface CartItem {
  id?: string
  quantity: number
  addedBy?: string
  specialInstructions?: string
  menuItem: {
    id: string
    name: string
    price: number
    imageUrl?: string
    category?: string
    tags?: string[]
  }
}

export interface AppState {
  sessionId: string | null
  tableId: string | null
  setSession: (sessionId: string, tableId: string) => void
  
  preferences: Record<string, boolean>
  setPreference: (key: string, value: boolean) => void
  
  cartItems: CartItem[]
  cartTotal: number
  cartGst: number
  setCart: (items: CartItem[], total: number, gst: number) => void
  addCartItem: (item: CartItem) => void
  removeCartItem: (id: string) => void
  
  groupMembers: { name: string, joinedAt: Date }[]
  addGroupMember: (member: { name: string, joinedAt: Date }) => void
  
  isChatOpen: boolean
  setChatOpen: (open: boolean) => void
  unreadCount: number
  incrementUnread: () => void
  clearUnread: () => void
  cartDrawerOpen: boolean
  setCartDrawerOpen: (open: boolean) => void

  chatMessages: any[]
  addChatMessage: (msg: any) => void
  updateChatMessage: (id: string, text: string, suggestions?: any[]) => void

  toasts: { id: string; message: string; type: 'success' | 'info' | 'warning' | 'error'; duration?: number }[]
  addToast: (message: string, type: 'success' | 'info' | 'warning' | 'error', duration?: number) => void
  removeToast: (id: string) => void

  activeUpsell: any | null
  setUpsell: (upsell: any) => void
  clearUpsell: () => void
}

export const useAppStore = create<AppState>((set) => ({
  sessionId: null,
  tableId: null,
  setSession: (sessionId, tableId) => set({ sessionId, tableId }),
  
  preferences: {},
  setPreference: (key, value) => set((state) => ({
    preferences: { ...state.preferences, [key]: value }
  })),
  
  cartItems: [],
  cartTotal: 0,
  cartGst: 0,
  setCart: (items, total, gst) => set({ cartItems: items, cartTotal: total, cartGst: gst }),
  addCartItem: (item) => set((state) => {
    const existing = state.cartItems.find(i => i.menuItem.id === item.menuItem.id)
    if (existing) {
      return {
        cartItems: state.cartItems.map(i => 
          i.menuItem.id === item.menuItem.id ? { ...i, quantity: i.quantity + item.quantity } : i
        ),
        cartTotal: state.cartTotal + (item.menuItem.price * item.quantity)
      }
    }
    return {
      cartItems: [...state.cartItems, item],
      cartTotal: state.cartTotal + (item.menuItem.price * item.quantity)
    }
  }),
  removeCartItem: (id) => set((state) => {
    const item = state.cartItems.find(i => i.menuItem.id === id)
    if (!item) return state
    return {
      cartItems: state.cartItems.filter(i => i.menuItem.id !== id),
      cartTotal: state.cartTotal - (item.menuItem.price * item.quantity)
    }
  }),
  
  groupMembers: [],
  addGroupMember: (member) => set((state) => ({ groupMembers: [...state.groupMembers, member] })),
  
  isChatOpen: false,
  setChatOpen: (open) => set((state) => ({ isChatOpen: open, unreadCount: open ? 0 : state.unreadCount })),
  
  unreadCount: 0,
  incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
  clearUnread: () => set({ unreadCount: 0 }),
  
  cartDrawerOpen: false,
  setCartDrawerOpen: (open) => set({ cartDrawerOpen: open }),

  chatMessages: [],
  addChatMessage: (msg) => set((state) => ({ chatMessages: [...state.chatMessages, msg] })),
  updateChatMessage: (id, text, suggestions) => set((state) => ({
    chatMessages: state.chatMessages.map(m => m.id === id ? { ...m, text, ...(suggestions ? { suggestions } : {}) } : m)
  })),

  toasts: [],
  addToast: (message, type, duration = 3000) => set((state) => {
    const id = Date.now().toString() + Math.random().toString()
    return { toasts: [...state.toasts, { id, message, type, duration }].slice(-3) }
  }),
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) })),

  activeUpsell: null,
  setUpsell: (upsell) => set({ activeUpsell: upsell }),
  clearUpsell: () => set({ activeUpsell: null })
}))
