import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { tableId: string } }
) {
  try {
    const { tableId } = params
    
    // Try to find existing active session
    const existing = await prisma.session.findFirst({
      where: {
        tableId,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() }
      }
    })
    
    if (existing) {
      const response = NextResponse.json({
        sessionId: existing.id,
        tableId: existing.tableId,
        status: existing.status,
        preferences: existing.preferences ?? {},
        expiresAt: existing.expiresAt,
      })
      response.cookies.set('sid', existing.id, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 4
      })
      return response
    }
    
    // Create new session
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000)
    const session = await prisma.session.create({
      data: {
        tableId,
        status: 'ACTIVE',
        preferences: {},
        expiresAt,
      }
    })
    
    const response = NextResponse.json({
      sessionId: session.id,
      tableId: session.tableId,
      status: session.status,
      preferences: session.preferences ?? {},
      expiresAt: session.expiresAt,
    })
    response.cookies.set('sid', session.id, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 4
    })
    return response
    
  } catch (error) {
    console.error('[SESSION ERROR]', error)
    return NextResponse.json(
      { error: 'Session failed', details: String(error) },
      { status: 500 }
    )
  }
}
