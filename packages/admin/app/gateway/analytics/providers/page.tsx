'use client';
import {Fragment,memo,useCallback,useMemo,useState} from 'react';
import Link from 'next/link';
import {useTranslations} from 'next-intl';
import {Badge,ControlButton,Dialog,PageHeader,Spinner,Table,TableHead,TableBody,TableRow,TableHeader,TableCell} from '@xsec/ui-react';
import {AnalyticsRangeCostTotals} from '@/components/AnalyticsRangeCostTotals';
import {AnalyticsTokenCount} from '@/components/AnalyticsTokenCount';
import {buildAnalyticsTtftTooltip,type AnalyticsTtftMetrics} from '@/components/AnalyticsTtftCell';
import {useBusinessTimezone} from '@/components/BusinessTimezoneProvider';
import ShellError from '@/components/layout/ShellError';
import {compareAnalyticsTableRows,createRangeValue,DEFAULT_GATEWAY_TIME_RANGE_PRESET,sumAnalyticsCosts,type GatewayTimeRangeValue} from '@/lib/analytics-range';
import {formatGatewayMoneyCode} from '@/lib/format-gateway-currency';
import {formatLatencyMs} from '@/lib/format-latency';
import type {TokenDisplayMode} from '@/lib/format-token-count';
import type {ProviderUsageRow} from '@/lib/types';
import {csvRowsToString,downloadCsvFile,filenameTimestamp} from '@/lib/csv';
import {parseProviders,parseModels,parseCurrency} from './usage-api';
import {useUsageRead} from './use-usage-read';
import {UsageRange} from './usage-range';
import {CacheBadge,UsageTtftCell,type OpenTtft} from './usage-metrics';
import './usage.css';
type SortKey=keyof ProviderUsageRow;
type SortDir='asc'|'desc';
function formatMaybeNumber(value:number|null|undefined,digits=0){return value==null?'':value.toFixed(digits);}
export default function ProviderUsagePage(){
 const t=useTranslations('analytics.providerUsage'),common=useTranslations('common'),token=useTranslations('analytics.tokenDisplay'),timezone=useBusinessTimezone();
 const [range,setRange]=useState(()=>createRangeValue(DEFAULT_GATEWAY_TIME_RANGE_PRESET,timezone)),[mode,setMode]=useState<TokenDisplayMode>('compact');
 const [sortKey,setSortKey]=useState<SortKey>('provider_name'),[sortDir,setSortDir]=useState<SortDir>('asc');
 const onSort=(key:SortKey)=>{if(sortKey===key)setSortDir(value=>value==='asc'?'desc':'asc');else{setSortKey(key);setSortDir('desc');}};
 const path='/api/admin/analytics/providers?'+new URLSearchParams({start_date:range.start_date,end_date:range.end_date}),read=useUsageRead(path,parseProviders),currency=useUsageRead('/api/admin/config',parseCurrency);
 return <div className="p-8 provider-usage-page">
  <PageHeader title={t('title')} description={t('subtitle')} actions={<ControlButton disabled={read.loading||currency.loading} onClick={()=>{read.refresh();currency.refresh();}}>{common('reload')}</ControlButton>}/>
  <div className="provider-usage-filters"><UsageRange value={range} onChange={setRange}/><div className="provider-usage-token-mode" role="group" aria-label={token('label')}><span className="xui-label">{token('label')}</span>{(['compact','numeric'] as const).map(value=><ControlButton key={value} variant={mode===value?'secondary':'ghost'} aria-pressed={mode===value} onClick={()=>setMode(value)}>{token(value)}</ControlButton>)}</div></div>
  {currency.failure?<ShellError title={t('feedback.currencyFailed')} failure={currency.failure} action={<ControlButton onClick={currency.refresh}>{common('reload')}</ControlButton>}/>:currency.loading?<p role="status">{t('feedback.currencyPending')}</p>:null}
  {read.failure?<ShellError title={t('feedback.readFailed')} failure={read.failure} action={<ControlButton onClick={read.refresh}>{common('reload')}</ControlButton>}/>:read.loading?<Spinner label={common('loading')}/>:null}
  {read.settledValue?<div hidden={read.loading||!!read.failure}><ProviderTable scope={read.scope} rows={read.settledValue} committedQuery={range} tokenDisplayMode={mode} billingCurrency={currency.loading?null:currency.settledValue} pending={read.loading} sortKey={sortKey} sortDir={sortDir} toggleSort={onSort}/></div>:null}
 </div>;
}
function SortHeader({label,columnKey,sortKey,sortDir,onSort}:{label:string;columnKey:SortKey;sortKey:SortKey;sortDir:SortDir;onSort:(key:SortKey)=>void}){
 return <TableHeader aria-sort={sortKey===columnKey?(sortDir==='asc'?'ascending':'descending'):undefined}><ControlButton variant="ghost" onClick={()=>onSort(columnKey)}>{label} {sortKey===columnKey?(sortDir==='asc'?'↑':'↓'):null}</ControlButton></TableHeader>;
}
function ProviderTable({scope,rows,committedQuery,tokenDisplayMode,billingCurrency,pending,sortKey,sortDir,toggleSort}:{scope:string;rows:ProviderUsageRow[];committedQuery:GatewayTimeRangeValue;tokenDisplayMode:TokenDisplayMode;billingCurrency:string|null;pending:boolean;sortKey:SortKey;sortDir:SortDir;toggleSort:(key:SortKey)=>void}){
 const t=useTranslations('analytics.providerUsage'),tA=useTranslations('analytics'),tCommon=useTranslations('common');
 const [expanded,setExpanded]=useState<{scope:string;id:string}|null>(null),[detail,setDetail]=useState<{scope:string;open:boolean;metrics:AnalyticsTtftMetrics;anchor:HTMLElement;subject:string}|null>(null);
 const openDetail:OpenTtft=useCallback((metrics,anchor,subject)=>setDetail({scope,open:true,metrics,anchor,subject}),[scope]);
 const toggleProviderModels=useCallback((id:string)=>setExpanded(value=>value?.scope===scope&&value.id===id?null:{scope,id}),[scope]);
 const sorted=useMemo(()=>[...rows].sort((a,b)=>compareAnalyticsTableRows(a,b,sortKey,sortDir)),[rows,sortKey,sortDir]),rangeTotals=useMemo(()=>sumAnalyticsCosts(rows),[rows]);
 const money=(value:number,digits:number)=>billingCurrency===null?tCommon('noData'):formatGatewayMoneyCode(value,billingCurrency,digits);
  const exportCsv = () => {
    const { start_date, end_date } = committedQuery;
    const headers = [
      'provider_id',
      'provider_name',
      'request_count',
      'input_tokens',
      'output_tokens',
      'cache_read_tokens',
      'cache_write_tokens',
      'cache_hit_rate',
      'standard_cost',
      'charged_cost',
      'metered_cost',
      'success_count',
      'error_count',
      'success_rate',
      'avg_latency_ms',
      'avg_first_reasoning_token_ms',
      'avg_first_token_ms',
      'avg_effective_ttft_ms',
      'avg_reasoning_phase_ms',
      'reasoning_ttft_rate',
      'content_ttft_rate',
      'avg_upstream_response_ms',
      'tokens_per_second',
      'failover_rate',
      'avg_attempts',
      'avg_charged_per_request',
      'range_start_utc',
      'range_end_utc',
    ];
    const dataRows: string[][] = sorted.map((r) => [
      r.provider_id,
      r.provider_name ?? '',
      String(r.request_count),
      String(r.input_tokens),
      String(r.output_tokens),
      String(r.cache_read_tokens),
      String(r.cache_write_tokens),
      String(r.cache_hit_rate),
      String(r.standard_cost ?? 0),
      String(r.charged_cost),
      String(r.metered_cost),
      String(r.success_count),
      String(r.error_count),
      String(r.success_rate),
      r.avg_latency_ms != null ? String(r.avg_latency_ms) : '',
      formatMaybeNumber(r.avg_first_reasoning_token_ms),
      formatMaybeNumber(r.avg_first_token_ms),
      formatMaybeNumber(r.avg_effective_ttft_ms),
      formatMaybeNumber(r.avg_reasoning_phase_ms),
      formatMaybeNumber(r.reasoning_ttft_rate, 1),
      formatMaybeNumber(r.content_ttft_rate, 1),
      formatMaybeNumber(r.avg_upstream_response_ms),
      formatMaybeNumber(r.tokens_per_second, 2),
      String(r.failover_rate),
      formatMaybeNumber(r.avg_attempts, 2),
      String(r.avg_charged_per_request),
      start_date,
      end_date,
    ]);
    const csv = csvRowsToString([headers, ...dataRows]);
    downloadCsvFile(`provider-usage-${filenameTimestamp()}.csv`, csv);
  };

 return <>
      <div className="provider-usage-panel">
        <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap justify-between items-center gap-x-4 gap-y-2 text-sm">
          <ControlButton
            type="button"
            onClick={exportCsv}
            disabled={pending||billingCurrency===null}
            variant="secondary"
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {tCommon('exportCsv')}
          </ControlButton>
          {billingCurrency!==null?<AnalyticsRangeCostTotals isLoading={pending} totals={rangeTotals} billingCurrency={billingCurrency}/>:null}
        </div>
        <div className="overflow-x-auto">
          <Table aria-label={t('title')} className="provider-usage-table">
            <TableHead className="bg-gray-50">
              <TableRow>
                <SortHeader sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} label={tA('columns.providerName')} columnKey="provider_name" />
                <SortHeader sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} label={tA('columns.requests')} columnKey="request_count" />
                <SortHeader sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} label={tA('columns.inputTokens')} columnKey="input_tokens" />
                <SortHeader sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} label={tA('columns.outputTokens')} columnKey="output_tokens" />
                <SortHeader sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} label={tA('columns.cacheHitRate')} columnKey="cache_hit_rate" />
                <SortHeader sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} label={tA('columns.standard')} columnKey="standard_cost" />
                <SortHeader sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} label={tA('columns.charged')} columnKey="charged_cost" />
                <SortHeader sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} label={tA('columns.metered')} columnKey="metered_cost" />
                <SortHeader sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} label={tA('columns.avgChargedPerReq')} columnKey="avg_charged_per_request" />
                <SortHeader sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} label={tA('columns.successRate')} columnKey="success_rate" />
                <SortHeader sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} label={tA('columns.avgLatencyMs')} columnKey="avg_latency_ms" />
                <SortHeader sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} label={tA('columns.ttft')} columnKey="avg_effective_ttft_ms" />
                <SortHeader sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} label={tA('columns.avgUpstreamMs')} columnKey="avg_upstream_response_ms" />
                <SortHeader sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} label={tA('columns.tokensPerSecond')} columnKey="tokens_per_second" />
                <SortHeader sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} label={tA('columns.failoverRate')} columnKey="failover_rate" />
                <SortHeader sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} label={tA('columns.avgAttempts')} columnKey="avg_attempts" />
              </TableRow>
            </TableHead>
            <TableBody className="bg-white divide-y divide-gray-200">
              {sorted.map(r=><ProviderRow key={r.provider_id} r={r} isExpanded={expanded?.scope===scope&&expanded.id===r.provider_id} committedQuery={committedQuery} tokenDisplayMode={tokenDisplayMode} billingCurrency={billingCurrency} toggleProviderModels={toggleProviderModels} openDetail={openDetail}/>)}
            </TableBody>
          </Table>
        </div>
        {sorted.length === 0 && <div role="status" className="text-center py-12 text-gray-500">{tA('noData')}</div>}
      </div>
