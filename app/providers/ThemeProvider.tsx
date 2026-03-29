"use client";

import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from "next-themes";

/** next-themes / globals.css `[data-theme='…']`와 동일한 이름 */
export const APP_THEMES = [
  "warm-home",
  "midnight-sky",
  "forest-walk",
  "lavender-garden",
  "sunset-glow",
  "ocean-breeze",
  "rose-petal",
  "golden-harvest",
  "cozy-cocoa",
  "winter-hearth",
] as const;

export type AppTheme = (typeof APP_THEMES)[number];

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="warm-home"
      themes={[...APP_THEMES]}
      enableSystem={false}
      enableColorScheme={false}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
