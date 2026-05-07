/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "rgb(var(--brand-primary) / <alpha-value>)",
          secondary: "rgb(var(--brand-secondary) / <alpha-value>)",
          accent: "rgb(var(--brand-accent) / <alpha-value>)",
        },
        surface: {
          base: "rgb(var(--surface-base) / <alpha-value>)",
          elevated: "rgb(var(--surface-elevated) / <alpha-value>)",
          muted: "rgb(var(--surface-muted) / <alpha-value>)",
        },
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "rgb(var(--card) / <alpha-value>)",
          foreground: "rgb(var(--card-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
          foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
          foreground: "rgb(var(--destructive-foreground) / <alpha-value>)",
        },
        border: "rgb(var(--border) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
        glass: {
          DEFAULT: "var(--glass-bg)",
          soft: "var(--glass-soft-bg)",
          medium: "var(--glass-medium-bg)",
          strong: "var(--glass-strong-bg)",
          overlay: "var(--glass-overlay-bg)",
        },
      },
      backgroundImage: {
        "app-shell-inner": "var(--app-shell-inner-bg)",
        "app-shell-outer": "var(--app-shell-outer-bg)",
      },
      borderColor: {
        "glass-soft": "var(--glass-soft-border)",
        "glass-medium": "var(--glass-medium-border)",
        "glass-strong": "var(--glass-strong-border)",
      },
      boxShadow: {
        "glass-soft": "var(--glass-soft-shadow)",
        "glass-medium": "var(--glass-medium-shadow)",
        "glass-strong": "var(--glass-strong-shadow)",
      },
      backdropBlur: {
        "glass-soft": "var(--glass-soft-blur)",
        "glass-medium": "var(--glass-medium-blur)",
        "glass-strong": "var(--glass-strong-blur)",
      },
    },
  },
  plugins: [],
};
