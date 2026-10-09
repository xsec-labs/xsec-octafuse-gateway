'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useEffect, useRef } from 'react';
import { ControlButton, ControlIconButton } from '@xsec/ui-react';
import BrandExternalLinks from './BrandExternalLinks';
import LocaleSwitcher from './LocaleSwitcher';
import ShellError from './ShellError';
import { adminAppVersion } from '@/lib/app-version';
import { parseShellSuccess, useShellRequest, type ShellFailure } from '@/lib/shell-request';
import {
  ArrowLeftStartOnRectangleIcon,
  Bars3Icon,
  HomeIcon,
  KeyIcon,
  CpuChipIcon,
  GlobeAltIcon,
  ArrowsRightLeftIcon,
  BeakerIcon,
  PlayCircleIcon,
  DocumentChartBarIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  ServerStackIcon,
  UsersIcon,
  ShieldCheckIcon,
  Cog6ToothIcon,
  WrenchScrewdriverIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline';
interface MenuItem {
  nameKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MenuGroup {
  groupKey: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    groupKey: 'overview',
    items: [
      { nameKey: 'dashboard', href: '/dashboard', icon: HomeIcon },
    ],
  },
  {
    groupKey: 'inference',
    items: [
      { nameKey: 'providers', href: '/gateway/providers', icon: GlobeAltIcon },
      { nameKey: 'models', href: '/gateway/models', icon: CpuChipIcon },
      { nameKey: 'routes', href: '/gateway/routes', icon: ArrowsRightLeftIcon },
      { nameKey: 'playground', href: '/gateway/playground', icon: BeakerIcon },
      { nameKey: 'simulator', href: '/gateway/simulator', icon: PlayCircleIcon },
    ],
  },
  {
    groupKey: 'user',
    items: [
      { nameKey: 'users', href: '/gateway/users', icon: UsersIcon },
      { nameKey: 'apiKeys', href: '/gateway/keys', icon: KeyIcon },
      { nameKey: 'requestLogs', href: '/gateway/request-logs', icon: DocumentChartBarIcon },
      { nameKey: 'auditLogs', href: '/gateway/audit-logs', icon: ClipboardDocumentListIcon },
    ],
  },
  {
    groupKey: 'tools',
    items: [
      { nameKey: 'toolsConfig', href: '/gateway/tools', icon: WrenchScrewdriverIcon },
      { nameKey: 'toolInvocations', href: '/gateway/tools/invocations', icon: QueueListIcon },
    ],
  },
  {
    groupKey: 'analytics',
    items: [
      { nameKey: 'modelUsage', href: '/gateway/analytics/models', icon: ChartBarIcon },
      { nameKey: 'providerUsage', href: '/gateway/analytics/providers', icon: ServerStackIcon },
      { nameKey: 'userUsage', href: '/gateway/analytics/users', icon: UsersIcon },
      { nameKey: 'reliability', href: '/gateway/analytics/reliability', icon: ShieldCheckIcon },
    ],
  },
  {
    groupKey: 'system',
    items: [
      { nameKey: 'config', href: '/gateway/config', icon: Cog6ToothIcon },
    ],
  },
];


const MobileNavigation = dynamic(() => import('./MobileNavigation'));
export default function Sidebar({ onLoggedOut, onCheckSession }: { onLoggedOut: () => void; onCheckSession: () => void }) {
 const t = useTranslations('sidebar'), tBrand = useTranslations('brand'), tAuth = useTranslations('auth'), tShell = useTranslations('shell');
 const pathname = usePathname(), [mobile, setMobile] = useState(false), [open, setOpen] = useState(false);
 const [loggingOut, setLoggingOut] = useState(false), [failure, setFailure] = useState<ShellFailure | null>(null);
 const trigger = useRef<HTMLButtonElement>(null), busy = useRef(false), { run } = useShellRequest();
 useEffect(() => {
  const query = matchMedia('(max-width: 767px)');
  const update = () => { setMobile(query.matches); if (!query.matches) setOpen(false); };
  update(); query.addEventListener('change', update); return () => query.removeEventListener('change', update);
 }, []);
 const logout = () => {
  if (busy.current) return; busy.current = true; setLoggingOut(true); setFailure(null);
  void run('/api/auth/logout', { method: 'POST' }, parseShellSuccess, () => { busy.current = false; setLoggingOut(false); onLoggedOut(); }, error => { busy.current = false; setLoggingOut(false); setFailure(error); });
 };
 const navigation = <>
  <nav aria-label={tShell('navigation')} className="octafuse-nav">
   {menuGroups.map(group => <section key={group.groupKey}>
    <h2>{t(`groups.${group.groupKey}`)}</h2>
    {group.items.map(item => {
     const active = pathname === item.href || (item.href === '/gateway/users' && pathname.startsWith('/gateway/users/'));
     const Icon = item.icon;
     return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className="octafuse-nav-link" onClick={() => setOpen(false)}><Icon aria-hidden className="octafuse-nav-icon" /><span>{t(`nav.${item.nameKey}`)}</span></Link>;
    })}
   </section>)}
  </nav>
  <footer className="octafuse-nav-footer"><LocaleSwitcher variant="sidebar" /><ControlButton variant="ghost" loading={loggingOut} onClick={logout}><ArrowLeftStartOnRectangleIcon className="octafuse-nav-icon" aria-hidden />{loggingOut ? tAuth('loggingOut') : tAuth('logout')}</ControlButton>
   {failure ? <ShellError title={tShell('logoutFailed')} failure={failure} uncertainWrite action={<ControlButton variant="secondary" onClick={onCheckSession}>{tShell('checkSession')}</ControlButton>} /> : null}
   <BrandExternalLinks variant="sidebar" /><p className="octafuse-version">{t('version', { version: adminAppVersion })}</p>
  </footer>
 </>;
 return <>
  <a className="octafuse-skip" href="#octafuse-main">{tShell('skipContent')}</a>
  {mobile ? <><header className="octafuse-mobile-bar"><Link href="/dashboard">{tBrand('wordmark')}</Link><ControlIconButton ref={trigger} label={tShell('openNavigation')} aria-expanded={open} onClick={() => setOpen(true)}><Bars3Icon className="octafuse-nav-icon" /></ControlIconButton></header>
   {open ? <MobileNavigation open={open} onOpenChange={setOpen} title={tShell('navigation')} finalFocus={trigger}>{navigation}</MobileNavigation> : null}
  </> : <aside className="octafuse-sidebar"><Link className="octafuse-brand" href="/dashboard"><strong>{tBrand('wordmark')}</strong><span>{tBrand('sidebarSubtitle')}</span></Link>{navigation}</aside>}
 </>;
}
