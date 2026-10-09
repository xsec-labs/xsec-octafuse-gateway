'use client';
import {Fragment, useMemo, useState} from 'react';
import Link from 'next/link';
import {useTranslations} from 'next-intl';
import {Badge, ControlButton, Dialog, PageHeader, Spinner, Table, TableHead, TableBody, TableRow, TableHeader, TableCell} from '@xsec/ui-react';
import {AnalyticsRangeCostTotals} from '@/components/AnalyticsRangeCostTotals';
import {AnalyticsTokenCount} from '@/components/AnalyticsTokenCount';
import {useBusinessTimezone} from '@/components/BusinessTimezoneProvider';
import ShellError from '@/components/layout/ShellError';
import {compareAnalyticsTableRows, createRangeValue, DEFAULT_GATEWAY_TIME_RANGE_PRESET, sumAnalyticsCosts, type GatewayTimeRangeValue} from '@/lib/analytics-range';
import {formatGatewayMoneyCode} from '@/lib/format-gateway-currency';
import {formatLatencyMs} from '@/lib/format-latency';
import type {TokenDisplayMode} from '@/lib/format-token-count';
import type {ModelUsageRow} from '@/lib/types';
import {csvRowsToString, downloadCsvFile, filenameTimestamp} from '@/lib/csv';
import {parseModels, parseProviders, parseCurrency} from './usage-api';
import {useUsageRead} from './use-usage-read';
import {UsageRange} from './usage-range';
import {CacheBadge, UsageTtftCell, type OpenTtft} from './usage-metrics';
import {buildAnalyticsTtftTooltip, type AnalyticsTtftMetrics} from '@/components/AnalyticsTtftCell';
import './usage.css';
type SortKey = keyof ModelUsageRow | '';
type SortDir = 'asc' | 'desc';
function formatMaybeNumber(value: number | null | undefined, digits=0) {return value==null?'':value.toFixed(digits);}
function modelKey(row: Pick<ModelUsageRow,'model_id'|'route_group'>) {return JSON.stringify([row.model_id,row.route_group]);}

