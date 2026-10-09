'use client';
import { useCallback, useEffect, useState } from 'react';
import { shellFailure, type ShellFailure } from '@/lib/shell-request';
import { notifyAdminSessionExpired } from '@/lib/admin-session-events';
import { readPlaygroundCatalog, type PlaygroundCatalog } from './catalog-api';

type CatalogRead = { status: 'loading' } | { status: 'failed'; failure: ShellFailure } | { status: 'ready'; data: PlaygroundCatalog };
export function usePlaygroundCatalog() {
 const [read, setRead] = useState<CatalogRead>({ status: 'loading' });
 const [attempt, setAttempt] = useState(0);
 const refresh = useCallback(() => {
  setRead({ status: 'loading' });
  setAttempt(value => value + 1);
 }, []);
 useEffect(() => {
  const controller = new AbortController();
  let current = true;
  void readPlaygroundCatalog(controller).then(
   data => { if (current) setRead({ status: 'ready', data }); },
   error => {
    if (!current) return;
    const failure = shellFailure(error);
    setRead({ status: 'failed', failure });
    if (failure.status === 401) notifyAdminSessionExpired();
   },
  );
  return () => { current = false; controller.abort(); };
 }, [attempt]);
 return { read, refresh };
}
