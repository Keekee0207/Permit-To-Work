"use client"

/**
 * ============================================================================
 * LOGIN & AUTHENTICATION SCREEN
 * ============================================================================
 * Provides secure email/password credential sign-in and one-click demo user
 * selectors for all 4 industrial roles (Requester, Area Owner, Safety Officer, Admin).
 */

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck, ArrowRight, Lock, Mail } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("requester@chennai.opmaint.com")
  const [password, setPassword] = useState("Password@123")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Submits credentials to /api/auth/login to receive HTTP-only JWT cookie
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Login failed")
        setLoading(false)
      } else {
        // Instant clean navigation with cookie active
        window.location.href = "/"
      }
    } catch (err: any) {
      setError("Network error. Please try again.")
      setLoading(false)
    }
  }

  // Pre-fills form credentials when clicking any quick demo role button
  const selectDemoUser = (userEmail: string) => {
    setEmail(userEmail)
    setPassword("Password@123")
  }

  return (
    <div className="max-w-md mx-auto my-12 bg-white p-8 rounded-xl border border-[#E5E7EB] shadow-sm">
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3 border border-blue-100">
          <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
        </div>
        <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">Sign In to Opmaint PTW</h1>
        <p className="text-xs text-[#475569] mt-1">
          Indian Industrial Plants • Permit to Work System
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-[#E5E7EB] rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-[#E5E7EB] rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[48px] bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
        >
          {loading ? "Authenticating..." : "Sign In to Portal"}
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {/* Demo Quick Logins */}
      <div className="mt-8 pt-6 border-t border-slate-100">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
          Demo One-Click Credentials
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => selectDemoUser("requester@chennai.opmaint.com")}
            className="p-2 border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50/50 text-left transition"
          >
            <div className="font-semibold text-slate-900">Rajesh Kumar</div>
            <div className="text-[10px] text-slate-500">REQUESTER</div>
          </button>
          <button
            type="button"
            onClick={() => selectDemoUser("areaowner@chennai.opmaint.com")}
            className="p-2 border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50/50 text-left transition"
          >
            <div className="font-semibold text-slate-900">M. Senthil</div>
            <div className="text-[10px] text-slate-500">AREA OWNER</div>
          </button>
          <button
            type="button"
            onClick={() => selectDemoUser("safety@chennai.opmaint.com")}
            className="p-2 border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50/50 text-left transition"
          >
            <div className="font-semibold text-slate-900">K. Radhakrishnan</div>
            <div className="text-[10px] text-slate-500">SAFETY OFFICER</div>
          </button>
          <button
            type="button"
            onClick={() => selectDemoUser("admin@chennai.opmaint.com")}
            className="p-2 border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50/50 text-left transition"
          >
            <div className="font-semibold text-slate-900">Pooja Nair</div>
            <div className="text-[10px] text-slate-500">ADMIN</div>
          </button>
        </div>
      </div>
    </div>
  )
}
