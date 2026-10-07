import {BILLING_CURRENCY_KEY,DEFAULT_BILLING_CURRENCY} from '@octafuse/core/lib/billing-currency';
import {isRecord,parseShellSuccess,ShellRequestError} from '@/lib/shell-request';
import type {DashboardStats,DashboardModelDistributionRow,DashboardTopUserRow,DashboardTimeseriesRow,GatewayRequestLog,KpiMetrics} from '@/lib/types';

export type DashboardRecentLog=Pick<GatewayRequestLog,'id'|'model_id'|'provider_id'|'status'|'created_at'|'error_message'>;
export type ConfirmedDashboard={gateway:DashboardStats['gateway'];kpi:Required<KpiMetrics>;modelDistribution:DashboardModelDistributionRow[];topUsers:DashboardTopUserRow[];timeseries:DashboardTimeseriesRow[];granularity:'hour'|'day';recentLogs:DashboardRecentLog[];recentErrors:DashboardRecentLog[]};
function invalid():never{throw new ShellRequestError('INVALID_RESPONSE');}
function record(value:unknown){if(!isRecord(value))invalid();return value;}
function finite(value:unknown){if(typeof value!=='number'||!Number.isFinite(value))invalid();return value;}
function count(value:unknown){const n=finite(value);if(!Number.isSafeInteger(n)||n<0)invalid();return n;}
function rate(value:unknown){const n=finite(value);if(n<0||n>100)invalid();return n;}
function duration(value:unknown){if(value===null)return null;const n=finite(value);if(n<0)invalid();return n;}
function text(value:unknown,empty=false){if(typeof value!=='string'||(!empty&&!value))invalid();return value;}
function nullableText(value:unknown){return value===null?null:text(value,true);}
function rows<T>(value:unknown,parse:(row:Record<string,unknown>)=>T,key:(row:T)=>string){if(!Array.isArray(value))invalid();const parsed=value.map(item=>parse(record(item)));if(new Set(parsed.map(key)).size!==parsed.length)invalid();return parsed;}
function usage(row:Record<string,unknown>){return{request_count:count(row.request_count),input_tokens:count(row.input_tokens),output_tokens:count(row.output_tokens),total_tokens:count(row.total_tokens),charged_cost:finite(row.charged_cost),metered_cost:finite(row.metered_cost),standard_cost:finite(row.standard_cost)};}
function recent(row:Record<string,unknown>):DashboardRecentLog{
 const created_at=text(row.created_at);if(!Number.isFinite(Date.parse(created_at)))invalid();
 const status=text(row.status);if(!['success','error','incomplete','cancelled'].includes(status))invalid();
 return{id:text(row.id),model_id:nullableText(row.model_id),provider_id:nullableText(row.provider_id),status,created_at,error_message:nullableText(row.error_message)};
}
/** The current stats endpoint always supplies the KPI, distribution and timeseries groups. */
export function parseDashboard(body:unknown):ConfirmedDashboard{
 parseShellSuccess(body);const data=record(record(body).data),g=record(data.gateway),k=record(data.kpi),granularity=data.granularity;if(granularity!=='hour'&&granularity!=='day')invalid();
 const gateway={activeKeysCount:count(g.activeKeysCount),keysTotal:count(g.keysTotal),keysActive:count(g.keysActive),accountsTotal:count(g.accountsTotal),accountsActive:count(g.accountsActive),todayRequestsCount:count(g.todayRequestsCount),todayCost:finite(g.todayCost),todayTokens:count(g.todayTokens),errorRate:rate(g.errorRate)};
 if(gateway.keysActive>gateway.keysTotal||gateway.accountsActive>gateway.accountsTotal)invalid();
 const kpi={totalRequests:count(k.totalRequests),successRate:rate(k.successRate),totalCost:finite(k.totalCost),standardCost:finite(k.standardCost),meteredCost:finite(k.meteredCost),activeUsers:count(k.activeUsers),errorRate:rate(k.errorRate),inputTokens:count(k.inputTokens),outputTokens:count(k.outputTokens),cacheReadTokens:count(k.cacheReadTokens),cacheWriteTokens:count(k.cacheWriteTokens),totalTokens:count(k.totalTokens),avgLatencyMs:duration(k.avgLatencyMs),rpm:count(k.rpm),tpm:count(k.tpm)};
 return{gateway,kpi,granularity,modelDistribution:rows(data.modelDistribution,row=>({...usage(row),model_id:text(row.model_id)}),row=>row.model_id),topUsers:rows(data.topUsers,row=>({...usage(row),user_email:text(row.user_email,true)}),row=>row.user_email),
  timeseries:rows(data.timeseries,row=>{const bucket=text(row.bucket);if(!/^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?$/.test(bucket)||!Number.isFinite(Date.parse(bucket.replace(' ','T')+(bucket.length===10?'T00:00:00Z':'Z'))))invalid();return{bucket,request_count:count(row.request_count),input_tokens:count(row.input_tokens),output_tokens:count(row.output_tokens),cache_read_tokens:count(row.cache_read_tokens),cache_write_tokens:count(row.cache_write_tokens),total_tokens:count(row.total_tokens),charged_cost:finite(row.charged_cost),avg_latency_ms:duration(row.avg_latency_ms),cache_hit_rate:rate(row.cache_hit_rate)};},row=>row.bucket),recentLogs:rows(data.recentLogs,recent,row=>row.id),recentErrors:rows(data.recentErrors,recent,row=>row.id)};
}
export function parseDashboardCurrency(body:unknown):string{
 parseShellSuccess(body);const data=record(body).data;if(!Array.isArray(data))invalid();let currency:string|undefined;
 for(const entry of data){const row=record(entry),key=text(row.key),value=text(row.value,true);if(key!==BILLING_CURRENCY_KEY)continue;if(currency!==undefined)invalid();currency=value.trim().toUpperCase();if(!/^[A-Z]{3}$/.test(currency))invalid();}
 // Missing configuration on a successful read uses the gateway's declared billing default.
 return currency??DEFAULT_BILLING_CURRENCY;
}
