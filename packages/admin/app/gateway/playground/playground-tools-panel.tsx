'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge, ControlButton, EmptyState, ErrorState, Field, Input, Section, Select, Spinner, Textarea, type SelectOption } from '@xsec/ui-react';
import { GATEWAY_TOOLS } from '@/lib/gateway-tools';
import { parseGatewayToolId, type GatewayToolId } from '@/lib/invoke-kind';
import { AI_DETECTION_IMPLEMENTED_PROVIDERS } from '@/lib/ai-detection-options';
import { WEB_SEARCH_PROVIDERS } from '@/lib/web-search-options';
import { WEB_FETCH_PROVIDERS } from '@/lib/web-fetch-options';
import { WEB_DEEP_SEARCH_PROVIDERS } from '@/lib/web-deep-search-options';
import { notifyAdminSessionExpired } from '@/lib/admin-session-events';
import { bodyTemplateForTool } from '../simulator/simulator-utils';
import './tools.css';

function providersForTool(toolId: GatewayToolId): readonly string[] {
 switch (toolId) {
  case 'web-search': return WEB_SEARCH_PROVIDERS;
  case 'web-fetch': return WEB_FETCH_PROVIDERS;
  case 'web-deep-search': return WEB_DEEP_SEARCH_PROVIDERS;
  case 'ai-detection': return AI_DETECTION_IMPLEMENTED_PROVIDERS;
  default: { const exhaustive: never = toolId; return exhaustive; }
 }
}
type Props = { initialToolId?: string | null; initialProvider?: string | null };
type Selection = { toolId: GatewayToolId; provider: string };
type Failure = { message: string; field: 'body' | 'timeout' | 'send' };
type Meta = { status: number; latencyMs: string | null; upstreamUrl: string | null };
function initialSelection({initialToolId,initialProvider}: Props): Selection {
 const toolId=initialToolId ? parseGatewayToolId(initialToolId) : 'ai-detection';
 if(!toolId)throw new Error('INVALID_PLAYGROUND_TOOL');
 const providers=providersForTool(toolId),provider=initialProvider?.trim() || providers[0];
 if(!provider || !providers.includes(provider))throw new Error('INVALID_PLAYGROUND_PROVIDER');
 return {toolId,provider};
}

type ToolSelectionProps = Selection & { sending: boolean; toolOptions: readonly SelectOption[]; providerOptions: readonly SelectOption[]; changeTool: (value: string|null) => void; changeProvider: (value: string|null) => void };
const ToolSelection = memo(function ToolSelection({toolId,provider,sending,toolOptions,providerOptions,changeTool,changeProvider}: ToolSelectionProps) {
 const t=useTranslations('playground');
 return <Section title={t('toolsSection')} className="playground-tools-catalog">
   <p className="playground-tools-hint">{t('toolsHint')}</p>
   <div className="playground-tools-filters">
    <Field label={t('tool')}>{field=><Select {...field} disabled={sending} value={toolId} onValueChange={changeTool} options={toolOptions} />}</Field>
    <Field label={t('engineProvider')} hint={t('engineProviderHint')}>{field=><Select {...field} disabled={sending} value={provider} onValueChange={changeProvider} options={providerOptions} />}</Field>
   </div>
  </Section>;
});

