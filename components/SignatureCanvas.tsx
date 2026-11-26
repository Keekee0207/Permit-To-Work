"use client"

/**
 * ============================================================================
 * DIGITAL SIGNATURE CANVAS COMPONENT
 * ============================================================================
 * Touch-screen and mouse-friendly HTML5 Canvas allowing Area Owners and
 * Safety Officers to digitally sign approvals on mobile tablets or desktop.
 * Exports high-resolution base64 PNG data URLs stored directly in PostgreSQL.
 */

import { useEffect, useRef, useState } from "react"

interface SignatureCanvasProps {
  onSave: (dataUrl: string) => void
  onClear: () => void
}

export function SignatureCanvas({ onSave, onClear }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  // Configure pen stroke styles on canvas context
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.strokeStyle = "#0F172A"
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
  }, [])

  // Touch & Mouse Event Handlers for smooth drawing
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY

    ctx.beginPath()
    ctx.moveTo(clientX - rect.left, clientY - rect.top)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY

    ctx.lineTo(clientX - rect.left, clientY - rect.top)
    ctx.stroke()
    setHasDrawn(true)
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (!canvas) return
    // Automatically export signature image as base64 data URL
    onSave(canvas.toDataURL("image/png"))
  }

  const handleClear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
    onClear()
  }

  return (
    <div className="space-y-2">
      <div className="border border-slate-300 rounded-lg bg-white overflow-hidden relative shadow-inner">
        <canvas
          ref={canvasRef}
          width={400}
          height={140}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-[140px] cursor-crosshair touch-none"
        />
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 text-xs">
            Sign here with finger or stylus
          </div>
        )}
      </div>
      <div className="flex justify-between items-center text-xs">
        <span className="text-[11px] text-slate-500">
          Digital verification sign-off
        </span>
        <button
          type="button"
          onClick={handleClear}
          className="text-xs text-slate-500 hover:text-slate-800 underline"
        >
          Clear signature
        </button>
      </div>
    </div>
  )
}
