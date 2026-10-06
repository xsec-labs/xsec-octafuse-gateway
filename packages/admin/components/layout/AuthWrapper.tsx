'use client';
import { useState, useEffect, useCallback, useRef, type ReactNode, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { ControlButton, Field, Input, Spinner } from '@xsec/ui-react';
import BrandExternalLinks from './BrandExternalLinks';
import LocaleSwitcher from './LocaleSwitcher';
import ShellError from './ShellError';
import { BusinessTimezoneProvider } from '@/components/BusinessTimezoneProvider';
import { ADMIN_SESSION_EXPIRED_EVENT_NAME } from '@/lib/admin-session-events';
import { isRecord, parseShellSuccess, ShellRequestError, useShellRequest, type ShellFailure } from '@/lib/shell-request';
import Sidebar from './Sidebar';

type AuthState = { status: 'checking' } | { status: 'anonymous' } | { status: 'authenticated' } | { status: 'error'; failure: ShellFailure };

export default function AuthWrapper({ children }: { children: ReactNode }) {
 const t = useTranslations('auth'), tBrand = useTranslations('brand'), tCommon = useTranslations('common'), tShell = useTranslations('shell');
 const [auth, setAuth] = useState<AuthState>({ status: 'checking' });
 const [username, setUsername] = useState(''), [password, setPassword] = useState('');
 const [loggingIn, setLoggingIn] = useState(false), [loginError, setLoginError] = useState<ShellFailure | null>(null);
 const { run: runCheck, cancel: cancelCheck } = useShellRequest(), { run: runLogin, cancel: cancelLogin } = useShellRequest(), loginBusy = useRef(false);
 const checkAuth = useCallback(() => {
  void runCheck('/api/auth/check', {}, body => {
   if (!isRecord(body) || typeof body.authenticated !== 'boolean') throw new ShellRequestError('INVALID_RESPONSE');
   return body.authenticated;
  }, authenticated => setAuth({ status: authenticated ? 'authenticated' : 'anonymous' }), failure => setAuth({ status: 'error', failure }));
 }, [runCheck]);
 useEffect(() => { checkAuth(); }, [checkAuth]);
 useEffect(() => {
  const expired = () => { cancelCheck(); cancelLogin(); loginBusy.current = false; setLoggingIn(false); setPassword(''); setAuth({ status: 'anonymous' }); };
  window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT_NAME, expired);
  return () => window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT_NAME, expired);
 }, [cancelCheck, cancelLogin]);
 useEffect(() => {
  const visible = () => { if (document.visibilityState === 'visible' && auth.status === 'authenticated') { setAuth({ status: 'checking' }); checkAuth(); } };
  document.addEventListener('visibilitychange', visible);
  return () => document.removeEventListener('visibilitychange', visible);
 }, [auth.status, checkAuth]);
 const handleLogin = (event: FormEvent) => {
  event.preventDefault(); if (loginBusy.current) return;
  loginBusy.current = true; setLoggingIn(true); setLoginError(null);
  void runLogin('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }, parseShellSuccess,
   () => { loginBusy.current = false; setLoggingIn(false); setPassword(''); setAuth({ status: 'authenticated' }); },
   failure => { loginBusy.current = false; setLoggingIn(false); setLoginError(failure); });
 };
 if (auth.status === 'checking' || auth.status === 'error') return <div className="octafuse-auth-page"><section className="octafuse-auth-panel">
  <h1>{tBrand('loginHeading')}</h1>
  {auth.status === 'checking' ? <Spinner label={tCommon('loading')} /> : <ShellError title={tShell('sessionFailed')} failure={auth.failure} action={<ControlButton onClick={() => { setAuth({ status: 'checking' }); checkAuth(); }}>{tShell('retry')}</ControlButton>} />}
 </section></div>;
 if (auth.status === 'anonymous') return <div className="octafuse-auth-page"><section className="octafuse-auth-panel">
  <header><p className="octafuse-eyebrow">{tBrand('operatorConsole')}</p><h1>{tBrand('loginHeading')}</h1><p className="octafuse-auth-intro">{tShell('loginIntro')}</p></header>
  <form onSubmit={handleLogin} aria-busy={loggingIn}>
   <Field id="username" label={t('username')}>{props => <Input {...props} type="text" value={username} onChange={event => setUsername(event.target.value)} required maxLength={256} autoComplete="username" disabled={loggingIn} />}</Field>
   <Field id="password" label={t('password')}>{props => <Input {...props} type="password" value={password} onChange={event => setPassword(event.target.value)} required maxLength={4096} autoComplete="current-password" disabled={loggingIn} />}</Field>
   {loginError ? <ShellError title={tCommon('loginFailed')} failure={loginError} uncertainWrite={loginError.status !== 401} action={loginError.status !== 401 ? <ControlButton variant="secondary" onClick={() => { setAuth({ status: 'checking' }); checkAuth(); }}>{tShell('checkSession')}</ControlButton> : undefined} /> : null}
   <ControlButton type="submit" loading={loggingIn}>{loggingIn ? t('loggingIn') : t('login')}</ControlButton>
  </form>
  <footer><LocaleSwitcher variant="login" /><BrandExternalLinks variant="login" /></footer>
 </section></div>;
 return <div className="octafuse-workspace"><Sidebar onLoggedOut={() => setAuth({ status: 'anonymous' })} onCheckSession={() => { setAuth({ status: 'checking' }); checkAuth(); }} /><main id="octafuse-main" className="octafuse-main" tabIndex={-1}><BusinessTimezoneProvider>{children}</BusinessTimezoneProvider></main></div>;
}
