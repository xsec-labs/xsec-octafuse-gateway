import {
	isRecord,
	parseShellSuccess,
	ShellRequestError,
} from '@/lib/shell-request';
import type { GatewayUserListItem } from '@/lib/types';
function invalid(): never {
	throw new ShellRequestError('INVALID_RESPONSE');
}
const money = (value: unknown) =>
	typeof value === 'number' && Number.isFinite(value);
export function parseUserList(body: unknown): {
	users: GatewayUserListItem[];
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
	const users = body.data.map((row: unknown) => {
		if (!isRecord(row)) invalid();
		for (const field of [
			'id',
			'status',
			'budget_period',
			'created_at',
			'updated_at',
		])
			if (typeof row[field] !== 'string' || !row[field]) invalid();
		if (typeof row.email !== 'string') invalid();
		for (const field of [
			'external_system',
			'external_user_id',
			'metadata',
			'budget_reset_at',
		])
			if (row[field] !== null && typeof row[field] !== 'string') invalid();
		if (
			!money(row.budget_spent) ||
			!money(row.budget_base) ||
			(row.budget_max !== null && !money(row.budget_max)) ||
			!Number.isSafeInteger(row.active_keys_count) ||
			Number(row.active_keys_count) < 0
		)
			invalid();
		return row as unknown as GatewayUserListItem;
	});
	if (
		users.length > 20 ||
		users.length > Number(body.total) ||
		new Set(users.map((row) => row.id)).size !== users.length
	)
		invalid();
	return { users, total: Number(body.total) };
}
export function parseCreatedUser(body: unknown): string {
	parseShellSuccess(body);
	if (
		!isRecord(body) ||
		!isRecord(body.data) ||
		typeof body.data.id !== 'string' ||
		!body.data.id
	)
		invalid();
	return body.data.id;
}
