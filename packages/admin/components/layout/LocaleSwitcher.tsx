'use client';
import { Select, ControlButton } from '@xsec/ui-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { locales, isLocale } from '@/lib/locale';
import { isRecord, ShellRequestError, useShellRequest, type ShellFailure } from '@/lib/shell-request';
import ShellError from './ShellError';

export default function LocaleSwitcher({ variant }: { variant: 'sidebar' | 'login' }) {
 const locale = useLocale(), t = useTranslations('locale'), tShell = useTranslations('shell'), router = useRouter();
 const [pending, setPending] = useState(false), [failure, setFailure] = useState<ShellFailure | null>(null), [refreshing, startTransition] = useTransition();
 const { run } = useShellRequest();
 if (!isLocale(locale)) throw new TypeError('Unsupported Admin locale');
 const select = (next: string | null) => {
  if (!next || !isLocale(next) || next === locale || pending || refreshing) return;
  setPending(true); setFailure(null);
  void run('/api/locale', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale: next }) }, body => {
   if (!isRecord(body) || body.success !== true || body.locale !== next) throw new ShellRequestError('INVALID_RESPONSE');
  }, () => { setPending(false); startTransition(() => router.refresh()); }, error => { setFailure(error); setPending(false); });
 };
 return <div className={'octafuse-locale octafuse-locale-' + variant} aria-busy={pending || refreshing}>
  <Select aria-label={t('label')} value={locale} options={locales.map(value => ({ value, label: t(value) }))} onValueChange={select} disabled={pending || refreshing} />
  {failure ? <ShellError title={tShell('localeFailed')} failure={failure} uncertainWrite action={<ControlButton variant="secondary" onClick={() => { setFailure(null); startTransition(() => router.refresh()); }}>{tShell('retry')}</ControlButton>} /> : null}
 </div>;
}