export function PlaygroundToolsPanel(props: Props) {
 const t=useTranslations('playground'),tTools=useTranslations('tools.catalog'),common=useTranslations('common');
 const [selection,setSelection]=useState(()=>initialSelection(props));
 const {toolId,provider}=selection;
 const providers=useMemo(()=>providersForTool(toolId),[toolId]);
 const toolOptions=useMemo(()=>GATEWAY_TOOLS.map(tool=>({value:tool.id,label:tTools(tool.nameKey)+' ('+tool.id+')'})),[tTools]);
 const providerOptions=useMemo(()=>providers.map(value=>({value,label:value})),[providers]);
 const [bodyText,setBodyText]=useState(()=>bodyTemplateForTool(selection.toolId));
 const [failure,setFailure]=useState<Failure|null>(null),[sending,setSending]=useState(false),[notice,setNotice]=useState<string|null>(null);
 const [timeoutSeconds,setTimeoutSeconds]=useState('300');
 const [meta,setMeta]=useState<Meta|null>(null),[response,setResponse]=useState(''),[wireBody,setWireBody]=useState<string|null>(null);
 const activeSend=useRef<AbortController|null>(null);
 useEffect(()=>()=>{const active=activeSend.current;activeSend.current=null;active?.abort();},[]);
 const clearResponse=useCallback(()=>{setFailure(null);setNotice(null);setMeta(null);setResponse('');setWireBody(null);},[]);
 const changeTool=useCallback((value: string|null)=>{
  if(activeSend.current)return;
  const parsed=parseGatewayToolId(value);
  if(!parsed)throw new Error('INVALID_PLAYGROUND_TOOL');
  const first=providersForTool(parsed)[0];
  if(!first)throw new Error('INVALID_PLAYGROUND_PROVIDER');
  setSelection({toolId:parsed,provider:first});setBodyText(bodyTemplateForTool(parsed));clearResponse();
 },[clearResponse]);
 const changeProvider=useCallback((value: string|null)=>{
  if(activeSend.current)return;
  if(!value || !providers.includes(value))throw new Error('INVALID_PLAYGROUND_PROVIDER');
  setSelection({toolId,provider:value});clearResponse();
 },[providers,toolId,clearResponse]);
 const cancel=()=>{const active=activeSend.current;if(!active)return;activeSend.current=null;active.abort();setSending(false);setNotice(t('sendState.cancelled'));};
 const send=async()=>{
  if(activeSend.current)return;
  setFailure(null);
  const seconds=Number(timeoutSeconds);
  if(!Number.isSafeInteger(seconds)||seconds<1||seconds>3600){setFailure({message:t('sendState.invalidTimeout'),field:'timeout'});return;}
  let body: Record<string,unknown>;
  try{const parsed:unknown=JSON.parse(bodyText);if(parsed===null||typeof parsed!=='object'||Array.isArray(parsed)){setFailure({message:t('toolsBodyMustBeObject'),field:'body'});return;}body=parsed as Record<string,unknown>;}
  catch{setFailure({message:common('invalidJson'),field:'body'});return;}
  if(!providers.includes(provider)){setFailure({message:t('toolsNeedProvider'),field:'send'});return;}
  const controller=new AbortController();activeSend.current=controller;
  const timer=setTimeout(()=>controller.abort(new Error(t('sendState.timeout'))),seconds*1000);
  clearResponse();setSending(true);
  try{
   const res=await fetch('/api/admin/playground',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({toolId,provider,body}),signal:controller.signal});
   controller.signal.throwIfAborted();
   if(res.status===401){notifyAdminSessionExpired();controller.abort();return;}
   setMeta({status:res.status,latencyMs:res.headers.get('x-playground-latency-ms'),upstreamUrl:res.headers.get('x-playground-upstream-url')});
   const wire=res.headers.get('x-playground-request-body');
   if(wire!==null)setWireBody(JSON.stringify(JSON.parse(decodeURIComponent(wire)),null,2));
   const text=await res.text();controller.signal.throwIfAborted();setResponse(text);
   if(res.headers.get('Content-Type')?.includes('application/json'))setResponse(JSON.stringify(JSON.parse(text),null,2));
   if(!res.ok)setFailure({message:common('requestFailed')+' (HTTP '+res.status+')',field:'send'});
  }catch(error){
   if(activeSend.current===controller){const cause=controller.signal.aborted ? controller.signal.reason : error;controller.abort();setFailure({message:cause instanceof Error ? cause.message : common('requestFailed'),field:'send'});}
  }finally{clearTimeout(timer);if(activeSend.current===controller){activeSend.current=null;setSending(false);}}
 };
 return <div className="playground-tools">
  <ToolSelection toolId={toolId} provider={provider} sending={sending} toolOptions={toolOptions} providerOptions={providerOptions} changeTool={changeTool} changeProvider={changeProvider} />
  <div className="playground-tools-exchange">
   <Section title={t('requestBody')} className="playground-tools-request">
    <div className="playground-tools-actions"><ControlButton variant="outline" disabled={sending} onClick={()=>{setBodyText(bodyTemplateForTool(toolId));setFailure(null);}}>{t('applyTemplate')}</ControlButton>
     <ControlButton disabled={sending} onClick={()=>void send()}>{sending ? common('sending') : common('send')}</ControlButton>
     {sending ? <ControlButton variant="outline" onClick={cancel}>{common('cancel')}</ControlButton> : null}</div>
    {failure?.field==='send' ? <ErrorState title={common('requestFailed')} description={failure.message} /> : null}
    {notice ? <p className="playground-operation-notice" role="status">{notice}</p> : null}
    <Field label={t('sendState.timeoutLabel')} hint={t('toolsTimeoutHint')} error={failure?.field==='timeout' ? failure.message : undefined}>{field=><Input {...field} disabled={sending} type="number" min={1} max={3600} step={1} value={timeoutSeconds} onChange={event=>setTimeoutSeconds(event.target.value)} />}</Field>
    <Field label="JSON" error={failure?.field==='body' ? failure.message : undefined}>{field=><Textarea {...field} disabled={sending} value={bodyText} onChange={event=>setBodyText(event.target.value)} rows={10} spellCheck={false} />}</Field>
   </Section>
   <Section title={t('response')} className="playground-tools-response">
    {meta ? <div className="playground-tools-badges"><Badge tone={meta.status>=400 ? 'danger' : 'neutral'}>HTTP {meta.status}</Badge>{meta.latencyMs!==null ? <Badge>{meta.latencyMs} ms</Badge> : null}</div> : null}
    {sending ? <Spinner label={common('sending')} /> : null}
    {meta?.upstreamUrl ? <p className="playground-response-upstream"><strong>{t('upstream')}</strong>{meta.upstreamUrl}</p> : null}
    {wireBody ? <details><summary>{t('sentBody')}</summary><pre tabIndex={0} aria-label={t('sentBody')}>{wireBody}</pre></details> : null}
    {response ? <div><h3>{t('rawPayload')}</h3><pre tabIndex={0} aria-label={t('rawPayload')}>{response}</pre></div> : null}
    {!meta&&!sending ? <EmptyState title={t('emptyResponseHint')} /> : null}
   </Section>
  </div>
 </div>;
}
