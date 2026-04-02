import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "8px",
        sm: "4px",
        xl: "20px",
      },
      boxShadow: {
        sm: "0 1px 4px rgba(0,0,0,0.40)",
        md: "0 4px 12px rgba(0,0,0,0.50)",
        popup: "0 8px 24px rgba(0,0,0,0.60)",
      },
      fontSize: {
        "page-title": ["28px", { lineHeight: "1.2", fontWeight: "700" }],
        "sidebar-section": ["11px", { lineHeight: "1.3", fontWeight: "600" }],
        "sidebar-item": ["14px", { lineHeight: "1.4", fontWeight: "400" }],
        "sidebar-item-active": ["14px", { lineHeight: "1.4", fontWeight: "500" }],
        body: ["13px", { lineHeight: "1.5", fontWeight: "400" }],
        caption: ["12px", { lineHeight: "1.4", fontWeight: "400" }],
        badge: ["11px", { lineHeight: "1", fontWeight: "600" }],
        "reader-body": ["18px", { lineHeight: "1.7", fontWeight: "400" }],
        "reader-translation": ["16px", { lineHeight: "1.7", fontWeight: "400" }],
        "reader-title": ["13px", { lineHeight: "1", fontWeight: "300" }],
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 200ms ease",
      },
      screens: {
        compact: "700px",
        standard: "1000px",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
