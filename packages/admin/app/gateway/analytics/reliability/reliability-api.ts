import { BILLING_CURRENCY_KEY, DEFAULT_BILLING_CURRENCY } from '@octafuse/core/lib/billing-currency';
import { isRecord, parseShellSuccess, ShellRequestError } from '@/lib/shell-request';
import type { GatewayRequestLog, ModelProviderRow, ProviderReliabilityRow } from '@/lib/types';

type ReliabilityError = Pick<GatewayRequestLog, 'id' | 'created_at' | 'model_id' | 'provider_id' | 'provider_name' | 'error_message'>;
export type ReliabilityPayload = {providers: ProviderReliabilityRow[]; modelProviders: ModelProviderRow[]; recentErrors: ReliabilityError[]};
function invalid(): never {throw new ShellRequestError('INVALID_RESPONSE');}
function finite(value: unknown): number {if(typeof value!=='number'||!Number.isFinite(value))invalid();return value;}
function count(value: unknown): number {const result=finite(value);if(!Number.isSafeInteger(result)||result<0)invalid();return result;}
function text(value: unknown): string {if(typeof value!=='string'||value.length===0)invalid();return value;}
function nullableText(value: unknown): string | null {if(value==null)return null;if(typeof value!=='string')invalid();return value;}
function duration(value: unknown): number | null {if(value==null)return null;const result=finite(value);if(result<0)invalid();return result;}
function aggregate(row: unknown) {
  if(!isRecord(row))invalid();
  const success_rate=finite(row.success_rate);
  if(success_rate<0||success_rate>100)invalid();
  const failover_rate=finite(row.failover_rate);if(failover_rate<0)invalid();
  return {provider_id:text(row.provider_id),provider_name:nullableText(row.provider_name),request_count:count(row.request_count),success_rate,
    avg_latency_ms:duration(row.avg_latency_ms),avg_upstream_response_ms:duration(row.avg_upstream_response_ms),avg_attempts:duration(row.avg_attempts),failover_rate,
    charged_cost:finite(row.charged_cost),metered_cost:finite(row.metered_cost),
    // The published analytics contract permits older gateways to omit catalog valuation.
    standard_cost:row.standard_cost===undefined?0:finite(row.standard_cost)};
}
export function parseReliability(body: unknown): ReliabilityPayload {
  parseShellSuccess(body);
  if(!isRecord(body)||!isRecord(body.data)||!Array.isArray(body.data.providers)||!Array.isArray(body.data.modelProviders)||!Array.isArray(body.data.recentErrors))invalid();
  const providers=body.data.providers.map(row=>{
    if(!isRecord(row))invalid();
    const value={...aggregate(row),success_count:count(row.success_count),error_count:count(row.error_count)};
    if(value.success_count+value.error_count>value.request_count)invalid();
    return value;
  });
  const modelProviders=body.data.modelProviders.map(row=>{if(!isRecord(row))invalid();return {...aggregate(row),model_id:text(row.model_id)};});
  const recentErrors=body.data.recentErrors.map(row=>{
    if(!isRecord(row))invalid();const created_at=text(row.created_at);
    if(!Number.isFinite(Date.parse(created_at)))invalid();
    return {id:text(row.id),created_at,model_id:nullableText(row.model_id),provider_id:nullableText(row.provider_id),provider_name:nullableText(row.provider_name),error_message:nullableText(row.error_message)};
  });
  if(new Set(providers.map(row=>row.provider_id)).size!==providers.length||new Set(modelProviders.map(row=>JSON.stringify([row.model_id,row.provider_id]))).size!==modelProviders.length||new Set(recentErrors.map(row=>row.id)).size!==recentErrors.length)invalid();
  return {providers,modelProviders,recentErrors};
}
export function parseReliabilityCurrency(body: unknown): string {
  parseShellSuccess(body);
  if(!isRecord(body)||!Array.isArray(body.data))invalid();
  let currency: string | undefined;
  for(const row of body.data){
    if(!isRecord(row)||typeof row.key!=='string'||typeof row.value!=='string')invalid();
    if(row.key!==BILLING_CURRENCY_KEY)continue;
    if(currency!==undefined)invalid();
    currency=row.value.trim().toUpperCase();if(!/^[A-Z]{3}$/.test(currency))invalid();
  }
  // A successfully read configuration without an entry declares the gateway's USD default.
  return currency??DEFAULT_BILLING_CURRENCY;
}
