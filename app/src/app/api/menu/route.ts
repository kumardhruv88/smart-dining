import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const items = await prisma.menuItem.findMany({
      where: { available: true },
      orderBy: { popularScore: 'desc' }
    })
    return NextResponse.json({ items })
  } catch (error) {
    console.error('[MENU ERROR]', error)
    return NextResponse.json(
      { error: 'Failed to fetch menu', details: String(error) },
      { status: 500 }
    )
  }
}
