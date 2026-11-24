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
