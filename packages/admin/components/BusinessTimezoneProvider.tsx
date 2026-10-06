'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ControlButton, Spinner } from '@xsec/ui-react';
import { useTranslations } from 'next-intl';
import { isRecord, ShellRequestError, useShellRequest, type ShellFailure } from '@/lib/shell-request';
import { notifyAdminSessionExpired } from '@/lib/admin-session-events';
import ShellError from './layout/ShellError';

type BusinessTimezoneContextValue = { businessTimezone: string; isLoading: boolean; refresh: () => Promise<void> };
const BusinessTimezoneContext = createContext<BusinessTimezoneContextValue | null>(null);
type State = { status: 'loading'; timezone?: string } | { status: 'ready'; timezone: string } | { status: 'error'; failure: ShellFailure; timezone?: string };
export function BusinessTimezoneProvider({ children }: { children: ReactNode }) {
 const [state, setState] = useState<State>({ status: 'loading' }), t = useTranslations('shell'), tCommon = useTranslations('common');
 const { run } = useShellRequest();
 const load = useCallback(async () => {
  await run('/api/admin/business-timezone', {}, body => {
   if (!isRecord(body) || body.success !== true || !isRecord(body.data) || typeof body.data.business_timezone !== 'string' || !body.data.business_timezone.trim()) throw new ShellRequestError('INVALID_RESPONSE');
   const timezone = body.data.business_timezone.trim();
   try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); } catch { throw new ShellRequestError('INVALID_RESPONSE'); }
   return timezone;
  }, timezone => setState({ status: 'ready', timezone }), failure => { if (failure.status === 401) notifyAdminSessionExpired(); else setState(previous => ({ status: 'error', failure, timezone: previous.timezone })); });
 }, [run]);
 useEffect(() => { void load(); }, [load]);
 const refresh = useCallback(async () => { setState(previous => ({ status: 'loading', timezone: previous.timezone })); await load(); }, [load]);
 // Keep page identity and drafts during a refresh; business content is available only after confirmation.
 return <>
  {state.status !== 'ready' ? <div className="octafuse-main-status">{state.status === 'loading' ? <Spinner label={tCommon('loading')} /> : <ShellError title={t('timezoneFailed')} failure={state.failure} action={<ControlButton onClick={() => void refresh()}>{t('retry')}</ControlButton>} />}</div> : null}
  {state.timezone ? <BusinessTimezoneContext.Provider value={{ businessTimezone: state.timezone, isLoading: state.status !== 'ready', refresh }}><div className="octafuse-business-content" hidden={state.status !== 'ready'}>{children}</div></BusinessTimezoneContext.Provider> : null}
 </>;
}
export function useBusinessTimezoneContext(): BusinessTimezoneContextValue {
 const context = useContext(BusinessTimezoneContext); if (!context) throw new Error('BusinessTimezoneProvider is required'); return context;
}
export function useBusinessTimezone(): string { return useBusinessTimezoneContext().businessTimezone; }
