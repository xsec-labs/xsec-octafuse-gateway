import { isRecord, parseShellSuccess, ShellRequestError } from '@/lib/shell-request';
import { BILLING_CURRENCY_KEY, DEFAULT_BILLING_CURRENCY } from '@octafuse/core/lib/billing-currency';
import type { GatewayRequestLog } from '@/lib/types';

function invalid(): never { throw new ShellRequestError('INVALID_RESPONSE'); }
function list(body: unknown): Record<string, unknown>[] {
  parseShellSuccess(body);
  if (!isRecord(body) || !Array.isArray(body.data) || !body.data.every(isRecord)) invalid();
  return body.data;
}
export function parseModels(body: unknown) {
  const rows = list(body).map(row => {
    if (typeof row.id !== 'string' || !row.id || (row.display_name != null && typeof row.display_name !== 'string')) invalid();
    return { id: row.id, display_name: row.display_name as string | null | undefined };
  });
  if (new Set(rows.map(row => row.id)).size !== rows.length) invalid();
  return rows;
}
export function parseProviders(body: unknown) {
  const rows = list(body).map(row => {
    if (typeof row.id !== 'string' || !row.id || typeof row.name !== 'string') invalid();
    return { id: row.id, name: row.name };
  });
  if (new Set(rows.map(row => row.id)).size !== rows.length) invalid();
  return rows;
}
export function parseRoutes(body: unknown) {
  return list(body).map(row => {
    if (row.route_group !== null && row.route_group !== undefined && typeof row.route_group !== 'string') invalid();
    return { route_group: row.route_group as string | null | undefined };
  });
}
export function parseCurrency(body: unknown): string {
  let currency: string | undefined;
  for (const row of list(body)) {
    if (typeof row.key !== 'string' || typeof row.value !== 'string') invalid();
    if (row.key !== BILLING_CURRENCY_KEY) continue;
    if (currency !== undefined) invalid();
    currency = row.value.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) invalid();
  }
  // A successfully read configuration with no currency entry uses the declared gateway default.
  return currency ?? DEFAULT_BILLING_CURRENCY;
}
function money(value: unknown): number {
  if (typeof value === 'string') {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) invalid();
    value = Number(value);
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid();
  return value;
}
export function parseLogs(body: unknown, page: number) {
  const rows = list(body);
  if (!isRecord(body) || !Number.isSafeInteger(body.total) || Number(body.total) < rows.length || rows.length > 50 || body.page !== page || body.page_size !== 50) invalid();
  const logs = rows.map(row => {
    for (const key of ['id', 'status', 'created_at']) if (typeof row[key] !== 'string' || !row[key]) invalid();
    if (!Number.isFinite(Date.parse(String(row.created_at)))) invalid();
    for (const key of ['api_key_id','user_id','user_email','external_system','model_id','model_name','provider_id','provider_name','provider_model_name','request_protocol','upstream_protocol','request_operation','upstream_operation','route_group','model_surface_id','route_pool_id','route_target_id','provider_key_id','provider_key_label','provider_key_fingerprint','upstream_request_id','upstream_message_id','error_message','request_body','upstream_request_body','raw_usage','pricing_audit','timing_metadata','route_trace','billing_kind']) {
      if (row[key] != null && typeof row[key] !== 'string') invalid();
    }
    for (const key of ['input_tokens','output_tokens','cache_read_tokens','cache_write_tokens']) if (!Number.isSafeInteger(row[key]) || Number(row[key]) < 0) invalid();
    for (const key of ['reasoning_tokens','total_tokens','latency_ms','gateway_overhead_ms','upstream_response_ms','final_upstream_headers_ms','first_reasoning_token_ms','first_token_ms','stream_duration_ms','upstream_attempt_count','upstream_failover_count','input_image_count','output_image_count']) {
      if (row[key] != null && (!Number.isSafeInteger(row[key]) || Number(row[key]) < 0)) invalid();
    }
    if (row.audio_duration_seconds != null && (typeof row.audio_duration_seconds !== 'number' || !Number.isFinite(row.audio_duration_seconds) || row.audio_duration_seconds < 0)) invalid();
    return {...row, standard_cost: row.standard_cost == null ? undefined : money(row.standard_cost), charged_cost: money(row.charged_cost), metered_cost: money(row.metered_cost)} as unknown as GatewayRequestLog;
  });
  if (new Set(logs.map(row => row.id)).size !== logs.length) invalid();
  return { logs, total: Number(body.total) };
}
