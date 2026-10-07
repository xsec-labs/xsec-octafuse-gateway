'use client';
import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Badge, ControlButton, Drawer, EmptyState, Field, PageHeader, Section, Select, Spinner, Tabs } from '@xsec/ui-react';
import ShellError from '@/components/layout/ShellError';
import { GatewayTimeRangePicker } from '@/components/GatewayTimeRangePicker';
import { GATEWAY_TOOLS } from '@/lib/gateway-tools';
import { parseToolRequestSummary, parseToolResponseSummary, resolveToolEngineProvider, toolResultHref } from '@/lib/tool-invocation-detail';
import type { GatewayRequestLog } from '@/lib/types';
import { useGatewayDateTime } from '@/lib/use-gateway-datetime';
import { invocationReadQuery } from './invocation-query';
import { useInvocationState } from './use-invocation-state';
import { InvocationTable } from './invocation-table';
import './invocations.css';

const subscribeToClient = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
export default function GatewayToolInvocationsPage() {
 const clientReady=useSyncExternalStore(subscribeToClient,clientSnapshot,serverSnapshot),common=useTranslations('common');
 return clientReady?<InvocationContent/>:<Spinner label={common('loading')}/>;
}
function InvocationContent() {
 const t=useTranslations('tools.invocations'),tools=useTranslations('tools'),common=useTranslations('common'),shell=useTranslations('shell'),options=useTranslations('options');
 const {businessTimezone,formatDateTime}=useGatewayDateTime(),state=useInvocationState(businessTimezone),[detail,setDetail]=useState<GatewayRequestLog|null>(null),[view,setView]=useState('list'),returnFocus=useRef<HTMLButtonElement|null>(null);
 const query=state.query,currency=state.currency,totalPages=state.result?Math.max(1,Math.ceil(state.result.total/50)):1;
 const readQuery=query?invocationReadQuery(query):null;if(readQuery){readQuery.delete('page');readQuery.delete('page_size');}
 const toolLabel=(model:string|null|undefined)=>{const tool=GATEWAY_TOOLS.find(x=>x.modelId===model);return tool?tools('catalog.'+tool.nameKey):model||'—';};
 const choose=(next:Parameters<typeof state.change>[0])=>{setDetail(null);state.change(next);};
 const request=detail?parseToolRequestSummary(detail.request_body):null,response=detail?parseToolResponseSummary(detail.raw_usage):null;
 const inspect=useCallback((log:GatewayRequestLog,trigger:HTMLButtonElement)=>{returnFocus.current=trigger;setView('list');setDetail(log);},[]);
 return <div className="tool-invocations-page p-8">
  <PageHeader title={t('title')} description={t('feedback.summary')} actions={<><Link className="invocation-link" href="/gateway/tools">{t('configureTools')}</Link>{readQuery?<Link className="invocation-link" href={'/gateway/request-logs?'+readQuery}>{t('openInRequestLogs')}</Link>:null}</>}/>
  {state.invalidQuery?<Section title={t('feedback.filters')}><p role="alert" className="invocation-error">{t('feedback.invalidQuery')}</p><ControlButton onClick={state.reset}>{common('clearFilters')}</ControlButton></Section>:query?<Section title={t('feedback.filters')} className="invocation-filters">
   <div className="invocation-filter-fields"><Field id="invocations-tool" label={t('toolFilter')}>{props=><Select {...props} value={query.tool} options={[{value:'',label:t('allTools')},...GATEWAY_TOOLS.map(tool=>({value:tool.id,label:tools('catalog.'+tool.nameKey)}))]} onValueChange={tool=>{if(tool!==null)choose({tool});}}/>}</Field>
   <Field id="invocations-status" label={t('status')}>{props=><Select {...props} value={query.status} options={[{value:'',label:common('all')},{value:'success',label:options('requestStatus.success')},{value:'error',label:options('requestStatus.error')}]} onValueChange={status=>{if(status!==null)choose({status});}}/>}</Field>
   <ControlButton variant="outline" onClick={()=>{setDetail(null);state.reset();}}>{common('clearFilters')}</ControlButton></div>
   <GatewayTimeRangePicker value={query.range} onChange={range=>choose({range})}/>
  </Section>:null}
  {state.currencyFailure?<ShellError title={t('feedback.currencyFailed')} failure={state.currencyFailure} action={<ControlButton variant="outline" onClick={()=>void state.refreshCurrency()}>{shell('retry')}</ControlButton>}/>:state.currencyLoading?<Spinner label={common('loading')}/>:null}
  {state.failure?<ShellError title={t('feedback.readFailed')} failure={state.failure} action={<ControlButton variant="outline" onClick={()=>void state.refresh()}>{shell('retry')}</ControlButton>}/>:state.loading?<Spinner label={common('loading')}/>:state.result&&query?<>
   {state.result.logs.length?<div className="invocation-list"><InvocationTable logs={state.result.logs} currency={currency} onInspect={inspect}/></div>:<EmptyState title={t('empty')}/>}
   <div className="invocation-pagination"><p role="status">{common('pageOf',{page:query.page,totalPages})} · {state.result.total}</p><div><ControlButton variant="outline" disabled={query.page<=1} onClick={()=>choose({page:query.page-1})}>{common('previous')}</ControlButton><ControlButton variant="outline" disabled={query.page>=totalPages} onClick={()=>choose({page:query.page+1})}>{common('next')}</ControlButton></div></div>
  </>:null}
  <Drawer open={detail!==null} onOpenChange={open=>{if(!open)setDetail(null);}} title={common('details')} description={detail?`${toolLabel(detail.model_id)} · ${detail.id}`:undefined} finalFocus={()=>returnFocus.current} className="invocation-detail-drawer">
   {detail&&request&&response?<div className="invocation-detail"><div className="invocation-detail-summary"><p>{formatDateTime(detail.created_at)}</p><p>{resolveToolEngineProvider(detail)||'—'} · {detail.user_email||'—'}</p></div>
    <div className="invocation-payloads"><section><h3>{t('detail.request')}</h3>{request.invalid?<p role="alert" className="invocation-error">{t('feedback.payloadInvalid')}</p>:null}<pre>{request.text||'—'}</pre></section>
    <section><h3>{t('detail.response')}</h3>{detail.error_message?<p role="alert" className="invocation-error">{detail.error_message}</p>:null}{response.invalid?<p role="alert" className="invocation-error">{t('feedback.payloadInvalid')}</p>:null}
     <Tabs value={view} onValueChange={setView} label={t('detail.responseFormat')} items={[{value:'list',label:t('detail.formatList'),content:response.invalid?<p>{t('feedback.inspectRaw')}</p>:response.results.length?<ul className="invocation-results">{response.results.map((item,i)=>{const href=item.url?toolResultHref(item.url):null;return <li key={i}>{href?<a className="invocation-link" href={href} target="_blank" rel="noopener noreferrer">{item.title||item.url}</a>:<p>{item.title||item.url||'—'}</p>}{item.url&&!href?<p className="invocation-error" role="alert">{t('feedback.unsafeResultUrl')}</p>:null}{item.siteName?<p className="invocation-muted">{item.siteName}</p>:null}{item.snippet?<p>{item.snippet}</p>:null}</li>;})}</ul>:<p className="invocation-muted">{response.text?t('detail.noListResults'):t('detail.noResponseStored')}</p>},{value:'json',label:t('detail.formatJson'),content:<pre>{response.text||t('detail.noResponseStored')}</pre>}]}/>
    </section></div><p className="invocation-muted">{t('detail.hint')}</p>
   </div>:null}
  </Drawer>
 </div>;
}
