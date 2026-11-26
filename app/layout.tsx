/**
 * ============================================================================
 * ROOT APPLICATION LAYOUT
 * ============================================================================
 * Wraps every page with the global Navbar, standardized industrial page padding,
 * compliance metadata, and footer.
 */

import "./globals.css"
import type { Metadata } from "next"
import { Navbar } from "@/components/Navbar"

export const metadata: Metadata = {
  title: "Opmaint PTW | Industrial Permit to Work System",
  description: "Shop-floor ready digital Permit to Work for Indian manufacturing plants",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
        {/* Global sticky navigation bar */}
        <Navbar />

        {/* Main application content viewport */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        {/* Compliance Footer */}
        <footer className="border-t border-[#E5E7EB] bg-white py-4 text-center text-xs text-[#475569]">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>Opmaint CMMS • Industrial Safety & Permit Compliance</span>
            <span className="text-slate-400">Indian Industrial Plants (IS 14489 / OSHA 1910 Compliance)</span>
          </div>
        </footer>
      </body>
    </html>
  )
}