export default function ModelUsagePage() {
 const t=useTranslations('analytics.modelUsage'), common=useTranslations('common'), token=useTranslations('analytics.tokenDisplay');
 const timezone=useBusinessTimezone();
 const [range,setRange]=useState(()=>createRangeValue(DEFAULT_GATEWAY_TIME_RANGE_PRESET,timezone));
 const [mode,setMode]=useState<TokenDisplayMode>('compact');
 const path='/api/admin/analytics/models?'+new URLSearchParams({start_date:range.start_date,end_date:range.end_date});
 const read=useUsageRead(path,parseModels), currency=useUsageRead('/api/admin/config',parseCurrency);
 return <div className="p-8 usage-page">
  <PageHeader title={t('title')} description={t('subtitle')} actions={<ControlButton disabled={read.loading||currency.loading} onClick={()=>{read.refresh();currency.refresh();}}>{common('reload')}</ControlButton>} />
  <div className="usage-filters"><UsageRange value={range} onChange={setRange} /><div className="usage-token-mode" role="group" aria-label={token('label')}><span className="xui-label">{token('label')}</span>{(['compact','numeric'] as const).map(value=><ControlButton key={value} variant={mode===value?'secondary':'ghost'} aria-pressed={mode===value} onClick={()=>setMode(value)}>{token(value)}</ControlButton>)}</div></div>
  {currency.failure?<ShellError title={t('feedback.currencyFailed')} failure={currency.failure} action={<ControlButton onClick={currency.refresh}>{common('reload')}</ControlButton>}/>:currency.loading?<p role="status">{t('feedback.currencyPending')}</p>:null}
  {read.failure?<ShellError title={t('feedback.readFailed')} failure={read.failure} action={<ControlButton onClick={read.refresh}>{common('reload')}</ControlButton>}/>:read.loading?<Spinner label={common('loading')}/>:null}
  {read.settledValue?<div hidden={read.loading||!!read.failure}><ModelTable scope={read.scope} rows={read.settledValue} committedQuery={range} tokenDisplayMode={mode} billingCurrency={currency.loading?null:currency.settledValue} pending={read.loading}/></div>:null}
 </div>;
}
function SortHeader({label,columnKey,sortKey,sortDir,onSort}:{label:string;columnKey:SortKey;sortKey:SortKey;sortDir:SortDir;onSort:(key:SortKey)=>void}) {
 return <TableHeader aria-sort={sortKey===columnKey?(sortDir==='asc'?'ascending':'descending'):undefined}><ControlButton variant="ghost" onClick={()=>onSort(columnKey)}>{label} {sortKey===columnKey?(sortDir==='asc'?'↑':'↓'):null}</ControlButton></TableHeader>;
}
function ModelTable({scope,rows,committedQuery,tokenDisplayMode,billingCurrency,pending}:{scope:string;rows:ModelUsageRow[];committedQuery:GatewayTimeRangeValue;tokenDisplayMode:TokenDisplayMode;billingCurrency:string|null;pending:boolean}) {
 const t=useTranslations('analytics.modelUsage'),tA=useTranslations('analytics'),tCommon=useTranslations('common');
 const [sortKey,setSortKey]=useState<SortKey>('model_id'),[sortDir,setSortDir]=useState<SortDir>('asc'),[expanded,setExpanded]=useState<{scope:string;key:string}|null>(null);
 const [detail,setDetail]=useState<{scope:string;open:boolean;metrics:AnalyticsTtftMetrics;anchor:HTMLElement;subject:string}|null>(null);
 const openDetail:OpenTtft=(metrics,anchor,subject)=>setDetail({scope,open:true,metrics,anchor,subject});
 const expandedModelKey=expanded?.scope===scope?expanded.key:null;
 const rangeTotals=useMemo(()=>sumAnalyticsCosts(rows),[rows]);
 const sorted=useMemo(()=>[...rows].sort((a,b)=>compareAnalyticsTableRows(a,b,sortKey,sortDir)),[rows,sortKey,sortDir]);
 const toggleSort=(key:SortKey)=>{if(sortKey===key)setSortDir(value=>value==='asc'?'desc':'asc');else{setSortKey(key);setSortDir('desc');}};
 const money=(value:number,digits:number)=>billingCurrency===null?tCommon('noData'):formatGatewayMoneyCode(value,billingCurrency,digits);
  const exportCsv = () => {
    const { start_date, end_date } = committedQuery;
    const headers = [
      'model_id',
      'route_group',
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
      r.model_id,
      r.route_group,
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
    downloadCsvFile(`model-usage-${filenameTimestamp()}.csv`, csv);
  };

 return <>      <div className="usage-panel">
        <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap justify-between items-center gap-x-4 gap-y-2 text-sm">
          <ControlButton
            type="button"
            onClick={exportCsv}
            disabled={pending || billingCurrency === null}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {tCommon('exportCsv')}
          </ControlButton>
          {billingCurrency !== null ? <AnalyticsRangeCostTotals isLoading={pending} totals={rangeTotals} billingCurrency={billingCurrency} /> : null}
        </div>
        <div className="overflow-x-auto">
          <Table aria-label={t('title')} className="usage-table">
            <TableHead className="bg-gray-50">
              <TableRow>
                <SortHeader sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} label={tA('columns.model')} columnKey="model_id" />
                <SortHeader sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} label={tA('columns.routeGroup')} columnKey="route_group" />
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
              {sorted.map((r) => {
                const key = modelKey(r);
                const isExpanded = expandedModelKey === key;
                return (
                  <Fragment key={key}>
                    <TableRow
                      className={isExpanded ? 'usage-expanded' : ''}
                    >
                      <TableCell className="px-4 py-3 text-sm">
                        <ControlButton
                          type="button"
                          variant="ghost"
                          className="inline-flex items-center gap-2 text-left font-medium text-blue-600 hover:text-blue-800"
                          aria-expanded={isExpanded}
                          aria-controls={isExpanded ? 'providers-'+encodeURIComponent(key) : undefined}
                          onClick={() => setExpanded(isExpanded ? null : {scope,key})}
                        >
                          <span className="w-4 text-gray-400">{isExpanded ? '▾' : '▸'}</span>
                          <span>{r.model_id}</span>
                        </ControlButton>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm font-mono text-gray-700">{r.route_group}</TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-900">{r.request_count.toLocaleString()}</TableCell>
                      <TableCell className="px-4 py-3 text-sm"><AnalyticsTokenCount value={r.input_tokens} mode={tokenDisplayMode} /></TableCell>
                      <TableCell className="px-4 py-3 text-sm"><AnalyticsTokenCount value={r.output_tokens} mode={tokenDisplayMode} /></TableCell>
                      <TableCell className="px-4 py-3 text-sm">
                        <CacheBadge rate={r.cache_hit_rate} />
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                        {money(r.standard_cost ?? 0, 4)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                        {money(r.charged_cost, 4)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                        {money(r.metered_cost, 4)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600">
                        {money(r.avg_charged_per_request, 6)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm">
                        <Badge tone={r.success_rate >= 95 ? 'success' : r.success_rate >= 80 ? 'warning' : 'danger'}>{r.success_rate.toFixed(1)}%</Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600 tabular-nums">{r.avg_latency_ms != null ? formatLatencyMs(r.avg_latency_ms) : tCommon('noData')}</TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600">
                        <UsageTtftCell metrics={r} noDataLabel={tCommon('noData')} subject={r.model_id+' / '+r.route_group} onOpen={openDetail} />
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600 tabular-nums">{r.avg_upstream_response_ms != null ? formatLatencyMs(r.avg_upstream_response_ms) : tCommon('noData')}</TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600">{r.tokens_per_second != null ? r.tokens_per_second.toFixed(1) : tCommon('noData')}</TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600">{r.failover_rate.toFixed(1)}%</TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600">{r.avg_attempts != null ? r.avg_attempts.toFixed(2) : tCommon('noData')}</TableCell>
                    </TableRow>
                    {isExpanded ? <TableRow className="usage-expanded"><TableCell colSpan={17} id={'providers-'+encodeURIComponent(key)}><ProviderBreakdown row={r} range={committedQuery} mode={tokenDisplayMode} currency={billingCurrency} onOpen={openDetail} /></TableCell></TableRow> : null}
                  </Fragment>
              );
              })}
            </TableBody>
          </Table>
        </div>
        {sorted.length === 0 && <div className="text-center py-12 text-gray-500">{tA('noData')}</div>}
      </div>
<Dialog open={detail?.scope===scope&&detail.open} onOpenChange={open=>setDetail(value=>value?{...value,open}:null)} title={tA('columns.ttft')} description={detail?.subject} finalFocus={()=>detail?.anchor.isConnected?detail.anchor:false}><p style={{whiteSpace:'pre-line',lineHeight:1.8}}>{detail?buildAnalyticsTtftTooltip(detail.metrics,tA):null}</p></Dialog>
</>;
}
function ProviderBreakdown({row,range,mode,currency,onOpen}:{onOpen:OpenTtft;row:ModelUsageRow;range:GatewayTimeRangeValue;mode:TokenDisplayMode;currency:string|null}) {
 const t=useTranslations('analytics.modelUsage'),tA=useTranslations('analytics'),tCommon=useTranslations('common');
 const logQuery=new URLSearchParams({start_date:range.start_date,end_date:range.end_date,model_id:row.model_id,route_group:row.route_group});
 const read=useUsageRead('/api/admin/analytics/providers?'+logQuery,parseProviders);
 const money=(value:number,digits:number)=>currency===null?tCommon('noData'):formatGatewayMoneyCode(value,currency,digits);
 if(read.failure)return <ShellError title={t('feedback.providersFailed')} failure={read.failure} action={<ControlButton onClick={read.refresh}>{tCommon('reload')}</ControlButton>}/>;
 if(read.loading)return <Spinner label={tA('loadingProviderUsage')}/>;
 if(!read.settledValue)return null;
 const providerRows=read.settledValue;
 if(providerRows.length===0)return <p role="status">{tA('noProviderUsageForModel')}</p>;
 return (                            <div className="usage-provider-panel">
                              <Table aria-label={t('feedback.providersFor', {model: row.model_id, group: row.route_group})} className="usage-provider-table">
                                <TableHead className="bg-gray-50">
                                  <TableRow>
                                    <TableHeader className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{tA('columns.provider')}</TableHeader>
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
                                  {providerRows.map((providerRow) => {
                                    const providerLogQuery = new URLSearchParams(logQuery);
                                    providerLogQuery.set('provider_id', providerRow.provider_id);
                                    return (
                                      <TableRow key={providerRow.provider_id} className="hover:bg-gray-50">
                                        <TableCell className="px-3 py-2 text-sm">
                                          <Link
                                            href={`/gateway/request-logs?${providerLogQuery.toString()}`}
                                            className="text-blue-600 hover:underline"
                                            onClick={(event) => event.stopPropagation()}
                                          >
                                            {providerRow.provider_name ?? providerRow.provider_id}
                                          </Link>
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-sm text-gray-900">{providerRow.request_count.toLocaleString()}</TableCell>
                                        <TableCell className="px-3 py-2 text-sm"><AnalyticsTokenCount value={providerRow.input_tokens} mode={mode} /></TableCell>
                                        <TableCell className="px-3 py-2 text-sm"><AnalyticsTokenCount value={providerRow.output_tokens} mode={mode} /></TableCell>
                                        <TableCell className="px-3 py-2 text-sm">
                                          <CacheBadge rate={providerRow.cache_hit_rate} />
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-sm text-gray-600 tabular-nums">
                                          {money(providerRow.standard_cost ?? 0, 4)}
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-sm text-gray-600 tabular-nums">
                                          {money(providerRow.charged_cost, 4)}
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-sm text-gray-600 tabular-nums">
                                          {money(providerRow.metered_cost, 4)}
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-sm text-gray-600">
                                          {money(providerRow.avg_charged_per_request, 6)}
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-sm">
                                          <Badge tone={providerRow.success_rate >= 95 ? 'success' : providerRow.success_rate >= 80 ? 'warning' : 'danger'}>{providerRow.success_rate.toFixed(1)}%</Badge>
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-sm text-gray-600 tabular-nums">
                                          {providerRow.avg_latency_ms != null ? formatLatencyMs(providerRow.avg_latency_ms) : tCommon('noData')}
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-sm text-gray-600">
                                          <UsageTtftCell metrics={providerRow} noDataLabel={tCommon('noData')} subject={row.model_id+' / '+(providerRow.provider_name??providerRow.provider_id)} onOpen={onOpen} />
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-sm text-gray-600">
                                          {providerRow.tokens_per_second != null ? providerRow.tokens_per_second.toFixed(1) : tCommon('noData')}
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-sm text-gray-600">
                                          {providerRow.failover_rate.toFixed(1)}%
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>);
}
