/**
 * =========================================================================================
 * TAILWIND CSS INDUSTRIAL DESIGN SYSTEM CONFIGURATION
 * =========================================================================================
 * Path: tailwind.config.js
 *
 * PURPOSE:
 * Configures the Tailwind utility classes, custom color palette, typography, and content paths.
 *
 * INDUSTRIAL COLOR PALETTE:
 * - High-contrast clean backgrounds and borders:
 *   - Background: #F8FAFC (clean light gray/slate canvas)
 *   - Foreground: #0F172A (high legibility slate-900 text)
 *   - Border:     #E5E7EB (crisp dividing lines for shop floor tablets)
 * - Industrial Primary Blue:
 *   - #2563EB (standard action buttons, interactive links)
 * - Safety Status Accents:
 *   - active:   #059669 / #ECFDF5 (Green - Authorized & Ongoing Work)
 *   - pending:  #D97706 / #FFFBEB (Amber - Awaiting Approval Sign-Off)
 *   - danger:   #DC2626 / #FEF2F2 (Red - Suspended / Expired / Rejected)
 *   - draft:    #475569 / #F1F5F9 (Muted Slate - Unsubmitted Drafts)
 * =========================================================================================
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "#E5E7EB",
        background: "#F8FAFC",
        foreground: "#0F172A",
        muted: "#475569",
        primary: {
          DEFAULT: "#2563EB",
          hover: "#1D4ED8",
        },
        status: {
          active: "#059669",
          activeBg: "#ECFDF5",
          pending: "#D97706",
          pendingBg: "#FFFBEB",
          danger: "#DC2626",
          dangerBg: "#FEF2F2",
          draft: "#475569",
          draftBg: "#F1F5F9",
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
}
