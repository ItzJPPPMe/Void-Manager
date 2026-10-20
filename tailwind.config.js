/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: {
          950: "#06070b",
          900: "#0a0c14",
          850: "#0e111c",
          800: "#121627",
          700: "#1a1f36",
          600: "#252b4a",
          500: "#353d6b",
        },
        neon: {
          cyan: "rgb(var(--accent-rgb) / <alpha-value>)",
          violet: "#8b5cf6",
          magenta: "#ff2e88",
          lime: "#a3ff12",
          amber: "#ffb020",
        },
      },
      fontFamily: {
        display: ["Rajdhani", "Segoe UI", "sans-serif"],
        body: ["Inter", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "Consolas", "monospace"],
      },
      boxShadow: {
        neon: "0 0 12px rgb(var(--accent-rgb) / 0.35)",
        "neon-violet": "0 0 12px rgba(139,92,246,0.4)",
        "neon-magenta": "0 0 12px rgba(255,46,136,0.35)",
        card: "0 8px 24px rgba(0,0,0,0.55)",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        slideUp: {
          from: { transform: "translateY(12px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        pulseGlow: "pulseGlow 2s ease-in-out infinite",
        slideUp: "slideUp 0.25s ease-out",
      },
    },
  },
  plugins: [],
};
