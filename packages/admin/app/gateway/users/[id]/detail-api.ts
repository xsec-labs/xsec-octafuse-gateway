import {
	isRecord,
	parseShellSuccess,
	ShellRequestError,
} from '@/lib/shell-request';
import type {
	GatewayApiKeyBudgetAuditLog,
	GatewayRequestLog,
} from '@/lib/types';
import {
	BILLING_CURRENCY_KEY,
	DEFAULT_BILLING_CURRENCY,
} from '@octafuse/core/lib/billing-currency';

export type UserDetail = {
	id: string;
	email: string;
	external_system: string | null;
	external_user_id: string | null;
	budget_max: number | null;
	budget_base: number;
	budget_spent: number;
	budget_period: string;
	budget_reset_at: string | null;
	status: string;
	metadata: unknown;
	created_at: string;
	updated_at: string;
};
export type UserKey = {
	id: string;
	key: string;
	user_id: string;
	name: string | null;
	status: string;
	metadata: string | null;
	last_used_at: string | null;
	created_at: string;
	updated_at: string;
};
export type RecentLog = Pick<
	GatewayRequestLog,
	| 'id'
	| 'created_at'
	| 'model_name'
	| 'model_id'
	| 'provider_name'
	| 'provider_id'
	| 'route_group'
	| 'status'
	| 'standard_cost'
	| 'charged_cost'
	| 'metered_cost'
>;
export type RecentAudit = Pick<
	GatewayApiKeyBudgetAuditLog,
	| 'id'
	| 'created_at'
	| 'event_type'
	| 'actor_type'
	| 'reason_code'
	| 'reason_text'
	| 'source'
	| 'correlation_id'
	| 'request_log_id'
	| 'delta_spent'
	| 'before_budget_max'
	| 'after_budget_max'
	| 'before_user_snapshot'
	| 'after_user_snapshot'
	| 'changed_fields'
>;
function invalid(): never {
	throw new ShellRequestError('INVALID_RESPONSE');
}
function strings(
	row: Record<string, unknown>,
	names: string[],
	nullable = false
) {
	for (const name of names)
		if (
			nullable
				? row[name] !== null && typeof row[name] !== 'string'
				: typeof row[name] !== 'string' || !row[name]
		)
			invalid();
}
function money(value: unknown, nullable = false) {
	if (nullable && value === null) return;
	if (typeof value !== 'number' || !Number.isFinite(value)) invalid();
}
function logMoney(value: unknown): number {
	// PostgreSQL NUMERIC and MySQL DECIMAL arrive as decimal text; D1 uses numbers.
	if (typeof value === 'string') {
		if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) invalid();
		value = Number(value);
	}
	money(value);
	return value as number;
}
function data(body: unknown) {
	parseShellSuccess(body);
	if (!isRecord(body)) invalid();
	return body.data;
}
export function parseDetailCurrency(body: unknown): string {
	const rows = data(body);
	if (!Array.isArray(rows)) invalid();
	let currency: string | undefined;
	for (const row of rows) {
		if (
			!isRecord(row) ||
			typeof row.key !== 'string' ||
			typeof row.value !== 'string'
		)
			invalid();
		if (row.key !== BILLING_CURRENCY_KEY) continue;
		if (currency !== undefined) invalid();
		currency = row.value.trim().toUpperCase();
		if (!/^[A-Z]{3}$/.test(currency)) invalid();
	}
	// A successfully read configuration with no currency row uses the gateway's declared default.
	return currency ?? DEFAULT_BILLING_CURRENCY;
}
export function parseUserDetail(body: unknown): UserDetail {
	const row = data(body);
	if (!isRecord(row)) invalid();
	strings(row, ['id', 'status', 'budget_period', 'created_at', 'updated_at']);
	if (typeof row.email !== 'string' || !Object.hasOwn(row, 'metadata'))
		invalid();
	strings(
		row,
		['external_system', 'external_user_id', 'budget_reset_at'],
		true
	);
	money(row.budget_max, true);
	money(row.budget_base);
	money(row.budget_spent);
	return row as UserDetail;
}
export function parseUserKeys(body: unknown): UserKey[] {
	const rows = data(body);
	if (!Array.isArray(rows)) invalid();
	for (const row of rows) {
		if (!isRecord(row)) invalid();
		strings(row, [
			'id',
			'key',
			'user_id',
			'status',
			'created_at',
			'updated_at',
		]);
		strings(row, ['name', 'metadata', 'last_used_at'], true);
	}
	if (new Set(rows.map((row) => row.id)).size !== rows.length) invalid();
	return rows as UserKey[];
}
function recentRows(body: unknown): Record<string, unknown>[] {
	const rows = data(body);
	if (
		!isRecord(body) ||
		!Array.isArray(rows) ||
		rows.length > 5 ||
		!Number.isSafeInteger(body.total) ||
		Number(body.total) < rows.length ||
		body.page !== 1 ||
		body.page_size !== 5
	)
		invalid();
	for (const row of rows) {
		if (!isRecord(row)) invalid();
		strings(row, ['id', 'created_at']);
	}
	if (new Set(rows.map((row) => row.id)).size !== rows.length) invalid();
	return rows as Record<string, unknown>[];
}
export function parseRecentLogs(body: unknown): RecentLog[] {
	const rows = recentRows(body);
	return rows.map((row) => {
		strings(row, ['status']);
		strings(
			row,
			['model_name', 'model_id', 'provider_name', 'provider_id'],
			true
		);
		if (
			row.route_group !== undefined &&
			row.route_group !== null &&
			typeof row.route_group !== 'string'
		)
			invalid();
		// Standard cost is optional in the existing pre-migration log schema.
		return {
			...row,
			standard_cost:
				row.standard_cost == null ? undefined : logMoney(row.standard_cost),
			charged_cost: logMoney(row.charged_cost),
			metered_cost: logMoney(row.metered_cost),
		} as RecentLog;
	});
}
export function parseRecentAudits(body: unknown): RecentAudit[] {
	const rows = recentRows(body);
	for (const row of rows) {
		strings(row, ['event_type', 'actor_type']);
		for (const name of [
			'reason_code',
			'reason_text',
			'source',
			'correlation_id',
			'request_log_id',
			'before_user_snapshot',
			'after_user_snapshot',
			'changed_fields',
		]) {
			if (
				row[name] !== undefined &&
				row[name] !== null &&
				typeof row[name] !== 'string'
			)
				invalid();
		}
		money(row.delta_spent);
		money(row.before_budget_max, true);
		money(row.after_budget_max, true);
		for (const name of [
			'before_user_snapshot',
			'after_user_snapshot',
			'changed_fields',
		]) {
			const raw = row[name];
			if (raw === undefined || raw === null) continue;
			if (typeof raw !== 'string') invalid();
			let parsed: unknown;
			try {
				parsed = JSON.parse(raw);
			} catch {
				invalid();
			}
			if (name === 'changed_fields') {
				if (
					!Array.isArray(parsed) ||
					!parsed.every(
						(field) => typeof field === 'string' && field.length > 0
					)
				)
					invalid();
			} else if (!isRecord(parsed)) invalid();
		}
	}
	return rows as RecentAudit[];
}
export function parseUserCreatedKey(body: unknown): string {
	const row = data(body);
	if (
		!isRecord(row) ||
		typeof row.key !== 'string' ||
		!row.key.startsWith('sk-') ||
		typeof row.key_id !== 'string' ||
		!row.key_id
	)
		invalid();
	return row.key;
}
