import {
	isRecord,
	parseShellSuccess,
	ShellRequestError,
} from '@/lib/shell-request';
import type { GatewayApiKey } from '@/lib/types';

function invalid(): never {
	throw new ShellRequestError('INVALID_RESPONSE');
}
const nullableString = (value: unknown) =>
	value == null || typeof value === 'string';
const money = (value: unknown) =>
	typeof value === 'number' && Number.isFinite(value);

/** Validate the actual list boundary; metadata may be any JSON stored as text. */
export function parseKeyList(body: unknown): {
	keys: GatewayApiKey[];
	total: number;
} {
	parseShellSuccess(body);
	if (
		!isRecord(body) ||
		!Array.isArray(body.data) ||
		!Number.isSafeInteger(body.total) ||
		Number(body.total) < 0
	)
		invalid();
	const keys = body.data.map((row: unknown) => {
		if (!isRecord(row)) invalid();
		for (const field of [
			'id',
			'key',
			'user_id',
			'status',
			'budget_period',
			'created_at',
			'updated_at',
		]) {
			if (typeof row[field] !== 'string' || !row[field]) invalid();
		}
		for (const field of ['name', 'user_email', 'metadata', 'budget_reset_at'])
			if (!nullableString(row[field])) invalid();
		if (
			!money(row.budget_spent) ||
			(row.budget_max !== null && !money(row.budget_max)) ||
			(row.budget_base !== undefined && !money(row.budget_base))
		)
			invalid();
		return row as unknown as GatewayApiKey;
	});
	if (
		new Set(keys.map((row) => row.id)).size !== keys.length ||
		keys.length > 20 ||
		keys.length > Number(body.total)
	)
		invalid();
	return { keys, total: Number(body.total) };
}

export function parseCreatedKey(body: unknown): string {
	parseShellSuccess(body);
	if (
		!isRecord(body) ||
		!isRecord(body.data) ||
		typeof body.data.key !== 'string' ||
		!body.data.key.startsWith('sk-') ||
		typeof body.data.key_id !== 'string' ||
		!body.data.key_id ||
		typeof body.data.user_id !== 'string' ||
		!body.data.user_id
	)
		invalid();
	return body.data.key;
}
