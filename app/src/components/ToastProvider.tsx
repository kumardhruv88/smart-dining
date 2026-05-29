'use client'

import React, { useEffect } from 'react'
import { useAppStore } from '@/store'

export function ToastProvider() {
  const { toasts, removeToast } = useAppStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 md:top-auto md:left-auto md:bottom-24 md:right-4 z-[200] flex flex-col gap-2 w-full max-w-[320px] px-4 md:px-0">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onRemove }: { toast: any, onRemove: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onRemove, toast.duration || 3000)
    return () => clearTimeout(timer)
  }, [toast.duration, onRemove])

  const colors = {
    success: 'bg-green-50 text-green-800 border-green-200',
    info: 'bg-blue-50 text-blue-800 border-blue-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    error: 'bg-red-50 text-red-800 border-red-200',
  }

  const icons = {
    success: '✓',
    info: 'ℹ',
    warning: '⚠',
    error: '✕'
  }

  return (
    <div className={`w-full p-3 rounded-lg border shadow-lg flex items-center gap-3 animate-in slide-in-from-top md:slide-in-from-right fade-in duration-300 ${colors[toast.type as keyof typeof colors]}`}>
      <span className="font-bold">{icons[toast.type as keyof typeof icons]}</span>
      <span className="text-sm font-medium flex-1">{toast.message}</span>
      <button onClick={onRemove} className="text-xl leading-none opacity-50 hover:opacity-100">&times;</button>
    </div>
  )
}
