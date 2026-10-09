import { validateAndNormalizeProviderEndpoints } from '@octafuse/core/provider-endpoints';
import { isRecord, ShellRequestError } from '@/lib/shell-request';
import { formDataToEndpointsMap } from './provider-utils';
import type {
	GatewayProvider,
	ProviderFormData,
	ProviderImportCatalogRow,
	ProviderImportResult,
} from './types';

function invalid(): never {
	throw new ShellRequestError('INVALID_RESPONSE');
}
function data(body: unknown): unknown {
	if (!isRecord(body) || body.success !== true) invalid();
	return body.data;
}
function nullableString(value: unknown): value is string | null {
	return value === null || typeof value === 'string';
}
function endpoints(value: unknown): string | null {
	if (!nullableString(value)) invalid();
	if (value !== null) {
		try {
			validateAndNormalizeProviderEndpoints(JSON.parse(value));
		} catch {
			invalid();
		}
	}
	return value;
}
export function parseProviders(body: unknown): GatewayProvider[] {
	const rows = data(body);
	if (!Array.isArray(rows)) invalid();
	const ids = new Set<string>();
	return rows
		.map((row) => {
			if (
				!isRecord(row) ||
				typeof row.id !== 'string' ||
				!row.id ||
				ids.has(row.id) ||
				typeof row.name !== 'string' ||
				!nullableString(row.description) ||
				typeof row.created_at !== 'string' ||
				typeof row.api_key !== 'string' ||
				!['active', 'disabled'].includes(String(row.status)) ||
				typeof row.has_pending_key !== 'boolean' ||
				typeof row.vendor_key !== 'string' ||
				typeof row.icon_key !== 'string'
			)
				invalid();
			ids.add(row.id);
			return {
				id: row.id,
				name: row.name,
				description: row.description,
				created_at: row.created_at,
				api_key: row.api_key,
				status: String(row.status),
				has_pending_key: row.has_pending_key,
				vendor_key: row.vendor_key,
				icon_key: row.icon_key,
				endpoints: endpoints(row.endpoints),
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}
export function parseImportCatalog(body: unknown): ProviderImportCatalogRow[] {
	const rows = data(body);
	if (!Array.isArray(rows)) invalid();
	const ids = new Set<string>();
	return rows.map((row) => {
		if (
			!isRecord(row) ||
			typeof row.id !== 'string' ||
			!row.id ||
			ids.has(row.id) ||
			typeof row.name !== 'string' ||
			typeof row.vendor_key !== 'string' ||
			typeof row.icon_key !== 'string' ||
			typeof row.vendor_label !== 'string' ||
			!nullableString(row.description) ||
			!Array.isArray(row.protocols) ||
			!row.protocols.every((p) => p === 'openai' || p === 'anthropic' || p === 'gemini')
		)
			invalid();
		ids.add(row.id);
		return {
			id: row.id,
			name: row.name,
			vendor_key: row.vendor_key,
			icon_key: row.icon_key,
			vendor_label: row.vendor_label,
			description: row.description,
			endpoints: endpoints(row.endpoints),
			protocols: row.protocols as ProviderImportCatalogRow['protocols'],
		};
	});
}
export function parseImportResult(body: unknown): ProviderImportResult {
	const value = data(body);
	if (
		!isRecord(value) ||
		!Number.isSafeInteger(value.created) ||
		Number(value.created) < 0 ||
		!Array.isArray(value.failed)
	)
		invalid();
	return {
		created: Number(value.created),
		failed: value.failed.map((row) => {
			if (!isRecord(row) || typeof row.id !== 'string' || typeof row.message !== 'string')
				invalid();
			return { id: row.id, message: row.message.slice(0, 300) };
		}),
	};
}
export function parseProviderKey(body: unknown): string {
	const value = data(body);
	if (!isRecord(value) || typeof value.api_key !== 'string' || !value.api_key) invalid();
	return value.api_key;
}
export function providerWrite(
	form: ProviderFormData,
	editingId: string | null,
): { path: string; init: RequestInit } {
	const payload: Record<string, unknown> = {
		name: form.name.trim(),
		description: form.description,
		endpoints: formDataToEndpointsMap(form),
		status: form.status,
	};
	if (form.api_key.trim()) payload.api_key = form.api_key.trim();
	if (!editingId && form.id.trim()) payload.id = form.id.trim();
	return {
		path: editingId
			? '/api/admin/providers/' + encodeURIComponent(editingId)
			: '/api/admin/providers',
		init: {
			method: editingId ? 'PATCH' : 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		},
	};
}
