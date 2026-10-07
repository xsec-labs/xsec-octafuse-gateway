'use client';
import {useCallback,useEffect,useState} from 'react';
import {notifyAdminSessionExpired} from '@/lib/admin-session-events';
import {useShellRequest,type ShellFailure} from '@/lib/shell-request';

/** Statistics and currency each own a cancellable read with a complete-body deadline. */
export function useDashboardRead<T>(path:string,parse:(body:unknown)=>T){
 const {run,cancel}=useShellRequest(),[revision,setRevision]=useState(0),scope=path+'\n'+revision;
 const [state,setState]=useState<{scope:string;value:T|null;failure:ShellFailure|null}>({scope:'',value:null,failure:null});
 useEffect(()=>{void run(path,{},parse,value=>setState({scope,value,failure:null}),failure=>{if(failure.status===401)notifyAdminSessionExpired();setState({scope,value:null,failure});});return cancel;},[path,scope,parse,run,cancel]);
 const refresh=useCallback(()=>setRevision(value=>value+1),[]),current=state.scope===scope;
 return{scope,value:state.value,failure:current?state.failure:null,loading:!current||(state.value===null&&state.failure===null),refresh};
}