<Dialog open={detail?.scope===scope&&detail.open} onOpenChange={open=>setDetail(value=>value?{...value,open}:null)} title={tA('columns.ttft')} description={detail?.subject} finalFocus={()=>detail?.anchor.isConnected?detail.anchor:false}><p style={{whiteSpace:'pre-line',lineHeight:1.8}}>{detail?buildAnalyticsTtftTooltip(detail.metrics,tA):null}</p></Dialog>
 </>;
}
function ProviderModels({provider,range,mode,currency,onOpen}:{provider:ProviderUsageRow;range:GatewayTimeRangeValue;mode:TokenDisplayMode;currency:string|null;onOpen:OpenTtft}){
 const t=useTranslations('analytics.providerUsage'),tA=useTranslations('analytics'),tCommon=useTranslations('common'),logQuery=new URLSearchParams({start_date:range.start_date,end_date:range.end_date,provider_id:provider.provider_id});
 const read=useUsageRead('/api/admin/analytics/models?'+logQuery,parseModels),money=(value:number,digits:number)=>currency===null?tCommon('noData'):formatGatewayMoneyCode(value,currency,digits);
 if(read.loading)return <Spinner label={tA('loadingModelUsage')}/>;
 if(read.failure)return <ShellError title={t('feedback.modelsFailed')} failure={read.failure} action={<ControlButton onClick={read.refresh}>{tCommon('reload')}</ControlButton>}/>;
 if(read.settledValue===null)throw new Error('Provider model read must settle with data or failure');const modelRows=read.settledValue;
 if(modelRows.length===0)return <p role="status">{tA('noModelUsageForProvider')}</p>;
 return                             <div className="provider-usage-model-panel">
                              <Table aria-label={t('feedback.modelsFor',{provider:provider.provider_name??provider.provider_id})} className="provider-usage-model-table">
                                <TableHead className="bg-gray-50">
                                  <TableRow>
                                    <TableHeader className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{tA('columns.model')}</TableHeader>
                                    <TableHeader className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{tA('columns.routeGroup')}</TableHeader>
                                    <TableHeader className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{tA('columns.requests')}</TableHeader>
                                    <TableHeader className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{tA('columns.inputTokens')}</TableHeader>
                                    <TableHeader className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{tA('columns.outputTokens')}</TableHeader>
                                    <TableHeader className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{tA('columns.cacheHitRate')}</TableHeader>
                                    <TableHeader className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{tA('columns.standard')}</TableHeader>
                                    <TableHeader className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{tA('columns.charged')}</TableHeader>
                                    <TableHeader className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{tA('columns.metered')}</TableHeader>
                                    <TableHeader className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{tA('columns.avgChargedPerReq')}</TableHeader>
                                    <TableHeader className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{tA('columns.successRate')}</TableHeader>
                                    <TableHeader className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{tA('columns.avgLatencyMs')}</TableHeader>
                                    <TableHeader className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{tA('columns.ttft')}</TableHeader>
                                    <TableHeader className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{tA('columns.tokensPerSecond')}</TableHeader>
                                    <TableHeader className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{tA('columns.failoverRate')}</TableHeader>
                                  </TableRow>
                                </TableHead>
                                <TableBody className="divide-y divide-gray-100">
                                  {modelRows.map((modelRow) => {
                                    const modelLogQuery = new URLSearchParams(logQuery);
                                    modelLogQuery.set('model_id', modelRow.model_id);
                                    modelLogQuery.set('route_group', modelRow.route_group);
                                    return (
                                      <TableRow key={JSON.stringify([modelRow.model_id,modelRow.route_group])} className="hover:bg-gray-50">
                                        <TableCell className="px-3 py-2 text-sm">
                                          <Link
                                            href={`/gateway/request-logs?${modelLogQuery.toString()}`}
                                            className="text-blue-600 hover:underline"
                                            onClick={(event) => event.stopPropagation()}
                                          >
                                            {modelRow.model_id}
                                          </Link>
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-sm font-mono text-gray-700">{modelRow.route_group}</TableCell>
                                        <TableCell className="px-3 py-2 text-sm text-gray-900">{modelRow.request_count.toLocaleString()}</TableCell>
                                        <TableCell className="px-3 py-2 text-sm"><AnalyticsTokenCount value={modelRow.input_tokens} mode={mode} /></TableCell>
                                        <TableCell className="px-3 py-2 text-sm"><AnalyticsTokenCount value={modelRow.output_tokens} mode={mode} /></TableCell>
                                        <TableCell className="px-3 py-2 text-sm">
                                          <CacheBadge rate={modelRow.cache_hit_rate}/>
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-sm text-gray-600 tabular-nums">
                                          {money(modelRow.standard_cost ?? 0,4)}
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-sm text-gray-600 tabular-nums">
                                          {money(modelRow.charged_cost,4)}
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-sm text-gray-600 tabular-nums">
                                          {money(modelRow.metered_cost,4)}
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-sm text-gray-600">
                                          {money(modelRow.avg_charged_per_request,6)}
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-sm">
                                          <Badge tone={modelRow.success_rate>=95?'success':modelRow.success_rate>=80?'warning':'danger'}>{modelRow.success_rate.toFixed(1)}%</Badge>
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-sm text-gray-600 tabular-nums">
                                          {modelRow.avg_latency_ms != null ? formatLatencyMs(modelRow.avg_latency_ms) : tCommon('noData')}
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-sm text-gray-600">
                                          <UsageTtftCell metrics={modelRow} noDataLabel={tCommon('noData')} subject={(provider.provider_name??provider.provider_id)+' / '+modelRow.model_id+' / '+modelRow.route_group} onOpen={onOpen}/>
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-sm text-gray-600">
                                          {modelRow.tokens_per_second != null ? modelRow.tokens_per_second.toFixed(1) : tCommon('noData')}
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-sm text-gray-600">
                                          {modelRow.failover_rate.toFixed(1)}%
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>;
}

/** Stable aggregate rows keep timing and token formatting local to the row whose scope changes. */
const ProviderRow=memo(function ProviderRow({r,isExpanded,committedQuery,tokenDisplayMode,billingCurrency,toggleProviderModels,openDetail}:{r:ProviderUsageRow;isExpanded:boolean;committedQuery:GatewayTimeRangeValue;tokenDisplayMode:TokenDisplayMode;billingCurrency:string|null;toggleProviderModels:(id:string)=>void;openDetail:OpenTtft}){
 const tA=useTranslations('analytics'),tCommon=useTranslations('common');
 const money=(value:number,digits:number)=>billingCurrency===null?tCommon('noData'):formatGatewayMoneyCode(value,billingCurrency,digits);
 return                   <Fragment key={r.provider_id}>
                    <TableRow
                      className={`cursor-pointer hover:bg-gray-50 ${isExpanded ? 'provider-usage-row-expanded' : ''}`}
                      onClick={() => void toggleProviderModels(r.provider_id)}
                    >
                      <TableCell className="px-4 py-3 text-sm">
                        <ControlButton
                          type="button"
                          variant="ghost"
                          className="inline-flex items-center gap-2 text-left font-medium text-blue-600 hover:text-blue-800"
                          aria-label={r.provider_name??r.provider_id}
                          aria-expanded={isExpanded}
                          aria-controls={isExpanded?"provider-models-"+encodeURIComponent(r.provider_id):undefined}
                        >
                          <span className="w-4 text-gray-400">{isExpanded ? '▾' : '▸'}</span>
                          <span>{r.provider_name ?? r.provider_id}</span>
                        </ControlButton>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-900">{r.request_count.toLocaleString()}</TableCell>
                      <TableCell className="px-4 py-3 text-sm"><AnalyticsTokenCount value={r.input_tokens} mode={tokenDisplayMode} /></TableCell>
                      <TableCell className="px-4 py-3 text-sm"><AnalyticsTokenCount value={r.output_tokens} mode={tokenDisplayMode} /></TableCell>
                      <TableCell className="px-4 py-3 text-sm">
                        <CacheBadge rate={r.cache_hit_rate}/>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                        {money(r.standard_cost ?? 0,4)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                        {money(r.charged_cost,4)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                        {money(r.metered_cost,4)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600">
                        {money(r.avg_charged_per_request,6)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm">
                        <Badge tone={r.success_rate>=95?'success':r.success_rate>=80?'warning':'danger'}>{r.success_rate.toFixed(1)}%</Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600 tabular-nums">{r.avg_latency_ms != null ? formatLatencyMs(r.avg_latency_ms) : tCommon('noData')}</TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600">
                        <UsageTtftCell metrics={r} noDataLabel={tCommon('noData')} subject={r.provider_name??r.provider_id} onOpen={openDetail}/>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600 tabular-nums">{r.avg_upstream_response_ms != null ? formatLatencyMs(r.avg_upstream_response_ms) : tCommon('noData')}</TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600">{r.tokens_per_second != null ? r.tokens_per_second.toFixed(1) : tCommon('noData')}</TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600">{r.failover_rate.toFixed(1)}%</TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600">{r.avg_attempts != null ? r.avg_attempts.toFixed(2) : tCommon('noData')}</TableCell>
                    </TableRow>
                    {isExpanded ? (
                      <TableRow key={`${r.provider_id}:models`} className="provider-usage-expanded">
                        <TableCell colSpan={16} id={"provider-models-"+encodeURIComponent(r.provider_id)} className="border-l-4 border-blue-300 px-5 py-4">
                          <ProviderModels provider={r} range={committedQuery} mode={tokenDisplayMode} currency={billingCurrency} onOpen={openDetail}/>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>;
});
