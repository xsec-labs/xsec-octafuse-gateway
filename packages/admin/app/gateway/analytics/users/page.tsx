'use client';
import {Fragment,useMemo,useState} from 'react';
import Link from 'next/link';
import {useTranslations} from 'next-intl';
import {Badge,ControlButton,PageHeader,Spinner,Table,TableHead,TableBody,TableRow,TableHeader,TableCell} from '@xsec/ui-react';
import {AnalyticsRangeCostTotals} from '@/components/AnalyticsRangeCostTotals';
import {AnalyticsTokenCount} from '@/components/AnalyticsTokenCount';
import {useBusinessTimezone} from '@/components/BusinessTimezoneProvider';
import ShellError from '@/components/layout/ShellError';
import {compareAnalyticsTableRows,createRangeValue,DEFAULT_GATEWAY_TIME_RANGE_PRESET,sumAnalyticsCosts,type GatewayTimeRangeValue} from '@/lib/analytics-range';
import {formatGatewayMoneyCode} from '@/lib/format-gateway-currency';
import {formatLatencyMs} from '@/lib/format-latency';
import type {TokenDisplayMode} from '@/lib/format-token-count';
import type {UserUsageRow} from '@/lib/types';
import {csvRowsToString,downloadCsvFile,filenameTimestamp} from '@/lib/csv';
import {useGatewayDateTime} from '@/lib/use-gateway-datetime';
import {parseUsers,parseModels,parseCurrency} from './usage-api';
import {useUsageRead} from './use-usage-read';
import {UsageRange} from './usage-range';
import './usage.css';
type SortKey=keyof UserUsageRow;
type SortDir='asc'|'desc';
type Sorting={sortKey:SortKey;sortDir:SortDir;onSort:(key:SortKey)=>void};

