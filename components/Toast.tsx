'use client'
import { useEffect } from 'react'

interface ToastProps {
  msg: string
  type?: 'success' | 'error' | 'info'
  onClose: () => void
}

export default function Toast({ msg, type = 'success', onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 2500)
    return () => clearTimeout(t)
  }, [onClose])

  const bg = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#334155'
  return <div className="toast" style={{ background: bg }}>{msg}</div>
}
