import { BILLING_CURRENCY_KEY, DEFAULT_BILLING_CURRENCY } from '@octafuse/core/lib/billing-currency';
import { isRecord, parseShellSuccess, ShellRequestError } from '@/lib/shell-request';
import type { ModelUsageRow, ProviderUsageRow } from '@/lib/types';

function invalid(): never {throw new ShellRequestError('INVALID_RESPONSE');}
function finite(value: unknown): number {if(typeof value!=='number'||!Number.isFinite(value))invalid();return value;}
function count(value: unknown): number {const result=finite(value);if(!Number.isSafeInteger(result)||result<0)invalid();return result;}
function text(value: unknown, allowEmpty=false): string {if(typeof value!=='string'||(!allowEmpty&&value.length===0))invalid();return value;}
function duration(value: unknown): number|null {if(value===null)return null;const result=finite(value);if(result<0)invalid();return result;}
function rate(value: unknown): number {const result=finite(value);if(result<0||result>100)invalid();return result;}
function aggregate(row: Record<string,unknown>) {
 const request_count=count(row.request_count),success_count=count(row.success_count),error_count=count(row.error_count);
 if(success_count+error_count>request_count)invalid();
 const failover_rate=finite(row.failover_rate);if(failover_rate<0)invalid();
 return {request_count,success_count,error_count,input_tokens:count(row.input_tokens),output_tokens:count(row.output_tokens),cache_read_tokens:count(row.cache_read_tokens),cache_write_tokens:count(row.cache_write_tokens),cache_hit_rate:rate(row.cache_hit_rate),success_rate:rate(row.success_rate),
  // Catalog valuation is optional in the published analytics response contract.
  standard_cost:row.standard_cost===undefined?0:finite(row.standard_cost),charged_cost:finite(row.charged_cost),metered_cost:finite(row.metered_cost),avg_charged_per_request:finite(row.avg_charged_per_request),
  avg_latency_ms:duration(row.avg_latency_ms),avg_first_reasoning_token_ms:duration(row.avg_first_reasoning_token_ms),avg_first_token_ms:duration(row.avg_first_token_ms),avg_effective_ttft_ms:duration(row.avg_effective_ttft_ms),avg_reasoning_phase_ms:duration(row.avg_reasoning_phase_ms),reasoning_ttft_rate:rate(row.reasoning_ttft_rate),content_ttft_rate:rate(row.content_ttft_rate),avg_upstream_response_ms:duration(row.avg_upstream_response_ms),tokens_per_second:duration(row.tokens_per_second),failover_rate,avg_attempts:duration(row.avg_attempts)};
}
function rows(body: unknown): Record<string,unknown>[] {
 parseShellSuccess(body);if(!isRecord(body)||!Array.isArray(body.data))invalid();
 return body.data.map(row=>{if(!isRecord(row))invalid();return row;});
}
export function parseModels(body: unknown): ModelUsageRow[] {
 const result=rows(body).map(row=>({...aggregate(row),model_id:text(row.model_id),route_group:text(row.route_group,true)}));
 if(new Set(result.map(row=>JSON.stringify([row.model_id,row.route_group]))).size!==result.length)invalid();
 return result;
}
export function parseProviders(body: unknown): ProviderUsageRow[] {
 const result=rows(body).map(row=>({...aggregate(row),provider_id:text(row.provider_id),provider_name:row.provider_name===null?null:text(row.provider_name,true),distinct_models:count(row.distinct_models)}));
 if(new Set(result.map(row=>row.provider_id)).size!==result.length)invalid();
 return result;
}
export function parseCurrency(body: unknown): string {
 let currency:string|undefined;
 for(const row of rows(body)) {
  const key=text(row.key),value=text(row.value,true);if(key!==BILLING_CURRENCY_KEY)continue;
  if(currency!==undefined)invalid();currency=value.trim().toUpperCase();if(!/^[A-Z]{3}$/.test(currency))invalid();
 }
 // A successful configuration read with no entry uses the gateway's declared USD default.
 return currency??DEFAULT_BILLING_CURRENCY;
}
