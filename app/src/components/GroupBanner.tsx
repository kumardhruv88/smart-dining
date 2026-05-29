import React from 'react'
import { useAppStore } from '@/store'

interface GroupBannerProps {
  members: { name: string; joinedAt: Date }[]
}

export function GroupBanner({ members }: GroupBannerProps) {
  const { setChatOpen } = useAppStore()

  if (members.length < 2) return null

  const handleSayHi = () => {
    setChatOpen(true)
  }

  // Earth tone avatar shades for group members
  const avatarColors = ['#E8650A', '#8B7355', '#B8A898', '#D4C4A8']

  return (
    <div
      className="flex items-center justify-between px-4 py-3 animate-in slide-in-from-top-2"
      style={{ background: '#FAF7F2', borderBottom: '1px solid #E8DCC8' }}
    >
      <div className="flex items-center gap-2">
        <div className="text-sm font-medium" style={{ color: '#2D1810' }}>
          🤝 {members.length} people at table
        </div>
        <button
          onClick={handleSayHi}
          className="text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors active:opacity-80"
          style={{ background: '#FFFFFF', color: '#2D1810', border: '1px solid #D4C4A8' }}
        >
          Say hi 👋
        </button>
      </div>
      <div className="flex -space-x-2">
        {members.slice(0, 4).map((m, i) => (
          <div
            key={i}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 animate-in slide-in-from-right-4 duration-300 ring-[#FAF7F2]"
            style={{ backgroundColor: avatarColors[i % avatarColors.length] }}
            title={m.name}
          >
            {m.name.charAt(0).toUpperCase()}
          </div>
        ))}
        {members.length > 4 && (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-[#FAF7F2]"
            style={{ background: '#E8DCC8', color: '#2D1810' }}
          >
            +{members.length - 4}
          </div>
        )}
      </div>
    </div>
  )
}
