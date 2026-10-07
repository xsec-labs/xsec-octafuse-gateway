'use client';
import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { Badge, ControlButton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@xsec/ui-react';
import { GATEWAY_TOOLS } from '@/lib/gateway-tools';
import { formatGatewayMoneyCompact, formatGatewayMoneyCompactSigned, getGatewayCurrencySymbol } from '@/lib/format-gateway-currency';
import { parseToolRequestSummary, parseToolResponseSummary, resolveToolEngineProvider } from '@/lib/tool-invocation-detail';
import type { GatewayRequestLog } from '@/lib/types';
import { useGatewayDateTime } from '@/lib/use-gateway-datetime';

/** Detail interactions keep the confirmed list and its parsed summaries stable. */
export const InvocationTable = memo(function InvocationTable({logs,currency,onInspect}:{logs:GatewayRequestLog[];currency:string|null;onInspect:(log:GatewayRequestLog,trigger:HTMLButtonElement)=>void}) {
 const t=useTranslations('tools.invocations'),tools=useTranslations('tools'),common=useTranslations('common'),options=useTranslations('options'),{formatDateTime}=useGatewayDateTime();
 const toolLabel=(model:string|null|undefined)=>{const tool=GATEWAY_TOOLS.find(x=>x.modelId===model);return tool?tools('catalog.'+tool.nameKey):model||'—';};
 const headers=['time','tool','provider','query','user','status','results','standard','charged','metered','profit','latency'] as const;
 const price=(value:number|undefined,signed=false)=>currency&&value!==undefined?(signed?formatGatewayMoneyCompactSigned(value,currency):formatGatewayMoneyCompact(value,currency)):'—';
 return <Table className="invocation-table" aria-label={t('title')}><TableHead><TableRow>{headers.map(key=><TableHeader key={key} title={['standard','charged','metered','profit'].includes(key)?t('titles.'+key):undefined} className={['results','standard','charged','metered','profit','latency'].includes(key)?'invocation-numeric':undefined}>{['standard','charged','metered','profit'].includes(key)?t('columns.'+key,{currency:currency?getGatewayCurrencySymbol(currency):'—'}):t('columns.'+key)}</TableHeader>)}</TableRow></TableHead><TableBody>{logs.map(log=>{
    const req=parseToolRequestSummary(log.request_body),res=parseToolResponseSummary(log.raw_usage),profit=log.charged_cost-log.metered_cost;
    return <TableRow key={log.id} data-log-id={log.id} data-loss={profit<0}>
     <TableCell className="invocation-time">{formatDateTime(log.created_at)}</TableCell><TableCell>{toolLabel(log.model_id)}</TableCell><TableCell>{resolveToolEngineProvider(log)||'—'}</TableCell>
     <TableCell><ControlButton variant="ghost" className="invocation-detail-trigger" aria-label={`${common('details')} · ${log.id}`} onClick={event=>onInspect(log,event.currentTarget)}>{req.query||common('details')}{req.invalid||res.invalid?<Badge>{t('feedback.payloadInvalid')}</Badge>:null}</ControlButton></TableCell>
     <TableCell className="invocation-user" title={log.user_email??undefined}>{log.user_email||'—'}</TableCell><TableCell><Badge>{log.status==='success'?options('requestStatus.success'):log.status==='error'?options('requestStatus.error'):log.status}</Badge></TableCell><TableCell className="invocation-numeric">{res.resultCount??'—'}</TableCell>
     <TableCell className="invocation-numeric" title={t('titles.standard')}>{price(log.standard_cost)}</TableCell><TableCell className="invocation-numeric" title={t('titles.charged')}>{price(log.charged_cost)}</TableCell><TableCell className="invocation-numeric" title={t('titles.metered')}>{price(log.metered_cost)}</TableCell><TableCell className="invocation-numeric" title={t('titles.profit')} data-profit={profit<0?'negative':profit>0?'positive':'neutral'}>{price(profit,true)}</TableCell><TableCell className="invocation-numeric">{log.latency_ms==null?'—':`${log.latency_ms} ms`}</TableCell>
    </TableRow>;
   })}</TableBody></Table>;
});
