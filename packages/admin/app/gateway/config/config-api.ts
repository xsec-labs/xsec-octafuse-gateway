import { isRecord, parseShellSuccess, ShellRequestError } from '@/lib/shell-request';
import { DEFAULT_ROUTE_STRATEGY, isRouteStrategyName } from '@octafuse/core/db/model-route-policy';
import type { SystemConfigRow } from '@/lib/types';
export const CONFIG_KEYS = { master: 'MASTER_KEY', timezone: 'BUSINESS_TIMEZONE', currency: 'BILLING_CURRENCY', strategy: 'ROUTE_STRATEGY', wecom: 'ALERT_WEBHOOK_WECOM_URL', feishu: 'ALERT_WEBHOOK_FEISHU_URL' } as const;
export type ConfigDraft = {
    master: string;
    timezone: string;
    currency: string;
    strategy: string;
    wecom: string;
    feishu: string;
};
export type ConfigGroup = 'master' | 'timezone' | 'currency' | 'strategy' | 'webhooks' | 'add';
export function validTimezone(value: string): boolean { try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return !!value;
}
catch {
    return false;
} }
export function parseConfig(body: unknown): {
    rows: SystemConfigRow[];
    draft: ConfigDraft;
} {
    parseShellSuccess(body);
    if (!isRecord(body) || !Array.isArray(body.data))
        throw new ShellRequestError('INVALID_RESPONSE');
    const keys = new Set<string>();
    const rows = body.data.map((row: unknown) => {
        if (!isRecord(row) || typeof row.key !== 'string' || !row.key.trim() || keys.has(row.key) || typeof row.value !== 'string' || !(row.description === null || typeof row.description === 'string'))
            throw new ShellRequestError('INVALID_RESPONSE');
        keys.add(row.key);
        return { key: row.key, value: row.value, description: row.description } as SystemConfigRow;
    });
    const value = (key: string) => rows.find(row => row.key === key)?.value ?? '';
    // Empty or absent settings use the gateway's declared defaults after a successful read.
    const timezone = value(CONFIG_KEYS.timezone).trim() || 'UTC', currency = value(CONFIG_KEYS.currency).trim().toUpperCase() || 'USD', strategy = value(CONFIG_KEYS.strategy).trim().toLowerCase() || DEFAULT_ROUTE_STRATEGY;
    if (!validTimezone(timezone) || !['USD', 'CNY'].includes(currency) || !isRouteStrategyName(strategy))
        throw new ShellRequestError('INVALID_RESPONSE');
    return { rows, draft: { master: value(CONFIG_KEYS.master), timezone, currency, strategy, wecom: value(CONFIG_KEYS.wecom), feishu: value(CONFIG_KEYS.feishu) } };
}
export const TOOL_KEYS = new Set(['WEB_SEARCH_PROVIDER', 'WEB_SEARCH_API_KEY', 'WEB_SEARCH_COST', 'WEB_SEARCH_ACTIVE', 'WEB_SEARCH_CATALOG', 'WEB_FETCH_PROVIDER', 'WEB_FETCH_API_KEY', 'WEB_FETCH_COST', 'WEB_FETCH_ACTIVE', 'WEB_FETCH_CATALOG', 'WEB_DEEP_SEARCH_ACTIVE', 'WEB_DEEP_SEARCH_CATALOG', 'AI_DETECTION_ACTIVE', 'AI_DETECTION_CATALOG']);
