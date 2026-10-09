'use client';
import { useCallback, useEffect, useState } from 'react';
import { notifyAdminSessionExpired } from '@/lib/admin-session-events';
import { useShellRequest, type ShellFailure } from '@/lib/shell-request';

/** Range results and currency are independent reads with their own cancellation and whole-body deadline. */
export function useReliabilityRead<T>(path: string, parse: (body: unknown) => T) {
  const {run,cancel}=useShellRequest();
  const [revision,setRevision]=useState(0);
  const scope=path+'\n'+revision;
  const [state,setState]=useState<{scope: string;value: T | null;failure: ShellFailure | null}>({scope:'',value:null,failure:null});
  useEffect(()=>{
    void run(path,{},parse,
      value=>setState({scope,value,failure:null}),
      failure=>{if(failure.status===401)notifyAdminSessionExpired();setState({scope,value:null,failure});});
    return cancel;
  },[path,scope,parse,run,cancel]);
  const refresh=useCallback(()=>setRevision(value=>value+1),[]);
  const current=state.scope===scope;
  // Pending scopes can keep the last settled payload mounted behind hidden; failures clear it.
  return {settledValue:state.value,failure:current?state.failure:null,loading:!current||(state.value===null&&state.failure===null),refresh};
}
