'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Badge, ControlButton, PageHeader, Spinner, Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@xsec/ui-react';
import { useBusinessTimezone } from '@/components/BusinessTimezoneProvider';
import ShellError from '@/components/layout/ShellError';
import { createRangeValue, DEFAULT_GATEWAY_TIME_RANGE_PRESET } from '@/lib/analytics-range';
import { formatGatewayMoneyCode } from '@/lib/format-gateway-currency';
import { formatLatencyMs } from '@/lib/format-latency';
import { useGatewayDateTime } from '@/lib/use-gateway-datetime';
import type { ModelProviderRow } from '@/lib/types';
import { parseReliability, parseReliabilityCurrency, type ReliabilityPayload } from './reliability-api';
import { useReliabilityRead } from './use-reliability-read';
import { ReliabilityRange } from './reliability-range';
import './reliability.css';

export default function ReliabilityPage() {
  const t = useTranslations('analytics.reliability'), common = useTranslations('common');
  const timezone = useBusinessTimezone();
  const [rangeValue, setRangeValue] = useState(() => createRangeValue(DEFAULT_GATEWAY_TIME_RANGE_PRESET, timezone));
  const path = '/api/admin/analytics/reliability?' + new URLSearchParams({start_date: rangeValue.start_date, end_date: rangeValue.end_date});
  const read = useReliabilityRead(path, parseReliability);
  const currency = useReliabilityRead('/api/admin/config', parseReliabilityCurrency);
  return <div className="p-8 reliability-page">
    <PageHeader title={t('title')} description={t('subtitle')} actions={<ControlButton disabled={read.loading || currency.loading} onClick={() => {read.refresh(); currency.refresh();}}>{common('reload')}</ControlButton>} />
    <div className="reliability-filters"><ReliabilityRange value={rangeValue} onChange={setRangeValue} /></div>
    {currency.failure ? <ShellError title={t('feedback.currencyFailed')} failure={currency.failure} action={<ControlButton onClick={currency.refresh}>{common('reload')}</ControlButton>} /> : currency.loading ? <p role="status" className="reliability-scope-note">{t('feedback.currencyPending')}</p> : null}
    {read.failure ? <ShellError title={t('feedback.readFailed')} failure={read.failure} action={<ControlButton onClick={read.refresh}>{common('reload')}</ControlButton>} /> : read.loading ? <Spinner label={common('loading')} /> : null}
    {read.settledValue ? <div hidden={read.loading || !!read.failure}><ReliabilityTables data={read.settledValue} billingCurrency={currency.loading ? null : currency.settledValue} /></div> : null}
  </div>;
}

