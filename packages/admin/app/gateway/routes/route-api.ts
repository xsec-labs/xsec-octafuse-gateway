import { isRecord, parseShellSuccess, ShellRequestError } from '@/lib/shell-request';
import type { GatewayModel } from '@/lib/types';
import {
	isRouteStrategyName,
	normalizeModelRoutePolicyInput,
} from '@octafuse/core/db/model-route-policy';
import { REQUEST_OPERATIONS_BY_PROTOCOL } from '@octafuse/core/route-topology';
import { ROUTE_STRATEGY_KEY } from '@octafuse/core/lib/route-strategy-system-config';
import { coerceRoutePricingScheduleInput } from '@octafuse/core/db/pricing-schedule';
import { parseModels, parseModelCurrency } from '../models/model-api';
import { parseProviders } from '../providers/provider-api';
import { buildRouteSavePayload } from './route-utils';
import type { RouteFormData, RouteListRow, RoutesPageData } from './types';

function invalid(): never {
	throw new ShellRequestError('INVALID_RESPONSE');
}
function jsonObject(raw: unknown): Record<string, unknown> | null {
	if (raw === null || raw === undefined) return null;
	if (typeof raw !== 'string' || !raw.trim()) invalid();
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		invalid();
	}
	if (!isRecord(value)) invalid();
	return value;
}
function operation(protocol: unknown, value: unknown): boolean {
	if (typeof protocol !== 'string' || !Object.hasOwn(REQUEST_OPERATIONS_BY_PROTOCOL, protocol))
		return false;
	return (
		value === '*' ||
		(typeof value === 'string' &&
			(
				REQUEST_OPERATIONS_BY_PROTOCOL[
					protocol as keyof typeof REQUEST_OPERATIONS_BY_PROTOCOL
				] as readonly string[]
			).includes(value))
	);
}
function policy(raw: unknown) {
	if (raw == null) return;
	if (typeof raw !== 'string') invalid();
	try {
		normalizeModelRoutePolicyInput(raw);
	} catch {
		invalid();
	}
}
function pricing(raw: unknown) {
	const value = jsonObject(raw);
	if (!value) return;
	for (const key of ['charged_factor', 'metered_factor', 'provider_factor'])
		if (
			value[key] !== undefined &&
			(typeof value[key] !== 'number' || !Number.isFinite(value[key]) || value[key] < 0)
		)
			invalid();
	if (value.schedule !== undefined) {
		if (!isRecord(value.schedule)) invalid();
		if (!coerceRoutePricingScheduleInput(value.schedule).ok) invalid();
	}
}
export function parseRoutes(body: unknown): RouteListRow[] {
	parseShellSuccess(body);
	const rows = (body as Record<string, unknown>).data;
	if (!Array.isArray(rows)) invalid();
	const ids = new Set<string>();
	return rows.map((row) => {
		if (!isRecord(row)) invalid();
		for (const key of ['id', 'model_id', 'provider_id', 'provider_model_name', 'route_group'])
			if (typeof row[key] !== 'string' || !row[key]) invalid();
		if (
			ids.has(String(row.id)) ||
			!Number.isSafeInteger(row.priority) ||
			(row.weight !== undefined && (!Number.isSafeInteger(row.weight) || Number(row.weight) < 1)) ||
			!['active', 'inactive'].includes(String(row.status)) ||
			!operation(row.upstream_protocol, row.upstream_operation ?? '*')
		)
			invalid();
		ids.add(String(row.id));
		for (const key of [
			'model_name',
			'provider_name',
			'adapter',
			'route_pool_id',
			'pool_name',
			'pool_strategy',
			'pool_status',
		])
			if (row[key] != null && typeof row[key] !== 'string') invalid();
		if (
			row.pool_strategy != null &&
			(typeof row.pool_strategy !== 'string' || !isRouteStrategyName(row.pool_strategy))
		)
			invalid();
		pricing(row.price_override);
		jsonObject(row.custom_params);
		if (row.surfaces != null) {
			if (typeof row.surfaces !== 'string') invalid();
			let surfaces: unknown;
			try {
				surfaces = JSON.parse(row.surfaces);
			} catch {
				invalid();
			}
			if (
				!Array.isArray(surfaces) ||
				!surfaces.every(
					(surface) =>
						isRecord(surface) &&
						typeof surface.id === 'string' &&
						operation(surface.request_protocol, surface.request_operation) &&
						['active', 'disabled'].includes(String(surface.status))
				)
			)
				invalid();
		}
		return row as unknown as RouteListRow;
	});
}
function parseRouteModels(body: unknown): GatewayModel[] {
	return parseModels(body).map((model) => {
		policy(model.route_policy);
		// The model-list API returns tag arrays; the GatewayModel consumer contract stores JSON text.
		return { ...model, tags: JSON.stringify(model.tags) };
	});
}
function parseConfig(body: unknown) {
	const billingCurrency = parseModelCurrency(body);
	const rows = (body as { data: { key: string; value: string }[] }).data;
	const raw = rows
		.find((row) => row.key === ROUTE_STRATEGY_KEY)
		?.value.trim()
		.toLowerCase();
	if (raw !== undefined && !isRouteStrategyName(raw)) invalid();
	return { billingCurrency, globalRouteStrategy: raw ?? null };
}
async function request<T>(
	path: string,
	signal: AbortSignal,
	parse: (body: unknown) => T
): Promise<T> {
	const response = await fetch(path, { signal, cache: 'no-store' });
	let body: unknown;
	try {
		body = await response.json();
	} catch {
		if (signal.aborted) throw signal.reason;
		throw new ShellRequestError('INVALID_RESPONSE', response.status);
	}
	if (!response.ok) {
		const requestId =
			isRecord(body) &&
			isRecord(body.error) &&
			typeof body.error.requestId === 'string' &&
			/^[a-zA-Z0-9-]{1,128}$/.test(body.error.requestId)
				? body.error.requestId
				: undefined;
		throw new ShellRequestError(
			'HTTP_ERROR',
			response.status,
			requestId,
			isRecord(body) && typeof body.message === 'string' ? body.message.slice(0, 300) : undefined
		);
	}
	return parse(body);
}
/** Atomic page read: one deadline includes all four headers and complete JSON bodies. */
export async function fetchRoutesPageData(controller: AbortController): Promise<RoutesPageData> {
	const timer = setTimeout(
		() => controller.abort(new ShellRequestError('REQUEST_TIMEOUT')),
		20_000
	);
	try {
		const [routes, models, providers, config] = await Promise.all([
			request('/api/admin/routes', controller.signal, parseRoutes),
			request('/api/admin/models', controller.signal, parseRouteModels),
			request('/api/admin/providers', controller.signal, parseProviders),
			request('/api/admin/config', controller.signal, parseConfig),
		]);
		if (
			routes.some(
				(row) =>
					!models.some((model) => model.id === row.model_id) ||
					!providers.some((provider) => provider.id === row.provider_id)
			)
		)
			invalid();
		return { routes, models, providers, ...config };
	} catch (error) {
		const failure = controller.signal.aborted ? controller.signal.reason : error;
		controller.abort();
		throw failure;
	} finally {
		clearTimeout(timer);
	}
}
export function routeWrite(form: RouteFormData, editing: RouteListRow | null) {
	if (
		![form.model_id, form.provider_id, form.provider_model_name].every((value) => value.trim()) ||
		!String(form.priority).trim() ||
		!String(form.weight).trim() ||
		!Number.isSafeInteger(Number(form.priority)) ||
		!Number.isSafeInteger(Number(form.weight)) ||
		Number(form.weight) < 1
	)
		throw new Error('INVALID_ROUTE_FIELDS');
	const payload = buildRouteSavePayload(
		{ ...form, priority: Number(form.priority), weight: Number(form.weight) },
		editing
	);
	return {
		path: editing ? '/api/admin/routes/' + encodeURIComponent(editing.id) : '/api/admin/routes',
		init: jsonWrite(editing ? 'PATCH' : 'POST', payload),
	};
}
export function jsonWrite(method: string, data: unknown): RequestInit {
	return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
}
