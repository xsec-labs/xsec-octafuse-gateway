'use client';
import { ControlThemeProvider } from '@xsec/ui-react';
import { themeDefaults } from '@xsec/design-tokens';
import { useLocale } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { isLocale } from '@/lib/locale';

export default function PublicTheme({ children }: { children: ReactNode }) {
 const locale = useLocale();
 const [system, setSystem] = useState({ dark: false, reducedMotion: false });
 useEffect(() => {
  const dark = matchMedia('(prefers-color-scheme: dark)'), motion = matchMedia('(prefers-reduced-motion: reduce)');
  const update = () => setSystem({ dark: dark.matches, reducedMotion: motion.matches });
  update(); dark.addEventListener('change', update); motion.addEventListener('change', update);
  return () => { dark.removeEventListener('change', update); motion.removeEventListener('change', update); };
 }, []);
 if (!isLocale(locale)) throw new TypeError('Unsupported Admin locale');
 return <ControlThemeProvider className="octafuse-public-theme" settings={{ ...themeDefaults, locale: locale === 'zh' ? 'zh-CN' : locale, colorMode: system.dark ? 'dark' : 'light', reducedMotion: system.reducedMotion }}>{children}</ControlThemeProvider>;
}
