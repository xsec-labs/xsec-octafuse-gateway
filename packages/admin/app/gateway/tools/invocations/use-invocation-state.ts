'use client';
import { useCallback, useEffect, useState } from 'react';
import { notifyAdminSessionExpired } from '@/lib/admin-session-events';
import { parseCurrency, parseLogs } from '@/lib/gateway-log-api';
import { useShellRequest, type ShellFailure } from '@/lib/shell-request';
import { defaultInvocationQuery, invocationReadQuery, invocationUrlQuery, parseInvocationQuery, type InvocationQuery } from './invocation-query';

export function useInvocationState(timezone: string) {
 const [{query,invalidQuery},setFilters]=useState<{query:InvocationQuery|null;invalidQuery:boolean}>(()=>{try{return {query:parseInvocationQuery(new URLSearchParams(window.location.search),timezone),invalidQuery:false};}catch(error){if(!(error instanceof TypeError)||error.message!=='INVALID_QUERY')throw error;return {query:null,invalidQuery:true};}});
 const [result,setResult]=useState<ReturnType<typeof parseLogs>|null>(null),[loading,setLoading]=useState(!invalidQuery),[failure,setFailure]=useState<ShellFailure|null>(null);
 const [currency,setCurrency]=useState<string|null>(null),[currencyLoading,setCurrencyLoading]=useState(true),[currencyFailure,setCurrencyFailure]=useState<ShellFailure|null>(null);
 const {run:read,cancel:cancelRead}=useShellRequest(),{run:readCurrency,cancel:cancelCurrency}=useShellRequest();
 useEffect(()=>{if(query)window.history.replaceState(window.history.state,'',`${window.location.pathname}?${invocationUrlQuery(query)}`);},[query]);
 const load=useCallback(async()=>{if(!query)return;await read('/api/admin/request-logs?'+invocationReadQuery(query),{},body=>parseLogs(body,query.page),value=>{setResult(value);setLoading(false);},error=>{setFailure(error);setLoading(false);if(error.status===401)notifyAdminSessionExpired();});},[query,read]);
 useEffect(()=>{void load();return cancelRead;},[load,cancelRead]);
 const loadCurrency=useCallback(async()=>{await readCurrency('/api/admin/config',{},parseCurrency,value=>{setCurrency(value);setCurrencyLoading(false);},error=>{setCurrencyFailure(error);setCurrencyLoading(false);if(error.status===401)notifyAdminSessionExpired();});},[readCurrency]);
 useEffect(()=>{void loadCurrency();return cancelCurrency;},[loadCurrency,cancelCurrency]);
 const change=(next:Partial<InvocationQuery>)=>{cancelRead();setResult(null);setLoading(true);setFailure(null);setFilters(previous=>({invalidQuery:false,query:previous.query&&({...previous.query,...next,page:next.page??1})}));};
 const reset=()=>{cancelRead();setResult(null);setLoading(true);setFailure(null);setFilters({invalidQuery:false,query:defaultInvocationQuery(timezone)});};
 const refresh=()=>{setResult(null);setLoading(true);setFailure(null);return load();};
 const refreshCurrency=()=>{setCurrency(null);setCurrencyLoading(true);setCurrencyFailure(null);return loadCurrency();};
 return {query,invalidQuery,result,loading,failure,currency,currencyLoading,currencyFailure,refresh,refreshCurrency,change,reset};
}
