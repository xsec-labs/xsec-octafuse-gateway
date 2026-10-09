'use client';
import { useCallback, useEffect, useState } from 'react';
import { useShellRequest, type ShellFailure } from '@/lib/shell-request';

/** Catalogs and currency have independent request owners and explicit retry actions. */
export function useLogResource<T>(path: string, parse: (body: unknown) => T) {
  const { run, cancel } = useShellRequest();
  const [state, setState] = useState<{ value: T | null; loading: boolean; failure: ShellFailure | null }>({value: null, loading: true, failure: null});
  const load = useCallback(() => {
    return run(path, {}, parse, value => setState({value, loading: false, failure: null}), failure => setState({value: null, loading: false, failure}));
  }, [path, parse, run]);
  const refresh = useCallback(() => {
    setState({value: null, loading: true, failure: null});
    return load();
  }, [load]);
  useEffect(() => { void load(); return cancel; }, [load, cancel]);
  return { ...state, refresh };
}
