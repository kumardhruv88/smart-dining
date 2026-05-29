'use client'

import React, { useState, useEffect } from 'react'
import { useAppStore } from '@/store'

export function CheckoutModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { sessionId, tableId, addToast } = useAppStore()
  
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [orderId, setOrderId] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [countdown, setCountdown] = useState(30)

  const otpRefs = React.useRef<(HTMLInputElement | null)[]>([])

  const handleOtpChange = (val: string, index: number) => {
    const cleaned = val.replace(/\D/g, '')
    if (!cleaned) {
      const newOtp = [...otp]
      newOtp[index] = ''
      setOtp(newOtp)
      return
    }

    const digits = cleaned.split('')
    const newOtp = [...otp]
    let nextIndex = index
    for (const d of digits) {
      if (nextIndex < 6) {
        newOtp[nextIndex] = d
        nextIndex++
      }
    }
    setOtp(newOtp)

    const targetIndex = Math.min(nextIndex, 5)
    otpRefs.current[targetIndex]?.focus()
  }

  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      const digit = otp[index]
      if (!digit && index > 0) {
        const newOtp = [...otp]
        newOtp[index - 1] = ''
        setOtp(newOtp)
        otpRefs.current[index - 1]?.focus()
        e.preventDefault()
      } else if (digit) {
        const newOtp = [...otp]
        newOtp[index] = ''
        setOtp(newOtp)
        e.preventDefault()
      }
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pastedData.length === 6) {
      const newOtp = pastedData.split('')
      setOtp(newOtp)
      otpRefs.current[5]?.focus()
    }
  }

  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setName('')
      setPhone('')
      setOtp(['', '', '', '', '', ''])
      setErrorMsg('')
    }
  }, [isOpen])

  useEffect(() => {
    if (step === 2 && countdown > 0) {
      const t = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [step, countdown])

  const handleSendOtp = async () => {
    if (name.length < 2) {
      setErrorMsg('Name must be at least 2 characters')
      return
    }
    if (!/^\+?[1-9]\d{9,14}$/.test(phone)) {
      setErrorMsg('Invalid mobile number')
      return
    }
    
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const errText = typeof data.error === 'string' ? data.error : (data.error?.message || JSON.stringify(data.error) || 'Failed to send OTP')
        throw new Error(errText)
      }
      setStep(2)
      setCountdown(30)
    } catch (e: any) {
      setErrorMsg(e.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    const code = otp.join('')
    if (code.length !== 6) return
    
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp: code })
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        if (data.attemptsRemaining !== undefined) {
          throw new Error(`Invalid OTP. ${data.attemptsRemaining} attempts remaining`)
        } else if (data.locked) {
          throw new Error('Too many attempts. Please try again in 5 minutes')
        }
        const errText = typeof data.error === 'string' ? data.error : (data.error?.message || JSON.stringify(data.error) || 'Verification failed')
        throw new Error(errText)
      }
      
      setStep(3)
      handlePlaceOrder(data.token || 'demo-token') 
      
    } catch (e: any) {
      setErrorMsg(e.message)
      addToast(e.message, 'error')
      setLoading(false)
    }
  }

  const handlePlaceOrder = async (verificationToken: string) => {
    try {
      const res = await fetch(`/api/session/${sessionId}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: name, customerPhone: phone, verificationToken })
      })
      const data = await res.json()
      
      if (!res.ok) {
        const errText = typeof data.error === 'string' ? data.error : (data.error?.message || JSON.stringify(data.error) || 'Order validation failed')
        throw new Error(errText)
      }
      
      setOrderId(data.orderId || `ORD-${Date.now()}`)
      setStep(4)
      
      // Clear the cart from the store immediately
      useAppStore.getState().setCart([], 0, 0)
      
      setTimeout(() => {
        onClose()
        // Pass orderId as query param so confirmation page can fetch real order details
        window.location.href = `/table/${tableId}/confirmation?orderId=${encodeURIComponent(data.orderId || '')}`
      }, 2000)
      
    } catch (e: any) {
      setErrorMsg(e.message)
      setStep(1)
      addToast(e.message, 'error')
    }
  }

  if (!isOpen) return null

  const inputStyle = {
    width: '100%',
    background: '#FFFFFF',
    border: '1px solid #E8DCC8',
    borderRadius: '12px',
    padding: '12px 16px',
    color: '#2D1810',
    outline: 'none',
    fontSize: '15px',
    fontFamily: 'var(--font-sans)',
    transition: 'border-color 0.2s',
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={step !== 3 && step !== 4 ? onClose : undefined}
      ></div>
      
      <div
        className="relative overflow-hidden animate-in zoom-in-95 duration-200"
        style={{ 
          background: '#FAF7F2', 
          border: '1px solid #E8DCC8',
          borderRadius: '20px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
          width: '100%',
          maxWidth: '440px',
        }}
      >
        {step !== 3 && step !== 4 && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-1 transition-colors text-2xl"
            style={{ color: '#8B7355', background: 'transparent' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = '#2D1810')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = '#8B7355')}
          >
            &times;
          </button>
        )}

        <div style={{ padding: '40px 36px' }}>
          {step === 1 && (
            <div className="space-y-5">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-semibold mb-1" style={{ color: '#2D1810', fontFamily: 'var(--font-serif)', letterSpacing: '-0.02em' }}>Almost there!</h2>
                <p className="text-[15px]" style={{ color: '#8B7355' }}>We just need a few details to finalize your order.</p>
              </div>
              
              <div>
                <label className="block text-[13px] font-medium mb-1.5" style={{ color: '#8B7355' }}>Your name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={inputStyle}
                  placeholder="John Doe"
                  onFocus={(e) => (e.target.style.borderColor = '#D4C4A8')}
                  onBlur={(e) => (e.target.style.borderColor = '#E8DCC8')}
                />
              </div>
              
              <div>
                <label className="block text-[13px] font-medium mb-1.5" style={{ color: '#8B7355' }}>Mobile number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={inputStyle}
                  placeholder="+91 9876543210"
                  onFocus={(e) => (e.target.style.borderColor = '#D4C4A8')}
                  onBlur={(e) => (e.target.style.borderColor = '#E8DCC8')}
                />
              </div>

              {errorMsg && <p className="text-sm font-medium text-center" style={{ color: '#D4580A' }}>{errorMsg}</p>}

              <button
                onClick={handleSendOtp}
                disabled={loading}
                className="w-full font-medium h-[48px] rounded-xl mt-6 transition-colors flex items-center justify-center disabled:opacity-50"
                style={{ background: '#2D1810', color: '#FAF7F2' }}
                onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#1A0E08' }}
                onMouseLeave={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#2D1810' }}
              >
                {loading ? <span className="animate-spin text-xl font-normal">↻</span> : 'Send OTP'}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-[20px]">
                <h2 style={{ color: '#2D1810', fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 600, marginBottom: '4px' }}>Verify your number</h2>
                <p style={{ color: '#8B7355', fontSize: '14px', fontWeight: 400 }}>Enter the 6-digit OTP sent to {phone}</p>
                <p style={{ color: '#B8A898', fontSize: '12px', fontStyle: 'italic', marginTop: '4px' }}>Demo OTP: 123456</p>
              </div>
              
              <div className="flex justify-center gap-2">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el }}
                    id={`otp-${i}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={i === 0 ? 6 : 1} // let paste work on first input
                    value={digit}
                    onChange={(e) => handleOtpChange(e.target.value, i)}
                    onKeyDown={(e) => handleOtpKeyDown(e, i)}
                    onPaste={handlePaste}
                    className="text-center transition-all focus:outline-none"
                    style={{
                      width: '48px',
                      height: '56px',
                      background: '#FFFFFF',
                      border: '1.5px solid #D4C4A8',
                      borderRadius: '12px',
                      color: '#2D1810',
                      fontSize: '24px',
                      fontWeight: 600,
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#E8650A'
                      e.target.style.boxShadow = '0 0 0 3px rgba(232,101,10,0.1)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#D4C4A8'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                ))}
              </div>

              {errorMsg && <p className="text-sm font-medium text-center" style={{ color: '#D4580A' }}>{errorMsg}</p>}

              <button
                onClick={handleVerifyOtp}
                disabled={loading || otp.join('').length !== 6}
                className="w-full flex items-center justify-center transition-colors disabled:opacity-50"
                style={{ 
                  background: '#2D1810', 
                  color: '#FAF7F2',
                  height: '52px',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: 600,
                }}
                onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#3D2418' }}
                onMouseLeave={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#2D1810' }}
              >
                {loading ? <span className="animate-spin text-xl font-normal">↻</span> : 'Verify OTP'}
              </button>
              
              <div className="text-center">
                <button
                  disabled={countdown > 0}
                  onClick={handleSendOtp}
                  className="disabled:opacity-40"
                  style={{ 
                    color: '#E8650A', 
                    fontSize: '13px',
                    cursor: countdown > 0 ? 'default' : 'pointer',
                    textDecoration: 'none'
                  }}
                >
                  {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <div
                className="w-10 h-10 border-2 rounded-full animate-spin"
                style={{ borderColor: '#E8DCC8', borderTopColor: '#2D1810' }}
              ></div>
              <p className="text-xl font-semibold" style={{ color: '#2D1810', fontFamily: 'var(--font-serif)' }}>Reviewing your order...</p>
              <p className="text-[15px] text-center max-w-[250px]" style={{ color: '#8B7355' }}>Zara is validating stock, timing, and group conflicts.</p>
              {errorMsg && <p className="text-[14px] font-medium text-center mt-4" style={{ color: '#D4580A' }}>{errorMsg}</p>}
            </div>
          )}

          {step === 4 && (
            <div className="py-10 flex flex-col items-center justify-center space-y-3 animate-in zoom-in duration-500">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-light mb-3"
                style={{ background: '#E8DCC8', color: '#2D1810' }}
              >
                ✓
              </div>
              <h2 className="text-2xl font-semibold" style={{ color: '#2D1810', fontFamily: 'var(--font-serif)' }}>Order Placed!</h2>
              <p className="font-medium text-[15px]" style={{ color: '#8B7355' }}>Order #{orderId.slice(0,8).toUpperCase()}</p>
              <p className="text-[13px]" style={{ color: '#B8A898' }}>Redirecting to confirmation...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
