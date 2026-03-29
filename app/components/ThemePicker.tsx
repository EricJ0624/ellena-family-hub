'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Palette } from 'lucide-react';
import { APP_THEMES, type AppTheme } from '@/app/providers/ThemeProvider';
import { useLanguage } from '@/app/contexts/LanguageContext';
import {
  getGroupSettingsTranslation,
  type GroupSettingsTranslations,
} from '@/lib/translations/groupSettings';

const THEME_LABEL_KEY: Record<AppTheme, keyof GroupSettingsTranslations> = {
  'warm-home': 'theme_warm_home',
  'midnight-sky': 'theme_midnight_sky',
  'forest-walk': 'theme_forest_walk',
  'lavender-garden': 'theme_lavender_garden',
  'sunset-glow': 'theme_sunset_glow',
  'ocean-breeze': 'theme_ocean_breeze',
  'rose-petal': 'theme_rose_petal',
  'golden-harvest': 'theme_golden_harvest',
  'cozy-cocoa': 'theme_cozy_cocoa',
  'winter-hearth': 'theme_winter_hearth',
};

export function ThemePicker({ className = '' }: { className?: string }) {
  const { lang } = useLanguage();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const gst = (key: keyof GroupSettingsTranslations) =>
    getGroupSettingsTranslation(lang, key);

  const raw = resolvedTheme ?? theme ?? 'warm-home';
  const current = (APP_THEMES.includes(raw as AppTheme) ? raw : 'warm-home') as AppTheme;

  useEffect(() => {
    if (!mounted) return;
    if (theme && !APP_THEMES.includes(theme as AppTheme)) {
      setTheme('warm-home');
    }
  }, [mounted, theme, setTheme]);

  if (!mounted) {
    return (
      <div
        className={`flex items-center gap-2 ${className}`}
        aria-hidden
      >
        <div className="h-9 w-[min(100%,14rem)] rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label
        htmlFor="app-theme-select"
        className="flex items-center gap-1.5 shrink-0 text-sm font-medium text-muted-foreground"
      >
        <Palette className="w-4 h-4 text-primary" aria-hidden />
        <span className="hidden sm:inline">{gst('theme_picker_label')}</span>
      </label>
      <select
        id="app-theme-select"
        value={current}
        onChange={(e) => setTheme(e.target.value)}
        aria-label={gst('theme_picker_label')}
        className="min-w-[10rem] max-w-[16rem] rounded-lg border border-border bg-card py-2 pl-3 pr-8 text-sm font-medium text-foreground shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
      >
        {APP_THEMES.map((id) => (
          <option key={id} value={id}>
            {gst(THEME_LABEL_KEY[id])}
          </option>
        ))}
      </select>
    </div>
  );
}
