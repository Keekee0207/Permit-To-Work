"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ShieldCheck, Plus, ListFilter, User, LogOut, Settings } from "lucide-react"

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        setCurrentUser(data.user)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [pathname])

  const handleLogout = async () => {
    await fetch("/api/auth/me", { method: "POST" })
    setCurrentUser(null)
    router.push("/login")
  }

  const quickSwitch = async (roleEmail: string) => {
    await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: roleEmail, password: "Password@123" }),
    })
    window.location.reload()
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#E5E7EB] shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
                <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base tracking-tight text-[#0F172A] leading-tight">
                  OPMAINT <span className="text-blue-600 font-normal">PTW</span>
                </span>
                <span className="text-[10px] text-[#475569] font-medium uppercase tracking-wider">
                  Permit to Work Module
                </span>
              </div>
            </Link>

            {/* Nav Links */}
            <nav className="hidden md:flex items-center gap-1 ml-4">
              <Link
                href="/"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname === "/"
                    ? "text-blue-600 bg-blue-50/60 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                Dashboard
              </Link>
              <Link
                href="/permits/new"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname === "/permits/new"
                    ? "text-blue-600 bg-blue-50/60 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                New Permit
              </Link>
              {currentUser?.role === "ADMIN" && (
                <Link
                  href="/admin"
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    pathname === "/admin"
                      ? "text-blue-600 bg-blue-50/60 font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Admin Panel
                </Link>
              )}
            </nav>
          </div>

          {/* Right Action & User Profile */}
          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-3">
                {/* Role Switcher Pill for Testing / Evaluation */}
                <div className="hidden lg:flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
                  <span className="text-[11px] text-slate-500 font-medium px-1.5">Switch Demo:</span>
                  <button
                    onClick={() => quickSwitch("requester@chennai.opmaint.com")}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                      currentUser.role === "REQUESTER" ? "bg-white text-blue-600 shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Requester
                  </button>
                  <button
                    onClick={() => quickSwitch("areaowner@chennai.opmaint.com")}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                      currentUser.role === "AREA_OWNER" ? "bg-white text-blue-600 shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Area Owner
                  </button>
                  <button
                    onClick={() => quickSwitch("safety@chennai.opmaint.com")}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                      currentUser.role === "SAFETY_OFFICER" ? "bg-white text-blue-600 shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Safety Officer
                  </button>
                  <button
                    onClick={() => quickSwitch("admin@chennai.opmaint.com")}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                      currentUser.role === "ADMIN" ? "bg-white text-blue-600 shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Admin
                  </button>
                </div>

                <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-semibold text-slate-900 leading-tight">
                      {currentUser.name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {currentUser.role.replace(/_/g, " ")}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    title="Sign Out"
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-slate-100 transition"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