function ReliabilityTables({data, billingCurrency}: {data: ReliabilityPayload; billingCurrency: string | null}) {
  const t = useTranslations('analytics.reliability'), tA = useTranslations('analytics'), tCommon = useTranslations('common');
  const {formatDateTime} = useGatewayDateTime();
  const {providers, modelProviders, recentErrors} = data;
  const byModel = useMemo(() => {
    const map = new Map<string, ModelProviderRow[]>();
    for (const row of modelProviders) {
      const group = map.get(row.model_id);
      if (group) group.push(row); else map.set(row.model_id, [row]);
    }
    return map;
  }, [modelProviders]);
  const formatDate = (value: string) => formatDateTime(value);
  const money = (value: number, digits: number) => billingCurrency === null ? tCommon('noData') : formatGatewayMoneyCode(value, billingCurrency, digits);
  return <>
      {/* Provider table */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('providerQuality')}</h2>
        <div className="reliability-panel">
          <div className="reliability-table-region">
            <Table aria-label={t('providerQuality')} className="reliability-table">
              <TableHead className="bg-gray-50">
                <TableRow>
                  <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tA('columns.provider')}</TableHeader>
                  <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tA('columns.requests')}</TableHeader>
                  <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tA('columns.successRate')}</TableHeader>
                  <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tA('columns.errors')}</TableHeader>
                  <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tA('columns.avgLatencyMs')}</TableHeader>
                  <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tA('columns.avgUpstreamMs')}</TableHeader>
                  <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tA('columns.failoverRate')}</TableHeader>
                  <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tA('columns.avgAttempts')}</TableHeader>
                  <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tA('columns.standard')}</TableHeader>
                  <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tA('columns.charged')}</TableHeader>
                  <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tA('columns.metered')}</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody className="bg-white divide-y divide-gray-200">
                {providers.map((p) => (
                  <TableRow key={p.provider_id} className="hover:bg-gray-50">
                    <TableCell className="px-4 py-3 text-sm font-medium text-gray-900">{p.provider_name ?? p.provider_id}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-600">{p.request_count.toLocaleString()}</TableCell>
                    <TableCell className="px-4 py-3 text-sm">
                      <Badge tone={p.success_rate >= 95 ? 'success' : p.success_rate >= 80 ? 'warning' : 'danger'}>
                        {p.success_rate.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-600">{p.error_count}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-600 tabular-nums">{p.avg_latency_ms != null ? formatLatencyMs(p.avg_latency_ms) : tCommon('noData')}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-600 tabular-nums">{p.avg_upstream_response_ms != null ? formatLatencyMs(p.avg_upstream_response_ms) : tCommon('noData')}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-600">{p.failover_rate.toFixed(1)}%</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-600">{p.avg_attempts != null ? p.avg_attempts.toFixed(2) : tCommon('noData')}</TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                      {money(p.standard_cost ?? 0, 4)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                      {money(p.charged_cost, 4)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                      {money(p.metered_cost, 4)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {providers.length === 0 && <div className="text-center py-8 text-gray-500">{tA('noData')}</div>}
        </div>
      </div>

      {/* Model–provider breakdown */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('perModelComparison')}</h2>
        <div className="reliability-panel">
          <div className="reliability-table-region">
            <Table aria-label={t('perModelComparison')} className="reliability-table">
              <TableHead className="bg-gray-50">
                <TableRow>
                  <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tA('columns.model')}</TableHeader>
                  <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tA('columns.provider')}</TableHeader>
                  <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tA('columns.requests')}</TableHeader>
                  <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tA('columns.successRate')}</TableHeader>
                  <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tA('columns.avgLatencyMs')}</TableHeader>
                  <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tA('columns.avgUpstreamMs')}</TableHeader>
                  <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tA('columns.failoverRate')}</TableHeader>
                  <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tA('columns.avgAttempts')}</TableHeader>
                  <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tA('columns.standard')}</TableHeader>
                  <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tA('columns.charged')}</TableHeader>
                  <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tA('columns.metered')}</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody className="bg-white divide-y divide-gray-200">
                {[...byModel].map(([modelId, list]) =>
                  list.map((r) => (
                    <TableRow key={JSON.stringify([r.model_id, r.provider_id])} className="hover:bg-gray-50">
                      <TableCell className="px-4 py-3 text-sm font-medium text-gray-900">{modelId}</TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600">{r.provider_name ?? r.provider_id}</TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600">{r.request_count.toLocaleString()}</TableCell>
                      <TableCell className="px-4 py-3 text-sm">
                        <Badge tone={r.success_rate >= 95 ? 'success' : r.success_rate >= 80 ? 'warning' : 'danger'}>
                          {r.success_rate.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600 tabular-nums">{r.avg_latency_ms != null ? formatLatencyMs(r.avg_latency_ms) : tCommon('noData')}</TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600 tabular-nums">{r.avg_upstream_response_ms != null ? formatLatencyMs(r.avg_upstream_response_ms) : tCommon('noData')}</TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600">{r.failover_rate.toFixed(1)}%</TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600">{r.avg_attempts != null ? r.avg_attempts.toFixed(2) : tCommon('noData')}</TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                        {money(r.standard_cost ?? 0, 4)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                        {money(r.charged_cost, 4)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                        {money(r.metered_cost, 4)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {modelProviders.length === 0 && <div className="text-center py-8 text-gray-500">{tA('noData')}</div>}
        </div>
      </div>

      <p className="reliability-scope-note">{t('feedback.recentErrorsScope')}</p>
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
          {t('recentErrors')}
          <Link href="/gateway/request-logs?status=error" className="reliability-drilldown">{t('viewAllErrors')}</Link>
        </h2>
        <div className="reliability-panel">
          <div className="reliability-table-region">
            <Table aria-label={t('recentErrors')} className="reliability-table">
              <TableHead className="bg-gray-50">
                <TableRow>
                  <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tCommon('time')}</TableHeader>
                  <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tA('columns.modelProvider')}</TableHeader>
                  <TableHeader className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{tA('columns.errors')}</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody className="bg-white divide-y divide-gray-200">
                {recentErrors.map((log) => (
                  <TableRow key={log.id} className="hover:bg-gray-50">
                    <TableCell className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(log.created_at)}</TableCell>
                    <TableCell className="px-4 py-3 text-sm">
                      <div className="text-gray-900">{log.model_id ?? '—'}</div>
                      <div className="text-xs text-gray-500">{log.provider_name ?? log.provider_id ?? '—'}</div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-red-600 reliability-error-text" title={log.error_message ?? ''}>
                      {log.error_message || tCommon('unknownError')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {recentErrors.length === 0 && <div className="text-center py-8 text-gray-500">{tCommon('noRecentErrors')}</div>}
        </div>
      </div>


  </>;
}