export default function UserUsagePage(){
 const t=useTranslations('analytics.userUsage'),common=useTranslations('common'),token=useTranslations('analytics.tokenDisplay');
 const timezone=useBusinessTimezone();
 const [range,setRange]=useState(()=>createRangeValue(DEFAULT_GATEWAY_TIME_RANGE_PRESET,timezone)),[mode,setMode]=useState<TokenDisplayMode>('compact');
 const [sortKey,setSortKey]=useState<SortKey>('request_count'),[sortDir,setSortDir]=useState<SortDir>('desc');
 const onSort=(key:SortKey)=>{if(sortKey===key)setSortDir(value=>value==='asc'?'desc':'asc');else{setSortKey(key);setSortDir('desc');}};
 const path='/api/admin/analytics/users?'+new URLSearchParams({start_date:range.start_date,end_date:range.end_date});
 const read=useUsageRead(path,parseUsers),currency=useUsageRead('/api/admin/config',parseCurrency);
 return <div className="p-8 user-usage-page">
  <PageHeader title={t('title')} description={t('subtitle')} actions={<ControlButton disabled={read.loading||currency.loading} onClick={()=>{read.refresh();currency.refresh();}}>{common('reload')}</ControlButton>}/>
  <div className="user-usage-filters"><UsageRange value={range} onChange={setRange}/><div className="user-usage-token-mode" role="group" aria-label={token('label')}><span className="xui-label">{token('label')}</span>{(['compact','numeric'] as const).map(value=><ControlButton key={value} variant={mode===value?'secondary':'ghost'} aria-pressed={mode===value} onClick={()=>setMode(value)}>{token(value)}</ControlButton>)}</div></div>
  {currency.failure?<ShellError title={t('feedback.currencyFailed')} failure={currency.failure} action={<ControlButton onClick={currency.refresh}>{common('reload')}</ControlButton>}/>:currency.loading?<p role="status">{t('feedback.currencyPending')}</p>:null}
  {read.failure?<ShellError title={t('feedback.readFailed')} failure={read.failure} action={<ControlButton onClick={read.refresh}>{common('reload')}</ControlButton>}/>:read.loading?<Spinner label={common('loading')}/>:null}
  {read.settledValue?<div hidden={read.loading||!!read.failure}><UserTable scope={read.scope} rows={read.settledValue} committedQuery={range} tokenDisplayMode={mode} billingCurrency={currency.loading?null:currency.settledValue} pending={read.loading} sortKey={sortKey} sortDir={sortDir} onSort={onSort}/></div>:null}
 </div>;
}
function SortHeader({label,columnKey,sortKey,sortDir,onSort}:{label:string;columnKey:SortKey}&Sorting){
 return <TableHeader aria-sort={sortKey===columnKey?(sortDir==='asc'?'ascending':'descending'):undefined}><ControlButton variant="ghost" onClick={()=>onSort(columnKey)}>{label} {sortKey===columnKey?(sortDir==='asc'?'↑':'↓'):null}</ControlButton></TableHeader>;
}
function SuccessBadge({rate}:{rate:number}){return <Badge tone={rate>=95?'success':rate>=80?'warning':'danger'}>{rate.toFixed(1)}%</Badge>;}
function UserTable({scope,rows,committedQuery,tokenDisplayMode,billingCurrency,pending,...sorting}:{scope:string;rows:UserUsageRow[];committedQuery:GatewayTimeRangeValue;tokenDisplayMode:TokenDisplayMode;billingCurrency:string|null;pending:boolean}&Sorting){
 const t=useTranslations('analytics.userUsage'),tA=useTranslations('analytics'),tCommon=useTranslations('common');
 const {formatDateTime}=useGatewayDateTime();
 const [expanded,setExpanded]=useState<{scope:string;email:string}|null>(null);
 const expandedEmail=expanded?.scope===scope?expanded.email:null;
 const sorted=useMemo(()=>[...rows].sort((a,b)=>compareAnalyticsTableRows(a,b,sorting.sortKey,sorting.sortDir)),[rows,sorting.sortKey,sorting.sortDir]);
 const rangeTotals=useMemo(()=>sumAnalyticsCosts(rows),[rows]);
 const toggle=(email:string)=>setExpanded(expandedEmail===email?null:{scope,email});
 const money=(value:number,digits:number)=>billingCurrency===null?tCommon('noData'):formatGatewayMoneyCode(value,billingCurrency,digits);
 const columns:[string,SortKey][]=[['userEmail','user_email'],['requests','request_count'],['inputTokens','input_tokens'],['outputTokens','output_tokens'],['standard','standard_cost'],['charged','charged_cost'],['metered','metered_cost'],['models','distinct_models'],['lastActive','last_active_at'],['budgetUsage','budget_usage_rate'],['successRate','success_rate']];
  const exportCsv = () => {
    const { start_date, end_date } = committedQuery;
    const headers = [
      'user_email',
      'request_count',
      'input_tokens',
      'output_tokens',
      'standard_cost',
      'charged_cost',
      'metered_cost',
      'distinct_models',
      'last_active_at',
      'budget_max',
      'budget_spent',
      'budget_usage_rate_pct',
      'success_rate_pct',
      'error_count',
      'range_start_utc',
      'range_end_utc',
    ];
    const dataRows: string[][] = sorted.map((r) => [
      r.user_email,
      String(r.request_count),
      String(r.input_tokens),
      String(r.output_tokens),
      String(r.standard_cost ?? 0),
      String(r.charged_cost),
      String(r.metered_cost),
      String(r.distinct_models),
      r.last_active_at ?? '',
      r.budget_max != null ? String(r.budget_max) : '',
      String(r.budget_spent),
      r.budget_usage_rate != null ? String(r.budget_usage_rate) : '',
      String(r.success_rate),
      String(r.error_count),
      start_date,
      end_date,
    ]);
    const csv = csvRowsToString([headers, ...dataRows]);
    downloadCsvFile(`user-usage-${filenameTimestamp()}.csv`, csv);
  };

 return <div className="user-usage-panel">
  <div className="user-usage-toolbar"><ControlButton variant="secondary" disabled={pending||billingCurrency===null} onClick={exportCsv}>{tCommon('exportCsv')}</ControlButton>{billingCurrency!==null?<AnalyticsRangeCostTotals isLoading={pending} totals={rangeTotals} billingCurrency={billingCurrency}/>:null}</div>
  <Table aria-label={t('title')} className="user-usage-table">
   <TableHead><TableRow>{columns.map(([label,columnKey])=><SortHeader key={columnKey} label={tA('columns.'+label)} columnKey={columnKey} {...sorting}/>)}</TableRow></TableHead>
   <TableBody>{sorted.map(row=>{
    const logQuery=new URLSearchParams({user_email:row.user_email,start_date:committedQuery.start_date,end_date:committedQuery.end_date}),isExpanded=expandedEmail===row.user_email;
    const panelId='user-models-'+encodeURIComponent(row.user_email);
    return <Fragment key={row.user_email}>
     <TableRow onClick={()=>toggle(row.user_email)} className={isExpanded?'user-usage-expanded':''}>
      <TableCell><div className="user-usage-identity"><ControlButton variant="ghost" aria-label={t('feedback.modelsFor',{email:row.user_email})} aria-expanded={isExpanded} aria-controls={isExpanded?panelId:undefined} onClick={event=>{event.stopPropagation();toggle(row.user_email);}}>{isExpanded?'▾':'▸'}</ControlButton><Link href={'/gateway/request-logs?'+logQuery} onClick={event=>event.stopPropagation()}>{row.user_email}</Link></div></TableCell>
      <TableCell>{row.request_count.toLocaleString()}</TableCell>
      <TableCell><AnalyticsTokenCount value={row.input_tokens} mode={tokenDisplayMode}/></TableCell>
      <TableCell><AnalyticsTokenCount value={row.output_tokens} mode={tokenDisplayMode}/></TableCell>
      <TableCell className="text-gray-600 tabular-nums">{money(row.standard_cost??0,4)}</TableCell><TableCell className="text-gray-600 tabular-nums">{money(row.charged_cost,4)}</TableCell><TableCell className="text-gray-600 tabular-nums">{money(row.metered_cost,4)}</TableCell>
      <TableCell>{row.distinct_models}</TableCell><TableCell className="text-gray-600">{formatDateTime(row.last_active_at)}</TableCell>
      <TableCell>{row.budget_usage_rate===null?tCommon('noData'):<Badge tone={row.budget_usage_rate>=100?'danger':row.budget_usage_rate>=80?'warning':'neutral'}>{row.budget_usage_rate.toFixed(1)}%</Badge>}</TableCell>
      <TableCell><SuccessBadge rate={row.success_rate}/></TableCell>
     </TableRow>
     {isExpanded?<TableRow className="user-usage-expanded"><TableCell colSpan={11}><div id={panelId}><UserModels userEmail={row.user_email} committedQuery={committedQuery} billingCurrency={billingCurrency} tokenDisplayMode={tokenDisplayMode}/></div></TableCell></TableRow>:null}
    </Fragment>;
   })}</TableBody>
  </Table>
  {rows.length===0?<div className="user-usage-empty">{tA('noData')}</div>:null}
 </div>;
}
function UserModels({userEmail,committedQuery,billingCurrency,tokenDisplayMode}:{userEmail:string;committedQuery:GatewayTimeRangeValue;billingCurrency:string|null;tokenDisplayMode:TokenDisplayMode}){
 const t=useTranslations('analytics.userUsage'),tA=useTranslations('analytics'),common=useTranslations('common');
 const path='/api/admin/analytics/models?'+new URLSearchParams({start_date:committedQuery.start_date,end_date:committedQuery.end_date,user_email:userEmail}),read=useUsageRead(path,parseModels);
 const money=(value:number,digits:number)=>billingCurrency===null?common('noData'):formatGatewayMoneyCode(value,billingCurrency,digits);
 if(read.loading)return <Spinner label={tA('loadingModelUsage')}/>;
 if(read.failure)return <ShellError title={t('feedback.modelsFailed')} failure={read.failure} action={<ControlButton onClick={read.refresh}>{common('reload')}</ControlButton>}/>;
 if(read.settledValue===null)throw new Error('User model read must settle with data or failure');
 if(read.settledValue.length===0)return <p className="user-usage-empty">{tA('noModelUsageForUser')}</p>;
 return <div className="user-usage-model-panel"><Table aria-label={t('feedback.modelsFor',{email:userEmail})} className="user-usage-model-table">
  <TableHead><TableRow>{['model','routeGroup','requests','inputTokens','outputTokens','standard','charged','metered','avgChargedPerReq','successRate','avgLatencyMs'].map(label=><TableHeader key={label}>{tA('columns.'+label)}</TableHeader>)}</TableRow></TableHead>
  <TableBody>{read.settledValue.map(row=>{
   const query=new URLSearchParams({user_email:userEmail,start_date:committedQuery.start_date,end_date:committedQuery.end_date,model_id:row.model_id,route_group:row.route_group});
   return <TableRow key={JSON.stringify([row.model_id,row.route_group])}>
    <TableCell><Link href={'/gateway/request-logs?'+query}>{row.model_id}</Link></TableCell><TableCell className="font-mono">{row.route_group}</TableCell><TableCell>{row.request_count.toLocaleString()}</TableCell>
    <TableCell><AnalyticsTokenCount value={row.input_tokens} mode={tokenDisplayMode}/></TableCell><TableCell><AnalyticsTokenCount value={row.output_tokens} mode={tokenDisplayMode}/></TableCell>
    <TableCell className="text-gray-600 tabular-nums">{money(row.standard_cost??0,4)}</TableCell><TableCell className="text-gray-600 tabular-nums">{money(row.charged_cost,4)}</TableCell><TableCell className="text-gray-600 tabular-nums">{money(row.metered_cost,4)}</TableCell><TableCell className="text-gray-600 tabular-nums">{money(row.avg_charged_per_request,6)}</TableCell>
    <TableCell><SuccessBadge rate={row.success_rate}/></TableCell><TableCell>{row.avg_latency_ms===null?common('noData'):formatLatencyMs(row.avg_latency_ms)}</TableCell>
   </TableRow>;
  })}</TableBody>
 </Table></div>;
}
