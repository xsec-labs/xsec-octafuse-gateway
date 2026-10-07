import { isRecord, parseShellSuccess, ShellRequestError } from '@/lib/shell-request';
import { BILLING_CURRENCY_KEY, DEFAULT_BILLING_CURRENCY } from '@octafuse/core/lib/billing-currency';
import type { GatewayApiKeyBudgetAuditLog } from '@/lib/types';

function invalid(): never { throw new ShellRequestError('INVALID_RESPONSE'); }
export function parseAuditReasons(body: unknown): string[] {
  parseShellSuccess(body);
  if (!isRecord(body) || !isRecord(body.data) || !Array.isArray(body.data.reasonCodes)) invalid();
  const reasons: unknown[] = body.data.reasonCodes;
  if (!reasons.every(value => typeof value === 'string' && value.trim() === value && value.length > 0) || new Set(reasons).size !== reasons.length) invalid();
  return reasons as string[];
}
export function parseAuditCurrency(body: unknown): string {
  parseShellSuccess(body);
  if (!isRecord(body) || !Array.isArray(body.data)) invalid();
  let currency: string | undefined;
  for (const row of body.data) {
    if (!isRecord(row) || typeof row.key !== 'string' || typeof row.value !== 'string') invalid();
    if (row.key !== BILLING_CURRENCY_KEY) continue;
    if (currency !== undefined) invalid();
    currency = row.value.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) invalid();
  }
  // The gateway declares USD when a successfully read configuration has no currency entry.
  return currency ?? DEFAULT_BILLING_CURRENCY;
}
function money(value: unknown): number {
  if (typeof value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) value = Number(value);
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid();
  return value;
}
export function parseAuditLogs(body: unknown, page: number) {
  parseShellSuccess(body);
  if (!isRecord(body) || !Array.isArray(body.data) || !Number.isSafeInteger(body.total) || Number(body.total) < body.data.length || body.data.length > 50 || body.page !== page || body.page_size !== 50) invalid();
  const logs = body.data.map(row => {
    if (!isRecord(row)) invalid();
    for (const key of ['id','event_type','actor_type','created_at']) if (typeof row[key] !== 'string' || !row[key]) invalid();
    if (!Number.isFinite(Date.parse(String(row.created_at)))) invalid();
    for (const key of ['user_id','api_key_id','actor_id','reason_code','reason_text','before_budget_period','after_budget_period','before_budget_reset_at','after_budget_reset_at','request_log_id','change_payload','before_user_snapshot','after_user_snapshot','changed_fields','correlation_id','source','user_email']) {
      if (row[key] != null && typeof row[key] !== 'string') invalid();
    }
    return {...row,
      before_spent: money(row.before_spent), after_spent: money(row.after_spent), delta_spent: money(row.delta_spent),
      before_budget_base: money(row.before_budget_base), after_budget_base: money(row.after_budget_base),
      before_budget_max: row.before_budget_max == null ? null : money(row.before_budget_max),
      after_budget_max: row.after_budget_max == null ? null : money(row.after_budget_max),
    } as unknown as GatewayApiKeyBudgetAuditLog;
  });
  if (new Set(logs.map(row => row.id)).size !== logs.length) invalid();
  return {logs, total: Number(body.total)};
}
