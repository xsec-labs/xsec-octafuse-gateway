'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useTranslations} from 'next-intl';
import {Badge,ControlButton,PageHeader,Spinner} from '@xsec/ui-react';
import {DashboardModelDistributionChart} from '@/components/dashboard/DashboardModelDistributionChart';
import {DashboardTokenTrendChart} from '@/components/dashboard/DashboardTokenTrendChart';
import ShellError from '@/components/layout/ShellError';
import {createRangeValue,DEFAULT_GATEWAY_TIME_RANGE_PRESET,formatGatewayRangeSummary,isRollingPreset,type GatewayTimeRangeValue} from '@/lib/analytics-range';
import {formatCompactTokens} from '@/lib/format-compact-tokens';
import {formatGatewayMoneyCode} from '@/lib/format-gateway-currency';
import {useGatewayDateTime} from '@/lib/use-gateway-datetime';
import {parseDashboard,parseDashboardCurrency,type ConfirmedDashboard} from './dashboard-api';
import {useDashboardRead} from './use-dashboard-read';
import {DashboardRange} from './dashboard-range';
import './dashboard.css';

function formatLatency(ms:number|null):string{if(ms===null)return '—';return ms>=1000?`${(ms/1000).toFixed(2)}s`:`${Math.round(ms)}ms`;}
export default function DashboardPage(){
 const t=useTranslations('dashboard'),brand=useTranslations('brand'),common=useTranslations('common'),{businessTimezone}=useGatewayDateTime();
 const [range,setRange]=useState(()=>createRangeValue(DEFAULT_GATEWAY_TIME_RANGE_PRESET,businessTimezone));
 const params=new URLSearchParams({start_date:range.start_date,end_date:range.end_date});if(isRollingPreset(range.preset))params.set('range',range.preset);
 const read=useDashboardRead('/api/admin/stats?'+params,parseDashboard),currency=useDashboardRead('/api/admin/config',parseDashboardCurrency);
 return <div className="p-8 dashboard-page">
  <PageHeader title={t('title')} description={t('subtitle',{product:brand('product')})} actions={<ControlButton disabled={read.loading||currency.loading} onClick={()=>{read.refresh();currency.refresh();}}>{t('refresh')}</ControlButton>}/>
  <DashboardRange value={range} onChange={setRange}/>
  {currency.failure?<ShellError title={t('feedback.currencyFailed')} failure={currency.failure} action={<ControlButton onClick={currency.refresh}>{common('reload')}</ControlButton>}/>:currency.loading?<p role="status">{t('feedback.currencyPending')}</p>:null}
  {read.failure?<ShellError title={t('feedback.readFailed')} failure={read.failure} action={<ControlButton onClick={read.refresh}>{common('reload')}</ControlButton>}/>:read.loading?<Spinner label={common('loading')}/>:null}
  {read.value?<div hidden={read.loading||!!read.failure} className="dashboard-results"><DashboardContent stats={read.value} range={range} billingCurrency={currency.loading?null:currency.value}/></div>:null}
 </div>;
}
function DashboardContent({stats,range,billingCurrency}:{stats:ConfirmedDashboard;range:GatewayTimeRangeValue;billingCurrency:string|null}){
 const t=useTranslations('dashboard'),tCommon=useTranslations('common'),tPricing=useTranslations('pricing'),tTimeRange=useTranslations('timeRange'),{businessTimezone,formatTime}=useGatewayDateTime();
 const rangeLabel=formatGatewayRangeSummary(range,preset=>t(`rangeLabels.${preset}`),tTimeRange('custom'),businessTimezone),kpi=stats.kpi,gateway=stats.gateway;
 const money=(amount:number,digits:number)=>billingCurrency===null?tCommon('noData'):formatGatewayMoneyCode(amount,billingCurrency,digits);
 return <>
			<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
				<div className="dashboard-panel p-5">
					<div className="text-sm text-gray-500 mb-1">{t('apiKeys')}</div>
					<div className="text-2xl font-bold text-gray-900">{gateway.keysTotal}</div>
					<div className="text-xs text-gray-500 mt-1">{t('enabledCount', { count: gateway.keysActive })}</div>
					<Link href="/gateway/keys" className="text-sm text-blue-600 hover:underline mt-2 inline-block">{t('keysLink')}</Link>
				</div>
				<div className="dashboard-panel p-5">
					<div className="text-sm text-gray-500 mb-1">{t('accounts')}</div>
					<div className="text-2xl font-bold text-gray-900">{gateway.accountsTotal}</div>
					<div className="text-xs text-gray-500 mt-1">{t('enabledCount', { count: gateway.accountsActive })}</div>
					<Link href="/gateway/users" className="text-sm text-blue-600 hover:underline mt-2 inline-block">{t('usersLink')}</Link>
				</div>
				<div className="dashboard-panel p-5">
					<div className="text-sm text-gray-500 mb-1">{t('todayRequests')}</div>
					<div className="text-2xl font-bold text-gray-900">{gateway.todayRequestsCount.toLocaleString()}</div>
					<div className="text-xs text-gray-500 mt-1">
						{tPricing('cost', { amount: money(gateway.todayCost, 4) })}
					</div>
				</div>
				<div className="dashboard-panel p-5">
					<div className="text-sm text-gray-500 mb-1">{t('activeUsersRange', { range: rangeLabel })}</div>
					<div className="text-2xl font-bold text-gray-900">{kpi.activeUsers}</div>
					<div className="text-xs text-gray-500 mt-1">{t('accountsTotalHint', { count: gateway.accountsTotal })}</div>
				</div>
				<div className="dashboard-panel p-5">
					<div className="text-sm text-gray-500 mb-1">{t('todayTokens')}</div>
					<div className="text-2xl font-bold text-gray-900">{formatCompactTokens(gateway.todayTokens)}</div>
					<div className="text-xs text-gray-500 mt-1">
						{t('rangeTokens', { range: rangeLabel, count: formatCompactTokens(kpi.totalTokens) })}
					</div>
				</div>
				<div className="dashboard-panel p-5">
					<div className="text-sm text-gray-500 mb-1">{t('rangeCost', { range: rangeLabel })}</div>
					<div className="text-xl font-bold text-gray-900">
						{money(kpi.totalCost, 4)}
					</div>
					<div className="text-xs text-gray-500 mt-1">
						{tPricing('stdMetered', {
							std: money(kpi.standardCost, 4),
							metered: money(kpi.meteredCost, 4),
						})}
					</div>
				</div>
				<div className="dashboard-panel p-5">
					<div className="text-sm text-gray-500 mb-1">{t('throughput')}</div>
					<div className="text-2xl font-bold text-gray-900">{kpi.rpm.toLocaleString()} RPM</div>
					<div className="text-xs text-gray-500 mt-1">{t('tpmValue', { count: formatCompactTokens(kpi.tpm) })}</div>
				</div>
				<div className="dashboard-panel p-5">
					<div className="text-sm text-gray-500 mb-1">{t('avgLatencyRange', { range: rangeLabel })}</div>
					<div className="text-2xl font-bold text-gray-900">{formatLatency(kpi.avgLatencyMs)}</div>
					<div className="text-xs text-gray-500 mt-1">
						{t('successRateValue', { rate: (kpi.successRate).toFixed(1) })}
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
				<DashboardModelDistributionChart
					modelDistribution={stats.modelDistribution}
					topUsers={stats.topUsers}
					billingCurrency={billingCurrency}
				/>
				<DashboardTokenTrendChart
					timeseries={stats.timeseries}
					granularity={stats.granularity}
				/>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
				<div className="dashboard-panel p-6">
					<div className="flex items-center justify-between">
						<div>
							<div className="text-sm text-gray-500 mb-1">{t('errorRateRange', { range: rangeLabel })}</div>
							<div className={`text-2xl font-bold ${(kpi.errorRate) > 5 ? 'text-red-600' : 'text-green-600'}`}>
								{kpi.errorRate.toFixed(2)}%
							</div>
						</div>
						<Link href="/gateway/request-logs?status=error" className="text-sm text-blue-600 hover:underline">{t('viewErrorLogs')}</Link>
					</div>
					<div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
						<Link href="/gateway/analytics/providers" className="text-sm text-blue-600 hover:underline">{t('providerUsageLink')}</Link>
						<Link href="/gateway/analytics/reliability" className="text-sm text-blue-600 hover:underline">{t('reliabilityLink')}</Link>
					</div>
				</div>
				<div className="dashboard-panel p-6">
					<div className="text-sm text-gray-500 mb-1">{t('requestsRange', { range: rangeLabel })}</div>
					<div className="text-2xl font-bold text-gray-900">{kpi.totalRequests.toLocaleString()}</div>
					<Link href="/gateway/analytics/models" className="text-sm text-blue-600 hover:underline mt-2 inline-block">{t('modelUsageLink')}</Link>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<div className="dashboard-panel p-6">
					<h2 className="text-lg font-semibold text-gray-900 mb-4">{t('recentRequests')}</h2>
					{stats.recentLogs && stats.recentLogs.length > 0 ? (
						<div className="space-y-3">
							{stats.recentLogs.map((log) => (
								<div key={log.id} className="flex items-center justify-between text-sm border-b pb-2">
									<div>
										<div>
											<span className="font-medium text-gray-900">{log.model_id || tCommon('unknown')}</span>
											<Badge className="ml-2" tone={log.status==='success'?'success':log.status==='error'?'danger':log.status==='incomplete'?'warning':'neutral'}>{log.status}</Badge>
										</div>
										{log.provider_id && <div className="text-xs text-gray-500 mt-0.5">{tPricing('providerLabel', { id: log.provider_id })}</div>}
									</div>
									<div className="text-gray-500">
										{formatTime(log.created_at)}
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="text-gray-500 text-sm">{tCommon('noRecentRequests')}</div>
					)}
					<Link href="/gateway/request-logs" className="text-sm text-blue-600 hover:underline mt-4 inline-block">{tCommon('viewAll')}</Link>
				</div>

				<div className="dashboard-panel p-6">
					<h2 className="text-lg font-semibold text-gray-900 mb-4">{t('recentErrors')}</h2>
					{stats.recentErrors && stats.recentErrors.length > 0 ? (
						<div className="space-y-3">
							{stats.recentErrors.map((log) => (
								<div key={log.id} className="flex items-center justify-between text-sm border-b pb-2">
									<div className="min-w-0 flex-1">
										<div>
											<span className="font-medium text-gray-900">{log.model_id || tCommon('unknown')}</span>
											<span className="ml-2 text-red-600 text-xs break-words">{log.error_message || tCommon('unknownError')}</span>
										</div>
										{log.provider_id && <div className="text-xs text-gray-500 mt-0.5">{tPricing('providerLabel', { id: log.provider_id })}</div>}
									</div>
									<div className="text-gray-500 ml-2">
										{formatTime(log.created_at)}
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="text-gray-500 text-sm">{tCommon('noRecentErrors')}</div>
					)}
				</div>
			</div>
 </>;
}
